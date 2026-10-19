// daniel.js — "Daniel" portfolio mascot, rendered with a WebGL2 SDF raymarcher.
// Plain ES module, no imports, no dependencies.
//
//   const ctl = createDaniel(container, { dpr: 1.5 });
//   await ctl.ready;         // the shader compiles in the background where the browser can
//   ctl.setPose({ waveRaise: 1, waveSwing: Math.sin(t) });   // see daniel.d.ts for every pose key
//   ctl.render();            // call from your own rAF loop
//   ctl.resize();            // on container resize
//   ctl.dispose();
//
// Throws if WebGL2 is unavailable, and `ready` rejects if the shader can't be built, so the
// host can show a poster image instead. render() draws nothing (returns false) until ready.

const VS = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform vec3  uCam;
uniform float uTanH;      // tan(half vertical fov)
uniform int   uSteps;     // raymarch step budget (quality setting)
uniform vec4  uBelly;     // cy, rx, ry, rz
uniform vec4  uChest;     // cy, rx, ry, rz
uniform vec3  uHeadPivot;
uniform mat3  uHeadM;     // head local -> world rotation (columns)
uniform vec3  uHeadOff;   // head centre relative to pivot (local)
uniform vec3  uHeadC;     // head centre (world)
uniform vec3  uSh[2];
uniform vec3  uEl[2];
uniform vec3  uWr[2];
uniform mat3  uHand[2];   // columns: along-hand, thumb side, palm normal
uniform vec2  uHandOpen;  // finger articulation per hand (0 relaxed mitt, 1 open)
uniform vec3  uBadgeP;
uniform mat3  uBadgeM;
uniform vec4  uEye;       // gazeX, gazeY, blink, 0
uniform mat3  uBodyM;     // body (everything above the legs) local -> world rotation: sway / lean
uniform vec3  uBodyT;     // the body's pivot (hips) in world space, including its lift
uniform vec3  uNeck;      // base of the neck (world)

const vec3 KEY = vec3(-0.45, 0.62, 0.64);
// Always 0 at run time, but the compiler can't know that: loops starting from ZERO are not
// unrolled, so map() and the hand aren't inlined once per call site. On Windows (ANGLE → D3D)
// full inlining made the first compile take ~20 s.
#define ZERO min(uSteps, 0)

