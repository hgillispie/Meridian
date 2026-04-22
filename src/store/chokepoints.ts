import { create } from 'zustand';

export type ChokepointId =
  | 'suez'
  | 'panama'
  | 'hormuz'
  | 'malacca'
  | 'bosphorus'
  | 'bab-el-mandeb'
  | 'dover'
  | 'cape-of-good-hope';

export type ChokepointFeature = {
  id: ChokepointId;
  name: string;
  region: string;
  description: string;
  center: [number, number];
  polygon: number[][]; // [lon, lat] ring (closed)
  bbox: [number, number, number, number];
};

export type ChokepointBaseline = {
  transitsPerDay: number;
  avgDwellHours: number;
  typicalQueue: number;
  notes: string;
};

/**
 * Live-computed metrics per chokepoint. Recomputed at a modest cadence
 * from the live vessel cache + a session-scoped transit ring buffer.
 */
export type ChokepointMetrics = {
  vesselsInside: number;
  queueLength: number;
  /** Cumulative transits observed since app start. */
  transits: number;
  /** Rolling window of the last 48 sample ticks (for sparkline). */
  history: number[];
  /** Running average dwell in hours (entry→exit, per MMSI). */
  avgDwellHours: number;
  /** Unix ms timestamp of last recompute. */
  sampledAt: number;
};

type ChokepointStore = {
  features: ChokepointFeature[];
  baselines: Record<ChokepointId, ChokepointBaseline>;
  metrics: Record<ChokepointId, ChokepointMetrics>;
  setFeatures: (f: ChokepointFeature[]) => void;
  setBaselines: (b: Record<ChokepointId, ChokepointBaseline>) => void;
  setMetrics: (id: ChokepointId, m: ChokepointMetrics) => void;
};

const EMPTY_METRICS: ChokepointMetrics = {
  vesselsInside: 0,
  queueLength: 0,
  transits: 0,
  history: [],
  avgDwellHours: 0,
  sampledAt: 0,
};

export const useChokepointStore = create<ChokepointStore>((set) => ({
  features: [],
  baselines: {} as Record<ChokepointId, ChokepointBaseline>,
  metrics: {
    suez: EMPTY_METRICS,
    panama: EMPTY_METRICS,
    hormuz: EMPTY_METRICS,
    malacca: EMPTY_METRICS,
    bosphorus: EMPTY_METRICS,
    'bab-el-mandeb': EMPTY_METRICS,
    dover: EMPTY_METRICS,
    'cape-of-good-hope': EMPTY_METRICS,
  },
  setFeatures: (features) => set({ features }),
  setBaselines: (baselines) => set({ baselines }),
  setMetrics: (id, m) =>
    set((s) => ({ metrics: { ...s.metrics, [id]: m } })),
}));

/**
 * Categorical status derived from transits-vs-baseline delta.
 * `nominal` = within ±25 %, `elevated` = 25–50 %, `critical` = >50 % below.
 * (Above baseline is fine — means traffic is flowing.)
 */
export function chokepointStatus(
  transitsPerHour: number,
  baselinePerDay: number
): 'nominal' | 'elevated' | 'critical' | 'stale' {
  if (baselinePerDay <= 0) return 'stale';
  const projectedPerDay = transitsPerHour * 24;
  const delta = (projectedPerDay - baselinePerDay) / baselinePerDay;
  if (Number.isNaN(delta)) return 'stale';
  if (delta < -0.5) return 'critical';
  if (delta < -0.25) return 'elevated';
  return 'nominal';
}
