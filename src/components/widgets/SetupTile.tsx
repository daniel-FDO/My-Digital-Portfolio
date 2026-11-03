/* =========================================================
   SETUP — the desk, with a dot for each thing on it (data/setup.ts).
   Shown in the hero grid's last tile only when setup.ts has at least
   3 placed items (data/heroSlot.ts); otherwise the X-ray tile.
   - A single-colour line drawing (generic shapes, no brands): monitor,
     keyboard, mouse, and a chair suggested in a few lines.
   - Each dot is a button named after its thing. Choosing one writes
     its name and one-line use in the caption at the bottom of the
     tile (never a hover tooltip), announced politely; choosing it
     again, or Esc, clears it. Tab goes through the dots in reading
     order (top to bottom, then left to right).
   - The dots pulse softly; not with reduced motion. Every dot keeps a
     24 × 24 px target at any width.
   - Development: a dot that isn't over anything drawn is reported in
     the console, so its x / y in setup.ts can be adjusted.
   ========================================================= */
import { useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { SetupItem } from '../../data/setup';

/** The drawing's box (the dots' x / y are percent of it) */
const VW = 200, VH = 110;
/** Roughly what's drawn where, in percent [left, top, right, bottom] (for the development check) */
export const DRAWN: Record<string, [number, number, number, number]> = {
  'monitor screen': [44, 7, 76, 47],
  'monitor stand': [52, 44, 68, 63],
  'desk surface': [24, 58, 100, 75],
  'desk legs': [26, 72, 98, 98],
  chair: [4, 29, 25, 97],
};
const over = (x: number, y: number) =>
  Object.values(DRAWN).some(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b);

export function SetupTile({ items }: { items: SetupItem[] }) {
  const capId = useId();
  const [sel, setSel] = useState<string | null>(null);
  // reading order: rows of roughly the same height, then left to right
  const ordered = useMemo(
    () => [...items].sort((a, b) => Math.round(a.y / 12) - Math.round(b.y / 12) || a.x - b.x),
    [items],
  );
  const cur = ordered.find((it) => it.id === sel) ?? null;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const off = items.filter((it) => !over(it.x, it.y));
    if (off.length) console.warn('[setup] these dots are not over anything drawn — adjust their x / y in src/data/setup.ts:', off.map((it) => `${it.id} (${it.x}, ${it.y})`).join(', '));
  }, [items]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && sel) { e.preventDefault(); setSel(null); }
  };

  return (
    <div className="w tile su" onKeyDown={onKeyDown}>
      <p className="w__label">Setup · {items.length} things</p>
      <div className="su__frame">
        <div className="su__stage">
          <svg className="su__art" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true" focusable="false">
            {/* monitor */}
            <rect x="92" y="10" width="56" height="40" rx="2.5" />
            <path d="M120 50v13M107 66h26" />
            {/* desk: the top in a little perspective, two legs */}
            <path d="M60 66h130l6 14H52z" />
            <path d="M56 80v26M192 80v26" />
            {/* keyboard and mouse */}
            <path d="M98 70.5h42l3 6.5H95z" />
            <ellipse cx="160" cy="73.5" rx="3.2" ry="4.4" />
            {/* chair: back, seat, stem and base */}
            <rect x="14" y="34" width="26" height="36" rx="4" />
            <rect x="10" y="74" width="36" height="6" rx="2" />
            <path d="M28 80v18M28 98l-12 6M28 98l12 6" />
          </svg>
          {ordered.map((it, k) => (
            <button
              key={it.id} type="button" className="su__spot"
              style={{ left: `${it.x}%`, top: `${it.y}%`, '--k': k } as CSSProperties}
              aria-label={it.name} aria-pressed={sel === it.id} aria-controls={capId}
              onClick={() => setSel(sel === it.id ? null : it.id)}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
      <p className="su__cap" id={capId} aria-live="polite">
        {cur ? <><b>{cur.name}</b> <span>{cur.use}</span></> : <span className="su__hint">Choose a dot</span>}
      </p>
    </div>
  );
}
