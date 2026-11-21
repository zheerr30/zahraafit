import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/** Bookmarked exercises, kept on this device (localStorage). */
const KEY = "muscle-studio:exercise-bookmarks:v1";

function read(): string[] {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

interface ExerciseState {
  bookmarks: ReadonlySet<string>;
  /** False until the saved bookmarks were read (client only). */
  loaded: boolean;
  load: () => void;
  toggle: (id: string) => void;
}

export const exerciseStore = createStore<ExerciseState>()((set, get) => ({
  bookmarks: new Set<string>(),
  loaded: false,
  load: () => {
    if (!get().loaded) set({ bookmarks: new Set(read()), loaded: true });
  },
  toggle: (id) => {
    const next = new Set(get().bookmarks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ bookmarks: next, loaded: true });
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // storage unavailable (private mode): bookmarks last for this visit only
    }
  },
}));

export function useExercises<T>(selector: (s: ExerciseState) => T): T {
  return useStore(exerciseStore, selector);
}
