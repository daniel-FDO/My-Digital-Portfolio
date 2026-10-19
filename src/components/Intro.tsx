/* =========================================================
   INTRO — name (large, revealed letter by letter) + role | Kent,
   UK + the time there; Currently; then a copy icon and my email.
   Styles: home.css "Intro" (scoped to .page .intro — the folder
   pages have their own .intro).
   ========================================================= */
import type { CSSProperties } from 'react';
import { HOME, INTRO } from '../data/home';
import { pad2, useKentTime } from '../lib/kentClock';
import type { CopyState } from '../hooks/useCopyEmail';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

interface Props {
  copy: CopyState & { copy: () => void };
}

export function Intro({ copy }: Props) {
  return (
    <header className="intro" id="intro" aria-labelledby="introName">
      <div className="intro__head">
        <div className="intro__id">
          {/* The name, letter by letter (the letters are visual; the heading reads it whole) */}
          <h1 className="intro__name" id="introName">
            <span className="sr">{INTRO.name}</span>
            <span className="intro__letters" aria-hidden="true">
              {[...INTRO.name].map((ch, i) => (
                <span key={i} className={ch === ' ' ? 'intro__gap' : 'intro__char'} style={{ '--i': i } as CSSProperties}>{ch === ' ' ? ' ' : ch}</span>
              ))}
            </span>
          </h1>
          <p className="intro__role in" style={delay(40)}>{INTRO.role}</p>
        </div>
        {/* Where I am + the time there (Europe/London: GMT or BST) */}
        <p className="intro__meta in" style={delay(80)}>
          <span>{HOME.location}</span>
          <IntroTime />
        </p>
      </div>

      <section className="intro__now in" style={delay(160)} aria-labelledby="nowTitle">
        <h2 className="intro__label" id="nowTitle">Currently</h2>
        <p className="intro__study">{INTRO.study}</p>
        <p className="intro__learning">{INTRO.learning}</p>
      </section>

      <p className="intro__contact in" style={delay(200)}>
        <button type="button" className={`copy${copy.done ? ' is-done' : ''}`} id="copyEmail" aria-label="Copy email address" onClick={copy.copy}>
          <svg className="copy__i copy__i--copy" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h9c1.1 0 2 .9 2 2" /></svg>
          <svg className="copy__i copy__i--done" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </button>
        <a className="intro__mail" href={`mailto:${HOME.email}`}>{HOME.email}</a>
        <span className={`copy__status${copy.status ? ' is-on' : ''}`} id="copyStatus" role="status" aria-live="polite">{copy.status}</span>
      </p>
    </header>
  );
}

/* "14:32 BST" under "Kent, UK" — re-renders once a second, on its own */
function IntroTime() {
  const t = useKentTime();
  const short = `${pad2(t.h)}:${pad2(t.m)}`;
  return (
    <time className="intro__time" id="introTime" dateTime={short}>
      <span className="sr">Local time in Kent: </span><span id="introTimeText">{`${short} ${t.zone}`}</span>
    </time>
  );
}
