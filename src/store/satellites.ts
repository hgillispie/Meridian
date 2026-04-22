import { create } from 'zustand';
import type { Satellite } from '@/types/satellite';

type SatelliteStore = {
  byId: Record<number, Satellite>;
  setSatellites: (list: Satellite[]) => void;
};

/**
 * Shared cache of currently-visible satellites, keyed by NORAD id. The
 * globe layer writes on every TLE load; the right-rail card reads for
 * whichever satellite is selected. Kept separate from `liveDataStore`
 * because TLEs refresh on a very different cadence (hours, not
 * sub-second) and the shape is static until the next fetch.
 */
export const useSatelliteStore = create<SatelliteStore>((set) => ({
  byId: {},
  setSatellites: (list) =>
    set(() => {
      const byId: Record<number, Satellite> = {};
      for (const s of list) byId[s.noradId] = s;
      return { byId };
    }),
}));
