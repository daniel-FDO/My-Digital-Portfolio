/* =========================================================
   THE SPRING CAROUSEL — photos as cards, iOS-style (DOM + CSS transforms)
   One big photo in the middle; its neighbours either side, smaller and
   dimmed, tucked a little behind it. Everything moves on one spring:
   - Drag / swipe follows the finger 1:1; let go and it carries on with
     the flick's momentum, then settles on the nearest photo with a
     soft, slightly springy stop (the target is projected from the
     velocity, like iOS scroll views, at most 3 photos per flick).
   - Previous / Next / a click on a neighbour spring to it; quicker
     presses just move the target on (the spring never jumps).
   - Autoplay: a new photo every 4.6 s while on screen and not held.
   - A click on the middle photo opens it (the host shows the preview).
   - It wraps: positions are a continuous number, cards are placed by
     their wrapped distance from it.
   - Reduced motion: no autoplay unless Play is pressed; no spring or
     momentum (changes are instant); dragging still moves it directly.
   - Animates only while something moves, on screen, tab visible.
     destroy() releases every listener, timer and element.
   The photos are real <img>s (crisp at any density); they're
   decorative here (aria-hidden): the host's plain strip carries the
   descriptions for screen readers. Same interface as the engines it
   replaced, so Gallery.tsx needs no other changes.
   ========================================================= */

export interface CarouselPhoto { src: string; position?: string }
export interface CarouselEvents {
  /** the photo in the middle (or the one being gone to) changed */
  onIndex(i: number): void;
  /** autoplay switched on / off (by the visitor's Play / Pause) */
  onPlaying(p: boolean): void;
  /** the middle photo was clicked / tapped (not dragged) */
  onPick(i: number): void;
  /** the middle photo has loaded: the host can show the carousel */
  onReady(): void;
  /** the initial photo could not load */
  onFail(reason: string): void;
}

