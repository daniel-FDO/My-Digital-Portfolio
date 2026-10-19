/* One reveal per section, only when reached. No CSS-hidden content:
   JS failure, hash links, keyboard focus and reduced motion stay readable.
   Waits until the preloader has handed the page back. */
import { useEffect } from 'react';
import { calm, motionQuery } from '../lib/motion';
import { onPreloaderDone, preloaderActive } from '../lib/preloader';

export function useSectionReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    const reveal = (el: Element) => {
      if (seen.has(el)) return;
      seen.add(el);
      if (calm() || el.contains(document.activeElement)) return;
      const animation = el.animate([
        { opacity: 0.35, transform: 'translateY(9px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 480, easing: 'cubic-bezier(.22,1,.36,1)' });
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    };
    const observer = new IntersectionObserver((entries) => {
      if (preloaderActive()) return;
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        observer.unobserve(target);
        reveal(target);
      });
    }, { threshold: 0.08 });
    const stopWaiting = onPreloaderDone(() => {
      document.querySelectorAll('.page > .sec, .page > .widgets').forEach((el) => observer.observe(el));
    });

    // A pointer click focuses between down/up: moving its target then
    // can swallow the click. Only keyboard focus needs an instant reveal.
    const onFocus = () => animations.forEach((animation) => {
      const el = document.activeElement;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (el && el.matches(':focus-visible') && target && target.contains(el)) animation.finish();
    });
    const onMotion = () => { if (calm()) animations.forEach((animation) => animation.finish()); };
    document.addEventListener('focusin', onFocus);
    motionQuery.addEventListener('change', onMotion);
    return () => {
      stopWaiting();
      observer.disconnect();
      animations.forEach((a) => a.cancel());
      document.removeEventListener('focusin', onFocus);
      motionQuery.removeEventListener('change', onMotion);
    };
  }, []);
}
