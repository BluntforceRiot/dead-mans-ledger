# Map Source Notes

## Generated Assets

The generated map files are:

- `public/assets/map/map-base-usa-4k.svg`
- `public/assets/map/map-base-usa-4k.png`
- `public/assets/map/map-base-usa-4k.webp`

Run:

```sh
npm run map:generate
```

## Geography Sources

The base state geometry comes from the `us-atlas` npm package:

- Package: `us-atlas`
- File used: `node_modules/us-atlas/states-10m.json`
- License: ISC
- Source described by the package as U.S. Census Bureau cartographic boundary shapefiles, 2017 edition, redistributed as TopoJSON.

Major river overlays are generated from a committed local fallback dataset:

- Local file: `scripts/geodata/major-rivers-fallback.geojson`
- Rivers included: Mississippi, Missouri, Ohio, Arkansas, Platte, Columbia, Colorado, Rio Grande, and Red.
- The generator can still try the Natural Earth public-domain river source with a 4.5 second timeout if the local fallback is missing.
- The GitHub Pages workflow does not depend on an unbounded remote fetch.

## Projection

The project uses a fixed Albers projection suitable for the contiguous United States.

Projection helper:

- `src/map/projection.ts`

Constants are shared by the generated map and the browser overlay:

- Width: 4096
- Height: 2304
- Parallels: 29.5, 45.5
- Rotate: 96, 0
- Center: -0.6, 38.7
- Scale: 4520.179188231777
- Translate: 2047.0615534894691, 1135.4042996638475

City nodes are projected from latitude/longitude at runtime.

## What Is Baked Into The Base Map

The base map includes:

- Contiguous U.S. state geometry.
- A merged contiguous U.S. land shape with faint state boundary linework.
- Coastline and Great Lakes shape from the source polygons.
- Major river overlay from the in-repo fallback dataset, with optional timed Natural Earth fallback.
- Decorative antique board-map styling.
- v0.3 paper grain, engraving hatch, softened state boundaries, and board-game color grading.

The base map does not include gameplay city markers, labels, route lines, or selected-route state. Those are drawn by the app from TypeScript data.

## No Google Or AI Geography

No Google Maps screenshots were used.

No AI-generated geography was used.

AI assistance may be used later for decorative art, panels, tokens, or title treatments, but not for U.S. coastline, Great Lakes, city positions, or route coordinates.

## v0.5 Status

The v0.5 final-candidate pass keeps the geodata pipeline deterministic for CI by adding the local river fallback and `npm run verify:assets`.

## Known Map Limitations

- State shapes are simplified at the `10m` TopoJSON level.
- Terrain bands are decorative, not terrain data.
- Major river linework is generalized for board-game readability.
- State boundaries are intentionally subdued in v0.3; a later art pass may add richer terrain styling without changing the geodata.
