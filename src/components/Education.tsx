/* EDUCATION — one row; it opens to show the course details (education.ts) */
import { useState } from 'react';
import { EDUCATION } from '../data/education';
import { HOME } from '../data/home';
import { ChevIcon } from './icons';

export function Education() {
  const [open, setOpen] = useState(false);
  const p = EDUCATION.panel;

  return (
    <section className="sec" id="education" aria-labelledby="eduTitle" data-xray="education">
      <h2 className="h" id="eduTitle">Education</h2>
      <div id="eduRows">
        <div className="xp">
          <button type="button" className="xp__btn" aria-expanded={open} aria-controls="eduMore" onClick={() => setOpen((v) => !v)}>
            <span className="xp__top"><span className="xp__title">{`T-Level ${p.heading} · ${p.place}`}</span><span className="xp__where">{HOME.location || ''}</span></span>
            <span className="xp__sub">{p.status}<ChevIcon /></span>
          </button>
          <div className={`xp__more${open ? ' is-open' : ''}`} id="eduMore" inert={!open}><div>
            <ul className="xp__list">
              {p.details.map((d) => <li key={d.label}><b>{d.label}</b><span>{d.text}</span></li>)}
            </ul>
          </div></div>
        </div>
      </div>
    </section>
  );
}
