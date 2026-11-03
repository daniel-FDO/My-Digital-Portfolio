/* WIDGETS — a bento of live, real things: music (Spotify), Kent right
   now (time, weather, the sun), GitHub, my name to play with, and a
   last tile that is "Fixed" (a bug logbook) or "Setup" (my desk) once
   their data files have real entries, and the X-ray switch until then
   (data/heroSlot.ts). Layout: widgets.css.
   data-xray: each tile's entry in data/xray.ts. */
import { useMemo, type CSSProperties } from 'react';
import { KentNow } from './KentNow';
import { Music } from './Music';
import { DanielTile } from './DanielTile';
import { GitHubTile } from './Tiles';
import { XrayTile } from './XrayTile';
import { FixedTile } from './FixedTile';
import { SetupTile } from './SetupTile';
import { heroBugs, heroSetup, heroSlot } from '../../data/heroSlot';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export function Widgets() {
  const slot = useMemo(heroSlot, []);
  return (
    <section className="widgets" aria-label="Personal widgets">
      <div className={`widgets__grid${slot !== 'xray' ? ' widgets__grid--slot' : ''}`}>
        <div className="wg wg--music rise" style={d(180)} data-xray="music"><Music /></div>
        <div className="wg wg--now rise" style={d(240)} data-xray="now"><KentNow /></div>
        <div className="wg wg--gh rise" style={d(300)} data-xray="gh"><GitHubTile /></div>
        <div className="wg wg--name rise" style={d(360)} data-xray="name"><DanielTile /></div>
        <div className="wg wg--xray rise" style={d(480)} data-xray={slot}>
          {slot === 'fixed' ? <FixedTile bugs={heroBugs()} /> : slot === 'setup' ? <SetupTile items={heroSetup()} /> : <XrayTile />}
        </div>
      </div>
    </section>
  );
}
