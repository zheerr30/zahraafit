// Web post-process of the Blender export (export_back.py). Geometry is NOT
// changed: no simplification, no subdivision, no welding of the output — every
// vertex and triangle of the export is kept (asserted below). It only:
//  1. merges the primitives of each structure (one per Blender material slot)
//     into one primitive, keeping the author's face materials as data:
//       muscles: _ANAT.y = author's "Tendon" faces (fraction at a vertex)
//       bones:   COLOR_0  = bone ivory / articular cartilage
//  2. bakes per-vertex appearance for the muscle shader (ambient occlusion,
//     fibre direction from the authored tendons) — see ../bodyparts3d/bake.mjs;
//  3. maps Z-Anatomy objects to the app's units and assigns origin/insertion
//     to the attachment patches;
//  4. compresses (quantization + meshopt).
//
//   node --max-old-space-size=12000 pipeline/blender/postprocess.mjs <back-raw.glb> <definitions.json> <out dir>
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, prune, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { bakeAppearance } from "../bodyparts3d/bake.mjs";
import { TriangleSurface } from "../bodyparts3d/lib.mjs";
import { BONES, CONTEXT_MUSCLES, NERVES, TENDONS, UNITS } from "../zanatomy/back-config.mjs";

const [rawPath, defsPath, outDir] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(rawPath);
const root = doc.getRoot();
const us = (s) => s.replace(/ /g, "_");
const AR = { ...CONTEXT_MUSCLES, ...TENDONS, ...NERVES, ...BONES };
const unitById = new Map(UNITS.map((u) => [u.id, u]));
const report = { source: "Z-Anatomy Startup.blend via Blender export (export_back.py)", triangles: {}, structures: {}, attachments: {}, tendonSource: {}, checks: {} };

// ───────── 1. read every structure (world-space, identity transforms) ─────────
const items = [];
for (const node of root.listNodes()) {
  const x = node.getExtras();
  const mesh = node.getMesh();
  if (!mesh || !x?.kind || x.kind === "group") continue;
  const prims = mesh.listPrimitives();
  let nV = 0, nI = 0;
  for (const p of prims) { nV += p.getAttribute("POSITION").getCount(); nI += p.getIndices().getCount(); }
  const pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3), idx = new Uint32Array(nI);
  const faceMat = new Uint8Array(nI / 3); // per triangle: 1 = Tendon / Cartilage
  const vMat = new Uint8Array(nV);
  let vo = 0, io2 = 0;
  for (const p of prims) {
    const P = p.getAttribute("POSITION"), N = p.getAttribute("NORMAL"), I = p.getIndices();
    const flag = /^(Tendon|Cartilage)/.test(p.getMaterial()?.getName() ?? "") ? 1 : 0;
    const tmp = [0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) {
      pos.set(P.getElement(i, tmp), (vo + i) * 3);
      nrm.set(N ? N.getElement(i, tmp) : [0, 1, 0], (vo + i) * 3);
      vMat[vo + i] = flag;
    }
    for (let i = 0; i < I.getCount(); i++) idx[io2 + i] = I.getScalar(i) + vo;
    faceMat.fill(flag, io2 / 3, (io2 + I.getCount()) / 3);
    vo += P.getCount();
    io2 += I.getCount();
  }
  const matrix = node.getWorldMatrix();
  if (matrix.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-9)) throw new Error(`non-identity transform on ${x.za_name}`);
  items.push({ node, mesh, x, pos, nrm, idx, faceMat, vMat, tris: nI / 3, material: prims[0].getMaterial() });
}

// ───────── 2. identity in the app (kinds, units, Arabic names) ─────────
const unitOfMesh = new Map(UNITS.flatMap((u) => u.meshes.map((m) => [m.replace(/_/g, " "), u])));
for (const it of items) {
  const { x } = it;
  it.kind = x.kind;
  it.side = x.side;
  it.base = x.za_base;
  if (x.kind === "unit") it.unit = unitOfMesh.get(x.za_base).id;
}
// Trapezius parts are named the other way round in Z-Anatomy; the config maps
// them by position — verify that the order really is upper > middle > lower.
const cy = (id) => { let s = 0, n = 0; for (const it of items) if (it.unit === id && it.side === "l") for (let i = 1; i < it.pos.length; i += 3) { s += it.pos[i]; n++; } return s / n; };
const ty = ["trapezius-upper", "trapezius-middle", "trapezius-lower"].map(cy);
if (!(ty[0] > ty[1] && ty[1] > ty[2])) throw new Error(`trapezius order ${ty}`);
report.checks.trapeziusCentreY = ty.map((v) => +v.toFixed(3));

