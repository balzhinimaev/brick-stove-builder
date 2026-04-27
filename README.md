# Brick Stove Builder

Mobile-first React prototype for manually building brick stove row layouts («порядовки») with a synchronized 2D grid, 3D Three.js preview, editable workshop parameters, row locking, and material estimates.

## Stack

- React 19
- TypeScript
- Vite
- Three.js / React Three Fiber / Drei
- Tailwind CSS

## Run locally

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Current features

- RU/EN/LT UI translations
- Parameter screen for foundation and room dimensions
- Manual row-by-row brick placement
- Tools: standard brick, half brick, firebrick, vent, cleanout door, eraser
- Horizontal/vertical brick orientation
- Row copy, clear, and lock actions
- 2D layout editor and 3D masonry preview
- Camera zoom/rotation controls
- Live side silhouette and material summary

## Notes

This is an interactive prototype. Material calculations are rough estimates and should be validated before real construction use.
