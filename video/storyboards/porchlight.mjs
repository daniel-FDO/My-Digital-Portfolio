/* HOMELESS SUPPORT FINDER — the classic fly-over.
   The whole page lies flat; the camera starts low over the hero and
   glides back down the page looking up it, past the support cards,
   the stats and the guides, rises straight overhead to show the page
   as one strip, then dives into the hero, which lands as the card. */
export const project = 'Homeless Support Finder';

export const capture = {
  url: 'https://porchlightwebproj.netlify.app/',
  waitUntil: 'networkidle',
  panels: [{
    id: 'page', fullPage: true,
    pieces: [
      { id: 'help', sel: 'a.support-cta' },
      { id: 'herocard', sel: '.home-hero-card' },
      ...[0, 1, 2, 3].map((n) => ({ id: `mood${n}`, sel: '.home-hero-buttons button', nth: n })),
      ...[0, 1, 2].map((n) => ({ id: `feat${n}`, sel: '.home-feature-card', nth: n })),
      ...[0, 1, 2].map((n) => ({ id: `stat${n}`, sel: '.home-stat', nth: n })),
      ...[0, 1, 2, 3].map((n) => ({ id: `guide${n}`, sel: '.guide-card', nth: n })),
    ],
  }],
};

export function film(cap, L) {
  const page = cap.panels[0];
  const hero = { x: 0, y: 0, w: 1280, h: 800 };
  const over = L.overviewCam({ x: 0, y: 0, w: page.w, h: page.h }, { margin: 42 });
  const end = L.cardCam(hero);
  const camera = (t) => {
    const fly = {
      x: 640,
      y: L.glide(t, { t0: 0, t1: 8.2, p0: 330, p1: page.h - 420, accel: 1.5, decel: 1.0 }),
      d: L.mix(1420, 1600, L.ramp(t, 0, 8.2)),
      pitch: 56, yaw: 0,
    };
    let c = L.blendCam(fly, { ...over, d: over.d * (1 - 0.035 * L.ramp(t, 9.25, 9.47)) }, L.ramp(t, 7.75, 9.25));
    c = L.blendCam(c, { ...end, d: end.d * (1 - 0.02 * L.ramp(t, 10.1, 13.5)) }, L.easeInOut(t, 9.47, 10.1));
    return c;
  };
  return {
    duration: 13.5,
    floor: ['#f7f5fa', '#ebe6f2'],
    ink: ['#1e1530', '#8b8b92'],
    panels: [{ id: 'page', x: 0, y: 0 }],
    lifts: [
      { id: 'help', at: 0.25, z: 30, stand: 20 },
      { id: 'herocard', at: 0.3, z: 12, stand: 3 },
      ...[0, 1, 2, 3].map((n) => ({ id: `mood${n}`, at: 0.45 + n * 0.12, z: 20 + n * 3, stand: 10 })),
      ...[0, 1, 2].map((n) => ({ id: `feat${n}`, at: 1.35 + n * 0.15, z: 30, stand: 28 })),
      ...[0, 1, 2].map((n) => ({ id: `stat${n}`, at: 2.9 + n * 0.15, z: 26, stand: 36 })),
      ...[0, 1, 2, 3].map((n) => ({ id: `guide${n}`, at: 4.1 + n * 0.3, z: 20, stand: 16 })),
    ],
    camera,
    end: { hero, t0: 9.47, t1: 10.1 },
    poster: 12.4,
    cruise: [1.8, 7.0],   // the steady part of the glide (check-motion.mjs)
  };
}
