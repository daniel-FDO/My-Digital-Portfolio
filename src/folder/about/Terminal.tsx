/* =========================================================
   TERMINAL — a small working prompt on the desk.
   Starts with `whoami` already run; understands a few commands
   (help, whoami, about, skills, projects, ls, clear).
   ========================================================= */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DESK } from '../../data/aboutDesk';
import { vars } from './desk';

const T = DESK.terminal;
const M = DESK.making;

type Entry = { cmd: string; out: string[] };

const COMMANDS: Record<string, () => string[]> = {
  help: () => ['commands: whoami  about  skills  projects  ls  clear'],
  whoami: () => T.whoami.map((l) => `> ${l}`),
  about: () => ['> Second-year T Level student, EKC Canterbury College', '> Finishing summer 2027. Exploring what comes next.'],
  skills: () => [`> using:    ${M.using.items.map(([s]) => s).join(', ')}`, `> learning: ${M.learning.items.join(', ')}`],
  projects: () => M.projects.map((p) => `> ${p.name}${p.status === 'Live' ? '' : ` (${p.status.toLowerCase()})`}`),
  ls: () => ['projects/  notes/  first-portfolio.html'],
  sudo: () => ['> nice try.'],
};

export function Terminal() {
  const [log, setLog] = useState<Entry[]>([{ cmd: 'whoami', out: COMMANDS.whoami() }]);
  const [value, setValue] = useState('');
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const o = outRef.current; if (o) o.scrollTop = o.scrollHeight; }, [log]);

  const run = (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim(), cmd = raw.toLowerCase().split(/\s+/)[0];
    setValue('');
    if (!raw) return;
    if (cmd === 'clear') { setLog([]); return; }
    const out = COMMANDS[cmd]?.() ?? [`command not found: ${raw.slice(0, 24)}. try "help"`];
    setLog((l) => [...l, { cmd: raw.slice(0, 40), out }].slice(-8));
  };

  return (
    <div className="dk-obj dk-term" data-reveal style={vars({ '--d': '0.5s' })}>
      <div className="term" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
        <div className="term__bar" aria-hidden="true">
          <span className="term__dots"><i></i><i></i><i></i></span>
          <span className="term__title">daniel — zsh</span>
        </div>
        <div className="term__out" ref={outRef} role="log" aria-label="Terminal output" aria-live="polite">
          {log.map((e, i) => (
            <div key={i}>
              <p className="term__line"><span className="term__ps">{T.user}</span> {e.cmd}</p>
              {e.out.map((l, k) => <p className="term__res" key={k}>{l}</p>)}
            </div>
          ))}
          <form className="term__form" onSubmit={run}>
            <label className="term__ps" htmlFor="dkTermInput">{T.user}</label>
            <span className="term__caret" aria-hidden="true"></span>
            <input
              id="dkTermInput" ref={inputRef} className="term__input" value={value} onChange={(e) => setValue(e.target.value)}
              autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={40} enterKeyHint="go"
              placeholder="help" aria-describedby="dkTermHint"
            />
          </form>
        </div>
        <p className="dk-sr" id="dkTermHint">Type a command such as help, about or skills, then press Enter.</p>
      </div>
    </div>
  );
}
