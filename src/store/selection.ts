import { create } from 'zustand';

export type SelectionKind =
  | 'vessel'
  | 'aircraft'
  | 'satellite'
  | 'port'
  | 'chokepoint';

export type Selection = {
  kind: SelectionKind;
  id: string;
};

type SelectionStore = {
  selection: Selection | null;
  select: (s: Selection | null) => void;
};

export const useSelectionStore = create<SelectionStore>((set) => ({
  selection: null,
  select: (selection) => set({ selection }),
}));
