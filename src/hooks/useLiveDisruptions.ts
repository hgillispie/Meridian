import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDisruptionStore } from '@/store/disruptions';
import { useEventsStore } from '@/store/events';
import { fetchNoaaMarineAlerts } from '@/lib/api/noaa';
import { fetchOpenMeteoStorms } from '@/lib/api/openMeteo';

/**
 * Pull live disruptions from keyless sources (NOAA NWS + Open-Meteo)
 * at a modest cadence and merge into the store. Each hook is its own
 * query so one source failing doesn't poison the other.
 *
 * Refresh cadence: NOAA every 5 min (NWS updates on that order), Open-
 * Meteo every 30 min (forecast deltas are much slower than active
 * alerts). React Query's `staleTime` keeps re-renders cheap when the
 * panel mounts/unmounts.
 */
export function useLiveDisruptions() {
  const upsertDisruptions = useDisruptionStore((s) => s.upsertMany);
  const upsertEvents = useEventsStore((s) => s.upsertMany);

  const noaa = useQuery({
    queryKey: ['disruptions', 'noaa'],
    queryFn: fetchNoaaMarineAlerts,
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
  });

  const openMeteo = useQuery({
    queryKey: ['disruptions', 'open-meteo'],
    queryFn: fetchOpenMeteoStorms,
    refetchInterval: 30 * 60_000,
    staleTime: 30 * 60_000,
  });

  // Upsert into both stores on each refetch. Events store merges by id so
  // re-pushing the same disruption on every poll no longer reshuffles the
  // list — only genuinely new events cause a visible reordering.
  useEffect(() => {
    if (!noaa.data) return;
    upsertDisruptions(noaa.data);
    upsertEvents(
      noaa.data.map((d) => ({
        id: `disruption:${d.id}`,
        kind: 'weather' as const,
        title: d.title,
        detail: d.detail,
        startedAt: d.startedAt,
        endedAt: d.endedAt,
      }))
    );
  }, [noaa.data, upsertDisruptions, upsertEvents]);

  useEffect(() => {
    if (!openMeteo.data) return;
    upsertDisruptions(openMeteo.data);
    upsertEvents(
      openMeteo.data.map((d) => ({
        id: `disruption:${d.id}`,
        kind: 'weather' as const,
        title: d.title,
        detail: d.detail,
        startedAt: d.startedAt,
        endedAt: d.endedAt,
      }))
    );
  }, [openMeteo.data, upsertDisruptions, upsertEvents]);
}
