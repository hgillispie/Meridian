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
import { loadWorldTileset, installAltitudeGate } from '@/lib/globe/tilesets';
import { VesselLayer, AircraftLayer, SatelliteLayer } from './layers';
import { useViewportBbox } from '@/hooks/useViewportBbox';
import { useSelectionStore, type SelectionKind } from '@/store/selection';
import { useClockBridge } from '@/hooks/useClockBridge';
import { setCameraApiViewer } from '@/lib/globe/cameraApi';
import { useShareableUrl } from '@/hooks/useShareableUrl';

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
  useClockBridge(viewer);
  useShareableUrl(viewer);

  // Resium populates `cesiumElement` on the ref asynchronously, so a one-shot
  // useEffect with `[]` deps can miss it. Poll with rAF until it shows up.
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const v = viewerRef.current?.cesiumElement;
      if (v) {
        setViewer(v);
        setCameraApiViewer(v);
        // Dev-only diagnostic hook so the Claude Preview agent can inspect
        // entities / camera state from the console.
        if (import.meta.env.DEV) {
          (window as unknown as { __viewer?: unknown }).__viewer = v;
        }
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      setCameraApiViewer(null);
    };
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

    // Kick off tileset load and wire an altitude gate so we don't stream
    // photorealistic tiles during wide-angle globe spins (Bing imagery is
    // indistinguishable at that distance, and Google's Map Tiles API is
    // metered per request).
    let detachGate: (() => void) | undefined;
    void loadWorldTileset(viewer).then((tileset) => {
      if (tileset) detachGate = installAltitudeGate(viewer, tileset);
    });

    return () => {
      detachGate?.();
    };
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
          <SatelliteLayer />
        </>
      )}
    </ResiumViewer>
  );
}
