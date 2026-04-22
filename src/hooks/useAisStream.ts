import { useEffect, useRef, useState } from 'react';
import type { Vessel } from '@/types/vessel';
import { createAisStreamClient, type AisStreamClient } from '@/lib/api/aisstream';
import { bboxContains, type Bbox } from '@/lib/geo/bbox';

type AisStatus = 'connecting' | 'open' | 'closed' | 'error' | 'disabled';

type UseAisStreamResult = {
  vessels: Map<number, Vessel>;
  status: AisStatus;
  /** Monotonic counter that bumps on every batched vessel update. Consumers
   *  should use this as a side-effect dependency instead of `vessels`, which
   *  is a stable ref and would never trigger re-runs. */
  tick: number;
};

/**
 * Persistent AISStream subscription keyed to the current bbox. Vessels are
 * stored in a Map indexed by MMSI; state updates batch at most once per
 * animation frame via a ref swap to avoid re-rendering on every message.
 */
export function useAisStream(bbox: Bbox, enabled: boolean): UseAisStreamResult {
  const apiKey = import.meta.env.VITE_PUBLIC_AISSTREAM_KEY as string | undefined;
  const clientRef = useRef<AisStreamClient | null>(null);
  const vesselsRef = useRef<Map<number, Vessel>>(new Map());
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState<AisStatus>(apiKey ? 'connecting' : 'disabled');

  // Create the client once
  useEffect(() => {
    if (!enabled || !apiKey) return;
    const client = createAisStreamClient(apiKey);
    clientRef.current = client;

    const offStatus = client.onStatus((s) => setStatus(s));

    let rafId: number | null = null;
    const offVessel = client.onVessel((v) => {
      // Merge with existing record; position reports may lack static data
      const prev = vesselsRef.current.get(v.mmsi);
      vesselsRef.current.set(v.mmsi, { ...prev, ...v });
      if (rafId == null) {
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          setTick((n) => (n + 1) % 1_000_000);
        });
      }
    });

    return () => {
      offStatus();
      offVessel();
      client.close();
      clientRef.current = null;
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [apiKey, enabled]);

  // Push the bbox whenever it changes. We depend on the scalar coords rather
  // than the bbox object itself so a new-reference-same-coords does not
  // trigger a re-subscribe. On every bbox change we also purge any vessel
  // whose last position has drifted outside the new viewport — otherwise
  // stale ships from prior pans accumulate forever and appear "left behind"
  // (e.g. Singapore vessels still sitting in the Pacific after panning to
  // the Atlantic).
  useEffect(() => {
    if (!enabled) return;
    clientRef.current?.subscribe(bbox);
    let removed = 0;
    for (const [mmsi, v] of vesselsRef.current) {
      if (v.lat == null || v.lon == null) continue;
      if (!bboxContains(bbox, v.lon, v.lat)) {
        vesselsRef.current.delete(mmsi);
        removed++;
      }
    }
    if (removed > 0) setTick((n) => (n + 1) % 1_000_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox.west, bbox.south, bbox.east, bbox.north, enabled]);

  return { vessels: vesselsRef.current, status, tick };
}
