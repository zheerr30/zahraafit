// Whole-body muscle surface refinement — smooth, clean muscle bellies built FROM the
// original Z-Anatomy meshes. Only muscle ("unit") vertices move, by at most 2 mm;
// topology, vertex count, tendons, fasciae, ligaments and bones are untouched.
//
//   1. pins (never move): the author's tendon / aponeurosis faces, bone contact
//      (origins / insertions), open borders, and seams where another structure
//      lies side by side with the muscle;
//   2. fairing: Taubin λ|μ smoothing (no shrinkage) of the free belly surface —
//      removes the low-resolution ridges, lumps and ragged facets of the source;
//   3. relationships kept: a vertex may approach its nearest neighbouring structure
//      by at most 40 % of the original gap, so no layer can come to cross another
//      (both sides are limited: 2 × 40 % < the gap);
//   4. normals recomputed (welded); the baked ambient occlusion — per vertex, patchy
//      at this resolution — is smoothed over the surface.
//
// Output: public/models/zanatomy/<sex>/core-smooth.glb (same nodes, names, extras,
// vertex and triangle counts as core.glb) + core-smooth.json with the measured changes.
//
//   node pipeline/sculpt/body.mjs public/models/zanatomy male
import { writeFileSync } from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, meshopt, quantize } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";

const [root = "public/models/zanatomy", sex = "male"] = process.argv.slice(2);

const FAIR_MAX = 0.002; // no vertex moves more than 2 mm
const APPROACH = 0.4; // of the original gap to the nearest other structure
const REACH = 0.012; // neighbours are searched within 12 mm
const ITER = 24;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const t0 = Date.now();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(path.join(root, sex, "core.glb"));
await doc.transform(dequantize());

