/**
 * Satellite record — a single active object distilled from a CelesTrak TLE
 * catalog entry. Identity is the NORAD catalog number. Human-readable name
 * comes from TLE line 0; operator / mission / category are enriched from
 * the curated EO bundle in `public/data/satellites.json`.
 */
export type Satellite = {
  /** NORAD catalog number (stable primary key). */
  noradId: number;
  /** Human-readable name from TLE line 0 (e.g. "SENTINEL-2A"). */
  name: string;
  /** Raw TLE lines 1 & 2 — needed for SGP4 propagation. */
  tle1: string;
  tle2: string;
  /** Source CelesTrak catalog (e.g. "sentinel", "planet", "active"). */
  source: SatelliteSource;
  /** International COSPAR designator (from TLE line 1 cols 10–17). */
  cospar?: string;
  /** Epoch year+day (from TLE line 1). */
  epoch?: number;
  /** Orbital period in minutes, derived from mean motion (TLE line 2). */
  periodMin?: number;

  // --- Enriched from curated bundle ---
  operator?: string;
  mission?: string;
  category?: SatelliteCategory;
};

export type SatelliteSource = 'sentinel' | 'resource' | 'planet' | 'active';

/**
 * Coarse categories used for filtering + color coding. Meridian's default
 * satellite layer shows commercial Earth-observation platforms only.
 */
export type SatelliteCategory =
  | 'eo-optical' // Sentinel-2, Landsat, Planet, Maxar
  | 'eo-radar' // Sentinel-1, Capella, ICEYE
  | 'eo-other' // climate / atmospheric EO
  | 'comms'
  | 'nav'
  | 'science'
  | 'other';

/**
 * Palette per §5.2 — ice-blue is the satellite accent. We tint SAR radar
 * birds slightly warmer to distinguish from optical EO.
 */
export function satelliteColor(category: SatelliteCategory): string {
  switch (category) {
    case 'eo-optical':
      return '#7BD3FF';
    case 'eo-radar':
      return '#A78BFA';
    case 'eo-other':
      return '#94A3B8';
    case 'comms':
      return '#00E5A8';
    case 'nav':
      return '#FFB020';
    case 'science':
      return '#C084FC';
    default:
      return '#8892A0';
  }
}
