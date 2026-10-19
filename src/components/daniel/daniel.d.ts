/* Types for daniel.js — the character drawing module (plain JS, no
   dependencies; see the comments at the top of daniel.js). */
export interface DanielPose {
  /** -1..1 chest / belly rise (feet stay planted) */
  breath?: number;
  /** degrees: -18..18 turn, -10..10 nod (positive looks down), -10..10 tilt (positive towards the viewer's right) */
  headYaw?: number;
  headPitch?: number;
  headTilt?: number;
  /** -1..1 where the eyes look (x: towards the viewer's right, y: up) */
  gazeX?: number;
  gazeY?: number;
  /** 0 open … 1 closed */
  blink?: number;
  /** 0 = at rest … 1 = raised beside the head: the arm on the viewer's right */
  waveRaise?: number;
  /** -1..1 that hand swinging once raised (+1 tips it outwards) */
  waveSwing?: number;
  /** the same two, for the arm on the viewer's left */
  leftRaise?: number;
  leftSwing?: number;
  /** degrees, -6..6: the body above the legs leans sideways (positive: towards the viewer's right). Feet stay planted. */
  bodySway?: number;
  /** degrees, -6..6: the body leans towards the viewer (positive) or back */
  bodyLean?: number;
  /** -1..1: the body rises (positive) or settles a little on its legs */
  bodyLift?: number;
}

export interface DanielRig {
  sh: number[]; el: number[]; wr: number[]; hand: number[]; open: number[];
  headC: number[]; headM: number[]; pivot: number[];
  belly: number[]; chest: number[]; bodyM: number[]; bodyT: number[];
}

export interface DanielController {
  /** Resolves once the shader is built (compiled in the background where the browser supports it); rejects if it can't be. */
  ready: Promise<void>;
  setPose(p: DanielPose): void;
  /** Draws the current pose; returns false (nothing drawn) before `ready` or after context loss. */
  render(): boolean;
  resize(): void;
  /** Render at a fraction (0.25–1) of the normal resolution; the canvas is stretched to fit. */
  setResolutionScale(s: number): void;
  dispose(): void;
}

/** Throws if the drawing API it needs isn't available (the host then shows the poster). */
export function createDaniel(container: HTMLElement, opts?: { dpr?: number; steps?: number; maxPixels?: number; preserveDrawingBuffer?: boolean }): DanielController;

/** The skeleton for a pose (world units; the feet stand at y = 0). */
export function computeRig(p: DanielPose): DanielRig;

/** Camera framing of the 3:4 box (world units). */
export const FRAME: { halfH: number; bottom: number; dist: number };
