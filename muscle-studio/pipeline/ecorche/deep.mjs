// Deep muscles for the Écorché body.
//
// The Écorché model is an artist's écorché: it has the superficial muscles only. The deep
// ones are taken from the open Z-Anatomy body (CC BY-SA 4.0) the atlas used before, and
// fitted into the Écorché body:
//   1. anchors — structures both bodies have (trunk bones, the superficial abdominal
//      muscles): each pair gives landmarks (a 3 × 3 × 3 grid of its bounding box);
//   2. a smooth warp (thin-plate spline) through all landmarks carries any point of the
//      Z-Anatomy body to its place in the Écorché body;
//   3. the warped deep muscles are tucked under the Écorché muscles that cover them: no
//      vertex is left on or outside the surface of a covering muscle;
//   4. normals are rebuilt, fibre directions follow the warp, the baked attributes of the
//      Z-Anatomy meshes (tendon mask, occlusion) are kept — the atlas draws them with its
//      own muscle material.
//
// Output: public/models/ecorche/<sex>/deep.glb — the same node metadata as in the Z-Anatomy
// file (ids, Arabic names, regions, depth), plus `from: "zanatomy"`.
//
//   ECORCHE_WORK=/path/to/work node pipeline/ecorche/deep.mjs male
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, prune, quantize } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";

const sex = process.argv[2] ?? "male";
const WORK = process.env.ECORCHE_WORK;
if (!WORK) throw new Error("set ECORCHE_WORK");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);

// ── the muscles to bring over, and what covers them in the Écorché body ──
// `under`: where the muscle must lie relative to each cover —
//   "outer": at least `gap` below the cover's outer face. The Écorché muscles are sculpted as
//            thick solids (much thicker than the real sheets of the abdominal wall), so a deep
//            sheet is placed at its anatomical depth under the body surface, inside that solid:
//            hidden while the cover is shown, in its natural place when the cover is peeled;
//   "inner": at least `gap` below the cover's inner face (really underneath it).
const WALL = ["External Oblique", "Rectus_Abdominis", "Latissimus_Dorsi", "Serratus_Anterior", "Pars_Abdominalis"];
const DEEP = [
  { id: "internal-abdominal-oblique-muscle", depth: 2, cover: WALL, under: "outer", gap: 0.006 },
  { id: "transversus-abdominis-muscle", depth: 3, cover: WALL, under: "outer", gap: 0.011 },
  { id: "quadratus-lumborum-muscle", depth: 3, cover: ["Longissimus_Lumborum", "Longissimus_Thoracis", "Latissimus_Dorsi"], under: "inner", gap: 0.002 },
];
// ── anchors: [Z-Anatomy ids (kind), Écorché object names] per side ──
const NUM = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
const ANCHORS = [
  { z: ["Hip_bone"], e: ["Pelvis"], sides: ["l", "r"] },
  { z: ["Sacrum"], e: ["Sacrum"], sides: ["m"] },
  { z: [1, 2, 3, 4, 5].map((n) => `Vertebra_L${n}`), e: ["Lumbar"], sides: ["m"] },
  { z: Array.from({ length: 12 }, (_, i) => `Vertebra_T${i + 1}`), e: ["Thoracic"], sides: ["m"] },
  { z: NUM.map((n) => `${n}_rib`), e: ["Rib_Cage"], sides: ["l", "r"] },
  { z: ["Body_of_sternum"], e: ["Body_Sternum"], sides: ["m"] },
  { z: ["Manubrium_of_sternum"], e: ["Manubrium_Sterni"], sides: ["m"] },
  { z: ["rectus-abdominis-muscle"], e: ["Rectus_Abdominis"], sides: ["l", "r"], split: true },
  { z: ["external-abdominal-oblique-muscle"], e: ["External Oblique"], sides: ["l", "r"] },
];

// ── inputs ──────────────────────────────────────────────────────────
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const zdoc = await io.read(`public/models/zanatomy/${sex}/core-smooth.glb`);
const manifest = JSON.parse(readFileSync(path.join(WORK, sex, "manifest.json"), "utf8"));
const bin = readFileSync(path.join(WORK, sex, "geometry.bin"));
const f32 = (off, n) => new Float32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * 4));
const u32 = (off, n) => new Uint32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * 4));

