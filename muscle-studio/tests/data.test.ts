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

  it("has one entry per separated BodyParts3D unit", () => {
    expect(MUSCLES).toHaveLength(51);
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
    expect(searchMuscles(MUSCLES, "الدالية الأمامية")[0].id).toBe("deltoid-anterior");
    expect(searchMuscles(MUSCLES, "rear delt")[0].id).toBe("deltoid-posterior");
    expect(searchMuscles(MUSCLES, "أعلى الصدر")[0].id).toBe("pectoralis-major-clavicular");
    expect(searchMuscles(MUSCLES, "biceps brachii")[0].id).toBe("biceps-brachii");
    expect(searchMuscles(MUSCLES, "بايسبس")[0].id).toBe("biceps-brachii");
    expect(searchMuscles(MUSCLES, "السمانة").map((m) => m.id)).toEqual(expect.arrayContaining(["gastrocnemius", "soleus"]));
    expect(searchMuscles(MUSCLES, "الالوية الكبرى")[0].id).toBe("gluteus-maximus");
    expect(searchMuscles(MUSCLES, "Musculus soleus")[0].id).toBe("soleus");
  });

  it("returns everything for an empty query and nothing for nonsense", () => {
    expect(searchMuscles(MUSCLES, "  ")).toHaveLength(MUSCLES.length);
    expect(searchMuscles(MUSCLES, "zzzz")).toHaveLength(0);
  });
});

describe("resolveAsset", () => {
  it("resolves the BodyParts3D muscles + reference body for each gender", () => {
    expect(resolveAsset("male", "back")?.id).toBe("bodyparts3d-male");
    expect(resolveAsset("female", "front")?.id).toBe("bodyparts3d-female");
    expect(ANATOMY_ASSETS.every((a) => a.musclesUrl?.startsWith("/models/bodyparts3d/"))).toBe(true);
    expect(ANATOMY_ASSETS.every((a) => a.attribution?.license === "CC BY 4.0")).toBe(true);
  });
});
