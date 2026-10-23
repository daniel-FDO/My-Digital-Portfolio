/* =========================================================
   DANIEL — the "Hello, I'm Daniel." card.
   The name in Nunito with its red full stop, which every so often hops
   across the letters like a bouncing ball (useNameHop.ts; also on a
   click / tap or when a mouse comes onto the name; still with reduced
   motion). Daniel the character sits on the right
   (ENABLE_DANIEL_CHARACTER).
   ========================================================= */
import { useRef } from 'react';
import '@fontsource-variable/nunito';
import { DanielCharacter, ENABLE_DANIEL_CHARACTER } from '../daniel/DanielCharacter';
import { useNameHop } from './useNameHop';

export function DanielTile() {
  const rootRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  useNameHop(rootRef, wordRef);

  return (
    <div className={`w tile daniel${ENABLE_DANIEL_CHARACTER ? ' daniel--with-character' : ''}`} ref={rootRef}>
      <span className="w__label" aria-hidden="true">Hello, I’m</span>
      <span ref={wordRef} className="daniel__word" role="img" aria-label="Daniel">
        {[...'Daniel'].map((ch, i) => <span key={i} className="daniel__ch" aria-hidden="true">{ch}</span>)}
        <span className="daniel__dot" aria-hidden="true">.</span>
      </span>
      {ENABLE_DANIEL_CHARACTER && <DanielCharacter />}
    </div>
  );
}
