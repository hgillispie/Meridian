import { create } from 'zustand';

export type LayerId =
  | 'vessels'
  | 'aircraft'
  | 'satellites'
  | 'webcams'
  | 'gps'
  | 'disruptions'
  | 'lanes'
  | 'chokepoints'
  | 'weather'
  | 'traffic';

export type LayerState = {
  enabled: boolean;
  intensity: number; // 0..1
};

type LayerStore = {
  layers: Record<LayerId, LayerState>;
  toggle: (id: LayerId, enabled: boolean) => void;
  setIntensity: (id: LayerId, intensity: number) => void;
};

const DEFAULT_LAYERS: Record<LayerId, LayerState> = {
  vessels: { enabled: true, intensity: 1 },
  aircraft: { enabled: true, intensity: 1 },
  satellites: { enabled: true, intensity: 1 },
  webcams: { enabled: false, intensity: 1 },
  gps: { enabled: false, intensity: 1 },
  disruptions: { enabled: true, intensity: 1 },
  lanes: { enabled: false, intensity: 0.6 },
  chokepoints: { enabled: true, intensity: 1 },
  weather: { enabled: false, intensity: 0.8 },
  traffic: { enabled: false, intensity: 1 },
};

export const useLayerStore = create<LayerStore>((set) => ({
  layers: DEFAULT_LAYERS,
  toggle: (id, enabled) =>
    set((s) => ({
      layers: { ...s.layers, [id]: { ...s.layers[id], enabled } },
    })),
  setIntensity: (id, intensity) =>
    set((s) => ({
      layers: { ...s.layers, [id]: { ...s.layers[id], intensity } },
    })),
}));
