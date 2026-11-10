/* =========================================================
   CLOCK — an analog face showing Kent time (lib/kentClock.ts),
   whatever the visitor's own time zone. Hour and minute hands in
   the text colour, the second hand in the accent. With reduced
   motion the second hand is hidden and the hands don't glide.
   ========================================================= */
import { HOME } from '../../data/home';
import { fmtSpoken, useKentTime } from '../../lib/kentClock';

const C = 100;                       // the centre of the 200 × 200 face
const EDGE = 92;                     // the face's half-width, ticks sit just inside it

/** A point at `deg` (0 = 12 o'clock) on a rounded square of half-width `r` */
function onSquare(deg: number, r: number): [number, number] {
  const a = (deg - 90) * (Math.PI / 180);
  const cos = Math.cos(a), sin = Math.sin(a);
  const k = r / Math.max(Math.abs(cos), Math.abs(sin));   // reach the square's edge
  const round = Math.min(k, r * 1.22);                      // ...but soften the corners
  return [C + cos * round, C + sin * round];
}

const TICKS = Array.from({ length: 12 }, (_, i) => i).filter((i) => i % 3 !== 0).map((i) => {
  const [x1, y1] = onSquare(i * 30, EDGE - 18);
  const [x2, y2] = onSquare(i * 30, EDGE - 6);
  return { i, x1, y1, x2, y2 };
});
const NUMERALS = [[12, 0], [3, 90], [6, 180], [9, 270]].map(([n, deg]) => {
  const [x, y] = onSquare(deg, EDGE - 22);
  return { n, x, y };
});

export function ClockTile() {
  const t = useKentTime();
  const hourDeg = (t.h % 12) * 30 + t.m * 0.5;
  const minDeg = (t.m * 60 + t.s) * 0.1;
  // The second hand eases between ticks, so its angle keeps counting up (seconds since UTC
  // midnight) instead of dropping back to 0 each minute, which would swing it backwards
  const secDeg = (Math.floor(t.date.getTime() / 1000) % 86400) * 6;

  return (
    <div className="w clock" role="img" aria-label={`The time in ${HOME.location}: ${fmtSpoken.format(t.date)} (${t.zone})`}>
      <svg className="clock__face" viewBox="0 0 200 200" aria-hidden="true">
        {TICKS.map((k) => <line key={k.i} className="clock__tick" x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} />)}
        {NUMERALS.map((n) => (
          <text key={n.n} className="clock__num" x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central">{n.n}</text>
        ))}
        <g className="clock__hand clock__hand--h" style={{ transform: `rotate(${hourDeg}deg)` }}><line x1={C} y1={C + 8} x2={C} y2={C - 38} /></g>
        <g className="clock__hand clock__hand--m" style={{ transform: `rotate(${minDeg}deg)` }}><line x1={C} y1={C + 10} x2={C} y2={C - 60} /></g>
        <g className="clock__hand clock__hand--s" style={{ transform: `rotate(${secDeg}deg)` }}><line x1={C} y1={C + 14} x2={C} y2={C - 70} /></g>
        <circle className="clock__pin" cx={C} cy={C} r="3.2" />
      </svg>
    </div>
  );
}
