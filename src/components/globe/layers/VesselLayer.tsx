import { useEffect, useMemo } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian3,
  Color,
  Entity as CesiumEntity,
  HeightReference,
  HorizontalOrigin,
  Math as CesiumMath,
  VerticalOrigin,
} from 'cesium';
import {
  categorizeShipType,
  vesselColor,
} from '@/types/vessel';
import { useAisStream } from '@/hooks/useAisStream';
import type { Bbox } from '@/lib/geo/bbox';
import { useLayerStore } from '@/store/layers';
import { useLiveDataStore } from '@/store/liveData';

// Reuse a single chevron SVG billboard image per color to keep GPU memory tame.
const chevronCache = new Map<string, string>();
function chevronSvg(color: string): string {
  const cached = chevronCache.get(color);
  if (cached) return cached;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>
    <path d='M8 1 L14 13 L8 10 L2 13 Z' fill='${color}' stroke='#07090D' stroke-width='0.8' stroke-linejoin='round'/>
  </svg>`;
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  chevronCache.set(color, uri);
  return uri;
}

export function VesselLayer({ bbox }: { bbox: Bbox }) {
  const enabled = useLayerStore((s) => s.layers.vessels.enabled);
  const { viewer } = useCesium();
  const { vessels, tick } = useAisStream(bbox, enabled);
  const upsertVessels = useLiveDataStore((s) => s.upsertVessels);

  // Maintain a stable Cesium EntityCollection owned by this layer.
  const entityMap = useMemo(() => new Map<number, CesiumEntity>(), []);

  // Mirror the live Map into the zustand store so cards can read by MMSI.
  useEffect(() => {
    if (!enabled) return;
    upsertVessels(vessels.values());
    // vessels is a stable ref; tick bumps on every batched update.
  }, [tick, vessels, enabled, upsertVessels]);

  useEffect(() => {
    if (!viewer) return;
    if (!enabled) {
      for (const e of entityMap.values()) viewer.entities.remove(e);
      entityMap.clear();
      return;
    }

    // Reconcile entities against the current vessel map.
    const seen = new Set<number>();
    for (const v of vessels.values()) {
      if (v.lat == null || v.lon == null) continue;
      seen.add(v.mmsi);
      let entity = entityMap.get(v.mmsi);
      if (!entity) {
        entity = new CesiumEntity({
          id: `vessel:${v.mmsi}`,
          position: Cartesian3.fromDegrees(v.lon, v.lat),
        });
        viewer.entities.add(entity);
        entityMap.set(v.mmsi, entity);
      } else {
        entity.position = Cartesian3.fromDegrees(v.lon, v.lat) as unknown as typeof entity.position;
      }
      const color = vesselColor(categorizeShipType(v.shipType));
      const rotationRad = CesiumMath.toRadians(-(v.heading ?? v.cog ?? 0));
      entity.billboard = {
        image: chevronSvg(color),
        rotation: rotationRad,
        alignedAxis: Cartesian3.ZERO,
        scale: 0.9,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        color: Color.WHITE,
        // Only disable depth test when camera is within 50 km so the billboard
        // isn't occluded by nearby terrain. Beyond that distance we let the
        // scene cull billboards on the far side of the globe — otherwise they
        // render through the earth and look detached from world position.
        disableDepthTestDistance: 50_000,
      } as unknown as typeof entity.billboard;
    }

    // Remove stale entities beyond a grace window — AIS position reports are
    // sparse, so we keep a vessel on screen for 10 minutes after its last ping
    // to avoid flicker. vesselsRef already maintains this; if it drops out of
    // the map we drop the entity too.
    for (const [mmsi, entity] of entityMap) {
      if (!seen.has(mmsi)) {
        viewer.entities.remove(entity);
        entityMap.delete(mmsi);
      }
    }
    // vessels is a stable ref — use `tick` to re-run on every batched update.
  }, [viewer, tick, vessels, enabled, entityMap]);

  return null;
}
