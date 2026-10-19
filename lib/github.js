/* =========================================================
   GITHUB — contribution calendar (server side only!)
   Used by server.js (on your computer) and api/github-contributions.js
   (when deployed to Vercel). The token comes ONLY from the environment
   (GITHUB_TOKEN in .env, or the host's settings) and is never sent to
   the browser or written to the logs.

   - Asks GitHub's GraphQL API for the real contribution calendar of the
     account in github-config.json (the last year, day by day) and, in
     the same request, its followers, public repositories and the stars
     on them.
   - Keeps a good answer for an hour (cacheMinutes) so visitors don't
     cause extra requests; 10 visitors at once → still only 1 request.
   - If GitHub fails, an older real answer is better than nothing (marked
     "stale"); with no answer at all → 503 and the page shows
     "unavailable". It never makes up data or reports an error as zero.
   ========================================================= */
const CONFIG = require('../github-config.json');

const API_URL = 'https://api.github.com/graphql';
const CACHE_MS = (CONFIG.cacheMinutes || 60) * 60 * 1000;
const TIMEOUT_MS = 8000;

let cached = null;    // { data, at } — the last good answer
let inFlight = null;  // the request in progress (shared by everyone waiting)

class GitHubError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;     // a short reason, safe to log (never a secret)
    this.status = status;
  }
}

// GitHub's level names → 0 … 4 (the same quartiles github.com uses for its colours)
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

// Public repositories the account owns (forks included, as on the profile page)
const REPOS = `repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, after: $cursor) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { stargazerCount }
    }`;

const QUERY = `query ($login: String!, $from: DateTime!, $to: DateTime!, $cursor: String) {
  user(login: $login) {
    followers { totalCount }
    ${REPOS}
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date weekday contributionCount contributionLevel } }
      }
    }
  }
}`;

// Only for accounts with more than 100 public repositories: the next pages of stars
const MORE_REPOS = `query ($login: String!, $cursor: String) {
  user(login: $login) {
    ${REPOS}
  }
}`;

async function ask(token, query, variables) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'daniel-portfolio',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new GitHubError('http-error', res.status);
  const json = await res.json();
  if (json.errors && json.errors.length) throw new GitHubError('graphql-error');
  return json.data && json.data.user;
}

/* ---- Ask GitHub (one request; more only past 100 repositories) ---- */
async function fetchCalendar() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubError('not-configured');

  // The last year, ending now (GitHub counts days in UTC)
  const to = new Date();
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  from.setUTCDate(from.getUTCDate() + 1);
  from.setUTCHours(0, 0, 0, 0);

  const user = await ask(token, QUERY, { login: CONFIG.username, from: from.toISOString(), to: to.toISOString(), cursor: null });
  const cal = user && user.contributionsCollection && user.contributionsCollection.contributionCalendar;
  if (!cal || !Array.isArray(cal.weeks)) throw new GitHubError('no-calendar');

  // Only what the page needs: weeks of { date, weekday, count, level }
  const weeks = cal.weeks.map((w) => w.contributionDays.map((d) => ({
    date: d.date,
    weekday: d.weekday,                        // 0 = Sunday … 6 = Saturday
    count: d.contributionCount,
    level: LEVELS[d.contributionLevel] ?? 0,
  }))).filter((w) => w.length);
  const days = weeks.flat();
  if (!days.length) throw new GitHubError('empty-calendar');

  // The total and the dates shown must describe exactly the days returned
  const sum = days.reduce((n, d) => n + d.count, 0);
  if (sum !== cal.totalContributions) console.warn(`[github] total ${cal.totalContributions} ≠ sum of days ${sum} — showing the sum of the displayed days`);

  return {
    username: CONFIG.username,
    profile: await readProfile(token, user),
    total: sum,
    from: days[0].date,
    to: days[days.length - 1].date,
    weeks,
    fetchedAt: new Date().toISOString(),
  };
}

/* Followers, public repositories and their stars. Counted from what GitHub
   returns; if a later page of repositories fails, there's no star count
   (null) rather than a partial one. */
async function readProfile(token, user) {
  const repos = user.repositories;
  const followers = user.followers ? user.followers.totalCount : null;
  if (!repos) return { followers, publicRepos: null, stars: null };
  let stars = repos.nodes.reduce((n, r) => n + (r.stargazerCount || 0), 0);
  let page = repos.pageInfo;
  try {
    for (let i = 0; page && page.hasNextPage && i < 10; i++) {
      const next = await ask(token, MORE_REPOS, { login: CONFIG.username, cursor: page.endCursor });
      const more = next && next.repositories;
      if (!more) throw new GitHubError('no-repositories');
      stars += more.nodes.reduce((n, r) => n + (r.stargazerCount || 0), 0);
      page = more.pageInfo;
    }
    if (page && page.hasNextPage) stars = null;     // more than 1,100 repositories: don't guess
  } catch (err) {
    console.warn('[github] stars: ' + (err.code || 'request-failed'));
    stars = null;
  }
  return { followers, publicRepos: repos.totalCount, stars };
}

/* ---- Cached: GitHub is asked at most once per cacheMinutes ---- */
async function getContributions() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (!inFlight) {
    inFlight = fetchCalendar()
      .then((data) => { cached = { data, at: Date.now() }; return data; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/* ---- The web handler (works in Express AND as a Vercel function) ---- */
async function handler(req, res) {
  try {
    const data = await getContributions();
    // browsers may keep it 10 minutes; a host like Vercel may keep it an hour
    send(res, 200, data, 'public, max-age=600, s-maxage=3600');
  } catch (err) {
    console.error('[github] ' + (err.code || 'request-failed') + (err.status ? ' (' + err.status + ')' : ''));
    if (cached) return send(res, 200, { ...cached.data, stale: true }, 'no-store');   // older, but real
    send(res, 503, { error: 'GitHub activity is unavailable right now.', reason: err.code === 'not-configured' ? 'not-configured' : 'unavailable' }, 'no-store');
  }
}

function send(res, status, body, cacheControl) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.end(JSON.stringify(body));
}

module.exports = { handler, getContributions, _fetchCalendar: fetchCalendar };
