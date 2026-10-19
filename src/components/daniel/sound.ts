/* =========================================================
   DANIEL — his one sound: a short, quiet, two-note chirp, made with
   the Web Audio API (no audio file). It only ever plays when someone
   explicitly chooses "Make a sound"; the AudioContext is created on
   that first request (inside the click), not on load.
   play() resolves to what happened, so the host can say so when
   audio isn't available or the browser blocks it.
   ========================================================= */
export type ChirpResult = 'played' | 'unavailable' | 'blocked';

type AudioCtor = typeof AudioContext;

export function createChirp() {
  let ctx: AudioContext | null = null;

  const tone = (c: AudioContext, at: number, f0: number, f1: number, len: number, peak: number) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + len * 0.7);          // a little upward lilt
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(c.destination);
    o.start(at);
    o.stop(at + len + 0.02);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  };

  return {
    async play(): Promise<ChirpResult> {
      const AC: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!AC) return 'unavailable';
      try {
        ctx ??= new AC();
        if (ctx.state !== 'running') {
          // resume() can stay pending when the browser won't allow audio; don't wait for ever
          await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 600))]);
        }
      } catch {
        return 'blocked';
      }
      if (ctx.state !== 'running') return 'blocked';
      const t = ctx.currentTime + 0.02;
      tone(ctx, t, 740, 880, 0.12, 0.05);           // "chir-
      tone(ctx, t + 0.15, 990, 1320, 0.16, 0.045);  //  -rup"
      return 'played';
    },
    /** Release the audio device (on unmount) */
    dispose() {
      const c = ctx;
      ctx = null;
      if (c && c.state !== 'closed') c.close().catch(() => {});
    },
  };
}
