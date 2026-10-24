/* =========================================================
   ISOPHOTE — a darkroom tide (WebGL2, no libraries)
   One photo at a time, on a paper plate. Changing photo is a tide:
   the photo washes off the paper tone by tone and leaves its own
   contour map behind (lines of equal brightness: the same fine
   topographic lines as the page background), the next photo's map
   comes in on the bare paper, and then the next photo develops up
   through it behind a rising copper line, warm and flat at first and
   then in full colour, like a print in the developer tray.
   - Each photo's "elevation" is computed once on the CPU from its
     blurred, partly equalised brightness (+ a little seeded noise so
     flat skies don't terrace), and uploaded as a small R16F texture.
     The shader draws the contour lines from it (antialiased with
     fwidth) and uses it as the order in which the tide moves.
   - The neighbours (±1, ±2) are shown only as their contour lines,
     fading towards the frame's edges; they tide along with the hero.
   - The tide is slanted like the background's light streak (down to
     the left): Next enters from the upper right, Previous from the
     upper left. On the light theme shadows develop first (like a
     print); on the dark one highlights first (like light on film).
   - Autoplay: 4.2 s at rest (a timer: nothing draws), then a copper
     line climbs through the photo's tones (1.4 s) and becomes the
     tide's front (2.2 s). Drag / swipe scrubs the tide by hand (one
     long drag can develop through several photos); Previous / Next
     run it (quicker presses queue, at most 3); a click on the photo
     opens it, a click on a neighbour's map goes there.
   - Reduced motion: no autoplay unless Play is pressed, no tide: a
     plain 240 ms cross-fade; no loupe; no fades.
   - Draws only while on screen, the tab is visible and something
     changes. Everything is released by destroy().
   This module knows nothing about React: Gallery.tsx owns the buttons
   and passes the photos in. Same interface as the ribbon it replaced.
   ========================================================= */
import { fbm } from '../../lib/noise';

export interface IsophotePhoto { src: string; position?: string }
export interface IsophoteEvents {
  /** the photo being shown (or heading to) changed */
  onIndex(i: number): void;
  /** automatic changes switched on / off (by the visitor's Play / Pause) */
  onPlaying(p: boolean): void;
  /** a photo was clicked / tapped (not dragged): its index in the photo list */
  onPick(i: number): void;
  /** the first frame with the photo is on screen */
  onReady(): void;
  /** WebGL failed (or the context was lost): the host shows its plain gallery */
  onFail(reason: string): void;
}

/** Every timing, in ms */
const TIDE = {
  rest: 4200,         // autoplay: how long a photo simply sits there
  restAfterStep: 5200,
  crest: 1400,        // autoplay: the copper line climbing through the photo
  auto: 2200,         // autoplay tide
  step: 1500,         // Previous / Next / a neighbour clicked
  fast: 900,          // queued steps
  finish: 180,        // a running tide hurries to its end when another step is queued
  queue: 3,           // at most this many steps wait
  reducedFade: 240,   // reduced motion: the cross-fade
  reducedEvery: 6000, // reduced motion + Play: a new photo this often
  resumeAfter: 2200,  // after a drag / the preview, before autoplay carries on
  loupeIdle: 900,     // the loupe goes once the pointer rests this long
};
/** Contour levels: hero / neighbours, wide / narrow (or touch) */
const LEVELS = { hero: 14, heroNarrow: 10, ghost: 9, ghostNarrow: 7 };
const MAP_W = 192, MAP_H = 256;
const ASPECT = 0.75;   // the plate: 3:4, like the photos

