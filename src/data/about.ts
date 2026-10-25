/* =========================================================
   ABOUT — the short version, for the home page's About section
   and the command menu's answers:
     facts    — quick facts (the "Exploring" line becomes tags)
     chapters — the three short chapters on the home timeline
   The full About page has its own words: aboutPage.ts.
   ========================================================= */
import type { AboutPageData } from '../types';

export const ABOUT_PAGE: AboutPageData = {
  facts: [
    { label: 'Based in', lines: ['Kent, UK'] },
    { label: 'Studying at', lines: ['EKC Canterbury College'] },
    { label: 'Exploring', lines: ['Cybersecurity · UI/UX', 'Front-end development · AI'] },
  ],


  chapters: [
    {
      num: '01',
      title: 'Right now',
      paragraphs: [
        'I’m Daniel, a software development student based in Kent. I’m in my second year at EKC Canterbury College and due to finish in summer 2027.',
        'I use HTML, CSS, Python and Flask, and I’m learning more JavaScript, React, TypeScript and Tailwind CSS. I’m most comfortable working with data in Pandas.',
        'I enjoy designing interfaces and figuring out why something isn’t working. I also use AI tools to help with development, then work through the code to understand it.',
      ],
    },
    {
      num: '02',
      title: 'How it started',
      paragraphs: [
        'Gaming got me interested in computers. I also liked fixing small technical problems and wanted to learn how to make my own websites and apps.',
        'I built my first portfolio in 2023 using HTML and Notepad.',
        'Visiting sixth forms and colleges helped me decide to study software development.',
      ],
    },
    {
      num: '03',
      title: 'Where I’m heading',
      paragraphs: [
        'After college, I’m considering university or an apprenticeship. I’m interested in cybersecurity, UI/UX design and front-end development.',
        'I want to get more confident with React, JavaScript, CSS, Python and TypeScript by using them in my projects.',
        'Outside my coursework, I’m learning about trading and gradually improving my computer setup.',
      ],
    },
  ],

};
