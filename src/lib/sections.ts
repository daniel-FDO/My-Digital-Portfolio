/* =========================================================
   SECTIONS — the page's nine sections and which one you're in.
   Used by the dock's section button and sheet (DockBar.tsx,
   SectionSheet.tsx) on screens without the rail (SectionNav.tsx keeps
   its own copy of the list and its own tracking). One scroll watcher runs while anything is subscribed.
   - The active section is the last one whose top has passed 30% of the
     screen (at most 260px down), unless a section's heading sits right
     at the top (then that one, so a short section counts once reached),
     or the page is at the very bottom (the last one).
   - While a click's scroll runs, the highlight holds on its target
     instead of flickering through the sections in between; wheel,
     touch or scrolling stopping lets go.
   ========================================================= */
import { useSyncExternalStore } from 'react';

export const SECTIONS: { id: string; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'projects', label: 'Projects' },
  { id: 'about', label: 'About' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Tech stack' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'activity', label: 'Activity' },
  { id: 'contact', label: 'Contact' },
];
export const two = (n: number) => String(n).padStart(2, '0');
/** When the right-hand rail is on screen (SectionNav.tsx uses the same query); below it, the dock's section button */
export const RAIL_QUERY = '(min-width: 1000px) and (min-height: 560px)';

let active = 0;
const listeners = new Set<() => void>();
let lock: { timer: number } | null = null;
let stop: (() => void) | null = null;

const set = (i: number) => { if (i !== active) { active = i; listeners.forEach((fn) => fn()); } };

function measure() {
  if (lock) return;
  const probe = Math.min(innerHeight * 0.3, 260);
  let i = 0, atTop = -1;
  SECTIONS.forEach((s, k) => {
    const el = document.getElementById(s.id);
    const top = el ? el.getBoundingClientRect().top : Infinity;
    if (top <= probe) i = k;
    if (atTop < 0 && top > -2 && top < 100) atTop = k;    // its heading sits at the top of the screen
  });
  if (atTop >= 0) i = atTop;
  if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) i = SECTIONS.length - 1;
  set(i);
}

function release() {
  if (!lock) return;
  clearTimeout(lock.timer);
  lock = null;
  measure();
}

function start() {
  let queued = 0;
  const queue = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; measure(); }); };
  const onScroll = () => {
    if (lock) { clearTimeout(lock.timer); lock.timer = window.setTimeout(release, 140); }
    queue();
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('scrollend', release);
  addEventListener('resize', queue);
  addEventListener('wheel', release, { passive: true });
  addEventListener('touchstart', release, { passive: true });
  measure();
  return () => {
    removeEventListener('scroll', onScroll);
    removeEventListener('scrollend', release);
    removeEventListener('resize', queue);
    removeEventListener('wheel', release);
    removeEventListener('touchstart', release);
    cancelAnimationFrame(queued);
    if (lock) clearTimeout(lock.timer);
    lock = null;
  };
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!stop) stop = start();
  return () => {
    listeners.delete(fn);
    if (!listeners.size && stop) { stop(); stop = null; }
  };
}

/** The index of the section on screen (re-renders only when it changes) */
export function useActiveSection(): number {
  return useSyncExternalStore(subscribe, () => active);
}

/** Go to section i: hold the highlight on it while the page scrolls there */
export function goToSection(i: number, go: (id: string) => void, top: () => void) {
  if (lock) clearTimeout(lock.timer);
  lock = { timer: window.setTimeout(release, 1000) };   // let go after 1s if scrolling never starts
  set(i);
  if (i === 0) top(); else go(SECTIONS[i].id);
}

/* ---- Scroll position, shared: progress through the page and direction ---- */
export interface ScrollInfo { y: number; progress: number; dir: 1 | -1 | 0 }
/** Calls fn on every scroll frame (and once now); returns the unsubscribe */
export function onScrollFrame(fn: (s: ScrollInfo) => void) {
  let queued = 0, lastY = scrollY;
  const run = () => {
    queued = 0;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    const dy = y - lastY;
    const dir: 1 | -1 | 0 = dy > 4 ? 1 : dy < -4 ? -1 : 0;
    if (dir) lastY = y;
    fn({ y, progress: max > 0 ? Math.min(1, Math.max(0, y / max)) : 0, dir });
  };
  const queue = () => { if (!queued) queued = requestAnimationFrame(run); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  run();
  return () => { removeEventListener('scroll', queue); removeEventListener('resize', queue); cancelAnimationFrame(queued); };
}
