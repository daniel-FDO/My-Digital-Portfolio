/* =========================================================
   THE PHOTO RIBBON — a curved, moving film strip (WebGL2, no libraries)
   Every photo is a strip of mesh bent onto the inside of a cylinder
   and seen in perspective: the middle is furthest away, so it reads
   flat and small; towards the sides the strip curves towards you, so
   photos grow taller and the top and bottom edges sweep outward. The
   photos are textures on that surface (they curve with it).
   - Photos are cover-cropped once into bounded textures (≤ 1024 px,
     768 on touch screens), keeping their object-position focus.
   - It wraps seamlessly: the strip is a loop of the photos laid end to
     end; each frame every photo is placed at its position modulo the
     loop's length.
   - Gentle automatic drift; drag / swipe with inertia; previous / next
     glide to the neighbouring photo; a click on a photo brings it to
     the middle. Reduced motion: no drift (unless Play is pressed), no
     inertia, previous / next jump.
   - Draws only while on screen and the tab is visible, and only while
     something moves. Everything (loop, observers, listeners, textures,
     buffers, the context) is released by destroy().
   This module knows nothing about React: Gallery.tsx owns the buttons
   and passes the photos in.
   ========================================================= */

export interface RibbonPhoto { src: string; position?: string }
export interface RibbonEvents {
  /** the photo nearest the middle changed */
  onIndex(i: number): void;
  /** automatic movement switched on / off (by the visitor's Play / Pause) */
  onPlaying(p: boolean): void;
  /** a photo was clicked / tapped (not dragged): its index in the photo list */
  onPick(i: number): void;
  /** the first frame with the visible photos is on screen */
  onReady(): void;
  /** WebGL failed (or the context was lost): the host shows its plain gallery */
  onFail(reason: string): void;
}

const VS = `#version 300 es
in vec2 aPos;                 // x: along the photo 0..1, y: bottom 0 .. top 1
uniform float uS0;            // where this photo starts, along the strip, relative to the middle
uniform vec2  uTile;          // photo width, height (world units)
uniform vec4  uCam;           // R (cylinder radius), D (camera distance), f (focal), aspect
uniform vec4  uEdge;          // edge region (screen x, 0 = middle, 1 = canvas edge): starts at, ends at; recess depth, light loss
out vec2 vUv;
out float vFade;              // 1 in the main viewing area → 0 at the ribbon's ends
out float vLight;
void main(){
  float R = uCam.x, D = uCam.y;
  float th = (uS0 + aPos.x * uTile.x) / R;
  // the inside of a cylinder: the strip comes towards the camera as it goes sideways
  vec3 p = vec3(R * sin(th), (aPos.y - 0.5) * uTile.y, R * (1.0 - cos(th)));
  // How far into the left / right edge region this point is (0 → 1), from where it falls on
  // screen: photos fade, dim and sink back a little as they near the ends, and emerge again.
  // (Sinking = a slight shrink towards the strip's centre line. Pushing them away in depth
  // instead would pull the ends inwards on screen and fold the strip over itself.)
  float e = smoothstep(uEdge.x, uEdge.y, abs(p.x * uCam.z / uCam.w / (D - p.z)));
  p.y *= 1.0 - uEdge.z * e * e;
  gl_Position = vec4(p.x * uCam.z / uCam.w, p.y * uCam.z, 0.0, D - p.z);
  vUv = aPos;
  vFade = 1.0 - e;
  vLight = 1.0 - uEdge.w * e;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vFade;
in float vLight;
uniform sampler2D uTex;
uniform float uFade;          // 0 = placeholder, 1 = the photo
uniform vec2  uShape;         // photo aspect (w / h), corner radius (× height)
out vec4 o;
void main(){
  vec3 photo = texture(uTex, vec2(vUv.x, 1.0 - vUv.y)).rgb * vLight;
  vec4 c = mix(vec4(0.07, 0.07, 0.07, 0.14), vec4(photo, 1.0), uFade);   // premultiplied
  // softly rounded corners, antialiased (also smooths the curved top and bottom edges)
  vec2 q = abs(vUv - 0.5) * vec2(uShape.x, 1.0);
  vec2 b = vec2(0.5 * uShape.x, 0.5) - uShape.y;
  float d = length(max(q - b, 0.0)) + min(max(q.x - b.x, q.y - b.y), 0.0) - uShape.y;
  float aa = fwidth(d) * 0.75;
  // premultiplied and transparent towards the ends: they blend into the real page background
  float a = vFade * vFade * (3.0 - 2.0 * vFade);
  o = c * (1.0 - smoothstep(-aa, aa, d)) * a;
}`;

