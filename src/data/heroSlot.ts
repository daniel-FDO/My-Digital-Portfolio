/* =========================================================
   THE HERO GRID'S LAST TILE — which widget holds it.
   "Fixed" (a bug logbook, data/fixed.ts) when it has at least one
   complete entry; otherwise "Setup" (the desk, data/setup.ts) when it
   has at least 3 placed items; otherwise the X-ray tile, as before.
   Widgets.tsx draws the winner and xray.ts describes only that one.
   X-ray mode itself never depends on this (the X key and Ctrl K
   "Toggle X-ray" live in components/xray/Xray.tsx).

   Development only: the browser tests can hand in their own entries
   (window.__heroPreview, set before the page loads) to exercise the
   widgets without any content in the source.
   ========================================================= */
import { FIXED, completeBugs, type FixedBug } from './fixed';
import { SETUP, placedItems, type SetupItem } from './setup';

export type HeroSlot = 'fixed' | 'setup' | 'xray';
export const SETUP_MIN_ITEMS = 3;

const preview = (): { fixed?: FixedBug[]; setup?: SetupItem[] } | null =>
  (import.meta.env.DEV && (window as unknown as { __heroPreview?: { fixed?: FixedBug[]; setup?: SetupItem[] } }).__heroPreview) || null;

export const heroBugs = (): FixedBug[] => completeBugs(preview()?.fixed ?? FIXED);
export const heroSetup = (): SetupItem[] => placedItems(preview()?.setup ?? SETUP);

export function heroSlot(): HeroSlot {
  if (heroBugs().length >= 1) return 'fixed';
  if (heroSetup().length >= SETUP_MIN_ITEMS) return 'setup';
  return 'xray';
}
