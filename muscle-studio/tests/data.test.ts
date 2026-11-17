import { describe, expect, it } from "vitest";
import { MUSCLES, REGION_DEFINITIONS } from "@/data/muscles/muscles";
import { ANATOMY_ASSETS, resolveAsset } from "@/data/models/manifest";
import { normalizeKey } from "@/lib/anatomy/normalize";
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

  it("has one entry per selectable muscle unit of the model", () => {
    expect(MUSCLES).toHaveLength(22);
    for (const m of MUSCLES) {
      expect(m.includes.length, m.id).toBeGreaterThan(0);
      for (const i of m.includes) expect(i.ar).toMatch(/[\u0600-\u06ff]/);
      expect(m.granularity === "single" ? m.includes.length : 2).toBeGreaterThanOrEqual(1);
    }
  });

  it("has no canonical mesh name colliding between muscles", () => {
    const index = buildKeyIndex(MUSCLES);
    for (const m of MUSCLES) {
      for (const name of m.meshNames) {
        expect(index.meshKeys.get(normalizeKey(name))).toBe(m.id);
      }
    }
  });
});

describe("searchMuscles", () => {
  it("finds units by Arabic name, English name, constituent muscle and gym slang", () => {
    expect(searchMuscles(MUSCLES, "الصدرية الكبرى")[0].id).toBe("pectoralis-major");
    expect(searchMuscles(MUSCLES, "traps")[0].id).toBe("trapezius");
    expect(searchMuscles(MUSCLES, "biceps brachii")[0].id).toBe("upper-arm");
    expect(searchMuscles(MUSCLES, "ذات الرأسين العضدية")[0].id).toBe("upper-arm");
    expect(searchMuscles(MUSCLES, "السمانة")[0].id).toBe("calf");
    expect(searchMuscles(MUSCLES, "الالوية الكبرى")[0].id).toBe("gluteal");
    expect(searchMuscles(MUSCLES, "Musculus deltoideus")[0].id).toBe("deltoid");
  });

  it("returns everything for an empty query and nothing for nonsense", () => {
    expect(searchMuscles(MUSCLES, "  ")).toHaveLength(MUSCLES.length);
    expect(searchMuscles(MUSCLES, "zzzz")).toHaveLength(0);
  });
});

describe("resolveAsset", () => {
  it("resolves the bundled Open Anatomy 3D body for each gender", () => {
    expect(resolveAsset("male", "back")?.id).toBe("open-anatomy-3d-male");
    expect(resolveAsset("female", "front")?.id).toBe("open-anatomy-3d-female");
    expect(ANATOMY_ASSETS.every((a) => a.attribution?.license === "CC BY 4.0")).toBe(true);
  });
});
