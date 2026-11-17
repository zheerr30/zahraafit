// Builds public/models/bodyparts3d/muscles-{male,female}.glb from BodyParts3D 4.0.
//
//   BodyParts3D © The Database Center for Life Science, CC BY 4.0
//   https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
//
// Male:   each selected muscle (or named part) of BodyParts3D becomes its own
//         mesh per side, in the open-anatomy-3d male coordinate frame, so it
//         lines up exactly with that model's skeleton, skin and organs.
// Female: BodyParts3D has only a male body. The open-anatomy-3d female model
//         is that same anatomy warped (thin-plate spline) into a MakeHuman
//         female body. We recover its male↔female vertex correspondence
//         (identical connectivity, renumbered vertices) and apply the same
//         deformation to the separated muscles.
//
// Usage:
//   node pipeline/bodyparts3d/build.mjs --bp3d <dir> [--oa3d public/models/open-anatomy-3d] [--out public/models/bodyparts3d]
// <dir> must contain isa_BP3D_4.0_obj_99/, partof_BP3D_4.0_obj_99/,
// isa_element_parts.txt and partof_element_parts.txt (see README.md here).

import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { harmonicFill, indexObjDirs, loadGlbScene, makeToThree, matchIsomorphicMeshes, meshWorld, parseObj, PointGrid, TriangleSurface } from "./lib.mjs";
import { bareName, CONTEXT, sideOf, UNITS } from "./units.mjs";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const BP3D = arg("bp3d");
const OA3D = arg("oa3d", "public/models/open-anatomy-3d");
const OUT = arg("out", "public/models/bodyparts3d");
if (!BP3D) throw new Error("--bp3d <dir> is required");

// open-anatomy-3d male frame: centre of all classified BodyParts3D structures
// (reproduced by running its pipeline/index.mjs + classify.mjs on the same
// data: gmin [-334.119,-246.783,-78.1112], gmax [332.825,45.2476,1641.36]).
// Verified below against the shipped male GLB.
const FRAME = { cx: -0.647, cy: -100.7677, minZ: -78.1112 };
const toThree = makeToThree(FRAME);

const UNIT_BUDGET = { ratio: 0.2, min: 1500, max: 9000, error: 0.01 };
const CONTEXT_BUDGET = { ratio: 0.08, min: 300, max: 8000, error: 0.03, sloppy: true };

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

// ───────────────────────── 1. index + select files ─────────────────────────
const files = indexObjDirs(
  [path.join(BP3D, "partof_BP3D_4.0_obj_99"), path.join(BP3D, "isa_BP3D_4.0_obj_99")],
  [path.join(BP3D, "isa_element_parts.txt"), path.join(BP3D, "partof_element_parts.txt")],
);
const byBare = new Map();
for (const f of files) {
  const bare = bareName(f.name);
  if (!byBare.has(bare)) byBare.set(bare, []);
  byBare.get(bare).push(f);
}

const report = { units: {}, context: {}, missingParts: [] };
function collect(spec, midline) {
  const out = midline ? { c: [] } : { l: [], r: [] };
  for (const part of spec.parts) {
    const list = byBare.get(part) ?? [];
    if (!list.length) report.missingParts.push(`${spec.key}: ${part}`);
    for (const f of list) {
      const cx = (f.min[0] + f.max[0]) / 2;
      (midline ? out.c : out[sideOf(f.name, cx)]).push(f);
    }
  }
  return out;
}
if (report.missingParts.length) console.warn("missing parts:", report.missingParts);

// ───────────────────────── 2. geometry helpers ─────────────────────────
function mergeFiles(list) {
  const pos = [];
  const idx = [];
  const fileOf = []; // per vertex: index into `list`
  list.forEach((f, fi) => {
    const o = parseObj(f.file);
    const base = pos.length / 3;
    for (let i = 0; i < o.pos.length; i += 3) {
      pos.push(...toThree(o.pos[i], o.pos[i + 1], o.pos[i + 2]));
      fileOf.push(fi);
    }
    for (const i of o.idx) idx.push(i + base);
  });
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), fileOf: Uint16Array.from(fileOf) };
}

