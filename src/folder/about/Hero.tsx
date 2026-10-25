/* =========================================================
   1. THE INTRODUCTORY DESK
   The name in the middle, and the things around it: the ID badge
   (flips), the record (opens), a football sticker and polaroids
   (draggable with a mouse), the ticket, the Notepad window and the
   terminal. Desktop: placed across the desk; smaller screens: a
   vertical scrapbook (positions live in about.css).
   ========================================================= */
import { useRef, useState, type RefObject } from 'react';
import { DESK } from '../../data/aboutDesk';
import { Clip, DeskDialog, RegMark, Sparkle, Squiggle, Swoosh, Tape, useDrag, vars } from './desk';
import { NotepadCard } from './Notepad';
import { Terminal } from './Terminal';

export function Hero() {
  const deskRef = useRef<HTMLDivElement>(null);
  return (
    <section className="dk-hero" aria-labelledby="dkName">
      <div className="dk-hero__desk" ref={deskRef}>
        <div className="dk-hero__title" data-reveal style={vars({ '--d': '0.12s' })}>
          <h1 className="dk-sign" id="dkName" tabIndex={-1}>{DESK.name}</h1>
          <Swoosh className="dk-sign__swoosh" />
          <p className="dk-tagline">{DESK.tagline}</p>
          <p className="dk-meta">{DESK.meta}</p>
        </div>
        <IdBadge />
        <Vinyl />
        <Sticker area={deskRef} />
        <TornStrip />
        <Ticket />
        <Polaroids area={deskRef} />
        <NotepadCard />
        <Terminal />
      </div>
      <IntroNote />
    </section>
  );
}

/* ---- A: the hanging ID badge (flips over) ---- */
function IdBadge() {
  const B = DESK.badge;
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="dk-obj dk-badge" data-reveal="drop" style={vars({ '--d': '0.05s' })}>
      <div className="dk-badge__swing">
        <span className="dk-badge__strap" aria-hidden="true"><span>DANIEL FASAN · LEARNING BY BUILDING ·</span></span>
        <span className="dk-badge__hook" aria-hidden="true"></span>
        <div className={`dk-badge__card${flipped ? ' is-flipped' : ''}`}>
          <div className="dk-badge__face dk-badge__front" aria-hidden={flipped}>
            <span className="dk-badge__slot" aria-hidden="true"></span>
            <p className="dk-badge__name">{DESK.name}</p>
            <p className="dk-badge__role">{B.role}</p>
            <span className="dk-badge__photo">
              <img src={B.photo.src} alt={B.photo.alt} width="240" height="240" decoding="async" draggable={false} style={{ objectPosition: B.photo.position }} />
            </span>
            <p className="dk-badge__line">{B.line}</p>
            <span className="dk-badge__code" aria-hidden="true"><i></i><span>{B.number}</span></span>
          </div>
          <div className="dk-badge__face dk-badge__back" aria-hidden={!flipped}>
            <span className="dk-badge__slot" aria-hidden="true"></span>
            <p className="dk-badge__hello">Hello,</p>
            <p className="dk-badge__intro">{B.back}</p>
            <p className="dk-badge__valid">{B.valid}</p>
          </div>
        </div>
        <button type="button" className="dk-badge__flip" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)} data-label={flipped ? 'Flip back' : 'Flip'}>
          <span className="dk-sr">Flip the ID badge</span>
        </button>
      </div>
    </div>
  );
}

