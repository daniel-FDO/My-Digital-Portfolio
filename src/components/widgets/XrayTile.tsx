/* =========================================================
   X-RAY TILE — "How it's built". A hairline map of this grid with
   this tile in red, how many parts and data sources the X-ray
   manifest (data/xray.ts) describes, and the switch for inspect
   mode (components/xray/Xray.tsx). The button's name never
   changes; aria-pressed says whether X-ray is on. With an empty
   manifest, only the map shows.
   ========================================================= */
import { useXray } from '../xray/Xray';
import { xrayCounts } from '../../data/xray';

// The wide layout (widgets.css): music music | now | gh  /  name name | now | xray
const W = 100, H = 52, G = 4, CW = (W - 3 * G) / 4, RH = (H - G) / 2;
const cell = (col: number, row: number, cols = 1, rows = 1) => ({
  x: col * (CW + G), y: row * (RH + G), width: cols * CW + (cols - 1) * G, height: rows * RH + (rows - 1) * G,
});

export function XrayTile() {
  const { on, toggle, entries } = useXray();
  const { parts, sources } = xrayCounts(entries);
  return (
    <div className="w tile xr-tile">
      <div>
        <p className="w__label">How it’s built · X-ray</p>
        <svg className="xr-tile__map" viewBox={`-1 -1 ${W + 2} ${H + 2}`} role="img" aria-label="A map of these tiles, with this one highlighted">
          <rect {...cell(0, 0, 2)} rx="3" />
          <rect {...cell(2, 0, 1, 2)} rx="3" />
          <rect {...cell(3, 0)} rx="3" />
          <rect {...cell(0, 1, 2)} rx="3" />
          <rect {...cell(3, 1)} rx="3" className="is-here" />
        </svg>
      </div>
      {parts > 0 && (
        <div>
          <p className="xr-tile__count">{parts} {parts === 1 ? 'part' : 'parts'} · {sources} data {sources === 1 ? 'source' : 'sources'}</p>
          <button type="button" className="xr-tile__btn" aria-pressed={on} aria-keyshortcuts="X" onClick={toggle}>
            Inspect this page<kbd aria-hidden="true">X</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
