import { describe, expect, it } from "vitest";
import { MUSCLES, REGION_DEFINITIONS } from "@/data/muscles/muscles";
import { ANATOMY_ASSETS, resolveAsset } from "@/data/models/manifest";
import { buildKeyIndex } from "@/lib/anatomy/resolver";
import { searchMuscles } from "@/lib/anatomy/search";
import { REGIONS } from "@/types/anatomy";

describe("muscle database", () => {
  it("has unique ids, bilingual names and valid regions", () => {
    const ids = new Set<string>();
    for (const m of MUSCLES) {
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(m.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(m.displayName.en.length).toBeGreaterThan(2);
      expect(m.displayName.ar).toMatch(/[؀-ۿ]/);
      expect(REGIONS).toContain(m.region);
      expect(m.meshNames.length).toBeGreaterThan(0);
      expect(m.viewAvailability.length).toBeGreaterThan(0);
    }
    expect(REGION_DEFINITIONS.map((r) => r.id)).toEqual([...REGIONS]);
  });

  it("includes all required muscles", () => {
    expect(MUSCLES).toHaveLength(32);
  });

  it("has no canonical mesh name colliding between muscles", () => {
    const index = buildKeyIndex(MUSCLES);
    for (const m of MUSCLES) {
      for (const name of m.meshNames) {
        const key = name.toLowerCase().replace(/_/g, " ");
        expect(index.meshKeys.get(key)).toBe(m.id);
      }
    }
  });
});

describe("searchMuscles", () => {
  it("finds muscles by English name, alias and Arabic name", () => {
    expect(searchMuscles(MUSCLES, "lats")[0].id).toBe("latissimus-dorsi");
    expect(searchMuscles(MUSCLES, "rear delt")[0].id).toBe("posterior-deltoid");
    expect(searchMuscles(MUSCLES, "الصدرية")[0].id).toBe("pectoralis-major");
    // Arabic normalization: hamza-less query still matches "الألوية".
    expect(searchMuscles(MUSCLES, "الالويه").length).toBeGreaterThan(0);
    expect(searchMuscles(MUSCLES, "الالوية الكبرى")[0].id).toBe("gluteus-maximus");
  });

  it("returns everything for an empty query and nothing for nonsense", () => {
    expect(searchMuscles(MUSCLES, "  ")).toHaveLength(MUSCLES.length);
    expect(searchMuscles(MUSCLES, "zzzz")).toHaveLength(0);
  });
});

describe("resolveAsset", () => {
  it("prefers a dedicated posterior asset for the back view when installed", () => {
    const all = new Set(ANATOMY_ASSETS.map((a) => a.id));
    expect(resolveAsset("male", "back", all)?.id).toBe("male-superficial-posterior");
    expect(resolveAsset("male", "front", all)?.id).toBe("male-superficial");
  });

  it("falls back to the full-body asset and returns null when nothing is installed", () => {
    expect(resolveAsset("female", "back", new Set(["female-superficial"]))?.id).toBe("female-superficial");
    expect(resolveAsset("female", "front", new Set())).toBeNull();
  });
});
