/* WIDGETS — a bento of live, real things: music (Spotify), Kent right
   now (time, weather, the sun), GitHub, my name to play with, and
   where I am in my course. Layout: widgets.css. */
import type { CSSProperties } from 'react';
import { KentNow } from './KentNow';
import { Music } from './Music';
import { DanielTile } from './DanielTile';
import { GitHubTile, StudyTile } from './Tiles';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export function Widgets() {
  return (
    <section className="widgets" aria-label="Personal widgets">
      <div className="widgets__grid">
        <div className="wg wg--music rise" style={d(180)}><Music /></div>
        <div className="wg wg--now rise" style={d(240)}><KentNow /></div>
        <div className="wg wg--gh rise" style={d(300)}><GitHubTile /></div>
        <div className="wg wg--name rise" style={d(360)}><DanielTile /></div>
        <div className="wg wg--study rise" style={d(480)}><StudyTile /></div>
      </div>
    </section>
  );
}
