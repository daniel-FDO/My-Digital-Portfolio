/* node tests/daniel-motion.mjs
   Daniel's animation logic (src/components/daniel/motion.ts) and framing, without a browser:
   - every action completes and returns to a neutral, settled pose (20/30/60/120 fps)
   - one action at a time: duplicates and conflicting actions are refused
   - reset mid-action; reduced motion's still poses (no movement while held)
   - hover: a brief rise on entry, an attentive hold, a smooth return; never interrupts an action;
     wins over page-wide (curious) following
   - framing: for every frame of every action, hands, head, tuft and body stay inside the
     3:4 frame, using the renderer's own rig and camera (computeRig, FRAME) */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { computeRig, FRAME } from '../src/components/daniel/daniel.js';

const src = fs.readFileSync(new URL('../src/components/daniel/motion.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const M = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const { createMotion, ACTIONS, WAVE_PHASES } = M;
const idle = { pointer: null, hover: null, reduced: false };
const run = (m, secs, input = idle, fps = 60) => { const out = []; for (let i = 0; i < Math.round(secs * fps); i++) out.push({ ...m.update(1 / fps, input), state: m.state }); return out; };
const settled = (p) => Math.abs(p.waveRaise) < 0.01 && Math.abs(p.leftRaise) < 0.01 && Math.abs(p.bodySway) < 0.01
  && Math.abs(p.bodyLift) < 0.02 && Math.abs(p.bodyLean) < 0.05 && Math.abs(p.headPitch) < 0.2 && Math.abs(p.headTilt) < 0.2;
let n = 0; const ok = (name) => { n++; console.log('  ok', name); };

// ---- every action completes, at several frame rates ----
for (const fps of [20, 30, 60, 120]) for (const a of ACTIONS) {
  const m = createMotion();
  run(m, 1, idle, fps);
  assert.equal(m.play(a, false), true, `${a} starts`);
  assert.equal(m.state, a);
  const tr = run(m, 7, idle, fps);
  for (const f of tr) for (const [k, v] of Object.entries(f)) if (k !== 'state') assert.ok(Number.isFinite(v), `${a}@${fps}: ${k} finite`);
  const end = tr.findIndex((f) => f.state === 'idle');
  assert.ok(end > 0, `${a}@${fps}fps returns to idle`);
  assert.ok(settled(tr.at(-1)), `${a}@${fps}fps settles to neutral: ${JSON.stringify(tr.at(-1))}`);
  // smooth: no frame-to-frame jump bigger than a joint could move
  for (let i = 1; i < tr.length; i++) {
    const d = (k, lim) => assert.ok(Math.abs(tr[i][k] - tr[i - 1][k]) <= lim * (60 / fps), `${a}@${fps}: ${k} jumps ${tr[i - 1][k].toFixed(3)} → ${tr[i][k].toFixed(3)}`);
    d('waveRaise', 0.12); d('leftRaise', 0.12); d('bodySway', 0.6); d('bodyLift', 0.2); d('headPitch', 2.2); d('headTilt', 2.2);
  }
}
ok('all five actions complete and settle at 20/30/60/120 fps, without jumps');

// ---- durations are short and as designed ----
{
  const lengths = {};
  for (const a of ACTIONS) { const m = createMotion(); m.play(a, false); const tr = run(m, 8); lengths[a] = tr.findIndex((f) => f.state === 'idle') / 60; }
  assert.ok(lengths.dance >= 3.4 && lengths.dance <= 4.4, `dance lasts ${lengths.dance}s`);
  assert.ok(lengths.nod <= 1.6 && lengths.sound <= 1.3, 'nod and sound are brief');
  assert.ok(lengths.wave < 4 && lengths.waveBoth < 4.2, 'waves are under ~4 s');
  ok(`durations ${Object.entries(lengths).map(([k, v]) => `${k} ${v.toFixed(2)}s`).join(', ')}`);
}

// ---- one at a time ----
{
  const m = createMotion();
  m.play('dance', false);
  run(m, 0.5);
  for (const a of ACTIONS) assert.equal(m.play(a, false), false, `${a} refused during dance`);
  assert.equal(m.wave(false), false, 'clicking him during a dance does nothing');
  assert.equal(m.state, 'dance');
  const w = createMotion();
  w.play('wave', false);
  assert.equal(w.play('wave', false), false, 'duplicate wave refused while rising');
  assert.equal(w.play('nod', false), false, 'nod refused during a wave');
  run(w, WAVE_PHASES.held + 0.15);
  assert.equal(w.canPlay('nod'), false, 'still busy while the arm lowers');
  assert.equal(w.play('wave', false), true, 'a wave caught while lowering lifts again');
  ok('only one action plays at a time; duplicates and conflicts are refused');
}

// ---- both hands: both arms up, out of step ----
{
  const m = createMotion(); m.play('waveBoth', false);
  const tr = run(m, 4);
  assert.ok(tr.some((f) => f.waveRaise > 0.95 && f.leftRaise > 0.95), 'both arms fully raised');
  const signs = (k) => tr.filter((f) => Math.abs(f[k]) > 0.15).map((f) => Math.sign(f[k]));
  const sR = signs('waveSwing'), sL = signs('leftSwing');
  const ch = (s) => s.filter((v, i) => i && v !== s[i - 1]).length;
  assert.ok(ch(sR) >= 3 && ch(sL) >= 3, `two waves each (direction changes R ${ch(sR)}, L ${ch(sL)})`);
  assert.ok(tr.some((f) => Math.abs(f.waveSwing - f.leftSwing) > 0.2), 'the two hands are slightly out of step');
  ok('wave both hands: both arms, two waves each, slightly out of step');
}
// ---- dance: sway, bounce, alternating arms; feet are never posed ----
{
  const m = createMotion(); m.play('dance', false);
  const tr = run(m, 4.5);
  assert.ok(Math.max(...tr.map((f) => f.bodySway)) > 2 && Math.min(...tr.map((f) => f.bodySway)) < -2, 'sways both ways');
  assert.ok(Math.max(...tr.map((f) => f.bodyLift)) > 0.4, 'a soft bounce');
  assert.ok(tr.some((f) => f.waveRaise > f.leftRaise + 0.2) && tr.some((f) => f.leftRaise > f.waveRaise + 0.2), 'arms alternate');
  assert.ok(Math.max(...tr.map((f) => Math.abs(f.bodySway))) <= 3.01, 'restrained sway (≤ 3°)');
  ok('dance: side-to-side, bounce, arms in turn, restrained');
}
// ---- nod: two nods, the second smaller ----
{
  const m = createMotion(); m.play('nod', false);
  const p = run(m, 1.6).map((f) => f.headPitch);
  const peaks = p.filter((v, i) => i > 0 && i < p.length - 1 && v > p[i - 1] && v >= p[i + 1] && v > 2);
  assert.equal(peaks.length, 2, `two nods (${peaks.map((v) => v.toFixed(1))})`);
  assert.ok(peaks[1] < peaks[0], 'second nod smaller');
  ok('nod: two natural nods');
}

// ---- reset mid-action ----
for (const a of ACTIONS) {
  const m = createMotion(); m.play(a, false); run(m, 0.9);
  m.reset();
  assert.equal(m.state, 'idle');
  const p = m.update(0, idle);
  assert.ok(settled(p) && p.headYaw === 0, `${a}: reset returns straight to neutral`);
  assert.equal(m.play('nod', false), true, 'and a new action can start');
}
ok('reset during every action returns to neutral and frees the queue');

// ---- reduced motion: still poses only ----
for (const a of ACTIONS) {
  const m = createMotion();
  const R = { pointer: { dx: 300, dy: 100 }, hover: { dx: 10, dy: 10 }, reduced: true };
  assert.equal(m.play(a, true), true);
  assert.equal(m.state, a === 'wave' ? 'greet' : a);
  const first = m.update(1 / 60, R);
  const held = run(m, 1.2, R);
  for (const f of held) { const { state, ...pose } = f; assert.deepEqual(pose, first, `${a}: no movement while the still pose is held`); assert.equal(state, first && m.state); }
  assert.equal(m.play('nod', true), false, 'one still pose at a time');
  run(m, 1, R);
  assert.equal(m.state, 'idle', `${a}: still pose ends`);
  const after = run(m, 1, R);
  assert.ok(after.every((f) => f.breath === 0 && f.blink === 0 && f.headYaw === 0 && f.bodyLift === 0), 'reduced idle: no breathing, blinking, following or hover');
}
{ // switched on mid-dance: back to neutral at once
  const m = createMotion(); m.play('dance', false); run(m, 1);
  const p = m.update(1 / 60, { ...idle, reduced: true });
  assert.equal(m.state, 'idle'); assert.ok(settled(p));
}
ok('reduced motion: every action is a held still pose; switching it on mid-action stops at neutral');

// ---- hover ----
{
  const m = createMotion(); run(m, 1);
  const H = { pointer: { dx: 40, dy: 10 }, hover: { dx: 40, dy: 10 }, reduced: false };
  const tr = run(m, 2, H);
  const liftPeak = Math.max(...tr.slice(0, 30).map((f) => f.bodyLift));
  const held = tr.at(-1);
  assert.ok(liftPeak > held.bodyLift + 0.2, `a brief rise on entry (peak ${liftPeak.toFixed(2)}, held ${held.bodyLift.toFixed(2)})`);
  assert.ok(held.headTilt > 3 && held.bodyLean > 1.5 && held.gazeX > 0.2, 'attentive: tilt, lean, eyes towards the pointer');
  assert.equal(m.busy, false, 'settled while hovered (host can idle cheaply)');
  // no continuous bouncing while hovered
  const late = tr.slice(-40).map((f) => f.bodyLift);
  assert.ok(Math.max(...late) - Math.min(...late) < 0.01, 'no bouncing while hovered');
  const out = run(m, 1.5);
  assert.ok(settled(out.at(-1)) && Math.abs(out.at(-1).gazeX) < 0.02, 'returns to neutral on exit');
  for (let i = 1; i < out.length; i++) assert.ok(Math.abs(out[i].bodyLift - out[i - 1].bodyLift) < 0.05, 'smoothly');
  // gaze direction: pointer below → eyes down (gazeY < 0); above → up
  const g = createMotion(); run(g, 1, { ...H, hover: { dx: 0, dy: 120 }, pointer: null });
  assert.ok(g.update(1 / 60, { ...H, hover: { dx: 0, dy: 120 }, pointer: null }).gazeY < -0.5, 'eyes look down at a pointer below');
  ok('hover: brief rise, attentive hold without bouncing, smooth return; gaze follows the pointer');
}
{
  const m = createMotion(); m.play('nod', false);
  const base = createMotion(); base.play('nod', false);
  const H = { pointer: null, hover: { dx: -80, dy: 0 }, reduced: false };
  const a = run(m, 0.8, H), b = run(base, 0.8);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i].headPitch - b[i].headPitch) < 1e-9 && Math.abs(a[i].bodyLift - b[i].bodyLift) < 1e-9, 'hover does not change a playing action');
  assert.equal(m.state, 'nod');
  // curious following is ignored while hovering
  const c = createMotion(); run(c, 1.5, { pointer: { dx: -500, dy: 0 }, hover: { dx: 60, dy: 0 }, reduced: false });
  assert.ok(c.update(1 / 60, { pointer: { dx: -500, dy: 0 }, hover: { dx: 60, dy: 0 }, reduced: false }).headYaw > 0, 'hover wins over page-wide following');
  ok('hover never interrupts an action, and wins over curious following');
}

