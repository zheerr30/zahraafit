// Lightweight body for phones — the same Z-Anatomy body as core-smooth.glb with fewer
// triangles: every node, name and `extras` (ids, Arabic names, regions) is kept, so the
// app selects, names and explains each muscle exactly as on the full model. Only the
// triangle count of each mesh is reduced (meshoptimizer's simplifier, attribute-aware:
// normals, the tendon mask, fibre direction and baked occlusion steer the collapse),
// and the attributes are stored with fewer bits.
//
// Output: public/models/zanatomy/<sex>/core-lite.glb + core-lite.json (what was reduced).
//
//   node pipeline/lite/body.mjs public/models/zanatomy male
import { writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, meshopt, prune, quantize } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const [root = "public/models/zanatomy", sex = "male"] = process.argv.slice(2);

// Share of the triangles kept, per kind of structure. Muscles carry the shape people look
// at; bones and deep sheets are mostly hidden under them.
const KEEP = { unit: 0.11, tendon: 0.14, bone: 0.06, ligament: 0.12, fascia: 0.1 };
// The abdominal wall keeps more of its triangles: the app opens the rectus sheath by
// leaving out the triangles of the oblique aponeuroses in front of the rectus
// (lib/three/abdomen.ts), and a coarse sheet gives that opening a ragged edge.
const DETAIL = /abdominal oblique|transversus abdominis|rectus abdominis|pyramidalis|linea alba|rectus sheath/i;
const DETAIL_KEEP = 0.5;
const OPEN_EDGE_KEPT = new Set(["unit", "tendon", "fascia"]);
const MIN_TRIANGLES = 160; // small meshes are left alone below this
const MAX_ERROR = 0.05; // of the mesh's own size: stop collapsing before the shape visibly changes
// metres: no surface moves further than this, however large the mesh (bones and deep sheets lie under the muscles)
const MAX_SHIFT = { unit: 0.005, tendon: 0.005 };
const MAX_SHIFT_OTHER = 0.012;
// How much each attribute resists a collapse across a change of its value.
const WEIGHT = { NORMAL: 0.5, _ANAT: 1.0, _FIBER: 0.05, COLOR_0: 0.1 };

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const t0 = Date.now();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(path.join(root, sex, "core-smooth.glb"));
await doc.transform(dequantize());

const report = { source: "core-smooth.glb", sex, keep: KEEP, kinds: {} };
const done = new Map(); // primitives sharing their vertices (left / right copies) are reduced once

// Vertices at the same place become one (the source repeats them along attribute seams,
// which stops the simplifier): their attributes are averaged, directions re-normalised.
const UNIT_LENGTH = new Set(["NORMAL", "_FIBER"]);
function weld(prim, positions, nv, indices) {
  const first = new Map();
  const rep = new Uint32Array(nv), count = new Uint16Array(nv);
  for (let i = 0; i < nv; i++) {
    const key = `${Math.round(positions[i * 3] * 2e5)},${Math.round(positions[i * 3 + 1] * 2e5)},${Math.round(positions[i * 3 + 2] * 2e5)}`;
    let r = first.get(key);
    if (r === undefined) first.set(key, (r = i));
    rep[i] = r;
    count[r]++;
  }
  if (first.size === nv) return;
  for (const s of prim.listSemantics()) {
    if (s === "POSITION") continue;
    const a = prim.getAttribute(s), n = a.getElementSize(), arr = Float32Array.from(a.getArray());
    for (let i = 0; i < nv; i++) if (rep[i] !== i) for (let c = 0; c < n; c++) arr[rep[i] * n + c] += arr[i * n + c];
    for (let i = 0; i < nv; i++) {
      if (rep[i] !== i || count[i] < 2) continue;
      let d = count[i];
      if (UNIT_LENGTH.has(s)) d = Math.hypot(arr[i * n], arr[i * n + 1], arr[i * n + 2]) || 1;
      for (let c = 0; c < n; c++) arr[i * n + c] /= d;
    }
    a.setArray(arr);
  }
  for (let i = 0; i < indices.length; i++) indices[i] = rep[indices[i]];
}

