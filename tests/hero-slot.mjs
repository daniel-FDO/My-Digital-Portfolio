/* =========================================================
   THE HERO GRID'S LAST TILE — X-ray, "Fixed" or "Setup"
   node tests/hero-slot.mjs [url]     (default http://localhost:5173/, the dev server)
   Headless Microsoft Edge. With the real data files (TODO entries only)
   the X-ray tile must stay. The widgets themselves are exercised with
   entries handed in by this test (window.__heroPreview, development
   only): placeholders, never content about Daniel. Checks keyboard,
   touch, focus, contrast, reduced motion, 320 px and both themes.
   Results: review/hero-slot/checks.json (+ screenshots).
   ========================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] || 'http://localhost:5173/';
const out = path.join(root, 'review', 'hero-slot');
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* placeholders only (the tile must cope with short and very long fields) */
const LONG = 'Placeholder text that is deliberately much longer than one line of the tile so that it has to be cut short and offered in full behind Read more.';
const BUGS = [
  { id: 't1', title: 'Placeholder bug one', symptom: 'Placeholder symptom', cause: 'Placeholder cause', fix: 'Placeholder fix', project: 'Test project', repoUrl: 'https://example.com/fix', date: '2026-01-02' },
  { id: 't2', title: 'Placeholder bug two', symptom: LONG, cause: 'Placeholder cause', fix: LONG },
  { id: 't3', title: 'Placeholder bug three', symptom: 'Placeholder symptom', cause: 'Placeholder cause', fix: 'Placeholder fix' },
];
const ITEMS = [
  { id: 's1', name: 'Placeholder screen', use: 'Placeholder use one', x: 60, y: 27 },
  { id: 's2', name: 'Placeholder keyboard', use: 'Placeholder use two', x: 60, y: 67 },
  { id: 's3', name: 'Placeholder mouse', use: 'Placeholder use three', x: 80, y: 67 },
  { id: 's4', name: 'Placeholder chair', use: 'Placeholder use four', x: 14, y: 47 },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function open({ preview, width = 1440, height = 1000, ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  if (preview) await ctx.addInitScript((p) => { window.__heroPreview = p; }, preview);
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/api\/|Failed to load resource/.test(m.text())) errors.push(m.text());
    if (m.type() === 'warning' && m.text().startsWith('[setup]')) warnings.push(m.text());
  });
  await page.goto(URL, { waitUntil: 'load' });
  await page.locator('.wg--xray').scrollIntoViewIfNeeded();
  await sleep(700);
  return { ctx, page, errors, warnings };
}
/** WCAG contrast of an element's text against the tile behind it (the tile's colour over the page's) */
const contrast = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return 0;
  // any CSS colour (rgb(), color(srgb …) from color-mix, …) → [r, g, b, a] via a 1 × 1 canvas
  const g = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const rgb = (s) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = s; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => { const a = top[3] ?? 1; return [0, 1, 2].map((k) => top[k] * a + under[k] * (1 - a)); };
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // the backgrounds stacked: html (white if unset), body, the tile
  let bg = [255, 255, 255];
  for (const layer of [document.documentElement, document.body, el.closest('.w')].filter(Boolean)) {
    const c = rgb(getComputedStyle(layer).backgroundColor);
    if (c.length >= 3 && (c[3] ?? 1) > 0) bg = over(c, bg);
  }
  const fg = over(rgb(getComputedStyle(el).color), bg);
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}, sel);
const label = (page, sel) => page.locator(sel).first().evaluate((e) => e.textContent.trim());
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const toggleTheme = (page) => page.evaluate(() => document.getElementById('themeToggle').click());   // the phone dock may be tucked away after scrolling

