import { geoAlbers } from 'd3-geo';

export const MAP_WIDTH = 4096;
export const MAP_HEIGHT = 2304;

// Fixed Albers projection fitted to the contiguous United States from us-atlas states-10m.
export function createLedgerProjection() {
  return geoAlbers()
    .parallels([29.5, 45.5])
    .rotate([96, 0])
    .center([-0.6, 38.7])
    .scale(4520.179188231777)
    .translate([2047.0615534894691, 1135.4042996638475]);
}

export function projectPoint(longitude: number, latitude: number) {
  const projection = createLedgerProjection();
  const point = projection([longitude, latitude]);
  if (!point) {
    return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  }
  return { x: point[0], y: point[1] };
}