const VS = `#version 300 es
in vec2 aPos;                // 0..1, y down
uniform vec4 uRect;          // x, y, w, h (CSS px inside the canvas, y down)
uniform vec2 uView;          // canvas size, CSS px
out vec2 vUv;
out vec2 vPx;
void main(){
  vec2 pad = vec2(1.0);      // 1px of room round the plate, so its edge antialiases
  vec2 px = -pad + aPos * (uRect.zw + 2.0 * pad);
  vPx = px;
  vUv = px / uRect.zw;
  vec2 clip = ((uRect.xy + px) / uView) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vPx;
uniform sampler2D uPhotoA, uPhotoB, uElevA, uElevB;
uniform float uT, uPlain, uMode, uGhostA, uCrest, uCrestA, uFrontMix, uOrder, uPx, uFadePx, uHair;
uniform vec2 uLevels;        // plain lines; index lines (every 5th)
uniform vec2 uFade;          // the photos' own fade-in (A, B)
uniform vec3 uRamp;          // the tide's travel direction (x, y down) and 1 / half its extent
uniform vec4 uPaper, uLine, uGhost, uInk, uCopper;
uniform vec4 uLoupe;         // x, y (rect CSS px), radius, strength
uniform vec4 uSize;          // rect w, h, corner radius, -
uniform vec2 uView;
out vec4 o;

// a smooth (cubic B-spline) lookup from four bilinear taps, so contour lines from the small map stay round
float bs(sampler2D s, vec2 uv){
  vec2 sz = vec2(textureSize(s, 0));
  vec2 p = uv * sz - 0.5, i = floor(p), f = p - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / sz, h1 = (i + 1.5 + w3 / g1) / sz;
  return g0.y * (g0.x * texture(s, h0).r + g1.x * texture(s, vec2(h1.x, h0.y)).r)
       + g1.y * (g0.x * texture(s, vec2(h0.x, h1.y)).r + g1.x * texture(s, h1).r);
}
float eIOC(float x){ return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
float eIOS(float x){ return 0.5 - 0.5 * cos(3.14159265 * x); }
// a contour line every 1/n; it thins away where lines would crowd closer than a few px (no moiré on busy photos)
float iso(float e, float n, float halfW){
  float f = e * n, w = max(fwidth(f), 1e-5);
  float d = abs(fract(f + 0.5) - 0.5) / w;
  return (1.0 - smoothstep(halfW - 0.5, halfW + 0.5, d)) * (1.0 - smoothstep(0.25, 0.4, w * uPx));
}
float front(float e, float L, float halfW){ return 1.0 - smoothstep(halfW - 0.5, halfW + 0.5, abs(e - L) / max(fwidth(e), 1e-5)); }

void main(){
  vec2 uv = clamp(vUv, 0.0, 1.0);
  float rA = bs(uElevA, uv), rB = bs(uElevB, uv);
  float r = clamp(dot(vPx - uSize.xy * 0.5, uRamp.xy) * uRamp.z * 0.5 + 0.5, 0.0, 1.0);
  float oA = mix(rA, 1.0 - rA, uOrder), oB = mix(rB, 1.0 - rB, uOrder);
  float eA = oA * 0.82 + 0.18 * (1.0 - r);   // A washes off from the entry edge first
  float eB = oB * 0.82 + 0.18 * r;           // B develops from the entry edge first
  float Lb = 1.04 - 1.08 * eIOC(clamp(uT / 0.55, 0.0, 1.0));
  float Ld = -0.04 + 1.20 * eIOS(clamp((uT - 0.30) / 0.70, 0.0, 1.0));
  float aA = smoothstep(Lb + 0.03, Lb - 0.03, eA);
  float rv = smoothstep(Ld + 0.012, Ld - 0.012, eB);
  float dB = smoothstep(Ld, Ld - 0.12, eB);
  vec3 pA = texture(uPhotoA, uv).rgb, pB = texture(uPhotoB, uv).rgb;
  vec3 devB = mix(vec3(dot(pB, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.05, 0.97, 0.86), pB, dB * dB);
  vec3 c = uPaper.rgb;
  c = mix(c, pA, aA * uFade.x);
  c = mix(c, devB, rv * (0.35 + 0.65 * dB) * uFade.y);

  // the maps (plain 1 CSS px, index 1.4)
  float iA = max(iso(rA, uLevels.x, 0.5 * uPx), iso(rA, uLevels.y, 0.7 * uPx));
  float iB = max(iso(rB, uLevels.x, 0.5 * uPx), iso(rB, uLevels.y, 0.7 * uPx));
  float lA = iA * (1.0 - aA) * (1.0 - smoothstep(0.50, 0.90, uT));
  float lB = iB * (1.0 - rv) * smoothstep(0.20, 0.45, uT);
  c = mix(c, uLine.rgb, uLine.a * max(lA, lB));
  // the falling wash-off front, and the rising copper develop front
  float fb = front(eA, Lb, 0.75 * uPx) * step(0.001, uT) * (1.0 - smoothstep(0.5, 0.6, uT));
  c = mix(c, mix(uCopper.rgb, uLine.rgb, uFrontMix), 0.6 * fb);
  float fd = front(eB, Ld, 0.75 * uPx) * step(0.30, uT) * (1.0 - smoothstep(0.85, 1.0, uT));
  c = mix(c, uCopper.rgb, 0.7 * fd);
  // autoplay: the copper line climbing through the photo's tones (on a faint paper halo)
  float ch = front(eA, uCrest, 1.25 * uPx), cl = front(eA, uCrest, 0.62 * uPx);
  c = mix(c, uPaper.rgb, 0.25 * ch * uCrestA);
  c = mix(c, uCopper.rgb, 0.5 * cl * uCrestA);
  // the loupe: the photo's own contours near the pointer
  float m = smoothstep(uLoupe.z, 0.55 * uLoupe.z, distance(vPx, uLoupe.xy)) * uLoupe.w;
  float lp = iso(rA, uLevels.x, 0.5 * uPx), lx = iso(rA, uLevels.y, 0.7 * uPx);
  c = mix(c, uInk.rgb, uInk.a * m * lp * aA);
  c = mix(c, uCopper.rgb, 0.5 * m * lx * aA);
  // reduced motion: a plain cross-fade instead of all of the above
  c = mix(c, mix(mix(uPaper.rgb, pA, uFade.x), mix(uPaper.rgb, pB, uFade.y), uT), uPlain);

  // the plate: a rounded rectangle (CSS px; negative inside)
  vec2 q = abs(vPx - uSize.xy * 0.5), b = uSize.xy * 0.5 - uSize.z;
  float d = length(max(q - b, 0.0)) + min(max(q.x - b.x, q.y - b.y), 0.0) - uSize.z;
  float aa = max(fwidth(d) * 0.75, 1e-4), inside = 1.0 - smoothstep(-aa, aa, d);
  c = mix(c, uLine.rgb, 0.5 * uHair * (1.0 - smoothstep(0.5, 1.5, abs(d + 0.75))));
  float xc = gl_FragCoord.x / uPx;
  float ef = smoothstep(0.0, uFadePx, min(xc, uView.x - xc));

  vec4 hero = vec4(c, 1.0) * inside * ef;
  // a neighbour's map dissolves towards its edges rather than stopping at a box
  float g = uGhost.a * uGhostA * max(iA * aA, iB * rv) * smoothstep(0.0, 28.0, -d) * ef;
  vec4 ghost = vec4(uGhost.rgb * g, g);
  o = mix(hero, ghost, uMode);
}`;

const parsePos = (p?: string) => {
  const [x = '50%', y = '50%'] = (p || '').trim().split(/\s+/);
  const f = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 : v === 'left' || v === 'top' ? 0 : v === 'right' || v === 'bottom' ? 1 : 0.5);
  return { x: f(x), y: f(y) };
};
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eIOC = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eIOS = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
const eOut3 = (x: number) => 1 - Math.pow(1 - x, 3);
/** the tide's slant: the background streak's, about 28° below level */
const SLANT = { x: 0.883, y: 0.469 };

/** separable box blur of a MAP_W × MAP_H field, radius r, edges clamped (tmp: scratch of the same size).
    A running sum along each row / column, so a wide blur costs no more than a narrow one. */
function blur(a: Float32Array, tmp: Float32Array, r: number) {
  const d = 2 * r + 1;
  const pass = (src: Float32Array, dst: Float32Array, len: number, lines: number, step: number, stride: number) => {
    for (let l = 0; l < lines; l++) {
      const o = l * stride, at = (i: number) => src[o + Math.min(len - 1, Math.max(0, i)) * step];
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let i = 0; i < len; i++) {
        dst[o + i * step] = sum / d;
        sum += at(i + r + 1) - at(i - r);
      }
    }
  };
  pass(a, tmp, MAP_W, MAP_H, 1, MAP_W);   // rows
  pass(tmp, a, MAP_H, MAP_W, MAP_W, 1);   // columns
}
function normalise(a: Float32Array) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
  const span = hi - lo || 1;
  for (let i = 0; i < a.length; i++) a[i] = clamp01((a[i] - lo) / span);
}

/** A photo's elevation map: blurred brightness, partly equalised, a touch of noise, 0..1 (rows top first);
    and a much smoother one for when it's a neighbour (a few broad lines, not the photo's detail) */
