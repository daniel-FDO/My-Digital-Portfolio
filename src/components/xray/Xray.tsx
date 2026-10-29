/* =========================================================
   X-RAY — a DevTools-style inspect mode for the home page.
   Each element with data-xray="id" (an entry in data/xray.ts) gets a
   dashed outline and a small tag: "Component · source · refresh".
   A tag opens a panel (Popover API; a bottom-sheet <dialog> on
   touch / narrow screens) with what / source / refresh / fallback
   and a link to the component's source. Between the hero tiles,
   brand-red redlines show the spacing (640px and up).

   On / off: the X-ray tile's button, the "X" key (not while typing
   or in the contact form), "Toggle X-ray" in the command menu, and
   the "X-ray on · Esc" pill. Esc closes an open panel first, then
   turns X-ray off. Always off when the page loads (nothing stored).
   Everything stays usable while it's on: tags sit at the edges.
   Turning it on: one 400ms scan line and the tags fade in — or,
   with reduced motion, it all just appears.
   ========================================================= */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { sourceUrl, tagText, XRAY, type XrayEntry } from '../../data/xray';
import { useMediaQuery, useReducedMotion } from '../../lib/motion';
import '../../styles/xray.css';

interface XrayApi {
  on: boolean;
  toggle: () => void;
  entries: XrayEntry[];
}
const XrayContext = createContext<XrayApi>({ on: false, toggle: () => {}, entries: XRAY });
export const useXray = () => useContext(XrayContext);

const COMPACT = '(pointer: coarse), (max-width: 639px)';   // tags: name only; details in a bottom sheet

export function XrayProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  const [said, setSaid] = useState('');
  const [panel, setPanel] = useState<{ entry: XrayEntry; tag: HTMLElement } | null>(null);
  const enabled = XRAY.length > 0;

  const toggle = useCallback(() => { if (enabled) setOn((v) => !v); }, [enabled]);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  // focus goes back to the tag first, so it's never left on the closing panel
  const closePanel = useCallback((refocus = true) => {
    if (refocus) panelRef.current?.tag.focus({ preventScroll: true });
    setPanel(null);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('is-xray', on);
    if (!on) setPanel(null);
    return () => document.documentElement.classList.remove('is-xray');
  }, [on]);

  // "X" toggles, Esc closes a panel and then X-ray itself
  const state = useRef({ on, panel: !!panel });
  state.current = { on, panel: !!panel };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;                            // something else (the command menu) took it
        if (state.current.panel) { e.preventDefault(); closePanel(); return; }
        if (state.current.on && !t.closest?.('dialog, [role="dialog"]')) setOn(false);
        return;
      }
      if (e.key.toLowerCase() !== 'x' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || !!t.closest?.('#mailForm');
      if (typing || document.getElementById('main')?.inert) return;   // typing, or a layer covers the page
      toggle();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle, closePanel]);

  const api = useMemo(() => ({ on, toggle, entries: XRAY }), [on, toggle]);
  return (
    <XrayContext.Provider value={api}>
      {children}
      {on && <XrayLayer panel={panel} openPanel={(entry, tag) => setPanel({ entry, tag })} closePanel={closePanel} off={() => setOn(false)} announce={setSaid} />}
      {!on && said && <Silence onDone={() => setSaid('')} />}
      <p className="sr" role="status" aria-live="polite">{on ? said : said && 'X-ray off'}</p>
    </XrayContext.Provider>
  );
}

// After "X-ray off" has been read out, the live region empties
function Silence({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1500); return () => clearTimeout(t); }, [onDone]);
  return null;
}

/* ---------- The layer: tags in the page, redlines, the panel, the pill ---------- */
interface LayerProps {
  panel: { entry: XrayEntry; tag: HTMLElement } | null;
  openPanel: (entry: XrayEntry, tag: HTMLElement) => void;
  closePanel: (refocus?: boolean) => void;
  off: () => void;
  announce: (s: string) => void;
}

function XrayLayer({ panel, openPanel, closePanel, off, announce }: LayerProps) {
  const reduced = useReducedMotion();
  const compact = useMediaQuery(COMPACT);
  const [hosts, setHosts] = useState<{ entry: XrayEntry; host: HTMLElement }[]>([]);
  const [grid, setGrid] = useState<HTMLElement | null>(null);
  const [scan, setScan] = useState(!reduced);

  // A small host at the start of each labelled element (so its tag comes first in the Tab
  // order); elements that aren't on the page are skipped
  useLayoutEffect(() => {
    const made = XRAY.flatMap((entry) => {
      const el = document.querySelector<HTMLElement>(`[data-xray="${entry.id}"]`);
      if (!el) return [];
      const host = document.createElement('span');
      host.className = 'xr-host';
      el.prepend(host);
      return [{ entry, host }];
    });
    const g = document.querySelector<HTMLElement>('.widgets__grid');
    let rl: HTMLElement | null = null;
    if (g) { rl = document.createElement('div'); rl.className = 'xr-redlines'; rl.setAttribute('aria-hidden', 'true'); g.append(rl); }
    setHosts(made);
    setGrid(rl);
    announce(`X-ray on, ${made.length} parts labelled`);
    return () => { made.forEach((m) => m.host.remove()); rl?.remove(); };
  }, [announce]);

  return (
    <>
      {hosts.map(({ entry, host }) => createPortal(
        <Tag entry={entry} compact={compact} open={panel?.entry.id === entry.id} onOpen={openPanel} onClose={closePanel} />, host, entry.id,
      ))}
      {grid && createPortal(<Redlines />, grid)}
      {createPortal(
        <>
          {scan && <div className="xr-scan" aria-hidden="true" onAnimationEnd={() => setScan(false)}></div>}
          <button type="button" className="xr-pill" onClick={off} aria-keyshortcuts="Escape">
            X-ray on <span aria-hidden="true">· Esc</span><span className="sr">: turn it off</span>
          </button>
          {panel && (compact
            ? <Sheet entry={panel.entry} onClose={closePanel} />
            : <Panel entry={panel.entry} tag={panel.tag} onClose={closePanel} />)}
        </>,
        document.body,
      )}
    </>
  );
}

