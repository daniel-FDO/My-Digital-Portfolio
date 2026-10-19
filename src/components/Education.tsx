/* EDUCATION — one row; it opens to show the course details (education.ts) */
import { Fragment, useState } from 'react';
import { EDUCATION } from '../data/education';
import { HOME } from '../data/home';
import { ChevIcon } from './icons';

export function Education() {
  const [open, setOpen] = useState(false);
  const p = EDUCATION.panel;
  const finish = (p.timeline.find((t) => /20\d\d/.test(t.label)) || { label: '' }).label;

  return (
    <section className="sec" id="education" aria-labelledby="eduTitle">
      <h2 className="h" id="eduTitle">Education</h2>
      <div id="eduRows">
        <div className="xp">
          <button type="button" className="xp__btn" aria-expanded={open} aria-controls="eduMore" onClick={() => setOpen((v) => !v)}>
            <span className="xp__top"><span className="xp__title">{`T-Level ${p.heading} · ${p.place}`}</span><span className="xp__where">{HOME.location || ''}</span></span>
            <span className="xp__sub">{p.status}<i aria-hidden="true"></i>{`Finishing ${finish.toLowerCase()}`}<ChevIcon /></span>
          </button>
          <div className={`xp__more${open ? ' is-open' : ''}`} id="eduMore" inert={!open}><div>
            <ul className="xp__list">
              <li><b>Path</b><span>{p.timeline.map((t, i) => (
                <Fragment key={t.label}>{i > 0 && ' → '}{t.current ? <span style={{ color: 'var(--fg)' }}>{t.label}</span> : t.label}</Fragment>
              ))}</span></li>
              {p.topics.map((t) => <li key={t.title}><b>{t.title}</b><span>{t.text}</span></li>)}
              <li><b>How</b><span>{p.note}</span></li>
            </ul>
          </div></div>
        </div>
      </div>
    </section>
  );
}
