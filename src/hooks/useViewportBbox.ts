import { useEffect, useState } from 'react';
import type { Viewer } from 'cesium';
import { viewportBbox, inflateBbox, worldBbox, type Bbox } from '@/lib/geo/bbox';

/**
 * Debounced viewport bbox. Updates 400ms after the camera settles so we
 * don't spam AISStream subscriptions or OpenSky requests during a pan.
 */
export function useViewportBbox(viewer: Viewer | null, debounceMs = 400): Bbox {
  const [bbox, setBbox] = useState<Bbox>(worldBbox);

  useEffect(() => {
    if (!viewer) return;

    let timeoutId: number | null = null;

    const update = () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setBbox(inflateBbox(viewportBbox(viewer), 0.1));
      }, debounceMs);
    };

    // Initial value after a tick so the viewer has time to compute the view
    const initId = window.setTimeout(update, 200);

    const removeListener = viewer.camera.changed.addEventListener(update);

    return () => {
      window.clearTimeout(initId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
      removeListener();
    };
  }, [viewer, debounceMs]);

  return bbox;
}