// ---- framing: every frame of every action stays inside the 3:4 frame ----
{
  const halfH = FRAME.halfH, halfW = halfH * 0.75, camY = FRAME.bottom + halfH, top = camY + halfH, MARGIN = 0.03;
  const col = (m, c, o = 0) => [m[o + c * 3], m[o + c * 3 + 1], m[o + c * 3 + 2]];
  const at = (P, M3, o, h) => [0, 1, 2].map((k) => P[k] + col(M3, 0, o)[k] * h[0] + col(M3, 1, o)[k] * h[1] + col(M3, 2, o)[k] * h[2]);
  const HAND = [[[0.068, 0, 0], 0.094], [[0.168, -0.059, 0], 0.035], [[0.177, 0, 0], 0.035], [[0.168, 0.053, 0], 0.035], [[0.095, 0.136, 0.02], 0.03]];
  const HEAD = [[[0.47, -0.05, 0], 0.0], [[-0.47, -0.05, 0], 0.0], [[0, 0.34, 0], 0.0], [[0.097, 0.453, 0], 0.05], [[0.03, 0.447, 0], 0.066], [[0.142, 0.418, 0], 0.034]];
  const worst = { x: 0, y: -9, what: '' };
  const probe = (label, p, rad) => {
    const s = FRAME.dist / (FRAME.dist - p[2]);
    const x = (Math.abs(p[0]) + rad) * s, y = camY + (p[1] - camY) * s + rad * s;
    if (x > worst.x) Object.assign(worst, { x, xwhat: label });
    if (y > worst.y) Object.assign(worst, { y, ywhat: label });
  };
  const check = (label, pose) => {
    const r = computeRig(pose);
    for (let i = 0; i < 2; i++) {
      probe(`${label} elbow${i}`, r.el.slice(i * 3, i * 3 + 3), 0.114);
      for (const [h, rad] of HAND) probe(`${label} hand${i}`, at(r.wr.slice(i * 3, i * 3 + 3), r.hand, i * 9, h), rad);
    }
    for (const [h, rad] of HEAD) probe(`${label} head/tuft`, at(r.headC, r.headM, 0, h), rad);
    const X = (p) => [0, 1, 2].map((k) => r.bodyT[k] + col(r.bodyM, 0)[k] * p[0] + col(r.bodyM, 1)[k] * (p[1] - 0.3) + col(r.bodyM, 2)[k] * p[2]);
    probe(`${label} belly`, X([0.52, r.belly[0], 0]), 0); probe(`${label} belly`, X([-0.52, r.belly[0], 0]), 0);
  };
  for (const a of ACTIONS) {
    const m = createMotion(); m.play(a, false);
    for (const f of run(m, 6)) check(a, f);
    check(`${a} (still)`, M.STILL[a]);
  }
  // hover at its strongest, plus the extremes the pose controls allow for a raised arm
  for (const sw of [-1, 1]) check('both raised', { waveRaise: 1, leftRaise: 1, waveSwing: sw, leftSwing: sw });
  assert.ok(worst.x < halfW - MARGIN, `x reaches ${worst.x.toFixed(3)} (${worst.xwhat}); frame half-width ${halfW.toFixed(3)}`);
  assert.ok(worst.y < top - MARGIN, `y reaches ${worst.y.toFixed(3)} (${worst.ywhat}); frame top ${top.toFixed(3)}`);
  assert.ok(worst.y < 2.45 - 0.02, `inside the raymarch box (y ${worst.y.toFixed(3)} < 2.45)`);
  ok(`framing: widest ${worst.x.toFixed(3)} / ${halfW.toFixed(3)} (${worst.xwhat}), highest ${worst.y.toFixed(3)} / ${top.toFixed(3)} (${worst.ywhat})`);
}
console.log(`\nDaniel motion + framing: ${n} groups passed.`);
