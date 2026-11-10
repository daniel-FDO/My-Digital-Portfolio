/* =========================================================
   EDUCATION — "My Studies": all of its words, in one place.
   Education.tsx builds the home page's Education row from this
   (the row opens to show the details).
     card     — the card's heading, description and button (also the command menu's answer)
     panel    — the row: course, college, the year
       details  — what the row opens to show, label + line, in my own words
   ========================================================= */
import type { Education } from '../types';

export const EDUCATION: Education = {
  card: {
    title: 'My Studies',
    text: 'Second-year T-Level Digital Software Development student at EKC Canterbury College.',
    button: 'My learning journey',
  },
  panel: {
    eyebrow: 'CURRENT CHAPTER',
    heading: 'Digital Software Development',
    place: 'EKC Canterbury College',
    status: 'Year 2',
    details: [
      { label: 'Course', text: 'Planning, building and testing software.' },
      { label: 'Projects', text: 'I work on my own projects alongside my coursework.' },
      /* PLACEHOLDER: add a line of your own here, e.g. a part of the course you've enjoyed:
         { label: '…', text: '…' }, */
    ],
  },
};
