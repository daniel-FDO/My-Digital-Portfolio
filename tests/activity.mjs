/* node tests/activity.mjs [url]     (default http://localhost:5174/, the dev server)
   The Activity dashboard (components/activity/Activity.tsx) in headless Microsoft Edge:
   - GitHub still shows live data; the old summary / stats column is gone
   - the Claude Code card shows exactly what /api/claude-usage serves (totals, this month,
     input, output; the heatmap's day counts) — compared number for number
   - every state of the Claude card: live, stale (collector not running), not connected,
     unavailable, network failure, and offline after it had loaded
   - layout: two equal cards side by side on desktop, stacked on narrow screens;
     no horizontal overflow; both themes; no console errors
   Results: console + review/activity/activity.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] || 'http://localhost:5174/';
const out = path.join(root, 'review', 'activity');
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ignorable = (t) => /Failed to load resource|api\/now-playing/.test(t);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function open({ viewport = { width: 1440, height: 1000 }, route, theme } = {}) {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  if (route) await ctx.route('**/api/claude-usage', route);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#activity', { timeout: 30000 });
  if (theme) await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.evaluate(() => document.getElementById('activity').scrollIntoView());
  await page.waitForFunction(() => [...document.querySelectorAll('#activity .act__badge')].every((b) => b.textContent !== 'Loading'), null, { timeout: 20000 }).catch(() => {});
  await sleep(400);
  return { ctx, page, errors };
}
const claude = (page) => page.evaluate(() => {
  const card = document.querySelector('.act__claude');
  return {
    badge: card.querySelector('.act__badge').textContent, fresh: card.querySelector('.act__badge').classList.contains('is-fresh'),
    empty: card.querySelector('.act__emptyTitle')?.textContent ?? null,
    nums: [...card.querySelectorAll('.act__nums dd')].map((d) => d.title),
    cells: [...card.querySelectorAll('.act__cell')].map((c) => c.getAttribute('aria-label')),
  };
});
const sample = (days, collectedAt, extra = {}) => ({ days, collectedAt, timezone: 'Europe/London', live: false, fetchedAt: new Date().toISOString(), ...extra });

