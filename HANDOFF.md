# Handoff: the "Hello, I'm Daniel." name card (19 October 2026)

**Scope:** only the portfolio's name card (`src/components/widgets/DanielTile.tsx`) and the character code it uses (`src/components/daniel/`). Nothing else in the portfolio changed: layout, navigation, themes, content and the other widgets are as they were. `daniel-companion` and the standalone `daniel-character` studio were not modified. The studio's refined renderer was copied *from* it, read-only.

**Preview:** `npm run dev` → http://localhost:5173/ (the name card is in the widgets bento under the intro).

## What changed

### Typography
- The name is now **Nunito**, a rounded sans. It is bundled locally through `@fontsource-variable/nunito` and imported only by `DanielTile.tsx`; there is no new CDN request.
- At rest the name is weight 560 (medium), with letter-spacing tightened from -0.05em to -0.035em. The red dot stays, now at weight 900.
- The letters still swell as the pointer passes; that interaction now runs from 560 to 880.
- "Hello, I'm" and the hint are now sentence case in the same face (700 and 600 weight), instead of uppercase mono.
- The instruction is now "Say hello to Daniel". If the character can't show at all, the card falls back to the old name-play hint.
- Styles: `.daniel__word`, `.daniel__ch`, `.daniel__dot`, `.daniel > .w__label`, `.daniel__hint` in `src/styles/widgets.css`.

### Renderer (`daniel.js`, `daniel.d.ts`)
- Replaced with the refined renderer from the standalone studio. That brings its shading fixes, its wave framing (the hand stays inside the 3:4 frame), background shader compilation (`ready`) and adaptive resolution.
- New pose controls, all optional and all 0 by default:
  - `leftRaise` / `leftSwing`: the left arm, mirroring the existing right-arm wave.
  - `bodySway` and `bodyLean`: in degrees, up to ±6, pivoting at the hips.
  - `bodyLift`: −1 to 1.
- The legs are never transformed, so the feet stay planted during every movement.
- The march box was raised to y 2.45.
- `computeRig` is exported for the framing test.
- The poster was missing from the portfolio, so the studio's poster was copied to `public/images/daniel/poster.png`. Its neutral pose is unchanged.

### Motion (`motion.ts`)
- One explicit state at a time: `idle`, `wave`, `waveBoth`, `dance`, `nod`, `sound`, or `greet` (reduced-motion wave).
- Two kinds of movement:
  - Rhythmic parts use smooth envelopes that start and end at zero.
  - Everything else eases on exact critically damped springs.
- Refusals and resets:
  - `play()` refuses any action while another is playing. The one exception is the existing behaviour where a wave caught while lowering lifts again.
  - `reset()` drops any action and returns to neutral.
- Hover (desktop mouse, pointer within the middle of his frame) has four parts:
  - a single soft rise on entry (about 0.45 s, not repeated)
  - a head tilt, eyes on the pointer and a 2° attentive lean, held while hovered
  - a smooth return on exit
  - it is ignored while an action plays, and it takes priority over the page-wide curious following
- Fixed an old sign error: in curious mode the eyes looked up when the pointer was below him.

| Action | What it does | Length |
|---|---|---|
| Wave | Click Daniel: the refined wave (anticipation dip, lift, two eased waves, hold, relaxed lowering) | ~3.5 s |
| Wave both hands | Both arms up, left a beat behind; two waves each, slightly out of step; a small happy lift | ~3.6 s |
| Dance | ±3° hip sway, a soft bounce twice per sway, the head following late, arms pumping in turn | ~3.6 s |
| Nod | Two nods (9°, then 6.5°), a slight lean, eyes kept on you | ~1.35 s |
| Make a sound | A two-note chirp with a small head pop (tilt and look up) | ~1.1 s |

### Component (`DanielCharacter.tsx`, `sound.ts`, `daniel.css`)
**The "…" trigger**
- It is a sibling button next to "Wave to Daniel", not nested inside it.
- The visible dots are 18×4 px at 42% opacity (70% on touch). The hit area is 44×44 px, reaching slightly into the card's padding.
- Its accessible label is "Daniel's actions". It sets `aria-haspopup="menu"`, accurate `aria-expanded`, and `aria-controls` while the menu is open.

