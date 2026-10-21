/* =========================================================
   NAME FONTS — development preview (fonts-preview.html, dev server only)
   "Daniel Fasan" in every installed font, with its name, variant,
   licence and live loading status (loader.ts: loading → ready, or
   failed with the reason), then every blocked font and why. All fonts
   load here at once on purpose — this page is for reviewing the set;
   the heading itself loads them one at a time.
   ========================================================= */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BLOCKED_FONTS, cssFamily, READY_FONTS } from './fonts';
import { load, NAME, onStatus, statusOf } from './loader';

function Preview() {
  const [, tick] = useState(0);
  useEffect(() => {
    const off = onStatus(() => tick((n) => n + 1));
    READY_FONTS.forEach((f) => { load(f).catch(() => {}); });
    return off;
  }, []);
  const counts = READY_FONTS.reduce((a, f) => { a[statusOf(f).state] = (a[statusOf(f).state] || 0) + 1; return a; }, {} as Record<string, number>);
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px', font: '14px/1.5 Geist, system-ui, sans-serif', color: '#e9e8e4' }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Name fonts <span style={{ color: '#a19e99', fontWeight: 400 }}>— development preview</span></h1>
      <p style={{ color: '#a19e99' }} data-summary="">
        {READY_FONTS.length} installed · {BLOCKED_FONTS.length} blocked · status: {Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'grid', gap: 10 }}>
        {READY_FONTS.map((f, i) => {
          const s = statusOf(f);
          return (
            <li key={f.family} data-family={f.family} data-state={s.state}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 16, alignItems: 'center', padding: '14px 18px', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, background: 'rgba(255,255,255,.03)' }}>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="pv-name" style={{ fontFamily: s.state === 'ready' ? `"${cssFamily(f)}"` : 'Geist', fontWeight: f.weight, fontStyle: f.style, letterSpacing: `${f.tracking ?? 0}em`, fontSize: 'clamp(30px, 6vw, 60px)', lineHeight: 1.2, whiteSpace: 'nowrap', opacity: s.state === 'ready' ? 1 : 0.25 }}>{NAME}</div>
              </div>
              <div style={{ fontSize: 12.5, color: '#a19e99' }}>
                <b style={{ color: '#e9e8e4', fontSize: 14 }}>{i + 1}. {f.family}</b> · {f.variant} {f.weight}{f.style === 'italic' ? ' italic' : ''}<br />
                {f.designer} · {f.licence}<br />
                <span style={{ color: s.state === 'ready' ? '#9fe0b0' : s.state === 'failed' ? '#ff9a8f' : '#e8c46a' }}>
                  {s.state === 'ready' ? 'Loaded, verified (renders its own glyphs)' : s.state === 'failed' ? `Failed: ${s.reason}` : 'Loading…'}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <h2 style={{ fontSize: 16, marginTop: 36 }}>Blocked ({BLOCKED_FONTS.length})</h2>
      <ul style={{ paddingLeft: 18, color: '#a19e99' }}>
        {BLOCKED_FONTS.map((f) => <li key={f.family} data-blocked={f.family} style={{ marginBottom: 8 }}><b style={{ color: '#e9e8e4' }}>{f.family}</b> ({f.designer}): {f.reason}</li>)}
      </ul>
    </main>
  );
}

document.body.style.cssText = 'margin:0;background:#111110';
createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>);
