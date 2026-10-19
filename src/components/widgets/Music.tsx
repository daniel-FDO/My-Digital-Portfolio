/* =========================================================
   MUSIC — what I'm playing on Spotify (the shared poller in
   lib/spotify.ts asks /api/now-playing). "Play" opens Spotify's own
   player in the card (only after a click, so nothing plays by itself).
   ========================================================= */
import { useEffect, useRef, useState } from 'react';
import { SPOTIFY_PROFILE } from '../../data/home';
import { trackId, useNowPlaying } from '../../lib/spotify';

/* ---- Spotify's iFrame API (loaded the first time Play is pressed) ---- */
interface SpotifyController {
  addListener(event: 'ready', fn: () => void): void;
  play(): void;
  destroy(): void;
}
interface SpotifyIframeApi {
  createController(el: HTMLElement, opts: { uri: string; width: string; height: number }, cb: (ctrl: SpotifyController) => void): void;
}
declare global {
  interface Window { onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void }
}

let spotifyApi: SpotifyIframeApi | null = null;
let apiWaiters: ((api: SpotifyIframeApi) => void)[] = [];
function spotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (spotifyApi) return Promise.resolve(spotifyApi);
  return new Promise((resolve, reject) => {
    apiWaiters.push(resolve);
    setTimeout(() => reject(new Error('timeout')), 6000);
    if (apiWaiters.length > 1) return;
    window.onSpotifyIframeApiReady = (api) => { spotifyApi = api; apiWaiters.forEach((fn) => fn(api)); apiWaiters = []; };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => { apiWaiters = []; reject(new Error('Spotify player unavailable')); };
    document.head.appendChild(s);
  });
}

const LABEL = { playing: 'Now playing', paused: 'Paused', last: 'Recently played' } as const;

export function Music() {
  const { data: d, state } = useNowPlaying();
  const [playerId, setPlayerId] = useState<string | null>(null);   // the track in the open player
  const embedRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const id = d ? trackId(d.songUrl) : null;
  const loading = state === 'loading';

  // The player: Spotify's controller (or a plain embed if its API can't load)
  useEffect(() => {
    if (!playerId) return;
    const embed = embedRef.current!;
    let controller: SpotifyController | null = null;
    let cancelled = false;
    embed.innerHTML = '';
    closeRef.current?.focus();
    spotifyIframeApi().then((api) => {
      if (cancelled) return;
      const mount = document.createElement('div');
      embed.appendChild(mount);
      api.createController(mount, { uri: 'spotify:track:' + playerId, width: '100%', height: 152 }, (ctrl) => {
        if (cancelled) { try { ctrl.destroy(); } catch { /* already gone */ } return; }
        controller = ctrl;
        // The visitor asked for it: try to start straight away. If the browser
        // blocks it, Spotify's own play button in the player still works.
        ctrl.addListener('ready', () => { try { ctrl.play(); } catch { /* blocked */ } });
      });
    }, () => {
      if (cancelled) return;
      const frame = document.createElement('iframe');
      frame.title = 'Spotify player';
      frame.src = `https://open.spotify.com/embed/track/${playerId}?utm_source=generator`;
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.loading = 'lazy';
      embed.appendChild(frame);
    });
    return () => {
      cancelled = true;
      try { controller?.destroy(); } catch { /* already gone */ }
      embed.innerHTML = '';
    };
  }, [playerId]);

  // After closing, focus goes back to Play (once React has shown it again)
  useEffect(() => {
    if (playerId || !restoreFocus.current) return;
    restoreFocus.current = false;
    playRef.current?.focus();
  }, [playerId]);

  const closePlayer = () => { restoreFocus.current = !!id; setPlayerId(null); };

  return (
    <article className="w music" id="music" data-state={state} aria-labelledby="musicLabel">
      {/* the cover, soft and blurred, as the card's backdrop */}
      {d?.albumArt && <img className="music__bg" src={d.albumArt} alt="" aria-hidden="true" decoding="async" />}
      <div className="music__art">
        {d?.albumArt
          ? <img id="musicArt" src={d.albumArt} alt={`Cover art: ${d.title}`} width={300} height={300} decoding="async" />
          : <img id="musicArt" alt="" width={300} height={300} decoding="async" hidden />}
        <svg className="music__ph" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      </div>
      <div className="music__info">
        <p className="music__label" id="musicLabel">
          {state === 'playing' && <span className="music__eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>}
          {d && state !== 'none' && state !== 'loading' ? LABEL[state] : 'Spotify'}
        </p>
        <p className="music__title" id="musicTitle">{loading ? 'Loading…' : d ? d.title : 'Not available right now'}</p>
        <p className="music__artist" id="musicArtist">{d?.artist || ''}</p>
        <button
          type="button" className="pill music__play" id="musicPlay" ref={playRef} hidden={!id}
          aria-label={id && d ? `Play ${d.title}${d.artist ? ' by ' + d.artist : ''} in the Spotify player` : undefined}
          onClick={() => { if (id) setPlayerId(id); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
          <span>Play</span>
        </button>
        <a className="pill music__open" id="musicOpen" href={SPOTIFY_PROFILE} target="_blank" rel="noopener noreferrer" hidden={loading || !!id}>
          <span>Open Spotify</span><span className="sr"> (opens in a new tab)</span>
        </a>
      </div>
      <a className="music__logo" href={SPOTIFY_PROFILE} target="_blank" rel="noopener noreferrer" aria-label="My Spotify profile (opens in a new tab)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.85-1.74-6.45-2.14-10.68-1.17a.75.75 0 1 1-.33-1.46c4.63-1.06 8.6-.6 11.77 1.34.36.22.47.68.25 1.04zm1.47-3.26a.94.94 0 0 1-1.29.3c-3.26-2-8.24-2.59-12.1-1.42a.94.94 0 0 1-.54-1.8c4.41-1.33 9.9-.69 13.63 1.6.44.28.58.86.3 1.32zm.13-3.4C15.2 8.33 8.77 8.12 5.05 9.25a1.13 1.13 0 1 1-.65-2.16c4.27-1.3 11.37-1.04 15.85 1.62a1.13 1.13 0 0 1-1.15 1.93z" /></svg>
      </a>
      {/* The Spotify player opens here, only after "Play" is pressed */}
      <div className="music__player" id="musicPlayer" hidden={!playerId} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closePlayer(); } }}>
        <div className="music__embed" id="musicEmbed" ref={embedRef}></div>
        <button type="button" className="music__close" id="musicClose" ref={closeRef} aria-label="Close player" onClick={closePlayer}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </article>
  );
}
