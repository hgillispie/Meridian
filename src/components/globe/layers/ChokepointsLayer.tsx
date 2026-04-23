import { useEffect, useMemo } from 'react';
import { useCesium } from 'resium';
import {
  Cartesian3,
  Color,
  Entity as CesiumEntity,
  PolygonHierarchy,
  LabelStyle,
  VerticalOrigin,
  HeightReference,
  HorizontalOrigin,
  Cartesian2,
} from 'cesium';
import { useChokepointStore } from '@/store/chokepoints';
import { useChokepointData } from '@/hooks/useChokepointData';
import { useChokepointMetrics } from '@/hooks/useChokepointMetrics';
import { useLayerStore } from '@/store/layers';
import { useSelectionStore } from '@/store/selection';
import { useDisruptionStore } from '@/store/disruptions';
import { deriveChokepointStatus } from '@/lib/globe/chokepointStatus';
import { pointInPolygon } from '@/lib/geo/pointInPolygon';

/**
 * Render chokepoint polygons + name labels on the globe. Colour is
 * derived from the unified status helper (nominal/elevated/congested/
 * critical/stale) so the globe fill and the BottomDock legend agree.
 *
 * Critical status is triggered either by a >50 % transit collapse OR by
 * an overlapping high-severity disruption (e.g. piracy zone over Bab-el-
 * Mandeb). That's why Bab-el-Mandeb flashes red even when its transit
 * count looks nominal in isolation.
 *
 * Polygons are intentionally low-opacity (15 %) so they read as context
 * rather than noise. Selected chokepoint gets a brighter outline.
 */
export function ChokepointsLayer() {
  useChokepointData();
  const enabled = useLayerStore((s) => s.layers.chokepoints.enabled);
  const intensity = useLayerStore((s) => s.layers.chokepoints.intensity);
  useChokepointMetrics(enabled);

  const { viewer } = useCesium();
  const features = useChokepointStore((s) => s.features);
  const metrics = useChokepointStore((s) => s.metrics);
  const baselines = useChokepointStore((s) => s.baselines);
  const disruptions = useDisruptionStore((s) => s.disruptions);
  const selection = useSelectionStore((s) => s.selection);
  const selectedId =
    selection?.kind === 'chokepoint' ? selection.id : null;

  // Pre-filter high-severity disruptions; recomputed whenever the
  // disruption store changes. Cheap vs re-scanning on every feature.
  const highSeverity = useMemo(
    () =>
      Object.values(disruptions).filter(
        (d) => d.severity === 'high' && (d.endedAt === undefined || d.endedAt > Date.now())
      ),
    [disruptions]
  );

  const entityMap = useMemo(() => new Map<string, CesiumEntity>(), []);

  useEffect(() => {
    if (!viewer) return;
    if (!enabled) {
      for (const e of entityMap.values()) viewer.entities.remove(e);
      entityMap.clear();
      return;
    }

    for (const f of features) {
      const metric = metrics[f.id];
      const baseline = baselines[f.id];

      // Overlap = either disruption center is inside the chokepoint, or
      // chokepoint center is inside the disruption. Good enough for the
      // coarse polygons we ship; a proper polygon-intersect would be
      // overkill for 8 chokepoints × ~20 active disruptions.
      const overlapping = highSeverity.some(
        (d) =>
          pointInPolygon(d.center, f.polygon) ||
          pointInPolygon(f.center, d.polygon)
      );

      const statusInfo = deriveChokepointStatus(metric, baseline, overlapping);
      const rgb = statusInfo.color;
      const fill = Color.fromCssColorString(rgb).withAlpha(0.15 * intensity);
      const outline = Color.fromCssColorString(rgb).withAlpha(
        selectedId === f.id ? 0.95 : 0.6
      );

      let entity = entityMap.get(f.id);
      const positions = Cartesian3.fromDegreesArray(
        f.polygon.flatMap(([lon, lat]) => [lon, lat])
      );
      if (!entity) {
        entity = new CesiumEntity({
          id: `chokepoint:${f.id}`,
          position: Cartesian3.fromDegrees(f.center[0], f.center[1]),
        });
        viewer.entities.add(entity);
        entityMap.set(f.id, entity);
      }

      entity.polygon = {
        hierarchy: new PolygonHierarchy(positions),
        material: fill,
        outline: true,
        outlineColor: outline,
        outlineWidth: selectedId === f.id ? 2 : 1,
        height: 0,
      } as unknown as typeof entity.polygon;

      entity.label = {
        text: f.name.toUpperCase(),
        font: '11px "Geist", system-ui, sans-serif',
        fillColor: Color.fromCssColorString('#E6EDF3').withAlpha(0.9 * intensity),
        outlineColor: Color.BLACK.withAlpha(0.7),
        outlineWidth: 2,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        pixelOffset: new Cartesian2(0, -6),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        // Fade out label at continent-scale zoom; the polygon is still
        // readable and the label just adds clutter from orbit height.
        translucencyByDistance: undefined,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#0B0F14').withAlpha(0.55),
        backgroundPadding: new Cartesian2(6, 3),
        // Punch through terrain for labels within 5,000 km of camera
        // (so mountains don't clip them at oblique angles) but let the
        // globe itself occlude far-hemisphere labels. Without this cap
        // you'd see every chokepoint label regardless of which side of
        // the planet you're looking at.
        disableDepthTestDistance: 5_000_000,
      } as unknown as typeof entity.label;
    }
  }, [
    viewer,
    enabled,
    features,
    metrics,
    baselines,
    highSeverity,
    selectedId,
    intensity,
    entityMap,
  ]);

  return null;
}
