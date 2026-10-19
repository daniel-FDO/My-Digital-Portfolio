/* =========================================================
   DOCK — the redesigned bottom bar (styles: dock.css).
   One charcoal rounded rectangle: search on the left (opens the
   command menu, as before; Ctrl / ⌘ K is handled there), one divider,
   then two equal buttons: theme and back to top. It never changes
   size or moves while you scroll. Switched on by ENABLE_DOCK_REDESIGN
   in Dock.tsx (false = the previous toolbar).
   ========================================================= */
import { useTheme } from '../lib/theme';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

interface Props {
  inert: boolean;
  menuOpen: boolean;
  onAsk: () => void;
  onTop: () => void;
}

export function DockBar({ inert, menuOpen, onAsk, onTop }: Props) {
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === 'dark';
  return (
    <div className="dock2" id="dock" inert={inert}>
      <button
        type="button" className="dock2__search" id="askOpen" onClick={onAsk}
        aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="cmd" aria-keyshortcuts="Control+K Meta+K"
      >
        <svg className="dock2__glass" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
        <span className="dock2__label">Search projects…</span>
        <span className="dock2__keys" aria-hidden="true"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
      </button>
      <span className="dock2__divider" aria-hidden="true"></span>
      <button type="button" className="dock2__btn" id="themeToggle" onClick={toggleTheme}
        aria-label={toLight ? 'Switch to light theme' : 'Switch to dark theme'} data-tip={toLight ? 'Light theme' : 'Dark theme'}>
        <span className="dock2__theme" aria-hidden="true">
          <svg className="dock2__sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>
          <svg className="dock2__moon" viewBox="0 0 24 24"><path d="M20.4 13.3A8.5 8.5 0 1 1 10.7 3.6a6.6 6.6 0 0 0 9.7 9.7z" /></svg>
        </span>
      </button>
      <button type="button" className="dock2__btn" id="toTop" onClick={onTop} aria-label="Back to top" data-tip="Back to top">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
      </button>
    </div>
  );
}
