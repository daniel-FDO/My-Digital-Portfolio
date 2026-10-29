/* =========================================================
   COMMAND MENU — "Ask me anything"
   Searches what's on this page (sections, projects, pages,
   links, skills, interests) and answers simple questions from
   the same content. No AI service: if there's no answer here,
   it says so and offers the email.
   Ctrl / ⌘ K opens and closes it, "/" opens it, "T" toggles the
   theme (when you're not typing). "X" (X-ray) is handled by
   components/xray/Xray.tsx.
   ========================================================= */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ABOUT_PAGE } from '../data/about';
import { EDUCATION } from '../data/education';
import { HOME, INTRO, PROJECTS } from '../data/home';
import { fmtSpoken } from '../lib/kentClock';
import { useNowPlaying } from '../lib/spotify';

export interface MenuActions {
  go: (sectionId: string) => void;
  openAbout: () => void;
  toggleTheme: () => void;
  toggleXray: () => void;
  copyEmail: () => void;
  backToTop: () => void;
}

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** the folder view is open: shortcuts stand down */
  blocked: boolean;
  actions: MenuActions;
}

const I = {
  section: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7" /></svg>,
  project: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
  page: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>,
  link: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>,
  action: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>,
};

interface Item {
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  kw: string;
  run: () => void;
  /** keep the menu open after running it */
  keep?: boolean;
}

const ext = (href: string) => () => { window.open(href, '_blank', 'noopener'); };
const join = (a: string[]) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const chapter = (n: number) => ABOUT_PAGE.chapters[n]?.paragraphs[0] ?? '';
const looksLikeQuestion = (q: string) => /\?\s*$/.test(q) || /^(what|where|who|how|when|which|why|are|is|do|does|can|tell|any)\b/i.test(q);
const Mail = () => <a href={`mailto:${HOME.email}`}>{HOME.email}</a>;

function score(item: Item, q: string) {
  const label = item.label.toLowerCase();
  if (!q) return 1;
  if (label.startsWith(q)) return 4;
  if (label.includes(q)) return 3;
  const hay = (label + ' ' + (item.hint || '') + ' ' + item.kw).toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return 0;
  const hits = words.filter((w) => hay.includes(w)).length;
  return hits === words.length ? 2 : hits && hits >= words.length / 2 ? 1 : 0;
}

