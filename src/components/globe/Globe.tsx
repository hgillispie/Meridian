import { useEffect, useRef } from 'react';
import { Viewer as ResiumViewer, CameraFlyTo } from 'resium';
import { Cartesian3, Math as CesiumMath, type Viewer as CesiumViewer } from 'cesium';
import { loadWorldTileset } from '@/lib/globe/tilesets';

/**
 * Phase 1 globe — Resium `<Viewer>` with all stock UI widgets disabled
 * so we can layer Meridian chrome over the scene.
 *
 * Globe.tsx is responsible only for:
 *   1. mounting the Cesium Viewer
 *   2. loading the world tileset (Google 3D Tiles → Ion fallback)
 *   3. configuring the camera controller for command-center feel
 *
 * Layer data (vessels, aircraft, satellites, chokepoints, …) mount
 * in sibling components that `useCesium()` to get the viewer.
 */
export function Globe() {
  const viewerRef = useRef<{ cesiumElement?: CesiumViewer }>(null);

  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    // Command-center camera: no underground rotation, sensible tilt clamp,
    // faster default zoom, no inertia spin drift.
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableCollisionDetection = true;
    controller.minimumZoomDistance = 10;
    controller.maximumZoomDistance = 30_000_000;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.fog.enabled = true;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    // Kick off tileset load — fire-and-forget
    void loadWorldTileset(viewer);

    // Cleanup: Resium handles viewer destruction on unmount.
  }, []);

  return (
    <ResiumViewer
      ref={viewerRef}
      full
      // Strip stock widgets — we render our own chrome
      animation={false}
      timeline={false}
      baseLayerPicker={false}
      fullscreenButton={false}
      geocoder={false}
      homeButton={false}
      infoBox={false}
      navigationHelpButton={false}
      sceneModePicker={false}
      selectionIndicator={false}
      // Use default imagery (Cesium Ion Bing); 3D Tiles are added on top
      terrain={undefined}
    >
      {/* Initial camera: Pacific-centric, zoomed out to show the fleet */}
      <CameraFlyTo
        destination={Cartesian3.fromDegrees(150, 5, 22_000_000)}
        orientation={{
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-90),
          roll: 0,
        }}
        duration={0}
        once
      />
    </ResiumViewer>
  );
}
