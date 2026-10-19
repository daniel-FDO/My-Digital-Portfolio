# daniel. — digital portfolio (React + TypeScript)

The same portfolio as `../me`, rebuilt with React 19, TypeScript and Vite.
The design, content, animations and behaviour are unchanged: the CSS is the
original CSS, and every component renders the original markup.

## Run it

```sh
npm install
npm run dev        # development, with hot reload: http://localhost:5173
npm run build      # type-check (tsc -b) + production build → dist/
npm start          # serve dist/ + the API: http://127.0.0.1:3000 (PORT overrides)
npm run typecheck  # TypeScript only
```

`npm run dev` and `npm start` both serve the two endpoints the page uses:

- `GET /api/now-playing` — Spotify (lib/spotify.js)
- `GET /api/github-contributions` — GitHub heatmap (lib/github.js)

Secrets live in `.env` (see `.env.example`); they never reach the browser.
`npm run get-token` gets the Spotify refresh token, as before.
`npm run capture` retakes the project screenshots into `public/previews/`.
The `api/` folder holds the same functions for Vercel.

## Where things are

| | |
|---|---|
| `index.html`, `secret.html` | The two pages. The inline scripts in `<head>` (theme, preloader gate, the secret page's pass) run before the first paint, as before. |
| `src/main.tsx` → `App.tsx` | The home page. App holds the layers over it (command menu, folder view) and makes the page behind them inert. |
| `src/components/` | One component per section: `Intro`, `widgets/` (Music, Kent now — time, weather, sun — and the GitHub, latest-project, learning and studying tiles), `Projects`, `AboutSection`, `Education`, `Skills`, `Gallery` (photo carousel), `activity/` (GitHub summary, heatmap, months), `SectionNav` (section dock), `PortfolioBackground` (background experiment), `Faq`, `Contact`, `footer/`, `Dock`, `CommandMenu`. |
| `src/components/footer/` | `Footer.tsx`, plus three small engines it starts and stops: `wordmark.ts` (fit + spinning "a"), `idRig.ts` (lanyard physics), `football.ts` (the footballers). |
| `src/folder/` | The About folder (gallery + story), the generic folder page and the in-place folder view with its history handling. Its CSS loads the first time a folder opens. |
| `src/lib/` | Shared stores and hooks: theme, Kent clock, Spotify poller, reduced motion, preloader. |
| `src/data/` | All the content: `home.ts`, `projects.json`, `education.ts`, `about.ts`, `folders.ts`, `skill-icons.ts`. `github-config.json` (root) is shared with the server. |
| `src/styles/` | The original stylesheets, unchanged. |
| `video/` | Tooling only (not part of the site): makes the Projects section's preview films from the real sites. See `video/README.md`. |
| `public/` | Images, screenshots, football artwork and the two standalone projects (`projects/study-desk`, `projects/object-lab`), copied as they were. |

Animations that run every frame (the dots, the lanyard, the footballers, the
gallery, the Precision marker, the scroll ring) write styles straight to their
elements instead of re-rendering React. Every listener, timer, observer and
animation is removed when its component unmounts.
