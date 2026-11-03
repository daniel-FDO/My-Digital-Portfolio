/* =========================================================
   GALLERY — the photos as a fan of cards
   (photos: data/gallery.ts; the fan itself: fan-gallery/)
   - Equal-size cards on a gentle curve, opening like a swatch book
     when the section scrolls into view (once).
   - Hover or focus a card: it lifts, straightens and comes forward,
     and its neighbours slide aside so it's fully visible.
     ← → / Home / End move between cards, Esc lets go.
   - Click / Enter on a card opens it flat and whole in a preview
     above the page (gallery/Preview.tsx).
   - Reduced motion is handled inside the fan (no springs).
   ========================================================= */
import { useState } from 'react';
import { GALLERY } from '../data/gallery';
import { FanGallery } from './fan-gallery/fan-gallery';
import { Preview } from './gallery/Preview';

const two = (n: number) => String(n).padStart(2, '0');
const ITEMS = GALLERY.map(({ src, alt }) => ({ src, alt }));

export function Gallery() {
  const n = GALLERY.length;
  const [preview, setPreview] = useState<{ i: number; opener: HTMLElement | null } | null>(null);

  return (
    <section className="sec gal" id="gallery" aria-labelledby="galleryTitle" data-xray="gallery">
      <div className="sec__head">
        <h2 className="h" id="galleryTitle">Gallery</h2>
        <span className="gal__edition" aria-hidden="true">Photos / {two(n)}</span>
      </div>

      <FanGallery
        className="gal__fan"
        ariaLabel="Photos"
        items={ITEMS}
        cardWidth={162}
        aspectRatio={0.8}
        spacing={0.69}
        curve={0.14}
        tilt={14.5}
        lift={42}
        spread={0.2}
        stackFrom="left"
        speed={0.7}
        stagger={0.09}
        bounce={0.35}
        hoverSpeed={0.28}
        radius={18}
        entrance="stack"
        trigger="scroll"
        viewportStart={75}
        once
        showTitle={false}
        onOpen={(i, card) => setPreview({ i, opener: card })}
      />

      {preview && (
        <Preview photos={GALLERY} start={preview.i} opener={preview.opener} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
