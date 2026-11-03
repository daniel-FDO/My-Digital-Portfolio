/* =========================================================
   FIXED — THE BUG LOGBOOK (edit here)
   Read by the "Fixed" tile in the hero grid (widgets/FixedTile.tsx),
   in this order, one real bug per card.
     id       — unique, short (e.g. 'gallery-blank-on-safari')
     title    — the bug in a few words
     symptom  — what you saw go wrong
     cause    — what was actually behind it
     fix      — what you changed
     project  — optional: which project it was in
     repoUrl  — optional: a link to the fix (commit or PR); shows "View fix ↗"
     date     — optional: when, as 'YYYY-MM-DD'
   Only real bugs. An entry counts once title, symptom, cause and fix
   are all filled in; until at least one is, the tile doesn't show and
   the X-ray tile keeps its place.
   ========================================================= */
export interface FixedBug {
  id: string;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
  project?: string;
  repoUrl?: string;
  date?: string;
}

export const FIXED: FixedBug[] = [
  // TODO: a real bug you fixed (fill in title, symptom, cause and fix)
  { id: 'todo-1', title: '', symptom: '', cause: '', fix: '' },
  // TODO: a real bug you fixed
  { id: 'todo-2', title: '', symptom: '', cause: '', fix: '' },
  // TODO: a real bug you fixed
  { id: 'todo-3', title: '', symptom: '', cause: '', fix: '' },
];

const filled = (s: string | undefined) => !!s && s.trim().length > 0 && !/\bTODO\b/.test(s);

/** The entries that are complete enough to show */
export function completeBugs(list: FixedBug[] = FIXED): FixedBug[] {
  return list.filter((b) => filled(b.title) && filled(b.symptom) && filled(b.cause) && filled(b.fix));
}
