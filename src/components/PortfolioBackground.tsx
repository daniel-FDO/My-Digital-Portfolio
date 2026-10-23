/* =========================================================
   PORTFOLIO BACKGROUND — EXPERIMENT (reversible)

   CURRENT LOOK: BACKGROUND_STYLE = 'topo' — fine topographic contour
   lines at the upper-right and lower-left (the middle stays quiet),
   in grey with the odd muted terracotta line, over the atmosphere's
   faint colour fields and grain below. Now and then a small light
   streaks diagonally across behind the page. The drawing and the
   streak live in background/topo.ts.

   ATMOSPHERE (BACKGROUND_STYLE = 'atmosphere'), the look before: a quiet backdrop:
   the near-black charcoal base with three very broad, very faint
   fields of colour (two burgundy, one neutral) kept towards the
   corners, so the text column stays dark and still. They drift and
   breathe on slow 70–110s loops (transform only: no lines, particles,
   pulses or blur filters), pause while the tab is hidden, and are
   still with reduced motion. The light theme has its own warm, pale
   version. A fine static grain sits over both.
   Set BACKGROUND_STYLE = 'contours' for the look before that, below.

   PREVIOUS LOOK ('contours'):
   Topographic contour lines around the edges of the screen, a faint
   burgundy glow in the top-right corner (near the red "D" widget)
   and a fine static grain, on the page's near-black base.

   TO SWITCH IT OFF: set ENABLE_BACKGROUND_EXPERIMENT to false below.
   The page then has its original plain background. To remove it for
   good: delete this file, src/styles/portfolio-background.css and the
   <PortfolioBackground /> line in App.tsx.

   - The contours are drawn once (and again after a resize): closed,
     irregular elevation lines around "hills" placed just off the
     corners. Each hill is split in two layers (odd / even lines)
     that drift on slightly different 26s loops, so the lines shift
     against each other instead of the whole pattern sliding.
   - Desktop (precise pointer): up to 8px of eased pointer parallax,
     written straight to one element (no React updates per frame).
   - Paused while the tab is hidden; still for reduced motion; fewer
     lines and no parallax on small / touch screens.
   - Fixed behind everything: never takes clicks, never scrolls.

   MORE LIFE (LIFE below; LIFE.enabled = false gives exactly the version
   above): each hill's layers drift on their own 25-40s loops, so
   they slide past each other; now and then a faint
   muted-red highlight travels a short way along a real contour; the
   glow wanders along the top-right edges; on desktop the hills nearest
   the pointer lean gently towards it and settle back. All of it stays
   in the outer margins (the mask keeps the middle calm).
   ========================================================= */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { calm, onAmbientPause, isAmbientPaused } from '../lib/motion';
import { createTopo } from './background/topo';
import '../styles/portfolio-background.css';

export const ENABLE_BACKGROUND_EXPERIMENT = true;
/** 'topo' (contours + a passing light, the current look), 'atmosphere' (quiet gradients only)
    or 'contours' (the older drifting hills) */
export const BACKGROUND_STYLE: 'topo' | 'atmosphere' | 'contours' = 'topo';

/** The livelier version, and its settings (enabled: false = the previous version) */
export const LIFE = {
  enabled: true,
  /** layers per hill (rings split by index), and each one's seamless loop, in seconds.
      3 layers deform more, but cost about a frame in four while scrolling on a modest GPU */
  flow: { layers: 2, mobileLayers: 2, durations: [27, 38, 33] },
  /** travelling highlights: seconds between them (random in range), how long each takes, at most at once */
  traces: { every: [4.5, 8] as [number, number], mobileEvery: [9, 15] as [number, number], duration: 3.4, max: 2 },
  /** the glow's wander along the edges, seconds per loop */
  glow: { duration: 36 },
  /** hills near the pointer lean towards it: within `reach` px, by up to `pull` px (desktop) */
  pointer: { reach: 420, pull: 12 },
};

const PARALLAX = 8;   // px, at most
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/* ---- A small seeded random, so the map is the same on every visit ---- */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A closed smooth path through points (Catmull-Rom → cubic Béziers) */
function smoothClosed(pts: [number, number][]) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

interface Hill {
  /** centre and radius, as fractions: x of the width, y and r of the height */
  x: number; y: number; r: number;
  rings: number;
  seed: number;
  /** drawn on narrow screens too */
  mobile?: boolean;
}

