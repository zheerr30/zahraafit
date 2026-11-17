import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Vector3, type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import catalog from "@/data/models/open-anatomy-3d/catalog.json";
import { structureName } from "@/data/anatomy/lexicon";
import { TARGET_COVERAGE } from "@/data/muscles/coverage";
import { MUSCLES, MUSCLES_BY_ID } from "@/data/muscles/muscles";
import { ANATOMY_ASSETS } from "@/data/models/manifest";
import type { MappingReport } from "@/lib/anatomy/resolver";
import { DEFAULT_LAYERS, createDefaultDoc } from "@/lib/storage/schema";
import {
  applyLayers,
  applyMaterials,
  isPickable,
  mapPreparedModel,
  prepareModel,
  type PreparedModel,
} from "@/lib/three/anatomyModel";
import { MaterialLibrary } from "@/lib/three/materials";
import { createEditorStore } from "@/stores/editorStore";

const MIDLINE = new Set(["abdominal-wall", "diaphragm", "pelvic-floor"]);

async function load(file: string): Promise<Group> {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(__dirname, "../public/models/open-anatomy-3d", file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) =>
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err),
  );
  return gltf.scene;
}

const bodies: Record<string, { model: PreparedModel; report: MappingReport }> = {};

beforeAll(async () => {
  for (const asset of ANATOMY_ASSETS) {
    const file = asset.url.split("/").pop()!;
    const model = prepareModel(await load(file), asset);
    applyLayers(model, DEFAULT_LAYERS);
    bodies[asset.gender] = { model, report: mapPreparedModel(model, asset, undefined) };
  }
}, 120_000);

describe.each(["male", "female"])("Open Anatomy 3D %s model", (gender) => {
  it("has every body system and maps all muscle meshes", () => {
    const { model, report } = bodies[gender];
    expect([...model.systemGroups.keys()].sort()).toEqual(
      ["muscles", "nerves", "organs", "skeleton", "skin", "vessels"].sort(),
    );
    const muscleMeshes = model.meshes.filter((m) => model.systemOf.get(m.uuid) === "muscles");
    expect(muscleMeshes).toHaveLength(41);
    expect(report.unmapped.map((u) => u.name)).toEqual([]);
    expect(report.missingMuscles).toEqual([]);
    expect(report.unsuitable).toBe(false);
  });

  it("gives each muscle unit its own disjoint meshes with correct sides", () => {
    const { model, report } = bodies[gender];
    const seen = new Set<string>();
    for (const muscle of MUSCLES) {
      const uids = report.byMuscle.get(muscle.id) ?? [];
      expect(uids.length, muscle.id).toBe(MIDLINE.has(muscle.id) ? 1 : 2);
      for (const uid of uids) {
        expect(seen.has(uid)).toBe(false);
        seen.add(uid);
        const mapping = report.byMesh.get(uid)!;
        const mesh = model.meshByUid.get(uid)!;
        const center = mesh.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(mesh.matrixWorld);
        // The model faces +Z, so its left side is on +X.
        if (mapping.side === "left") expect(center.x, mapping.name).toBeGreaterThan(0);
        if (mapping.side === "right") expect(center.x, mapping.name).toBeLessThan(0);
        if (mapping.side === "center") expect(Math.abs(center.x), mapping.name).toBeLessThan(0.05);
      }
    }
  });

  it("shows only the muscles at start; other systems are hidden and not pickable", () => {
    const { model } = bodies[gender];
    for (const [system, group] of model.systemGroups) expect(group.visible, system).toBe(system === "muscles");
    for (const mesh of model.meshes) {
      expect(isPickable(mesh)).toBe(model.systemOf.get(mesh.uuid) === "muscles");
    }
  });

  it("toggles systems; the skin is never pickable so muscles can be clicked through it", () => {
    const { model } = bodies[gender];
    applyLayers(model, { ...DEFAULT_LAYERS, skin: true, skeleton: true });
    expect(model.systemGroups.get("skin")!.visible).toBe(true);
    for (const mesh of model.meshes) {
      const system = model.systemOf.get(mesh.uuid);
      if (system === "skin") expect(isPickable(mesh)).toBe(false);
      if (system === "skeleton") expect(isPickable(mesh)).toBe(true);
    }
    applyLayers(model, DEFAULT_LAYERS);
  });

  it("names every mesh structure in Arabic", () => {
    const { model } = bodies[gender];
    for (const mesh of model.meshes) {
      const key = model.meshNames.get(mesh.uuid)!;
      const name = structureName(key);
      expect(name, key).not.toBeNull();
      expect(name!.ar, key).toMatch(/[؀-ۿ]/);
    }
  });

  it("selecting each muscle unit independently recolours only its own meshes", () => {
    const { model, report } = bodies[gender];
    const library = new MaterialLibrary();
    const doc = createDefaultDoc(gender as "male" | "female");
    const highlight = library.get(doc.palette.primary);
    for (const muscle of MUSCLES) {
      const store = createEditorStore({ initialDoc: doc });
      store.getState().toggleMuscle(muscle.id);
      expect(Object.keys(store.getState().doc.selections)).toEqual([muscle.id]);
      applyMaterials(model, report, { doc: store.getState().doc, hoveredMuscleId: null }, library);
      const own = new Set(report.byMuscle.get(muscle.id));
      for (const mesh of model.meshes) {
        if (model.systemOf.get(mesh.uuid) !== "muscles") continue;
        expect(mesh.material === highlight, `${muscle.id} → ${model.meshNames.get(mesh.uuid)}`).toBe(own.has(mesh.uuid));
      }
    }
    library.dispose();
  });
});

describe("data consistency with the upstream catalog", () => {
  it("covers exactly the catalog's muscle structures", () => {
    const catalogMuscles = new Set(
      (catalog as { key: string; system: string }[])
        .filter((c) => c.system === "muscles")
        .map((c) => c.key.replace(/_(l|r)$/, "")),
    );
    const ours = new Set(MUSCLES.flatMap((m) => m.meshNames));
    expect([...ours].sort()).toEqual([...catalogMuscles].sort());
  });

  it("coverage table points at real muscle units", () => {
    expect(TARGET_COVERAGE).toHaveLength(32);
    for (const entry of TARGET_COVERAGE) {
      if (entry.status === "missing") expect(entry.muscleId).toBeNull();
      else expect(MUSCLES_BY_ID.has(entry.muscleId!), entry.name.en).toBe(true);
    }
  });
});
