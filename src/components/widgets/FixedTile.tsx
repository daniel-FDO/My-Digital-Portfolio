/* =========================================================
   FIXED — a bug logbook: one real bug per card (data/fixed.ts).
   Shown in the hero grid's last tile only when fixed.ts has at least
   one complete entry (data/heroSlot.ts); otherwise the X-ray tile.
   - "FIXED · 01 / 03", the title, then Symptom / Cause / Fix (Fix in
     the brand red); a project chip and "View fix ↗" when given.
   - Each field is one line here; when any is cut short, "Read more"
     opens the whole entry in a dialog (a centred card, or a bottom
     sheet on narrow screens — the same shape as the X-ray sheet).
   - Previous / Next buttons, ← / → while focus is in the tile, and a
     sideways swipe on touch. It wraps round; the new position is
     announced politely. With one entry there are no arrows.
   - A short slide-and-fade between cards; instant with reduced motion.
   ========================================================= */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { FixedBug } from '../../data/fixed';

const two = (n: number) => String(n).padStart(2, '0');
const dateText = (d?: string) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T12:00:00Z`);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const Out = () => <span aria-hidden="true">↗</span>;

export function FixedTile({ bugs }: { bugs: FixedBug[] }) {
  const n = bugs.length;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<0 | 1 | -1>(0);           // 0 until the first move (no slide on load)
  const [said, setSaid] = useState('');
  const [clamped, setClamped] = useState(false);
  const [reading, setReading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const i = Math.min(index, n - 1);
  const bug = bugs[i];

  const go = (d: 1 | -1) => {
    if (n < 2) return;
    const k = (i + d + n) % n;
    setDir(d); setIndex(k);
    setSaid(`Bug ${k + 1} of ${n}: ${bugs[k].title}`);
  };

  // is anything cut short? then offer "Read more"
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const check = () => setClamped([...el.querySelectorAll<HTMLElement>('.fx__clamp')]
      .some((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1));
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [i]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('dialog')) return;   // keys inside the open entry stay there
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(e.key === 'ArrowRight' ? 1 : -1); }
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="w tile fx" role="group" aria-roledescription="carousel" aria-label="Fixed: a bug logbook"
      tabIndex={0} onKeyDown={onKeyDown}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = null; }}
    >
      <div className="fx__top">
        <p className="w__label">Fixed · {two(i + 1)} / {two(n)}</p>
        {n > 1 && (
          <div className="fx__nav">
            <button type="button" className="fx__btn" aria-label="Previous bug" onClick={() => go(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
            </button>
            <button type="button" className="fx__btn" aria-label="Next bug" onClick={() => go(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>

      <div key={bug.id} ref={cardRef} className="fx__card" data-dir={dir || undefined}>
        <p className="fx__title fx__clamp">{bug.title}</p>
        <dl className="fx__rows">
          <div><dt>Symptom</dt><dd className="fx__clamp">{bug.symptom}</dd></div>
          <div><dt>Cause</dt><dd className="fx__clamp">{bug.cause}</dd></div>
          <div className="fx__fix"><dt>Fix</dt><dd className="fx__clamp">{bug.fix}</dd></div>
        </dl>
      </div>

      {(bug.project || clamped || bug.repoUrl) && (
        <div className="fx__foot">
          {bug.project && <span className="fx__chip">{bug.project}</span>}
          {clamped && (
            <button type="button" ref={moreRef} className="fx__more" aria-haspopup="dialog" onClick={() => setReading(true)}>
              Read more<span className="sr">: {bug.title}</span>
            </button>
          )}
          {bug.repoUrl && (
            <a className="fx__link" href={bug.repoUrl} target="_blank" rel="noopener noreferrer">
              View fix <Out /><span className="sr"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      )}

      <span className="sr" aria-live="polite" aria-atomic="true">{said}</span>
      {reading && <FixedEntry bug={bug} at={i} n={n} onClose={() => { setReading(false); moreRef.current?.focus({ preventScroll: true }); }} />}
    </div>
  );
}

/* The whole entry: a native modal dialog (focus kept inside, Esc closes, focus goes back to "Read more") */
function FixedEntry({ bug, at, n, onClose }: { bug: FixedBug; at: number; n: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    return () => { if (d.open) d.close(); };
  }, []);
  const when = dateText(bug.date);
  return (
    <dialog
      className="fx-entry" ref={ref} aria-labelledby="fxEntryTitle"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}   // the backdrop
    >
      <div className="fx-entry__body">
        <button type="button" className="fx-entry__close" aria-label="Close" onClick={onClose}>×</button>
        <p className="w__label">Fixed · {two(at + 1)} / {two(n)}</p>
        <h2 className="fx-entry__title" id="fxEntryTitle">{bug.title}</h2>
        <dl className="fx-entry__rows">
          <div><dt>Symptom</dt><dd>{bug.symptom}</dd></div>
          <div><dt>Cause</dt><dd>{bug.cause}</dd></div>
          <div className="fx__fix"><dt>Fix</dt><dd>{bug.fix}</dd></div>
        </dl>
        {(bug.project || when || bug.repoUrl) && (
          <div className="fx__foot">
            {bug.project && <span className="fx__chip">{bug.project}</span>}
            {when && <span className="fx-entry__date">{when}</span>}
            {bug.repoUrl && (
              <a className="fx__link" href={bug.repoUrl} target="_blank" rel="noopener noreferrer">
                View fix <Out /><span className="sr"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
