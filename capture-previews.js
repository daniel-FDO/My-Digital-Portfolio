/* =========================================================
   CAPTURE PROJECT PREVIEWS — run with:  npm run capture
   (force new screenshots of everything:  npm run capture -- --force)
   ---------------------------------------------------------
   1. Warm-up: asks every site for its page until it answers 200.
      The Render site sleeps on the free plan → polled every 5s for
      up to 2 minutes.
   2. Opens each site in Microsoft Edge (via playwright-core — no extra
      browser download), 1440×900, waits for the network to go quiet
      + 1.5s, clicks away cookie banners, then saves a JPG screenshot
      to public/previews/ straight away.
   3. Up to 3 tries per site; one failure never stops the others.
   4. Skips sites whose screenshot is less than 7 days old (unless
      --force). Also saves each site's real <title> + meta description
      to public/previews/meta.json.
   5. Prints a summary of what worked and what failed.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const PROJECTS = require('./src/data/projects.json');

const OUT = path.join(__dirname, 'public', 'previews');
const FORCE = process.argv.includes('--force');
const FRESH_DAYS = 7;
const VIEWPORT = { width: 1440, height: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isFresh = (file) => fs.existsSync(file) && (Date.now() - fs.statSync(file).mtimeMs) < FRESH_DAYS * 864e5;

// ---- 1. Warm-up: wait for HTTP 200 (sleepy Render sites get up to 2 minutes) ----
async function warmUp(project) {
  const slow = project.url.includes('onrender.com');
  const deadline = Date.now() + (slow ? 120000 : 30000);
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const res = await fetch(project.url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (res.status === 200) return true;
      console.log(`  … ${project.name}: HTTP ${res.status}, waiting (try ${attempt})`);
    } catch (err) {
      console.log(`  … ${project.name}: not answering yet (${err.name}), waiting (try ${attempt})`);
    }
    await sleep(5000);
  }
  return false;
}

// Gives up on a step that takes too long (some playful pages keep the
// browser so busy that a step would otherwise wait forever)
function limit(promise, ms, label) {
  let t;
  return Promise.race([promise, new Promise((_, reject) => { t = setTimeout(() => reject(new Error(label + " took longer than " + ms / 1000 + "s")), ms); })])
    .finally(() => clearTimeout(t));
}

// ---- Click "accept"-style buttons on cookie banners, if there are any ----
async function dismissCookieBanners(page) {
  const labels = /^(accept( all)?|allow( all)?|agree|got it|i understand)$/i;
  for (const frame of page.frames()) {
    try {
      const buttons = frame.getByRole("button", { name: labels });
      const n = Math.min(await limit(buttons.count(), 3000, "looking for cookie banners"), 3);
      for (let i = 0; i < n; i++) await buttons.nth(i).click({ timeout: 1500 }).catch(() => {});
    } catch (e) { /* no banner (or the page is too busy to check) */ }
  }
}

// ---- 2. Screenshot one site (with retries) ----
// browserBox.get() gives a working browser; after a frozen try it is restarted
async function capture(browserBox, project) {
  const file = path.join(OUT, project.image.replace(/^previews\//, ""));
  for (let tryNo = 1; tryNo <= 3; tryNo++) {
    let context;
    try {
      const browser = await browserBox.get();
      context = await limit(browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: "reduce" }), 15000, "opening a tab");
      const page = await context.newPage();
      const run = (async () => {
        await page.goto(project.url, { waitUntil: "load", timeout: 60000 });
        // Wait for the network to go quiet — sites with endless animations /
        // live connections never do, so stop waiting after 15s
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await dismissCookieBanners(page);
        await page.waitForTimeout(1500);                     // let animations + fonts settle
        const meta = await limit(page.evaluate(() => ({
          title: document.title.trim(),
          description: (document.querySelector("meta[name=\"description\"]")?.content || "").trim(),
        })), 10000, "reading the title");
        // saved right away; "animations: disabled" stops endless animations blocking it
        await page.screenshot({ path: file, type: "jpeg", quality: 72, animations: "disabled", timeout: 30000 });
        return meta;
      })();
      const meta = await limit(run, 100000, "the whole capture");   // one try never takes > 100s
      await limit(context.close(), 10000, "closing the tab").catch(() => {});
      return { ok: true, meta };
    } catch (err) {
      console.log(`  ✗ ${project.name}: try ${tryNo}/3 failed (${err.message.split("\n")[0]})`);
      if (context) await limit(context.close(), 5000, "closing").catch(() => browserBox.restart());
      await sleep(2000);
    }
  }
  return { ok: false };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const metaFile = path.join(OUT, 'meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const results = [];

  const todo = PROJECTS.filter((p) => {
    // a screenshot taken by hand (e.g. inside the gallery, past its entrance) is never replaced
    if (p.capture === false) { results.push({ name: p.name, status: 'skipped (captured by hand)' }); return false; }
    const fresh = !FORCE && isFresh(path.join(OUT, p.image.replace(/^previews\//, '')));
    if (fresh) results.push({ name: p.name, status: 'skipped (fresh)' });
    return !fresh;
  });

  console.log(`\nWarming up ${todo.length} site(s)…`);
  const awake = await Promise.all(todo.map(warmUp));

  // Microsoft Edge (already on the computer) — restarted if it ever freezes
  const browserBox = {
    browser: null,
    async get() {
      if (!this.browser) this.browser = await chromium.launch({ channel: 'msedge', headless: true });
      return this.browser;
    },
    async restart() {
      const b = this.browser;
      this.browser = null;
      if (b) await limit(b.close(), 5000, 'closing Edge').catch(() => {});
    },
  };
  try {
    await browserBox.get();
  } catch (err) {
    console.error('\nCould not start Microsoft Edge: ' + err.message.split('\n')[0]);
    process.exit(1);
  }

  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    if (!awake[i]) { results.push({ name: p.name, status: 'FAILED (never answered 200)' }); continue; }
    console.log(`Capturing ${p.name}…`);
    const r = await capture(browserBox, p);
    if (r.ok) {
      meta[p.url] = r.meta;
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));  // saved after every site
      results.push({ name: p.name, status: 'ok' });
    } else results.push({ name: p.name, status: 'FAILED (3 tries)' });
  }
  await browserBox.restart();

  console.log('\nSummary');
  for (const r of results) console.log(`  ${r.status.startsWith('FAILED') ? '✗' : '✓'} ${r.name.padEnd(34)} ${r.status}`);
  console.log(`\nScreenshots: ${OUT}\nTitles + descriptions: ${metaFile}\n`);
})();
