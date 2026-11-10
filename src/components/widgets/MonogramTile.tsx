/* =========================================================
   MONOGRAM — a "D" drawn in dots, in the accent colour, with a
   lighter band across it like light on a sign. Hovering the tile
   sends a soft wave through the dots; with reduced motion it stays
   still. (Decorative: no Tab stop, since it does nothing.)
   ========================================================= */
import type { CSSProperties } from 'react';

const N = 17;   // the grid: N × N dots

/** The letter: an outer D minus an inner D, 3 dots thick */
function inD(x: number, y: number) {
  const outer = (x >= 2 && x <= 8 && y >= 1 && y <= 15) || (x >= 8 && ((x - 8) / 7.2) ** 2 + ((y - 8) / 7.2) ** 2 <= 1);
  const inner = (x >= 5 && x <= 8 && y >= 4 && y <= 12) || (x >= 8 && ((x - 8) / 4.2) ** 2 + ((y - 8) / 4.2) ** 2 <= 1);
  return outer && !inner;
}

const DOTS = Array.from({ length: N * N }, (_, i) => ({ x: i % N, y: Math.floor(i / N) }))
  .filter(({ x, y }) => inD(x, y))
  .map(({ x, y }) => ({
    x, y,
    // a diagonal band of lighter dots, brightest along its middle
    lit: Math.max(0, 1 - Math.abs((x - y) - 3) / 3),
  }));

export function MonogramTile() {
  return (
    <div className="w mono" role="img" aria-label="A D for Daniel, drawn in dots">
      <svg className="mono__d" viewBox={`-0.5 -0.5 ${N} ${N}`} aria-hidden="true">
        {DOTS.map((d) => (
          <rect
            key={`${d.x}-${d.y}`} x={d.x + 0.12} y={d.y + 0.12} width="0.76" height="0.76" rx="0.2"
            style={{ '--k': d.x + d.y, '--lit': d.lit.toFixed(2) } as CSSProperties}
          />
        ))}
      </svg>
    </div>
  );
}
