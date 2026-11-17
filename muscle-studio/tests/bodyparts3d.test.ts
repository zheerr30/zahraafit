import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Vector3, type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import { structureName } from "@/data/anatomy/lexicon";
import { TARGET_COVERAGE } from "@/data/muscles/coverage";
import { LEGACY_GROUP_IDS, MUSCLES, MUSCLES_BY_ID } from "@/data/muscles/muscles";
import { ANATOMY_ASSETS } from "@/data/models/manifest";
import type { MappingReport } from "@/lib/anatomy/resolver";
import { DEFAULT_LAYERS, createDefaultDoc } from "@/lib/storage/schema";
import {
  applyLayers,
  applyMaterials,
  combineBodyAndMuscles,
  isPickable,
  mapPreparedModel,
  prepareModel,
  type PreparedModel,
} from "@/lib/three/anatomyModel";
import { MaterialLibrary } from "@/lib/three/materials";
import { createEditorStore } from "@/stores/editorStore";
// The pipeline's source-of-truth list of extracted units.
import { UNITS } from "../pipeline/bodyparts3d/units.mjs";

const PUBLIC = join(__dirname, "../public");
const report = JSON.parse(readFileSync(join(PUBLIC, "models/bodyparts3d/build-report.json"), "utf8"));

async function load(url: string): Promise<Group> {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(PUBLIC, url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) =>
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err),
  );
  return gltf.scene;
}

const bodies: Record<string, { model: PreparedModel; report: MappingReport }> = {};

beforeAll(async () => {
  for (const asset of ANATOMY_ASSETS) {
    const body = await load(asset.url);
    const muscles = await load(asset.musclesUrl!);
    const replaced = combineBodyAndMuscles(body, muscles);
    expect(replaced?.name).toBe("muscles");
    const model = prepareModel(body, asset);
    applyLayers(model, DEFAULT_LAYERS);
    bodies[asset.gender] = { model, report: mapPreparedModel(model, asset, undefined) };
  }
}, 120_000);

describe("pipeline output (BodyParts3D build report)", () => {
  it("used every listed part and reproduces the source shape closely", () => {
    expect(report.missingParts).toEqual([]);
    expect(report.filesUsed).toBe(378);
    expect(report.fidelitySummary.worstMeanMm).toBeLessThan(0.5);
    expect(report.fidelitySummary.worstP95Mm).toBeLessThan(2);
  });

  it("is aligned with the open-anatomy-3d body and reproduces its female warp", () => {
    for (const v of Object.values(report.maleFrameCheck) as { mean: number }[]) expect(v.mean).toBeLessThan(1);
    for (const v of Object.values(report.femaleCheck) as { mean: number }[]) expect(v.mean).toBeLessThan(1.5);
    expect(report.correspondencePairs).toBeGreaterThan(500_000);
    expect(report.fieldHoldoutError.meanMm).toBeLessThan(1);
  });

  it("matches the app's muscle database one-to-one", () => {
    expect(UNITS.map((u: { key: string }) => u.key).sort()).toEqual(MUSCLES.map((m) => m.meshNames[0]).sort());
  });
});

