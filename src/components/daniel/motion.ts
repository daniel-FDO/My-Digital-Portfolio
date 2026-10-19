/* =========================================================
   DANIEL — the animation logic (no drawing here).
   One explicit state at a time; nothing stacks:
     idle      breathing, the odd blink. If the pointer is right over
               him (hover) he notices: a small rise, a head tilt, eyes
               on the pointer, an attentive lean, held until it leaves.
               Otherwise his head and eyes follow the page pointer a
               little (curious). Hover wins over curious.
     wave      a small anticipating dip of the head → the arm lifts
               (elbow first) → two waves eased in and out → a short
               hold → a relaxed lowering. Clicking him plays this one.
     waveBoth  both arms up (the left a beat behind), two waves each,
               slightly out of step, then down.
     dance     ~3.6 s: side-to-side sway from the hips, a soft bounce,
               the head following, arms pumping in turn. Feet stay put.
     nod       two small nods, the second smaller, eyes kept on you.
     sound     a little head pop with the chirp (the host plays the sound).
     greet     reduced motion's wave: a still pose, held briefly.
   With reduced motion every action is a still pose held for a moment
   (no movement in between), and there's no hover reaction.
   Rhythmic parts are smooth envelopes that start and end at zero;
   everything else eases with critically damped springs, so nothing
   snaps. While an action plays, nothing else can start — except a
   wave caught on its way down, which lifts again from where it is.
   ========================================================= */
import type { DanielPose } from './daniel';

export type DanielAction = 'wave' | 'waveBoth' | 'dance' | 'nod' | 'sound';
export type DanielState = 'idle' | 'greet' | DanielAction;
export const ACTIONS: readonly DanielAction[] = ['wave', 'waveBoth', 'dance', 'nod', 'sound'];

interface Spring { x: number; v: number }
const spring = (): Spring => ({ x: 0, v: 0 });
/** critically damped: settles in about `t` seconds, no overshoot (exact, so stable at any frame rate) */
function step(s: Spring, target: number, dt: number, t: number) {
  const w = 4.6 / t;
  const offset = s.x - target;
  const impulse = s.v + w * offset;
  const decay = Math.exp(-w * dt);
  s.x = target + (offset + impulse * dt) * decay;
  s.v = (s.v - w * impulse * dt) * decay;
}
const clamp = (v: number, a = -1, b = 1) => Math.max(a, Math.min(b, v));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** 0 → 1 → 0 over u = 0..1, flat at both ends */
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2);

/** Timings (seconds) */
export const TIMING = { prep: 0.2, raise: 0.55, swings: 2, swingTime: 1.4, hold: 0.45, lower: 0.7, still: 1.6 };
/** When the single wave's phases end, measured from its start */
export const WAVE_PHASES = (() => {
  const prep = TIMING.prep, raised = prep + TIMING.raise, waved = raised + TIMING.swingTime, held = waved + TIMING.hold;
  return { prep, raised, waved, held };
})();
export const BOTH = { prep: 0.18, raise: 0.55, lag: 0.09, swings: 2, swingTime: 1.5, hold: 0.35 };
export const DANCE = { length: 3.6, cycle: 1.2, fadeIn: 0.45, fadeOut: 0.7 };
export const NOD = { length: 1.35 };
export const SOUND = { length: 1.1 };
export const HOVER = { pop: 0.45 };

/** Reduced motion: each action is one still pose */
export const STILL: Record<DanielAction, DanielPose> = {
  wave: { headTilt: 6, waveRaise: 1, waveSwing: 0.4 },
  waveBoth: { headPitch: -3, waveRaise: 1, waveSwing: 0.3, leftRaise: 1, leftSwing: 0.3 },
  dance: { headTilt: -6, bodySway: 2.5, waveRaise: 0.5, leftRaise: 0.15 },
  nod: { headPitch: 7, gazeY: 0.25 },
  sound: { headTilt: 7, headPitch: -4, gazeY: 0.3 },
};
const NEUTRAL: Required<DanielPose> = {
  breath: 0, blink: 0, headYaw: 0, headPitch: 0, headTilt: 0, gazeX: 0, gazeY: 0,
  waveRaise: 0, waveSwing: 0, leftRaise: 0, leftSwing: 0, bodySway: 0, bodyLean: 0, bodyLift: 0,
};