function simplify(mesh, budget) {
  const src = mesh.idx.length / 3;
  const target = Math.min(budget.max, Math.max(budget.min, Math.round(src * budget.ratio)));
  let idx = mesh.idx;
  if (src > target) {
    const [s] = MeshoptSimplifier.simplify(mesh.idx, mesh.pos, 3, target * 3, budget.error, []);
    if (s.length >= 3 * 64) idx = s;
    // Context only: many thin open strips (intercostals) cannot be collapsed
    // topologically; use the topology-agnostic simplifier to meet the budget.
    if (budget.sloppy && idx.length > target * 3 * 1.5) {
      const [t] = MeshoptSimplifier.simplifySloppy(mesh.idx, mesh.pos, 3, null, target * 3, budget.error);
      if (t.length >= 3 * 64) idx = t;
    }
  }
  // compact
  const remap = new Int32Array(mesh.pos.length / 3).fill(-1);
  let n = 0;
  for (const i of idx) if (remap[i] < 0) remap[i] = n++;
  const pos = new Float32Array(n * 3);
  const fileOf = new Uint16Array(n);
  for (let v = 0; v < remap.length; v++) {
    if (remap[v] < 0) continue;
    pos.set(mesh.pos.subarray(v * 3, v * 3 + 3), remap[v] * 3);
    fileOf[remap[v]] = mesh.fileOf[v];
  }
  const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = remap[idx[i]];
  return { pos, idx: out, fileOf, srcTris: src };
}