**The menu**
- It is a `role="menu"` portalled to `<body>` with fixed positioning. It aligns to the trigger's right edge and opens above it, or below if there's no room. It stays at least 8px inside the viewport, so the card's `overflow: hidden` can't clip it.
- It repositions on scroll and resize, and closes if the card scrolls out of view.
- Keyboard and dismissal:
  - Enter, Space or ArrowDown opens it on the first enabled item; ArrowUp opens it on the last.
  - Arrows, Home and End move through the items.
  - Escape and Tab close it and return focus to the trigger; choosing an item does the same.
  - An outside click dismisses it.
  - A click on Daniel that only dismisses the menu does not wave.
- While an action plays, the five actions are `aria-disabled` and do nothing. "Mute sounds" (a `menuitemcheckbox`) and closing stay available.

**Sound**
- Web Audio, no file: two short sine notes at peak gain about 0.05.
- The AudioContext is created only when someone chooses "Make a sound". It is never created on load, hover or ordinary clicks.
- If audio is unavailable or blocked, a short label says so.
- Mute is remembered in `localStorage` (`daniel:muted`) and degrades gracefully in private mode.
- The AudioContext is closed on unmount.

**Reduced motion**
- No breathing, blinking, following or hover reaction.
- Every action is a still pose held for 1.6 s, with a text label on him: "Hi there!", "Hi hi!", "Dance time!", "Yes!" or "Chirp!".
- A requested sound still plays unless muted.
- If the live drawing isn't available (the poster is showing), actions show the same text labels.

**Unchanged:** suspension offscreen and in hidden tabs, the DPR caps, and cleanup on unmount (loop, listeners, GPU context, audio).

## Verification
- **`npm run build`:** passes (TypeScript and Vite). The renderer is still its own lazy chunk (24 KB, 9.9 KB gzip). The Nunito woff2 files are emitted locally.
- **`npm run test:daniel`** (`tests/daniel-motion.mjs`, no browser), 11 groups:
  - every action completes and settles at 20, 30, 60 and 120 fps with no frame-to-frame jumps
  - durations are as designed
  - duplicates and conflicting actions are refused
  - both-hands, dance and nod have the intended shape
  - reset mid-action works for every action
  - reduced motion gives still poses only, and switching it on mid-dance stops at neutral
  - hover: entry rise, attentive hold with no bouncing, smooth exit, gaze direction; it never interrupts an action and wins over curious following
  - **framing:** across every frame of every action and every still pose, the widest point is x 0.934 against a frame half-width of 1.005 (a hand, mid-dance), and the highest is y 2.173 against a frame top of 2.51 (the tuft).
- **`npm run test:daniel:browser`** (`tests/daniel-browser.mjs`): **62/62** against the running dev server, in headless Edge on the real GPU (Intel HD Graphics, ANGLE D3D11). Results are in `review/daniel-card/browser.json`. It covers:
  - the bundled font and weight, and the hint text
  - the hover rise, attentive pose, no bouncing, return to neutral, and no action started
  - click, Enter and Space waves; 10 rapid clicks give one wave
  - menu keyboard flow, Escape and focus return, ArrowUp, disabled items while busy, outside click, and a dismiss-click that doesn't wave
  - each action via the menu
  - sound only on request, plus mute and its persistence
  - offscreen and hidden-tab suspension
  - menu inside the viewport and parented to `<body>` at 1440, 768 and 390 px, with no horizontal overflow
  - touch at 390 px (tap waves, tap opens the menu, items ≥ 44 px, no hover reaction)
  - reduced motion (still poses with labels, no redraws while held, no hover reaction, requested sound plays)
  - no console errors
- **Visual review:**
  - `review/daniel-card/before-after.png`. The "before" tablet shot is partly covered by the floating search dock; the "after" one was retaken with the card centred.
  - `menu-1440.png`, `menu-768.png`, `menu-390.png`, `light-menu.png` (light theme).
- **Recording:** `review/daniel-card/interaction.mp4` (52 s, cropped to the card) shows type, hover in and out, the click wave, each menu action, keyboard navigation, Escape, and the disabled state. `interaction-contact-sheet.png` holds one frame per second. The screencast captured about 22 fps, so it is choppier than the live animation, and it has no audio.

