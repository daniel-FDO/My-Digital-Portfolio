/* =========================================================
   MINI TOOLTIP — one small floating label (the GitHub heatmap's)
   - sits above the thing it describes (below it if there's no room)
   - always kept inside the screen (never cut off at the edges)
   - moved with transform, faded with opacity; hides while scrolling
   It's visual only: the squares carry the same text in their own
   aria-label for screen readers.
   ========================================================= */
import { useCallback, useEffect, useMemo, useRef, type ReactPortal } from 'react';
import { createPortal } from 'react-dom';

export interface MiniTipApi {
  show: (target: HTMLElement, text: string) => void;
  /** hide — only if `target` (when given) still owns the tip */
  hide: (target?: HTMLElement | null) => void;
}

export function useMiniTip(): [MiniTipApi, ReactPortal] {
  const el = useRef<HTMLDivElement>(null);
  const owner = useRef<HTMLElement | null>(null);
  const label = useRef('');

  const show = useCallback((target: HTMLElement, text: string) => {
    const tip = el.current;
    if (!tip) return;
    owner.current = target;
    label.current = text;
    tip.textContent = text;
    const r = target.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight, gap = 8, edge = 8;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(edge, Math.min(innerWidth - edge - w, x));          // keep inside the screen
    let y = r.top - h - gap;
    if (y < edge) y = r.bottom + gap;                                // no room above → below
    tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    tip.classList.add('is-on');
  }, []);

  const hide = useCallback((target?: HTMLElement | null) => {
    if (target && target !== owner.current) return;   // someone else already took it over
    owner.current = null;
    el.current?.classList.remove('is-on');
  }, []);

  // While the page scrolls: a keyboard-focused square keeps its label (moved along with
  // it — Tab often scrolls the page itself); a hovered / tapped one just lets it go.
  useEffect(() => {
    let queued = false, raf = 0;
    const onScroll = () => {
      if (!owner.current) return;
      if (document.activeElement !== owner.current) { hide(); return; }
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(() => { queued = false; if (owner.current) show(owner.current, label.current); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [show, hide]);

  const api = useMemo(() => ({ show, hide }), [show, hide]);
  const portal = createPortal(<div className="mini-tip" aria-hidden="true" ref={el}></div>, document.body);
  return [api, portal];
}
