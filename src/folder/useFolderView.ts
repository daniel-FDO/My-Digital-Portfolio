/* =========================================================
   FOLDER VIEW — About (and the other folders) open over the home
   page, in place, so going back never reloads it.
   History rules: a click adds one entry (…#folder/about); Back
   (the button, Esc or the browser's) closes it; Forward reopens it.
   A typed / reloaded #folder/ address just shows the home page.
   ========================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FOLDERS, isFolderKey, lookStyle, type FolderKey } from '../data/folders';
import { calm } from '../lib/motion';

const HASH = '#folder/';
const DOC = Math.random().toString(36).slice(2);   // this page load (history entries from another load are ignored)
const homeUrl = () => location.pathname + location.search;

interface FolderState { folder?: string; homeY?: number; doc?: string }
const keyOf = (s: FolderState | null): FolderKey | null => (s && isFolderKey(s.folder) ? s.folder : null);

let stylesReady: Promise<unknown> | null = null;
function loadStyles() {
  if (stylesReady) return stylesReady;
  const timeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise((r) => setTimeout(r, 4000))]);
  const font = new Promise((resolve) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo:wdth,wght@62..125,500..900&display=swap';
    l.onload = l.onerror = resolve;
    document.head.appendChild(l);
  });
  stylesReady = Promise.all([timeout(font), timeout(import('./folderStyles').catch(() => {}))]);
  return stylesReady;
}

export function useFolderView() {
  // `key` = the folder that should be open; `shown` = the layer is on screen
  // (it stays on screen while the exit fade plays)
  const [key, setKey] = useState<FolderKey | null>(null);
  const [shownState, setShownState] = useState<{ key: FolderKey; n: number } | null>(null);
  const shown = shownState?.key ?? null;
  const [mounted, setMounted] = useState<FolderKey[]>([]);
  const layerRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<FolderKey | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const exit = useRef<Animation | null>(null);
  const homeTitle = useRef(document.title);
  keyRef.current = key;

  /* ---- open / close ---- */
  const open = useCallback((k: FolderKey, from?: HTMLElement | null) => {
    if (keyRef.current === k) return;
    returnTo.current = from || (document.activeElement as HTMLElement | null);
    history.replaceState({ homeY: Math.round(scrollY), doc: DOC }, '', homeUrl());
    history.pushState({ folder: k, homeY: Math.round(scrollY), doc: DOC }, '', HASH + k);
    setKey(k);
  }, []);

  const back = useCallback(() => {
    const s = history.state as FolderState | null;
    if (s && s.folder && s.doc === DOC) history.back();
    else { history.replaceState({ homeY: Math.round(scrollY), doc: DOC }, '', homeUrl()); setKey(null); }
  }, []);

  // The browser's Back / Forward
  useEffect(() => {
    const onPop = (e: PopStateEvent) => setKey(keyOf(e.state));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  // Arriving with #folder/… : only Back / Forward (our own entry) reopens it
  useEffect(() => {
    if (!location.hash.startsWith(HASH)) return;
    const k = keyOf(history.state);
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (k && nav && nav.type === 'back_forward') setKey(k);
    else history.replaceState(null, '', homeUrl());
  }, []);

  /* ---- show: once the folder styles are in ---- */
  useEffect(() => {
    if (!key) return;
    if (exit.current) { exit.current.cancel(); exit.current = null; }
    let live = true;
    loadStyles().then(() => {
      if (!live || keyRef.current !== key) return;   // closed / changed while loading
      setMounted((m) => (m.includes(key) ? m : [...m, key]));
      setShownState((s) => ({ key, n: (s?.n ?? 0) + 1 }));   // a new n replays the entrance
    });
    return () => { live = false; };
  }, [key]);

  // The layer has its folder on screen: look, scroll, focus, entrance
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!shown || !layer || keyRef.current !== shown) return;
    const f = FOLDERS[shown];
    Object.entries(lookStyle(f)).forEach(([prop, value]) => layer.style.setProperty(prop, value));
    layer.dataset.tone = f.tone;
    layer.scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';
    document.title = `${f.title} — Daniel Fasan`;
    layer.classList.remove('is-in', 'is-entering');
    void layer.offsetWidth;
    const view = layer.querySelector<HTMLElement>(`[data-folder="${shown}"]`);
    if (!calm()) {
      layer.classList.add('is-entering');
      view?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => layer.classList.add('is-in')); });
    const heading = view?.querySelector('h1');
    if (heading) { if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [shownState]);

  /* ---- hide: fade out, then give the page back ---- */
  useEffect(() => {
    if (key || !shown) return;
    const layer = layerRef.current!;
    const finish = () => {
      if (keyRef.current) return;
      layer.classList.remove('is-in', 'is-entering');
      document.documentElement.style.overflow = '';
      document.title = homeTitle.current;
      setShownState(null);
      const r = returnTo.current;
      // after React has lifted inert from the page
      requestAnimationFrame(() => { if (r && r.isConnected) r.focus({ preventScroll: true }); });
    };
    if (calm()) { finish(); return; }
    // Keep the page behind inert until the outgoing layer has gone.
    const anim = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out' });
    exit.current = anim;
    anim.finished.then(() => { if (exit.current === anim) { exit.current = null; finish(); } }, () => {});
  }, [key, shown]);

  // Leaving the page with the folder open: nothing to restore later
  useEffect(() => () => { document.documentElement.style.overflow = ''; }, []);

  return { key, shown, mounted, layerRef, open, back, isOpen: key !== null };
}

export type FolderView = ReturnType<typeof useFolderView>;
