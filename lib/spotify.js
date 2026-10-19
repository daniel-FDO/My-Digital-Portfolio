/* =========================================================
   SPOTIFY — "now playing / last played" (server side only!)
   Used by server.js (on your computer) and api/now-playing.js
   (when deployed to Vercel). The browser never sees this file's
   secrets: they come ONLY from environment variables
   (.env on your computer, the host's settings when deployed).
   ========================================================= */

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';
const CACHE_MS = 5 * 1000;    // reuse the last answer for 5 seconds (pause/stop shows up fast)
const TIMEOUT_MS = 8000;      // give up on Spotify after 8 seconds

let token = null;     // { value, expiresAt } — the short-lived access token
let cached = null;    // { data, at }        — the last good answer
let inFlight = null;  // so 10 visitors at once cause only 1 Spotify request

class SpotifyError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;     // a short reason, safe to log (never a secret)
    this.status = status;
  }
}

/* ---- 1. Access token: swap the refresh token for a fresh one,
          and keep it until about a minute before it expires ---- */
async function getAccessToken() {
  if (token && Date.now() < token.expiresAt - 60 * 1000) return token.value;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new SpotifyError('not-configured');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new SpotifyError('token-refresh-failed', res.status);

  const json = await res.json();
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

/* ---- 2. Small helpers ---- */
const callApi = (path, accessToken) => fetch(API_URL + path, {
  headers: { Authorization: 'Bearer ' + accessToken },
  signal: AbortSignal.timeout(TIMEOUT_MS),
});

// The biggest album picture (Spotify usually lists 640, 300 and 64px)
function largestImage(images) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.reduce((best, img) => ((img.width || 0) > (best.width || 0) ? img : best)).url || null;
}

// Only what the website shows: title, artist, picture, link (never lyrics)
function shapeTrack(track, extra) {
  return {
    isPlaying: false,
    title: track.name || null,
    artist: (track.artists || []).map((a) => a.name).join(', ') || null,
    albumArt: largestImage(track.album && track.album.images),
    songUrl: (track.external_urls && track.external_urls.spotify) || null,
    ...extra,
  };
}

/* ---- 3. Ask Spotify: playing now? paused? If neither → the last played track ----
   state: "playing" | "paused" | "last"
   isPlaying is true ONLY when Spotify says is_playing === true for a real
   song (not paused, not a podcast/ad, not empty). */
async function fetchFromSpotify() {
  const accessToken = await getAccessToken();

  try {
    const res = await callApi('/me/player/currently-playing', accessToken);
    if (res.status === 401) token = null;            // token expired early → refresh next time
    if (res.status === 200) {
      const now = await res.json();
      const isSong = now && now.item && now.currently_playing_type === 'track';
      if (isSong && now.is_playing === true) {
        return shapeTrack(now.item, { isPlaying: true, state: 'playing' });
      }
      if (isSong) {                                  // the song is there but paused
        return shapeTrack(now.item, { isPlaying: false, state: 'paused' });
      }
    }
    // 204 = nothing playing at all → fall through to "recently played"
  } catch (err) {
    // Network hiccup on this call → still try "recently played"
  }

  const res = await callApi('/me/player/recently-played?limit=1', accessToken);
  if (res.status === 401) token = null;
  if (!res.ok) throw new SpotifyError('recently-played-failed', res.status);
  const recent = await res.json();
  const item = recent && recent.items && recent.items[0];
  if (!item || !item.track) return { isPlaying: false, state: 'last', title: null, artist: null, albumArt: null, songUrl: null, playedAt: null };
  return shapeTrack(item.track, { isPlaying: false, state: 'last', playedAt: item.played_at });
}

/* ---- 4. With the 20-second cache ---- */
async function getNowPlaying() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (!inFlight) {
    inFlight = fetchFromSpotify()
      .then((data) => { cached = { data, at: Date.now() }; return data; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/* ---- 5. The web handler (works in Express AND as a Vercel function) ----
   Always answers with safe JSON: the track info, or a short message.
   Errors are logged as a short code only — never tokens or secrets. */
async function handler(req, res) {
  try {
    const data = await getNowPlaying();
    // Hosts (e.g. Vercel) may keep it 5s too — but never serve an older copy after that
    send(res, 200, data, 'public, max-age=0, s-maxage=5');
  } catch (err) {
    console.error('[spotify] ' + (err.code || 'request-failed') + (err.status ? ' (' + err.status + ')' : ''));
    // An old answer beats no answer — but it can never claim "playing" any more:
    // we don't know that, so it becomes "last played" (at the time we last saw it).
    if (cached && cached.data.title) {
      const old = cached.data;
      return send(res, 200, { ...old, isPlaying: false, state: 'last', playedAt: old.playedAt || new Date(cached.at).toISOString(), stale: true }, 'no-store');
    }
    send(res, 503, { error: 'Spotify data is unavailable right now.' }, 'no-store');
  }
}

function send(res, status, body, cacheControl) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.end(JSON.stringify(body));
}

module.exports = { handler, getNowPlaying };
