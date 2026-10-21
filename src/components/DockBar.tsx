/* =========================================================
   DOCK — the bottom bar (styles: dock.css).
   Tinted frosted glass: search on the left (opens the command menu,
   as before; Ctrl / ⌘ K is handled there), one divider, then theme
   and back to top. It never moves while you scroll.
   Expanding action bar: when a mouse rests on it, or keyboard focus
   is inside it, the two icon buttons slide their labels open and the
   bar widens to fit; a highlight pill glides to the item under the
   pointer. It closes again ~90 ms after the pointer leaves / focus
   moves out. Touch and narrow screens keep the compact bar (there's
   no hover to reveal labels, and no room for them) and every tap acts
   at once. Reduced motion: labels appear without sliding or blurring.
   Switched on by ENABLE_DOCK_REDESIGN in Dock.tsx (false = the
   previous toolbar).
   ========================================================= */
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import { useMediaQuery } from '../lib/motion';
import { useTheme } from '../lib/theme';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const COLLAPSE_DELAY = 90;

interface Props {
  inert: boolean;
  menuOpen: boolean;
  onAsk: () => void;
  onTop: () => void;
}

export function DockBar({ inert, menuOpen, onAsk, onTop }: Props) {
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === 'dark';
  const canExpand = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 640px)');
  // open while a mouse rests on it OR keyboard focus is inside it; closes 90 ms after neither is true
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number; on: boolean }>({ x: 0, w: 0, on: false });
  const barRef = useRef<HTMLDivElement>(null);
  const hovered = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (pointerIn || focusIn) { setExpanded(true); return; }
    const t = window.setTimeout(() => setExpanded(false), COLLAPSE_DELAY);
    return () => clearTimeout(t);
  }, [pointerIn, focusIn]);
  const open = expanded && canExpand;

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
    bar.querySelectorAll('.dock2__item').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
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
      className={`dock2${open ? ' is-expanded' : ''}`} id="dock" inert={inert}
      style={{ '--pill-x': `${pill.x}px`, '--pill-w': `${pill.w}px` } as CSSProperties}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPointerIn(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setPointerIn(false); place(null); } }}
      onFocus={onFocus} onBlur={onBlur}
    >
      <span className={`dock2__pill${pill.on && canExpand ? ' is-on' : ''}`} aria-hidden="true"></span>
      <button
        type="button" className="dock2__search dock2__item" id="askOpen" onClick={onAsk} {...item}
        aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="cmd" aria-keyshortcuts="Control+K Meta+K"
      >
        <svg className="dock2__glass" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
        <span className="dock2__label">Search projects…</span>
        <span className="dock2__keys" aria-hidden="true"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
      </button>
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
      <button type="button" className="dock2__btn dock2__item" id="toTop" onClick={onTop} {...item}
        aria-label="Back to top" data-tip={open ? undefined : 'Back to top'}>
        <svg className="dock2__up" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        <span className="dock2__more" aria-hidden="true"><span>Back to top</span></span>
      </button>
    </div>
  );
}
