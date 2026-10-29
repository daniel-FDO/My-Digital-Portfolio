/* =========================================================
   ACTIVITY — one compact card with two sources, one at a time:
   GitHub contributions | Claude Code tokens. They're different
   measures, so they're never added together or drawn on one scale.
   The card: a switcher (tabs) with the source's status, a few
   figures, the source's heatmap of the last 12 months, and a quiet
   month strip underneath.

   GitHub   — /api/github-contributions (lib/github.js): the server asks
              GitHub with a token from .env and caches the answer for an
              hour; this page never sees the token. github-config.json.
   Claude   — /api/claude-usage (lib/claude-usage.js): daily token totals
              published by a collector on Daniel's computer
              (scripts/claude-usage-sync.mjs, which runs ccusage). Only
              numbers per day — never prompts, conversations or code.
              Re-asked every 5 minutes while the section is on screen.
              "Live" = the collector ran in the last 30 minutes; otherwise
              the badge says when it last did.

   States (per source):
     loading     → quiet placeholders
     ready       → the real numbers and when they're from
     unavailable → says so (never made-up squares; an error is never
                   shown as zero). Claude: "not connected" when no data
                   has been published yet.
   Interaction:
     switcher    → Tab to it, ← / → (Home / End) change the source
     heatmap     → hover / tap / focus: a tooltip with the date and the
                   exact count. Keyboard: Tab in once, then the arrow keys.
     month strip → hover / focus: the month's exact total; click / Enter
                   picks the month: the figures cover only that month and
                   the rest of the heatmap fades. Click it again (or "All
                   months") to go back. The month carries over when you
                   switch source — both cover the same period.
   ========================================================= */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import CONFIG from '../../../github-config.json';
import type { ClaudeUsage, ContributionDay, Contributions, GithubConfig } from '../../types';
import { loadContributions } from '../../lib/github';
import { loadClaudeUsage, UsageUnavailable } from '../../lib/claudeUsage';
import { NewTab } from '../icons';
import { SKILL_ICONS } from '../../data/skill-icons';
import { useMiniTip, type MiniTipApi } from './MiniTip';
import { summarise, type MonthTotal, type Summary } from './stats';