// Just off the corners and edges, spaced so their lines (almost) never meet
const HILLS: Hill[] = [
  { x: -0.07, y: -0.12, r: 0.62, rings: 13, seed: 11, mobile: true },
  { x: 1.06, y: 0.06, r: 0.5, rings: 11, seed: 23 },
  { x: 0.93, y: 1.14, r: 0.56, rings: 12, seed: 37, mobile: true },
  { x: 0.03, y: 1.1, r: 0.4, rings: 9, seed: 41 },
  { x: -0.12, y: 0.52, r: 0.26, rings: 6, seed: 53 },
];

interface Layer {
  key: string;
  box: { left: number; top: number; width: number; height: number };
  origin: string;
  paths: { d: string; index: boolean }[];
  /** which drift loop, and how far into it it starts */
  anim: number;
  delay: number;
  /** its hill, and which of the hill's layers (front = 0) */
  hill: number;
  group: number;
  /** its loop length, seconds (LIFE.flow) */
  duration?: number;
  /** where its hill's lines are on screen (for the pointer) */
  anchor: [number, number];
}

/** Every hill's lines, in screen pixels, split into layers (odd / even, or more with LIFE) */
function buildLayers(w: number, h: number, groups: number, durations?: number[]): Layer[] {
  const narrow = w < 640;
  const layers: Layer[] = [];
  HILLS.filter((hill) => !narrow || hill.mobile).forEach((hill, hi) => {
    const rand = rng(hill.seed);
    const scale = narrow ? Math.max(h * 0.85, w * 1.1) : h;
    const R = hill.r * scale;
    const cx = hill.x * w, cy = hill.y * h;
    // The slope: rings drift off-centre as they grow (one side steeper)
    const slope = rand() * Math.PI * 2, lean = 0.12 + rand() * 0.12;
    // Shape: a few slow waves around the ring, each changing as the rings grow
    const waves = [1, 2, 3, 5].map((j) => ({ j, a: (0.11 / j) * (0.6 + rand() * 0.8), phase: rand() * Math.PI * 2, turn: (rand() - 0.5) * 0.5 }));
    const rings: { d: string; index: boolean; bbox: number[] }[] = [];
    const n = narrow ? Math.ceil(hill.rings * 0.7) : hill.rings;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      // Irregular spacing: tighter near the top, with a little jitter
      const rk = R * Math.pow(t, 0.8) * (0.96 + rand() * 0.08);
      const ox = cx + Math.cos(slope) * lean * R * t, oy = cy + Math.sin(slope) * lean * R * t;
      const pts: [number, number][] = [];
      const steps = 56;
      for (let s = 0; s < steps; s++) {
        const th = (s / steps) * Math.PI * 2;
        let f = 1;
        for (const wv of waves) f += wv.a * (0.55 + 0.45 * t) * Math.sin(wv.j * th + wv.phase + wv.turn * k);
        pts.push([ox + Math.cos(th) * rk * f, oy + Math.sin(th) * rk * f]);
      }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      rings.push({ d: smoothClosed(pts), index: k % 4 === 0, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
    // Each layer only as big as its lines on screen (+ room to drift)
    const pad = 40;
    for (let parity = 0; parity < groups; parity++) {
      const mine = rings.filter((_, i) => i % groups === parity);
      if (!mine.length) continue;
      const left = Math.max(-pad, Math.min(...mine.map((r) => r.bbox[0])) - pad);
      const top = Math.max(-pad, Math.min(...mine.map((r) => r.bbox[1])) - pad);
      const right = Math.min(w + pad, Math.max(...mine.map((r) => r.bbox[2])) + pad);
      const bottom = Math.min(h + pad, Math.max(...mine.map((r) => r.bbox[3])) + pad);
      if (right <= left || bottom <= top) continue;
      layers.push({
        key: `${hi}-${parity}`,
        box: { left, top, width: right - left, height: bottom - top },
        origin: `${(cx - left).toFixed(0)}px ${(cy - top).toFixed(0)}px`,
        paths: mine.map((r) => ({ d: r.d, index: r.index })),
        anim: (hi + parity) % 3,
        delay: -((hi * 7 + parity * 11) % (durations?.[parity] ?? 26)),
        hill: hi, group: parity,
        duration: durations?.[parity],
        anchor: [Math.min(w, Math.max(0, cx)), Math.min(h, Math.max(0, cy))],
      });
    }
  });
  return layers;
}

export function PortfolioBackground() {
  if (BACKGROUND_STYLE === 'topo') return <Topo />;
  return BACKGROUND_STYLE === 'atmosphere' ? <Atmosphere /> : <ContourBackground />;
}

/** Contours and the passing light (background/topo.ts), on the atmosphere's colour fields */
function Topo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLCanvasElement>(null);
  const streakRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ENABLE_BACKGROUND_EXPERIMENT) return;
    const root = rootRef.current!;
    document.documentElement.classList.add('pbg-on');
    const topo = createTopo(root, linesRef.current!, streakRef.current!);
    // the colour fields' slow drift holds while hidden or paused, like the light
    const sync = () => root.classList.toggle('is-paused', document.hidden || isAmbientPaused());
    sync();
    document.addEventListener('visibilitychange', sync);
    const offPause = onAmbientPause(sync);
    if (import.meta.env.DEV) (window as unknown as { __topo?: typeof topo }).__topo = topo;
    return () => {
      topo.destroy(); offPause();
      document.removeEventListener('visibilitychange', sync);
      document.documentElement.classList.remove('pbg-on');
    };
  }, []);
  if (!ENABLE_BACKGROUND_EXPERIMENT) return null;
  return (
    <div className="pbg pbg--air pbg--topo" ref={rootRef} aria-hidden="true">
      <div className="pbg__air pbg__air--a"></div>
      <div className="pbg__air pbg__air--b"></div>
      <canvas className="pbg__lines" ref={linesRef}></canvas>
      <canvas className="pbg__streak" ref={streakRef}></canvas>
      <div className="pbg__grain"></div>
    </div>
  );
}

