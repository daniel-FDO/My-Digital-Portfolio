/* =========================================================
   ACTIVITY — GitHub: a summary on the left, the heatmap and the
   months on the right (stacked on narrower screens).
   Data: /api/github-contributions (lib/github.js). The server asks
   GitHub with a token from .env and caches the answer for an hour;
   this page never sees the token. Settings: github-config.json.

   The period is the days GitHub returns (the last 12 months, to
   today). Every number in the summary — total, busiest day, longest
   streak, the monthly bars — is counted from those same days.
   Stars / followers / repositories come with them, from the profile.

   States:
     loading     → quiet placeholders (one soft pulse)
     ready       → the real numbers; "Updated n min ago" (when GitHub
                   was last asked), or "Cached copy" if GitHub didn't
                   answer and an older real answer is shown
     unavailable → says so, with the profile link (never made-up
                   squares, and an error is never shown as zero)
   Interaction:
     hover / tap / focus a square or a month → a tooltip with the
     date(s) and count. Keyboard: Tab into the grid (or the months)
     once, then the arrow keys move; Home / End = first / last.
   ========================================================= */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import CONFIG from '../../../github-config.json';
import type { ContributionDay, Contributions, GithubConfig } from '../../types';
import { loadContributions } from '../../lib/github';
import { NewTab } from '../icons';
import { useMiniTip, type MiniTipApi } from './MiniTip';
import { summarise, type MonthTotal, type Summary } from './stats';

