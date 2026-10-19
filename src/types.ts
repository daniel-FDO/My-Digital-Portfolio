/* =========================================================
   TYPES — the shapes of the site's content and live data
   ========================================================= */

/** One project row (src/data/projects.json). In order: the first ones are
 *  the newest / most important. Everything was checked against the live
 *  site, its own copy or its repository (10 Oct 2026) — don't add outcomes
 *  or stacks that aren't verifiable. */
export interface Project {
  /** the project's name */
  name: string;
  /** a short label under the name */
  category: string;
  /** the live site (opens in a new tab) */
  url: string;
  /** the source code, ONLY where it's verified */
  repo?: string;
  /** its screenshot in public/previews/ (1440 × 900) */
  image?: string;
  /** the part of the screenshot that stays in view when cropped (CSS object-position) */
  focus?: string;
  /** false = don't let `npm run capture` replace the screenshot */
  capture?: boolean;
  /** what it does, in one plain sentence */
  description: string;
  /** at most two short supporting details */
  points?: string[];
  /** technologies, ONLY where verified */
  tech?: string[];
  /** also shown in the hero's preview */
  featured?: boolean;
  /** its motion preview (public/previews/video/, made by video/ — see video/README.md) */
  video?: string;
  /** that video's poster: shown while it loads, if it can't play, and for reduced motion */
  poster?: string;
}

/** [name, abbr, icon]: `icon` is one or more space-separated keys in
 *  skill-icons.ts or SkillIcon's own icons; `abbr` is the fallback tile. */
export type SkillItem = [name: string, abbr: string, icon: string];

export interface SkillGroup {
  group: string;
  /** groups with `learning` go in the right-hand column */
  learning?: 'now' | 'next';
  /** 'middle': a second column beside the first groups on wide screens */
  column?: 'middle';
  items: SkillItem[];
}

export interface Social {
  label: string;
  href: string;
}

export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** the object-position that keeps the face in its rounded frame */
  position: string;
}

export interface HomeData {
  location: string;
  /** the clock widget's zone */
  timeZone: string;
  email: string;
  aboutPhoto: Photo;
  skills: SkillGroup[];
  socials: Social[];
}

export interface Education {
  card: { title: string; text: string; button: string };
  panel: {
    eyebrow: string;
    heading: string;
    place: string;
    status: string;
    timeline: { label: string; current?: boolean }[];
    topics: { title: string; text: string }[];
    note: string;
  };
}

export interface GallerySlide {
  src: string;
  alt: string;
  position?: string;
  /** true = muted, looped, only plays while it's the front slide */
  video?: boolean;
}

export interface AboutPageData {
  hero: { label: string; title: string[] };
  gallery: GallerySlide[];
  facts: { label: string; lines: string[] }[];
  lore: { heading: [string, string, string]; caption: string };
  chapters: { num: string; title: string; paragraphs: string[] }[];
  footer: {
    heading: string[];
    text: string;
    cta: { label: string; href: string };
    links: { label: string; href: string; external?: boolean }[];
  };
}

export interface GithubConfig {
  username: string;
  profileUrl: string;
  heading: string;
  cacheMinutes: number;
  locale: string;
}

/* ---------- Live data (from our own /api endpoints) ---------- */

/** /api/now-playing (lib/spotify.js) */
export interface NowPlaying {
  isPlaying: boolean;
  state?: 'playing' | 'paused' | 'last';
  title: string | null;
  artist: string | null;
  albumArt: string | null;
  songUrl: string | null;
  playedAt?: string | null;
  stale?: boolean;
  /** added in the browser: when this answer arrived */
  seenAt?: string;
}

export type MusicState = 'playing' | 'paused' | 'last' | 'none' | 'loading';

export interface ContributionDay {
  date: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

/** Counts from the GitHub profile; null = GitHub didn't give that number */
export interface GithubProfile {
  followers: number | null;
  publicRepos: number | null;
  /** stars on the public repositories the account owns */
  stars: number | null;
}

/** /api/github-contributions (lib/github.js) */
export interface Contributions {
  username: string;
  /** missing in answers cached before it was added */
  profile?: GithubProfile;
  total: number;
  from: string;
  to: string;
  weeks: ContributionDay[][];
  fetchedAt: string;
  stale?: boolean;
}

export type Theme = 'light' | 'dark';