// ───────── 3. attachments: owner unit and role ─────────
const family = (id) => id.split("-")[0];
const surf = new Map();
const unitSurface = (id, side) => {
  const k = `${id}|${side}`;
  if (!surf.has(k)) surf.set(k, items.filter((m) => m.unit === id && m.side === side).map((m) => new TriangleSurface(m.pos, m.idx)));
  return surf.get(k);
};
const meanDist = (surfaces, pos) => {
  const n = pos.length / 3, step = Math.max(1, Math.floor(n / 24));
  let d = 0, c = 0;
  for (let i = 0; i < n; i += step) { d += Math.min(...surfaces.map((s) => s.distance(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))); c++; }
  return d / c;
};
const extraAttachments = [];
for (const it of items.filter((m) => m.kind === "attachment")) {
  const muscle = it.x.muscle;
  const direct = UNITS.filter((u) => u.meshes.map((m) => m.replace(/_/g, " ")).includes(muscle));
  const alias = UNITS.filter((u) => u.patches.map((m) => m.replace(/_/g, " ")).includes(muscle));
  let owners = alias;
  if (direct.length) {
    const sib = UNITS.filter((u) => family(u.id) === family(direct[0].id));
    owners = [sib.length > 1 ? sib.map((u) => [u, meanDist(unitSurface(u.id, it.side), it.pos)]).sort((a, b) => a[1] - b[1])[0][0] : direct[0]];
  }
  const boneBase = it.x.bone.replace(/\.[lr]$/, "").replace(/\.\d+$/, "");
  const roleOf = (u) => (u.insertionBones ? (u.insertionBones.some((b) => us(boneBase).includes(b)) ? "insertion" : "origin") : it.x.suffix === "e" ? "insertion" : "origin");
  it.unit = owners[0].id;
  it.role = roleOf(owners[0]);
  it.boneBase = boneBase;
  for (const u of owners.slice(1)) extraAttachments.push({ ...it, unit: u.id, role: roleOf(u), shared: true });
  for (const u of owners) {
    const r = (report.attachments[u.id] ??= {});
    (r[`${roleOf(u)}:${it.side}`] ??= []).push(`${boneBase} ← ${it.x.za_name}`);
  }
}

// ───────── 4. appearance bake on welded connectivity ─────────
console.time("bake");
const tissue = items.filter((m) => m.kind === "unit" || m.kind === "context");
const welded = tissue.map((m) => {
  const map = new Map(), remap = new Uint32Array(m.pos.length / 3), wp = [];
  for (let v = 0; v < remap.length; v++) {
    const k = `${Math.round(m.pos[v * 3] * 1e6)},${Math.round(m.pos[v * 3 + 1] * 1e6)},${Math.round(m.pos[v * 3 + 2] * 1e6)}`;
    let j = map.get(k);
    if (j === undefined) { j = wp.length / 3; map.set(k, j); wp.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); }
    remap[v] = j;
  }
  const n = wp.length / 3;
  const idx = Uint32Array.from(m.idx, (i) => remap[i]);
  const nrm = new Float32Array(n * 3), tend = new Float32Array(n), cnt = new Float32Array(n);
  for (let v = 0; v < remap.length; v++) for (let k = 0; k < 3; k++) nrm[remap[v] * 3 + k] += m.nrm[v * 3 + k];
  for (let v = 0; v < n; v++) { const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1; for (let k = 0; k < 3; k++) nrm[v * 3 + k] /= l; }
  for (let t = 0; t < m.faceMat.length; t++) for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; tend[v] += m.faceMat[t]; cnt[v] += 1; }
  for (let v = 0; v < n; v++) tend[v] = cnt[v] ? tend[v] / cnt[v] : 0;
  const share = m.faceMat.reduce((a, b) => a + b, 0) / m.faceMat.length;
  // The author's tendon faces are used wherever they exist; muscles without
  // any (rotator cuff, erector spinae) fall back to the thickness detection.
  const authored = share > 0.005;
  report.tendonSource[`${m.x.za_name}`] = authored ? `author ${(share * 100).toFixed(1)}%` : "thickness";
  return { pos: new Float32Array(wp), idx, nrm, remap, ...(authored ? { tendonOverride: tend } : {}) };
});
const baked = bakeAppearance(welded);
tissue.forEach((m, i) => {
  const { remap } = welded[i];
  m.anat = new Float32Array(remap.length * 2);
  m.fibre = new Float32Array(remap.length * 3);
  for (let v = 0; v < remap.length; v++) {
    m.anat.set(baked[i].anat.subarray(remap[v] * 2, remap[v] * 2 + 2), v * 2);
    m.fibre.set(baked[i].fibre.subarray(remap[v] * 3, remap[v] * 3 + 3), v * 3);
  }
});
console.timeEnd("bake");

