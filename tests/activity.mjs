/* node tests/activity.mjs [url]     (default http://localhost:5174/, the dev server)
   The Activity section (components/activity/Activity.tsx) in headless Microsoft Edge:
   - one card with a GitHub | Claude Code switcher (tabs, arrow keys); GitHub shows live data
   - the Claude Code panel shows exactly what /api/claude-usage serves (total, input,
     output, active days; the heatmap's day counts) — compared number for number
   - picking a month narrows the figures to that month and fades the other days
   - every state of the Claude panel: live, stale (collector not running), not connected,
     unavailable, network failure, and offline after it had loaded
   - layout: no horizontal overflow at desktop / tablet / phone widths; both themes;
     no console errors
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
  // both sources finished loading (the badge only shows the selected one: look at the panels)
  await page.waitForFunction(() => [...document.querySelectorAll('#activity .act__panel')].every((p) => !p.querySelector('.act__skeleton')), null, { timeout: 20000 }).catch(() => {});
  await sleep(400);
  return { ctx, page, errors };
}
const showClaude = async (page) => { await page.click('#actTab-cl'); await sleep(150); };
const claude = (page) => page.evaluate(() => {
  const card = document.querySelector('.act__claude');
  const badge = document.querySelector('#activity .act__badge');
  return {
    badge: badge.textContent, fresh: badge.classList.contains('is-fresh'),
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
      const card = document.querySelector('#actPanel-gh');
      return { badge: document.querySelector('#activity .act__badge').textContent, cells: card.querySelectorAll('.act__cell').length, months: card.querySelectorAll('.act__bar').length, nums: card.querySelectorAll('.act__nums dd').length };
    });
    check('GitHub (selected first): live GitHub data (figures + heatmap + months)', gh.cells > 360 && gh.months >= 12 && gh.nums === 4 && /Updated|Cached/.test(gh.badge), JSON.stringify(gh));
    check('one card, a two-tab switcher; only the selected panel is shown', await page.evaluate(() =>
      document.querySelectorAll('#activity .act__card').length === 1 && document.querySelectorAll('#activity [role="tab"]').length === 2
      && document.querySelector('#actTab-gh').getAttribute('aria-selected') === 'true' && document.querySelector('#actPanel-cl').hidden));
    // the switcher by keyboard
    await page.focus('#actTab-gh');
    await page.keyboard.press('ArrowRight');
    await sleep(150);
    check('switcher: → moves to Claude Code and shows its panel', await page.evaluate(() =>
      document.activeElement?.id === 'actTab-cl' && document.querySelector('#actTab-cl').getAttribute('aria-selected') === 'true'
      && !document.querySelector('#actPanel-cl').hidden && document.querySelector('#actPanel-gh').hidden));
    const c = await claude(page);
    // what the panel should say, worked out from the endpoint's own answer over the panel's period
    const range = await page.evaluate(() => document.querySelector('#clRange').textContent);
    // the squares are listed row by row (one row per weekday): the period is their earliest → latest date
    const dayOf = (label) => new Date(label.split(' on ')[1] + ' UTC').toISOString().slice(0, 10);
    const dates = c.cells.map(dayOf).sort();
    const from = dates[0], to = dates.at(-1);
    const inRange = api.days.filter((d) => d.date >= from && d.date <= to);
    const sum = (k, l = inRange) => l.reduce((n, d) => n + d[k], 0);
    const nf = new Intl.NumberFormat('en-GB');
    const want = [sum('total'), sum('input'), sum('output'), inRange.filter((d) => d.total > 0).length].map((n) => nf.format(n));
    const got = c.nums.map((t) => t.match(/^[\d,]+/)?.[0]);
    check('Claude panel: figures agree with the source data exactly (total, input, output, active days)', JSON.stringify(got) === JSON.stringify(want), `panel ${got.join(' / ')} · source ${want.join(' / ')} (${range})`);
    check('Claude totals: input + output + cache = total for every day (no double counting)', api.days.every((d) => d.input + d.output + d.cacheWrite + d.cacheRead === d.total));
    // every day the source has in the period appears in the heatmap with its exact count
    const cellMap = new Map(c.cells.map((l) => [dayOf(l), l.split(' on ')[0]]));
    const wrong = inRange.filter((d) => cellMap.get(d.date) !== (d.total === 0 ? 'No tokens' : `${nf.format(d.total)} token${d.total === 1 ? '' : 's'}`)).map((d) => d.date);
    check(`Claude heatmap: every day's square carries its exact token count (${inRange.length} days with data)`, wrong.length === 0 && c.cells.length > 360, wrong.slice(0, 5).join(', '));
    check('Claude: live badge while the collector runs', api.live ? c.fresh && /Live/.test(c.badge) : !c.fresh, c.badge);
    // a square's tooltip shows the date and the exact count
    const lastBox = await page.locator('.act__claude .act__cell').last().boundingBox();
    await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2);
    await sleep(250);
    const tipText = await page.evaluate(() => document.querySelector('.mini-tip')?.textContent ?? '');
    check('hovering a Claude square shows its date and exact token count', /tokens? · \d{1,2} \w+ \d{4}/.test(tipText) || /No tokens · /.test(tipText), tipText);
    // pick a month: the figures cover only it, the other days fade, the strip says which is picked
    const bars = page.locator('#actPanel-cl .act__bar');
    const n = await bars.count();
    await bars.nth(n - 2).click();
    await sleep(200);
    const picked = await page.evaluate(() => {
      const p = document.querySelector('#actPanel-cl');
      const b = [...p.querySelectorAll('.act__bar')];
      return {
        key: b.findIndex((x) => x.getAttribute('aria-pressed') === 'true'),
        dim: p.querySelectorAll('.act__cell.is-dim').length, all: p.querySelectorAll('.act__cell').length,
        total: p.querySelector('.act__nums dd').title, label: p.querySelector('.act__scope .act__label').textContent,
      };
    });
    const mKey = [...new Set(dates.map((d) => d.slice(0, 7)))][n - 2];
    const mSum = sum('total', inRange.filter((d) => d.date.startsWith(mKey)));
    check('month filter: picked month is pressed, other days fade, total = that month only',
      picked.key === n - 2 && picked.dim > 300 && picked.dim < picked.all && picked.total.startsWith(mSum === 0 ? 'No tokens' : nf.format(mSum)),
      `${picked.label} · ${picked.total} (want ${nf.format(mSum)})`);
    await page.click('#actPanel-cl .act__reset');
    await sleep(150);
    check('month filter: "All months" clears it', await page.evaluate(() =>
      document.querySelectorAll('#actPanel-cl .act__cell.is-dim').length === 0 && !document.querySelector('#actPanel-cl [aria-pressed="true"]')));
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
    const gh = await page.evaluate(() => document.querySelector('#actPanel-gh').querySelectorAll('.act__cell').length);
    await showClaude(page);
    const c = await claude(page);
    check(`state: ${name}`, ok(c) && gh > 360 && errors.length === 0, `${c.badge}${c.empty ? ' · ' + c.empty : ''}${errors.length ? ' · ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  // offline after loading: the numbers stay, the badge says so
  {
    let fail = false;
    const { ctx, page } = await open({ route: (r) => (fail ? r.abort() : r.fulfill({ json: sample([day1], new Date().toISOString(), { live: true }) })) });
    await showClaude(page);
    const before = await claude(page);
    fail = true;
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(1200);
    const after = await claude(page);
    check('state: offline after it had loaded — keeps the numbers, says "Offline"', before.fresh && /^Offline/.test(after.badge) && !after.fresh && after.nums.join() === before.nums.join(), after.badge);
    await ctx.close();
  }
  // ---- themes and widths ----
  for (const [w, h] of [[1440, 1000], [768, 1100], [390, 844], [320, 700]]) for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await open({ viewport: { width: w, height: h }, theme });
    const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    // nothing in the card sticks out of it (the heatmap may scroll inside its own box)
    const spill = () => page.evaluate(() => {
      const card = document.querySelector('#activity .act__card').getBoundingClientRect();
      return [...document.querySelectorAll('#activity .act__tools > *, #activity .act__nums, #activity .act__bars, #activity .act__scroll')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < card.left - 1 || r.right > card.right + 1); })
        .map((e) => e.className);
    });
    const s1 = await spill();
    await page.locator('#activity').screenshot({ path: path.join(out, `activity-${w}-${theme}-gh.png`) });
    await showClaude(page);
    const s2 = await spill();
    await page.locator('#activity').screenshot({ path: path.join(out, `activity-${w}-${theme}-cl.png`) });
    check(`${w} ${theme}: no overflow (page or card), both sources`, o <= 0 && !s1.length && !s2.length && errors.length === 0, [...s1, ...s2, ...errors].join(', '));
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'activity.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} activity checks passed`);
  process.exitCode = failed ? 1 : 0;
}
