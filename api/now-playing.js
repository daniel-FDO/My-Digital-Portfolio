/* Vercel serverless function → https://your-site.vercel.app/api/now-playing
   (Only used when the site is deployed to Vercel. Locally, server.js serves
   the same endpoint.) The secrets come from Vercel's Environment Variables. */
module.exports = require('../lib/spotify').handler;