float smin(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float sdEll(vec3 p, vec3 r){
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
// tapered capsule: radius goes r1 → r2 from a to b. Not an exact distance like a true
// rounded cone, but close for the gentle tapers used here, and far cheaper to compile
// (the exact version's branches made the first shader compile several seconds slower).
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(r1, r2, h);
}
float sdRBox(vec3 p, vec3 b, float r){
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdSeg(vec3 p, vec3 a, vec3 b){
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 headLocal(vec3 p){ return (p - uHeadPivot) * uHeadM - uHeadOff; }

// dome head: a rounded super-ellipsoid with a full crown and a gently flattened underside.
// The exponent eases between the two halves (no seam at the equator).
float sdDome(vec3 q){
  float n = mix(2.7, 2.1, smoothstep(-0.12, 0.14, q.y));
  vec3 r = vec3(0.45, q.y > 0.0 ? 0.335 : 0.225, 0.395);
  vec3 a = abs(q) / r + 1e-4;
  vec3 pn = pow(a, vec3(n));
  float S = pn.x + pn.y + pn.z;
  float k = pow(S, 1.0 / n);
  vec3 g = pn / a / r;
  return (k - 1.0) * (S / k) / length(g);
}
float sdHeadShape(vec3 q){
  float h = sdDome(q);
  // soft cheek volume low on the face
  vec3 c = vec3(abs(q.x), q.y, q.z) - vec3(0.25, -0.075, 0.2);
  return smin(h, sdEll(c, vec3(0.16, 0.12, 0.155)), 0.09);
}
// the tuft: a thick crescent rising from the crown and rolling over to the viewer's right.
// Its tip stops short of the crown so the scoop beneath it stays open.
float sdCurl(vec3 q){
  q.z = (q.z - 0.02) * 1.3;          // a little flatter front to back
  float c = sdRC(q, vec3(-0.035, 0.28, 0.0), vec3(-0.018, 0.385, 0.0), 0.1, 0.082);
  c = smin(c, sdRC(q, vec3(-0.018, 0.385, 0.0), vec3(0.03, 0.447, 0.0), 0.082, 0.066), 0.03);
  c = smin(c, sdRC(q, vec3(0.03, 0.447, 0.0), vec3(0.097, 0.453, 0.0), 0.066, 0.05), 0.025);
  c = smin(c, sdRC(q, vec3(0.097, 0.453, 0.0), vec3(0.142, 0.418, 0.0), 0.05, 0.034), 0.02);
  c = smin(c, sdRC(q, vec3(0.142, 0.418, 0.0), vec3(0.152, 0.384, 0.0), 0.034, 0.018), 0.014);
  return c / 1.3;
}
float sdHead(vec3 q){
  float h = sdHeadShape(q);
  float cb = length(q - vec3(0.05, 0.4, 0.02)) - 0.25;
  if (cb < h + 0.06){
    // generous blend where it grows from the crown, a tight one at the tip
    float k = mix(0.05, 0.006, smoothstep(0.04, 0.11, q.x));
    h = smin(h, sdCurl(q), k);
  }
  return h;
}

float sdTorso(vec3 p){
  float b = sdEll(p - vec3(0.0, uBelly.x, 0.035), uBelly.yzw);
  float c = sdEll(p - vec3(0.0, uChest.x, 0.0), uChest.yzw);
  return smin(b, c, 0.26);
}
float sdLegs(vec3 p){
  vec3 q = p;
  q.x = abs(q.x) - 0.215;
  q.z -= 0.025;
  const float h = 0.22, rr = 0.075;
  q.y -= h;
  float R = 0.165 + 0.01 * clamp(-q.y / h, -1.0, 1.0);   // a touch wider at the foot
  vec2 w = vec2(length(q.xz) - (R - rr), abs(q.y) - (h - rr));
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - rr;
}

// hand space: x along the hand, y towards the thumb, z out of the palm.
// open = 0 relaxed (fingers slightly curled), 1 flat for the wave.
float sdHand(vec3 h, float open){
  float palm = sdEll(h - vec3(0.068, 0.0, 0.0), vec3(0.09, 0.094, 0.058));
  float L = mix(0.055, 0.082, open);
  float cz = (1.0 - open) * 0.03;
  float f = 1e5;
  for (int k = ZERO; k < 3; k++){
    float fk = float(k);
    float y = -0.054 + 0.052 * fk;            // little-finger side .. index side
    float len = L * (k == 1 ? 1.0 : 0.9);
    f = smin(f, sdRC(h, vec3(0.095, y, 0.0), vec3(0.095 + len, y * 1.1, cz), 0.039, 0.035), 0.012);
  }
  float m = smin(palm, f, 0.03);
  vec3 tt = mix(vec3(0.08, 0.116, 0.042), vec3(0.095, 0.136, 0.02), open);
  float th = sdRC(h, vec3(0.03, 0.062, 0.012), tt, 0.04, 0.03);
  return smin(m, th, 0.02);
}
float sdArmShape(vec3 p, int i){
  float d = sdRC(p, uSh[i], uEl[i], 0.128, 0.11);
  d = smin(d, sdRC(p, uEl[i], uWr[i], 0.108, 0.088), 0.03);
  d = smin(d, length(p - uEl[i]) - 0.114, 0.025);      // a soft elbow
  vec3 h = (p - uWr[i]) * uHand[i];
  return smin(d, sdHand(h, uHandOpen[i]), 0.03);       // narrower wrist into a fuller hand
}
// conservative lower bound of sdArmShape
float armBound(vec3 p, int i){
  vec3 tip = uWr[i] + uHand[i][0] * 0.17;
  return min(sdSeg(p, uSh[i], uEl[i]), sdSeg(p, uEl[i], tip)) - 0.21;
}
// arm-to-body blend: soft at the shoulder, tight towards the hand so the arm reads as its own shape
float armK(vec3 p, int i){
  vec3 a = uSh[i], ab = uWr[i] - uSh[i];
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return mix(0.085, 0.02, smoothstep(0.15, 0.7, t));
}
float sdBadge(vec3 p){
  vec3 b = (p - uBadgeP) * uBadgeM;
  return sdRBox(b, vec3(0.056, 0.056, 0.02), 0.024);
}

// 'far': beyond this distance the cheap bound is returned instead of the exact field.
// Raymarching only needs a lower bound, but ambient occlusion samples up to 0.25 away
// and must see the real field, or it shades a hard-edged step where the bound kicks in.
// Every part skipped below is skipped only when it is farther than its blend radius, so
// the field stays continuous.
float map(vec3 p, float far){
  // the torso in its own (swayed / leaning / lifted) frame; the legs stay planted in world space
  vec3 pb = (p - uBodyT) * uBodyM + vec3(0.0, 0.3, 0.0);
  float a0 = armBound(p, 0), a1 = armBound(p, 1);
  float hb = length(p - uHeadC) - 0.62;
  float bnd = sdSeg(pb, vec3(0.0, 0.25, 0.03), vec3(0.0, 1.22, 0.0)) - 0.64;
  bnd = min(bnd, sdSeg(p, vec3(0.0, 0.1, 0.02), vec3(0.0, 0.5, 0.02)) - 0.47);   // the planted legs
  bnd = min(min(bnd, hb), min(a0, a1));
  if (bnd > far) return bnd;
  vec2 ab = vec2(a0, a1);

  float d = sdTorso(pb);
  if (p.y < 0.8) d = smin(d, sdLegs(p), 0.06);
  float nk = sdRC(p, uNeck, uHeadPivot + uHeadM * vec3(0.0, 0.07, 0.02), 0.19, 0.2);
  d = smin(d, nk, 0.06);
  for (int i = ZERO; i < 2; i++)
    if (ab[i] < d + 0.1) d = smin(d, sdArmShape(p, i), armK(p, i));
  if (hb < d + 0.07) d = smin(d, sdHead(headLocal(p)), 0.06);
  float bb = length(p - uBadgeP) - 0.11;
  if (bb < d + 0.02) d = smin(d, sdBadge(p), 0.012);
  return d;
}

// Surface normal (tetrahedral differences, iterations 0-3) and ambient occlusion
// (four probes along that normal, iterations 4-7) in one loop, so map() is compiled once here.
vec4 normalAO(vec3 p, float e){
  vec3 n = vec3(0.0);
  float occ = 0.0, sca = 1.0;
  for (int i = ZERO; i < 8; i++){
    if (i < 4){
      vec3 k = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
      n += k * map(p + k * e, 0.3);
    } else {
      if (i == 4) n = normalize(n);
      float h = 0.025 + 0.075 * float(i - 4);
      occ += (h - map(p + n * h, 0.4)) * sca;
      sca *= 0.75;
    }
  }
  return vec4(n, clamp(1.0 - 1.5 * occ, 0.0, 1.0));
}
// analytic soft shadow of a sphere (iq)
float sphShadow(vec3 ro, vec3 rd, vec3 c, float r, float k){
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r * r;
  float h = b * b - cc;
  float d = sqrt(max(0.0, r * r - h)) - r;
  float t = -b - sqrt(max(h, 0.0));
  return (t < 0.0) ? 1.0 : smoothstep(0.0, 1.0, 2.5 * k * d / t);
}
// Shadows from simple proxies of the head and arms. A proxy never shadows its own part
// (wHead / wArm fade to 0 on it): an approximate shape shadowing the real surface it
// stands for is what produces hard patches.
float keyShadow(vec3 p, vec3 L, float wHead, vec2 wArm){
  vec3 hs = vec3(0.43, 0.29, 0.38);
  vec3 ro = ((p - uHeadC) * uHeadM - vec3(0.0, 0.06, 0.0)) / hs;
  vec3 rd = (L * uHeadM) / hs;
  float s = mix(1.0, sphShadow(ro, rd / length(rd), vec3(0.0), 1.0, 1.2), wHead);
  for (int i = 0; i < 2; i++){
    float a = sphShadow(p, L, mix(uSh[i], uEl[i], 0.6), 0.12, 3.0);
    a *= sphShadow(p, L, mix(uEl[i], uWr[i], 0.5), 0.1, 3.0);
    a *= sphShadow(p, L, uWr[i] + uHand[i][0] * 0.08, 0.1, 3.0);
    s *= mix(1.0, a, wArm[i]);
  }
  return s;
}

float sdSeg2(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float glyphD(vec2 g){
  float bowl = abs(length((g - vec2(-0.008, -0.012)) * vec2(1.0, 0.96)) - 0.0215) - 0.0055;
  float stem = sdSeg2(g, vec2(0.0135, -0.033), vec2(0.0135, 0.037)) - 0.0055;
  return min(bowl, stem);
}

vec3 shade(vec3 p, vec3 rd, float t, float pxw){
  vec4 nao = normalAO(p, 0.0015);
  vec3 n = nao.xyz;
  vec3 V = -rd;
  vec3 L = normalize(KEY);

  vec3 alb = vec3(1.0, 0.94, 0.875);              // warm ivory
  float gloss = 0.08, shin = 26.0;
  float eyeMask = 0.0, lineMask = 0.0, badgeMask = 0.0, glyph = 0.0, hl = 0.0, eyeRim = 0.0;
  vec3 nb = n;
  vec3 q = headLocal(p);
  float px = pxw * t;

  // ---- face decals (head-local space) ----
  if (q.z > 0.12 && sdHeadShape(q) < 0.02){
    float blink = uEye.z;
    vec2 gz = uEye.xy;
    for (int s = 0; s < 2; s++){
      float sx = s == 0 ? -1.0 : 1.0;
      vec2 c = vec2(sx * 0.2 + gz.x * 0.03, 0.005 + gz.y * 0.024);
      vec2 r = vec2(0.05, 0.066);
      vec2 d = q.xy - c;
      float ryb = mix(r.y, 0.0075, blink);
      float yb = d.y + (r.y - ryb) * 0.6 - blink * 0.55 * r.y * (d.x / r.x) * (d.x / r.x);
      vec2 e = vec2(d.x / r.x, yb / ryb);
      float le = length(e);
      float ed = (le - 1.0) * min(r.x, ryb);
      float m = 1.0 - smoothstep(-px * 0.75, px * 0.75, ed);
      float rim = (1.0 - smoothstep(0.0, 0.009, abs(ed - 0.006))) * (1.0 - blink);
      eyeRim = max(eyeRim, rim);
      if (m > eyeMask){
        eyeMask = m;
        vec2 eb = vec2(d.x / r.x, d.y / r.y) * (1.0 - blink);
        nb = normalize(n + uHeadM * vec3(eb * 0.6, 0.0));
        vec2 hp = d - vec2(-0.017 + gz.x * 0.006, 0.024 + gz.y * 0.005);
        float hd = length(hp * vec2(1.0, 0.9)) - 0.0105;
        hl = (1.0 - smoothstep(-px * 0.6, px * 0.8, hd)) * (1.0 - smoothstep(0.3, 0.6, blink));
      }
    }
    // smile
    vec2 sp = q.xy - vec2(gz.x * 0.02, -0.055 + gz.y * 0.012);
    const float hw = 0.04;
    const float cu = 10.0;
    float sd;
    if (abs(sp.x) <= hw) sd = abs(sp.y - cu * sp.x * sp.x) / sqrt(1.0 + pow(2.0 * cu * sp.x, 2.0));
    else { float cx = sign(sp.x) * hw; sd = length(sp - vec2(cx, cu * cx * cx)); }
    lineMask = 1.0 - smoothstep(0.0058 - px * 0.6, 0.0058 + px * 0.6, sd);
  }

  // ---- badge: muted terracotta, the "d" embossed in the same material ----
  if (length(p - uBadgeP) < 0.12){
    float dB = sdBadge(p);
    vec3 b = (p - uBadgeP) * uBadgeM;
    badgeMask = 1.0 - smoothstep(0.002, 0.006, dB);
    float front = smoothstep(0.008, 0.014, b.z);
    float gd = glyphD(b.xy);
    glyph = (1.0 - smoothstep(-px * 0.6, px * 0.6, gd)) * front;
    // a rounded bevel around the stroke, tilted outwards like a raised letter
    const float e = 0.0015;
    vec2 gg = vec2(glyphD(b.xy + vec2(e, 0.0)) - glyphD(b.xy - vec2(e, 0.0)),
                   glyphD(b.xy + vec2(0.0, e)) - glyphD(b.xy - vec2(0.0, e))) / (2.0 * e);
    float bev = (1.0 - smoothstep(0.0, 0.005, abs(gd + 0.0015))) * front * badgeMask;
    nb = normalize(nb + uBadgeM * vec3(gg * 0.75 * bev, 0.0));
  }

  // ---- lighting ----
  float occ = nao.w;
  // how far this point is from the head / each arm (cheap proxies: the weights only fade
  // the shadows those parts cast, so they need to be smooth, not exact)
  float wHead = smoothstep(0.01, 0.08, sdEll(q - vec3(0.0, 0.06, 0.0), vec3(0.47, 0.33, 0.42)));
  vec2 wArm;
  for (int i = ZERO; i < 2; i++) wArm[i] = smoothstep(0.01, 0.07, armBound(p, i) + 0.09);
  float sh = keyShadow(p + n * 0.01, L, wHead, wArm);
  float ndl = dot(nb, L);
  float wrap = clamp((ndl + 0.5) / 1.5, 0.0, 1.0);
  float lit = wrap * sh;

  if (badgeMask > 0.5){
    alb = mix(vec3(0.43, 0.15, 0.095), vec3(0.6, 0.25, 0.165), glyph);
    gloss = 0.05; shin = 18.0;
  }
  // warm, low-contrast "vinyl" lighting: ambient carries the warm/pink shadow tone
  vec3 amb = mix(vec3(0.40, 0.29, 0.235), vec3(0.50, 0.43, 0.39), nb.y * 0.5 + 0.5);
  vec3 col = alb * amb * occ;
  vec3 sssTint = mix(vec3(1.0, 0.70, 0.58), vec3(1.0), smoothstep(0.0, 0.6, lit));
  col += alb * vec3(0.56) * sssTint * lit * mix(0.6, 1.0, occ);
  // fill from the right
  vec3 F = normalize(vec3(0.8, 0.1, 0.55));
  col += alb * vec3(0.10, 0.10, 0.105) * clamp(dot(nb, F), 0.0, 1.0) * occ;
  // rim
  float fr = pow(1.0 - clamp(dot(nb, V), 0.0, 1.0), 3.0);
  vec3 rimL = normalize(vec3(-0.85, 0.3, -0.4));
  vec3 rimR = normalize(vec3(0.85, 0.25, -0.4));
  float rimTerm = fr * (0.6 * clamp(dot(nb, rimL) + 0.65, 0.0, 1.0) + 0.45 * clamp(dot(nb, rimR) + 0.65, 0.0, 1.0));
  col += vec3(1.0, 0.88, 0.8) * rimTerm * 0.35 * occ * (1.0 - badgeMask * 0.6);
  // soft specular
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.96, 0.92) * gloss * pow(clamp(dot(nb, H), 0.0, 1.0), shin) * sh;

  if (eyeMask > 0.0){
    vec3 ec = vec3(0.012, 0.0072, 0.0062) * (0.5 + 0.5 * lit);
    ec += vec3(0.05, 0.022, 0.014) * smoothstep(0.01, -0.05, q.y - (0.005 + uEye.y * 0.024)) * (1.0 - uEye.z);
    vec3 R = reflect(rd, nb);
    ec += vec3(1.0, 0.95, 0.9) * (0.5 * pow(clamp(dot(nb, H), 0.0, 1.0), 220.0) + 0.04 * smoothstep(0.3, 1.0, R.y));
    ec = mix(ec, vec3(1.0, 0.98, 0.95), hl);
    col = mix(col, ec, eyeMask);
  }
  col += vec3(0.07, 0.06, 0.055) * eyeRim * (1.0 - eyeMask) * occ;
  if (lineMask > 0.0) col = mix(col, vec3(0.016, 0.009, 0.008), lineMask);
  return col;
}

vec3 toSRGB(vec3 x){
  x = x / (1.0 + 0.08 * x);                // gentle shoulder
  return pow(clamp(x, 0.0, 1.0), vec3(1.0 / 2.2));
}

float groundShadow(vec2 g){
  vec2 c = g - vec2(0.06, -0.05);
  float blob = exp(-(c.x * c.x / 0.5 + c.y * c.y / 0.2) * 2.4) * 0.34;
  float f = 0.0;
  for (int s = 0; s < 2; s++){
    float sx = s == 0 ? -1.0 : 1.0;
    float dd = length(g - vec2(sx * 0.215 + 0.015, 0.0)) - 0.17;
    f = max(f, exp(-max(dd, 0.0) * 15.0) * 0.6);
  }
  return 1.0 - (1.0 - blob) * (1.0 - f);
}

void main(){
  vec2 ndc = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 ro = uCam;
  vec3 rd = normalize(vec3(ndc.x * aspect * uTanH, ndc.y * uTanH, -1.0));
  float pxw = 2.0 * uTanH / uRes.y;

  float gsh = 0.0;
  if (rd.y < 0.0){
    vec3 g = ro + rd * (-ro.y / rd.y);
    gsh = groundShadow(g.xz);
  }

  vec3 bmin = vec3(-1.05, -0.02, -0.75), bmax = vec3(1.05, 2.45, 0.75);
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tsm = min(t0, t1), tbg = max(t0, t1);
  float tn = max(max(tsm.x, tsm.y), tsm.z);
  float tf = min(min(tbg.x, tbg.y), tbg.z);

  vec4 outc = vec4(0.0);
  if (tf > max(tn, 0.0)){
    float t = max(tn, 0.0);
    bool hit = false;
    float minR = 1e9, tMin = t, d = 1e9;
    for (int i = ZERO; i < uSteps; i++){
      d = map(ro + rd * t, 0.08);
      if (d < 0.3 * pxw * t){ hit = true; break; }
      float r = d / t;
      if (r < minR){ minR = r; tMin = t; }
      t += d;
      if (t > tf) break;
    }
    // a ray that grazes a surface can use up its step budget while still creeping towards it;
    // if it ended within a few pixels of the surface, count it as a hit rather than a gap
    if (!hit && t < tf && d < 3.0 * pxw * t) hit = true;
    float a = 0.0;
    if (hit) a = 1.0;
    else if (minR < pxw){ a = clamp(1.0 - (minR - 0.3 * pxw) / (0.7 * pxw), 0.0, 1.0); t = tMin; }
    if (a > 0.0){
      vec3 c = toSRGB(shade(ro + rd * t, rd, t, pxw));
      outc = vec4(c * a, a);
    }
  }
  fragColor = vec4(outc.rgb, outc.a + gsh * (1.0 - outc.a));
}`;

const DEG = Math.PI / 180;
const DEFAULT_POSE = {
  breath: 0, headYaw: 0, headPitch: 0, headTilt: 0,
  gazeX: 0, gazeY: 0, blink: 0, waveRaise: 0, waveSwing: 0,
  leftRaise: 0, leftSwing: 0, bodySway: 0, bodyLean: 0, bodyLift: 0,
};
/** The body pivots about the hips; the legs (and so the feet) never move. */
const HIP = [0, 0.3, 0];
const LIFT = 0.04;           // world units at bodyLift = 1
/** Camera framing for the 3:4 box: vertical half-extent (world units), bottom edge (feet stand at y = 0), distance */
export const FRAME = { halfH: 1.34, bottom: -0.17, dist: 9 };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const mat3cols = (c0, c1, c2) => [c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], c2[0], c2[1], c2[2]];
const mat3vec = (M, v) => [
  M[0] * v[0] + M[3] * v[1] + M[6] * v[2],
  M[1] * v[0] + M[4] * v[1] + M[7] * v[2],
  M[2] * v[0] + M[5] * v[1] + M[8] * v[2],
];
function mat3mul(A, B) {
  const r = new Array(9);
  for (let c = 0; c < 3; c++) for (let rr = 0; rr < 3; rr++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += A[k * 3 + rr] * B[c * 3 + k];
    r[c * 3 + rr] = s;
  }
  return r;
}
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; };

// the torso field in JS (same formulas as the shader), used to seat the badge on the surface
const ell = (q, r) => {
  const k0 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2]);
  const k1 = Math.hypot(q[0] / (r[0] * r[0]), q[1] / (r[1] * r[1]), q[2] / (r[2] * r[2]));
  return (k0 * (k0 - 1)) / k1;
};
function torsoSd(p, belly, chest) {
  const b = ell([p[0], p[1] - belly[0], p[2] - 0.035], [belly[1], belly[2], belly[3]]);
  const c = ell([p[0], p[1] - chest[0], p[2]], [chest[1], chest[2], chest[3]]);
  const k = 0.26, h = Math.max(k - Math.abs(b - c), 0) / k;
  return Math.min(b, c) - h * h * k * 0.25;
}

export function computeRig(P) {
  const b = clamp(num(P.breath, 0), -1, 1);
  // per arm (0 = viewer's left, 1 = viewer's right): how far raised, and the swing once up
  const raises = [smooth(clamp(num(P.leftRaise, 0), 0, 1)), smooth(clamp(num(P.waveRaise, 0), 0, 1))];
  const swings = [clamp(num(P.leftSwing, 0), -1, 1), clamp(num(P.waveSwing, 0), -1, 1)];

  // pear-shaped torso: wide low belly, narrower chest; breath lifts/expands the chest, feet stay planted
  const belly = [0.68 - 0.004 * b, 0.52 * (1 + 0.01 * b), 0.44 * (1 + 0.012 * b), 0.47 * (1 + 0.028 * b)];
  const chest = [1.08 + 0.012 * b, 0.40 * (1 + 0.014 * b), 0.36 * (1 + 0.02 * b), 0.37 * (1 + 0.03 * b)];

  const lift = 0.014 * b;
  const pivot = [0, 1.37 + lift, 0];
  const headOff = [0, 0.25, 0.02];
  const yaw = clamp(num(P.headYaw, 0), -18, 18) * DEG;
  const pitch = clamp(num(P.headPitch, 0), -10, 10) * DEG;
  const tilt = clamp(num(P.headTilt, 0), -10, 10) * DEG;
  const headM = mat3mul(rotY(yaw), mat3mul(rotX(pitch), rotZ(-tilt)));
  const headC = add(pivot, mat3vec(headM, headOff));

  const L1 = 0.3, L2 = 0.26;
  const sh = [], el = [], wr = [], hand = [], open = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    // shoulders sit below and inside the chest's top so the line slopes from the neck into the arm
    const S = [s * 0.38, 1.17 + 0.012 * b, -0.01];
    const aRest = (25 + 1.5 * b * (i === 0 ? 1 : 0.4)) * DEG;
    const fRest = (12 + 1.0 * b * (i === 0 ? 1 : 0.4)) * DEG;
    let a = aRest, f = fRest, flex = 0, ez = 0, fwd = 0;
    const r = raises[i], raise = r;
    let swing = swings[i];
    if (r > 0) {
      // (mirrored for the two arms: swing +1 always tips the hand outwards)
      // the elbow bends early and the upper arm follows, so the hand travels up close to the head
      const ra = Math.pow(raise, 1.3);
      const rf = smooth(clamp(raise * 1.8, 0, 1));
      // the swing only takes effect once the arm is up, so a half-raised arm can't fling out of frame
      swing *= smooth(clamp((raise - 0.55) / 0.35, 0, 1));
      a = lerp(aRest, 115 * DEG, ra);
      f = lerp(fRest, (169 - 11 * swing) * DEG, rf);
      flex = -9 * DEG * swing * rf;                 // the hand leads the forearm slightly
      // while the elbow bends, the forearm swings up in front of the body (towards the viewer), not out sideways
      fwd = 0.75 * Math.sin(Math.PI * rf);
      ez = 0.06 * raise;
    }
    const E = add(S, [s * Math.sin(a) * L1, -Math.cos(a) * L1, ez]);
    const dir = (ang) => norm([s * Math.sin(ang) * (1 - fwd), -Math.cos(ang), Math.abs(Math.sin(ang)) * fwd + 0.12 * r]);
    const W = add(E, mul(dir(f), L2));
    const u = dir(f + flex);
    let n = norm([lerp(-s, 0, r), 0, lerp(0.3, 1, r)]);
    n = norm(sub(n, mul(u, dot(n, u))));
    const t = mul(cross(u, n), -s);
    sh.push(...S); el.push(...E); wr.push(...W); hand.push(...mat3cols(u, t, n));
    open.push(r);
  }

  // badge on the chest (viewer's right), seated on the blended torso surface
  const bx = 0.2, by = 1.14;
  let lo = 0, hi = 0.8;
  for (let k = 0; k < 28; k++) {
    const m = (lo + hi) / 2;
    if (torsoSd([bx, by, m], belly, chest) < 0) lo = m; else hi = m;
  }
  const e = 1e-3, sp = [bx, by, lo];
  const bn = norm([
    torsoSd(add(sp, [e, 0, 0]), belly, chest) - torsoSd(add(sp, [-e, 0, 0]), belly, chest),
    torsoSd(add(sp, [0, e, 0]), belly, chest) - torsoSd(add(sp, [0, -e, 0]), belly, chest),
    torsoSd(add(sp, [0, 0, e]), belly, chest) - torsoSd(add(sp, [0, 0, -e]), belly, chest),
  ]);
  const bp = add(sp, mul(bn, 0.01));
  const up0 = [0, 1, 0];
  const bup = norm(sub(up0, mul(bn, dot(up0, bn))));
  const brt = cross(bup, bn);
  const badgeM = mat3cols(brt, bup, bn);

  // Everything above was built in the body's own frame. Sway (side to side) and lean (towards the
  // viewer) rotate it about the hips, and lift raises it a little; the legs stay where they are.
  const sway = clamp(num(P.bodySway, 0), -6, 6) * DEG;
  const lean = clamp(num(P.bodyLean, 0), -6, 6) * DEG;
  const up = clamp(num(P.bodyLift, 0), -1, 1) * LIFT;
  const bodyM = mat3mul(rotZ(-sway), rotX(lean));
  const bodyT = add(HIP, [0, up, 0]);
  const X = (p) => add(mat3vec(bodyM, sub(p, HIP)), bodyT);
  const Xs = (arr) => { const o = []; for (let k = 0; k < arr.length; k += 3) o.push(...X(arr.slice(k, k + 3))); return o; };
  const Xm = (arr) => { const o = []; for (let k = 0; k < arr.length; k += 9) o.push(...mat3mul(bodyM, arr.slice(k, k + 9))); return o; };

  return {
    belly, chest, bodyM, bodyT, neck: X([0, 1.3, 0]),
    pivot: X(pivot), headOff, headM: mat3mul(bodyM, headM), headC: X(headC),
    sh: Xs(sh), el: Xs(el), wr: Xs(wr), hand: Xm(hand), open,
    badgeP: X(bp), badgeM: mat3mul(bodyM, badgeM),
  };
}

const UNIFORMS = ['uRes', 'uCam', 'uTanH', 'uSteps', 'uBelly', 'uChest', 'uHeadPivot', 'uHeadM', 'uHeadOff', 'uHeadC',
  'uSh', 'uEl', 'uWr', 'uHand', 'uHandOpen', 'uBadgeP', 'uBadgeM', 'uEye', 'uBodyM', 'uBodyT', 'uNeck'];

export function createDaniel(container, opts = {}) {
  if (!container) throw new Error('createDaniel: container element required');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;background:transparent;';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 is not available');

  // Compile without waiting: where KHR_parallel_shader_compile exists the driver compiles in
  // the background and `ready` resolves once it's done, so the page never freezes on it
  // (a cold compile of this shader can take seconds with ANGLE on Windows). Elsewhere the
  // status check below blocks, as before.
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const vs = shader(gl.VERTEX_SHADER, VS);
  const fs = shader(gl.FRAGMENT_SHADER, opts._fs ? opts._fs(FS) : FS);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  const vao = gl.createVertexArray();
  const U = {};
  let linked = false;
  const finishLink = () => {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = (gl.getShaderInfoLog(fs) || '') + (gl.getProgramInfoLog(prog) || '');
      throw new Error('Daniel shader failed to compile: ' + log);
    }
    for (const n of UNIFORMS) U[n] = gl.getUniformLocation(prog, n);
    linked = true;
  };
  container.appendChild(canvas);

  const pose = { ...DEFAULT_POSE };
  let width = 1, height = 1, disposed = false, scale = 1;
  // Optional upper bound on canvas pixels (none by default; the host's adaptive resolution
  // reacts to measured frame pacing instead).
  const maxPixels = Math.max(20000, num(opts.maxPixels, Infinity));
  const steps = Math.round(clamp(num(opts.steps, 96), 32, 96));

  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const cap = num(opts.dpr, 2);
    const cssW = rect.width || 360, cssH = rect.height || 480;
    let dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, cap)) * scale;
    dpr = Math.min(dpr, Math.sqrt(maxPixels / (cssW * cssH)));
    width = Math.max(1, Math.round(cssW * dpr));
    height = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  function setPose(p) {
    if (!p) return;
    for (const k in DEFAULT_POSE) if (k in p) pose[k] = num(p[k], pose[k]);
  }

  function render() {
    if (disposed || !linked || gl.isContextLost()) return false;
    const rig = computeRig(pose);
    const aspect = width / height;
    const halfH = FRAME.halfH * Math.max(1, 0.75 / aspect);   // narrower than 3:4: keep the width, grow the height
    const camY = FRAME.bottom + halfH;
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform2f(U.uRes, width, height);
    gl.uniform3f(U.uCam, 0, camY, FRAME.dist);
    gl.uniform1f(U.uTanH, halfH / FRAME.dist);
    gl.uniform1i(U.uSteps, steps);
    gl.uniform4fv(U.uBelly, rig.belly);
    gl.uniform4fv(U.uChest, rig.chest);
    gl.uniform3fv(U.uHeadPivot, rig.pivot);
    gl.uniformMatrix3fv(U.uHeadM, false, rig.headM);
    gl.uniform3fv(U.uHeadOff, rig.headOff);
    gl.uniform3fv(U.uHeadC, rig.headC);
    gl.uniform3fv(U.uSh, rig.sh);
    gl.uniform3fv(U.uEl, rig.el);
    gl.uniform3fv(U.uWr, rig.wr);
    gl.uniformMatrix3fv(U.uHand, false, rig.hand);
    gl.uniform2fv(U.uHandOpen, rig.open);
    gl.uniform3fv(U.uBadgeP, rig.badgeP);
    gl.uniformMatrix3fv(U.uBadgeM, false, rig.badgeM);
    gl.uniformMatrix3fv(U.uBodyM, false, rig.bodyM);
    gl.uniform3fv(U.uBodyT, rig.bodyT);
    gl.uniform3fv(U.uNeck, rig.neck);
    gl.uniform4f(U.uEye, clamp(pose.gazeX, -1, 1), clamp(pose.gazeY, -1, 1), clamp(pose.blink, 0, 1), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteVertexArray(vao);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    canvas.remove();
  }

  const ready = new Promise((resolve, reject) => {
    const check = () => {
      if (disposed) { reject(new Error('Daniel was disposed before it was ready')); return; }
      if (gl.isContextLost()) { reject(new Error('Graphics context lost')); return; }
      if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) { setTimeout(check, 30); return; }
      try { finishLink(); resolve(); } catch (err) { dispose(); reject(err); }
    };
    check();
  });
  ready.catch(() => {});        // the host observes `ready`; don't report an unhandled rejection twice

  resize();
  /** Render at a fraction (0.25–1) of the normal resolution; the canvas is stretched to fit. */
  function setResolutionScale(s) {
    scale = clamp(num(s, 1), 0.25, 1);
    resize();
  }

  return { setPose, render, resize, dispose, setResolutionScale, canvas, gl, ready };
}
