# Brick Stove Builder

Mobile-first React prototype for manually building brick stove row layouts («порядовки») with a synchronized 2D grid, 3D Three.js preview, editable workshop parameters, row locking, and material estimates.

## Stack

- React 19
- TypeScript
- Vite
- Three.js / React Three Fiber / Drei
- Tailwind CSS
- Express + Mongoose API for saved projects

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
