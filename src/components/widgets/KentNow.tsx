/* =========================================================
   KENT NOW — the time where I am, today's date, the weather and
   where the sun is between sunrise and sunset.
   Time: the shared Kent clock (lib/kentClock.ts).
   Weather: Open-Meteo (free, no key; nothing about the visitor is
   sent), for Canterbury, asked once and again every 30 minutes.
   If it doesn't answer, the weather and the sun arc just don't
   show — nothing is guessed.
   ========================================================= */
import { useEffect, useState, type ReactElement } from 'react';
import { HOME } from '../../data/home';
import { fmtSpoken, pad2, useKentTime } from '../../lib/kentClock';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=51.28&longitude=1.08'
  + '&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=Europe%2FLondon&forecast_days=2';
const REFRESH = 30 * 60 * 1000;
const fmtDate = new Intl.DateTimeFormat('en-GB', { timeZone: HOME.timeZone, weekday: 'long', day: 'numeric', month: 'long' });

interface Weather {
  temp: number;
  code: number;
  isDay: boolean;
  /** minutes after midnight, Kent time */
  sunrise: number;
  sunset: number;
  /** tomorrow's sunrise, minutes after midnight */
  nextSunrise: number;
}

type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
// WMO weather codes (Open-Meteo's docs) → a word and an icon
function sky(code: number): [Sky, string] {
  if (code === 0) return ['clear', 'Clear'];
  if (code <= 2) return ['partly', code === 1 ? 'Mostly clear' : 'Partly cloudy'];
  if (code === 3) return ['cloudy', 'Overcast'];
  if (code === 45 || code === 48) return ['fog', 'Fog'];
  if (code >= 51 && code <= 57) return ['drizzle', 'Drizzle'];
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['rain', code >= 80 ? 'Showers' : 'Rain'];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['snow', 'Snow'];
  if (code >= 95) return ['storm', 'Thunderstorm'];
  return ['cloudy', 'Cloudy'];
}
const minutesOf = (iso: string) => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return h * 60 + m; };
const hhmm = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const span = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${pad2(min % 60)}m` : `${min} min`);

function useWeather() {
  const [w, setW] = useState<Weather | null>(null);
  useEffect(() => {
    let gone = false;
    const controller = new AbortController();
    const load = () => fetch(WEATHER_URL, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((j) => {
        const c = j?.current, d = j?.daily;
        if (typeof c?.temperature_2m !== 'number' || !d?.sunrise?.[1] || !d?.sunset?.[0]) throw new Error('no data');
        if (!gone) setW({ temp: c.temperature_2m, code: c.weather_code, isDay: c.is_day === 1, sunrise: minutesOf(d.sunrise[0]), sunset: minutesOf(d.sunset[0]), nextSunrise: minutesOf(d.sunrise[1]) });
      })
      .catch(() => { /* keep the last good answer, or none */ });
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, REFRESH);
    return () => { gone = true; controller.abort(); clearInterval(timer); };
  }, []);
  return w;
}

const ICONS: Record<Sky | 'moon', ReactElement> = {
  clear: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  partly: <><path d="M8 3.5v1.3M3.5 8h1.3M4.8 4.8l.9.9M11.2 4.8l-.9.9" /><path d="M5.6 10.2A3.2 3.2 0 1 1 11 7" /><path d="M8 20h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 8 20z" /></>,
  cloudy: <path d="M7 19h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 19z" />,
  fog: <><path d="M7 14h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 14z" /><path d="M4 18h16M7 21h10" /></>,
  drizzle: <><path d="M7 15h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15z" /><path d="M9 18.5v.5M12 19.5v.5M15 18.5v.5" /></>,
  rain: <><path d="M7 15h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15z" /><path d="m9 18-1 3M13 18l-1 3M17 18l-1 3" /></>,
  snow: <><path d="M7 15h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 15z" /><path d="M9 19h.01M12 21h.01M15 19h.01" /></>,
  storm: <><path d="M7 14h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 14z" /><path d="m12.5 15-2 3.5h3l-2 3.5" /></>,
};

export function KentNow() {
  const t = useKentTime();
  const w = useWeather();
  const now = t.h * 60 + t.m;
  const [kind, word] = w ? sky(w.code) : ['clear', ''] as [Sky, string];
  const daytime = w ? now >= w.sunrise && now < w.sunset : true;
  // What's next for the sun, counted from the real times (tomorrow's sunrise after sunset)
  const nextSun = !w ? '' : daytime ? `Sunset in ${span(w.sunset - now)}`
    : now < w.sunrise ? `Sunrise in ${span(w.sunrise - now)}` : `Sunrise in ${span(24 * 60 - now + w.nextSunrise)}`;
  const icon = w && !w.isDay && (kind === 'clear' || kind === 'partly') ? ICONS.moon : ICONS[kind];
  // The sun along the arc: 0 at sunrise → 1 at sunset (only by day)
  const p = w ? Math.min(1, Math.max(0, (now - w.sunrise) / (w.sunset - w.sunrise))) : 0;
  const a = Math.PI * (1 - p), sx = 60 + 50 * Math.cos(a), sy = 56 - 44 * Math.sin(a);
  const spoken = `${fmtSpoken.format(t.date)} ${t.zone} in ${HOME.location}`;

  return (
    <article className="w now" aria-label={`Kent right now: ${spoken}${w ? `, ${Math.round(w.temp)} degrees, ${word.toLowerCase()}` : ''}`}>
      <p className="w__label"><span className="now__dot" aria-hidden="true"></span>{HOME.location} · {t.zone}</p>
      <div className="now__main" aria-hidden="true">
        <p className="now__time">{pad2(t.h)}<span className="now__colon">:</span>{pad2(t.m)}<span className="now__sec">{pad2(t.s)}</span></p>
        <p className="now__date">{fmtDate.format(t.date)}</p>
      </div>
      {w && (
        <div className="now__wx" aria-hidden="true">
          <svg className="now__icon" viewBox="0 0 24 24">{icon}</svg>
          <span className="now__temp">{Math.round(w.temp)}°</span>
          <span className="now__word">{word}</span>
        </div>
      )}
      {w && (
        <div className="now__sun" aria-hidden="true">
          <svg viewBox="0 0 120 64" className="now__arc">
            <path className="now__track" d="M10 56a50 44 0 0 1 100 0" pathLength={1} />
            {daytime && <path className="now__done" d="M10 56a50 44 0 0 1 100 0" pathLength={1} style={{ strokeDasharray: `${p} 1` }} />}
            <line className="now__horizon" x1="4" y1="56.5" x2="116" y2="56.5" />
            {daytime
              ? <circle className="now__sunDot" cx={sx.toFixed(2)} cy={sy.toFixed(2)} r="4" />
              : <path className="now__moon" transform="translate(52 22) scale(0.68)" d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
          </svg>
          <p className="now__next">{nextSun}</p>
          <p className="now__times"><span>↑ {hhmm(w.sunrise)}</span><span>↓ {hhmm(w.sunset)}</span></p>
        </div>
      )}
    </article>
  );
}
