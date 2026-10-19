/* =========================================================
   FOOTBALL ON THE WORDMARK
   Ronaldo stands on the "n", Messi on the dot of the "i", and they
   juggle and pass a ball between them. The pixel-art poses come
   straight from the sprite sheet (no bending, no cross-fades); the
   ball is a separate image.
   - one small canvas over the letters; clicks and drags go straight
     through it (the ID card and links stay usable)
   - feet are placed on the letters' real shapes, measured from the
     font after the wordmark has been sized (wordmark.ts → relayout())
   - artwork loads just before the footer arrives; the loop runs only
     while it's on screen, the tab is visible and it isn't paused
   - reduced motion: a still picture until Play is pressed
   - narrow screens: one player juggling alone, or nobody if the ID
     card hangs over both letters
   The Play / Pause button is React's (Footer.tsx): onState tells it
   whether to show and what it says; toggle() is its click.
   ========================================================= */

export interface FootballEls {
  foot: HTMLElement;
  word: HTMLElement;
  mark: HTMLElement;
  canvas: HTMLCanvasElement;
  /** a zero-size box on the wordmark's baseline */
  probe: HTMLElement;
  card: HTMLElement;
  space: HTMLElement;
}

export interface FootballState { show: boolean; playing: boolean }

// The six poses in each row of the sprite sheet
const POSE = { IDLE: 0, PREP: 1, FOOT: 2, KNEE: 3, PASS: 4, READY: 5 } as const;
type Pose = (typeof POSE)[keyof typeof POSE];

interface PlayerDef {
  name: string; row: number; letter: string; facing: 1 | -1;
  feet: number[]; ground: number[]; box: [number, number, number][];
  touch: Partial<Record<Pose, [number, number]>>;
  slices?: ({ l: number; r: number } | undefined)[];
}

/* ---------------------------------------------------------
   SETTINGS — everything you might want to tweak is here
   --------------------------------------------------------- */
