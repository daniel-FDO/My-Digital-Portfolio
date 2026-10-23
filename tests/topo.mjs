/* =========================================================
   node tests/topo.mjs [url]     (default http://localhost:5173/, the dev server)
   The 'topo' background in headless Microsoft Edge: both themes at
   1440 / 768 / 390, a light forced mid-crossing (window.__topo, dev
   only), theme switching, Pause / Resume, reduced motion, the tab
   hidden, page errors and horizontal overflow. Screenshots go to
   review/topo/.
   ========================================================= */
import { chromium } from 'playwright-core';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:5173/';
const out = path.resolve('review/topo');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${ok || !info ? '' : '  — ' + info}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__topo);
  return { ctx, page, errors };
}
/** how much of the streak canvas is painted (alpha > 0), sampled */
const streakInk = (page) => page.evaluate(() => {
  const c = document.querySelector('.pbg__streak'); const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 16) if (d[i] > 8) n++;
  return n;
});
const toggleTheme = (page) => page.getByRole('button', { name: /Switch to (light|dark) theme/ }).first().click();

try {
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
    const { ctx, page, errors } = await open(w, h);
    const st = await page.evaluate(() => {
      const el = document.querySelector('.pbg'); const cs = getComputedStyle(el);
      return { hidden: el.getAttribute('aria-hidden'), pe: cs.pointerEvents, z: cs.zIndex, pos: cs.position,
        overflow: document.documentElement.scrollWidth - innerWidth, layers: document.querySelectorAll('.pbg').length };
    });
    check(`${w}: one decorative layer, behind, not clickable`, st.hidden === 'true' && st.pe === 'none' && st.z === '-1' && st.pos === 'fixed' && st.layers === 1, JSON.stringify(st));
    check(`${w}: no horizontal overflow`, st.overflow <= 0, String(st.overflow));
    for (const theme of ['dark', 'light']) {
      if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) { await toggleTheme(page); await sleep(400); }
      await page.evaluate(() => window.__topo.launch()); await sleep(2300);
      const ink = await streakInk(page);
      check(`${w} ${theme}: a light is crossing`, ink > 3, String(ink));
      await page.screenshot({ path: path.join(out, `${theme}-${w}.png`) });
      await page.screenshot({ path: path.join(out, `${theme}-${w}-full.png`), fullPage: true });
    }
    // a control above the background still takes clicks
    const hit = await page.evaluate(() => { const b = document.querySelector('.fcn__ctl'); const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.fcn__ctl') === b; });
    check(`${w}: controls stay clickable`, hit);
    await page.mouse.wheel(0, 1600); await sleep(400);
    check(`${w}: scrolls, background stays put`, (await page.evaluate(() => scrollY)) > 0 && (await page.evaluate(() => document.querySelector('.pbg').getBoundingClientRect().top)) === 0);
    check(`${w}: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Theme switch repaints at once; Pause holds the light, Resume lets it go on
  {
    const { ctx, page, errors } = await open(1440, 900);
    const px = () => page.evaluate(() => { const c = document.querySelector('.pbg__lines'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return [d[i - 3], d[i - 2], d[i - 1]].join(','); return ''; });
    const before = await px(); await toggleTheme(page); await sleep(50); const after = await px();
    check('theme change repaints the contours immediately', before && after && before !== after, `${before} → ${after}`);
    await page.evaluate(() => window.__topo.launch()); await sleep(1500);
    await page.getByRole('button', { name: 'Pause animations' }).click();
    const snap = () => page.evaluate(() => document.querySelector('.pbg__streak').toDataURL().length + ':' + document.querySelector('.pbg__streak').toDataURL().slice(-60));
    const a = await snap(); await sleep(900); const b = await snap();
    check('Pause holds the light where it is', a === b && (await streakInk(page)) > 0);
    check('Pause holds the colour fields too', await page.evaluate(() => document.querySelector('.pbg').classList.contains('is-paused')));
    await page.getByRole('button', { name: 'Resume animations' }).click(); await sleep(500);
    check('Resume lets it carry on', (await snap()) !== b);
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const c1 = await snap(); await sleep(600);
    check('tab hidden: the light holds', c1 === (await snap()));
    check('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Reduced motion: contours stay, no light
  {
    const { ctx, page, errors } = await open(1440, 900, { reducedMotion: 'reduce' });
    await page.evaluate(() => window.__topo.launch()); await sleep(1500);
    const st = await page.evaluate(() => ({ streak: getComputedStyle(document.querySelector('.pbg__streak')).display }));
    check('reduced motion: no light crossing', st.streak === 'none' && (await streakInk(page)) === 0, JSON.stringify(st));
    check('reduced motion: contours still drawn', await page.evaluate(() => { const c = document.querySelector('.pbg__lines'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 64) if (d[i]) return true; return false; }));
    check('reduced motion: no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${pass}/${pass + fail} topo checks passed`);
process.exit(fail ? 1 : 0);
