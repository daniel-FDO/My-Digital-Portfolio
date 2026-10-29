/* =========================================================
   PROJECTS — title + category badge + one line; the rest behind "more".

   The preview: with a mouse on a wide screen, hovering (or keyboard-
   focusing) a project shows its card in a column on the right and the
   surrounding page dims slightly; on touch / narrow screens a "Preview"
   button (separate from the link, so a tap on the project still just
   opens it) shows the card under that row.
   Cleared by: leaving the list, Escape, scrolling (side mode), the card
   leaving the screen (inline mode), a tap elsewhere, opening a link,
   the tab hiding. The motion is CSS over the screenshot (.pv__img).
   ========================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import { PROJECTS } from '../data/home';
import { useMediaQuery } from '../lib/motion';
import { ExtIcon, NewTab, SparkIcon } from './icons';
import { ENABLE_PROJECT_SHOWCASE, ProjectShowcase } from './ProjectShowcase';

const SHOWN = 3;
const SIDE_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 900px)';

type Mode = 'side' | 'inline';
interface Active { i: number; mode: Mode }
interface Shown { src: string; alt: string; focus: string; cap: string; host: string; n: number }

const hostOf = (url: string) => {
  try {
    const resolved = new URL(url, location.href);
    return resolved.origin === location.origin ? resolved.pathname : resolved.host.replace(/^www\./, '');
  } catch { return ''; }
};

/* The section: the large preview stage (ProjectShowcase.tsx), or with
   ENABLE_PROJECT_SHOWCASE = false there, the original list below */
export function Projects() {
  return ENABLE_PROJECT_SHOWCASE ? <ProjectShowcase /> : <ProjectsClassic />;
}

