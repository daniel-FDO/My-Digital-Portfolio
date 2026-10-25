/* =========================================================
   THE LAST PAGE OF THE NOTEBOOK — the closing note, the way to
   the projects, and a small date stamp.
   "See what I've built" is a real link (index.html#projects).
   In the home page's in-place view (onLeave given), a plain click
   closes the About page instead and scrolls to the projects.
   ========================================================= */
import type { MouseEvent } from 'react';
import { DESK } from '../../data/aboutDesk';
import { calm } from '../../lib/motion';
import { vars } from './desk';

const E = DESK.ending;

export function Ending({ onLeave }: { onLeave?: () => void }) {
  const toProjects = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onLeave || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onLeave();
    // Once the layer has gone (the page can scroll again), go to the projects
    const t0 = performance.now();
    const wait = () => {
      if (document.documentElement.style.overflow === '' || performance.now() - t0 > 1200) {
        document.getElementById('projects')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
      } else requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  };

  return (
    <section className="dk-sec dk-end" aria-labelledby="dkEndTitle">
      <div className="dk-page" data-reveal="focus">
        <span className="dk-page__holes" aria-hidden="true"></span>
        <h2 className="dk-page__title" id="dkEndTitle">{E.heading}</h2>
        <p className="dk-page__text">{E.text}</p>
        <a className="dk-cta" href="index.html#projects" onClick={toProjects}>
          {E.cta}<span aria-hidden="true">→</span>
        </a>
        <p className="dk-hand dk-page__sign">{E.sign}</p>
        <span className="dk-stamp dk-page__stamp" aria-hidden="true" style={vars({ '--r': '-12deg' })}>KENT · UK<br /><b>{new Date().getFullYear()}</b><br />STILL BUILDING</span>
        <p className="dk-mono dk-page__ps">
          P.S. say hi:{' '}
          {E.links.map((l, i) => (
            <span key={l.label}>
              {i > 0 && ' · '}
              <a href={l.href} {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
