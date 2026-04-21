import { create } from 'zustand';

export type ViewMode = 'daylight' | 'nightops' | 'density' | 'blueprint' | 'retro';

type ViewModeStore = {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
};

export const useViewModeStore = create<ViewModeStore>((set) => ({
  mode: 'daylight',
  setMode: (mode) => set({ mode }),
}));
