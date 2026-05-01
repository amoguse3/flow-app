# Wispucci AI

> Learn anything in 5-minute bites. Built for short attention spans.

Wispucci is a browser-first EdTech app that runs entirely in the browser — no
server needed. State is kept in `localStorage`, so users can open the URL and
start learning immediately.

The same codebase also ships as a desktop app (Electron). The web build and the
desktop build share the React renderer and the shared API contract under
`shared/`.

## Quick start (web)

```bash
npm install

# Local dev server with HMR
npm run web:dev

# Production build into ./dist-web
npm run web:build

# Preview the production build
npm run web:preview
```

Then open the printed URL (default `http://localhost:5173`).

## Project layout

```
.
├── src/
│   ├── renderer/           # React SPA — used for both web and desktop
│   │   ├── index.html      # HTML entry (used by both web and desktop builds)
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── browser-aura.ts   # Pure-browser implementation of the AuraAPI
│   │       ├── web-bridge.ts     # Chooses browser vs Electron-IPC backend
│   │       ├── components/       # All UI
│   │       └── ...
│   ├── main/               # Electron main process (desktop-only)
│   └── preload/            # Electron preload (desktop-only)
├── shared/                 # Types and i18n shared between targets
├── public/                 # Static assets served verbatim by the web build
├── vite.config.ts          # Web-only Vite config (output: dist-web/)
├── electron.vite.config.ts # Electron build pipeline (output: out/)
└── vercel.json             # Vercel deploy config (uses npm run web:build)
```

The web build is a single-page application. All routing and persistence is
client-side; no API server is required.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run web:dev` | Start the web dev server (Vite, HMR). |
| `npm run web:build` | Build the website into `dist-web/`. |
| `npm run web:preview` | Serve the production build locally. |
| `npm run dev` | Start the Electron desktop app in dev mode. |
| `npm run build` | Build the Electron app into `out/`. |
| `npm run typecheck` | Type-check both renderer and main. |

## How browser mode works

`src/renderer/src/web-bridge.ts` runs at boot. When the app is loaded from
anything other than the local Electron dev bridge (`127.0.0.1:4315`), it
installs `createBrowserAura()` from `browser-aura.ts` as `window.aura`.

`browser-aura.ts` implements the full `AuraAPI` contract from
`shared/types.ts` against `window.localStorage`. Tasks, courses, flashcards,
games, motivation/streak data, and chat history are all persisted in the
user's browser only.

This means:

- The site works offline after first load.
- Each browser is its own isolated profile — there is no server-side account.
- Clearing site data resets the app.

## Deployment

### Vercel (configured)

`vercel.json` is preconfigured. Connect the repo on Vercel and it will run
`npm run web:build` and serve `dist-web/`.

### Any static host

The output of `npm run web:build` is a plain static SPA. Serve `dist-web/`
behind any static host (Netlify, Cloudflare Pages, GitHub Pages, S3 + CDN…)
with a fallback rewrite of unknown paths to `/index.html`.