export interface MotionInput {
  /** page pointer, relative to his head in px (curious following; null = none) */
  pointer: { dx: number; dy: number } | null;
  /** the pointer while it is right over him, relative to his head in px (null = not hovering) */
  hover?: { dx: number; dy: number } | null;
  reduced: boolean;
}

export function createMotion() {
  let state: DanielState = 'idle';
  let still = false;                       // reduced motion: the action is a held still pose
  let stateAt = 0, now = 0, lowering = false;
  let nextBlink = 1.2 + Math.random() * 2.5, blinkAt = -10, doubleBlink = false;
  let hovering = false, hoverAt = -10, hoverSide = 1;
  const s = {
    raiseR: spring(), raiseL: spring(), headYaw: spring(), headPitch: spring(), headTilt: spring(),
    gazeX: spring(), gazeY: spring(), lift: spring(), lean: spring(),
  };
  const listeners = new Set<(st: DanielState) => void>();
  const set = (st: DanielState) => { state = st; stateAt = now; lowering = false; still = false; listeners.forEach((fn) => fn(st)); };
  const zero = () => Object.values(s).forEach((sp) => { sp.x = 0; sp.v = 0; });

  /** Can this action start now? (one at a time; a wave may restart while lowering) */
  const canPlay = (a: DanielAction) => state === 'idle' || (a === 'wave' && state === 'wave' && lowering);
  const play = (a: DanielAction, reduced: boolean): boolean => {
    if (reduced) {
      if (state !== 'idle') return false;
      set(a === 'wave' ? 'greet' : a);
      still = true;
      return true;
    }
    if (!canPlay(a)) return false;
    const rising = a === 'wave' && state === 'wave' && s.raiseR.x > 0.05;
    set(a);
    // caught while lowering: lift again from where the arm is, without a second anticipation
    if (rising) stateAt -= TIMING.prep;
    return true;
  };

  return {
    get state() { return state; },
    /** true while an action (or reduced motion's still pose) is playing */
    get acting() { return state !== 'idle'; },
    onState(fn: (st: DanielState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    canPlay,
    /** Start an action. Returns false (and changes nothing) if another one is playing. */
    play,
    /** The single-hand wave (same as clicking him). */
    wave: (reduced: boolean) => play('wave', reduced),
    /** Straight back to the neutral pose (every joint at rest, any action dropped) */
    reset() {
      zero();
      blinkAt = -10;
      nextBlink = now + 2.5;
      hoverAt = -10;
      if (state !== 'idle') set('idle');
    },
    /** Advance by dt seconds; returns the pose to draw */
    update(dt: number, input: MotionInput): Required<DanielPose> {
      dt = Math.min(dt, 1 / 20);                 // a long gap (tab switch, offscreen) never makes a jump
      now += dt;
      const t = now - stateAt;
      const hv = input.reduced ? null : input.hover ?? null;
      if (hv && !hovering) { hovering = true; hoverSide = hv.dx < 0 ? -1 : 1; hoverAt = state === 'idle' ? now : -10; }
      else if (!hv) hovering = false;

      if (input.reduced) {
        if (state !== 'idle' && !still) set('idle');          // switched on mid-action: stop, no movement
        if (still && t > TIMING.still) set('idle');
        zero();
        const key: DanielAction | null = !still ? null : state === 'greet' ? 'wave' : (state as DanielAction);
        return { ...NEUTRAL, ...(key ? STILL[key] : {}) };
      }
      if (still) set('idle');                                 // reduced motion switched off mid-pose

      const pose = { ...NEUTRAL };
      pose.breath = Math.sin(now * (Math.PI * 2) / 4.4);
      // blinking: every 2.5–6 s, sometimes twice
      if (now >= nextBlink) {
        blinkAt = now;
        doubleBlink = Math.random() < 0.18;
        nextBlink = now + 2.5 + Math.random() * 3.5 + (doubleBlink ? 0.4 : 0);
      }
      const curve = (u: number) => (u < 0 || u > 0.16 ? 0 : Math.sin((u / 0.16) * Math.PI));
      const bt = now - blinkAt;
      pose.blink = Math.max(curve(bt), doubleBlink ? curve(bt - 0.24) : 0);

      // spring targets …
      let rR = 0, rL = 0, yaw = 0, pitch = 0, tilt = 0, gx = 0, gy = 0, lift = 0, lean = 0;
      // … and direct offsets (envelopes that start and end at zero)
      let swR = 0, swL = 0, aYaw = 0, aPitch = 0, aTilt = 0, aGy = 0, aSway = 0, aLift = 0, aLean = 0;
      let armT = lowering ? TIMING.lower : 0.42, headT = 0.32;

      switch (state) {
        case 'wave': {
          const P = WAVE_PHASES;
          let prep = 0;
          if (t < P.prep) prep = Math.sin((t / P.prep) * Math.PI * 0.5);
          else if (t < P.held) {
            rR = 1;
            prep = Math.max(0, 1 - (t - P.prep) / 0.3);
            if (t >= P.raised && t < P.waved) {
              const u = (t - P.raised) / TIMING.swingTime;
              swR = Math.sin(u * Math.PI) ** 0.7 * Math.sin(u * TIMING.swings * Math.PI * 2);
            }
          } else {
            lowering = true; armT = TIMING.lower;
            if (s.raiseR.x < 0.02 && t > P.held + 0.25) set('idle');
          }
          pitch = 4 * prep;                                     // a little dip before the arm moves …
          tilt = 6 * Math.min(1, s.raiseR.x * 1.5);             // … then a friendly tilt towards the hand
          break;
        }
        case 'waveBoth': {
          const B = BOTH, raised = B.prep + B.raise, held = raised + B.swingTime + B.hold;
          let prep = 0;
          if (t < B.prep) prep = Math.sin((t / B.prep) * Math.PI * 0.5);
          else if (t < held + B.lag) {
            rR = t < held ? 1 : 0;
            rL = t >= B.prep + B.lag ? 1 : 0;                   // the left arm a beat behind
            prep = Math.max(0, 1 - (t - B.prep) / 0.3);
            const uR = (t - raised) / B.swingTime, uL = (t - raised - B.lag) / B.swingTime;
            if (uR > 0 && uR < 1) swR = Math.sin(uR * Math.PI) ** 0.7 * Math.sin(uR * B.swings * Math.PI * 2);
            if (uL > 0 && uL < 1) swL = 0.85 * Math.sin(uL * Math.PI) ** 0.7 * Math.sin(uL * B.swings * Math.PI * 2 + 0.5);
            pitch = 3 * prep - 3 * smoothstep(B.prep, raised, t);   // looks up a little, happily
            lift = 0.35 * smoothstep(B.prep, raised, t);
          } else {
            lowering = true; armT = TIMING.lower;
            if (Math.max(s.raiseR.x, s.raiseL.x) < 0.02 && t > held + B.lag + 0.25) set('idle');
          }
          break;
        }
        case 'dance': {
          const D = DANCE;
          const env = smoothstep(0, D.fadeIn, t) * (1 - smoothstep(D.length - D.fadeOut, D.length, t));
          const ph = (Math.PI * 2 * t) / D.cycle;
          aSway = env * 3 * Math.sin(ph);                                  // side to side from the hips
          aLift = env * 0.7 * (0.5 - 0.5 * Math.cos(2 * ph));              // a soft bounce, twice per sway
          aTilt = env * 5 * Math.sin(ph - 0.6);                            // the head follows, a little late
          aYaw = env * 4 * Math.sin(ph);
          gx = 0.25 * env * Math.sin(ph - 0.3);
          const arm = 0.5 + 0.5 * Math.sin(ph + 0.4);                      // arms pump in turn
          rR = env * (0.12 + 0.36 * arm);
          rL = env * (0.12 + 0.36 * (1 - arm));
          armT = 0.22;
          if (t > D.length) {
            lowering = true; armT = 0.45;
            if (Math.max(s.raiseR.x, s.raiseL.x) < 0.02) set('idle');
          }
          break;
        }
        case 'nod': {
          aPitch = 9 * bump((t - 0.05) / 0.5) + 6.5 * bump((t - 0.6) / 0.46);
          aLean = 0.12 * aPitch;
          aGy = 0.035 * aPitch;                                  // eyes stay on you while the head dips
          if (t > NOD.length) set('idle');
          break;
        }
        case 'sound': {
          const e = smoothstep(0, 0.16, t) * (1 - smoothstep(0.35, SOUND.length - 0.05, t));
          aTilt = 7 * e; aPitch = -4 * e; aLift = 0.5 * e; aGy = 0.3 * e;
          if (t > SOUND.length) set('idle');
          break;
        }
        default: {
          headT = 0.5;
          if (hv) {
            // he notices you: eyes on the pointer, a slight tilt, an attentive lean, and one small rise on arrival
            const nx = clamp(hv.dx / 160), ny = clamp(hv.dy / 200);
            yaw = nx * 9; pitch = ny * 4; tilt = 5 * hoverSide;
            gx = clamp(hv.dx / 110); gy = -clamp(hv.dy / 110);
            lift = 0.25; lean = 2;
            aLift = 0.8 * bump((now - hoverAt) / HOVER.pop);
          } else if (input.pointer) {
            // curious: follow the page pointer, a little
            const { dx, dy } = input.pointer;
            const nx = clamp(dx / 520), ny = clamp(dy / 420);
            yaw = nx * 14; pitch = ny * 7; tilt = nx * -3;
            gx = clamp(dx / 260); gy = -clamp(dy / 260);
            headT = 0.55;
          }
        }
      }

      step(s.raiseR, rR, dt, armT); step(s.raiseL, rL, dt, armT);
      step(s.headYaw, yaw, dt, headT); step(s.headPitch, pitch, dt, headT); step(s.headTilt, tilt, dt, headT + 0.05);
      step(s.gazeX, gx, dt, 0.22); step(s.gazeY, gy, dt, 0.22);
      step(s.lift, lift, dt, 0.4); step(s.lean, lean, dt, 0.45);

      pose.waveRaise = clamp(s.raiseR.x, 0, 1);
      pose.waveSwing = swR * Math.min(1, s.raiseR.x * 1.4);
      pose.leftRaise = clamp(s.raiseL.x, 0, 1);
      pose.leftSwing = swL * Math.min(1, s.raiseL.x * 1.4);
      pose.headYaw = s.headYaw.x + aYaw;
      pose.headPitch = s.headPitch.x + aPitch;
      pose.headTilt = s.headTilt.x + aTilt;
      pose.gazeX = clamp(s.gazeX.x);
      pose.gazeY = clamp(s.gazeY.x + aGy);
      pose.bodySway = aSway;
      pose.bodyLift = clamp(s.lift.x + aLift);
      pose.bodyLean = s.lean.x + aLean;
      return pose;
    },
    /** true while something is still on its way to a target (the host can idle cheaply otherwise) */
    get busy() {
      if (state !== 'idle' || Math.abs(s.raiseR.x) + Math.abs(s.raiseL.x) > 0.002) return true;
      if (now - hoverAt < HOVER.pop) return true;
      let v = 0;
      for (const sp of Object.values(s)) v += Math.abs(sp.v);
      return v > 0.01;
    },
  };
}
export type Motion = ReturnType<typeof createMotion>;
