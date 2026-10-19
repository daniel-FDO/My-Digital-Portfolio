/* =========================================================
   GET YOUR SPOTIFY REFRESH TOKEN — run ONCE with:  npm run get-token
   ---------------------------------------------------------
   Before running:
     1. Copy .env.example to a new file called .env
     2. Fill in SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
        (Spotify Developer Dashboard → your app → Settings)
     3. Your app's Redirect URI must be exactly:
        http://127.0.0.1:3000/callback
   What happens:
     4. This starts a tiny server on http://127.0.0.1:3000 and opens
        your browser at Spotify's "Allow access?" page.
     5. You click "Agree". Spotify sends you back to /callback with a
        one-time code.
     6. The script swaps that code for tokens (Authorization Code flow,
        using your client secret from .env) and PRINTS THE REFRESH TOKEN
        here in the terminal.
     7. Paste it into .env as SPOTIFY_REFRESH_TOKEN=... and you're done.
   (Add --no-open to print the link instead of opening the browser.)
   ========================================================= */
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) { /* checked below */ }

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PORT = 3000;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-currently-playing user-read-recently-played';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n  Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.');
  console.error('  Copy .env.example to .env and fill in those two first.\n');
  process.exit(1);
}

// A random "state" value: proves the answer really comes from the login we started
const state = crypto.randomBytes(16).toString('hex');
const authorizeUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id: CLIENT_ID,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
  state,
  show_dialog: 'true',
});

const page = (title, text) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;max-width:520px;margin:15vh auto;padding:0 20px;line-height:1.5">
<h1 style="font-size:22px">${title}</h1><p>${text}</p></body>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // Step 4: http://127.0.0.1:3000/ → Spotify's "Allow access?" page
  if (url.pathname === '/') {
    res.writeHead(302, { Location: authorizeUrl });
    return res.end();
  }

  // Step 5–6: Spotify sends us back here
  if (url.pathname === '/callback') {
    // On a problem we stay running, so you can simply try again
    // (and a fake /callback from someone else can't stop your login)
    const fail = (msg) => {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('Something went wrong', msg + ' <a href="/">Try again</a>.'));
      console.error('\n  ✗ ' + msg + ' Try again: http://127.0.0.1:' + PORT + '/\n');
    };
    if (url.searchParams.get('error')) return fail('Spotify said: ' + url.searchParams.get('error') + '.');
    if (url.searchParams.get('state') !== state) return fail('The security check (state) did not match.');
    const code = url.searchParams.get('code');
    if (!code) return fail('No code came back from Spotify.');

    try {
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
      });
      const json = await tokenRes.json();
      if (!tokenRes.ok || !json.refresh_token) {
        return fail('Could not swap the code for tokens (' + (json.error_description || json.error || tokenRes.status) + ').');
      }

      // Step 7: the refresh token goes ONLY to your terminal (not the browser page)
      console.log('\n  ✓ Success! Copy this line into your .env file:\n');
      console.log('  SPOTIFY_REFRESH_TOKEN=' + json.refresh_token + '\n');
      console.log('  (Keep it secret — it lets this app read what you listen to.)\n');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      res.end(page('All done ✓', 'Your refresh token is printed in the terminal. You can close this tab.'));
      server.close();                    // finished → stop the helper
      server.closeAllConnections();
    } catch (err) {
      return fail('Could not reach Spotify (' + err.message + ').');
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  const start = `http://127.0.0.1:${PORT}/`;
  console.log('\n  Opening Spotify login… If nothing opens, visit this link yourself:\n  ' + start + '\n');
  if (process.argv.includes('--no-open')) return;
  // Open the default browser (Windows / Mac / Linux)
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', start]]
    : process.platform === 'darwin' ? ['open', [start]] : ['xdg-open', [start]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error('\n  Port 3000 is busy. Stop "npm start" (Ctrl + C) and try again.\n');
  else console.error(err.message);
  process.exit(1);
});
