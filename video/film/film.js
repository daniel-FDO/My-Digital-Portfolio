/* =========================================================
   FILM — renders one project's film, frame by frame.
   film/index.html?slug=<slug>[&sub=4]
   window.seek(t) draws the frame at t seconds; nothing moves on its
   own (no timers, no CSS transitions), so render.mjs can step through
   frames deterministically.

   The scene: the captured panels lie flat on a floor (z = 0) with a
   soft wide shadow and rounded corners; each captured piece is its own
   quad that lifts to a height z and stands up by turning about its own
   middle (top edge rising toward the lens), casting a soft shadow.
   Drawn back to front with no depth buffer. Textures are captured at
   2× and mipmapped with anisotropic filtering, so far text doesn't
   shimmer; a mild depth of field picks a softer mip level for things
   in front of the focus. Motion blur: `sub` sub-frames across 0.6 of a
   frame, averaged in a float buffer.
   World units are CSS pixels of the captured pages: x right, y down
   the page, z up off the floor.
   ========================================================= */
import * as L from '../lib.mjs';

const W = 1280, H = 800, FOCAL = 1300, FPS = 30;
const q = new URLSearchParams(location.search);
const slug = q.get('slug');
const SUB = Math.max(1, Number(q.get('sub') ?? 4));
const DEG = Math.PI / 180;

const sb = await import(`../storyboards/${slug}.mjs`);
const cap = await (await fetch(`../captures/${slug}/capture.json`)).json();
const projects = await (await fetch('../../src/data/projects.json')).json();
const proj = projects.find((p) => p.name === sb.project);
if (!proj) throw new Error(`"${sb.project}" isn't in src/data/projects.json`);
const film = sb.film(cap, L);

/* ---------- GL ---------- */
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
const floatOK = !!gl.getExtension('EXT_color_buffer_float');

const VS = `#version 300 es
in vec2 a_uv;
uniform vec3 u_O, u_U, u_V, u_C, u_R, u_Up, u_F;
uniform float u_focal; uniform vec2 u_view; uniform int u_mode;
out vec2 v_uv; out float v_depth; out vec2 v_world;
void main() {
  v_uv = a_uv;
  if (u_mode >= 3) { gl_Position = vec4(a_uv * 2.0 - 1.0, 0.0, 1.0); return; }
  vec3 P = u_O + a_uv.x * u_U + a_uv.y * u_V;
  v_world = P.xy;
  vec3 d = P - u_C;
  float xc = dot(d, u_R), yc = dot(d, u_Up), zc = dot(d, u_F);
  v_depth = zc;
  gl_Position = vec4(xc * u_focal / (u_view.x * 0.5), yc * u_focal / (u_view.y * 0.5), 0.0, zc);
}`;
const FS = `#version 300 es
precision highp float; precision highp int;
in vec2 v_uv; in float v_depth; in vec2 v_world;
uniform sampler2D u_tex; uniform int u_mode;
uniform vec2 u_size; uniform float u_radius, u_alpha, u_focus, u_lod;
uniform vec4 u_color, u_color2; uniform vec2 u_view;
uniform float u_pad, u_blur;
uniform vec4 u_mask; uniform float u_maskR, u_maskK;
out vec4 o;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float maskA() {
  if (u_maskK <= 0.0) return 1.0;
  float d = sdRound(v_world - (u_mask.xy + u_mask.zw * 0.5), u_mask.zw * 0.5, u_maskR);
  float inside = clamp(0.5 - d / max(fwidth(d), 1e-3), 0.0, 1.0);
  return mix(1.0 - u_maskK, 1.0, inside);            // outside the mask fades as it closes in
}
void main() {
  if (u_mode == 3) {                                  // the floor: a soft radial gradient
    vec2 p = gl_FragCoord.xy / u_view - 0.5; p.x *= u_view.x / u_view.y;
    o = vec4(mix(u_color.rgb, u_color2.rgb, smoothstep(0.1, 0.95, length(p))), 1.0); return;
  }
  if (u_mode == 4) { o = texture(u_tex, v_uv) * u_alpha; return; }   // copy / accumulate
  vec2 px = v_uv * u_size;
  float a = u_alpha * maskA();
  if (u_mode == 0) {                                  // a panel or a piece
    float d = sdRound(px - u_size * 0.5, u_size * 0.5, u_radius);
    float edge = clamp(0.5 - d / max(fwidth(d), 1e-3), 0.0, 1.0);
    // depth of field: softer (a higher mip) in front of the focus, a little behind it
    float z = max(v_depth, 1.0);
    float r = z < u_focus ? 7.0 * (u_focus - z) / z : 1.5 * (z - u_focus) / z;
    vec4 c = texture(u_tex, v_uv, clamp(log2(1.0 + r), 0.0, 1.6));
    o = c * a * edge; return;
  }
  if (u_mode == 1) {                                  // a piece's shadow: its own shape, blurred
    float s = texture(u_tex, v_uv, u_lod).a;
    o = vec4(u_color.rgb, 1.0) * u_color.a * s * a; return;
  }
  if (u_mode == 2) {                                  // a panel's soft, wide shadow
    float d = sdRound(px - u_size * 0.5, u_size * 0.5 - u_pad, u_radius);
    float s = d < 0.0 ? 1.0 : exp(-pow(d / u_blur, 2.0) * 2.2);
    o = vec4(u_color.rgb, 1.0) * u_color.a * s * a; return;
  }
}`;
function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const U = new Proxy({}, { get: (c, k) => (c[k] ??= gl.getUniformLocation(prog, k)) });
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'a_uv');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
gl.uniform2f(U.u_view, W, H);
gl.uniform1f(U.u_focal, FOCAL);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);         // premultiplied alpha

