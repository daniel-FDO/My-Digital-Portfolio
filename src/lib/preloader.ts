/* =========================================================
   PRELOADER — "daniel." (markup: index.html, look: preloader.css)
   Whether it shows at all is decided in index.html's <head>: once
   per tab, on the first visit to the home page (sessionStorage
   'introSeen'). Not on reload, Back / Forward, or arriving from
   another page of this site. That script adds html.pl-on; without
   it this does nothing. The markup is plain HTML (outside React),
   so it's on screen before the app's JavaScript arrives.

   PROGRESS is real, from a short, explicit list:
     • the page is built (React has rendered the home page:
       markPageReady(), called from App)
     • the three primary font faces (Geist 400 / 500, Geist Mono 400)
     • images in the first screen, if there are any (not Spotify's
       album art, not lazy ones)
   Spotify, GitHub, videos and everything further down are never
   waited for. A failed font or image counts as finished.

   TIMING: on screen for at least MIN_SHOWN so the sequence reads;
   "Still loading…" from SLOW; gone by DEADLINE (after the page
   started loading) whatever is still missing — then the figure
   stays where it really was, it never jumps to 100%.
   Every way out goes through leave(), which gives back scrolling,
   focus (inert) and the page's own entrance.
   ========================================================= */
import { calm as reducedMotion } from './motion';

declare global {
  interface Window { Preloader?: { active: boolean } }
}

const MIN_SHOWN = 900;     // ms from the first painted frame
const SLOW = 1400;         // ms: "Still loading…" (a normal load has gone by ~0.9s)
const DEADLINE = 4000;     // ms after navigation start
const EXIT = 500;          // ms: the fade + lift (preloader.css)

interface Task { v: number; set(x: number): void }

let pageReady: (() => void) | null = null;
const doneListeners: (() => void)[] = [];
let isDone = true;

/** True while the loader covers the page (the sections wait to reveal) */
export const preloaderActive = () => document.documentElement.classList.contains('pl-on');

/** Runs fn once the loader has handed the page back (straight away if there's none) */
export function onPreloaderDone(fn: () => void): () => void {
  if (isDone || !preloaderActive()) { fn(); return () => {}; }
  doneListeners.push(fn);
  return () => { const i = doneListeners.indexOf(fn); if (i >= 0) doneListeners.splice(i, 1); };
}

/** App calls this once the home page has rendered */
export function markPageReady() {
  if (pageReady) { const fn = pageReady; pageReady = null; fn(); }
}

