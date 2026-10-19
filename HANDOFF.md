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
