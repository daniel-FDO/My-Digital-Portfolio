/* =========================================================
   PHOTO PREVIEW — one gallery photo, flat and whole, above the site
   - Rendered into <body> (a portal), outside the page's own root, so
     nothing that blurs or transforms the page can touch it. The page
     root is made inert while it's open.
   - One fixed backdrop layer darkens and blurs everything behind it
     (backdrop-filter; a plain dark translucent layer where that isn't
     supported). The photo and controls sit above it, sharp.
   - The photo is shown complete (object-fit: contain), at most its
     own pixel size: a small file is never blown up.
   - Close (button, Escape, a click on the backdrop), Previous / Next
     (buttons, ← →, a horizontal swipe), a small counter. Focus moves
     in, stays in (Tab wraps) and returns to where it came from.
   - Page scrolling is locked without the page shifting sideways
     (scrollbar-gutter keeps the scrollbar's space), and the scroll
     position is put back exactly on close.
   - Reduced motion: a plain fade, no scaling.
   ========================================================= */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { GalleryPhoto } from '../../data/gallery';
import { calm } from '../../lib/motion';

interface Props {
  photos: GalleryPhoto[];
  start: number;
  /** where focus goes back to on close */
  opener: HTMLElement | null;
  onClose: () => void;
}

const two = (n: number) => String(n).padStart(2, '0');

export function Preview({ photos, start, opener, onClose }: Props) {
  const n = photos.length;
  const [i, setI] = useState(start);
  const [shown, setShown] = useState(false);          // drives the opening / closing transition
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const swipe = useRef<{ id: number; x: number; y: number; pointers: number; used: boolean } | null>(null);
  const ph = photos[i];

  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    window.setTimeout(onClose, calm() ? 0 : 180);
  }, [onClose]);

  // Open: lock the page behind (inert, no scrolling, no width change), focus in. Close: undo it all.
  useEffect(() => {
    const page = document.getElementById('root');
    const html = document.documentElement;
    const y = scrollY, x = scrollX;
    const prev = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    if (page) page.inert = true;
    html.style.scrollbarGutter = 'stable';
    html.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(raf);
      if (page) page.inert = false;
      html.style.overflow = prev.overflow;
      html.style.scrollbarGutter = prev.gutter;
      if (scrollY !== y || scrollX !== x) scrollTo({ left: x, top: y, behavior: 'instant' });
      opener?.focus({ preventScroll: true });
    };
  }, [opener]);

  // the neighbours load in the background, so Previous / Next are instant
  useEffect(() => {
    [i + 1, i - 1].forEach((k) => { const im = new Image(); im.decoding = 'async'; im.src = photos[(k + n) % n].src; });
  }, [i, n, photos]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Tab') {
      // keep focus inside the preview
      const f = [...(rootRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      const at = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && at <= 0) { e.preventDefault(); f.at(-1)?.focus(); }
      else if (!e.shiftKey && at === f.length - 1) { e.preventDefault(); f[0]?.focus(); }
    }
  };

  // Touch: a clear horizontal swipe changes photo. Two fingers (zooming) or a mostly vertical move don't.
  const onDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') return;
    if (swipe.current) { swipe.current.pointers++; return; }
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pointers: 1, used: false };
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    if (e.pointerId !== s.id) { s.pointers--; return; }
    swipe.current = null;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.pointers === 1 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) { go(dx < 0 ? 1 : -1); swiped.current = true; }
  };
  const swiped = useRef(false);
  // a click on the backdrop (anywhere that isn't the photo or a control) closes it
  const onClick = (e: MouseEvent) => {
    if (swiped.current) { swiped.current = false; return; }
    const t = e.target as HTMLElement;
    if (!t.closest('.gpv__img, .gpv__btn')) close();
  };

  return createPortal(
    <div
      ref={rootRef} className={`gpv${shown ? ' is-in' : ''}`}
      role="dialog" aria-modal="true" aria-label={`Photo ${i + 1} of ${n}`}
      onKeyDown={onKeyDown} onClick={onClick}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { swipe.current = null; }}
    >
      <div className="gpv__veil" aria-hidden="true" />
      <figure className="gpv__fig">
        <img
          key={ph.src} className="gpv__img" src={ph.src} alt={ph.alt}
          width={ph.width} height={ph.height} decoding="async" draggable={false}
        />
      </figure>
      <p className="gpv__count" aria-hidden="true"><b>{two(i + 1)}</b> / {two(n)}</p>
      <button ref={closeRef} type="button" className="gpv__btn gpv__close" aria-label="Close preview" onClick={close}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <button type="button" className="gpv__btn gpv__prev" aria-label="Previous photo" onClick={() => go(-1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
      </button>
      <button type="button" className="gpv__btn gpv__next" aria-label="Next photo" onClick={() => go(1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
      </button>
      <p className="sr" aria-live="polite" aria-atomic="true">Photo {i + 1} of {n}</p>
    </div>,
    document.body,
  );
}