try {
  /* ---- 1. the real data (TODO entries only): nothing ships, X-ray stays and still works ---- */
  {
    const { ctx, page, errors } = await open();
    check('real data: the X-ray tile keeps its place', (await page.locator('.wg--xray .xr-tile').count()) === 1 && (await page.locator('.fx, .su').count()) === 0);
    check('real data: the slot is described as the X-ray tile', (await page.locator('[data-xray="xray"]').count()) === 1 && (await page.locator('[data-xray="fixed"], [data-xray="setup"]').count()) === 0);
    await page.keyboard.press('x'); await sleep(200);
    check('the X key still toggles X-ray', await page.evaluate(() => document.documentElement.classList.contains('is-xray')));
    await page.keyboard.press('x'); await sleep(200);
    check('no page errors (real data)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ---- 2. Fixed ---- */
  for (const theme of ['dark', 'light']) {
    const { ctx, page, errors } = await open({ preview: { fixed: BUGS } });
    if (theme === 'light') { await toggleTheme(page); await sleep(300); }
    const tile = page.locator('.fx');
    check(`fixed (${theme}): replaces the X-ray tile`, (await tile.count()) === 1 && (await page.locator('.xr-tile').count()) === 0 && (await page.locator('[data-xray="fixed"]').count()) === 1);
    if (theme === 'dark') {
      check('fixed: label "Fixed · 01 / 03", uppercase mono', (await label(page, '.fx .w__label')) === 'Fixed · 01 / 03'
        && (await page.locator('.fx .w__label').evaluate((e) => getComputedStyle(e).textTransform)) === 'uppercase');
      const fixColor = await page.locator('.fx__fix dt').evaluate((e) => getComputedStyle(e).color);
      const brand = await page.evaluate(() => { const s = document.createElement('span'); s.style.color = 'var(--brand)'; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; });
      check('fixed: the FIX label is in --brand (dark theme; light uses a deeper shade of it for contrast)', fixColor === brand, fixColor);
      check('fixed: project chip and "View fix ↗" (new tab)', (await page.locator('.fx__chip').count()) === 1 && (await page.locator('.fx__link').getAttribute('target')) === '_blank');
      await page.getByRole('button', { name: 'Next bug' }).click(); await sleep(400);
      check('fixed: Next moves on', (await label(page, '.fx .w__label')) === 'Fixed · 02 / 03');
      check('fixed: the new position is announced politely', (await page.locator('.fx [aria-live="polite"]').textContent()) === 'Bug 2 of 3: Placeholder bug two');
      check('fixed: a long field is cut short and offers "Read more"', (await page.locator('.fx__more').count()) === 1);
      await page.locator('.fx__more').click(); await sleep(200);
      check('fixed: "Read more" opens the whole entry in a modal dialog', await page.locator('dialog.fx-entry').evaluate((d) => d.open && d.matches(':modal')));
      check('fixed: the dialog holds the full text', (await page.locator('dialog.fx-entry').textContent()).includes(BUGS[1].fix));
      check('fixed: focus moves into the dialog', await page.evaluate(() => !!document.activeElement?.closest('dialog.fx-entry')));
      await page.keyboard.press('ArrowRight'); await sleep(100);
      check('fixed: arrow keys inside the dialog don\'t change the card', (await label(page, '.fx .w__label')) === 'Fixed · 02 / 03');
      await page.screenshot({ path: path.join(out, 'fixed-dialog-1440.png') });
      await page.keyboard.press('Escape'); await sleep(200);
      check('fixed: Esc closes it and focus returns to "Read more"', (await page.locator('dialog.fx-entry').count()) === 0 && await page.evaluate(() => document.activeElement?.classList.contains('fx__more')));
      await page.getByRole('button', { name: 'Previous bug' }).click(); await sleep(100);
      await page.getByRole('button', { name: 'Previous bug' }).click(); await sleep(400);
      check('fixed: it wraps round (Previous from 01 → 03)', (await label(page, '.fx .w__label')) === 'Fixed · 03 / 03');
      await tile.focus();
      await page.keyboard.press('ArrowRight'); await sleep(100);
      check('fixed: → on the focused tile', (await label(page, '.fx .w__label')) === 'Fixed · 01 / 03');
      await page.keyboard.press('ArrowLeft'); await sleep(100);
      check('fixed: ← on the focused tile', (await label(page, '.fx .w__label')) === 'Fixed · 03 / 03');
      check('fixed: the tile shows a focus ring', await tile.evaluate((e) => getComputedStyle(e).outlineStyle !== 'none' && parseFloat(getComputedStyle(e).outlineWidth) > 0));
      check('fixed: a slide plays between cards', (await page.locator('.fx__card').evaluate((e) => getComputedStyle(e).animationName)) === 'fx-in');
      // a sideways touch swipe
      const box = await tile.boundingBox();
      await tile.evaluate((el, b) => {
        const y = b.y + b.height / 2;
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: b.x + b.width * 0.8, clientY: y }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: b.x + b.width * 0.2, clientY: y + 6 }));
      }, box);
      await sleep(100);
      check('fixed: a swipe to the left goes to the next bug', (await label(page, '.fx .w__label')) === 'Fixed · 01 / 03');
      check('fixed: buttons have accessible names', (await page.getByRole('button', { name: 'Previous bug' }).count()) === 1 && (await page.getByRole('button', { name: 'Next bug' }).count()) === 1);
    }
    for (const sel of ['.fx__title', '.fx__rows dd', '.fx__rows dt', '.fx__fix dt', '.fx .w__label']) {
      const c = await contrast(page, sel);
      check(`fixed (${theme}): ${sel} contrast ≥ 4.5:1`, c >= 4.5, c.toFixed(2));
    }
    await page.locator('.wg--xray').screenshot({ path: path.join(out, `fixed-${theme}-1440.png`) });
    check(`fixed (${theme}): no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ preview: { fixed: [BUGS[0]] } });
    check('fixed: one entry → no arrows', (await page.locator('.fx__nav').count()) === 0 && (await label(page, '.fx .w__label')) === 'Fixed · 01 / 01');
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ preview: { fixed: [{ id: 'x', title: 'TODO', symptom: '', cause: '', fix: '' }] } });
    check('fixed: only TODO / empty entries → X-ray stays', (await page.locator('.xr-tile').count()) === 1 && (await page.locator('.fx').count()) === 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ preview: { fixed: BUGS }, reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Next bug' }).click(); await sleep(50);
    check('fixed: reduced motion → instant change, no slide', (await page.locator('.fx__card').evaluate((e) => getComputedStyle(e).animationName)) === 'none' && (await label(page, '.fx .w__label')) === 'Fixed · 02 / 03');
    await ctx.close();
  }
  for (const theme of ['dark', 'light']) {
    const { ctx, page } = await open({ preview: { fixed: BUGS }, width: 320, height: 760, hasTouch: true, isMobile: true });
    if (theme === 'light') { await toggleTheme(page); await sleep(300); }
    const fits = await page.locator('.fx').evaluate((e) => [...e.querySelectorAll('*')].every((c) => { const r = c.getBoundingClientRect(), t = e.getBoundingClientRect(); return r.width === 0 || (r.left >= t.left - 1 && r.right <= t.right + 1); }));
    check(`fixed at 320 (${theme}): everything inside the tile, no sideways scroll`, fits && !(await overflowX(page)));
    const nb = await page.getByRole('button', { name: 'Next bug' }).boundingBox();
    check(`fixed at 320 (${theme}): arrow targets ≥ 24 px`, nb.width >= 24 && nb.height >= 24, `${nb.width}×${nb.height}`);
    await page.locator('.wg--xray').screenshot({ path: path.join(out, `fixed-${theme}-320.png`) });
    if (theme === 'dark') {
      await page.getByRole('button', { name: 'Next bug' }).tap(); await sleep(400);
      await page.locator('.fx__more').tap(); await sleep(300);
      const sheet = await page.locator('dialog.fx-entry').boundingBox();
      check('fixed at 320: "Read more" is a bottom sheet', sheet && Math.abs(sheet.y + sheet.height - 760) < 2 && sheet.width >= 319, JSON.stringify(sheet));
      await page.screenshot({ path: path.join(out, 'fixed-sheet-320.png') });
    }
    await ctx.close();
  }

  /* ---- 3. Setup ---- */
  for (const theme of ['dark', 'light']) {
    const { ctx, page, errors, warnings } = await open({ preview: { setup: ITEMS } });
    if (theme === 'light') { await toggleTheme(page); await sleep(300); }
    check(`setup (${theme}): replaces the X-ray tile`, (await page.locator('.su').count()) === 1 && (await page.locator('.xr-tile').count()) === 0 && (await page.locator('[data-xray="setup"]').count()) === 1);
    if (theme === 'dark') {
      check('setup: label "Setup · 4 things"', (await label(page, '.su .w__label')) === 'Setup · 4 things');
      check('setup: one button per thing, named after it', (await page.getByRole('button', { name: 'Placeholder mouse' }).count()) === 1 && (await page.locator('.su__spot').count()) === 4);
      const names = await page.locator('.su__spot').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
      check('setup: Tab order is reading order', names.join('|') === 'Placeholder screen|Placeholder chair|Placeholder keyboard|Placeholder mouse', names.join(' → '));
      check('setup: the drawing is lines in --muted, 1–1.5 px', await page.locator('.su__art rect').first().evaluate((e) => { const s = getComputedStyle(e); return parseFloat(s.strokeWidth) >= 1 && parseFloat(s.strokeWidth) <= 1.5 && s.fill === 'none'; }));
      check('setup: the dots pulse', (await page.locator('.su__spot > span').first().evaluate((e) => getComputedStyle(e, '::after').animationName)) === 'su-pulse');
      await page.getByRole('button', { name: 'Placeholder keyboard' }).click(); await sleep(100);
      const cap = await page.locator('.su__cap').textContent();
      check('setup: a dot shows its name and use in the caption', cap.includes('Placeholder keyboard') && cap.includes('Placeholder use two'), cap);
      check('setup: the caption is a polite live region', (await page.locator('.su__cap').getAttribute('aria-live')) === 'polite');
      check('setup: the chosen dot is pressed', (await page.getByRole('button', { name: 'Placeholder keyboard' }).getAttribute('aria-pressed')) === 'true');
      await page.keyboard.press('Escape'); await sleep(100);
      check('setup: Esc clears the caption', !(await page.locator('.su__cap').textContent()).includes('Placeholder'));
      await page.getByRole('button', { name: 'Placeholder screen' }).focus();
      await page.keyboard.press('Tab');
      check('setup: Tab moves to the next dot', (await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Placeholder chair');
      await page.keyboard.press('Enter'); await sleep(100);
      check('setup: Enter on a dot works too', (await page.locator('.su__cap').textContent()).includes('Placeholder use four'));
      check('setup: a dot shows a focus ring', await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
      check('setup: the placeholder dots are all over the drawing (no dev warning)', warnings.length === 0, warnings.join(' | '));
    }
    for (const sel of ['.su .w__label', '.su__cap']) {
      const c = await contrast(page, sel);
      check(`setup (${theme}): ${sel} contrast ≥ 4.5:1`, c >= 4.5, c.toFixed(2));
    }
    await page.locator('.wg--xray').screenshot({ path: path.join(out, `setup-${theme}-1440.png`) });
    check(`setup (${theme}): no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ preview: { setup: ITEMS.slice(0, 2) } });
    check('setup: fewer than 3 items → X-ray stays', (await page.locator('.xr-tile').count()) === 1 && (await page.locator('.su').count()) === 0);
    await ctx.close();
  }
  {
    const { ctx, warnings } = await open({ preview: { setup: [...ITEMS.slice(0, 3), { id: 'off', name: 'Placeholder off', use: 'x', x: 95, y: 15 }] } });
    check('setup: a dot over nothing drawn is reported in development', warnings.some((w) => w.includes('off (95, 15)')), warnings.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ preview: { setup: ITEMS }, reducedMotion: 'reduce' });
    check('setup: reduced motion → no pulse', (await page.locator('.su__spot > span').first().evaluate((e) => getComputedStyle(e, '::after').animationName)) === 'none');
    await ctx.close();
  }
  for (const theme of ['dark', 'light']) {
    const { ctx, page } = await open({ preview: { setup: ITEMS }, width: 320, height: 760, hasTouch: true, isMobile: true });
    if (theme === 'light') { await toggleTheme(page); await sleep(300); }
    const sizes = await page.locator('.su__spot').evaluateAll((b) => b.map((x) => { const r = x.getBoundingClientRect(); return [r.width, r.height]; }));
    check(`setup at 320 (${theme}): every dot is a ≥ 24 × 24 target`, sizes.every(([w, h]) => w >= 24 && h >= 24), JSON.stringify(sizes));
    check(`setup at 320 (${theme}): no sideways scroll`, !(await overflowX(page)));
    await page.getByRole('button', { name: 'Placeholder mouse' }).tap(); await sleep(100);
    check(`setup at 320 (${theme}): a tap shows the caption (no hover needed)`, (await page.locator('.su__cap').textContent()).includes('Placeholder use three'));
    await page.locator('.wg--xray').screenshot({ path: path.join(out, `setup-${theme}-320.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
