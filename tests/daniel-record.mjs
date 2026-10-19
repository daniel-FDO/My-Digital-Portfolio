/* node tests/daniel-record.mjs [url]   (default http://localhost:5173/)
   Records the portfolio's name card in headless Microsoft Edge (real GPU): hover in and out,
   the action menu (pointer and keyboard), and every action. A caption and a pointer dot are
   drawn into the page (the recording has no cursor); the video is cropped around the card.
   Frames come from the browser's screencast with their timestamps; ffmpeg (on PATH) encodes.
   Output: review/daniel-card/interaction.mp4 */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] || 'http://localhost:5173/';
const outDir = path.join(root, 'review', 'daniel-card');
const tmp = path.join(outDir, '.video');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const size = { width: 1280, height: 800 };
const ctx = await browser.newContext({ viewport: size });
await ctx.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.style.cssText = 'position:fixed;z-index:9999;padding:6px 12px;border-radius:999px;background:#f4efe8;color:#111;font:600 14px system-ui;box-shadow:0 2px 12px #0006;pointer-events:none';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#e8604c;border:2px solid #fff;z-index:9999;pointer-events:none;left:-20px;top:-20px';
    document.body.append(cap, dot);
    addEventListener('pointermove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
  });
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
const card = page.locator('.wg--name');
await card.scrollIntoViewIfNeeded();
await page.evaluate(() => { const r = document.querySelector('.wg--name').getBoundingClientRect(); scrollBy(0, r.top - 300); });
await page.waitForSelector('.dnc--live', { timeout: 40000 });
await page.mouse.move(20, 20);
await sleep(1200);
const cb = await card.boundingBox();
// caption under the card; crop: the card with room above for the menu
await page.evaluate((y) => { const c = document.getElementById('__cap'); c.style.left = '50%'; c.style.transform = 'translateX(-50%)'; c.style.top = y + 'px'; }, cb.y + cb.height + 14);
const crop = { x: Math.max(0, Math.round(cb.x - 24)), y: Math.max(0, Math.round(cb.y - 260)), w: 0, h: 0 };
crop.w = Math.min(size.width - crop.x, Math.round(cb.width + 48)) & ~1;
crop.h = Math.min(size.height - crop.y, Math.round(cb.height + 260 + 64)) & ~1;
await page.evaluate((x) => { document.getElementById('__cap').style.left = x + 'px'; }, cb.x + cb.width / 2);

const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const f = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  frames.push({ f, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
const say = (t) => page.evaluate((t) => { const c = document.getElementById('__cap'); if (c) c.textContent = t; }, t);
const daniel = page.getByRole('button', { name: 'Wave to Daniel' });
const trig = page.getByRole('button', { name: 'Daniel’s actions' });
const idle = async () => { for (let i = 0; i < 200; i++) { if ((await page.evaluate(() => document.querySelector('.dnc').dataset.state)) === 'idle') return; await sleep(40); } };
const glide = async (x, y, n = 16) => page.mouse.move(x, y, { steps: n });

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
const box = await daniel.boundingBox();
await say('The name card: rounded, medium-weight type');
await sleep(1800);
await say('Hover over Daniel: he notices you');
await glide(box.x + box.width * 0.75, box.y + box.height * 0.35, 24);
await sleep(1600);
await glide(box.x + box.width * 0.3, box.y + box.height * 0.6, 20);
await sleep(1000);
await say('Pointer leaves: he relaxes');
await glide(cb.x + 80, cb.y + 40, 20);
await sleep(1600);

await say('Click Daniel: the one-hand wave');
await glide(box.x + box.width * 0.5, box.y + box.height * 0.55, 12);
await daniel.click();
await sleep(400);
await glide(cb.x + 120, cb.y + 60, 12);
await idle(); await sleep(400);

const tb = await trig.boundingBox();
for (const [name, label] of [['Wave both hands', 'Menu → Wave both hands'], ['Dance', 'Menu → Dance'], ['Nod', 'Menu → Nod'], ['Make a sound', 'Menu → Make a sound (a quiet chirp; audio not in this recording)']]) {
  await say(label);
  await glide(tb.x + tb.width / 2, tb.y + tb.height / 2, 14);
  await sleep(250);
  await trig.click();
  await sleep(700);
  const ib = await page.getByRole('menuitem', { name, exact: true }).boundingBox();
  await glide(ib.x + ib.width / 2, ib.y + ib.height / 2, 10);
  await sleep(300);
  await page.getByRole('menuitem', { name, exact: true }).click();
  await glide(cb.x + 120, cb.y + 60, 12);
  await sleep(300);
  await idle(); await sleep(500);
}

await say('Keyboard: Tab to the menu, arrows, Enter');
await trig.focus();
await sleep(500);
await page.keyboard.press('Enter'); await sleep(600);
await page.keyboard.press('ArrowDown'); await sleep(400);
await page.keyboard.press('ArrowDown'); await sleep(400);
await page.keyboard.press('ArrowDown'); await sleep(400);
await page.keyboard.press('Enter');
await idle(); await sleep(400);
await say('Escape closes the menu; focus goes back to the "…"');
await page.keyboard.press('Enter'); await sleep(900);
await page.keyboard.press('Escape'); await sleep(1300);
await say('While an action plays, the others are disabled');
await page.keyboard.press('ArrowUp'); await sleep(200);
await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter'); await sleep(500);
await trig.click(); await sleep(1600);
await page.keyboard.press('Escape');
await idle();
await say('Done');
await sleep(800);

await cdp.send('Page.stopScreencast');
await ctx.close();
await browser.close();
const fwd = (f) => f.split(path.sep).join('/');
const list = frames.map((fr, i) => `file '${fwd(fr.f)}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? fr.t + 0.1) - fr.t).toFixed(4)}`).join('\n');
const listFile = path.join(tmp, 'list.txt');
fs.writeFileSync(listFile, `${list}\nfile '${fwd(frames.at(-1).f)}'\n`);
const mp4 = path.join(outDir, 'interaction.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-vf', `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},fps=30`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4]);
fs.rmSync(tmp, { recursive: true, force: true });
const secs = frames.at(-1).t - frames[0].t;
console.log(`recording → ${path.relative(root, mp4)} (${frames.length} frames over ${secs.toFixed(1)} s, ~${(frames.length / secs).toFixed(0)} fps captured)`);
