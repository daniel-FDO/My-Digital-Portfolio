/* The GitHub data (/api/github-contributions), asked for once per page
   and shared by the GitHub widget and the Activity section. A slow
   answer (12s) counts as a failure; a failure can be tried again. */
import type { Contributions } from '../types';

const ENDPOINT = '/api/github-contributions';
let pending: Promise<Contributions> | null = null;

export function loadContributions(): Promise<Contributions> {
  if (pending) return pending;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  pending = fetch(ENDPOINT, { headers: { Accept: 'application/json' }, signal: controller.signal })
    .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json() as Promise<Contributions>; })
    .then((data) => {
      if (!data || !Array.isArray(data.weeks) || !data.weeks.flat().length) throw new Error('no data');
      return data;
    })
    .catch((err) => { pending = null; throw err; })
    .finally(() => clearTimeout(timer));
  return pending;
}