To reproduce: `npm run dev`, then `npm run test:daniel`, `npm run test:daniel:browser` and `npm run record:daniel` (these need Microsoft Edge and ffmpeg on PATH).

## Limitations
- **Hidden tab:** verified by simulating `visibilitychange`, not by a real tab switch.
- **Real devices:** touch was tested with Playwright emulation only, not real phone hardware, and GPU cost was not re-measured on mobile.
- **Sound:** no one listened to the chirp. The test confirms that one AudioContext and two oscillators start on request and none at any other time.
- **Menu coverage:** on desktop the open menu covers Daniel (it opens upward from his corner). Choosing an action closes it, so the action is always visible.
- **Hover region:** "over Daniel" is approximated as the middle 72% of his frame's width, not his exact silhouette.
- **Likeness:** Daniel is still the procedural approximation of the concept sheet, not an exact likeness.

# Later the same day: footer, projects, gallery, background, skills

**Footer footballers on phones.** *Cause:* `football.ts` sized the players to at most 20% of the wordmark's font size and dropped anything under 34px. On phones the wordmark is only about 122–149px, so the cap (24–29px) was always below the minimum and the canvas was never shown. *Fix:* separate limits for footers narrower than 560px (`CONFIG.narrow`) and a minimum ball size. Tablet and desktop are unchanged. Result: both players at 390 and 430px, one juggling alone at 360px (where the ID card hangs over "iel"). `tests/footer-football.mjs` passes 44/44: seven sizes including landscape, touch, reduced motion, offscreen and hidden tab. Recording: `review/footer/football-390.mp4`.

**Projects.** Removed Study Desk and Object Lab from `src/data/projects.json`. Their standalone pages remain in `public/projects/`, so they can still be reached by direct URL.

**Gallery: a curved WebGL ribbon with a click-to-preview.**
- Files: `src/components/gallery/ribbon.ts` (no dependencies), `gallery/Preview.tsx`, `Gallery.tsx`, `styles/gallery.css`.
- The ribbon:
  - the photos are meshes bent onto the inside of a cylinder
  - it drifts left to right
  - photos fade, dim and shrink slightly toward both ends, by screen position, into the real page background
  - you can drag or swipe it, with inertia
- Clicking or tapping a photo, or pressing Enter on the focused ribbon, opens a portalled modal. It has one backdrop-blur layer, the flat, complete photo (never enlarged), Previous/Next, a counter, arrow keys, swipe, and Escape or backdrop click to close. It also has a focus trap, an inert page, and a scroll lock without a width change. Closing restores the scroll position, the ribbon position, focus and the paused state.
- Fallback: a plain horizontal strip of photo buttons shows while the ribbon loads and whenever WebGL fails.
- `tests/gallery.mjs` passes 53/53 at 1440, 768 and 390px. Recording: `review/gallery/gallery.mp4`.

**Background.** `PortfolioBackground.tsx` now defaults to `BACKGROUND_STYLE = 'atmosphere'`: three broad, faint fields of colour (burgundy and neutral) drifting on 70–110s loops. It uses transforms only, pauses in a hidden tab, and is static with reduced motion. The light theme has its own version. Set the constant to `'contours'` for the previous look.

**Skills.** New "Design" group (Figma, Canva, Stitch, Lovable) and "AI tools" group (Claude, ChatGPT, Notion, Gemini). On screens 1200px and wider they sit in a middle column. Icons come from Simple Icons: Claude's from v15.22.0, the rest from v11.15.0, and ChatGPT uses the OpenAI mark. Stitch and Lovable have no published mark, so they use the section's letter tile.

**Not tested:** real iOS Safari and real phones (all touch testing used emulation in Edge), and real tab switches (simulated with `visibilitychange`).

# Font-cycling name (21 October 2026)
- **What it does:** "Daniel Fasan" in the intro starts as the original Geist heading, then changes typeface every 3 seconds. It steps through all 24 installed fonts in order and repeats.
- **Files:**
  - `src/components/fontcycle/`: `FontCycleName.tsx` (the component), `loader.ts` (loading and verifying fonts), `fonts.ts` (the typed manifest of all 36 families, ready or blocked with reasons)
  - `src/styles/font-cycle.css`
