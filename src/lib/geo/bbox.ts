import {
  Cartographic,
  Math as CesiumMath,
  Rectangle,
  type Viewer,
} from 'cesium';

export type Bbox = {
  /** West longitude in degrees, −180..180. */
  west: number;
  /** South latitude in degrees, −90..90. */
  south: number;
  /** East longitude in degrees, −180..180. */
  east: number;
  /** North latitude in degrees, −90..90. */
  north: number;
};

/**
 * Derive the current viewport's bounding box in degrees. Falls back to a
 * global bbox when the camera doesn't intersect the globe (e.g. looking
 * at space). Clamped to valid ranges.
 */
export function viewportBbox(viewer: Viewer): Bbox {
  const rect: Rectangle | undefined = viewer.camera.computeViewRectangle();
  if (!rect) return { west: -180, south: -85, east: 180, north: 85 };

  return {
    west: clampLon(CesiumMath.toDegrees(rect.west)),
    south: clampLat(CesiumMath.toDegrees(rect.south)),
    east: clampLon(CesiumMath.toDegrees(rect.east)),
    north: clampLat(CesiumMath.toDegrees(rect.north)),
  };
}

/**
 * Inflate bbox by a percentage on each side. Helps keep entities visible
 * when the user is mid-pan/zoom so we don't flicker in and out.
 */
export function inflateBbox(bbox: Bbox, pct = 0.1): Bbox {
  const dLon = (bbox.east - bbox.west) * pct;
  const dLat = (bbox.north - bbox.south) * pct;
  return {
    west: clampLon(bbox.west - dLon),
    south: clampLat(bbox.south - dLat),
    east: clampLon(bbox.east + dLon),
    north: clampLat(bbox.north + dLat),
  };
}

export function bboxArea(bbox: Bbox): number {
  return Math.max(0, bbox.east - bbox.west) * Math.max(0, bbox.north - bbox.south);
}

export function bboxContains(bbox: Bbox, lon: number, lat: number): boolean {
  // Handle antimeridian wrap: if west > east we crossed ±180
  const inLon = bbox.west <= bbox.east ? lon >= bbox.west && lon <= bbox.east : lon >= bbox.west || lon <= bbox.east;
  return inLon && lat >= bbox.south && lat <= bbox.north;
}

export function worldBbox(): Bbox {
  return { west: -180, south: -85, east: 180, north: 85 };
}

function clampLon(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < -180) return -180;
  if (v > 180) return 180;
  return v;
}
function clampLat(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < -85) return -85;
  if (v > 85) return 85;
  return v;
}

/** Cartographic lat/lon in radians → degrees. */
export function cartoToDegrees(c: Cartographic): { lon: number; lat: number } {
  return {
    lon: CesiumMath.toDegrees(c.longitude),
    lat: CesiumMath.toDegrees(c.latitude),
  };
}
