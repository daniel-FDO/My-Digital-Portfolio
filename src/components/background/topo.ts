/* =========================================================
   TOPO — the 'topo' background (PortfolioBackground.tsx)
   Two canvases, fixed behind the page:
   - contours: fine topographic lines traced (marching squares) from a
     seeded noise height field, so the map is the same on every visit.
     Drawn once, and again after a resize; a theme change only
     repaints them in the new colours. A CSS mask keeps them to the
     upper-right and lower-left, and the middle quiet. They never move.
   - streak: now and then one small light crosses the screen
     diagonally (top / right edge → bottom / left), a tiny point with
     a short tapering trail, fading in and out near the edges. One at
     a time; 4–6 s across, then 8–15 s of nothing.
     It animates only while crossing (no loop in between), holds while
     the tab is hidden or the visitor has paused (the control beside
     the name), and never runs with reduced motion.
   Colours come from CSS custom properties on the root element
   (portfolio-background.css), read again whenever the theme changes;
   the trail's is an "r, g, b" triplet so it can fade in its own hue.
   ========================================================= */
import { calm, isAmbientPaused, motionQuery, onAmbientPause } from '../../lib/motion';

export const TOPO = {
  /** px between neighbouring lines, on average (small screens: fewer lines) */
  spacing: 19, mobileSpacing: 28,
  /** marching-squares cell, px */
  cell: 7, mobileCell: 9,
  /** every n-th line is terracotta */
  accentEvery: 11,
  /** the streak: crossing time and the pause after it (seconds, random in range) */
  cross: [4, 6] as [number, number],
  gap: [8, 15] as [number, number],
  /** the first one comes a little sooner */
  firstGap: [3, 6] as [number, number],
  /** trail length, px */
  trail: 150, mobileTrail: 95,
};

/* ---- Seeded value noise ---- */
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, seed: number) {
  return noise(x, y, seed) * 0.7 + noise(x * 2.03, y * 2.03, seed + 7) * 0.25 + noise(x * 4.1, y * 4.1, seed + 13) * 0.05;
}

/** The height at a point (px): slow noise, gently warped so lines flow, on a slope
    that runs the bands from upper left to lower right (as on a hillside) */
function height(x: number, y: number) {
  const s = 1 / 680;
  const wx = fbm(x * s * 0.6 + 3.1, y * s * 0.6 + 8.4, 5) - 0.5;
  const wy = fbm(x * s * 0.6 + 11.7, y * s * 0.6 + 1.3, 9) - 0.5;
  const u = x * s + wx * 1.1, v = y * s + wy * 1.1;
  return fbm(u, v, 3) * 1.55 + (u - v) * 0.42;
}

/** Contour segments: [x1, y1, x2, y2, …], plain and accent lines apart */
function trace(w: number, h: number, narrow: boolean) {
  const c = narrow ? TOPO.mobileCell : TOPO.cell;
  const nx = Math.ceil(w / c) + 2, ny = Math.ceil(h / c) + 2;
  const f = new Float32Array(nx * ny);
  let lo = Infinity, hi = -Infinity, grad = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = height((i - 1) * c, (j - 1) * c);
    f[j * nx + i] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // average slope per px, so the lines' spacing on screen is about `spacing`
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = f[j * nx + i];
    grad += Math.hypot(f[j * nx + i + 1] - v, f[(j + 1) * nx + i] - v) / c;
  }
  grad /= (nx - 1) * (ny - 1);
  const step = grad * (narrow ? TOPO.mobileSpacing : TOPO.spacing);
  const plain: number[] = [], accent: number[] = [];
  const first = Math.ceil(lo / step);
  for (let k = first; k * step < hi; k++) {
    const iso = k * step, out = k % TOPO.accentEvery === 0 ? accent : plain;
    for (let j = 0; j < ny - 1; j++) {
      const y0 = (j - 1) * c;
      for (let i = 0; i < nx - 1; i++) {
        const a = f[j * nx + i], b = f[j * nx + i + 1], d = f[(j + 1) * nx + i], e = f[(j + 1) * nx + i + 1];
        const m = (a > iso ? 1 : 0) | (b > iso ? 2 : 0) | (e > iso ? 4 : 0) | (d > iso ? 8 : 0);
        if (m === 0 || m === 15) continue;
        const x0 = (i - 1) * c;
        // where the line crosses each edge of the cell
        const T = () => [x0 + ((iso - a) / (b - a)) * c, y0];
        const R = () => [x0 + c, y0 + ((iso - b) / (e - b)) * c];
        const B = () => [x0 + ((iso - d) / (e - d)) * c, y0 + c];
        const L = () => [x0, y0 + ((iso - a) / (d - a)) * c];
        const seg = (p: number[], q: number[]) => out.push(p[0], p[1], q[0], q[1]);
        switch (m) {
          case 1: case 14: seg(L(), T()); break;
          case 2: case 13: seg(T(), R()); break;
          case 3: case 12: seg(L(), R()); break;
          case 4: case 11: seg(R(), B()); break;
          case 6: case 9: seg(T(), B()); break;
          case 7: case 8: seg(L(), B()); break;
          case 5: seg(L(), T()); seg(R(), B()); break;
          case 10: seg(T(), R()); seg(L(), B()); break;
        }
      }
    }
  }
  return { plain, accent };
}