async function texture(file) {
  const blob = await (await fetch(`../captures/${slug}/${file}`)).blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none' });
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return { t, pw: bmp.width, ph: bmp.height };
}

/* ---------- The scene ---------- */
const place = Object.fromEntries(film.panels.map((p) => [p.id, p]));
const panels = await Promise.all(cap.panels.filter((p) => place[p.id]).map(async (p) => ({ ...p, ...place[p.id], tex: await texture(p.file) })));
const liftOf = Object.fromEntries((film.lifts ?? []).map((l) => [l.id, l]));
const pieces = await Promise.all(cap.pieces.filter((p) => place[p.panel]).map(async (p) => ({
  ...p, x: place[p.panel].x + p.x, y: place[p.panel].y + p.y, lift: liftOf[p.id] ?? { at: 0, z: 0, stand: 0 }, tex: await texture(p.file),
})));
const bounds = panels.reduce((b, p) => ({ x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x + p.w), y1: Math.max(b.y1, p.y + p.h) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
const all = { x: bounds.x0, y: bounds.y0, w: bounds.x1 - bounds.x0, h: bounds.y1 - bounds.y0 };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const floorA = rgb(film.floor[0]), floorB = rgb(film.floor[1]);
const dark = !!film.dark;
const SHADOW = dark ? [0, 0, 0, 0.42] : [...rgb('#1a2133'), 0.18];
const PAGE_SHADOW = dark ? [0, 0, 0, 0.55] : [...rgb('#1a2133'), 0.16];
const end = film.end;
const sEnd = end.hero.w / 905;                          // world px per screen px on the end card

function camera(t) {
  const c = film.camera(t);
  const th = c.pitch * DEG, ps = (c.yaw ?? 0) * DEG;
  const f = [Math.sin(ps), -Math.cos(ps)];
  const C = [c.x - f[0] * c.d * Math.sin(th), c.y - f[1] * c.d * Math.sin(th), c.d * Math.cos(th)];
  const Fv = [c.x - C[0], c.y - C[1], -C[2]]; const n = Math.hypot(...Fv); Fv[0] /= n; Fv[1] /= n; Fv[2] /= n;
  const R = [Math.cos(ps), Math.sin(ps), 0];
  const Up = [Fv[1] * R[2] - Fv[2] * R[1], Fv[2] * R[0] - Fv[0] * R[2], Fv[0] * R[1] - Fv[1] * R[0]];
  return { C, R, Up, F: Fv, d: c.d };
}

function quad(o) {
  gl.uniform1i(U.u_mode, o.mode);
  gl.uniform3fv(U.u_O, o.O); gl.uniform3fv(U.u_U, o.U); gl.uniform3fv(U.u_V, o.V);
  gl.uniform2f(U.u_size, o.size[0], o.size[1]);
  gl.uniform1f(U.u_radius, o.radius ?? 0);
  gl.uniform1f(U.u_alpha, o.alpha ?? 1);
  if (o.color) gl.uniform4fv(U.u_color, o.color);
  gl.uniform1f(U.u_lod, o.lod ?? 0);
  gl.uniform1f(U.u_pad, o.pad ?? 0); gl.uniform1f(U.u_blur, o.blur ?? 1);
  if (o.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.tex.t); gl.uniform1i(U.u_tex, 0); }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function liftNow(l, t) {
  const up = L.easeOut(t, l.at, l.at + (l.dur ?? 1.1));
  const settle = L.ramp(t, end.t0 - 0.25, end.t1);      // everything lies back down for the end card
  const k = up * (1 - settle);
  return { z: l.z * k, a: (l.stand ?? 0) * k * DEG };
}

function renderScene(t) {
  const cam = camera(t);
  gl.uniform3fv(U.u_C, cam.C); gl.uniform3fv(U.u_R, cam.R); gl.uniform3fv(U.u_Up, cam.Up); gl.uniform3fv(U.u_F, cam.F);
  gl.uniform1f(U.u_focus, cam.d);
  gl.clearColor(...floorA, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1f(U.u_maskK, 0);
  gl.uniform4f(U.u_color, ...floorA, 1); gl.uniform4f(U.u_color2, ...floorB, 1);
  quad({ mode: 3, O: [0, 0, 0], U: [0, 0, 0], V: [0, 0, 0], size: [W, H] });

  // The end card's mask: from all the panels to the hero, the corners 24 → 38 screen px
  const mk = L.ramp(t, end.t0, end.t1);
  const m = { x: L.mix(all.x, end.hero.x, mk), y: L.mix(all.y, end.hero.y, mk), w: L.mix(all.w, end.hero.w, mk), h: L.mix(all.h, end.hero.h, mk) };
  gl.uniform4f(U.u_mask, m.x, m.y, m.w, m.h);
  gl.uniform1f(U.u_maskR, L.mix(24, 38 * sEnd, mk));
  gl.uniform1f(U.u_maskK, mk);

  // Panel shadows, then the card's own shadow as the mask closes in, then the panels
  for (const p of panels) quad({ mode: 2, O: [p.x - 90, p.y - 90 + 22, 0], U: [p.w + 180, 0, 0], V: [0, p.h + 180, 0], size: [p.w + 180, p.h + 180], pad: 90, blur: 70, radius: 24, color: PAGE_SHADOW, alpha: 1 - mk });
  if (mk > 0) {
    gl.uniform1f(U.u_maskK, 0);
    const pad = 90 * sEnd;
    quad({ mode: 2, O: [m.x - pad, m.y - pad + 24 * sEnd, 0], U: [m.w + 2 * pad, 0, 0], V: [0, m.h + 2 * pad, 0], size: [m.w + 2 * pad, m.h + 2 * pad], pad, blur: 60 * sEnd, radius: 38 * sEnd, color: PAGE_SHADOW, alpha: mk });
    gl.uniform1f(U.u_maskK, mk);
  }
  for (const p of panels) quad({ mode: 0, tex: p.tex, O: [p.x, p.y, 0], U: [p.w, 0, 0], V: [0, p.h, 0], size: [p.w, p.h], radius: 24 });

  // The pieces, lowest first: shadow, then the piece standing up about its middle
  const now = pieces.map((p) => ({ p, ...liftNow(p.lift, t) })).sort((a, b) => a.z - b.z);
  for (const { p, z, a } of now) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const zc = a > 0 ? Math.max(z, (p.h / 2) * sa + 2) : z;
    const cy = p.y + p.h / 2;
    if (zc > 0.5) {
      const blur = 7 + 0.5 * zc;
      quad({ mode: 1, tex: p.tex, O: [p.x + 0.1 * zc, cy - (p.h / 2) * ca + 4 + 0.36 * zc, 0.2], U: [p.w, 0, 0], V: [0, p.h * ca, 0], size: [p.w, p.h * ca], color: SHADOW, alpha: Math.min(1, zc / 14), lod: Math.log2(Math.max(1, blur * p.tex.pw / p.w)) });
    }
    quad({ mode: 0, tex: p.tex, O: [p.x, cy - (p.h / 2) * ca, zc + (p.h / 2) * sa], U: [p.w, 0, 0], V: [0, p.h * ca, -p.h * sa], size: [p.w, p.h], radius: zc > 0.5 ? 6 : 0 });
  }
}

/* ---------- Motion blur: average sub-frames in a float buffer ---------- */
function target(internal) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, internal, W, H);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex: { t: tex } };
}
const useBlur = floatOK && SUB > 1;
const sceneT = useBlur ? target(gl.RGBA8) : null;
const accumT = useBlur ? target(gl.RGBA16F) : null;
const blit = (tex, alpha) => quad({ mode: 4, tex, O: [0, 0, 0], U: [0, 0, 0], V: [0, 0, 0], size: [W, H], alpha });

