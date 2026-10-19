/* DANIEL'S GALLERY — a corridor of rooms.
   The real lobby and three rooms (entered with the site's own Enter
   button and room tabs) hang side by side like a corridor; the camera
   trucks along them left to right while each room's works lift off the
   wall. Then it rises to see the whole corridor and dives into the
   lobby. */
export const project = 'Daniel’s Gallery';

const room = (name) => async (page, wait) => { await page.click(`nav.pill a:text-is("${name}")`); await wait(3800); };

export const capture = {
  url: 'https://gallery-zeta-blond.vercel.app/',
  settle: 3500,
  panels: [
    { id: 'lobby', pieces: [{ id: 'enter', sel: '#enter-btn' }] },
    { id: 'livearts', prepare: async (page, wait) => { await page.click('#enter-btn'); await wait(4200); }, pieces: [
      { id: 'art0', sel: '.cw-panel .frame', nth: 0 },
      { id: 'art1', sel: '.cw-panel .frame', nth: 1 },
      { id: 'pill', sel: 'nav.pill' },
    ] },
    { id: 'wallpapers', prepare: room('Wallpapers'), pieces: [
      { id: 'banner0', sel: '.sr-banner', nth: 0 },
      { id: 'banner1', sel: '.sr-banner', nth: 1 },
      { id: 'sign', sel: '.sr-sign' },
    ] },
    { id: 'portraits', prepare: room('Portraits'), pieces: [0, 1, 2].map((n) => ({ id: `portrait${n}`, sel: '.sf-art .sf-frame', nth: n })) },
  ],
};

const GAP = 80;

export function film(cap, L) {
  const ids = ['lobby', 'livearts', 'wallpapers', 'portraits'];
  const panels = ids.map((id, i) => ({ id, x: i * (1280 + GAP), y: 0 }));
  const span = { x: 0, y: 0, w: ids.length * (1280 + GAP) - GAP, h: 800 };
  const over = L.overviewCam(span, { margin: 40 });
  const hero = { x: 0, y: 0, w: 1280, h: 800 };
  const end = L.cardCam(hero);
  const camera = (t) => {
    const fly = {
      x: L.glide(t, { t0: 0, t1: 8.8, p0: 640, p1: span.w - 640, accel: 1.4, decel: 1.3 }),
      y: 470, d: L.mix(1400, 1520, L.ramp(t, 0, 8.8)), pitch: 44, yaw: 0,
    };
    let c = L.blendCam(fly, { ...over, d: over.d * (1 - 0.03 * L.ramp(t, 9.6, 9.9)) }, L.ramp(t, 8.2, 9.6));
    c = L.blendCam(c, { ...end, d: end.d * (1 - 0.02 * L.ramp(t, 10.6, 14)) }, L.easeInOut(t, 9.9, 10.6));
    return c;
  };
  return {
    duration: 14,
    floor: ['#f5f2ec', '#e6e0d5'],
    ink: ['#1f1c18', '#8b8b92'],
    panels,
    lifts: [
      { id: 'enter', at: 0.35, z: 50, stand: 24 },
      { id: 'pill', at: 1.9, z: 18, stand: 12 },
      { id: 'art0', at: 2.0, z: 40, stand: 18 },
      { id: 'art1', at: 2.25, z: 32, stand: 18 },
      { id: 'sign', at: 4.3, z: 26, stand: 22 },
      { id: 'banner0', at: 4.45, z: 36, stand: 14 },
      { id: 'banner1', at: 4.7, z: 46, stand: 14 },
      ...[0, 1, 2].map((n) => ({ id: `portrait${n}`, at: 6.6 + n * 0.22, z: 32 + n * 8, stand: 18 })),
    ],
    camera,
    end: { hero, t0: 9.9, t1: 10.6 },
    poster: 12.8,
    cruise: [1.8, 7.4],   // the steady part of the glide (check-motion.mjs)
  };
}
