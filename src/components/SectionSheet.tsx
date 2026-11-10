/* =========================================================
   SECTION SHEET — all nine sections in a native modal <dialog>,
   opened by the dock's section button when there's no rail (DockBar.tsx;
   styles: dock.css). The current section is marked
   (aria-current). Choosing one closes the sheet and goes there (focus
   moves to its heading); Esc, the backdrop or the close button close
   it and put focus back on the dock's section button.
   ========================================================= */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SECTIONS, two } from '../lib/sections';

/* the same icons as the rail (SectionNav.tsx) */
const ICONS: Record<string, ReactNode> = {
  intro: <path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" />,
  projects: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></>,
  about: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  education: <><path d="M22 9.5 12 4.5 2 9.5l10 5z" /><path d="M6 11.5v4.8c3.3 2.3 8.7 2.3 12 0v-4.8M22 9.5v5" /></>,
  skills: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />,
  gallery: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.7" /><path d="m21 15.5-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5 20" /></>,
  activity: <path d="M3 12h3.5l2.5-7 5 14 2.5-7H21" />,
  contact: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
};
const SectionIcon = ({ id }: { id: string }) => <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[id]}</svg>;

interface Props {
  active: number;
  onPick: (i: number) => void;
  /** close without choosing (Esc, backdrop, ×): focus goes back to the opener */
  onClose: () => void;
}

export function SectionSheet({ active, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    // start on the current section, so Tab / arrows carry on from where you are
    d.querySelector<HTMLButtonElement>('[aria-current]')?.focus();
    return () => { if (d.open) d.close(); };
  }, []);

  return createPortal(
    <dialog
      className="snav-sheet" id="sectionSheet" ref={ref} aria-labelledby="sectionSheetTitle"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}   // the backdrop
    >
      <div className="snav-sheet__head">
        <h2 className="snav-sheet__title" id="sectionSheetTitle">Sections</h2>
        <button type="button" className="snav-sheet__close" aria-label="Close sections" onClick={onClose}>×</button>
      </div>
      <ol className="snav-sheet__list">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <button type="button" className="snav-sheet__item" aria-current={i === active ? 'location' : undefined} onClick={() => onPick(i)}>
              <span className="snav-sheet__n" aria-hidden="true">{two(i + 1)}</span>
              <span className="snav-sheet__label">{s.label}</span>
              <SectionIcon id={s.id} />
            </button>
          </li>
        ))}
      </ol>
    </dialog>,
    document.body,
  );
}