describe.each(["male", "female"])("%s body with separated BodyParts3D muscles", (gender) => {
  it("replaces the merged muscle groups and maps all 102 separated meshes", () => {
    const { model, report: r } = bodies[gender];
    expect([...model.systemGroups.keys()].sort()).toEqual(
      ["muscles", "muscles_context", "nerves", "organs", "skeleton", "skin", "vessels"].sort(),
    );
    const muscleMeshes = model.meshes.filter((m) => model.systemOf.get(m.uuid) === "muscles");
    expect(muscleMeshes).toHaveLength(MUSCLES.length * 2);
    expect(r.unmapped.map((u) => u.name)).toEqual([]);
    expect(r.missingMuscles).toEqual([]);
    // No open-anatomy-3d merged group survived.
    expect(model.meshes.some((m) => model.meshNames.get(m.uuid) === "upper_arm_muscles_l")).toBe(false);
  });

  it("gives each unit one left and one right mesh, on the correct side", () => {
    const { model, report: r } = bodies[gender];
    const seen = new Set<string>();
    for (const muscle of MUSCLES) {
      const uids = r.byMuscle.get(muscle.id) ?? [];
      expect(uids.length, muscle.id).toBe(2);
      for (const uid of uids) {
        expect(seen.has(uid)).toBe(false);
        seen.add(uid);
        const mapping = r.byMesh.get(uid)!;
        const mesh = model.meshByUid.get(uid)!;
        const c = mesh.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(mesh.matrixWorld);
        if (mapping.side === "left") expect(c.x, mapping.name).toBeGreaterThan(0);
        else expect(c.x, mapping.name).toBeLessThan(0);
      }
    }
  });

  it("shows only muscles (+ the skull to complete the head) at start and never maps context meshes", () => {
    const { model, report: r } = bodies[gender];
    for (const [system, group] of model.systemGroups) {
      expect(group.visible, system).toBe(["muscles", "muscles_context", "skeleton"].includes(system));
    }
    for (const mesh of model.meshes) {
      if (model.systemOf.get(mesh.uuid) !== "skeleton") continue;
      const name = model.meshNames.get(mesh.uuid)!;
      expect(mesh.visible, name).toBe(["skull", "mandible", "teeth"].includes(name));
    }
    for (const mesh of model.meshes) {
      if (model.systemOf.get(mesh.uuid) === "muscles_context") expect(r.byMesh.has(mesh.uuid)).toBe(false);
      if (model.systemOf.get(mesh.uuid) === "skin") expect(isPickable(mesh)).toBe(false);
    }
  });

  it("names every visible structure in Arabic", () => {
    const { model } = bodies[gender];
    for (const mesh of model.meshes) {
      const key = model.meshNames.get(mesh.uuid)!;
      const name = structureName(key);
      expect(name, key).not.toBeNull();
      expect(name!.ar, key).toMatch(/[؀-ۿ]/);
    }
  });

  it("selecting each unit independently recolours only its own two meshes", () => {
    const { model, report: r } = bodies[gender];
    const library = new MaterialLibrary();
    const doc = createDefaultDoc(gender as "male" | "female");
    const highlight = library.muscle(doc.palette.primary, "highlight");
    for (const muscle of MUSCLES) {
      const store = createEditorStore({ initialDoc: doc });
      store.getState().toggleMuscle(muscle.id);
      expect(Object.keys(store.getState().doc.selections)).toEqual([muscle.id]);
      applyMaterials(model, r, { doc: store.getState().doc, hoveredMuscleId: null }, library);
      const own = new Set(r.byMuscle.get(muscle.id));
      for (const mesh of model.meshes) {
        expect(mesh.material === highlight, `${muscle.id} → ${model.meshNames.get(mesh.uuid)}`).toBe(own.has(mesh.uuid));
      }
    }
    library.dispose();
  });
});

describe.each(["male", "female"])("%s realistic appearance data", (gender) => {
  it("every muscle mesh carries baked occlusion, tendon and fibre attributes", () => {
    const { model } = bodies[gender];
    for (const mesh of model.meshes) {
      const system = model.systemOf.get(mesh.uuid);
      if (system !== "muscles" && system !== "muscles_context") continue;
      const anat = mesh.geometry.getAttribute("_anat");
      const fiber = mesh.geometry.getAttribute("_fiber");
      expect(anat, model.meshNames.get(mesh.uuid)).toBeDefined();
      expect(fiber).toBeDefined();
      for (let i = 0; i < anat.count; i += Math.max(1, anat.count >> 4)) {
        expect(anat.getX(i)).toBeGreaterThanOrEqual(0);
        expect(anat.getX(i)).toBeLessThanOrEqual(1.0001);
        expect(Math.hypot(fiber.getX(i), fiber.getY(i), fiber.getZ(i))).toBeCloseTo(1, 1);
      }
    }
  });
});

describe("data consistency", () => {
  it("coverage table points at real units and lists the absent muscles", () => {
    expect(TARGET_COVERAGE).toHaveLength(32);
    const missing = TARGET_COVERAGE.filter((c) => c.status === "missing").map((c) => c.name.en);
    expect(missing).toEqual(["Latissimus Dorsi", "Rectus Abdominis", "Internal Obliques"]);
    for (const entry of TARGET_COVERAGE) for (const id of entry.muscleIds) expect(MUSCLES_BY_ID.has(id), id).toBe(true);
  });

  it("legacy group ids expand only to existing units", () => {
    for (const ids of Object.values(LEGACY_GROUP_IDS)) for (const id of ids) expect(MUSCLES_BY_ID.has(id), id).toBe(true);
  });
});
