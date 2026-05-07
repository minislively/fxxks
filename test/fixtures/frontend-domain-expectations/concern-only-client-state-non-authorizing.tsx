import { create } from "zustand";

type DraftState = {
  query: string;
  setQuery: (value: string) => void;
};

export const useDraftStore = create<DraftState>((set) => ({
  query: "",
  setQuery: (value) => set({ query: value }),
}));