/* Shape of the ribbon (cylinder radius = 1). Tuned against the reference recording. */
const SHAPE = {
  theta: 0.98,        // half the angle the canvas width spans: the screen's edge is this far round the cylinder
  dist: 0.87,         // camera distance from the strip's middle: edge photos look ~2× taller than the middle one (as in the reference)
  fill: 0.97,         // the edge photos' height, as a fraction of the canvas height
  aspect: 0.84,       // each photo's width / height on the strip (cover-cropped to this)
  gap: 0.022,         // gap between photos, × photo height
  radius: 0.012,      // corner rounding, × photo height
  segs: 40,           // mesh columns per photo (smooth curve)
  limit: 1.0,         // photos starting further round than this (radians) are off screen: not drawn (just past `theta`)
  // the ends, in screen terms (0 = the middle, 1 = the canvas edge): from `edgeIn` photos start
  // to fade, dim and sink back (they shrink a little: `recess`); at `edgeOut` (just inside the
  // edge) they're gone, so nothing is ever clipped hard by the canvas
  edgeIn: 0.5, edgeOut: 0.985, recess: 0.14, dim: 0.35, dimLight: 0.06,
};
const MOTION = {
  drift: 0.085,       // automatic movement, photo widths per second
  resumeAfter: 2200,  // ms after the visitor lets go before the drift comes back
  glide: 0.2,         // seconds: previous / next / click easing
  friction: 0.33,     // seconds: how quickly a flick slows down
};

