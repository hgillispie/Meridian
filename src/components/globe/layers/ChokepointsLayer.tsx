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

/**
 * Render chokepoint polygons + name labels on the globe. Colour is
 * derived from the current "vessels inside" count vs. the baseline —
 * fewer vessels than expected = amber/red, nominal = mint.
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
  const selection = useSelectionStore((s) => s.selection);
  const selectedId =
    selection?.kind === 'chokepoint' ? selection.id : null;

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
      const rgb = statusColor(metric?.vesselsInside ?? 0, baseline?.typicalQueue ?? 0);
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
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      } as unknown as typeof entity.label;
    }
  }, [viewer, enabled, features, metrics, baselines, selectedId, intensity, entityMap]);

  return null;
}

/**
 * Map vessels-inside count vs typical queue size to a status color.
 * Empty / stale = dim slate; normal traffic = mint; heavy queue = amber.
 */
function statusColor(inside: number, typicalQueue: number): string {
  if (inside === 0) return '#64748B'; // slate — no data / empty
  if (typicalQueue > 0 && inside > typicalQueue * 3) return '#F59E0B'; // amber — congested
  if (typicalQueue > 0 && inside > typicalQueue * 1.5) return '#FACC15'; // yellow — elevated
  return '#00E5A8'; // mint — nominal
}