const C: GithubConfig = CONFIG;
const locale = C.locale || 'en-GB';
// GitHub dates are calendar days ("2026-10-04") → read and print them in UTC so they never shift a day
const day = (s: string) => new Date(s + 'T00:00:00Z');
const fmtLong = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtTip = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
const fmtMonthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const nf = new Intl.NumberFormat(locale);
const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
const big = (n: number) => (n >= 10000 ? compact.format(n) : nf.format(n));
const plural = (n: number) => (n === 0 ? 'No contributions' : `${nf.format(n)} contribution${n === 1 ? '' : 's'}`);
const monthLabel = (m: MonthTotal) => fmtMonthYear.format(day(m.first))
  + (m.partial ? ` (${fmtDayMonth.format(day(m.first))} – ${fmtDayMonth.format(day(m.last))})` : '');

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(min)) return null;
  if (min < 1) return 'Updated just now';
  if (min < 60) return `Updated ${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `Updated ${h} h ago` : `Updated ${fmtShort.format(new Date(iso))}`;
}

type Load = { state: 'loading' } | { state: 'ready'; data: Contributions } | { state: 'unavailable' };

const GitHubMark = () => (
  <svg className="act__mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
);
const Arrow = () => <svg className="act__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>;
const STAT_ICONS = {
  stars: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z" /></svg>,
  followers: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4A6.5 6.5 0 0 1 21.5 20" /></svg>,
  repos: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2.2" /><circle cx="18" cy="5" r="2.2" /><circle cx="12" cy="19" r="2.2" /><path d="M6 7.2v1.3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.2M12 11.5v5.3" /></svg>,
};

export function Activity() {
  const rootRef = useRef<HTMLElement>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [seen, setSeen] = useState(false);        // on screen once → the entrance plays
  const [tip, tipPortal] = useMiniTip();

  // Fetch once, when the section is getting close (shared with the GitHub widget: one request)
  useEffect(() => {
    let gone = false;
    const obs = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      loadContributions()
        .then((data) => { if (!gone) setLoad({ state: 'ready', data }); })
        .catch(() => { if (!gone) setLoad({ state: 'unavailable' }); });
    }, { rootMargin: '800px 0px' });
    obs.observe(rootRef.current!);
    return () => { gone = true; obs.disconnect(); };
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setSeen(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(rootRef.current!);
    return () => obs.disconnect();
  }, []);

  const data = load.state === 'ready' ? load.data : null;
  const summary = useMemo(() => (data ? summarise(data.weeks.flat()) : null), [data]);
  const status = load.state === 'loading' ? 'Loading'
    : load.state === 'unavailable' ? 'Unavailable'
    : data!.stale ? 'Cached copy' : (ago(data!.fetchedAt) ?? 'From GitHub');

  return (
    <section className={`sec act is-${load.state}${seen ? ' is-in' : ''}`} id="activity" aria-labelledby="activityTitle" ref={rootRef}>
      <div className="sec__head">
        <h2 className="h" id="activityTitle">Activity</h2>
        <a className="sec__link" href={C.profileUrl} target="_blank" rel="noopener noreferrer">GitHub<NewTab /></a>
      </div>

      <div className="act__lead">
        <div>
          <p className="act__eyebrow">GitHub · last 12 months</p>
          <p className="act__title">Code, one day <em>at a time.</em></p>
        </div>
        <p className="act__intro">
          Contributions, followers and public repositories, from GitHub.
          {summary && <> Counted over <span className="act__nowrap">{fmtShort.format(day(summary.from))} – {fmtShort.format(day(summary.to))}</span>.</>}
        </p>
      </div>

      {load.state === 'unavailable' ? (
        <div className="act__card act__empty" role="status">
          <p className="act__label">GitHub activity</p>
          <p className="act__emptyTitle">Unavailable right now.</p>
          <p className="act__muted">GitHub didn't answer, so there are no numbers to show here. Nothing is estimated.</p>
          <a className="act__pill" href={C.profileUrl} target="_blank" rel="noopener noreferrer"><GitHubMark />@{C.username}<Arrow /><NewTab /></a>
        </div>
      ) : (
        <div className="act__grid">
          <div className="act__side">
            <SummaryCard summary={summary} stale={!!data?.stale} />
            <ul className="act__stats" aria-label="GitHub profile">
              <StatCard k="stars" label="Stars" hint="On public repositories" value={data ? data.profile?.stars ?? null : undefined} d={1} />
              <StatCard k="followers" label="Followers" value={data ? data.profile?.followers ?? null : undefined} d={2} />
              <StatCard k="repos" label="Repos" hint="Public repositories" value={data ? data.profile?.publicRepos ?? null : undefined} d={3} />
            </ul>
          </div>

          <div className="act__card act__panel" style={{ '--d': 2 } as CSSProperties}>
            <div className="act__panelHead">
              <span className="act__who"><GitHubMark />@{data?.username ?? C.username}</span>
              <span className={`act__badge${data && !data.stale ? ' is-fresh' : ''}`} role="status">{status}</span>
              <a className="act__view" href={C.profileUrl} target="_blank" rel="noopener noreferrer">View profile<Arrow /><NewTab /></a>
            </div>
            {data && summary ? (
              <>
                <Calendar weeks={data.weeks} summary={summary} tip={tip} />
                <MonthBars summary={summary} tip={tip} />
              </>
            ) : (
              <div className="act__skeleton" aria-hidden="true"><i></i><i></i></div>
            )}
          </div>
        </div>
      )}
      {tipPortal}
    </section>
  );
}

/* ---------- Summary (left) ---------- */
function SummaryCard({ summary, stale }: { summary: Summary | null; stale: boolean }) {
  const s = summary;
  return (
    <div className="act__card act__summary" style={{ '--d': 0 } as CSSProperties}>
      <p className="act__label">Last 12 months</p>
      <p className="act__big">{s ? nf.format(s.total) : <span className="act__ph act__ph--big"></span>}</p>
      <p className="act__muted">contribution{s?.total === 1 ? '' : 's'} on GitHub</p>
      {s && <p className="act__period">{fmtShort.format(day(s.from))} – {fmtShort.format(day(s.to))}{stale && <><br /><span className="act__stale">Not the latest: GitHub didn't answer, so this is the last copy it sent.</span></>}</p>}
      <dl className="act__facts">
        <div>
          <dt>Busiest day</dt>
          {/* the period is under a year, so a day + month is never ambiguous; the full date is in the title */}
          <dd title={s?.busiest ? fmtLong.format(day(s.busiest.date)) : undefined}>{!s ? <span className="act__ph"></span> : s.busiest ? <>{nf.format(s.busiest.count)} <span className="act__dim">·</span> <span className="act__nowrap">{fmtDayMonth.format(day(s.busiest.date))}</span><span className="sr"> {day(s.busiest.date).getUTCFullYear()}</span></> : 'None yet'}</dd>
        </div>
        <div>
          <dt>Longest streak</dt>
          <dd>{!s ? <span className="act__ph"></span> : `${nf.format(s.longestStreak)} day${s.longestStreak === 1 ? '' : 's'}`}</dd>
        </div>
      </dl>
    </div>
  );
}

function StatCard({ k, label, hint, value, d }: { k: keyof typeof STAT_ICONS; label: string; hint?: string; value: number | null | undefined; d: number }) {
  // undefined = still loading; null = GitHub didn't give this number
  const shown: ReactNode = value === undefined ? <span className="act__ph"></span> : value === null ? '—' : big(value);
  return (
    <li className="act__card act__stat" style={{ '--d': d } as CSSProperties} title={hint}>
      <span className="act__statIcon">{STAT_ICONS[k]}</span>
      <span className="act__statNum">{shown}</span>
      <span className="act__label">{label}{value === null && <span className="sr"> (not available)</span>}</span>
    </li>
  );
}

/* ---------- The heatmap ---------- */
interface Cell extends ContributionDay { i: number; col: number }

function Calendar({ weeks, summary, tip }: { weeks: ContributionDay[][]; summary: Summary; tip: MiniTipApi }) {
  const { days, cols, months, rows } = useMemo(() => {
    const cells: Cell[] = [];
    weeks.forEach((w, col) => w.forEach((d) => cells.push({ ...d, i: cells.length, col })));
    // Month labels: above the first week that contains the 1st of a month
    const months: { col: number; label: string }[] = [];
    let lastCol = -9;
    weeks.forEach((w, c) => {
      const firstOfMonth = w.find((d) => d.date.endsWith('-01'));
      const isStart = c === 0 && day(w[0].date).getUTCDate() <= 7;
      if ((firstOfMonth || isStart) && c - lastCol >= 3 && c <= weeks.length - 2) {
        months.push({ col: c, label: fmtMonth.format(day((firstOfMonth || w[0]).date)) });
        lastCol = c;
      }
    });
    // Cells, row by row (row = weekday, column = week) so the grid reads like a table
    const rows: Cell[][] = Array.from({ length: 7 }, () => []);
    cells.forEach((c) => rows[c.weekday].push(c));
    return { days: cells, cols: weeks.length, months, rows };
  }, [weeks]);

  const [current, setCurrent] = useState(days.length - 1);   // the one square in the Tab order (today, at first)
  const [active, setActive] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const cellEl = (i: number) => gridRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? null;
  const tipText = (k: number) => `${plural(days[k].count)} · ${fmtTip.format(day(days[k].date))}`;

  // Narrow screens: the year is wider than the box → it scrolls sideways inside it, starting at today
  useLayoutEffect(() => {
    const s = scrollerRef.current!;
    s.scrollLeft = s.scrollWidth;
  }, []);

  const activate = (i: number, el: HTMLElement) => { setActive(i); tip.show(el, tipText(i)); };
  const deactivate = (i: number, el: HTMLElement | null) => { setActive((a) => (a === i ? null : a)); tip.hide(el); };

  // A tap / click anywhere else lets go of the highlighted square
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      const a = activeRef.current;
      if (a !== null && !gridRef.current?.contains(e.target as Node)) deactivate(a, cellEl(a));
    };
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('pointerdown', onDown); tip.hide(); };
  }, [tip]);   // deactivate / cellEl only use refs + setters

  function moveTo(k: number) {
    k = Math.max(0, Math.min(days.length - 1, k));
    setCurrent(k);
    const cell = cellEl(k)!;
    cell.focus({ preventScroll: true });
    // keep it visible inside the sideways-scrolling box (not the page)
    const scroller = scrollerRef.current!;
    const cr = cell.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
    if (cr.left < sr.left + 30) scroller.scrollLeft -= sr.left + 30 - cr.left;
    else if (cr.right > sr.right - 8) scroller.scrollLeft += cr.right - (sr.right - 8);
    tip.show(cell, tipText(k));
  }

  const cellOf = (t: EventTarget | null) => ((t as Element | null)?.closest?.('.act__cell') as HTMLElement | null) ?? null;
  const idx = (el: HTMLElement) => Number(el.dataset.i);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 } as Record<string, number>)[e.key];
    if (step) { e.preventDefault(); moveTo(current + step); }
    else if (e.key === 'Home') { e.preventDefault(); moveTo(0); }
    else if (e.key === 'End') { e.preventDefault(); moveTo(days.length - 1); }
    else if (e.key === 'Escape') tip.hide();
  };

  return (
    <div className="act__heat">
      <h3 className="sr" id="ghTitle">Contributions, day by day</h3>
      <div className="act__scroll scroll-thin" ref={scrollerRef} onScroll={() => tip.hide()}>
        <div className="act__cal" style={{ '--cols': cols } as CSSProperties}>
          <div className="act__months" aria-hidden="true">
            {months.map((m) => <span key={m.col} style={{ gridColumn: `${m.col + 1} / span 3` }}>{m.label}</span>)}
          </div>
          <div className="act__wd" aria-hidden="true"><span style={{ gridRow: 2 }}>Mon</span><span style={{ gridRow: 4 }}>Wed</span><span style={{ gridRow: 6 }}>Fri</span></div>
          <div
            className="act__cells" role="grid" aria-labelledby="ghTitle" aria-describedby="ghRange ghKeys" ref={gridRef}
            onKeyDown={onKeyDown}
            onFocus={(e) => { const c = cellOf(e.target); if (c) { setCurrent(idx(c)); activate(idx(c), c); } }}
            onBlur={(e) => { const c = cellOf(e.target); if (c && !gridRef.current?.contains(e.relatedTarget as Node | null)) deactivate(idx(c), c); }}
            onPointerOver={(e: PointerEvent) => { if (e.pointerType !== 'mouse') return; const c = cellOf(e.target); if (c) activate(idx(c), c); }}
            onPointerOut={(e: PointerEvent) => {
              if (e.pointerType !== 'mouse') return;
              const c = cellOf(e.target);
              if (c && !c.contains(e.relatedTarget as Node | null) && document.activeElement !== c) deactivate(idx(c), c);
            }}
            onPointerDown={(e: PointerEvent) => { if (e.pointerType !== 'mouse') tap.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={(e: PointerEvent) => {
              if (e.pointerType === 'mouse' || !tap.current) return;
              const moved = Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 8;     // it was a scroll, not a tap
              tap.current = null;
              const c = cellOf(e.target);
              if (!moved && c) activate(idx(c), c);
            }}
          >
            {rows.map((r, w) => (
              <div className="act__row" role="row" key={w}>
                {r.map((d) => <DayCell key={d.i} d={d} focusable={d.i === current} active={d.i === active} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="act__heatFoot">
        <span id="ghRange">{fmtShort.format(day(summary.from))} – {fmtShort.format(day(summary.to))}</span>
        <span className="act__legend" aria-hidden="true">Less <i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i> More</span>
        <span className="sr" id="ghKeys">Use the arrow keys to move between days.</span>
      </div>
    </div>
  );
}

// ~370 squares: only the ones whose focus / highlight changes re-render
const DayCell = memo(function DayCell({ d, focusable, active }: { d: Cell; focusable: boolean; active: boolean }) {
  return (
    <span
      className={`act__cell${active ? ' is-active' : ''}`} role="gridcell" tabIndex={focusable ? 0 : -1} data-i={d.i} data-l={d.level}
      style={{ gridColumn: d.col + 1, gridRow: d.weekday + 1 }}
      aria-label={`${plural(d.count)} on ${fmtLong.format(day(d.date))}`}
    ></span>
  );
});

/* ---------- Contributions by month ---------- */
function MonthBars({ summary, tip }: { summary: Summary; tip: MiniTipApi }) {
  const { months } = summary;
  const max = Math.max(0, ...months.map((m) => m.count));
  const top = max > 0 ? months.reduce((a, b) => (b.count >= a.count ? b : a)) : null;   // the latest busiest month
  const [current, setCurrent] = useState(months.length - 1);
  const listRef = useRef<HTMLOListElement>(null);
  const barEl = (i: number) => listRef.current?.children[i] as HTMLElement | undefined;
  const text = (m: MonthTotal) => `${plural(m.count)} · ${monthLabel(m)}`;

  useEffect(() => () => tip.hide(), [tip]);

  const moveTo = (k: number) => {
    k = Math.max(0, Math.min(months.length - 1, k));
    setCurrent(k);
    barEl(k)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: 1, ArrowDown: -1 } as Record<string, number>)[e.key];
    if (step) { e.preventDefault(); moveTo(current + step); }
    else if (e.key === 'Home') { e.preventDefault(); moveTo(0); }
    else if (e.key === 'End') { e.preventDefault(); moveTo(months.length - 1); }
    else if (e.key === 'Escape') tip.hide();
  };

  return (
    <div className="act__monthly">
      <div className="act__monthlyHead">
        <h3 className="act__label" id="actMonthsTitle">Contributions by month</h3>
        {top && <span className="act__top">Busiest: <b>{fmtMonth.format(day(top.first))}</b> · {nf.format(top.count)}</span>}
      </div>
      <ol className="act__bars" aria-labelledby="actMonthsTitle" ref={listRef} onKeyDown={onKeyDown} style={{ '--n': months.length } as CSSProperties}>
        {months.map((m, i) => (
          <li
            key={m.key} className={`act__bar${m.count === 0 ? ' is-zero' : ''}`} tabIndex={i === current ? 0 : -1}
            aria-label={`${monthLabel(m)}: ${plural(m.count).toLowerCase()}`}
            style={{ '--h': max ? m.count / max : 0, '--i': i } as CSSProperties}
            onFocus={(e) => { setCurrent(i); tip.show(e.currentTarget, text(m)); }}
            onBlur={(e) => tip.hide(e.currentTarget)}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') tip.show(e.currentTarget, text(m)); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse' && document.activeElement !== e.currentTarget) tip.hide(e.currentTarget); }}
            onClick={(e) => tip.show(e.currentTarget, text(m))}
          >
            <span className="act__barTrack" aria-hidden="true"><span className="act__barFill"></span></span>
            <span className="act__barLabel" aria-hidden="true">{fmtMonth.format(day(m.first))}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