const C: GithubConfig = CONFIG;
const locale = C.locale || 'en-GB';
// Dates are calendar days ("2026-10-04") → read and print them in UTC so they never shift a day
const day = (s: string) => new Date(s + 'T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtLong = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtTip = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
const fmtMonthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const nf = new Intl.NumberFormat(locale);
const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How each source names its counts: exact (tooltips, screen readers) and short (labels) */
interface Unit { exact: (n: number) => string; short: (n: number) => string }
const CONTRIBUTIONS: Unit = {
  exact: (n) => (n === 0 ? 'No contributions' : `${nf.format(n)} contribution${n === 1 ? '' : 's'}`),
  short: (n) => nf.format(n),
};
const TOKENS: Unit = {
  exact: (n) => (n === 0 ? 'No tokens' : `${nf.format(n)} token${n === 1 ? '' : 's'}`),
  short: (n) => (n >= 10000 ? compact.format(n) : nf.format(n)),
};
const monthLabel = (m: MonthTotal) => fmtMonthYear.format(day(m.first))
  + (m.partial ? ` (${fmtDayMonth.format(day(m.first))} – ${fmtDayMonth.format(day(m.last))})` : '');

function ago(isoTime: string, verb = 'Updated') {
  const min = Math.round((Date.now() - Date.parse(isoTime)) / 60000);
  if (!Number.isFinite(min)) return null;
  if (min < 1) return `${verb} just now`;
  if (min < 60) return `${verb} ${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${verb} ${h} h ago` : `${verb} ${fmtShort.format(new Date(isoTime))}`;
}

const GitHubMark = () => (
  <svg className="act__mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
);
// Claude's mark: the Simple Icons path the Skills section already uses, in Claude's colour
const ClaudeMark = () => (
  <svg className="act__mark act__mark--claude" viewBox="0 0 24 24" aria-hidden="true"><path d={SKILL_ICONS.claude[1]} /></svg>
);
const Arrow = () => <svg className="act__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>;

type GhLoad = { state: 'loading' } | { state: 'ready'; data: Contributions } | { state: 'unavailable' };
type ClLoad = { state: 'loading' } | { state: 'ready'; data: ClaudeUsage; offline?: boolean } | { state: 'not-configured' } | { state: 'unavailable' };
type Source = 'gh' | 'cl';
interface Status { text: string; fresh: boolean; title?: string }

const REFRESH_MS = 5 * 60 * 1000;
const SOURCES: Source[] = ['gh', 'cl'];

function ghStatus(load: GhLoad): Status {
  if (load.state !== 'ready') return { text: load.state === 'loading' ? 'Loading' : 'Unavailable', fresh: false };
  const d = load.data;
  return { text: d.stale ? 'Cached copy' : (ago(d.fetchedAt) ?? 'From GitHub'), fresh: !d.stale };
}
function clStatus(load: ClLoad): Status {
  if (load.state === 'loading') return { text: 'Loading', fresh: false };
  if (load.state === 'not-configured') return { text: 'Not connected', fresh: false };
  if (load.state === 'unavailable') return { text: 'Unavailable', fresh: false };
  const u = load.data, title = `Collector last ran ${new Date(u.collectedAt).toLocaleString(locale)}`;
  if (load.offline) return { text: 'Offline · ' + (ago(u.collectedAt, 'synced') ?? ''), fresh: false, title };
  const fresh = u.live && !u.stale;
  return { text: fresh ? (ago(u.collectedAt, 'Live · synced') ?? 'Live') : (ago(u.collectedAt, 'Last synced') ?? 'Not live'), fresh, title };
}

export function Activity() {
  const rootRef = useRef<HTMLElement>(null);
  const [gh, setGh] = useState<GhLoad>({ state: 'loading' });
  const [cl, setCl] = useState<ClLoad>({ state: 'loading' });
  const [source, setSource] = useState<Source>('gh');
  const [month, setMonth] = useState<string | null>(null);   // "2026-07" → figures + heatmap narrowed to it
  const [seen, setSeen] = useState(false);        // on screen once → the entrance plays
  const [, setTick] = useState(0);                // re-render now and then so "n min ago" stays true
  const [tip, tipPortal] = useMiniTip();
  const tabRefs = useRef<Record<Source, HTMLButtonElement | null>>({ gh: null, cl: null });

  // Fetch when the section is getting close; Claude's numbers are asked again every 5 minutes
  // while the section is on screen and the tab is visible
  useEffect(() => {
    let gone = false, near = false, timer = 0;
    const askClaude = () => {
      loadClaudeUsage()
        .then((data) => { if (!gone) setCl({ state: 'ready', data }); })
        .catch((err: unknown) => {
          if (gone) return;
          const reason = err instanceof UsageUnavailable ? err.reason : 'unavailable';
          // a failed refresh keeps the numbers already shown (marked offline); the first failure says why
          setCl((prev) => (prev.state === 'ready' ? { ...prev, offline: true } : { state: reason }));
        });
    };
    const loop = () => {
      clearTimeout(timer);
      if (!near || document.hidden) return;
      timer = window.setTimeout(() => { askClaude(); setTick((n) => n + 1); loop(); }, REFRESH_MS);
    };
    let first = true;
    const obs = new IntersectionObserver((entries) => {
      near = entries[0].isIntersecting;
      if (near && first) {
        first = false;
        loadContributions()
          .then((data) => { if (!gone) setGh({ state: 'ready', data }); })
          .catch(() => { if (!gone) setGh({ state: 'unavailable' }); });
        askClaude();
      }
      loop();
    }, { rootMargin: '800px 0px' });
    obs.observe(rootRef.current!);
    const onVis = () => { if (!document.hidden && near && !first) { askClaude(); setTick((n) => n + 1); } loop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { gone = true; clearTimeout(timer); obs.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setSeen(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(rootRef.current!);
    return () => obs.disconnect();
  }, []);

  const ghData = gh.state === 'ready' ? gh.data : null;
  const ghSummary = useMemo(() => (ghData ? summarise(ghData.weeks.flat()) : null), [ghData]);
  // the Claude heatmap covers the same days as GitHub's (or the last 12 months, if GitHub isn't there)
  const range = ghSummary ? { from: ghSummary.from, to: ghSummary.to } : null;

  const status = source === 'gh' ? ghStatus(gh) : clStatus(cl);

  const pick = (s: Source) => { tip.hide(); setSource(s); };
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = SOURCES.indexOf(source);
    const next = ({ ArrowLeft: SOURCES[(i + 1) % 2], ArrowRight: SOURCES[(i + 1) % 2], Home: 'gh', End: 'cl' } as Record<string, Source>)[e.key];
    if (!next) return;
    e.preventDefault();
    pick(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className={`sec act is-${gh.state === 'loading' && cl.state === 'loading' ? 'loading' : 'ready'}${seen ? ' is-in' : ''}`} id="activity" aria-labelledby="activityTitle" ref={rootRef}>
      <div className="sec__head">
        <h2 className="h" id="activityTitle">Activity</h2>
        <a className="sec__link" href={C.profileUrl} target="_blank" rel="noopener noreferrer">GitHub<NewTab /></a>
      </div>
      <p className="act__desc">The last 12 months, day by day: contributions on GitHub and tokens used in Claude Code — two separate measures, shown one at a time.</p>

      <div className={`act__card${source === 'cl' ? ' is-cl' : ''}`}>
        <div className="act__tools">
          <div className="act__tabs" role="tablist" aria-label="Activity source" onKeyDown={onTabKey}>
            {SOURCES.map((s) => (
              <button
                key={s} type="button" role="tab" id={`actTab-${s}`} className="act__tab"
                aria-selected={source === s} aria-controls={`actPanel-${s}`} tabIndex={source === s ? 0 : -1}
                ref={(el) => { tabRefs.current[s] = el; }} onClick={() => pick(s)}
              >
                {s === 'gh' ? <GitHubMark /> : <ClaudeMark />}
                <span>{s === 'gh' ? 'GitHub' : 'Claude Code'}</span>
                <span className="act__tabUnit">{s === 'gh' ? 'contributions' : 'tokens'}</span>
              </button>
            ))}
          </div>
          <span className={`act__badge${status.fresh ? ' is-fresh' : ''}`} role="status" title={status.title}>{status.text}</span>
          {source === 'gh' ? (
            <a className="act__view" href={C.profileUrl} target="_blank" rel="noopener noreferrer">@{ghData?.username ?? C.username}<Arrow /><NewTab /></a>
          ) : (
            <span className="act__view act__view--note">Local daily totals</span>
          )}
        </div>

        <div className="act__panel" role="tabpanel" id="actPanel-gh" aria-labelledby="actTab-gh" hidden={source !== 'gh'}>
          <GitHubPanel load={gh} summary={ghSummary} month={month} onMonth={setMonth} tip={tip} shown={source === 'gh'} />
        </div>
        <div className="act__panel act__claude" role="tabpanel" id="actPanel-cl" aria-labelledby="actTab-cl" hidden={source !== 'cl'}>
          <ClaudePanel load={cl} range={range} month={month} onMonth={setMonth} tip={tip} shown={source === 'cl'} />
        </div>
      </div>
      {tipPortal}
    </section>
  );
}

interface PanelProps { month: string | null; onMonth: (m: string | null) => void; tip: MiniTipApi; shown: boolean }

function Unavailable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="act__empty" role="status">
      <p className="act__emptyTitle">{title}</p>
      <p className="act__muted">{children}</p>
    </div>
  );
}
const Skeleton = () => <div className="act__skeleton" aria-hidden="true"><i></i><i></i></div>;

function Fig({ label, value, title }: { label: string; value: ReactNode; title: string }) {
  return <div><dt>{label}</dt><dd title={title}>{value}</dd></div>;
}

/* ---------- GitHub ---------- */
function GitHubPanel({ load, summary, ...rest }: PanelProps & { load: GhLoad; summary: Summary | null }) {
  if (load.state === 'unavailable') {
    return <Unavailable title="Unavailable right now.">GitHub didn't answer, so there are no numbers to show here. Nothing is estimated.</Unavailable>;
  }
  if (load.state !== 'ready' || !summary) return <Skeleton />;
  return (
    <Overview
      {...rest} idp="gh" unit={CONTRIBUTIONS} weeks={load.data.weeks} summary={summary}
      calendarTitle="Contributions, day by day"
      figures={(cells, s) => {
        const active = cells.filter((d) => d.count > 0).length;
        const b = s.busiest;
        return (
          <dl className="act__nums">
            <Fig label="Contributions" value={nf.format(s.total)} title={CONTRIBUTIONS.exact(s.total)} />
            <Fig label="Active days" value={nf.format(active)} title={`${nf.format(active)} of ${nf.format(cells.length)} days`} />
            <Fig label="Longest streak" value={<>{nf.format(s.longestStreak)}<small> {s.longestStreak === 1 ? 'day' : 'days'}</small></>} title={`${nf.format(s.longestStreak)} days in a row with at least one contribution`} />
            <Fig
              label={b ? `Best day · ${fmtDayMonth.format(day(b.date))}` : 'Best day'}
              value={b ? nf.format(b.count) : '—'}
              title={b ? `${CONTRIBUTIONS.exact(b.count)} on ${fmtLong.format(day(b.date))}` : 'No contributions'}
            />
          </dl>
        );
      }}
    />
  );
}

/* ---------- Claude Code ---------- */
/** Claude's days laid out like GitHub's calendar: weeks Sunday → Saturday, levels by quartile */
function claudeWeeks(usage: ClaudeUsage, range: { from: string; to: string } | null) {
  const byDate = new Map(usage.days.map((d) => [d.date, d]));
  // the same period as GitHub's, or the last 12 months ending on the latest day the collector saw
  const end = range ? day(range.to) : day(usage.days.at(-1)?.date ?? iso(new Date()));
  const start = range ? day(range.from) : new Date(end.getTime() - 364 * 864e5);
  const totals = usage.days.filter((d) => d.date >= iso(start) && d.date <= iso(end) && d.total > 0).map((d) => d.total).sort((a, b) => a - b);
  // GitHub-style intensity: the non-zero days split into four equal groups
  const q = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))] ?? Infinity;
  const cut = [q(0.25), q(0.5), q(0.75)];
  const level = (n: number): ContributionDay['level'] => (n <= 0 ? 0 : n < cut[0] ? 1 : n < cut[1] ? 2 : n < cut[2] ? 3 : 4);
  const weeks: ContributionDay[][] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 864e5) {
    const d = new Date(t), date = iso(d), weekday = d.getUTCDay();
    if (!weeks.length || weekday === 0) weeks.push([]);
    const total = byDate.get(date)?.total ?? 0;
    weeks[weeks.length - 1].push({ date, weekday, count: total, level: level(total) });
  }
  return weeks;
}

