/* =========================================================
   ABOUT PAGE — a short, calm profile (words: data/aboutPage.ts)
   1. Opening: who I am + the portrait
   2. How I got here (+ "My first website", a native <details>)
   3. At the moment (+ two project links), then two photos
   4. Outside of coding
   5. Looking ahead (+ the way back to the projects / contact)
   Behind it: the home page's contours, still (background/topo.ts).
   The page has no motion of its own; the folder view's short entrance
   (useFolderView.ts) is the only one, and it respects reduced motion.
   ========================================================= */
import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { ABOUT } from '../data/aboutPage';
import { createTopoStill } from '../components/background/topo';
import { calm } from '../lib/motion';

interface Props {
  /** the element the page scrolls in (the home page's folder view) */
  scroller?: RefObject<HTMLElement | null>;
  /** home page only: closes the in-place view */
  onLeave?: () => void;
}

const Arrow = () => (
  <svg className="ab-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 11 11 5M6 5h5v5" /></svg>
);

function Section({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section className="ab-sec" aria-labelledby={id}>
      <h2 className="ab-sec__label" id={id}>{heading}</h2>
      <div className="ab-sec__body">{children}</div>
    </section>
  );
}

export function AboutPage({ onLeave }: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLCanvasElement>(null);

  // The still contours behind the page
  useEffect(() => {
    const root = pageRef.current, canvas = linesRef.current;
    if (!root || !canvas) return;
    return createTopoStill(root, canvas).destroy;
  }, []);

  // In the home page's in-place view, "See my projects" / "Get in touch"
  // close the About page and then scroll to that section. On secret.html
  // (no onLeave) they're ordinary links to index.html#…
  const leaveTo = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onLeave || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onLeave();
    const t0 = performance.now();
    const go = () => {
      // the page can scroll again once the layer has gone
      if (document.documentElement.style.overflow === '' || performance.now() - t0 > 1200) {
        document.getElementById(id)?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
      } else requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  };

  const { portrait: P, story, now, outside, ahead } = ABOUT;

  return (
    <div className="ab" ref={pageRef}>
      <canvas className="ab-lines" ref={linesRef} aria-hidden="true"></canvas>

      <div className="ab-wrap">
        <header className="ab-open">
          <div className="ab-open__text">
            <p className="ab-kicker">{ABOUT.label}</p>
            <h1 className="ab-title" tabIndex={-1}>{ABOUT.heading}</h1>
            {ABOUT.intro.map((t) => <p className="ab-p" key={t}>{t}</p>)}
          </div>
          <figure className="ab-portrait">
            <span className="ab-portrait__frame">
              <img src={P.src} alt={P.alt} width={P.width} height={P.height} decoding="async" style={{ objectPosition: P.position }} />
            </span>
            <figcaption className="ab-portrait__cap"><span>{P.caption[0]}</span><span>{P.caption[1]}</span></figcaption>
          </figure>
        </header>

        <Section id="abStory" heading={story.heading}>
          {story.text.map((t) => <p className="ab-p" key={t}>{t}</p>)}
          <details className="ab-note">
            <summary className="ab-note__sum">
              <span>{story.firstSite.summary}</span>
              <span className="ab-note__mark" aria-hidden="true"></span>
            </summary>
            <p className="ab-note__text">{story.firstSite.text}</p>
          </details>
        </Section>

        <Section id="abNow" heading={now.heading}>
          {now.text.map((t) => <p className="ab-p" key={t}>{t}</p>)}
          <p className="ab-meta" id="abProjects">{now.projectsLabel}</p>
          <ul className="ab-projects" aria-labelledby="abProjects">
            {now.projects.map((p) => (
              <li key={p.name}>
                <a className="ab-project" href={p.url} target="_blank" rel="noopener noreferrer">
                  <span className="ab-project__name">{p.name}<Arrow /></span>
                  <span className="ab-project__text">{p.text}</span>
                  <span className="ab-sr"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <div className="ab-photos">
          {ABOUT.photos.map((ph) => (
            <figure className="ab-photo" key={ph.src}>
              <img src={ph.src} alt={ph.alt} width={ph.width} height={ph.height} loading="lazy" decoding="async" style={{ objectPosition: ph.position }} />
            </figure>
          ))}
        </div>

        <Section id="abOutside" heading={outside.heading}>
          {outside.text.map((t) => <p className="ab-p" key={t}>{t}</p>)}
        </Section>

        <Section id="abAhead" heading={ahead.heading}>
          {ahead.text.map((t) => <p className="ab-p" key={t}>{t}</p>)}
          <p className="ab-links">
            <a className="ab-link ab-link--main" href={ahead.links.projects.href} onClick={leaveTo(ahead.links.projects.id)}>
              {ahead.links.projects.label}<span aria-hidden="true">→</span>
            </a>
            <a className="ab-link" href={ahead.links.contact.href} onClick={leaveTo(ahead.links.contact.id)}>{ahead.links.contact.label}</a>
          </p>
        </Section>
      </div>
    </div>
  );
}
