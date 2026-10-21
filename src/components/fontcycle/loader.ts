/* =========================================================
   NAME FONTS — loading and checking (no React)
   load(font) fetches one WOFF2 through the FontFace API (only when
   asked: nothing loads up front), adds it to document.fonts, then
   proves the browser really draws "Daniel Fasan" with it: the text is
   measured with the font and two different fallbacks; if the widths
   match the fallbacks, the font isn't being used (a broken file, a
   missing glyph set…) and the load counts as failed.
   It also measures the name's ink (canvas TextMetrics, per 1px of
   font size), which the heading uses to fit each font to its box.
   Results are cached; statuses are published for the dev preview.
   ========================================================= */
import { cssFamily, fontUrl, type ReadyFont } from './fonts';

export const NAME = 'Daniel Fasan';

export interface InkMetrics {
  /** per 1px of font size, with the font's tracking applied */
  width: number;
  ascent: number;   // ink above the baseline
  descent: number;  // ink below it
  left: number;     // ink left of the start point (TextMetrics.actualBoundingBoxLeft)
}
export type LoadStatus = { state: 'idle' } | { state: 'loading' } | { state: 'ready'; ink: InkMetrics } | { state: 'failed'; reason: string };

const status = new Map<string, LoadStatus>();
const pending = new Map<string, Promise<InkMetrics>>();
const listeners = new Set<() => void>();
const set = (f: ReadyFont, s: LoadStatus) => { status.set(f.family, s); listeners.forEach((fn) => fn()); };
export const statusOf = (f: ReadyFont): LoadStatus => status.get(f.family) ?? { state: 'idle' };
export const onStatus = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
/** Ink of the name in any CSS font (e.g. the page's own heading font), per 1px of size */
export function measureInk(font: string, sizePx: number, trackingEm = 0): InkMetrics {
  const g = canvas!.getContext('2d')!;
  g.font = `${font.replace('{size}', `${sizePx}px`)}`;
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${trackingEm * sizePx}px`;
  const m = g.measureText(NAME);
  return { width: m.width / sizePx, ascent: m.actualBoundingBoxAscent / sizePx, descent: m.actualBoundingBoxDescent / sizePx, left: m.actualBoundingBoxLeft / sizePx };
}

export function load(f: ReadyFont): Promise<InkMetrics> {
  const had = pending.get(f.family);
  if (had) return had;
  const p = (async () => {
    set(f, { state: 'loading' });
    const family = cssFamily(f);
    const face = new FontFace(family, `url(${fontUrl(f)}) format('woff2')`, { weight: String(f.weight), style: f.style, display: 'block' });
    await face.load();                                   // rejects on a network / decode error
    document.fonts.add(face);
    const spec = `${f.style === 'italic' ? 'italic ' : ''}${f.weight} {size} "${family}"`;
    if (!document.fonts.check(spec.replace('{size}', '100px'), NAME)) throw new Error('the browser reports the font as unusable');
    // does it really draw the name (not a fallback)? compare against two different fallbacks
    const w = (fallback: string) => measureInk(`${spec}, ${fallback}`, 100).width;
    const wm = w('monospace'), ws = w('serif');
    const fm = measureInk(`${f.weight} {size} monospace`, 100).width, fs = measureInk(`${f.weight} {size} serif`, 100).width;
    if (Math.abs(wm - fm) < 1e-3 && Math.abs(ws - fs) < 1e-3) throw new Error('the name renders with a fallback font, not this one');
    if (Math.abs(wm - ws) > 1e-3) throw new Error('part of the name falls back to another font (missing glyphs)');
    const ink = measureInk(spec, 100, f.tracking ?? 0);
    if (!(ink.width > 0) || !(ink.ascent + ink.descent > 0)) throw new Error('the name has no visible ink in this font');
    set(f, { state: 'ready', ink });
    return ink;
  })();
  p.catch((err: unknown) => {
    pending.delete(f.family);                            // a later attempt may succeed (e.g. after a network blip)
    const reason = err instanceof Error ? err.message : String(err);
    set(f, { state: 'failed', reason });
    console.warn(`[name fonts] "${f.family}" could not be used: ${reason}`);
  });
  pending.set(f.family, p);
  return p;
}
