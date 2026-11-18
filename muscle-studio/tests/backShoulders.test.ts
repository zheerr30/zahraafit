import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import { REGION_MUSCLES } from "@/data/region/backShoulders";
import { applyStyle, GHOST, prepareRegionModel, shouldShow, targetOpacity, type RegionModel } from "@/lib/region/backModel";
import { DEFAULT_LAYERS, type PickedStructure } from "@/stores/backStore";
import { UNITS } from "../pipeline/zanatomy/back-config.mjs";

const DIR = join(__dirname, "../public/models/back-shoulders");
const report = JSON.parse(readFileSync(join(DIR, "build-report-za.json"), "utf8"));
let model: RegionModel;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(DIR, "back-shoulders-za.glb"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  model = prepareRegionModel(gltf.scene);
}, 120_000);

const base = { layers: { ...DEFAULT_LAYERS }, hiddenUnits: {}, depthMode: "all" as const, isolate: false, selected: null };

describe("back & shoulders model (Z-Anatomy)", () => {
  it("contains every requested muscle as separate meshes on both sides", () => {
    expect(REGION_MUSCLES.map((m) => m.id).sort()).toEqual(UNITS.map((u: { id: string }) => u.id).sort());
    for (const m of REGION_MUSCLES) {
      const meshes = model.byUnit.get(m.id)!.filter((x) => x.kind === "unit");
      expect(new Set(meshes.map((x) => x.side)), m.id).toEqual(new Set(["l", "r"]));
      for (const x of meshes) {
        expect(x.mesh.geometry.getAttribute("_anat"), m.id).toBeDefined();
        expect(x.mesh.geometry.getAttribute("_fiber"), m.id).toBeDefined();
      }
    }
    expect(report.structures).toEqual({ unit: 48, context: 84, bone: 119, attachment: 112, tendon: 40, nerve: 56 });
  });

  it("keeps the original Z-Anatomy geometry and metadata", () => {
    // Triangle totals of the Blender export (asserted per structure by the post-process).
    expect(report.triangles.unit).toBe(210746);
    for (const m of model.meshes.filter((x) => x.kind === "unit")) {
      expect(m.meta.zaName, m.id).toMatch(/muscle|scapulae/);
      expect(m.meta.hierarchy[0], m.meta.zaName).toBe("Muscular system");
      expect(m.meta.ta2, m.meta.zaName).toBeGreaterThan(0);
      expect(m.meta.latin, m.meta.zaName).toMatch(/^(Musculus|Pars|Levator)/);
    }
    const lat = model.meshes.find((x) => x.meta.zaName === "Latissimus dorsi muscle.l")!;
    expect(lat.meta.ta2).toBe(2231);
    expect(lat.meta.materials).toEqual(["Adductor", "Tendon"]);
    expect(lat.mesh.geometry.index!.count / 3).toBe(21580);
  });

  it("uses the author's tendon faces where the source has them", () => {
    for (const n of ["Latissimus dorsi muscle.l", "Transverse part of trapezius muscle.l", "Rhomboid major muscle.l", "Levator scapulae.l"]) {
      expect(report.tendonSource[n], n).toMatch(/^author/);
    }
    expect(report.tendonSource["Supraspinatus muscle.l"]).toBe("thickness");
  });

  it("has the requested bones, tendons and peripheral nerves", () => {
    const names = (kind: string) => new Set(model.meshes.filter((m) => m.kind === kind).map((m) => m.id));
    const bones = names("bone");
    for (const b of ["Scapula", "Clavicle", "Humerus", "Vertebra_T1", "Vertebra_T12", "First_rib", "Twelfth_rib"]) expect(bones.has(b), b).toBe(true);
    const nerves = names("nerve");
    for (const n of ["Accessory_nerve_(XI)", "Suprascapular_nerve", "Axillary_nerve", "Dorsal_scapular_nerve", "Thoracodorsal_nerve", "Inferior_subscapular_nerve"]) expect(nerves.has(n), n).toBe(true);
    const tendons = names("tendon");
    for (const t of ["Articular_capsule_of_glenohumeral_joint", "Posterior_layer_of_thoracolumbar_fascia", "Nuchal_ligament"]) expect(tendons.has(t), t).toBe(true);
  });

  it("labels the trapezius parts by position (Z-Anatomy names them the other way round)", () => {
    const [upper, middle, lower] = report.checks.trapeziusCentreY;
    expect(upper).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(lower);
    expect(report.attachments["trapezius-upper"]["insertion:l"].join()).toMatch(/Clavicle/);
  });

  it("puts the rotator cuff insertions on the humerus and origins on the scapula", () => {
    for (const id of ["supraspinatus", "infraspinatus", "teres-minor", "subscapularis"]) {
      expect(report.attachments[id]["origin:l"].join(), id).toMatch(/Scapula/);
      expect(report.attachments[id]["insertion:l"].join(), id).toMatch(/Humerus/);
    }
  });

});

