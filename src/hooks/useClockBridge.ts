import { useEffect } from 'react';
import { JulianDate, type Viewer } from 'cesium';
import { useClockStore } from '@/store/clock';

/**
 * Bi-directional bridge between our `useClockStore` and the Cesium
 * `viewer.clock`. One-way flows can't give us both "user dragged the
 * slider" and "slider drifts as time plays" without a re-entrancy
 * guard, so we subscribe imperatively (bypassing React re-render) and
 * use an `echoing` flag to avoid the subscriber firing itself on echo.
 *
 * Contract:
 *   - `position` is offset-in-hours from wall-clock now. `0` = live.
 *   - `speed` maps to `clock.multiplier` (1, 10, or 100).
 *   - `playing` maps to `clock.shouldAnimate`.
 *   - On tick we echo `position` back to the store so the slider
 *     advances as playback runs. Echoes snap to `0` within a minute of
 *     now so "live" mode is sticky.
 */
export function useClockBridge(viewer: Viewer | null): void {
  useEffect(() => {
    if (!viewer) return;
    const clock = viewer.clock;

    let echoing = false;

    const secondsFromNow = (jd: JulianDate): number =>
      JulianDate.secondsDifference(jd, JulianDate.now(new JulianDate()));

    const apply = (s: { speed: number; position: number; playing: boolean }) => {
      clock.multiplier = s.speed;
      clock.shouldAnimate = s.playing;
      const target = JulianDate.addSeconds(
        JulianDate.now(new JulianDate()),
        s.position * 3600,
        new JulianDate()
      );
      clock.currentTime = target;
    };

    // Initial sync
    apply(useClockStore.getState());

    // Store → Cesium
    const unsub = useClockStore.subscribe((s) => {
      if (echoing) return;
      apply(s);
    });

    // Cesium → store (on every tick, throttled by delta threshold)
    const removeTick = clock.onTick.addEventListener(() => {
      const offsetSec = secondsFromNow(clock.currentTime);
      const offsetHours = offsetSec / 3600;
      // Snap to "live" once we're within ~1 minute of now.
      const snapped =
        Math.abs(offsetHours) < 0.02
          ? 0
          : Math.max(-168, Math.min(0, offsetHours));
      const current = useClockStore.getState().position;
      if (Math.abs(current - snapped) > 0.02) {
        echoing = true;
        useClockStore.setState({ position: snapped });
        echoing = false;
      }
    });

    return () => {
      unsub();
      removeTick();
    };
  }, [viewer]);
}
