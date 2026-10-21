/* =========================================================
   DANIEL — the character, on the right of the "Hello, I'm Daniel."
   card (widgets/DanielTile.tsx mounts him; styles: daniel.css).
   TO SWITCH HIM OFF: set ENABLE_DANIEL_CHARACTER to false; the hero
   goes back to exactly how it was.

   - The drawing (daniel.js) is loaded after the page has settled, so
     the text never waits for it; its shader compiles in the background.
     Until then — and for good if it can't load, WebGL isn't there or
     the graphics context is lost — a still poster of him holds the
     space. If the poster can't load either, his slot hides itself.
   - He's one big button, "Wave to Daniel": click, tap, Enter or Space
     makes him wave with one hand (motion.ts).
   - Next to it (a sibling, never nested) is a small "…" button,
     "Daniel's actions": a menu with Wave, Wave both hands, Dance,
     Nod and Make a sound, plus a mute switch. One action at a time;
     the others are disabled while one plays. The menu is rendered at
     the end of <body> (fixed, kept inside the viewport) so the card's
     rounded clipping can't cut it off.
   - Desktop: right over him, he notices you (a small rise, head tilt,
     eyes on the pointer, an attentive lean) and relaxes when you
     leave; elsewhere on the page his head and eyes follow a little.
   - Sound only ever plays after "Make a sound" is chosen (Web Audio,
     no file), never on load, hover or ordinary clicks; muting is
     remembered on this device.
   - Reduced motion: no breathing, blinking, following or hover
     reaction; every action is a still pose for a moment, with a short
     text acknowledgement. Requested sound still plays unless muted.
   - Drawing stops while he's off screen or the tab is hidden, the
     resolution is capped (lower on touch devices, and steps down if
     frames are slow), and everything — loop, listeners, GPU and audio
     resources — is released on unmount.
   ========================================================= */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motionQuery } from '../../lib/motion';
import type { DanielController } from './daniel';
import { ACTIONS, createMotion, type DanielAction, type DanielState } from './motion';
import { createChirp } from './sound';

export const ENABLE_DANIEL_CHARACTER = true;

const POSTER = 'images/daniel/poster.png';
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const coarse = window.matchMedia('(pointer: coarse)');

const LABEL: Record<DanielAction, string> = { wave: 'Wave', waveBoth: 'Wave both hands', dance: 'Dance', nod: 'Nod', sound: 'Make a sound' };
const SAY: Record<DanielAction, string> = {
  wave: 'Daniel waves hello.', waveBoth: 'Daniel waves with both hands.', dance: 'Daniel does a little dance.',
  nod: 'Daniel nods.', sound: 'Daniel chirps.',
};
/** The little label on him, for still poses (reduced motion, or the poster) */
const ACK: Record<DanielAction, string> = { wave: 'Hi there!', waveBoth: 'Hi hi!', dance: 'Dance time!', nod: 'Yes!', sound: 'Chirp!' };
/** Each action's icon: line icons on a 24px grid (paths adapted from Lucide, ISC licence) */
const HAND = 'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15';
const SPEAKER = 'M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z';
const ICON: Record<DanielAction | 'mute' | 'unmute', ReactNode> = {
  wave: <path d={HAND} />,
  waveBoth: <><g transform="translate(-3 2) scale(.72)"><path d={HAND} /></g><g transform="translate(27 2) scale(-.72 .72)"><path d={HAND} /></g></>,
  dance: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  nod: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
  sound: <><path d={SPEAKER} /><path className="dnc-menu__wave1" d="M16 9a5 5 0 0 1 0 6" /><path className="dnc-menu__wave2" d="M19.4 18.4a9 9 0 0 0 0-12.8" /></>,
  mute: <><path d={SPEAKER} /><path d="m22 9-6 6M16 9l6 6" /></>,
  unmute: <><path d={SPEAKER} /><path d="M16 9a5 5 0 0 1 0 6" /></>,
};
const MUTE_KEY = 'daniel:muted';
const readMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };

type Status = 'poster' | 'live' | 'fallback' | 'none';

