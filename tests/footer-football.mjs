/* node tests/footer-football.mjs [url]     (default http://localhost:5173/)
   The footballers on the footer wordmark (src/components/footer/football.ts), in headless
   Microsoft Edge: at phone, tablet and desktop sizes (portrait and landscape) they appear,
   animate, stay clear of the ID card / text / links and inside the page; with reduced motion
   a still picture shows; the loop stops offscreen and in a hidden tab; the ID card, Play /
   Pause and the links still work. Uses the engine's own ?football-debug hook.
   Results: console + review/footer/football.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = (process.argv[2] || 'http://localhost:5173/') + '?football-debug';
const out = path.join(root, 'review', 'footer');
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// what's on the canvas: inked pixel count + a cheap fingerprint
const INK = () => {
  const c = document.querySelector('.ffoot__football');
  if (!c || c.hidden || !c.width) return { ink: 0, sig: 0 };
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ink = 0, sig = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { ink++; sig = (sig * 31 + i) % 1e9; }
  return { ink, sig };
};
const GEO = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const c = document.querySelector('.ffoot__football');
  const pl = window.__football?.plan;
  const avoid = [...document.querySelectorAll('.fend__quote, .fend__nav a, .fend__legal, .ffoot__base, .ffoot__play')].map(r);
  const form = document.querySelector('#contact form, .contact form, form');
  if (form) avoid.push(r(form));
  return { mode: pl?.mode, height: pl?.height, canvas: c.hidden ? null : r(c), card: r(document.getElementById('idCard')), avoid, vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, running: window.__football?.running };
};
const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const SIZES = [
  ['360 portrait', 360, 780, true], ['390 portrait', 390, 844, true], ['430 portrait', 430, 932, true],
  ['390 landscape', 844, 390, true], ['430 landscape', 932, 430, true],
  ['768 tablet', 768, 1024, true], ['desktop 1440', 1440, 900, false],
];
try {
  for (const [label, w, h, touch] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: touch && w < 1000, hasTouch: touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: 'load' });
    // scroll the footer into view the way a visitor would (several wheel / swipe steps)
    for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 600); await sleep(40); }
    // short landscape screens: bring the players themselves into view
    await page.evaluate(() => { const c = document.querySelector('.ffoot__football'); if (!c.hidden) c.scrollIntoView({ block: 'center' }); });
    await sleep(3500);                     // the ID card drops in and swings; let it come to rest
    const g = await page.evaluate(GEO);
    const a = await page.evaluate(INK); await sleep(400); const b = await page.evaluate(INK);
    const clear = g.canvas && !g.avoid.some((o) => hit(g.canvas, o)) && !hit(g.canvas, g.card);
    check(`${label}: footballers shown (${g.mode}, ${g.height}px)`, g.canvas && a.ink > 200 && (g.mode === 'duo' || g.mode === 'solo'), `${a.ink} inked px`);
    check(`${label}: animating`, g.running && a.sig !== b.sig);
    check(`${label}: clear of the ID card, quote, links, footer text`, clear, JSON.stringify(g.canvas));
    check(`${label}: inside the page, no horizontal overflow`, g.canvas && g.canvas.l >= 0 && g.canvas.r <= g.vw && g.sw <= g.vw, `scrollWidth ${g.sw} / ${g.vw}`);
    await page.locator('.ffoot').screenshot({ path: path.join(out, `after-${w}x${h}.png`) });
    if (label === '390 portrait') {
      // touch: the ID card still flips with a tap, Play / Pause works with a tap
      const card = page.locator('#idCard');
      await card.scrollIntoViewIfNeeded();
      // on touch the card flips with a double-tap (a single tap is left for dragging / throwing)
      // (raw touchscreen taps: Playwright's tap() waits for the swinging card to hold still,
      // which can push the second tap past the 350 ms double-tap window)
      const dbl = async () => { const bx = await card.boundingBox(); const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2; await page.touchscreen.tap(x, y); await sleep(90); await page.touchscreen.tap(x, y); await sleep(600); };
      await dbl();
      const flipped = await card.getAttribute('aria-pressed');
      await dbl();
      check('390: double-tapping the ID card still flips it', flipped === 'true' && (await card.getAttribute('aria-pressed')) === 'false');
      await page.locator('#ffootPlay').tap(); await sleep(300);
      const paused = await page.evaluate(() => ({ running: window.__football.running, state: document.getElementById('ffootPlay').dataset.state }));
      const p1 = await page.evaluate(INK); await sleep(400); const p2 = await page.evaluate(INK);
      check('390: Pause (tap) stops the animation, players stay visible', !paused.running && paused.state === 'paused' && p1.sig === p2.sig && p1.ink > 200);
      await page.locator('#ffootPlay').tap(); await sleep(300);
      check('390: Play (tap) resumes', await page.evaluate(() => window.__football.running));
      // the changing letter (the spinning "a") still changes
      const l0 = await page.locator('#ffootLang').innerText(); await sleep(4000);
      check('390: the "a" still cycles through scripts', (await page.locator('#ffootLang').innerText()) !== l0, `${l0} → ${await page.locator('#ffootLang').innerText()}`);
      // offscreen: the loop stops; back: it resumes
      await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
      check('390: offscreen, the loop stops', !(await page.evaluate(() => window.__football.running)));
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(600);
      check('390: back on screen, it resumes', await page.evaluate(() => window.__football.running));
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      await sleep(200);
      check('390: hidden tab (simulated), the loop stops', !(await page.evaluate(() => window.__football.running)));
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    }
    check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // reduced motion: a still picture, not hidden
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: w < 1000, hasTouch: w < 1000 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(2000);
    const a = await page.evaluate(INK); await sleep(600); const b = await page.evaluate(INK);
    const st = await page.evaluate(() => ({ running: window.__football.running, play: document.getElementById('ffootPlay').dataset.state, hidden: document.getElementById('ffootPlay').hidden }));
    check(`reduced motion ${w}px: a still picture of the players, Play offered`, a.ink > 200 && a.sig === b.sig && !st.running && st.play === 'paused' && !st.hidden, `${a.ink} inked px`);
    await page.locator('.ffoot').screenshot({ path: path.join(out, `reduced-${w}.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'football.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} footer checks passed`);
  process.exitCode = failed ? 1 : 0;
}
