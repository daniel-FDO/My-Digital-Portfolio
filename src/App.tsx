/* =========================================================
   HOME — the page (index.html) and everything layered over it:
   the toolbar, the command menu and the in-place folder view.
   While a layer covers the page, what's behind it is inert.
   ========================================================= */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AboutSection } from './components/AboutSection';
import { Activity } from './components/activity/Activity';
import { CommandMenu, type MenuActions } from './components/CommandMenu';
import { Contact } from './components/Contact';
import { Dock } from './components/Dock';
import { Education } from './components/Education';
import { Faq } from './components/Faq';
import { Footer } from './components/footer/Footer';
import { Gallery } from './components/Gallery';
import { Intro } from './components/Intro';
import { PortfolioBackground } from './components/PortfolioBackground';
import { Projects } from './components/Projects';
import { SectionNav } from './components/SectionNav';
import { Skills } from './components/Skills';
import { Widgets } from './components/widgets/Widgets';
import { HOME } from './data/home';
import { DetailLayer } from './folder/DetailLayer';
import { useFolderView } from './folder/useFolderView';
import { useCopyEmail } from './hooks/useCopyEmail';
import { useSectionReveal } from './hooks/useSectionReveal';
import { calm } from './lib/motion';
import { markPageReady, preloaderActive } from './lib/preloader';
import { useTheme } from './lib/theme';

// Focus a heading without scrolling to it again (it gets tabindex -1 to take focus)
function focusHeading(h: HTMLElement | null) {
  if (!h) return;
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
}

export function App() {
  const { toggleTheme } = useTheme();
  const copy = useCopyEmail(HOME.email);
  const [menuOpen, setMenuOpen] = useState(false);
  const folder = useFolderView();
  const covered = folder.shown !== null;      // the folder view is on screen (or fading out)
  const behind = covered || menuOpen;

  useSectionReveal();

  useEffect(() => {
    markPageReady();
    // A link straight to a section (/#about): the page is built now, so go there
    // (with the preloader, it does this itself once it steps aside)
    let id = decodeURIComponent(location.hash.slice(1));
    if (id === 'arcade') id = 'gallery';     // old links to the Play section
    if (id && !id.startsWith('folder/') && !preloaderActive()) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  const backToTop = useCallback(() => {
    scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
    focusHeading(document.querySelector('h1'));
  }, []);

  const { copy: copyEmail } = copy;
  const { open: openFolder } = folder;
  const actions = useMemo<MenuActions>(() => ({
    go: (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
      focusHeading(el.querySelector('h2'));
    },
    openAbout: () => openFolder('about', document.getElementById('askOpen')),
    toggleTheme,
    copyEmail: () => { copyEmail(); },
    backToTop,
  }), [toggleTheme, copyEmail, backToTop, openFolder]);

  return (
    <>
      {/* Background experiment: switch off in PortfolioBackground.tsx (ENABLE_BACKGROUND_EXPERIMENT) */}
      <PortfolioBackground />

      <a className="skip" href="#main" inert={covered}>Skip to content</a>

      <main className="page" id="main" inert={behind}>
        <Intro copy={copy} />
        <Widgets />
        <Projects />
        <AboutSection onOpenFolder={openFolder} />
        <Education />
        <Skills />
        <Gallery />
        <Activity />
        <Faq />
        <Contact />
      </main>

      <Footer inert={behind} />

      {/* Soft blur along the bottom edge, under the toolbar */}
      <div className="edge" aria-hidden="true" inert={covered}></div>

      <Dock inert={behind} menuOpen={menuOpen} onAsk={() => { if (!folder.isOpen) setMenuOpen(true); }} onTop={backToTop} />

      <SectionNav inert={behind} onGo={actions.go} onTop={backToTop} />

      <CommandMenu open={menuOpen} setOpen={setMenuOpen} blocked={folder.isOpen} actions={actions} />

      <DetailLayer view={folder} menuOpen={menuOpen} />
    </>
  );
}