// ───────── 5. rebuild one primitive per structure; extras for the app ─────────
const buffer = root.listBuffers()[0];
const BONE_RGB = [0.89, 0.86, 0.78], CART_RGB = [0.78, 0.84, 0.86];
function writeItem(it, node) {
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(it.pos).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(it.nrm).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(it.pos.length / 3 > 65535 ? it.idx : Uint16Array.from(it.idx)).setBuffer(buffer))
    .setMaterial(it.material);
  if (it.anat) {
    prim.setAttribute("_ANAT", doc.createAccessor().setType("VEC2").setArray(it.anat).setBuffer(buffer));
    prim.setAttribute("_FIBER", doc.createAccessor().setType("VEC3").setArray(it.fibre).setBuffer(buffer));
  }
  if (it.kind === "bone" && it.vMat.some((f) => f)) {
    const col = new Float32Array(it.vMat.length * 3);
    for (let v = 0; v < it.vMat.length; v++) col.set(it.vMat[v] ? CART_RGB : BONE_RGB, v * 3);
    prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(col).setBuffer(buffer));
  }
  const mesh = doc.createMesh(node.getName()).addPrimitive(prim);
  node.setMesh(mesh);
  const id = it.kind === "unit" || it.kind === "attachment" ? it.unit : us(it.base);
  const ar = it.kind === "unit" || it.kind === "attachment" ? undefined : AR[us(it.base)];
  node.setExtras({
    // app schema
    kind: it.kind,
    id,
    side: it.side,
    source: us(it.base),
    ...(ar ? { ar } : {}),
    ...(it.kind === "unit" ? { depth: unitById.get(it.unit).depth } : {}),
    ...(it.kind === "attachment" ? { role: it.role, bone: us(it.boneBase), shared: !!it.shared } : {}),
    // preserved Z-Anatomy metadata
    za_name: it.x.za_name,
    hierarchy: JSON.parse(it.x.hierarchy),
    system: it.x.system,
    materials: JSON.parse(it.x.materials),
    ...(it.x.ta2_id ? { ta2: it.x.ta2_id, latin: it.x.latin } : {}),
    ...(it.x.definition ? { definition: it.x.definition } : {}),
  });
  report.triangles[it.kind] = (report.triangles[it.kind] ?? 0) + it.idx.length / 3;
}
for (const it of items) {
  const old = it.mesh;
  writeItem(it, it.node);
  old.dispose();
  if (it.tris !== it.idx.length / 3) throw new Error(`triangle count changed: ${it.x.za_name}`);
}
// Patch nodes are children of their bone in the export; move them next to the
// bone (same group) so quantization transforms never stack. The relationship
// is kept in extras.bone.
for (const it of items.filter((m) => m.kind === "attachment")) {
  const parent = it.node.getParentNode();
  if (parent?.getMesh()) {
    const grand = parent.getParentNode();
    parent.removeChild(it.node);
    grand.addChild(it.node);
  }
}
// An attachment shared by several units (the deltoid insertion) is written once
// more per extra owner, next to the original.
for (const it of extraAttachments) {
  const n = doc.createNode(`${it.node.getName()}|${it.unit}`);
  it.node.getParentNode()?.addChild(n);
  writeItem(it, n);
}
for (const n of root.listNodes()) {
  if (n.getMesh() || n.getExtras()?.kind !== "group") continue;
  const x = n.getExtras();
  n.setExtras({ kind: "group", hierarchy: typeof x.hierarchy === "string" ? JSON.parse(x.hierarchy) : x.hierarchy });
}
report.structures = Object.fromEntries(["unit", "context", "bone", "attachment", "tendon", "nerve"].map((k) => [k, items.filter((m) => m.kind === k).length]));
report.trianglesTotal = Object.values(report.triangles).reduce((a, b) => a + b, 0);

// ───────── 6. compress & write ─────────
doc.getRoot().getAsset().copyright =
  "Z-Anatomy (Gauthier Kervyn et al., https://github.com/Z-Anatomy/Models-of-human-anatomy) CC BY-SA 4.0, based on BodyParts3D (c) DBCLS. " +
  "Region export & web post-process by MUSCLE STUDIO 3D, CC BY-SA 4.0.";
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await doc.transform(prune(), reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeColor: 8 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "back-shoulders-za.glb");
await io.write(out, doc);
report.bytes = fs.statSync(out).size;
// Definitions (Wikipedia text via Z-Anatomy, CC BY-SA 3.0) for the exported structures.
const defs = JSON.parse(fs.readFileSync(defsPath, "utf8"));
fs.writeFileSync(path.join(outDir, "definitions.json"), JSON.stringify(defs));
fs.writeFileSync(path.join(outDir, "build-report-za.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ bytes: report.bytes, triangles: report.triangles, total: report.trianglesTotal, structures: report.structures, trapezius: report.checks.trapeziusCentreY }));
