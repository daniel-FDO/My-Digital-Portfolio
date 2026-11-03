/* =========================================================
   SETUP — WHAT'S ON THE DESK (edit here)
   Read by the "Setup" tile in the hero grid (widgets/SetupTile.tsx):
   a line drawing of a desk with a dot for each thing.
     id    — unique, short (e.g. 'monitor')
     name  — what it is, as you'd say it (this is the dot's accessible name)
     use   — one line: what you use it for
     x, y  — where its dot sits on the drawing, in percent of the drawing's
             width (x, from the left) and height (y, from the top)
   Where the drawn things are (percent, roughly the middle of each):
     monitor screen  x 60, y 27      monitor stand  x 60, y 53
     keyboard        x 60, y 67      mouse          x 80, y 67
     chair back      x 14, y 47      chair seat     x 14, y 70
     desk top        y 60 – 73 (x 26 – 98)
   Only real things. An item counts once name and use are filled in and
   x, y are between 0 and 100; with fewer than 3 such items the tile
   doesn't show and the X-ray tile keeps its place. In development, a dot
   that isn't over anything drawn is reported in the console.
   ========================================================= */
export interface SetupItem {
  id: string;
  name: string;
  use: string;
  x: number;
  y: number;
}

export const SETUP: SetupItem[] = [
  // TODO: a real thing on your desk (name, one-line use, and its x / y on the drawing)
  { id: 'todo-1', name: '', use: '', x: 0, y: 0 },
  // TODO: a real thing on your desk
  { id: 'todo-2', name: '', use: '', x: 0, y: 0 },
  // TODO: a real thing on your desk
  { id: 'todo-3', name: '', use: '', x: 0, y: 0 },
];

const filled = (s: string) => s.trim().length > 0 && !/\bTODO\b/.test(s);
const onDrawing = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;

/** The items that are complete enough to show */
export function placedItems(list: SetupItem[] = SETUP): SetupItem[] {
  return list.filter((i) => filled(i.name) && filled(i.use) && onDrawing(i.x) && onDrawing(i.y));
}
