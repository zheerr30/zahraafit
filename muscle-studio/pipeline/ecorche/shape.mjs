// Skin and clothing of the Écorché body with its body shapes as morph targets.
//
// The purchased model's skin has a thin and an overweight shape for each sex (one control,
// "Weight", from −1 to +1), and its garments follow with fits of their own. This builds
// public/models/ecorche/<sex>/skin-morph.glb and skin-morph-lite.glb: the skin and the
// garments of the atlas's skin layer (same materials, same names, the skin under the cloth
// cut away as there) with two morph targets, in this order:
//     0  "thin"         the model's <Sex>-Thin shape        (Weight −1)
//     1  "overweight"   the model's <Sex>-Overweight shape  (Weight +1)
// Each target carries positions and normals. One of the two is used at a time (the model
// has no mix of them): influence = −Weight for thin, +Weight for overweight.
//
// The eyes of the body's own file are added (without them the lids open on nothing).
//
// Input: the three builds dumped by pipeline/ecorche/shape_dump.py into
// <work>/shape-<sex>/{base,thin,over}, the body's manifest <work>/<sex>/manifest.json (for the
// pubic bone), and the atlas's own skin and body files, whose materials and eyes are reused.
// The atlas itself does not load these files: they are for the ZahraaFit app's body-shape view.
//
//   ECORCHE_SHAPE=/path/to/work node pipeline/ecorche/shape.mjs male|female [out dir]
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { copyToDocument, meshopt, prune, quantize } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";

const sex = process.argv[2] ?? "female";
const WORK = process.env.ECORCHE_SHAPE;
if (!WORK) throw new Error("set ECORCHE_SHAPE");
const MODELS = process.env.ECORCHE_MODELS ?? "public/models/ecorche";
const OUT = process.argv[3] ?? path.join(MODELS, sex);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
export const TARGETS = ["thin", "overweight"];
const GARMENTS = new Set(["Underwear", "Female-Clothes"]);
const LITE_KEEP = 0.55, BODY_PIECE = 1500;

const load = (build) => {
  const dir = path.join(WORK, `shape-${sex}`, build), bin = readFileSync(path.join(dir, "geometry.bin"));
  const f32 = (off, n) => new Float32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * 4));
  const u32 = (off, n) => new Uint32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * 4));
  return JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")).records.map((r) => ({ name: r.name, n: r.vertices, pos: f32(r.position, r.vertices * 3), nrm: f32(r.normal, r.vertices * 3), uv: f32(r.uv, r.vertices * 2), idx: u32(r.index, r.triangles * 3) }));
};
const base = load("base"), thin = load("thin"), over = load("over");

/**
 * Triangles of the skin that are not under a garment. The rule is the atlas's: what the
 * cloth covers on the base shape is cut away (the genital area and the nipples are not in
 * the file). One exception: on the overweight body the briefs lie lower under the belly, and
 * a band of the lower belly that the cloth covers on the base shape comes into view — those
 * triangles (covered on the base shape, uncovered on another, and in the belly band above
 * the pubic bone only) are kept, so no shape shows a hole.
 */
