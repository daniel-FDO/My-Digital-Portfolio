/* =========================================================
   CAPTURE — photographs each project's real website for its film.
     node video/capture.mjs [slug …]      (all projects if none given)
   For every panel in a storyboard's `capture` spec it:
     1. puts the page into that state (scroll, clicks — the site's own UI)
     2. screenshots the panel with the pieces that will lift hidden
     3. screenshots each piece alone on a transparent background
   and writes captures/<slug>/capture.json with every piece's position.
   1280 × 800 viewport, device scale 2 (sharp at any zoom in the film).
   ========================================================= */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL = fs.readdirSync(path.join(here, 'storyboards')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4));
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ISO_CSS = `
  html.__iso *, html.__iso *::before, html.__iso *::after { visibility: hidden !important; }
  html.__iso .__keep, html.__iso .__keep *, html.__iso .__keep *::before, html.__iso .__keep *::after { visibility: visible !important; }
  html.__iso .__keep .__hide, html.__iso .__keep .__hide * { visibility: hidden !important; }
  html.__iso, html.__iso body { background: transparent !important; }
  .__hide, .__hide * { visibility: hidden !important; }
`;

const server = await serve();                      // "local:" URLs → the projects in public/
const resolveUrl = (u) => (u.startsWith('local:') ? server.url + 'public/' + u.slice(6) : u);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const slug of slugs) {
  const { capture } = await import(pathToFileURL(path.join(here, 'storyboards', slug + '.mjs')).href);
  const out = path.join(here, 'captures', slug);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'pieces'), { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  console.log(`\n[${slug}] ${capture.url}`);
  await page.goto(resolveUrl(capture.url), { waitUntil: capture.waitUntil ?? 'load', timeout: 120000 });
  await wait(capture.settle ?? 2500);
  await page.addStyleTag({ content: ISO_CSS });
  if (capture.remove) await page.evaluate((s) => document.querySelectorAll(s).forEach((e) => e.remove()), capture.remove);
  if (capture.setup) await capture.setup(page, wait);

  const meta = { slug, url: capture.url, capturedAt: new Date().toISOString(), panels: [], pieces: [] };
  for (const panel of capture.panels) {
    if (panel.prepare) await panel.prepare(page, wait);
    await wait(panel.settle ?? 1200);
    if (capture.remove) await page.evaluate((s) => document.querySelectorAll(s).forEach((e) => e.remove()), capture.remove);
    const full = !!panel.fullPage;
    const origin = full ? { x: 0, y: 0 } : await page.evaluate(() => ({ x: scrollX, y: scrollY }));

    // Find the pieces and where they are (page coordinates)
    const handles = [];
    for (const piece of panel.pieces ?? []) {
      const loc = page.locator(piece.sel).nth(piece.nth ?? 0);
      if (!(await loc.count())) { console.warn(`  ! ${panel.id}/${piece.id}: "${piece.sel}" not found — skipped`); continue; }
      const h = await loc.elementHandle();
      const r = await h.evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; });
      handles.push({ piece, h, r });
    }

    // The panel, with its pieces hidden (they're drawn separately, lifted)
    for (const { h } of handles) await h.evaluate((e) => e.classList.add('__hide'));
    const size = full
      ? await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }))
      : { w: 1280, h: 800 };
    const file = `${panel.id}.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: full, animations: 'allow' });
    for (const { h } of handles) await h.evaluate((e) => e.classList.remove('__hide'));
    meta.panels.push({ id: panel.id, file, w: size.w, h: size.h });
    console.log(`  panel ${panel.id} ${size.w}×${size.h}`);

    // Each piece alone (other pieces inside it stay hidden)
    for (const { piece, h, r } of handles) {
      const others = handles.filter((o) => o.h !== h).map((o) => o.h);
      await h.evaluate((e, os) => { e.classList.add('__keep'); os.forEach((o) => { if (e.contains(o)) o.classList.add('__hide'); }); document.documentElement.classList.add('__iso'); }, others);
      const pfile = `pieces/${panel.id}--${piece.id}.png`;
      // A clip of the page, not an element screenshot: some pieces never stop moving
      // (floating chips, tilting frames) and an element screenshot waits for them to
      await page.screenshot({ path: path.join(out, pfile), omitBackground: true, animations: 'allow', fullPage: full, clip: full ? { x: r.x, y: r.y, width: r.w, height: r.h } : { x: r.x - origin.x, y: r.y - origin.y, width: r.w, height: r.h } });
      await h.evaluate((e, os) => { e.classList.remove('__keep'); os.forEach((o) => o.classList.remove('__hide')); document.documentElement.classList.remove('__iso'); }, others);
      meta.pieces.push({ id: piece.id, panel: panel.id, file: pfile, x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h });
    }
    if (handles.length) console.log(`  pieces: ${handles.map((p) => p.piece.id).join(', ')}`);
  }
  fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify(meta, null, 2));
  await ctx.close();
}
await browser.close();
server.close();