function Tag({ entry, compact, open, onOpen, onClose }: { entry: XrayEntry; compact: boolean; open: boolean; onOpen: (e: XrayEntry, el: HTMLElement) => void; onClose: () => void }) {
  return (
    <button
      type="button" className={`xr-tag${open ? ' is-open' : ''}`} data-xray-tag={entry.id}
      aria-haspopup="dialog" aria-expanded={open} aria-label={`${entry.component}: ${entry.label}. Details`}
      onClick={(e) => (open ? onClose() : onOpen(entry, e.currentTarget))}
    >
      {compact ? entry.component : tagText(entry)}
    </button>
  );
}

function Details({ entry, headingId }: { entry: XrayEntry; headingId: string }) {
  const url = sourceUrl(entry.file);
  return (
    <>
      <p className="xr-panel__name" id={headingId}>{entry.component}</p>
      <dl className="xr-panel__facts">
        <div><dt>What</dt><dd>{entry.label}</dd></div>
        {entry.dataSource && <div><dt>Source</dt><dd>{entry.dataSource.detail}</dd></div>}
        {entry.refresh && <div><dt>Refresh</dt><dd>{entry.refresh.detail}</dd></div>}
        {entry.fallback && <div><dt>Fallback</dt><dd>{entry.fallback}</dd></div>}
      </dl>
      {url && (
        <a className="xr-panel__src" href={url} target="_blank" rel="noopener noreferrer">
          View source <span aria-hidden="true">↗</span><span className="sr"> of {entry.file} on GitHub (opens in a new tab)</span>
        </a>
      )}
    </>
  );
}

/* A popover beside its tag (mouse / wide screens) */
function Panel({ entry, tag, onClose }: { entry: XrayEntry; tag: HTMLElement; onClose: (refocus?: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    try { el.showPopover(); } catch { /* no Popover API: it's still shown, as a fixed box */ }
    const place = () => {
      const r = tag.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, edge = 12;
      let x = Math.max(edge, Math.min(innerWidth - edge - w, r.left));
      let y = r.bottom + 8;
      if (y + h > innerHeight - edge) y = Math.max(edge, r.top - h - 8);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    place();
    el.querySelector<HTMLElement>('.xr-panel__close')?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!el.contains(t) && !tag.contains(t)) onClose(false);
    };
    addEventListener('scroll', place, { passive: true });
    addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown);
    return () => {
      removeEventListener('scroll', place);
      removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown);
      try { el.hidePopover(); } catch { /* already hidden */ }
    };
  }, [entry, tag, onClose]);

  return (
    <div className="xr-panel" popover="manual" ref={ref} role="dialog" aria-labelledby="xrPanelName">
      <button type="button" className="xr-panel__close" aria-label="Close details" onClick={() => onClose()}>×</button>
      <Details entry={entry} headingId="xrPanelName" />
    </div>
  );
}

/* A bottom sheet (touch / narrow screens) */
function Sheet({ entry, onClose }: { entry: XrayEntry; onClose: (refocus?: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    return () => { if (d.open) d.close(); };
  }, [entry]);
  return (
    <dialog
      className="xr-sheet" ref={ref} aria-labelledby="xrSheetName"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}   // the backdrop
    >
      <div className="xr-sheet__body">
        <button type="button" className="xr-panel__close" aria-label="Close details" onClick={() => onClose()}>×</button>
        <Details entry={entry} headingId="xrSheetName" />
      </div>
    </dialog>
  );
}

/* ---------- Redlines: the gaps between hero tiles, measured ---------- */
interface Gap { x: number; y: number; len: number; dir: 'h' | 'v' }

function Redlines() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const layer = ref.current!.parentElement!, grid = layer.parentElement!;
    const measure = () => {
      const g = grid.getBoundingClientRect();
      const tiles = [...grid.querySelectorAll<HTMLElement>(':scope > .wg')].map((t) => t.getBoundingClientRect());
      const out: Gap[] = [], seen = new Set<string>();
      for (const a of tiles) for (const b of tiles) {
        // b sits right of a, overlapping it vertically
        const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
        const dx = b.left - a.right;
        if (dx > 0 && dx < 48 && bottom - top > 20) {
          const k = `h${Math.round(a.right)}:${Math.round(top)}`;
          if (!seen.has(k)) { seen.add(k); out.push({ dir: 'h', x: a.right - g.left, y: (top + bottom) / 2 - g.top, len: dx }); }
        }
        // b sits below a, overlapping it horizontally
        const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
        const dy = b.top - a.bottom;
        if (dy > 0 && dy < 48 && right - left > 20) {
          const k = `v${Math.round(a.bottom)}:${Math.round(left)}`;
          // near the right-hand end, clear of the tags (which hang off the tiles' top-left)
          if (!seen.has(k)) { seen.add(k); out.push({ dir: 'v', x: right - 28 - g.left, y: a.bottom - g.top, len: dy }); }
        }
      }
      setGaps(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref}>
      {gaps.map((g, i) => (
        <span key={i} className={`xr-red xr-red--${g.dir}`} style={g.dir === 'h'
          ? { left: g.x, top: g.y, width: g.len }
          : { left: g.x, top: g.y, height: g.len }}>
          <b>{Math.round(g.len)}</b>
        </span>
      ))}
    </div>
  );
}
