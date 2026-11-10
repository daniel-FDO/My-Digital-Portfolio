/* WIDGETS — one quiet row under the intro: what I'm listening to
   (Spotify), the time in Kent on an analog face, and a dot-matrix
   monogram. Layout: widgets.css. data-xray: each tile's entry in
   data/xray.ts. (The earlier tiles: KentNow, GitHubTile, DanielTile,
   XrayTile and the Fixed / Setup slot, are kept in this folder but
   no longer shown; X-ray mode itself stays on the X key and Ctrl K.) */
import type { CSSProperties } from 'react';
import { Music } from './Music';
import { ClockTile } from './ClockTile';
import { MonogramTile } from './MonogramTile';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export function Widgets() {
  return (
    <section className="widgets" aria-label="Personal widgets">
      <div className="widgets__grid">
        <div className="wg wg--music rise" style={d(180)} data-xray="music"><Music /></div>
        <div className="wg wg--clock rise" style={d(240)} data-xray="clock"><ClockTile /></div>
        <div className="wg wg--mono rise" style={d(300)} data-xray="mono"><MonogramTile /></div>
      </div>
    </section>
  );
}