function ClaudePanel({ load, range, ...rest }: PanelProps & { load: ClLoad; range: { from: string; to: string } | null }) {
  const usage = load.state === 'ready' ? load.data : null;
  const weeks = useMemo(() => (usage ? claudeWeeks(usage, range) : null), [usage, range]);
  const summary = useMemo(() => (weeks ? summarise(weeks.flat()) : null), [weeks]);

  if (load.state === 'not-configured') {
    return <Unavailable title="Not connected yet.">Token usage appears here once the local collector has published it. Nothing is estimated.</Unavailable>;
  }
  if (load.state === 'unavailable') {
    return <Unavailable title="Unavailable right now.">The usage data couldn't be loaded, so there are no numbers to show. Nothing is estimated.</Unavailable>;
  }
  if (!usage || !weeks || !summary) return <Skeleton />;
  return (
    <Overview
      {...rest} idp="cl" unit={TOKENS} weeks={weeks} summary={summary}
      calendarTitle="Claude Code tokens, day by day"
      figures={(cells, s) => {
        const inScope = usage.days.filter((d) => d.date >= s.from && d.date <= s.to);
        const sum = (k: 'input' | 'output' | 'cacheWrite' | 'cacheRead') => inScope.reduce((n, d) => n + d[k], 0);
        const active = cells.filter((d) => d.count > 0).length;
        const input = sum('input'), output = sum('output'), cache = sum('cacheWrite') + sum('cacheRead');
        return (
          <>
            <dl className="act__nums">
              <Fig label="Total tokens" value={TOKENS.short(s.total)} title={TOKENS.exact(s.total)} />
              <Fig label="Input" value={TOKENS.short(input)} title={TOKENS.exact(input)} />
              <Fig label="Output" value={TOKENS.short(output)} title={TOKENS.exact(output)} />
              <Fig label="Active days" value={nf.format(active)} title={`${nf.format(active)} of ${nf.format(cells.length)} days`} />
            </dl>
            <p className="act__note">Total includes {TOKENS.short(cache)} cache reads and writes.</p>
          </>
        );
      }}
    />
  );
}

