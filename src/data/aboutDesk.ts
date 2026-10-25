/* =========================================================
   ABOUT PAGE — "BEHIND THE SCREEN" (edit the words here)
   Every piece of text on the About desk (src/folder/about/)
   comes from this file, section by section, top to bottom.
   ========================================================= */

export const DESK = {
  name: 'Daniel Fasan',
  tagline: 'I build things. I break things. I figure out why.',
  meta: 'Software Development Student · Kent, UK',

  badge: {
    role: 'Software Development Student',
    line: 'Learning by building.',
    number: 'DF / 23 — 27',
    photo: { src: 'images/about/portrait.jpg', alt: 'Daniel Fasan', position: '55% 28%' },
    back: 'I’m a software development student based in Kent, currently in my second year at EKC Canterbury College.',
    valid: 'Valid until: summer 2027',
  },

  notepad: {
    title: 'first-portfolio.html — Notepad',
    label: '2023 — where it started.',
    code: [
      '<!DOCTYPE html>',
      '<html>',
      '  <head>',
      '    <title>My First Website</title>',
      '  </head>',
      '  <body>',
      '    <h1>Hello World!</h1>',
      '  </body>',
      '</html>',
    ],
    story: 'Back in 2023, I built my first portfolio using HTML and Notepad. It was simple, but watching something I’d written turn into an actual website made me want to keep learning.',
  },

  vinyl: {
    side: 'Side A',
    title: 'OFF THE CLOCK',
    sub: 'Football, gaming & everything else.',
    interests: [
      { name: 'Liverpool FC', note: 'YNWA.' },
      { name: 'Gaming', note: 'where it all started' },
      { name: 'Music', note: 'always on somewhere' },
      { name: 'Design', note: 'hence the redesigns' },
      { name: 'Learning about trading', note: 'still a beginner' },
    ],
  },

  ticket: { title: ['DESIGN', '×', 'DEVELOPMENT'], sub: 'Curious since 2023.' },

  terminal: {
    user: 'daniel@portfolio:~$',
    whoami: ['Software development student', 'Based in Kent, UK', 'Currently learning React', 'Interested in design and technology'],
  },

  // Real screenshots of my projects (public/previews)
  polaroids: [
    { src: 'previews/porchlight.jpg', alt: 'Screenshot of the Porchlight Support Finder website', caption: 'Made this.' },
    { src: 'previews/blueprint.jpg', alt: 'Screenshot of Blueprint, the CV builder', caption: 'Still improving.' },
    { src: 'previews/gallery.jpg', alt: 'Screenshot of my interactive gallery project', caption: 'Another redesign?' },
  ],

  intro: {
    note: 'Behind the screen: a collection of things that made me, me. Have a look around. Most things on this desk do something.',
    lines: [
      ['I like taking things apart to see ', 'how they work', ', then building something of my own.'],
      ['Right now that means ', 'learning React', ' and getting a little better with every project.'],
    ] as [string, string, string][],
  },

  origin: {
    heading: 'It started with curiosity.',
    note: 'Funny how a simple HTML file started all this.',
    artefacts: [
      {
        key: 'gaming',
        label: 'Gaming',
        title: 'The controller',
        text: 'Gaming was one of the things that first got me interested in computers. I also enjoyed figuring out why things stopped working and how to fix them.',
      },
      {
        key: '2023',
        label: '2023',
        title: 'first-portfolio.html',
        text: 'In 2023, I made my first portfolio with HTML and Notepad. It wasn’t anything fancy, but it was my first experience turning code into something I could actually see.',
      },
      {
        key: 'direction',
        label: 'Choosing a direction',
        title: 'The course leaflet',
        text: 'Exploring different colleges and courses helped me realise that software development was something I genuinely wanted to pursue.',
      },
    ],
  },

  making: {
    heading: 'Currently making things.',
    sub: 'Some finished. Some still being figured out.',
    projects: [
      {
        key: 'porchlight',
        name: 'Porchlight Support Finder',
        status: 'Live',
        text: 'A web project focused on helping people find support services across East Kent.',
        areas: ['Dover', 'Deal', 'Canterbury', 'Folkestone'],
        url: 'https://porchlightwebproj.netlify.app/',
        host: 'porchlightwebproj.netlify.app',
        image: 'previews/porchlight.jpg',
        alt: 'The Porchlight Support Finder home page',
        tone: 'kraft',
      },
      {
        key: 'blueprint',
        name: 'Blueprint',
        status: 'In development',
        text: 'A CV builder I’m working on to make creating a professional CV easier.',
        areas: [],
        url: 'https://blueprint-vwig.onrender.com/',
        host: 'blueprint-vwig.onrender.com',
        image: 'previews/blueprint.jpg',
        alt: 'Blueprint’s CV editor, still in development',
        tone: 'blue',
      },
    ] as const,
    learning: {
      heading: 'Currently learning...',
      items: ['React', 'JavaScript', 'TypeScript', 'Tailwind CSS', 'UI/UX design'],
      note: 'Trying to get better with every project.',
    },
    using: {
      file: 'already-using.txt',
      items: [
        ['HTML', 'structure'],
        ['CSS', 'layout + style'],
        ['Python', 'scripts + logic'],
        ['Flask', 'small web apps'],
        ['Pandas', 'working with data'],
      ] as [string, string][],
    },
  },

  future: {
    heading: 'The next chapter is still being written.',
    text: [
      'I’m studying software development at EKC Canterbury College and expect to finish in summer 2027.',
      'After that, I’m exploring university and degree apprenticeships. Both look interesting for different reasons.',
    ],
    paths: [
      {
        key: 'uni',
        title: 'UNIVERSITY',
        line: 'Keep studying. Explore computer science.',
        more: 'More time to go deep into computer science, and space to try the areas I’m curious about before settling on one.',
      },
      {
        key: 'apprenticeship',
        title: 'DEGREE APPRENTICESHIP',
        line: 'Learn on the job. Build real-world experience.',
        more: 'Working on real projects alongside people who do this every day, while still earning a degree. That combination appeals to me.',
      },
    ],
    ideas: ['Front-end development', 'Cybersecurity', 'UI/UX design', 'Software engineering'],
    note: 'Not everything has to be figured out yet.',
  },

  offline: {
    heading: 'When the laptop closes...',
    items: [
      { key: 'football', label: 'Liverpool FC match ticket', note: 'Liverpool supporter. That probably explains enough.' },
      { key: 'gaming', label: 'Game cartridge', note: 'Where the curiosity started. Still the best way to switch off.' },
      { key: 'music', label: 'Cassette tape', note: 'Music’s always on somewhere. Taste: still loading.' },
      { key: 'trading', label: 'Trading notebook', note: 'Learning how markets work. Very much still a beginner.' },
      { key: 'design', label: 'Design sketches and colour swatches', note: 'I’ve redesigned this portfolio more times than I care to admit.' },
    ],
  },

  ending: {
    heading: 'Still learning. Still building. Still curious.',
    text: 'I’m figuring things out one project at a time. This website is part of that process.',
    cta: 'Enough about me. See what I’ve built.',
    sign: '— Daniel',
    links: [
      { label: 'Email', href: 'mailto:danielfash2007@gmail.com' },
      { label: 'GitHub', href: 'https://github.com/daniel-FDO' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/daniel-fasan-a0b503331/' },
    ],
  },
};
