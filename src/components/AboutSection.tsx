/* =========================================================
   ABOUT — photo + name on the left, the three chapters from
   about.ts on a small timeline on the right, then the interests
   and a link to the full About page (opened in place).
   Every link is a real link to secret.html?folder=about; a plain
   click opens the page in place instead (onOpenFolder).
   ========================================================= */
import type { MouseEvent } from 'react';
import { ABOUT_PAGE } from '../data/about';
import { HOME, INTRO } from '../data/home';
import type { FolderKey } from '../data/folders';

const firstSentence = (t: string) => { const m = /^.+?[.!?](\s|$)/.exec(t); return (m ? m[0] : t).trim(); };

interface Props {
  onOpenFolder: (key: FolderKey, from: HTMLElement) => void;
}

export function AboutSection({ onOpenFolder }: Props) {
  const photo = HOME.aboutPhoto;
  const exploring = ABOUT_PAGE.facts.find((f) => f.label === 'Exploring');
  const tags = exploring ? exploring.lines.join(' · ').split(' · ') : [];

  // A plain left click opens the page in place; modified clicks (new tab…) follow the link
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpenFolder('about', e.currentTarget);
  };
  const link = { href: 'secret.html?folder=about', rel: 'nofollow', 'data-folder-open': 'about', onClick: open };

  return (
    <section className="sec" id="about" aria-labelledby="aboutTitle">
      <h2 className="h" id="aboutTitle">About</h2>
      <div className="about" id="aboutBody">
        <div className="about__grid">
          <figure className="about__me">
            <div className="about__photo">
              <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" style={{ objectPosition: photo.position }} />
            </div>
            <figcaption className="about__who">
              <span className="about__name">{INTRO.name}</span>
              <span className="about__where">{HOME.location || ABOUT_PAGE.facts[0].lines[0]}</span>
            </figcaption>
          </figure>
          <ol className="tl">
            {ABOUT_PAGE.chapters.map((c) => (
              <li className="tl__item" key={c.num}>
                <a className="tl__link" {...link}>
                  <span className="tl__dot" aria-hidden="true"></span>
                  {' '}<h3 className="tl__title">{c.title}</h3>
                  {' '}<p className="tl__text">{firstSentence(c.paragraphs[0])}</p>
                </a>
              </li>
            ))}
          </ol>
        </div>
        <div className="about__foot">
          {exploring && tags.length > 0 && (
            <>
              <p className="about__label" id="aboutTagsLabel">{exploring.label}</p>
              <ul className="tags" aria-labelledby="aboutTagsLabel">{tags.map((t) => <li className="tag" key={t}>{t}</li>)}</ul>
            </>
          )}
          <a className="about__more" {...link}>Photos &amp; the full story<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg></a>
        </div>
      </div>
    </section>
  );
}
