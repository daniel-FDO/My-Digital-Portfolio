/* =========================================================
   GALLERY — a horizontal photo carousel (photos: data/gallery.ts)
   - The front photo is large and sharp; its neighbours are smaller,
     dimmer and turned slightly away. Wide screens centre it; narrow
     ones show it with a peek of the next one.
   - Mouse drag and touch swipe, then it settles on the nearest photo.
     Touch keeps vertical page scrolling (touch-action: pan-y).
   - Or: Previous / Next, the arrow keys (Home / End) when the photos
     have focus, or a click on a neighbour. No autoplay.
   - A small "Drag" badge follows a precise pointer over the photos.
   - Reduced motion: no easing between photos (dragging still follows
     the finger). Positions are written straight to the cards each
     frame, not through React.
   ========================================================= */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { GALLERY } from '../data/gallery';
import { calm } from '../lib/motion';

const two = (n: number) => String(n).padStart(2, '0');
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/** The carousel's sizes: below 560px wide it's the narrow layout */
function measure(view: HTMLElement, card: HTMLElement) {
  const W = view.clientWidth, cw = card.offsetWidth, narrow = W < 560;
  return { W, cw, narrow, step: narrow ? cw + 12 : cw * 0.9 + 22 };
}

interface Drag {
  id: number;
  x: number;
  y: number;
  from: number;          // pos when it started
  dragging: boolean;     // past the threshold (a drag, not a click)
  samples: { x: number; t: number }[];
}

