/* =========================================================
   THE NAME'S BOUNCING DOT (DanielTile.tsx)
   The red full stop of "Daniel." hops across the name like a bouncing
   ball: right to left, landing on top of each letter (the i's tittle
   included), which gives a small squash and a blush of red as it's
   hit; then it springs back home in one high arc.
   - Plays once when the card comes into view, then every ~9 s while it
     stays on screen; also on a click / tap, or when a mouse comes onto
     the name (not more often than every few seconds).
   - Landing spots come from the real letters: their position on the
     page, and the height of each glyph's ink above the baseline
     (measured with the same font), so it fits any size. Arcs stay
     inside the card (it clips its contents).
   - Web Animations only (no per-frame JavaScript, no React updates).
   - Never while off screen or in a hidden tab; never with reduced
     motion (the name stays still).
   ========================================================= */
import { useEffect, type RefObject } from 'react';
import { calm } from '../../lib/motion';

const HOP_MS = 230;          // one hop between letters
const HOME_MS = 560;         // the arc back to its place
const EVERY_MS = 9000;       // automatic replays while on screen
const COOLDOWN_MS = 3500;    // a hover / tap can't start it more often than this

export function useNameHop(rootRef: RefObject<HTMLElement | null>, wordRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current, word = wordRef.current;
    if (!root || !word) return;
    const dot = word.querySelector<HTMLElement>('.daniel__dot');
    const chars = [...word.querySelectorAll<HTMLElement>('.daniel__ch')];
    if (!dot || !chars.length) return;
    const g = document.createElement('canvas').getContext('2d')!;
    let playing: Animation[] = [], endedAt = -1e9, timer = 0, visible = false, alive = true;

    const play = () => {
      if (!alive || calm() || playing.length || performance.now() - endedAt < COOLDOWN_MS) return;
      const cs = getComputedStyle(chars[0]);
      const fs = parseFloat(cs.fontSize);
      g.font = `${cs.fontStyle} ${getComputedStyle(chars[0]).fontVariationSettings.match(/\d+/)?.[0] ?? 560} ${fs}px ${cs.fontFamily}`;
      const brand = getComputedStyle(root).getPropertyValue('--brand').trim() || '#e0352b';
      const d = dot.getBoundingClientRect(), dotX = d.left + d.width / 2;
      // where it lands: over each letter's middle, on top of its ink (y relative to the baseline both share)
      const spots = chars.map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2 - dotX, y: -g.measureText(c.textContent || '').actualBoundingBoxAscent, el: c };
      }).reverse();                                       // right to left: l, e, i, n, a, D
      const path = [{ x: 0, y: 0 }, ...spots, { x: 0, y: 0 }];
      // the card clips its contents: no arc may lift the dot above its top edge (with a little room)
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      word.appendChild(probe);
      const baseline = probe.getBoundingClientRect().top;
      probe.remove();
      const dotInk = g.measureText('.').actualBoundingBoxAscent;
      const ceiling = (root.getBoundingClientRect().top + 8 + dotInk) - baseline;   // the highest the dot's foot may go (negative = up)
      const legs = path.length - 1, total = HOP_MS * (legs - 1) + HOME_MS;
      // the dot's keyframes: a parabola for each leg, a little squash on every landing
      const frames: Keyframe[] = [];
      let t = 0;
      for (let k = 0; k < legs; k++) {
        const a = path[k], b = path[k + 1], dur = k === legs - 1 ? HOME_MS : HOP_MS;
        const lift = (k === legs - 1 ? 0.75 : k === 0 ? 0.5 : 0.32) * fs;
        const top = Math.max(ceiling, Math.min(a.y, b.y) - lift);
        for (let s = 0; s <= 8; s++) {
          if (k > 0 && s === 0) continue;
          const u = s / 8, x = a.x + (b.x - a.x) * u;
          // a parabola through a → its apex → b
          const y = (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * (2 * top - (a.y + b.y) / 2) + u * u * b.y;
          const land = s === 8 && k < legs - 1;
          frames.push({ offset: (t + u * dur) / total, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)${land ? ' scale(1.25, 0.75)' : ''}`, easing: 'linear' });
        }
        t += dur;
      }
      frames[frames.length - 1].offset = 1;
      playing = [dot.animate(frames, { duration: total, easing: 'linear' })];
      // each letter answers as the dot lands on it
      spots.forEach((s, k) => {
        playing.push(s.el.animate([
          { transform: 'none', color: '' },
          { transform: 'translateY(0.05em) scale(1.06, 0.9)', color: brand, offset: 0.25 },
          { transform: 'translateY(-0.02em) scale(0.98, 1.03)', offset: 0.6 },
          { transform: 'none', color: '' },
        ], { duration: 420, delay: HOP_MS * (k + 1), easing: 'cubic-bezier(.3, .7, .4, 1)' }));
      });
      playing[0].finished.then(() => { endedAt = performance.now(); }, () => {}).finally(() => { playing = []; });
    };

    const schedule = () => {
      clearTimeout(timer);
      if (visible && !document.hidden && !calm()) timer = window.setTimeout(() => { play(); schedule(); }, EVERY_MS);
    };
    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting && e.intersectionRatio > 0.6;
      if (visible && !was) { window.setTimeout(play, 500); }
      if (!visible) playing.forEach((a) => a.finish());
      schedule();
    }, { threshold: [0, 0.6, 1] });
    io.observe(root);
    const onVis = () => schedule();
    document.addEventListener('visibilitychange', onVis);
    const onEnter = (e: PointerEvent) => { if (e.pointerType === 'mouse') play(); };
    const onClick = () => { endedAt = -1e9; play(); };     // an explicit click / tap skips the cooldown
    word.addEventListener('pointerenter', onEnter);
    word.addEventListener('click', onClick);

    return () => {
      alive = false;
      clearTimeout(timer);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      word.removeEventListener('pointerenter', onEnter);
      word.removeEventListener('click', onClick);
      playing.forEach((a) => a.cancel());
    };
  }, [rootRef, wordRef]);
}
