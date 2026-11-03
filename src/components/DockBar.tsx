/* =========================================================
   DOCK — the bottom bar (styles: dock.css).
   Search or ask (opens the command menu; Ctrl / ⌘ K is handled there),
   without the rail (below 1000px) the current section ("07 Activity ▴", which opens the
   section sheet: SectionSheet.tsx), one divider, then theme and back
   to top. The bar is near-opaque, so text behind it doesn't show.
   - Back to top appears once you've scrolled 60% of a screen, its thin
     ring filling as you read down the page.
   - Scrolling down folds the search label away to its icon; scrolling
     up brings it back. On phones (640px and narrower) the whole dock
     slides away while you scroll down past 400px and returns as soon
     as you scroll up, or when keyboard focus reaches it.
   - Never folded or hidden while it's in use (pointer or focus in it,
     the command menu or the sheet open).
   - Wide screens with a precise pointer: hovering or keyboard focus
     slides the theme / back-to-top labels open, a pill gliding to the
     item under the pointer; it closes ~90 ms after you leave.
   - Reduced motion: nothing slides or fades; states change at once.
   Switched on by ENABLE_DOCK_REDESIGN in Dock.tsx (false = the
   previous toolbar).
   ========================================================= */
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import { useMediaQuery } from '../lib/motion';
import { RAIL_QUERY, SECTIONS, goToSection, onScrollFrame, two, useActiveSection } from '../lib/sections';
import { useTheme } from '../lib/theme';
import { SectionSheet } from './SectionSheet';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const COLLAPSE_DELAY = 90;

interface Props {
  inert: boolean;
  menuOpen: boolean;
  onAsk: () => void;
  onTop: () => void;
  /** scroll to a section and focus its heading */
  onGo: (id: string) => void;
}

