/* STUDY DESK — across the desk, on a diagonal.
   Captured with the site's own "Load example tasks", so the list holds
   its real example tasks (they stay on the desk; their rows are
   see-through, so lifted they'd float as loose text). The camera drifts
   diagonally (moving, never turning) from the title to the task form,
   the tasks and the focus timer, then lifts straight up over the whole
   desk and settles on the top of the page as the card. */
export const project = 'Study Desk';

export const capture = {
  url: 'local:projects/study-desk/index.html',
  settle: 1500,
  panels: [{
    id: 'desk', fullPage: true,
    prepare: async (page, wait) => { await page.click('text=Load example tasks'); await wait(900); },
    pieces: [
      { id: 'title', sel: 'main h1' },
      { id: 'nav', sel: 'aside button.nav', nth: 0 },
      { id: 'form', sel: '#taskForm' },
      { id: 'focus', sel: 'aside.focus' },
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
      x: L.glide(t, { t0: 0, t1: 8.4, p0: 420, p1: 1010, accel: 1.4, decel: 1.2 }),
      y: L.glide(t, { t0: 0, t1: 8.0, p0: 300, p1: 690, accel: 1.4, decel: 1.4 }),
      d: L.mix(1180, 1300, L.ramp(t, 0, 8.4)), pitch: 52, yaw: 0,
    };
    let c = L.blendCam(fly, over, L.ramp(t, 7.6, 9.2));
    c = L.blendCam(c, { ...end, d: end.d * (1 - 0.02 * L.ramp(t, 10, 13)) }, L.easeInOut(t, 9.3, 10));
    return c;
  };
  return {
    duration: 13,
    floor: ['#f4f2ec', '#e6e3d9'],
    ink: ['#1a2a20', '#8b8b92'],
    panels: [{ id: 'desk', x: 0, y: 0 }],
    lifts: [
      { id: 'title', at: 0.35, z: 30, stand: 30 },
      { id: 'nav', at: 0.7, z: 20, stand: 16 },
      { id: 'form', at: 2.1, z: 18, stand: 8 },
      { id: 'focus', at: 5.2, z: 34, stand: 14 },
    ],
    camera,
    end: { hero, t0: 9.3, t1: 10 },
    poster: 11.8,
    cruise: [1.6, 6.6],
  };
}
