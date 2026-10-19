/* =========================================================
   THE ID CARD ON ITS LANYARD
   A chain of points joined by sticks (verlet integration):
   rope points → the card's top (T) → the card's centre (C).
   The card is heavy, the rope is light. 120 small steps a second.
   Drag, throw, click / double-tap to flip; it drops in from above
   the first time the footer comes into view. Only runs while the
   footer is on screen, and sleeps once it's still.
   React owns the card's state (flipped / live / grabbing — Footer.tsx);
   this owns the physics and draws with transforms + SVG paths.
   ========================================================= */

export interface RigEls {
  foot: HTMLElement;
  space: HTMLElement;
  card: HTMLElement;
  clip: HTMLElement;
  tilt: HTMLElement;
  sheens: HTMLElement[];
  strapLine: SVGPathElement;
  edgeL: SVGPathElement;
  edgeR: SVGPathElement;
  threadL: SVGPathElement;
  threadR: SVGPathElement;
  logo: SVGGElement;
  claspTop: SVGGElement;
  claspHook: SVGGElement;
  hook: SVGGElement;
}

export interface RigCallbacks {
  /** the drop-in has started: the card and lanyard show */
  onLive: () => void;
  onGrab: (grabbing: boolean) => void;
  /** a click (mouse) or double-tap (touch) */
  onFlip: () => void;
}

interface Pt { x: number; y: number; px: number; py: number; im: number }
interface XY { x: number; y: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const SEGS = 8;                       // rope pieces
const DT = 1 / 120;
const GRAVITY = 2600;                 // px / s²
const ITER = 14;                      // constraint passes per step
// the strap and its hardware (sizes in the SVG's units, drawn for an 18px strap)
const CLASP = 26, SWIVEL = 9.7, MOUNT_B = 4, FOLD = 4;
const ROPE_IM = 1.1;                  // rope points: heavy enough to trail and bend behind the card
const BEND = 0.09;                    // how firmly the strap's top is held straight down by the anchor
const REST_TILT = -0.05;              // rad: the card hangs a touch askew (≈3°), drawn only — the physics is unchanged

export function createIdRig(els: RigEls, cb: RigCallbacks) {
  const { foot, space, card, clip, tilt, sheens, strapLine, edgeL, edgeR, threadL, threadR, logo, claspTop, claspHook, hook } = els;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DAMP = reduce ? 0.975 : 0.9955; // how quickly the swinging dies down

  let pts: Pt[] = [];                   // 0 = anchor (fixed) … SEGS = card top (T), SEGS+1 = card centre (C)
  let segLen = 10, half = 175, cardW = 250;
  let anchor: XY = { x: 0, y: 0 };
  let strapW = 18, hs = 1, hookY = -9;
  let inView = false;

  const point = (x: number, y: number, im: number): Pt => ({ x, y, px: x, py: y, im });
  function layout() {
    const cs = getComputedStyle(foot);
    const fr = foot.getBoundingClientRect();
    const sr = space.getBoundingClientRect();
    cardW = card.offsetWidth;
    half = card.offsetHeight / 2;
    const ropeLen = parseFloat(cs.getPropertyValue('--rope')) || 80;
    segLen = ropeLen / SEGS;
    strapW = parseFloat(cs.getPropertyValue('--strap-w')) || 18;
    hs = strapW / 18;
    // the clasp's hook sits just inside the top of the badge clip (card units, up = negative)
    hookY = clip.offsetTop + (parseFloat(cs.getPropertyValue('--hook-sink')) || 3);
    const ax = sr.left - fr.left + sr.width * (parseFloat(cs.getPropertyValue('--anchor-x')) || 0.5);
    const ay = sr.top - fr.top + (parseFloat(cs.getPropertyValue('--anchor-y')) || 0);
    if (!pts.length) {
      // hanging straight down, at rest
      for (let i = 0; i <= SEGS; i++) pts.push(point(ax, ay + i * segLen, i === 0 ? 0 : i === SEGS ? 1 / 3 : ROPE_IM));
      pts.push(point(ax, ay + ropeLen + half, 1 / 6));
    } else {
      // the page changed size: move everything along with the anchor
      const dx = ax - anchor.x, dy = ay - anchor.y;
      pts.forEach((p) => { p.x += dx; p.y += dy; p.px += dx; p.py += dy; });
    }
    anchor = { x: ax, y: ay };
    if (!dropping) { pts[0].x = pts[0].px = ax; pts[0].y = pts[0].py = ay; }
  }

  // keep a pair of points a set distance apart (rope = only when stretched)
  function link(a: Pt, b: Pt, len: number, ropeOnly: boolean) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    if (ropeOnly && d <= len) return;
    const w = a.im + b.im;
    if (!w) return;
    const k = (d - len) / d / w;
    a.x += dx * k * a.im; a.y += dy * k * a.im;
    b.x -= dx * k * b.im; b.y -= dy * k * b.im;
  }

