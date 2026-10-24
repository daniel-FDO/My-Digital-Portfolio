import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const out = 'review/gallery-carousel';
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(name, pass) { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); }
try {
  for (const width of [1440, 768, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:5173/?gallery-debug');
    await page.locator('#gallery').scrollIntoViewIfNeeded();
    await page.waitForSelector('.gal__stage.is-live');
    await page.getByRole('button', { name: 'Pause the slideshow' }).click();
    const rest = () => page.waitForFunction(() => Math.abs(window.__gallery.pos - window.__gallery.target) < .001);
    await rest();
    check(`${width}: cards and controls fit`, await page.evaluate(() => {
      const r = document.querySelector('.gal__card.is-centre').getBoundingClientRect();
      const pill = document.querySelector('.gal__pill').getBoundingClientRect();
      const frame = document.querySelector('.gal__frame').getBoundingClientRect();
      return r.width > 150 && r.width < innerWidth && r.top >= frame.top && r.bottom <= frame.bottom && pill.left >= 0 && pill.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
    }));
    const index = () => page.evaluate(() => window.__gallery.index);
    const initial = await index();
    await page.getByRole('button', { name: 'Next photo', exact: true }).click();
    await rest();
    check(`${width}: Next changes photo`, await index() === (initial + 1) % 11);
    await page.locator('.gal__plate').focus();
    await page.keyboard.press('ArrowLeft'); await rest();
    check(`${width}: keyboard previous`, await index() === initial);
    const y = await page.evaluate(() => scrollY);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.gpv');
    check(`${width}: preview opens and isolates page`, await page.evaluate(() => document.getElementById('root').inert));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gpv', { state: 'detached' });
    check(`${width}: preview restores focus and scroll`, await page.evaluate(y => scrollY === y && document.activeElement.classList.contains('gal__plate') && !document.getElementById('root').inert, y));
    const r = await page.locator('.gal__card.is-centre').boundingBox();
    await page.mouse.move(r.x + r.width * .8, r.y + r.height / 2); await page.mouse.down();
    await page.mouse.move(r.x + r.width * .1, r.y + r.height / 2, { steps: 12 }); await page.mouse.up(); await rest();
    check(`${width}: dragging changes photo without opening preview`, await index() !== initial && await page.locator('.gpv').count() === 0);
    if (width === 390) {
      const cdp = await context.newCDPSession(page);
      const box = await page.locator('.gal__plate').boundingBox();
      const swipe = async (dx, dy) => {
        const x = box.x + box.width * .75, y = box.y + box.height * .65;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let k = 1; k <= 10; k++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * k / 10, y: y + dy * k / 10 }] });
          await page.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      const before = await index(); await swipe(-180, 0); await rest();
      check('touch swipe changes photo', await index() !== before && await page.locator('.gpv').count() === 0);
      const scroll = await page.evaluate(() => scrollY); await swipe(0, -160); await page.waitForTimeout(400);
      check('vertical touch scrolls page', await page.evaluate(() => scrollY) > scroll + 30);
      await page.locator('#gallery').scrollIntoViewIfNeeded();
    }
    await page.getByRole('button', { name: 'Show photo 11', exact: true }).click(); await rest();
    check(`${width}: thumbnail selects the last photo`, await index() === 10 && await page.getByRole('button', { name: 'Show photo 11', exact: true }).getAttribute('aria-pressed') === 'true');
    await page.getByRole('button', { name: 'Next photo', exact: true }).click(); await rest();
    check(`${width}: next wraps to first photo`, await index() === 0);
    await page.getByRole('button', { name: 'View photo', exact: false }).click();
    await page.waitForSelector('.gpv');
    check(`${width}: View photo opens current image`, await page.locator('.gpv').getAttribute('aria-label') === 'Photo 1 of 11');
    await page.keyboard.press('Escape'); await page.waitForSelector('.gpv', { state: 'detached' });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.locator('#gallery').screenshot({ path: `${out}/${width}-${theme}.png` });
    }
    check(`${width}: no page errors`, errors.length === 0);
    await context.close();
  }
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('http://localhost:5173/?gallery-debug');
  await page.locator('#gallery').scrollIntoViewIfNeeded(); await page.waitForSelector('.gal__stage.is-live');
  check('reduced motion starts paused', await page.getByRole('button', { name: 'Play the slideshow' }).isVisible());
  await page.getByRole('button', { name: 'Next photo', exact: true }).click();
  await page.waitForFunction(() => window.__gallery.pos === 1);
  check('reduced motion changes directly to next photo', await page.evaluate(() => window.__gallery.pos === window.__gallery.target));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Pause the slideshow' }).click();
  await page.getByRole('button', { name: 'Play the slideshow' }).click();
  await page.waitForFunction(() => window.__gallery.index !== 1, null, { timeout: 8000 });
  check('autoplay advances after Play', true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(500);
  check('offscreen autoplay is suspended', await page.evaluate(() => !window.__gallery.armed && !window.__gallery.running));
  const fallback = await browser.newPage();
  await fallback.route('**/images/**', route => route.abort());
  await fallback.goto('http://localhost:5173/');
  await fallback.locator('#gallery').scrollIntoViewIfNeeded();
  await fallback.waitForSelector('.gal__stage.is-fallback');
  check('image failure exposes plain gallery', await fallback.locator('.gal__open').count() === 11);
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
}
if (results.some(r => !r.pass)) process.exitCode = 1;
