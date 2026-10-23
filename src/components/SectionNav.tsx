/* =========================================================
   SECTION DOCK — a slim pill of section icons
   Wide screens: on the right edge, vertically centred: the current
   section's number on top, the count at the bottom. Narrow screens:
   a compact row just above the toolbar, once you've scrolled, and
   out of the way while the footer is on screen.
   - A click / Enter scrolls to the section (smoothly, unless reduced
     motion) and moves focus to its heading, like the command menu.
   - Normal scrolling moves the highlight: the active section is the
     last one whose top has passed 30% of the screen (at most 260px
     down), unless a section's heading sits right at the top — then
     that one (so a short section like Education counts once reached) (the last one at
     the very bottom of the page). While a click's scroll is running,
     the highlight stays on its target instead of flickering through.
   - Arrow keys move between the icons; Home / End jump to the ends.
   - Wide screens with a precise pointer: an expanding action bar.
     When a mouse rests on the rail, or keyboard focus is inside it,
     every icon slides its label open (the rail grows leftwards, the
     icons stay put) and a highlight pill glides to the hovered row;
     it closes ~90 ms after the pointer leaves / focus moves out.
     Otherwise (the narrow row, touch) one floating label shows on
     hover / keyboard focus, so it's never clipped by the row's
     scrolling. Reduced motion: no sliding or blurring.
   Sections are found by id; scroll-margin-top (home.css .sec) keeps
   them clear of the top edge, as there's no fixed header.
   ========================================================= */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { calm, useMediaQuery } from '../lib/motion';

const ICONS: Record<string, ReactNode> = {
  intro: <path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" />,
  projects: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></>,
  about: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  education: <><path d="M22 9.5 12 4.5 2 9.5l10 5z" /><path d="M6 11.5v4.8c3.3 2.3 8.7 2.3 12 0v-4.8M22 9.5v5" /></>,
  skills: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />,
  gallery: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.7" /><path d="m21 15.5-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5 20" /></>,
  activity: <path d="M3 12h3.5l2.5-7 5 14 2.5-7H21" />,
  faq: <><circle cx="12" cy="12" r="9" /><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 2.5M12 16.8h.01" /></>,
  contact: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
};

export const SECTIONS: { id: string; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'projects', label: 'Projects' },
  { id: 'about', label: 'About' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Tech stack' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'activity', label: 'Activity' },
  { id: 'faq', label: 'Questions' },
  { id: 'contact', label: 'Contact' },
];

const two = (n: number) => String(n).padStart(2, '0');

interface Props {
  inert: boolean;
  /** scroll to a section and focus its heading (App's command-menu action) */
  onGo: (id: string) => void;
  /** back to the very top (the intro) */
  onTop: () => void;
}

