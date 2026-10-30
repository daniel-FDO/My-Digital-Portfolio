/* =========================================================
   PROJECT SHOWCASE — the project list, with a large video preview
   that only appears while you're looking at a project.

   TO SWITCH IT OFF: set ENABLE_PROJECT_SHOWCASE to false. The section
   goes back to the original list with its small hover preview
   (Projects.tsx). The videos live in public/previews/video/ and are
   made by the separate tooling in video/ (see video/README.md).

   - Mouse on a wide screen: hovering a project (or keyboard-focusing
     it) shows its preview in the column on the right, which stays
     while the pointer moves onto it (Play / Pause, Visit website) and
     goes once the pointer leaves both, on Escape, or when focus leaves
     the list. Each row is the link to the project, as before.
   - Touch / narrow screens: a "Preview" button under each project
     opens the preview right below it; pressing it again closes it.
   - Only the previewed project's video is loaded (nothing before the
     first preview). It plays muted and inline, pauses whenever the
     preview is hidden, off screen or the tab is hidden, and the same
     project shown again carries on rather than restarting.
   - Reduced motion: the poster shows; Play starts the video.
   - If a video can't load or play, its poster stays.
   ========================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PROJECTS } from '../data/home';
import { useMediaQuery, useReducedMotion } from '../lib/motion';
import { ExtIcon, NewTab, SparkIcon } from './icons';

export const ENABLE_PROJECT_SHOWCASE = true;

const SIDE_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 900px)';
const SHOW_DELAY = 110;    // ms a pointer rests on a row before its preview shows
const HIDE_DELAY = 220;    // ms grace to move from the list onto the preview
const hostOf = (url: string) => {
  try {
    const u = new URL(url, location.href);
    return u.origin === location.origin ? u.pathname.replace(/\/$/, '') : u.host.replace(/^www\./, '');
  } catch { return ''; }
};

export function ProjectShowcase() {
  const side = useMediaQuery(SIDE_QUERY);
  const [active, setActive] = useState<number | null>(null);   // the project being previewed
  const [shown, setShown] = useState(0);                         // what the stage holds (kept while hidden)
  const listRef = useRef<HTMLUListElement>(null);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);

  const hide = useCallback(() => { clearTimeout(showTimer.current); setActive(null); }, []);
  // A project with nothing to preview (no poster or video) never opens an empty stage
  const show = useCallback((i: number) => {
    const p = PROJECTS[i];
    if (!p?.poster && !p?.video) { hide(); return; }
    clearTimeout(hideTimer.current); setActive(i); setShown(i);
  }, [hide]);
  const hideSoon = useCallback(() => { clearTimeout(showTimer.current); clearTimeout(hideTimer.current); hideTimer.current = window.setTimeout(hide, HIDE_DELAY); }, [hide]);
  const keep = () => clearTimeout(hideTimer.current);
  useEffect(() => () => { clearTimeout(showTimer.current); clearTimeout(hideTimer.current); }, []);

  // Switching between mouse + wide and touch / narrow closes it; so does Escape
  useEffect(() => { hide(); }, [side, hide]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hide]);

  const stage = (inline: boolean) => (
    <Stage i={shown} on={active !== null} inline={inline} onEnter={keep} onLeave={side ? hideSoon : undefined} />
  );

  return (
    <section className={`sec pjs${side ? ' pjs--side' : ''}`} id="projects" aria-labelledby="projectsTitle" data-xray="projects">
      <h2 className="h" id="projectsTitle">Projects</h2>
      <div className="pjs__layout">
        <ul
          className="rows pjs__list" ref={listRef}
          onPointerLeave={(e) => { if (side && e.pointerType === 'mouse') hideSoon(); }}
          onPointerEnter={keep}
          onBlur={(e) => { if (side && !listRef.current?.contains(e.relatedTarget as Node | null)) hide(); }}
        >
          {PROJECTS.map((p, i) => (
            <li key={p.url} className={active === i ? 'is-previewed' : undefined}>
              <a
                className="row" href={p.url} target="_blank" rel="noopener noreferrer"
                onPointerEnter={(e) => {
                  if (!side || e.pointerType !== 'mouse') return;
                  clearTimeout(showTimer.current); keep();
                  showTimer.current = window.setTimeout(() => show(i), SHOW_DELAY);
                }}
                onFocus={(e) => { if (side && e.currentTarget.matches(':focus-visible')) show(i); }}
                onClick={hide}
              >
                <span className="row__top">
                  <span className="row__name">{p.name}</span>
                  {' '}<span className="badge"><SparkIcon />{p.category}</span>
                  {' '}<ExtIcon className="row__ext" />
                </span>
                <span className="row__desc">{p.description}</span><NewTab />
              </a>
              {p.repo && (
                <a className="row__repo" href={p.repo} target="_blank" rel="noopener noreferrer">Source<span className="sr"> code for {p.name} (opens in a new tab)</span></a>
              )}
              {!side && p.video && (
                <button
                  type="button" className="row__pv pjs__pv" aria-expanded={active === i} aria-controls="pjStage"
                  onClick={() => (active === i ? hide() : show(i))}
                >
                  {active === i ? 'Hide preview' : 'Preview'}<span className="sr"> {p.name}</span>
                </button>
              )}
              {!side && active === i && stage(true)}
            </li>
          ))}
        </ul>
        {side && stage(false)}
      </div>
    </section>
  );
}

/* ---------- The stage: video (or poster), name, links ---------- */
interface StageProps { i: number; on: boolean; inline: boolean; onEnter: () => void; onLeave?: () => void }
function Stage({ i, on, inline, onEnter, onLeave }: StageProps) {
  const p = PROJECTS[i];
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [userPaused, setUserPaused] = useState(false);
  const [requested, setRequested] = useState(false);   // reduced motion: asked to play
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);   // nothing is downloaded before the first preview

  useEffect(() => {
    const viewObs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    viewObs.observe(screenRef.current!);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { viewObs.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => { if (on && p.video) setLoaded(p.video); }, [on, p.video]);
  const src = loaded;
  useEffect(() => setPlaying(false), [src]);
  const broken = !!src && failed === src;
  const wantPlay = on && !!src && !broken && inView && !hidden && !userPaused && (!reduced || requested);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (wantPlay) v.play().catch(() => { /* blocked or failed: the poster stays */ });
    else v.pause();
  }, [wantPlay, src]);

  const toggle = () => {
    if (playing || wantPlay) { setUserPaused(true); return; }
    setUserPaused(false);
    setRequested(true);
  };
  const host = hostOf(p.url);
  const label = playing ? `Pause the ${p.name} preview` : `Play the ${p.name} preview`;
  // A mouse convenience: the row itself is the link and carries all of this,
  // so the stage stays out of the Tab order
  return (
    <div
      className={`pjs__stage${inline ? ' pjs__stage--inline' : ''}${on ? ' is-on' : ''}`} id="pjStage"
      aria-hidden={!inline || undefined}
      onPointerEnter={onEnter} onPointerLeave={(e) => { if (e.pointerType === 'mouse') onLeave?.(); }}
    >
      <div className="pjs__screen" ref={screenRef}>
        {p.poster && <img key={p.poster} className="pjs__poster" src={p.poster} alt="" width={1280} height={800} decoding="async" />}
        {src && src === p.video && !broken && (
          <video
            key={src} ref={videoRef} className="pjs__video"
            src={src} poster={p.poster} muted playsInline loop preload="auto"
            aria-label={`${p.name}: a short video tour of the website`}
            onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEmptied={() => setPlaying(false)}
            onError={() => { setFailed(src); setPlaying(false); }}
          />
        )}
        {src && !broken && (
          <button type="button" className="pjs__play" aria-label={label} title={label} onClick={toggle} tabIndex={inline ? 0 : -1}>
            {playing
              ? <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="1" /><rect x="9.4" y="3" width="2.6" height="10" rx="1" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.3v9.4a.8.8 0 0 0 1.2.7l7.4-4.7a.8.8 0 0 0 0-1.4L6.2 2.6A.8.8 0 0 0 5 3.3z" /></svg>}
          </button>
        )}
      </div>
      <div className="pjs__meta">
        <div className="pjs__id">
          <p className="pjs__name">{p.name}</p>
          <p className="pjs__sub">{p.category}{host && <> · <span className="pjs__host">{host}</span></>}</p>
        </div>
        <div className="pjs__links">
          {p.repo && <a className="pjs__source" href={p.repo} target="_blank" rel="noopener noreferrer" tabIndex={inline ? 0 : -1}>Source<NewTab /></a>}
          <a className="pjs__visit" href={p.url} target="_blank" rel="noopener noreferrer" tabIndex={inline ? 0 : -1}>
            Visit website<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg><NewTab />
          </a>
        </div>
      </div>
    </div>
  );
}
