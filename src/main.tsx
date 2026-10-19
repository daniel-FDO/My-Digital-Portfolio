/* The home page (index.html). Its stylesheets are linked in index.html,
   so they're in place before the first paint, as before. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startPreloader } from './lib/preloader';
import { ThemeProvider } from './lib/theme';

// The preloader's markup is already on screen (plain HTML); this runs its progress + exit
startPreloader();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
