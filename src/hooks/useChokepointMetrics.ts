import { useEffect, useRef } from 'react';
import { useChokepointStore, type ChokepointId, type ChokepointMetrics } from '@/store/chokepoints';
import { useLiveDataStore } from '@/store/liveData';
import { pointInBbox, pointInPolygon } from '@/lib/geo/pointInPolygon';

/**
 * Recompute chokepoint metrics from the live vessel cache at a fixed
 * cadence (every 10 s — more than fast enough for a sparkline and cheap
 * enough that 8 polygons × ~500 vessels is <2 ms on an M-series).
 *
 * Tracked per chokepoint:
 *   - `vesselsInside`: live count.
 *   - `queueLength`: vessels inside with speed <2 kn (backed-up traffic).
 *   - `transits`: cumulative entry events since app start.
 *   - `history`: ring buffer of `vesselsInside` samples (latest-last).
 *   - `avgDwellHours`: running mean of per-MMSI dwell times (entry→exit).
 *
 * "Transits" can't be a true 24 h rolling count without bundled replay,
 * so we expose `transits` (since session start) + baseline; the card
 * projects a per-hour rate and the status color comes from that.
 */

const SAMPLE_MS = 10_000;
const HISTORY_LEN = 48;
const QUEUE_SPEED_KN = 2;

/** Persistent per-MMSI entry state so we can measure dwell. */
type EntryRecord = { enteredAt: number };

type PerChokepointState = {
  entries: Map<number, EntryRecord>;
  transits: number;
  history: number[];
  dwellSum: number;
  dwellCount: number;
};

function initState(): PerChokepointState {
  return {
    entries: new Map(),
    transits: 0,
    history: [],
    dwellSum: 0,
    dwellCount: 0,
  };
}

export function useChokepointMetrics(enabled: boolean) {
  const features = useChokepointStore((s) => s.features);
  const setMetrics = useChokepointStore((s) => s.setMetrics);

  // State persists across ticks — we keep it in a ref so polygons retain
  // their entry sets and cumulative transits between sample intervals.
  const stateRef = useRef<Map<ChokepointId, PerChokepointState>>(new Map());

  useEffect(() => {
    if (!enabled || features.length === 0) return;

    // Ensure every feature has a state bucket.
    for (const f of features) {
      if (!stateRef.current.has(f.id)) {
        stateRef.current.set(f.id, initState());
      }
    }

    const sample = () => {
      const vessels = useLiveDataStore.getState().vessels;
      const now = Date.now();
      for (const f of features) {
        const st = stateRef.current.get(f.id)!;
        let inside = 0;
        let queue = 0;
        const stillInside = new Set<number>();

        for (const v of Object.values(vessels)) {
          if (v.lat == null || v.lon == null) continue;
          const p: [number, number] = [v.lon, v.lat];
          // Cheap bbox fast-reject first — ~90% of vessels don't touch
          // any chokepoint, so the ray-cast is avoided for most.
          if (!pointInBbox(p, f.bbox)) continue;
          if (!pointInPolygon(p, f.polygon)) continue;
          inside++;
          if ((v.sog ?? 0) < QUEUE_SPEED_KN) queue++;
          stillInside.add(v.mmsi);
          if (!st.entries.has(v.mmsi)) {
            st.entries.set(v.mmsi, { enteredAt: now });
            st.transits++;
          }
        }

        // Mark exits — anything in st.entries that's no longer inside
        // contributes to dwell and is removed from the entry set.
        for (const [mmsi, rec] of st.entries) {
          if (!stillInside.has(mmsi)) {
            const dwellHours = (now - rec.enteredAt) / 3_600_000;
            // Guard: a vessel that entered and exited within one sample
            // tick has implausibly short dwell. Cap below 5 min out.
            if (dwellHours >= 5 / 60) {
              st.dwellSum += dwellHours;
              st.dwellCount++;
            }
            st.entries.delete(mmsi);
          }
        }

        st.history.push(inside);
        if (st.history.length > HISTORY_LEN) st.history.shift();

        const metrics: ChokepointMetrics = {
          vesselsInside: inside,
          queueLength: queue,
          transits: st.transits,
          history: [...st.history],
          avgDwellHours: st.dwellCount === 0 ? 0 : st.dwellSum / st.dwellCount,
          sampledAt: now,
        };
        setMetrics(f.id, metrics);
      }
    };

    // Sample immediately on mount so the RightRail isn't dashed for 10 s,
    // then tick on the interval.
    sample();
    const id = window.setInterval(sample, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [features, enabled, setMetrics]);
}
