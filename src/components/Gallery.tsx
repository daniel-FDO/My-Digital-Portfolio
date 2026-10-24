/* =========================================================
   GALLERY — the photos as a spring carousel, iOS-style
   (photos: data/gallery.ts; the carousel itself: gallery/carousel.ts)
   - One big photo in the middle, its neighbours either side, smaller
     and dimmed. Drag or swipe it: it follows the finger, carries on
     with the flick and settles on a photo with a soft spring.
   - A floating Liquid Glass pill over the photo holds the counter and
     Previous / Play-Pause / Next; ← → when the carousel has focus.
     Keyboard focus inside the gallery, dragging, an open preview and
     the visitor's Pause stop autoplay.
   - Click / tap the middle photo, or Enter on the focused carousel:
     it opens flat and whole in a preview above the page
     (gallery/Preview.tsx). Clicking a neighbour brings it to the
     middle. Closing the preview leaves the carousel, the page's
     scroll position and Play / Pause exactly as they were.
   - The same photos are also a plain horizontal scroll strip in the
     page: it carries the descriptions for screen readers (the
     carousel's cards are decorative), and shows only if the carousel
     can't start.
   - Reduced motion: no autoplay (Play still starts it); changes are
     instant (no spring, no momentum).
   - Vertical swipes and the mouse wheel keep scrolling the page.
   ========================================================= */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GALLERY } from '../data/gallery';
import { createCarousel, type Carousel } from './gallery/carousel';
import { Preview } from './gallery/Preview';

const two = (n: number) => String(n).padStart(2, '0');
type Mode = 'loading' | 'live' | 'fallback';

export function Gallery() {
  const photos = GALLERY;
  const n = photos.length;
  const [mode, setMode] = useState<Mode>('loading');
  const [under, setUnder] = useState(false);          // the strip has faded under the carousel
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [said, setSaid] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLUListElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Carousel | null>(null);
  const focusHeld = useRef(false);    // autoplay is held for keyboard focus in the gallery
  const [preview, setPreview] = useState<{ i: number; opener: HTMLElement | null } | null>(null);
  const open = (i: number, opener: HTMLElement | null) => { engine.current?.hold('preview', true); setPreview({ i, opener }); };
  const openRef = useRef(open); openRef.current = open;

  useEffect(() => {
    let r: Carousel | null = null, timer = 0;
    try {
      r = createCarousel(hostRef.current!, photos, {
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
  useEffect(() => {
    const strip = thumbsRef.current;
    const item = strip?.children[index] as HTMLElement | undefined;
    if (strip && item) strip.scrollTo({ left: item.offsetLeft - strip.offsetWidth / 2 + item.offsetWidth / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [index, live]);
  // the plain strip: previous / next scroll it by one photo
  const scrollStrip = (dir: 1 | -1) => {
    const s = stripRef.current, first = s?.firstElementChild as HTMLElement | null;
    if (s && first) s.scrollBy({ left: dir * (first.offsetWidth + 12), behavior: 'smooth' });
  };
  const step = (dir: 1 | -1) => {
    const e = engine.current;
    if (e) {
      const before = e.index;
      if (dir > 0) e.next(); else e.prev();
      // announce only a step that happened (one is ignored mid-swipe)
      if (e.index !== before) setSaid(`Photo ${e.index + 1} of ${n}: ${photos[e.index].alt}`);
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
        onFocus={(e) => {
          // keyboard focus only: a mouse click on the carousel or a button mustn't stop autoplay for good
          const kb = (e.target as Element).matches(':focus-visible');
          if (kb !== focusHeld.current) { focusHeld.current = kb; engine.current?.hold('focus', kb); }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node) && focusHeld.current) { focusHeld.current = false; engine.current?.hold('focus', false); }
        }}
      >
        <div className="gal__frame">
          {/* The same photos, plainly: shown only if the carousel can't start */}
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
          {/* The carousel (its cards are decorative: the strip above carries the descriptions) */}
          <div
            className="gal__plate" ref={hostRef} role="group"
            tabIndex={live ? 0 : -1} aria-hidden={!live}
            aria-label="Photo carousel: left and right arrow keys change the photo, Enter opens it"
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="gal__toolbar">
          <span className="gal__hint" aria-hidden="true">{live ? 'Drag to explore' : 'Scroll to explore'}</span>
          <div className="gal__pill">
            <button type="button" className="gal__btn" aria-label="Previous photo" onClick={() => step(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
            </button>
            <span className="gal__count" aria-hidden="true"><b>{two(index + 1)}</b><i>/</i>{two(n)}</span>
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
          </div>
          {live && <button type="button" className="gal__expand" onClick={(e) => open(index, e.currentTarget)}>View photo <span aria-hidden="true">↗</span></button>}
        </div>

        {live && <div className="gal__thumbs" ref={thumbsRef} role="group" aria-label="Choose a photo">
          {photos.map((ph, i) => <button type="button" key={ph.src} className="gal__thumb" aria-label={`Show photo ${i + 1}`} aria-pressed={index === i}
            onClick={() => { engine.current?.select(i); setSaid(`Photo ${i + 1} of ${n}: ${ph.alt}`); }}>
            <img src={ph.src} alt="" loading="lazy" draggable={false} />
          </button>)}
        </div>}

        <div className="gal__bar">
          <span className="sr" aria-live="polite" aria-atomic="true">{said}</span>
        </div>
      </div>
      {preview && (
        <Preview photos={photos} start={preview.i} opener={preview.opener}
          onClose={() => { setPreview(null); engine.current?.hold('preview', false); }} />
      )}
    </section>
  );
}
