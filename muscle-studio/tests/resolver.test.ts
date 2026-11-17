import { describe, expect, it } from "vitest";
import { MUSCLES } from "@/data/muscles/muscles";
import { mapMeshesToMuscles } from "@/lib/anatomy/resolver";

const d = (name: string, i = 0) => ({ uid: `u${i}-${name}`, name });

describe("mapMeshesToMuscles", () => {
  it("maps Open Anatomy 3D mesh keys with side detection", () => {
    const report = mapMeshesToMuscles(
      [d("deltoid_anterior_l"), d("deltoid_anterior_r"), d("biceps_brachii_l"), d("trapezius_descending_r")],
      MUSCLES,
    );
    expect(report.unmapped).toHaveLength(0);
    expect(report.byMuscle.get("deltoid-anterior")).toHaveLength(2);
    expect(report.mapped.find((m) => m.name === "biceps_brachii_l")).toMatchObject({
      muscleId: "biceps-brachii",
      side: "left",
      via: "mesh-name",
    });
  });

  it("accepts other naming styles for the same mesh keys", () => {
    const report = mapMeshesToMuscles([d("Biceps_Brachii.L"), d("GastrocnemiusRight"), d("Left Rectus Femoris")], MUSCLES);
    expect(report.mapped.map((m) => m.muscleId)).toEqual(["biceps-brachii", "gastrocnemius", "rectus-femoris"]);
  });

  it("never guesses: a whole-muscle name does not map to one of its parts", () => {
    const report = mapMeshesToMuscles([d("Deltoid_L"), d("Latissimus_Dorsi_L"), d("ctx_hand_l")], MUSCLES);
    expect(report.unmapped.map((m) => m.name)).toEqual(["Deltoid_L", "Latissimus_Dorsi_L", "ctx_hand_l"]);
  });

  it("applies user and asset overrides before name matching", () => {
    const report = mapMeshesToMuscles([d("Object_17"), d("Object_18")], MUSCLES, {
      assetMap: { Object_17: "soleus" },
      userMap: { Object_18: "soleus", Object_17: "trapezius-descending" },
    });
    expect(report.byMesh.get("u0-Object_17")?.muscleId).toBe("trapezius-descending");
    expect(report.byMesh.get("u0-Object_17")?.via).toBe("user-map");
    expect(report.byMesh.get("u0-Object_18")?.muscleId).toBe("soleus");
  });

  it("ignores override targets that are not real muscle ids", () => {
    const report = mapMeshesToMuscles([d("Foo")], MUSCLES, { userMap: { Foo: "not-a-muscle" } });
    expect(report.unmapped).toHaveLength(1);
  });

  it("flags single-mesh assets as unsuitable for per-muscle highlighting", () => {
    const report = mapMeshesToMuscles([d("Body")], MUSCLES);
    expect(report.unsuitable).toBe(true);
  });

  it("flags assets where no mesh matches any muscle", () => {
    expect(mapMeshesToMuscles([d("A"), d("B")], MUSCLES).unsuitable).toBe(true);
  });
});
