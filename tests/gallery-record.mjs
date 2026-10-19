/* node tests/gallery-record.mjs [url]   (default http://localhost:5173/)
   A short recording of the Gallery in headless Microsoft Edge (real GPU), 1440 × 900:
   1. photos emerging on the left and sinking away on the right (drift, then a reverse drag)
   2. opening a photo and moving through the preview
   3. closing it: the same place on the page, the same photo in the middle
   4. the background's slow motion (shown sped up 20×; captioned)
   A caption and a pointer dot are drawn into the page (the screencast has no cursor).
   Output: review/gallery/gallery.mp4 (needs ffmpeg on PATH) */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = (process.argv[2] || 'http://localhost:5173/') + '?gallery-debug';
const outDir = path.join(root, 'review', 'gallery');
const tmp = path.join(outDir, '.video');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const size = { width: 1440, height: 900 };
const ctx = await browser.newContext({ viewport: size });
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;padding:7px 14px;border-radius:999px;background:#f4efe8;color:#111;font:600 14px system-ui;box-shadow:0 2px 12px #0006;pointer-events:none;white-space:nowrap';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#e8604c;border:2px solid #fff;z-index:99999;pointer-events:none;left:-20px;top:-20px';
    document.documentElement.append(cap, dot);
    addEventListener('pointermove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  });
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => document.getElementById('gallery').scrollIntoView({ block: 'center' }));
await page.waitForSelector('.gal__stage.is-live', { timeout: 20000 });
await sleep(2500);

const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(tmp, name), Buffer.from(data, 'base64'));
  frames.push({ name, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
const say = (t) => page.evaluate((t) => { const c = document.getElementById('__cap'); if (c) c.textContent = t; }, t);
const box = await page.locator('.gal__canvas').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
await say('1 · Photos emerge on the left, sink away on the right');
await sleep(6000);
await say('1 · Dragging back: the edges follow each photo\'s position');
await page.mouse.move(cx - 260, cy, { steps: 6 });
await page.mouse.down();
await page.mouse.move(cx + 300, cy, { steps: 40 });
await page.mouse.up();
await sleep(2500);
await page.mouse.move(cx + 300, cy); await page.mouse.down(); await page.mouse.move(cx - 300, cy, { steps: 40 }); await page.mouse.up();
await sleep(2500);

await say('2 · Click a photo: it opens flat and whole; the site behind is dimmed and blurred');
const y0 = await page.evaluate(() => scrollY);
const mid = await page.evaluate(() => { const g = window.__gallery, w = document.querySelector('.gal__canvas').clientWidth; let best = null; for (let k = 0; k < g.count; k++) { const c = g.centreOf(k); if (c && (!best || Math.abs(c.x - w / 2) < Math.abs(best.x - w / 2))) best = c; } return best; });
await page.mouse.move(box.x + mid.x, box.y + mid.y, { steps: 12 });
await sleep(400);
await page.mouse.click(box.x + mid.x, box.y + mid.y);
await sleep(1800);
await say('2 · Next / Previous (buttons, ← →, swipe)');
await page.keyboard.press('ArrowRight'); await sleep(1300);
await page.keyboard.press('ArrowRight'); await sleep(1300);
const next = page.getByRole('button', { name: 'Next photo' }).last();
const nb = await next.boundingBox();
await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2, { steps: 10 });
await next.click(); await sleep(1300);
await page.keyboard.press('ArrowLeft'); await sleep(1300);

await say('3 · Close: the same place on the page, the same photo in the middle');
const cl = page.getByRole('button', { name: 'Close preview' });
const cb = await cl.boundingBox();
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2, { steps: 10 });
await cl.click();
await sleep(2200);
const y1 = await page.evaluate(() => scrollY);

await say('4 · The background: broad, faint colour drifting slowly (shown 20× faster)');
await page.mouse.move(cx, 80, { steps: 6 });
await page.evaluate(() => { scrollTo({ top: 0, behavior: 'instant' }); document.getAnimations().forEach((a) => { if (String(a.animationName || '').startsWith('pbg-air')) a.playbackRate = 20; }); });
await sleep(7000);
await say('4 · …and at its real speed');
await page.evaluate(() => document.getAnimations().forEach((a) => { if (String(a.animationName || '').startsWith('pbg-air')) a.playbackRate = 1; }));
await sleep(2500);

await cdp.send('Page.stopScreencast');
await ctx.close();
await browser.close();
const list = frames.map((fr, i) => `file '${fr.name}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? fr.t + 0.1) - fr.t).toFixed(4)}`).join('\n');
fs.writeFileSync(path.join(tmp, 'list.txt'), `${list}\nfile '${frames.at(-1).name}'\n`);
const mp4 = path.join(outDir, 'gallery.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
  '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', mp4]);
fs.rmSync(tmp, { recursive: true, force: true });
const secs = frames.at(-1).t - frames[0].t;
console.log(`recording → ${path.relative(root, mp4)} (${frames.length} frames over ${secs.toFixed(1)} s, ~${(frames.length / secs).toFixed(0)} fps captured); scroll before / after the preview: ${y0} / ${y1}`);
