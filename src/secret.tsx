/* secret.html — the folder pages on their own (stylesheets linked in secret.html) */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SecretPage } from './SecretPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SecretPage />
  </StrictMode>,
);