function render(t) {
  gl.viewport(0, 0, W, H);
  if (!useBlur) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); renderScene(t); return; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, accumT.fb);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  for (let i = 0; i < SUB; i++) {
    const ts = t + ((i + 0.5) / SUB - 0.5) * (0.6 / FPS);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneT.fb);
    renderScene(ts);
    gl.bindFramebuffer(gl.FRAMEBUFFER, accumT.fb);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(U.u_maskK, 0);
    blit(sceneT.tex, 1 / SUB);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.disable(gl.BLEND);
  blit(accumT.tex, 1);
  gl.enable(gl.BLEND);
}

/* ---------- The end card's words ---------- */
const host = /^https?:/.test(proj.url) ? new URL(proj.url).host.replace(/^www\./, '') : null;
const badgeText = host ?? (proj.tech?.length ? proj.tech.join(' · ') : 'Daniel Fasan');
const card = document.getElementById('card');
document.querySelector('#badge span').textContent = badgeText;
document.querySelector('#badge i').style.background = film.accent ?? film.ink[0];
const words = (el, text, color) => { el.style.color = color; return text.split(' ').map((w, i, a) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w + (i < a.length - 1 ? ' ' : ''); el.appendChild(s); return s; }); };
const line1 = words(document.getElementById('line1'), proj.name, film.ink[0]);
const line2 = words(document.getElementById('line2'), proj.category, film.ink[1]);
const badge = document.getElementById('badge');

