/* =========================================================
   FONT-CYCLING NAME — the intro's "Daniel Fasan" heading, shown in a
   new typeface every 3 seconds (fonts.ts lists them, in order).
   - It starts as the original heading (Geist, letter-by-letter
     entrance), then steps through every installed font and repeats.
   - Two overlapping layers take turns: the next font is drawn, fitted
     and checked in the hidden layer, then a short opacity crossfade
     swaps them. Fonts load one ahead (loader.ts); if one fails, the
     current font stays and the next one is tried. Nothing changes
     size: the original heading reserves the box, every font is
     fitted inside it (its ink scaled to the original's height or
     width, whichever is tighter, then centred on the original ink).
   - A small Pause / Resume control sits beside the name. Cycling also
     waits while the heading is off screen or the tab is hidden, and
     resumes with a fresh 3 seconds (it never replays missed steps).
   - Reduced motion: no automatic changes; the control becomes
     "Next font", and the swap is instant.
   - One h1, one accessible name ("Daniel Fasan"): the visual layers
     are hidden from assistive technology; font changes are never
     announced.
   Everything runs from one effect, outside React's render cycle; the
   timers, observers and listeners are released on unmount.
   Switch: ENABLE_FONT_CYCLE (Intro.tsx) — false = the original heading.
   ========================================================= */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../../lib/motion';
import { cssFamily, READY_FONTS, type ReadyFont } from './fonts';
import { load, measureInk, NAME, type InkMetrics } from './loader';
import '../../styles/font-cycle.css';

/** 3 s per font. (Development / testing only: ?name-fonts-step=<ms> shortens it, so a test can watch the whole rotation.) */
const STEP_MS = (() => {
  const q = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('name-fonts-step')) : 0;
  return q >= 200 ? q : 3000;
})();
/** The rotation: the original heading first, then every installed font */
const ORDER: (ReadyFont | null)[] = [null, ...READY_FONTS];
const ORIGINAL_FONT = '600 {size} Geist, ui-sans-serif, system-ui, sans-serif';
const ORIGINAL_TRACKING = -0.055;
/** a font's ink may grow to this much of the original ink's height (decorative scripts need a little room) */
const MAX_INK = 1.3;