function elevation(img: HTMLImageElement, position: string | undefined, seed: number, scratch: HTMLCanvasElement) {
  scratch.width = MAP_W; scratch.height = MAP_H;
  const g = scratch.getContext('2d', { willReadFrequently: true })!;
  const s = Math.max(MAP_W / img.naturalWidth, MAP_H / img.naturalHeight);
  const sw = MAP_W / s, shh = MAP_H / s, fp = parsePos(position);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (img.naturalWidth - sw) * fp.x, (img.naturalHeight - shh) * fp.y, sw, shh, 0, 0, MAP_W, MAP_H);
  const px = g.getImageData(0, 0, MAP_W, MAP_H).data;
  const n = MAP_W * MAP_H;
  const a = new Float32Array(n), tmp = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  blur(a, tmp, 2); blur(a, tmp, 2); blur(a, tmp, 2);
  // partial equalisation: tones spread evenly over the levels, without flattening the picture
  const hist = new Float32Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, (a[i] * 255) | 0)]++;
  for (let i = 1; i < 256; i++) hist[i] += hist[i - 1];
  for (let i = 0; i < n; i++) a[i] = a[i] * 0.35 + (hist[Math.min(255, (a[i] * 255) | 0)] / n) * 0.65;
  // break up flat areas (skies, walls) so their lines flow instead of terracing
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) a[y * MAP_W + x] += 0.05 * (fbm(x / 40, y / 40, 17 + seed) - 0.5);
  blur(a, tmp, 1);
  normalise(a);
  const soft = Float32Array.from(a);
  blur(soft, tmp, 6); blur(soft, tmp, 6); blur(soft, tmp, 4);
  normalise(soft);
  return { map: a, soft };
}

