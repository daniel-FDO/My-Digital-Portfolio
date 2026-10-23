import { useSyncExternalStore } from 'react';

/** prefers-reduced-motion, shared by everything that moves */
export const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const calm = () => motionQuery.matches;

const subscribe = (fn: () => void) => {
  motionQuery.addEventListener('change', fn);
  return () => motionQuery.removeEventListener('change', fn);
};

/** Re-renders when the visitor's reduced-motion setting changes */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, calm);
}

/** Any media query, kept up to date */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    },
    () => window.matchMedia(query).matches,
  );
}

/* The visitor's Pause (the control beside the name): ambient motion that
   isn't the name itself, such as the background's light streak, holds too */
let ambientPaused = false;
const pauseListeners = new Set<() => void>();
export const isAmbientPaused = () => ambientPaused;
export function setAmbientPaused(p: boolean) {
  if (p === ambientPaused) return;
  ambientPaused = p;
  pauseListeners.forEach((fn) => fn());
}
export function onAmbientPause(fn: () => void) {
  pauseListeners.add(fn);
  return () => { pauseListeners.delete(fn); };
}
