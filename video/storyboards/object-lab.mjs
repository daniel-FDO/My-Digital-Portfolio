/* OBJECT LAB — a low sweep across the chamber.
   Shapes are dropped into the live chamber with the site's own Circle +
   and Square + buttons and left to settle before the capture. The
   camera sits low, looking across the page, and trucks left to right
   along the chamber while its controls stand up; then it rises over
   the page and settles on the top as the card. */
export const project = 'Object Lab';

export const capture = {
  url: 'local:projects/object-lab/index.html',
  settle: 1500,
  setup: async (page, wait) => {
    for (let i = 0; i < 4; i++) { await page.click('#addCircle'); await wait(260); await page.click('#addSquare'); await wait(260); }
    await wait(3200);
  },
  panels: [{
    id: 'lab', fullPage: true,
    pieces: [
      { id: 'title', sel: 'main h1' },
      { id: 'bench', sel: '.bench-header' },
      { id: 'circle', sel: '#addCircle' },
      { id: 'square', sel: '#addSquare' },
      { id: 'gravity', sel: '.gravity-control' },
      { id: 'pause', sel: '#pause' },
      { id: 'reset', sel: '#reset' },
    ],
  }],
};

export function film(cap, L) {
  const page = cap.panels[0];
  const hero = { x: 0, y: 0, w: 1280, h: 800 };
  const over = L.overviewCam({ x: 0, y: 0, w: page.w, h: page.h }, { margin: 60 });
  const end = L.cardCam(hero);
  const camera = (t) => {
    const fly = {
      x: L.glide(t, { t0: 0, t1: 7.8, p0: 330, p1: 960, accel: 1.3, decel: 1.3 }),
      y: L.mix(500, 580, L.ramp(t, 0, 4.5)),
      d: L.mix(960, 1060, L.ramp(t, 0, 7.8)), pitch: 55, yaw: 0,
    };
    let c = L.blendCam(fly, over, L.ramp(t, 7.0, 8.7));
    c = L.blendCam(c, { ...end, d: end.d * (1 - 0.02 * L.ramp(t, 9.6, 12.5)) }, L.easeInOut(t, 8.9, 9.6));
    return c;
  };
  return {
    duration: 12.5,
    floor: ['#f3f1ec', '#e5e1d8'],
    ink: ['#1d1b18', '#8b8b92'],
    panels: [{ id: 'lab', x: 0, y: 0 }],
    lifts: [
      { id: 'title', at: 0.3, z: 28, stand: 32 },
      { id: 'bench', at: 1.0, z: 14, stand: 18 },
      { id: 'circle', at: 2.4, z: 36, stand: 28 },
      { id: 'square', at: 2.6, z: 42, stand: 28 },
      { id: 'gravity', at: 3.4, z: 28, stand: 24 },
      { id: 'pause', at: 4.4, z: 38, stand: 28 },
      { id: 'reset', at: 4.6, z: 46, stand: 28 },
    ],
    camera,
    end: { hero, t0: 8.9, t1: 9.6 },
    poster: 11.2,
    cruise: [1.6, 6.4],   // the steady part of the glide (check-motion.mjs)
  };
}
