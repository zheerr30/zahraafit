import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MUSCLES } from "@/data/muscles/muscles";
import { TEST_RIG_ASSET } from "@/data/models/manifest";
import { mapMeshesToMuscles } from "@/lib/anatomy/resolver";

const d = (name: string, i = 0) => ({ uid: `u${i}-${name}`, name });

describe("mapMeshesToMuscles", () => {
  it("maps canonical names and aliases with side detection", () => {
    const report = mapMeshesToMuscles(
      [d("Pectoralis_Major_L"), d("Pectoralis_Major_R"), d("Rear_Delt_L"), d("calves.R")],
      MUSCLES,
    );
    expect(report.unmapped).toHaveLength(0);
    expect(report.byMuscle.get("pectoralis-major")).toHaveLength(2);
    expect(report.mapped.find((m) => m.name === "Rear_Delt_L")).toMatchObject({
      muscleId: "posterior-deltoid",
      side: "left",
      via: "alias",
    });
    expect(report.mapped.find((m) => m.name === "calves.R")?.muscleId).toBe("gastrocnemius");
  });

  it("never guesses unknown or ambiguous names", () => {
    const report = mapMeshesToMuscles([d("Biceps_L"), d("Sartorius_L"), d("Pectoralis_Major_L")], MUSCLES);
    // "biceps" is an alias of biceps-brachii only; "sartorius" is unknown.
    expect(report.unmapped.map((m) => m.name)).toEqual(["Sartorius_L"]);
  });

  it("applies user and asset overrides before name matching", () => {
    const report = mapMeshesToMuscles([d("Object_17"), d("Object_18")], MUSCLES, {
      assetMap: { Object_17: "soleus" },
      userMap: { Object_18: "soleus", Object_17: "trapezius" },
    });
    expect(report.byMesh.get("u0-Object_17")?.muscleId).toBe("trapezius");
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
    expect(report.unsuitableReason).toMatch(/single combined mesh/);
  });

  it("flags assets where no mesh matches any muscle", () => {
    const report = mapMeshesToMuscles([d("A"), d("B")], MUSCLES);
    expect(report.unsuitable).toBe(true);
  });

  it("maps every muscle of the generated pipeline test rig", () => {
    const glb = readFileSync(join(__dirname, "../public/models/test-rig/pipeline-test-rig.glb"));
    const jsonLength = glb.readUInt32LE(12);
    const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8")) as {
      nodes: { name: string }[];
    };
    const report = mapMeshesToMuscles(
      gltf.nodes.map((n, i) => d(n.name, i)),
      MUSCLES,
      { ignore: TEST_RIG_ASSET.ignoreMeshes },
    );
    expect(report.unmapped.map((m) => m.name)).toEqual([]);
    expect(report.missingMuscles).toEqual([]);
    expect(report.ignored.length).toBeGreaterThan(0);
    expect(report.unsuitable).toBe(false);
    // Every bilateral muscle resolves to both sides.
    for (const muscle of MUSCLES) {
      const sides = report.mapped.filter((m) => m.muscleId === muscle.id).map((m) => m.side);
      expect(new Set(sides)).toEqual(new Set(["left", "right"]));
    }
  });
});
