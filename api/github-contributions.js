/* Vercel serverless function → https://your-site.vercel.app/api/github-contributions
   (Only used when the site is deployed to Vercel. Locally, server.js serves
   the same endpoint.) GITHUB_TOKEN comes from Vercel's Environment Variables. */
module.exports = require('../lib/github').handler;
