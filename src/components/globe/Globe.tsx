import { useEffect, useRef, useState } from 'react';
import { Viewer as ResiumViewer, CameraFlyTo } from 'resium';
import {
  Cartesian2,
  Cartesian3,
  Entity as CesiumEntity,
  Math as CesiumMath,
  ScreenSpaceEventType,
  type Viewer as CesiumViewer,
} from 'cesium';
import { loadWorldTileset } from '@/lib/globe/tilesets';
import { VesselLayer, AircraftLayer } from './layers';
import { useViewportBbox } from '@/hooks/useViewportBbox';
import { useSelectionStore, type SelectionKind } from '@/store/selection';

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
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const bbox = useViewportBbox(viewer);

  useEffect(() => {
    const v = viewerRef.current?.cesiumElement;
    if (!v) return;
    setViewer(v);
  }, []);

  useEffect(() => {
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
  }, [viewer]);

  // Centralized click-to-select — dispatches to selection store based on
  // the picked entity's id prefix (`vessel:<mmsi>`, `aircraft:<icao24>`, …).
  // Cesium only supports one handler per button, so this must be the single
  // owner of LEFT_CLICK; layers write their entity ids and Globe reads them.
  useEffect(() => {
    if (!viewer) return;
    const handler = viewer.screenSpaceEventHandler;
    const select = useSelectionStore.getState().select;
    const KNOWN: readonly SelectionKind[] = [
      'vessel',
      'aircraft',
      'satellite',
      'port',
      'chokepoint',
    ];
    const onLeftClick = (ev: { position: { x: number; y: number } }) => {
      const picked = viewer.scene.pick(new Cartesian2(ev.position.x, ev.position.y));
      if (picked?.id instanceof CesiumEntity && typeof picked.id.id === 'string') {
        const [kind, id] = picked.id.id.split(':');
        if (id && (KNOWN as readonly string[]).includes(kind)) {
          select({ kind: kind as SelectionKind, id });
          return;
        }
      }
      select(null);
    };
    handler.setInputAction(
      onLeftClick as unknown as () => void,
      ScreenSpaceEventType.LEFT_CLICK
    );
    return () => {
      handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
    };
  }, [viewer]);

  return (
    <ResiumViewer
      ref={viewerRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
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
      {/* Initial camera: Singapore Strait regional view — one of the busiest
          shipping corridors on Earth. Close enough (~2,500 km altitude) that
          AIS vessel billboards are visible on first render. */}
      <CameraFlyTo
        destination={Cartesian3.fromDegrees(104, 2, 2_500_000)}
        orientation={{
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-65),
          roll: 0,
        }}
        duration={0}
        once
      />
      {viewer && (
        <>
          <VesselLayer bbox={bbox} />
          <AircraftLayer bbox={bbox} />
        </>
      )}
    </ResiumViewer>
  );
}
