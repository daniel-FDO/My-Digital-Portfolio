/* BLUEPRINT — a deck of its scroll scenes.
   Blueprint tells its story as full-screen scenes while you scroll
   (hero, Write, the three templates, Check, export), so the film lays
   five of those real scenes out as a staggered deck on a dark floor
   and glides down it, weaving to keep each scene centred. Then it
   pulls back at an angle to reveal the deck and dives back up to the
   hero. */
export const project = 'Blueprint';

const scene = (y, ms = 1600) => async (page, wait) => { await page.evaluate((y) => scrollTo(0, y), y); await wait(ms); };

export const capture = {
  url: 'https://blueprint-vwig.onrender.com/',
  waitUntil: 'networkidle',
  settle: 2500,
  panels: [
    { id: 'hero', prepare: scene(0), pieces: [
      { id: 'cta', sel: 'section#top a.btn.btn-primary' },
      ...[0, 1, 2].map((n) => ({ id: `chip${n}`, sel: '#hero-fragments .frag-pill', nth: n })),
    ] },
    // (the assistant's suggestion only appears from ~2800px; the export title is fully typed by ~14100px)
    { id: 'write', prepare: scene(2800), pieces: [
      { id: 'assistant', sel: '#assistant .assistant-ask' },
    ] },
    { id: 'templates', prepare: scene(7230), pieces: [1, 2, 3, 4].map((n) => ({ id: `tile${n}`, sel: '#gallery-grid a.gallery-tile', nth: n })) },
    { id: 'check', prepare: scene(8400), pieces: [
      { id: 'checkpage', sel: '#check-page' },
      { id: 'lens', sel: '#check-lens' },
    ] },
    { id: 'export', prepare: scene(14300), pieces: [          // its title types itself out as you scroll: complete by here
      { id: 'formats', sel: '.export-formats' },
      { id: 'download', sel: '#export-action' },
    ] },
  ],
};

const STEP = 880;               // 800px scenes + an 80px gap
const SWAY = 150;               // the deck's stagger left / right

export function film(cap, L) {
  const ids = ['hero', 'write', 'templates', 'check', 'export'];
  const panels = ids.map((id, i) => ({ id, x: (i % 2 ? SWAY : -SWAY) * (i ? 1 : 0), y: i * STEP }));
  // The camera's x follows the deck's stagger smoothly as it goes down
  const swayAt = (y) => {
    const f = Math.max(0, Math.min(ids.length - 1, (y - 400) / STEP));
    const i = Math.floor(f), k = f - i;
    const xi = (n) => 640 + panels[Math.min(n, ids.length - 1)].x;
    return L.mix(xi(i), xi(i + 1), (1 - Math.cos(Math.PI * k)) / 2);
  };
  const hero = { x: panels[0].x, y: 0, w: 1280, h: 800 };
  const deck = { x: -SWAY, y: 0, w: 1280 + 2 * SWAY, h: ids.length * STEP - 80 };
  const reveal = { ...L.overviewCam(deck, { margin: 30 }), pitch: 34 };
  reveal.d *= 0.78;
  const end = L.cardCam(hero);
  const camera = (t) => {
    const y = L.glide(t, { t0: 0, t1: 8.4, p0: 380, p1: 4 * STEP + 420, accel: 1.3, decel: 1.2 });
    const fly = { x: swayAt(y), y, d: L.mix(1380, 1560, L.ramp(t, 0, 8.4)), pitch: 50, yaw: 0 };
    let c = L.blendCam(fly, reveal, L.ramp(t, 7.9, 9.6));
    c = L.blendCam(c, { ...end, d: end.d * (1 - 0.02 * L.ramp(t, 10.6, 14)) }, L.easeInOut(t, 9.6, 10.6));
    return c;
  };
  return {
    duration: 14,
    floor: ['#111a30', '#070b16'],
    ink: ['#f2f4fa', '#8f96ab'],
    dark: true,
    panels,
    lifts: [
      { id: 'cta', at: 0.3, z: 40, stand: 24 },
      ...[0, 1, 2].map((n) => ({ id: `chip${n}`, at: 0.2 + n * 0.15, z: 40 + n * 8, stand: 28 })),
      { id: 'assistant', at: 1.8, z: 56, stand: 22 },
      ...[1, 2, 3, 4].map((n, i) => ({ id: `tile${n}`, at: 3.2 + i * 0.18, z: 32 + i * 6, stand: 30 })),
      { id: 'checkpage', at: 4.9, z: 20, stand: 10 },
      { id: 'lens', at: 5.1, z: 64, stand: 22 },
      { id: 'formats', at: 6.6, z: 30, stand: 24 },
      { id: 'download', at: 6.8, z: 46, stand: 24 },
    ],
    camera,
    end: { hero, t0: 9.6, t1: 10.6 },
    poster: 12.8,
    cruise: [1.6, 7.0],   // the steady part of the glide (check-motion.mjs)
  };
}
