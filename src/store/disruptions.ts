import { create } from 'zustand';

export type DisruptionKind =
  | 'weather'
  | 'piracy'
  | 'port-status'
  | 'regulatory'
  | 'gps'
  | 'demo';

export type DisruptionSeverity = 'low' | 'moderate' | 'high';

export type Disruption = {
  id: string;
  kind: DisruptionKind;
  severity: DisruptionSeverity;
  title: string;
  detail?: string;
  /** epoch ms */
  startedAt: number;
  endedAt?: number;
  polygon: number[][]; // [lon, lat] ring (closed)
  center: [number, number];
  /** Source label — shown in the event feed. */
  source?: string;
};

type DisruptionStore = {
  disruptions: Record<string, Disruption>;
  upsert: (d: Disruption) => void;
  upsertMany: (ds: Disruption[]) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useDisruptionStore = create<DisruptionStore>((set) => ({
  disruptions: {},
  upsert: (d) =>
    set((s) => ({ disruptions: { ...s.disruptions, [d.id]: d } })),
  upsertMany: (ds) =>
    set((s) => {
      const next = { ...s.disruptions };
      for (const d of ds) next[d.id] = d;
      return { disruptions: next };
    }),
  remove: (id) =>
    set((s) => {
      const next = { ...s.disruptions };
      delete next[id];
      return { disruptions: next };
    }),
  clear: () => set({ disruptions: {} }),
}));

/**
 * Severity → [ css color, base alpha ] pairs. Low alpha because polygons
 * sit on top of live-vessel billboards and shouldn't wash them out.
 */
export function disruptionColor(severity: DisruptionSeverity): string {
  switch (severity) {
    case 'high':
      return '#F43F5E'; // red-rose
    case 'moderate':
      return '#F59E0B'; // amber
    case 'low':
      return '#FACC15'; // yellow
  }
}
