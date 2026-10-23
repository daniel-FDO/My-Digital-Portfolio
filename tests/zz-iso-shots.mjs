// scratch: screenshots of the plate at rest and mid-tide, both themes, three widths
import { chromium } from 'playwright-core';
const out = process.argv[2];
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/|Failed to load/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://localhost:5173/?gallery-debug', { waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('gallery').scrollIntoView({ block: 'center' }));
  await page.waitForSelector('.gal__stage.is-live', { timeout: 15000 });
  await page.waitForFunction(() => window.__gallery.mapsReady >= 11, null, { timeout: 15000 });
  // pause autoplay so we control it
  const pause = page.getByRole('button', { name: 'Pause the slideshow' });
  if (await pause.isVisible()) await pause.click();
  for (const theme of ['dark', 'light']) {
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) { await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).first().click(); await page.waitForTimeout(300); }
    await page.waitForTimeout(500);
    const stage = page.locator('.gal__stage');
    await stage.screenshot({ path: `${out}/${theme}-${w}-rest.png` });
    await page.getByRole('button', { name: 'Next photo' }).click();
    for (const ms of [300, 340, 400]) { await page.waitForTimeout(ms); await stage.screenshot({ path: `${out}/${theme}-${w}-t${ms}.png` }); console.log(w, theme, ms, await page.evaluate(() => [window.__gallery.phase, window.__gallery.t.toFixed(2)].join(' '))); }
    await page.waitForTimeout(1200);
  }
  console.log(w, 'errors:', errs.join(' | ') || 'none');
  await ctx.close();
}
await b.close();