/* ---------- One source: scope line, figures, heatmap, month strip ---------- */
function Overview({ idp, unit, weeks, summary, calendarTitle, figures, month, onMonth, tip, shown }: PanelProps & {
  idp: Source; unit: Unit; weeks: ContributionDay[][]; summary: Summary; calendarTitle: string;
  figures: (cells: ContributionDay[], s: Summary) => ReactNode;
}) {
  // the month only applies if this source's period has it
  const m = summary.months.find((x) => x.key === month) ?? null;
  const scope = useMemo(() => {
    const all = weeks.flat();
    const cells = m ? all.filter((d) => d.date.startsWith(m.key)) : all;
    return { cells, s: summarise(cells) };
  }, [weeks, m]);

  return (
    <>
      <div className="act__scope">
        <p className="act__label" aria-live="polite"><span className="sr">Showing </span>{m ? monthLabel(m) : 'Last 12 months'}</p>
        {m && <button type="button" className="act__reset" onClick={() => onMonth(null)}>All months<span aria-hidden="true"> ×</span></button>}
      </div>
      {figures(scope.cells, scope.s)}
      <Calendar idp={idp} title={calendarTitle} weeks={weeks} summary={summary} unit={unit} tip={tip} month={m?.key ?? null} shown={shown} />
      <MonthStrip idp={idp} summary={summary} unit={unit} tip={tip} selected={m?.key ?? null} onSelect={onMonth} />
    </>
  );
}

