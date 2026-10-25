/* =========================================================
   ABOUT PAGE — "Behind the screen": a desk of things that made
   me, me (content: data/aboutDesk.ts; pieces: folder/about/).
   1. The introductory desk        4. Where I'm heading
   2. The origin story             5. Away from the keyboard
   3. What's on my desk right now  6. The last page of the notebook
   Colours follow the site theme (about.css); nothing here keeps
   its own theme state.
   ========================================================= */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CursorLabel, DeskContext, useReveal } from './about/desk';
import { Hero } from './about/Hero';
import { NotepadDialog } from './about/Notepad';
import { Origin } from './about/Origin';
import { Making } from './about/Making';
import { Future } from './about/Future';
import { Offline } from './about/Offline';
import { Ending } from './about/Ending';

// The page's fonts: Caveat (handwriting) and Archivo's full weight range
// (the home page's folder view already asks for the same Archivo file)
const FONTS = [
  'https://fonts.googleapis.com/css2?family=Caveat:wght@500..700&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo:wdth,wght@62..125,500..900&display=swap',
];
function loadFonts() {
  FONTS.forEach((href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  });
}

interface Props {
  /** the element the page scrolls in (the home page's folder view) */
  scroller?: RefObject<HTMLElement | null>;
  /** closes the in-place view (home page only) */
  onLeave?: () => void;
}

export function AboutPage({ onLeave }: Props) {
  useEffect(loadFonts, []);
  const rootRef = useRef<HTMLDivElement>(null);
  const armed = useReveal(rootRef);
  const [notepad, setNotepad] = useState(false);
  const openNotepad = useCallback(() => setNotepad(true), []);
  const desk = useMemo(() => ({ openNotepad }), [openNotepad]);

  return (
    <DeskContext.Provider value={desk}>
      <div className={`dk${armed ? ' is-armed' : ''}`} ref={rootRef}>
        <CursorLabel root={rootRef} />
        <Hero />
        <Origin />
        <Making />
        <Future />
        <Offline />
        <Ending onLeave={onLeave} />
        <NotepadDialog open={notepad} onClose={() => setNotepad(false)} />
      </div>
    </DeskContext.Provider>
  );
}
