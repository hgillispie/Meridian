import { create } from 'zustand';

type Speed = 1 | 10 | 100;

type ClockStore = {
  /** Playback speed multiplier applied to Cesium `viewer.clock.multiplier`. */
  speed: Speed;
  /** Offset in hours from "now". 0 = live. Negative = past. */
  position: number;
  playing: boolean;
  setSpeed: (s: Speed) => void;
  setPosition: (p: number) => void;
  play: () => void;
  pause: () => void;
};

export const useClockStore = create<ClockStore>((set) => ({
  speed: 1,
  position: 0,
  playing: true,
  setSpeed: (speed) => set({ speed }),
  setPosition: (position) => set({ position }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
}));
