/* =========================================================
   THE HANDWRITTEN NAME — browser checks (nameScript.ts, DanielTile.tsx)
   node tests/name-script.mjs [url]     (default http://localhost:5173/, the dev server)
   Headless Microsoft Edge. Writes review/name-play/checks.json.
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] || 'http://localhost:5173/';
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** read the engine (nameScript.ts exposes it on the word for these tests) */
const S = (p, expr) => p.evaluate(`(() => { const s = document.querySelector('.daniel__word').__script; return ${expr}; })()`);
const waitMode = (p, mode, timeout = 8000) =>
  p.waitForFunction((m) => document.querySelector('.daniel__word')?.__script?.mode === m, mode, { timeout });

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function open(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, ...opts });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.wg--name').scrollIntoViewIfNeeded();
  return { page, errors };
}
/** viewBox units → page pixels */
const view = async (page) => {
  const m = await page.evaluate(() => { const c = document.querySelector('.daniel__script').getScreenCTM(); return [c.a, c.d, c.e, c.f]; });
  return { x: (x) => m[0] * x + m[2], y: (y) => m[1] * y + m[3] };
};
const inkLength = (page) => page.evaluate(() => [...document.querySelectorAll('.daniel__ink')].reduce((n, p) => n + (p.getAttribute('d') || '').length, 0));
const inkRight = (page) => page.evaluate(() => Math.max(...[...document.querySelectorAll('.daniel__ink, .daniel__stop')].map((e) => e.getBoundingClientRect().right)));
const sweep = async (page, v) => {
  await page.mouse.move(v.x(60), v.y(-20));
  for (let k = 0; k <= 8; k++) await page.mouse.move(v.x(60 + k * 30), v.y(-20 + k * 16));
};

try {
  /* ---- 1. writing it, at desktop ---- */
  {
    const { page, errors } = await open();
    await waitMode(page, 'write', 15000);
    check('writes itself when the card comes into view', true);
    const a = await inkLength(page); await sleep(500); const b = await inkLength(page);
    check('the ink grows while it writes', b > a, `${a} → ${b} chars of path`);
    await waitMode(page, 'rest');
    check('finishes in rest, with the full stop stamped', Number(await page.locator('.daniel__stop').getAttribute('rx')) > 6);
    await sleep(1500);
    check('the loop sleeps once it is still', !(await S(page, 's.awake')));
    check('accessible: one focusable button named "Daniel"',
      (await page.getByRole('button', { name: 'Daniel', exact: true }).count()) === 1 && (await page.locator('.daniel__word').getAttribute('tabindex')) === '0');
    const dnc = await page.locator('.dnc').boundingBox(), right = await inkRight(page);
    check('the name stays clear of the character (1440)', right < dnc.x - 8, `ink ends ${right.toFixed(0)}, him at ${dnc.x.toFixed(0)}`);

    /* ---- 2. playing with it ---- */
    const v = await view(page);
    await sweep(page, v); await sleep(60);
    const swept = await S(page, 's.stretch');
    check('a pointer sweeping across bends the ink', swept > 1.5, `${swept.toFixed(1)} units`);
    await sleep(2500);
    await page.mouse.move(v.x(207), v.y(56)); await page.mouse.down();
    await page.mouse.move(v.x(212), v.y(100), { steps: 8 }); await sleep(300);
    const pulled = await S(page, 's.stretch');
    check('grabbing pulls the line like a rubber band', pulled > 20 && pulled <= 48, `${pulled.toFixed(1)} units`);
    check('grabbing shows the grabbing cursor', (await page.locator('.daniel__word[data-grab]').count()) === 1);
    await page.mouse.up(); await sleep(250);
    check('let go, it springs back', (await S(page, 's.stretch')) < pulled * 0.6);
    await sleep(4000);
    check('and settles completely', (await S(page, 's.stretch')) < 0.05 && !(await S(page, 's.awake')));
    check('a drag is not a click (no rewrite)', (await S(page, 's.mode')) === 'rest');

    /* ---- 3. writing it again ---- */
    const before = await page.locator('.daniel__ink').nth(1).getAttribute('d');
    await page.mouse.click(v.x(120), v.y(80));
    await sleep(150);
    check('a click erases it…', (await S(page, 's.mode')) === 'erase');
    await waitMode(page, 'write', 3000);
    check('…and writes it again', true);
    await waitMode(page, 'rest');
    check('each take is a little different', (await page.locator('.daniel__ink').nth(1).getAttribute('d')) !== before);
    await sleep(800);
    await page.locator('.daniel__word').focus();
    await page.keyboard.press('Enter'); await sleep(100);
    check('Enter writes it again', (await S(page, 's.mode')) === 'erase');
    await waitMode(page, 'rest');
    await sleep(600);
    await page.keyboard.press('ArrowRight'); await sleep(80);
    check('→ plucks the line', (await S(page, 's.stretch')) > 1);

    /* ---- 4. leaving the screen mid-write finishes it ---- */
    await sleep(2500);
    await page.keyboard.press('Enter'); await sleep(700);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(400);
    check('scrolled away mid-write: it jumps to the finished name', (await S(page, 's.mode')) === 'rest');
    check('no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 5. reduced motion ---- */
  {
    const { page, errors } = await open({ reducedMotion: 'reduce' });
    await sleep(1500);
    check('reduced motion: the name is simply there', (await S(page, 's.mode')) === 'rest' && (await inkLength(page)) > 1000);
    const v = await view(page);
    await sweep(page, v);
    check('reduced motion: nothing wobbles', (await S(page, 's.stretch')) === 0 && !(await S(page, 's.awake')));
    const before = await page.locator('.daniel__ink').nth(1).getAttribute('d');
    await page.mouse.click(v.x(120), v.y(80));
    check('reduced motion: a click shows a new take at once',
      (await S(page, 's.mode')) === 'rest' && (await page.locator('.daniel__ink').nth(1).getAttribute('d')) !== before);
    check('reduced motion: no page errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  /* ---- 6. tablet and phone: clear of him ---- */
  for (const width of [768, 390]) {
    const { page } = await open({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    await waitMode(page, 'rest', 15000);
    const dnc = await page.locator('.dnc').boundingBox(), right = await inkRight(page);
    check(`the name stays clear of the character (${width})`, right < dnc.x - 4, `ink ends ${right.toFixed(0)}, him at ${dnc.x.toFixed(0)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
const out = path.join(root, 'review', 'name-play');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