function wordIn(el, t, start) {
  const k = L.easeOut(t, start, start + 0.34);
  el.style.opacity = k.toFixed(3);
  el.style.transform = `translateY(${((1 - k) * 16).toFixed(2)}px)`;
  el.style.filter = k < 1 ? `blur(${((1 - k) * 12).toFixed(2)}px)` : 'none';
}
function setCard(t) {
  card.style.visibility = t >= end.t1 - 0.01 ? 'visible' : 'hidden';
  const b = L.easeOut(t, end.t1 + 0.05, end.t1 + 0.4);
  badge.style.opacity = b.toFixed(3);
  badge.style.transform = `translateX(-50%) translateY(${((1 - b) * 8).toFixed(2)}px)`;
  line1.forEach((w, i) => wordIn(w, t, end.t1 + 0.15 + i * 0.06));
  line2.forEach((w, i) => wordIn(w, t, end.t1 + 0.39 + i * 0.05));
}

await document.fonts.load('500 51px Geist');
await document.fonts.load('italic 57px "Instrument Serif"');
await document.fonts.ready;

window.film = { slug, duration: film.duration, poster: film.poster, fps: FPS, motionBlur: useBlur ? SUB : 1, renderer: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() };
window.seek = (t) => { render(t); setCard(t); gl.finish(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(t)))); };
window.ready = true;
