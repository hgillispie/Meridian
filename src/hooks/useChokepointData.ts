import { useEffect } from 'react';
import { useChokepointStore, type ChokepointFeature, type ChokepointId, type ChokepointBaseline } from '@/store/chokepoints';
import { polygonBbox } from '@/lib/geo/pointInPolygon';

type ChokepointGeoJson = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      id: ChokepointId;
      name: string;
      region: string;
      description: string;
      center: [number, number];
    };
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }>;
};

type BaselineJson = {
  baselines: Record<ChokepointId, ChokepointBaseline>;
};

/**
 * One-shot loader — reads `/data/chokepoints.geojson` +
 * `/data/chokepoint-baselines.json` on mount and pushes them into the
 * zustand store. Kept as a hook so it runs exactly once per app session
 * (the host component is a sibling of the layers that need the data).
 */
export function useChokepointData() {
  const setFeatures = useChokepointStore((s) => s.setFeatures);
  const setBaselines = useChokepointStore((s) => s.setBaselines);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch('/data/chokepoints.geojson').then((r) => r.json() as Promise<ChokepointGeoJson>),
      fetch('/data/chokepoint-baselines.json').then((r) => r.json() as Promise<BaselineJson>),
    ])
      .then(([gj, bl]) => {
        if (cancelled) return;
        const features: ChokepointFeature[] = gj.features.map((f) => {
          // GeoJSON Polygon coordinates are [ring[], …]; we only use the outer ring.
          const ring = f.geometry.coordinates[0].map(
            (c) => [c[0], c[1]] as [number, number]
          );
          return {
            id: f.properties.id,
            name: f.properties.name,
            region: f.properties.region,
            description: f.properties.description,
            center: f.properties.center,
            polygon: ring,
            bbox: polygonBbox(ring),
          };
        });
        setFeatures(features);
        setBaselines(bl.baselines);
      })
      .catch((e: unknown) => {
        // Chokepoint metrics degrade gracefully if the static data fails
        // to load — the layer just renders nothing.
        console.warn('[chokepoints] failed to load static data:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [setFeatures, setBaselines]);
}