/* ---- C: the record in its sleeve (opens the interests card) ---- */
function Vinyl() {
  const V = DESK.vinyl;
  const [open, setOpen] = useState(false);
  return (
    <div className="dk-obj dk-vinyl" data-reveal style={vars({ '--d': '0.3s' })}>
      <button type="button" className="dk-vinyl__btn" onClick={() => setOpen(true)} aria-haspopup="dialog" data-label="Open">
        <span className="dk-vinyl__record" aria-hidden="true"><span className="dk-vinyl__label">DF<small>33⅓</small></span></span>
        <span className="dk-vinyl__sleeve">
          <span className="dk-vinyl__side">{V.side}</span>
          <strong className="dk-vinyl__title">{V.title}</strong>
          <span className="dk-vinyl__sub">{V.sub}</span>
        </span>
      </button>
      <DeskDialog open={open} onClose={() => setOpen(false)} labelledBy="dkVinylTitle" className="dk-dialog--card">
        <div className="dk-card dk-interests">
          <Tape className="dk-interests__tape" />
          <button type="button" className="dk-close" onClick={() => setOpen(false)} aria-label="Close">&#10005;</button>
          <p className="dk-mono dk-interests__kicker">{V.side} · tracklist</p>
          <h2 className="dk-interests__title" id="dkVinylTitle">{V.title}</h2>
          <ol className="dk-interests__list">
            {V.interests.map((it, i) => (
              <li key={it.name}>
                <span className="dk-mono dk-interests__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="dk-interests__name">{it.name}</span>
                <span className="dk-hand dk-interests__note">{it.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </DeskDialog>
    </div>
  );
}

/* ---- D: the football sticker (YNWA) ---- */
function Sticker({ area }: { area: RefObject<HTMLElement | null> }) {
  const ref = useDrag<HTMLDivElement>(area);
  return (
    <div className="dk-obj dk-sticker dk-drag" ref={ref} data-reveal="drop" style={vars({ '--d': '0.36s' })} data-label="Drag">
      <span className="dk-sticker__disc" role="img" aria-label="A red football sticker: Liverpool supporter">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="20" fill="#fff" />
          <path d="M32 22.5l8.6 6.2-3.3 10.1H26.7l-3.3-10.1z" fill="#1b1b1b" />
          <path d="M32 22.5V12.6M40.6 28.7l9.3-3M37.3 38.8l5.8 7.9M26.7 38.8l-5.8 7.9M23.4 28.7l-9.3-3" stroke="#1b1b1b" strokeWidth="1.8" fill="none" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="#1b1b1b" strokeWidth="2" />
        </svg>
      </span>
      <span className="dk-hand dk-sticker__label">YNWA.</span>
    </div>
  );
}

/* ---- G: torn paper with a pencil, a coffee and tape (decorative) ---- */
function TornStrip() {
  return (
    <div className="dk-obj dk-strip" data-reveal style={vars({ '--d': '0.2s' })} aria-hidden="true">
      <span className="dk-strip__paper"></span>
      <Tape className="dk-strip__tape" />
      <Clip className="dk-strip__clip" />
      <span className="dk-hand dk-strip__note">don’t delete this</span>
      <svg className="dk-strip__mug" viewBox="0 0 120 100">
        <path d="M86 40c16-4 24 4 22 12s-10 14-24 10" fill="none" stroke="#e7e2d8" strokeWidth="9" strokeLinecap="round" />
        <circle cx="50" cy="50" r="40" fill="#f4f1ea" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#d6cfc2" />
        <circle cx="50" cy="50" r="32" fill="#e8e2d6" />
        <circle cx="50" cy="50" r="28" fill="#5a3a22" />
        <circle cx="50" cy="50" r="28" fill="url(#dkCrema)" />
        <ellipse cx="41" cy="41" rx="9" ry="5" fill="#fff" opacity=".18" transform="rotate(-30 41 41)" />
        <defs>
          <radialGradient id="dkCrema" cx=".45" cy=".42" r=".6"><stop offset="0" stopColor="#b9875a" stopOpacity=".9" /><stop offset=".7" stopColor="#7a5230" stopOpacity=".4" /><stop offset="1" stopColor="#3f2716" stopOpacity="0" /></radialGradient>
        </defs>
      </svg>
      <svg className="dk-strip__pencil" viewBox="0 0 20 200">
        <path d="M3 32h14v146H3z" fill="#f2c230" />
        <path d="M8 32h4v146H8z" fill="#e3ad19" />
        <path d="M3 32 10 6l7 26z" fill="#e9cfa4" />
        <path d="M8.1 13 10 6l1.9 7z" fill="#3a3a3a" />
        <path d="M2.6 178h14.8v12H2.6z" fill="#c6c9cc" />
        <path d="M2.6 182h14.8M2.6 186h14.8" stroke="#9fa3a7" strokeWidth="1" />
        <path d="M3 190h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="#e88c8c" />
      </svg>
    </div>
  );
}

/* ---- E: the ticket ---- */
function Ticket() {
  const t = DESK.ticket;
  return (
    <div className="dk-obj dk-ticket" data-reveal style={vars({ '--d': '0.26s' })}>
      <div className="ticket">
        <span className="ticket__stub" aria-hidden="true"><span>ADMIT ONE · No. 2023</span></span>
        <div className="ticket__main">
          <p className="ticket__title">{t.title[0]} <span>{t.title[1]}</span><br />{t.title[2]}</p>
          <dl className="ticket__meta">
            <div><dt>Since</dt><dd>2023</dd></div>
            <div><dt>Venue</dt><dd>Kent, UK</dd></div>
            <div><dt>Gate</dt><dd>Curiosity</dd></div>
          </dl>
          <p className="ticket__sub">{t.sub}</p>
        </div>
        <span className="ticket__tear" aria-hidden="true"><span className="ticket__bars"></span><span className="ticket__no">DF · 001</span></span>
      </div>
    </div>
  );
}

/* ---- H: polaroids on kraft paper (draggable) ---- */
function Polaroids({ area }: { area: RefObject<HTMLElement | null> }) {
  return (
    <div className="dk-obj dk-collage" data-reveal style={vars({ '--d': '0.34s' })}>
      <span className="dk-collage__kraft" aria-hidden="true"></span>
      <p className="dk-hand dk-collage__title">things I’ve made</p>
      {DESK.polaroids.map((p, i) => <Polaroid key={p.src} {...p} i={i} area={area} />)}
      <Sparkle className="dk-collage__spark" />
    </div>
  );
}
function Polaroid({ src, alt, caption, i, area }: { src: string; alt: string; caption: string; i: number; area: RefObject<HTMLElement | null> }) {
  const ref = useDrag<HTMLElement>(area);
  return (
    <figure className={`polaroid dk-drag polaroid--${i}`} ref={ref} data-label="Drag">
      <Tape className="polaroid__tape" />
      <span className="polaroid__photo"><img src={src} alt={alt} width="400" height="300" decoding="async" draggable={false} /></span>
      <figcaption className="dk-hand">{caption}</figcaption>
    </figure>
  );
}

/* ---- the sticky note + a few lines in typewriter, under the desk ---- */
function IntroNote() {
  const I = DESK.intro;
  const area = useRef<HTMLDivElement>(null);
  const note = useDrag<HTMLDivElement>(area);
  return (
    <div className="dk-intro" ref={area}>
      <RegMark className="dk-reg--a" /><RegMark className="dk-reg--b" />
      <div className="dk-sticky dk-drag" ref={note} data-reveal="settle" data-label="Drag">
        <span className="dk-sticky__holes" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <p>{I.note}</p>
      </div>
      <div className="dk-intro__lines" data-reveal style={vars({ '--d': '0.1s' })}>
        {I.lines.map(([a, box, b], i) => (
          <p key={i}>
            {i === 0 && <Squiggle className="dk-intro__squiggle" />}
            {i === 1 && <Sparkle className="dk-intro__spark" />}
            {a}<span className="dk-boxed">{box}</span>{b}
          </p>
        ))}
      </div>
      <RegMark className="dk-reg--c" /><RegMark className="dk-reg--d" />
    </div>
  );
}