/** World-space positions of a Z-Anatomy node. */
function zWorld(node) {
  const acc = node.getMesh().listPrimitives()[0].getAttribute("POSITION"), m = node.getWorldMatrix(), n = acc.getCount();
  const out = new Float32Array(n * 3), v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    acc.getElement(i, v);
    out[i * 3] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
    out[i * 3 + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    out[i * 3 + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
  }
  return out;
}
const zNodes = zdoc.getRoot().listNodes().filter((n) => n.getMesh());
const box = () => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const grow = (b, p, keep = () => true) => { for (let i = 0; i < p.length; i += 3) { if (!keep(p[i])) continue; for (let c = 0; c < 3; c++) { if (p[i + c] < b.min[c]) b.min[c] = p[i + c]; if (p[i + c] > b.max[c]) b.max[c] = p[i + c]; } } };
const halfOf = (side) => (side === "l" ? (x) => x >= 0 : side === "r" ? (x) => x <= 0 : () => true);

// ── landmarks ───────────────────────────────────────────────────────
const P = [], Q = []; // Z-Anatomy points → Écorché points
for (const a of ANCHORS) {
  for (const side of a.sides) {
    const bz = box(), be = box();
    for (const n of zNodes) { const x = n.getExtras(); if (a.z.includes(x.id) && (side === "m" || x.side === side)) grow(bz, zWorld(n)); }
    for (const r of manifest.records) { if (a.e.includes(r.name) && (a.split || side === "m" || r.side === side)) grow(be, f32(r.position, r.vertices * 3), a.split ? halfOf(side) : undefined); }
    if (!isFinite(bz.min[0]) || !isFinite(be.min[0])) throw new Error(`anchor not found: ${a.z[0]} / ${a.e[0]} (${side})`);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const t = [i / 2, j / 2, k / 2];
      P.push(t.map((u, c) => bz.min[c] + u * (bz.max[c] - bz.min[c])));
      Q.push(t.map((u, c) => be.min[c] + u * (be.max[c] - be.min[c])));
    }
  }
}

