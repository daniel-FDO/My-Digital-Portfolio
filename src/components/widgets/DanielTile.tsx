/* =========================================================
   DANIEL — the "Hello, I'm Daniel." card.
   The name, handwritten in one pen stroke: the red full stop writes it
   when the card comes into view, and the ink can be plucked, pulled and
   rewritten (nameScript.ts). Daniel the character sits on the right
   (ENABLE_DANIEL_CHARACTER).
   ========================================================= */
import { useRef } from 'react';
import '@fontsource-variable/nunito';
import { DanielCharacter, ENABLE_DANIEL_CHARACTER } from '../daniel/DanielCharacter';
import { INK_WIDTH, VIEWBOX, useNameScript } from './nameScript';

export function DanielTile() {
  const rootRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  useNameScript(rootRef, wordRef);

  return (
    <div className={`w tile daniel${ENABLE_DANIEL_CHARACTER ? ' daniel--with-character' : ''}`} ref={rootRef}>
      <span className="w__label" aria-hidden="true">Hello, I’m</span>
      <span
        ref={wordRef} className="daniel__word" role="button" tabIndex={0}
        aria-label="Daniel" aria-description="Handwritten. Press to write it again."
      >
        <svg className="daniel__script" viewBox={VIEWBOX} preserveAspectRatio="xMinYMax meet" aria-hidden="true" focusable="false">
          <g className="daniel__pen" fill="none" stroke="currentColor" strokeWidth={INK_WIDTH} strokeLinecap="round" strokeLinejoin="round">
            <path className="daniel__ink" />
            <path className="daniel__ink" />
          </g>
          <circle className="daniel__tittle" fill="currentColor" r="0" />
          <ellipse className="daniel__stop" rx="0" ry="0" />
        </svg>
      </span>
      {ENABLE_DANIEL_CHARACTER && <DanielCharacter />}
    </div>
  );
}
