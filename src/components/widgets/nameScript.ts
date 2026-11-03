/* =========================================================
   THE HANDWRITTEN NAME (DanielTile.tsx)
   "Daniel" as one monoline pen stroke (the D, then "aniel" in one go),
   the i's dot tapped on, and the red full stop stamped at the end.
   - The red full stop IS the pen: it writes the name live when the card
     first comes into view (after the preloader), taps the i, then hops
     to the end of the line and lands as the full stop.
   - The ink is a string: sweep the pointer across it and it bends and
     wobbles back; grab it and pull, and it stretches like a rubber band
     and twangs when let go (mouse, pen or a sideways swipe on touch,
     which still leaves vertical scrolling to the page).
   - Click / tap / Enter / Space: the pen eats the ink back and writes it
     again, a little differently each time, like a real signature.
     ← / → pluck the line from either end.
   - Reduced motion: the name is simply there; a click or Enter shows a
     new take straight away; nothing wobbles.
   - SVG paths rebuilt from sampled points while something moves; the
     loop sleeps as soon as everything is still, and a write in progress
     jumps to its end when the card leaves the screen or the tab hides.
   ========================================================= */
import { useEffect, type RefObject } from 'react';
import { calm, isAmbientPaused } from '../../lib/motion';
import { onPreloaderDone } from '../../lib/preloader';

/* ---- The letters (units: baseline y = 100, x-height ≈ 56, ascender ≈ 2).
   Points are threaded with a centripetal Catmull–Rom spline; [x, y, 1]
   is a corner, where the pen turns sharply. ---- */
type Pt = [number, number] | [number, number, 1];
const STROKES: Pt[][] = [
  // D: up the stem, round the bowl, past the stem
  [[15, 98], [18, 52], [21, 7, 1], [58, 6], [86, 25], [94, 55], [82, 86], [50, 100], [18, 99], [5, 94]],
  // a n i e l, without lifting the pen
  [[157, 64], [146, 55], [129, 57], [117, 70], [116, 88], [126, 99], [141, 96], [152, 80], [158, 57, 1],
    [156, 84], [160, 98], [170, 96], [178, 80], [184, 57, 1], [183, 100, 1], [185, 80], [194, 62], [207, 56], [217, 64], [219, 84], [222, 97], [232, 97],
    [240, 80], [245, 57, 1], [243, 88], [248, 99], [260, 95],
    [276, 84], [290, 72], [289, 58], [277, 55], [266, 65], [265, 86], [276, 99], [293, 98], [306, 86],
    [318, 62], [328, 30], [331, 8], [325, 1], [316, 9], [313, 42], [314, 78], [321, 96], [333, 99], [345, 93]],
];
const TITTLE: [number, number] = [247, 37];
const STOP: [number, number] = [358, 95];
/** The SVG's viewBox (DanielTile.tsx); the ink may overshoot it while it wobbles */
export const VIEWBOX = '-4 -12 392 124';
export const INK_WIDTH = 7;

const STEP = 1.6;                    // sample spacing along the line
const WRITE_S = 1.85;                // both strokes, end to end (seconds)
const ERASE_S = 0.5;
const PEN_R = INK_WIDTH / 2 + 0.9;   // the red pen, slightly wider than its line
const STOP_R = 7.5, TITTLE_R = 4.3;
// the string: spring home, tension along the line, damping (per second)
const K = 40, TENSION = 4000, DAMP = 3.4, DT = 1 / 120, MAX_OFF = 48;
const SWEEP_R = 15, SWEEP_GAIN = 0.3, GRAB_R = 18, GRAB_SIGMA = 24, GRAB_K = 1500, MAX_PULL = 42;