describe("layer logic", () => {
  const unit = (id: string, side = "l") => model.meshes.find((m) => m.kind === "unit" && m.id === id && m.side === side)!;
  it("hides only the superficial layer, then everything but the deep muscles", () => {
    expect(shouldShow(unit("latissimus-dorsi"), { ...base, depthMode: "no-superficial" })).toBe(false);
    expect(shouldShow(unit("rhomboid-major"), { ...base, depthMode: "no-superficial" })).toBe(true);
    expect(shouldShow(unit("rhomboid-major"), { ...base, depthMode: "deep" })).toBe(false);
    expect(shouldShow(unit("erector-spinae"), { ...base, depthMode: "deep" })).toBe(true);
  });

  it("hides one muscle independently", () => {
    const s = { ...base, hiddenUnits: { "teres-major": true as const } };
    expect(shouldShow(unit("teres-major"), s)).toBe(false);
    expect(shouldShow(unit("teres-minor"), s)).toBe(true);
  });

  it("isolates the selected muscle with the skeleton", () => {
    const sel: PickedStructure = { kind: "unit", id: "infraspinatus", side: "l", ar: "", en: "" };
    const s = { ...base, isolate: true, selected: sel };
    const solid = model.meshes.filter((m) => targetOpacity(m, s) === 1);
    expect(new Set(solid.map((m) => m.kind))).toEqual(new Set(["unit", "bone", "attachment"]));
    expect(new Set(solid.filter((m) => m.kind !== "bone").map((m) => m.id))).toEqual(new Set(["infraspinatus"]));
    // the surrounding anatomy stays visible as a ghost
    const ghost = model.meshes.filter((m) => targetOpacity(m, s) === GHOST);
    expect(ghost.some((m) => m.id === "deltoid-posterior")).toBe(true);
    expect(ghost.some((m) => m.kind === "context")).toBe(true);
  });

  it("colours the selected muscle (custom colour) on both sides", () => {
    const sel: PickedStructure = { kind: "unit", id: "deltoid-lateral", side: "l", ar: "", en: "" };
    for (const m of model.meshes) applyStyle(m, sel, null, "#173F8A");
    for (const side of ["l", "r"]) {
      const mat = unit("deltoid-lateral", side).mesh.material as unknown as { color: { getHexString(): string } };
      expect(mat.color.getHexString()).toBe("173f8a");
    }
    for (const m of model.meshes) applyStyle(m, sel, null);
    for (const side of ["l", "r"]) {
      const mat = unit("deltoid-lateral", side).mesh.material as unknown as { color: { getHexString(): string } };
      expect(mat.color.getHexString()).toBe("e8602c");
    }
    const other = unit("deltoid-anterior").mesh.material as unknown as { color: { getHexString(): string } };
    expect(other.color.getHexString()).not.toBe("e8602c");
  });
});
