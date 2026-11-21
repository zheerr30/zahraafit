/**
 * The lightweight body for phones (pipeline/lite/body.mjs) is the same body as the full
 * one: every structure keeps its node, name and id, so selection, names and the muscle
 * explanations work unchanged. Only triangles are fewer and the download smaller.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MeshoptDecoder } from "meshoptimizer";
import { Box3, type Group, type Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MUSCLE_GROUPS } from "@/data/exercises/groups";
import { prepareRegionModel, type RegionModel } from "@/lib/region/backModel";

const PUBLIC = join(__dirname, "../public");
const file = (sex: string, part: string) => join(PUBLIC, `models/zanatomy/${sex}/${part}.glb`);

async function load(sex: string, part: string): Promise<Group> {
  const buf = readFileSync(file(sex, part));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  return gltf.scene;
}
const meshesOf = (scene: Group) => {
  const out = new Map<string, Mesh>();
  scene.traverse((o) => { if ((o as Mesh).isMesh) out.set(o.name, o as Mesh); });
  return out;
};

let full: Group, lite: Group;
let model: RegionModel;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  full = await load("male", "core-smooth");
  lite = await load("male", "core-lite");
  model = prepareRegionModel(await load("male", "core-lite"));
}, 240_000);

describe("lightweight body for phones", () => {
  it("is about a fifth of the full download, for both bodies", () => {
    for (const sex of ["male", "female"]) {
      const a = statSync(file(sex, "core-smooth")).size, b = statSync(file(sex, "core-lite")).size;
      expect(b, sex).toBeLessThan(7_000_000);
      expect(b / a, sex).toBeLessThan(0.26);
    }
  });

  it("keeps every structure: same nodes, names and ids as the full body", () => {
    const A = meshesOf(full), B = meshesOf(lite);
    expect([...B.keys()].sort()).toEqual([...A.keys()].sort());
    for (const [name, a] of A) {
      const b = B.get(name)!;
      for (const k of ["kind", "id", "side", "ar", "region"]) expect(b.userData[k], `${name}.${k}`).toEqual(a.userData[k]);
    }
  });

  it("keeps every structure in place and at its size (muscles within 5 mm, the rest within 12 mm)", () => {
    const A = meshesOf(full), B = meshesOf(lite);
    full.updateMatrixWorld(true);
    lite.updateMatrixWorld(true);
    const worst = { muscle: 0, other: 0 };
    for (const [name, a] of A) {
      const ba = new Box3().setFromObject(a), bb = new Box3().setFromObject(B.get(name)!);
      const d = Math.max(ba.min.distanceTo(bb.min), ba.max.distanceTo(bb.max));
      const k = a.userData.kind === "unit" || a.userData.kind === "tendon" ? "muscle" : "other";
      worst[k] = Math.max(worst[k], d);
    }
    expect(worst.muscle).toBeLessThan(0.0055);
    expect(worst.other).toBeLessThan(0.0125);
  });

  it("has far fewer triangles, and still every attribute the materials read", () => {
    const tri = (s: Group) => { let n = 0; s.traverse((o) => { const m = o as Mesh; if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; }); return n; };
    expect(tri(lite) / tri(full)).toBeLessThan(0.25);
    const A = meshesOf(full), B = meshesOf(lite);
    for (const [name, a] of A) expect(Object.keys(B.get(name)!.geometry.attributes).sort(), name).toEqual(Object.keys(a.geometry.attributes).sort());
  });

  it("the app finds every muscle of the exercise groups in it", () => {
    for (const g of MUSCLE_GROUPS) for (const u of g.units) expect(model.units.has(u), `${g.id}: ${u}`).toBe(true);
  });
});