/* ---- A take: the same letters, a slightly different hand each time ---- */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function takeOf(seed: number) {
  const r = rng(seed * 7919 + 13);
  const slant = seed ? (r() - 0.4) * 0.09 : 0, sx = seed ? 0.975 + r() * 0.04 : 1;
  const amp = seed ? 0.5 + r() * 1.4 : 0, ph = r() * 6.28, j = seed ? 2.2 : 0;
  const map = (x: number, y: number, jx = 0, jy = 0): [number, number] =>
    [x * sx + (100 - y) * slant + jx, y + amp * Math.sin(x / 62 + ph) + jy];
  return {
    strokes: STROKES.map((s) => s.map((p): Pt => {
      const [x, y] = map(p[0], p[1], (r() - 0.5) * j, (r() - 0.5) * j);
      return p[2] ? [x, y, 1] : [x, y];
    })),
    tittle: map(TITTLE[0], TITTLE[1], (r() - 0.5) * j * 2, (r() - 0.5) * j * 1.5),
    stop: map(STOP[0], STOP[1]),
  };
}

/* ---- Sampling the spline into evenly spaced points ---- */
function sampleStroke(stroke: Pt[]): number[] {
  const out: number[] = [stroke[0][0], stroke[0][1]];
  const runs: Pt[][] = [];
  let cur: Pt[] = [stroke[0]];
  for (let i = 1; i < stroke.length; i++) {
    cur.push(stroke[i]);
    if (stroke[i][2] && i < stroke.length - 1) { runs.push(cur); cur = [stroke[i]]; }
  }
  runs.push(cur);
  for (const run of runs) {
    const P = run.map((p) => [p[0], p[1]]);
    const a = P[0], b = P[1], y = P[P.length - 1], z = P[P.length - 2];
    const E = [[2 * a[0] - b[0], 2 * a[1] - b[1]], ...P, [2 * y[0] - z[0], 2 * y[1] - z[1]]];
    for (let i = 1; i < E.length - 2; i++) {
      const p0 = E[i - 1], p1 = E[i], p2 = E[i + 1], p3 = E[i + 2];
      const d = (u: number[], v: number[]) => Math.max(1e-4, Math.sqrt(Math.hypot(v[0] - u[0], v[1] - u[1])));
      const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / STEP));
      const L = (u: number[], v: number[], ta: number, tb: number, t: number) =>
        [((tb - t) * u[0] + (t - ta) * v[0]) / (tb - ta), ((tb - t) * u[1] + (t - ta) * v[1]) / (tb - ta)];
      for (let k = 1; k <= n; k++) {
        const t = t1 + ((t2 - t1) * k) / n;
        const A1 = L(p0, p1, 0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t);
        const B1 = L(A1, A2, 0, t2, t), B2 = L(A2, A3, t1, t3, t);
        const C = L(B1, B2, t1, t2, t);
        out.push(C[0], C[1]);
      }
    }
  }
  return out;
}

interface Geometry {
  n: number;                 // line points; index n = the i's dot, n + 1 = the full stop
  rx: Float32Array; ry: Float32Array;
  arc: Float32Array;         // distance along its own stroke
  pace: Float32Array;        // writing time along its own stroke (0 → 1)
  first: number[]; last: number[];   // each stroke's index range
  len: number[];             // each stroke's length
}
function build(seed: number): Geometry {
  const t = takeOf(seed);
  const flat = t.strokes.map(sampleStroke);
  const n = flat.reduce((s, f) => s + f.length / 2, 0);
  const rx = new Float32Array(n + 2), ry = new Float32Array(n + 2);
  const arc = new Float32Array(n), pace = new Float32Array(n);
  const first: number[] = [], last: number[] = [], len: number[] = [];
  let i = 0;
  for (const f of flat) {
    first.push(i);
    const m = f.length / 2;
    for (let k = 0; k < m; k++) { rx[i + k] = f[2 * k]; ry[i + k] = f[2 * k + 1]; }
    let s = 0;
    for (let k = 1; k < m; k++) { s += Math.hypot(rx[i + k] - rx[i + k - 1], ry[i + k] - ry[i + k - 1]); arc[i + k] = s; }
    // a hand slows into turns and at the start and end of a stroke
    let w = 0;
    for (let k = 1; k < m; k++) {
      const seg = arc[i + k] - arc[i + k - 1];
      let turn = 0;
      if (k < m - 1) {
        const a1 = Math.atan2(ry[i + k] - ry[i + k - 1], rx[i + k] - rx[i + k - 1]);
        const a2 = Math.atan2(ry[i + k + 1] - ry[i + k], rx[i + k + 1] - rx[i + k]);
        turn = Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      }
      w += seg * (1 + 5 * turn + 0.9 * Math.exp(-arc[i + k] / 18) + 0.6 * Math.exp(-(s - arc[i + k]) / 18));
      pace[i + k] = w;
    }
    for (let k = 1; k < m; k++) pace[i + k] /= w;
    len.push(s);
    i += m;
    last.push(i - 1);
  }
  rx[n] = t.tittle[0]; ry[n] = t.tittle[1];
  rx[n + 1] = t.stop[0]; ry[n + 1] = t.stop[1];
  return { n, rx, ry, arc, pace, first, last, len };
}