const smooth01 = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ── collect every mesh in world space ───────────────────────────────
const SOLID = new Set(["unit", "bone", "tendon", "ligament", "fascia"]);
const items = [];
const seenPos = new Set();
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const ex = node.getExtras();
  if (!SOLID.has(ex.kind)) continue;
  const prim = mesh.listPrimitives()[0];
  let pos = prim.getAttribute("POSITION");
  if (seenPos.has(pos)) { pos = pos.clone(); prim.setAttribute("POSITION", pos); prim.setAttribute("NORMAL", prim.getAttribute("NORMAL").clone()); }
  seenPos.add(pos);
  const M = node.getWorldMatrix();
  const L = pos.getArray(), n = L.length / 3;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = L[i * 3], y = L[i * 3 + 1], z = L[i * 3 + 2];
    P[i * 3] = M[0] * x + M[4] * y + M[8] * z + M[12];
    P[i * 3 + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
    P[i * 3 + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
  }
  const I = Uint32Array.from(prim.getIndices().getArray());
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(Float32Array.from(P), 3));
  g.setIndex(new BufferAttribute(Uint32Array.from(I), 1)); // MeshBVH reorders its own copy
  items.push({ node, prim, kind: ex.kind, name: ex.za_name ?? node.getName(), M, P, I, lo, hi, bvh: new MeshBVH(g) });
}
console.log(`[${sex}] ${items.length} meshes, ${items.filter((x) => x.kind === "unit").length} muscles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// ── helpers ─────────────────────────────────────────────────────
/** Welded vertex graph: canonical index per position, neighbours, open-border flags. */
function weld(P, I) {
  const n = P.length / 3;
  const map = new Map(), canon = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = `${Math.round(P[i * 3] * 1e6)},${Math.round(P[i * 3 + 1] * 1e6)},${Math.round(P[i * 3 + 2] * 1e6)}`; let c = map.get(k); if (c === undefined) { c = i; map.set(k, i); } canon[i] = c; }
  const nb = new Map(), edges = new Map();
  const add = (a, b) => { let s = nb.get(a); if (!s) nb.set(a, (s = new Set())); s.add(b); };
  for (let t = 0; t < I.length; t += 3) {
    const v = [canon[I[t]], canon[I[t + 1]], canon[I[t + 2]]];
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      if (a === b) continue;
      add(a, b); add(b, a);
      const k = a < b ? a * n + b : b * n + a;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  const border = new Uint8Array(n);
  for (const [k, c] of edges) if (c === 1) { border[Math.floor(k / n)] = 1; border[k % n] = 1; }
  return { canon, reps: [...new Set(canon)], nb, border };
}
function normalsOf(P, I, canon) {
  const n = P.length / 3, acc = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = canon[I[t]], b = canon[I[t + 1]], c = canon[I[t + 2]];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const x of [a, b, c]) { acc[x * 3] += fx; acc[x * 3 + 1] += fy; acc[x * 3 + 2] += fz; }
  }
  for (let i = 0; i < n; i++) { const c = canon[i]; const l = Math.hypot(acc[c * 3], acc[c * 3 + 1], acc[c * 3 + 2]) || 1; N[i * 3] = acc[c * 3] / l; N[i * 3 + 1] = acc[c * 3 + 1] / l; N[i * 3 + 2] = acc[c * 3 + 2] / l; }
  return N;
}
const volumeOf = (P, I) => {
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  return Math.abs(v);
};
/** Mean angle (degrees) between the normals of faces sharing an edge: surface roughness. */
function roughnessOf(P, I, canon) {
  const n = P.length / 3, first = new Map();
  let sum = 0, cnt = 0;
  const fn = (t) => {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  for (let t = 0; t < I.length; t += 3) {
    const N = fn(t), v = [canon[I[t]], canon[I[t + 1]], canon[I[t + 2]]];
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3], k = a < b ? a * n + b : b * n + a;
      const o = first.get(k);
      if (o === undefined) first.set(k, N);
      else { const d = Math.min(1, Math.max(-1, o[0] * N[0] + o[1] * N[1] + o[2] * N[2])); if (d > 0) { sum += Math.acos(d); cnt++; } } // sharp rims (> 90°) are form, not roughness
    }
  }
  return cnt ? (sum / cnt) * (180 / Math.PI) : 0;
}

const report = { sex, generated: new Date().toISOString(), method: "pinned Taubin fairing of muscle bellies (≤ 2 mm, ≤ 40 % of the gap to the nearest structure) + welded normals + smoothed AO", limitsMm: { max: FAIR_MAX * 1e3 }, meshes: [] };
const p = new Vector3(), hit = { point: new Vector3(), distance: 0, faceIndex: 0 };
const results = [];

for (const T of items) {
  if (T.kind !== "unit") continue;
  const P0 = T.P, I = T.I, n = P0.length / 3;
  const P = Float32Array.from(P0);
  const anat = T.prim.getAttribute("_ANAT")?.getArray();
  const { canon, reps, nb, border } = weld(P0, I);
  const N0 = normalsOf(P0, I, canon);
  // structures whose bounds come within reach
  const near = items.filter((U) => U !== T && U.lo[0] < T.hi[0] + REACH && U.hi[0] > T.lo[0] - REACH && U.lo[1] < T.hi[1] + REACH && U.hi[1] > T.lo[1] - REACH && U.lo[2] < T.hi[2] + REACH && U.hi[2] > T.lo[2] - REACH);
  const pin = new Float32Array(n), bonePin = new Float32Array(n), gap = new Float32Array(n).fill(Infinity), dir = new Float32Array(n * 3);
  for (const i of reps) {
    p.set(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]);
    let best = REACH, bone = Infinity, ux = 0, uy = 0, uz = 0, found = false;
    for (const U of near) {
      if (p.x < U.lo[0] - best || p.x > U.hi[0] + best || p.y < U.lo[1] - best || p.y > U.hi[1] + best || p.z < U.lo[2] - best || p.z > U.hi[2] + best) {
        if (U.kind !== "bone") continue;
      }
      const h = U.bvh.closestPointToPoint(p, hit, 0, U.kind === "bone" ? Math.max(best, 0.011) : best);
      if (!h) continue;
      if (U.kind === "bone") bone = Math.min(bone, h.distance);
      if (h.distance < best) { best = h.distance; found = true; ux = h.point.x - p.x; uy = h.point.y - p.y; uz = h.point.z - p.z; }
    }
    let seam = 0;
    if (found) {
      const l = Math.hypot(ux, uy, uz);
      gap[i] = best;
      if (l > 1e-7) {
        dir[i * 3] = ux / l; dir[i * 3 + 1] = uy / l; dir[i * 3 + 2] = uz / l;
        // side by side (the neighbour is not above / below the surface): a seam — keep it closed
        const across = Math.abs(dir[i * 3] * N0[i * 3] + dir[i * 3 + 1] * N0[i * 3 + 1] + dir[i * 3 + 2] * N0[i * 3 + 2]);
        seam = (1 - smooth01(0.001, 0.005, best)) * (1 - smooth01(0.4, 0.75, across));
      } else seam = 1; // touching
    }
    const tendon = anat ? smooth01(0.35, 0.85, anat[i * 2 + 1]) : 0;
    bonePin[i] = 1 - smooth01(0.003, 0.01, bone);
    pin[i] = Math.max(tendon, bonePin[i], seam, border[i]);
  }
  // ── Taubin fairing of the free surface ──
  const D = new Float32Array(n * 3);
  const step = (lam) => {
    for (const i of reps) {
      const s = nb.get(i), w = lam * (1 - pin[i]);
      if (!s || !s.size || w === 0) { D[i * 3] = D[i * 3 + 1] = D[i * 3 + 2] = 0; continue; }
      let x = 0, y = 0, z = 0;
      for (const j of s) { x += P[j * 3]; y += P[j * 3 + 1]; z += P[j * 3 + 2]; }
      const k = s.size;
      D[i * 3] = w * (x / k - P[i * 3]); D[i * 3 + 1] = w * (y / k - P[i * 3 + 1]); D[i * 3 + 2] = w * (z / k - P[i * 3 + 2]);
    }
    for (const i of reps) { P[i * 3] += D[i * 3]; P[i * 3 + 1] += D[i * 3 + 1]; P[i * 3 + 2] += D[i * 3 + 2]; }
  };
  const clamp = () => {
    for (const i of reps) {
      let dx = P[i * 3] - P0[i * 3], dy = P[i * 3 + 1] - P0[i * 3 + 1], dz = P[i * 3 + 2] - P0[i * 3 + 2];
      if (gap[i] < Infinity) {
        // towards the nearest structure: at most 40 % of the original gap
        const along = dx * dir[i * 3] + dy * dir[i * 3 + 1] + dz * dir[i * 3 + 2], lim = APPROACH * gap[i];
        if (along > lim) { const k = along - lim; dx -= k * dir[i * 3]; dy -= k * dir[i * 3 + 1]; dz -= k * dir[i * 3 + 2]; }
      }
      const d = Math.hypot(dx, dy, dz), lim = FAIR_MAX * (1 - pin[i]);
      const k = d > lim ? (d > 0 ? lim / d : 0) : 1;
      P[i * 3] = P0[i * 3] + dx * k; P[i * 3 + 1] = P0[i * 3 + 1] + dy * k; P[i * 3 + 2] = P0[i * 3 + 2] + dz * k;
    }
  };
  for (let it = 0; it < ITER; it++) { step(0.5); step(-0.53); clamp(); }
  for (let i = 0; i < n; i++) { const c = canon[i]; if (c !== i) { P[i * 3] = P[c * 3]; P[i * 3 + 1] = P[c * 3 + 1]; P[i * 3 + 2] = P[c * 3 + 2]; } }
  const N = normalsOf(P, I, canon);
  // ── baked AO: per-vertex and patchy at this resolution → smoothed over the surface ──
  if (anat) {
    const A = new Float32Array(n);
    for (let i = 0; i < n; i++) A[i] = anat[canon[i] * 2];
    for (let it = 0; it < 3; it++) {
      const B = Float32Array.from(A);
      for (const i of reps) { const s = nb.get(i); if (!s || !s.size) continue; let m = 0; for (const j of s) m += A[j]; B[i] = 0.5 * A[i] + 0.5 * (m / s.size); }
      A.set(B);
    }
    for (let i = 0; i < n; i++) anat[i * 2] = A[canon[i]];
  }
  // ── measured ──
  let max = 0, mean = 0, boneMax = 0, tendonMax = 0, cnt = 0;
  for (const i of reps) {
    const d = Math.hypot(P[i * 3] - P0[i * 3], P[i * 3 + 1] - P0[i * 3 + 1], P[i * 3 + 2] - P0[i * 3 + 2]);
    max = Math.max(max, d); mean += d; cnt++;
    if (bonePin[i] > 0.99) boneMax = Math.max(boneMax, d);
    if (anat && anat[i * 2 + 1] > 0.85) tendonMax = Math.max(tendonMax, d);
  }
  const v0 = volumeOf(P0, I), v1 = volumeOf(P, I);
  report.meshes.push({
    name: T.name, vertices: n, triangles: I.length / 3,
    maxDisplacementMm: +(max * 1e3).toFixed(3), meanDisplacementMm: +((mean / cnt) * 1e3).toFixed(3),
    boneAttachmentMaxDisplacementMm: +(boneMax * 1e3).toFixed(3), tendonMaxDisplacementMm: +(tendonMax * 1e3).toFixed(3),
    volumeChangePct: v0 > 0 ? +(((v1 - v0) / v0) * 100).toFixed(2) : 0,
    roughnessDegBefore: +roughnessOf(P0, I, canon).toFixed(2), roughnessDegAfter: +roughnessOf(P, I, canon).toFixed(2),
  });
  results.push({ T, P, N });
}

// ── abdominal wall: the deep sheets must lie UNDER the external oblique ──
// In the source the internal oblique (and transversus) cross the outer surface of the
// external oblique at the flank by fractions of a millimetre, which renders as a
// mottled patch. Their vertices found on or above that surface are moved 1.2 mm
// beneath it (hidden deep layer only; the superficial muscle is not touched).
report.abdominalWall = [];
{
  const COVER = 0.0012;
  const sideOf = (T) => (/\.l$/.test(T.name) ? "l" : /\.r$/.test(T.name) ? "r" : "m");
  const q = new Vector3();
  for (const E of results.filter((r) => /^External abdominal oblique/.test(r.T.name))) {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(Float32Array.from(E.P), 3));
    g.setIndex(new BufferAttribute(Uint32Array.from(E.T.I), 1));
    const bvh = new MeshBVH(g), EP = g.getAttribute("position").array, EI = g.index.array;
    // torso axis (for "outward"): centroid of the sheet in x–z
    let cx = 0, cz = 0;
    for (let i = 0; i < E.P.length; i += 3) { cx += E.P[i]; cz += E.P[i + 2]; }
    cz /= E.P.length / 3; cx = 0; // the body is centred on x = 0
    for (const D of results.filter((r) => /^(Internal abdominal oblique|Transvers(us|e) abdomin)/.test(r.T.name) && sideOf(r.T) === sideOf(E.T))) {
      const P = D.P, { canon } = weld(D.T.P, D.T.I);
      let moved = 0, max = 0;
      for (let i = 0; i < P.length / 3; i++) {
        if (canon[i] !== i) continue;
        q.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        if (!bvh.closestPointToPoint(q, hit, 0, 0.004) || hit.distance > 0.004) continue;
        const f = hit.faceIndex * 3, a = EI[f] * 3, b = EI[f + 1] * 3, c = EI[f + 2] * 3;
        const ux = EP[b] - EP[a], uy = EP[b + 1] - EP[a + 1], uz = EP[b + 2] - EP[a + 2], vx = EP[c] - EP[a], vy = EP[c + 1] - EP[a + 1], vz = EP[c + 2] - EP[a + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        // only the OUTER face of the superficial sheet (normal pointing away from the torso axis)
        if (nx * (hit.point.x - cx) + nz * (hit.point.z - cz) <= 0) continue;
        const h = (q.x - hit.point.x) * nx + (q.y - hit.point.y) * ny + (q.z - hit.point.z) * nz;
        // directly above / below that face (not merely beside the border of the sheet)
        if (h <= -COVER || Math.abs(h) < 0.9 * hit.distance) continue;
        const k = h + COVER;
        P[i * 3] -= k * nx; P[i * 3 + 1] -= k * ny; P[i * 3 + 2] -= k * nz;
        moved++; max = Math.max(max, k);
      }
      for (let i = 0; i < P.length / 3; i++) { const c = canon[i]; if (c !== i) { P[i * 3] = P[c * 3]; P[i * 3 + 1] = P[c * 3 + 1]; P[i * 3 + 2] = P[c * 3 + 2]; } }
      D.N = normalsOf(P, D.T.I, canon);
      report.abdominalWall.push({ deep: D.T.name, under: E.T.name, verticesMoved: moved, maxMoveMm: +(max * 1e3).toFixed(3) });
    }
  }
}
console.log(JSON.stringify(report.abdominalWall));

// ── write back (after all muscles were measured against the ORIGINAL neighbours) ──
for (const { T, P, N } of results) {
  const M = T.M, n = P.length / 3;
  // inverse of the node's world matrix (uniform scale + translation + rotation)
  const a = M[0], b = M[1], c = M[2], d = M[4], e = M[5], f = M[6], g = M[8], h = M[9], k = M[10];
  const det = a * (e * k - f * h) - d * (b * k - c * h) + g * (b * f - c * e);
  const inv = [(e * k - f * h) / det, (c * h - b * k) / det, (b * f - c * e) / det, (f * g - d * k) / det, (a * k - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  const L = T.prim.getAttribute("POSITION").getArray(), LN = T.prim.getAttribute("NORMAL").getArray();
  for (let i = 0; i < n; i++) {
    const x = P[i * 3] - M[12], y = P[i * 3 + 1] - M[13], z = P[i * 3 + 2] - M[14];
    L[i * 3] = inv[0] * x + inv[3] * y + inv[6] * z; L[i * 3 + 1] = inv[1] * x + inv[4] * y + inv[7] * z; L[i * 3 + 2] = inv[2] * x + inv[5] * y + inv[8] * z;
    // normals: transpose of the forward 3×3 (= inverse transpose of the inverse)
    const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    const lx = a * nx + b * ny + c * nz, ly = d * nx + e * ny + f * nz, lz = g * nx + h * ny + k * nz, ll = Math.hypot(lx, ly, lz) || 1;
    LN[i * 3] = lx / ll; LN[i * 3 + 1] = ly / ll; LN[i * 3 + 2] = lz / ll;
  }
  T.prim.getAttribute("POSITION").setArray(L);
  T.prim.getAttribute("NORMAL").setArray(LN);
  const A = T.prim.getAttribute("_ANAT");
  if (A) A.setArray(A.getArray());
}

const ms = report.meshes;
const agg = (f) => +ms.reduce((s, m) => Math.max(s, f(m)), 0).toFixed(3);
const avg = (f) => +(ms.reduce((s, m) => s + f(m) * m.vertices, 0) / ms.reduce((s, m) => s + m.vertices, 0)).toFixed(3);
report.summary = {
  muscles: ms.length, vertices: ms.reduce((s, m) => s + m.vertices, 0),
  maxDisplacementMm: agg((m) => m.maxDisplacementMm), meanDisplacementMm: avg((m) => m.meanDisplacementMm),
  boneAttachmentMaxDisplacementMm: agg((m) => m.boneAttachmentMaxDisplacementMm), tendonMaxDisplacementMm: agg((m) => m.tendonMaxDisplacementMm),
  maxAbsVolumeChangePct: agg((m) => Math.abs(m.volumeChangePct)),
  roughnessDegBefore: avg((m) => m.roughnessDegBefore), roughnessDegAfter: avg((m) => m.roughnessDegAfter),
};
console.log(JSON.stringify(report.summary));

await doc.transform(quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeColor: 8, quantizeGeneric: 16 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
const out = path.join(root, sex, "core-smooth.glb");
await io.write(out, doc);
writeFileSync(path.join(root, sex, "core-smooth.json"), JSON.stringify(report, null, 1));
console.log(`wrote ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
