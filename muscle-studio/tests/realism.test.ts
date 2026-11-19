import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Vector3, type Group, type Mesh, type MeshPhysicalMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import { applyStyle, prepareRegionModel, refineReport, type RegionModel } from "@/lib/region/backModel";
import { dequantizeMesh } from "@/lib/three/anatomyModel";
import { refineGeometry, refineMeshInPlace, unrefineMeshInPlace } from "@/lib/three/refine";

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

describe("on-demand refinement can be released", () => {
  it("refine → unrefine restores the very same original geometry", () => {
    const mesh = findMesh(scene, /^Teres major muscle\.l$/).clone();
    mesh.geometry = mesh.geometry.clone();
    dequantizeMesh(mesh);
    const original = mesh.geometry;
    const tris = original.getIndex()!.count / 3;
    expect(refineMeshInPlace(mesh)).toBe(tris * 3);
    expect(mesh.geometry).not.toBe(original);
    expect(refineMeshInPlace(mesh)).toBe(0); // idempotent
    expect(unrefineMeshInPlace(mesh)).toBe(tris * 3);
    expect(mesh.geometry).toBe(original);
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

describe("editor in HD keeps the per-muscle colouring", () => {
  it("HD geometry prep + HD library: selecting a unit recolours only its own meshes", async () => {
    const { ANATOMY_ASSETS } = await import("@/data/models/manifest");
    const { prepareModel, mapPreparedModel, applyMaterials } = await import("@/lib/three/anatomyModel");
    const { MaterialLibrary } = await import("@/lib/three/materials");
    const { createDefaultDoc } = await import("@/lib/storage/schema");
    const { createEditorStore } = await import("@/stores/editorStore");
    const asset = ANATOMY_ASSETS.find((a) => a.gender === "female")!;
    const model = prepareModel(await load(asset.url), asset, { hd: true });
    const report = mapPreparedModel(model, asset, undefined);
    const muscles = model.meshes.filter((m) => m.geometry.getAttribute("_fiber"));
    expect(muscles.length).toBeGreaterThan(400);
    for (const m of muscles) expect(m.geometry.getAttribute("tangent")).toBeDefined();
    const library = new MaterialLibrary({ hd: true });
    const doc = createDefaultDoc("female");
    const highlight = library.muscle(doc.palette.primary, "highlight");
    expect((highlight as MeshPhysicalMaterial).userData.hd).toBe(true);
    for (const id of ["latissimus-dorsi", "gluteus-maximus", "infraspinatus"]) {
      const store = createEditorStore({ initialDoc: doc });
      store.getState().toggleMuscle(id);
      applyMaterials(model, report, { doc: store.getState().doc, hoveredMuscleId: null }, library);
      const own = new Set(report.byMuscle.get(id));
      const isHighlight = (m: (typeof model.meshes)[number]) => {
        const mat = m.material as MeshPhysicalMaterial;
        return mat === highlight || (mat.userData.hd && mat.name === highlight.name);
      };
      for (const mesh of model.meshes) expect(isHighlight(mesh), id).toBe(own.has(mesh.uuid));
    }
    library.dispose();
  }, 120_000);
});

describe("abdominal wall: rectus sheath from the oblique aponeuroses", () => {
  it("marks the external oblique over the rectus as sheath (+) and the internal oblique lamina as fused (−), both sides", () => {
    for (const side of ["l", "r"]) {
      const ext = hd.meshes.find((m) => m.kind === "unit" && /^External abdominal oblique/.test(m.meta.zaName) && m.side === side)!;
      const int = hd.meshes.find((m) => m.kind === "unit" && /^Internal abdominal oblique/.test(m.meta.zaName) && m.side === side)!;
      const count = (m: typeof ext, sign: number) => {
        const a = m.mesh.geometry.getAttribute("_sheath");
        let n = 0;
        for (let i = 0; i < a.count; i++) if (a.getX(i) * sign > 0.5) n++;
        return { n, total: a.count };
      };
      const e = count(ext, 1), i = count(int, -1);
      expect(e.n, `external ${side}`).toBeGreaterThan(300);
      expect(e.n / e.total).toBeLessThan(0.7); // the fleshy lateral part stays muscle
      expect(i.n, `internal ${side}`).toBeGreaterThan(100);
      expect((ext.mesh.material as MeshPhysicalMaterial).alphaToCoverage).toBe(true);
      // The anterior layer is opened in front of the rectus: no triangle of the external
      // oblique is left wholly inside the rectus outline (vertices themselves are kept).
      const sh = ext.mesh.geometry.getAttribute("_sheath"), idx = ext.mesh.geometry.index!;
      let inFront = 0, onRectus = 0;
      for (let v = 0; v < sh.count; v++) if (sh.getX(v) >= 1.999) onRectus++;
      for (let t = 0; t < idx.count; t += 3) if (sh.getX(idx.getX(t)) >= 1.999 && sh.getX(idx.getX(t + 1)) >= 1.999 && sh.getX(idx.getX(t + 2)) >= 1.999) inFront++;
      expect(onRectus, `sheath vertices kept ${side}`).toBeGreaterThan(300);
      expect(inFront, `opened ${side}`).toBe(0);
    }
  });
});

describe("muscle surface refinement (core-smooth) keeps the anatomy", () => {
  it("measured report: ≤ 2 mm, tendons and bone attachments fixed, smoother, both bodies", () => {
    for (const sex of ["male", "female"]) {
      const r = JSON.parse(readFileSync(join(PUBLIC, `models/zanatomy/${sex}/core-smooth.json`), "utf8"));
      expect(r.summary.muscles).toBe(466);
      expect(r.summary.maxDisplacementMm).toBeLessThanOrEqual(2.001);
      expect(r.summary.tendonMaxDisplacementMm).toBeLessThan(0.01);
      expect(r.summary.boneAttachmentMaxDisplacementMm).toBeLessThan(0.1);
      expect(r.summary.roughnessDegAfter).toBeLessThan(r.summary.roughnessDegBefore);
      for (const m of r.meshes) if (m.vertices > 800) expect(m.roughnessDegAfter, m.name).toBeLessThanOrEqual(m.roughnessDegBefore + 0.3);
    }
  });

  it("same nodes, names, ids, vertex and triangle counts as the original; only muscles moved", async () => {
    const smooth = await load("models/zanatomy/male/core-smooth.glb");
    const orig = new Map<string, Mesh>();
    scene.traverse((o) => { if ((o as Mesh).isMesh) orig.set(o.name, o as Mesh); });
    scene.updateMatrixWorld(true);
    smooth.updateMatrixWorld(true);
    let meshes = 0, movedMuscles = 0;
    const a = new Vector3();
    smooth.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      meshes++;
      const q = orig.get(m.name)!;
      expect(q, m.name).toBeDefined();
      expect(m.userData.id).toBe(q.userData.id);
      expect(m.userData.za_name).toBe(q.userData.za_name);
      const pa = m.geometry.getAttribute("position"), pb = q.geometry.getAttribute("position");
      expect(pa.count, m.name).toBe(pb.count);
      expect(m.geometry.index!.count, m.name).toBe(q.geometry.index!.count);
      // order-independent comparison (the files are re-indexed when compressed): centroid and bounds
      const stat = (mesh: Mesh) => {
        const p = mesh.geometry.getAttribute("position");
        const c = new Vector3(), lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
        for (let i = 0; i < p.count; i++) { a.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); c.add(a); lo.min(a); hi.max(a); }
        return { c: c.divideScalar(p.count), lo, hi };
      };
      const A = stat(m), B = stat(q);
      const shift = A.c.distanceTo(B.c), box = Math.max(A.lo.distanceTo(B.lo), A.hi.distanceTo(B.hi));
      if (m.userData.kind === "unit") {
        expect(shift, m.name).toBeLessThan(0.0021);
        expect(box, m.name).toBeLessThan(0.0036); // ≤ 2 mm per axis
        if (shift > 0.00002) movedMuscles++;
      } else {
        // every other tissue is where it was (quantisation only)
        expect(shift, m.name).toBeLessThan(0.00005);
        expect(box, m.name).toBeLessThan(0.0001);
      }
    });
    expect(meshes).toBe(orig.size);
    expect(movedMuscles).toBeGreaterThan(100);
  }, 180_000);
});
