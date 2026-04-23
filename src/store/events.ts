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
  /** Insert a new event, or merge into an existing one keyed by id without
   *  changing its position in the list. Pollers (NOAA, Open-Meteo) call
   *  push every refetch; if we don't dedupe the feed shuffles on every poll
   *  even when nothing has actually changed. */
  push: (e: EventRow) => void;
  /** Bulk upsert — preserves ordering of events already in the store and
   *  prepends only genuinely new ids. */
  upsertMany: (events: EventRow[]) => void;
  clear: () => void;
};

function mergeEvent(existing: EventRow, incoming: EventRow): EventRow {
  // Keep the original startedAt (the event's first observation) so position
  // stability is preserved; adopt new title/detail/endedAt in case the
  // upstream refined them.
  return {
    ...existing,
    title: incoming.title,
    detail: incoming.detail,
    endedAt: incoming.endedAt,
    kind: incoming.kind,
  };
}

export const useEventsStore = create<EventsStore>((set) => ({
  events: [],
  push: (e) =>
    set((s) => {
      const idx = s.events.findIndex((x) => x.id === e.id);
      if (idx >= 0) {
        const next = s.events.slice();
        next[idx] = mergeEvent(next[idx], e);
        return { events: next };
      }
      return { events: [e, ...s.events].slice(0, 100) };
    }),
  upsertMany: (incoming) =>
    set((s) => {
      const byId = new Map(s.events.map((e) => [e.id, e]));
      const truly_new: EventRow[] = [];
      for (const e of incoming) {
        const existing = byId.get(e.id);
        if (existing) {
          byId.set(e.id, mergeEvent(existing, e));
        } else {
          truly_new.push(e);
          byId.set(e.id, e);
        }
      }
      // Preserve original ordering; prepend any new events in the order
      // they were submitted.
      const updated = s.events.map((e) => byId.get(e.id) ?? e);
      return { events: [...truly_new, ...updated].slice(0, 100) };
    }),
  clear: () => set({ events: [] }),
}));
