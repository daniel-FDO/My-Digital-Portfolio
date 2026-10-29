/* =========================================================
   INTRO — name (large, revealed letter by letter) + role | when the
   site last changed (its latest commit); Currently; then a copy icon
   and my email.
   Styles: home.css "Intro" (scoped to .page .intro — the folder
   pages have their own .intro).
   ========================================================= */
import { useEffect, useState, type CSSProperties } from 'react';
import { HOME, INTRO } from '../data/home';
import { FontCycleName } from './fontcycle/FontCycleName';

/** The name changes typeface every 3 seconds (fontcycle/). false = the original heading below. */
export const ENABLE_FONT_CYCLE = true;
import type { CopyState } from '../hooks/useCopyEmail';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

interface Props {
  copy: CopyState & { copy: () => void };
}

export function Intro({ copy }: Props) {
  return (
    <header className="intro" id="intro" aria-labelledby="introName" data-xray="intro">
      <div className="intro__head">
        <div className="intro__id">
          {ENABLE_FONT_CYCLE ? <FontCycleName name={INTRO.name} /> : (
          /* The name, letter by letter (the letters are visual; the heading reads it whole) */
          <h1 className="intro__name" id="introName">
            <span className="sr">{INTRO.name}</span>
            <span className="intro__letters" aria-hidden="true">
              {[...INTRO.name].map((ch, i) => (
                <span key={i} className={ch === ' ' ? 'intro__gap' : 'intro__char'} style={{ '--i': i } as CSSProperties}>{ch === ' ' ? ' ' : ch}</span>
              ))}
            </span>
          </h1>
          )}
          <p className="intro__role in" style={delay(40)}>{INTRO.role}</p>
        </div>
        <LastUpdate />
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

/* "Last recorded update" + "29 Oct 2026 · 2 days ago": this site's latest commit
   (__LAST_COMMIT__, from vite.config.mts at build time). Days are counted in
   UK calendar days. Without a date (no git at build time) nothing is shown. */
const ZONE = HOME.timeZone || 'Europe/London';
const ukDay = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtDate = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, day: 'numeric', month: 'short', year: 'numeric' });
const fmtFull = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, dateStyle: 'full', timeStyle: 'short' });

function LastUpdate() {
  const [, setTick] = useState(0);
  // a tab left open overnight: count again when it's looked at
  useEffect(() => {
    const onVis = () => { if (!document.hidden) setTick((n) => n + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // (typeof: a dev server started before vite.config.mts set it has no __LAST_COMMIT__ at all)
  const iso = typeof __LAST_COMMIT__ === 'string' ? __LAST_COMMIT__ : null;
  const when = iso ? new Date(iso) : null;
  if (!iso || !when || Number.isNaN(when.getTime())) return null;
  const days = Math.round((Date.parse(ukDay.format(new Date())) - Date.parse(ukDay.format(when))) / 864e5);
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return (
    <p className="intro__meta in" style={delay(80)}>
      <span>Last recorded update</span>
      <time className="intro__time" dateTime={iso} title={`Latest commit: ${fmtFull.format(when)}`}>
        {fmtDate.format(when)} · {ago}
      </time>
    </p>
  );
}
