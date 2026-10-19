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
];