function ProjectsClassic() {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [placeIn, setPlaceIn] = useState<number | null>(null);   // the row an inline card sits under
  const [shown, setShown] = useState<Shown | null>(null);         // what the card shows (once decoded)
  const [touring, setTouring] = useState(false);
  const sideOk = useMediaQuery(SIDE_QUERY);

  const listRef = useRef<HTMLUListElement>(null);
  const pvRef = useRef<HTMLDivElement>(null);
  const firstHidden = useRef<HTMLAnchorElement>(null);
  const activeRef = useRef<Active | null>(null);
  const request = useRef(0);
  const hush = useRef(false);   // after Escape: stays closed until the pointer leaves the list
  activeRef.current = active;

  const hide = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = null;
    request.current++;
    setActive(null);
    setTouring(false);
  }, []);

  const show = useCallback((i: number, mode: Mode) => {
    const p = PROJECTS[i];
    if (!p || !p.image) { hide(); return; }
    const cur = activeRef.current;
    if (cur && cur.i === i && cur.mode === mode) return;
    const next = { i, mode };
    activeRef.current = next;
    const mine = ++request.current;
    setActive(next);
    if (mode === 'inline') setPlaceIn(i);
    else setPlaceIn(null);
    // The screenshot, its caption and address change together, once the new
    // image is decoded (the card never shows a blank frame or a mismatch)
    const img = new Image(1440, 900);
    img.src = p.image;
    const apply = () => {
      if (activeRef.current !== next || mine !== request.current) return;
      setShown({ src: p.image!, alt: `${p.name} website preview`, focus: p.focus || '50% 0%', cap: p.category || '', host: hostOf(p.url), n: mine });
      setTouring(true);   // the tour starts from the beginning (a new <img>)
    };
    img.decode().then(apply, apply);
  }, [hide]);

  // The page around the list dims while a card shows
  useEffect(() => {
    document.body.classList.toggle('is-previewing', !!active);
    return () => document.body.classList.remove('is-previewing');
  }, [active]);

  // Everything outside the list that closes the card
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cur = activeRef.current;
      if (e.key !== 'Escape' || !cur) return;
      hush.current = cur.mode === 'side';
      const back = cur.mode === 'inline' ? listRef.current?.querySelector<HTMLButtonElement>(`li[data-i="${cur.i}"] .row__pv`) : null;
      hide();
      if (back && listRef.current?.contains(document.activeElement)) back.focus();
    };
    const onDown = (e: PointerEvent) => { if (activeRef.current && !listRef.current?.contains(e.target as Node)) hide(); };
    const onScroll = () => { if (activeRef.current?.mode === 'side') hide(); };
    const onVisibility = () => { if (document.hidden) hide(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('pagehide', hide);
    };
  }, [hide]);

  // Switching between mouse + wide and touch / narrow closes it
  const firstSide = useRef(true);
  useEffect(() => {
    if (firstSide.current) { firstSide.current = false; return; }
    hide();
  }, [sideOk, hide]);

  // Inline mode: the card scrolled off screen → close it (it also stops the motion)
  useEffect(() => {
    if (active?.mode !== 'inline' || !pvRef.current) return;
    const seen = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting && activeRef.current?.mode === 'inline') hide(); });
    seen.observe(pvRef.current);
    return () => seen.disconnect();
  }, [active, placeIn, hide]);

  // Warm the screenshots once the page is idle, so the first hover isn't blank
  useEffect(() => {
    const warm = () => PROJECTS.forEach((p) => { if (p.image) { const i = new Image(); i.src = p.image; } });
    if ('requestIdleCallback' in window) { const id = requestIdleCallback(warm); return () => cancelIdleCallback(id); }
    const id = setTimeout(warm, 1);
    return () => clearTimeout(id);
  }, []);

  // "more": the first newly shown project gets focus
  useEffect(() => {
    if (expanded) firstHidden.current?.focus({ preventScroll: true });
  }, [expanded]);

  const liOf = (target: EventTarget) => (target as Element).closest?.('li');
  const indexOf = (li: Element | null | undefined) => (li ? Number((li as HTMLElement).dataset.i) : -1);

  const card = (
    <Preview
      ref={pvRef}
      inline={placeIn !== null}
      on={!!active}
      shown={shown}
      touring={touring}
    />
  );

  return (
    <section className="sec" id="projects" aria-labelledby="projectsTitle">
      <h2 className="h" id="projectsTitle">Projects</h2>
      <ul
        className="rows" id="projectRows" ref={listRef}
        onPointerMove={(e) => {
          if (!sideOk || e.pointerType !== 'mouse' || hush.current) return;
          const i = indexOf(liOf(e.target));
          if (i >= 0) show(i, 'side');
        }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' && activeRef.current?.mode === 'side') hide(); hush.current = false; }}
        onFocus={(e) => {
          if (!sideOk || !(e.target as Element).matches('.row:focus-visible')) return;
          show(indexOf(liOf(e.target)), 'side');
        }}
        onBlur={(e) => { if (activeRef.current?.mode === 'side' && !listRef.current?.contains(e.relatedTarget as Node | null)) hide(); }}
        onClick={(e) => { if ((e.target as Element).closest('a')) hide(); }}   // opening the project / its source
      >
        {PROJECTS.map((p, i) => {
          const previewed = active?.i === i;
          return (
            <li key={p.url} hidden={i >= SHOWN && !expanded} data-i={i} className={previewed ? 'is-previewed' : undefined}>
              <a className="row" href={p.url} target="_blank" rel="noopener noreferrer" ref={i === SHOWN ? firstHidden : undefined}>
                {/* (the spaces between the parts are the original markup's) */}
                <span className="row__top">
                  {' '}<span className="row__name">{p.name}</span>
                  {' '}<span className="badge"><SparkIcon />{p.category}</span>
                  {' '}<ExtIcon className="row__ext" />{' '}
                </span>
                {' '}<span className="row__desc" style={{ display: 'block' }}>{p.description}</span><NewTab />
              </a>
              {p.repo && (
                <a className="row__repo" href={p.repo} target="_blank" rel="noopener noreferrer">Source<span className="sr"> code for {p.name} (opens in a new tab)</span></a>
              )}
              {p.image && (
                <button
                  type="button" className="row__pv" aria-controls="pv"
                  aria-expanded={active?.mode === 'inline' && active.i === i}
                  onClick={() => { if (active?.i === i && active.mode === 'inline') hide(); else show(i, 'inline'); }}
                >
                  Preview<span className="sr"> {p.name}</span>
                </button>
              )}
              {placeIn === i && card}
            </li>
          );
        })}
      </ul>
      {PROJECTS.length > SHOWN && (
        <button type="button" className="more" id="projectsMore" aria-expanded={expanded} aria-controls="projectRows" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'less' : 'more'}
        </button>
      )}
      {placeIn === null && card}
    </section>
  );
}

/* The card: a slow pan + zoom over the project's screenshot (an animated
   screenshot, not a video), its category and address. Decorative: the
   row already says all of it. It fades in on the frame after it mounts
   (it moves between the side column and the rows). */
interface PreviewProps {
  ref: Ref<HTMLDivElement>;
  inline: boolean;
  on: boolean;
  shown: Shown | null;
  touring: boolean;
}
function Preview({ ref, inline, on, shown, touring }: PreviewProps) {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const cls = `pv${inline ? ' pv--inline' : ''}${on && mounted ? ' is-on' : ''}`;
  return (
    <div className={cls} id="pv" ref={ref} aria-hidden="true" style={shown ? ({ '--focus': shown.focus } as CSSProperties) : undefined}>
      <div className="pv__frame">
        {shown
          ? <img key={shown.n} className={`pv__img${touring ? ' is-touring' : ''}`} id="pvImg" src={shown.src} alt={shown.alt} width={1440} height={900} decoding="async" />
          : <img className="pv__img" id="pvImg" alt="" width={1440} height={900} decoding="async" />}
        <span className="pv__cap" id="pvCap">{shown?.cap}</span>
      </div>
      <p className="pv__host" id="pvHost">{shown?.host}</p>
    </div>
  );
}
