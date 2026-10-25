/* =========================================================
   2. THE ORIGIN STORY — three artefacts on the desk. Picking one
   up shows its part of the story on the index card beside them
   (the first is picked to start with, so nothing is hidden).
   ========================================================= */
import { useState } from 'react';
import { DESK } from '../../data/aboutDesk';
import { ArrowCurve, useDesk, vars } from './desk';

const O = DESK.origin;
type Key = (typeof O.artefacts)[number]['key'];

export function Origin() {
  const [pick, setPick] = useState<Key>('gaming');
  const { openNotepad } = useDesk();
  const now = O.artefacts.find((a) => a.key === pick)!;

  return (
    <section className="dk-sec dk-origin" aria-labelledby="dkOriginTitle">
      <header className="dk-sec__head" data-reveal>
        <p className="dk-mono dk-kicker">origin.txt</p>
        <h2 className="dk-h2" id="dkOriginTitle">{O.heading}</h2>
      </header>

      <div className="dk-origin__desk">
        <div className="dk-origin__items" role="group" aria-label="Pick something up to read its part of the story">
          {O.artefacts.map((a, i) => (
            <button
              key={a.key} type="button" className={`dk-art dk-art--${a.key}${pick === a.key ? ' is-picked' : ''}`}
              aria-pressed={pick === a.key} aria-controls="dkOriginCard" aria-label={`${a.label}: ${a.title}`} onClick={() => setPick(a.key)}
              data-reveal style={vars({ '--d': `${0.08 + i * 0.1}s` })} data-label="Read"
            >
              <Artefact k={a.key} />
              <span className="dk-art__tag dk-mono">{a.label}</span>
            </button>
          ))}
          <p className="dk-hand dk-origin__note" data-reveal style={vars({ '--d': '0.5s' })}>
            {O.note}
            <ArrowCurve className="dk-origin__arrow" />
          </p>
        </div>

        <article className="dk-card dk-index" id="dkOriginCard" aria-live="polite" data-reveal="settle" style={vars({ '--d': '0.3s' })}>
          <p className="dk-mono dk-index__kicker">{now.label}</p>
          <h3 className="dk-index__title">{now.title}</h3>
          <p className="dk-index__text">{now.text}</p>
          {pick === '2023' && <button type="button" className="dk-link" onClick={openNotepad} aria-haspopup="dialog">Open the file in Notepad</button>}
        </article>
      </div>
    </section>
  );
}

function Artefact({ k }: { k: Key }) {
  if (k === 'gaming') return (
    <svg className="dk-art__svg" viewBox="0 0 220 140" aria-hidden="true">
      <path d="M58 26h104c26 0 40 18 48 52 7 30 0 50-18 50-14 0-22-10-32-24H60c-10 14-18 24-32 24-18 0-25-20-18-50 8-34 22-52 48-52z" fill="#2b2b2e" />
      <path d="M58 26h104c26 0 40 18 48 52l-2 6c-8-30-22-48-46-48H58c-24 0-38 18-46 48l-2-6c8-34 22-52 48-52z" fill="#3b3b3f" />
      <path d="M52 56v12H40v12h12v12h12V80h12V68H64V56z" fill="#5b5b61" />
      <circle cx="160" cy="58" r="7" fill="#c95b4d" /><circle cx="176" cy="74" r="7" fill="#4267a9" />
      <circle cx="144" cy="74" r="7" fill="#e3b341" /><circle cx="160" cy="90" r="7" fill="#5d9a64" />
      <circle cx="88" cy="100" r="11" fill="#1d1d20" stroke="#4a4a50" strokeWidth="3" />
      <circle cx="132" cy="100" r="11" fill="#1d1d20" stroke="#4a4a50" strokeWidth="3" />
      <rect x="98" y="58" width="10" height="5" rx="2.5" fill="#5b5b61" /><rect x="112" y="58" width="10" height="5" rx="2.5" fill="#5b5b61" />
    </svg>
  );
  if (k === '2023') return (
    <span className="dk-print">
      <span className="dk-print__head">first-portfolio.html</span>
      <span className="dk-print__code">{DESK.notepad.code.slice(0, 7).join('\n')}</span>
      <span className="dk-print__ring" aria-hidden="true"></span>
    </span>
  );
  return (
    <span className="dk-leaflet">
      <span className="dk-leaflet__panel dk-leaflet__panel--a">
        <span className="dk-leaflet__kicker">Open evening</span>
        <span className="dk-leaflet__big">Course<br />guide</span>
      </span>
      <span className="dk-leaflet__panel dk-leaflet__panel--b">
        <span className="dk-leaflet__kicker">Which one?</span>
        <span className="dk-leaflet__opt">Sixth form?</span>
        <span className="dk-leaflet__opt">A levels?</span>
        <span className="dk-leaflet__opt is-circled">Software development</span>
      </span>
    </span>
  );
}
