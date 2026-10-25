/* =========================================================
   5. AWAY FROM THE KEYBOARD — five things scattered on the lower
   desk. Tapping one turns over its handwritten note. The cassette
   label shows what's really playing (or last played) on my Spotify,
   from the same feed as the home page's music widget.
   ========================================================= */
import { useState } from 'react';
import { DESK } from '../../data/aboutDesk';
import { useNowPlaying } from '../../lib/spotify';
import { vars } from './desk';

const OFF = DESK.offline;
type Key = (typeof OFF.items)[number]['key'];

export function Offline() {
  const [open, setOpen] = useState<Key | null>(null);
  return (
    <section className="dk-sec dk-offline" aria-labelledby="dkOffTitle">
      <header className="dk-sec__head dk-sec__head--center" data-reveal>
        <p className="dk-mono dk-kicker">away from the keyboard</p>
        <h2 className="dk-h2" id="dkOffTitle">{OFF.heading}</h2>
      </header>
      <ul className="dk-offline__desk">
        {OFF.items.map((it, i) => {
          const on = open === it.key;
          return (
            <li className={`dk-off dk-off--${it.key}${on ? ' is-open' : ''}`} key={it.key} data-reveal style={vars({ '--d': `${0.05 + i * 0.08}s` })}>
              <button type="button" className="dk-off__obj" aria-expanded={on} aria-controls={`dkOff-${it.key}`} onClick={() => setOpen(on ? null : it.key)} data-label={on ? 'Close' : 'Read'}>
                <span className="dk-sr">{it.label}</span>
                <Thing k={it.key} />
              </button>
              <p className="dk-off__note dk-hand" id={`dkOff-${it.key}`} hidden={!on}>{it.note}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Thing({ k }: { k: Key }) {
  if (k === 'football') return (
    <span className="dk-match" aria-hidden="true">
      <span className="dk-match__club">Liverpool FC</span>
      <span className="dk-match__ground">Anfield · Matchday</span>
      <span className="dk-match__row"><span>Stand<b>Kop</b></span><span>Row<b>YNWA</b></span></span>
      <svg className="dk-match__ball" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#1b1b1b" strokeWidth="1.6" /><path d="M20 13l6.6 4.8-2.5 7.8h-8.2l-2.5-7.8z" fill="#1b1b1b" /></svg>
    </span>
  );
  if (k === 'gaming') return (
    <span className="dk-cart" aria-hidden="true">
      <span className="dk-cart__grip"></span>
      <span className="dk-cart__label"><b>SAVE FILE 01</b><span>curiosity.sav</span></span>
    </span>
  );
  if (k === 'music') return <Cassette />;
  if (k === 'trading') return (
    <span className="dk-trade" aria-hidden="true">
      <span className="dk-mono dk-trade__head">markets 101</span>
      <svg viewBox="0 0 160 80">
        {[[12, 30, 50, 1], [26, 24, 44, 1], [40, 34, 56, 0], [54, 28, 46, 1], [68, 18, 38, 1], [82, 26, 48, 0], [96, 14, 32, 1], [110, 20, 36, 0], [124, 10, 28, 1], [138, 6, 22, 1]].map(([x, a, b, up]) => (
          <g key={x}><path d={`M${x} ${a - 6}V${b + 6}`} stroke="#555" strokeWidth="1" /><rect x={x - 4} y={a} width="8" height={b - a} fill={up ? '#5d9a64' : '#c95b4d'} /></g>
        ))}
        <path d="M8 60c30-6 50 2 80-14s40-12 64-30" fill="none" stroke="#4267a9" strokeWidth="1.6" strokeDasharray="3 3" />
      </svg>
      <span className="dk-hand dk-trade__q">buy high, sell low?? (no)</span>
    </span>
  );
  return (
    <span className="dk-swatch" aria-hidden="true">
      <span className="dk-swatch__sketch">
        <svg viewBox="0 0 120 84"><rect x="6" y="6" width="108" height="72" rx="4" fill="none" stroke="#333" strokeWidth="1.4" /><path d="M16 18h44M16 26h28" stroke="#333" strokeWidth="2.6" strokeLinecap="round" /><rect x="16" y="36" width="40" height="30" rx="2" fill="none" stroke="#333" strokeDasharray="3 3" /><path d="M66 38h38M66 46h30M66 54h34" stroke="#333" strokeWidth="1.6" strokeLinecap="round" /><rect x="66" y="60" width="22" height="8" rx="4" fill="#333" /></svg>
        <span className="dk-hand">v7?</span>
      </span>
      {['#222222', '#f8f7f2', '#4267a9', '#c95b4d', '#f9df88'].map((c, i) => (
        <span className="dk-swatch__chip" key={c} style={vars({ '--c': c, '--i': i })}><span className="dk-mono">{c.slice(1)}</span></span>
      ))}
    </span>
  );
}

function Cassette() {
  const { data, state } = useNowPlaying();
  const track = data && data.title && state !== 'loading' && state !== 'none'
    ? `${state === 'playing' ? 'now playing' : 'last played'}: ${data.title}${data.artist ? ` — ${data.artist}` : ''}`
    : null;
  return (
    <span className="dk-tape-c" aria-hidden="true">
      <span className="dk-tape-c__label">
        <span className="dk-hand dk-tape-c__title">desk mix · side B</span>
        <span className="dk-mono dk-tape-c__track">{track ?? 'tracklist: whatever’s on'}</span>
      </span>
      <span className="dk-tape-c__window"><i></i><i></i></span>
    </span>
  );
}
