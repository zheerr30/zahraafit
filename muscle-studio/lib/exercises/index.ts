import { EXERCISES, type Equipment, type Exercise, type ExerciseType, type Level } from "@/data/exercises/exercises";
import { GROUP_BY_ID, groupsOfUnit, type MuscleView } from "@/data/exercises/groups";
import { normalizeSearchText } from "@/lib/anatomy/normalize";

export interface ExerciseFilter {
  type?: ExerciseType;
  /** Text typed by the user (Arabic or English; name, muscles, equipment). */
  query?: string;
  equipment?: Equipment | null;
  level?: Level | null;
  /** Only exercises that work one of these groups. */
  groups?: readonly string[] | null;
  /** Only bookmarked exercises (ids). */
  bookmarks?: ReadonlySet<string> | null;
  /** Only exercises that have a video. */
  video?: boolean;
}

/** How an exercise relates to a set of muscle groups: prime mover (2), helper (1) or not at all (0). */
export function relevance(e: Exercise, groups: readonly string[]): 0 | 1 | 2 {
  if (e.primary.some((g) => groups.includes(g))) return 2;
  if (e.secondary.some((g) => groups.includes(g))) return 1;
  return 0;
}

const haystack = new Map<string, string>();
function textOf(e: Exercise): string {
  let t = haystack.get(e.id);
  if (!t) {
    const names = [...e.primary, ...e.secondary].map((g) => `${GROUP_BY_ID.get(g)?.ar ?? ""} ${GROUP_BY_ID.get(g)?.en ?? ""}`).join(" ");
    t = normalizeSearchText(`${e.ar} ${e.en} ${names}`);
    haystack.set(e.id, t);
  }
  return t;
}

/** Filtered exercises; with `groups`, prime-mover exercises come first. */
export function filterExercises(f: ExerciseFilter, all: readonly Exercise[] = EXERCISES): Exercise[] {
  const q = normalizeSearchText(f.query ?? "");
  const out = all.filter(
    (e) =>
      (!f.type || e.type === f.type) &&
      (!f.equipment || e.equipment === f.equipment) &&
      (!f.level || e.level === f.level) &&
      (!f.bookmarks || f.bookmarks.has(e.id)) &&
      (!f.video || !!e.media?.video) &&
      (!f.groups || relevance(e, f.groups) > 0) &&
      (!q || textOf(e).includes(q)),
  );
  // prime movers of the chosen muscle first; then exercises with a video, with written steps, easier ones
  const g = f.groups ?? null;
  const rank = (e: Exercise) => (g ? (2 - relevance(e, g)) * 100 : 0) + (e.media?.video ? 0 : 20) + (e.steps.length ? 0 : 10) + e.level;
  return out.map((e, i) => [rank(e), i, e] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}

/** Group ids of a model unit (empty when no exercise group covers it). */
export function groupIdsOfUnit(unitId: string): string[] {
  return groupsOfUnit(unitId).map((g) => g.id);
}

/** Number of exercises that work a model unit, by type. */
export function countForUnit(unitId: string): Record<ExerciseType, number> {
  const groups = groupIdsOfUnit(unitId);
  return {
    strength: groups.length ? filterExercises({ type: "strength", groups }).length : 0,
    stretch: groups.length ? filterExercises({ type: "stretch", groups }).length : 0,
  };
}

/** Model unit ids lit for an exercise: prime movers and helpers (helpers never repeat a prime mover). */
export function spotlightOf(e: Exercise): { primary: string[]; secondary: string[] } {
  const units = (ids: string[]) => [...new Set(ids.flatMap((g) => GROUP_BY_ID.get(g)?.units ?? []))];
  const primary = units(e.primary);
  const p = new Set(primary);
  return { primary, secondary: units(e.secondary).filter((u) => !p.has(u)) };
}

/** The side of the body an exercise's prime movers are best seen from. */
export function viewOf(e: Exercise): MuscleView {
  const back = e.primary.filter((g) => GROUP_BY_ID.get(g)?.view === "back").length;
  return back > e.primary.length - back ? "back" : "front";
}

/** Function line of a model unit (from its most specific exercise group). */
export function functionOfUnit(unitId: string): string | null {
  const gs = groupsOfUnit(unitId);
  return gs.length ? gs[gs.length - 1].fn : null;
}

/** The 11-character id of a YouTube link (youtu.be/…, watch?v=…, /shorts/…, /embed/…), or null. */
export function youtubeId(url: string | undefined | null): string | null {
  const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/.exec(url ?? "");
  return m ? m[1] : null;
}
