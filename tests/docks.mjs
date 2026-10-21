/* node tests/docks.mjs [url]     (default http://localhost:5173/)
   The two docks (DockBar.tsx + dock.css, SectionNav.tsx + section-nav.css) and Daniel's action
   menu, in headless Microsoft Edge: tinted frosted glass; expanding on mouse hover and keyboard
   focus (labels slide open, the pill follows the pointer) and collapsing again; their buttons
   still work; touch / narrow screens keep the compact bar and act on the first tap; reduced
   motion; no overflow at 1440 / 768 / 390; no console errors. Results: review/docks/docks.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] || 'http://localhost:5173/';
const out = path.join(root, 'review', 'docks');
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ignorable = (t) => /api\/|Failed to load resource/.test(t);

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('projects').scrollIntoView());
  await sleep(800);
  return { ctx, page, errors };
}
const W = (page, sel) => page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().width), sel);
const labelShown = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : -1; }, sel);

try {
  {
    const { ctx, page, errors } = await open();
    // the glass
    const g = await page.evaluate(() => ['#dock', '.snav__bar'].map((s) => { const c = getComputedStyle(document.querySelector(s)); return { blur: c.backdropFilter || c.webkitBackdropFilter, bg: c.backgroundImage }; }));
    check('both docks: frosted (backdrop blur) with a coloured tint', g.every((x) => /blur/.test(x.blur) && /radial-gradient/.test(x.bg)), JSON.stringify(g.map((x) => x.blur)));
    // bottom dock: hover expands, leaving collapses
    const w0 = await W(page, '#dock');
    const db = await page.locator('#dock').boundingBox();
    await page.mouse.move(db.x + db.width - 30, db.y + db.height / 2, { steps: 4 });
    await sleep(600);
    const w1 = await W(page, '#dock');
    check('bottom dock: hover expands it, labels slide open', (await page.locator('#dock.is-expanded').count()) === 1 && w1 > w0 + 100 && (await labelShown(page, '#toTop .dock2__more > span')) > 0.95, `${w0}px → ${w1}px`);
    const pill = await page.evaluate(() => { const p = document.querySelector('.dock2__pill'), b = document.getElementById('toTop'); const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect(); return { on: p.classList.contains('is-on'), dx: Math.abs(pr.left - br.left), dw: Math.abs(pr.width - br.width) }; });
    check('bottom dock: the pill sits under the hovered button', pill.on && pill.dx < 2 && pill.dw < 2, JSON.stringify(pill));
    const vw = await page.evaluate(() => { const r = document.getElementById('dock').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth }; });
    check('bottom dock: expanded, it stays inside the screen', vw.l >= 0 && vw.r <= vw.vw);
    await page.mouse.move(700, 300, { steps: 3 });
    await sleep(600);
    check('bottom dock: collapses when the pointer leaves', (await page.locator('#dock.is-expanded').count()) === 0 && Math.abs((await W(page, '#dock')) - w0) < 2);
    // its buttons still work
    const t0 = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#themeToggle').click(); await sleep(400);
    const t1 = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#themeToggle').click(); await sleep(400);
    check('bottom dock: theme button still switches the theme', t0 !== t1);
    await page.locator('#askOpen').click(); await sleep(300);
    check('bottom dock: search still opens the command menu', await page.evaluate(() => !!document.querySelector('#cmd[open], #cmd.is-open, [role="dialog"]#cmd') || document.getElementById('askOpen').getAttribute('aria-expanded') === 'true'));
    await page.keyboard.press('Escape'); await sleep(300);
    // keyboard focus expands it too
    await page.mouse.move(700, 300);
    await page.locator('#askOpen').focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');   // focus-visible
    await sleep(500);
    check('bottom dock: keyboard focus expands it', (await page.locator('#dock.is-expanded').count()) === 1);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await sleep(500);
    check('bottom dock: focus leaving collapses it', (await page.locator('#dock.is-expanded').count()) === 0, await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    await page.screenshot({ path: path.join(out, 'page-1440.png') });

    // the section rail (move focus out of the docks first: the Tabs above reach the rail)
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(600, 400); await sleep(400);
    const r0 = await W(page, '.snav__bar');
    const rb = await page.locator('.snav__bar').boundingBox();
    await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 4 });
    await sleep(700);
    const r1 = await W(page, '.snav__bar');
    const labels = await page.$$eval('.snav__more > span', (els) => els.map((e) => +getComputedStyle(e).opacity));
    check('rail: hover expands it into labelled rows', (await page.locator('.snav.is-expanded').count()) === 1 && r1 > r0 + 60 && labels.length === 9 && labels.every((o) => o > 0.95), `${r0}px → ${r1}px`);
    const icons = await page.$$eval('.snav__btn svg', (els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
    check('rail: the icons stay put as it grows (it opens leftwards)', Math.max(...icons) - Math.min(...icons) <= 1, icons.join(','));
    const ra = await page.evaluate(() => { const r = document.querySelector('.snav__bar').getBoundingClientRect(); return r.right <= innerWidth && r.left > 0; });
    check('rail: expanded, it stays inside the screen', ra);
    await page.getByRole('button', { name: 'Gallery', exact: true }).hover();
    await sleep(400);
    const hov = await page.evaluate(() => { const h = document.querySelector('.snav__hover'), b = [...document.querySelectorAll('.snav__btn')].find((x) => x.getAttribute('aria-label') === 'Gallery'); return { on: h.classList.contains('is-on'), dy: Math.abs(h.getBoundingClientRect().top - b.getBoundingClientRect().top) }; });
    check('rail: the hover pill glides to the hovered row', hov.on && hov.dy < 2, JSON.stringify(hov));
    await page.screenshot({ path: path.join(out, 'rail-1440.png') });
    await page.getByRole('button', { name: 'Gallery', exact: true }).click();
    await sleep(1600);
    check('rail: stays open while the pointer rests on it after a click (focus moved to the section)', (await page.locator('.snav.is-expanded').count()) === 1);
    check('rail: clicking a row still goes to that section', await page.evaluate(() => Math.abs(document.getElementById('gallery').getBoundingClientRect().top) < 140 && [...document.querySelectorAll('.snav__btn')].find((b) => b.getAttribute('aria-current'))?.getAttribute('aria-label') === 'Gallery'));
    await page.mouse.move(600, 400, { steps: 3 });
    await sleep(600);
    check('rail: collapses when the pointer leaves', (await page.locator('.snav.is-expanded').count()) === 0 && Math.abs((await W(page, '.snav__bar')) - r0) < 2);
    await page.getByRole('button', { name: 'About', exact: true }).focus();
    await page.keyboard.press('ArrowDown'); await sleep(500);
    check('rail: keyboard focus expands it; arrow keys still move between rows', (await page.locator('.snav.is-expanded').count()) === 1 && (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Education');
    await page.keyboard.press('Escape');
    check('1440: no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // 768: the bottom dock may expand (wide enough, precise pointer); the section dock is the row
  {
    const { ctx, page, errors } = await open({ viewport: { width: 768, height: 1024 } });
    const db = await page.locator('#dock').boundingBox();
    await page.mouse.move(db.x + db.width - 30, db.y + db.height / 2, { steps: 3 });
    await sleep(600);
    const o = await page.evaluate(() => { const r = document.getElementById('dock').getBoundingClientRect(); return { l: r.left, r: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    check('768: the bottom dock expands and fits; no page overflow', (await page.locator('#dock.is-expanded').count()) === 1 && o.l >= 0 && o.r <= o.vw && o.sw <= o.vw, JSON.stringify(o));
    await page.screenshot({ path: path.join(out, 'page-768.png') });
    check('768: no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // 390 touch: compact bars, every tap acts at once
  {
    const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const t0 = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#themeToggle').tap(); await sleep(400);
    check('390 touch: one tap switches the theme (no "first tap expands")', (await page.evaluate(() => document.documentElement.dataset.theme)) !== t0 && (await page.locator('#dock.is-expanded').count()) === 0);
    await page.locator('#themeToggle').tap(); await sleep(300);
    await page.evaluate(() => scrollTo(0, 1600)); await sleep(500);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, dock: document.getElementById('dock').getBoundingClientRect().right, row: document.querySelector('.snav')?.className }));
    check('390: no overflow; the section row is shown compact', o.sw <= o.vw && o.dock <= o.vw && /snav--row/.test(o.row || ''), JSON.stringify(o));
    await page.screenshot({ path: path.join(out, 'page-390.png') });
    check('390: no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // reduced motion: still expands, without sliding
  {
    const { ctx, page } = await open({ reducedMotion: 'reduce' });
    const db = await page.locator('#dock').boundingBox();
    await page.mouse.move(db.x + db.width - 30, db.y + db.height / 2, { steps: 2 });
    await sleep(150);
    const s = await page.evaluate(() => { const e = document.querySelector('#toTop .dock2__more > span'), c = getComputedStyle(e); return { op: +c.opacity, tf: c.transform, tr: c.transitionDuration }; });
    check('reduced motion: labels appear without sliding or blurring', (await page.locator('#dock.is-expanded').count()) === 1 && s.op === 1 && s.tf === 'none', JSON.stringify(s));
    await ctx.close();
  }
  // Daniel's menu: glass, rows, icons, highlight, mute switch, closing animation
  {
    const { ctx, page, errors } = await open();
    await page.evaluate(() => { const r = document.querySelector('.wg--name').getBoundingClientRect(); scrollBy(0, r.top - 500); });
    await page.waitForSelector('.dnc--live', { timeout: 30000 });
    await page.getByRole('button', { name: 'Daniel’s actions' }).click();
    await sleep(500);
    const m = await page.evaluate(() => { const el = document.querySelector('.dnc-menu'), c = getComputedStyle(el); return { blur: c.backdropFilter, icons: el.querySelectorAll('.dnc-menu__icon').length, items: el.querySelectorAll('[role^="menuitem"]').length }; });
    check('menu: frosted glass, an icon on every row', /blur/.test(m.blur) && m.icons === 6 && m.items === 6, JSON.stringify(m));
    const it = await page.getByRole('menuitem', { name: 'Nod' }).boundingBox();
    await page.mouse.move(it.x + 30, it.y + it.height / 2, { steps: 3 });
    await sleep(450);
    const hl = await page.evaluate(() => { const h = document.querySelector('.dnc-menu__hl'), b = document.querySelector('[data-action="nod"]'); return { on: h.classList.contains('is-on'), dy: Math.abs(h.getBoundingClientRect().top - b.getBoundingClientRect().top) }; });
    check('menu: the highlight glides to the hovered row', hl.on && hl.dy < 2, JSON.stringify(hl));
    await page.getByRole('menuitemcheckbox', { name: 'Mute sounds' }).click(); await sleep(350);
    const sw = await page.evaluate(() => getComputedStyle(document.querySelector('.dnc-menu__switch > span')).transform);
    check('menu: the mute switch slides on', /matrix\(1, 0, 0, 1, 12/.test(sw), sw);
    await page.getByRole('menuitemcheckbox', { name: 'Mute sounds' }).click();
    await page.keyboard.press('Escape');
    const leaving = await page.evaluate(() => document.querySelector('.dnc-menu')?.classList.contains('is-leaving'));
    await sleep(300);
    check('menu: Escape plays a short closing animation, then removes it', leaving === true && (await page.locator('.dnc-menu').count()) === 0);
    check('menu: no console errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'docks.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} dock checks passed`);
  process.exitCode = failed ? 1 : 0;
}
