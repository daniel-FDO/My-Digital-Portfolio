/* =========================================================
   TOOLBAR — search / ask, theme, back to top (styles: toolbar.css)
   A dark glass pill, like the section dock. The ask field's
   placeholder cycles through questions the command menu really
   answers (still for reduced motion, while the menu is open or the
   tab is hidden); its accessible name stays the same. Once you've
   scrolled, back to top slides in, its ring filling as you read down
   the page. It stays at the bottom all the way down: the footer keeps
   room under its last line (home.css "Footer").
   ========================================================= */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../lib/motion';
import { useTheme } from '../lib/theme';
import { DockBar } from './DockBar';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// Each of these gets a real answer from the command menu (CommandMenu.tsx)
const PROMPTS = ['Ask me anything', 'What is he learning?', 'Search projects…', 'Where is he based?', 'How do I contact him?', 'What’s playing now?'];
const CYCLE = 3600;

interface Props {
  inert: boolean;
  menuOpen: boolean;
  onAsk: () => void;
  onTop: () => void;
}

/** The redesigned dock (DockBar.tsx, dock.css). false = the previous toolbar below. */
export const ENABLE_DOCK_REDESIGN = true;

export function Dock(props: Props) {
  return ENABLE_DOCK_REDESIGN ? <DockBar {...props} /> : <DockClassic {...props} />;
}

function DockClassic({ inert, menuOpen, onAsk, onTop }: Props) {
  const { theme, toggleTheme } = useTheme();
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [prompt, setPrompt] = useState(0);
  const ring = useRef<SVGCircleElement>(null);

  // The ring is drawn straight from the scroll position (no re-render per frame)
  useEffect(() => {
    let queued = 0;
    const onScroll = () => {
      queued = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 0;
      if (ring.current) ring.current.style.strokeDashoffset = String(100 - p * 100);
      setScrolled(scrollY > 240);
    };
    const queue = () => { if (!queued) queued = requestAnimationFrame(onScroll); };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    onScroll();
    return () => { removeEventListener('scroll', queue); removeEventListener('resize', queue); cancelAnimationFrame(queued); };
  }, []);

  // The placeholder's questions, one after another
  useEffect(() => {
    if (reduced || menuOpen || inert) { setPrompt(0); return; }
    const id = window.setInterval(() => { if (!document.hidden) setPrompt((n) => (n + 1) % PROMPTS.length); }, CYCLE);
    return () => clearInterval(id);
  }, [reduced, menuOpen, inert]);

  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <div className={`dock${scrolled ? ' is-scrolled' : ''}`} id="dock" inert={inert}>
      <div className="dock__bar">
        <button
          type="button" className="dock__ask" id="askOpen" aria-label="Ask me anything" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="cmd"
          aria-keyshortcuts="Control+K Meta+K" onClick={onAsk}
        >
          <span className="dock__spark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3.5c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5 4.3-.5 6-2.2 6.5-6.5z" /><path d="M18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" /></svg>
          </span>
          <span className="dock__ph" aria-hidden="true"><span key={prompt}>{PROMPTS[prompt]}</span></span>
          <span className="dock__keys" aria-hidden="true"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
        </button>
        <span className="dock__sep" aria-hidden="true"></span>
        <button type="button" className="dock__btn" id="themeToggle" aria-label={themeLabel} data-tip={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={toggleTheme}>
          <svg className="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
          <svg className="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></svg>
        </button>
        {/* Back to top, its ring showing how far down the page you are */}
        <span className="dock__more">
          <button type="button" className="dock__btn dock__top" id="toTop" aria-label="Back to top" data-tip="Back to top" tabIndex={scrolled ? 0 : -1} onClick={onTop}>
            <svg className="dock__ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="dock__track" cx="18" cy="18" r="15" />
              <circle className="dock__prog" ref={ring} cx="18" cy="18" r="15" pathLength={100} />
            </svg>
            <svg className="dock__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17V7M7.5 11.5 12 7l4.5 4.5" /></svg>
          </button>
        </span>
      </div>
    </div>
  );
}