// ── thin-plate spline in 3D (kernel r), slightly smoothed: the landmarks are approximate ──
const N = P.length, SMOOTH = 0.003;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const A = Array.from({ length: N + 4 }, () => new Float64Array(N + 4));
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) A[i][j] = dist(P[i], P[j]) + (i === j ? SMOOTH : 0);
  A[i][N] = A[N][i] = 1;
  for (let c = 0; c < 3; c++) A[i][N + 1 + c] = A[N + 1 + c][i] = P[i][c];
}
function solve(M, rhs) { // Gaussian elimination with partial pivoting; rhs: three columns
  const n = M.length, a = M.map((r) => Float64Array.from(r)), b = rhs.map((r) => Float64Array.from(r));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    [a[col], a[piv]] = [a[piv], a[col]]; [b[col], b[piv]] = [b[piv], b[col]];
    const d = a[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / d;
      if (!f) continue;
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c];
      for (let c = 0; c < 3; c++) b[r][c] -= f * b[col][c];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    for (let c = 0; c < 3; c++) { let s = b[r][c]; for (let k = r + 1; k < n; k++) s -= a[r][k] * b[k][c]; b[r][c] = s / a[r][r]; }
  }
  return b;
}
const W = solve(A, [...Q.map((q) => [q[0], q[1], q[2]]), [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
function warp(p, out = [0, 0, 0]) {
  let x = W[N][0] + W[N + 1][0] * p[0] + W[N + 2][0] * p[1] + W[N + 3][0] * p[2];
  let y = W[N][1] + W[N + 1][1] * p[0] + W[N + 2][1] * p[1] + W[N + 3][1] * p[2];
  let z = W[N][2] + W[N + 1][2] * p[0] + W[N + 2][2] * p[1] + W[N + 3][2] * p[2];
  for (let i = 0; i < N; i++) { const r = dist(p, P[i]); x += W[i][0] * r; y += W[i][1] * r; z += W[i][2] * r; }
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}
let fitErr = 0;
for (let i = 0; i < N; i++) fitErr = Math.max(fitErr, dist(warp(P[i]), Q[i]));

// ── covers of the Écorché body ──────────────────────────────────────
const bvhOf = new Map();
function coverBVH(name) {
  if (bvhOf.has(name)) return bvhOf.get(name);
  const list = [];
  for (const r of manifest.records) {
    if (r.name !== name) continue;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(f32(r.position, r.vertices * 3), 3));
    g.setIndex(new BufferAttribute(u32(r.index, r.triangles * 3), 1));
    list.push(new MeshBVH(g));
  }
  bvhOf.set(name, list);
  return list;
}
// the trunk's axis: straight up through the middle of the rib cage and pelvis
const trunk = box();
for (const r of manifest.records) if (["Rib_Cage", "Pelvis"].includes(r.name)) grow(trunk, f32(r.position, r.vertices * 3));
const AXIS_Z = (trunk.min[2] + trunk.max[2]) / 2;

/**
 * How far (m) each vertex must move towards the trunk's axis to lie `margin` under every
 * covering muscle. A ray from outside the body towards the axis through the vertex meets a
 * cover on its outer face and leaves it on its inner face; the vertex must come after the exit.
 */
function tuck(pos, covers, under, margin) {
  const n = pos.length / 3, push = new Float32Array(n), dirs = new Float32Array(n * 2);
  const ray = new Ray(), FAR = 0.3;
  const bvhs = covers.flatMap(coverBVH);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let dx = x, dz = z - AXIS_Z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    dirs[i * 2] = dx; dirs[i * 2 + 1] = dz;
    ray.origin.set(x + dx * FAR, y, z + dz * FAR); ray.direction.set(-dx, 0, -dz);
    let need = 0;
    for (const bvh of bvhs) {
      const hits = bvh.raycast(ray, DoubleSide).map((h) => h.distance).sort((a, b) => a - b);
      // pairs: in at hits[0], out at hits[1], … ; a cover the vertex is outside of, inside of,
      // or closer than the margin under
      for (let k = 0; k < hits.length; k += 2) {
        const face = under === "inner" ? (hits[k + 1] ?? hits[k]) : hits[k];
        if (hits[k] > FAR + 0.06) break; // far beyond the vertex: the other side of the body
        if (face + margin > FAR) need = Math.max(need, face + margin - FAR);
      }
    }
    push[i] = Math.min(need, 0.05);
  }
  // The push is a smooth field over the trunk (height × angle around the axis), the same for
  // both faces of the muscle at a place: it keeps its thickness and its surface stays even.
  const CELL_Y = 0.006, CELL_A = (3 * Math.PI) / 180;
  const cy = (i) => pos[i * 3 + 1] / CELL_Y, ca = (i) => Math.atan2(dirs[i * 2 + 1], dirs[i * 2]) / CELL_A;
  let grid = new Map();
  const K = (a, b) => `${a},${b}`;
  for (let i = 0; i < n; i++) { const k = K(Math.round(cy(i)), Math.round(ca(i))); grid.set(k, Math.max(grid.get(k) ?? 0, push[i])); }
  for (let pass = 0; pass < 3; pass++) { // widen and soften: never less than what a cell needs
    const next = new Map();
    for (const [k, v] of grid) {
      const [a, b] = k.split(",").map(Number);
      let sum = 0, cnt = 0;
      for (let u = -1; u <= 1; u++) for (let w = -1; w <= 1; w++) { const g = grid.get(K(a + u, b + w)); if (g !== undefined) { sum += g; cnt++; } }
      next.set(k, Math.max(v, sum / cnt));
      for (let u = -1; u <= 1; u++) for (let w = -1; w <= 1; w++) if (!grid.has(K(a + u, b + w)) && !next.has(K(a + u, b + w))) next.set(K(a + u, b + w), v * 0.6);
    }
    grid = next;
  }
  const at = (a, b) => grid.get(K(a, b)) ?? 0;
  let moved = 0, most = 0;
  for (let i = 0; i < n; i++) {
    const y = cy(i), a = ca(i), y0 = Math.floor(y), a0 = Math.floor(a), fy = y - y0, fa = a - a0;
    const d = (at(y0, a0) * (1 - fa) + at(y0, a0 + 1) * fa) * (1 - fy) + (at(y0 + 1, a0) * (1 - fa) + at(y0 + 1, a0 + 1) * fa) * fy;
    if (d > 1e-5) { pos[i * 3] -= dirs[i * 2] * d; pos[i * 3 + 2] -= dirs[i * 2 + 1] * d; moved++; most = Math.max(most, d); }
  }
  return { moved, most };
}

/** Smooth vertex normals (corners at the same place share one). */
function normals(pos, idx) {
  const n = pos.length / 3, acc = new Float32Array(n * 3), rep = new Uint32Array(n), first = new Map();
  for (let i = 0; i < n; i++) { const k = `${Math.round(pos[i * 3] * 2e5)},${Math.round(pos[i * 3 + 1] * 2e5)},${Math.round(pos[i * 3 + 2] * 2e5)}`; let r = first.get(k); if (r === undefined) first.set(k, (r = i)); rep[i] = r; }
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(pos, idx[t] * 3); b.fromArray(pos, idx[t + 1] * 3); c.fromArray(pos, idx[t + 2] * 3);
    b.sub(a); c.sub(a); b.cross(c);
    for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { const r = rep[v]; acc[r * 3] += b.x; acc[r * 3 + 1] += b.y; acc[r * 3 + 2] += b.z; }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = rep[i], l = Math.hypot(acc[r * 3], acc[r * 3 + 1], acc[r * 3 + 2]) || 1; out[i * 3] = acc[r * 3] / l; out[i * 3 + 1] = acc[r * 3 + 1] / l; out[i * 3 + 2] = acc[r * 3 + 2] / l; }
  return out;
}

