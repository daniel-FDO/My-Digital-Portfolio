/* =========================================================
   SPOTIFY — "now playing / paused / last played"
   One shared poller for every component that wants it (the music
   widget, the command menu's answers): useNowPlaying().
   Data comes from OUR server (/api/now-playing — lib/spotify.js),
   which talks to Spotify with the secrets in .env. Nothing secret
   is in here.
   - asks every 10 seconds while the tab is visible (not while hidden),
     and straight away when you come back to the tab / window
   - only the NEWEST answer is ever shown (a slow old one is ignored)
   - anything remembered or stale is never shown as "playing"
   - polling only runs while something is subscribed
   Only title, artist and album art are shown (never lyrics).
   ========================================================= */
import { useSyncExternalStore } from 'react';
import type { MusicState, NowPlaying } from '../types';

const ENDPOINT = '/api/now-playing';
const REFRESH_MS = 10 * 1000;
const CACHE_KEY = 'spotify-last';

type Played = 'playing' | 'paused' | 'last';

// "playing" only if the server says so in BOTH fields; otherwise paused / last
export function stateOf(d: NowPlaying): Played {
  if (d.isPlaying === true && (d.state === 'playing' || !d.state)) return 'playing';
  if (d.state === 'paused') return 'paused';
  return 'last';
}

// A remembered (old) answer may say "paused" or "last played", never "playing"
const asStale = (d: NowPlaying): NowPlaying => (stateOf(d) === 'playing'
  ? { ...d, isPlaying: false, state: 'last', playedAt: d.playedAt || d.seenAt || null }
  : d);

export interface NowPlayingSnapshot {
  data: NowPlaying | null;
  /** 'loading' until the first answer (or the remembered one) */
  state: MusicState;
}

/* ---- Shared data ---- */
let last: NowPlaying | null = null;
try { last = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch { /* storage blocked */ }

let snapshot: NowPlayingSnapshot = { data: null, state: 'loading' };
const listeners = new Set<() => void>();
let seq = 0;          // number of the newest request
let shownSeq = 0;     // number of the answer on screen
let controller: AbortController | null = null;
let timer = 0;

function render(d: NowPlaying | null) {
  snapshot = { data: d, state: d ? stateOf(d) : 'none' };
  listeners.forEach((fn) => fn());
}

async function fetchNowPlaying(): Promise<{ mine: number; data?: NowPlaying | null; aborted?: boolean }> {
  const mine = ++seq;
  if (controller) controller.abort();               // a newer question replaces the old one
  controller = new AbortController();
  try {
    const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = (await res.json()) as NowPlaying;
    if (!data || !data.title) throw new Error('no track');
    data.seenAt = new Date().toISOString();
    last = data;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* storage blocked */ }
    return { mine, data };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { mine, aborted: true };
    // Failed → keep showing the last known track, but never as "playing"
    return { mine, data: last ? asStale(last) : null };
  }
}

async function refresh() {
  const result = await fetchNowPlaying();
  if (result.aborted || result.mine < shownSeq || !listeners.size) return; // an older answer arrived late → ignore it
  shownSeq = result.mine;
  render(result.data ?? null);
}
function start() {
  clearInterval(timer);
  refresh();
  timer = window.setInterval(refresh, REFRESH_MS);
}
function stop() {
  clearInterval(timer);
  timer = 0;
}
const onVisibility = () => (document.hidden ? stop() : start());
const onFocus = () => { if (!document.hidden) start(); };

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    if (last && snapshot.state === 'loading') render(asStale(last)); // the remembered track straight away (never as "playing")
    if (!document.hidden) start();
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size) return;
    stop();
    if (controller) controller.abort();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
  };
}

/** The current answer: data is null when Spotify can't be reached and nothing was remembered */
export function useNowPlaying(): NowPlayingSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export const trackId = (url: string | null | undefined): string | null => {
  const m = /open\.spotify\.com\/track\/([A-Za-z0-9]+)/.exec(url || '');
  return m ? m[1] : null;
};
