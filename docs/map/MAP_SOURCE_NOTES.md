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

Major river overlays are fetched by the generator from Natural Earth vector data:

- Source URL: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson`
- Natural Earth public-domain map data.
- Rivers used include Mississippi, Missouri, Ohio, Arkansas, Platte, Columbia, Colorado, Rio Grande, and Red where available in the source.

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
- Faint state boundaries.
- Coastline and Great Lakes shape from the source polygons.
- Major river overlay from Natural Earth.
- Decorative antique board-map styling.

The base map does not include gameplay city markers, labels, route lines, or selected-route state. Those are drawn by the app from TypeScript data.

## No Google Or AI Geography

No Google Maps screenshots were used.

No AI-generated geography was used.

AI assistance may be used later for decorative art, panels, tokens, or title treatments, but not for U.S. coastline, Great Lakes, city positions, or route coordinates.

## Known Map Limitations

- State shapes are simplified at the `10m` TopoJSON level.
- Terrain bands are decorative, not terrain data.
- Major river linework is generalized for board-game readability.
- State lines remain visible in v0.1; a later art pass may make them even fainter.
