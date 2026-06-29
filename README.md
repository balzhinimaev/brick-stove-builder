# Brick Stove Builder

Mobile-first React prototype for manually building brick stove row layouts («порядовки») with a synchronized 2D grid, 3D Three.js preview, editable workshop parameters, row locking, and material estimates.

## Stack

- React 19
- TypeScript
- Vite
- Three.js / React Three Fiber / Drei
- Tailwind CSS
- Express + Mongoose API for saved projects
- Vitest for domain + auth unit tests

## Project structure

The frontend is split out of a single large component into focused modules:

```
src/
  App.tsx                 thin root that wires the hook to the screens
  theme/colors.ts         shared palette
  i18n/                   translations (ru/en/lt) + useI18n; en/lt completeness enforced at compile time
  domain/                 framework-free logic: types, geometry, materials, parameters, tools, demo projects
  domain/editor.ts        pure editor reducer (place/lock/copy/param transitions) — no React
  domain/__tests__/       Vitest unit tests (editor reducer, geometry, materials, parameters, i18n)
  api/client.ts           fetch helpers + token-based session handling
  storage/draft.ts        local autosave draft
  hooks/
    useEditor.ts          React binding over the reducer (+ id allocation, derived materials)
    useSession.ts         auth + token session
    useSavedProjects.ts   server-backed saved projects
    useAutosaveDraft.ts   debounced local draft autosave
    useStudioState.ts     thin composition root wiring the above
  components/             UI screens and controls; components/three is the R3F scene,
                          lazy-loaded behind a Suspense + ErrorBoundary
  lib/id.ts               collision-free id generation

server/
  index.js                entry: connect Mongo, build app, listen
  config.js  db.js  app.js
  models/ middleware/ routes/ lib/   (auth tokens, password hashing, validation)
```

## Run locally

**Frontend + hot reload** (Vite dev server). The terminal prints the exact URL (by default `127.0.0.1:5173`, or the next free port if that one is busy):

```bash
npm ci
npm run dev
```

With the default setup, `/api` is proxied to Express on `127.0.0.1:4174`. Start the backend in another terminal:

```bash
cp .env.example .env
# edit MONGODB_URI if needed
npm run server
```

You only need `npm run build` before `npm run server` if you want Express to serve the production `dist/` bundle from the same port. During pure API development, running `npm run server` alone is enough; Vite will proxy API calls without a local `dist` build.

To point the SPA at another API explicitly, set `VITE_API_BASE` (e.g. `http://127.0.0.1:4174/api`); change the proxy target with `VITE_DEV_API_ORIGIN` (defaults to `http://127.0.0.1:4174`).

**Production-style** (single process: Express + static build):

```bash
npm run build
npm run server
```

Run everything in Docker on one network:

```bash
docker compose up -d --build
```

Compose starts:

- `app` — Express + static built frontend, published on `127.0.0.1:4174`
- `mongo` — MongoDB 7, internal-only, reachable from app as `mongodb://mongo:27017/brick-stove-builder`
- shared bridge network `brick-stove`

If the app is served behind nginx at `/brick-stove-builder/`, use `deploy/nginx.brick-stove-builder.conf` as the proxy snippet.

The frontend uses `/api` by default locally and `/brick-stove-builder/api` when deployed under `/brick-stove-builder/`.

## Build

```bash
npm run build
```

## Test

```bash
npm test          # run once
npm run test:watch
```

## Authentication

Accounts are login + password. On register/login the API returns a stateless,
HMAC-signed token; the SPA stores it and sends it as `Authorization: Bearer …`.
Project routes authorize from the **verified token**, not a client-supplied
header, so one user can no longer read or write another user's projects.

Set `AUTH_SECRET` to a long random value in production. Without it the server
starts with a random per-restart secret and logs a warning — fine for local dev,
but every issued token is invalidated on restart.

## Current features

- RU/EN/LT UI translations
- Parameter screen for foundation and room dimensions
- Ready project gallery with two demo stove layouts
- Row-by-row project previews for stove order layouts («порядовки»)
- MongoDB-backed saved custom projects
- Manual row-by-row brick placement
- Tools: standard brick, half brick, firebrick, vent, cleanout door, eraser
- Horizontal/vertical brick orientation
- Row copy, clear, and lock actions
- 2D layout editor and 3D masonry preview
- Camera zoom/rotation controls
- Live side silhouette and material summary

## Notes

This is an interactive prototype. Material calculations are rough estimates and should be validated before real construction use.
