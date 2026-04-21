import { useEffect, useRef, useState } from 'react';
import type { Vessel } from '@/types/vessel';
import { createAisStreamClient, type AisStreamClient } from '@/lib/api/aisstream';
import type { Bbox } from '@/lib/geo/bbox';

type AisStatus = 'connecting' | 'open' | 'closed' | 'error' | 'disabled';

type UseAisStreamResult = {
  vessels: Map<number, Vessel>;
  status: AisStatus;
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
  const [, forceRender] = useState(0);
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
          forceRender((n) => (n + 1) % 1_000_000);
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
  // trigger a re-subscribe.
  useEffect(() => {
    if (!enabled) return;
    clientRef.current?.subscribe(bbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox.west, bbox.south, bbox.east, bbox.north, enabled]);

  return { vessels: vesselsRef.current, status };
}
