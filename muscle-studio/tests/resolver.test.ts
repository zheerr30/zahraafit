import { describe, expect, it } from "vitest";
import { MUSCLES } from "@/data/muscles/muscles";
import { mapMeshesToMuscles } from "@/lib/anatomy/resolver";

const d = (name: string, i = 0) => ({ uid: `u${i}-${name}`, name });

describe("mapMeshesToMuscles", () => {
  it("maps Open Anatomy 3D mesh keys with side detection", () => {
    const report = mapMeshesToMuscles(
      [d("chest_muscles_l"), d("chest_muscles_r"), d("upper_arm_muscles_l"), d("abdominal_muscles")],
      MUSCLES,
    );
    expect(report.unmapped).toHaveLength(0);
    expect(report.byMuscle.get("pectoralis-major")).toHaveLength(2);
    expect(report.mapped.find((m) => m.name === "upper_arm_muscles_l")).toMatchObject({
      muscleId: "upper-arm",
      side: "left",
      via: "mesh-name",
    });
    expect(report.mapped.find((m) => m.name === "abdominal_muscles")?.side).toBe("center");
  });

  it("maps unambiguous aliases", () => {
    const report = mapMeshesToMuscles([d("Pectoralis_Major_L"), d("Traps_R"), d("Hamstring.L")], MUSCLES);
    expect(report.mapped.map((m) => m.muscleId)).toEqual(["pectoralis-major", "trapezius", "hamstrings"]);
  });

  it("never guesses unknown names — constituent muscles are not mapping aliases", () => {
    // Biceps is inside the upper-arm group, but a mesh named Biceps must not be
    // silently mapped to the whole group.
    const report = mapMeshesToMuscles([d("Biceps_Brachii_L"), d("Latissimus_Dorsi_L"), d("trapezius_l")], MUSCLES);
    expect(report.unmapped.map((m) => m.name)).toEqual(["Biceps_Brachii_L", "Latissimus_Dorsi_L"]);
  });

  it("applies user and asset overrides before name matching", () => {
    const report = mapMeshesToMuscles([d("Object_17"), d("Object_18")], MUSCLES, {
      assetMap: { Object_17: "calf" },
      userMap: { Object_18: "calf", Object_17: "trapezius" },
    });
    expect(report.byMesh.get("u0-Object_17")?.muscleId).toBe("trapezius");
    expect(report.byMesh.get("u0-Object_17")?.via).toBe("user-map");
    expect(report.byMesh.get("u0-Object_18")?.muscleId).toBe("calf");
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
