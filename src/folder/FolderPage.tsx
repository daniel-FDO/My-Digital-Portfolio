/* =========================================================
   FOLDER PAGE — the full story behind one folder (folders.ts).
   Used in the home page's in-place folder view (DetailLayer.tsx)
   and on secret.html (SecretPage.tsx).
   `scroller` = the element this page scrolls in (the folder view);
   without it, the window scrolls (secret.html).
   ========================================================= */
import type { CSSProperties, RefObject } from 'react';
import { FOLDERS, lookStyle, type Folder, type FolderKey } from '../data/folders';
import { AboutPage } from './AboutPage';

const rise = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

interface Props {
  folderKey: FolderKey;
  scroller?: RefObject<HTMLElement | null>;
  hidden?: boolean;
  /** secret.html: the page's <main id="story"> */
  as?: 'div' | 'main';
  id?: string;
  /** home page only: closes the in-place view (the About page's way out) */
  onLeave?: () => void;
}

export function FolderPage({ folderKey, scroller, hidden, as: Tag = 'div', id, onLeave }: Props) {
  const folder: Folder = FOLDERS[folderKey];
  const style = lookStyle(folder) as CSSProperties;

  // The About folder has its own page
  if (folder.custom === 'about') {
    return (
      <Tag className="story page-about" id={id} style={style} data-tone={folder.tone} data-folder={folderKey} hidden={hidden}>
        <div className="ab-root"><AboutPage scroller={scroller} onLeave={onLeave} /></div>
      </Tag>
    );
  }

  return (
    <Tag className="story" id={id} style={style} data-tone={folder.tone} data-folder={folderKey} hidden={hidden}>
      <section className="intro">
        <div className="intro__inner">
          <div className="intro__meta rise" style={rise(0.05)}>
            <span className="intro__num">{folder.num}</span>
            <span className="intro__tag">{folder.tag}</span>
          </div>
          <h1 className="intro__title rise" style={rise(0.12)} tabIndex={-1}>{folder.title}</h1>
          <p className="intro__lead rise" style={rise(0.2)}>{folder.lead}</p>
        </div>
      </section>

      <section className="body">
        <dl className="facts rise" style={rise(0.3)}>
          {folder.facts?.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {folder.sections?.map((sec, i) => (
          <article className="block rise" style={rise(0.36 + i * 0.07)} key={sec.heading}>
            <h2>{sec.heading}</h2>
            <p>{sec.text}</p>
          </article>
        ))}
      </section>
    </Tag>
  );
}
