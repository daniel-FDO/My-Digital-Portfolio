/* Vercel serverless function → https://your-site.vercel.app/api/claude-usage
   Reads the private Gist the local collector publishes to (CLAUDE_USAGE_GIST_ID
   in Vercel's Environment Variables). Locally, server.js / the dev server serve
   the same endpoint. See lib/claude-usage.js. */
module.exports = require('../lib/claude-usage').handler;
