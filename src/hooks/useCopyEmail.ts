import { useCallback, useEffect, useRef, useState } from 'react';

export interface CopyState {
  /** '' | 'Copied' | 'Couldn’t copy — use the address' */
  status: string;
  done: boolean;
}

/* The intro's copy icon (and the command menu's "Copy email address"):
   the icon turns into a tick and "Copied" shows beside the address
   for 1.8s; the status text is a live region for screen readers. */
export function useCopyEmail(email: string) {
  const [state, setState] = useState<CopyState>({ status: '', done: false });
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(email); ok = true; } catch {
      // Older / insecure contexts: a hidden textarea
      const t = document.createElement('textarea');
      t.value = email; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch { /* not supported */ }
      t.remove();
    }
    setState({ status: ok ? 'Copied' : 'Couldn’t copy — use the address', done: ok });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState({ status: '', done: false }), 1800);
    return ok;
  }, [email]);

  return { ...state, copy };
}