/* ---- Timeline helpers ---- */
const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
/** first index in [lo, hi] whose value is ≥ v */
function seek(a: Float32Array, lo: number, hi: number, v: number) {
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

type Mode = 'blank' | 'write' | 'erase' | 'rest';
interface Els { word: HTMLElement; svg: SVGSVGElement; ink: SVGPathElement[]; tittle: SVGCircleElement; stop: SVGEllipseElement }

export function createNameScript(els: Els, blank: boolean) {
  const { word, svg, ink, tittle, stop } = els;
  let g = build(0), takes = 0;
  let N = g.n + 2;
  let ox = new Float32Array(N), oy = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  let mode: Mode = blank ? 'blank' : 'rest', clock = 0, raf = 0, last = 0, awake = false, alive = true;
  // what's drawn: per stroke, the length of ink; the pen; the dot's and the stop's own little springs
  let drawn = g.len.map(() => (blank ? 0 : Infinity));
  let pen = { x: g.rx[0], y: g.ry[0], r: 0 };
  let dotScale = blank ? 0 : 1, dotV = 0, dotTarget = blank ? 0 : 1;
  let squash = 0, squashV = 0, stopShown = !blank;
  let grab: { id: number; i: number; px: number; py: number } | null = null;
  const sweepAt = new Map<number, { x: number; y: number; t: number }>();
  let plan: { at: number; run: (u: number) => void; dur: number; done?: () => void }[] = [];

  const reset = () => { ox.fill(0); oy.fill(0); vx.fill(0); vy.fill(0); };

  /* ---- drawing ---- */
  const strokeD = (s: number) => {
    const a = g.first[s], b = g.last[s], want = drawn[s];
    if (want <= 0) return '';
    const end = want >= g.len[s] ? b : seek(g.arc, a, b, want);
    let d = `M${(g.rx[a] + ox[a]).toFixed(1)} ${(g.ry[a] + oy[a]).toFixed(1)}`;
    for (let i = a + 1; i < end; i++) d += `L${(g.rx[i] + ox[i]).toFixed(1)} ${(g.ry[i] + oy[i]).toFixed(1)}`;
    if (end > a) {
      // the last piece: up to exactly where the pen is
      const u = want >= g.len[s] ? 1 : (want - g.arc[end - 1]) / Math.max(1e-4, g.arc[end] - g.arc[end - 1]);
      const x = g.rx[end - 1] + ox[end - 1] + (g.rx[end] + ox[end] - g.rx[end - 1] - ox[end - 1]) * u;
      const y = g.ry[end - 1] + oy[end - 1] + (g.ry[end] + oy[end] - g.ry[end - 1] - oy[end - 1]) * u;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };
  /** where the pen's tip is on stroke s after `len` of ink */
  const tipAt = (s: number, len: number) => {
    const a = g.first[s], b = g.last[s];
    const i = Math.max(a, Math.min(b, seek(g.arc, a, b, Math.max(0, len))));
    return { x: g.rx[i] + ox[i], y: g.ry[i] + oy[i] };
  };
  const render = () => {
    ink.forEach((p, s) => p.setAttribute('d', strokeD(s)));
    const n = g.n;
    tittle.setAttribute('cx', (g.rx[n] + ox[n]).toFixed(1));
    tittle.setAttribute('cy', (g.ry[n] + oy[n]).toFixed(1));
    tittle.setAttribute('r', Math.max(0, TITTLE_R * dotScale).toFixed(2));
    let x = pen.x, y = pen.y, r = pen.r;
    if (mode === 'rest' || (mode === 'blank' && stopShown)) { x = g.rx[n + 1] + ox[n + 1]; y = g.ry[n + 1] + oy[n + 1]; r = STOP_R; }
    if (mode === 'blank' && !stopShown) r = 0;
    // squash about its foot
    const ryR = r * (1 - squash), rxR = r * (1 + squash * 0.7);
    stop.setAttribute('cx', x.toFixed(1));
    stop.setAttribute('cy', (y + (r - ryR)).toFixed(1));
    stop.setAttribute('rx', Math.max(0, rxR).toFixed(2));
    stop.setAttribute('ry', Math.max(0, ryR).toFixed(2));
  };

  /* ---- the write and erase timelines ---- */
  const hop = (from: () => { x: number; y: number }, to: () => { x: number; y: number }, lift: number, r0: number, r1: number) => (u: number) => {
    const a = from(), b = to(), e = ease(u);
    const top = Math.min(a.y, b.y) - lift;
    pen.x = a.x + (b.x - a.x) * e;
    pen.y = (1 - e) * (1 - e) * a.y + 2 * e * (1 - e) * top + e * e * b.y;
    pen.r = r0 + (r1 - r0) * e;
  };
  const writePlan = () => {
    const total = g.len[0] * 1 + g.len[1];
    const T = g.len.map((l) => (WRITE_S * l) / total);
    let at = 0;
    const steps: typeof plan = [];
    const put = (dur: number, run: (u: number) => void, done?: () => void) => { steps.push({ at, dur, run, done }); at += dur; };
    const from = { ...pen };
    put(0.22, hop(() => from, () => tipAt(0, 0), 10, from.r, PEN_R));
    g.len.forEach((l, s) => {
      if (s > 0) put(0.17, hop(() => tipAt(s - 1, Infinity), () => tipAt(s, 0), 16, PEN_R, PEN_R));
      put(T[s], (u) => {
        // follow the hand's pace: u is time, the ink length comes from it
        const a = g.first[s], b = g.last[s];
        const i = seek(g.pace, a + 1, b, u);
        const p0 = g.pace[i - 1] ?? 0, p1 = g.pace[i];
        const f = p1 > p0 ? (u - p0) / (p1 - p0) : 1;
        drawn[s] = u >= 1 ? l : g.arc[i - 1] + (g.arc[i] - g.arc[i - 1]) * Math.min(1, Math.max(0, f));
        const t = tipAt(s, drawn[s]);
        pen.x = t.x; pen.y = t.y;
      }, () => { drawn[s] = l; });
    });
    const n = g.n;
    const dot = () => ({ x: g.rx[n] + ox[n], y: g.ry[n] + oy[n] });
    const home = () => ({ x: g.rx[n + 1] + ox[n + 1], y: g.ry[n + 1] + oy[n + 1] });
    put(0.24, hop(() => tipAt(g.len.length - 1, Infinity), dot, 14, PEN_R, PEN_R), () => { dotTarget = 1; dotV = 9; });
    put(0.07, () => { /* the tap */ });
    put(0.36, hop(dot, home, 22, PEN_R, STOP_R), () => { squashV = 9; });
    return steps;
  };
  const erasePlan = () => {
    let at = 0;
    const steps: typeof plan = [];
    const put = (dur: number, run: (u: number) => void, done?: () => void) => { steps.push({ at, dur, run, done }); at += dur; };
    const n = g.n, S = g.len.length;
    const total = g.len.reduce((a, b) => a + b, 0);
    const from = { x: g.rx[n + 1] + ox[n + 1], y: g.ry[n + 1] + oy[n + 1] };
    dotTarget = 0;
    put(0.16, hop(() => from, () => tipAt(S - 1, Infinity), 12, STOP_R, PEN_R));
    for (let s = S - 1; s >= 0; s--) {
      const l = g.len[s];
      put((ERASE_S * l) / total, (u) => {
        drawn[s] = l * (1 - u * u * (3 - 2 * u));
        const t = tipAt(s, drawn[s]); pen.x = t.x; pen.y = t.y;
      }, () => { drawn[s] = 0; });
      if (s > 0) put(0.1, hop(() => tipAt(s, 0), () => tipAt(s - 1, Infinity), 10, PEN_R, PEN_R));
    }
    return steps;
  };
  const begin = (m: 'write' | 'erase') => {
    mode = m; clock = 0;
    plan = m === 'write' ? writePlan() : erasePlan();
    wake();
  };
  const runPlan = () => {
    for (const p of plan) {
      if (clock < p.at) break;
      const u = p.dur > 0 ? Math.min(1, (clock - p.at) / p.dur) : 1;
      p.run(u);
      if (u >= 1 && p.done) { p.done(); p.done = undefined; }
    }
    const end = plan.length ? plan[plan.length - 1].at + plan[plan.length - 1].dur : 0;
    if (clock >= end) {
      if (mode === 'erase') { newTake(); begin('write'); }
      else { mode = 'rest'; stopShown = true; drawn = g.len.map((l) => l); }
    }
  };
  const newTake = () => {
    g = build(++takes);
    if (g.n + 2 !== N) { N = g.n + 2; ox = new Float32Array(N); oy = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N); }
    else reset();
    drawn = g.len.map(() => 0);
  };

  /* ---- the string ---- */
  const physics = (dt: number) => {
    const n = g.n;
    const gs = grab ? strokeOf(grab.i) : -1;
    for (let s = 0; s < g.first.length; s++) {
      const a = g.first[s], b = g.last[s];
      for (let i = a; i <= b; i++) {
        const l = i > a ? i - 1 : i, r = i < b ? i + 1 : i;
        let ax = -K * ox[i] + TENSION * (ox[l] + ox[r] - 2 * ox[i]) - DAMP * vx[i];
        let ay = -K * oy[i] + TENSION * (oy[l] + oy[r] - 2 * oy[i]) - DAMP * vy[i];
        if (grab && s === gs) {
          const ds = g.arc[i] - g.arc[grab.i];
          const w = Math.exp(-(ds * ds) / (2 * GRAB_SIGMA * GRAB_SIGMA));
          if (w > 0.01) { ax += GRAB_K * w * (grab.px * w - ox[i]); ay += GRAB_K * w * (grab.py * w - oy[i]); }
        }
        vx[i] += ax * dt; vy[i] += ay * dt;
      }
    }
    for (const i of [n, n + 1]) {   // the dots: plain springs
      vx[i] += (-K * 1.4 * ox[i] - DAMP * vx[i]) * dt; vy[i] += (-K * 1.4 * oy[i] - DAMP * vy[i]) * dt;
    }
    for (let i = 0; i < N; i++) {
      ox[i] += vx[i] * dt; oy[i] += vy[i] * dt;
      const m = Math.hypot(ox[i], oy[i]);
      if (m > MAX_OFF) { ox[i] *= MAX_OFF / m; oy[i] *= MAX_OFF / m; }
    }
    // the i's dot popping in, the full stop's landing squash
    dotV += (220 * (dotTarget - dotScale) - 13 * dotV) * dt; dotScale += dotV * dt;
    squashV += (-300 * squash - 11 * squashV) * dt; squash += squashV * dt;
    squash = Math.max(-0.35, Math.min(0.4, squash));
  };
  /** how much is still moving (0 = everything at rest) */
  const energy = () => {
    let e = Math.max(Math.abs(dotTarget - dotScale) + Math.abs(dotV) * 0.05, Math.abs(squash) + Math.abs(squashV) * 0.05);
    for (let i = 0; i < N; i++) e = Math.max(e, Math.abs(ox[i]) + Math.abs(oy[i]) + 0.02 * (Math.abs(vx[i]) + Math.abs(vy[i])));
    return e;
  };
  const strokeOf = (i: number) => (i <= g.last[0] ? 0 : 1);

  /* ---- the loop: runs only while something moves ---- */
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    for (let t = 0; t < dt - 1e-6; t += DT) physics(Math.min(DT, dt - t));
    if (mode === 'write' || mode === 'erase') { clock += dt; runPlan(); }
    render();
    if (mode === 'write' || mode === 'erase' || grab || dt === 0 || energy() > 0.15) raf = requestAnimationFrame(frame);
    else { awake = false; reset(); dotScale = dotTarget; squash = 0; render(); }
  };
  const wake = () => {
    awake = true;
    if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };

  /** Jump to the finished name (no animation) */
  const finish = () => {
    if (mode === 'erase') newTake();
    mode = 'rest'; plan = []; stopShown = true;
    drawn = g.len.map((l) => l);
    reset(); dotScale = dotTarget = 1; dotV = 0; squash = squashV = 0; grab = null;
    render();
  };

  /* ---- input ---- */
  const toView = (e: PointerEvent) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const nearest = (x: number, y: number) => {
    let best = -1, bd = GRAB_R * GRAB_R;
    for (let s = 0; s < g.first.length; s++) {
      if (drawn[s] <= 0) continue;
      for (let i = g.first[s]; i <= g.last[s]; i++) {
        if (g.arc[i] > drawn[s]) break;
        const d = (g.rx[i] + ox[i] - x) ** 2 + (g.ry[i] + oy[i] - y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  };
  /** a pointer passing over the line drags it along a little */
  const sweep = (ax: number, ay: number, bx: number, by: number, pvx: number, pvy: number) => {
    const sp = Math.hypot(pvx, pvy);
    if (sp < 30) return;
    const k = Math.min(1, 1200 / sp);
    pvx *= k; pvy *= k;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    let hit = false;
    for (let i = 0; i < N; i++) {
      if (i < g.n && g.arc[i] > drawn[strokeOf(i)]) continue;
      const px = g.rx[i] + ox[i], py = g.ry[i] + oy[i];
      const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
      const d = Math.hypot(px - ax - dx * u, py - ay - dy * u);
      if (d < SWEEP_R) {
        // carried along at a share of the pointer's speed (blended, so fast or frequent events can't stack up)
        const w = 0.6 * (1 - d / SWEEP_R) ** 2;
        vx[i] += (pvx * SWEEP_GAIN - vx[i]) * w; vy[i] += (pvy * SWEEP_GAIN - vy[i]) * w;
        hit = true;
      }
    }
    if (hit) wake();
  };
  /** ← / →: pluck the line near one end */
  const pluck = (fromRight: boolean) => {
    const s = fromRight ? 1 : 0, a = g.first[s], b = g.last[s];
    const c = fromRight ? b - Math.floor((b - a) * 0.18) : a + Math.floor((b - a) * 0.35);
    for (let i = a; i <= b; i++) {
      const w = Math.exp(-(((g.arc[i] - g.arc[c]) / 30) ** 2));
      vy[i] -= 260 * w; vx[i] += (fromRight ? -60 : 60) * w;
    }
    wake();
  };
  /** a click, a tap, Enter: write it again */
  const rewrite = () => {
    if (mode === 'write' || mode === 'erase') return;
    if (calm()) { newTake(); finish(); return; }
    if (mode === 'blank') begin('write'); else begin('erase');
  };

  let down: { id: number; x: number; y: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    if (calm() || mode === 'blank') return;
    const p = toView(e);
    if (!p) return;
    const i = nearest(p.x, p.y);
    if (i >= 0) {
      grab = { id: e.pointerId, i, px: 0, py: 0 };
      try { word.setPointerCapture(e.pointerId); } catch { /* capture can fail on a detached node */ }
      word.dataset.grab = '';
      wake();
    }
  };
  const onMove = (e: PointerEvent) => {
    if (calm() || mode === 'blank') return;
    const p = toView(e);
    if (!p) return;
    if (grab && e.pointerId === grab.id) {
      // a rubber band: the further you pull, the harder it gets
      let px = p.x - g.rx[grab.i], py = p.y - g.ry[grab.i];
      const m = Math.hypot(px, py), lim = MAX_PULL * Math.tanh(m / MAX_PULL);
      if (m > 0) { px *= lim / m; py *= lim / m; }
      grab.px = px; grab.py = py;
      wake();
      return;
    }
    const now = performance.now(), prev = sweepAt.get(e.pointerId);
    sweepAt.set(e.pointerId, { x: p.x, y: p.y, t: now });
    if (prev && now - prev.t < 80) {
      const dt = Math.max(8, now - prev.t) / 1000;
      sweep(prev.x, prev.y, p.x, p.y, (p.x - prev.x) / dt, (p.y - prev.y) / dt);
    }
  };
  const letGo = (e: PointerEvent) => {
    sweepAt.delete(e.pointerId);
    if (grab && e.pointerId === grab.id) { grab = null; delete word.dataset.grab; wake(); }
  };
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    letGo(e);
    if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 450) rewrite();
  };
  const onCancel = (e: PointerEvent) => { down = null; letGo(e); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rewrite(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !calm() && mode !== 'blank') { e.preventDefault(); pluck(e.key === 'ArrowRight'); }
  };
  word.addEventListener('pointerdown', onDown);
  word.addEventListener('pointermove', onMove);
  word.addEventListener('pointerup', onUp);
  word.addEventListener('pointercancel', onCancel);
  word.addEventListener('pointerleave', letGo);
  word.addEventListener('lostpointercapture', letGo);
  word.addEventListener('keydown', onKey);

  render();
  return {
    /** Write the name (from blank, the first time it's seen) */
    write() { if (mode === 'blank') { if (calm() || isAmbientPaused()) finish(); else begin('write'); } },
    finish() { if (mode === 'write' || mode === 'erase' || mode === 'blank') finish(); },
    get mode() { return mode; },
    get awake() { return awake; },
    /** the line's largest displacement right now (for the browser tests) */
    get stretch() { let m = 0; for (let i = 0; i < g.n; i++) m = Math.max(m, Math.hypot(ox[i], oy[i])); return m; },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      word.removeEventListener('pointerdown', onDown);
      word.removeEventListener('pointermove', onMove);
      word.removeEventListener('pointerup', onUp);
      word.removeEventListener('pointercancel', onCancel);
      word.removeEventListener('pointerleave', letGo);
      word.removeEventListener('lostpointercapture', letGo);
      word.removeEventListener('keydown', onKey);
    },
  };
}
export type NameScript = ReturnType<typeof createNameScript>;