function coveredBy(body, garments) {
  const covered = new Uint8Array(body.n), ray = new Ray(), p = new Vector3(), n = new Vector3();
  for (const g of garments) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(g.pos, 3));
    geo.setIndex(new BufferAttribute(g.idx, 1));
    const bvh = new MeshBVH(geo);
    for (let i = 0; i < body.n; i++) {
      if (covered[i]) continue;
      p.fromArray(body.pos, i * 3); n.fromArray(body.nrm, i * 3);
      ray.origin.copy(p).addScaledVector(n, -0.004); ray.direction.copy(n);
      if (bvh.raycastFirst(ray, DoubleSide, 0, 0.044)) covered[i] = 1;
    }
  }
  return covered;
}
function uncovered(bodies, garmentSets, belly) {
  const body = bodies[0], shapes = bodies.map((b, s) => coveredBy(b, garmentSets[s])), onBase = shapes[0];
  const inBelly = (i) => body.pos[i * 3 + 1] > belly[0] && body.pos[i * 3 + 1] < belly[1];
  let kept = [], back = 0;
  for (let t = 0; t < body.idx.length; t += 3) {
    const v = [body.idx[t], body.idx[t + 1], body.idx[t + 2]];
    if (!v.every((i) => onBase[i])) { kept.push(t); continue; }
    if (v.every(inBelly) && shapes.some((c) => !v.every((i) => c[i]))) { kept.push(t); back++; }
  }
  console.log(`${sex}: ${back} belly triangles kept for the shapes in which the cloth leaves them uncovered`);
  // connected pieces: the trunk and the legs stay, small loose bits inside the covered zone go
  const key = (i) => `${Math.round(body.pos[i * 3] * 1e5)},${Math.round(body.pos[i * 3 + 1] * 1e5)},${Math.round(body.pos[i * 3 + 2] * 1e5)}`;
  const id = new Map(), parent = [];
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const node = (i) => { const k = key(i); let v = id.get(k); if (v === undefined) { v = parent.length; id.set(k, v); parent.push(v); } return v; };
  for (const t of kept) { const a = find(node(body.idx[t])); parent[find(node(body.idx[t + 1]))] = a; parent[find(node(body.idx[t + 2]))] = a; }
  const size = new Map();
  for (const t of kept) { const r = find(node(body.idx[t])); size.set(r, (size.get(r) ?? 0) + 1); }
  kept = kept.filter((t) => size.get(find(node(body.idx[t]))) >= BODY_PIECE);
  const out = new Uint32Array(kept.length * 3);
  kept.forEach((t, k) => { out[k * 3] = body.idx[t]; out[k * 3 + 1] = body.idx[t + 1]; out[k * 3 + 2] = body.idx[t + 2]; });
  return out;
}

