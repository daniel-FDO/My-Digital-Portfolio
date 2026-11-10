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

const ALL_ENTRIES: XrayEntry[] = [
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
    id: 'clock',
    label: 'The time in Kent, on an analog face',
    component: 'ClockTile',
    file: 'src/components/widgets/ClockTile.tsx',
    dataSource: { short: 'your clock', detail: 'UK time worked out from the visitor’s own clock (lib/kentClock.ts); nothing is fetched.', sources: ['site-data'] },
    refresh: { short: '1 s', detail: 'Every second, from one shared timer that only runs while the clock is on the page.' },
  },
  {
    id: 'mono',
    label: 'A D for Daniel, drawn in dots',
    component: 'MonogramTile',
    file: 'src/components/widgets/MonogramTile.tsx',
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
    label: 'Photo fan',
    component: 'Gallery',
    file: 'src/components/Gallery.tsx',
    dataSource: { short: 'gallery.ts', detail: 'src/data/gallery.ts; the photos in public/images/gallery/.', sources: ['site-data'] },
    refresh: STATIC,
    fallback: 'With reduced motion, the cards appear in place without the opening animation.',
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
    id: 'contact',
    label: 'A “new message” window',
    component: 'Contact',
    file: 'src/components/Contact.tsx',
    dataSource: { short: 'home.ts', detail: 'The address from src/data/home.ts. Nothing is sent from this site: Send opens your own email app.', sources: ['site-data'] },
    refresh: STATIC,
    fallback: 'It’s a real mailto: form, so it still opens your email app if the page’s script doesn’t run.',
  },

  /* ---- Navigation (fixed to the screen) ---- */
  {
    id: 'dock',
    label: 'The dock: search or ask, the current section, theme and back to top',
    component: 'DockBar',
    file: 'src/components/DockBar.tsx',
    dataSource: { short: 'the page', detail: 'Search opens the command menu (Ctrl K); the section button and the back-to-top ring follow your scrolling.', sources: ['site-data'] },
    refresh: { short: 'on scroll', detail: 'Back to top appears after 60% of a screen; scrolling down folds the search label (and on phones tucks the dock away) until you scroll up.' },
  },
];

export const XRAY: XrayEntry[] = ALL_ENTRIES;

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