- **Switch:** `ENABLE_FONT_CYCLE` in `Intro.tsx` (false = the original heading).
- **Fonts:** `public/fonts/name/` (391 KB in total, each loaded only when needed), with licence documents. Research trail: `Desktop/typefree-font-handoff/{codex,claude}/`.
- **How it works:**
  - **Loading:** fonts load one ahead through the FontFace API, after the page settles. Each is checked against two fallbacks to prove it really renders the name.
  - **Failures:** a font that fails is reported (a console warning) and skipped, and the current font stays up meanwhile.
  - **Fitting:** each font is fitted into the original heading's box. Its ink height is matched to the original's, capped by the box width, then centred on the original ink. Two absolutely positioned layers crossfade over the in-flow original, so the layout never moves.
  - **Controls:** a Pause / Resume control sits beside the name. Rotation also waits while the heading is offscreen or the tab is hidden, then resumes with a fresh 3 s.
  - **Reduced motion:** the name stays static and the control becomes "Next font", which switches instantly.
  - **Accessibility:** one h1 with one accessible name; the visual layers are `aria-hidden`.
- **Development-only preview:** `/fonts-preview.html` on the dev server shows every font with its status, and the blocked list. It is not part of the build.
- **Tests:** `npm run test:name-fonts` passes 37/37.
  - The full rotation at 1440, 768 and 390 px; every font fits on one line, clear of the role line; the intro never moves.
  - Progressive loading; a blocked font request; pause, resume and keyboard; offscreen and hidden tab; reduced motion; the real 3 s timing.
  - Contact sheets: `review/name-fonts/`.
- **Not tested:** real Safari / iOS, and real tab switches (simulated).

# Activity: GitHub + Claude Code dashboard (22 October 2026)
- **Layout:** the old left column is deleted (component and CSS): the 12-month summary, busiest day, longest streak, and the stars/followers/repos cards. In its place are two equal cards, GitHub contributions and Claude Code tokens. They sit side by side from 900px and stack below that. Both cards share the same heatmap and month-chart components.
- **GitHub:** unchanged backend (`lib/github.js`). The heatmap is compact and scrolls sideways inside the card when the year doesn't fit, and its tooltips and keyboard navigation still work. The server still returns profile counts, which the page no longer shows.
- **Claude Code numbers:** these come from **ccusage** (pinned `ccusage@20.0.40`, `claude daily`: Claude Code only, Europe/London days).
  - **Collector:** `scripts/claude-usage-sync.mjs`, run as `npm run usage:sync` or `usage:watch` (every 10 minutes).
  - **Kept:** per-day totals only (input, output, cache writes, cache reads, total). No prompts, content, paths, projects, sessions, models or costs.
  - **Merged:** each run is merged into the published history, because Claude Code keeps only about a month of local records.
  - **Published:** written to `.cache/claude-usage.json` (git-ignored) and, once configured, to a private GitHub Gist.
- **Endpoint:** `/api/claude-usage` (`lib/claude-usage.js` and `api/claude-usage.js`, also routed in `server.js` and the dev server).
  - **Reads:** the Gist (`CLAUDE_USAGE_GIST_ID`), or the local file when no Gist is set.
  - **Validates:** it checks the file (a day's categories must add up to its total) and caches for 2 minutes.
  - **Status:** "live" means the collector ran within 30 minutes. If the Gist can't be read, it serves an older real copy marked stale.
- **Page:** asks again every 5 minutes while the section is on screen. The Claude badge shows one of: Live · synced n min ago / Last synced … / Offline · synced … / Not connected / Unavailable.
- **Totals:** total = input + output + cache writes + cache reads (ccusage's `totalTokens`, checked per day). The card shows total, this month, input and output, with a line saying how much of the total is cache.
- **Setup still needed for the deployed site:** create the Gist token, run `--create-gist`, add the ID to `.env` and to Vercel, then keep `npm run usage:watch` running. Until then the deployed card says "Not connected yet".
- **Tests:** `npm run test:activity` passes 19/19. It covers GitHub staying live, the Claude figures matching the source exactly, every state, both themes, and 1440/768/390 px.
