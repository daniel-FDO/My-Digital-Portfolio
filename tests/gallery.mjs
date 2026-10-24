/* node tests/gallery.mjs [url]     (default http://localhost:5173/)
   The Gallery (Gallery.tsx, gallery/isophote.ts, gallery/Preview.tsx) in headless Microsoft Edge on
   the GPU, at 1440 / 768 / 390 px. The plate shows one photo (the hero) on paper, its neighbours as
   contour maps (ghosts); changing photo is a tide (the photo washes off into its map, the next one
   develops up through it). Checked: the plate goes live; autoplay rests (nothing drawn), then a
   crest, then a tide that advances the photo; a click on the hero opens that photo, a click on a
   ghost goes to it without opening; Next wraps across the loop's seam; rapid presses queue (≤ 3)
   and land where they should; drags scrub and commit across the seam with a photo always there;
   the preview's controls (mouse, keyboard, touch), focus trap, inert page, scroll lock without a
   width change, and exact restore (scroll, plate, focus, paused state), also when opened mid-tide;
   touch swipes on the plate vs vertical page scrolling; reduced motion (plain fades); the
   WebGL-failure fallback; both themes (tide order); no horizontal overflow; no console errors.
   Uses the engine's own ?gallery-debug hook. Results: console + review/gallery/gallery.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:5173/';
const URL = BASE + '?gallery-debug';
const out = path.join(root, 'review', 'gallery');
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ignorable = (t) => /api\/|Failed to load resource/.test(t);   // the Spotify / GitHub endpoints have no keys locally
const N = 11;
const mod = (a, n = N) => ((a % n) + n) % n;

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function open(opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('gallery').scrollIntoView({ block: 'center' }));
  return { ctx, page, errors };
}
const G = (page, expr, arg) => page.evaluate(expr, arg);
/** the hook's state in one read */
const S = (page) => G(page, () => { const g = window.__gallery; return { index: g.index, from: g.from, to: g.to, t: g.t, phase: g.phase, pos: g.pos, running: g.running, playing: g.playing, queue: g.queue, dwell: g.dwell, order: g.order }; });
/** wait until no transition is under way (phase rest, t 0) */
const atRest = (page, timeout = 6000) => page.waitForFunction(() => window.__gallery.phase === 'rest' && window.__gallery.t === 0, null, { timeout, polling: 20 }).then(() => true, () => false);
/** sample the hook in the page every ~10 ms until `stop` (a JS expression over g, seq) holds or `ms` pass:
    the phases visited (in order), the largest |queue| seen */
const trace = (page, ms, stop = 'false') => page.evaluate(({ ms, stop }) => new Promise((res) => {
  const g = window.__gallery, seq = [], t0 = performance.now(); let maxQ = 0;
  const f = new Function('g', 'seq', 'return (' + stop + ');');
  const tick = () => {
    if (seq[seq.length - 1] !== g.phase) seq.push(g.phase);
    maxQ = Math.max(maxQ, Math.abs(g.queue));
    if (f(g, seq) || performance.now() - t0 > ms) { clearInterval(iv); res({ seq, maxQ, ms: Math.round(performance.now() - t0), index: g.index, pos: g.pos, phase: g.phase, t: g.t }); }
  };
  const iv = setInterval(tick, 10); tick();
}), { ms, stop });
/** focus the plate and make sure it has it (focus() can land before the plate is focusable) */
async function focusPlate(page) {
  for (let i = 0; i < 30; i++) {
    await page.locator('.gal__plate').focus().catch(() => {});
    if (await G(page, () => !!document.activeElement?.classList.contains('gal__plate'))) return true;
    await sleep(100);
  }
  return false;
}
/** Enter on the focused plate, until the preview is open (or give up) */
async function enterPlate(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await focusPlate(page))) continue;
    await page.keyboard.press('Enter');
    if (await page.waitForSelector('.gpv.is-in', { timeout: 2000 }).then(() => true, () => false)) return true;
  }
  return false;
}
async function closePreview(page) {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.gpv', { state: 'detached', timeout: 2000 }).catch(() => {});
  await sleep(150);
}
const previewPhoto = async (page) => {
  const label = await page.locator('.gpv').getAttribute('aria-label', { timeout: 1000 }).catch(() => null);
  return label ? Number(label.match(/Photo (\d+)/)[1]) - 1 : -1;
};
/** the hero's middle row, read back through a screenshot (the WebGL buffer isn't preserved):
    the luminance's spread (a photo is there, not flat paper or a hole) */
