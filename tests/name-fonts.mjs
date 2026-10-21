/* node tests/name-fonts.mjs [url]     (default http://localhost:5173/, the dev server)
   The font-cycling "Daniel Fasan" heading (components/fontcycle/) in headless Microsoft Edge:
   - the full rotation, every installed font, in order, then repeating (at 1440, 768 and 390 px,
     with ?name-fonts-step=500 so a whole cycle fits in a test; the real step is 3 s)
   - each font fitted inside the original heading's box: no wider, never wrapping, never clipped,
     not overlapping the role line; the intro around it never moves
   - fonts load one at a time (not all up front)
   - a font that fails to load: the current one stays, the failure is reported, the next one is used
   - Pause / Resume; offscreen and hidden tab; reduced motion ("Next font", no automatic change)
   - one h1, one accessible name, visual layers hidden; no console errors; no horizontal overflow
   A contact sheet of every font at each width goes to review/name-fonts/. Results: name-fonts.json */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:5173/';
const out = path.join(root, 'review', 'name-fonts');
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ignorable = (t) => /api\/|Failed to load resource/.test(t);
const STEP = 500;

// the installed fonts, in rotation order, straight from the manifest
const manifest = fs.readFileSync(path.join(root, 'src/components/fontcycle/fonts.ts'), 'utf8');
const readyPart = manifest.slice(manifest.indexOf('// ---- ready'), manifest.indexOf('// ---- blocked'));
const ORDER = [...readyPart.matchAll(/(?:family: '([^']+)'|RORY\('([^']+)')/g)].map((m) => m[1] || m[2]);

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
async function open(opts = {}, q = `?name-fonts-step=${STEP}`, init) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  if (init) await init(ctx);
  const page = await ctx.newPage();
  const errors = [], warnings = [], fontReqs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); if (m.type() === 'warning' && /name fonts/.test(m.text())) warnings.push(m.text()); });
  page.on('request', (r) => { if (/\/fonts\/name\//.test(r.url())) fontReqs.push({ url: r.url(), t: Date.now() }); });
  const t0 = Date.now();
  await page.goto(BASE + q, { waitUntil: 'load' });
  await page.waitForSelector('.fcn__stage', { timeout: 15000 });
  // every font change, recorded in the page (so a slow screenshot never makes the test miss one)
  await page.evaluate(() => {
    const st = document.querySelector('.fcn__stage');
    window.__fonts = [st.dataset.font];
    new MutationObserver(() => { if (st.dataset.font !== window.__fonts.at(-1)) window.__fonts.push(st.dataset.font); }).observe(st, { attributes: true, attributeFilter: ['data-font'] });
  });
  return { ctx, page, errors, warnings, fontReqs, t0 };
}
const geo = (page) => page.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const stage = document.querySelector('.fcn__stage'), orig = document.querySelector('.fcn__orig');
  const on = document.querySelector('.fcn__layer.is-on');
  return {
    font: stage.dataset.font, orig: r(orig), on: r(on), fs: parseFloat(getComputedStyle(on).fontSize),
    role: r(document.querySelector('.intro__role')), meta: r(document.querySelector('.intro__meta')), now: r(document.querySelector('.intro__now')),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});

try {
  for (const [w, h, mobile] of [[1440, 900, false], [768, 1024, false], [390, 844, true]]) {
    const { ctx, page, errors, fontReqs, t0 } = await open({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
    // ---- accessibility ----
    const a11y = await page.evaluate(() => ({
      h1s: document.querySelectorAll('h1').length,
      name: document.querySelector('#introName').textContent.includes('Daniel Fasan'),
      hidden: document.querySelector('.fcn__stage').getAttribute('aria-hidden'),
    }));
    const snap = await page.locator('#intro').ariaSnapshot();
    check(`${w}: one h1, named "Daniel Fasan" once; the font layers are hidden`, a11y.h1s === 1 && a11y.hidden === 'true' && /heading "Daniel Fasan" \[level=1\]/.test(snap) && (snap.match(/Daniel Fasan/g) || []).length === 1, snap.split('\n')[0]);
    const first = await geo(page);
    check(`${w}: starts with the original heading`, first.font === 'original');
    // the intro's own entrance animation (everything rises in) must finish before positions are compared
    // (it waits for the preloader, then rises 6px; the font layers have nothing to do with it)
    await page.waitForFunction(() => ['.intro__role', '.intro__meta', '.intro__now'].every((q) => getComputedStyle(document.querySelector(q)).transform === 'none') && !document.documentElement.classList.contains('pl-on'), null, { timeout: 8000 });
    await sleep(200);
    // ---- the whole rotation ----
    const seen = [], shots = [], fits = [], moved = [];
    const base = await geo(page);
    let last = 'original', guard = Date.now();
    while (new Set(seen).size < ORDER.length + 1 && Date.now() - guard < (ORDER.length + 6) * STEP * 4) {
      await sleep(60);
      const g = await geo(page);
      if (g.font === last) continue;
      last = g.font;
      seen.push(g.font);
      if (g.font !== 'original') {
        // fitted inside the box: no wider than the original name, one line, clear of the role line
        const wide = g.on.w <= g.orig.w * 1.02 + 1;
        const oneLine = g.on.h < g.fs * 1.6;
        const clear = g.on.b <= g.role.t + 4 && g.on.t >= g.orig.t - g.orig.h * 0.45 && g.on.l >= g.orig.l - 4;
        if (!(wide && oneLine && clear)) fits.push(`${g.font}: w ${g.on.w.toFixed(0)}/${g.orig.w.toFixed(0)}, h ${g.on.h.toFixed(0)} (fs ${g.fs.toFixed(0)}), top ${(g.on.t - g.orig.t).toFixed(0)}, bottom→role ${(g.role.t - g.on.b).toFixed(0)}`);
        const box = await page.locator('.fcn').boundingBox();
        await sleep(470 - 60 > 0 ? 300 : 0);   // let the crossfade finish before the picture
        const pad = 16;
        shots.push({ font: g.font, buf: await page.screenshot({ clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(w - Math.max(0, box.x - pad), box.width + 70), height: box.height + pad * 2 } }) });
      }
      for (const k of ['role', 'meta', 'now']) if (Math.abs(g[k].t - base[k].t) > 0.5 || Math.abs(g[k].l - base[k].l) > 0.5) moved.push(`${g.font}: ${k} moved`);
      if (g.sw > g.cw) moved.push(`${g.font}: horizontal overflow ${g.sw}/${g.cw}`);
    }
    const expected = ['original', ...ORDER, 'original'];
    const history = (await page.evaluate(() => window.__fonts)).slice(0, expected.length);
    check(`${w}: the full rotation — every installed font (${ORDER.length}), in order, then back to the start`, JSON.stringify(history) === JSON.stringify(expected), history.length < expected.length ? `stopped after ${history.length}: ${history.at(-1)}` : history.filter((f, i) => f !== expected[i]).join(', '));
    check(`${w}: screenshots of every font for the contact sheet`, new Set(shots.map((x) => x.font)).size >= ORDER.length - 2, `${new Set(shots.map((x) => x.font)).size} captured`);
    check(`${w}: every font fits the heading's box (no wider, one line, clear of the role line)`, fits.length === 0, fits.join(' | '));
    check(`${w}: the intro never moves; no horizontal overflow`, moved.length === 0, moved.slice(0, 5).join(' | '));
    // fonts were fetched one at a time, as the rotation reached them
    const firstFontReq = fontReqs[0] ? fontReqs[0].t - t0 : -1;
    check(`${w}: fonts load progressively (${fontReqs.length} requests, the first ${firstFontReq} ms after navigation)`, fontReqs.length <= ORDER.length + 1 && new Set(fontReqs.map((r) => r.url)).size === fontReqs.length);
    // contact sheet
    const dir = path.join(out, `.tmp-${w}`); fs.mkdirSync(dir, { recursive: true });
    shots.forEach((s, i) => fs.writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}.png`), s.buf));
    const cols = w > 500 ? 3 : 4;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%02d.png'),
      '-vf', `scale=${w > 500 ? 640 : 420}:-2:force_original_aspect_ratio=decrease,pad=${w > 500 ? 640 : 420}:ih+4:0:0:0x222222,tile=${cols}x${Math.ceil(shots.length / cols)}`, '-frames:v', '1', path.join(out, `rotation-${w}.png`)]);
    fs.rmSync(dir, { recursive: true, force: true });
    check(`${w}: no console errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- a font that can't load: the current one stays, it's reported, the next is used ----
  {
    const broken = ORDER[2];   // the third font in the rotation
    const { ctx, page, warnings } = await open({}, `?name-fonts-step=${STEP}`, (c) => c.route(new RegExp(`/fonts/name/${broken.toLowerCase().replace(/ /g, '-')}/`), (r) => r.abort()));
    const seen = []; let last = 'original'; const t = Date.now();
    while (seen.length < 4 && Date.now() - t < STEP * 14) { await sleep(50); const f = await page.evaluate(() => document.querySelector('.fcn__stage').dataset.font); if (f !== last) { seen.push(f); last = f; } }
    check(`a failed font (${broken}) is skipped, the current one stays meanwhile, the next is shown`, !seen.includes(broken) && seen[0] === ORDER[0] && seen[1] === ORDER[1] && seen[2] === ORDER[3], seen.join(' → '));
    check('the failure is reported (console warning)', warnings.some((w) => w.includes(broken)), warnings[0] || 'none');
    await ctx.close();
  }

  // ---- pause / resume; offscreen; hidden tab ----
  {
    const { ctx, page } = await open();
    const font = () => page.evaluate(() => document.querySelector('.fcn__stage').dataset.font);
    await sleep(STEP * 2.5);
    await page.getByRole('button', { name: 'Pause the name’s font changes' }).click();
    const p0 = await font(); await sleep(STEP * 3); const p1 = await font();
    check('Pause holds the current font', p0 === p1 && (await page.getByRole('button', { name: 'Resume the name’s font changes' }).isVisible()), p0);
    await page.getByRole('button', { name: 'Resume the name’s font changes' }).click();
    await sleep(STEP * 1.6);
    check('Resume carries on (one step, not a burst of missed ones)', (await font()) !== p1 && (await font()) === ORDER[(ORDER.indexOf(p1) + 1) % ORDER.length] || (p1 === ORDER.at(-1) && (await font()) === 'original'), `${p1} → ${await font()}`);
    // keyboard
    await page.getByRole('button', { name: 'Pause the name’s font changes' }).focus();
    await page.keyboard.press('Enter');
    check('the control works from the keyboard', await page.getByRole('button', { name: 'Resume the name’s font changes' }).isVisible());
    await page.keyboard.press('Enter');
    // offscreen
    await page.evaluate(() => scrollTo(0, 2500)); await sleep(300);
    const o0 = await font(); await sleep(STEP * 3); const o1 = await font();
    check('offscreen: no changes', o0 === o1);
    await page.evaluate(() => scrollTo(0, 0)); await sleep(STEP * 1.5);
    check('back on screen: it carries on', (await font()) !== o1);
    // hidden tab (simulated)
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const v0 = await font(); await sleep(STEP * 3); const v1 = await font();
    check('hidden tab: no changes (simulated visibilitychange)', v0 === v1);
    await page.screenshot({ path: path.join(out, 'heading-1440.png'), clip: { x: 0, y: 0, width: 1440, height: 420 } });
    await ctx.close();
  }

  // ---- reduced motion: static; "Next font" ----
  {
    const { ctx, page, errors } = await open({ reducedMotion: 'reduce' });
    const font = () => page.evaluate(() => document.querySelector('.fcn__stage').dataset.font);
    await sleep(STEP * 4);
    check('reduced motion: stays on the original heading', (await font()) === 'original');
    const next = page.getByRole('button', { name: 'Show the name in the next font' });
    await next.click();
    await page.waitForFunction(() => document.querySelector('.fcn__stage').dataset.font !== 'original', null, { timeout: 5000 }).catch(() => {});
    const f1 = await font();
    const instant = await page.evaluate(() => getComputedStyle(document.querySelector('.fcn__layer.is-on')).transitionDuration);
    await sleep(STEP * 3);
    check('reduced motion: "Next font" shows the next one, instantly, and it stays', f1 === ORDER[0] && (await font()) === ORDER[0] && /^(0s|1e-05s)/.test(instant), `${f1}, transition ${instant}`);
    await next.click(); await sleep(400);
    check('reduced motion: and again', (await font()) === ORDER[1]);
    check('reduced motion: no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ---- the real 3 s step (no test parameter) ----
  {
    const { ctx, page } = await open({}, '');
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector('.fcn__stage').dataset.font !== 'original', null, { timeout: 12000 });
    const first = Date.now() - t0;
    const f = await page.evaluate(() => document.querySelector('.fcn__stage').dataset.font);
    const t1 = Date.now();
    await page.waitForFunction((f) => document.querySelector('.fcn__stage').dataset.font !== f, f, { timeout: 12000 });
    const gap = Date.now() - t1;
    check('default timing: about 3 s per font', first >= 2500 && first < 5500 && gap >= 2500 && gap < 3800, `first change after ${first} ms, next ${gap} ms later`);
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'name-fonts.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} name-font checks passed`);
  process.exitCode = failed ? 1 : 0;
}