export function createIsophote(host: HTMLElement, photos: IsophotePhoto[], ev: IsophoteEvents) {
  const n = photos.length;
  if (!n) throw new Error('no photos');
  const canvas = document.createElement('canvas');
  canvas.className = 'gal__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'default' });
  if (!ctx) throw new Error('WebGL2 is not available');
  const gl: WebGL2RenderingContext = ctx;

  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = (gl.getShaderInfoLog(vs) || '') + (gl.getShaderInfoLog(fs) || '') + (gl.getProgramInfoLog(prog) || '');
    gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    throw new Error('gallery shader failed: ' + log);
  }
  const U = Object.fromEntries(['uRect', 'uView', 'uPhotoA', 'uPhotoB', 'uElevA', 'uElevB', 'uT', 'uPlain', 'uMode', 'uGhostA', 'uCrest', 'uCrestA',
    'uFrontMix', 'uOrder', 'uPx', 'uFadePx', 'uHair', 'uLevels', 'uFade', 'uRamp', 'uPaper', 'uLine', 'uGhost', 'uInk', 'uCopper', 'uLoupe', 'uSize']
    .map((k) => [k, gl.getUniformLocation(prog, k)]));

  const vao = gl.createVertexArray()!, vbo = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  const tex = (setup: () => void) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    setup();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  // stand-ins for whatever hasn't loaded yet: a clear photo, a flat (line-less) map
  const blankPhoto = tex(() => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  });
  const flatMap = tex(() => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([0.5]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  });

  host.appendChild(canvas);

  /* ---- state ---- */
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  type Item = {
    ph: IsophotePhoto; img: HTMLImageElement | null; loading: boolean; failed: boolean;
    photo: WebGLTexture | null; photoH: number; fade: number;
    map: Float32Array | null; mapTex: WebGLTexture | null; softTex: WebGLTexture | null; mapFade: number; used: number;
  };
  const items: Item[] = photos.map((ph) => ({ ph, img: null, loading: false, failed: false, photo: null, photoH: 0, fade: 0, map: null, mapTex: null, softTex: null, mapFade: 0, used: 0 }));
  let Wc = 1, Hc = 1, dpr = 1, narrow = false;   // canvas size (CSS px)
  let hero = { x: 0, y: 0, w: 1, h: 1 }, ghostH = 1, ghostW = 1, gap = 0, fadePx = 20;
  let texH = 512;

  type Phase = 'rest' | 'crest' | 'tide' | 'drag' | 'settle' | 'fade';
  let phase: Phase = 'rest';
  let index = 0;                 // the photo shown, or the one the visitor is heading to
  let from = 0, to = 0, dir = 1, m = 0, t = 0;
  let rate = 0;                  // tide: t per ms
  let kind: 'auto' | 'step' = 'step';
  let pending = 0;               // steps pressed while a tide runs (net); more than TIDE.queue → one tide straight there
  let posBase = 0;               // `from`, unwrapped (for tests)
  let settle = { t0: 0, t1: 0, dur: 1, el: 0 };
  let crestMs = 0, crestA = 0;
  let choice: boolean | null = null;
  const held = new Set<string>();
  let resumeAt = 0, restLeft = TIDE.rest, restTotal = TIDE.rest, restTimer = 0, armedAt = 0;
  let visible = false, raf = 0, last = 0, destroyed = false, ready = false, firstDraw = 0, started = false;
  let drag: { id: number; x: number; y: number; moved: boolean; s0: number; s: number; samples: { x: number; t: number }[] } | null = null;
  let wheel: { s0: number; acc: number; timer: number; quietUntil: number } | null = null;
  const loupe = { x: 0, y: 0, a: 0, target: 0, lastMove: 0 };
  const hover = { k: 0, a: 0 };
  let col = { paper: [0, 0, 0], line: [0, 0, 0, 0], ghost: [0, 0, 0, 0], ink: [0, 0, 0, 0], copper: [0, 0, 0] };
  let order = 1;

  const playing = () => choice ?? !reduce.matches;
  const running = () => visible && !document.hidden && !destroyed && !gl.isContextLost();

  /* ---- theme: colours from gallery.css (comma lists: r, g, b[, a]) ---- */
  function readTheme() {
    const cs = getComputedStyle(host);
    const v = (name: string) => cs.getPropertyValue(name).split(',').map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x));
    const rgb = (a: number[]) => [a[0] / 255, a[1] / 255, a[2] / 255];
    const rgba = (a: number[]) => [...rgb(a), a[3] ?? 1];
    col = { paper: rgb(v('--gal-paper')), line: rgba(v('--gal-line')), ghost: rgba(v('--gal-ghost')), ink: rgba(v('--gal-ink')), copper: rgb(v('--gal-copper')) };
    order = document.documentElement.dataset.theme === 'light' ? 0 : 1;
  }

  /* ---- layout ---- */
  function fit() {
    const r = host.getBoundingClientRect();
    const cap = coarse ? 1.5 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    dpr = Math.min(dpr, Math.sqrt(2.4e6 / Math.max(1, r.width * r.height)));
    Wc = Math.max(1, r.width); Hc = Math.max(1, r.height);
    const W = Math.max(1, Math.round(Wc * dpr)), H = Math.max(1, Math.round(Hc * dpr));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const wide = Wc / Hc >= 1.3;
    narrow = coarse || Wc < 480;
    const hh = Math.round(wide ? Hc : 0.94 * Hc), hw = Math.round(ASPECT * hh);
    hero = { x: Math.round((Wc - hw) / 2), y: Math.round((Hc - hh) / 2), w: hw, h: hh };
    ghostH = Math.round(0.86 * hh); ghostW = ASPECT * ghostH;
    gap = wide ? Math.round(0.07 * Hc) : Math.max(10, Math.round(0.035 * Hc));
    fadePx = Math.min(96, Math.max(20, 0.08 * Wc));
    const need = Math.min(coarse ? 768 : 1024, Math.max(256, Math.ceil(hh * dpr)));
    texH = need;
    for (const it of items) {
      if (!it.photo || !it.img) continue;
      const can = Math.min(need, it.img.naturalHeight, Math.round(it.img.naturalWidth / ASPECT));   // never past its own pixels
      if (can > it.photoH || can < it.photoH * 0.7) uploadPhoto(it);
    }
  }
  /** the neighbours' boxes that are (at least 12px) on the canvas */
  function ghosts() {
    const out: { x: number; y: number; w: number; h: number; offset: number }[] = [];
    const y = (Hc - ghostH) / 2;
    for (const k of [-2, -1, 1, 2]) {
      const x = k > 0 ? hero.x + hero.w + gap + (k - 1) * (ghostW + gap) : hero.x - gap - ghostW + (k + 1) * (ghostW + gap);
      const seen = Math.min(Wc, x + ghostW) - Math.max(0, x);
      if (seen >= 12) out.push({ x, y, w: ghostW, h: ghostH, offset: k });
    }
    return out;
  }

  /* ---- photos → textures, maps ---- */
  const crop = document.createElement('canvas'), scratch = document.createElement('canvas');
  function uploadPhoto(it: Item) {
    const img = it.img!;
    // never larger than the photo's own pixels (most are 480 × 640)
    const ch = Math.max(16, Math.min(texH, img.naturalHeight, Math.round(img.naturalWidth / ASPECT))), cw = Math.round(ch * ASPECT);
    crop.width = cw; crop.height = ch;
    const g = crop.getContext('2d')!;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const sw = cw / s, shh = ch / s, fp = parsePos(it.ph.position);
    g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, cw, ch);
    g.drawImage(img, (img.naturalWidth - sw) * fp.x, (img.naturalHeight - shh) * fp.y, sw, shh, 0, 0, cw, ch);
    if (!it.photo) it.photo = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, it.photo);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, crop);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    it.photoH = ch;
  }
  function buildMap(it: Item, i: number) {
    if (destroyed || !it.img || it.map) return;
    try {
      const { map, soft } = elevation(it.img, it.ph.position, i, scratch);
      const upload = (data: Float32Array) => tex(() => {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, MAP_W, MAP_H, 0, gl.RED, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      });
      it.map = map;
      it.mapTex = upload(map);
      it.softTex = upload(soft);
      if (reduce.matches) it.mapFade = 1;
    } catch { /* no lines for this one */ }
    wake();
  }
  /* The maps are built one per idle moment (about 10–30 ms each), nearest to the photo shown first,
     so scrolling to the gallery never stalls behind all eleven at once. */
  let mapJob = 0;
  const hasIdle = typeof window.requestIdleCallback === 'function';
  const idle = (fn: () => void) => (hasIdle ? window.requestIdleCallback(fn, { timeout: 400 }) : window.setTimeout(fn, 16));
  const cancelIdle = (id: number) => (hasIdle ? window.cancelIdleCallback(id) : clearTimeout(id));
  function scheduleMaps() {
    if (mapJob || destroyed) return;
    mapJob = idle(() => {
      mapJob = 0;
      const todo = items.map((it, i) => ({ it, i })).filter(({ it }) => it.img && !it.map);
      if (!todo.length) return;
      const dist = (i: number) => { const d = mod(i - index, n); return Math.min(d, n - d); };
      todo.sort((a, b) => dist(a.i) - dist(b.i));
      buildMap(todo[0].it, todo[0].i);
      scheduleMaps();
    });
  }
  function loadAll() {
    if (started) return;
    started = true;
    items.forEach((it) => {
      it.loading = true;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { if (destroyed) return; it.img = img; scheduleMaps(); wake(); };
      img.onerror = () => { it.failed = true; wake(); };
      img.src = it.ph.src;
    });
  }
  /** the hero's photo textures: what's needed now (index ± 2, the tide's ends), at most 6 kept */
  function photoTex(i: number) {
    const it = items[i];
    if (!it.img) return null;
    if (!it.photo) { try { uploadPhoto(it); if (reduce.matches) it.fade = 1; } catch { return null; } }
    it.used = performance.now();
    return it.photo;
  }
  function trim() {
    const keep = new Set([from, to, index, ...[-2, -1, 1, 2].map((k) => mod(index + k, n))]);
    const live = items.filter((it) => it.photo).sort((a, b) => a.used - b.used);
    for (const it of live) {
      if (live.filter((x) => x.photo).length <= 6) break;
      const i = items.indexOf(it);
      if (keep.has(i)) continue;
      gl.deleteTexture(it.photo); it.photo = null; it.photoH = 0; it.fade = 0;
    }
  }

  /* ---- drawing ---- */
  const ramp = (w: number, h: number, d: number) => {
    const dx = -SLANT.x * d, dy = SLANT.y;   // Next: in from the upper right, travelling down-left
    return [dx, dy, 1 / (0.5 * (Math.abs(dx) * w + Math.abs(dy) * h))];
  };
  function bindPair(a: number, b: number, photosToo: boolean) {
    const ia = items[a], ib = items[b];
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, (photosToo && photoTex(a)) || blankPhoto);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (photosToo && photoTex(b)) || blankPhoto);
    // the neighbours use the smooth maps: a few broad lines each
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, (photosToo ? ia.mapTex : ia.softTex) || flatMap);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, (photosToo ? ib.mapTex : ib.softTex) || flatMap);
  }
  const rectU = (r: { x: number; y: number; w: number; h: number }) => {
    gl.uniform4f(U.uRect, r.x, r.y, r.w, r.h);
    gl.uniform4f(U.uSize, r.w, r.h, 9.6, 0);
  };
  /** the tide's t as the shader sees it (reduced-motion fades and the rest state included) */
  const tideT = () => (phase === 'rest' || phase === 'crest' ? 0 : t);
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(U.uPhotoA, 0); gl.uniform1i(U.uPhotoB, 1); gl.uniform1i(U.uElevA, 2); gl.uniform1i(U.uElevB, 3);
    gl.uniform2f(U.uView, Wc, Hc);
    gl.uniform1f(U.uPx, dpr);
    gl.uniform1f(U.uFadePx, fadePx);
    gl.uniform1f(U.uOrder, order);
    gl.uniform4f(U.uPaper, col.paper[0], col.paper[1], col.paper[2], 1);
    gl.uniform4f(U.uLine, col.line[0], col.line[1], col.line[2], col.line[3]);
    gl.uniform4f(U.uGhost, col.ghost[0], col.ghost[1], col.ghost[2], col.ghost[3]);
    gl.uniform4f(U.uInk, col.ink[0], col.ink[1], col.ink[2], col.ink[3]);
    gl.uniform4f(U.uCopper, col.copper[0], col.copper[1], col.copper[2], 1);
    const plain = phase === 'fade' || reduce.matches ? 1 : 0;
    const tt = tideT();
    const a = from, b = phase === 'rest' || phase === 'crest' ? from : to;
    const d = phase === 'crest' ? 1 : dir;
    gl.uniform1f(U.uPlain, plain);
    gl.uniform1f(U.uCrest, -0.02 + 1.04 * eIOS(clamp01(crestMs / TIDE.crest)));
    gl.uniform1f(U.uFrontMix, kind === 'auto' ? smooth(0, 0.2, tt) : 1);
    gl.uniform4f(U.uLoupe, loupe.x - hero.x, loupe.y - hero.y, Math.min(120, 0.26 * hero.h), plain ? 0 : loupe.a);

    // the neighbours: their maps only
    gl.uniform1f(U.uMode, 1);
    gl.uniform1f(U.uCrestA, 0);
    gl.uniform1f(U.uHair, 0);
    const gl2 = narrow ? LEVELS.ghostNarrow : LEVELS.ghost;
    gl.uniform2f(U.uLevels, gl2, gl2 / 5);
    // reduced motion: the maps swap at the end of the fade, not gradually
    gl.uniform1f(U.uT, plain ? (tt >= 1 ? 1 : 0) : tt);
    for (const g of ghosts()) {
      const ga = mod(a + g.offset, n), gb = mod(b + g.offset, n);
      if (!items[ga].mapTex && !items[gb].mapTex) continue;
      const f = Math.min(items[ga].mapTex ? items[ga].mapFade : 1, items[gb].mapTex ? items[gb].mapFade : 1);
      const strength = (Math.abs(g.offset) === 1 ? 1 : 0.45) * (1 + 0.6 * (hover.k === g.offset ? hover.a : 0));
      gl.uniform1f(U.uGhostA, strength * f);
      const rp = ramp(g.w, g.h, d);
      gl.uniform3f(U.uRamp, rp[0], rp[1], rp[2]);
      bindPair(ga, gb, false);
      rectU(g);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // the photo
    gl.uniform1f(U.uMode, 0);
    gl.uniform1f(U.uT, tt);
    const hl = narrow ? LEVELS.heroNarrow : LEVELS.hero;
    gl.uniform2f(U.uLevels, hl, hl / 5);
    gl.uniform1f(U.uCrestA, plain ? 0 : crestA);
    gl.uniform1f(U.uHair, plain ? 0 : smooth(0.05, 0.15, tt) * (1 - smooth(0.85, 0.97, tt)));
    const rp = ramp(hero.w, hero.h, d);
    gl.uniform3f(U.uRamp, rp[0], rp[1], rp[2]);
    bindPair(a, b, true);
    gl.uniform2f(U.uFade, items[a].photo ? items[a].fade : 0, items[b].photo ? items[b].fade : 0);
    rectU(hero);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (!firstDraw) firstDraw = performance.now();
    if (!ready && ((items[index].photo && (items[index].map || items[index].failed)) || performance.now() - firstDraw > 2500)) { ready = true; ev.onReady(); }
  }

  /* ---- the clock: frames only while something changes ---- */
  function animating() {
    if (phase === 'crest' || phase === 'tide' || phase === 'settle' || phase === 'fade' || phase === 'drag') return true;
    // the loupe stays live until the pointer has rested long enough for it to fade
    if (crestA > 0 || loupe.target > 0 || Math.abs(loupe.a - loupe.target) > 1e-3) return true;
    if (hover.a !== (hover.k ? 1 : 0)) return true;
    for (const it of items) if ((it.photo && it.fade < 1) || (it.mapTex && it.mapFade < 1)) return true;
    return !ready;
  }
  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    const instant = reduce.matches;
    // fades of newly arrived photos and maps
    for (const it of items) {
      if (it.photo && it.fade < 1) it.fade = instant ? 1 : Math.min(1, it.fade + dt / 350);
      if (it.mapTex && it.mapFade < 1) it.mapFade = instant ? 1 : Math.min(1, it.mapFade + dt / 400);
    }
    // loupe and neighbour hover
    if (loupe.target > 0 && now - loupe.lastMove > TIDE.loupeIdle) loupe.target = 0;
    loupe.a += (loupe.target - loupe.a) * Math.min(1, dt / (loupe.target > loupe.a ? 200 : 250) * 3);
    if (Math.abs(loupe.a - loupe.target) < 1e-3) loupe.a = loupe.target;
    hover.a = hover.k ? Math.min(1, hover.a + dt / 160) : Math.max(0, hover.a - dt / 160);
    if (!hover.a && !hover.k) hover.a = 0;
    // the phases
    if (phase === 'crest') {
      crestMs += dt;
      crestA = Math.min(1, crestMs / 300);
      if (crestMs >= TIDE.crest) startTide(1, TIDE.auto, 'auto');
    } else if (crestA > 0) crestA = Math.max(0, crestA - dt / 300);
    if (phase === 'tide' || phase === 'fade') {
      t = Math.min(1, t + rate * dt);
      if (t >= 1) commit();
    } else if (phase === 'settle') {
      settle.el += dt;
      const k = clamp01(settle.el / settle.dur);
      t = settle.t0 + (settle.t1 - settle.t0) * eOut3(k);
      if (k >= 1) endSettle();
    }
    draw();
    if (animating()) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function wake() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }

  /* ---- the dwell: a plain timer, so nothing draws while a photo just sits there ---- */
  const canDwell = () => playing() && held.size === 0 && running() && phase === 'rest' && !drag;
  function arm() {
    if (restTimer || !canDwell()) return;
    armedAt = performance.now();
    restTimer = window.setTimeout(() => { restTimer = 0; restLeft = 0; startCrest(); }, Math.max(restLeft, resumeAt - armedAt));
  }
  function disarm() {
    if (!restTimer) return;
    clearTimeout(restTimer); restTimer = 0;
    restLeft = Math.max(0, restLeft - (performance.now() - armedAt));
  }
  const rearm = () => { disarm(); arm(); };
  function startCrest() {
    if (!canDwell()) return;
    if (reduce.matches) { go(1); return; }
    phase = 'crest'; crestMs = 0; dir = 1;
    loupe.target = 0;
    wake();
  }
  function cancelCrest() {
    if (phase !== 'crest') return;
    phase = 'rest';
    restLeft = 1200;   // the dwell picks up again just before the line would start
    wake();   // the line fades out
  }

  /* ---- tides ---- */
  function setIndex(i: number) { i = mod(i, n); if (i !== index) { index = i; ev.onIndex(i); } }
  function startTide(k: number, dur: number, how: 'auto' | 'step') {
    disarm();
    if (phase === 'crest') crestA = 0;   // the climbing line becomes the tide's front
    from = mod(from, n);
    to = mod(from + k, n); dir = Math.sign(k) || 1; m = Math.abs(k); t = 0;
    rate = 1 / dur; kind = how;
    phase = reduce.matches ? 'fade' : 'tide';
    if (phase === 'fade') rate = 1 / TIDE.reducedFade;
    setIndex(to + pending);
    wake();
  }
  function commit() {
    posBase += dir * m;
    from = to; t = 0; m = 0;
    phase = 'rest';
    if (pending) {
      const k = Math.abs(pending) > TIDE.queue ? pending : Math.sign(pending);
      pending -= k;
      startTide(k, Math.abs(k) > 1 ? TIDE.step : TIDE.fast, 'step');
      return;
    }
    restLeft = restTotal = reduce.matches ? TIDE.reducedEvery : kind === 'auto' ? TIDE.rest : TIDE.restAfterStep;
    setIndex(from);
    trim();
    arm();
  }
  /** finish whatever is under way, at once (the preview opening, a theme change, reduced motion switching on) */
  function resolve() {
    const wasDrag = phase === 'drag';
    if (phase === 'crest') { phase = 'rest'; crestA = 0; }
    if (phase === 'tide' || phase === 'fade' || phase === 'settle' || phase === 'drag') {
      if (phase === 'settle' && settle.t1 === 0) { t = 0; to = from; m = 0; phase = 'rest'; setIndex(from); }
      else if (phase === 'drag' && t < 0.5) { t = 0; to = from; m = 0; phase = 'rest'; setIndex(from); }
      else {
        posBase += dir * m;
        from = mod(to + pending, n); posBase += pending;
        to = from; pending = 0; t = 0; m = 0; phase = 'rest'; setIndex(from);
      }
      if (wasDrag) endPointer();
    }
    restLeft = restTotal = reduce.matches ? TIDE.reducedEvery : TIDE.rest;
  }
  function go(k: number) {
    if (!k) return;
    if (phase === 'drag' || phase === 'settle') return;
    if (reduce.matches) {
      if (phase === 'fade') { t = 1; commit(); }
      if (phase === 'crest') phase = 'rest';
      startTide(k, TIDE.reducedFade, 'step');
      return;
    }
    if (phase === 'rest' || phase === 'crest') { cancelCrest(); crestA = 0; startTide(k, TIDE.step, 'step'); return; }
    // a tide is running: it hurries to its end, and this step waits its turn
    pending += k;
    rate = Math.max(rate, (1 - t) / TIDE.finish);
    setIndex(to + pending);
  }

  /* ---- input: drag / swipe scrubs the tide by hand ---- */
  const scrubPx = () => 0.9 * hero.w;
  function scrub(s: number) {
    // whole photos crossed: they're committed, and the scrub carries on from there
    while (Math.abs(s) >= 1) {
      const sg = Math.sign(s);
      from = mod(from + sg, n); posBase += sg;
      if (drag) drag.s0 -= sg;
      if (wheel) wheel.s0 -= sg;
      s -= sg;
    }
    if (s >= 0) { dir = 1; to = mod(from + 1, n); } else { dir = -1; to = mod(from - 1, n); }
    m = 1; t = Math.abs(s);
    setIndex(t >= 0.5 ? to : from);
  }
  /** take over from whatever is happening, for a drag or a trackpad swipe: returns where the scrub starts */
  function grab() {
    disarm(); pending = 0;
    let s0 = 0;
    if (phase === 'crest') { phase = 'rest'; crestA = 0; }
    if ((phase === 'tide' || phase === 'settle') && m === 1) s0 = dir * t;
    else if (phase !== 'rest' && phase !== 'drag') resolve();
    phase = 'drag';
    loupe.target = 0;
    return s0;
  }
  function release(v: number) {
    const s = dir * t;
    const flick = Math.abs(v) > 0.45, flickDir = -Math.sign(v);
    let ok = (t > 0.3 && !(flick && flickDir === -Math.sign(s))) || (flick && (flickDir === Math.sign(s) || Math.abs(s) < 0.02));
    if (ok && Math.abs(s) < 0.02) { dir = flickDir || 1; to = mod(from + dir, n); m = 1; }
    if (m !== 1) ok = false;
    phase = 'settle';
    settle = ok ? { t0: t, t1: 1, dur: Math.max(160, (1 - t) * 1400), el: 0 } : { t0: t, t1: 0, dur: Math.max(120, t * 800), el: 0 };
    kind = 'step';
    setIndex(ok ? to : from);
    wake();
  }
  function endSettle() {
    if (settle.t1 === 1) { t = 1; commit(); }
    else { t = 0; to = from; m = 0; phase = 'rest'; setIndex(from); restLeft = restTotal = TIDE.restAfterStep; arm(); }
  }

  const local = (e: { clientX: number; clientY: number }) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const inRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  /** sample a CPU map at uv (bilinear) */
  function sample(map: Float32Array | null, u: number, v: number) {
    if (!map) return 0.5;
    // texel centres, as the GPU samples (the map is smooth enough that bilinear matches the B-spline closely)
    const x = Math.min(MAP_W - 1, Math.max(0, clamp01(u) * MAP_W - 0.5)), y = Math.min(MAP_H - 1, Math.max(0, clamp01(v) * MAP_H - 0.5));
    const xi = Math.floor(x), yi = Math.floor(y);
    const x1 = Math.min(MAP_W - 1, xi + 1), y1 = Math.min(MAP_H - 1, yi + 1), fx = x - xi, fy = y - yi;
    const a = map[yi * MAP_W + xi], b = map[yi * MAP_W + x1], c = map[y1 * MAP_W + xi], d = map[y1 * MAP_W + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  /** mid-tide: which photo is showing under a point of the hero (the same sums as the shader) */
  function photoUnder(p: { x: number; y: number }) {
    const tt = tideT();
    if (tt <= 0 || phase === 'rest') return from;
    if (phase === 'fade') return tt < 0.5 ? from : to;
    const px = p.x - hero.x, py = p.y - hero.y, u = px / hero.w, v = py / hero.h;
    const rp = ramp(hero.w, hero.h, dir);
    const r = clamp01(((px - hero.w / 2) * rp[0] + (py - hero.h / 2) * rp[1]) * rp[2] * 0.5 + 0.5);
    const rA = sample(items[from].map, u, v);
    const eA = (order ? 1 - rA : rA) * 0.82 + 0.18 * (1 - r);
    const Lb = 1.04 - 1.08 * eIOC(clamp01(tt / 0.55));
    const aA = smooth(Lb + 0.03, Lb - 0.03, eA);
    return aA >= 0.5 ? from : to;
  }
  function pickAt(p: { x: number; y: number }) {
    if (inRect(p, hero)) return { kind: 'hero' as const, photo: photoUnder(p) };
    for (const g of ghosts()) if (inRect(p, g) && p.x >= 0 && p.x <= Wc) return { kind: 'ghost' as const, photo: mod(index + g.offset, n), offset: g.offset };
    return { kind: null, photo: -1 };
  }
  /** forget the pointer being tracked (its drag, capture and hold) */
  function endPointer() {
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
    held.delete('drag');
    host.classList.remove('is-dragging');
  }
  function onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag || !e.isPrimary) return;   // a second finger doesn't take over (or turn the drag into a tap)
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, s0: 0, s: 0, samples: [{ x: e.clientX, t: e.timeStamp }] };
  }
  function onMove(e: PointerEvent) {
    const p = local(e);
    // the loupe and the neighbours' hover (a precise pointer, nothing being dragged)
    if (!drag && e.pointerType === 'mouse' && finePointer.matches && !reduce.matches) {
      const k = pickAt(p);
      const overHero = k.kind === 'hero', ghostK = k.kind === 'ghost' ? (k as { offset: number }).offset : 0;
      host.classList.toggle('is-over-hero', overHero);
      host.classList.toggle('is-over-ghost', !!ghostK);
      if (ghostK !== hover.k) { hover.k = ghostK; }
      if (overHero && (phase === 'rest' || phase === 'crest')) { loupe.x = p.x; loupe.y = p.y; loupe.target = 1; loupe.lastMove = performance.now(); }
      else loupe.target = 0;
      wake();
    }
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    // a mouse press that ended outside the canvas (no pointerup reached us): let it go
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { onUp(e, true); return; }
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;   // not yet / a vertical scroll
      g.moved = true;
      canvas.setPointerCapture(e.pointerId);
      host.classList.add('is-dragging');
      held.add('drag');
      if (!reduce.matches) { g.s0 = grab(); wake(); }
    }
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
    if (!reduce.matches) scrub(g.s0 - dx / scrubPx());
  }
  function onUp(e: PointerEvent, cancelled: boolean) {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    endPointer();
    if (g.moved) {
      resumeAt = performance.now() + TIDE.resumeAfter;
      const a = g.samples[0], b = g.samples[g.samples.length - 1];
      const v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
      if (reduce.matches) {
        const dx = e.clientX - g.x;
        if (!cancelled && (Math.abs(dx) >= 40 || Math.abs(v) > 0.45)) go(-Math.sign(Math.abs(dx) >= 40 ? dx : v));
        else arm();
      } else release(cancelled ? 0 : v);
      if (cancelled && !reduce.matches) { settle = { t0: t, t1: 0, dur: Math.max(120, t * 800), el: 0 }; setIndex(from); }
    } else if (!cancelled) {
      // a click / tap: the photo opens; a neighbour's map is gone to
      const p = local(e), k = pickAt(p);
      if (k.kind === 'hero') {
        // mid-tide, the photo under the pointer is the one that opens (and stays when the preview closes)
        if (phase === 'tide' || phase === 'settle' || phase === 'fade') {
          pending = 0;
          if (k.photo === from) { t = 0; to = from; m = 0; phase = 'rest'; setIndex(from); }
          else { t = 1; commit(); }
        } else if (phase === 'crest') { phase = 'rest'; crestA = 0; }
        draw();
        ev.onPick(index);
      } else if (k.kind === 'ghost') go((k as { offset: number }).offset);
    }
    wake();
  }
  // a horizontal trackpad swipe scrubs too; vertical wheel scrolling is left to the page
  function onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
    e.preventDefault();
    const now = performance.now();
    if (reduce.matches) {
      if (!wheel) wheel = { s0: 0, acc: 0, timer: 0, quietUntil: 0 };
      clearTimeout(wheel.timer);
      wheel.timer = window.setTimeout(() => { wheel = null; }, 300);
      if (now < wheel.quietUntil) { wheel.quietUntil = now + 300; return; }
      wheel.acc += e.deltaX;
      if (Math.abs(wheel.acc) >= 60) { go(Math.sign(wheel.acc)); wheel.acc = 0; wheel.quietUntil = now + 300; }
      return;
    }
    if (!wheel) { held.add('drag'); wheel = { s0: grab(), acc: 0, timer: 0, quietUntil: 0 }; wake(); }
    wheel.acc += e.deltaX;
    scrub(wheel.s0 + wheel.acc / scrubPx());
    clearTimeout(wheel.timer);
    wheel.timer = window.setTimeout(() => {
      wheel = null; held.delete('drag'); resumeAt = performance.now() + TIDE.resumeAfter;
      if (phase === 'drag') release(0);
    }, 160);
  }
  function onLeave() {
    loupe.target = 0; hover.k = 0;
    host.classList.remove('is-over-hero', 'is-over-ghost');
    wake();
  }
  const up = (e: PointerEvent) => onUp(e, false), cancel = (e: PointerEvent) => onUp(e, true);
  const noDrag = (e: Event) => e.preventDefault();
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dragstart', noDrag);

  /* ---- keeping up with the page ---- */
  const setVisible = (on: boolean) => {
    if (on === visible) return;
    visible = on;
    if (on) { loadAll(); wake(); arm(); }
    else { cancelAnimationFrame(raf); raf = 0; last = 0; disarm(); }
  };
  const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px 0px' });
  io.observe(host);
  // backstop for the observer (loading straight at #gallery, an entry was sometimes never delivered)
  let checkQueued = 0;
  const check = () => {
    checkQueued = 0;
    const r = host.getBoundingClientRect();
    setVisible(r.bottom > -300 && r.top < innerHeight + 300 && r.width > 0);
  };
  const onScroll = () => { if (!checkQueued) checkQueued = requestAnimationFrame(check); };
  addEventListener('scroll', onScroll, { passive: true });
  const ro = new ResizeObserver(() => { fit(); onScroll(); if (running()) draw(); });
  ro.observe(host);
  // the pixel density can change without the size (a window moved to another monitor)
  let dprQuery: MediaQueryList | null = null;
  const onDpr = () => { fit(); if (running()) draw(); watchDpr(); };
  function watchDpr() {
    dprQuery?.removeEventListener('change', onDpr);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onDpr);
  }
  watchDpr();
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; disarm(); } else { wake(); arm(); } };
  document.addEventListener('visibilitychange', onVis);
  const onMotion = () => {
    resolve();
    if (reduce.matches) { loupe.target = loupe.a = 0; items.forEach((it) => { it.fade = it.photo ? 1 : 0; it.mapFade = it.mapTex ? 1 : 0; }); }
    if (choice === null) ev.onPlaying(playing());
    disarm(); arm(); wake();
  };
  reduce.addEventListener('change', onMotion);
  // the theme switch: the tide's order flips with it, so whatever is under way finishes first
  const themeWatch = new MutationObserver(() => { resolve(); readTheme(); rearm(); if (running()) draw(); });
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; disarm(); ev.onFail('Graphics context lost'); };
  canvas.addEventListener('webglcontextlost', onLost);

  readTheme();
  fit();
  ev.onPlaying(playing());
  ev.onIndex(index);

  // For testing only: add ?gallery-debug to the address
  if (/[?&]gallery-debug\b/.test(location.search)) {
    (window as unknown as { __gallery: unknown }).__gallery = {
      get index() { return index; }, get from() { return from; }, get to() { return to; },
      get t() { return t; }, get phase() { return phase; }, get pos() { return posBase + dir * m * t; },
      get running() { return !!raf; }, get playing() { return playing(); }, /** steps waiting, as separate tides (a longer wait runs as one) */
      get queue() { return Math.abs(pending) > TIDE.queue ? Math.sign(pending) : pending; },
      get dwell() {
        if (!playing()) return 0;
        const total = restTotal + TIDE.crest;
        if (phase === 'crest') return (restTotal + crestMs) / total;
        if (phase !== 'rest') return 0;
        const left = restTimer ? Math.max(0, restLeft - (performance.now() - armedAt)) : restLeft;
        return (restTotal - left) / total;
      },
      get order() { return order; },
      get mapsReady() { return items.filter((it) => it.map).length; },
      heroRect() { return { ...hero, photo: index }; },
      ghostRects() {
        return ghosts().map((g) => ({ ...g, photo: mod(index + g.offset, n), alpha: Math.abs(g.offset) === 1 ? 1 : 0.45 }));
      },
      pickAt(x: number, y: number) { const k = pickAt({ x, y }); return { kind: k.kind, photo: k.photo }; },
      count: n,
    };
  }

  return {
    next() { go(1); },
    prev() { go(-1); },
    toggle() {
      choice = !playing(); resumeAt = 0;
      if (playing()) { restLeft = restTotal = 1200; arm(); }
      else { disarm(); cancelCrest(); }
      ev.onPlaying(playing());
    },
    /** hold autoplay for a reason ('focus' inside the gallery, the 'preview' being open…) */
    hold(why: string, on: boolean) {
      if (on) {
        held.add(why); disarm();
        if (why === 'preview') { resolve(); if (running()) draw(); }
        else cancelCrest();
      } else {
        held.delete(why);
        resumeAt = performance.now() + (why === 'focus' ? 600 : TIDE.resumeAfter);
        restLeft = restTotal = reduce.matches ? TIDE.reducedEvery : TIDE.rest;
        arm();
      }
      wake();
    },
    /** the photo shown (or the one being gone to) */
    get index() { return index; },
    get playing() { return playing(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf); clearTimeout(restTimer);
      if (mapJob) cancelIdle(mapJob);
      dprQuery?.removeEventListener('change', onDpr);
      if (wheel) clearTimeout(wheel.timer);
      cancelAnimationFrame(checkQueued);
      io.disconnect(); ro.disconnect(); themeWatch.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('scroll', onScroll);
      reduce.removeEventListener('change', onMotion);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dragstart', noDrag);
      canvas.removeEventListener('webglcontextlost', onLost);
      items.forEach((it) => {
        if (it.photo) gl.deleteTexture(it.photo);
        if (it.mapTex) gl.deleteTexture(it.mapTex);
        if (it.softTex) gl.deleteTexture(it.softTex);
        it.img = null; it.map = null;
      });
      gl.deleteTexture(blankPhoto); gl.deleteTexture(flatMap);
      gl.deleteBuffer(vbo); gl.deleteVertexArray(vao);
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      crop.width = crop.height = scratch.width = scratch.height = 0;
      canvas.remove();
    },
  };
}
export type Isophote = ReturnType<typeof createIsophote>;
