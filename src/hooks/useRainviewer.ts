import { useEffect, useState } from 'react';
import {
  fetchRainviewerManifest,
  type RainviewerManifest,
} from '@/lib/api/rainviewer';

type UseRainviewerResult = {
  manifest: RainviewerManifest | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

/**
 * Polls the RainViewer manifest every 5 minutes while `enabled`.
 * The manifest itself is tiny (~1 KB); tile requests are what actually
 * consumes bandwidth and those are pulled on-demand by Cesium's
 * imagery loader as the camera moves.
 */
export function useRainviewer(enabled: boolean): UseRainviewerResult {
  const [manifest, setManifest] = useState<RainviewerManifest | null>(null);
  const [status, setStatus] =
    useState<UseRainviewerResult['status']>('idle');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      setStatus((s) => (s === 'ready' ? s : 'loading'));
      try {
        const m = await fetchRainviewerManifest();
        if (!cancelled) {
          setManifest(m);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[rainviewer] manifest fetch failed', err);
          setStatus('error');
        }
      }
    };

    void load();
    // RainViewer publishes a new frame every 10 min; poll at half that.
    timer = setInterval(load, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [enabled]);

  return { manifest, status };
}
