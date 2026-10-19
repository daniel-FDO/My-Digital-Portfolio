/* =========================================================
   FOLDER PAGES — the full story behind each folder
   Shared by two places, so the content lives once:
     • the home page — opens IN PLACE, over the page (DetailLayer.tsx)
     • secret.html — the stand-alone fallback page (SecretPage.tsx)
   ========================================================= */

/* ---------------------------------------------------------
   FOLDER PALETTE — the ONE place the folders' colours live.
   The folders look the same in BOTH site themes, so their text
   colours are fixed here — never the theme's --text.
     bg     — the card / header band       accent — that folder's small details
     ink    — main text                    ink2   — secondary text
     line   — hairline borders             tone   — 'dark' | 'light'
   --------------------------------------------------------- */
export interface FolderLook {
  color: string;
  accent: string;
  ink: string;
  ink2: string;
  line: string;
  tone: 'dark' | 'light';
}

export interface Folder extends FolderLook {
  num: string;
  tag: string;
  title: string;
  /** 'about' = a page with its own layout (AboutPage.tsx) */
  custom?: 'about';
  lead?: string;
  facts?: [label: string, value: string][];
  sections?: { heading: string; text: string }[];
}

const DARK = { ink: '#F1F0EC', ink2: '#B9B8B2', line: 'rgba(241, 240, 236, 0.13)', tone: 'dark' as const };
const look = (): FolderLook => ({ color: '#1c1c1a', accent: '#d4cfc6', ...DARK });

export const FOLDERS = {
  about: {
    num: '01', tag: 'ABOUT ME', title: "Hi, I'm Daniel",
    ...look(),
    // Its own page layout: AboutPage.tsx, content in about.ts
    custom: 'about',
  },
  education: {
    num: '02', tag: 'EDUCATION', title: 'My Studies',
    ...look(),
    lead: 'I’m in my second year of T-Level Digital Software Development at EKC Canterbury College.',
    facts: [['Course', 'Digital Software Development'], ['Where', 'EKC Canterbury College'], ['Next milestone', 'Summer 2027']],
    sections: [
      { heading: 'The course', text: 'Planning interfaces and applications, building them, then testing and troubleshooting what needs improving.' },
      { heading: 'Highlights', text: 'I work on practical projects alongside my coursework. After college, I’m considering university or an apprenticeship.' },
    ],
  },
  skills: {
    num: '03', tag: 'SKILLS', title: 'What I Can Do',
    ...look(),
    lead: 'These are the languages and tools I use, alongside the ones I’m still learning.',
    facts: [['Frontend', 'HTML · CSS · Tailwind CSS'], ['Python & data', 'Python · Flask · Pandas'], ['Tools', 'Git · GitHub · VS Code']],
    sections: [
      { heading: 'Strongest skills', text: 'Building responsive interfaces with HTML and CSS, working with Python and Flask, and exploring data with Pandas.' },
      { heading: 'Currently learning', text: 'React, TypeScript and JavaScript are my current focus. Next on the list: Node.js, UI/UX design and motion graphics.' },
    ],
  },
} satisfies Record<string, Folder>;

export type FolderKey = keyof typeof FOLDERS;

export const isFolderKey = (key: unknown): key is FolderKey =>
  typeof key === 'string' && Object.prototype.hasOwnProperty.call(FOLDERS, key);

/** The palette as CSS custom properties (for a card / band / page): --card, --ink, … */
export function lookStyle(folder: FolderLook): Record<string, string> {
  return {
    '--card': folder.color,
    '--ink': folder.ink,
    '--ink-2': folder.ink2,
    '--card-accent': folder.accent,
    '--card-line': folder.line,
  };
}
