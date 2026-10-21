/* =========================================================
   NAME FONTS — every font the "Daniel Fasan" heading can rotate
   through (FontCycleName.tsx), and every one that was requested but
   couldn't be used, with the reason. One entry per family, in the
   order they appear in the rotation.

   Files live in public/fonts/name/<dir>/: the font (WOFF2, converted
   losslessly from the designer's own release: container only, no
   subsetting or glyph changes) and the licence documents that came
   with it. Research trail: Desktop/typefree-font-handoff (codex/ and
   claude/ manifests).

   scale    — multiplies the size the heading fits the font to (1 = fit
              its ink to the original heading's cap height / width)
   tracking — letter-spacing in em (0 = the font's own spacing)
   ========================================================= */

export type Licence = 'OFL-1.1' | 'OFL-1.1 (Beržulis licence v1.0)';

export interface ReadyFont {
  status: 'ready';
  /** the family name as Typefree lists it */
  family: string;
  /** folder + file under public/fonts/name/ */
  dir: string;
  file: string;
  weight: number;
  style: 'normal' | 'italic';
  /** which cut, when the family has several */
  variant: string;
  designer: string;
  /** the official page Typefree links to */
  source: string;
  /** where the file was actually downloaded from */
  download: string;
  licence: Licence;
  /** licence documents kept beside the font (same folder) */
  licenceFiles: string[];
  scale?: number;
  tracking?: number;
  note?: string;
}
export interface BlockedFont {
  status: 'blocked';
  family: string;
  designer: string;
  source: string;
  reason: string;
}
export type NameFont = ReadyFont | BlockedFont;

const LEAGUE = 'https://www.theleagueofmoveabletype.com';
const GH = 'https://github.com';
const OFL = 'OFL-1.1' as const;
const RORY = (family: string, repo: string, dir: string, file: string, extra: Partial<ReadyFont> = {}): ReadyFont => ({
  status: 'ready', family, dir, file: `${dir}.woff2`, weight: 400, style: 'normal', variant: 'Regular', designer: 'Rory King',
  source: `${GH}/nervousattack/${repo}`, download: `${GH}/nervousattack/${repo}/blob/master/${file}`,
  licence: OFL, licenceFiles: ['README.md', 'OFL.txt'], ...extra,
});
const LUKE = (family: string): BlockedFont => ({
  status: 'blocked', family, designer: 'Luke Rowland', source: 'https://prototypefonts.tumblr.com/type',
  reason: 'The official download page no longer exists ("This post has ceased to exist" on tumblr.com/prototypefonts/type); the blog subdomain is behind a human-verification check; the page was never captured by the Internet Archive; and no licence statement could be found anywhere (Typefree’s own file metadata has none). Self-hosting / web-embedding permission cannot be verified.',
});