try {
  // ---- real data, desktop ----
  {
    const { ctx, page, errors } = await open();
    const api = await page.evaluate(() => fetch('/api/claude-usage').then((r) => r.json()));
    const gh = await page.evaluate(() => {
      const card = document.querySelectorAll('#activity .act__panel')[0];
      return { badge: card.querySelector('.act__badge').textContent, fresh: card.querySelector('.act__badge').classList.contains('is-fresh'), cells: card.querySelectorAll('.act__cell').length, months: card.querySelectorAll('.act__bar').length };
    });
    check('GitHub card: live GitHub data (heatmap + months)', gh.cells > 360 && gh.months >= 12 && /Updated|Cached/.test(gh.badge), JSON.stringify(gh));
    check('the old summary / stats column is gone (not just hidden)', (await page.locator('.act__summary, .act__stats, .act__side, .act__stat').count()) === 0);
    const c = await claude(page);
    // what the card should say, worked out from the endpoint's own answer over the card's period
    const range = await page.evaluate(() => document.querySelector('#clRange').textContent);
    // the squares are listed row by row (one row per weekday): the period is their earliest → latest date
    const dayOf = (label) => new Date(label.split(' on ')[1] + ' UTC').toISOString().slice(0, 10);
    const dates = c.cells.map(dayOf).sort();
    const from = dates[0], to = dates.at(-1);
    const inRange = api.days.filter((d) => d.date >= from && d.date <= to);
    const sum = (k, l = inRange) => l.reduce((n, d) => n + d[k], 0);
    const nf = new Intl.NumberFormat('en-GB');
    const want = [sum('total'), sum('total', inRange.filter((d) => d.date.startsWith(to.slice(0, 7)))), sum('input'), sum('output')].map((n) => nf.format(n));
    const got = c.nums.map((t) => t.match(/^[\d,]+/)?.[0]);
    check('Claude card: totals agree with the source data exactly (total, this month, input, output)', JSON.stringify(got) === JSON.stringify(want), `card ${got.join(' / ')} · source ${want.join(' / ')} (${range})`);
    check('Claude totals: input + output + cache = total for every day (no double counting)', api.days.every((d) => d.input + d.output + d.cacheWrite + d.cacheRead === d.total));
    // every day the source has in the period appears in the heatmap with its exact count
    const cellMap = new Map(c.cells.map((l) => [dayOf(l), l.split(' on ')[0]]));
    const wrong = inRange.filter((d) => cellMap.get(d.date) !== (d.total === 0 ? 'No tokens' : `${nf.format(d.total)} token${d.total === 1 ? '' : 's'}`)).map((d) => d.date);
    check(`Claude heatmap: every day's square carries its exact token count (${inRange.length} days with data)`, wrong.length === 0 && c.cells.length > 360, wrong.slice(0, 5).join(', '));
    check('Claude card: live badge while the collector runs', api.live ? c.fresh && /Live/.test(c.badge) : !c.fresh, c.badge);
    // a square's tooltip shows the date and the exact count
    const lastBox = await page.locator('.act__claude .act__cell').last().boundingBox();
    await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2);
    await sleep(250);
    const tipText = await page.evaluate(() => document.querySelector('.mini-tip')?.textContent ?? '');
    check('hovering a Claude square shows its date and exact token count', /tokens? · \d{1,2} \w+ \d{4}/.test(tipText) || /No tokens · /.test(tipText), tipText);
    const geo = await page.evaluate(() => [...document.querySelectorAll('#activity .act__panel')].map((c) => { const r = c.getBoundingClientRect(); return { l: r.left, w: r.width, h: r.height }; }));
    check('desktop: two equal cards side by side, same height', Math.abs(geo[0].w - geo[1].w) < 1 && geo[1].l > geo[0].l + geo[0].w && Math.abs(geo[0].h - geo[1].h) < 1, JSON.stringify(geo));
    check('desktop: no horizontal overflow; no console errors', (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) && errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // ---- states ----
  const today = new Date().toISOString().slice(0, 10);
  const day1 = { date: today, input: 10, output: 20, cacheWrite: 30, cacheRead: 40, total: 100 };
  const states = [
    ['stale (collector not running)', (r) => r.fulfill({ json: sample([day1], new Date(Date.now() - 3 * 3600e3).toISOString()) }), (c) => !c.fresh && /Last synced 3 h ago/.test(c.badge) && c.nums.length === 4],
    ['not connected (nothing published yet)', (r) => r.fulfill({ status: 503, json: { reason: 'not-configured' } }), (c) => c.badge === 'Not connected' && c.empty === 'Not connected yet.' && c.cells.length === 0],
    ['unavailable (server error)', (r) => r.fulfill({ status: 503, json: { reason: 'unavailable' } }), (c) => c.badge === 'Unavailable' && c.empty === 'Unavailable right now.' && c.cells.length === 0],
    ['network failure', (r) => r.abort(), (c) => c.badge === 'Unavailable' && c.cells.length === 0],
    ['empty history (connected, no usage yet)', (r) => r.fulfill({ json: sample([], new Date().toISOString(), { live: true }) }), (c) => c.fresh && c.nums.every((t) => /^No tokens/.test(t) || /^0/.test(t)) && c.cells.every((l) => l.startsWith('No tokens'))],
  ];
  for (const [name, route, ok] of states) {
    const { ctx, page, errors } = await open({ route });
    const c = await claude(page);
    const gh = await page.evaluate(() => document.querySelectorAll('#activity .act__panel')[0].querySelectorAll('.act__cell').length);
    check(`state: ${name}`, ok(c) && gh > 360 && errors.length === 0, `${c.badge}${c.empty ? ' · ' + c.empty : ''}${errors.length ? ' · ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  // offline after loading: the numbers stay, the badge says so
  {
    let fail = false;
    const { ctx, page } = await open({ route: (r) => (fail ? r.abort() : r.fulfill({ json: sample([day1], new Date().toISOString(), { live: true }) })) });
    const before = await claude(page);
    fail = true;
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(1200);
    const after = await claude(page);
    check('state: offline after it had loaded — keeps the numbers, says "Offline"', before.fresh && /^Offline/.test(after.badge) && !after.fresh && after.nums.join() === before.nums.join(), after.badge);
    await ctx.close();
  }
  // ---- themes and widths ----
  for (const [w, h] of [[768, 1100], [390, 844]]) for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, theme });
    const geo = await page.evaluate(() => [...document.querySelectorAll('#activity .act__panel')].map((c) => { const r = c.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; }));
    const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${w} ${theme}: cards stacked, full width, no overflow`, geo[0].l === geo[1].l && geo[1].t > geo[0].t && geo[0].w === geo[1].w && o <= 0 && errors.length === 0, JSON.stringify(geo));
    await page.locator('#activity').screenshot({ path: path.join(out, `activity-${w}-${theme}.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'activity.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} activity checks passed`);
  process.exitCode = failed ? 1 : 0;
}
