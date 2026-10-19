/* =========================================================
   Shared maths for the storyboards (run in the browser by the film
   page, so plain ES module, no Node APIs).
   All camera motion is built from these: smooth ramps and glides
   whose speed changes gently, so the camera never stops or surges.
   ========================================================= */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mix = (a, b, k) => a + (b - a) * k;
/** zoom-style interpolation (even in log scale) */
export const logmix = (a, b, k) => Math.exp(mix(Math.log(a), Math.log(b), k));
/** 0 → 1 between t0 and t1, zero speed at both ends (smootherstep) */
export const ramp = (t, t0, t1) => { const x = clamp((t - t0) / (t1 - t0)); return x * x * x * (x * (x * 6 - 15) + 10); };
/** 0 → 1, fast start, gentle landing */
export const easeOut = (t, t0, t1) => { const x = clamp((t - t0) / (t1 - t0)); return 1 - Math.pow(1 - x, 3); };
export const easeInOut = (t, t0, t1) => { const x = clamp((t - t0) / (t1 - t0)); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };

/**
 * A glide from p0 to p1 between t0 and t1 whose speed rises smoothly for
 * `accel` seconds, holds steady, then falls smoothly for `decel` seconds
 * (a trapezoid with rounded corners). Integrated numerically, so the
 * position is exact for any speed shape.
 */
export function glide(t, { t0, t1, p0, p1, accel = 0.8, decel = 0.8 }) {
  const speed = (s) => Math.min(ramp(s, t0, t0 + accel), 1 - ramp(s, t1 - decel, t1));
  const area = (s) => { let a = 0; const n = 240, h = (Math.min(s, t1) - t0) / n; if (h <= 0) return 0; for (let i = 0; i < n; i++) a += speed(t0 + (i + 0.5) * h) * h; return a; };
  const total = area(t1);
  return mix(p0, p1, clamp(area(clamp(t, t0, t1)) / total));
}

/**
 * A point at distance s along a path of straight segments, with its
 * corners rounded (an average over ±r of path length), so a glide along
 * it turns smoothly without slowing down.
 */
export function along(points, s, r = 220) {
  const seg = []; let total = 0;
  for (let i = 1; i < points.length; i++) { const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); seg.push(l); total += l; }
  const at = (u) => {
    u = clamp(u, 0, total);
    for (let i = 0; i < seg.length; i++) { if (u <= seg[i] || i === seg.length - 1) { const k = seg[i] ? u / seg[i] : 0; return [mix(points[i][0], points[i + 1][0], k), mix(points[i][1], points[i + 1][1], k)]; } u -= seg[i]; }
  };
  const n = 24; let x = 0, y = 0;
  for (let i = 0; i < n; i++) { const p = at(s + ((i + 0.5) / n - 0.5) * 2 * r); x += p[0]; y += p[1]; }
  return { x: x / n, y: y / n, total };
}
export const pathLength = (points) => points.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);

/** Blend camera A into camera B (x, y, pitch, yaw linearly; distance in log scale) */
export function blendCam(a, b, k) {
  return { x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), d: logmix(a.d, b.d, k), pitch: mix(a.pitch, b.pitch, k), yaw: mix(a.yaw ?? 0, b.yaw ?? 0, k) };
}

/**
 * The end-card camera: looking straight down so a hero rectangle (world
 * px) lands as a card `cardW` px wide whose top sits at `cardTop` px on
 * a W × H frame, with focal length f.
 */
export function cardCam(hero, { W = 1280, H = 800, f = 1300, cardW = 905, cardTop = 196 } = {}) {
  const s = hero.w / cardW;                         // world px per screen px
  const cardH = hero.h / s;
  const cy = cardTop + cardH / 2;                   // where the card's centre sits on screen
  return { x: hero.x + hero.w / 2, y: hero.y + hero.h / 2 - (cy - H / 2) * s, d: f * s, pitch: 0, yaw: 0 };
}

/** A camera that frames a world rectangle from straight above, with a margin (screen px) */
export function overviewCam(rect, { W = 1280, H = 800, f = 1300, margin = 48 } = {}) {
  const s = Math.max(rect.w / (W - 2 * margin), rect.h / (H - 2 * margin));
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, d: f * s, pitch: 0, yaw: 0 };
}
