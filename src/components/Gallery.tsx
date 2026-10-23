/* =========================================================
   GALLERY — the photos as a darkroom tide
   (photos: data/gallery.ts; the plate itself: gallery/isophote.ts)
   - One photo at a time, on a paper plate (WebGL). Changing photo is
     a tide: the photo washes off into a contour map of itself (the
     page background's fine lines), the next photo's map comes in, and
     it develops up through it behind a copper line, like a print in a
     developer tray. The neighbours show as their maps alone.
   - Autoplay waits ~4 s per photo, then a copper line climbs through
     its tones and becomes the tide. Drag or swipe scrubs the tide by
     hand; Previous / Next and Play / Pause below it; ← → when it has
     focus. Keyboard focus inside the gallery, dragging, an open
     preview and the visitor's Pause stop autoplay.
   - Click / tap the photo (not a drag), or Enter on the focused plate:
     it opens flat and whole in a preview above the page
     (gallery/Preview.tsx). Clicking a neighbour's map goes to it.
     Closing the preview leaves the plate, the page's scroll position
     and Play / Pause exactly as they were.
   - The same photos are also a plain horizontal scroll strip in the
     page. It stays unseen while the plate loads and shows only if
     WebGL isn't available or fails. Once the plate is drawn the
     strip stays only for screen readers (the canvas is decorative).
   - Reduced motion: no autoplay (Play still starts it) and no tide:
     a plain cross-fade.
   - Vertical swipes and the mouse wheel keep scrolling the page.
   ========================================================= */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GALLERY } from '../data/gallery';
import { createIsophote, type Isophote } from './gallery/isophote';
import { Preview } from './gallery/Preview';

const two = (n: number) => String(n).padStart(2, '0');
type Mode = 'loading' | 'live' | 'fallback';

export function Gallery() {
  const photos = GALLERY;
  const n = photos.length;
  const [mode, setMode] = useState<Mode>('loading');
  const [under, setUnder] = useState(false);          // the strip has faded under the plate
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [said, setSaid] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLUListElement>(null);
  const engine = useRef<Isophote | null>(null);
  const [preview, setPreview] = useState<{ i: number; opener: HTMLElement | null } | null>(null);
  const open = (i: number, opener: HTMLElement | null) => { engine.current?.hold('preview', true); setPreview({ i, opener }); };
  const openRef = useRef(open); openRef.current = open;

  useEffect(() => {
    let r: Isophote | null = null, timer = 0;
    try {
      r = createIsophote(hostRef.current!, photos, {
        onIndex: setIndex,
        onPlaying: setPlaying,
        onPick: (i) => openRef.current(i, hostRef.current),
        onReady: () => { setMode('live'); timer = window.setTimeout(() => setUnder(true), 450); },
        onFail: (why) => { console.warn('[gallery] showing the plain gallery:', why); r?.destroy(); engine.current = r = null; setMode('fallback'); setUnder(false); },
      });
      engine.current = r;
    } catch (err) {
      console.warn('[gallery] showing the plain gallery:', err instanceof Error ? err.message : err);
      setMode('fallback');
    }
    return () => { clearTimeout(timer); r?.destroy(); engine.current = null; };
  }, [photos]);

  const live = mode === 'live';
  // the plain strip: previous / next scroll it by one photo
  const scrollStrip = (dir: 1 | -1) => {
    const s = stripRef.current, first = s?.firstElementChild as HTMLElement | null;
    if (s && first) s.scrollBy({ left: dir * (first.offsetWidth + 12), behavior: 'smooth' });
  };
  const step = (dir: 1 | -1) => {
    if (engine.current) {
      if (dir > 0) engine.current.next(); else engine.current.prev();
      const i = (index + dir + n) % n;
      setSaid(`Photo ${i + 1} of ${n}: ${photos[i].alt}`);
    } else scrollStrip(dir);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && engine.current) { e.preventDefault(); open(engine.current.index, e.currentTarget); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };

  return (
    <section className="sec gal" id="gallery" aria-labelledby="galleryTitle">
      <div className="sec__head">
        <h2 className="h" id="galleryTitle">Gallery</h2>
        <span className="gal__edition" aria-hidden="true">Photos / {two(n)}</span>
      </div>

      <div
        className={`gal__stage is-${mode}${under ? ' is-under' : ''}`}
        role="region" aria-roledescription="carousel" aria-label="Photos"
        onFocus={() => engine.current?.hold('focus', true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) engine.current?.hold('focus', false); }}
      >
        <div className="gal__frame">
          {/* The same photos, plainly: shown only if the plate can't run */}
          <ul className="gal__strip" ref={stripRef} tabIndex={live ? -1 : 0} aria-label="Photos (scroll sideways)">
            {photos.map((ph, i) => (
              <li key={ph.src} className="gal__item">
                {/* a button per photo: opens the preview (its name is the photo's description) */}
                <button type="button" className="gal__open" tabIndex={live ? -1 : 0} onClick={(e) => open(i, e.currentTarget)}>
                  <img src={ph.src} alt={ph.alt} width={ph.width} height={ph.height} loading="lazy" decoding="async" draggable={false}
                    style={ph.position ? { objectPosition: ph.position } : undefined} />
                </button>
              </li>
            ))}
          </ul>
          {/* The plate (its canvas is decorative: the strip above carries the descriptions) */}
          <div
            className="gal__plate" ref={hostRef} role="group"
            tabIndex={live ? 0 : -1} aria-hidden={!live}
            aria-label="Photo plate: left and right arrow keys change the photo, Enter opens it"
            onKeyDown={onKeyDown}
          />
        </div>

        <div className="gal__bar">
          <span className="gal__count" aria-hidden="true"><b>{two(index + 1)}</b> / {two(n)}</span>
          <span className="sr" aria-live="polite" aria-atomic="true">{said}</span>
          <span className="gal__hint" aria-hidden="true">{live ? 'Drag, swipe or use ← → · click to open' : 'Scroll sideways · tap to open'}</span>
          <span className="gal__nav">
            <button type="button" className="gal__btn" aria-label="Previous photo" onClick={() => step(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
            </button>
            {live && (
              <button type="button" className="gal__btn" aria-label={playing ? 'Pause the slideshow' : 'Play the slideshow'}
                onClick={() => engine.current?.toggle()}>
                {playing
                  ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5v11M15 6.5v11" /></svg>
                  : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.2v11.6a.6.6 0 0 0 .9.5l9-5.8a.6.6 0 0 0 0-1L9.4 5.7a.6.6 0 0 0-.9.5z" /></svg>}
              </button>
            )}
            <button type="button" className="gal__btn" aria-label="Next photo" onClick={() => step(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
            </button>
          </span>
        </div>
      </div>
      {preview && (
        <Preview photos={photos} start={preview.i} opener={preview.opener}
          onClose={() => { setPreview(null); engine.current?.hold('preview', false); }} />
      )}
    </section>
  );
}
