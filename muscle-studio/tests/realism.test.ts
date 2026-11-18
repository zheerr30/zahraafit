import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Group, Mesh, MeshPhysicalMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import { applyStyle, prepareRegionModel, refineReport, type RegionModel } from "@/lib/region/backModel";
import { dequantizeMesh } from "@/lib/three/anatomyModel";
import { refineGeometry } from "@/lib/three/refine";

const PUBLIC = join(__dirname, "../public");

async function load(url: string): Promise<Group> {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(PUBLIC, url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  return gltf.scene;
}

let scene: Group;
let hd: RegionModel;

beforeAll(async () => {
  scene = await load("models/zanatomy/male/core.glb");
  hd = prepareRegionModel(await load("models/zanatomy/male/core.glb"), { hd: true, refineRegions: new Set(["back", "shoulders"]) });
}, 300_000);

function findMesh(root: Group, source: RegExp): Mesh {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (!found && (o as Mesh).isMesh && source.test((o.userData.za_name as string) ?? "")) found = o as Mesh;
  });
  if (!found) throw new Error(`no mesh ${source}`);
  return found;
}

describe("PN surface refinement keeps the anatomy", () => {
  it("keeps every original vertex, splits each triangle in four, bounds the new vertices, leaves no cracks", () => {
    for (const name of [/^Infraspinatus muscle\.l$/, /^Latissimus dorsi muscle\.l$/, /^Descending part of trapezius muscle\.l$/]) {
      const mesh = findMesh(scene, name).clone();
      mesh.geometry = mesh.geometry.clone();
      dequantizeMesh(mesh);
      const src = mesh.geometry;
      const { geometry: g, stats } = refineGeometry(src);
      const P0 = src.getAttribute("position"), P1 = g.getAttribute("position");
      // 1. original vertices: identical positions
      for (let i = 0; i < P0.count; i++) {
        expect(P1.getX(i)).toBe(P0.getX(i));
        expect(P1.getY(i)).toBe(P0.getY(i));
        expect(P1.getZ(i)).toBe(P0.getZ(i));
      }
      // 2. ×4 triangles
      expect(g.getIndex()!.count).toBe(src.getIndex()!.count * 4);
      // 3. new vertices stay close to the straight edge (≤ 20 % of the edge, and small in absolute terms)
      expect(stats.maxOffset).toBeLessThanOrEqual(0.0005 + 1e-9);
      expect(stats.meanOffset).toBeLessThan(0.0004);
      // 4. watertight where the source is: every position-keyed edge of the refined mesh
      //    is shared by the same number of triangles as in the source (no T-junctions / cracks).
      const key = (P: typeof P1, i: number) => `${Math.round(P.getX(i) * 1e6)},${Math.round(P.getY(i) * 1e6)},${Math.round(P.getZ(i) * 1e6)}`;
      const boundary = (geom: typeof g) => {
        const P = geom.getAttribute("position") as typeof P1;
        const I = geom.getIndex()!;
        const count = new Map<string, number>();
        for (let t = 0; t < I.count; t += 3) {
          const v = [I.getX(t), I.getX(t + 1), I.getX(t + 2)].map((i) => key(P, i));
          for (const [a, b] of [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]]) {
            const k = a < b ? `${a}|${b}` : `${b}|${a}`;
            count.set(k, (count.get(k) ?? 0) + 1);
          }
        }
        let open = 0;
        for (const c of count.values()) if (c === 1) open++;
        return open;
      };
      // each open source edge becomes exactly two open edges; no new openings
      expect(boundary(g)).toBe(boundary(src) * 2);
    }
  });

  it("is applied to the back & shoulder muscles only, in HD mode", () => {
    expect(refineReport.meshes).toBeGreaterThan(40);
    expect(refineReport.trianglesAfter).toBe(refineReport.trianglesBefore * 4);
    expect(refineReport.maxOffsetMm).toBeLessThanOrEqual(0.5 + 1e-6);
    const refined = hd.meshes.filter((m) => m.kind === "unit" && (m.region === "back" || m.region === "shoulders"));
    const other = hd.meshes.filter((m) => m.kind === "unit" && m.region === "thigh");
    for (const m of refined) expect(m.mesh.geometry.getAttribute("tangent"), m.meta.zaName).toBeDefined();
    const plain = prepareRegionModel(scene);
    const tris = (model: RegionModel, ids: Set<string>) => model.meshes.filter((m) => m.kind === "unit" && ids.has(`${m.id}:${m.side}:${m.meta.zaName}`)).reduce((a, m) => a + m.mesh.geometry.getIndex()!.count / 3, 0);
    const otherIds = new Set(other.map((m) => `${m.id}:${m.side}:${m.meta.zaName}`));
    expect(tris(hd, otherIds)).toBe(tris(plain, otherIds));
  });
});

describe("HD materials keep the interaction", () => {
  it("every structure gets an HD material; selection recolours with the highlight colour", () => {
    for (const m of hd.meshes) expect((m.mesh.material as MeshPhysicalMaterial).userData.hd, m.meta.zaName).toBe(true);
    const unit = hd.meshes.find((m) => m.kind === "unit" && m.id === "infraspinatus" && m.side === "l")!;
    const sel = { kind: "unit" as const, id: "infraspinatus", side: "l" as const, ar: "", en: "" };
    for (const m of hd.meshes) applyStyle(m, sel, null, "#173F8A");
    expect((unit.mesh.material as MeshPhysicalMaterial).color.getHexString()).toBe("173f8a");
    for (const m of hd.meshes) applyStyle(m, null, null, "#173F8A");
    expect((unit.mesh.material as MeshPhysicalMaterial).color.getHexString()).not.toBe("173f8a");
  });
});
