/* A contact sheet of one project's captures (panels with their holes, pieces on a checkerboard) */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { serve } from './server.mjs';
const server = await serve(4798);
const b = await chromium.launch({ channel: 'msedge', headless: true });
for (const slug of process.argv.slice(2)) {
  const cap = JSON.parse(fs.readFileSync(`video/captures/${slug}/capture.json`, 'utf8'));
  const base = `${server.url}video/captures/${slug}/`;
  const html = `<body style="margin:0;padding:12px;background:#777;font:12px sans-serif;color:#fff">
    <div style="display:flex;gap:8px;flex-wrap:wrap">${cap.panels.map((p) => `<figure style="margin:0"><img src="${base}${p.file}" style="width:300px"><figcaption>${p.id}</figcaption></figure>`).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${cap.pieces.map((p) => `<figure style="margin:0;background:repeating-conic-gradient(#bbb 0 25%,#eee 0 50%) 0 0/16px 16px"><img src="${base}${p.file}" style="max-width:220px;max-height:160px;display:block"><figcaption style="background:#333">${p.id}</figcaption></figure>`).join('')}</div></body>`;
  const page = await b.newPage({ viewport: { width: 1300, height: 600 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `video/.probe/contact-${slug}.png`, fullPage: true });
  await page.close();
}
await b.close(); server.close();
