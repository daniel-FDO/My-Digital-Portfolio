/* =========================================================
   SECRET PAGE — the stand-alone fallback for a folder's story.
   The home page normally opens folders IN PLACE (DetailLayer.tsx);
   this page is only used when that can't happen (e.g. a folder link
   opened in a new tab — the gate in secret.html sends visitors
   without a pass straight home).
   1. Show the folder from ?folder=…  (unknown → "about")
   2. Page transitions (enter / leave)
   ========================================================= */
import { useEffect, type MouseEvent } from 'react';
import { FOLDERS, isFolderKey } from './data/folders';
import { FolderPage } from './folder/FolderPage';
import { calm } from './lib/motion';

const param = new URLSearchParams(location.search).get('folder');
const key = isFolderKey(param) ? param : 'about';
const folder = FOLDERS[key];

export function SecretPage() {
  useEffect(() => {
    const body = document.body;
    body.style.setProperty('--card', folder.color);   // the veil + logo use the folder's colours too
    body.style.setProperty('--ink', folder.ink);
    document.title = `${folder.title} — daniel.`;

    // Enter: the page starts covered by the veil; two frames later (so the
    // starting state is drawn first) it fades away and the content rises in
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => body.classList.add('is-in')); });

    // Restored from memory with Back/Forward → the pass was used up, so leave again
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) location.replace('index.html'); };
    addEventListener('pageshow', onShow);
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); removeEventListener('pageshow', onShow); };
  }, []);

  // Leave: the veil grows back from the Back button, then we go back
  const back = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const goBack = () => {
      // Came from the home page in this tab → real "back" (keeps its state);
      // otherwise just open the home page
      let fromHome = false;
      try { fromHome = !!document.referrer && new URL(document.referrer).pathname.replace(/\/$/, '/index.html').endsWith('index.html'); } catch { /* bad referrer */ }
      if (fromHome && history.length > 1) history.back();
      else location.href = 'index.html';
    };
    if (calm()) { goBack(); return; }
    document.body.classList.add('is-out');
    setTimeout(goBack, 520);
  };

  return (
    <>
      {/* Covers the page in the card's colour, then shrinks away (enter)
          or grows back (leave). Animated with transform only. */}
      <div className="veil" id="veil" aria-hidden="true"></div>

      <header className="top">
        <a href="index.html" className="back btn btn--utility" id="back" onClick={back}>Back</a>
        <span className="logo">daniel<span>.</span></span>
      </header>

      <FolderPage folderKey={key} as="main" id="story" />
    </>
  );
}