export function Gallery() {
  const photos = GALLERY;
  const n = photos.length;
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState(false);          // the Drag badge is showing

  const viewRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const pos = useRef(0);                             // where the carousel is (0 = first photo, can be fractional)
  const target = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const indexRef = useRef(0);

  /* ---- Draw: every card's place from `pos` ---- */
  const draw = useCallback(() => {
    const view = viewRef.current;
    const first = cardRefs.current[0];
    if (!view || !first) return;
    const { W, cw, narrow, step } = measure(view, first);
    const p = pos.current;
    // Wide: the front card is centred. Narrow: left-aligned, so the next one peeks in
    // (the last one aligns right, so the previous one peeks in instead).
    const cx = narrow
      ? cw / 2 + (n > 1 ? (W - cw) * clamp(p - (n - 2), 0, 1) : (W - cw) / 2)
      : W / 2;
    const tilt = narrow ? 6 : 11, shrink = narrow ? 0.08 : 0.14;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = i - p, a = Math.min(Math.abs(d), 1.5);
      const x = cx + d * step - cw / 2;
      el.style.transform = `translate3d(${x.toFixed(2)}px,0,0) rotateY(${(clamp(-d, -1, 1) * tilt).toFixed(2)}deg) scale(${(1 - shrink * Math.min(a, 1)).toFixed(4)})`;
      el.style.zIndex = String(100 - Math.round(a * 10));
      el.style.setProperty('--dim', (Math.min(a, 1) * 0.55).toFixed(3));
    });
  }, [n]);

  const settleIndex = useCallback((i: number) => {
    if (i !== indexRef.current) { indexRef.current = i; setIndex(i); }
  }, []);

  /* ---- Animate pos → target (eases out; interruptible) ---- */
  const tick = useCallback((t: number) => {
    const dt = Math.min(64, t - (last.current || t));
    last.current = t;
    const diff = target.current - pos.current;
    if (Math.abs(diff) < 0.0008) {
      pos.current = target.current;
      raf.current = 0;
      draw();
      return;
    }
    pos.current += diff * (1 - Math.exp(-dt / 95));
    draw();
    raf.current = requestAnimationFrame(tick);
  }, [draw]);

  const go = useCallback((i: number) => {
    i = clamp(Math.round(i), 0, n - 1);
    target.current = i;
    settleIndex(i);
    if (calm()) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      pos.current = i;
      draw();
      return;
    }
    if (!raf.current) { last.current = 0; raf.current = requestAnimationFrame(tick); }
  }, [n, draw, tick, settleIndex]);

  // First layout + keep it right when the size changes; stop everything on unmount
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(viewRef.current!);
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [draw]);

  /* ---- Dragging (mouse) and swiping (touch / pen) ---- */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || n < 2) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: pos.current, dragging: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
    suppressClick.current = false;
  };

  const moveBadge = (e: ReactPointerEvent<HTMLDivElement>) => {
    const badge = badgeRef.current, view = viewRef.current;
    if (!badge || !view || e.pointerType !== 'mouse' || !finePointer.matches) return;
    const r = view.getBoundingClientRect();
    badge.style.transform = `translate3d(${(e.clientX - r.left).toFixed(1)}px,${(e.clientY - r.top).toFixed(1)}px,0)`;
    if (!hint) setHint(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    moveBadge(e);
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.dragging) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;   // not yet / a vertical scroll
      g.dragging = true;
      suppressClick.current = true;
      viewRef.current?.setPointerCapture(e.pointerId);
      viewRef.current?.classList.add('is-dragging');
    }
    const first = cardRefs.current[0], view = viewRef.current;
    if (!first || !view) return;
    const { step } = measure(view, first);
    let p = g.from - dx / step;
    if (p < 0) p *= 0.35;                                            // a little give past the ends
    else if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.35;
    pos.current = p;
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
    draw();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    drag.current = null;
    viewRef.current?.classList.remove('is-dragging');
    if (viewRef.current?.hasPointerCapture(e.pointerId)) viewRef.current.releasePointerCapture(e.pointerId);
    if (!g.dragging) return;
    // A flick carries on a little further than where it was let go
    const s = g.samples, a = s[0], b = s[s.length - 1];
    const first = cardRefs.current[0], view = viewRef.current;
    const step = first && view ? measure(view, first).step : 1;
    const v = !cancelled && b.t > a.t ? -(b.x - a.x) / (b.t - a.t) / step : 0;   // photos per ms
    const start = Math.round(g.from);
    go(clamp(Math.round(pos.current + v * 160), start - 1, start + 1));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = ({ ArrowLeft: indexRef.current - 1, ArrowRight: indexRef.current + 1, Home: 0, End: n - 1 } as Record<string, number>)[e.key];
    if (k === undefined) return;
    e.preventDefault();
    go(k);
  };

  // A click on a neighbour brings it to the front (not after a drag)
  const onClickCapture = (e: MouseEvent) => {
    if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; }
  };

  const atStart = index === 0, atEnd = index === n - 1;

  return (
    <section className="sec gal" id="gallery" aria-labelledby="galleryTitle">
      <div className="sec__head">
        <h2 className="h" id="galleryTitle">Gallery</h2>
        <span className="gal__edition" aria-hidden="true">Photos / {two(n)}</span>
      </div>

      <div className="gal__stage" role="region" aria-roledescription="carousel" aria-label="Photos">
        <div
          className={`gal__view${hint ? ' is-hinting' : ''}`} ref={viewRef} tabIndex={0}
          aria-label="Photos: use the left and right arrow keys to move between them"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)} onPointerCancel={(e) => endDrag(e, true)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHint(false); }}
          onKeyDown={onKeyDown} onClickCapture={onClickCapture}
          onDragStart={(e) => e.preventDefault()}
        >
          {photos.map((ph, i) => (
            <figure
              key={ph.src} className={`gal__card${i === index ? ' is-front' : ''}`}
              ref={(el) => { cardRefs.current[i] = el; }}
              role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`}
              onClick={() => { if (i !== indexRef.current) go(i); }}
            >
              <img
                src={ph.src} alt={ph.alt} width={ph.width} height={ph.height}
                loading="lazy" decoding="async" draggable={false}
                style={ph.position ? ({ objectPosition: ph.position } as CSSProperties) : undefined}
              />
              <span className="gal__num" aria-hidden="true">{two(i + 1)}</span>
              {ph.caption && <figcaption className="gal__cap">{ph.caption}</figcaption>}
            </figure>
          ))}
          <span className="gal__badge" ref={badgeRef} aria-hidden="true"><span>Drag</span></span>
        </div>

        <div className="gal__bar">
          <span className="gal__count" aria-hidden="true"><b>{two(index + 1)}</b> / {two(n)}</span>
          <span className="sr" aria-live="polite" aria-atomic="true">Photo {index + 1} of {n}</span>
          <span className="gal__hint" aria-hidden="true">Drag, swipe or use ← →</span>
          <span className="gal__nav">
            <button type="button" className="gal__btn" aria-label="Previous photo" aria-disabled={atStart} onClick={() => { if (!atStart) go(index - 1); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
            </button>
            <button type="button" className="gal__btn" aria-label="Next photo" aria-disabled={atEnd} onClick={() => { if (!atEnd) go(index + 1); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
            </button>
          </span>
        </div>
      </div>
    </section>
  );
}