export function FontCycleName({ name = NAME }: { name?: string }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLSpanElement>(null);
  const origRef = useRef<HTMLSpanElement>(null);
  const slotRefs = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];
  const api = useRef<{ next: () => void; setPaused: (p: boolean) => void }>({ next: () => {}, setPaused: () => {} });

  useEffect(() => {
    const stage = stageRef.current!, orig = origRef.current!;
    const slots = slotRefs.map((r) => r.current!);
    let alive = true, timer = 0, busy = false;
    let cursor = 0;                          // index in ORDER of what's showing
    let shown: HTMLSpanElement = orig;       // the visible layer
    let visible = true, userPaused = false;
    const isReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const running = () => alive && visible && !document.hidden && !userPaused && !isReduced();

    /* ---- fitting a font into the original heading's box ---- */
    const fit = (layer: HTMLSpanElement, font: ReadyFont, ink: InkMetrics) => {
      const base = parseFloat(getComputedStyle(stage).fontSize);
      const box = { w: orig.offsetWidth, h: orig.offsetHeight };
      const o = measureInk(ORIGINAL_FONT, base, ORIGINAL_TRACKING);          // the original ink, per 1px
      const oInkH = (o.ascent + o.descent) * base;
      const fInkH = ink.ascent + ink.descent;
      let size = Math.min(oInkH / fInkH, (box.w * 0.98) / ink.width) * (font.scale ?? 1);
      size = Math.min(size, (oInkH * MAX_INK) / fInkH, (box.w * 0.98) / ink.width);   // never wider than the box, never too tall
      layer.style.fontFamily = `"${cssFamily(font)}"`;
      layer.style.fontWeight = String(font.weight);
      layer.style.fontStyle = font.style;
      layer.style.fontSize = `${size}px`;
      layer.style.letterSpacing = `${font.tracking ?? 0}em`;
      layer.style.transform = '';
      // centre this ink on the original ink (vertically), start it where the original's starts
      const sr = stage.getBoundingClientRect();
      const baseline = (el: HTMLElement) => el.querySelector<HTMLElement>('.fcn__probe')!.getBoundingClientRect().top - sr.top;
      const oCentre = baseline(orig) - ((o.ascent - o.descent) * base) / 2;
      const want = oCentre + ((ink.ascent - ink.descent) * size) / 2;
      const dx = (-o.left * base) - (-ink.left * size);
      layer.style.transform = `translate(${dx.toFixed(2)}px, ${(want - baseline(layer)).toFixed(2)}px)`;
      layer.dataset.font = font.family;
    };

    /* ---- one step: the next font that works, faded in over the current one ---- */
    const show = (layer: HTMLSpanElement) => {
      [orig, ...slots].forEach((el) => el.classList.toggle('is-on', el === layer));
      stage.classList.toggle('is-instant', isReduced());
      shown = layer;
      stage.dataset.font = layer === orig ? 'original' : layer.dataset.font;
    };
    const advance = async () => {
      if (busy || !alive) return;
      busy = true;
      try {
        // try the following fonts in order until one loads (the current font stays on screen meanwhile)
        for (let tries = 1; tries <= ORDER.length && alive; tries++) {
          const at = (cursor + tries) % ORDER.length, font = ORDER[at];
          if (!font) { show(orig); cursor = at; break; }
          let ink: InkMetrics;
          try { ink = await load(font); } catch { continue; }      // reported by the loader; keep the current font
          if (!alive) return;
          const layer = slots.find((s) => s !== shown)!;
          fit(layer, font, ink);
          show(layer);
          cursor = at;
          break;
        }
        // fetch the one after next in the background (one font ahead, never dozens)
        const ahead = ORDER[(cursor + 1) % ORDER.length];
        if (ahead) load(ahead).catch(() => {});
      } finally { busy = false; }
      schedule();
    };
    const schedule = () => {
      clearTimeout(timer);
      if (running()) timer = window.setTimeout(advance, STEP_MS);
    };

    /* ---- when to run ---- */
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); });
    io.observe(stage);
    const onVis = () => schedule();
    document.addEventListener('visibilitychange', onVis);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => schedule();
    mq.addEventListener('change', onMotion);
    // the heading's size follows the viewport: refit whatever is showing
    const ro = new ResizeObserver(() => {
      if (shown === orig) return;
      const font = ORDER[cursor];
      if (font) load(font).then((ink) => { if (alive && shown.dataset.font === font.family) fit(shown, font, ink); }).catch(() => {});
    });
    ro.observe(stage);

    api.current = {
      next: () => { clearTimeout(timer); void advance(); },
      setPaused: (p) => { userPaused = p; schedule(); },
    };
    // the first font loads only after the page has settled (the heading never waits for it)
    const idle = 'requestIdleCallback' in window
      ? window.requestIdleCallback(() => { const f = ORDER[1]; if (f && alive) load(f).catch(() => {}); }, { timeout: 2500 })
      : setTimeout(() => { const f = ORDER[1]; if (f && alive) load(f).catch(() => {}); }, 800) as unknown as number;
    schedule();

    return () => {
      alive = false;
      clearTimeout(timer);
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle as number); else clearTimeout(idle as number);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener('change', onMotion);
      api.current = { next: () => {}, setPaused: () => {} };
    };
    // the layers are created once; their refs never change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { api.current.setPaused(paused); }, [paused]);

  const letters = [...name];
  return (
    <div className="fcn">
      <h1 className="intro__name fcn__h" id="introName">
        <span className="sr">{name}</span>
        <span className="fcn__stage" ref={stageRef} aria-hidden="true" data-font="original">
          {/* the original heading: it sets the box every other font is fitted into */}
          <span className="intro__letters fcn__layer fcn__orig is-on" ref={origRef}>
            {letters.map((ch, i) => (
              <span key={i} className={ch === ' ' ? 'intro__gap' : 'intro__char'} style={{ '--i': i } as CSSProperties}>{ch === ' ' ? ' ' : ch}</span>
            ))}
            <span className="fcn__probe"></span>
          </span>
          <span className="fcn__layer fcn__slot" ref={slotRefs[0]}>{name}<span className="fcn__probe"></span></span>
          <span className="fcn__layer fcn__slot" ref={slotRefs[1]}>{name}<span className="fcn__probe"></span></span>
        </span>
      </h1>
      {reduced ? (
        <button type="button" className="fcn__ctl" aria-label="Show the name in the next font" onClick={() => api.current.next()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
        </button>
      ) : (
        <button type="button" className="fcn__ctl" aria-label={paused ? 'Resume the name’s font changes' : 'Pause the name’s font changes'}
          onClick={() => setPaused((p) => !p)}>
          {paused
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.2v11.6a.6.6 0 0 0 .9.5l9-5.8a.6.6 0 0 0 0-1L9.4 5.7a.6.6 0 0 0-.9.5z" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5v11M15 6.5v11" /></svg>}
        </button>
      )}
    </div>
  );
}
