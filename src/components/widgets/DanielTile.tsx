/* =========================================================
   DANIEL — the name as something to play with.
   Set in Nunito (rounded, bundled locally: @fontsource-variable/nunito)
   at a medium weight. Each letter of "Daniel." swells heavier (its
   weight axis) and lifts a little as the pointer comes near, then settles
   back. A click / tap sends a wave across the word; on touch, drag a
   finger along it (vertical scrolling still works). While nobody is
   playing, a gentle wave passes every few seconds — only on screen,
   never with reduced motion. Frames are written straight to the
   letters (no React re-renders); the loop stops once everything has
   settled.
   ========================================================= */
import { useEffect, useRef } from 'react';
import '@fontsource-variable/nunito';
import { calm } from '../../lib/motion';
import { DanielCharacter, ENABLE_DANIEL_CHARACTER } from '../daniel/DanielCharacter';

const WORD = 'Daniel';
const BASE = 560, PEAK = 880;            // font weights: at rest, right under the pointer
const REACH = 0.9;                       // how far the influence spreads, in letter widths
const IDLE_EVERY = 6500, WAVE_MS = 1100;

export function DanielTile() {
  const rootRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current!;
    const chars = charRefs.current.filter(Boolean) as HTMLSpanElement[];
    const n = chars.length;
    const k = new Float32Array(n);       // each letter's current 0…1
    let pointerX: number | null = null;  // in tile px
    let wave: { start: number; dir: 1 | -1 } | null = null;
    let raf = 0, idleTimer = 0, visible = false, lastInput = 0;

    const centres = () => { const r = root.getBoundingClientRect(); return chars.map((c) => { const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2 - r.left, w: b.width }; }); };

    const frame = (now: number) => {
      raf = 0;
      const cs = centres();
      const avgW = cs.reduce((a, c) => a + c.w, 0) / n || 1;
      let moving = false;
      for (let i = 0; i < n; i++) {
        let target = 0;
        if (pointerX !== null) target = Math.exp(-(((cs[i].x - pointerX) / (avgW * REACH)) ** 2) * 1.6);
        if (wave) {
          const p = (now - wave.start) / WAVE_MS;                       // 0 → 1 across the word (and a bit past)
          const pos = (wave.dir > 0 ? p : 1 - p) * (n + 1) - 0.5;       // in letters
          target = Math.max(target, Math.exp(-((i - pos) ** 2) * 0.9));
        }
        k[i] += (target - k[i]) * 0.16;
        if (Math.abs(target - k[i]) > 0.002) moving = true;
        const s = chars[i].style;
        s.fontVariationSettings = `'wght' ${(BASE + (PEAK - BASE) * k[i]).toFixed(0)}`;
        s.transform = `translateY(${(-k[i] * 6).toFixed(2)}px)`;
        s.setProperty('--k', k[i].toFixed(3));
      }
      if (wave && now - wave.start > WAVE_MS * 1.25) wave = null;
      if (moving || wave || pointerX !== null) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const startWave = (dir: 1 | -1 = 1) => { wave = { start: performance.now(), dir }; kick(); };

    const local = (e: PointerEvent) => e.clientX - root.getBoundingClientRect().left;
    const onMove = (e: PointerEvent) => { pointerX = local(e); lastInput = performance.now(); kick(); };
    const onLeave = () => { pointerX = null; kick(); };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('.dnc')) return;   // tapping the character waves him, not the letters
      lastInput = performance.now(); const x = local(e); startWave(x < root.clientWidth / 2 ? 1 : -1);
    };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    root.addEventListener('pointercancel', onLeave);
    root.addEventListener('pointerdown', onDown);

    // A gentle wave now and then, while on screen and nobody is playing
    const idle = () => {
      idleTimer = window.setTimeout(() => {
        if (visible && !document.hidden && !calm() && pointerX === null && performance.now() - lastInput > 4000) startWave(1);
        idle();
      }, IDLE_EVERY);
    };
    idle();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(root);

    return () => {
      cancelAnimationFrame(raf); clearTimeout(idleTimer); io.disconnect();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointercancel', onLeave);
      root.removeEventListener('pointerdown', onDown);
    };
  }, []);

  return (
    <div className={`w tile daniel${ENABLE_DANIEL_CHARACTER ? ' daniel--with-character' : ''}`} ref={rootRef}>
      <span className="w__label" aria-hidden="true">Hello, I’m</span>
      <span className="daniel__word" role="img" aria-label="Daniel — move across the name to play with it">
        {[...WORD].map((ch, i) => <span key={i} className="daniel__ch" aria-hidden="true" ref={(el) => { charRefs.current[i] = el; }}>{ch}</span>)}
        <span className="daniel__dot" aria-hidden="true">.</span>
      </span>
      <span className="daniel__hint" aria-hidden="true">
        {/* while the character is there, the invitation is his; otherwise the name's own */}
        <span className="daniel__hint-dnc">Say hello to Daniel</span>
        <span className="daniel__hint-name">
          <span className="daniel__hint-fine">Move across the name · click for a wave</span>
          <span className="daniel__hint-touch">Drag along the name · tap for a wave</span>
        </span>
      </span>
      {/* Daniel, the character, on the right of the card (switch: ENABLE_DANIEL_CHARACTER) */}
      {ENABLE_DANIEL_CHARACTER && <DanielCharacter />}
    </div>
  );
}
