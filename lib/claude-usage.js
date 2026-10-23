/* =========================================================
   CLAUDE CODE USAGE — the endpoint (server side only)
   Used by server.js / the dev server (vite.config.mts) and
   api/claude-usage.js on Vercel.

   Where the numbers come from: the local collector
   (scripts/claude-usage-sync.mjs) runs ccusage on Daniel's computer and
   publishes ONLY per-day token totals to a private GitHub Gist
   (CLAUDE_USAGE_GIST_ID). This reads that Gist. With no Gist configured
   (local development), it reads the collector's own copy,
   .cache/claude-usage.json, instead.

   - Validates the file; never invents a number. No data at all → 503 and
     the page says the usage isn't connected / unavailable.
   - Keeps a good answer for 2 minutes (the collector publishes every
     ~10); if the Gist can't be read, an older real answer is served,
     marked stale.
   - Reports when the collector last ran (collectedAt) and whether that's
     recent ("live": within 30 minutes) — the page shows the difference.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const CACHE_MS = 2 * 60 * 1000;
const LIVE_MS = 30 * 60 * 1000;        // collector runs every ~10 min: 30 min of silence = not running
const TIMEOUT_MS = 8000;
const LOCAL = path.join(__dirname, '..', '.cache', 'claude-usage.json');
const FILE = 'claude-usage.json';

let cached = null, inFlight = null;

class UsageError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }

const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ok = (v) => Number.isFinite(v) && v >= 0;
/** Only the expected fields, checked; anything else in the file is dropped */
function clean(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.days)) throw new UsageError('bad-file');
  const days = raw.days.filter((d) => d && isDay(d.date) && ['input', 'output', 'cacheWrite', 'cacheRead', 'total'].every((k) => ok(d[k]))
    && d.input + d.output + d.cacheWrite + d.cacheRead === d.total)
    .map((d) => ({ date: d.date, input: d.input, output: d.output, cacheWrite: d.cacheWrite, cacheRead: d.cacheRead, total: d.total }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const collectedAt = Date.parse(raw.collectedAt);
  if (!Number.isFinite(collectedAt)) throw new UsageError('bad-file');
  return { days, collectedAt: new Date(collectedAt).toISOString(), timezone: typeof raw.timezone === 'string' ? raw.timezone : 'Europe/London', source: 'ccusage' };
}

async function read() {
  const id = process.env.CLAUDE_USAGE_GIST_ID;
  if (id) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'daniel-portfolio' };
    // optional: the GitHub token already used for the heatmap raises the rate limit
    if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
    const res = await fetch('https://api.github.com/gists/' + encodeURIComponent(id), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new UsageError('gist-http', res.status);
    const file = (await res.json()).files?.[FILE];
    if (!file) throw new UsageError('gist-no-file');
    let content = file.content;
    if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url, { signal: AbortSignal.timeout(TIMEOUT_MS) })).text();
    return clean(JSON.parse(content));
  }
  if (fs.existsSync(LOCAL)) return clean(JSON.parse(fs.readFileSync(LOCAL, 'utf8')));
  throw new UsageError('not-configured');
}

async function getUsage() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (!inFlight) inFlight = read().then((data) => { cached = { data, at: Date.now() }; return data; }).finally(() => { inFlight = null; });
  return inFlight;
}

async function handler(req, res) {
  try {
    const data = await getUsage();
    send(res, 200, { ...data, live: Date.now() - Date.parse(data.collectedAt) < LIVE_MS, fetchedAt: new Date().toISOString() }, 'public, max-age=60, s-maxage=120');
  } catch (err) {
    console.error('[claude-usage] ' + (err.code || 'request-failed') + (err.status ? ' (' + err.status + ')' : ''));
    if (cached) return send(res, 200, { ...cached.data, live: false, stale: true, fetchedAt: new Date().toISOString() }, 'no-store');
    send(res, 503, { error: 'Claude Code usage is unavailable right now.', reason: err.code === 'not-configured' ? 'not-configured' : 'unavailable' }, 'no-store');
  }
}

function send(res, status, body, cacheControl) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.end(JSON.stringify(body));
}

module.exports = { handler, _clean: clean };
