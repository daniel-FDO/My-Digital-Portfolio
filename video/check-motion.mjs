/* Checks every film's camera before rendering: during the flight the
   glide's speed never dips or surges (after its ease-in, before its
   ease-out), the distance never shrinks (no zoom-in), the yaw never
   changes (no turning). Sampled at 120 Hz straight from the storyboards. */
import fs from 'node:fs';
import * as L from './lib.mjs';
const slugs = fs.readdirSync('video/storyboards').map((f) => f.replace('.mjs', ''));
const capOf = (s) => JSON.parse(fs.readFileSync(`video/captures/${s}/capture.json`, 'utf8'));
let bad = 0;
for (const slug of slugs) {
  const sb = await import(`./storyboards/${slug}.mjs`);
  const f = sb.film(capOf(slug), L);
  const flightEnd = f.end.t0 - 1.6;                 // the flight, before the rise / reveal
  const dt = 1 / 120, sp = [];
  let prev = f.camera(0), dDrop = 0, yawMoves = 0;
  for (let t = dt; t <= flightEnd; t += dt) {
    const c = f.camera(t);
    sp.push({ t, v: Math.hypot(c.x - prev.x, c.y - prev.y) / dt });
    if (c.d < prev.d - 1e-6) dDrop = Math.max(dDrop, prev.d - c.d);
    if (Math.abs((c.yaw ?? 0) - (prev.yaw ?? 0)) > 1e-9) yawMoves++;
    prev = c;
  }
  // cruise: the steady part of the glide (each storyboard says when)
  const [c0, c1] = f.cruise ?? [1.8, flightEnd - 1.4];
  const cruise = sp.filter((s) => s.t > c0 && s.t < c1).map((s) => s.v);
  const lo = Math.min(...cruise), hi = Math.max(...cruise), mean = cruise.reduce((a, b) => a + b, 0) / cruise.length;
  // and: no sharp speed change anywhere (frame-to-frame acceleration)
  let jerk = 0; for (let i = 1; i < sp.length; i++) jerk = Math.max(jerk, Math.abs(sp[i].v - sp[i - 1].v) / dt);
  const ok = lo > 0.6 * mean && hi < 1.4 * mean && dDrop === 0 && yawMoves === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${slug.padEnd(20)} cruise ${mean.toFixed(0)} px/s (min ${(lo / mean * 100).toFixed(0)}%, max ${(hi / mean * 100).toFixed(0)}%), max accel ${jerk.toFixed(0)} px/s², zoom-in during flight: ${dDrop ? dDrop.toFixed(2) + 'px' : 'none'}, turning: ${yawMoves ? 'YES' : 'none'}`);
}
process.exit(bad ? 1 : 0);
