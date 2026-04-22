import {
  propagate,
  gstime,
  eciToEcf,
  ecfToLookAngles,
  degreesToRadians,
  type SatRec,
} from 'satellite.js';
import type { PreparedSat } from './propagate';

export type OverpassTarget = {
  /** Degrees, −90..90. */
  lat: number;
  /** Degrees, −180..180. */
  lon: number;
  /** Meters above WGS84 ellipsoid. 0 for sea level. */
  alt?: number;
};

export type Overpass = {
  /** Moment of peak elevation (epoch ms). */
  peakAt: number;
  /** Peak elevation angle in degrees above the horizon. */
  peakElevationDeg: number;
  /** Azimuth at peak, degrees clockwise from north. */
  azimuthDeg: number;
  /** Duration above the visibility mask, in seconds. */
  durationSec: number;
};

const DEFAULT_MIN_ELEVATION_DEG = 10;

/**
 * Solve for the next time `sat` rises above `minElevationDeg` at `target`.
 *
 * Step 1: walk forward in coarse 60s ticks up to `horizonSec` looking for an
 *   elevation crossing above the mask.
 * Step 2: refine peak with a ternary-ish search in 5s steps around the first
 *   above-mask window.
 *
 * Returns `null` if no overpass is found inside the horizon — some
 * inclinations never pass over extreme latitudes.
 */
export function nextOverpass(
  prepared: PreparedSat,
  target: OverpassTarget,
  fromTime: Date = new Date(),
  horizonSec = 24 * 3600,
  minElevationDeg = DEFAULT_MIN_ELEVATION_DEG
): Overpass | null {
  const observer = {
    longitude: degreesToRadians(target.lon),
    latitude: degreesToRadians(target.lat),
    height: (target.alt ?? 0) / 1000, // meters → km
  };

  const coarseStepSec = 60;
  const refineStepSec = 5;
  const startMs = fromTime.getTime();
  const endMs = startMs + horizonSec * 1000;

  let inPass = false;
  let passStartMs = 0;
  let bestPeakEl = -Infinity;
  let bestPeakMs = 0;

  for (let t = startMs; t <= endMs; t += coarseStepSec * 1000) {
    const el = elevationDeg(prepared.satrec, observer, new Date(t));
    if (el == null) continue;

    if (!inPass && el >= minElevationDeg) {
      inPass = true;
      passStartMs = t;
      bestPeakEl = el;
      bestPeakMs = t;
    } else if (inPass) {
      if (el > bestPeakEl) {
        bestPeakEl = el;
        bestPeakMs = t;
      }
      if (el < minElevationDeg) {
        // Refine within [peak - step, peak + step]
        const refined = refinePeak(
          prepared.satrec,
          observer,
          bestPeakMs - coarseStepSec * 1000,
          bestPeakMs + coarseStepSec * 1000,
          refineStepSec
        );
        const durationSec = (t - passStartMs) / 1000;
        if (refined) {
          return {
            peakAt: refined.peakMs,
            peakElevationDeg: refined.elDeg,
            azimuthDeg: refined.azDeg,
            durationSec,
          };
        }
        // Refinement failed — return coarse
        const coarseAz = azimuthDeg(prepared.satrec, observer, new Date(bestPeakMs));
        return {
          peakAt: bestPeakMs,
          peakElevationDeg: bestPeakEl,
          azimuthDeg: coarseAz ?? 0,
          durationSec,
        };
      }
    }
  }

  return null;
}

type Observer = { longitude: number; latitude: number; height: number };

function elevationDeg(
  satrec: SatRec,
  observer: Observer,
  date: Date
): number | null {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const gmst = gstime(date);
  const ecf = eciToEcf(pv.position, gmst);
  const look = ecfToLookAngles(observer, ecf);
  return (look.elevation * 180) / Math.PI;
}

function azimuthDeg(
  satrec: SatRec,
  observer: Observer,
  date: Date
): number | null {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const gmst = gstime(date);
  const ecf = eciToEcf(pv.position, gmst);
  const look = ecfToLookAngles(observer, ecf);
  let az = (look.azimuth * 180) / Math.PI;
  if (az < 0) az += 360;
  return az;
}

function refinePeak(
  satrec: SatRec,
  observer: Observer,
  fromMs: number,
  toMs: number,
  stepSec: number
): { peakMs: number; elDeg: number; azDeg: number } | null {
  let bestEl = -Infinity;
  let bestMs = 0;
  for (let t = fromMs; t <= toMs; t += stepSec * 1000) {
    const el = elevationDeg(satrec, observer, new Date(t));
    if (el != null && el > bestEl) {
      bestEl = el;
      bestMs = t;
    }
  }
  if (!Number.isFinite(bestEl)) return null;
  const az = azimuthDeg(satrec, observer, new Date(bestMs));
  return { peakMs: bestMs, elDeg: bestEl, azDeg: az ?? 0 };
}