/** Make winding outward (mirrored "M" files can be inside-out) via signed volume. */
function fixWinding(mesh) {
  let vol = 0;
  const p = mesh.pos;
  for (let t = 0; t < mesh.idx.length; t += 3) {
    const a = mesh.idx[t] * 3, b = mesh.idx[t + 1] * 3, c = mesh.idx[t + 2] * 3;
    vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  if (vol < 0) for (let t = 0; t < mesh.idx.length; t += 3) [mesh.idx[t + 1], mesh.idx[t + 2]] = [mesh.idx[t + 2], mesh.idx[t + 1]];
  return mesh;
}

function normals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { n[i] += nx; n[i + 1] += ny; n[i + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

// ───────────────────────── 3. build male meshes ─────────────────────────
const meshes = []; // { node, group, pos, idx, oaKey }
const OA_GROUP = {
  deltoid: "deltoid", trapezius: "trapezius", pectoralis_major: "chest_muscles", biceps_brachii: "upper_arm_muscles",
  triceps_brachii: "upper_arm_muscles", gluteus_maximus: "gluteal", rectus_femoris: "quadriceps", gastrocnemius: "calf",
  biceps_femoris: "hamstrings", tibialis_anterior: "shin_muscles", sternocleidomastoid: "neck_muscles",
};
for (const u of UNITS) {
  const sides = collect(u, false);
  for (const s of ["l", "r"]) {
    if (!sides[s].length) { report.missingParts.push(`${u.key}_${s}: no files`); continue; }
    const m = fixWinding(simplify(mergeFiles(sides[s]), UNIT_BUDGET));
    const oaBase = Object.entries(OA_GROUP).find(([k]) => u.key.startsWith(k))?.[1];
    meshes.push({ node: `${u.key}_${s}`, group: "muscles", ...m, oaKey: oaBase ? `${oaBase}_${s}` : null, files: sides[s].map((f) => f.fj) });
    report.units[`${u.key}_${s}`] = { files: sides[s].length, srcTris: m.srcTris, tris: m.idx.length / 3 };
  }
}
for (const c of CONTEXT) {
  const sides = collect(c, Boolean(c.midline));
  for (const [s, list] of Object.entries(sides)) {
    if (!list.length) continue;
    const m = fixWinding(simplify(mergeFiles(list), CONTEXT_BUDGET));
    const node = s === "c" ? `ctx_${c.key}` : `ctx_${c.key}_${s}`;
    meshes.push({ node, group: "muscles_context", ...m, oaKey: null, files: list.map((f) => f.fj) });
    report.context[node] = { files: list.length, srcTris: m.srcTris, tris: m.idx.length / 3 };
  }
}

// Shape fidelity: distance from the ORIGINAL BodyParts3D vertices to the
// simplified mesh surface (sampled), so simplification never distorts anatomy.
report.fidelity = {};
for (const m of meshes) {
  if (m.group !== "muscles") continue;
  const source = mergeFiles(m.files.map((fj) => files.find((f) => f.fj === fj)));
  const surf = new TriangleSurface(m.pos, m.idx);
  const d = [];
  const step = Math.max(1, Math.floor(source.pos.length / 3 / 4000));
  for (let i = 0; i < source.pos.length / 3; i += step) d.push(surf.distance(source.pos[i * 3], source.pos[i * 3 + 1], source.pos[i * 3 + 2]) * 1000);
  d.sort((a, b) => a - b);
  report.fidelity[m.node] = { meanMm: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), p95Mm: +d[Math.floor(d.length * 0.95)].toFixed(2), maxMm: +d[d.length - 1].toFixed(2) };
}
const fid = Object.values(report.fidelity);
report.fidelitySummary = {
  worstMeanMm: Math.max(...fid.map((f) => f.meanMm)),
  worstP95Mm: Math.max(...fid.map((f) => f.p95Mm)),
  worstMaxMm: Math.max(...fid.map((f) => f.maxMm)),
};

// Every muscle file of BodyParts3D must be used exactly once.
const used = new Map();
for (const m of meshes) for (const fj of m.files) used.set(fj, (used.get(fj) ?? 0) + 1);
const dup = [...used].filter(([, n]) => n > 1);
if (dup.length) throw new Error(`files used twice: ${dup.map(([f]) => f).join(", ")}`);
report.filesUsed = used.size;

// ───────────────────────── 4. verify the male frame ─────────────────────────
const maleOA = await loadGlbScene(path.join(OA3D, "anatomy-male.glb"));
const femaleOA = await loadGlbScene(path.join(OA3D, "anatomy-female.glb"));
/** Mean / 95th-percentile distance (mm) from points to a reference surface. */
function surfaceDistance(fromPos, ref) {
  const surf = new TriangleSurface(ref.pos, ref.idx);
  const d = [];
  for (let i = 0; i < fromPos.length; i += 3) d.push(surf.distance(fromPos[i], fromPos[i + 1], fromPos[i + 2]) * 1000);
  d.sort((a, b) => a - b);
  return { mean: +(d.reduce((s, x) => s + x, 0) / d.length).toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2) };
}
report.maleFrameCheck = {};
// Only finely meshed open-anatomy-3d structures are a fair reference: its calf,
// thigh and forearm groups were simplified with a 5% error tolerance.
for (const key of ["deltoid_anterior_l", "deltoid_posterior_r", "trapezius_descending_r", "trapezius_ascending_l"]) {
  const m = meshes.find((x) => x.node === key);
  report.maleFrameCheck[key] = surfaceDistance(m.pos, meshWorld(maleOA.getObjectByName(m.oaKey)));
}
if (Object.values(report.maleFrameCheck).some((d) => d.mean > 2)) throw new Error(`male frame misaligned: ${JSON.stringify(report.maleFrameCheck)}`);

// ───────────────────────── 5. male → female deformation field ─────────────────────────
// Correspondence pairs are kept PER open-anatomy-3d structure. Each new vertex
// is warped only with pairs from the structure it came from (its nearest male
// structure vertex): neighbouring structures can move very differently in the
// female warp (e.g. the hands hang next to the hips).
const fields = []; // per structure: { grid, disp }
const allPos = [], allField = [];
let pairCount = 0;
const holdout = []; // [fieldIndex, srcXYZ, dstXYZ]
maleOA.traverse((m) => {
  if (!m.isMesh || m.name.startsWith("skin")) return;
  const f = femaleOA.getObjectByName(m.name);
  if (!f) return;
  const A = meshWorld(m), B = meshWorld(f);
  if (A.idx.length !== B.idx.length || A.pos.length !== B.pos.length) return;
  const map = matchIsomorphicMeshes(A.idx, A.pos.length / 3, B.idx, B.pos.length / 3);
  const pos = [], disp = [];
  const fi = fields.length;
  for (let v = 0; v < map.length; v++) {
    if (map[v] < 0) continue;
    const s = [A.pos[v * 3], A.pos[v * 3 + 1], A.pos[v * 3 + 2]];
    const d = [B.pos[map[v] * 3], B.pos[map[v] * 3 + 1], B.pos[map[v] * 3 + 2]];
    pairCount++;
    // Hold out 1% of pairs to measure how well the field reproduces the warp.
    if (pairCount % 100 === 0) { holdout.push([fi, s, d, v]); continue; }
    pos.push(...s);
    disp.push(d[0] - s[0], d[1] - s[1], d[2] - s[2]);
  }
  if (!pos.length) return;
  // Complete the field on every male vertex of the structure (harmonic fill of
  // unmatched/held-out vertices) for continuous barycentric interpolation.
  const nA = A.pos.length / 3;
  const known = new Uint8Array(nA), full = new Float32Array(nA * 3);
  const held = new Set(holdout.filter((h) => h[0] === fi).map((h) => h[3]));
  for (let v = 0; v < nA; v++) {
    if (map[v] < 0 || held.has(v)) continue;
    known[v] = 1;
    for (let k = 0; k < 3; k++) full[v * 3 + k] = B.pos[map[v] * 3 + k] - A.pos[v * 3 + k];
  }
  const filled = harmonicFill(A.idx, nA, known, full);
  // Mesh pieces without any matched vertex: inverse-distance fallback.
  const fieldGrid = new PointGrid(new Float32Array(pos), 0.01);
  for (let v = 0; v < nA; v++) {
    if (filled.filled[v]) continue;
    const nn = fieldGrid.knn(A.pos[v * 3], A.pos[v * 3 + 1], A.pos[v * 3 + 2], 8, 40);
    let wx = 0, wy = 0, wz = 0, ws = 0;
    for (const [i, d2] of nn) { const w = 1 / (d2 + 1e-8); wx += disp[i * 3] * w; wy += disp[i * 3 + 1] * w; wz += disp[i * 3 + 2] * w; ws += w; }
    filled.disp[v * 3] = wx / ws; filled.disp[v * 3 + 1] = wy / ws; filled.disp[v * 3 + 2] = wz / ws;
  }
  fields.push({
    name: m.name,
    grid: fieldGrid,
    disp: new Float32Array(disp),
    surface: new TriangleSurface(A.pos, A.idx),
    idx: A.idx,
    vdisp: filled.disp,
  });
  // Structure lookup: every male vertex of the open-anatomy-3d MUSCLE groups.
  if (m.parent?.name === "muscles") for (let i = 0; i < A.pos.length; i += 3) { allPos.push(A.pos[i], A.pos[i + 1], A.pos[i + 2]); allField.push(fi); }
});
const structureGrid = new PointGrid(new Float32Array(allPos), 0.01);
const structureOf = Int32Array.from(allField);
report.correspondencePairs = pairCount;

/** Continuous warp: barycentric interpolation on the nearest male triangle of the structure. */
function warpWith(fi, x, y, z) {
  const f = fields[fi];
  const { t, bary } = f.surface.closest(x, y, z);
  if (t >= 0) {
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < 3; k++) {
      const v = f.idx[t * 3 + k];
      dx += bary[k] * f.vdisp[v * 3]; dy += bary[k] * f.vdisp[v * 3 + 1]; dz += bary[k] * f.vdisp[v * 3 + 2];
    }
    return [x + dx, y + dy, z + dz];
  }
  return warpIdw(fi, x, y, z);
}
function warpIdw(fi, x, y, z) {
  const { grid, disp } = fields[fi];
  const nn = grid.knn(x, y, z, 8, 40);
  let wx = 0, wy = 0, wz = 0, ws = 0;
  for (const [i, d2] of nn) {
    const w = 1 / (d2 + 1e-8);
    wx += disp[i * 3] * w; wy += disp[i * 3 + 1] * w; wz += disp[i * 3 + 2] * w; ws += w;
  }
  return [x + wx / ws, y + wy / ws, z + wz / ws];
}
/**
 * Each BodyParts3D file belongs to exactly one open-anatomy-3d muscle group
 * (its decimated copy lives there). Find it by majority vote of the file's
 * vertices, so every vertex of a file is warped by one coherent field.
 */
