/* =========================================================
   ABOUT PAGE — the About folder's story (content: about.ts)
   1. Hero + gallery — layered cards; drag / swipe / buttons / arrow
      keys / horizontal trackpad; snaps like the reference slider
   2. Quick facts
   3. Story — chapters fade up as they scroll in; football + doodles
   4. Footer — back to top
   ========================================================= */
import { Fragment, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ABOUT_PAGE as D } from '../data/about';
import { calm } from '../lib/motion';

const rise = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;
const pad = (n: number) => String(n).padStart(2, '0');
const mod = (a: number, m: number) => ((a % m) + m) % m;

// Handwritten font for the small "the short version" caption (this page only)
function loadCaveat() {
  const href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600&display=swap';
  if (document.querySelector(`link[href="${href}"]`)) return;
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = href;
  document.head.appendChild(font);
}

export function AboutPage({ scroller }: { scroller?: RefObject<HTMLElement | null> }) {
  useEffect(loadCaveat, []);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const toTop = () => {
    (scroller?.current || window).scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
    titleRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <section className="ab-hero" aria-labelledby="abTitle">
        <div className="ab-hero__inner">
          <div className="ab-hero__text">
            <p className="ab-hero__label rise" style={rise(0.05)}>{D.hero.label}</p>
            <h1 className="ab-hero__title rise" style={rise(0.12)} id="abTitle" tabIndex={-1} ref={titleRef}>
              {D.hero.title.map((t, i) => <Fragment key={i}>{i > 0 && ' '}<span>{t}</span></Fragment>)}
            </h1>
          </div>
          <Gallery />
        </div>
      </section>

      <section className="ab-facts" aria-label="Quick facts">
        <dl className="ab-facts__grid">
          {D.facts.map((f) => (
            <div className="ab-facts__item" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.lines.map((l) => <span key={l}>{l}</span>)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Lore />

      <footer className="ab-footer">
        <div className="ab-footer__inner">
          <h2 className="ab-footer__title">{D.footer.heading.map((t, i) => <Fragment key={i}>{i > 0 && ' '}<span>{t}</span></Fragment>)}</h2>
          <p className="ab-footer__text">{D.footer.text}</p>
          <a className="ab-footer__cta btn btn--primary" href={D.footer.cta.href}>{D.footer.cta.label}</a>
          <hr className="ab-footer__rule" />
          <div className="ab-footer__bottom">
            <span className="ab-footer__logo">daniel<span>.</span></span>
            <nav className="ab-footer__links" aria-label="Contact links">
              {D.footer.links.map((l) => (
                <a key={l.label} href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
              ))}
            </nav>
            <button className="ab-footer__top btn btn--secondary" type="button" id="abTop" onClick={toTop}>Back to top</button>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ---------------------------------------------------------
   GALLERY
   One number, `pos`, says where the gallery is (0 = first card at
   the front, 1.5 = halfway between the 2nd and 3rd…). Every card's
   transform comes from its distance to `pos`, so dragging is just
   changing `pos`, and snapping is easing it to a whole number.
   The cards track the finger 1:1 while dragging, then glide quickly
   to the nearest card. It loops. Only transform + opacity change, so
   nothing around it moves. The per-frame styles are written straight
   to the cards; the front card's number is React state.
   --------------------------------------------------------- */
function Gallery() {
  const n = D.gallery.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const api = useRef<{ next(): void; prev(): void } | null>(null);

  useEffect(() => {
    const stage = stageRef.current!;
    const cards = Array.from(stage.querySelectorAll<HTMLElement>('.ab-card'));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pos = 0, front = -1, raf = 0, visible = false;

    // Distance from card i to the front, wrapped so the loop is seamless
    const offset = (i: number) => { let o = mod(i - pos, n); if (o > n / 2) o -= n; return o; };

    function layout() {
      const still = motion.matches;
      cards.forEach((card, i) => {
        const o = offset(i), a = Math.abs(o), s = Math.sign(o);
        let x, y, rot, scale, opacity;
        if (still) {
          // Reduced motion: a small, flat stack — no swing or long travel
          x = o * 7; y = a * 2; rot = 0; scale = 1 - Math.min(a, 2) * 0.05;
          opacity = a < 1.5 ? 1 - a * 0.35 : 0;
        } else {
          x = s * (a <= 1 ? a * 36 : 36 + (a - 1) * 22);      // % of the card width
          y = Math.min(a, 2) * 3;
          rot = -2.5 + s * Math.min(a, 2.2) * 6.5;
          scale = 1 - Math.min(a, 3) * 0.085;
          opacity = a <= 2 ? 1 : Math.max(0, 1 - (a - 2) * 2);
        }
        card.style.transform = `translate3d(${x.toFixed(2)}%, ${y.toFixed(2)}%, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.zIndex = String(100 - Math.round(a * 10));
        card.style.setProperty('--shade', (Math.min(a, 2) * 0.16).toFixed(3));
        card.style.visibility = opacity < 0.01 ? 'hidden' : '';
      });
      const now = mod(Math.round(pos), n);
      if (now !== front) { front = now; setActive(now); syncVideo(); }
    }

    // The video only plays while it's the front card, the gallery is on
    // screen, the tab is visible and motion is allowed.
    function syncVideo() {
      cards.forEach((c, i) => {
        const v = c.querySelector('video');
        if (!v) return;
        if (i === front && visible && !document.hidden && !motion.matches) v.play().catch(() => {});
        else if (!v.paused) v.pause();
      });
    }
    const seen = new IntersectionObserver((e) => { visible = e[0].isIntersecting; syncVideo(); });
    seen.observe(stage);
    document.addEventListener('visibilitychange', syncVideo);

    // Ease `pos` to a whole number (ease-out, like the reference's glide)
    function goTo(target: number, ms = 460) {
      cancelAnimationFrame(raf);
      if (motion.matches) { pos = target; layout(); return; }
      const from = pos, t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        pos = from + (target - from) * (1 - Math.pow(1 - k, 3));
        layout();
        if (k < 1) raf = requestAnimationFrame(step);
        else { pos = mod(target, n); raf = 0; }
      };
      raf = requestAnimationFrame(step);
    }
    const next = () => goTo(Math.round(pos) + 1);
    const prev = () => goTo(Math.round(pos) - 1);
    api.current = { next, prev };

    // Drag (mouse) and swipe (touch/pen). CSS touch-action: pan-y hands
    // vertical swipes to the browser, so the page still scrolls.
    let drag: { x: number; start: number; moved: boolean; id: number; trail: [number, number][] } | null = null;
    const slideWidth = () => cards[0].offsetWidth * 0.62; // px of drag = one card
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(raf);
      drag = { x: e.clientX, start: pos, moved: false, id: e.pointerId, trail: [[e.clientX, e.timeStamp]] };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('is-dragging');
      }
      pos = drag.start - dx / slideWidth();
      drag.trail.push([e.clientX, e.timeStamp]);
      if (drag.trail.length > 6) drag.trail.shift();
      layout();
    };
    const endDrag = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      stage.classList.remove('is-dragging');
      if (!d.moved) {
        // A click on a side card brings it to the front
        const card = (e.target as Element).closest?.<HTMLElement>('.ab-card');
        if (card && e.type === 'pointerup') {
          const o = offset(+card.dataset.i!);
          if (Math.abs(o) > 0.5) goTo(Math.round(pos + o));
        }
        return;
      }
      // A quick flick carries on to the next card even if it was short
      const [x0, t0] = d.trail[0], [x1, t1] = d.trail[d.trail.length - 1];
      const v = (x1 - x0) / Math.max(1, t1 - t0);            // px per ms
      let target = Math.round(pos - v * 120 / slideWidth());
      target = Math.max(Math.round(d.start) - 2, Math.min(Math.round(d.start) + 2, target));
      goTo(target);
    };

    // Trackpad: a sideways swipe moves one card per gesture. Vertical
    // wheel/trackpad movement is left alone, so the page scrolls as usual.
    let wheelSum = 0, wheelLocked = false, wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { wheelSum = 0; wheelLocked = false; }, 180);
      if (wheelLocked) return;
      wheelSum += e.deltaX;
      if (Math.abs(wheelSum) > 40) { if (wheelSum > 0) next(); else prev(); wheelLocked = true; }
    };
    const onMotion = () => { layout(); syncVideo(); };

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
    stage.addEventListener('wheel', onWheel, { passive: false });
    motion.addEventListener('change', onMotion);
    layout();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(wheelTimer);
      seen.disconnect();
      document.removeEventListener('visibilitychange', syncVideo);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('lostpointercapture', endDrag);
      stage.removeEventListener('wheel', onWheel);
      motion.removeEventListener('change', onMotion);
      api.current = null;
    };
  }, [n]);

  return (
    <div className="ab-gallery rise" style={rise(0.22)}>
      <div
        className="ab-gallery__stage" id="abStage" ref={stageRef} tabIndex={0} role="region"
        aria-roledescription="carousel" aria-label="Photo gallery. Use the left and right arrow keys to browse."
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); api.current?.next(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); api.current?.prev(); }
        }}
      >
        {D.gallery.map((m, i) => (
          <figure className="ab-card" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${n}`} data-i={i} key={m.src} aria-hidden={i !== active}>
            {m.video
              ? <video src={m.src} muted loop playsInline preload="metadata" aria-label={m.alt} style={{ objectPosition: m.position || '50% 50%' }}></video>
              : <img src={m.src} alt={m.alt} draggable={false} decoding="async" loading={i < 3 ? undefined : 'lazy'} style={{ objectPosition: m.position || '50% 50%' }} />}
            <span className="ab-card__shade"></span>
          </figure>
        ))}
      </div>
      <div className="ab-gallery__bar">
        <button className="ab-gallery__btn btn btn--utility btn--icon btn--lg" type="button" id="abPrev" aria-label="Previous photo" onClick={() => api.current?.prev()}><span aria-hidden="true">←</span></button>
        <p className="ab-gallery__count" aria-hidden="true"><span id="abCount">{pad(active + 1)}</span> / {pad(n)}</p>
        <button className="ab-gallery__btn btn btn--utility btn--icon btn--lg" type="button" id="abNext" aria-label="Next photo" onClick={() => api.current?.next()}><span aria-hidden="true">→</span></button>
      </div>
      <p className="ab-gallery__hint">Drag or swipe to explore</p>
      <p className="ab-sr" id="abLive" aria-live="polite">{`Photo ${active + 1} of ${n}: ${D.gallery[active].alt}`}</p>
    </div>
  );
}

/* ---------------------------------------------------------
   STORY
   - Chapters fade up (0.5s) the first time they scroll into view
     and their number fills in. They stay visible afterwards.
     The hidden starting state (is-armed) is only added here, so if
     motion is reduced, everything is just visible.
   - The football pops out from behind the "O" once, the first time
     the heading is seen; hovering or focusing it replays that.
   --------------------------------------------------------- */
const SVG = {
  ball: (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="29" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <path d="M32 21l9 6.5-3.4 10.6H26.4L23 27.5z" fill="currentColor" />
      <path d="M32 21V8M41 27.5l12-4.5M37.6 38.1l7.4 10.4M26.4 38.1L19 48.5M23 27.5l-12-4.5" stroke="currentColor" strokeWidth="2.6" fill="none" />
      <path d="M26 5.6l6 2.4 6-2.4M55 18l-2 5 4.5 7M50.5 51l-5.5-2.5-6 5M19 48.5L13.5 51M8.5 31L11 23l-3.5-4" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  code: <svg viewBox="0 0 80 56" aria-hidden="true" focusable="false"><path d="M24 10L6 28l18 18M56 10l18 18-18 18M46 4L34 52" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  coffee: <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M14 24h32l-3.5 30a4 4 0 0 1-4 3.5H21.5a4 4 0 0 1-4-3.5z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /><path d="M10 24h40M18 24l2-7h20l2 7M46 31h4a6 6 0 0 1 0 12h-5.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M24 6c-2 3 2 4 0 7M31 4c-2 3 2 4 0 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>,
  arrow: <svg viewBox="0 0 90 60" aria-hidden="true" focusable="false"><path d="M84 52C60 56 24 50 14 12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /><path d="M5 22l9-12 10 11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

function Lore() {
  const [l1, l2, l3] = D.lore.heading;
  // Wrap the first "O" of the last line, so the football can sit behind it
  const oAt = l3.indexOf('O');
  const loreRef = useRef<HTMLElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const oRef = useRef<HTMLSpanElement>(null);
  const ballRef = useRef<HTMLButtonElement>(null);
  const [armed] = useState(() => !calm() && 'IntersectionObserver' in window);
  const [shown, setShown] = useState<boolean[]>(() => D.chapters.map(() => false));

  useEffect(() => {
    const art = artRef.current!, lore = loreRef.current!, ball = ballRef.current!;
    const cleanups: (() => void)[] = [];

    // Put the football just behind the top of the "O" (measured, so it
    // follows the real font size and wrapping)
    let alive = true;
    function placeBall() {
      const o = oRef.current;
      if (!o || !alive) return;
      const a = art.getBoundingClientRect(), r = o.getBoundingClientRect();
      // Centre: right half of the O, level with the top of the letter, so
      // the top half of the ball shows above it and the rest hides behind
      art.style.setProperty('--ball-x', `${(r.left - a.left + r.width * 0.72).toFixed(1)}px`);
      art.style.setProperty('--ball-y', `${(r.top - a.top + r.height * 0.2).toFixed(1)}px`);
    }
    placeBall();
    const resize = new ResizeObserver(placeBall);
    resize.observe(art);
    document.fonts?.ready.then(placeBall);
    cleanups.push(() => { alive = false; resize.disconnect(); });

    if (armed) {
      const chapters = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = Number((e.target as HTMLElement).dataset.i);
          setShown((s) => s.map((v, k) => v || k === i));
          chapters.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
      lore.querySelectorAll('.ab-chapter').forEach((c) => chapters.observe(c));

      // The bounce is a CSS animation, restarted by toggling its class
      const playBall = () => {
        art.classList.remove('is-playing');
        void art.offsetWidth;                 // restart the CSS animation
        art.classList.add('is-played', 'is-playing');
      };
      const intro = new IntersectionObserver((e) => {
        if (!e[0].isIntersecting) return;
        intro.disconnect();
        playBall();
      }, { threshold: 0.4 });
      intro.observe(art);
      // Replay on hover/focus, but not while it's still bouncing
      const replay = () => { if (!art.classList.contains('is-playing')) playBall(); };
      const onEnd = (e: AnimationEvent) => { if (e.animationName === 'ab-ball-pop') art.classList.remove('is-playing'); };
      ball.addEventListener('pointerenter', replay);
      ball.addEventListener('focus', replay);
      ball.addEventListener('click', replay);
      ball.addEventListener('animationend', onEnd);
      cleanups.push(() => {
        chapters.disconnect(); intro.disconnect();
        ball.removeEventListener('pointerenter', replay);
        ball.removeEventListener('focus', replay);
        ball.removeEventListener('click', replay);
        ball.removeEventListener('animationend', onEnd);
      });
    }
    return () => cleanups.forEach((fn) => fn());
  }, [armed]);

  return (
    <section className={`ab-lore${armed ? ' is-armed' : ''}`} id="abLore" aria-labelledby="abLoreTitle" ref={loreRef}>
      <div className="ab-lore__inner">
        <div className="ab-lore__side">
          <div className="ab-lore__sticky">
            {/* className stays fixed: the bounce classes are toggled directly */}
            <div className="ab-lore__art" id="abArt" ref={artRef}>
              <h2 className="ab-lore__title" id="abLoreTitle">
                <span>{l1}</span>
                <span>{l2}</span>
                <span>{oAt < 0 ? l3 : <>{l3.slice(0, oAt)}<span className="ab-lore__o" ref={oRef}>O</span>{l3.slice(oAt + 1)}</>}</span>
              </h2>
              <button className="ab-ball" type="button" id="abBall" aria-label="Bounce the football" ref={ballRef}>{SVG.ball}</button>
              <span className="ab-doodle ab-doodle--code" aria-hidden="true">{SVG.code}</span>
            </div>
            <p className="ab-lore__caption">
              <span className="ab-doodle ab-doodle--arrow" aria-hidden="true">{SVG.arrow}</span>
              <span className="ab-lore__note">{D.lore.caption}</span>
              <span className="ab-doodle ab-doodle--coffee" aria-hidden="true">{SVG.coffee}</span>
            </p>
          </div>
        </div>

        <ol className="ab-chapters">
          {D.chapters.map((c, i) => (
            <li className={`ab-chapter${shown[i] ? ' is-shown' : ''}`} data-i={i} key={c.num}>
              <span className="ab-chapter__marker" aria-hidden="true">{c.num}</span>
              <div className="ab-chapter__body">
                <h3><span className="ab-sr">{c.num} — </span>{c.title}</h3>
                {c.paragraphs.map((p, k) => <p key={k}>{p}</p>)}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
