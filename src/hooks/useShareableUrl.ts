import { useEffect, useRef } from 'react';
import type { Viewer } from 'cesium';
import {
  HASH_PREFIX,
  applySnapshot,
  decodeSnapshot,
  encodeSnapshot,
  snapshotState,
} from '@/lib/shareableUrl';
import { useLayerStore } from '@/store/layers';
import { useClockStore } from '@/store/clock';
import { useViewModeStore } from '@/store/viewMode';
import { useSelectionStore } from '@/store/selection';

/**
 * Two halves:
 *
 *  1. On mount (once the viewer is live) — read `window.location.hash`,
 *     decode, and apply to stores + camera. This is how the shareable
 *     URL actually survives a page load.
 *
 *  2. Subscribe to every piece of state that goes into the snapshot and
 *     re-encode to the hash — debounced because camera.changed fires on
 *     every render frame during a fly.
 *
 *  We use `history.replaceState` rather than assigning `location.hash`
 *  directly so we don't stack hundreds of back-button entries during
 *  a long pan.
 */
export function useShareableUrl(viewer: Viewer | null): void {
  const appliedRef = useRef(false);

  // --- read on mount ---
  useEffect(() => {
    if (!viewer) return;
    if (appliedRef.current) return;
    appliedRef.current = true;

    const raw = window.location.hash.replace(/^#/, '');
    if (!raw.startsWith(HASH_PREFIX)) return;
    const decoded = decodeSnapshot(raw);
    if (decoded) applySnapshot(viewer, decoded);
  }, [viewer]);

  // --- write on changes ---
  useEffect(() => {
    if (!viewer) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const writeHash = () => {
      const snap = snapshotState(viewer);
      const encoded = encodeSnapshot(snap); // already prefixed `v1=…`
      const hash = `#${encoded}`;
      if (window.location.hash !== hash) {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}${hash}`
        );
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(writeHash, 300);
    };

    // Camera listener — Cesium's `camera.changed` fires on motion; we
    // bump a lower minimum movement so idle frames don't thrash.
    viewer.camera.percentageChanged = 0.02;
    const removeCam = viewer.camera.changed.addEventListener(schedule);

    // Store subscriptions — every relevant store.
    const unsubs = [
      useLayerStore.subscribe(schedule),
      useClockStore.subscribe(schedule),
      useViewModeStore.subscribe(schedule),
      useSelectionStore.subscribe(schedule),
    ];

    // Write once on mount (after the read-phase has had a tick to land).
    const initial = setTimeout(writeHash, 400);

    return () => {
      removeCam();
      unsubs.forEach((u) => u());
      if (timer) clearTimeout(timer);
      clearTimeout(initial);
    };
  }, [viewer]);
}
