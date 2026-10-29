/* =========================================================
   X-RAY — what each part of the home page is, where its data
   comes from, how often it refreshes and what it does when that
   fails. Read by the X-ray tile and inspect mode (components/xray/).

   Every entry is taken from the code itself (the comments and
   behaviour of the file in `file`). If something can't be checked
   in the code, leave the field out rather than guess.

   An entry is shown on the element with the matching data-xray="id".
   `file` must be a UI file under src/ — sourceUrl() refuses
   anything else (api/, server.js, scripts, env, token or config
   files are never linked).
   ========================================================= */

export const SOURCE_REPO_URL = 'https://github.com/daniel-FDO/My-Digital-Portfolio/blob/main/';

/** Where data comes from, counted once each in "N parts · M data sources" */
export type SourceKey = 'spotify' | 'open-meteo' | 'github' | 'claude-usage' | 'git' | 'site-data';

export interface XrayFact {
  /** a word or two, for the tag */
  short: string;
  /** a sentence, for the panel */
  detail: string;
}

export interface XrayEntry {
  /** matches data-xray="…" on the element */
  id: string;
  /** what it is, in plain words */
  label: string;
  /** the React component that draws it */
  component: string;
  /** its component file, relative to the repo root (under src/) */
  file: string;
  dataSource?: XrayFact & { sources: SourceKey[] };
  refresh?: XrayFact;
  fallback?: string;
}

const STATIC: XrayFact = { short: 'static', detail: 'Built into the page; it changes when the site is redeployed.' };

