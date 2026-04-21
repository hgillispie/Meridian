import { create } from 'zustand';

export type EventKind =
  | 'weather'
  | 'port-status'
  | 'gps'
  | 'piracy'
  | 'regulatory'
  | 'demo';

export type EventRow = {
  id: string;
  kind: EventKind;
  title: string;
  detail?: string;
  startedAt: number; // epoch ms
  endedAt?: number;
};

type EventsStore = {
  events: EventRow[];
  push: (e: EventRow) => void;
  clear: () => void;
};

export const useEventsStore = create<EventsStore>((set) => ({
  events: [],
  push: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 100) })),
  clear: () => set({ events: [] }),
}));