// ── build ───────────────────────────────────────────────────────────
const doc = new Document();
const buffer = doc.createBuffer(), scene = doc.createScene("deep");
const material = doc.createMaterial("muscle").setBaseColorFactor([0.5, 0.2, 0.17, 1]).setRoughnessFactor(0.6).setMetallicFactor(0);
const report = [];
for (const spec of DEEP) {
  for (const node of zNodes.filter((n) => n.getExtras().id === spec.id && n.getExtras().kind === "unit")) {
    const prim = node.getMesh().listPrimitives()[0], src = zWorld(node), n = src.length / 3;
    const pos = new Float32Array(n * 3), p = [0, 0, 0], q = [0, 0, 0];
    for (let i = 0; i < n; i++) { p[0] = src[i * 3]; p[1] = src[i * 3 + 1]; p[2] = src[i * 3 + 2]; warp(p, q); pos.set(q, i * 3); }
    // fibre directions follow the warp (a small step along the fibre, warped)
    const fib = prim.getAttribute("_FIBER"), fibOut = new Float32Array(n * 3), wm = node.getWorldMatrix(), f = [0, 0, 0], q2 = [0, 0, 0];
    for (let i = 0; fib && i < n; i++) {
      fib.getElement(i, f);
      const d = [wm[0] * f[0] + wm[4] * f[1] + wm[8] * f[2], wm[1] * f[0] + wm[5] * f[1] + wm[9] * f[2], wm[2] * f[0] + wm[6] * f[1] + wm[10] * f[2]];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      warp([src[i * 3] + (d[0] / l) * 0.002, src[i * 3 + 1] + (d[1] / l) * 0.002, src[i * 3 + 2] + (d[2] / l) * 0.002], q2);
      const e = [q2[0] - pos[i * 3], q2[1] - pos[i * 3 + 1], q2[2] - pos[i * 3 + 2]], le = Math.hypot(e[0], e[1], e[2]) || 1;
      fibOut.set([e[0] / le, e[1] / le, e[2] / le], i * 3);
    }
    const tucked = tuck(pos, spec.cover, spec.under, spec.gap);
    const idx = Uint32Array.from(prim.getIndices().getArray());
    const out = doc.createPrimitive().setMaterial(material)
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals(pos, idx)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer));
    if (fib) out.setAttribute("_FIBER", doc.createAccessor().setType("VEC3").setArray(fibOut).setBuffer(buffer));
    for (const s of ["_ANAT", "COLOR_0"]) {
      const a = prim.getAttribute(s);
      if (!a) continue;
      // de-normalised copy (the source stores these as normalised integers)
      const m = a.getElementSize(), arr = new Float32Array(n * m), el = new Array(m).fill(0);
      for (let i = 0; i < n; i++) { a.getElement(i, el); arr.set(el, i * m); }
      out.setAttribute(s, doc.createAccessor().setType(a.getType()).setArray(arr).setBuffer(buffer));
    }
    const x = node.getExtras();
    scene.addChild(doc.createNode(node.getName()).setMesh(doc.createMesh(node.getName()).addPrimitive(out)).setExtras({ ...x, depth: spec.depth, from: "zanatomy" }));
    report.push(`${x.id} ${x.side}: ${n} vertices, ${tucked.moved} tucked under the surface muscles (up to ${(tucked.most * 1000).toFixed(1)} mm)`);
  }
}
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true);
await doc.transform(prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, quantizeGeneric: 12 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
const file = path.join("public/models/ecorche", sex, "deep.glb");
await io.write(file, doc);
console.log(`${sex}: ${N} landmarks, largest landmark miss ${(fitErr * 1000).toFixed(1)} mm`);
console.log(report.join("\n"));
console.log(`wrote ${file} (${(statSync(file).size / 1e6).toFixed(2)} MB)`);
