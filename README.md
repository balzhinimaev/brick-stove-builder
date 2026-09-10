# Brick Stove Builder

Mobile-first React prototype for manually building brick stove row layouts («порядовки») in a single 3D workspace, with deliberate placement confirmation, touch camera controls, editable workshop parameters, row locking, and material estimates.

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

The build first runs the TypeScript project build and then creates the Vite
production bundle in `dist/`.

## Test

```bash
npm test          # run once
npm run test:watch
```

Biome is the shared formatter and linter for TypeScript, React (including React
Hooks), and the server-side JavaScript:

```bash
npm run format        # format supported files in place
npm run format:check  # verify formatting without changing files
npm run lint          # run the linter
npm run check         # formatting, linting, TypeScript/Vite build, then tests
```

Run `npm run check` before submitting a change. Generated output such as
`dist/`, dependency directories, coverage, Vite caches, Gradle output, and
Capacitor's generated web assets is excluded from Biome analysis.

## Authentication

Accounts are login + password. On register/login the API returns a stateless,
HMAC-signed token; the SPA stores it and sends it as `Authorization: Bearer …`.
Project routes authorize from the **verified token**, not a client-supplied
header, so one user can no longer read or write another user's projects.

Set `AUTH_SECRET` to a long random value in production. Without it the server
starts with a random per-restart secret and logs a warning — fine for local dev,
but every issued token is invalidated on restart.

## Android app (Capacitor)

The SPA is packaged into a native Android WebView app with Capacitor
(`capacitor.config.ts`, native project in `android/`).

Before building a release, point the app at your deployed backend — a phone
cannot use the relative `/api`. Set `VITE_API_BASE` in `.env.production`
(e.g. `https://your-domain.tld/brick-stove-builder/api`).

Build a debug APK (needs a JDK 21 and the Android SDK with platform 36):

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_SDK_ROOT=/path/to/Android/Sdk   # or android/local.properties: sdk.dir=…
npm run android:apk
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run cap:sync` rebuilds the web bundle and copies it into the native project;
`npm run android:open` opens the project in Android Studio (recommended for
signed release builds / store uploads).

## Current features

- RU/EN/LT UI translations
- Parameter screen for foundation and room dimensions
- Ready project gallery with built-in demo stove layouts, including a 36-course Russian stove with hob
- Row-by-row project previews for stove order layouts («порядовки»)
- MongoDB-backed saved custom projects
- Manual row-by-row brick placement
- Tools: standard brick, half brick, firebrick, vent, cleanout door, eraser
- Horizontal/vertical brick orientation
- Row copy, clear, and lock actions
- One 3D editor for every device; no editable 2D view
- Separate Build and Inspect modes, camera presets, fit, zoom and orbit controls
- Placement ghost with explicit confirmation, coordinate nudges and collision feedback
- Physically consistent vertical scale, instanced masonry, mineral surface detail and mortar beds
- Camera zoom/rotation controls
- Live side silhouette and material summary

## 3D workflow

1. Choose a course and an element in the Tools panel.
2. In **Build**, tap the course plane to select a position. Review the green ghost,
   rotate it or nudge it on the fixed X/Z axes, then press **Place**. Red means blocked
   or outside the foundation. Existing elements must be explicitly erased before
   replacement. Amber outlines show automatic seat cuts and grate supports.
3. Switch to **Inspect** to orbit the complete stove with one finger or left mouse
   drag. Two fingers zoom and pan in both modes; the mouse wheel zooms, right drag
   orbits, and middle drag pans. Pinching, dragging and cancelled touches never place
   an element. Use **Fit** to recover the model, or choose front/top/3D camera views.
4. Use the Rows panel to copy, fill, clear, delete or lock courses. Undo/redo is available
   on desktop and mobile. Existing project storage, account sync, custom cutters,
   material estimates and printable course diagrams remain available.

Keyboard: **R** rotates the selected tool, **B** selects brick, **E** selects eraser,
**arrows** nudge a selected placement, **Enter** confirms, **Escape** cancels,
**Ctrl/Cmd+Z** undoes and **Ctrl/Cmd+Shift+Z** redoes. Forms keep their native shortcuts.
The Set position button and X/Z controls provide a placement route without canvas tapping.
X/Z fields accept millimetres independently of grid snapping, so custom cuts can be
aligned precisely even when an edge falls between the 62.5 mm grid lines.

### Flush seating into cuts

- A new flush plate or grate has its bottom at `65 − thickness` mm and top at 65 mm.
  Placement requires contact with a masonry ledge at that elevation. Missing support
  blocks confirmation with an explanation; the element never silently drops to the course base.
- Automatic cutting may deepen a shallow ledge or widen its footprint. It never fills
  a deeper cut or turns a through-cut back into solid material. Rectangular pieces from
  the cutter can also receive a ledge. A second cut that removes the last contact under
  an existing seated element is rejected as one complete transaction.
- Full-height brick inserts fit through-cuts; an existing shallow ledge blocks them.
  Cut geometry, preview and placement use the same solids. The preview displays the
  proposed cut in place of the original body, and cancelling restores the original view.
- Grate supports are cut into separate pieces, including for a rotated 125 mm wide
  grate. Placement, cut changes and new supports form one undo/redo step.
- The current format stores one rectangular notch and one depth per brick. A cut
  requiring an additional depth alongside a through-hole is rejected. Support checking
  establishes geometric contact only; it does not calculate load-bearing stability.
  Loading saved projects preserves their existing geometry and stored seating elevations.

### Geometry and rendering

- The saved 125 mm modular footprint grid is unchanged. This preserves existing
  projects; standard brick plan dimensions remain approximate because the old grid
  includes the joint allowance. Vertical scale is now uniform: 65 mm body + 5 mm joint
  per 70 mm course, rather than a visually compressed stack.
- `domain/editor/preview.ts` reuses the placement transaction for collision checks,
  automatic seat height, support cuts and eraser/toggle targets.
- `components/three/sceneMath.ts` converts the collision solids into rendered volumes.
  Doors, trim pieces, ledges and flush plates share the same height model.
- `SceneCamera.tsx` owns OrbitControls locally. The editor reducer stores document and
  tool state only; camera commands never rotate the document or enter undo history.
- Masonry and mortar beds use instanced draws, capped pixel density and demand rendering.
  Hardware remains separate geometry. The main editor needs no remote fonts or textures.
- Flues are empty space, with course guides during editing. This remains a layout
  editor, not a thermal, draft, structural or support-analysis simulator.

## Notes

This is an interactive prototype. Material calculations are rough estimates and should be validated before real construction use.

## Русская печь с плитой — общедоступный пример

Откройте `/?screen=showcase#russian-stove-hob` или выберите «Русская печь с плитой» в готовых проектах. 36 редактируемых рядов, плита, горнило, условный свод и труба. Демо доступно без входа и MongoDB, без коммерческой заявки. **Не строительная порядовка.** [Габариты, устройство, ряды и ограничения](docs/russian-stove-demo.md).
