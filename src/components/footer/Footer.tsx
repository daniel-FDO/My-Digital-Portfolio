/* =========================================================
   FOOTER — the "daniel" wordmark (spinning "a") with Ronaldo and
   Messi on its letters, the hanging ID card, a quote, the links, ©.
   Same background as the page; styles: home.css "Footer" for the
   wordmark, footer-rig.css for the card.
   The motion lives in three small engines, started and stopped by
   the effect below:
     wordmark.ts — fits the word edge to edge, spins the "a"
     idRig.ts    — the lanyard physics, drag / throw / flip
     football.ts — the footballers' canvas
   React keeps the state the visitor can see change: the card's
   flip / live / grabbing, and the football's Play / Pause.
   ========================================================= */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { LanyardSvg, QrCode } from './art';
import { createFootball, type FootballState } from './football';
import { createIdRig } from './idRig';
import { createWordmark } from './wordmark';

const YEAR = new Date().getFullYear();

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/daniel-FDO' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/daniel-fasan-a0b503331/' },
  { label: 'Spotify', href: 'https://open.spotify.com/user/313dgijnrcg4vwkwuuryvr4wqfb4?si=e403baac359541ba' },
  { label: 'Instagram', href: 'https://www.instagram.com/d4ni3lllll__?stkn=Y2Y0Njk3NjczeW91&utm_source=qr' },
];

