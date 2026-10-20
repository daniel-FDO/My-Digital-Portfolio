/* =========================================================
   HOME PAGE — the words that aren't already in another data file.
   Everything here is taken from what the site already said
   (about.ts, education.ts, the old Skills list and contact
   section) — don't add claims that aren't true.
   Other content comes from:
     projects.json       — Projects (+ the hover screenshots)
     education.ts        — Education
     about.ts            — About rows (open the About page)
     github-config.json  — Activity
   ========================================================= */
import type { HomeData, Project } from '../types';
import projects from './projects.json';

export const PROJECTS: Project[] = projects;

/** The intro (name, role, "Currently") — also used by the command menu's answers */
export const INTRO = {
  name: 'Daniel Fasan',
  role: 'Software development student',
  study: 'Second-year T-Level Digital Software Development student at EKC Canterbury College. Finishing summer 2027.',
  learning: 'Currently learning React and TypeScript.',
};

export const SPOTIFY_PROFILE = 'https://open.spotify.com/user/313dgijnrcg4vwkwuuryvr4wqfb4?si=e403baac359541ba';

export const HOME: HomeData = {
  location: 'Kent, UK',
  timeZone: 'Europe/London',   // the clock widget
  email: 'danielfash2007@gmail.com',

  // About: the portrait beside the timeline (600 × 706). `position` is
  // the object-position that keeps the face in its 4:5 rounded frame.
  // (The About page's own gallery is about.ts.)
  aboutPhoto: {
    src: 'images/interests/me-card.webp',
    alt: 'Daniel Fasan, head-and-shoulders portrait against a pale background: curly afro, short beard, black T-shirt',
    width: 600, height: 706,
    position: '62% 50%',
  },

  // Skills & tools: the old Skills section, plus what the About page says
  // I'm sharpening (Python, Flask, Pandas) and learning (Tailwind, TypeScript).
  // Each item: [name, abbr, icon]. `icon` is one or more keys (space-separated)
  // in skill-icons.ts (brand marks) or SkillIcon's OWN_ICONS; `abbr` is only the
  // fallback tile if an icon is missing. Groups with `learning` go in the
  // right-hand column; `column: 'middle'` ones sit beside the first groups on
  // wide screens (below them on narrower ones). Each skill appears once.
  skills: [
    { group: 'Frontend', items: [['HTML', 'H', 'html'], ['CSS', 'C', 'css'], ['Tailwind CSS', 'Tw', 'tailwind'], ['Responsive design', '↔', 'responsive']] },
    { group: 'Python & data', items: [['Python', 'Py', 'python'], ['Flask', 'F', 'flask'], ['Pandas', 'Pd', 'pandas']] },
    { group: 'Tools', items: [['VS Code', 'VS', 'vscode'], ['Git & GitHub', 'G', 'git github'], ['Chrome DevTools', 'Dt', 'chrome'], ['Antigravity', 'A', 'Antigravity']] },
    // Stitch and Lovable have no published brand mark in Simple Icons: their letter tile shows instead
    { group: 'Design', column: 'middle', items: [['Figma', 'F', 'figma'], ['Canva', 'C', 'canva'], ['Stitch', 'St', 'stitch'], ['Lovable', 'Lv', 'lovable']] },
    { group: 'AI tools', column: 'middle', items: [['Claude', 'Cl', 'claude'], ['ChatGPT', 'GP', 'chatgpt'], ['Notion', 'N', 'notion'], ['Gemini', 'G', 'gemini']] },
    { group: 'Currently learning', learning: 'now', items: [['React', 'R', 'react'], ['TypeScript', 'TS', 'ts'], ['JavaScript', 'JS', 'js']] },
    { group: 'Learning next', learning: 'next', items: [['Node.js', 'N', 'node'], ['UI/UX design', 'UI', 'uiux'], ['Motion graphics', 'Mo', 'motion']] },
  ],

  socials: [
    { label: 'GitHub', href: 'https://github.com/daniel-FDO' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/daniel-fasan-a0b503331/' },
    { label: 'Instagram', href: 'https://www.instagram.com/d4ni3lllll__?stkn=Y2Y0Njk3NjczeW91&utm_source=qr' },
    { label: 'Spotify', href: SPOTIFY_PROFILE },
  ],
};