export const XRAY: XrayEntry[] = [
  /* ---- Hero tiles (components/widgets/) ---- */
  {
    id: 'music',
    label: 'What I’m listening to on Spotify',
    component: 'Music',
    file: 'src/components/widgets/Music.tsx',
    dataSource: { short: 'Spotify', detail: 'This site’s /api/now-playing endpoint, which asks Spotify server-side. Only the title, artist and album art reach the page.', sources: ['spotify'] },
    refresh: { short: '10 s', detail: 'Every 10 seconds while the tab is visible, and straight away when you come back to it.' },
    fallback: 'If a request fails, the last known track stays, shown as paused or recently played, never as playing. With nothing known: “Not available right now” and an Open Spotify link.',
  },
  {
    id: 'now',
    label: 'Kent right now: the time, date, weather and the sun',
    component: 'KentNow',
    file: 'src/components/widgets/KentNow.tsx',
    dataSource: { short: 'Open-Meteo', detail: 'Open-Meteo’s forecast for Canterbury (free, no key; nothing about the visitor is sent). The time is UK time from the visitor’s clock.', sources: ['open-meteo'] },
    refresh: { short: '30 min', detail: 'Weather every 30 minutes while the tab is visible; the clock every second.' },
    fallback: 'If Open-Meteo doesn’t answer, the last good weather stays; with none, the weather and the sun arc just don’t show.',
  },
  {
    id: 'gh',
    label: 'GitHub contributions, the last 16 weeks',
    component: 'GitHubTile',
    file: 'src/components/widgets/Tiles.tsx',
    dataSource: { short: 'GitHub', detail: 'This site’s /api/github-contributions endpoint (GitHub’s GraphQL API, token kept server-side). The same request feeds the Activity section.', sources: ['github'] },
    refresh: { short: 'per visit', detail: 'Asked once per page load; the server keeps an answer for an hour.' },
    fallback: '“Activity unavailable right now.” No squares are made up. If GitHub fails, the server sends its last real answer, marked stale.',
  },
  {
    id: 'name',
    label: '“Hello, I’m Daniel.” with Daniel the character',
    component: 'DanielTile',
    file: 'src/components/widgets/DanielTile.tsx',
  },
  {
    id: 'xray',
    label: 'This tile: the X-ray switch and a map of the grid',
    component: 'XrayTile',
    file: 'src/components/widgets/XrayTile.tsx',
    dataSource: { short: 'xray.ts', detail: 'The manifest in src/data/xray.ts.', sources: ['site-data'] },
    refresh: STATIC,
  },

  /* ---- Sections ---- */
  {
    id: 'intro',
    label: 'Name, role, “Currently” and the email address',
    component: 'Intro',
    file: 'src/components/Intro.tsx',
    dataSource: { short: 'git', detail: 'Words from src/data/home.ts. “Last recorded update” is the latest commit’s date, read when the site is built.', sources: ['site-data', 'git'] },
    refresh: { short: 'per build', detail: 'The date is fixed at build time; the “days ago” is worked out on each visit.' },
    fallback: 'Without git at build time, the “Last recorded update” line isn’t shown.',
  },
  {
    id: 'projects',
    label: 'The project list, with a video preview',
    component: 'ProjectShowcase',
    file: 'src/components/ProjectShowcase.tsx',
    dataSource: { short: 'projects.json', detail: 'src/data/projects.json; the previews in public/previews/.', sources: ['site-data'] },
    refresh: STATIC,
    fallback: 'If a preview video can’t load or play, its poster stays.',
  },
  {
    id: 'about',
    label: 'About: photo, three chapters and interests',
    component: 'AboutSection',
    file: 'src/components/AboutSection.tsx',
    dataSource: { short: 'about.ts', detail: 'src/data/about.ts and home.ts.', sources: ['site-data'] },
    refresh: STATIC,
  },
  {
    id: 'education',
    label: 'Education: the course, opening to its details',
    component: 'Education',
    file: 'src/components/Education.tsx',
    dataSource: { short: 'education.ts', detail: 'src/data/education.ts.', sources: ['site-data'] },
    refresh: STATIC,
  },
  {
    id: 'skills',
    label: 'Skills and tools, and what I’m learning',
    component: 'Skills',
    file: 'src/components/Skills.tsx',
    dataSource: { short: 'home.ts', detail: 'The groups in src/data/home.ts; brand marks from skill-icons.ts.', sources: ['site-data'] },
    refresh: STATIC,
  },
  {
    id: 'gallery',
    label: 'Photo carousel',
    component: 'Gallery',
    file: 'src/components/Gallery.tsx',
    dataSource: { short: 'gallery.ts', detail: 'src/data/gallery.ts; the photos in public/images/gallery/.', sources: ['site-data'] },
    refresh: STATIC,
    fallback: 'If the carousel can’t start, a plain scrolling strip of the same photos shows instead.',
  },
  {
    id: 'activity',
    label: 'GitHub contributions and Claude Code tokens, day by day',
    component: 'Activity',
    file: 'src/components/activity/Activity.tsx',
    dataSource: { short: 'GitHub + Claude', detail: 'GitHub: the same request as the GitHub tile. Claude Code: /api/claude-usage, daily token totals published by a collector on Daniel’s computer (numbers only).', sources: ['github', 'claude-usage'] },
    refresh: { short: '5 min', detail: 'GitHub once per visit. Claude Code every 5 minutes while the section is on screen and the tab is visible.' },
    fallback: '“Unavailable” or “Not connected” instead of numbers; nothing is estimated. A failed Claude refresh keeps the numbers already shown, marked offline.',
  },
  {
    id: 'faq',
    label: 'Questions people ask',
    component: 'Faq',
    file: 'src/components/Faq.tsx',
    dataSource: { short: 'written in', detail: 'Written in Faq.tsx, from what the site already says.', sources: ['site-data'] },
    refresh: STATIC,
  },
  {
    id: 'contact',
    label: 'A “new message” window',
    component: 'Contact',
    file: 'src/components/Contact.tsx',
    dataSource: { short: 'home.ts', detail: 'The address from src/data/home.ts. Nothing is sent from this site: Send opens your own email app.', sources: ['site-data'] },
    refresh: STATIC,
    fallback: 'It’s a real mailto: form, so it still opens your email app if the page’s script doesn’t run.',
  },
];

/* Only component / UI files under src/ are linked — never the server, scripts or config */
const NEVER = /(^|\/)(api|scripts|lib)\/|server\.js|get-token|\.env|token|config|secret/i;

/** The file on GitHub, or null if it isn't a UI file that may be linked */
export function sourceUrl(file: string): string | null {
  if (!file.startsWith('src/') || NEVER.test(file) || !/\.(tsx?|css)$/.test(file)) return null;
  return SOURCE_REPO_URL + file;
}

/** "13 parts · 6 data sources" */
export function xrayCounts(list: XrayEntry[] = XRAY) {
  const sources = new Set(list.flatMap((e) => e.dataSource?.sources ?? []));
  return { parts: list.length, sources: sources.size };
}

/** "Music · Spotify · 10 s" */
export const tagText = (e: XrayEntry) => [e.component, e.dataSource?.short, e.refresh?.short].filter(Boolean).join(' · ');