async function heroRow(page) {
  const png = (await page.locator('.gal__canvas').screenshot()).toString('base64');
  return page.evaluate(async (png) => {
    const r = window.__gallery.heroRect(), cw = document.querySelector('.gal__canvas').clientWidth;
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const s = img.width / cw;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const y = Math.round((r.y + r.h / 2) * s), x0 = Math.round((r.x + 12) * s), x1 = Math.round((r.x + r.w - 12) * s);
    const row = g.getImageData(x0, y, Math.max(1, x1 - x0), 1).data;
    let sum = 0, sq = 0, k = 0;
    for (let i = 0; i < row.length; i += 4) { const l = 0.2126 * row[i] + 0.7152 * row[i + 1] + 0.0722 * row[i + 2]; sum += l; sq += l * l; k++; }
    const mean = sum / k;
    return { std: Math.sqrt(Math.max(0, sq / k - mean * mean)), mean };
  }, png);
}
/** the hero's centre, in page coordinates */
async function heroCentre(page) {
  const box = await page.locator('.gal__canvas').boundingBox();
  const r = await G(page, () => window.__gallery.heroRect());
  return { x: box.x + r.x + r.w / 2, y: box.y + r.y + r.h / 2, r, box };
}

try {
  for (const [w, h, touch] of [[1440, 900, false], [768, 1024, true], [390, 844, true]]) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const ok = await page.waitForSelector('.gal__stage.is-live', { timeout: 15000 }).then(() => true, () => false);
    check(`${w}: plate live`, ok);

    // autoplay: rest (a timer) → crest → tide; the photo advances; nothing draws once it rests again
    const a0 = await S(page);
    const tr = await trace(page, 9500, "seq.includes('tide') && g.phase === 'rest'");
    const ci = tr.seq.indexOf('crest'), ti = tr.seq.indexOf('tide');
    check(`${w}: autoplay advances (rest → crest → tide)`, tr.index === mod(a0.index + 1) && tr.pos > a0.pos && ci >= 0 && ti > ci && tr.phase === 'rest',
      `index ${a0.index} → ${tr.index}, pos ${a0.pos.toFixed(2)} → ${tr.pos.toFixed(2)}, phases ${tr.seq.join(' → ')} (${tr.ms} ms)`);
    const idle = await page.waitForFunction(() => !window.__gallery.running, null, { timeout: 1000, polling: 'raf' }).then(() => true, () => false);
    check(`${w}: nothing draws at rest (frames stop within 1 s of the tide ending)`, idle && (await G(page, () => window.__gallery.phase)) === 'rest');

    // pause, so the photo stays put for the clicks
    await page.getByRole('button', { name: 'Pause the slideshow' }).click();
    await atRest(page);
    await page.waitForFunction(() => window.__gallery.mapsReady >= window.__gallery.count, null, { timeout: 10000 }).catch(() => {});
    const o = await G(page, () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check(`${w}: no horizontal overflow`, o.sw <= o.cw, `${o.sw} / ${o.cw}`);
    await page.locator('#gallery').screenshot({ path: path.join(out, `gallery-${w}.png`) });

    // (a) a click on the hero opens that photo
    {
      const c = await heroCentre(page), i = await G(page, () => window.__gallery.index);
      await page.mouse.click(c.x, c.y);
      await page.waitForSelector('.gpv', { timeout: 2000 }).catch(() => {});
      const got = await previewPhoto(page);
      check(`${w}: clicking the photo opens that photo`, got === i, `expected ${i + 1}, got ${got + 1}`);
      await closePreview(page);
    }
    // (b) a click on each neighbour's map goes there (no preview)
    {
      const n0 = (await G(page, () => window.__gallery.ghostRects())).length;
      const box = await page.locator('.gal__canvas').boundingBox();
      const wrong = [];
      for (let j = 0; j < n0; j++) {
        await atRest(page);
        const gs = await G(page, () => window.__gallery.ghostRects());
        const gr = gs[j];
        if (!gr) { wrong.push(`ghost ${j} missing`); continue; }
        const x0 = Math.max(0, gr.x), x1 = Math.min(box.width, gr.x + gr.w), x = (x0 + x1) / 2, y = gr.y + gr.h / 2;
        const pk = await G(page, ([x, y]) => window.__gallery.pickAt(x, y), [x, y]);
        await page.mouse.click(box.x + x, box.y + y);
        await sleep(250);
        const pv = await page.locator('.gpv').count();
        if (pv) await closePreview(page);
        const rested = await atRest(page, 5000);
        const s = await S(page);
        if (pk.kind !== 'ghost' || pv || !rested || s.index !== gr.photo) wrong.push(`offset ${gr.offset}: pick ${pk.kind}, preview ${pv}, rest ${rested}, index ${s.index} (expected ${gr.photo})`);
      }
      check(`${w}: clicking each neighbour's map goes to it without opening the preview (${n0} ghosts)`, n0 >= 2 && wrong.length === 0, wrong.join('; '));
    }
    // (c) Next ×11 comes back round (across the loop's seam), and the hero then opens that photo
    {
      await page.mouse.move(2, 2);
      const s0 = await S(page);
      const seen = [];
      for (let k = 0; k < N; k++) {
        await page.getByRole('button', { name: 'Next photo' }).click();
        await atRest(page, 4000);
        seen.push(await G(page, () => window.__gallery.index));
      }
      const s1 = await S(page);
      check(`${w}: Next ×11 visits every photo and wraps back to the start`, s1.index === s0.index && Math.abs(s1.pos - (s0.pos + N)) < 1e-6 && new Set(seen).size === N,
        `index ${s0.index} → ${seen.join(',')}; pos ${s0.pos} → ${s1.pos}`);
      const c = await heroCentre(page);
      await page.mouse.click(c.x, c.y);
      await page.waitForSelector('.gpv', { timeout: 2000 }).catch(() => {});
      const got = await previewPhoto(page);
      check(`${w}: after wrapping, the photo opens as itself`, got === s1.index, `expected ${s1.index + 1}, got ${got + 1}`);
      await closePreview(page);
    }
    // rapid Next ×6: at most 3 wait; lands on start + 6
    {
      await atRest(page);
      const s0 = await S(page);
      const nb = await page.getByRole('button', { name: 'Next photo' }).boundingBox();
      // the index right after each press (read in the page, after React's handler, so the presses stay quick)
      await G(page, () => { window.__presses = []; document.addEventListener('click', (e) => { if (e.target.closest?.('[aria-label="Next photo"]')) window.__presses.push(window.__gallery.index); }); });
      const tracing = trace(page, 9000, "g.phase === 'rest' && seq.length > 1");
      const t0 = Date.now();
      for (let k = 0; k < 6; k++) await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
      const spent = Date.now() - t0;
      const tr2 = await tracing;
      const idx = await G(page, () => window.__presses);
      await atRest(page);
      const s1 = await S(page);
      check(`${w}: rapid Next ×6 (${spent} ms): |queue| never above 3`, tr2.maxQ <= 3, `max |queue| ${tr2.maxQ}; index after each press ${idx.join(',')}`);
      check(`${w}: rapid Next ×6 lands on start + 6`, s1.index === mod(s0.index + 6) && Math.abs(s1.pos - (s0.pos + 6)) < 1e-6 && idx[5] === mod(s0.index + 6),
        `index ${s0.index} → ${s1.index} (expected ${mod(s0.index + 6)}); pos ${s0.pos} → ${s1.pos}; phases ${tr2.seq.join(' → ')}`);
    }

    // a drag never opens the preview
    const { x: cx, y: cy, r: hero } = await heroCentre(page);
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 90, cy, { steps: 8 }); await page.mouse.up();
    await sleep(300);
    check(`${w}: releasing a drag doesn't open the preview`, (await page.locator('.gpv').count()) === 0);
    await atRest(page);

    // dragging across the loop's seam: each drag commits one photo, and a photo is always there
    {
      const s0 = await S(page);
      const span = 0.6 * 0.9 * hero.w;     // t ≈ 0.6 of one tide: past the commit threshold, short of a second photo
      let lowest = Infinity; const bad = [];
      for (let i = 0; i < 14; i++) {
        await page.mouse.move(cx + span / 2, cy); await page.mouse.down(); await page.mouse.move(cx - span / 2, cy, { steps: 6 }); await page.mouse.up();
        const rested = await atRest(page, 4000);
        await page.mouse.move(2, 2);
        const row = await heroRow(page);
        lowest = Math.min(lowest, row.std);
        const s = await S(page);
        if (!rested || s.index !== mod(s0.index + i + 1)) bad.push(`drag ${i + 1}: rest ${rested}, index ${s.index}`);
      }
      const s1 = await S(page);
      check(`${w}: 14 drags across the seam each commit one photo`, bad.length === 0 && s1.index === mod(s0.index + 14) && Math.abs(s1.pos - (s0.pos + 14)) < 1e-6,
        `index ${s0.index} → ${s1.index} (expected ${mod(s0.index + 14)}), pos ${s0.pos} → ${s1.pos}${bad.length ? '; ' + bad.join('; ') : ''}`);
      check(`${w}: wrapping leaves no holes (a photo after every drag; lowest middle-row spread ${lowest.toFixed(1)})`, lowest > 8);
    }

    if (w === 1440) {
      // ---- the preview, in detail ----
      await page.evaluate(() => scrollBy(0, 37));            // an arbitrary scroll position to come back to
      await atRest(page);
      for (let t = 0; t < 60 && (await G(page, () => window.__gallery.running)); t++) await sleep(100);
      const before = await G(page, () => ({ y: scrollY, cw: document.documentElement.clientWidth, pos: window.__gallery.pos, index: window.__gallery.index }));
      const mid = await heroCentre(page);
      await page.mouse.click(mid.x, mid.y);
      await page.waitForSelector('.gpv.is-in');
      await sleep(300);
      const st = await G(page, () => {
        const d = document.querySelector('.gpv'), img = d.querySelector('.gpv__img'), v = getComputedStyle(d.querySelector('.gpv__veil'));
        return {
          inBody: d.parentElement === document.body, rootInert: document.getElementById('root').inert,
          overflow: getComputedStyle(document.documentElement).overflow, cw: document.documentElement.clientWidth,
          focus: document.activeElement?.getAttribute('aria-label'), blur: v.backdropFilter || v.webkitBackdropFilter,
          imgFilter: getComputedStyle(img).filter, dlgFilter: getComputedStyle(d).filter,
          fit: getComputedStyle(img).objectFit, nat: [img.naturalWidth, img.naturalHeight], shown: [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)],
          modal: d.getAttribute('aria-modal'),
        };
      });
      check('preview: portalled into <body>, page inert, scroll locked without a width change', st.inBody && st.rootInert && st.overflow === 'hidden' && st.cw === before.cw, JSON.stringify({ cw: [before.cw, st.cw] }));
      check('preview: one backdrop blur behind; the photo itself unblurred', /blur/.test(st.blur) && st.imgFilter === 'none' && st.dlgFilter === 'none', st.blur);
      check('preview: complete photo, never upscaled past its pixels', st.fit === 'contain' && st.shown[0] <= st.nat[0] && st.shown[1] <= st.nat[1], `natural ${st.nat.join('×')}, shown ${st.shown.join('×')}`);
      // every photo, large and small, fits inside the viewport whole (and isn't enlarged)
      const fits = [];
      for (let k = 0; k < 11; k++) {
        await sleep(260);
        fits.push(await G(page, () => { const im = document.querySelector('.gpv__img'), r = im.getBoundingClientRect(); return im.complete && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth && r.width <= im.naturalWidth + 0.5 && Math.abs(r.width / r.height - im.naturalWidth / im.naturalHeight) < 0.02; }));
        await page.keyboard.press('ArrowRight');
      }
      check('preview: all 11 photos fit the viewport whole, in proportion, never enlarged', fits.every(Boolean), fits.map((f) => (f ? '✓' : '✗')).join(''));
      check('preview: focus moves in (Close)', st.focus === 'Close preview' && st.modal === 'true');
      await page.screenshot({ path: path.join(out, 'preview-1440.png') });
      // focus trap
      const seen = new Set();
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); seen.add(await G(page, () => document.activeElement?.closest('.gpv') ? document.activeElement.getAttribute('aria-label') : 'OUTSIDE')); }
      check('preview: Tab stays inside', !seen.has('OUTSIDE') && seen.size === 3, [...seen].join(', '));
      // keyboard / buttons / counter
      const lab = () => page.locator('.gpv').getAttribute('aria-label');
      const l0 = await lab(); await page.keyboard.press('ArrowRight'); const l1 = await lab(); await page.keyboard.press('ArrowLeft'); const l2 = await lab();
      await page.getByRole('button', { name: 'Next photo' }).last().click(); const l3 = await lab();
      await page.getByRole('button', { name: 'Previous photo' }).last().click(); const l4 = await lab();
      const count = await page.locator('.gpv__count').innerText();
      check('preview: ← → and Previous / Next move through the photos; counter shown', l1 !== l0 && l2 === l0 && l3 !== l0 && l4 === l0 && /\d+\s*\/\s*11/.test(count), `${l0} → ${l1} → ${l2}; ${l3} → ${l4}; counter "${count}"`);
      // Escape → everything restored
      await page.keyboard.press('Escape');
      await page.waitForSelector('.gpv', { state: 'detached' });
      await sleep(250);
      const after = await G(page, () => ({ y: scrollY, pos: window.__gallery.pos, index: window.__gallery.index, phase: window.__gallery.phase, inert: document.getElementById('root').inert, overflow: document.documentElement.style.overflow, focus: document.activeElement?.className }));
      check('close: same scroll position, same photo on the plate, page usable again', after.y === before.y && Math.abs(after.pos - before.pos) < 1e-6 && after.index === before.index && !after.inert && after.overflow === '', JSON.stringify({ y: [before.y, after.y], pos: [before.pos, after.pos], index: [before.index, after.index] }));
      check('close: focus back on the plate it came from', /gal__plate/.test(after.focus || ''), after.focus);
      check('close: the paused gallery stays paused', await page.getByRole('button', { name: 'Play the slideshow' }).isVisible());
      await sleep(2600);
      const still = await S(page);
      check('close: no change after closing while paused', Math.abs(still.pos - before.pos) < 1e-6 && still.phase === 'rest' && after.phase === 'rest', `pos ${before.pos} → ${still.pos}, phase ${after.phase} → ${still.phase}`);
      // backdrop click closes; Enter on the focused plate opens the photo shown
      const entered = await enterPlate(page);
      check('keyboard: Enter on the plate opens the photo shown', entered && (await lab()) === `Photo ${(await G(page, () => window.__gallery.index)) + 1} of 11`);
      await page.mouse.click(200, 30);                    // empty backdrop (the controls sit at the sides)
      await page.waitForSelector('.gpv', { state: 'detached', timeout: 2000 }).catch(() => {});
      check('backdrop click closes', (await page.locator('.gpv').count()) === 0);
      // the preview opened mid-tide: the photo under the pointer opens, and the plate settles on it
      {
        await atRest(page);
        await page.getByRole('button', { name: 'Next photo' }).click();
        await page.waitForFunction(() => window.__gallery.phase === 'tide' && window.__gallery.t >= 0.45, null, { timeout: 3000, polling: 'raf' }).catch(() => {});
        const s = await S(page);
        const c = await heroCentre(page);
        await page.mouse.click(c.x, c.y);
        await page.waitForSelector('.gpv.is-in', { timeout: 2000 }).catch(() => {});
        const got = await previewPhoto(page);
        await closePreview(page);
        await sleep(200);
        const e = await S(page);
        check('preview opened mid-tide: the photo under the pointer opens, and the plate rests on it after closing',
          got >= 0 && (got === s.from || got === s.to) && e.phase === 'rest' && e.t === 0 && e.index === got,
          `clicked at t=${s.t.toFixed(2)} (${s.from} → ${s.to}); opened ${got}; after: phase ${e.phase}, t ${e.t}, index ${e.index}`);
      }
      // a mouse click inside the gallery (here: Play) does NOT hold autoplay; keyboard focus does
      await page.getByRole('button', { name: 'Play the slideshow' }).click();
      await page.mouse.move(5, 5);
      const c0 = await S(page);
      const ran = await page.waitForFunction((i) => window.__gallery.index !== i, c0.index, { timeout: 9000 }).then(() => true, () => false);
      check('a mouse click on Play leaves autoplay running (only keyboard focus holds it)', ran, `index ${c0.index} → ${(await S(page)).index}`);
      await page.waitForFunction(() => window.__gallery.phase === 'rest', null, { timeout: 5000 });
      // keyboard focus: Shift+Tab back from the buttons onto the plate (a real keyboard focus, :focus-visible)
      let focused = false;
      for (let k = 0; k < 5 && !focused; k++) {
        await page.keyboard.press('Shift+Tab');
        focused = await page.evaluate(() => document.activeElement?.classList.contains('gal__plate') && document.activeElement.matches(':focus-visible'));
      }
      const f0 = await S(page);
      const tf = await page.evaluate(() => new Promise((res) => {
        const g = window.__gallery, phases = new Set(); let d0 = g.dwell, up = 0;
        const iv = setInterval(() => { phases.add(g.phase); if (g.dwell > d0 + 1e-6) up++; d0 = Math.min(d0, g.dwell); }, 50);
        setTimeout(() => { clearInterval(iv); res({ phases: [...phases], up, dwell: g.dwell }); }, 6000);
      }));
      check('keyboard focus on the plate holds autoplay (6 s at rest, dwell not advancing)', focused && f0.playing && tf.phases.length === 1 && tf.phases[0] === 'rest' && tf.up === 0,
        `playing ${f0.playing}, phases ${tf.phases.join(',')}, dwell ${f0.dwell.toFixed(3)} → ${tf.dwell.toFixed(3)}`);
      await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
      await page.getByRole('button', { name: 'Pause the slideshow' }).click();
      await atRest(page);
      // themes: light develops shadows first (order 0), dark highlights first (order 1)
      const orders = [];
      for (const t of ['light', 'dark']) {
        await G(page, (t) => { document.documentElement.dataset.theme = t; }, t);
        await sleep(500);
        orders.push(`${t}: ${await G(page, () => window.__gallery.order)}`);
        await page.locator('#gallery').screenshot({ path: path.join(out, `gallery-1440-${t}.png`) });
        await page.getByRole('button', { name: 'Next photo' }).click();
        await sleep(700);
        await page.locator('#gallery').screenshot({ path: path.join(out, `gallery-1440-${t}-tide.png`) });
        await atRest(page);
      }
      check('themes: tide order 0 on light, 1 on dark', orders.join(', ') === 'light: 0, dark: 1', orders.join(', '));
      // neighbouring sections and section links still work
      const secs = await G(page, () => ['projects', 'gallery', 'skills'].map((id) => !!document.getElementById(id)));
      await page.evaluate(() => { location.hash = '#gallery'; });
      await sleep(400);
      check('adjacent sections present; #gallery anchor intact', secs.every(Boolean) && (await G(page, () => Math.abs(document.getElementById('gallery').getBoundingClientRect().top) < 120)));
    }

    if (w === 390) {
      // touch: a horizontal swipe runs the tide to the next photo; a vertical swipe scrolls the page
      const cdp = await ctx.newCDPSession(page);
      const tb = await page.locator('.gal__canvas').boundingBox();
      const swipe = async (x0, y0, x1, y1) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
        for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y: y0 + ((y1 - y0) * i) / 10 }] }); await sleep(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      await atRest(page);
      const a = await S(page);
      await swipe(tb.x + tb.width * 0.75, tb.y + tb.height / 2, tb.x + tb.width * 0.25, tb.y + tb.height / 2);
      await sleep(900);
      const b = await S(page);
      check('390 touch: a horizontal swipe changes the photo', b.index === mod(a.index + 1) || Math.abs(b.pos - a.pos) >= 0.3, `index ${a.index} → ${b.index}, pos ${a.pos.toFixed(2)} → ${b.pos.toFixed(2)}, ${b.phase}`);
      check('390 touch: a swipe doesn\'t open the preview', (await page.locator('.gpv').count()) === 0);
      await atRest(page);
      const y0 = await G(page, () => scrollY);
      await swipe(tb.x + tb.width / 2, tb.y + tb.height * 0.8, tb.x + tb.width / 2, tb.y + tb.height * 0.1);
      await sleep(700);
      check('390 touch: a vertical swipe over the plate scrolls the page', (await G(page, () => scrollY)) > y0 + 40, `scrollY ${y0} → ${await G(page, () => scrollY)}`);
      // tap opens; preview controls fit inside the screen; swipe in the preview changes photo
      await page.evaluate(() => document.getElementById('gallery').scrollIntoView({ block: 'center' }));
      await sleep(500);
      const t2 = await page.locator('.gal__canvas').boundingBox();
      await page.touchscreen.tap(t2.x + t2.width / 2, t2.y + t2.height / 2);
      await page.waitForSelector('.gpv.is-in', { timeout: 2000 }).catch(() => {});
      check('390 touch: tapping the photo opens the preview', (await page.locator('.gpv').count()) === 1);
      await sleep(300);
      const ctrls = await G(page, () => [...document.querySelectorAll('.gpv__btn')].map((b) => { const r = b.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }));
      check('390: preview controls inside the screen, ≥ 44 px', ctrls.every((c) => c.l >= 0 && c.t >= 0 && c.r <= 390 && c.b <= 844 && c.w >= 44 && c.h >= 44));
      await page.screenshot({ path: path.join(out, 'preview-390.png') });
      const pl = () => page.locator('.gpv').getAttribute('aria-label');
      const before = await pl();
      await swipe(320, 420, 80, 430);
      await sleep(300);
      check('390 touch: swiping in the preview changes photo (and doesn\'t close it)', (await page.locator('.gpv').count()) === 1 && (await pl()) !== before, `${before} → ${await pl()}`);
      await page.getByRole('button', { name: 'Close preview' }).tap();
      await page.waitForSelector('.gpv', { state: 'detached', timeout: 2000 }).catch(() => {});
      check('390 touch: Close works', (await page.locator('.gpv').count()) === 0);
    }
    check(`${w}: no console errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- reduced motion: no autoplay, plain fades instead of tides, no inertia; preview without scaling ----
  {
    const { ctx, page, errors } = await open({ reducedMotion: 'reduce' });
    await page.waitForSelector('.gal__stage.is-live', { timeout: 15000 });
    await sleep(1200);
    const a = await G(page, () => window.__gallery.pos); await sleep(1500); const b = await G(page, () => window.__gallery.pos);
    check('reduced motion: no automatic movement', a === b && await page.getByRole('button', { name: 'Play the slideshow' }).isVisible());
    const { x: cx, y: cy } = await heroCentre(page);
    const s0 = await S(page);
    await page.mouse.move(cx + 150, cy); await page.mouse.down(); await page.mouse.move(cx - 150, cy, { steps: 3 }); await page.mouse.up();
    await sleep(400);
    const c1 = await S(page); await sleep(500); const c2 = await S(page);
    check('reduced motion: dragging still works, without inertia (one photo, then still)', c1.index === mod(s0.index + 1) && Number.isInteger(c1.pos) && c1.phase === 'rest' && c1.pos === c2.pos && c1.pos === s0.pos + 1,
      `index ${s0.index} → ${c1.index}; pos ${s0.pos} → ${c1.pos} → ${c2.pos}; ${c1.phase}`);
    // Next: a 240 ms fade, never a tide
    const tracing = trace(page, 2000, "seq.includes('fade') && g.phase === 'rest'");
    await page.getByRole('button', { name: 'Next photo' }).click();
    const tr = await tracing;
    check('reduced motion: Next is a short plain fade (no tide)', tr.seq.includes('fade') && !tr.seq.includes('tide') && !tr.seq.includes('crest') && tr.phase === 'rest' && tr.index === mod(s0.index + 2),
      `phases ${tr.seq.join(' → ')} in ${tr.ms} ms; index ${tr.index}`);
    const entered = await enterPlate(page);
    const tf = entered ? await G(page, () => getComputedStyle(document.querySelector('.gpv__img')).transform) : 'no preview';
    check('reduced motion: the preview opens without scaling', tf === 'none', tf);
    check('reduced motion: no console errors', errors.length === 0, errors.join(' | '));
    await page.keyboard.press('Escape');
    await ctx.close();
  }

  // ---- WebGL unavailable: the plain gallery ----
  {
    const { ctx, page, errors } = await open({}, () => {
      const o = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, ...r) { return t === 'webgl2' ? null : o.call(this, t, ...r); };
    });
    await sleep(1500);
    const st = await G(page, () => ({ cls: document.querySelector('.gal__stage').className, strip: getComputedStyle(document.querySelector('.gal__strip')).position, items: document.querySelectorAll('.gal__open').length, canvas: document.querySelectorAll('.gal__canvas').length }));
    check('no WebGL: the plain strip shows every photo', /is-fallback/.test(st.cls) && st.strip !== 'absolute' && st.items === 11 && st.canvas === 0, JSON.stringify(st));
    await page.locator('#gallery').screenshot({ path: path.join(out, 'fallback-1440.png') });
    const s0 = await G(page, () => document.querySelector('.gal__strip').scrollLeft);
    await page.getByRole('button', { name: 'Next photo' }).click(); await sleep(600);
    check('no WebGL: Next scrolls the strip', (await G(page, () => document.querySelector('.gal__strip').scrollLeft)) > s0);
    await page.locator('.gal__open').nth(2).click();
    await page.waitForSelector('.gpv');
    check('no WebGL: clicking a photo opens its preview', (await page.locator('.gpv').getAttribute('aria-label')) === 'Photo 3 of 11');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gpv', { state: 'detached' });
    check('no WebGL: focus returns to the photo button', await G(page, () => document.activeElement?.classList.contains('gal__open')));
    check('no WebGL: no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- no backdrop-filter: a dim translucent layer instead ----
  {
    const { ctx, page } = await open();
    await page.addStyleTag({ content: '.gpv__veil{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
    await page.waitForSelector('.gal__stage.is-live', { timeout: 15000 });
    // (the plate only takes focus once it's live and visible: focus it until it has it, then Enter)
    const entered = await enterPlate(page);
    await sleep(300);
    const bg = entered ? await G(page, () => getComputedStyle(document.querySelector('.gpv__veil')).backgroundColor) : 'no preview';
    check('veil is a dimmed translucent layer on its own (fallback when blur is unsupported)', /rgba\(8, 8, 8, 0\.(6|8)/.test(bg), bg);
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'gallery.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} gallery checks passed`);
  process.exitCode = failed ? 1 : 0;
}