export function createTopo(root: HTMLElement, contours: HTMLCanvasElement, streak: HTMLCanvasElement) {
  const cx = contours.getContext('2d')!, sx = streak.getContext('2d')!;
  let w = 0, h = 0, dpr = 1, narrow = false;
  let lines: ReturnType<typeof trace> = { plain: [], accent: [] };
  let col = { line: '', accent: '', head: '', trail: '' };
  const readColours = () => {
    const cs = getComputedStyle(root), v = (n: string) => cs.getPropertyValue(n).trim();
    col = { line: v('--topo-line'), accent: v('--topo-accent'), head: v('--streak-head'), trail: v('--streak-trail-rgb') };
  };

  /* ---- contours ---- */
  function paintContours() {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, w, h);
    cx.lineWidth = 1;
    for (const [segs, colour] of [[lines.plain, col.line], [lines.accent, col.accent]] as const) {
      cx.beginPath();
      for (let n = 0; n < segs.length; n += 4) { cx.moveTo(segs[n], segs[n + 1]); cx.lineTo(segs[n + 2], segs[n + 3]); }
      cx.strokeStyle = colour;
      cx.stroke();
    }
  }
  function layout() {
    w = innerWidth; h = innerHeight; narrow = w < 640;
    dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [contours, streak]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    lines = trace(w, h, narrow);
    paintContours();
    flight = null; drawStreak();
  }

  /* ---- the streak ---- */
  type Flight = { x: number; y: number; dx: number; dy: number; dist: number; dur: number; t: number };
  let flight: Flight | null = null, raf = 0, timer = 0, last = 0;
  const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);
  const smooth = (a: number, b: number, t: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const stopped = () => document.hidden || isAmbientPaused() || calm();

  function launch() {
    timer = 0;
    if (stopped()) return;
    // down and to the left, about 28° below level, give or take a few degrees
    const ang = ((180 - 28 + (Math.random() - 0.5) * 8) * Math.PI) / 180;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    // in from the top edge (right half), or now and then the upper right edge
    const fromTop = Math.random() < 0.7;
    const x = fromTop ? w * rand([0.52, 0.94]) : w;
    const y = fromTop ? 0 : h * rand([0.04, 0.32]);
    // out through the left or bottom edge
    const dist = Math.min(x / -dx, (h - y) / dy);
    flight = { x, y, dx, dy, dist, dur: rand(TOPO.cross) * 1000, t: 0 };
    last = 0; raf = requestAnimationFrame(frame);
  }
  function schedule(range: [number, number]) {
    clearTimeout(timer);
    timer = window.setTimeout(launch, rand(range) * 1000);
  }
  function drawStreak() {
    sx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sx.clearRect(0, 0, w, h);
    if (!flight) return;
    const { x, y, dx, dy, dist, dur, t } = flight;
    const p = Math.min(1, t / dur);
    const alpha = smooth(0, 0.16, p) * (1 - smooth(0.78, 1, p));
    if (alpha <= 0.002) return;
    const hx = x + dx * dist * p, hy = y + dy * dist * p;
    const len = Math.min(narrow ? TOPO.mobileTrail : TOPO.trail, dist * p);
    const tx = hx - dx * len, ty = hy - dy * len;
    // the trail: a thin wedge, widest at the head, fading out behind it
    const nx = -dy, ny = dx, half = 1.05;
    const g = sx.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, `rgba(${col.trail}, 1)`);
    g.addColorStop(0.45, `rgba(${col.trail}, 0.35)`);
    g.addColorStop(1, `rgba(${col.trail}, 0)`);
    sx.globalAlpha = alpha * 0.85;
    sx.fillStyle = g;
    sx.beginPath();
    sx.moveTo(hx + nx * half, hy + ny * half);
    sx.lineTo(tx, ty);
    sx.lineTo(hx - nx * half, hy - ny * half);
    sx.closePath();
    sx.fill();
    // the point: tiny, with the faintest halo
    const halo = sx.createRadialGradient(hx, hy, 0, hx, hy, 4.5);
    halo.addColorStop(0, `rgba(${col.trail}, 1)`);
    halo.addColorStop(1, `rgba(${col.trail}, 0)`);
    sx.globalAlpha = alpha * 0.35;
    sx.fillStyle = halo;
    sx.beginPath(); sx.arc(hx, hy, 4.5, 0, Math.PI * 2); sx.fill();
    sx.globalAlpha = alpha;
    sx.fillStyle = col.head;
    sx.beginPath(); sx.arc(hx, hy, 1.4, 0, Math.PI * 2); sx.fill();
    sx.globalAlpha = 1;
  }
  function frame(now: number) {
    raf = 0;
    if (!flight || stopped()) return;
    if (last) flight.t += Math.min(64, now - last);   // a long frame never jumps the light ahead
    last = now;
    drawStreak();
    if (flight.t >= flight.dur) { flight = null; drawStreak(); schedule(TOPO.gap); return; }
    raf = requestAnimationFrame(frame);
  }
  /** Pause / resume: a light mid-way holds where it is; with reduced motion it goes */
  function sync() {
    if (calm()) { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; flight = null; drawStreak(); return; }
    if (stopped()) { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); timer = 0; last = 0; return; }
    if (flight) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else if (!timer) schedule(TOPO.gap);
  }

  /* ---- start, and keep up with the page ---- */
  readColours();
  layout();
  if (!stopped()) schedule(TOPO.firstGap);

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    // not for the mobile address bar showing / hiding (height only, under 120px)
    resizeTimer = window.setTimeout(() => { if (innerWidth !== w || Math.abs(innerHeight - h) >= 120) { layout(); sync(); } }, 200);
  };
  const themeWatch = new MutationObserver(() => { readColours(); paintContours(); drawStreak(); });
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', sync);
  motionQuery.addEventListener('change', sync);
  const offPause = onAmbientPause(sync);

  return {
    destroy() {
      cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(resizeTimer);
      themeWatch.disconnect();
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', sync);
      motionQuery.removeEventListener('change', sync);
      offPause();
    },
    /** testing: send a light across now */
    launch() { clearTimeout(timer); launch(); },
  };
}