export const NAME_FONTS: NameFont[] = [
  // ---- ready: the rotation, in this order ----
  { status: 'ready', family: 'Astloch', dir: 'astloch', file: 'astloch.woff2', weight: 700, style: 'normal', variant: 'Bold', designer: 'Dan Rhatigan',
    source: 'https://fonts.google.com/specimen/Astloch', download: 'https://fonts.google.com/specimen/Astloch (via Codex: Astloch-Bold.ttf)', licence: OFL, licenceFiles: ['OFL.txt'],
    scale: 1.08, note: 'Bold: Typefree’s first variant, and the thin Regular all but disappears at heading size.' },
  { status: 'ready', family: 'Sniglet', dir: 'sniglet', file: 'sniglet.woff2', weight: 400, style: 'normal', variant: 'Regular', designer: 'Haley Fiege',
    source: `${LEAGUE}/sniglet`, download: `${GH}/theleagueof/sniglet/blob/master/Sniglet%20Regular.otf`, licence: OFL, licenceFiles: ['Open-Font-License.markdown'] },
  { status: 'ready', family: 'Blackout', dir: 'blackout', file: 'blackout.woff2', weight: 400, style: 'normal', variant: 'Sunrise', designer: 'Tyler Finck',
    source: `${LEAGUE}/blackout`, download: `${GH}/theleagueof/blackout (via Codex: Blackout Sunrise.ttf)`, licence: OFL, licenceFiles: ['Open-Font-License.markdown'],
    note: 'Sunrise (the reversed, block style): Codex compared it with the screenshot; Typefree also lists Midnight / 2 AM.' },
  { status: 'ready', family: 'Chunk', dir: 'chunk', file: 'chunk.woff2', weight: 400, style: 'normal', variant: 'ChunkFive Regular', designer: 'Meredith Mandel',
    source: `${LEAGUE}/chunk`, download: `${GH}/theleagueof/chunk/blob/master/webfonts/ChunkFive-Regular.woff2`, licence: OFL, licenceFiles: ['Open-Font-License.markdown'] },
  { status: 'ready', family: 'League Script', dir: 'league-script', file: 'league-script.woff2', weight: 400, style: 'normal', variant: 'Number One', designer: 'Haley Fiege',
    source: `${LEAGUE}/league-script`, download: `${GH}/theleagueof/league-script-number-one/blob/master/LeagueScriptNumberOne.otf`, licence: OFL, licenceFiles: ['Open-Font-License.markdown'],
    scale: 1.12 },
  { status: 'ready', family: 'League Spartan', dir: 'league-spartan', file: 'league-spartan.woff2', weight: 700, style: 'normal', variant: 'Bold', designer: 'Caroline Hadilaksono, Micah Rich, Tyler Finck & Matt Bailey',
    source: `${LEAGUE}/league-spartan`, download: `${GH}/theleagueof/league-spartan/blob/master/fonts/webfonts/LeagueSpartan-Bold.woff2`, licence: OFL, licenceFiles: ['OFL.txt'],
    tracking: -0.02, note: 'Typefree shows the variable font; Bold is the original League Spartan weight (one static file instead of the whole variable range).' },
  { status: 'ready', family: 'Linden Hill', dir: 'linden-hill', file: 'linden-hill.woff2', weight: 400, style: 'normal', variant: 'Regular (roman)', designer: 'Barry Schwartz',
    source: `${LEAGUE}/linden-hill`, download: `${GH}/theleagueof/linden-hill/blob/master/Linden%20Hill.otf`, licence: OFL, licenceFiles: ['Open-Font-License.markdown'] },
  { status: 'ready', family: 'Knewave', dir: 'knewave', file: 'knewave.woff2', weight: 400, style: 'normal', variant: 'Regular (not Outline)', designer: 'Tyler Finck',
    source: `${LEAGUE}/knewave`, download: `${GH}/theleagueof/knewave/blob/master/knewave.otf`, licence: OFL, licenceFiles: ['Open-Font-License.markdown'],
    note: 'Appears more than once in the screenshots; included once (the solid cut).' },
  { status: 'ready', family: 'revival', dir: 'revival', file: 'revival.woff2', weight: 400, style: 'normal', variant: 'Regular', designer: 'Lucie Danloy',
    source: 'https://typotheque.le75.be/', download: 'https://typotheque.le75.be/site/assets/files/1134/revival.otf', licence: OFL, licenceFiles: ['OFL.txt'],
    note: 'Typefree spells it in lower case. The release has no licence file; OFL.txt quotes the publisher’s “Licence : SIL Open Font License (OFL)” and the font’s own copyright line.' },
  { status: 'ready', family: 'Mud Club', dir: 'mud-club', file: 'mud-club.woff2', weight: 400, style: 'normal', variant: 'Franklin the Goth', designer: 'Rory King',
    source: `${GH}/nervousattack/Mud-Club`, download: `${GH}/nervousattack/Mud-Club (via Codex)`, licence: OFL, licenceFiles: ['README.md', 'OFL.txt'] },
  RORY('Cold Ice Plant', 'ColdIcePlant', 'cold-ice-plant', 'ColdIcePlant-Mono.otf', { variant: 'Mono' }),
  { status: 'ready', family: 'BLOCKS ON BLOCKS', dir: 'blocks-on-blocks', file: 'blocks-on-blocks.woff2', weight: 400, style: 'normal', variant: 'Regular', designer: 'Rory King',
    source: `${GH}/nervousattack/BLOCKS-ON-BLOCKS`, download: `${GH}/nervousattack/BLOCKS-ON-BLOCKS (via Codex)`, licence: OFL, licenceFiles: ['README.md', 'OFL.txt'] },
  { status: 'ready', family: 'BOLd GOd dISPLAY', dir: 'bold-god-display', file: 'bold-god-display.woff2', weight: 400, style: 'normal', variant: 'Display', designer: 'Rory King',
    source: `${GH}/nervousattack/BOLd-GOd-dISPLAY`, download: `${GH}/nervousattack/BOLd-GOd-dISPLAY (via Codex)`, licence: OFL, licenceFiles: ['README.md', 'OFL.txt'] },
  { status: 'ready', family: 'GUY1976', dir: 'guy1976', file: 'guy1976.woff2', weight: 400, style: 'normal', variant: 'ONE', designer: 'Rory King',
    source: 'http://github.com/nervousattack/GUY1976', download: `${GH}/nervousattack/GUY1976 (via Codex)`, licence: OFL, licenceFiles: ['README.md', 'OFL.txt'] },
  RORY('Pringip Signage', 'Pringip-Signage', 'pringip-signage', 'Pringip-Signage.otf'),
  { status: 'ready', family: 'Scribble Fill', dir: 'scribble-fill', file: 'scribble-fill.woff2', weight: 400, style: 'normal', variant: 'Regular', designer: 'Rory King',
    source: `${GH}/nervousattack/Scribble-Fill`, download: `${GH}/nervousattack/Scribble-Fill (via Codex)`, licence: OFL, licenceFiles: ['README.md', 'OFL.txt'] },
  RORY('Slash Standard', 'Slash-Standard', 'slash-standard', 'Slash-Standard.otf'),
  RORY('Slow Script', 'Slow-Script', 'slow-script', 'SlowScript-One.otf', { variant: 'One' }),
  RORY('Time Stamp', 'Time-Stamp', 'time-stamp', 'TimeStamp-Standard.otf', { variant: 'Standard', source: 'http://github.com/nervousattack/Time-Stamp' }),
  RORY('Wreckage Grotesque', 'Wreckage-Grotesque', 'wreckage-grotesque', 'Wreckage-GrotesqueOne.otf', { variant: 'One' }),
  RORY('Squarevetica', 'Squarevetica', 'squarevetica', 'Squarevetica-Regular.otf'),
  { status: 'ready', family: 'Aušrinė', dir: 'ausrine', file: 'ausrine.woff2', weight: 400, style: 'normal', variant: 'Regular', designer: 'Beržulis (Studio Cryo)',
    source: 'https://berzulis.com/', download: 'https://web.archive.org/web/20250119094826/https://berzulis.com/wp-content/uploads/2020/10/Ausrine-Aushrine.zip',
    licence: 'OFL-1.1 (Beržulis licence v1.0)', licenceFiles: ['Berzulis-License-v1.0.txt'], note: BERZULIS_NOTE() },
  { status: 'ready', family: 'Barstukai', dir: 'barstukai', file: 'barstukai.woff2', weight: 400, style: 'normal', variant: 'Regular v1.001', designer: 'Beržulis (Studio Cryo)',
    source: 'https://berzulis.com/', download: 'https://web.archive.org/web/20250119094826/https://berzulis.com/wp-content/uploads/2021/09/Barstukai-Bars-tu-kai-v1.001.zip',
    licence: 'OFL-1.1 (Beržulis licence v1.0)', licenceFiles: ['Berzulis-License-v1.0.txt'], note: BERZULIS_NOTE() },
  { status: 'ready', family: 'Gaila', dir: 'gaila', file: 'gaila.woff2', weight: 400, style: 'normal', variant: 'Regular v1.000', designer: 'Beržulis (Studio Cryo)',
    source: 'https://berzulis.com/', download: 'https://web.archive.org/web/20250119094826/https://berzulis.com/wp-content/uploads/2021/09/Gaila-Gai-la-v1.000..zip',
    licence: 'OFL-1.1 (Beržulis licence v1.0)', licenceFiles: ['Berzulis-License-v1.0.txt'], note: BERZULIS_NOTE() },

  // ---- blocked: requested, not installed ----
  LUKE('Arc'), LUKE('Blob'), LUKE('Blockcut'), LUKE('Curvature'), LUKE('Lefty'), LUKE('Pentool'), LUKE('Perfect'), LUKE('Poly'), LUKE('Rip'),
  { status: 'blocked', family: 'Voxel', designer: 'Fine, Great. Studio', source: 'https://www.behance.net/gallery/146299581/VOXEL-TYPEFACE-FREE',
    reason: 'The official release (finegreatstudio.gumroad.com/l/voxeltypeface, €0) says only “Free to use!” — no licence, nothing about self-hosting or web embedding — and the file is only issued through a Gumroad checkout. Behance blocks automated access (403).' },
  { status: 'blocked', family: 'ARK-ES', designer: 'Eddie Stuart (Stuedio)', source: 'https://fontesk.com/ark-es-typeface/',
    reason: 'The font’s licence is “for personal use only. Do not resell, redistribute or alter in any way without the consent of Eddie Stuart” (licence URL https://stued.io/font-licensing). A public portfolio needs a commercial / web licence from hello@stued.io.' },
  { status: 'blocked', family: 'Austėja', designer: 'Beržulis (Studio Cryo)', source: 'https://berzulis.com/',
    reason: 'Released in 2025 on berzulis.com, which has since gone offline (the domain no longer resolves; its 2026 archive is a parked page). The June 2025 archive lists Austėja under the same OFL statement, but its font files were never archived (every capture returns an archive error page), so no official copy can be obtained.' },
];

/** The Beržulis licence text contradicts itself; the decision taken is recorded here (and in the summary). */
function BERZULIS_NOTE() {
  return 'Beržulis licence v1.0 (in the zip): “free to use personal or commercial and are licensed under the SIL Open Font License. Do not resell, or redistribute.” The OFL permits web embedding, so it is self-hosted here as an embedded web font; the files are not offered for download. Site asks for credit when used in products for sale (“x typeface in use by Studio Cryo”). The official site is offline: downloaded from its Internet Archive capture. Remove the entry if you read “do not redistribute” as excluding web fonts.';
}

export const READY_FONTS = NAME_FONTS.filter((f): f is ReadyFont => f.status === 'ready');
export const BLOCKED_FONTS = NAME_FONTS.filter((f): f is BlockedFont => f.status === 'blocked');
/** each font's own CSS family name (prefixed, so it can never clash with a font the page or system already has) */
export const cssFamily = (f: ReadyFont) => `NameCycle ${f.family}`;
export const fontUrl = (f: ReadyFont) => `fonts/name/${f.dir}/${f.file}`;
