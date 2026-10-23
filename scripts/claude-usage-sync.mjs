#!/usr/bin/env node
/* =========================================================
   CLAUDE CODE USAGE — the local collector
     npm run usage:sync            once
     npm run usage:watch           every 10 minutes while it runs (Ctrl + C to stop)
     npm run usage:sync -- --create-gist   first-time setup: makes the private Gist, prints its id

   1. Runs ccusage (https://ccusage.com, pinned below) on THIS computer:
        ccusage claude daily --json --offline --timezone Europe/London
      It reads Claude Code's local usage records. Only Claude Code: ccusage's
      plain `daily` also counts other agents (e.g. Codex), so it isn't used.
   2. Keeps ONLY per-day token totals: date, input, output, cache writes,
      cache reads, total. No prompts, conversations, file paths, projects,
      session ids, model names or costs ever leave this script.
   3. Merges them with what was published before (Claude Code keeps only
      about a month of local records, so older days come from the
      published history; a day this run sees replaces its older copy).
   4. Writes .cache/claude-usage.json (git-ignored; the dev server reads it)
      and, when CLAUDE_USAGE_GIST_ID + CLAUDE_USAGE_GIST_TOKEN are set in .env,
      publishes the same file to that private Gist. The deployed site's
      /api/claude-usage reads the Gist (lib/claude-usage.js).

   "total" = input + output + cache writes + cache reads, exactly ccusage's
   totalTokens (checked for every day; a mismatch stops the run).
   ========================================================= */
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.cache', 'claude-usage.json');
const CCUSAGE = 'ccusage@20.0.40';           // pinned: its JSON shape is what this script was written against
const TIMEZONE = 'Europe/London';
const GIST_FILE = 'claude-usage.json';
const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const EVERY_MIN = Math.max(5, Number(args[args.indexOf('--every') + 1]) || 10);

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env: local file only */ }
const GIST_ID = process.env.CLAUDE_USAGE_GIST_ID || '';
const GIST_TOKEN = process.env.CLAUDE_USAGE_GIST_TOKEN || '';

const log = (...a) => console.log(`[${new Date().toLocaleTimeString('en-GB')}]`, ...a);

/* ---- 1. ccusage ---- */
function runCcusage() {
  return new Promise((resolve, reject) => {
    // one fixed command (no user input is ever put into it); a shell is needed for npx on Windows
    exec(`npx --yes ${CCUSAGE} claude daily --json --offline --timezone ${TIMEZONE}`,
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, timeout: 5 * 60 * 1000, windowsHide: true },
      (err, stdout) => {
        if (err) return reject(new Error(`ccusage failed: ${err.message.split('\n')[0]}`));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error('ccusage did not print JSON')); }
      });
  });
}

/* ---- 2. only per-day totals ---- */
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : NaN);
function reduce(json) {
  if (!json || !Array.isArray(json.daily)) throw new Error('unexpected ccusage output (no "daily" list)');
  return json.daily.map((r) => {
    const day = {
      date: r.date ?? r.period,
      input: n(r.inputTokens), output: n(r.outputTokens),
      cacheWrite: n(r.cacheCreationTokens), cacheRead: n(r.cacheReadTokens),
      total: n(r.totalTokens),
    };
    if (!isDay(day.date) || Object.values(day).some((v) => Number.isNaN(v))) throw new Error(`unexpected ccusage row for ${day.date}`);
    if (day.input + day.output + day.cacheWrite + day.cacheRead !== day.total) throw new Error(`token categories don't add up to the total on ${day.date}`);
    return day;
  });
}

/* ---- 3. merge with what was published ---- */
async function readPublished() {
  if (GIST_ID && GIST_TOKEN) {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers: gh() });
    if (!res.ok) throw new Error(`reading the Gist failed (HTTP ${res.status})`);
    const file = (await res.json()).files?.[GIST_FILE];
    if (file?.content) return JSON.parse(file.content);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return null; }
}
function merge(prev, fresh) {
  const byDate = new Map((prev?.days ?? []).filter((d) => isDay(d.date)).map((d) => [d.date, d]));
  for (const d of fresh) byDate.set(d.date, d);                 // a day this run sees is the authority for that day
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ---- 4. write + publish ---- */
const gh = () => ({ Authorization: `Bearer ${GIST_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'daniel-portfolio-usage' });
async function publish(body) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH', headers: { ...gh(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(body) } } }),
  });
  if (!res.ok) throw new Error(`publishing to the Gist failed (HTTP ${res.status})`);
}
async function createGist() {
  if (!GIST_TOKEN) throw new Error('set CLAUDE_USAGE_GIST_TOKEN in .env first (a token with the Gists → read and write permission)');
  const res = await fetch('https://api.github.com/gists', {
    method: 'POST', headers: { ...gh(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'Claude Code daily token totals for my portfolio (no prompts or content)', public: false, files: { [GIST_FILE]: { content: '{"version":1,"days":[]}' } } }),
  });
  if (!res.ok) throw new Error(`creating the Gist failed (HTTP ${res.status})`);
  const g = await res.json();
  console.log(`\nCreated a private Gist. Add this line to .env (and to Vercel's Environment Variables):\n\n  CLAUDE_USAGE_GIST_ID=${g.id}\n`);
}

async function syncOnce() {
  const fresh = reduce(await runCcusage());
  let prev = null;
  try { prev = await readPublished(); } catch (e) { log('note:', e.message, '— merging with the local copy instead'); try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* none */ } }
  const days = merge(prev, fresh);
  const body = { version: 1, source: `${CCUSAGE} claude daily`, timezone: TIMEZONE, collectedAt: new Date().toISOString(), days };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(body, null, 1));
  const total = days.reduce((s, d) => s + d.total, 0);
  let where = `.cache/claude-usage.json`;
  if (GIST_ID && GIST_TOKEN) { await publish(body); where += ' + Gist'; }
  else if (!GIST_ID || !GIST_TOKEN) where += ' (Gist not configured: the deployed site won\'t see this)';
  log(`${days.length} days, ${total.toLocaleString('en-GB')} tokens → ${where}`);
}

if (args.includes('--create-gist')) {
  await createGist();
} else if (WATCH) {
  log(`watching: every ${EVERY_MIN} min (Ctrl + C to stop)`);
  const tick = () => syncOnce().catch((e) => log('sync failed:', e.message, '— will retry'));
  await tick();
  setInterval(tick, EVERY_MIN * 60 * 1000);
} else {
  await syncOnce().catch((e) => { console.error('sync failed:', e.message); process.exitCode = 1; });
}