for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const kind = node.getExtras().kind ?? "other";
  const detail = DETAIL.test(node.getName()) || DETAIL.test(String(node.getExtras().za_name ?? ""));
  const keep = detail ? DETAIL_KEEP : (KEEP[kind] ?? 0.2);
  if (detail) (report.detail ??= []).push(node.getName());
  for (const prim of mesh.listPrimitives()) {
    const posAcc = prim.getAttribute("POSITION");
    const idxAcc = prim.getIndices();
    const k = (report.kinds[kind] ??= { meshes: 0, trianglesBefore: 0, trianglesAfter: 0, verticesBefore: 0, verticesAfter: 0 });
    k.meshes++;
    const cached = done.get(posAcc);
    if (cached) {
      for (const [s, a] of Object.entries(cached.attrs)) prim.setAttribute(s, a);
      prim.setIndices(cached.indices);
      k.trianglesBefore += cached.t0; k.trianglesAfter += cached.t1; k.verticesBefore += cached.v0; k.verticesAfter += cached.v1;
      continue;
    }
    const positions = posAcc.getArray();
    const nv = posAcc.getCount();
    const indices = idxAcc ? Uint32Array.from(idxAcc.getArray()) : Uint32Array.from({ length: nv }, (_, i) => i);
    const tris = indices.length / 3;
    weld(prim, positions, nv, indices);
    let out = indices;
    if (tris > MIN_TRIANGLES) {
      // attributes that steer the simplifier, packed side by side
      const sems = prim.listSemantics().filter((s) => WEIGHT[s]);
      const sizes = sems.map((s) => prim.getAttribute(s).getElementSize());
      const stride = sizes.reduce((a, b) => a + b, 0);
      const packed = new Float32Array(nv * stride);
      const weights = [];
      let off = 0;
      sems.forEach((s, j) => {
        const a = prim.getAttribute(s), arr = a.getArray(), n = sizes[j];
        for (let i = 0; i < nv; i++) for (let c = 0; c < n; c++) packed[i * stride + off + c] = arr[i * n + c];
        for (let c = 0; c < n; c++) weights.push(WEIGHT[s]);
        off += n;
      });
      // the open edge of a muscle or a sheet is where it meets its neighbour: it stays in place
      const flags = OPEN_EDGE_KEPT.has(kind) ? ["LockBorder"] : [];
      // error allowed: a share of the mesh's own size, and never more than MAX_SHIFT in the body
      let ext = 0;
      for (let c = 0; c < 3; c++) {
        let lo = Infinity, hi = -Infinity;
        for (let i = c; i < positions.length; i += 3) { const v = positions[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        ext = Math.max(ext, hi - lo);
      }
      const maxError = Math.min(MAX_ERROR, (MAX_SHIFT[kind] ?? MAX_SHIFT_OTHER) / (ext * Math.max(...node.getWorldScale()) || 1));
      const target = Math.max(MIN_TRIANGLES, Math.round(tris * keep)) * 3;
      const pos32 = positions instanceof Float32Array ? positions : Float32Array.from(positions);
      [out] = stride
        ? MeshoptSimplifier.simplifyWithAttributes(indices, pos32, 3, packed, stride, weights, null, target, maxError, flags)
        : MeshoptSimplifier.simplify(indices, pos32, 3, target, maxError, flags);
    }
    // drop the vertices no triangle uses any more
    const [remap, unique] = MeshoptSimplifier.compactMesh(out);
    const attrs = {};
    for (const s of prim.listSemantics()) {
      const a = prim.getAttribute(s), n = a.getElementSize(), src = a.getArray();
      const dst = new src.constructor(unique * n);
      for (let i = 0; i < nv; i++) {
        const r = remap[i];
        if (r === 0xffffffff) continue;
        for (let c = 0; c < n; c++) dst[r * n + c] = src[i * n + c];
      }
      const na = a.clone().setArray(dst);
      prim.setAttribute(s, na);
      attrs[s] = na;
    }
    const ni = (idxAcc ? idxAcc.clone() : doc.createAccessor().setType("SCALAR")).setArray(unique > 65535 ? out : Uint16Array.from(out));
    prim.setIndices(ni);
    const rec = { attrs, indices: ni, t0: tris, t1: out.length / 3, v0: nv, v1: unique };
    done.set(posAcc, rec);
    k.trianglesBefore += rec.t0; k.trianglesAfter += rec.t1; k.verticesBefore += rec.v0; k.verticesAfter += rec.v1;
  }
}

await doc.transform(
  prune(),
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeColor: 8, quantizeGeneric: 8 }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
const out = path.join(root, sex, "core-lite.glb");
await io.write(out, doc);
const sum = (f) => Object.values(report.kinds).reduce((s, k) => s + k[f], 0);
report.summary = {
  meshes: sum("meshes"),
  trianglesBefore: sum("trianglesBefore"), trianglesAfter: sum("trianglesAfter"),
  verticesBefore: sum("verticesBefore"), verticesAfter: sum("verticesAfter"),
  bytesBefore: statSync(path.join(root, sex, "core-smooth.glb")).size, bytesAfter: statSync(out).size,
};
writeFileSync(path.join(root, sex, "core-lite.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.summary));
console.log(`wrote ${out} (${(report.summary.bytesAfter / 1e6).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
