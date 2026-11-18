// Geometry audit of exported Z-Anatomy meshes: density, edge length, faceting (dihedral angle), UVs.
// node pipeline/audit/geometry.mjs <export.glb> <regex on za_name>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const want = new RegExp(process.argv[3]);
const rows = [];
for (const node of doc.getRoot().listNodes()) {
  const x = node.getExtras(); const mesh = node.getMesh();
  if (!mesh || !x || !want.test(x.za_name ?? "")) continue;
  // Merge all primitives (Z-Anatomy splits muscle and "Tendon" faces into separate material slots).
  const prims = mesh.listPrimitives();
  const pos = [], idx = [];
  for (const pr of prims) {
    const P = pr.getAttribute("POSITION"), I = pr.getIndices(), o = pos.length;
    for (let i = 0; i < P.getCount(); i++) pos.push(P.getElement(i, [0, 0, 0]));
    for (let i = 0; i < I.getCount(); i++) idx.push(I.getScalar(i) + o);
  }
  const prim = prims[0], N = prim.getAttribute("NORMAL");
  const I = { getCount: () => idx.length, getScalar: (i) => idx[i] };
  const s = node.getWorldMatrix()[0];
  const nv = pos.length, nt = idx.length / 3;
  const p = (i) => pos[i];
  const edges = []; const fn = [];
  const e2f = new Map();
  for (let t = 0; t < nt; t++) {
    const a = I.getScalar(3 * t), b = I.getScalar(3 * t + 1), c = I.getScalar(3 * t + 2);
    const A = p(a), B = p(b), C = p(c);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; fn.push(n.map((q) => q / l));
    for (const [i, j] of [[a, b], [b, c], [c, a]]) {
      const k = i < j ? `${i},${j}` : `${j},${i}`;
      if (!e2f.has(k)) { e2f.set(k, []); const X = p(i), Y = p(j); edges.push(Math.hypot(X[0] - Y[0], X[1] - Y[1], X[2] - Y[2])); }
      e2f.get(k).push(t);
    }
  }
  const dih = [];
  for (const f of e2f.values()) if (f.length === 2) { const a = fn[f[0]], b = fn[f[1]]; dih.push(Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI); }
  edges.sort((a, b) => a - b); dih.sort((a, b) => a - b);
  const q = (arr, f) => arr[Math.floor(arr.length * f)];
  rows.push({ name: x.za_name, prims: prims.map((q) => q.getMaterial()?.getName()).join("+"), tris: nt, verts: nv, medEdgeMm: +(q(edges, 0.5) * s * 1000).toFixed(2), p95EdgeMm: +(q(edges, 0.95) * s * 1000).toFixed(2), medDihedral: +q(dih, 0.5).toFixed(1), p95Dihedral: +q(dih, 0.95).toFixed(1), uv: !!prim.getAttribute("TEXCOORD_0"), normals: !!N, scale: s });
}
console.table(rows);
// Area-weighted summary
const tot = rows.reduce((a, r) => a + r.tris, 0);
console.log("total tris", tot);
