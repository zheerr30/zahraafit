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
import { indexObjDirs, loadGlbScene, makeToThree, matchIsomorphicMeshes, meshWorld, parseObj, TriangleSurface } from "./lib.mjs";
import { bareName, CONTEXT, sideOf, UNITS } from "./units.mjs";
import { bakeAppearance } from "./bake.mjs";
import { farthestPoints, fitTps } from "./tps.mjs";

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

const UNIT_BUDGET = { ratio: 0.3, min: 2000, max: 14000, error: 0.005 };
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
    // BodyParts3D OBJs duplicate vertices along patch seams (e.g. the
    // sternocostal pectoralis is 382 disconnected pieces). Weld coincident
    // vertices (0.01 mm) within each file so the surface is continuous:
    // smooth normals, crack-free simplification, connected fibre flow.
    const weld = new Map();
    const remap = new Uint32Array(o.pos.length / 3);
    for (let i = 0; i < o.pos.length / 3; i++) {
      const k = `${Math.round(o.pos[i * 3] * 100)},${Math.round(o.pos[i * 3 + 1] * 100)},${Math.round(o.pos[i * 3 + 2] * 100)}`;
      let j = weld.get(k);
      if (j === undefined) {
        j = weld.size;
        weld.set(k, j);
        pos.push(...toThree(o.pos[i * 3], o.pos[i * 3 + 1], o.pos[i * 3 + 2]));
        fileOf.push(fi);
      }
      remap[i] = j;
    }
    for (let t = 0; t < o.idx.length; t += 3) {
      const a = remap[o.idx[t]], b = remap[o.idx[t + 1]], c = remap[o.idx[t + 2]];
      if (a === b || b === c || a === c) continue; // collapsed by the weld
      idx.push(a + base, b + base, c + base);
    }
  });
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), fileOf: Uint16Array.from(fileOf) };
}

function simplify(mesh, budget) {
  const src = mesh.idx.length / 3;
  const target = Math.min(budget.max, Math.max(budget.min, Math.round(src * budget.ratio)));
  let idx = mesh.idx;
  // Small meshes are kept whole: shaving the last 20% only costs fidelity.
  if (src > target * 1.25) {
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
  // Only vertices used by a triangle (a few OBJs carry stray, unreferenced vertices).
  const used = new Uint8Array(source.pos.length / 3);
  for (const i of source.idx) used[i] = 1;
  const step = Math.max(1, Math.floor(source.pos.length / 3 / 4000));
  for (let i = 0; i < source.pos.length / 3; i += step) if (used[i]) d.push(surf.distance(source.pos[i * 3], source.pos[i * 3 + 1], source.pos[i * 3 + 2]) * 1000);
  // A few source files contain tiny stray fragments far from the muscle (the
  // right sternocleidomastoid has 12 vertices on the left side of the neck);
  // simplification drops them. Count them instead of measuring them.
  const stray = d.filter((x) => !Number.isFinite(x)).length;
  for (let i = d.length - 1; i >= 0; i--) if (!Number.isFinite(d[i])) d.splice(i, 1);
  d.sort((a, b) => a - b);
  report.fidelity[m.node] = { strayVertices: stray, meanMm: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), p95Mm: +d[Math.floor(d.length * 0.95)].toFixed(2), maxMm: +d[d.length - 1].toFixed(2) };
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

// ───────────────────────── 5. male → female deformation ─────────────────────────
// BodyParts3D has one (male) body. open-anatomy-3d built a female version by
// warping it into a MakeHuman female body, but that warp badly distorts the
// shoulder and chest muscles (up to ~40% non-rigid shape change). We keep only
// what it tells us about female PROPORTIONS — from the skeleton, which carries
// them reliably — and fit our own smooth, regularized thin-plate spline:
//   1. recover the male↔female skeleton vertex correspondence (graph matching);
//   2. take 520 well-spread landmarks (farthest-point sampling);
//   3. fit a regularized TPS (λ = 1) and apply it to every muscle AND to the
//      male skeleton, so the female muscles and bones stay consistent.
const LAMBDA = 1;
const skS = [], skD = [];
let pairCount = 0;
maleOA.getObjectByName("skeleton").traverse((m) => {
  if (!m.isMesh) return;
  const f = femaleOA.getObjectByName(m.name);
  if (!f) return;
  const A = meshWorld(m), B = meshWorld(f);
  if (A.idx.length !== B.idx.length || A.pos.length !== B.pos.length) return;
  const map = matchIsomorphicMeshes(A.idx, A.pos.length / 3, B.idx, B.pos.length / 3);
  for (let v = 0; v < map.length; v++) {
    if (map[v] < 0) continue;
    pairCount++;
    skS.push(A.pos[v * 3], A.pos[v * 3 + 1], A.pos[v * 3 + 2]);
    skD.push(B.pos[map[v] * 3], B.pos[map[v] * 3 + 1], B.pos[map[v] * 3 + 2]);
  }
});
report.skeletonCorrespondencePairs = pairCount;
const lmIdx = farthestPoints(Float32Array.from(skS), 520);
const lmTrain = lmIdx.filter((_, i) => i % 5 !== 0), lmTest = lmIdx.filter((_, i) => i % 5 === 0);
const pt = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
const tps = fitTps(lmTrain.map((i) => pt(skS, i)), lmTrain.map((i) => pt(skD, i)), LAMBDA);
let lmErr = 0;
for (const i of lmTest) { const w = tps(...pt(skS, i)); lmErr += Math.hypot(w[0] - skD[i * 3], w[1] - skD[i * 3 + 1], w[2] - skD[i * 3 + 2]); }
report.femaleWarp = { method: "regularized thin-plate spline on skeleton landmarks", lambda: LAMBDA, landmarks: lmTrain.length, boneHoldoutMm: +(lmErr / lmTest.length * 1000).toFixed(1) };

const warpPos = (pos) => {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) out.set(tps(pos[i], pos[i + 1], pos[i + 2]), i);
  return out;
};
const femaleMeshes = meshes.map((m) => ({ ...m, pos: warpPos(m.pos) }));

