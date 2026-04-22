import { useEffect, useMemo, useState } from 'react';
import { loadDefaultEoBundle } from '@/lib/api/celestrak';
import type {
  Satellite,
  SatelliteCategory,
} from '@/types/satellite';

type EnrichmentFile = {
  operators?: Record<
    string,
    { operator?: string; mission?: string; category?: SatelliteCategory }
  >;
  planetPrefixes?: Record<
    string,
    { operator?: string; mission?: string; category?: SatelliteCategory }
  >;
};

type UseSatellitesResult = {
  satellites: Satellite[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
};

/**
 * Load + enrich the default commercial-EO satellite set. Runs once on
 * mount; TLE bundle is itself cached 2h in localStorage by
 * `loadDefaultEoBundle`, so repeat mounts are instant.
 */
export function useSatellites(enabled: boolean): UseSatellitesResult {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [status, setStatus] = useState<UseSatellitesResult['status']>('idle');
  const [error, setError] = useState<string | undefined>(undefined);
  const [enrichment, setEnrichment] = useState<EnrichmentFile | null>(null);

  // Load enrichment JSON once
  useEffect(() => {
    let cancelled = false;
    fetch('/data/satellites.json')
      .then((r) => r.json() as Promise<EnrichmentFile>)
      .then((d) => {
        if (!cancelled) setEnrichment(d);
      })
      .catch(() => {
        if (!cancelled) setEnrichment({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load TLE bundle when enabled
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setStatus('loading');
    loadDefaultEoBundle()
      .then((list) => {
        if (cancelled) return;
        setSatellites(list);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return useMemo(() => {
    if (!enrichment) return { satellites, status, error };
    const enriched = satellites.map((s) => enrich(s, enrichment));
    return { satellites: enriched, status, error };
  }, [satellites, enrichment, status, error]);
}

function enrich(sat: Satellite, file: EnrichmentFile): Satellite {
  const byId = file.operators?.[String(sat.noradId)];
  if (byId) {
    return {
      ...sat,
      operator: byId.operator,
      mission: byId.mission,
      category: byId.category,
    };
  }
  const upper = sat.name.toUpperCase();
  for (const [prefix, meta] of Object.entries(file.planetPrefixes ?? {})) {
    if (upper.startsWith(prefix)) {
      return {
        ...sat,
        operator: meta.operator,
        mission: meta.mission,
        category: meta.category,
      };
    }
  }
  return sat;
}

/**
 * Filter to the "commercial EO" preset — Sentinel-1/2, Landsat-8/9,
 * Planet, Capella, Maxar, ICEYE. A satellite is included if either:
 *   - its enrichment category is eo-optical / eo-radar / eo-other, OR
 *   - its TLE name matches a well-known commercial EO prefix.
 */
export function filterCommercialEo(sats: Satellite[]): Satellite[] {
  return sats.filter((s) => {
    if (s.category === 'eo-optical' || s.category === 'eo-radar' || s.category === 'eo-other') return true;
    const n = s.name.toUpperCase();
    return (
      n.startsWith('SENTINEL') ||
      n.startsWith('LANDSAT') ||
      n.startsWith('FLOCK') ||
      n.startsWith('SKYSAT') ||
      n.startsWith('DOVE') ||
      n.startsWith('CAPELLA') ||
      n.startsWith('WORLDVIEW') ||
      n.startsWith('GEOEYE') ||
      n.startsWith('ICEYE') ||
      n.startsWith('SPOT') ||
      n.startsWith('PLEIADES') ||
      n.startsWith('PLÉIADES')
    );
  });
}