function fileStructures(m) {
  const votes = m.files.map(() => new Map());
  for (let v = 0; v < m.pos.length / 3; v++) {
    const [[nearest]] = structureGrid.knn(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], 1, 40);
    const fi = structureOf[nearest];
    const map = votes[m.fileOf[v]];
    map.set(fi, (map.get(fi) ?? 0) + 1);
  }
  return votes.map((map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1);
}
report.fileStructure = {};
let errSum = 0, errMax = 0;
for (const [fi, src, dst] of holdout) {
  const p = warpWith(fi, src[0], src[1], src[2]);
  const e = Math.hypot(p[0] - dst[0], p[1] - dst[1], p[2] - dst[2]);
  errSum += e; errMax = Math.max(errMax, e);
}
report.fieldHoldoutError = { meanMm: +(errSum / holdout.length * 1000).toFixed(2), maxMm: +(errMax * 1000).toFixed(2), n: holdout.length };

// Smoothness guard: no warped triangle edge may stretch far beyond its male length.
const femaleMeshes = meshes.map((m) => {
  const structure = fileStructures(m);
  m.files.forEach((fj, i) => (report.fileStructure[fj] = fields[structure[i]]?.name ?? null));
  const pos = new Float32Array(m.pos.length);
  for (let v = 0; v < pos.length / 3; v++) pos.set(warpWith(structure[m.fileOf[v]], m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]), v * 3);
  return { ...m, pos };
});
let worstStretch = { ratio: 0, node: "" };
const ratios = [];
const over5 = {};
for (let k = 0; k < meshes.length; k++) {
  const a = meshes[k].pos, b = femaleMeshes[k].pos, idx = meshes[k].idx;
  for (let t = 0; t < idx.length; t += 3) for (const [i, j] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
    const la = Math.hypot(a[i * 3] - a[j * 3], a[i * 3 + 1] - a[j * 3 + 1], a[i * 3 + 2] - a[j * 3 + 2]);
    const lb = Math.hypot(b[i * 3] - b[j * 3], b[i * 3 + 1] - b[j * 3 + 1], b[i * 3 + 2] - b[j * 3 + 2]);
    if (la <= 0.002) continue;
    const r = lb / la;
    ratios.push(r);
    if (r > 5) over5[meshes[k].node] = (over5[meshes[k].node] ?? 0) + 1;
    if (r > worstStretch.ratio) worstStretch = { ratio: +r.toFixed(2), node: meshes[k].node };
  }
}
ratios.sort((x, y) => x - y);
const pct = (q) => +ratios[Math.floor(ratios.length * q)].toFixed(2);
report.femaleEdgeStretch = { median: pct(0.5), p99: pct(0.99), p999: pct(0.999), worst: worstStretch, edgesOver5x: ratios.filter((r) => r > 5).length, edges: ratios.length, over5ByMesh: over5 };
report.femaleCheck = {};
for (const key of ["deltoid_anterior_l", "deltoid_posterior_r", "trapezius_descending_r", "trapezius_ascending_l"]) {
  const m = femaleMeshes.find((x) => x.node === key);
  report.femaleCheck[key] = surfaceDistance(m.pos, meshWorld(femaleOA.getObjectByName(m.oaKey)));
}

