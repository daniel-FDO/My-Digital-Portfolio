import { useRef } from 'react';
import '@fontsource-variable/nunito';
import { DanielCharacter, ENABLE_DANIEL_CHARACTER } from '../daniel/DanielCharacter';
import { useNameFragments } from './useNameFragments';
import '../../styles/name-fragments.css';

export function DanielTile() {
  const rootRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useNameFragments(rootRef, wordRef, canvasRef);

  return (
    <div className={`w tile daniel${ENABLE_DANIEL_CHARACTER ? ' daniel--with-character' : ''}`} ref={rootRef}>
      <span className="w__label" aria-hidden="true">Hello, I’m</span>
      <button ref={wordRef} type="button" className="daniel__word daniel__play" aria-label="Animate Daniel’s name" aria-describedby="namePlayHint">
        {[...'Daniel'].map((ch, i) => <span key={i} className="daniel__ch" aria-hidden="true">{ch}</span>)}
        <span className="daniel__dot" aria-hidden="true">.</span>
      </button>
      <canvas ref={canvasRef} className="daniel__fragments" aria-hidden="true" />
      <span className="daniel__hint" id="namePlayHint">
        <span className="daniel__hint-fine">Move across my name · click to scatter</span>
        <span className="daniel__hint-touch">Tap my name to scatter it</span>
      </span>
      {ENABLE_DANIEL_CHARACTER && <DanielCharacter />}
    </div>
  );
}
