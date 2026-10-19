/* =========================================================
   GALLERY — YOUR PHOTOS (edit here)
   Used by the home page's Gallery section (Gallery.tsx), in this order.
     src      — a file in public/ (e.g. public/images/gallery/…)
     alt      — what the photo shows, for screen readers
     width / height — the file's pixel size (keeps the layout steady)
     position — CSS object-position: the part that stays in view when
                the card crops the photo (e.g. '50% 30%' = keep the top)
     caption  — optional; only add what's true about the photo
   ========================================================= */
export interface GalleryPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  position?: string;
  caption?: string;
}

export const GALLERY: GalleryPhoto[] = [
  {
    src: 'images/gallery/photo-01.webp',
    alt: 'A tall granite obelisk behind black iron railings, beside a river at low tide, under a blue sky with white clouds',
    width: 1200,
    height: 1600,
    position: '50% 40%',
  },
  {
    src: 'images/gallery/photo-02.webp',
    alt: 'A small group of people talking on a gravel path between two large plane trees, with the obelisk and a city skyline across the river behind them',
    width: 1200,
    height: 1600,
    position: '50% 58%',
  },
  {
    src: 'images/gallery/photo-03.webp',
    alt: 'Turquoise apartment buildings with rounded ends and porthole windows, reflected in a puddle on a wet road beside a yellow "TAXI" road marking',
    width: 480,
    height: 640,
    position: '50% 40%',
  },
  {
    src: 'images/gallery/photo-04.webp',
    alt: 'Sunlit open water seen past a metal railing, with a long low city skyline under a sky of big white clouds',
    width: 480,
    height: 640,
    position: '50% 45%',
  },
  {
    src: 'images/gallery/photo-05.webp',
    alt: 'A British Airways plane parked at an airport terminal across a stretch of blue water, with tower blocks and construction cranes behind',
    width: 480,
    height: 640,
    position: '50% 35%',
  },
  {
    src: 'images/gallery/photo-06.webp',
    alt: 'A curved monitor on a desk showing a grid of hand-gesture photos next to code, with a keyboard and mouse in front',
    width: 480,
    height: 640,
    position: '50% 40%',
  },
  {
    src: 'images/gallery/photo-07.webp',
    alt: 'A lecture theatre screen showing the talk title "Do Androids Dream of Electric People?" by Daryll Scott, Author, Consultant & Coach, above an audience',
    width: 480,
    height: 640,
    position: '50% 45%',
  },
  {
    src: 'images/gallery/photo-08.webp',
    alt: 'A speaker in army uniform presenting a slide titled "Finding Jimmy: The Technical Leader" to students in a lecture theatre',
    width: 480,
    height: 640,
    position: '50% 40%',
  },
  {
    src: 'images/gallery/photo-09.webp',
    alt: 'A speaker presenting "The Art of Influence" in a lecture theatre, beside an Aspiration Digital banner, with students watching',
    width: 480,
    height: 640,
    position: '50% 40%',
  },
  {
    src: 'images/gallery/photo-10.webp',
    alt: 'A screen reading "Thank you to our sponsors" with the sponsors\' logos, including the University of Kent and the Army, at the end of a talk',
    width: 480,
    height: 640,
    position: '50% 35%',
  },
  {
    src: 'images/gallery/photo-11.webp',
    alt: 'A keynote slide, "Creating value through your story: how to sell yourself in your career", with the speaker at the front of a lecture theatre',
    width: 480,
    height: 640,
    position: '50% 40%',
  },
];
