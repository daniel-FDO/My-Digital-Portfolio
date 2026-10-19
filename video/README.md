# Project preview films

The motion previews in the Projects section (`public/previews/video/*.mp4`
and their `.jpg` posters) are made here. This folder is tooling only: the
portfolio never imports it, and Vite doesn't build it. It uses what the
project already has: `playwright-core` with Microsoft Edge, and `ffmpeg`.

```sh
npm run video:capture -- [slug …]   # photograph the real sites → video/captures/<slug>/
npm run video:check                 # check every camera: steady glide, no zoom-in, no turning
npm run video:stills -- <slug> [t,t,…]   # review frames → video/stills/
npm run video:render -- [slug …]    # MP4s + posters → public/previews/video/
```

Slugs: `blueprint`, `gallery`, `porchlight` (Homeless Support Finder),
`rock-paper-scissors`, `study-desk`, `object-lab`.

## How it works

| File | |
|---|---|
| `storyboards/<slug>.mjs` | One per project. `capture`: which states of the real site to photograph (scroll positions, clicks on its own buttons) and which elements lift. `film(cap, L)`: where the panels lie, when each piece lifts and stands up, and the camera as a function of time. The end card's words come from `src/data/projects.json` (name + category), so they are always the portfolio's own. |
| `capture.mjs` | Opens each site at 1280 × 800 (device scale 2), puts it in each state, screenshots the panel with its lifting pieces hidden, then each piece alone on a transparent background. Writes `captures/<slug>/capture.json`. Study Desk and Object Lab are served from `public/projects/`. |
| `film/` | The renderer: WebGL2, every frame computed from `seek(t)` (no timers). Mipmaps + 16× anisotropic filtering, a mild depth of field, 4 motion-blur sub-frames, the end card in Geist / Instrument Serif. |
| `render.mjs` | Steps through the frames on the real GPU and pipes them into ffmpeg: 1280 × 800, 30 fps, H.264 (CRF 23, `+faststart`), no audio. The poster is the end card. |
| `check-motion.mjs` | Samples every camera at 120 Hz: the glide's speed never dips or surges while cruising, the distance never shrinks during the flight, the camera never turns. |
| `contact.mjs` | `node video/contact.mjs <slug>`: a contact sheet of one capture (panels + pieces), to check it before filming. |
| `lib.mjs` | The shared camera maths (smooth glides, blends, the end-card framing). |
| `server.mjs` | A tiny static server for the tools. |

## Updating a film

If a site changes, run its capture again, look at a few stills, then
render it. If a site's layout changes enough that a selector in its
storyboard no longer matches, `capture.mjs` warns and skips that piece.

The live sites are captured as they are on the day: the Rock, Paper,
Scissors film shows whatever its real round dealt (the capture plays
Paper), and the Netlify hosting badge is removed from its screenshots.
