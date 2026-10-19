/* =========================================================
   RENDER — turns the films into stills, MP4s and posters.
     node video/render.mjs stills <slug> [t,t,…]   → video/stills/<slug>-<t>.png
     node video/render.mjs video [slug …]          → public/previews/video/<slug>.mp4 + .jpg
   Every frame is drawn by the film page's seek(t) on the real GPU (Edge,
   ANGLE / D3D11), screenshotted and piped into ffmpeg:
   1280 × 800, 30 fps, H.264 (yuv420p, +faststart), no audio.
   The poster is the film's composed end card, as a sharp JPEG.
   ========================================================= */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = 'video', ...rest] = process.argv.slice(2);
const ALL = fs.readdirSync(path.join(here, 'storyboards')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4));
const OUT = path.join(here, '..', 'public', 'previews', 'video');
const STILLS = path.join(here, 'stills');
const CRF = process.env.CRF ?? '23';

const server = await serve(4797);
const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

async function open(slug, sub = 4) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`  [${slug}] ${e.message}`));
  await page.goto(`${server.url}video/film/index.html?slug=${slug}&sub=${sub}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const info = await page.evaluate(() => window.film);
  console.log(`[${slug}] ${info.duration}s · motion blur ×${info.motionBlur} · GPU: ${info.renderer}`);
  return { page, info };
}

if (mode === 'stills') {
  const [slug, times] = rest;
  fs.mkdirSync(STILLS, { recursive: true });
  const { page, info } = await open(slug);
  const ts = times ? times.split(',').map(Number) : [0, 1.6, 2.5, 5, 6.5, 9.3, 11];
  for (const t of ts) {
    await page.evaluate((t) => window.seek(t), Math.min(t, info.duration));
    await page.screenshot({ path: path.join(STILLS, `${slug}-${t.toFixed(2)}.png`) });
  }
  console.log(`  stills: ${ts.join(', ')}`);
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const slug of rest.length ? rest : ALL) {
    const { page, info } = await open(slug);
    const file = path.join(OUT, `${slug}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
    const frames = Math.round(info.duration * info.fps);
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.seek(t), i / info.fps);
      const png = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write(`  frame ${i}/${frames}\r`);
    }
    ff.stdin.end();
    await done;
    await page.evaluate((t) => window.seek(t), info.poster);
    await page.screenshot({ path: path.join(OUT, `${slug}.jpg`), type: 'jpeg', quality: 88 });
    const mb = (fs.statSync(file).size / 1e6).toFixed(2);
    console.log(`  → ${path.relative(path.join(here, '..'), file)} (${frames} frames, ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s) + poster`);
    await page.close();
  }
}
await browser.close();
server.close();
