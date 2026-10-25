/* =========================================================
   4. WHERE I'M HEADING — a folded map with an unfinished route,
   two overlapping tickets (each opens to say why it appeals),
   and a page of ideas. Possibilities, not a decision.
   ========================================================= */
import { useState } from 'react';
import { DESK } from '../../data/aboutDesk';
import { Tape, vars } from './desk';

const F = DESK.future;

export function Future() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="dk-sec dk-future" aria-labelledby="dkFutureTitle">
      <header className="dk-sec__head" data-reveal>
        <p className="dk-mono dk-kicker">next/ (work in progress)</p>
        <h2 className="dk-h2" id="dkFutureTitle">{F.heading}</h2>
      </header>

      <div className="dk-future__desk">
        <div className="dk-map" data-reveal style={vars({ '--d': '0.05s' })}>
          <svg className="dk-map__svg" viewBox="0 0 400 260" aria-hidden="true">
            <path d="M0 70c60-10 90 20 150 8s110-40 160-20 70 30 90 26" fill="none" stroke="#a9c4cf" strokeWidth="14" opacity=".5" />
            <path d="M30 230c40-40 30-90 80-110s100 10 130-30 70-40 120-60" fill="none" stroke="#d9cfb8" strokeWidth="3" />
            <path d="M60 30c30 60 80 70 90 130s60 70 120 80" fill="none" stroke="#d9cfb8" strokeWidth="2" />
            <path className="dk-map__route" pathLength={1} d="M78 196c34-30 70-26 96-50s38-60 86-62 56-24 82-40" fill="none" stroke="#c95b4d" strokeWidth="2.6" strokeDasharray=".02 .018" strokeLinecap="round" />
            <circle cx="78" cy="196" r="6" fill="#c95b4d" />
            <text x="90" y="214" className="dk-map__place">Canterbury · 2027</text>
            <text x="336" y="34" className="dk-map__q">?</text>
          </svg>
          <span className="dk-map__plane" aria-hidden="true">
            <svg viewBox="0 0 48 32"><path d="M2 16 46 2 30 30l-7-10z" fill="#fff" stroke="#222" strokeWidth="1.4" strokeLinejoin="round" /><path d="M46 2 23 20l-3 10" fill="none" stroke="#222" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          </span>
          <span className="dk-stamp dk-map__stamp" aria-hidden="true">EST. FINISH<br /><b>SUMMER 2027</b></span>
        </div>

        <div className="dk-card dk-future__text" data-reveal="settle" style={vars({ '--d': '0.15s' })}>
          <Tape className="dk-future__tape" />
          {F.text.map((t) => <p key={t}>{t}</p>)}
        </div>

        <div className="dk-paths" role="group" aria-label="Two possible paths">
          {F.paths.map((p, i) => {
            const on = open === p.key;
            return (
              <div className={`dk-path dk-path--${p.key}${on ? ' is-open' : ''}`} key={p.key} data-reveal style={vars({ '--d': `${0.25 + i * 0.12}s` })}>
                <button type="button" className="dk-path__ticket" aria-expanded={on} aria-controls={`dkPath-${p.key}`} onClick={() => setOpen(on ? null : p.key)} data-label={on ? 'Close' : 'Open'}>
                  <span className="dk-path__punch" aria-hidden="true"></span>
                  <span className="dk-mono dk-path__kicker">Possible route 0{i + 1}</span>
                  <span className="dk-path__title">{p.title}</span>
                  <span className="dk-path__line">{p.line}</span>
                </button>
                <p className="dk-hand dk-path__more" id={`dkPath-${p.key}`} hidden={!on}>{p.more}</p>
              </div>
            );
          })}
        </div>

        <div className="dk-ideas" data-reveal style={vars({ '--d': '0.3s' })}>
          <h3 className="dk-mono dk-ideas__title">ideas for later</h3>
          <ul>{F.ideas.map((t) => <li key={t} className="dk-hand">{t}</li>)}</ul>
        </div>

        <p className="dk-hand dk-future__note" data-reveal="settle" style={vars({ '--d': '0.45s' })}>{F.note}</p>
      </div>
    </section>
  );
}