  // dragging: the grabbed spot (u across, t down the card) follows the pointer
  let grab: { u: number; t: number; tx: number; ty: number; gx: number; gy: number } | null = null;
  let dropping: { t0: number; x: number; y: number; dur: number } | null = null;   // the drop-in: the anchor slides down from above
  let time = 0;

  function step() {
    time += DT;
    if (dropping) {
      // The whole rig falls together, faster and faster (like gravity).
      // When the hook arrives it stops; the card keeps its speed → it swings.
      const p = clamp((time - dropping.t0) / dropping.dur, 0, 1);
      const e = p * p;
      const dx = dropping.x + (anchor.x - dropping.x) * e - pts[0].x;
      const dy = dropping.y + (anchor.y - dropping.y) * e - pts[0].y;
      pts.forEach((pt) => { pt.x += dx; pt.y += dy; pt.px += dx; pt.py += dy; });
      if (p >= 1) {
        pts.forEach((pt, i) => { if (i) { pt.px -= dx; pt.py -= dy; } });
        dropping = null;
      }
    }
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = clamp((p.x - p.px) * DAMP, -45, 45);
      const vy = clamp((p.y - p.py) * DAMP, -45, 45);
      p.px = p.x; p.py = p.y;
      p.x += vx;
      p.y += vy + GRAVITY * DT * DT;
    }
    if (grab) {                         // ease the target towards the pointer (gives throws their speed)
      grab.gx += (grab.tx - grab.gx) * 0.35;
      grab.gy += (grab.ty - grab.gy) * 0.35;
    }
    const T = pts[SEGS], C = pts[SEGS + 1];
    for (let k = 0; k < ITER; k++) {
      for (let i = 0; i < SEGS; i++) link(pts[i], pts[i + 1], segLen, true);
      // the webbing leaves the anchor pointing down, so it bends into a curve when it swings
      for (let i = 1; i <= 3; i++) {
        const p = pts[i], f = BEND / i;
        p.x += (pts[0].x - p.x) * f;
        p.y += (pts[0].y + segLen * i - p.y) * f * 0.5;
      }
      link(T, C, half, false);
      if (grab) {
        const dl = Math.hypot(C.x - T.x, C.y - T.y) || 1;
        const downX = (C.x - T.x) / dl, downY = (C.y - T.y) / dl;
        const gx = T.x + downX * grab.t * half + downY * grab.u;
        const gy = T.y + downY * grab.t * half - downX * grab.u;
        const ex = grab.gx - gx, ey = grab.gy - gy;
        const wT = 1 - grab.t, wC = grab.t, n = 1 / (wT * wT + wC * wC);
        T.x += ex * wT * n; T.y += ey * wT * n;
        C.x += ex * wC * n; C.y += ey * wC * n;
      }
    }
  }

  // Draw: card (transform only), lanyard path, tilt and sheen
  let tiltY = 0, tiltX = 0, hoverX = 0, sheenPos = 0.55;
  function render() {
    const T = pts[SEGS], C = pts[SEGS + 1];
    const angle = Math.atan2(-(C.x - T.x), C.y - T.y);
    card.style.transform = `translate3d(${(T.x - cardW / 2).toFixed(2)}px, ${T.y.toFixed(2)}px, 0) rotate(${(angle + REST_TILT).toFixed(4)}rad)`;

    // a touch of 3D: the card turns slightly as it moves sideways
    const vx = (C.x - C.px) / DT, vy = (C.y - C.py) / DT;
    tiltY += (clamp(-vx * 0.014, -26, 26) - tiltY) * 0.2;
    tiltX += (clamp(vy * 0.006, -10, 10) - tiltX) * 0.2;
    tilt.style.transform = `rotateY(${tiltY.toFixed(2)}deg) rotateX(${tiltX.toFixed(2)}deg)`;

    // the sheen slides with the swing, the tilt and the cursor
    const goal = clamp(0.55 + angle * 1.6 - tiltY / 45 + hoverX * 0.7, -0.15, 1.75);
    sheenPos += (goal - sheenPos) * 0.15;
    const sx = (sheenPos * cardW).toFixed(1);
    sheens.forEach((el) => { el.style.transform = `translate3d(${sx}px, 0, 0)`; });

    // lanyard: a smooth curve through the rope points, sampled into a polyline
    const line: XY[] = [{ x: pts[0].x, y: pts[0].y }];
    let qx = pts[0].x, qy = pts[0].y;
    for (let i = 1; i < SEGS; i++) {
      const p = pts[i], q = pts[i + 1];
      const ex = (p.x + q.x) / 2, ey = (p.y + q.y) / 2;
      for (let k = 1; k <= 4; k++) {
        const t = k / 4, u = 1 - t;
        line.push({ x: u * u * qx + 2 * u * t * p.x + t * t * ex, y: u * u * qy + 2 * u * t * p.y + t * t * ey });
      }
      qx = ex; qy = ey;
    }
    line.push({ x: T.x, y: T.y });

    // the clasp, hinged at its swivel: the snap hook reaches from the badge clip (B)
    // up to the swivel (V), the D-ring from there up to the end of the strap (S)
    const dl = Math.hypot(C.x - T.x, C.y - T.y) || 1;
    const B = { x: T.x + ((C.x - T.x) / dl) * hookY, y: T.y + ((C.y - T.y) / dl) * hookY };
    const hit = reachBack(line, line.length - 1, B, (CLASP - SWIVEL) * hs);
    const V = hit.p;
    const top = reachBack(line, hit.j, V, SWIVEL * hs);
    const S = top.p;
    const strapPts = line.slice(0, top.j + 1);
    strapPts.push(S);
    const deg = (f: XY, t: XY) => (Math.atan2(-(t.x - f.x), t.y - f.y) * 180 / Math.PI).toFixed(2);
    claspTop.setAttribute('transform', `translate(${S.x.toFixed(2)} ${S.y.toFixed(2)}) rotate(${deg(S, V)}) scale(${hs.toFixed(3)})`);
    claspHook.setAttribute('transform', `translate(${V.x.toFixed(2)} ${V.y.toFixed(2)}) rotate(${deg(V, B)}) scale(${hs.toFixed(3)}) translate(0 ${-SWIVEL})`);

    // the strap, its edges (stitching) and two weave threads, all offset from one centre line
    const n = strapPts.length, nx: number[] = [], ny: number[] = [], len = [0];
    for (let i = 0; i < n; i++) {
      const a = strapPts[Math.max(0, i - 1)], b = strapPts[Math.min(n - 1, i + 1)];
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      nx.push(-(b.y - a.y) / tl); ny.push((b.x - a.x) / tl);
      if (i) len.push(len[i - 1] + Math.hypot(strapPts[i].x - strapPts[i - 1].x, strapPts[i].y - strapPts[i - 1].y));
    }
    const path = (o: number) => strapPts.map((p, i) => `${i ? 'L' : 'M'}${(p.x + nx[i] * o).toFixed(2)} ${(p.y + ny[i] * o).toFixed(2)}`).join('');
    const edge = strapW * 0.37, thread = strapW * 0.19;
    strapLine.setAttribute('d', path(0));
    edgeL.setAttribute('d', path(-edge)); edgeR.setAttribute('d', path(edge));
    threadL.setAttribute('d', path(-thread)); threadR.setAttribute('d', path(thread));

    // "dF": in the middle of the strap's visible stretch (between the anchor and the clasp)
    const total = len[n - 1];
    const a0 = MOUNT_B * hs, a1 = total - FOLD * hs, ls = (strapW * 0.62) / 24;
    if (a1 - a0 < 13 * ls) logo.style.display = 'none';
    else {
      logo.style.display = '';
      const mid = (a0 + a1) / 2;
      let i = 1;
      while (i < n - 1 && len[i] < mid) i++;
      const p = strapPts[i - 1], q = strapPts[i], t = (mid - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
      const la = Math.atan2(-(q.x - p.x), q.y - p.y) * 180 / Math.PI;
      logo.setAttribute('transform', `translate(${(p.x + (q.x - p.x) * t).toFixed(2)} ${(p.y + (q.y - p.y) * t).toFixed(2)}) rotate(${la.toFixed(2)}) scale(${ls.toFixed(4)})`);
    }
    hook.setAttribute('transform', `translate(${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}) scale(${hs.toFixed(3)})`);
  }

  // Walk back along a polyline from index i to the first spot exactly r away from P.
  // Returns that spot and the index of the last point before it. If the whole line
  // is closer than r (the card shoved up to the anchor), aims straight at the anchor.
  function reachBack(list: XY[], i: number, P: XY, r: number): { j: number; p: XY } {
    let j = i;
    while (j >= 0 && Math.hypot(list[j].x - P.x, list[j].y - P.y) < r) j--;
    if (j < 0) {
      const vx = list[0].x - P.x, vy = list[0].y - P.y, vl = Math.hypot(vx, vy) || 1;
      return { j: 0, p: { x: P.x + (vx / vl) * r, y: P.y + (vy / vl) * r } };
    }
    const a = list[j], b = j === i ? P : list[j + 1];   // P itself lies further along the line
    const da = Math.hypot(a.x - P.x, a.y - P.y), db = Math.hypot(b.x - P.x, b.y - P.y);
    const t = (da - r) / (da - db || 1);
    return { j, p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } };
  }

  // The loop: runs only while the footer is on screen, sleeps once it's still
  let raf = 0, last = 0, acc = 0, still = 0;
  function frame(now: number) {
    raf = 0;
    if (!inView) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    acc += dt;
    while (acc >= DT) { step(); acc -= DT; }
    render();
    let moving = 0;
    pts.forEach((p) => { moving = Math.max(moving, Math.abs(p.x - p.px) + Math.abs(p.y - p.py)); });
    still = moving < 0.012 && !grab && !dropping ? still + 1 : 0;
    if (still > 90 && Math.abs(hoverX) < 0.01) { last = 0; return; }   // asleep (woken by wake())
    raf = requestAnimationFrame(frame);
  }
  function wake() {
    still = 0;
    if (!raf && inView && pts.length) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
  }

  // Drop in from above the first time the footer comes into view
  let dropped = false;
  function dropIn() {
    if (dropped) return;
    dropped = true;
    layout();
    if (!reduce) {
      const fr = foot.getBoundingClientRect();
      // Start just above the top of the screen, a little to the right,
      // with the lanyard tilted — so it swings out when the hook stops.
      const lean = 0.5, cos = Math.cos(lean), sin = Math.sin(lean);
      pts.forEach((p) => {
        const rx = p.x - anchor.x, ry = p.y - anchor.y;
        p.x = anchor.x + rx * cos - ry * sin;
        p.y = anchor.y + rx * sin + ry * cos;
      });
      const fromY = Math.min(anchor.y - 260, -fr.top - (segLen * SEGS + half * 2) - 60);
      dropping = { t0: time, x: anchor.x + 120, y: fromY, dur: clamp(Math.sqrt((2 * (anchor.y - fromY)) / GRAVITY), 0.45, 1.1) };
      const dx = dropping.x - anchor.x, dy = fromY - anchor.y;
      pts.forEach((p) => { p.x += dx; p.y += dy; p.px = p.x; p.py = p.y; });
    }
    cb.onLive();
    render();
    wake();
  }

  // Is the footer (nearly) on screen? The loop starts/stops with it.
  const seen = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && dropped) wake();
  }, { rootMargin: '120px 0px' });
  seen.observe(foot);
  const arrive = new IntersectionObserver(([e]) => { if (e.isIntersecting) dropIn(); }, { rootMargin: '0px 0px -30% 0px' });
  arrive.observe(foot);

  // Keep everything in place when the window changes size
  let resizeQueued = 0;
  const resize = new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = requestAnimationFrame(() => {
      resizeQueued = 0;
      if (pts.length) { layout(); render(); wake(); }
    });
  });
  resize.observe(foot);

  /* ---- Drag, throw, flip ---- */
  const toFoot = (e: PointerEvent) => { const r = foot.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let down: { x: number; y: number; t: number; type: string; moved: number } | null = null, lastTap = 0;

  function onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!dropped) return;
    card.setPointerCapture(e.pointerId);
    const P = toFoot(e);
    const T = pts[SEGS], C = pts[SEGS + 1];
    const dl = Math.hypot(C.x - T.x, C.y - T.y) || 1;
    const downX = (C.x - T.x) / dl, downY = (C.y - T.y) / dl;
    const rx = P.x - T.x, ry = P.y - T.y;
    // where on the card we grabbed it (across, and down as a fraction of half its height)
    grab = { u: rx * downY - ry * downX, t: (rx * downX + ry * downY) / half, tx: P.x, ty: P.y, gx: P.x, gy: P.y };
    down = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType, moved: 0 };
    cb.onGrab(true);
    dropping = null;
    wake();
  }
  function onMove(e: PointerEvent) {
    if (grab && down) {
      const P = toFoot(e);
      // don't let it pull the lanyard much past its length
      const reach = segLen * SEGS + Math.hypot(grab.u, grab.t * half) + 24;
      const vx = P.x - anchor.x, vy = P.y - anchor.y, dist = Math.hypot(vx, vy);
      const s = dist > reach ? reach / dist : 1;
      grab.tx = anchor.x + vx * s;
      grab.ty = anchor.y + vy * s;
      down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
    } else if (e.pointerType === 'mouse') {
      const r = card.getBoundingClientRect();
      hoverX = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -0.6, 0.6);
      wake();
    }
  }
  function release(e: PointerEvent, cancelled: boolean) {
    if (!grab) return;
    grab = null;
    cb.onGrab(false);
    if (card.hasPointerCapture && card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId);
    // a short tap / click (not a drag) → flip. Mouse: one click. Touch: double-tap.
    if (!cancelled && down && down.moved < 6 && performance.now() - down.t < 350) {
      if (down.type === 'mouse') cb.onFlip();
      else if (performance.now() - lastTap < 350) { cb.onFlip(); lastTap = 0; }
      else lastTap = performance.now();
    }
    down = null;
    wake();
  }
  const onUp = (e: PointerEvent) => release(e, false);
  const onCancel = (e: PointerEvent) => release(e, true);   // e.g. the phone decided to scroll
  const onLeave = () => { if (!grab) { hoverX = 0; wake(); } };
  card.addEventListener('pointerdown', onDown);
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerup', onUp);
  card.addEventListener('pointercancel', onCancel);
  card.addEventListener('pointerleave', onLeave);

  return {
    /** ← / → on the keyboard give it a push */
    push(dir: -1 | 1) {
      if (!pts.length) return;
      pts[SEGS + 1].px += dir < 0 ? 9 : -9;
      wake();
    },
    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeQueued);
      seen.disconnect();
      arrive.disconnect();
      resize.disconnect();
      card.removeEventListener('pointerdown', onDown);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onCancel);
      card.removeEventListener('pointerleave', onLeave);
    },
  };
}
