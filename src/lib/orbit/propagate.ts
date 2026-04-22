import {
  Cartesian3,
  JulianDate,
  SampledPositionProperty,
  ReferenceFrame,
} from 'cesium';
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToEcf,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type SatRec,
} from 'satellite.js';
import type { Satellite } from '@/types/satellite';

const EARTH_RADIUS_KM = 6378.137;

/** Opaque handle returned by `prepareSatrec`. */
export type PreparedSat = {
  satrec: SatRec;
  /** Orbital period in minutes, for choosing a trace window. */
  periodMin: number;
};

/**
 * Parse a TLE triplet into an SGP4 record. Throws if the TLE is invalid.
 */
export function prepareSatrec(sat: Satellite): PreparedSat {
  const satrec = twoline2satrec(sat.tle1, sat.tle2);
  const meanMotion = Number.parseFloat(sat.tle2.slice(52, 63));
  const periodMin =
    Number.isFinite(meanMotion) && meanMotion > 0 ? 1440 / meanMotion : 90;
  return { satrec, periodMin };
}

/**
 * Sample a satellite's position across a ±window around `center`. Returns a
 * Cesium `SampledPositionProperty` in the fixed (ECEF / WGS84) frame so the
 * point stays locked to the rotating Earth — no weird drift relative to
 * ground billboards.
 *
 * Step defaults to 30s; that's ~250 km along a LEO ground track, plenty
 * smooth for the `PathGraphics` trace to look continuous.
 */
export function sampleOrbit(
  prepared: PreparedSat,
  center: Date,
  windowSec: number,
  stepSec = 30
): SampledPositionProperty {
  const prop = new SampledPositionProperty(ReferenceFrame.FIXED);
  const start = center.getTime() - windowSec * 1000;
  const end = center.getTime() + windowSec * 1000;
  for (let t = start; t <= end; t += stepSec * 1000) {
    const d = new Date(t);
    const pv = propagate(prepared.satrec, d);
    if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
    const gmst = gstime(d);
    const ecf = eciToEcf(pv.position, gmst);
    // satellite.js returns positions in km in ECF; Cesium expects meters.
    const pos = new Cartesian3(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000);
    prop.addSample(JulianDate.fromDate(d), pos);
  }
  return prop;
}

/**
 * Sample and return as an array of `Cartesian3` (meters, ECEF). Useful
 * when we want a `PolylineGraphics` with static positions rather than a
 * time-animated `SampledPositionProperty`.
 */
export function sampleOrbitPath(
  prepared: PreparedSat,
  center: Date,
  windowSec: number,
  stepSec = 30
): Cartesian3[] {
  const out: Cartesian3[] = [];
  const start = center.getTime() - windowSec * 1000;
  const end = center.getTime() + windowSec * 1000;
  for (let t = start; t <= end; t += stepSec * 1000) {
    const d = new Date(t);
    const pv = propagate(prepared.satrec, d);
    if (!pv || !pv.position || typeof pv.position === 'boolean') continue;
    const gmst = gstime(d);
    const ecf = eciToEcf(pv.position, gmst);
    out.push(new Cartesian3(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000));
  }
  return out;
}

/**
 * Geodetic lat/lon/alt at a single instant. Altitude is meters above the
 * WGS84 ellipsoid.
 */
export function propagateToGeodetic(
  prepared: PreparedSat,
  date: Date
): { lat: number; lon: number; alt: number } | null {
  const pv = propagate(prepared.satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const gmst = gstime(date);
  const geo = eciToGeodetic(pv.position, gmst);
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    alt: geo.height * 1000, // km → m
  };
}

/** Rough orbit altitude in meters from the satrec's semi-major axis. */
export function approxAltitudeMeters(prepared: PreparedSat): number {
  // satrec.no is mean motion in rad/min; a = (mu / n^2)^(1/3)
  const mu = 398600.4418; // km^3/s^2
  const n = prepared.satrec.no / 60; // rad/s
  if (!Number.isFinite(n) || n <= 0) return 0;
  const a = Math.cbrt(mu / (n * n));
  return Math.max(0, (a - EARTH_RADIUS_KM) * 1000);
}
