import type { MuscleDefinition } from "@/types/anatomy";
import { REGION_DEFINITIONS } from "@/data/muscles/muscles";
import { normalizeSearchText } from "./normalize";

const haystackCache = new WeakMap<MuscleDefinition, string>();

function haystack(m: MuscleDefinition): string {
  let h = haystackCache.get(m);
  if (!h) {
    const region = REGION_DEFINITIONS.find((r) => r.id === m.region);
    h = normalizeSearchText(
      [
        m.id,
        m.displayName.en,
        m.displayName.ar,
        m.latin,
        ...m.includes.flatMap((i) => [i.ar, i.en]),
        ...m.searchTerms,
        ...m.aliases,
        ...m.meshNames,
        region?.displayName.en ?? "",
        region?.displayName.ar ?? "",
      ].join(" | "),
    );
    haystackCache.set(m, h);
  }
  return h;
}

/**
 * Bilingual search. Every whitespace-separated term must appear somewhere in the
 * muscle's English/Arabic names, aliases, mesh names or region.
 * Results are ranked: display-name prefix matches first.
 */
export function searchMuscles(
  muscles: readonly MuscleDefinition[],
  query: string,
): MuscleDefinition[] {
  const q = normalizeSearchText(query);
  if (!q) return [...muscles];
  const terms = q.split(" ");
  const scored: { m: MuscleDefinition; score: number }[] = [];
  for (const m of muscles) {
    const h = haystack(m);
    if (!terms.every((t) => h.includes(t))) continue;
    const en = normalizeSearchText(m.displayName.en);
    const ar = normalizeSearchText(m.displayName.ar);
    let score = 2;
    if (en.startsWith(q) || ar.startsWith(q)) score = 0;
    else if (en.includes(q) || ar.includes(q)) score = 1;
    scored.push({ m, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.m);
}
