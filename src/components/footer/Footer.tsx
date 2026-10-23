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

/* The links show as icons (24 × 24, filled): an envelope, and the brand
   marks from Simple Icons (Spotify's is the music widget's) */
const MAIL_ICON = 'M1.5 4.5h21A1.5 1.5 0 0 1 24 6v.3l-12 7.2L0 6.3V6a1.5 1.5 0 0 1 1.5-1.5zM0 8.6l12 7.2 12-7.2V18a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 0 18z';

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/daniel-FDO',
    icon: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/daniel-fasan-a0b503331/',
    icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  { label: 'Spotify', href: 'https://open.spotify.com/user/313dgijnrcg4vwkwuuryvr4wqfb4?si=e403baac359541ba',
    icon: 'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.85-1.74-6.45-2.14-10.68-1.17a.75.75 0 1 1-.33-1.46c4.63-1.06 8.6-.6 11.77 1.34.36.22.47.68.25 1.04zm1.47-3.26a.94.94 0 0 1-1.29.3c-3.26-2-8.24-2.59-12.1-1.42a.94.94 0 0 1-.54-1.8c4.41-1.33 9.9-.69 13.63 1.6.44.28.58.86.3 1.32zm.13-3.4C15.2 8.33 8.77 8.12 5.05 9.25a1.13 1.13 0 1 1-.65-2.16c4.27-1.3 11.37-1.04 15.85 1.62a1.13 1.13 0 0 1-1.15 1.93z' },
  { label: 'Instagram', href: 'https://www.instagram.com/d4ni3lllll__?stkn=Y2Y0Njk3NjczeW91&utm_source=qr',
    icon: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z' },
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
              <li><a href="mailto:danielfash2007@gmail.com" title="Email"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={MAIL_ICON} /></svg><span className="sr">Email</span></a></li>
              {LINKS.map((l) => (
                <li key={l.label}><a href={l.href} target="_blank" rel="noopener noreferrer" title={l.label}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={l.icon} /></svg><span className="sr">{l.label} (opens in a new tab)</span></a></li>
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
