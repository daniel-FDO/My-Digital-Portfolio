/* =========================================================
   NOTEPAD — where it started (2023)
   - NotepadCard: the small window on the desk (opens the big one)
   - NotepadDialog: the big window: the file, the story, and the
     Easter egg — "View first attempt" swaps in a tiny 2023-style
     page (a recreation for fun, not the original file)
   ========================================================= */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DESK } from '../../data/aboutDesk';
import { ArrowShort, DeskDialog, useDesk, vars } from './desk';

const N = DESK.notepad;

const Code = () => <pre className="np__code"><code>{N.code.join('\n')}</code></pre>;

function TitleBar({ children }: { children?: ReactNode }) {
  return (
    <div className="np__bar">
      <span className="np__icon" aria-hidden="true"></span>
      <span className="np__title">{N.title}</span>
      <span className="np__ctl" aria-hidden="true"><i>&#8211;</i><i>&#9633;</i></span>
      {children ?? <span className="np__x" aria-hidden="true">&#10005;</span>}
    </div>
  );
}
const Menu = () => (
  <div className="np__menu" aria-hidden="true"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div>
);

export function NotepadCard() {
  const { openNotepad } = useDesk();
  return (
    <div className="dk-obj dk-np" data-reveal style={vars({ '--d': '0.42s' })}>
      <button type="button" className="np np--mini" onClick={openNotepad} aria-haspopup="dialog" data-label="Open"
        aria-label="Open first-portfolio.html in Notepad: where it started, in 2023">
        <TitleBar />
        <Menu />
        <Code />
      </button>
      <p className="dk-hand dk-np__label"><ArrowShort className="dk-np__arrow" />{N.label}</p>
    </div>
  );
}

export function NotepadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [then, setThen] = useState(false);   // the Easter egg: 2023 vs 2026
  const egg = useRef<HTMLButtonElement>(null);
  const wasThen = useRef(false);
  // Back from 2023: focus returns to the link that went there
  useEffect(() => { if (wasThen.current && !then) egg.current?.focus(); wasThen.current = then; }, [then]);
  const close = () => { onClose(); setThen(false); };

  return (
    <DeskDialog open={open} onClose={close} labelledBy="npTitle" className="dk-dialog--np">
      <div className="np np--big">
        <TitleBar>
          <button type="button" className="np__x np__x--real" onClick={close} aria-label="Close Notepad">&#10005;</button>
        </TitleBar>
        <h2 className="dk-sr" id="npTitle">{then ? 'My first website (a 2023-style recreation)' : 'first-portfolio.html, where it started'}</h2>
        {!then ? (
          <>
            <Menu />
            <div className="np__page">
              <Code />
              <p className="np__story">
                <span className="np__comment" aria-hidden="true">&lt;!-- </span>{N.story}<span className="np__comment" aria-hidden="true"> --&gt;</span>
              </p>
            </div>
            <div className="np__status">
              <button type="button" className="np__egg" ref={egg} onClick={() => setThen(true)}>View first attempt.</button>
              <span aria-hidden="true">Ln 7, Col 22</span>
              <span aria-hidden="true">Windows (CRLF)</span>
            </div>
          </>
        ) : (
          <div className="np__then">
            <div className="np__address" aria-hidden="true">file:///C:/Users/Daniel/Desktop/first-portfolio.html</div>
            {/* Intentionally plain: browser defaults, like a first website */}
            <div className="np__site">
              <h3>Hello World!</h3>
              <p>Welcome to my website. This is my first website and I made it myself.</p>
              <hr />
              <p><b>About me:</b> I like computers and games.</p>
              <ul>
                <li><a href="mailto:danielfash2007@gmail.com">Email me</a></li>
                <li><a href="https://github.com/daniel-FDO" target="_blank" rel="noopener noreferrer">My GitHub</a></li>
              </ul>
              <p><small>Best viewed in any browser.</small></p>
            </div>
            <div className="np__then-foot">
              <p className="dk-hand">A recreation for fun, not the archived original.</p>
              <button type="button" className="dk-btn" onClick={() => setThen(false)} autoFocus>Back to 2026.</button>
            </div>
          </div>
        )}
      </div>
    </DeskDialog>
  );
}