export function Footer({ inert }: { inert: boolean }) {
  const ffoot = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [live, setLive] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [ball, setBall] = useState<FootballState>({ show: false, playing: true });
  const rig = useRef<ReturnType<typeof createIdRig> | null>(null);
  const football = useRef<ReturnType<typeof createFootball> | null>(null);

  useEffect(() => {
    const foot = ffoot.current!;
    const q = <T extends Element>(sel: string) => foot.querySelector<T>(sel)!;
    const card = q<HTMLElement>('#idCard');
    const space = q<HTMLElement>('#ffootSpace');
    const word = q<HTMLElement>('#ffootWord');
    const mark = q<HTMLElement>('#ffootMark');
    const probe = q<HTMLElement>('.ffoot__probe');

    const fb = createFootball({ foot, word, mark, canvas: q('.ffoot__football'), probe, card, space }, setBall);
    football.current = fb;
    const wm = createWordmark({
      foot, mark, word, probe,
      slot: q('#ffootA'), glyph: q('.ffoot__glyph'), label: q('#ffootLang'),
    }, () => fb.relayout());
    const r = createIdRig({
      foot, space, card,
      clip: q('.idcard__clip'), tilt: q('.idcard__tilt'), sheens: Array.from(foot.querySelectorAll<HTMLElement>('.idcard__sheen')),
      strapLine: q('#idStrapLine'), edgeL: q('#idEdgeL'), edgeR: q('#idEdgeR'), threadL: q('#idThreadL'), threadR: q('#idThreadR'),
      logo: q('#idLogo'), claspTop: q('#idClaspTop'), claspHook: q('#idClaspHook'), hook: q('#idHook'),
    }, {
      onLive: () => setLive(true),
      onGrab: setGrabbing,
      onFlip: () => setFlipped((f) => !f),
    });
    rig.current = r;
    return () => { wm.destroy(); r.destroy(); fb.destroy(); rig.current = football.current = null; };
  }, []);

  // Keyboard: Enter / Space flips it, ← / → give it a push
  const onCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); rig.current?.push(e.key === 'ArrowLeft' ? -1 : 1); }
  };

  const cardCls = `idcard${live ? ' is-live' : ''}${grabbing ? ' is-grabbing' : ''}${flipped ? ' is-flipped' : ''}`;

  return (
    <footer className="footer" id="footer" inert={inert}>
      <div className="ffoot" id="ffoot" ref={ffoot}>
        {/* Where the ID card's lanyard hangs from (footer-rig.css places it) */}
        <span className="ffoot__cardspace" id="ffootSpace" aria-hidden="true"></span>
        <div className="fend">
          {/* The giant "daniel": sized so the ink runs edge to edge of its box, the
              baseline just below its bottom edge; the "a" spins through other scripts,
              its language shown under it. Screen readers just hear "daniel". */}
          <div className="ffoot__wm" id="ffootWm">
            <div className="ffoot__mark" id="ffootMark" role="img" aria-label="daniel">
              <span className="ffoot__word" id="ffootWord">d<span className="ffoot__a" id="ffootA" aria-hidden="true"><span className="ffoot__glyph">a</span></span>nie<span className="ffoot__l">l</span><span className="ffoot__probe" aria-hidden="true" style={{ display: 'inline-block', width: 0, height: 0 }}></span></span>
            </div>
            {/* The footballers (football.ts; decorative: the wordmark already says "daniel") */}
            <canvas className="ffoot__football" aria-hidden="true" hidden></canvas>
            <div className="ffoot__base">
              <span className="ffoot__lang" id="ffootLang" aria-hidden="true">English</span>
              {/* Play / pause for the footballers (shown once they're ready) */}
              <button
                type="button" className="ffoot__play" id="ffootPlay" hidden={!ball.show}
                data-state={ball.playing ? 'playing' : 'paused'}
                aria-label={ball.playing ? 'Pause football animation' : 'Play football animation'}
                onClick={() => football.current?.toggle()}
              >
                <svg className="ffoot__play-pause" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4" y="3" width="2.6" height="10" rx="1" /><rect x="9.4" y="3" width="2.6" height="10" rx="1" /></svg>
                <svg className="ffoot__play-play" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.3v9.4a.8.8 0 0 0 1.2.7l7.4-4.7a.8.8 0 0 0 0-1.4L6.2 2.6A.8.8 0 0 0 5 3.3z" /></svg>
              </button>
            </div>
          </div>

          <figure className="fend__quote">
            <blockquote><p>“Life is a joking”</p></blockquote>
            <figcaption>— Neymar Jr.</figcaption>
          </figure>

          <nav className="fend__nav" aria-label="Contact and social links">
            <ul className="fend__links">
              <li><a href="mailto:danielfash2007@gmail.com">Email</a></li>
              {LINKS.map((l) => (
                <li key={l.label}><a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}<span className="sr"> (opens in a new tab)</span></a></li>
              ))}
            </ul>
          </nav>

          <p className="fend__legal">© <span id="year">{YEAR}</span> Daniel. Built with React &amp; TypeScript.</p>
        </div>

        {/* The ID card on its lanyard (idRig.ts runs the physics) */}
        <div className={`idrig${live ? ' is-live' : ''}`} id="idRig">
          <LanyardSvg />
          <div
            className={cardCls} id="idCard" tabIndex={0} role="button" aria-pressed={flipped}
            aria-label="ID card: Daniel Fasan, digital developer. Press Enter to flip it over." data-cursor="drag"
            onKeyDown={onCardKey}
          >
            <span className="idcard__clip" aria-hidden="true"></span>
            <div className="idcard__tilt">
              <div className="idcard__flip">
                {/* Front */}
                <div className="idcard__face idcard__front">
                  <p className="idcard__logo">daniel<span>.</span></p>
                  <img className="idcard__photo" src="images/me-card.webp" alt="" width={600} height={706} loading="lazy" decoding="async" draggable={false} />
                  <div className="idcard__name">
                    <strong>Daniel Fasan</strong>
                    <span></span>
                  </div>
                  <span className="idcard__sheen"></span>
                </div>
                {/* Back */}
                <div className="idcard__face idcard__back">
                  <div className="idcard__back-top"><span className="idcard__logo idcard__logo--small">daniel<span>.</span></span><span>ID · <span className="idcard__yr">{YEAR}</span></span></div>
                  <QrCode />
                  <p className="idcard__portfolio">Portfolio <span className="idcard__yr">{YEAR}</span></p>
                  <p className="idcard__email">danielfash2007@gmail.com</p>
                  <span className="idcard__barcode" aria-hidden="true"></span>
                  <span className="idcard__sheen"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