const parsePos = (p?: string) => {
  const [x = '50%', y = '50%'] = (p || '').trim().split(/\s+/);
  const f = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 : v === 'left' || v === 'top' ? 0 : v === 'right' || v === 'bottom' ? 1 : 0.5);
  return { x: f(x), y: f(y) };
};
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function createRibbon(host: HTMLElement, photos: RibbonPhoto[], ev: RibbonEvents) {
  if (!photos.length) throw new Error('no photos');
  const canvas = document.createElement('canvas');
  canvas.className = 'gal__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, powerPreference: 'default' });
  if (!gl) throw new Error('WebGL2 is not available');

  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = (gl.getShaderInfoLog(vs) || '') + (gl.getShaderInfoLog(fs) || '') + (gl.getProgramInfoLog(prog) || '');
    gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    throw new Error('ribbon shader failed: ' + log);
  }
  const U = Object.fromEntries(['uS0', 'uTile', 'uCam', 'uTex', 'uFade', 'uShape', 'uEdge'].map((n) => [n, gl.getUniformLocation(prog, n)]));

  // one photo's mesh: SHAPE.segs columns × 1 row (the curve is horizontal only)
  const verts: number[] = [];
  for (let i = 0; i < SHAPE.segs; i++) {
    const a = i / SHAPE.segs, b = (i + 1) / SHAPE.segs;
    verts.push(a, 0, b, 0, a, 1, a, 1, b, 0, b, 1);
  }
  const vao = gl.createVertexArray()!, vbo = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const vertCount = verts.length / 2;
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  host.appendChild(canvas);

  /* ---- state ---- */
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  // short collections repeat so the loop is always longer than what's on screen
  const repeat = Math.max(1, Math.ceil(8 / photos.length));
  const count = photos.length * repeat;
  const tiles = photos.map((ph) => ({ ph, tex: null as WebGLTexture | null, img: null as HTMLImageElement | null, fade: 0, loading: false }));
  let W = 1, H = 1, dpr = 1;
  let cam = { R: 1, D: SHAPE.dist, f: 1, aspect: 1 }, tileW = 0.5, tileH = 0.6, step = 0.52;
  let pos = 0;                          // how far along the strip the middle of the screen is (world units)
  let vel = 0, target: number | null = null;
  let choice: boolean | null = null;    // the visitor's Play / Pause (null: the default)
  let held = new Set<string>();         // reasons the drift waits: 'focus', 'drag', 'hidden'…
  let resumeAt = 0;
  let visible = false, raf = 0, last = 0, destroyed = false, ready = false, index = -1, firstDraw = 0;
  let drag: { id: number; x: number; y: number; from: number; moved: boolean; samples: { x: number; t: number }[] } | null = null;

  const playing = () => (choice ?? !reduce.matches);
  const drifting = () => playing() && held.size === 0 && performance.now() >= resumeAt && !drag && target === null && Math.abs(vel) < 1e-4;

  /* ---- geometry: fit the strip to the canvas ---- */
  function fit() {
    const r = host.getBoundingClientRect();
    const cap = coarse ? 1.5 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    // bounded pixel count (big canvases at 2× are mostly wasted on photos this soft)
    dpr = Math.min(dpr, Math.sqrt(2.4e6 / Math.max(1, r.width * r.height)));
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const aspect = r.width / Math.max(1, r.height);
    const th = SHAPE.theta, xe = Math.sin(th), ze = 1 - Math.cos(th);
    const f = (aspect * (SHAPE.dist - ze)) / xe;            // the screen's edge is `theta` round the cylinder
    tileH = (2 * SHAPE.fill * (SHAPE.dist - ze)) / f;       // ...and the photos there just fit the height
    tileW = tileH * SHAPE.aspect;
    const was = step;
    step = tileW + tileH * SHAPE.gap;
    cam = { R: 1, D: SHAPE.dist, f, aspect };
    if (step !== was) pos = (pos / was) * step;          // keep the same photo in the middle when the size changes
    // textures sized for the tallest a photo gets on screen (the edges), bounded
    const need = Math.min(coarse ? 768 : 1024, Math.max(256, Math.ceil(H * SHAPE.fill)));
    tiles.forEach((t) => { if (t.img && (t.tex as unknown as { h?: number })?.h !== need) upload(t, need); });
    texH = need;
  }
  let texH = 512;

  /* ---- photos → textures ---- */
  const crop = document.createElement('canvas');
  function upload(t: (typeof tiles)[number], h: number) {
    const img = t.img!, w = Math.round(h * SHAPE.aspect);
    crop.width = w; crop.height = h;
    const g = crop.getContext('2d')!;
    // cover-crop, keeping the photo's object-position focus
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / s, shh = h / s, fp = parsePos(t.ph.position);
    const sx = (img.naturalWidth - sw) * fp.x, sy = (img.naturalHeight - shh) * fp.y;
    g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, w, h);
    g.drawImage(img, sx, sy, sw, shh, 0, 0, w, h);
    if (!t.tex) t.tex = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, crop);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    if (aniso) gl!.texParameterf(gl!.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl!.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    (t.tex as unknown as { h?: number }).h = h;
  }
  function load(t: (typeof tiles)[number]) {
    if (t.loading) return;
    t.loading = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (destroyed) return;
      t.img = img;
      try { upload(t, texH); } catch { /* keeps its placeholder */ }
      wake();
    };
    img.src = t.ph.src;
  }

  /* ---- where things are ---- */
  // a photo slot k (0..count-1): where it starts, relative to the middle (wrapped)
  const L = () => count * step;
  const startOf = (k: number) => mod(k * step - pos + L() / 2, L()) - L() / 2;
  // The same projection as the vertex shader, for picking: where a point `th` radians round
  // the cylinder lands on screen (NDC x), how tall a photo is there (NDC half-height), how faded.
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function project(th: number) {
    const z0 = 1 - Math.cos(th);
    const e = smooth(SHAPE.edgeIn, SHAPE.edgeOut, Math.abs((Math.sin(th) * cam.f) / (cam.aspect * (cam.D - z0))));
    const w = cam.D - z0, shrink = 1 - e * e * (reduce.matches ? 0 : SHAPE.recess);
    return { x: (Math.sin(th) * cam.f) / (cam.aspect * w), half: ((tileH / 2) * shrink * cam.f) / w, e };
  }
  // which photo slot is under a point (CSS px inside the canvas), or null (a gap, above / below
  // the strip, or where it has faded almost to nothing). Loop copies map back via k % photos.
  function slotAt(px: number, py: number) {
    const nx = (px / (W / dpr)) * 2 - 1, ny = 1 - (py / (H / dpr)) * 2;
    let best = 0, err = Infinity;
    for (let i = 0; i <= 600; i++) {                     // the curve isn't monotonic near the ends: scan
      const th = -SHAPE.limit + (2 * SHAPE.limit * i) / 600, d = Math.abs(project(th).x - nx);
      if (d < err) { err = d; best = th; }
    }
    const pr = project(best);
    if (err > 0.02 || pr.e > 0.8 || Math.abs(ny) > pr.half) return null;
    const s = mod(best + pos, L());
    const k = Math.floor(s / step);
    return s - k * step <= tileW ? k : null;
  }
  // the strip position that puts slot k in the middle, nearest to where we are
  const centreOf = (k: number) => { const p = k * step + tileW / 2; return p + Math.round((pos - p) / L()) * L(); };
  const nearest = () => Math.round((pos - tileW / 2) / step);
  // CSS px of drag → strip units, at the middle of the screen
  const perPx = () => (2 * cam.aspect * cam.D) / (cam.f * (W / dpr));

  /* ---- drawing ---- */
  function draw() {
    gl!.viewport(0, 0, W, H);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.useProgram(prog);
    gl!.bindVertexArray(vao);
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
    gl!.uniform2f(U.uTile, tileW, tileH);
    gl!.uniform4f(U.uCam, cam.R, cam.D, cam.f, cam.aspect);
    gl!.uniform2f(U.uShape, SHAPE.aspect, SHAPE.radius);
    // dimming suits the dark page; on the light one it would turn the ends muddy grey, so it's slight
    const dim = document.documentElement.dataset.theme === 'light' ? SHAPE.dimLight : SHAPE.dim;
    gl!.uniform4f(U.uEdge, SHAPE.edgeIn, SHAPE.edgeOut, reduce.matches ? 0 : SHAPE.recess, dim);   // reduced motion: the fade stays, no depth travel
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.uniform1i(U.uTex, 0);
    let pending = 0;
    for (let k = 0; k < count; k++) {
      const s0 = startOf(k);
      if (s0 + tileW < -SHAPE.limit || s0 > SHAPE.limit) continue;
      const t = tiles[k % photos.length];
      if (!t.tex) { load(t); pending++; }
      gl!.bindTexture(gl!.TEXTURE_2D, t.tex);
      gl!.uniform1f(U.uS0, s0);
      gl!.uniform1f(U.uFade, t.tex ? t.fade : 0);
      gl!.drawArrays(gl!.TRIANGLES, 0, vertCount);
    }
    const i = mod(nearest(), photos.length);
    if (i !== index) { index = i; ev.onIndex(i); }
    // ready once the photos on screen have loaded (or after 2.5 s: late ones fade in over their placeholders)
    if (!firstDraw) firstDraw = performance.now();
    if (!ready && (pending === 0 || performance.now() - firstDraw > 2500)) { ready = true; ev.onReady(); }
    return pending;
  }

  /* ---- the loop: runs only while something moves ---- */
  const running = () => visible && !document.hidden && !destroyed && !gl!.isContextLost();
  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    let moving = false;
    if (drag) moving = true;
    else if (target !== null) {
      if (reduce.matches) { pos = target; target = null; }
      else {
        pos += (target - pos) * (1 - Math.exp(-dt / MOTION.glide * 3));
        if (Math.abs(target - pos) < 1e-4) { pos = target; target = null; } else moving = true;
      }
    } else if (Math.abs(vel) > 1e-4) {
      pos += vel * dt;
      vel *= Math.exp(-dt / MOTION.friction);
      moving = true;
      if (Math.abs(vel) < 0.002) vel = 0;
    } else if (drifting()) {
      pos -= MOTION.drift * step * dt;          // the strip moves right: photos enter on the left, leave on the right
      moving = true;
    } else if (playing() && held.size === 0 && !drag) moving = true;   // waiting to resume
    let fading = false;
    for (const t of tiles) if (t.tex && t.fade < 1) { t.fade = reduce.matches ? 1 : Math.min(1, t.fade + dt / 0.35); fading = true; }
    const pending = draw();
    if (moving || fading || pending) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function wake() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }
  const hold = (why: string, on: boolean) => { if (on) held.add(why); else { held.delete(why); resumeAt = performance.now() + (why === 'focus' ? 600 : MOTION.resumeAfter); } wake(); };

  /* ---- input: drag / swipe (vertical swipes keep scrolling the page) ---- */
  function onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: pos, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
    target = null; vel = 0;
    wake();
  }
  function onMove(e: PointerEvent) {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;   // not yet / a vertical scroll
      g.moved = true;
      canvas.setPointerCapture(e.pointerId);
      host.classList.add('is-dragging');
      held.add('drag');
    }
    pos = g.from - dx * perPx();
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
  }
  function onUp(e: PointerEvent, cancelled: boolean) {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    drag = null;
    host.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (g.moved) {
      hold('drag', false);
      const a = g.samples[0], b = g.samples[g.samples.length - 1];
      vel = !cancelled && !reduce.matches && b.t > a.t ? (-(b.x - a.x) / (b.t - a.t)) * 1000 * perPx() : 0;
      vel = Math.max(-6 * step, Math.min(6 * step, vel));
    } else if (!cancelled) {
      // a click / tap, not a drag: open that photo (the host shows the preview)
      const r = canvas.getBoundingClientRect(), k = slotAt(e.clientX - r.left, e.clientY - r.top);
      if (k !== null) ev.onPick(k % photos.length);
    }
    wake();
  }
  // a horizontal trackpad swipe moves it; vertical wheel scrolling is left to the page
  function onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
    e.preventDefault();
    target = null; vel = 0;
    pos += e.deltaX * perPx();
    resumeAt = performance.now() + MOTION.resumeAfter;
    wake();
  }
  const up = (e: PointerEvent) => onUp(e, false), cancel = (e: PointerEvent) => onUp(e, true);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dragstart', (e) => e.preventDefault());

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { tiles.forEach((t, i) => { if (i < 4 || i >= photos.length - 3) load(t); }); wake(); }
    else { cancelAnimationFrame(raf); raf = 0; last = 0; }
  }, { rootMargin: '300px 0px' });
  io.observe(host);
  // Backstop for the observer above: loading straight at #gallery, an "on screen" entry was
  // sometimes never delivered, so a scroll (rAF-throttled) re-checks the box itself.
  let checkQueued = 0;
  const check = () => {
    checkQueued = 0;
    const r = host.getBoundingClientRect(), on = r.bottom > -300 && r.top < innerHeight + 300 && r.width > 0;
    if (on !== visible) { visible = on; if (on) wake(); }
  };
  const onScroll = () => { if (!checkQueued) checkQueued = requestAnimationFrame(check); };
  addEventListener('scroll', onScroll, { passive: true });
  const ro = new ResizeObserver(() => { fit(); onScroll(); if (running()) draw(); });
  ro.observe(host);
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; } else wake(); };
  document.addEventListener('visibilitychange', onVis);
  const onMotion = () => { if (choice === null) ev.onPlaying(playing()); vel = 0; wake(); };
  reduce.addEventListener('change', onMotion);
  // the theme switch: redraw with that theme's edge lighting
  const themeWatch = new MutationObserver(() => { if (running()) draw(); });
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; ev.onFail('Graphics context lost'); };
  canvas.addEventListener('webglcontextlost', onLost);

  fit();
  ev.onPlaying(playing());

  // For testing only: add ?gallery-debug to the address
  if (/[?&]gallery-debug\b/.test(location.search)) {
    (window as unknown as { __gallery: unknown }).__gallery = {
      get pos() { return pos; },
      get index() { return mod(nearest(), photos.length); },
      get running() { return !!raf; },
      /** where photo slot k's middle is on screen (CSS px inside the canvas), or null when off screen */
      centreOf(k: number) {
        const th = startOf(k) + tileW / 2;
        if (Math.abs(th) > SHAPE.limit) return null;
        const pr = project(th);
        return { x: ((pr.x + 1) / 2) * (W / dpr), y: (H / dpr) / 2, fade: 1 - pr.e, photo: k % photos.length };
      },
      count,
    };
  }

  const go = (k: number) => { vel = 0; target = centreOf(k); resumeAt = performance.now() + MOTION.resumeAfter; wake(); };
  return {
    next() { go(nearest() + 1); },
    prev() { go(nearest() - 1); },
    toggle() { choice = !playing(); resumeAt = 0; ev.onPlaying(playing()); wake(); },
    /** hold the drift for a reason ('focus' inside the gallery, the 'preview' being open…) */
    hold(why: string, on: boolean) {
      // the preview freezes the strip exactly where it is (no glide or flick carrying on underneath)
      if (on && why === 'preview') { vel = 0; target = null; }
      hold(why, on);
    },
    /** the photo nearest the middle */
    get index() { return mod(nearest(), photos.length); },
    get playing() { return playing(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect(); themeWatch.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('scroll', onScroll);
      cancelAnimationFrame(checkQueued);
      reduce.removeEventListener('change', onMotion);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onLost);
      tiles.forEach((t) => { if (t.tex) gl!.deleteTexture(t.tex); t.img = null; });
      gl!.deleteBuffer(vbo); gl!.deleteVertexArray(vao);
      gl!.deleteProgram(prog); gl!.deleteShader(vs); gl!.deleteShader(fs);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
export type Ribbon = ReturnType<typeof createRibbon>;
