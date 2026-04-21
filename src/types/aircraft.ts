/**
 * Aircraft record — distilled from OpenSky `/states/all` response.
 * OpenSky returns a 17-column positional array per aircraft; we convert
 * to a named record.
 *
 * See: https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
 */
export type Aircraft = {
  icao24: string;
  callsign?: string;
  originCountry: string;
  /** Epoch seconds */
  lastContact: number;
  lon?: number;
  lat?: number;
  /** Barometric altitude in meters. */
  altBaro?: number;
  /** Geometric altitude in meters. */
  altGeo?: number;
  /** Velocity over ground in m/s. */
  velocity?: number;
  /** True track in degrees clockwise from north. */
  heading?: number;
  /** Vertical rate in m/s (+ climb, - descent). */
  verticalRate?: number;
  onGround: boolean;
  /** Navigational Integrity Category, 0..7 (higher is better). Used for GPS integrity in Phase 8. */
  nic?: number;
};

export type OpenSkyRawState = [
  icao24: string,
  callsign: string | null,
  origin_country: string,
  time_position: number | null,
  last_contact: number,
  longitude: number | null,
  latitude: number | null,
  baro_altitude: number | null,
  on_ground: boolean,
  velocity: number | null,
  true_track: number | null,
  vertical_rate: number | null,
  sensors: number[] | null,
  geo_altitude: number | null,
  squawk: string | null,
  spi: boolean,
  position_source: number,
];

export function fromOpenSky(raw: OpenSkyRawState): Aircraft {
  return {
    icao24: raw[0].toLowerCase(),
    callsign: raw[1]?.trim() || undefined,
    originCountry: raw[2],
    lastContact: raw[4],
    lon: raw[5] ?? undefined,
    lat: raw[6] ?? undefined,
    altBaro: raw[7] ?? undefined,
    onGround: raw[8],
    velocity: raw[9] ?? undefined,
    heading: raw[10] ?? undefined,
    verticalRate: raw[11] ?? undefined,
    altGeo: raw[13] ?? undefined,
  };
}