const CONFIG = {
  // Artwork (only downloaded when the footer is close)
  sheet: 'assets/football/ronaldo-messi-sprite-concept.png', // 6 poses × 2 players
  ball: 'assets/football/ball.png',  // the ball from approved-characters.png, cropped (44 KB instead of 692 KB)
  cell: 362,                         // each pose sits in a 362 × 362 px cell of the sheet
  loadAhead: 1200,                   // start downloading this many px before the footer is on screen

  // Sizes, in CSS px
  height: {
    max: 80,                         // tallest the players get (desktop)
    perFont: 0.2,                    // ...and never taller than 20% of the wordmark's font size
    min: 34,                         // smaller than this and they're left out
    duoMin: 46,                      // below this, one player juggling alone looks better than two
    step: 2,                         // shrink in 2px steps until everything fits
  },
  // Phones (footer narrower than `below` px): the wordmark is only ~120–150px tall there, so
  // 20% of it is under `min` and nobody would ever fit. These limits apply instead; wider
  // footers (tablet, desktop) keep the settings above unchanged.
  narrow: { below: 560, perFont: 0.3, min: 26, duoMin: 28 },
  ballSize: 0.13,                    // ball diameter, × player height
  ballMin: 7,                        // ...but never under this many CSS px, so it stays visible on phones
  clearance: 8,                      // px kept free around the links and the ID card
  minArc: 0.22,                      // if the ball can't rise at least this much (× height), that layout doesn't fit

  // When each pose shows, as a fraction of the ball's flight from one touch to the next.
  // The touch itself lands at 0 / 1, in the middle of the strike pose.
  poseAt: {
    followThrough: 0.22,             // the player who touched it holds the pose until here
    recover: 0.38,                   // ...then a "prepare" frame until here
    prepare: 0.69,                   // the player about to touch it gets ready from here
    strike: 0.88,                    // ...and shows the touch pose from here
  },

  // The routine: [who (0 Ronaldo, 1 Messi), touch, seconds until the next touch, arc].
  // Arc = how far the ball rises above the higher of the two touches, × player height
  // (lowered automatically if a link or the ID card is in the way).
  duo: [
    [0, POSE.FOOT, 0.95, 0.5], [0, POSE.KNEE, 1.05, 0.38], [0, POSE.FOOT, 0.95, 0.5], [0, POSE.PASS, 1.6, 0.5],
    [1, POSE.FOOT, 0.95, 0.5], [1, POSE.KNEE, 1.05, 0.38], [1, POSE.FOOT, 0.95, 0.5], [1, POSE.PASS, 1.6, 0.5],
  ] as [number, Pose, number, number][],
  // Narrow screens: one player keeps it up alone (the "pass" pose becomes a high kick-up)
  solo: [[POSE.FOOT, 0.95, 0.5], [POSE.KNEE, 1.05, 0.38], [POSE.FOOT, 0.95, 0.5], [POSE.PASS, 1.25, 0.75]] as [Pose, number, number][],

  // Measured from the sheet (pixels with alpha > 60), in px inside each 362px cell, per pose:
  //   feet   – middle of the ground contact (both boots, or the standing boot). Lining these up
  //            keeps the planted feet still from frame to frame.
  //   ground – lowest row of the boots
  //   box    – the figure's [left, top, right]
  //   touch  – where the ball meets the boot (foot tap, pass) or the knee
  feetHalf: 78,                      // half the widest stance (sheet px): the flat bit of letter they need
  sliceRows: 24,                     // the outline used to keep clear of links is measured in 24px slices
  players: [
    {
      name: 'Ronaldo', row: 0, letter: 'n', facing: 1,
      feet: [160, 169.5, 167, 175.5, 176.5, 202.5],
      ground: [352, 352, 352, 352, 351, 352],
      box: [[84, 15, 231], [74, 27, 262], [87, 15, 313], [93, 15, 269], [62, 30, 346], [121, 15, 279]],
      touch: { [POSE.FOOT]: [288, 232], [POSE.KNEE]: [204, 157], [POSE.PASS]: [332, 236] },
    },
    {
      name: 'Messi', row: 1, letter: 'i', facing: -1,
      feet: [165, 180.5, 180.5, 186.5, 189, 206.5],
      ground: [344, 344, 342, 342, 342, 344],
      box: [[90, 21, 246], [75, 28, 265], [48, 14, 264], [101, 14, 275], [38, 24, 312], [129, 17, 287]],
      touch: { [POSE.FOOT]: [70, 232], [POSE.KNEE]: [127, 152], [POSE.PASS]: [56, 250] },
    },
  ] as PlayerDef[],
};

interface Box { l: number; t: number; r: number; b: number }
interface Letter { x0: number; step: number; tops: number[]; mid: number }
interface Measure {
  s: number;
  boxes: { l: number; r: number; t: number }[];
  all: { l: number; r: number; t: number };
  slices: Box[];
  touch: Partial<Record<Pose, { x: number; y: number }>>;
  feetHalf: number;
}
interface Placed {
  p: number; P: PlayerDef; M: Measure; x: number; y: number; parts: Box[]; letter: Letter; box: Box;
  frames?: { c: HTMLCanvasElement; left: number; up: number }[];
}
interface Touch { q: number; pose: Pose; dur: number; arc: number; x: number; y: number; apex?: number }
interface Plan {
  mode: 'duo' | 'solo';
  height: number;
  players: Placed[];
  seq: Touch[];
  r: number;
  total: number;
  rest?: { x: number; y: number } | null;
  band?: Box;
  ballCanvas?: HTMLCanvasElement;
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(src));
  img.src = src;
});

const overlaps = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

// The ball between two touches: a real projectile curve through `apex`
function flight(a: Touch, b: Touch, u: number) {
  const apex = a.apex!;
  const sa = Math.sqrt(Math.max(0, a.y - apex)), sb = Math.sqrt(Math.max(0, b.y - apex));
  const top = sa / (sa + sb || 1);            // when it reaches the top
  return { x: a.x + (b.x - a.x) * u, y: apex + (sa + sb) ** 2 * (u - top) ** 2 };
}

