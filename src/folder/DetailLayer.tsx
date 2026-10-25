/* The folder view's layer over the home page (logic: useFolderView.ts).
   Each folder, once opened, stays mounted (hidden) so it keeps its state. */
import { useEffect } from 'react';
import { FolderPage } from './FolderPage';
import type { FolderView } from './useFolderView';

export function DetailLayer({ view, menuOpen }: { view: FolderView; menuOpen: boolean }) {
  const { shown, mounted, layerRef, back, isOpen } = view;

  // Esc closes it (not while the command menu is on top)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && shown && !menuOpen) back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, shown, menuOpen, back]);

  return (
    <div className="fp detail" id="detail" ref={layerRef} hidden={!shown} data-lenis-prevent>
      <header className="top">
        <button type="button" className="back btn btn--utility" id="detailBack" onClick={back}>Back</button>
        <span className="logo">daniel<span>.</span></span>
      </header>
      <div id="detailViews">
        {mounted.map((k) => <FolderPage key={k} folderKey={k} scroller={layerRef} hidden={k !== shown} onLeave={back} />)}
      </div>
    </div>
  );
}
