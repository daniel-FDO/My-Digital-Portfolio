/* =========================================================
   LAST WORKED ON — a slim strip of "tape" under Projects:
   "Last recorded update to Daniel's Gallery · 19 days ago".

   The dates: `lastWorkedOn` ("YYYY-MM-DD") in src/data/projects.json.
   Add `"lastWorkedOnFrom": "commit"` when the date is the repo's
   latest commit (the strip then says "last recorded update", not
   "last worked on"). Projects without a date are left out; with no
   dates at all, the strip isn't shown. The day count is worked out
   from the visitor's today, never stored.

   - More than one project: one at a time, newest first, changing
     every 7 s with a slow fade. It holds while hovered, off screen,
     in a hidden tab, or while the site's Pause is on.
   - Reduced motion: no rotation — every project is shown at once.
   - Screen readers get a plain list of them all (the moving line is
     hidden from them, so nothing is announced as it changes).
   ========================================================= */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PROJECTS } from '../data/home';
import { isAmbientPaused, onAmbientPause, useReducedMotion } from '../lib/motion';

const ROTATE_MS = 7000;
const fmtDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** whole calendar days from `date` to the visitor's today (null if not a real, past date) */
function daysSince(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const then = Date.parse(date + 'T00:00:00Z');
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - then) / 864e5);
  return Number.isFinite(days) && days >= 0 ? days : null;
}
const ago = (d: number) => (d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);

interface Entry { name: string; date: string; days: number; commit: boolean }

function entries(): Entry[] {
  return PROJECTS.flatMap((p) => {
    const days = p.lastWorkedOn ? daysSince(p.lastWorkedOn) : null;
    return days === null ? [] : [{ name: p.name, date: p.lastWorkedOn!, days, commit: p.lastWorkedOnFrom === 'commit' }];
  }).sort((a, b) => a.days - b.days);
}

const lead = (e: Entry) => (e.commit ? 'Last recorded update to' : 'Last worked on');

const usePaused = () => useSyncExternalStore(onAmbientPause, isAmbientPaused);

export function LastWorkedOn() {
  const reduced = useReducedMotion();
  const paused = usePaused();
  const [, setDay] = useState(0);                 // re-reads the dates when the tab comes back (a new day, maybe)
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);        // hovered
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const list = entries();
  const rotate = !reduced && list.length > 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    obs.observe(el);
    const onVis = () => { if (!document.hidden) setDay((n) => n + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => { obs.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    if (!rotate || hold || paused || !inView) return;
    const t = window.setInterval(() => { if (!document.hidden) setI((n) => n + 1); }, ROTATE_MS);
    return () => clearInterval(t);
  }, [rotate, hold, paused, inView]);

  if (!list.length) return null;
  const current = i % list.length;

  return (
    <aside className="lwo" aria-label="When I last worked on these projects" ref={ref}>
      <ul className="sr">
        {list.map((e) => (
          <li key={e.name}>{lead(e)} {e.name}: {ago(e.days)} (<time dateTime={e.date}>{fmtDate.format(new Date(e.date + 'T00:00:00Z'))}</time>)</li>
        ))}
      </ul>
      <p
        className={`lwo__strip${rotate ? ' is-rotating' : ''}`} aria-hidden="true"
        onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}
      >
        <svg className="lwo__pen" viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" /></svg>
        <span className="lwo__lines">
          {list.map((e, k) => (
            <span
              key={e.name} className={`lwo__line${!rotate || k === current ? ' is-on' : ''}`}
              title={`${lead(e)} ${e.name} on ${fmtDate.format(new Date(e.date + 'T00:00:00Z'))}`}
            >
              {/* the name and the count stay together; a narrow strip breaks after "to" */}
              {lead(e)} <b>{e.name}</b>{' '}<span className="lwo__ago">·{' '}{ago(e.days)}</span>
            </span>
          ))}
        </span>
      </p>
    </aside>
  );
}