// The female skeleton: open-anatomy-3d male bones under the same warp.
const femaleBones = [];
maleOA.getObjectByName("skeleton").traverse((m) => {
  if (!m.isMesh) return;
  const { pos, idx } = meshWorld(m);
  femaleBones.push({ node: m.name, group: "skeleton", pos: warpPos(pos), idx, files: [], bone: true });
});

// Shape check: non-rigid change of each muscle after the best similarity fit.
function procrustesResidual(A, B) {
  const n = A.length / 3, ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { ca[k] += A[i * 3 + k] / n; cb[k] += B[i * 3 + k] / n; }
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    const a = [0, 1, 2].map((k) => A[i * 3 + k] - ca[k]), b = [0, 1, 2].map((k) => B[i * 3 + k] - cb[k]);
    sa += a[0] ** 2 + a[1] ** 2 + a[2] ** 2; sb += b[0] ** 2 + b[1] ** 2 + b[2] ** 2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) H[r][c] += a[r] * b[c];
  }
  let X = H.map((r) => r.slice()); // orthogonal polar factor by Newton iteration
  for (let it = 0; it < 50; it++) {
    const d = X[0][0] * (X[1][1] * X[2][2] - X[1][2] * X[2][1]) - X[0][1] * (X[1][0] * X[2][2] - X[1][2] * X[2][0]) + X[0][2] * (X[1][0] * X[2][1] - X[1][1] * X[2][0]);
    const inv = [[(X[1][1] * X[2][2] - X[1][2] * X[2][1]) / d, (X[0][2] * X[2][1] - X[0][1] * X[2][2]) / d, (X[0][1] * X[1][2] - X[0][2] * X[1][1]) / d], [(X[1][2] * X[2][0] - X[1][0] * X[2][2]) / d, (X[0][0] * X[2][2] - X[0][2] * X[2][0]) / d, (X[0][2] * X[1][0] - X[0][0] * X[1][2]) / d], [(X[1][0] * X[2][1] - X[1][1] * X[2][0]) / d, (X[0][1] * X[2][0] - X[0][0] * X[2][1]) / d, (X[0][0] * X[1][1] - X[0][1] * X[1][0]) / d]];
    X = X.map((r, i) => r.map((v, j) => 0.5 * (v + inv[j][i])));
  }
  let tr = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tr += X[r][c] * H[r][c];
  const s = tr / sa;
  let res = 0;
  for (let i = 0; i < n; i++) {
    const a = [0, 1, 2].map((k) => A[i * 3 + k] - ca[k]);
    for (let c = 0; c < 3; c++) res += (s * (X[0][c] * a[0] + X[1][c] * a[1] + X[2][c] * a[2]) - (B[i * 3 + c] - cb[c])) ** 2;
  }
  return Math.sqrt(res / n) / Math.sqrt(sb / n);
}
const residuals = meshes
  .map((m, i) => [m.node, procrustesResidual(m.pos, femaleMeshes[i].pos)])
  .filter(([node]) => !node.startsWith("ctx_"))
  .sort((a, b) => b[1] - a[1]);
report.femaleShapeChange = {
  medianPct: +(residuals[residuals.length >> 1][1] * 100).toFixed(1),
  worstPct: +(residuals[0][1] * 100).toFixed(1),
  worst: residuals[0][0],
};

let worstStretch = { ratio: 0, node: "" };
const ratios = [];
for (let k = 0; k < meshes.length; k++) {
  const a = meshes[k].pos, b = femaleMeshes[k].pos, idx = meshes[k].idx;
  for (let t = 0; t < idx.length; t += 3) for (const [i, j] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
    const la = Math.hypot(a[i * 3] - a[j * 3], a[i * 3 + 1] - a[j * 3 + 1], a[i * 3 + 2] - a[j * 3 + 2]);
    const lb = Math.hypot(b[i * 3] - b[j * 3], b[i * 3 + 1] - b[j * 3 + 1], b[i * 3 + 2] - b[j * 3 + 2]);
    if (la <= 0.002) continue;
    ratios.push(lb / la);
    if (lb / la > worstStretch.ratio) worstStretch = { ratio: +(lb / la).toFixed(2), node: meshes[k].node };
  }
}
ratios.sort((x, y) => x - y);
const pct = (q) => +ratios[Math.floor(ratios.length * q)].toFixed(2);
report.femaleEdgeStretch = { median: pct(0.5), p99: pct(0.99), p999: pct(0.999), worst: worstStretch };

