import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

/* The same /api endpoints as server.js (lib/ — CommonJS, shared with the
   Vercel functions in api/), mounted on the dev server so `npm run dev`
   shows real Spotify / GitHub data. Secrets stay in .env, server side. */
function api(): Plugin {
  return {
    name: 'portfolio-api',
    configureServer(server) {
      try { process.loadEnvFile(path.join(root, '.env')); } catch { /* no .env yet */ }
      const routes: Record<string, Handler> = {
        '/api/now-playing': require('./lib/spotify.js').handler,
        '/api/github-contributions': require('./lib/github.js').handler,
        '/api/claude-usage': require('./lib/claude-usage.js').handler,
      };
      server.middlewares.use((req, res, next) => {
        const route = routes[(req.url || '').split('?')[0]];
        if (route && req.method === 'GET') Promise.resolve(route(req, res)).catch(next);
        else next();
      });
    },
  };
}

/* When this site's code last changed: the latest commit's date, read once
   when the dev server starts or the site is built (on Vercel: the commit
   being deployed). null if git isn't there — the intro then leaves it out. */
function lastCommit(): string | null {
  try {
    return execSync('git log -1 --format=%cI', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch { return null; }
}

export default defineConfig({
  // Relative URLs, like the original: the site works from any folder
  base: './',
  define: { __LAST_COMMIT__: JSON.stringify(lastCommit()) },
  plugins: [react(), api()],
  build: {
    rollupOptions: {
      input: {
        main: path.join(root, 'index.html'),
        secret: path.join(root, 'secret.html'),
      },
    },
  },
});
