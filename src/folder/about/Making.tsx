/* =========================================================
   3. WHAT'S ON MY DESK RIGHT NOW — two project folders (open to
   pull the screenshot out), the notebook of things I'm learning,
   and a plain reference sheet of what I already use.
   ========================================================= */
import { useState } from 'react';
import { DESK } from '../../data/aboutDesk';
import { ArrowShort, Tape, vars } from './desk';

const M = DESK.making;
type Project = (typeof M.projects)[number];

export function Making() {
  return (
    <section className="dk-sec dk-making" aria-labelledby="dkMakingTitle">
      <header className="dk-sec__head dk-sec__head--right" data-reveal>
        <p className="dk-mono dk-kicker">~/desk/right-now</p>
        <h2 className="dk-h2" id="dkMakingTitle">{M.heading}</h2>
        <p className="dk-hand dk-sec__sub">{M.sub}</p>
      </header>

      <div className="dk-making__projects">
        {M.projects.map((p, i) => <ProjectFolder key={p.key} p={p} i={i} />)}
      </div>

      <div className="dk-making__study">
        <div className="dk-notebook" data-reveal style={vars({ '--d': '0.1s' })}>
          <span className="dk-notebook__rings" aria-hidden="true"></span>
          <h3 className="dk-hand dk-notebook__title">{M.learning.heading}</h3>
          <ul className="dk-notebook__list">
            {M.learning.items.map((t, i) => <li key={t} style={vars({ '--i': i })}><span className="dk-hl">{t}</span></li>)}
          </ul>
          <p className="dk-hand dk-notebook__note"><ArrowShort className="dk-notebook__arrow" />{M.learning.note}</p>
        </div>

        <div className="dk-sheet" data-reveal style={vars({ '--d': '0.2s' })}>
          <Tape className="dk-sheet__tape" />
          <p className="dk-mono dk-sheet__file">{M.using.file}</p>
          <h3 className="dk-sr">Things I already use</h3>
          <dl className="dk-sheet__list">
            {M.using.items.map(([name, use]) => (
              <div key={name}><dt>{name}</dt><dd>{use}</dd></div>
            ))}
          </dl>
          <p className="dk-mono dk-sheet__foot">// no percentages. just things I’ve used.</p>
        </div>
      </div>
    </section>
  );
}

function ProjectFolder({ p, i }: { p: Project; i: number }) {
  const [open, setOpen] = useState(false);
  const live = p.status === 'Live';
  return (
    <article className={`dk-proj dk-proj--${p.tone}`} data-reveal="folder" style={vars({ '--d': `${0.1 + i * 0.15}s` })} aria-labelledby={`dkProj-${p.key}`}>
      <button
        type="button" className={`folder${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`${open ? 'Close' : 'Open'} the ${p.name} folder`} data-label={open ? 'Close' : 'Open'}
      >
        <span className="folder__back" aria-hidden="true"><span className="folder__tab dk-mono">{p.key}/</span></span>
        <span className="folder__sheet">
          <span className="folder__chrome" aria-hidden="true"><i></i><i></i><i></i><span>{p.host}</span></span>
          <img src={p.image} alt={p.alt} width="800" height="500" loading="lazy" decoding="async" draggable={false} />
        </span>
        {!live && (
          <svg className="folder__wire" viewBox="0 0 160 110" aria-hidden="true">
            <rect x="4" y="4" width="152" height="102" rx="3" fill="#fbfaf6" stroke="#4267a9" strokeWidth="1.5" />
            <path d="M14 18h60M14 28h40" stroke="#4267a9" strokeWidth="3" strokeLinecap="round" />
            <rect x="14" y="40" width="58" height="56" rx="2" fill="none" stroke="#4267a9" strokeDasharray="3 3" />
            <path d="M84 42h62M84 52h50M84 62h58M84 72h40M84 86h30" stroke="#4267a9" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          </svg>
        )}
        <span className="folder__front" aria-hidden="true">
          <span className="folder__label dk-mono">{p.name}</span>
          {!live && <span className="folder__stamp">IN PROGRESS</span>}
        </span>
      </button>

      <div className="dk-card dk-proj__card">
        <p className={`dk-mono dk-proj__status${live ? '' : ' is-wip'}`}>{p.status}</p>
        <h3 className="dk-proj__name" id={`dkProj-${p.key}`}>{p.name}</h3>
        <p className="dk-proj__text">{p.text}</p>
        {p.areas.length > 0 && (
          <ul className="dk-proj__areas" aria-label="Areas covered">{p.areas.map((a) => <li key={a}>{a}</li>)}</ul>
        )}
        <a className="dk-link" href={p.url} target="_blank" rel="noopener noreferrer">
          {live ? 'Visit the site' : 'See where it’s at'}<span aria-hidden="true"> ↗</span><span className="dk-sr"> (opens in a new tab)</span>
        </a>
      </div>
    </article>
  );
}