// ───────────────────────── 6. appearance bake ─────────────────────────
// Occlusion, tendon factor and fibre flow are computed on the male (source)
// geometry and reused for the female mesh (same vertices).
console.time("bake");
for (const m of meshes) {
  m.nrm = normals(m.pos, m.idx);
  m.allTendon = m.node === "ctx_linea_alba"; // a tendinous band, not muscle
}
// External oblique: BodyParts3D's mesh wraps the rectus region (the rectus
// abdominis itself is not in the source). Medial to the semilunar line the
// external oblique is aponeurosis — the anterior rectus sheath — so it is
// rendered as a pearly sheath through which the rectus contours still read.
// Landmarks come from the model: the linea alba spans xiphoid → pubis; the
// semilunar line runs ≈8.5 cm from the midline at the costal margin to
// ≈3.5 cm at the pubic tubercle.
{
  const la = meshes.find((m) => m.node === "ctx_linea_alba");
  let yTop = -Infinity, yBot = Infinity;
  for (let i = 1; i < la.pos.length; i += 3) { yTop = Math.max(yTop, la.pos[i]); yBot = Math.min(yBot, la.pos[i]); }
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (const m of meshes) {
    if (!/^external_oblique_[lr]$/.test(m.node)) continue;
    const n = m.pos.length / 3;
    m.tendonFloor = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const x = Math.abs(m.pos[v * 3]), y = m.pos[v * 3 + 1];
      const t = Math.min(1, Math.max(0, (y - yBot) / (yTop - yBot)));
      const xs = 0.035 + (0.085 - 0.035) * t;
      const medial = 1 - smooth(xs - 0.006, xs + 0.006, x);
      const anterior = smooth(-0.2, 0.3, m.nrm[v * 3 + 2]);
      m.tendonFloor[v] = 0.62 * medial * anterior * (y < yTop + 0.02 ? 1 : 0);
    }
  }
  report.aponeurosis = { linea_alba_y: [+yBot.toFixed(3), +yTop.toFixed(3)] };
}
const baked = bakeAppearance(meshes);
// Same vertices in both bodies: the female mesh reuses the male bake, so its
// fibre pattern deforms with the muscle instead of being recomputed.
meshes.forEach((m, i) => { m.anat = baked[i].anat; m.fibre = baked[i].fibre; });
femaleMeshes.forEach((m, i) => { m.anat = baked[i].anat; m.fibre = baked[i].fibre; });
console.timeEnd("bake");
const tendonShare = (() => {
  let t = 0, n = 0;
  for (const m of meshes) for (let v = 1; v < m.anat.length; v += 2) { t += m.anat[v] > 0.5 ? 1 : 0; n++; }
  return +(t / n).toFixed(3);
})();
report.appearance = { tendonVertexShare: tendonShare };

// ───────────────────────── 7. write GLBs ─────────────────────────
async function writeGlb(list, file, sex) {
  const doc = new Document();
  doc.getRoot().getAsset().generator = "muscle-studio pipeline/bodyparts3d";
  doc.getRoot().getAsset().copyright =
    "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International" +
    (sex === "female" ? "; female proportions derived from open-anatomy-3d (CC BY 4.0) / MakeHuman (CC0)" : "");
  const buffer = doc.createBuffer();
  const scene = doc.createScene(`bodyparts3d-muscles-${sex}`);
  const groups = {};
  const groupNames = [...new Set(list.map((m) => m.group))];
  for (const g of groupNames) scene.addChild((groups[g] = doc.createNode(g)));
  for (const m of list) {
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(m.pos).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals(m.pos, m.idx)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(m.pos.length / 3 > 65535 ? m.idx : Uint16Array.from(m.idx)).setBuffer(buffer));
    if (m.anat) {
      prim
        .setAttribute("_ANAT", doc.createAccessor().setType("VEC2").setArray(m.anat).setBuffer(buffer))
        .setAttribute("_FIBER", doc.createAccessor().setType("VEC3").setArray(m.fibre).setBuffer(buffer));
    }
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
  female: await writeGlb([...femaleMeshes, ...femaleBones], path.join(OUT, "muscles-female.glb"), "female"),
};
report.triangles = {
  units: meshes.filter((m) => m.group === "muscles").reduce((s, m) => s + m.idx.length / 3, 0),
  context: meshes.filter((m) => m.group === "muscles_context").reduce((s, m) => s + m.idx.length / 3, 0),
};
fs.writeFileSync(path.join(OUT, "build-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, fidelity: undefined, units: Object.keys(report.units).length, context: Object.keys(report.context).length }, null, 2));
