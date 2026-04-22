import type { Satellite, SatelliteSource } from '@/types/satellite';

/**
 * CelesTrak TLE catalog client.
 *
 * CelesTrak exposes public-domain TLE catalogs at
 *   https://celestrak.org/NORAD/elements/gp.php?GROUP=<group>&FORMAT=tle
 *
 * We fetch three tight EO-focused bundles by default (sentinel, resource,
 * planet). `active` is available as an optional broad fallback but is
 * large (~10k objects) and only loaded when a caller explicitly asks.
 *
 * TLE data is cached in `localStorage` for 2 hours — a single TLE "ages"
 * on the order of days, so 2h is a comfortable freshness window that
 * keeps repeat loads instant.
 */

const BASE = 'https://celestrak.org/NORAD/elements/gp.php';
const TTL_MS = 2 * 60 * 60 * 1000;
const CACHE_PREFIX = 'meridian.celestrak.v1.';

// CelesTrak GP group names. Sentinels + Landsat live under "resource"; there
// is no standalone "sentinel" group on CelesTrak. We keep the
// `SatelliteSource` union for downstream tagging but route the sentinel bucket
// to the resource catalog (so cached TLEs still include Sentinel-1/2/3/5P/6).
const GROUPS: Record<SatelliteSource, string> = {
  sentinel: 'resource',
  resource: 'resource',
  planet: 'planet',
  active: 'active',
};

type CacheEntry = {
  fetchedAt: number;
  /** Raw TLE text as served by CelesTrak. */
  body: string;
};

function cacheKey(source: SatelliteSource): string {
  return `${CACHE_PREFIX}${source}`;
}

function readCache(source: SatelliteSource): CacheEntry | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(source));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.fetchedAt > TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(source: SatelliteSource, body: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), body };
    localStorage.setItem(cacheKey(source), JSON.stringify(entry));
  } catch {
    // Quota exceeded — silently skip caching
  }
}

async function fetchTleBundle(source: SatelliteSource): Promise<string> {
  const cached = readCache(source);
  if (cached) return cached.body;
  const url = `${BASE}?GROUP=${GROUPS[source]}&FORMAT=tle`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CelesTrak ${source} fetch failed: ${res.status}`);
  }
  const body = await res.text();
  // CelesTrak returns a plain-text error like `Invalid query: "..."` with a
  // 200 status when the group name is wrong. Never cache those.
  if (body.startsWith('Invalid query')) {
    throw new Error(`CelesTrak rejected group "${GROUPS[source]}": ${body}`);
  }
  writeCache(source, body);
  return body;
}

/**
 * Parse a TLE triplet into a `Satellite` record. TLE format:
 *   line 0: name (24 chars)
 *   line 1: '1 ' + NORAD id + ...
 *   line 2: '2 ' + NORAD id + inclination + RAAN + ecc + argp + MA + MM ...
 *
 * Mean motion (rev/day) is in TLE line 2 cols 53–63; period = 1440 / MM.
 */
function parseTleTriplet(
  name: string,
  line1: string,
  line2: string,
  source: SatelliteSource
): Satellite | null {
  const noradIdStr = line1.slice(2, 7).trim();
  const noradId = Number.parseInt(noradIdStr, 10);
  if (!Number.isFinite(noradId)) return null;

  const cospar = line1.slice(9, 17).trim() || undefined;
  const epochStr = line1.slice(18, 32).trim();
  const epoch = Number.parseFloat(epochStr);

  const meanMotion = Number.parseFloat(line2.slice(52, 63));
  const periodMin =
    Number.isFinite(meanMotion) && meanMotion > 0 ? 1440 / meanMotion : undefined;

  return {
    noradId,
    name: name.trim(),
    tle1: line1,
    tle2: line2,
    source,
    cospar,
    epoch: Number.isFinite(epoch) ? epoch : undefined,
    periodMin,
  };
}

export function parseTleCatalog(body: string, source: SatelliteSource): Satellite[] {
  const out: Satellite[] = [];
  const lines = body.split(/\r?\n/).filter((l) => l.length > 0);
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const a = lines[i];
    const b = lines[i + 1];
    const c = lines[i + 2];
    if (!a || !b || !c) continue;
    if (b[0] !== '1' || c[0] !== '2') continue;
    const sat = parseTleTriplet(a, b, c, source);
    if (sat) out.push(sat);
  }
  return out;
}

/**
 * Fetch + parse a single CelesTrak group. Results are cached by source
 * in `localStorage` for 2h.
 */
export async function loadSatellites(
  source: SatelliteSource
): Promise<Satellite[]> {
  const body = await fetchTleBundle(source);
  return parseTleCatalog(body, source);
}

/**
 * Fetch the default Meridian EO bundle — `resource` (Sentinels, Landsat,
 * SPOT, Pléiades, GeoEye, WorldView, etc.) plus `planet` (Dove / SkySat
 * flock). Dedupes by NORAD id when catalogs overlap.
 */
export async function loadDefaultEoBundle(): Promise<Satellite[]> {
  const sources: SatelliteSource[] = ['resource', 'planet'];
  const bundles = await Promise.all(sources.map(loadSatellites));
  const byId = new Map<number, Satellite>();
  for (const list of bundles) {
    for (const sat of list) {
      if (!byId.has(sat.noradId)) byId.set(sat.noradId, sat);
    }
  }
  return Array.from(byId.values());
}

/** Clear all cached TLE bundles. Useful for dev + QA. */
export function clearCelestrakCache(): void {
  if (typeof localStorage === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}
