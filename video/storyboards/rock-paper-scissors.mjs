/* ROCK, PAPER, SCISSORS — a round of the game on a tabletop.
   Starts straight above the board, close in, and pulls back while
   tilting as the three choices lift off one by one; glides down to the
   real result of a round played through the site's own buttons; across
   to the rules; rises over all three; dives back to the board. */
export const project = 'Rock, Paper, Scissors';

export const capture = {
  url: 'https://rock-paper-scissors-daniel.netlify.app/',
  settle: 2000,
  remove: '#nl-badge-frame',                  // Netlify's hosting badge, not part of the site
  panels: [
    { id: 'board', pieces: [
      ...[0, 1, 2].map((n) => ({ id: `choice${n}`, sel: '#choice-area > button', nth: n })),
      { id: 'score', sel: 'header div.h-28' },
    ] },
    { id: 'result', prepare: async (page, wait) => { await page.click('#choice-area > button >> nth=1'); await wait(3200); }, pieces: [
      { id: 'you', sel: '#player-result' },
      { id: 'house', sel: '#house-result' },
      { id: 'message', sel: '#result-message' },
      { id: 'again', sel: '#play-again' },
    ] },
    { id: 'rules', prepare: async (page, wait) => {
      await page.click('#play-again'); await wait(900);
      await page.evaluate(() => document.getElementById('open-rules').click()); await wait(1000);
    }, pieces: [{ id: 'modal', sel: '#rules-modal > div' }] },
  ],
};

export function film(cap, L) {
  const panels = [
    { id: 'board', x: 0, y: 0 },
    { id: 'result', x: 0, y: 880 },
    { id: 'rules', x: 1360, y: 880 },
  ];
  const all = { x: 0, y: 0, w: 2640, h: 1680 };
  const over = L.overviewCam(all, { margin: 44 });
  const hero = { x: 0, y: 0, w: 1280, h: 800 };
  const end = L.cardCam(hero);
  // One continuous glide: down from the board to the result, round the corner to the rules
  const route = [[640, 470], [640, 880 + 470], [1360 + 640, 880 + 470]];
  const len = L.pathLength(route);
  const camera = (t) => {
    const at = L.along(route, L.glide(t, { t0: 1.4, t1: 9.0, p0: 0, p1: len, accel: 1.4, decel: 1.2 }), 260);
    const fly = {
      x: at.x, y: at.y,
      // straight above the board, close, then back and tilted
      d: L.logmix(760, 1300, L.easeOut(t, 0, 3.2)),
      pitch: L.mix(0, 44, L.ramp(t, 0, 3.0)),
      yaw: 0,
    };
    let c = L.blendCam(fly, { ...over, d: over.d * (1 - 0.03 * L.ramp(t, 10.2, 10.5)) }, L.ramp(t, 8.6, 10.2));
    c = L.blendCam(c, { ...end, d: end.d * (1 - 0.02 * L.ramp(t, 11.2, 14)) }, L.easeInOut(t, 10.5, 11.2));
    return c;
  };
  return {
    duration: 14,
    floor: ['#22346b', '#121c3c'],
    ink: ['#ffffff', '#9aa5c7'],
    dark: true,
    panels,
    lifts: [
      ...[0, 1, 2].map((n) => ({ id: `choice${n}`, at: 0.5 + n * 0.35, z: 50 + n * 8, stand: 26 })),
      { id: 'score', at: 1.6, z: 30, stand: 20 },
      { id: 'you', at: 3.6, z: 56, stand: 22 },
      { id: 'house', at: 3.9, z: 66, stand: 22 },
      { id: 'message', at: 4.3, z: 40, stand: 28 },
      { id: 'again', at: 4.5, z: 30, stand: 28 },
      { id: 'modal', at: 6.8, z: 40, stand: 12 },
    ],
    camera,
    end: { hero, t0: 10.5, t1: 11.2 },
    poster: 13,
    cruise: [3.0, 7.6],
  };
}
