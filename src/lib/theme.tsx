/* =========================================================
   THEME — dark on a fresh visit; a choice lasts this visit
   (sessionStorage 'theme', also read by secret.html). The first
   value is set by the inline script in index.html's <head>, before
   the page draws, so there's no flash.
   ========================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import type { Theme } from '../types';

interface ThemeValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const current = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(current);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#111110' : '#f4f2ef';
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    if (root.dataset.theme === next) return;
    try { sessionStorage.setItem('theme', next); } catch { /* storage blocked */ }
    // Set straight away (not only in the effect): components that read the
    // theme's CSS variables in their own effects run first
    const apply = () => flushSync(() => { root.dataset.theme = next; setThemeState(next); });

    // One clean switch: while it happens, no element runs its own colour
    // transition (otherwise borders and text lag behind the backgrounds)
    root.classList.add('theme-switching');
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    const vt = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition;
    if (!vt || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); done(); return; }

    // The new theme opens as a circle from the theme button (or the middle of the screen)
    const btn = document.getElementById('themeToggle')?.getBoundingClientRect();
    const x = btn && btn.width ? btn.left + btn.width / 2 : innerWidth / 2;
    const y = btn && btn.width ? btn.top + btn.height / 2 : innerHeight / 2;
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    vt.call(document, apply).finished.finally(done);
  }, []);
  const toggleTheme = useCallback(() => setTheme(current() === 'dark' ? 'light' : 'dark'), [setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
