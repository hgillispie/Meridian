import { useEffect, useMemo } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  Entity as CesiumEntity,
  HeightReference,
  HorizontalOrigin,
  VerticalOrigin,
} from 'cesium';
import { useWebcamStore } from '@/store/webcams';
import { useWebcamData } from '@/hooks/useWebcamData';
import { useLayerStore } from '@/store/layers';
import { useSelectionStore } from '@/store/selection';

/**
 * Render a camera-icon pin above every curated webcam. Clicking the pin
 * dispatches a port-selection (entity id = `port:<unlocode>`) which the
 * Globe's central click handler already routes into the selection
 * store. The RightRail's PortCard then reads the active webcam for the
 * port.
 *
 * The icon is a tiny inline SVG rasterized into a data URL so we don't
 * ship a sprite. Mint fill when selected; dim white otherwise.
 */
export function WebcamsLayer() {
  useWebcamData();
  const enabled = useLayerStore((s) => s.layers.webcams.enabled);
  const intensity = useLayerStore((s) => s.layers.webcams.intensity);
  const { viewer } = useCesium();
  const webcams = useWebcamStore((s) => s.webcams);
  const selection = useSelectionStore((s) => s.selection);
  const selectedPort =
    selection?.kind === 'port' ? selection.id : null;

  // Each entity keyed by webcam id so multiple cams at the same port
  // all show up as distinct pins.
  const entityMap = useMemo(() => new Map<string, CesiumEntity>(), []);

  useEffect(() => {
    if (!viewer) return;
    if (!enabled) {
      for (const e of entityMap.values()) viewer.entities.remove(e);
      entityMap.clear();
      return;
    }

    const seen = new Set<string>();
    for (const cam of webcams) {
      seen.add(cam.id);
      const isSelected = selectedPort === cam.portCode;

      let entity = entityMap.get(cam.id);
      if (!entity) {
        entity = new CesiumEntity({
          // Id prefix = `port:` so the central click handler treats the
          // selection as a port. We lose per-cam targeting on the globe
          // (ports with multiple cams share a single selection), but
          // the PortCard exposes a camera switcher for that.
          id: `port:${cam.portCode}`,
          position: Cartesian3.fromDegrees(cam.location[0], cam.location[1]),
        });
        viewer.entities.add(entity);
        entityMap.set(cam.id, entity);
      } else {
        entity.position = Cartesian3.fromDegrees(
          cam.location[0],
          cam.location[1]
        ) as unknown as typeof entity.position;
      }

      entity.billboard = {
        image: cameraIconDataUrl(isSelected),
        width: isSelected ? 26 : 20,
        height: isSelected ? 26 : 20,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -2),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        color: Color.WHITE.withAlpha(
          Math.min(1, 0.85 * intensity + (isSelected ? 0.15 : 0))
        ),
        // Hide from low-Earth-orbit — too much noise at that zoom.
        distanceDisplayCondition: new DistanceDisplayCondition(
          0,
          12_000_000
        ),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      } as unknown as typeof entity.billboard;

      entity.label = {
        text: cam.title.replace(/ — .*/, ''),
        font: '10px "Geist", system-ui, sans-serif',
        fillColor: Color.fromCssColorString('#E6EDF3').withAlpha(
          isSelected ? 0.95 : 0.65
        ),
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(14, 0),
        // Only show the label at close-ish zoom to avoid overlapping
        // chokepoint labels when the camera is far out.
        distanceDisplayCondition: new DistanceDisplayCondition(
          0,
          2_000_000
        ),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#0B0F14').withAlpha(0.65),
        backgroundPadding: new Cartesian2(5, 3),
      } as unknown as typeof entity.label;
    }

    // GC pins for webcams that have been removed from the directory.
    for (const [id, entity] of entityMap) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entityMap.delete(id);
      }
    }
  }, [viewer, enabled, webcams, selectedPort, intensity, entityMap]);

  return null;
}

/**
 * Return a data-URL SVG of a camera glyph. Two variants so the selected
 * pin pops in mint, the others read as a dim neutral fill.
 */
function cameraIconDataUrl(selected: boolean): string {
  const fill = selected ? '#00E5A8' : '#E6EDF3';
  const bg = selected ? '#0B0F14' : '#0B0F14';
  const stroke = selected ? '#00E5A8' : '#64748B';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="11" fill="${bg}" stroke="${stroke}" stroke-width="1.5"/>
      <path d="M7.5 9h2.2l.9-1.3h2.8l.9 1.3h2.2a.8.8 0 0 1 .8.8v5.6a.8.8 0 0 1-.8.8H7.5a.8.8 0 0 1-.8-.8V9.8a.8.8 0 0 1 .8-.8Z"
            fill="none" stroke="${fill}" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="12" cy="12.6" r="2.2" fill="none" stroke="${fill}" stroke-width="1.4"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