/** The quiet backdrop: three broad, faint fields of colour, slowly drifting (CSS only) */
function Atmosphere() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ENABLE_BACKGROUND_EXPERIMENT) return;
    document.documentElement.classList.add('pbg-on');
    const sync = () => rootRef.current?.classList.toggle('is-paused', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { document.documentElement.classList.remove('pbg-on'); document.removeEventListener('visibilitychange', sync); };
  }, []);
  if (!ENABLE_BACKGROUND_EXPERIMENT) return null;
  return (
    <div className="pbg pbg--air" ref={rootRef} aria-hidden="true">
      <div className="pbg__air pbg__air--a"></div>
      <div className="pbg__air pbg__air--b"></div>
      <div className="pbg__air pbg__air--c"></div>
      <div className="pbg__grain"></div>
    </div>
  );
}

function ContourBackground() {
  if (!ENABLE_BACKGROUND_EXPERIMENT) return null;
  return <Background />;
}

function Background() {
  const rootRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => ({ w: innerWidth, h: innerHeight }));
  const narrow = size.w < 640;
  const groups = LIFE.enabled ? (narrow ? LIFE.flow.mobileLayers : LIFE.flow.layers) : 2;
  const layers = useMemo(() => buildLayers(size.w, size.h, groups, LIFE.enabled ? LIFE.flow.durations : undefined), [size, groups]);
  const moverRefs = useRef<(HTMLDivElement | null)[]>([]);
  // The layers, grouped by hill (LIFE: one mover per hill leans towards the pointer)
  const hills = useMemo(() => {
    const m = new Map<number, { anchor: [number, number]; layers: Layer[] }>();
    layers.forEach((l) => { if (!m.has(l.hill)) m.set(l.hill, { anchor: l.anchor, layers: [] }); m.get(l.hill)!.layers.push(l); });
    return [...m.values()];
  }, [layers]);

  // The page's own background steps back (html keeps the base colour)
  useEffect(() => {
    document.documentElement.classList.add('pbg-on');
    return () => document.documentElement.classList.remove('pbg-on');
  }, []);

  // Redraw after a resize settles (not on every pixel of a drag, and not for
  // the mobile address bar showing / hiding: height changes under 120px)
  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setSize((s) => (
        s.w === innerWidth && Math.abs(s.h - innerHeight) < 120 ? s : { w: innerWidth, h: innerHeight }
      )), 200);
    };
    addEventListener('resize', onResize);
    return () => { removeEventListener('resize', onResize); clearTimeout(timer); };
  }, []);

  // Pause the drift while the tab is hidden
  useEffect(() => {
    const sync = () => rootRef.current?.classList.toggle('is-paused', document.hidden);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Pointer parallax: precise pointers only, eased, at most PARALLAX px.
  // LIFE: each layer by its depth, plus the hills near the pointer leaning towards it.
  useEffect(() => {
    let raf = 0, tx = 0, ty = 0, x = 0, y = 0, px = -1e4, py = -1e4;
    const el = shiftRef.current!;
    const lean = hills.map(() => [0, 0]);
    const frame = () => {
      raf = 0;
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      let moving = Math.abs(tx - x) > 0.02 || Math.abs(ty - y) > 0.02;
      el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      if (LIFE.enabled) {
        // each hill near the pointer leans towards it, then settles back
        const { reach, pull } = LIFE.pointer;
        hills.forEach((h, i) => {
          const dx = px - h.anchor[0], dy = py - h.anchor[1], dist = Math.hypot(dx, dy);
          const k = dist > 0 ? (Math.exp(-((dist / reach) ** 2)) * pull) / dist : 0;
          const g = lean[i], gx = dx * k, gy = dy * k;
          g[0] += (gx - g[0]) * 0.07;
          g[1] += (gy - g[1]) * 0.07;
          if (Math.abs(gx - g[0]) > 0.02 || Math.abs(gy - g[1]) > 0.02) moving = true;
          const m = moverRefs.current[i];
          if (m) m.style.transform = Math.abs(g[0]) + Math.abs(g[1]) < 0.05 ? '' : `translate3d(${g[0].toFixed(2)}px,${g[1].toFixed(2)}px,0)`;
        });
      }
      if (moving) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !finePointer.matches || calm() || document.hidden) return;
      tx = -((e.clientX / innerWidth) * 2 - 1) * PARALLAX;
      ty = -((e.clientY / innerHeight) * 2 - 1) * PARALLAX;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const reset = () => { tx = 0; ty = 0; px = py = -1e4; if (!raf) raf = requestAnimationFrame(frame); };
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    return () => {
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', reset);
      cancelAnimationFrame(raf);
      el.style.transform = '';
      moverRefs.current.forEach((m) => { if (m) m.style.transform = ''; });
    };
  }, [hills]);

  // LIFE: now and then, a faint highlight travels a short way along a real contour
  useEffect(() => {
    if (!LIFE.enabled) return;
    const { every, mobileEvery, duration, max } = LIFE.traces;
    const [lo, hi] = narrow ? mobileEvery : every;
    const root = rootRef.current!;
    let timer = 0, live = 0;
    const next = () => { timer = window.setTimeout(spawn, (lo + Math.random() * (hi - lo)) * 1000); };
    function spawn() {
      if (!document.hidden && !calm() && live < max) {
        const svgs = root.querySelectorAll<SVGSVGElement>('.pbg__layer');
        const svg = svgs[Math.floor(Math.random() * svgs.length)];
        const paths = svg ? [...svg.querySelectorAll<SVGPathElement>('path:not(.pbg__trace)')] : [];
        // the outer half of a hill's rings: the ones that run along the edges
        const ring = paths[Math.min(paths.length - 1, Math.floor(paths.length / 2 + Math.random() * Math.ceil(paths.length / 2)))];
        if (ring) {
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          t.setAttribute('d', ring.getAttribute('d')!);
          t.setAttribute('pathLength', '1');
          t.setAttribute('class', 'pbg__trace');
          const from = Math.random();
          t.style.setProperty('--from', String(from));
          t.style.setProperty('--to', String(from - 0.16));
          t.style.animationDuration = `${duration}s`;
          live++;
          t.addEventListener('animationend', () => { t.remove(); live--; }, { once: true });
          svg.appendChild(t);
        }
      }
      next();
    }
    next();
    return () => { clearTimeout(timer); root.querySelectorAll('.pbg__trace').forEach((t) => t.remove()); };
  }, [narrow, layers]);

  return (
    <div className={`pbg${LIFE.enabled ? ' pbg--life' : ''}`} ref={rootRef} aria-hidden="true"
      style={LIFE.enabled ? ({ '--glow-loop': `${LIFE.glow.duration}s` } as CSSProperties) : undefined}>
      <div className="pbg__glow"></div>
      <div className="pbg__shift" ref={shiftRef}>
        <div className="pbg__map">
          {(LIFE.enabled ? hills : [{ anchor: [0, 0] as [number, number], layers }]).map((h, hi) => {
            const svgs = h.layers.map((l) => (
              <svg
                key={l.key} className={`pbg__layer pbg__layer--${l.anim}`}
                width={l.box.width} height={l.box.height} viewBox={`${l.box.left} ${l.box.top} ${l.box.width} ${l.box.height}`}
                style={{ left: l.box.left, top: l.box.top, transformOrigin: l.origin, animationDelay: `${l.delay}s`, animationDuration: l.duration ? `${l.duration}s` : undefined } as CSSProperties}
                focusable="false"
              >
                {l.paths.map((p, i) => <path key={i} d={p.d} className={p.index ? 'is-index' : undefined} />)}
              </svg>
            ));
            // LIFE: each hill in its own mover, so it can lean towards the pointer
            return LIFE.enabled
              ? <div key={hi} className="pbg__mover" ref={(el) => { moverRefs.current[hi] = el; }}>{svgs}</div>
              : svgs;
          })}
        </div>
      </div>
      <div className="pbg__grain"></div>
    </div>
  );
}