const SPRING = {
  stiffness: 125,       // a longer, gentle glide into each photo
  damping: 0.82,        // a small, controlled spring settle
  project: 0.16,        // s: how far a flick's velocity carries the target
  maxFlick: 3,          // photos per flick, at most
};
const TIMING = {
  every: 4600,          // ms between autoplay steps
  everyReduced: 6000,
  resumeAfter: 2200,    // ms after a drag / the preview before autoplay carries on
};
/** card layout, as fractions of the card's width */
const LAYOUT = {
  spread: 0.78,         // the first neighbour's centre, from the middle
  further: 0.5,         // each one after that adds this much
  shrink: 0.13,         // scale lost per step out (first neighbour 0.87)
  minScale: 0.62,
  dim: 0.28,            // keep neighbouring photography visible
  visible: 2.8,         // fade the outer cards before they wrap
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function createCarousel(host: HTMLElement, photos: CarouselPhoto[], ev: CarouselEvents) {
  const n = photos.length;
  if (!n) throw new Error('no photos');

  /* ---- the cards ---- */
  const track = document.createElement('div');
  track.className = 'gal__track';
  track.setAttribute('aria-hidden', 'true');
  const cards = photos.map((ph, i) => {
    const el = document.createElement('div');
    el.className = 'gal__card';
    el.dataset.i = String(i);
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.loading = 'lazy';
    if (ph.position) img.style.objectPosition = ph.position;
    const veil = document.createElement('span');
    veil.className = 'gal__veil';
    el.append(img, veil);
    track.appendChild(el);
    return { el, img, veil, ph, loaded: false, shown: false };
  });
  host.appendChild(track);

  /* ---- state ---- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pos = 0, vel = 0, target = 0;     // photos (continuous, unwrapped); photos per second
  let cardW = 1, index = 0;
  let choice: boolean | null = null;
  const held = new Set<string>();
  let resumeAt = 0, autoTimer = 0;
  let visible = false, raf = 0, last = 0, destroyed = false, ready = false;
  let drag: { id: number; x: number; y: number; from: number; moved: boolean; samples: { x: number; t: number }[] } | null = null;
  let wheelTimer = 0;

  const playing = () => choice ?? !reduce.matches;
  const running = () => visible && !document.hidden && !destroyed;
  const moving = () => !!drag || Math.abs(target - pos) > 5e-4 || Math.abs(vel) > 1e-3;
  const setIndex = (i: number) => { i = mod(i, n); if (i !== index) { index = i; ev.onIndex(i); } };

  /* ---- layout ---- */
  function fit() {
    const h = host.clientHeight, w = host.clientWidth;
    // a 3:4 card nearly the frame's height, but never so wide the neighbours have no room
    cardW = Math.min(h * 0.86 * 0.75, w * 0.68);
    track.style.setProperty('--card-w', `${cardW.toFixed(1)}px`);
    place();
  }
  /** where a card sits for a wrapped distance d from the middle */
  function slot(d: number) {
    const a = Math.abs(d), s = Math.sign(d);
    const x = s * (a <= 1 ? a * LAYOUT.spread : LAYOUT.spread + (a - 1) * LAYOUT.further) * cardW;
    const scale = Math.max(LAYOUT.minScale, 1 - LAYOUT.shrink * Math.min(a, 1) - LAYOUT.shrink * 0.8 * Math.max(0, a - 1));
    const veil = Math.min(0.8, LAYOUT.dim * Math.min(a, 1) + 0.2 * Math.max(0, a - 1));
    return { x, scale, veil, z: Math.round(100 - a * 10) };
  }
  function place() {
    for (let i = 0; i < n; i++) {
      const c = cards[i];
      const d = mod(i - pos + n / 2, n) - n / 2;      // wrapped distance, -n/2 .. n/2
      const show = Math.abs(d) < LAYOUT.visible;
      if (show !== c.shown) { c.el.style.visibility = show ? 'visible' : 'hidden'; c.shown = show; }
      if (!show) continue;
      if (!c.img.src) c.img.src = c.ph.src;          // load as it comes near
      const s = slot(d);
      const bend = Math.tanh(d);
      const angle = reduce.matches ? 0 : -bend * 14;
      const roll = reduce.matches ? 0 : bend * 3;
      const lift = Math.min(Math.abs(d), 2) * 13;
      c.el.style.transform = `translate3d(calc(-50% + ${s.x.toFixed(2)}px), calc(-50% + ${lift.toFixed(2)}px), 0) perspective(1100px) rotateY(${angle.toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg) scale(${s.scale.toFixed(4)})`;
      c.el.style.opacity = String(Math.max(0, Math.min(1, (LAYOUT.visible - Math.abs(d)) / 0.65)));
      c.el.style.zIndex = String(s.z);
      c.veil.style.opacity = s.veil.toFixed(3);
      c.el.classList.toggle('is-centre', Math.abs(d) < 0.5);
    }
  }

  /* ---- the spring ---- */
  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!drag) {
      if (reduce.matches) { pos = target; vel = 0; }
      else {
        // a damped spring towards the target (semi-implicit Euler, in two half steps for stability)
        const k = SPRING.stiffness, c = 2 * Math.sqrt(k) * SPRING.damping;
        for (let s = 0; s < 2; s++) {
          const h = dt / 2;
          vel += (k * (target - pos) - c * vel) * h;
          pos += vel * h;
        }
        if (Math.abs(target - pos) < 5e-4 && Math.abs(vel) < 1e-3) { pos = target; vel = 0; }
      }
    }
    place();
    if (moving()) raf = requestAnimationFrame(frame);
    else { last = 0; arm(); }
  }
  function wake() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }
  function goTo(t: number) {
    target = t;
    setIndex(Math.round(t));
    disarm();
    wake();
    if (reduce.matches && !running()) { pos = target; place(); }
  }

  /* ---- autoplay: a timer between steps (nothing animates while a photo just sits there) ---- */
  const canPlay = () => playing() && held.size === 0 && running() && !moving();
  function arm() {
    if (autoTimer || !canPlay()) return;
    const every = reduce.matches ? TIMING.everyReduced : TIMING.every;
    autoTimer = window.setTimeout(() => {
      autoTimer = 0;
      if (canPlay()) goTo(Math.round(target) + 1);
      else arm();
    }, Math.max(every, resumeAt - performance.now()));
  }
  function disarm() { clearTimeout(autoTimer); autoTimer = 0; }
  function hold(why: string, on: boolean) {
    if (on) {
      held.add(why); disarm();
      // the preview: settle at once on the photo it opens, so closing it returns the same picture
      if (why === 'preview') { pos = target = Math.round(target); vel = 0; drag = null; host.classList.remove('is-dragging'); place(); }
    } else {
      held.delete(why);
      resumeAt = performance.now() + (why === 'focus' ? 600 : TIMING.resumeAfter);
      arm();
    }
  }

  /* ---- input: drag / swipe (vertical swipes keep scrolling the page) ---- */
  const perPx = () => 1 / (LAYOUT.spread * cardW);   // photos per px of drag
  function endPointer() {
    if (drag && host.hasPointerCapture(drag.id)) host.releasePointerCapture(drag.id);
    drag = null;
    held.delete('drag');
    host.classList.remove('is-dragging');
  }
  function onDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag || !e.isPrimary) return;      // a second finger doesn't take over
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: pos, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
  }
  function onMove(e: PointerEvent) {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { onUp(e, true); return; }   // the press ended outside
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;   // not yet / a vertical scroll
      g.moved = true;
      host.setPointerCapture(e.pointerId);
      host.classList.add('is-dragging');
      held.add('drag'); disarm();
      g.from = pos; g.x = e.clientX;     // pick up from wherever the spring was, without a jump
      vel = 0;
    }
    pos = g.from - (e.clientX - g.x) * perPx();
    target = pos;
    setIndex(Math.round(pos));
    g.samples.push({ x: e.clientX, t: e.timeStamp });
    if (g.samples.length > 6) g.samples.shift();
    wake();
  }
  function onUp(e: PointerEvent, cancelled: boolean) {
    const g = drag;
    if (!g || g.id !== e.pointerId) return;
    endPointer();
    if (g.moved) {
      resumeAt = performance.now() + TIMING.resumeAfter;
      const a = g.samples[0], b = g.samples[g.samples.length - 1];
      const v = !cancelled && b.t > a.t ? (-(b.x - a.x) / (b.t - a.t)) * 1000 * perPx() : 0;   // photos / s
      if (reduce.matches) { goTo(Math.round(pos + Math.sign(v) * (Math.abs(v) > 1.2 ? 0.5 : 0))); return; }
      // momentum: project where the flick would carry it, settle on that photo
      const start = Math.round(g.from);
      let t = Math.round(pos + v * SPRING.project);
      t = Math.max(start - SPRING.maxFlick, Math.min(start + SPRING.maxFlick, t));
      vel = v;
      goTo(t);
    } else if (!cancelled) {
      // a click / tap: the middle photo opens; a neighbour comes to the middle
      const el = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest<HTMLElement>('.gal__card');
      if (!el || !track.contains(el)) return;
      const i = Number(el.dataset.i), d = Math.round(mod(i - pos + n / 2, n) - n / 2);
      if (d === 0) ev.onPick(mod(Math.round(target), n));   // the host holds 'preview', which settles it
      else goTo(Math.round(target) + d);
    }
  }
  // a horizontal trackpad swipe moves it too; vertical wheel scrolling is left to the page
  function onWheel(e: WheelEvent) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.ctrlKey) return;
    e.preventDefault();
    disarm();
    pos += e.deltaX * perPx() * 0.6; target = pos; vel = 0;
    setIndex(Math.round(pos));
    place();
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { resumeAt = performance.now() + TIMING.resumeAfter; goTo(Math.round(pos)); }, 140);
  }
  const up = (e: PointerEvent) => onUp(e, false), cancel = (e: PointerEvent) => onUp(e, true);
  const noDrag = (e: Event) => e.preventDefault();
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', cancel);
  host.addEventListener('wheel', onWheel, { passive: false });
  host.addEventListener('dragstart', noDrag);

  /* ---- ready when the middle photo has loaded ---- */
  const first = cards[0];
  const markReady = () => { if (!ready && !destroyed) { ready = true; ev.onReady(); } };
  first.img.addEventListener('load', markReady, { once: true });
  const fail = () => { if (!destroyed) ev.onFail('The first photo could not load'); };
  first.img.addEventListener('error', fail, { once: true });

  /* ---- keeping up with the page ---- */
  const setVisible = (on: boolean) => {
    if (on === visible) return;
    visible = on;
    if (on) { place(); wake(); arm(); }
    else { cancelAnimationFrame(raf); raf = 0; last = 0; disarm(); }
  };
  const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '300px 0px' });
  io.observe(host);
  const ro = new ResizeObserver(() => fit());
  ro.observe(host);
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; disarm(); } else { wake(); arm(); } };
  document.addEventListener('visibilitychange', onVis);
  const onMotion = () => { pos = target = Math.round(target); vel = 0; place(); if (choice === null) ev.onPlaying(playing()); disarm(); arm(); };
  reduce.addEventListener('change', onMotion);

  fit();
  ev.onPlaying(playing());
  ev.onIndex(index);

  // For testing only: add ?gallery-debug to the address
  if (/[?&]gallery-debug\b/.test(location.search)) {
    (window as unknown as { __gallery: unknown }).__gallery = {
      get index() { return index; }, get pos() { return pos; }, get target() { return target; },
      get running() { return !!raf; }, get playing() { return playing(); }, get armed() { return !!autoTimer; },
      /** a card's box (CSS px, relative to the host), by its wrapped distance from the middle (0 = middle) */
      cardRect(d: number) {
        const i = mod(Math.round(pos) + d, n), r = cards[i].el.getBoundingClientRect(), h = host.getBoundingClientRect();
        return cards[i].shown ? { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height, photo: i } : null;
      },
      count: n,
    };
  }

  return {
    select(i: number) {
      if (!drag) goTo(Math.round(target) + mod(i - Math.round(target) + n / 2, n) - n / 2);
    },
    next() { if (!drag) goTo(Math.round(target) + 1); },
    prev() { if (!drag) goTo(Math.round(target) - 1); },
    toggle() {
      choice = !playing(); resumeAt = 0;
      if (playing()) arm(); else disarm();
      ev.onPlaying(playing());
    },
    /** hold autoplay for a reason ('focus' inside the gallery, the 'preview' being open…) */
    hold(why: string, on: boolean) { hold(why, on); },
    /** the photo in the middle (or the one being gone to) */
    get index() { return index; },
    get playing() { return playing(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf); disarm(); clearTimeout(wheelTimer);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reduce.removeEventListener('change', onMotion);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', cancel);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('dragstart', noDrag);
      first.img.removeEventListener('load', markReady);
      first.img.removeEventListener('error', fail);
      track.remove();
    },
  };
}
export type Carousel = ReturnType<typeof createCarousel>;
