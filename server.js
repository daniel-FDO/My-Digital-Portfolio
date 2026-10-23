/* =========================================================
   LOCAL SERVER — run with:  npm start   (after npm run build)
   Then open http://127.0.0.1:3000
   - serves the built website (dist/: index.html, secret.html, assets…)
   - GET /api/now-playing → what you're playing on Spotify
   - GET /api/github-contributions → your GitHub contribution calendar
   - GET /api/claude-usage → Claude Code daily token totals (from the collector)
   Your secrets are read from .env (never sent to the browser).
   For development with hot reload use  npm run dev  (vite.config.mts
   mounts the same two endpoints).
   ========================================================= */
const fs = require('fs');
const path = require('path');
const express = require('express');

// Load .env (Node 21.7+ can do this by itself — no extra package)
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) { /* no .env yet */ }

const { handler } = require('./lib/spotify');
const github = require('./lib/github');
const claudeUsage = require('./lib/claude-usage');

const DIST = path.join(__dirname, 'dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('\n  No build found. Run "npm run build" first (or "npm run dev" for development).\n');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // only reachable from this computer

app.disable('x-powered-by');

// The Spotify endpoint
app.get('/api/now-playing', handler);
// The GitHub contributions endpoint (token from .env, cached for an hour)
app.get('/api/github-contributions', github.handler);
// Claude Code token totals (published by scripts/claude-usage-sync.mjs; see lib/claude-usage.js)
app.get('/api/claude-usage', claudeUsage.handler);

// Everything else = the built website (dist/ only holds public files)
app.use(express.static(DIST, { dotfiles: 'deny', index: 'index.html' }));

app.listen(PORT, HOST, () => {
  console.log(`\n  Website running at  http://${HOST}:${PORT}\n  (stop it with Ctrl + C)\n`);
  if (!process.env.SPOTIFY_REFRESH_TOKEN) {
    console.log('  Note: no SPOTIFY_REFRESH_TOKEN in .env yet → run "npm run get-token" first.\n');
  }
  if (!process.env.GITHUB_TOKEN) {
    console.log('  Note: no GITHUB_TOKEN in .env → the GitHub activity shows "unavailable" (see .env.example).\n');
  }
});
