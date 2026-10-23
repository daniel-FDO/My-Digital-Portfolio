/* Seeded value noise (deterministic: the same pattern on every visit).
   Shared by the background's contours (background/topo.ts) and the
   gallery's photo contour maps (gallery/isophote.ts). */
export function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed: number) {
  return noise(x, y, seed) * 0.7 + noise(x * 2.03, y * 2.03, seed + 7) * 0.25 + noise(x * 4.1, y * 4.1, seed + 13) * 0.05;
}
