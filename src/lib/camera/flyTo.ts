import { Cartesian3, Math as CesiumMath, type Viewer } from 'cesium';

export type FlyTarget = {
  lon: number; // degrees
  lat: number; // degrees
  altMeters?: number; // default 2_000_000 for country-scale
  headingDeg?: number;
  pitchDeg?: number; // default -45
  durationSec?: number; // default 1.4 (matches §5.2 motion spec)
};

/**
 * Cinematic "fly to" — 1.4s ease-in-out by default so the globe always moves
 * the same way the demo narrative describes (§5.2 motion · §7.1 camera).
 */
export function flyTo(viewer: Viewer, target: FlyTarget): void {
  const {
    lon,
    lat,
    altMeters = 2_000_000,
    headingDeg = 0,
    pitchDeg = -45,
    durationSec = 1.4,
  } = target;

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, altMeters),
    orientation: {
      heading: CesiumMath.toRadians(headingDeg),
      pitch: CesiumMath.toRadians(pitchDeg),
      roll: 0,
    },
    duration: durationSec,
    easingFunction: undefined, // Cesium's default EASE_IN_OUT_QUAD is correct here
  });
}

/**
 * Home view the app returns to on load: Pacific-centric (matches §2.3 opening).
 */
export const PACIFIC_HOME: FlyTarget = {
  lon: 150,
  lat: 5,
  altMeters: 22_000_000,
  pitchDeg: -90,
  durationSec: 0,
};

/**
 * Hero port presets for the command palette + demo narrative (§13.1).
 */
export const HERO_PORTS = {
  singapore: { lon: 103.85, lat: 1.29, altMeters: 60_000, pitchDeg: -35 },
  rotterdam: { lon: 4.13, lat: 51.95, altMeters: 60_000, pitchDeg: -35 },
  losangeles: { lon: -118.27, lat: 33.75, altMeters: 60_000, pitchDeg: -35 },
  shanghai: { lon: 121.62, lat: 31.2, altMeters: 60_000, pitchDeg: -35 },
  panama: { lon: -79.52, lat: 9.08, altMeters: 80_000, pitchDeg: -35 },
} as const satisfies Record<string, FlyTarget>;
