/* =========================================================
   EDUCATION — "My Studies": all of its words, in one place.
   Education.tsx builds the home page's Education row from this
   (the row opens to show the path, topics and note).
     card     — the card's heading, description and button
     panel    — the dashboard on the right
       timeline — the steps in order; current: true = highlighted
       topics   — the three tiles (title + short line)
   ========================================================= */
import type { Education } from '../types';

export const EDUCATION: Education = {
  card: {
    title: 'My Studies',
    text: 'Second-year T-Level Digital Software Development student at EKC Canterbury College, finishing in summer 2027.',
    button: 'My learning journey',
  },
  panel: {
    eyebrow: 'CURRENT CHAPTER',
    heading: 'Digital Software Development',
    place: 'EKC Canterbury College',
    status: 'Year 2',
    timeline: [
      { label: 'Foundations' },
      { label: 'Year 2', current: true },
      { label: 'Summer 2027' },
    ],
    topics: [
      { title: 'Plan', text: 'Ideas and problem-solving' },
      { title: 'Build', text: 'Interfaces and applications' },
      { title: 'Improve', text: 'Testing and troubleshooting' },
    ],
    note: 'Learning through practical projects.',
  },
};
