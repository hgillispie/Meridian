import { Cartesian3, type Viewer } from 'cesium';

/**
 * Camera singleton so non-React modules (spotlight actions, URL
 * restoration, demo-mode scripts) can fly the Cesium camera without
 * plumbing the viewer through props. Globe.tsx owns the lifecycle and
 * calls `setCameraApiViewer` when the viewer is ready (and `null` on
 * unmount).
 *
 * No state is stored here beyond the reference — the actual camera
 * state lives on Cesium's own `camera` object.
 */
let viewerRef: Viewer | null = null;

export function setCameraApiViewer(v: Viewer | null): void {
  viewerRef = v;
}

export function getViewer(): Viewer | null {
  return viewerRef;
}

/** Smooth fly to a lon/lat with a default 1.4s ease-in-out. */
export function flyTo(
  lon: number,
  lat: number,
  altitudeM = 500_000,
  durationSec = 1.4
): void {
  if (!viewerRef) return;
  viewerRef.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, altitudeM),
    duration: durationSec,
  });
}
