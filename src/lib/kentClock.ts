/* =========================================================
   KENT CLOCK — always Kent / London time (GMT or BST), whatever
   the visitor's own time zone. One timer for the whole page, ticking
   on the second boundary; it only runs while something is listening.
   ========================================================= */
import { useSyncExternalStore } from 'react';
import { HOME } from '../data/home';

const ZONE = HOME.timeZone || 'Europe/London';
const fmtParts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', timeZoneName: 'short' });
/** "2:32 pm" — spoken / shown in sentences */
export const fmtSpoken = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true });

export interface KentTime {
  h: number;
  m: number;
  s: number;
  /** "GMT" / "BST" */
  zone: string;
  /** the same instant, for fmtSpoken */
  date: Date;
}

function read(): KentTime {
  const date = new Date();
  const p = Object.fromEntries(fmtParts.formatToParts(date).map((x) => [x.type, x.value]));
  return { h: +p.hour, m: +p.minute, s: +p.second, zone: p.timeZoneName || 'UK', date };
}

let snapshot = read();
const listeners = new Set<() => void>();
let timeout = 0, interval = 0;

function tick() {
  snapshot = read();
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    tick();
    // Tick on the second boundary
    timeout = window.setTimeout(() => { tick(); interval = window.setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) { clearTimeout(timeout); clearInterval(interval); timeout = interval = 0; }
  };
}

export function useKentTime(): KentTime {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
