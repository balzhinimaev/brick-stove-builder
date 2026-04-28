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

```bash
npm ci
npm run dev
```

Run the API/server with MongoDB:

```bash
cp .env.example .env
# edit MONGODB_URI if needed
npm run build
npm run server
```

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
