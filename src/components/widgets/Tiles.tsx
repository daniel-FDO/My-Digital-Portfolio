/* =========================================================
   SMALL TILES — GitHub and studying.
   All from real data: the shared GitHub request (lib/github.ts)
   and education.ts.
   ========================================================= */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import CONFIG from '../../../github-config.json';
import { EDUCATION } from '../../data/education';
import { loadContributions } from '../../lib/github';
import type { Contributions } from '../../types';

const nf = new Intl.NumberFormat('en-GB');
const Arrow = () => <svg className="w__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>;

/* ---- GitHub: the total + the last 16 weeks ---- */
export function GitHubTile() {
  const [data, setData] = useState<Contributions | null | 'error'>(null);
  useEffect(() => {
    let gone = false;
    loadContributions().then((d) => { if (!gone) setData(d); }, () => { if (!gone) setData('error'); });
    return () => { gone = true; };
  }, []);
  const ready = data && data !== 'error' ? data : null;
  const { weeks, total } = useMemo(() => (ready
    ? { weeks: ready.weeks.slice(-16), total: ready.weeks.flat().reduce((n, d) => n + d.count, 0) }
    : { weeks: [], total: 0 }), [ready]);

  return (
    <a className="w tile gh-tile" href="#activity" aria-label={ready ? `GitHub: ${nf.format(total)} contributions in the last 12 months. Go to Activity` : 'GitHub activity: go to Activity'}>
      <p className="w__label">
        <svg className="w__glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
        @{CONFIG.username}
      </p>
      {data === 'error' ? (
        <p className="tile__muted" aria-hidden="true">Activity unavailable right now.</p>
      ) : (
        <div className="gh-tile__body" aria-hidden="true">
          <div className="gh-tile__grid" style={{ '--weeks': weeks.length || 16 } as CSSProperties}>
            {ready
              ? weeks.map((w, c) => w.map((d) => <i key={d.date} data-l={d.level} style={{ gridColumn: c + 1, gridRow: d.weekday + 1 }}></i>))
              : Array.from({ length: 112 }, (_, i) => <i key={i} className="is-ph"></i>)}
          </div>
          <p className="tile__num">{ready ? nf.format(total) : <span className="tile__ph"></span>}<span className="tile__unit">contributions<br />in 12 months</span></p>
        </div>
      )}
      <Arrow />
    </a>
  );
}

/* ---- Studying: the course and where I am in it ---- */
export function StudyTile() {
  const { panel } = EDUCATION;
  const steps = panel.timeline;
  const at = Math.max(0, steps.findIndex((s) => s.current));
  return (
    <a className="w tile study-tile" href="#education">
      <span className="w__label">Studying · {panel.status}</span>
      <span className="study-tile__title">{panel.heading}</span>
      <span className="tile__muted">{panel.place}</span>
      <ol className="study-tile__steps" style={{ '--at': at, '--n': steps.length } as CSSProperties}>
        {steps.map((s, i) => (
          <li key={s.label} className={i < at ? 'is-done' : i === at ? 'is-now' : undefined} aria-current={i === at ? 'step' : undefined}>
            <i aria-hidden="true"></i><span>{s.label}</span>
          </li>
        ))}
      </ol>
    </a>
  );
}
