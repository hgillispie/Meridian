import type { Disruption } from '@/store/disruptions';

/**
 * NOAA National Weather Service "active alerts" API. Keyless, public,
 * CORS-enabled. We filter for marine-relevant alert types and project
 * each alert's affected area as a polygon disruption.
 *
 * docs: https://www.weather.gov/documentation/services-web-api
 */

const MARINE_EVENTS = new Set([
  'Small Craft Advisory',
  'Gale Warning',
  'Storm Warning',
  'Hurricane Force Wind Warning',
  'Tropical Storm Warning',
  'Hurricane Warning',
  'Tsunami Warning',
  'Coastal Flood Warning',
  'High Seas Warning',
]);

type NwsFeature = {
  id: string;
  properties: {
    event: string;
    headline?: string;
    description?: string;
    severity?: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
    effective?: string;
    expires?: string;
  };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | null;
};
type NwsFeed = { features: NwsFeature[] };

export async function fetchNoaaMarineAlerts(): Promise<Disruption[]> {
  const url = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert';
  try {
    const res = await fetch(url, { headers: { Accept: 'application/geo+json' } });
    if (!res.ok) return [];
    const feed = (await res.json()) as NwsFeed;
    const out: Disruption[] = [];
    for (const f of feed.features) {
      if (!MARINE_EVENTS.has(f.properties.event)) continue;
      if (!f.geometry) continue;
      // Flatten MultiPolygon to first outer ring for this iteration —
      // the map can't afford exploded complex geometries at globe scale
      // and NOAA ground-truth isn't precise at our resolution anyway.
      let ring: number[][] | null = null;
      if (f.geometry.type === 'Polygon') ring = f.geometry.coordinates[0];
      else ring = f.geometry.coordinates[0]?.[0] ?? null;
      if (!ring || ring.length < 4) continue;
      const center = centroid(ring);
      out.push({
        id: `noaa:${f.id}`,
        kind: 'weather',
        severity: mapSeverity(f.properties.severity),
        title: f.properties.event,
        detail: f.properties.headline ?? f.properties.description?.slice(0, 240),
        startedAt: f.properties.effective ? Date.parse(f.properties.effective) : Date.now(),
        endedAt: f.properties.expires ? Date.parse(f.properties.expires) : undefined,
        polygon: ring,
        center,
        source: 'NOAA NWS',
      });
    }
    // Cap to 30 so the globe doesn't get plastered during hurricane season.
    return out.slice(0, 30);
  } catch {
    return [];
  }
}

function mapSeverity(s?: string): 'low' | 'moderate' | 'high' {
  if (s === 'Extreme' || s === 'Severe') return 'high';
  if (s === 'Moderate') return 'moderate';
  return 'low';
}

function centroid(ring: number[][]): [number, number] {
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / ring.length, sumLat / ring.length];
}
