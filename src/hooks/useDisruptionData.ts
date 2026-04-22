import { useEffect } from 'react';
import {
  useDisruptionStore,
  type Disruption,
  type DisruptionKind,
  type DisruptionSeverity,
} from '@/store/disruptions';
import { useEventsStore, type EventKind } from '@/store/events';

type DemoDisruptionRaw = {
  id: string;
  kind: DisruptionKind;
  severity: DisruptionSeverity;
  title: string;
  detail?: string;
  startedAt: string;
  endedAt?: string;
  polygon: number[][];
  center: [number, number];
};

type DemoDisruptionsFile = { disruptions: DemoDisruptionRaw[] };

/**
 * Load bundled demo disruptions + fan them into the event feed.
 *
 * This is the Phase 5 baseline; live sources (NOAA NWS, Open-Meteo,
 * IMB RSS) layer on top via their own hooks but share the same store,
 * so the map and feed render a union.
 */
export function useDisruptionData() {
  const upsertMany = useDisruptionStore((s) => s.upsertMany);
  const push = useEventsStore((s) => s.push);

  useEffect(() => {
    let cancelled = false;
    void fetch('/data/demo-disruptions.json')
      .then((r) => r.json() as Promise<DemoDisruptionsFile>)
      .then((file) => {
        if (cancelled) return;
        const parsed: Disruption[] = file.disruptions.map((d) => ({
          ...d,
          startedAt: Date.parse(d.startedAt),
          endedAt: d.endedAt ? Date.parse(d.endedAt) : undefined,
          source: 'curated',
        }));
        upsertMany(parsed);
        // Mirror into event feed — keep severity → EventKind mapping loose;
        // the feed just cares about broad categories.
        for (const d of parsed) {
          push({
            id: `disruption:${d.id}`,
            kind: kindToEvent(d.kind),
            title: d.title,
            detail: d.detail,
            startedAt: d.startedAt,
            endedAt: d.endedAt,
          });
        }
      })
      .catch((e: unknown) => {
        console.warn('[disruptions] failed to load demo data:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [upsertMany, push]);
}

function kindToEvent(k: DisruptionKind): EventKind {
  switch (k) {
    case 'piracy':
      return 'piracy';
    case 'weather':
      return 'weather';
    case 'port-status':
      return 'port-status';
    case 'gps':
      return 'gps';
    case 'regulatory':
      return 'regulatory';
    default:
      return 'demo';
  }
}
