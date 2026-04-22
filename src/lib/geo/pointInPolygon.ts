/**
 * Ray-casting point-in-polygon test.
 *
 * `polygon` is a [lon, lat] ring with the first point repeated at the end
 * (GeoJSON convention). `point` is a single [lon, lat] coordinate.
 *
 * Cheap enough to run against every vessel on every tick for the chokepoint
 * polygons we ship (≤10 vertices each). Don't use this for complex shapes —
 * for those, switch to an R-tree + winding-number solver.
 */
export function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    // Standard ray-cast: count crossings of a horizontal ray to -∞.
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Axis-aligned bounding-box fast-reject — preflight `pointInPolygon` so we
 * don't run ray-cast against every polygon for every vessel.
 */
export function polygonBbox(polygon: number[][]): [number, number, number, number] {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of polygon) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function pointInBbox(
  point: [number, number],
  bbox: [number, number, number, number]
): boolean {
  const [x, y] = point;
  return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3];
}
