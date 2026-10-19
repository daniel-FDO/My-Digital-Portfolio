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