/** Corners that are the same vertex (place, normal and texture coordinate, in every shape) become one; unused ones go. */
function compact(r, idx, shapes) {
  const first = new Map(), map = new Int32Array(r.n).fill(-1), keep = [];
  const q = (v, s) => Math.round(v * s);
  const out = new Uint32Array(idx.length);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (map[i] < 0) {
      const key = `${q(r.pos[i * 3], 1e5)},${q(r.pos[i * 3 + 1], 1e5)},${q(r.pos[i * 3 + 2], 1e5)}|${q(r.nrm[i * 3], 500)},${q(r.nrm[i * 3 + 1], 500)},${q(r.nrm[i * 3 + 2], 500)}|${q(r.uv[i * 2], 1e4)},${q(r.uv[i * 2 + 1], 1e4)}`;
      let v = first.get(key);
      if (v === undefined) { v = keep.length; first.set(key, v); keep.push(i); }
      map[i] = v;
    }
    out[k] = map[i];
  }
  const take = (a, m) => { const o = new Float32Array(keep.length * m); keep.forEach((i, k) => { for (let c = 0; c < m; c++) o[k * m + c] = a[i * m + c]; }); return o; };
  const uv = take(r.uv, 2);
  for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i]; // image space: v runs downward
  return { n: keep.length, idx: out, pos: take(r.pos, 3), nrm: take(r.nrm, 3), uv, shapes: shapes.map((s) => ({ pos: take(s.pos, 3), nrm: take(s.nrm, 3) })) };
}
/** Fewer triangles (vertices stay where they are, so the shapes stay valid), then unused vertices dropped. */
function lighter(m, ratio) {
  const target = Math.floor((m.idx.length / 3) * ratio) * 3;
  const [idx] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.004, []);
  const map = new Int32Array(m.n).fill(-1), keep = [], out = new Uint32Array(idx.length);
  for (let k = 0; k < idx.length; k++) { const i = idx[k]; if (map[i] < 0) { map[i] = keep.length; keep.push(i); } out[k] = map[i]; }
  const take = (a, c) => { const o = new Float32Array(keep.length * c); keep.forEach((i, k) => { for (let j = 0; j < c; j++) o[k * c + j] = a[i * c + j]; }); return o; };
  return { n: keep.length, idx: out, pos: take(m.pos, 3), nrm: take(m.nrm, 3), uv: take(m.uv, 2), shapes: m.shapes.map((s) => ({ pos: take(s.pos, 3), nrm: take(s.nrm, 3) })) };
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const bodyOf = (set) => set.find((r) => r.name === "Body"), garmentsOf = (set) => set.filter((r) => GARMENTS.has(r.name));
// the belly band: from 3 cm above the top of the pubic bone to 22 cm higher (below the chest)
const bones = JSON.parse(readFileSync(path.join(WORK, sex, "manifest.json"), "utf8")).records.filter((r) => r.name === "Pubic_symphysis");
if (!bones.length) throw new Error("pubic bone not found in the body's manifest");
const pubis = Math.max(...bones.map((r) => r.max[1]));
const cut = uncovered([base, thin, over].map(bodyOf), [base, thin, over].map(garmentsOf), [pubis + 0.03, pubis + 0.25]);
for (const lite of [false, true]) {
  // the atlas's skin file: its materials, textures and node metadata are kept, the geometry replaced
  const doc = await io.read(path.join(MODELS, sex, `skin${lite ? "-lite" : ""}.glb`));
  const buffer = doc.getRoot().listBuffers()[0];
  const report = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = node.getName().replace(/_m$/, ""), r = base.find((x) => x.name.replace(/[^A-Za-z0-9]+/g, "_") === name);
    if (!r) throw new Error(`no shape data for ${node.getName()}`);
    const at = (set) => set.find((x) => x.name === r.name);
    let m = compact(r, r.name === "Body" ? cut : r.idx, [at(thin), at(over)]);
    if (lite) m = lighter(m, LITE_KEEP);
    const old = mesh.listPrimitives()[0], material = old.getMaterial();
    const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
    const prim = doc.createPrimitive().setMaterial(material)
      .setAttribute("POSITION", acc("VEC3", m.pos)).setAttribute("NORMAL", acc("VEC3", m.nrm)).setAttribute("TEXCOORD_0", acc("VEC2", m.uv))
      .setIndices(acc("SCALAR", m.idx));
    let most = [0, 0];
    m.shapes.forEach((s, k) => {
      const dp = new Float32Array(m.n * 3), dn = new Float32Array(m.n * 3);
      for (let i = 0; i < m.n * 3; i++) { dp[i] = s.pos[i] - m.pos[i]; dn[i] = s.nrm[i] - m.nrm[i]; }
      for (let i = 0; i < m.n; i++) most[k] = Math.max(most[k], Math.hypot(dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2]));
      prim.addTarget(doc.createPrimitiveTarget(TARGETS[k]).setAttribute("POSITION", acc("VEC3", dp)).setAttribute("NORMAL", acc("VEC3", dn)));
    });
    mesh.removePrimitive(old); old.dispose();
    // (the node carried the old geometry's de-quantization transform: the new geometry is in metres)
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    mesh.addPrimitive(prim).setWeights([0, 0]).setExtras({ ...mesh.getExtras(), targetNames: TARGETS });
    node.setExtras({ ...node.getExtras(), morphs: TARGETS });
    report.push(`${node.getName()}: ${m.n} vertices, ${m.idx.length / 3} triangles; moves up to ${(most[0] * 100).toFixed(1)} cm (thin), ${(most[1] * 100).toFixed(1)} cm (overweight)`);
  }
  // the eyes (they are in the body's own file in the atlas): without them the lids open on nothing
  const core = await io.read(path.join(MODELS, sex, `core${lite ? "-lite" : ""}.glb`));
  const eyes = core.getRoot().listNodes().filter((n) => n.getMesh() && n.getExtras().id === "Eyeball");
  if (!eyes.length) throw new Error("eyes not found in the body's file");
  const copied = copyToDocument(doc, core, eyes);
  for (const n of eyes) doc.getRoot().listScenes()[0].addChild(copied.get(n));
  // one buffer for the file
  for (const b of doc.getRoot().listBuffers()) if (b !== buffer) { for (const acc of doc.getRoot().listAccessors()) if (acc.getBuffer() === b) acc.setBuffer(buffer); b.dispose(); }
  report.push(`${eyes.length} eye meshes (no shapes: they stay in place)`);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  await doc.transform(prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  const file = path.join(OUT, `skin-morph${lite ? "-lite" : ""}.glb`);
  await io.write(file, doc);
  console.log(`${file} (${(statSync(file).size / 1e6).toFixed(2)} MB)\n  ${report.join("\n  ")}`);
}
