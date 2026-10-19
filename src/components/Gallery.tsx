/* =========================================================
   GALLERY — the photos as a curved, moving film strip
   (photos: data/gallery.ts; the ribbon itself: gallery/ribbon.ts)
   - The ribbon is WebGL: the photos sit on a strip bent like the
     inside of a cylinder, drifting gently (in from the left, out to
     the right) while on screen; they emerge from and sink back into
     the page at its ends. Drag or swipe it (with a little inertia);
     Previous / Next and Play / Pause below it; ← → when it has focus.
     Keyboard focus inside the gallery, dragging, an open preview and
     the visitor's Pause stop the drift.
   - Click / tap a photo (not a drag), or Enter on the focused ribbon:
     it opens flat and whole in a preview above the page
     (gallery/Preview.tsx). Closing it leaves the ribbon, the page's
     scroll position and Play / Pause exactly as they were.
   - The same photos are also a plain horizontal scroll strip in the
     page. It's what shows while the ribbon loads, and for good if
     WebGL isn't available or fails. Once the ribbon is drawn the
     strip stays only for screen readers (the canvas is decorative).
   - Reduced motion: no drift (Play still starts it) and no inertia.
   - Vertical swipes and the mouse wheel keep scrolling the page.
   ========================================================= */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GALLERY } from '../data/gallery';
import { createRibbon, type Ribbon } from './gallery/ribbon';
import { Preview } from './gallery/Preview';

const two = (n: number) => String(n).padStart(2, '0');
type Mode = 'loading' | 'live' | 'fallback';

export function Gallery() {
  const photos = GALLERY;
  const n = photos.length;
  const [mode, setMode] = useState<Mode>('loading');
  const [under, setUnder] = useState(false);          // the strip has faded under the ribbon
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [said, setSaid] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLUListElement>(null);
  const ribbon = useRef<Ribbon | null>(null);
  const [preview, setPreview] = useState<{ i: number; opener: HTMLElement | null } | null>(null);
  const open = (i: number, opener: HTMLElement | null) => { ribbon.current?.hold('preview', true); setPreview({ i, opener }); };
  const openRef = useRef(open); openRef.current = open;

  useEffect(() => {
    let r: Ribbon | null = null, timer = 0;
    try {
      r = createRibbon(hostRef.current!, photos, {
        onIndex: setIndex,
        onPlaying: setPlaying,
        onPick: (i) => openRef.current(i, hostRef.current),
        onReady: () => { setMode('live'); timer = window.setTimeout(() => setUnder(true), 450); },
        onFail: (why) => { console.warn('[gallery] showing the plain gallery:', why); r?.destroy(); ribbon.current = r = null; setMode('fallback'); setUnder(false); },
      });
      ribbon.current = r;
    } catch (err) {
      console.warn('[gallery] showing the plain gallery:', err instanceof Error ? err.message : err);
      setMode('fallback');
    }
    return () => { clearTimeout(timer); r?.destroy(); ribbon.current = null; };
  }, [photos]);

  const live = mode === 'live';
  // the plain strip: previous / next scroll it by one photo
  const scrollStrip = (dir: 1 | -1) => {
    const s = stripRef.current, first = s?.firstElementChild as HTMLElement | null;
    if (s && first) s.scrollBy({ left: dir * (first.offsetWidth + 12), behavior: 'smooth' });
  };
  const step = (dir: 1 | -1) => {
    if (ribbon.current) {
      if (dir > 0) ribbon.current.next(); else ribbon.current.prev();
      const i = (index + dir + n) % n;
      setSaid(`Photo ${i + 1} of ${n}: ${photos[i].alt}`);
    } else scrollStrip(dir);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && ribbon.current) { e.preventDefault(); open(ribbon.current.index, e.currentTarget); return; }
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
        onFocus={() => ribbon.current?.hold('focus', true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) ribbon.current?.hold('focus', false); }}
      >
        <div className="gal__frame">
          {/* The same photos, plainly: shown while the ribbon loads or if it can't run */}
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
          {/* The ribbon (its canvas is decorative: the strip above carries the descriptions) */}
          <div
            className="gal__ribbon" ref={hostRef} role="group"
            tabIndex={live ? 0 : -1} aria-hidden={!live}
            aria-label="Curved photo strip: left and right arrow keys move between photos, Enter opens the one in the middle"
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
              <button type="button" className="gal__btn" aria-label={playing ? 'Pause the moving gallery' : 'Play the moving gallery'}
                onClick={() => ribbon.current?.toggle()}>
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
          onClose={() => { setPreview(null); ribbon.current?.hold('preview', false); }} />
      )}
    </section>
  );
}