export function DanielCharacter() {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLSpanElement>(null);
  const motion = useRef(createMotion());
  const chirp = useRef(createChirp());
  const [status, setStatus] = useState<Status>('poster');
  const [said, setSaid] = useState('');
  const [ack, setAck] = useState('');                // the short visible acknowledgement
  const [state, setState] = useState<DanielState>('idle');
  const [posterOk, setPosterOk] = useState(true);
  const [muted, setMuted] = useState(readMuted);
  const statusRef = useRef(status); statusRef.current = status;
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const stage = stageRef.current!, btn = btnRef.current!;
    const m = motion.current;
    let ctl: DanielController | null = null;          // set once its shader is ready
    let pending: DanielController | null = null;      // created, still compiling
    let raf = 0, last = 0, lastDraw = 0, visible = false, gone = false, drawn = false, idleId = 0;
    let pointer: { dx: number; dy: number } | null = null;
    let hover: { dx: number; dy: number } | null = null;
    let shown = '', dirty = true, contextLost = false;
    // Adaptive resolution: while he's animating every frame, if frames average slower than
    // ~40 fps the canvas resolution steps down by 20%, at most three times (floor 0.6×).
    let res = 1, slow = 0, fast = 0, prevDraw = 0;

    const running = () => visible && !document.hidden && !!ctl && !contextLost;
    const frame = (ts: number) => {
      raf = 0;
      if (!ctl || !running()) return;
      const dt = last ? (ts - last) / 1000 : 1 / 60;
      last = ts;
      const reduced = motionQuery.matches;
      const pose = m.update(dt, { pointer: reduced ? null : pointer, hover: reduced ? null : hover, reduced });
      // idle at ~30 fps (cheaper); acting, or still turning / settling, at full rate
      const lively = m.state !== 'idle' || m.busy;
      const key = Object.values(pose).map((v) => v.toFixed(4)).join();
      if (!dirty && drawn && key === shown) {
        // nothing moved (e.g. reduced motion's still pose): don't redraw the same frame
      } else if (dirty || lively || ts - lastDraw > 31 || !drawn) {
        ctl.setPose(pose);
        if (ctl.render()) {
          if (lively && prevDraw && ts - prevDraw < 100) {
            if (ts - prevDraw > 25) slow++; else fast++;
            if (slow + fast >= 30) {
              if (slow > 20 && res > 0.6 + 1e-3) { res = Math.max(0.6, res * 0.8); ctl.setResolutionScale(res); }
              slow = 0; fast = 0;
            }
          }
          prevDraw = lively ? ts : 0;
          shown = key; lastDraw = ts; dirty = false;
          if (!drawn) { drawn = true; setStatus('live'); }
        }
      }
      // Reduced motion: only draw while something changes, then stop
      if (reduced && m.state === 'idle' && drawn && !dirty) { last = 0; return; }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } };
    const halt = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
    kickRef.current = () => { dirty = true; kick(); };

    // Load the drawing once the page is idle (the hero text never waits)
    const load = async () => {
      try {
        const mod = await import('./daniel.js');
        if (gone) return;
        const dpr = Math.min(window.devicePixelRatio || 1, coarse.matches ? 1.25 : 1.75);
        pending = mod.createDaniel(stage, { dpr });
        await pending.ready;                 // the poster stays up while the shader compiles
        if (gone) return;
        ctl = pending; pending = null;
        kick();
      } catch (err) {
        pending?.dispose(); pending = null;
        console.warn('[daniel] showing the poster instead:', err);
        if (!gone) setStatus('fallback');
      }
    };
    const start = () => { if ('requestIdleCallback' in window) idleId = requestIdleCallback(() => { void load(); }, { timeout: 1500 }); else idleId = setTimeout(() => { void load(); }, 300) as unknown as number; };
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });

    // Only draw while on screen and the tab is visible
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); else halt(); }, { rootMargin: '80px 0px' });
    io.observe(stage);
    const onVis = () => { if (document.hidden) halt(); else kick(); };
    document.addEventListener('visibilitychange', onVis);
    const onContextLost = () => { contextLost = true; halt(); setStatus('fallback'); };
    stage.addEventListener('webglcontextlost', onContextLost, true);
    const ro = new ResizeObserver(() => { if (!ctl) return; ctl.resize(); dirty = true; kick(); });
    ro.observe(stage);

    // Desktop pointer: right over him → hover (he notices you); anywhere else → follow a little.
    // "Over him" is the middle of his frame, not its empty corners.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !finePointer.matches || motionQuery.matches) return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.3);
      pointer = { dx, dy };
      const over = Math.abs(dx) < r.width * 0.36 && e.clientY > r.top + r.height * 0.04 && e.clientY < r.bottom - r.height * 0.02;
      hover = over ? { dx, dy } : null;
      kick();
    };
    const onLeave = () => { pointer = null; hover = null; kick(); };
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    const onMotionPref = () => { pointer = null; hover = null; dirty = true; kick(); };
    motionQuery.addEventListener('change', onMotionPref);

    const offState = m.onState((st) => { setState(st); kick(); });
    const sound = chirp.current;

    return () => {
      gone = true;
      halt();
      if ('cancelIdleCallback' in window) cancelIdleCallback(idleId); clearTimeout(idleId);
      removeEventListener('load', start);
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      stage.removeEventListener('webglcontextlost', onContextLost, true);
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      motionQuery.removeEventListener('change', onMotionPref);
      offState();
      kickRef.current = () => {};
      pending?.dispose(); pending = null;
      ctl?.dispose(); ctl = null;
      sound.dispose();
    };
  }, []);

  // ---- acting ----
  const ackTimer = useRef(0);
  useEffect(() => () => clearTimeout(ackTimer.current), []);
  const showAck = (text: string, ms = 1600) => {
    setAck(text);
    clearTimeout(ackTimer.current);
    ackTimer.current = window.setTimeout(() => setAck(''), ms);
  };
  // the same sentence twice in a row still gets announced
  const announce = (text: string) => setSaid((s) => (s === text ? text.replace(/\.$/, ' again.') : text));
  const makeSound = async () => {
    if (mutedRef.current) { showAck('Sound is muted'); return; }
    const r = await chirp.current.play();
    if (r !== 'played') showAck(r === 'blocked' ? 'Sound was blocked' : 'No sound here');
  };
  const busy = state !== 'idle' || (status !== 'live' && ack !== '');

  /** Play an action. Returns false if another one is still playing. */
  const play = (a: DanielAction): boolean => {
    const reduced = motionQuery.matches;
    const text = a === 'sound' && mutedRef.current ? 'Daniel chirps silently: sound is muted.' : SAY[a];
    if (statusRef.current !== 'live') {
      // the poster: a short text acknowledgement instead of movement
      if (ack) return false;
      showAck(ACK[a]); announce(text);
      if (a === 'sound') void makeSound();
      return true;
    }
    if (!motion.current.play(a, reduced)) return false;
    announce(text);
    if (reduced) showAck(ACK[a]);
    if (a === 'sound') void makeSound();
    kickRef.current();
    return true;
  };

  // ---- the action menu ----
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);     // the closing animation is playing (the menu is already inert)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [hl, setHl] = useState<{ y: number; h: number; on: boolean }>({ y: 0, h: 0, on: false });
  const leaveTimer = useRef(0);
  const trigRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<'first' | 'last'>('first');
  const swallowClick = useRef(0);                    // a click on him that only closed the menu
  const menuId = useId();

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
  const close = useCallback((refocus: boolean) => {
    // a short fade / scale out, then it's removed (straight away with reduced motion)
    setLeaving(true);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { setOpen(false); setLeaving(false); setPos(null); setHl((v) => ({ ...v, on: false })); }, motionQuery.matches ? 0 : 140);
    if (refocus) trigRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  // the highlight pill glides to the item under the pointer / with keyboard focus
  const lightUp = (el: HTMLElement) => setHl({ y: el.offsetTop, h: el.offsetHeight, on: true });
  const place = useCallback(() => {
    const t = trigRef.current, mnu = menuRef.current;
    if (!t || !mnu) return;
    const r = t.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) { setOpen(false); setPos(null); return; }   // scrolled away from him
    const w = mnu.offsetWidth, h = mnu.offsetHeight, M = 8;
    const left = Math.max(M, Math.min(r.right - w, vw - w - M));
    let top = r.top - h - 6;                         // above the button; below it if there's no room
    if (top < M) top = r.bottom + 6;
    top = Math.max(M, Math.min(top, vh - h - M));
    setPos({ left: Math.round(left), top: Math.round(top) });
  }, []);
  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open || !pos) return;
    const list = items();
    const target = focusOnOpen.current === 'last' ? list.at(-1) : list.find((el) => el.getAttribute('aria-disabled') !== 'true') ?? list[0];
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos !== null]);
  useEffect(() => {
    if (!open || leaving) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Node;
      if (menuRef.current?.contains(el) || trigRef.current?.contains(el)) return;
      if (btnRef.current?.contains(el)) swallowClick.current = performance.now();   // dismissing isn't a wave
      const inMenu = menuRef.current?.contains(document.activeElement);
      close(false);
      if (inMenu) trigRef.current?.focus({ preventScroll: true });
    };
    const onScroll = () => place();
    document.addEventListener('pointerdown', onDown, true);
    addEventListener('resize', place);
    addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      removeEventListener('resize', place);
      removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open, leaving, close, place]);

  const openMenu = (focus: 'first' | 'last') => { clearTimeout(leaveTimer.current); setLeaving(false); focusOnOpen.current = focus; setOpen(true); };
  const onTrigKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(e.key === 'ArrowUp' ? 'last' : 'first'); }
  };
  const onMenuKey = (e: KeyboardEvent) => {
    const list = items(), i = list.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => { e.preventDefault(); list[(j + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); close(true); }
  };
  const choose = (a: DanielAction) => {
    if (busy) return;                                // disabled while another action plays
    close(true);
    play(a);
  };
  const toggleMute = () => {
    setMuted((v) => {
      const next = !v;
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* private mode: just this visit */ }
      return next;
    });
  };

  const onDanielClick = () => {
    if (performance.now() - swallowClick.current < 1000) { swallowClick.current = 0; return; }
    play('wave');
  };

  const hidden = status === 'fallback' && !posterOk;
  return (
    // Nothing to show at all (no live drawing, no poster): the slot steps aside
    <div ref={rootRef} className={`dnc dnc--${hidden ? 'none' : status}${ack ? ' is-greeting' : ''}`} hidden={hidden} data-state={state}>
      <button
        ref={btnRef} type="button" className="dnc__btn" aria-label="Wave to Daniel" aria-describedby="dncHint"
        onClick={onDanielClick}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.repeat) e.preventDefault(); }}
      >
        <span className="dnc__stage" ref={stageRef} aria-hidden="true">
          {posterOk && <img className="dnc__poster" src={POSTER} alt="" width={720} height={960} decoding="async" onError={() => setPosterOk(false)} />}
        </span>
        <span className="dnc__tip" aria-hidden="true">
          <span className="dnc__tip-key">Press Enter for a wave</span>
          <span className="dnc__tip-hi">{ack}</span>
        </span>
      </button>
      <button
        ref={trigRef} type="button" className="dnc__more"
        aria-label="Daniel’s actions" aria-haspopup="menu" aria-expanded={open && !leaving} aria-controls={open && !leaving ? menuId : undefined}
        onClick={() => (open && !leaving ? close(false) : openMenu('first'))}
        onKeyDown={onTrigKey}
      >
        <svg className="dnc__dots" viewBox="0 0 18 4" aria-hidden="true"><circle cx="2" cy="2" r="1.6" /><circle cx="9" cy="2" r="1.6" /><circle cx="16" cy="2" r="1.6" /></svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef} id={menuId} role="menu" aria-label="Daniel’s actions"
          className={`dnc-menu${leaving ? ' is-leaving' : ''}`} inert={leaving}
          style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
          onKeyDown={onMenuKey}
          onFocus={(e) => { const it = (e.target as HTMLElement).closest<HTMLElement>('.dnc-menu__item'); if (it) lightUp(it); }}
          onPointerLeave={() => setHl((v) => ({ ...v, on: false }))}
        >
          <span className={`dnc-menu__hl${hl.on ? ' is-on' : ''}`} aria-hidden="true" style={{ '--y': `${hl.y}px`, '--h': `${hl.h}px` } as CSSProperties}></span>
          {ACTIONS.map((a, i) => (
            <button key={a} type="button" role="menuitem" tabIndex={-1} className="dnc-menu__item"
              style={{ '--i': i } as CSSProperties}
              aria-disabled={busy || undefined} onClick={() => choose(a)} data-action={a}
              onPointerEnter={(e) => lightUp(e.currentTarget)}>
              <svg className="dnc-menu__icon" viewBox="0 0 24 24" aria-hidden="true">{ICON[a]}</svg>
              <span>{LABEL[a]}</span>
            </button>
          ))}
          <div className="dnc-menu__sep" role="separator" style={{ '--i': ACTIONS.length } as CSSProperties} />
          <button type="button" role="menuitemcheckbox" tabIndex={-1} aria-checked={muted} className="dnc-menu__item dnc-menu__mute" onClick={toggleMute}
            style={{ '--i': ACTIONS.length + 1 } as CSSProperties} onPointerEnter={(e) => lightUp(e.currentTarget)}>
            <svg className="dnc-menu__icon" viewBox="0 0 24 24" aria-hidden="true">{muted ? ICON.mute : ICON.unmute}</svg>
            <span>Mute sounds</span>
            <span className="dnc-menu__switch" aria-hidden="true"><span></span></span>
          </button>
          {busy && <p className="dnc-menu__note" aria-hidden="true">Daniel is busy…</p>}
        </div>,
        document.body,
      )}
      <span className="sr" id="dncHint">Daniel waves back when you activate him. More actions are in the menu next to him.</span>
      <span className="sr" role="status" aria-live="polite">{said}</span>
    </div>
  );
}