export function DockBar({ inert, menuOpen, onAsk, onTop, onGo }: Props) {
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === 'dark';
  const canExpand = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 640px)');
  const rail = useMediaQuery(RAIL_QUERY);
  const phone = useMediaQuery('(max-width: 640px)');
  const active = useActiveSection();
  // open while a mouse rests on it OR keyboard focus is inside it; closes 90 ms after neither is true
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number; on: boolean }>({ x: 0, w: 0, on: false });
  const [sheet, setSheet] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const hovered = useRef<HTMLElement | null>(null);
  const ring = useRef<SVGCircleElement>(null);
  const sectRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  busy.current = focusIn || pointerIn || menuOpen || sheet;
  const phoneRef = useRef(phone);
  phoneRef.current = phone;

  useEffect(() => {
    if (pointerIn || focusIn) { setExpanded(true); return; }
    const t = window.setTimeout(() => setExpanded(false), COLLAPSE_DELAY);
    return () => clearTimeout(t);
  }, [pointerIn, focusIn]);
  const open = expanded && canExpand;

  // Scrolling: the ring and when back to top shows, folding the label, tucking away on phones
  useEffect(() => onScrollFrame(({ y, progress, dir }) => {
    if (ring.current) ring.current.style.strokeDashoffset = String(100 - progress * 100);
    setShowTop(y > innerHeight * 0.6);
    if (y < 200 || dir === -1) setCompact(false);
    else if (dir === 1 && !busy.current) setCompact(true);
    if (!phoneRef.current || y < 400 || dir === -1) setHidden(false);
    else if (dir === 1 && !busy.current) setHidden(true);
  }), []);
  useEffect(() => { if (!phone) setHidden(false); }, [phone]);
  useEffect(() => { if (rail) setSheet(false); }, [rail]);
  useEffect(() => { if (busy.current) { setHidden(false); } }, [menuOpen, sheet]);

  // the highlight pill follows the hovered item, also while the labels slide open and the items move
  const place = (el: HTMLElement | null) => {
    hovered.current = el;
    if (!el) { setPill((p) => ({ ...p, on: false })); return; }
    setPill({ x: el.offsetLeft, w: el.offsetWidth, on: true });
  };
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const ro = new ResizeObserver(() => { if (hovered.current) place(hovered.current); });
    ro.observe(bar);                     // the bar resizing (the search folding) moves the items too
    bar.querySelectorAll('.dock2__item').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [rail]);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    setHidden(false);                    // keyboard focus reached it while it was tucked away
    if (t.matches(':focus-visible')) { setFocusIn(true); place(t.closest('.dock2__item')); }
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) { setFocusIn(false); if (!pointerIn) place(null); }
  };
  const item = {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => { if (e.pointerType === 'mouse') place(e.currentTarget); },
  };

  return (
    <div
      ref={barRef}
      className={`dock2${open ? ' is-expanded' : ''}${compact ? ' is-compact' : ''}${hidden ? ' is-hidden' : ''}`}
      id="dock" inert={inert} data-xray="dock"
      style={{ '--pill-x': `${pill.x}px`, '--pill-w': `${pill.w}px` } as CSSProperties}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPointerIn(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setPointerIn(false); place(null); } }}
      onFocus={onFocus} onBlur={onBlur}
    >
      <span className={`dock2__pill${pill.on && canExpand ? ' is-on' : ''}`} aria-hidden="true"></span>
      <button
        type="button" className="dock2__search dock2__item" id="askOpen" onClick={onAsk} {...item}
        aria-label="Search or ask" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="cmd" aria-keyshortcuts="Control+K Meta+K"
      >
        <svg className="dock2__glass" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
        <span className="dock2__label" aria-hidden="true"><span>Search or ask…</span></span>
        <span className="dock2__keys" aria-hidden="true"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
      </button>
      {!rail && (
        <button
          type="button" className="dock2__sect dock2__item" ref={sectRef} onClick={() => setSheet(true)} {...item}
          aria-haspopup="dialog" aria-expanded={sheet} aria-controls={sheet ? 'sectionSheet' : undefined}
        >
          <span className="sr">Sections, current: </span>
          <span className="dock2__sect-n">{two(active + 1)}</span>
          <span className="dock2__sect-label">{SECTIONS[active].label}</span>
          <svg className="dock2__caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 14.5 5.5-5.5 5.5 5.5" /></svg>
        </button>
      )}
      <span className="dock2__divider" aria-hidden="true"></span>
      <button type="button" className="dock2__btn dock2__item" id="themeToggle" onClick={toggleTheme} {...item}
        aria-label={toLight ? 'Switch to light theme' : 'Switch to dark theme'}
        data-tip={open ? undefined : toLight ? 'Light theme' : 'Dark theme'}>
        <span className="dock2__theme" aria-hidden="true">
          <svg className="dock2__sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
          <svg className="dock2__moon" viewBox="0 0 24 24"><path d="M20.4 13.3A8.5 8.5 0 1 1 10.7 3.6a6.6 6.6 0 0 0 9.7 9.7z" /></svg>
        </span>
        <span className="dock2__more" aria-hidden="true"><span>{toLight ? 'Light theme' : 'Dark theme'}</span></span>
      </button>
      {/* Back to top: only once you've scrolled; its ring shows how far down the page you are */}
      <button type="button" className={`dock2__btn dock2__item dock2__top${showTop ? '' : ' is-away'}`} id="toTop" onClick={onTop} {...item}
        aria-label="Back to top" data-tip={open ? undefined : 'Back to top'} inert={!showTop}>
        <span className="dock2__ringwrap" aria-hidden="true">
          <svg className="dock2__ring" viewBox="0 0 32 32">
            <circle className="dock2__track" cx="16" cy="16" r="14" pathLength={100} />
            <circle className="dock2__prog" ref={ring} cx="16" cy="16" r="14" pathLength={100} />
          </svg>
          <svg className="dock2__up" viewBox="0 0 24 24"><path d="M12 17V7M7.5 11.5 12 7l4.5 4.5" /></svg>
        </span>
        <span className="dock2__more" aria-hidden="true"><span>Back to top</span></span>
      </button>
      {sheet && (
        <SectionSheet
          active={active}
          onPick={(i) => { setSheet(false); goToSection(i, onGo, onTop); }}
          onClose={() => { setSheet(false); sectRef.current?.focus({ preventScroll: true }); }}
        />
      )}
    </div>
  );
}