export function CommandMenu({ open, setOpen, blocked, actions }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const restore = useRef(true);
  const now = useNowPlaying();

  const items = useMemo<Item[]>(() => {
    const skillWords = HOME.skills.flatMap((g) => g.items.map((i) => i[0])).join(' ');
    return [
      { group: 'Sections', label: 'Projects', icon: I.section, kw: 'work built portfolio sites', run: () => actions.go('projects') },
      { group: 'Sections', label: 'About', icon: I.section, kw: 'story me who', run: () => actions.go('about') },
      { group: 'Sections', label: 'Education', icon: I.section, kw: 'college school study t-level course ekc canterbury', run: () => actions.go('education') },
      { group: 'Sections', label: 'Tech stack', icon: I.section, kw: 'stack tech languages ' + skillWords, run: () => actions.go('skills') },
      { group: 'Sections', label: 'Gallery', icon: I.section, kw: 'photos pictures images carousel', run: () => actions.go('gallery') },
      { group: 'Sections', label: 'Activity', icon: I.section, kw: 'github contributions commits code', run: () => actions.go('activity') },
      { group: 'Sections', label: 'Contact', icon: I.section, kw: 'email hello hire message', run: () => actions.go('contact') },
      ...PROJECTS.map((p) => ({ group: 'Projects', label: p.name, hint: p.category, icon: I.project, kw: `${p.category} ${p.description} ${(p.tech || []).join(' ')}`, run: ext(p.url) })),
      { group: 'Pages', label: 'About me — photos & story', icon: I.page, kw: 'about gallery photos chapters lore', run: actions.openAbout },
      ...HOME.socials.map((s) => ({ group: 'Links', label: s.label, icon: I.link, kw: 'social profile', run: ext(s.href) })),
      { group: 'Links', label: 'Email Daniel', hint: HOME.email, icon: I.link, kw: 'mail contact', run: () => { location.href = 'mailto:' + HOME.email; } },
      { group: 'Actions', label: 'Toggle theme', hint: 'T', icon: I.action, kw: 'dark light mode', run: actions.toggleTheme, keep: true },
      { group: 'Actions', label: 'Toggle X-ray', hint: 'X', icon: I.action, kw: 'inspect how built source code devtools parts data', run: actions.toggleXray },
      { group: 'Actions', label: 'Copy email address', icon: I.action, kw: 'clipboard', run: actions.copyEmail },
      { group: 'Actions', label: 'Back to top', icon: I.action, kw: 'scroll up home', run: actions.backToTop },
    ];
  }, [actions]);

  /* ---- Answers, from this page's own content ---- */
  const answerFor = (q: string): ReactNode => {
    const learning = (HOME.skills.find((g) => /learning/i.test(g.group)) || { items: [] }).items.map((i) => i[0]);
    const ANSWERS: { re: RegExp; a: () => ReactNode }[] = [
      { re: /\b(photos?|pictures?|gallery|images?)\b/, a: () => 'There’s a photo gallery further down the page: drag, swipe or use the arrow buttons.' },
      { re: /\b(where|based|live|from|location|kent|uk)\b/, a: () => `Daniel is based in ${HOME.location}.` },
      { re: /\b(stud|college|school|course|t-?level|education|ekc|qualif|grade|year)/, a: () => EDUCATION.card.text },
      { re: /\b(learn|learning|next|improv)/, a: () => `Right now he’s learning ${join(learning)}.` },
      { re: /\b(skill|stack|tech|language|know|tools?|code in|program)/, a: () => HOME.skills.map((g, i) => <span key={g.group}>{i > 0 && <br />}<b>{g.group}:</b> {g.items.map((it) => it[0]).join(', ')}</span>) },
      { re: /\b(project|built|build|made|make|work|portfolio|site)/, a: () => `${PROJECTS.length} projects so far: ${join(PROJECTS.map((p) => p.name))}. The newest is ${PROJECTS[0].name}: ${PROJECTS[0].description}` },
      { re: /\b(contact|email|e-mail|reach|hire|message|talk|opportunit)/, a: () => <>Email <Mail />, or find him on <a href={HOME.socials[1].href} target="_blank" rel="noopener noreferrer">LinkedIn</a>.</> },
      { re: /\b(music|listen|song|spotify|playing|track)/, a: () => (now.data
        ? `${now.state === 'playing' ? 'Playing right now' : now.state === 'paused' ? 'Paused on' : 'Last played'}: “${now.data.title}”${now.data.artist ? ' by ' + now.data.artist : ''}.`
        : 'Spotify isn’t answering right now, but music is always on. Try the music widget at the top of the page.') },
      { re: /\b(future|plan|plans|heading|apprentice|university|uni|career|goal|cyber)/, a: () => chapter(2) },
      { re: /\b(start|started|begin|first|how did)/, a: () => chapter(1) },
      { re: /\b(time|clock|o'?clock)\b/, a: () => `It’s ${fmtSpoken.format(new Date())} in Kent right now.` },
      { re: /\b(who|about|yourself|daniel|you)\b/, a: () => [INTRO.role, INTRO.study, INTRO.learning].map((t) => t.trim().replace(/[.]?$/, '.')).join(' ') },
    ];
    const s = q.toLowerCase();
    for (const x of ANSWERS) if (x.re.test(s)) { const a = x.a(); if (a) return a; }
    return null;
  };

  /* ---- Search ---- */
  const raw = query.trim();
  const q = raw.toLowerCase();
  let results = items.map((it, i) => ({ it, i, s: score(it, q) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.it);
  if (q) results = results.slice(0, 12);
  // Answer card for questions (or when nothing matched)
  let answer: ReactNode = null;
  if (q && (looksLikeQuestion(raw) || !results.length)) {
    answer = answerFor(q) || <>There’s nothing about that on this site yet. You could ask Daniel directly: <Mail />.</>;
  }
  const count = results.length
    ? `${results.length} result${results.length === 1 ? '' : 's'}${answer ? ' · answer above' : ''}`
    : (answer ? 'Answer above' : 'No results');
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  // A new search starts at the top of the list
  useEffect(() => { setActive(0); }, [query]);

  // The highlighted result stays in view
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, query, open]);

  /* ---- Open / close ---- */
  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      restore.current = true;
      setQuery('');
      setActive(0);
      inputRef.current?.focus();
      return;
    }
    const back = lastFocus.current;
    lastFocus.current = null;
    if (restore.current && back && back.isConnected) back.focus({ preventScroll: true });
  }, [open]);

  const close = (restoreFocus = true) => { restore.current = restoreFocus; setOpen(false); };
  const run = (i: number) => {
    const it = results[i];
    if (!it) return;
    if (it.keep) { it.run(); return; }
    // Closed (and the page un-inert) before the action runs, so it can move focus there
    restore.current = false;
    flushSync(() => setOpen(false));
    it.run();
  };

  // The global shortcuts
  const state = useRef({ open, blocked, setOpen, toggleTheme: actions.toggleTheme });
  state.current = { open, blocked, setOpen, toggleTheme: actions.toggleTheme };
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const s = state.current;
      const t = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (s.open) { restore.current = true; s.setOpen(false); }
        else if (!s.blocked) s.setOpen(true);
      }
      else if (e.key === '/' && !typing && !s.open && !s.blocked) { e.preventDefault(); s.setOpen(true); }
      else if (e.key.toLowerCase() === 't' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !s.open && !s.blocked) s.toggleTheme();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) setActive((activeIndex + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) setActive((activeIndex - 1 + results.length) % results.length); }
    else if (e.key === 'Home' && !query) { e.preventDefault(); setActive(0); }
    else if (e.key === 'Enter') { e.preventDefault(); run(activeIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') {
      // Keep focus inside: input ↔ any link in the answer
      const links = Array.from(answerRef.current?.querySelectorAll('a') ?? []);
      if (!links.length) { e.preventDefault(); return; }
      if (!e.shiftKey) { e.preventDefault(); links[0].focus(); }
    }
  };

  let group = '';
  return (
    <div className="cmd" id="cmd" role="dialog" aria-modal="true" aria-labelledby="cmdTitle" hidden={!open} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="cmd__panel">
        <h2 className="sr" id="cmdTitle">Search and ask</h2>
        <div className="cmd__field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></svg>
          <input
            id="cmdInput" ref={inputRef} type="text" role="combobox" aria-expanded="true" aria-controls="cmdList" aria-autocomplete="list"
            aria-activedescendant={results.length ? `cmd-o${activeIndex}` : undefined}
            autoComplete="off" spellCheck={false} placeholder="Search projects, or ask about Daniel…" aria-label="Search projects, or ask about Daniel"
            value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKey}
          />
        </div>
        <div className="cmd__box">
          <div
            className="cmd__answer" id="cmdAnswer" ref={answerRef} hidden={!answer}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); close(); }
              if (e.key === 'Tab') { e.preventDefault(); inputRef.current?.focus(); }
            }}
          >
            {answer && <><small>From this site</small>{answer}</>}
          </div>
          <div className="cmd__list" id="cmdList" role="listbox" aria-label="Results" ref={listRef}>
            {results.map((it, i) => {
              const head = it.group !== group ? (group = it.group) : null;
              return (
                <ItemRow
                  key={it.group + it.label} item={it} i={i} head={head} selected={i === activeIndex}
                  onHover={() => { if (i !== activeIndex) setActive(i); }} onPick={() => run(i)}
                />
              );
            })}
            {!results.length && !answer && <p className="cmd__empty">No results</p>}
          </div>
          <div className="cmd__foot">
            <span id="cmdCount" role="status" aria-live="polite">{open ? count : ''}</span>
            <span className="cmd__keys"><span>Open</span><kbd>↵</kbd><span>Close</span><kbd>Esc</kbd></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item, i, head, selected, onHover, onPick }: { item: Item; i: number; head: string | null; selected: boolean; onHover: () => void; onPick: () => void }) {
  return (
    <>
      {head && <div className="cmd__group" role="presentation">{head}</div>}
      <div className="cmd__item" role="option" id={`cmd-o${i}`} data-i={i} aria-selected={selected} onPointerMove={onHover} onClick={onPick}>
        {item.icon}<span>{item.label}</span>{item.hint && <em>{item.hint}</em>}
      </div>
    </>
  );
}
