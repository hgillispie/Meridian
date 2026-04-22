import { useEffect, useMemo } from 'react';
import { useCesium } from 'resium';
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  Entity as CesiumEntity,
  JulianDate,
  PolygonHierarchy,
} from 'cesium';
import { useDisruptionStore, disruptionColor } from '@/store/disruptions';
import { useDisruptionData } from '@/hooks/useDisruptionData';
import { useLiveDisruptions } from '@/hooks/useLiveDisruptions';
import { useLayerStore } from '@/store/layers';

/**
 * Render disruption polygons with a subtle pulsing fill so the eye is
 * pulled without the map turning into a disco. Pulse is a sine on wall-
 * clock time → alpha — cheap and GPU-independent.
 *
 * We mount both the demo-data loader and the live-source hooks here so
 * DisruptionZonesLayer is the single owner of everything disruption-
 * related.
 */
export function DisruptionZonesLayer() {
  useDisruptionData();
  useLiveDisruptions();
  const enabled = useLayerStore((s) => s.layers.disruptions.enabled);
  const intensity = useLayerStore((s) => s.layers.disruptions.intensity);
  const { viewer } = useCesium();
  const disruptions = useDisruptionStore((s) => s.disruptions);

  const entityMap = useMemo(() => new Map<string, CesiumEntity>(), []);

  useEffect(() => {
    if (!viewer) return;
    if (!enabled) {
      for (const e of entityMap.values()) viewer.entities.remove(e);
      entityMap.clear();
      return;
    }

    const seen = new Set<string>();
    for (const d of Object.values(disruptions)) {
      seen.add(d.id);
      const css = disruptionColor(d.severity);
      const baseAlpha = d.severity === 'high' ? 0.28 : d.severity === 'moderate' ? 0.22 : 0.16;

      let entity = entityMap.get(d.id);
      const positions = Cartesian3.fromDegreesArray(
        d.polygon.flatMap(([lon, lat]) => [lon, lat])
      );
      if (!entity) {
        entity = new CesiumEntity({
          id: `disruption:${d.id}`,
          position: Cartesian3.fromDegrees(d.center[0], d.center[1]),
        });
        viewer.entities.add(entity);
        entityMap.set(d.id, entity);
      }

      // CallbackProperty on alpha gives a 2 s pulse. Wrapped in a
      // ColorMaterialProperty because PolygonGraphics.material expects
      // a MaterialProperty, not a raw color-returning Property.
      const pulseColor = new CallbackProperty((time) => {
        const t = time instanceof JulianDate ? JulianDate.toDate(time).getTime() : Date.now();
        const pulse = 0.5 + 0.5 * Math.sin((t / 1000) * Math.PI);
        const a = baseAlpha * (0.6 + 0.4 * pulse) * intensity;
        return Color.fromCssColorString(css).withAlpha(a);
      }, false);
      const pulseMaterial = new ColorMaterialProperty(pulseColor);

      entity.polygon = {
        hierarchy: new PolygonHierarchy(positions),
        material: pulseMaterial,
        outline: true,
        outlineColor: Color.fromCssColorString(css).withAlpha(0.75 * intensity),
        outlineWidth: 1,
        height: 0,
      } as unknown as typeof entity.polygon;
    }

    // GC entities whose disruption was removed from the store.
    for (const [id, entity] of entityMap) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity);
        entityMap.delete(id);
      }
    }
  }, [viewer, enabled, disruptions, intensity, entityMap]);

  return null;
}
