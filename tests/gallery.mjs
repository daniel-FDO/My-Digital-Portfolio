/* node tests/gallery.mjs [url]     (default http://localhost:5173/)
   The Gallery (Gallery.tsx, gallery/ribbon.ts, gallery/Preview.tsx) in headless Microsoft Edge on
   the GPU, at 1440 / 768 / 390 px: the ribbon goes live; wrapping never leaves a hole; drift goes
   left → right; clicks open the photo actually under the pointer (loop copies included), drags
   never do; the preview's controls (mouse, keyboard, touch), focus trap, inert page, scroll lock
   without a width change, and exact restore (scroll, ribbon position, focus, paused state);
   touch swipes on the ribbon vs vertical page scrolling; reduced motion; the WebGL-failure
   fallback; both themes; no horizontal overflow; no console errors.
   Uses the ribbon's own ?gallery-debug hook. Results: console + review/gallery/gallery.json */
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
const G = (page, expr) => page.evaluate(expr);
// the canvas's pixels, read back through a screenshot (the WebGL buffer isn't preserved)
async function band(page, yFrac = 0.5) {
  const c = page.locator('.gal__canvas');
  const png = (await c.screenshot({ omitBackground: false })).toString('base64');
  return page.evaluate(async ({ png, yFrac }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const y = Math.round(img.height * yFrac), row = g.getImageData(0, y, img.width, 1).data;
    // the page background under the ribbon is near-black: count long runs of it in the middle 60%
    const lum = (i) => 0.3 * row[i] + 0.59 * row[i + 1] + 0.11 * row[i + 2];
    let run = 0, worst = 0;
    for (let x = Math.round(img.width * 0.2); x < img.width * 0.8; x++) { if (lum(x * 4) < 34) { run++; worst = Math.max(worst, run); } else run = 0; }
    return { worst, w: img.width };
  }, { png, yFrac });
}