export function createFootball(els: FootballEls, onState: (s: FootballState) => void) {
  const { foot, word, mark, canvas, probe, card, space } = els;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups: (() => void)[] = [];
  let destroyed = false;
  let sheet: HTMLImageElement | null = null, ballImg: HTMLImageElement | null = null;
  const ctx = canvas.getContext('2d')!;
  let plan: Plan | { mode: 'none' } | null = null;
  let dpr = 1;
  let time = 0, last = 0, raf = 0, spin = 0, prevBallX: number | null = null;
  let inView = false;
  let choice: 'play' | 'pause' | null = null;   // the visitor's own choice (null = the default)

  const wantsPlay = () => (choice ? choice === 'play' : !reduceMotion.matches);
  const live = (): Plan | null => (plan && plan.mode !== 'none' ? plan : null);

  /* ---------------------------------------------------------
     1. LOAD THE ARTWORK — just before the footer comes into view
     --------------------------------------------------------- */
  const loadWatch = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    loadWatch.disconnect();
    Promise.allSettled([loadImage(CONFIG.sheet), loadImage(CONFIG.ball)]).then(([s, b]) => {
      if (destroyed) return;
      if (s.status !== 'fulfilled') {             // no players → leave the footer exactly as it was
        console.warn('Footer football: the sprite sheet could not load.', s.reason);
        return;
      }
      sheet = s.value;
      ballImg = b.status === 'fulfilled' ? b.value : null;   // no ball image → a plain drawn ball
      setup();
    });
  }, { rootMargin: `0px 0px ${CONFIG.loadAhead}px 0px` });
  loadWatch.observe(foot);
  cleanups.push(() => loadWatch.disconnect());

  /* ---------------------------------------------------------
     2. SETUP — runs once, after the artwork has loaded
     --------------------------------------------------------- */
  function setup() {
    readOutlines();

    // Re-measure when the footer changes size or fonts arrive
    const resize = new ResizeObserver(scheduleLayout);
    resize.observe(foot);
    cleanups.push(() => resize.disconnect());
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', scheduleLayout);
      cleanups.push(() => document.fonts.removeEventListener('loadingdone', scheduleLayout));
    }
    watchPixelRatio();

    const seen = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); });
    seen.observe(canvas);
    cleanups.push(() => seen.disconnect());
    document.addEventListener('visibilitychange', sync);
    cleanups.push(() => document.removeEventListener('visibilitychange', sync));
    const onMotion = () => {
      if (choice) return;                           // the visitor already chose; keep it
      if (reduceMotion.matches) { time = 0; draw(); }   // back to the still picture
      sync();
    };
    reduceMotion.addEventListener('change', onMotion);
    cleanups.push(() => reduceMotion.removeEventListener('change', onMotion));

    layout();
  }

  // Zooming or moving to another screen can change the pixel ratio without a resize
  function watchPixelRatio() {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => { scheduleLayout(); watchPixelRatio(); };
    mq.addEventListener('change', onChange, { once: true });
    cleanups.push(() => mq.removeEventListener('change', onChange));
  }

  let layoutQueued = 0;
  function scheduleLayout() {
    if (layoutQueued || !sheet || destroyed) return;
    layoutQueued = requestAnimationFrame(() => { layoutQueued = 0; layout(); });
  }
  cleanups.push(() => cancelAnimationFrame(layoutQueued));

  /* ---------------------------------------------------------
     3. LAYOUT — where the letters are, how big the players can be
     --------------------------------------------------------- */
  const scan = document.createElement('canvas');

  // The top edge of one letter, in footer coordinates. The pen position
  // comes from the page; the shape comes from drawing the letter with the
  // same font and finding the first inked row in each column.
  function letterTop(ch: string, penX: number, baseline: number, fs: number, family: string, markTop: number): Letter {
    const k = Math.min(dpr, 2);                        // scan at screen resolution
    const font = `800 ${fs * k}px ${family}`;
    const g = scan.getContext('2d', { willReadFrequently: true })!;
    g.font = font;
    const m = g.measureText(ch);
    const pad = 2;
    const left = Math.floor(-m.actualBoundingBoxLeft) - pad;
    const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2;
    const h = Math.ceil(fs * k * 0.14) + pad;          // only the top of the letter matters
    scan.width = w;
    scan.height = h;
    g.font = font;
    g.fillText(ch, -left, pad + m.actualBoundingBoxAscent);   // the ink's top lands on row `pad`
    const data = g.getImageData(0, 0, w, h).data;
    const y0 = baseline - m.actualBoundingBoxAscent / k;
    const tops = new Array<number>(w).fill(NaN);
    let first = -1, lastCol = -1;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (data[(y * w + x) * 4 + 3] >= 128) {
          tops[x] = Math.max(markTop, y0 + (y - pad) / k);   // the wordmark's top edge crops anything above it
          if (first < 0) first = x;
          lastCol = x;
          break;
        }
      }
    }
    const x0 = penX + left / k, step = 1 / k;
    return { x0, step, tops, mid: x0 + ((first + lastCol) / 2) * step };
  }

  // Each player's outline: for every 24px slice up from the boots, how far
  // left and right any pose reaches (relative to the planted feet). Much
  // tighter than one big box, so they can stand close to the links.
  // If the pixels can't be read, the pose boxes from CONFIG are used instead.
  function readOutlines() {
    const cell = CONFIG.cell, rows = CONFIG.sliceRows, img = sheet!;
    let data: Uint8ClampedArray | null = null;
    try {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      data = g.getImageData(0, 0, c.width, c.height).data;
    } catch { /* fall back to the boxes */ }
    CONFIG.players.forEach((P) => {
      const slices: ({ l: number; r: number } | undefined)[] = [];
      const add = (j: number, l: number, r: number) => {
        const s = slices[j] || (slices[j] = { l: Infinity, r: -Infinity });
        s.l = Math.min(s.l, l);
        s.r = Math.max(s.r, r);
      };
      P.box.forEach(([l, t, r], f) => {
        const fx = P.feet[f], ge = P.ground[f] + 1, sx = f * cell, sy = P.row * cell;
        if (!data) {
          for (let y = t; y < ge; y += rows) add(Math.floor((ge - 1 - y) / rows), l - fx, r + 1 - fx);
          return;
        }
        for (let y = t; y < ge; y++) {
          let minX = -1, maxX = -1;
          for (let x = l; x <= r; x++) {
            if (data[((sy + y) * img.width + sx + x) * 4 + 3] > 60) { if (minX < 0) minX = x; maxX = x; }
          }
          if (minX >= 0) add(Math.floor((ge - 1 - y) / rows), minX - fx, maxX + 1 - fx);
        }
      });
      P.slices = slices;
    });
  }

  // A player's measurements at a given height (CSS px, relative to the planted feet)
  function measure(P: PlayerDef, height: number): Measure {
    const s = height / (P.ground[0] + 1 - P.box[0][1]);   // idle pose = `height` tall
    const boxes = P.box.map(([l, t, r], f) => ({ l: (l - P.feet[f]) * s, r: (r - P.feet[f]) * s, t: (t - P.ground[f] - 1) * s }));
    const all = { l: Math.min(...boxes.map((b) => b.l)), r: Math.max(...boxes.map((b) => b.r)), t: Math.min(...boxes.map((b) => b.t)) };
    const rows = CONFIG.sliceRows * s;
    const slices: Box[] = [];
    (P.slices || []).forEach((sl, j) => { if (sl) slices.push({ l: sl.l * s, r: sl.r * s, t: -(j + 1) * rows, b: -j * rows }); });
    const touch: Measure['touch'] = {};
    (Object.keys(P.touch) as unknown as Pose[]).forEach((f) => {
      const [x, y] = P.touch[f]!;
      touch[f] = { x: (x - P.feet[f]) * s, y: (y - P.ground[f] - 1) * s };
    });
    return { s, boxes, all, slices, touch, feetHalf: CONFIG.feetHalf * s };
  }

  function layout() {
    if (destroyed) return;
    const fs = parseFloat(word.style.fontSize);       // set by wordmark.ts once the wordmark is fitted
    const fr = foot.getBoundingClientRect();
    const text = Array.from(word.childNodes).find((n): n is Text => n.nodeType === 3 && (n as Text).data.startsWith('ni'));
    if (!fs || !fr.width || !text) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);

    const rel = (r: DOMRect): Box => ({ l: r.left - fr.left, t: r.top - fr.top, r: r.right - fr.left, b: r.bottom - fr.top });
    const range = document.createRange();
    const pen = (i: number) => { range.setStart(text, i); range.setEnd(text, i + 1); return range.getBoundingClientRect().left - fr.left; };
    const baseline = probe.getBoundingClientRect().top - fr.top;
    const markTop = mark.getBoundingClientRect().top - fr.top;
    const family = getComputedStyle(word).fontFamily;
    const letters = [
      letterTop('n', pen(0), baseline, fs, family, markTop),
      letterTop('i', pen(1), baseline, fs, family, markTop),
    ];

    // Things the players and ball must keep clear of: every link and badge
    // in the top row, and the ID card + lanyard where they hang at rest.
    const pad = CONFIG.clearance;
    const grow = (o: Box): Box => ({ l: o.l - pad, t: o.t - pad, r: o.r + pad, b: o.b + pad });
    const obstacles = Array.from(foot.querySelectorAll('.ffoot__top a')).map((a) => grow(rel(a.getBoundingClientRect())));
    {
      const cs = getComputedStyle(foot), sr = rel(space.getBoundingClientRect());
      const ax = sr.l + (sr.r - sr.l) * (parseFloat(cs.getPropertyValue('--anchor-x')) || 0.5);
      const ay = sr.t + (parseFloat(cs.getPropertyValue('--anchor-y')) || 0);
      const top = ay + (parseFloat(cs.getPropertyValue('--rope')) || 80);
      obstacles.push(grow({ l: ax - card.offsetWidth / 2, r: ax + card.offsetWidth / 2, t: top, b: top + card.offsetHeight }));
      obstacles.push(grow({ l: ax - 16, r: ax + 16, t: ay - 10, b: top }));
    }
    const W = fr.width;
    const fits = (b: Box) => b.l >= 4 && b.r <= W - 4 && b.t >= 4 && !obstacles.some((o) => overlaps(b, o));

    // Stand a player on the flattest bit of their letter, nearest its middle
    function place(p: number, height: number): Placed | null {
      const P = CONFIG.players[p], M = measure(P, height), L = letters[p];
      const span = Math.round(M.feetHalf / L.step), tol = height * 0.07, spots: { x: number; y: number }[] = [];
      for (let c = span; c < L.tops.length - span; c++) {
        let hi = Infinity, lo = -Infinity;
        for (let j = c - span; j <= c + span && lo - hi <= tol; j++) {
          const t = L.tops[j];
          if (Number.isNaN(t)) { lo = Infinity; break; }
          hi = Math.min(hi, t); lo = Math.max(lo, t);
        }
        if (lo - hi <= tol) spots.push({ x: L.x0 + c * L.step, y: hi });   // feet on the highest point: never sunk in
      }
      spots.sort((a, b) => Math.abs(a.x - L.mid) - Math.abs(b.x - L.mid));
      for (const s of spots) {
        const parts = M.slices.map((sl) => ({ l: s.x + sl.l, r: s.x + sl.r, t: s.y + sl.t, b: s.y + sl.b }));
        if (parts.every(fits)) {
          return { p, P, M, x: s.x, y: s.y, parts, letter: L, box: { l: s.x + M.all.l, r: s.x + M.all.r, t: s.y + M.all.t, b: s.y } };
        }
      }
      return null;
    }
    // Ronaldo's and Messi's outlines never touch (with room for the ball between)
    const apart = (a: Placed, b: Placed, gap: number) => a.parts.every((pa) => b.parts.every((pb) => !overlaps({ l: pa.l - gap, r: pa.r + gap, t: pa.t, b: pa.b }, pb)));

    // The ball's route through the routine; null if it can't fly without hitting something
    function route(players: Placed[], height: number, solo: boolean) {
      const r = Math.max(height * CONFIG.ballSize, CONFIG.ballMin) / 2;
      const steps: [number, Pose, number, number][] = solo ? CONFIG.solo.map(([pose, dur, arc]) => [0, pose, dur, arc]) : CONFIG.duo;
      const seq: Touch[] = steps.map(([q, pose, dur, arc]) => {
        const pl = players[q], t = pl.M.touch[pose]!;
        return { q, pose, dur, arc, x: pl.x + t.x, y: pl.y + t.y - r };   // ball centre, resting on the boot / knee
      });
      for (let k = 0; k < seq.length; k++) {
        const a = seq[k], b = seq[(k + 1) % seq.length];
        const low = Math.min(a.y, b.y);
        const xl = Math.min(a.x, b.x) - r, xr = Math.max(a.x, b.x) + r;
        let apex = low - a.arc * height;
        obstacles.forEach((o) => { if (o.l < xr && o.r > xl && o.b <= low) apex = Math.max(apex, o.b + r); });
        if (low - apex < CONFIG.minArc * height) return null;
        a.apex = apex;
        for (let i = 0; i <= 24; i++) {
          const pt = flight(a, b, i / 24);
          if (!fits({ l: pt.x - r, r: pt.x + r, t: pt.y - r, b: pt.y + r })) return null;
        }
      }
      return { seq, r, total: seq.reduce((sum, s) => sum + s.dur, 0) };
    }

    // Biggest size that fits: both players if there's room, otherwise one alone
    const N = CONFIG.narrow, narrow = W < N.below;
    const H = narrow ? { ...CONFIG.height, perFont: N.perFont, min: N.min, duoMin: N.duoMin } : CONFIG.height;
    const maxH = Math.min(H.max, Math.floor(fs * H.perFont));
    let next: Plan | null = null;
    for (let h = maxH; h >= H.duoMin && !next; h -= H.step) {
      const a = place(0, h), b = a && place(1, h);
      if (!a || !b || !apart(a, b, Math.max(h * CONFIG.ballSize, CONFIG.ballMin) * 2)) continue;   // too close to pass properly
      const rt = route([a, b], h, false);
      if (rt) next = { mode: 'duo', height: h, players: [a, b], ...rt };
    }
    for (let h = maxH; h >= H.min && !next; h -= H.step) {
      for (const p of [0, 1]) {
        const a = place(p, h), rt = a && route([a], h, true);
        if (a && rt) { next = { mode: 'solo', height: h, players: [a], ...rt }; break; }
      }
    }
    if (!next) {
      plan = { mode: 'none' };
      canvas.hidden = true;
      sync();
      return;
    }

    next.rest = restingBall(next, fits);
    // The canvas only covers the players and the ball's flight (plus a little room)
    const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    const add = (b: Box) => { box.l = Math.min(box.l, b.l); box.t = Math.min(box.t, b.t); box.r = Math.max(box.r, b.r); box.b = Math.max(box.b, b.b); };
    const np = next;
    np.players.forEach((pl) => add(pl.box));
    np.seq.forEach((a) => add({ l: a.x - np.r, r: a.x + np.r, t: a.apex! - np.r, b: a.y + np.r }));
    if (np.rest) add({ l: np.rest.x - np.r, r: np.rest.x + np.r, t: np.rest.y - np.r, b: np.rest.y + np.r });
    np.band = {
      l: Math.max(0, Math.floor(box.l) - 3), t: Math.max(0, Math.floor(box.t) - 3),
      r: Math.min(Math.ceil(W), Math.ceil(box.r) + 3), b: Math.ceil(box.b) + 3,
    };
    bake(np);

    plan = np;
    const B = np.band;
    canvas.style.left = B.l + 'px';
    canvas.style.top = B.t + 'px';
    canvas.style.width = (B.r - B.l) + 'px';
    canvas.style.height = (B.b - B.t) + 'px';
    canvas.width = Math.round((B.r - B.l) * dpr);
    canvas.height = Math.round((B.b - B.t) * dpr);
    canvas.hidden = false;
    prevBallX = null;
    draw();
    sync();
  }

  // For the still picture: the ball sits on the letter just in front of
  // the first player's toes — if there's a flat bit there. Otherwise null
  // (the still picture then balances it on the boot instead).
  function restingBall(pl: Plan, fits: (b: Box) => boolean) {
    const a = pl.players[0], r = pl.r, idle = a.M.boxes[POSE.IDLE], L = a.letter;
    const x = a.x + (a.P.facing > 0 ? idle.r + r + 1 : idle.l - r - 1);
    const c0 = Math.round((x - r * 0.6 - L.x0) / L.step), c1 = Math.round((x + r * 0.6 - L.x0) / L.step);
    if (c0 < 0 || c1 >= L.tops.length) return null;
    let hi = Infinity, lo = -Infinity;
    for (let c = c0; c <= c1; c++) { const t = L.tops[c]; if (Number.isNaN(t)) return null; hi = Math.min(hi, t); lo = Math.max(lo, t); }
    if (lo - hi > r * 0.5 || Math.abs(hi - a.y) > r) return null;
    const ball = { x, y: hi - r };
    return fits({ l: x - r, r: x + r, t: ball.y - r, b: ball.y + r }) ? ball : null;
  }

  /* ---------------------------------------------------------
     4. DRAWING
     --------------------------------------------------------- */
  // Each pose is scaled once per layout (nearest-neighbour, so the pixel
  // art stays crisp) onto its own little canvas, with the planted feet on
  // an exact device pixel. Every frame is then a plain 1:1 copy.
  function bake(pl: Plan) {
    const img = sheet!;
    pl.players.forEach((a) => {
      const P = a.P, s = a.M.s * dpr, m = 3;   // device px per sheet px; 3 px margin for soft edges
      a.frames = P.box.map(([l, t, r], f) => {
        const fx = P.feet[f], ge = P.ground[f] + 1;
        const left = Math.ceil((fx - l + m) * s), right = Math.ceil((r + m - fx) * s), up = Math.ceil((ge - t + m) * s);
        const c = document.createElement('canvas');
        c.width = left + right;
        c.height = up;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.drawImage(img, f * CONFIG.cell + fx - left / s, P.row * CONFIG.cell + ge - up / s, c.width / s, up / s, 0, 0, c.width, up);
        return { c, left, up };
      });
    });
    // The ball: a smooth illustration, so it's scaled with smoothing
    const d = Math.max(4, Math.round(pl.r * 2 * dpr));
    const c = document.createElement('canvas');
    c.width = c.height = d;
    const g = c.getContext('2d')!;
    if (ballImg) {
      g.imageSmoothingQuality = 'high';
      g.drawImage(ballImg, 0, 0, d, d);
    } else {                                    // no ball image: a simple white ball
      g.fillStyle = '#f4f4f4';
      g.strokeStyle = '#222';
      g.lineWidth = Math.max(1, d / 10);
      g.beginPath();
      g.arc(d / 2, d / 2, d / 2 - g.lineWidth / 2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    pl.ballCanvas = c;
  }

  // Which pose each player shows, and where the ball is, at time t (seconds)
  function stateAt(pl: Plan, t: number) {
    const { seq, total, players } = pl;
    let local = ((t % total) + total) % total, k = 0;
    while (k < seq.length - 1 && local >= seq[k].dur) local -= seq[k++].dur;
    const from = seq[k], to = seq[(k + 1) % seq.length], u = local / from.dur, at = CONFIG.poseAt;
    const poses = players.map((_, q): Pose => {
      if (q === from.q && u < at.followThrough) return from.pose;   // just touched it
      if (q === from.q && u < at.recover) return POSE.PREP;
      if (q === to.q && u >= at.strike) return to.pose;            // about to touch it
      if (q === to.q && u >= at.prepare) return POSE.PREP;
      if (q === to.q) return POSE.READY;                            // watching it come
      return POSE.IDLE;
    });
    return { poses, ball: flight(from, to, u), from, to };
  }

  // The still picture (reduced motion, before Play): standing, ball at their feet
  function stillState(pl: Plan) {
    const poses = pl.players.map((_, q): Pose => (q === 0 ? POSE.IDLE : POSE.READY));
    if (pl.rest) return { poses, ball: pl.rest, from: null, to: null };
    poses[0] = POSE.FOOT;                       // nowhere flat to put it: balanced on the boot
    const a = pl.players[0], t = a.M.touch[POSE.FOOT]!;
    return { poses, ball: { x: a.x + t.x, y: a.y + t.y - pl.r }, from: null, to: null };
  }

  function draw() {
    const pl = live();
    if (!pl || !pl.band || !pl.ballCanvas) return;
    const B = pl.band;
    const st = time === 0 && !wantsPlay() ? stillState(pl) : stateAt(pl, time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pl.players.forEach((a, q) => {
      const fr = a.frames![st.poses[q]];
      ctx.drawImage(fr.c, Math.round((a.x - B.l) * dpr) - fr.left, Math.round((a.y - B.t) * dpr) - fr.up);
    });
    // The ball spins as it travels (and backspins on the spot when juggled)
    if (prevBallX !== null) spin += (st.ball.x - prevBallX) / pl.r * 0.6;
    prevBallX = st.ball.x;
    const d = pl.ballCanvas.width;
    ctx.translate((st.ball.x - B.l) * dpr, (st.ball.y - B.t) * dpr);
    ctx.rotate(spin + (st.from && st.to && st.from.q === st.to.q ? time * 3 * pl.players[st.from.q].P.facing : 0));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pl.ballCanvas, -d / 2, -d / 2);
  }

  /* ---------------------------------------------------------
     5. THE LOOP + THE PLAY / PAUSE STATE
     Only one loop ever runs; it stops when the footer leaves the
     screen, the tab is hidden, or the visitor pauses.
     --------------------------------------------------------- */
  const shouldRun = () => !!live() && wantsPlay() && inView && !document.hidden && !destroyed;
  function tick(now: number) {
    raf = 0;
    if (!shouldRun()) return;
    if (last) time += Math.min(0.05, (now - last) / 1000);   // a long gap never jumps ahead
    last = now;
    draw();
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    if (shouldRun()) {
      if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    // When paused the canvas keeps its last frame; the still picture is drawn by draw()
    onState({ show: !!live(), playing: wantsPlay() });
  }

  // For testing only: add ?football-debug to the address
  if (/[?&]football-debug\b/.test(location.search)) {
    (window as unknown as { __football: unknown }).__football = {
      get plan() { return plan; },
      get time() { return time; },
      set time(v: number) { time = v; prevBallX = null; draw(); },
      get running() { return !!raf; },
      get choice() { return choice; },
      config: CONFIG,
    };
  }

  return {
    /** the Play / Pause button: the choice is kept while scrolling away and back */
    toggle() {
      choice = wantsPlay() ? 'pause' : 'play';
      sync();
    },
    /** the wordmark was re-fitted: measure the letters again */
    relayout: scheduleLayout,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    },
  };
}
