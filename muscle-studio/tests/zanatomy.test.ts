import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Vector3, type Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import { TARGET_COVERAGE } from "@/data/muscles/coverage";
import { LEGACY_GROUP_IDS, MUSCLES, MUSCLES_BY_ID } from "@/data/muscles/muscles";
import { ANATOMY_ASSETS } from "@/data/models/manifest";
import { REGION_MUSCLES } from "@/data/region/backShoulders";
import type { MappingReport } from "@/lib/anatomy/resolver";
import { applyStyle, GHOST, prepareRegionModel, REGIONS, shouldShow, targetOpacity, type RegionModel } from "@/lib/region/backModel";
import { DEFAULT_LAYERS as EDITOR_LAYERS, createDefaultDoc } from "@/lib/storage/schema";
import { applyLayers, applyMaterials, isPickable, mapPreparedModel, prepareModel, type PreparedModel } from "@/lib/three/anatomyModel";
import { MaterialLibrary } from "@/lib/three/materials";
import { DEFAULT_LAYERS, type PickedStructure } from "@/stores/backStore";
import { createEditorStore } from "@/stores/editorStore";
import { UNITS as DETAIL_UNITS } from "../pipeline/zanatomy/back-config.mjs";
import { EDITOR_UNITS } from "../pipeline/zanatomy/editor-units.mjs";

const PUBLIC = join(__dirname, "../public");
const report = JSON.parse(readFileSync(join(PUBLIC, "models/zanatomy/build-report.json"), "utf8"));

