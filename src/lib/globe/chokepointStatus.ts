import type {
  ChokepointBaseline,
  ChokepointMetrics,
} from '@/store/chokepoints';

/**
 * Unified status + color for a chokepoint. Used by both the globe polygon
 * fill/outline and the BottomDock legend so the UI speaks with one voice.
 *
 *   nominal   → green   — traffic within ±25 % of the 30-day baseline
 *   elevated  → yellow  — 25-50 % below baseline, or 2-3× typical queue
 *   congested → orange  — heavy backlog (>3× typical queue)
 *   critical  → red     — >50 % below baseline, or any overlapping high-
 *                         severity disruption zone (piracy, closure)
 *   stale     → slate   — not enough data yet (first few minutes of a
 *                         session before transits have accumulated)
 */
export type ChokepointStatus =
  | 'nominal'
  | 'elevated'
  | 'congested'
  | 'critical'
  | 'stale';

export type ChokepointStatusInfo = {
  status: ChokepointStatus;
  color: string;
  label: string;
  description: string;
};

const STATUS_META: Record<
  ChokepointStatus,
  { color: string; label: string; description: string }
> = {
  nominal: {
    color: '#00E5A8',
    label: 'Nominal',
    description: 'Traffic flowing within ±25 % of 30-day baseline.',
  },
  elevated: {
    color: '#FACC15',
    label: 'Elevated',
    description: 'Queue building or transits 25–50 % below baseline.',
  },
  congested: {
    color: '#F59E0B',
    label: 'Congested',
    description: 'Heavy backlog — more than 3× the typical queue length.',
  },
  critical: {
    color: '#EF4444',
    label: 'Critical',
    description:
      'Transits >50 % below baseline, or an active high-severity disruption overlaps the corridor.',
  },
  stale: {
    color: '#64748B',
    label: 'Awaiting data',
    description: 'Waiting for enough transits to form a reliable estimate.',
  },
};

/**
 * Derive status from current metrics + baseline + an optional "is this
 * chokepoint overlapping an active high-severity disruption?" hint.
 *
 * The caller computes the disruption overlap because this helper lives in
 * lib/globe and shouldn't reach into the disruption store directly.
 */
export function deriveChokepointStatus(
  metric: ChokepointMetrics | undefined,
  baseline: ChokepointBaseline | undefined,
  hasHighSeverityDisruption: boolean
): ChokepointStatusInfo {
  if (hasHighSeverityDisruption) {
    return { status: 'critical', ...STATUS_META.critical };
  }

  if (!metric || !baseline || metric.sampledAt === 0) {
    return { status: 'stale', ...STATUS_META.stale };
  }

  // Transit-rate analysis: what the metric hook observed vs 30-day baseline.
  // transits is a cumulative count since app start; convert to per-hour.
  const hoursObserved = Math.max(
    0.5,
    (Date.now() - metric.sampledAt + 30 * 60_000) / 3_600_000
  );
  const perHour = metric.transits / hoursObserved;
  const projectedPerDay = perHour * 24;
  const deltaVsBaseline =
    baseline.transitsPerDay > 0
      ? (projectedPerDay - baseline.transitsPerDay) / baseline.transitsPerDay
      : 0;

  // Queue analysis: how many vessels inside vs "typical queue" baseline.
  const typicalQueue = Math.max(1, baseline.typicalQueue);
  const queueRatio = metric.vesselsInside / typicalQueue;

  // Critical: traffic has collapsed to <50 % of baseline.
  if (deltaVsBaseline < -0.5) {
    return { status: 'critical', ...STATUS_META.critical };
  }
  // Congested: more than 3× typical queue sitting inside.
  if (queueRatio > 3) {
    return { status: 'congested', ...STATUS_META.congested };
  }
  // Elevated: moderate transit dip or 1.5-3× typical queue.
  if (deltaVsBaseline < -0.25 || queueRatio > 1.5) {
    return { status: 'elevated', ...STATUS_META.elevated };
  }
  return { status: 'nominal', ...STATUS_META.nominal };
}

export const CHOKEPOINT_STATUS_LEGEND: ChokepointStatusInfo[] = (
  ['nominal', 'elevated', 'congested', 'critical', 'stale'] as const
).map((s) => ({ status: s, ...STATUS_META[s] }));
