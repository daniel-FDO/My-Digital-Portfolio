/* The summary numbers, all worked out from the same days the heatmap draws */
import type { ContributionDay } from '../../types';

export interface MonthTotal {
  /** "2026-07" */
  key: string;
  /** first and last day of this month that are inside the period */
  first: string;
  last: string;
  count: number;
  /** the period starts or ends partway through this month */
  partial: boolean;
}

export interface Summary {
  total: number;
  from: string;
  to: string;
  /** the most recent day with the highest count (null if every day is 0) */
  busiest: ContributionDay | null;
  /** the longest run of days in a row with at least one contribution */
  longestStreak: number;
  months: MonthTotal[];
}

const lastDayOfMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function summarise(days: ContributionDay[]): Summary {
  let total = 0, busiest: ContributionDay | null = null, run = 0, longestStreak = 0;
  const months: MonthTotal[] = [];
  for (const d of days) {
    total += d.count;
    if (d.count > 0 && (!busiest || d.count >= busiest.count)) busiest = d;
    run = d.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
    const key = d.date.slice(0, 7);
    const m = months[months.length - 1];
    if (m && m.key === key) { m.count += d.count; m.last = d.date; }
    else months.push({ key, first: d.date, last: d.date, count: d.count, partial: false });
  }
  for (const m of months) {
    m.partial = !m.first.endsWith('-01') || Number(m.last.slice(8)) !== lastDayOfMonth(m.key);
  }
  return { total, from: days[0].date, to: days[days.length - 1].date, busiest, longestStreak, months };
}