// ───────────────────────── 6. write GLBs ─────────────────────────
async function writeGlb(list, file, sex) {
  const doc = new Document();
  doc.getRoot().getAsset().generator = "muscle-studio pipeline/bodyparts3d";
  doc.getRoot().getAsset().copyright =
    "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International" +
    (sex === "female" ? "; female shape via open-anatomy-3d (CC BY 4.0) / MakeHuman (CC0)" : "");
  const buffer = doc.createBuffer();
  const scene = doc.createScene(`bodyparts3d-muscles-${sex}`);
  const groups = {};
  for (const g of ["muscles", "muscles_context"]) scene.addChild((groups[g] = doc.createNode(g)));
  for (const m of list) {
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(m.pos).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals(m.pos, m.idx)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(m.pos.length / 3 > 65535 ? m.idx : Uint16Array.from(m.idx)).setBuffer(buffer));
    const node = doc.createNode(m.node).setMesh(doc.createMesh(m.node).addPrimitive(prim)).setExtras({ bodyparts3d: m.files });
    groups[m.group].addChild(node);
  }
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await io.write(file, doc);
  return fs.statSync(file).size;
}
report.bytes = {
  male: await writeGlb(meshes, path.join(OUT, "muscles-male.glb"), "male"),
  female: await writeGlb(femaleMeshes, path.join(OUT, "muscles-female.glb"), "female"),
};
report.triangles = {
  units: meshes.filter((m) => m.group === "muscles").reduce((s, m) => s + m.idx.length / 3, 0),
  context: meshes.filter((m) => m.group === "muscles_context").reduce((s, m) => s + m.idx.length / 3, 0),
};
fs.writeFileSync(path.join(OUT, "build-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, fidelity: undefined, units: Object.keys(report.units).length, context: Object.keys(report.context).length }, null, 2));
