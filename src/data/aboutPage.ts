/* =========================================================
   ABOUT PAGE — YOUR WORDS (edit here)
   The full About page (src/folder/AboutPage.tsx), reached from the
   home page's About links or secret.html?folder=about.
   Each section is a label (left column on wide screens) and a few
   short paragraphs. Keep it true: no invented details.
   (The home page's own About section uses about.ts.)
   ========================================================= */

export const ABOUT = {
  label: 'About',
  heading: 'A little more about me.',
  intro: [
    'I’m Daniel, a software development student based in Kent. I’m in my second year at EKC Canterbury College, studying T‑Level Digital Software Development, and I’m due to finish in summer 2027.',
    'I enjoy working on interfaces and figuring out why things aren’t working. At the moment, I’m learning React and TypeScript through my own projects.',
  ],
  portrait: {
    src: 'images/about/portrait.jpg',
    alt: 'Daniel Fasan in a black T-shirt, looking down at the camera against a pale grey background',
    width: 1000,
    height: 1000,
    position: '55% 22%',
    caption: ['Daniel Fasan', 'Kent, UK'],
  },

  story: {
    heading: 'How I got here',
    text: [
      'Gaming was one of the things that got me interested in computers. I liked figuring out how things worked, especially when something stopped working and needed fixing.',
      'In 2023, I made my first portfolio using HTML and Notepad. Later, looking around different colleges and courses helped me decide to study software development.',
    ],
    // The optional note under the story (a native <details>)
    firstSite: {
      summary: 'My first website — 2023',
      text: 'It was simple: HTML typed into Notepad and opened in a browser. But watching something I’d written turn into an actual website made me want to keep learning.',
    },
  },

  now: {
    heading: 'At the moment',
    text: [
      'My course covers planning, building and testing software, and I work on my own projects alongside it. I’ve used HTML, CSS, Python and Flask, and I’ve worked with data in Pandas. Right now I’m learning more JavaScript, React, TypeScript and Tailwind CSS, mostly by using them in projects, and I’m exploring UI/UX design.',
    ],
    projectsLabel: 'Two things I’ve built',
    // Descriptions and links from src/data/projects.json
    projects: [
      {
        name: 'Porchlight Support Finder',
        text: 'A support site that helps people find shelters, food banks and other local services.',
        url: 'https://porchlightwebproj.netlify.app/',
      },
      {
        name: 'Blueprint',
        text: 'A CV builder with editable templates, a live preview and PDF export.',
        url: 'https://blueprint-vwig.onrender.com/',
      },
    ],
  },

  // Two real photos from the gallery (src/data/gallery.ts: photo-06, photo-07)
  photos: [
    {
      src: 'images/gallery/photo-06.webp',
      alt: 'A curved monitor on a desk showing a grid of hand-gesture photos next to code, with a keyboard and mouse in front',
      width: 480,
      height: 640,
      position: '50% 42%',
    },
    {
      src: 'images/gallery/photo-07.webp',
      alt: 'A lecture theatre screen showing the talk title "Do Androids Dream of Electric People?" by Daryll Scott, Author, Consultant & Coach, above an audience',
      width: 480,
      height: 640,
      position: '50% 50%',
    },
  ],

  outside: {
    heading: 'Outside of coding',
    text: [
      'Outside of college and my own projects, I spend time gaming, listening to music and following Liverpool. I also enjoy design, which is probably why this site keeps changing. More recently I’ve started learning a little about trading, very much as a beginner.',
    ],
  },

  ahead: {
    heading: 'Looking ahead',
    text: [
      'After I finish college in summer 2027, I’m considering university or a degree apprenticeship. I haven’t decided yet. The areas I’d most like to explore further are front-end development, UI/UX design and cybersecurity.',
    ],
    links: {
      projects: { label: 'See my projects', href: 'index.html#projects', id: 'projects' },
      contact: { label: 'Get in touch', href: 'index.html#contact', id: 'contact' },
    },
  },
};