export function startPreloader() {
  const root = document.documentElement;
  const loader = document.getElementById('pl');
  const live = document.getElementById('plLive');
  if (!root.classList.contains('pl-on') || !loader) {
    if (loader) loader.remove();
    window.Preloader = { active: false };
    return;
  }
  window.Preloader = { active: true };   // the 5s fallback in index.html stands down
  isDone = false;

  const fill = loader.querySelector<HTMLElement>('.pl__fill')!;
  const pctEl = loader.querySelector<HTMLElement>('.pl__pct')!;
  const calm = reducedMotion();
  const say = (text: string) => { if (live) live.textContent = text; };

  /* ---------- Nothing behind it can be reached ---------- */
  const madeInert: HTMLElement[] = [];
  for (const el of Array.from(document.body.children) as HTMLElement[]) {
    if (el === loader || el === live || el.tagName === 'SCRIPT' || el.inert) continue;
    el.inert = true;
    madeInert.push(el);
  }

  /* ---------- What counts as loaded ---------- */
  const tasks: Task[] = [];
  const task = (): Task => { const t: Task = { v: 0, set(x) { t.v = Math.max(t.v, Math.min(1, x)); } }; tasks.push(t); return t; };
  const real = () => tasks.reduce((s, t) => s + t.v, 0) / tasks.length;

  // 1. The page is built
  const docTask = task();
  // 2. Fonts — each face on its own, a failure still counts as done
  ['400 1em Geist', '500 1em Geist', '400 1em "Geist Mono"'].forEach((face) => {
    const t = task();
    if (document.fonts && document.fonts.load) document.fonts.load(face).then(() => t.set(1), () => t.set(1));
    else t.set(1);
  });
  // 3. First-screen images (counted once the page is built)
  const imgTask = task();
  function trackImages() {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('main img')).filter((img) => {
      if (img.loading === 'lazy' || img.closest('#music, [hidden]')) return false;
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.top < innerHeight && r.bottom > 0;
    });
    if (!imgs.length) { imgTask.set(1); return; }
    let done = 0;
    const one = () => { done += 1; imgTask.set(done / imgs.length); };
    imgs.forEach((img) => {
      if (img.complete) one();
      else { img.addEventListener('load', one, { once: true }); img.addEventListener('error', one, { once: true }); }
    });
  }
  pageReady = () => { docTask.set(1); trackImages(); };

  /* ---------- The sequence ---------- */
  let t0 = 0, shown = 0, left = false, done = false;
  const deadlineAt = Math.max(DEADLINE, performance.now() + 600);

  function draw(p: number) {
    fill.style.setProperty('--p', p.toFixed(4));
    pctEl.textContent = Math.floor(p * 100) + '%';
  }
  draw(0);

  function frame() {
    if (left) return;
    const now = performance.now();
    const target = real();
    // the line eases towards the real figure, never past it
    shown = calm ? target : Math.min(target, shown + Math.max((target - shown) * 0.16, 0.004));
    if (target >= 1 && shown > 0.995) shown = 1;
    draw(shown);
    if (t0 && now - t0 >= SLOW && shown < 1) loader!.classList.add('is-slow');
    if (shown >= 1 && t0 && now - t0 >= MIN_SHOWN) { leave(true); return; }
    if (now >= deadlineAt) { leave(target >= 1); return; }
    requestAnimationFrame(frame);
  }

  function handBack() {
    madeInert.forEach((el) => { el.inert = false; });
    root.classList.remove('pl-on');
    isDone = true;
    doneListeners.splice(0).forEach((fn) => fn());
  }

  function leave(complete: boolean) {
    if (left) return;
    left = true;
    if (complete) { draw(1); loader!.classList.remove('is-slow'); }
    // hand the page back first, so its entrance plays as the loader fades
    handBack();
    restoreHash();
    loader!.classList.add('is-out');
    say(complete ? 'Portfolio loaded' : 'Portfolio ready; some parts are still loading');
    setTimeout(finish, calm ? 340 : EXIT + 40);
  }

  function finish() {
    if (done) return;
    done = true;
    if (!left) { left = true; handBack(); }
    loader!.remove();
    setTimeout(() => say(''), 3000);
  }

  // A link straight to a section (/#about): the page was built under the
  // loader, so put the section back at the top once it can scroll again
  function restoreHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || id.startsWith('folder/')) return;
    const target = document.getElementById(id === 'arcade' ? 'gallery' : id);   // old links to the Play section
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  // Start once the loader has really been painted; the wordmark waits a
  // moment for Geist so it doesn't swap fonts while rising in
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('500 1em Geist').catch(() => {}) : Promise.resolve();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    say('Loading portfolio');
    Promise.race([fontReady, new Promise((r) => setTimeout(r, 150))]).then(() => {
      if (left) return;
      t0 = performance.now();
      loader!.classList.add('is-in');
      requestAnimationFrame(frame);
    });
  }));

  // Background tabs pause animation frames: these still end it on time
  setTimeout(() => leave(real() >= 1), Math.max(0, deadlineAt - performance.now()) + 50);
  setTimeout(finish, Math.max(0, deadlineAt - performance.now()) + 1500);
  // Restored from the back/forward cache mid-sequence: just show the page
  addEventListener('pageshow', (e) => { if (e.persisted && !done) { leave(real() >= 1); finish(); } });
}