/* ---------- The heatmap ---------- */
interface Cell extends ContributionDay { i: number; col: number }

function Calendar({ idp, title, weeks, summary, unit, tip, month, shown }: { idp: string; title: string; weeks: ContributionDay[][]; summary: Summary; unit: Unit; tip: MiniTipApi; month: string | null; shown: boolean }) {
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
  const tipText = (k: number) => `${unit.exact(days[k].count)} · ${fmtTip.format(day(days[k].date))}`;

  // When the year is wider than the card it scrolls sideways inside it: to the picked month,
  // or to today. (A hidden panel has no width, so this waits until it's shown.)
  useLayoutEffect(() => {
    const s = scrollerRef.current;
    if (!s || !shown) return;
    const first = month ? days.find((d) => d.date.startsWith(month)) : null;
    if (!first) { s.scrollLeft = s.scrollWidth; return; }
    const el = cellEl(first.i);
    if (!el) return;
    const left = s.scrollLeft + el.getBoundingClientRect().left - s.getBoundingClientRect().left - 32;
    s.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
    // the square in the Tab order moves into the picked month
    setCurrent((c) => (days[c]?.date.startsWith(month!) ? c : first.i));
  }, [month, shown, days]);

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
    <div className={`act__heat${month ? ' is-filtered' : ''}`}>
      <h3 className="sr" id={`${idp}Title`}>{title}</h3>
      <div className="act__scroll scroll-thin" ref={scrollerRef} onScroll={() => tip.hide()}>
        <div className="act__cal" style={{ '--cols': cols } as CSSProperties}>
          <div className="act__months" aria-hidden="true">
            {months.map((m) => <span key={m.col} style={{ gridColumn: `${m.col + 1} / span 3` }}>{m.label}</span>)}
          </div>
          <div className="act__wd" aria-hidden="true"><span style={{ gridRow: 2 }}>Mon</span><span style={{ gridRow: 4 }}>Wed</span><span style={{ gridRow: 6 }}>Fri</span></div>
          <div
            className="act__cells" role="grid" aria-labelledby={`${idp}Title`} aria-describedby={`${idp}Range ${idp}Keys`} ref={gridRef}
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
                {r.map((d) => <DayCell key={d.i} d={d} unit={unit} focusable={d.i === current} active={d.i === active} dim={!!month && !d.date.startsWith(month)} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="act__heatFoot">
        <span id={`${idp}Range`}>{fmtShort.format(day(summary.from))} – {fmtShort.format(day(summary.to))}</span>
        <span className="act__legend" aria-hidden="true">Less <i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i> More</span>
        <span className="sr" id={`${idp}Keys`}>Use the arrow keys to move between days.</span>
      </div>
    </div>
  );
}

// ~370 squares: only the ones whose focus / highlight / fade changes re-render
const DayCell = memo(function DayCell({ d, unit, focusable, active, dim }: { d: Cell; unit: Unit; focusable: boolean; active: boolean; dim: boolean }) {
  return (
    <span
      className={`act__cell${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}`} role="gridcell" tabIndex={focusable ? 0 : -1} data-i={d.i} data-l={d.level}
      style={{ gridColumn: d.col + 1, gridRow: d.weekday + 1 }}
      aria-label={`${unit.exact(d.count)} on ${fmtLong.format(day(d.date))}`}
    ></span>
  );
});

/* ---------- Month strip: a total per month, and the month filter ---------- */
function MonthStrip({ idp, summary, unit, tip, selected, onSelect }: { idp: string; summary: Summary; unit: Unit; tip: MiniTipApi; selected: string | null; onSelect: (m: string | null) => void }) {
  const { months } = summary;
  const max = Math.max(0, ...months.map((m) => m.count));
  const top = max > 0 ? months.reduce((a, b) => (b.count >= a.count ? b : a)) : null;   // the latest busiest month
  const sel = months.findIndex((m) => m.key === selected);
  const [current, setCurrent] = useState(sel >= 0 ? sel : months.length - 1);
  const listRef = useRef<HTMLDivElement>(null);
  const barEl = (i: number) => listRef.current?.children[i] as HTMLElement | undefined;
  const text = (m: MonthTotal) => `${unit.exact(m.count)} · ${monthLabel(m)}`;

  useEffect(() => () => tip.hide(), [tip]);

  const moveTo = (k: number) => {
    k = Math.max(0, Math.min(months.length - 1, k));
    setCurrent(k);
    barEl(k)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: 1, ArrowDown: -1 } as Record<string, number>)[e.key];
    if (step) { e.preventDefault(); moveTo(current + step); }
    else if (e.key === 'Home') { e.preventDefault(); moveTo(0); }
    else if (e.key === 'End') { e.preventDefault(); moveTo(months.length - 1); }
    else if (e.key === 'Escape') { tip.hide(); if (selected) onSelect(null); }
  };

  return (
    <div className="act__monthly">
      <div className="act__monthlyHead">
        <h3 className="act__label" id={`${idp}MonthsTitle`}>By month</h3>
        {top && <span className="act__top" title={unit.exact(top.count)}>Busiest: <b>{fmtMonth.format(day(top.first))}</b> · {unit.short(top.count)}</span>}
      </div>
      <div
        className={`act__bars${selected ? ' has-pick' : ''}`} role="group" aria-labelledby={`${idp}MonthsTitle`} aria-describedby={`${idp}MonthsKeys`}
        ref={listRef} onKeyDown={onKeyDown} style={{ '--n': months.length } as CSSProperties}
      >
        {months.map((m, i) => (
          <button
            key={m.key} type="button" className={`act__bar${m.count === 0 ? ' is-zero' : ''}`} tabIndex={i === current ? 0 : -1}
            aria-pressed={m.key === selected} aria-label={`${monthLabel(m)}: ${unit.exact(m.count).toLowerCase()}`}
            style={{ '--h': max ? m.count / max : 0, '--i': i } as CSSProperties}
            onFocus={(e) => { setCurrent(i); tip.show(e.currentTarget, text(m)); }}
            onBlur={(e) => tip.hide(e.currentTarget)}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') tip.show(e.currentTarget, text(m)); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse' && document.activeElement !== e.currentTarget) tip.hide(e.currentTarget); }}
            onClick={(e) => { setCurrent(i); onSelect(m.key === selected ? null : m.key); tip.show(e.currentTarget, text(m)); }}
          >
            <span className="act__barTrack" aria-hidden="true"><span className="act__barFill"></span></span>
            <span className="act__barLabel" aria-hidden="true">{fmtMonth.format(day(m.first))}</span>
          </button>
        ))}
      </div>
      <span className="sr" id={`${idp}MonthsKeys`}>Select a month to show only its figures and days. Arrow keys move between months; Escape shows all months again.</span>
    </div>
  );
}
