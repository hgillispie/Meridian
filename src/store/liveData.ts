import { create } from 'zustand';
import type { Vessel } from '@/types/vessel';
import type { Aircraft } from '@/types/aircraft';

type LiveDataStore = {
  vessels: Record<number, Vessel>;
  aircraft: Record<string, Aircraft>;
  cargoIcaos: Set<string>;
  upsertVessels: (vs: Iterable<Vessel>) => void;
  syncAircraft: (list: Aircraft[]) => void;
  setCargoIcaos: (set: Set<string>) => void;
};

/**
 * Shared live-data bus between the globe layer components (which ingest data)
 * and the right-rail cards (which display selected entities).
 *
 * Keeping this global avoids re-running expensive AIS/ADS-B subscriptions when
 * consumer components remount, and lets the spotlight / chokepoint layers
 * consume the same cache.
 */
export const useLiveDataStore = create<LiveDataStore>((set) => ({
  vessels: {},
  aircraft: {},
  cargoIcaos: new Set(),
  upsertVessels: (vs) =>
    set((s) => {
      const next = { ...s.vessels };
      for (const v of vs) {
        next[v.mmsi] = { ...next[v.mmsi], ...v };
      }
      return { vessels: next };
    }),
  syncAircraft: (list) =>
    set(() => {
      const next: Record<string, Aircraft> = {};
      for (const a of list) next[a.icao24] = a;
      return { aircraft: next };
    }),
  setCargoIcaos: (cargoIcaos) => set({ cargoIcaos }),
}));