async function load(url: string): Promise<Group> {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(PUBLIC, url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  return gltf.scene;
}

const editor: Record<string, { model: PreparedModel; report: MappingReport }> = {};
const atlas: Record<string, RegionModel> = {};

beforeAll(async () => {
  for (const asset of ANATOMY_ASSETS) {
    const model = prepareModel(await load(asset.url), asset);
    applyLayers(model, EDITOR_LAYERS);
    editor[asset.gender] = { model, report: mapPreparedModel(model, asset, undefined) };
    atlas[asset.gender] = prepareRegionModel(await load(asset.url));
  }
}, 300_000);

describe("full-body Z-Anatomy build", () => {
  it("keeps the original geometry and reports every structure", () => {
    expect(report.counts.core).toBeGreaterThan(1300);
    expect(report.checks.missingArabic).toEqual([]);
    const [upper, middle, lower] = report.checks.trapeziusCentreY;
    expect(upper).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(lower);
    expect(report.files["male/core.glb"].triangles).toBeGreaterThan(3_300_000);
    expect(report.files["female/core.glb"].triangles).toBe(report.files["male/core.glb"].triangles);
  });

  it("covers all ten study regions with independent muscles", () => {
    for (const r of REGIONS) expect(report.regions[r.id], r.id).toBeGreaterThan(0);
    expect(report.depthCounts["1"]).toBeGreaterThan(50);
    expect(report.depthCounts["2"] + report.depthCounts["3"]).toBeGreaterThan(50);
  });

  it("fits the female variant to the skeleton (approximation, labelled)", () => {
    expect(report.femaleAlignment.meanMm).toBeLessThan(6);
    expect(report.femaleWarp.note).toMatch(/approximation/);
  });
});

describe.each(["male", "female"])("%s editor body", (gender) => {
  it("maps every editor unit to its meshes on both sides", () => {
    const { model, report: r } = editor[gender];
    expect(Object.keys(EDITOR_UNITS).sort()).toEqual(MUSCLES.map((m) => m.meshNames[0]).sort());
    expect(r.unmapped.map((u) => u.name)).toEqual([]);
    expect(r.missingMuscles).toEqual([]);
    for (const muscle of MUSCLES) {
      const uids = r.byMuscle.get(muscle.id) ?? [];
      const sides = new Set(uids.map((u) => r.byMesh.get(u)!.side));
      expect(sides, muscle.id).toEqual(new Set(["left", "right"]));
      for (const uid of uids) {
        const mesh = model.meshByUid.get(uid)!;
        const c = mesh.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(mesh.matrixWorld);
        if (r.byMesh.get(uid)!.side === "left") expect(c.x, muscle.id).toBeGreaterThan(0);
        else expect(c.x, muscle.id).toBeLessThan(0);
      }
    }
  });

  it("shows muscles, tendons and the skull at start; fasciae hidden; context never painted", () => {
    const { model, report: r } = editor[gender];
    for (const mesh of model.meshes) {
      const sys = model.systemOf.get(mesh.uuid);
      if (sys === "fasciae") expect(mesh.parent?.visible ?? true).toBe(false);
      if (sys === "muscles_context") expect(r.byMesh.has(mesh.uuid)).toBe(false);
      if (sys === "skeleton" && mesh.userData.kind === "bone" && /^Frontal_bone|^Mandible|^Femur/.test(mesh.userData.source)) {
        expect(mesh.visible, mesh.userData.source).toBe(mesh.userData.source !== "Femur");
      }
    }
    expect(model.meshes.some((m) => isPickable(m) && model.systemOf.get(m.uuid) === "muscles")).toBe(true);
  });

  it("selecting each unit recolours only its own meshes", () => {
    const { model, report: r } = editor[gender];
    const library = new MaterialLibrary();
    const doc = createDefaultDoc(gender as "male" | "female");
    const highlight = library.muscle(doc.palette.primary, "highlight");
    for (const muscle of MUSCLES) {
      const store = createEditorStore({ initialDoc: doc });
      store.getState().toggleMuscle(muscle.id);
      applyMaterials(model, r, { doc: store.getState().doc, hoveredMuscleId: null }, library);
      const own = new Set(r.byMuscle.get(muscle.id));
      for (const mesh of model.meshes) expect(mesh.material === highlight, muscle.id).toBe(own.has(mesh.uuid));
    }
    library.dispose();
  });
});

describe.each(["male", "female"])("%s atlas body", (gender) => {
  it("every muscle is selectable, named in Arabic and carries appearance data", () => {
    const m = atlas[gender];
    expect(m.units.size).toBeGreaterThan(200);
    for (const x of m.meshes.filter((y) => y.kind === "unit")) {
      expect(x.ar, x.meta.zaName).toMatch(/[؀-ۿ]/);
      expect(x.mesh.geometry.getAttribute("_anat"), x.meta.zaName).toBeDefined();
      const f = x.mesh.geometry.getAttribute("_fiber");
      expect(Math.hypot(f.getX(0), f.getY(0), f.getZ(0)), x.meta.zaName).toBeCloseTo(1, 1);
      expect(x.meta.hierarchy[0]).toBe("Muscular system");
    }
    for (const u of REGION_MUSCLES) expect(m.units.has(u.id), u.id).toBe(true);
    expect(REGION_MUSCLES.map((x) => x.id).sort()).toEqual(DETAIL_UNITS.map((x: { id: string }) => x.id).sort());
  });

  it("layer, depth and isolation logic", () => {
    const m = atlas[gender];
    const base = { layers: { ...DEFAULT_LAYERS }, hiddenUnits: {}, depthMode: "all" as const, isolate: false, selected: null };
    const unit = (id: string) => m.meshes.find((x) => x.kind === "unit" && x.id === id && x.side === "l")!;
    expect(unit("latissimus-dorsi").depth).toBe(1);
    expect(unit("subscapularis").depth).toBeGreaterThan(1);
    expect(shouldShow(unit("latissimus-dorsi"), { ...base, depthMode: "no-superficial" })).toBe(false);
    expect(shouldShow(unit("teres-major"), { ...base, hiddenUnits: { "teres-major": true } })).toBe(false);
    for (const x of m.meshes.filter((y) => y.kind === "fascia")) expect(shouldShow(x, base)).toBe(false);
    const sel: PickedStructure = { kind: "unit", id: "infraspinatus", side: "l", ar: "", en: "" };
    const s = { ...base, isolate: true, selected: sel };
    expect(new Set(m.meshes.filter((x) => targetOpacity(x, s) === 1 && x.kind === "unit").map((x) => x.id))).toEqual(new Set(["infraspinatus"]));
    expect(m.meshes.some((x) => x.id === "deltoid-posterior" && targetOpacity(x, s) === GHOST)).toBe(true);
    for (const x of m.meshes) applyStyle(x, sel, null, "#173F8A");
    expect((unit("infraspinatus").mesh.material as unknown as { color: { getHexString(): string } }).color.getHexString()).toBe("173f8a");
  });
});

describe("data consistency", () => {
  it("coverage table: all 32 target muscles are available", () => {
    expect(TARGET_COVERAGE).toHaveLength(32);
    expect(TARGET_COVERAGE.filter((c) => c.status === "missing")).toEqual([]);
    for (const entry of TARGET_COVERAGE) for (const id of entry.muscleIds) expect(MUSCLES_BY_ID.has(id), id).toBe(true);
  });

  it("legacy group ids expand only to existing units", () => {
    for (const ids of Object.values(LEGACY_GROUP_IDS)) for (const id of ids) expect(MUSCLES_BY_ID.has(id), id).toBe(true);
  });
});
