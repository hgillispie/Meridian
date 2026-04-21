/**
 * Vessel record — distilled from AISStream's PositionReport + ShipStaticData
 * messages. We collapse the two upstream message types into a single record
 * that's indexed by MMSI.
 */
export type Vessel = {
  mmsi: number;
  /** Most recent timestamp (epoch ms). */
  t: number;
  lat: number;
  lon: number;
  /** Course-over-ground in degrees (0 = north). */
  cog?: number;
  /** Speed-over-ground in knots. */
  sog?: number;
  /** True heading in degrees (can differ from COG). */
  heading?: number;

  // Static data — may lag behind position reports.
  name?: string;
  callSign?: string;
  imo?: number;
  shipType?: number; // ITU M.1371 classification
  flag?: string; // inferred from MMSI MID
  destination?: string;
  eta?: number; // epoch ms
  length?: number; // meters
  draft?: number; // meters
};

/**
 * ITU M.1371 ship-type categories collapsed into the palette groups we care
 * about for the map. Numbers reference the AIS spec; grouping simplifies
 * color assignment.
 */
export type VesselCategory =
  | 'container'
  | 'tanker'
  | 'bulker'
  | 'passenger'
  | 'fishing'
  | 'tug'
  | 'pleasure'
  | 'other';

export function categorizeShipType(code?: number): VesselCategory {
  if (code == null) return 'other';
  if (code >= 70 && code <= 79) return 'container'; // "Cargo, all ships of this type"
  if (code >= 80 && code <= 89) return 'tanker';
  if (code === 1003 || code === 1013 || code === 1014) return 'container'; // AISStream extended
  if (code >= 60 && code <= 69) return 'passenger';
  if (code === 30) return 'fishing';
  if (code === 31 || code === 32 || code === 52) return 'tug';
  if (code === 36 || code === 37) return 'pleasure';
  if (code >= 40 && code <= 49) return 'passenger'; // high-speed craft
  return 'other';
}

/**
 * Meridian palette per §5.2 + §7.2 — tanker amber, container mint, etc.
 */
export function vesselColor(category: VesselCategory): string {
  switch (category) {
    case 'container':
      return '#00E5A8';
    case 'tanker':
      return '#FFB020';
    case 'bulker':
      return '#7BD3FF';
    case 'passenger':
      return '#C084FC';
    case 'fishing':
      return '#94A3B8';
    case 'tug':
      return '#FB923C';
    case 'pleasure':
      return '#F472B6';
    default:
      return '#E6EDF3';
  }
}
