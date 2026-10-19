/* =========================================================
   THE WORDMARK
   1. The giant "daniel", sized so the letters run edge to edge
   2. The spinning "a" — every turn shows it in another language
   Only spins while the footer is on screen and the tab is visible.
   ========================================================= */

export interface WordmarkEls {
  foot: HTMLElement;
  mark: HTMLElement;
  word: HTMLElement;
  slot: HTMLElement;
  glyph: HTMLElement;
  label: HTMLElement;
  /** a zero-size box sitting exactly on the baseline */
  probe: HTMLElement;
}

const FONT = '"Inter Tight", "Inter", sans-serif';
const TRACK = -0.055;             // letter-spacing of .ffoot__word in home.css (em)

interface Glyph { ch: string; name: string; font: string; k: number; size?: number; tx?: number; ty?: number }

export function createWordmark(els: WordmarkEls, onFit: () => void) {
  const { foot, mark, word, slot, glyph, label, probe } = els;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let destroyed = false;

  // Ink measurements of a letter (at 100px), from a canvas
  const ctx = document.createElement('canvas').getContext('2d')!;
  function ink(text: string, family: string) {
    ctx.font = `800 100px ${family}`;
    const m = ctx.measureText(text);
    return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, w: m.width };
  }

  // Everything is worked out from the font's own measurements (not the
  // page layout), so the result is the same every time.
  function fit() {
    // The wordmark fills its own box (.ffoot__mark), less any padding on it
    const ms = getComputedStyle(mark);
    const pad = parseFloat(ms.paddingLeft) || 0;
    const avail = mark.clientWidth - pad - (parseFloat(ms.paddingRight) || 0);
    // the "a" slot = exactly one latin "a" plus its letter-spacing
    const slotEm = (ink('a', FONT).w + TRACK * 100) / 100;
    slot.style.width = slotEm + 'em';
    // word width at 100px: d + slot + n i e l (spacing after d, n, i, e — not after the last l)
    const wordW = ink('d', FONT).w + slotEm * 100 + ink('n', FONT).w + ink('i', FONT).w + ink('e', FONT).w + ink('l', FONT).w + TRACK * 100 * 4;
    // Fit the INK (not the letter boxes): "d" starts and "l" ends exactly at the gutters
    const d = ink('d', FONT), l = ink('l', FONT);
    const lsb = -d.l;                 // empty space before the "d"
    const rsb = l.w - l.r;            // empty space after the "l"
    const f = (100 * avail) / (wordW - lsb - rsb);
    word.style.fontSize = f + 'px';
    word.style.left = (pad - (lsb * f) / 100) + 'px';

    // Height: from the top of "d"/"l" down to the baseline, minus a little crop
    const asc = (Math.max(d.a, l.a) * f) / 100;
    const crop = 0.035 * f;
    const h = Math.ceil(asc - crop + 4);
    mark.style.height = h + 'px';
    word.style.top = '0px';
    const baseline = probe.getBoundingClientRect().top - word.getBoundingClientRect().top;
    word.style.top = (h + crop - baseline) + 'px';

    // The spin's vanishing point + the language label sit at the "a"
    const centre = slot.offsetLeft + slot.offsetWidth / 2;
    word.style.perspectiveOrigin = `${centre}px 60%`;
    label.style.left = (word.offsetLeft + centre) + 'px';
    onFit();   // the footballers re-measure the letters
  }

  /* k = how big the letter should be, compared with the latin "a"
     (letters like あ or अ look right a bit taller than an "x-height"). */
  const GLYPHS: Glyph[] = [
    { ch: 'a', name: 'English', font: FONT, k: 1 },
    { ch: 'α', name: 'Greek', font: FONT, k: 1 },
    { ch: 'а', name: 'Russian', font: FONT, k: 1 },
    { ch: 'あ', name: 'Japanese', font: '"Noto Sans JP", sans-serif', k: 1.12 },
    { ch: 'अ', name: 'Hindi', font: '"Noto Sans Devanagari", sans-serif', k: 1.18 },
    { ch: 'أ', name: 'Arabic', font: '"Noto Sans Arabic", sans-serif', k: 1.55 },
    { ch: '아', name: 'Korean', font: '"Noto Sans KR", sans-serif', k: 1.12 },
    { ch: 'א', name: 'Hebrew', font: '"Noto Sans Hebrew", sans-serif', k: 1.08 },
    { ch: 'ა', name: 'Georgian', font: '"Noto Sans Georgian", sans-serif', k: 1 },
    { ch: 'ա', name: 'Armenian', font: '"Noto Sans Armenian", sans-serif', k: 1 },
  ];

  // Work out each glyph's size and offsets so it lines up with the other
  // letters: same ink bottom as the latin "a", centred in the slot.
  function calibrate() {
    const a = ink('a', FONT);
    const aH = a.a + a.d;
    const maxW = (a.l + a.r) * 0.98;          // never much wider than the "a"
    GLYPHS.forEach((g) => {
      const m = ink(g.ch, g.font);
      let s = (g.k * aH) / Math.max(1, m.a + m.d);
      if ((m.l + m.r) * s > maxW) s = maxW / (m.l + m.r);
      const dx = (a.r - a.l) / 2 - (s * (m.r - m.l)) / 2;   // match the ink centres
      const dy = a.d - m.d * s;                              // match the ink bottoms
      g.size = s;
      g.tx = dx / 100 / s;                                   // in the glyph's own em
      g.ty = dy / 100 / s;
    });
  }
  function showGlyph(i: number) {
    const g = GLYPHS[i];
    glyph.textContent = g.ch;
    glyph.style.fontFamily = g.font;
    glyph.style.fontSize = g.size + 'em';
    glyph.style.translate = `${g.tx}em ${g.ty}em`;
  }
  function flashLabel(name: string) {
    label.textContent = name;
    label.getAnimations().forEach((an) => an.cancel());
    label.animate(reduce
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
      : [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none', offset: 0.2 },
         { opacity: 1, transform: 'none', offset: 0.75 }, { opacity: 0, transform: 'translateY(-3px)' }],
      { duration: reduce ? 2600 : 1900, easing: 'ease' });
  }

  let current = 0, spinning = false, ready = false, timer = 0, inView = false;
  function schedule(ms: number) {
    clearTimeout(timer);
    if (ready && inView && !document.hidden && !destroyed) timer = window.setTimeout(spin, ms);
  }
  // One turn: spin to edge-on (invisible), swap the letter, spin back
  async function spin() {
    if (spinning || !ready || destroyed) return;
    spinning = true;
    clearTimeout(timer);
    const next = (current + 1) % GLYPHS.length;
    try {
      if (reduce) {
        // Reduced motion: no spin — a quick cross-fade
        const out = slot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
        await out.finished;
        showGlyph(next); flashLabel(GLYPHS[next].name);
        const back = slot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'forwards' });
        await back.finished;
        out.cancel(); back.cancel();
      } else {
        const out = slot.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' }],
          { duration: 600, easing: 'cubic-bezier(0.55, 0.05, 0.85, 0.4)', fill: 'forwards' });
        await out.finished;
        showGlyph(next); flashLabel(GLYPHS[next].name);           // swapped while edge-on
        const back = slot.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0deg)' }],
          { duration: 600, easing: 'cubic-bezier(0.15, 0.6, 0.45, 1)', fill: 'forwards' });
        await back.finished;
        out.cancel(); back.cancel();
      }
      current = next;
    } catch { /* animation cancelled */ }
    spinning = false;
    schedule(reduce ? 3000 : 1500);
  }

  const onEnter = () => { spin(); };                // hover → spin now
  slot.addEventListener('pointerenter', onEnter);
  const onVisibility = () => (document.hidden ? clearTimeout(timer) : schedule(1500));
  document.addEventListener('visibilitychange', onVisibility);
  const seen = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) schedule(reduce ? 3000 : 1500); else clearTimeout(timer);
  }, { rootMargin: '120px 0px' });
  seen.observe(foot);

  // Keep the letters edge to edge when the footer changes size
  let resizeQueued = 0;
  const resize = new ResizeObserver(() => {
    if (resizeQueued || !ready) return;
    resizeQueued = requestAnimationFrame(() => { resizeQueued = 0; fit(); });
  });
  resize.observe(foot);

  // Wait for the fonts (max ~4s), then measure everything and start
  const loads = [document.fonts.load(`800 100px ${FONT}`, 'danielαа')]
    .concat(GLYPHS.slice(3).map((g) => document.fonts.load(`800 100px ${g.font}`, g.ch)));
  Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 4000))]).then(() => {
    if (destroyed) return;
    fit();
    calibrate();
    showGlyph(current);
    ready = true;
    schedule(1200);
  });

  return {
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      cancelAnimationFrame(resizeQueued);
      slot.removeEventListener('pointerenter', onEnter);
      document.removeEventListener('visibilitychange', onVisibility);
      seen.disconnect();
      resize.disconnect();
      slot.getAnimations().forEach((a) => a.cancel());
      label.getAnimations().forEach((a) => a.cancel());
    },
  };
}
