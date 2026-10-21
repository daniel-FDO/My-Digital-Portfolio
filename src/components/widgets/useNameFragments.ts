import { useEffect, type RefObject } from 'react';

type Fragment = { x: number; y: number; hx: number; hy: number; vx: number; vy: number; seed: number; dot: boolean };

export function useNameFragments(
  rootRef: RefObject<HTMLDivElement | null>,
  wordRef: RefObject<HTMLButtonElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current!, word = wordRef.current!, canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let particles: Fragment[] = [];
    let raf = 0, disposed = false, visible = true, prepared = false;
    let pointer: { x: number; y: number } | null = null;
    let burst = -Infinity, last = 0, started = 0;
    let width = 0, height = 0, left = 0, right = 0, midY = 0, radius = 55;
    let top = 0, bottom = 0;
    let ink = '', accent = '', step = 3;

    // Sample the actual locally bundled font, using each DOM letter's position.
    const prepare = () => {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      width = rect.width; height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mask = document.createElement('canvas');
      mask.width = Math.ceil(width); mask.height = Math.ceil(height);
      const m = mask.getContext('2d', { willReadFrequently: true });
      if (!m) return false;
      const styles = getComputedStyle(root);
      ink = styles.getPropertyValue('--fg').trim(); accent = styles.getPropertyValue('--brand').trim();
      const wr = word.getBoundingClientRect();
      left = wr.left - rect.left; right = wr.right - rect.left; midY = wr.top - rect.top + wr.height / 2;
      top = (root.querySelector('.w__label')?.getBoundingClientRect().bottom ?? wr.top) - rect.top + 5;
      bottom = (root.querySelector('.daniel__hint')?.getBoundingClientRect().top ?? wr.bottom) - rect.top - 6;
      radius = Math.max(32, Math.min(65, wr.height * 0.8));
      step = wr.width < 240 ? 2.6 : 3.2;
      let dotX = right;
      for (const el of Array.from(word.children) as HTMLElement[]) {
        const cr = el.getBoundingClientRect(), cs = getComputedStyle(el);
        m.font = `${el.classList.contains('daniel__dot') ? 900 : 560} ${cs.fontSize} ${cs.fontFamily}`;
        m.fillStyle = '#fff';
        const metrics = m.measureText(el.textContent || '');
        const ascent = metrics.fontBoundingBoxAscent;
        const descent = metrics.fontBoundingBoxDescent;
        const baseline = cr.top - rect.top + (cr.height - ascent - descent) / 2 + ascent;
        m.fillText(el.textContent || '', cr.left - rect.left, baseline);
        if (el.classList.contains('daniel__dot')) dotX = cr.left - rect.left;
      }
      const data = m.getImageData(0, 0, mask.width, mask.height).data;
      particles = [];
      for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
        if (data[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] > 110) {
          particles.push({ x, y, hx: x, hy: y, vx: 0, vy: 0, seed: Math.sin(x * 12.98 + y * 78.23) * 0.5 + 0.5, dot: x >= dotX });
        }
      }
      prepared = particles.length > 0;
      return prepared;
    };
    const stop = () => {
      cancelAnimationFrame(raf); raf = 0; pointer = null; burst = -Infinity;
      root.classList.remove('is-fragmenting');
      ctx.clearRect(0, 0, width, height); prepared = false;
    };
    const frame = (now: number) => {
      raf = 0;
      if (disposed || reduced.matches || !visible || document.hidden) { stop(); return; }
      const dt = Math.min((now - last) / 16.667, 2); last = now;
      const progress = (now - burst) / 1300;
      const sweeping = progress >= 0 && progress < 1;
      const source = sweeping ? { x: left - radius + (right - left + radius * 2) * progress, y: midY } : pointer;
      ctx.clearRect(0, 0, width, height);
      let energy = 0;
      for (const p of particles) {
        const dx = p.hx - (source?.x ?? -1000), dy = p.hy - (source?.y ?? -1000);
        const distance = Math.hypot(dx, dy);
        const influence = source ? Math.pow(Math.max(0, 1 - distance / radius), 2) : 0;
        const angle = Math.atan2(dy, dx) + 0.9 + Math.sin(now * 0.0017 + p.seed * 6) * 0.4;
        const push = influence * radius * (sweeping ? 1.1 : 0.8) * (0.6 + p.seed * 0.8);
        const tx = Math.max(left, Math.min(right + 12, p.hx + Math.cos(angle) * push));
        const ty = Math.max(Math.min(top, p.hy), Math.min(Math.max(bottom, p.hy), p.hy + Math.sin(angle) * push));
        p.vx = (p.vx + (tx - p.x) * 0.075 * dt) * Math.pow(0.77, dt);
        p.vy = (p.vy + (ty - p.y) * 0.075 * dt) * Math.pow(0.77, dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        const displacement = Math.hypot(p.x - p.hx, p.y - p.hy);
        energy += displacement + Math.abs(p.vx) + Math.abs(p.vy);
        const hot = displacement > 3;
        ctx.fillStyle = p.dot || (hot && p.seed > 0.35) ? accent : ink;
        ctx.globalAlpha = hot ? 0.6 + p.seed * 0.4 : 0.94;
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.rotate(hot ? Math.atan2(p.vy, p.vx) + p.seed : 0);
        // Short metal-like slivers stretch into sparks as they move.
        const size = step * 0.78;
        ctx.fillRect(-size / 2, -size / 2, hot ? size + Math.min(5, Math.hypot(p.vx, p.vy) * 1.3) : size, hot ? size * 0.65 : size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (!source && energy < particles.length * 0.12 && now - started > 250) { stop(); return; }
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (reduced.matches || document.hidden || !visible) return;
      if (!prepared && !prepare()) return;
      root.classList.add('is-fragmenting');
      if (!raf) { last = started = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = root.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; start();
    };
    const leave = () => { pointer = null; };
    const click = () => { burst = performance.now(); start(); };
    const focus = () => { burst = performance.now(); start(); };
    word.addEventListener('pointermove', move);
    word.addEventListener('pointerleave', leave);
    word.addEventListener('pointercancel', leave);
    word.addEventListener('click', click);
    word.addEventListener('focus', focus);
    word.addEventListener('blur', leave);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) stop(); });
    io.observe(root);
    const ro = new ResizeObserver(stop); ro.observe(root); ro.observe(word);
    const mo = new MutationObserver(stop); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', stop);
    void document.fonts.ready.then(() => { if (!disposed) stop(); });
    return () => {
      disposed = true; stop(); io.disconnect(); ro.disconnect(); mo.disconnect();
      word.removeEventListener('pointermove', move); word.removeEventListener('pointerleave', leave);
      word.removeEventListener('pointercancel', leave); word.removeEventListener('click', click);
      word.removeEventListener('focus', focus); word.removeEventListener('blur', leave);
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', stop);
    };
  }, [rootRef, wordRef, canvasRef]);
}