/* ---- In the card: writes it once it's in view (after the preloader) ---- */
export function useNameScript(rootRef: RefObject<HTMLElement | null>, wordRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current, word = wordRef.current;
    const svg = word?.querySelector('svg');
    if (!root || !word || !svg) return;
    const ink = [...svg.querySelectorAll<SVGPathElement>('.daniel__ink')];
    const tittle = svg.querySelector<SVGCircleElement>('.daniel__tittle');
    const stop = svg.querySelector<SVGEllipseElement>('.daniel__stop');
    if (ink.length !== STROKES.length || !tittle || !stop) return;
    const script = createNameScript({ word, svg, ink, tittle, stop }, !calm());
    (word as HTMLElement & { __script?: NameScript }).__script = script;   // for the browser tests
    let ready = false, visible = false, timer = 0;
    const tryWrite = () => {
      clearTimeout(timer);
      if (ready && visible && !document.hidden) timer = window.setTimeout(() => script.write(), 350);
    };
    const stopWaiting = onPreloaderDone(() => { ready = true; tryWrite(); });
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && e.intersectionRatio > 0.5;
      if (visible) tryWrite();
      else { clearTimeout(timer); if (script.mode !== 'blank') script.finish(); }
    }, { threshold: [0, 0.5, 1] });
    io.observe(root);
    const onVis = () => { if (document.hidden) { clearTimeout(timer); if (script.mode !== 'blank') script.finish(); } else tryWrite(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      stopWaiting();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      script.destroy();
    };
  }, [rootRef, wordRef]);
}