try {
  for (const [w, h, touch] of [[1440, 900, false], [768, 1024, true], [390, 844, true]]) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const ok = await page.waitForSelector('.gal__stage.is-live', { timeout: 15000 }).then(() => true, () => false);
    check(`${w}: ribbon live`, ok);
    await sleep(2500);
    const o = await G(page, () => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check(`${w}: no horizontal overflow`, o.sw <= o.cw, `${o.sw} / ${o.cw}`);
    await page.locator('#gallery').screenshot({ path: path.join(out, `gallery-${w}.png`) });
    // drift: left → right (photos enter on the left)
    const p0 = await G(page, () => window.__gallery.pos); await sleep(1200); const p1 = await G(page, () => window.__gallery.pos);
    check(`${w}: drifts left → right`, p1 < p0, `pos ${p0.toFixed(3)} → ${p1.toFixed(3)}`);

    // pause, so positions are stable for picking
    await page.getByRole('button', { name: 'Pause the moving gallery' }).click();
    await sleep(300);
    // every visible photo (incl. one beyond the loop seam) opens the right preview
    const box = await page.locator('.gal__canvas').boundingBox();
    let picked = 0, wrong = [];
    for (let rounds = 0; rounds < 2; rounds++) {
      const slots = await G(page, () => Array.from({ length: window.__gallery.count }, (_, k) => window.__gallery.centreOf(k)).map((c, k) => c && { ...c, k }).filter((c) => c && c.fade > 0.6));
      for (const s of slots) {
        await page.mouse.click(box.x + s.x, box.y + s.y);
        await page.waitForSelector('.gpv', { timeout: 2000 }).catch(() => {});
        const label = await page.locator('.gpv').getAttribute('aria-label').catch(() => null);
        const got = label ? Number(label.match(/Photo (\d+)/)[1]) - 1 : -1;
        picked++;
        if (got !== s.photo) wrong.push(`slot ${s.k}: expected ${s.photo + 1}, got ${got + 1}`);
        await page.keyboard.press('Escape'); await page.waitForSelector('.gpv', { state: 'detached', timeout: 2000 }).catch(() => {});
        await sleep(150);
      }
      // move across the loop's seam (well past photo 11 → 1) and try again
      for (let i = 0; i < 6; i++) { await page.getByRole('button', { name: 'Next photo' }).click(); await sleep(260); }
      await sleep(400);
    }
    check(`${w}: clicking each visible photo opens that photo (${picked} clicks, across the loop seam)`, wrong.length === 0 && picked >= (w < 500 ? 2 : 4), wrong.join('; '));

    // a drag never opens it
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 90, cy, { steps: 8 }); await page.mouse.up();
    await sleep(300);
    check(`${w}: releasing a drag doesn't open the preview`, (await page.locator('.gpv').count()) === 0);

    // seamless wrapping: drag across more than a whole loop; the middle never shows a hole
    let worst = 0;
    for (let i = 0; i < 14; i++) {
      await page.mouse.move(cx + 200, cy); await page.mouse.down(); await page.mouse.move(cx - 200, cy, { steps: 6 }); await page.mouse.up();
      const b = await band(page); worst = Math.max(worst, b.worst);
    }
    const gapPx = await G(page, () => document.querySelector('.gal__canvas').getBoundingClientRect().width);
    // (dark photo content and the perspective-widened gaps near the sides count too; a missing photo
    // would leave a hole of a whole photo's width, well over 5% of the strip)
    check(`${w}: wrapping across the loop leaves no holes (widest dark run in the middle ${worst}px)`, worst < Math.max(24, gapPx * 0.05));

    if (w === 1440) {
      // ---- the preview, in detail ----
      await page.evaluate(() => scrollBy(0, 37));            // an arbitrary scroll position to come back to
      for (let t = 0; t < 60 && (await G(page, () => window.__gallery.running)); t++) await sleep(100);   // the last flick has stopped
      const before = await G(page, () => ({ y: scrollY, cw: document.documentElement.clientWidth, pos: window.__gallery.pos }));
      const mid = await G(page, () => { const g = window.__gallery; let best = null; for (let k = 0; k < g.count; k++) { const c = g.centreOf(k); if (c && (!best || Math.abs(c.x - document.querySelector('.gal__canvas').clientWidth / 2) < Math.abs(best.x - document.querySelector('.gal__canvas').clientWidth / 2))) best = c; } return best; });
      const b2 = await page.locator('.gal__canvas').boundingBox();
      await page.mouse.click(b2.x + mid.x, b2.y + mid.y);
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
      const after = await G(page, () => ({ y: scrollY, pos: window.__gallery.pos, inert: document.getElementById('root').inert, overflow: document.documentElement.style.overflow, focus: document.activeElement?.className }));
      check('close: same scroll position, same ribbon position, page usable again', after.y === before.y && Math.abs(after.pos - before.pos) < 1e-6 && !after.inert && after.overflow === '', JSON.stringify({ y: [before.y, after.y], pos: [before.pos, after.pos] }));
      check('close: focus back on the ribbon it came from', /gal__ribbon/.test(after.focus || ''), after.focus);
      check('close: the paused gallery stays paused', await page.getByRole('button', { name: 'Play the moving gallery' }).isVisible());
      await sleep(2600);
      const still = await G(page, () => window.__gallery.pos);
      check('close: no drift after closing while paused', Math.abs(still - before.pos) < 1e-6);
      // backdrop click closes; Enter on the focused ribbon opens the middle photo
      await page.locator('.gal__ribbon').focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.gpv.is-in');
      check('keyboard: Enter on the ribbon opens the middle photo', (await lab()) === `Photo ${(await G(page, () => window.__gallery.index)) + 1} of 11`);
      await page.mouse.click(200, 30);                    // empty backdrop (the controls sit at the sides)
      await page.waitForSelector('.gpv', { state: 'detached', timeout: 2000 }).catch(() => {});
      check('backdrop click closes', (await page.locator('.gpv').count()) === 0);
      // focus inside the gallery holds the drift
      await page.getByRole('button', { name: 'Play the moving gallery' }).click();
      await page.locator('.gal__ribbon').focus();
      const f0 = await G(page, () => window.__gallery.pos); await sleep(1200); const f1 = await G(page, () => window.__gallery.pos);
      check('keyboard focus inside the gallery pauses the drift', Math.abs(f1 - f0) < 1e-6);
      await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
      // themes
      for (const t of ['light', 'dark']) {
        await G(page, (t) => { document.documentElement.dataset.theme = t; }, t);
        await sleep(500);
        await page.locator('#gallery').screenshot({ path: path.join(out, `gallery-1440-${t}.png`) });
      }
      // neighbouring sections and section links still work
      const secs = await G(page, () => ['projects', 'gallery', 'skills'].map((id) => !!document.getElementById(id)));
      await page.evaluate(() => { location.hash = '#gallery'; });
      await sleep(400);
      check('adjacent sections present; #gallery anchor intact', secs.every(Boolean) && (await G(page, () => Math.abs(document.getElementById('gallery').getBoundingClientRect().top) < 120)));
    }

    if (w === 390) {
      // touch: a horizontal swipe moves the ribbon; a vertical swipe scrolls the page
      const cdp = await ctx.newCDPSession(page);
      const tb = await page.locator('.gal__canvas').boundingBox();
      const swipe = async (x0, y0, x1, y1) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
        for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y: y0 + ((y1 - y0) * i) / 10 }] }); await sleep(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const a = await G(page, () => window.__gallery.pos);
      await swipe(tb.x + tb.width * 0.75, tb.y + tb.height / 2, tb.x + tb.width * 0.25, tb.y + tb.height / 2);
      await sleep(500);
      const b = await G(page, () => window.__gallery.pos);
      check('390 touch: a horizontal swipe moves the ribbon', Math.abs(b - a) > 0.05, `pos ${a.toFixed(2)} → ${b.toFixed(2)}`);
      check('390 touch: a swipe doesn\'t open the preview', (await page.locator('.gpv').count()) === 0);
      const y0 = await G(page, () => scrollY);
      await swipe(tb.x + tb.width / 2, tb.y + tb.height * 0.8, tb.x + tb.width / 2, tb.y + tb.height * 0.1);
      await sleep(700);
      check('390 touch: a vertical swipe over the ribbon scrolls the page', (await G(page, () => scrollY)) > y0 + 40, `scrollY ${y0} → ${await G(page, () => scrollY)}`);
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

  // ---- reduced motion: no drift, no inertia; preview without scaling ----
  {
    const { ctx, page, errors } = await open({ reducedMotion: 'reduce' });
    await page.waitForSelector('.gal__stage.is-live', { timeout: 15000 });
    await sleep(1200);
    const a = await G(page, () => window.__gallery.pos); await sleep(1500); const b = await G(page, () => window.__gallery.pos);
    check('reduced motion: no automatic movement', a === b && await page.getByRole('button', { name: 'Play the moving gallery' }).isVisible());
    const box = await page.locator('.gal__canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx + 150, cy); await page.mouse.down(); await page.mouse.move(cx - 150, cy, { steps: 3 }); await page.mouse.up();
    const c1 = await G(page, () => window.__gallery.pos); await sleep(500); const c2 = await G(page, () => window.__gallery.pos);
    check('reduced motion: dragging still works, without inertia', Math.abs(c1 - b) > 0.1 && c1 === c2);
    await page.getByRole('button', { name: 'Next photo' }).click();
    await page.locator('.gal__ribbon').focus(); await page.keyboard.press('Enter');
    await page.waitForSelector('.gpv');
    const tf = await G(page, () => getComputedStyle(document.querySelector('.gpv__img')).transform);
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
    await page.locator('.gal__ribbon').focus(); await page.keyboard.press('Enter');
    await page.waitForSelector('.gpv.is-in'); await sleep(300);
    const bg = await G(page, () => getComputedStyle(document.querySelector('.gpv__veil')).backgroundColor);
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