export function SectionNav({ inert, onGo, onTop }: Props) {
  const rail = useMediaQuery('(min-width: 1000px) and (min-height: 560px)');
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(rail);
  const [tip, setTip] = useState({ i: 0, at: 0, on: false });
  const navRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lock = useRef<{ target: number; timer: number } | null>(null);
  const lockRelease = useRef<() => void>(() => {});
  const railRef = useRef(rail);
  railRef.current = rail;
  // the expanding rail: a resting mouse (pointer events check for it) or keyboard focus
  const canExpand = rail;
  // open while a mouse rests on it OR keyboard focus is inside it; closes 90 ms after neither is true
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(-1);
  useEffect(() => {
    if (pointerIn || focusIn) { setExpanded(true); return; }
    const t = window.setTimeout(() => setExpanded(false), 90);
    return () => clearTimeout(t);
  }, [pointerIn, focusIn]);
  const open = expanded && canExpand;

  /* ---- Which section is on screen (and, narrow, whether to show at all) ---- */
  useEffect(() => {
    let queued = 0;
    const els = () => SECTIONS.map((s) => document.getElementById(s.id));
    const measure = () => {
      queued = 0;
      const doc = document.documentElement;
      const footer = document.querySelector('.footer');
      const narrowShown = scrollY > 240 && !(footer && footer.getBoundingClientRect().top < innerHeight - 40);
      setShown(railRef.current || narrowShown);
      if (lock.current) return;
      const probe = Math.min(innerHeight * 0.3, 260);
      let i = 0, atTop = -1;
      els().forEach((el, k) => {
        const top = el ? el.getBoundingClientRect().top : Infinity;
        if (top <= probe) i = k;
        if (atTop < 0 && top > -2 && top < 100) atTop = k;    // its heading sits at the top of the screen
      });
      if (atTop >= 0) i = atTop;
      if (scrollY + innerHeight >= doc.scrollHeight - 4) i = SECTIONS.length - 1;
      setActive(i);
    };
    const queue = () => { if (!queued) queued = requestAnimationFrame(measure); };
    // While a click's scroll runs: hold the target until scrolling has stopped
    const onScroll = () => {
      const l = lock.current;
      if (l) { clearTimeout(l.timer); l.timer = window.setTimeout(release, 140); }
      queue();
    };
    const release = () => {
      if (!lock.current) return;
      clearTimeout(lock.current.timer);
      lock.current = null;
      queue();
    };
    // The visitor takes over (wheel, touch, keys) → follow them again
    const takeOver = () => release();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('scrollend', release);
    addEventListener('resize', queue);
    addEventListener('wheel', takeOver, { passive: true });
    addEventListener('touchstart', takeOver, { passive: true });
    lockRelease.current = release;
    measure();
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('scrollend', release);
      removeEventListener('resize', queue);
      removeEventListener('wheel', takeOver);
      removeEventListener('touchstart', takeOver);
      cancelAnimationFrame(queued);
      if (lock.current) clearTimeout(lock.current.timer);
      lock.current = null;
    };
  }, []);

  useEffect(() => { if (rail) setShown(true); }, [rail]);

  /* ---- Narrow: keep the active icon in view inside the scrolling row ---- */
  useLayoutEffect(() => {
    const strip = stripRef.current, btn = btnRefs.current[active];
    if (rail || !strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    const left = btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: calm() ? 'auto' : 'smooth' });
  }, [active, rail]);

  const go = (i: number) => {
    if (lock.current) clearTimeout(lock.current.timer);
    // Hold the highlight on the target; let go once scrolling stops (or after 1s if it never starts)
    lock.current = { target: i, timer: window.setTimeout(() => lockRelease.current(), 1000) };
    setActive(i);
    setTip((t) => ({ ...t, on: false }));
    if (i === 0) onTop();
    else onGo(SECTIONS[i].id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = btnRefs.current.findIndex((b) => b === document.activeElement);
    if (k < 0) return;
    const next = ({ ArrowDown: k + 1, ArrowRight: k + 1, ArrowUp: k - 1, ArrowLeft: k - 1, Home: 0, End: SECTIONS.length - 1 } as Record<string, number>)[e.key];
    if (next === undefined) return;
    e.preventDefault();
    btnRefs.current[(next + SECTIONS.length) % SECTIONS.length]?.focus();
  };

  /* ---- The floating label ---- */
  const showTip = (i: number) => {
    if (railRef.current && canExpandRef.current) return;      // the expanded rail shows its own labels
    const nav = navRef.current, btn = btnRefs.current[i];
    if (!nav || !btn) return;
    const n = nav.getBoundingClientRect(), b = btn.getBoundingClientRect();
    setTip({ i, on: true, at: railRef.current ? b.top + b.height / 2 - n.top : b.left + b.width / 2 - n.left });
  };
  const hideTip = (i: number) => setTip((t) => (t.i === i ? { ...t, on: false } : t));
  const canExpandRef = useRef(canExpand); canExpandRef.current = canExpand;
  const onFocus = (i: number) => (e: FocusEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.matches(':focus-visible')) return;
    setFocusIn(true); setHover(i); showTip(i);
  };
  const onEnter = (i: number) => (e: PointerEvent<HTMLButtonElement>) => { if (e.pointerType === 'mouse') { setHover(i); showTip(i); } };

  return (
    <nav
      className={`snav ${rail ? 'snav--rail' : 'snav--row'}${shown ? '' : ' is-hidden'}${open ? ' is-expanded' : ''}`}
      aria-label="Sections" ref={navRef} inert={inert || !shown}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPointerIn(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setPointerIn(false); setHover(-1); } }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setFocusIn(false); if (!pointerIn) setHover(-1); } }}
    >
      <div className="snav__bar">
        <span className="snav__num" aria-hidden="true"><span key={active}>{two(active + 1)}</span></span>
        <span className="snav__line" aria-hidden="true"></span>
        <div className="snav__strip" ref={stripRef} onKeyDown={onKeyDown}>
          <div className="snav__list" style={{ '--i': active, '--h': Math.max(0, hover) } as CSSProperties}>
            <span className="snav__glow" aria-hidden="true"></span>
            <span className={`snav__hover${hover >= 0 && hover !== active ? ' is-on' : ''}`} aria-hidden="true"></span>
            {SECTIONS.map((s, i) => (
              <button
                key={s.id} type="button" className={`snav__btn${i === active ? ' is-active' : ''}`}
                ref={(el) => { btnRefs.current[i] = el; }} style={{ '--n': i } as CSSProperties}
                aria-label={s.label} aria-current={i === active ? 'location' : undefined}
                onClick={() => go(i)}
                onFocus={onFocus(i)} onBlur={() => hideTip(i)}
                onPointerEnter={onEnter(i)} onPointerLeave={() => hideTip(i)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[s.id]}</svg>
                {rail && <span className="snav__more" aria-hidden="true"><span>{s.label}</span></span>}
              </button>
            ))}
          </div>
        </div>
        <span className="snav__line" aria-hidden="true"></span>
        <span className="snav__num snav__num--total" aria-hidden="true">{two(SECTIONS.length)}</span>
      </div>
      <span className={`snav__tip${tip.on ? ' is-on' : ''}`} aria-hidden="true" style={{ '--at': `${tip.at}px` } as CSSProperties}>
        {SECTIONS[tip.i].label}
      </span>
    </nav>
  );
}
