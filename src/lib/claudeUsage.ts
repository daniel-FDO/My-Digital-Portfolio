/* Claude Code token totals (/api/claude-usage, lib/claude-usage.js). The
   numbers come from a collector on Daniel's computer (ccusage), published
   as daily totals only. A failure says why: "not-configured" (no data has
   been connected yet) or "unavailable" (the server or the network failed). */
import type { ClaudeUsage } from '../types';

const ENDPOINT = '/api/claude-usage';

export class UsageUnavailable extends Error {
  constructor(public reason: 'not-configured' | 'unavailable') { super(reason); }
}

export async function loadClaudeUsage(): Promise<ClaudeUsage> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-cache' });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new UsageUnavailable(body?.reason === 'not-configured' ? 'not-configured' : 'unavailable');
    if (!body || !Array.isArray(body.days) || typeof body.collectedAt !== 'string') throw new UsageUnavailable('unavailable');
    return body as ClaudeUsage;
  } catch (err) {
    throw err instanceof UsageUnavailable ? err : new UsageUnavailable('unavailable');
  } finally {
    clearTimeout(timer);
  }
}
