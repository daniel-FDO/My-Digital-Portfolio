/* =========================================================
   ABOUT PAGE — YOUR CONTENT (edit here)
   Used by AboutPage.tsx (the About folder, opened in place on the
   home page or on secret.html?folder=about) and the home page's
   About section. Everything on the page comes from this one object:
     hero     — the small label + the big title (one line per entry)
     gallery  — the photo/video slides, in order
     facts    — the three quick facts under the hero
     lore     — the "Okay, a little lore." heading + caption
     chapters — the numbered story on the right
     footer   — the dark "Got something in mind?" panel
   ========================================================= */
import type { AboutPageData } from '../types';

export const ABOUT_PAGE: AboutPageData = {
  hero: {
    label: '01 / ABOUT ME',
    title: ['HI, I’M', 'DANIEL'],
  },

  //   position — CSS object-position, so faces stay in the crop
  //   video    — true = muted, looped, only plays while it's the front slide
  gallery: [
    { src: 'images/about/portrait.jpg', alt: 'Daniel in a black T-shirt, looking down at the camera against a pale grey background', position: '55% 30%' },
    { src: 'images/about/anime.jpg', alt: 'Daniel drawn in an anime style, holding a backpack strap on a hillside above a lake', position: '50% 30%' },
    { src: 'images/about/blocky.jpg', alt: 'Daniel as a blocky, Minecraft-style figure holding up a glowing lantern', position: '45% 40%' },
    { src: 'images/about/cartoon.jpg', alt: 'Daniel as a 3D cartoon character, smiling and waving', position: '50% 30%' },
  ],

  facts: [
    { label: 'Based in', lines: ['Kent, UK'] },
    { label: 'Studying at', lines: ['EKC Canterbury College'] },
    { label: 'Exploring', lines: ['Cybersecurity · UI/UX', 'Front-end development · AI'] },
  ],

  lore: {
    heading: ['OKAY,', 'A LITTLE', 'LORE.'],
    caption: 'the short version',
  },

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

  footer: {
    heading: ['GOT SOMETHING', 'IN MIND?'],
    text: 'A project, an opportunity, or just a hello.',
    cta: { label: 'Let’s talk', href: 'mailto:danielfash2007@gmail.com' },
    links: [
      { label: 'Email', href: 'mailto:danielfash2007@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/daniel-FDO', external: true },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/daniel-fasan-a0b503331/', external: true },
    ],
  },
};
