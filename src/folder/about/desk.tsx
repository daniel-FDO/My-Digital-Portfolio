/* =========================================================
   THE DESK — shared pieces for the About page
   - useReveal: things settle in the first time they scroll into
     view (once; nothing moves with reduced motion). It marks them
     with data-in, not a class, so React re-renders keep it
   - useDrag: a few loose objects can be nudged around the desk
     (mouse / trackpad only, kept inside their area)
   - DeskDialog: the native <dialog> every pop-up window uses
     (Esc / the close button / a click outside close it)
   - CursorLabel: the tiny "OPEN" / "FLIP" tag beside the pointer
   - Doodles: hand-drawn arrows and marks (decorative)
   ========================================================= */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { calm } from '../../lib/motion';

/** Inline style for a CSS variable or two (delay, rotation…) */
export const vars = (v: Record<string, string | number>) => v as CSSProperties;

/* ---- Page-wide actions (the Notepad can be opened from two places) ---- */
export const DeskContext = createContext<{ openNotepad: () => void }>({ openNotepad: () => {} });
export const useDesk = () => useContext(DeskContext);

/* ---- Reveal on scroll: sets data-in on every [data-reveal], once ---- */
export function useReveal(root: RefObject<HTMLElement | null>) {
  const [armed] = useState(() => !calm() && 'IntersectionObserver' in window);
  useEffect(() => {
    if (!armed || !root.current) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        (e.target as HTMLElement).dataset.in = '';
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    root.current.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [armed, root]);
  return armed;
}

/* ---- Drag: offsets go into --dx / --dy (the CSS `translate`), so the
   object's own rotation and hover transform keep working ---- */
let topLayer = 40;
export function useDrag<T extends HTMLElement>(area: RefObject<HTMLElement | null>) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let dx = 0, dy = 0, moved = false;
    let start: { x: number; y: number; dx: number; dy: number; id: number } | null = null;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));

    const down = (e: PointerEvent) => {
      if (!fine.matches || e.button !== 0 || (e.target as Element).closest('a, button, input')) return;
      start = { x: e.clientX, y: e.clientY, dx, dy, id: e.pointerId };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      let nx = start.dx + e.clientX - start.x, ny = start.dy + e.clientY - start.y;
      if (!moved) {
        if (Math.hypot(nx - start.dx, ny - start.dy) < 4) return;   // a click stays a click
        moved = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add('is-dragging');
        el.style.zIndex = String(++topLayer);
      }
      const box = area.current?.getBoundingClientRect();
      if (box) {
        const r = el.getBoundingClientRect(), left = r.left - dx, top = r.top - dy;
        nx = clamp(nx, box.left - left, box.right - (left + r.width));
        ny = clamp(ny, box.top - top, box.bottom - (top + r.height));
      }
      dx = nx; dy = ny;
      el.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      el.style.setProperty('--dy', `${dy.toFixed(1)}px`);
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [area]);
  return ref;
}

/* ---- Dialog: a native modal (focus stays inside, Esc closes it).
   Esc closes only the window, not the whole About page behind it
   (DetailLayer listens for Esc on document). ---- */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}
export function DeskDialog({ open, onClose, labelledBy, className = '', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { opener.current = document.activeElement as HTMLElement | null; d.showModal(); }
    else if (!open && d.open) d.close();
    if (!open) return;
    // While it's open, Esc belongs to this window alone, even if focus has
    // slipped out of it (the dialog still closes itself; only the page's
    // own Esc handler is kept from hearing it)
    const claimEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') e.stopPropagation(); };
    window.addEventListener('keydown', claimEsc, true);
    return () => window.removeEventListener('keydown', claimEsc, true);
  }, [open]);
  return (
    <dialog
      ref={ref} className={`dk-dialog ${className}`} aria-labelledby={labelledBy}
      onClose={() => { onClose(); opener.current?.focus({ preventScroll: true }); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </dialog>
  );
}

/* ---- The small label beside the pointer over [data-label] objects
   (mouse only; it never replaces the cursor, and follows it 1:1) ---- */
export function CursorLabel({ root }: { root: RefObject<HTMLElement | null> }) {
  const tag = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = root.current, el = tag.current;
    if (!host || !el) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onMove = (e: PointerEvent) => {
      const target = fine.matches && e.pointerType === 'mouse' ? (e.target as Element).closest<HTMLElement>('[data-label]') : null;
      if (!target) { el.classList.remove('is-on'); return; }
      el.textContent = target.dataset.label!;
      el.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY + 18}px, 0)`;
      el.classList.add('is-on');
    };
    const off = () => el.classList.remove('is-on');
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', off);
    host.addEventListener('pointerdown', off);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', off);
      host.removeEventListener('pointerdown', off);
    };
  }, [root]);
  return <span className="dk-cursor-tag" ref={tag} aria-hidden="true"></span>;
}

/* ---- Doodles (pathLength=1 lets the CSS "draw" them in) ---- */
type Doodle = { className?: string; style?: CSSProperties };
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const ArrowCurve = ({ className = '', style }: Doodle) => (
  <svg className={`dk-doodle ${className}`} style={style} viewBox="0 0 120 70" aria-hidden="true" data-reveal="draw">
    <path {...stroke} pathLength={1} d="M6 10c22-6 58-2 78 18 10 10 14 22 16 34" />
    <path {...stroke} pathLength={1} d="M88 52l12 12 9-16" />
  </svg>
);
export const ArrowShort = ({ className = '', style }: Doodle) => (
  <svg className={`dk-doodle ${className}`} style={style} viewBox="0 0 70 40" aria-hidden="true" data-reveal="draw">
    <path {...stroke} pathLength={1} d="M4 30c16-16 34-22 58-18" />
    <path {...stroke} pathLength={1} d="M52 4l11 8-9 11" />
  </svg>
);
export const Swoosh = ({ className = '', style }: Doodle) => (
  <svg className={`dk-doodle ${className}`} style={style} viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden="true" data-reveal="draw">
    <path {...stroke} strokeWidth={2.6} pathLength={1} d="M6 20c60-12 140-16 210-10 26 2 50 6 78 0" />
  </svg>
);
export const Sparkle = ({ className = '', style }: Doodle) => (
  <svg className={`dk-doodle ${className}`} style={style} viewBox="0 0 40 40" aria-hidden="true">
    <path {...stroke} strokeWidth={1.8} d="M20 3c1 11 4 15 16 17-12 2-15 6-16 17-1-11-4-15-16-17 12-2 15-6 16-17z" />
  </svg>
);
export const Squiggle = ({ className = '', style }: Doodle) => (
  <svg className={`dk-doodle ${className}`} style={style} viewBox="0 0 60 30" aria-hidden="true">
    <path {...stroke} strokeWidth={2} d="M3 18c6-12 10-12 13 0s8 12 12 0 8-12 12 0 8 10 16-4" />
  </svg>
);

/** A dashed square with a cross: the printer's marks in the corners */
export const RegMark = ({ className = '' }: { className?: string }) => <span className={`dk-reg ${className}`} aria-hidden="true"></span>;
/** A strip of masking tape */
export const Tape = ({ className = '', style }: Doodle) => <span className={`dk-tape ${className}`} style={style} aria-hidden="true"></span>;
/** A paper clip */
export const Clip = ({ className = '', style }: Doodle) => (
  <svg className={`dk-clip ${className}`} style={style} viewBox="0 0 24 64" aria-hidden="true">
    <path d="M8 18v30a5 5 0 0 0 10 0V10a7 7 0 0 0-14 0v42a9 9 0 0 0 18 0V20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
