import { useEffect } from 'react';
import { useWebcamStore, type Webcam } from '@/store/webcams';

/**
 * One-shot loader for the port webcam directory. Safe to mount multiple
 * times; the store remembers `loaded` and bails on the second pass.
 */
export function useWebcamData() {
  const loaded = useWebcamStore((s) => s.loaded);
  const setWebcams = useWebcamStore((s) => s.setWebcams);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    void fetch('/data/port-webcams.json')
      .then((r) => r.json() as Promise<{ webcams: Webcam[] }>)
      .then((d) => {
        if (cancelled) return;
        setWebcams(d.webcams ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setWebcams([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, setWebcams]);
}
