// Deep muscles for the Écorché body.
//
// The Écorché model is an artist's écorché: it has the superficial muscles only. The deep
// ones are taken from the open Z-Anatomy body (CC BY-SA 4.0) the atlas used before, and
// fitted into the Écorché body:
//   1. bones — every bone of the Z-Anatomy skeleton is fitted onto the same bone of the
//      Écorché skeleton (each rib and each vertebra on its own), and points on its surface
//      become landmarks: where a point of that bone is in one body and in the other;
//   2. the abdominal wall has no bone under it: there the landmarks are taken on the outer
//      face of the wall muscles both bodies have (rectus, external oblique);
//   3. a smooth warp (thin-plate spline) through all landmarks carries any point of the
//      Z-Anatomy body to its place in the Écorché body;
//   4. the warped deep muscles are tucked under the Écorché muscles: no vertex is left on
//      or outside the surface of the body, and none is pushed through a bone for it;
//   5. normals are rebuilt, fibre directions follow the warp, the baked attributes of the
//      Z-Anatomy meshes (tendon mask, occlusion) are kept — the atlas draws them with its
//      own muscle material.
//
// Output: public/models/ecorche/<sex>/deep.glb and deep-lite.glb — the node metadata of the
// Z-Anatomy file (ids, Arabic names, regions), the depth given here, and `from: "zanatomy"`.
//
//   ECORCHE_WORK=/path/to/work node pipeline/ecorche/deep.mjs male|female
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { cloneDocument, meshopt, prune, quantize, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { REMOVED, nameOf } from "./names.mjs";
import { DEEP } from "./deep-list.mjs";

const sex = process.argv[2] ?? "male";
const WORK = process.env.ECORCHE_WORK;
if (!WORK) throw new Error("set ECORCHE_WORK");
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);

// ── bones both bodies have: Z-Anatomy ids → Écorché objects ─────────
// each: the Écorché object is made of separate pieces, one per Z-Anatomy bone, top to bottom.
// refine: one Écorché object for many bones whose pieces can't be told apart by height —
//         the group is fitted as a whole, then each bone settles on the nearest surface.
const TOES = ["first", "second", "third", "fourth", "fifth"];
const NUM = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
const B = (z, e, sides, k, mode = "one") => ({ z, e, sides, k, mode });
const FOOT = ["Calcaneus", "Talus", "Navicular_bone", "Cuboid_bone", "Medial_cuneiform_bone", "Intermediate_cuneiform_bone", "Lateral_cuneiform_bone",
  ...NUM.slice(0, 5).map((n) => `${n}_metatarsal_bone`), ...TOES.map((n) => `Proximal_phalanx_of_${n}_finger_of_foot`)];
const LR = ["l", "r"], M = ["m"];
const BONES = [
  B(["Hip_bone"], "Pelvis", LR, 130), B(["Sacrum"], "Sacrum", M, 28), B(["Coccyx"], "Coccyx", M, 6),
  B([1, 2, 3, 4, 5].map((n) => `Vertebra_L${n}`), "Lumbar", M, 12, "each"),
  B(Array.from({ length: 12 }, (_, i) => `Vertebra_T${i + 1}`), "Thoracic", M, 9, "each"),
  B(["Atlas_(C1)", "Axis_(C2)", "Vertebra_C3", "Vertebra_C4", "Vertebra_C5", "Vertebra_C6", "Vertebra_C7"], "Cervical", M, 8, "each"),
  B(NUM.map((n) => `${n}_rib`), "Rib_Cage", LR, 14, "each"),
  B(["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"].map((n) => `Costal_cartilage_of_${n}_rib`), "Costal_Cartilage", LR, 28),
  B(["Body_of_sternum"], "Body_Sternum", M, 14), B(["Manubrium_of_sternum"], "Manubrium_Sterni", M, 10), B(["Xiphoid_process"], "Xiphoid_Process", M, 4),
  B(["Clavicle"], "Clavicle", LR, 12), B(["Scapula"], "Scapula", LR, 44),
  B(["Humerus"], "Humerus", LR, 60), B(["Radius"], "Radius", LR, 40), B(["Ulna"], "Ulna", LR, 40),
  B(["Femur"], "Femur", LR, 140), B(["Tibia"], "Tibia", LR, 140), B(["Fibula"], "Fibula", LR, 50), B(["Patella"], "Patella", LR, 6),
  { ...B([...FOOT, ...TOES.slice(1).map((n) => `Middle_phalanx_of_${n}_finger_of_foot`), ...TOES.map((n) => `Distal_phalanx_of_${n}_finger_of_foot`)], "Foot", LR, 10, "refine"), marks: FOOT },
  B(["Frontal_bone", "Parietal_bone", "Occipital_bone", "Temporal_bone", "Zygomatic_bone", "Maxilla", "Sphenoid_bone", "Nasal_bone", "Palatine_bone", "Vomer", "Ethmoid_bone"], "Cranium", M, 70),
  B(["Mandible"], "Mandible", M, 26), B(["Hyoid_bone"], "Hyoid", M, 8), B(["Thyroid_cartilage"], "Thyroid_Cartilage", M, 8),
];
// the abdominal wall: muscles both bodies have, whose outer face gives landmarks
const WALL_Z = ["rectus-abdominis-muscle", "external-abdominal-oblique-muscle"], WALL_E = ["Rectus_Abdominis", "External Oblique"];

// ── inputs ──────────────────────────────────────────────────────────
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
// the Z-Anatomy male body is the source for both sexes: its female variant is itself a warp
const zdoc = await io.read("public/models/zanatomy/male/core-smooth.glb");
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
const sideOk = (have, want) => want === "m" || have === want;

/** Several meshes as one: { pos, idx }. */
function merge(parts) {
  const nv = parts.reduce((s, p) => s + p.pos.length / 3, 0), nt = parts.reduce((s, p) => s + p.idx.length, 0);
  const pos = new Float32Array(nv * 3), idx = new Uint32Array(nt);
  let vo = 0, to = 0;
  for (const p of parts) { pos.set(p.pos, vo * 3); for (let i = 0; i < p.idx.length; i++) idx[to + i] = p.idx[i] + vo; vo += p.pos.length / 3; to += p.idx.length; }
  return { pos, idx };
}
const zMesh = (ids, side) => merge(zNodes.filter((n) => ids.includes(n.getExtras().id) && sideOk(n.getExtras().side, side))
  .map((n) => ({ pos: zWorld(n), idx: Uint32Array.from(n.getMesh().listPrimitives()[0].getIndices().getArray()) })));
const eMesh = (names, side, keep = () => true) => merge(manifest.records.filter((r) => names.includes(r.name) && sideOk(r.side, side) && keep(r))
  .map((r) => ({ pos: f32(r.position, r.vertices * 3), idx: u32(r.index, r.triangles * 3) })));
function bvhOf(g) {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(g.pos, 3));
  geo.setIndex(new BufferAttribute(g.idx, 1));
  return new MeshBVH(geo);
}
/** The separate pieces of a mesh (corners at the same place joined), highest first. */
function pieces(g) {
  const n = g.pos.length / 3, first = new Map(), rep = new Int32Array(n), par = Int32Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i++) { const k = `${Math.round(g.pos[i * 3] * 1e4)},${Math.round(g.pos[i * 3 + 1] * 1e4)},${Math.round(g.pos[i * 3 + 2] * 1e4)}`; let v = first.get(k); if (v === undefined) first.set(k, (v = i)); rep[i] = v; }
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < g.idx.length; t += 3) { const a = find(rep[g.idx[t]]); par[find(rep[g.idx[t + 1]])] = a; par[find(rep[g.idx[t + 2]])] = a; }
  const groups = new Map();
  for (let t = 0; t < g.idx.length; t += 3) { const c = find(rep[g.idx[t]]); (groups.get(c) ?? groups.set(c, []).get(c)).push(t); }
  const out = [];
  for (const tris of groups.values()) {
    if (tris.length < 12) continue;
    const map = new Map(), pos = [], idx = new Uint32Array(tris.length * 3);
    let top = -Infinity;
    tris.forEach((t, j) => { for (let c = 0; c < 3; c++) { const v = g.idx[t + c]; let m = map.get(v); if (m === undefined) { map.set(v, (m = pos.length / 3)); pos.push(g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]); top = Math.max(top, g.pos[v * 3 + 1]); } idx[j * 3 + c] = m; } });
    out.push({ pos: Float32Array.from(pos), idx, top });
  }
  return out.sort((a, b) => b.top - a.top);
}

// ── fitting one bone onto another ───────────────────────────────────
const dist3 = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const boxOf = (p) => { const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) { if (p[i + c] < b.min[c]) b.min[c] = p[i + c]; if (p[i + c] > b.max[c]) b.max[c] = p[i + c]; } return b; };
const sample = (p, most) => { const n = p.length / 3, step = Math.max(1, Math.floor(n / most)), out = []; for (let i = 0; i < n; i += step) out.push([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]); return out; };
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3], m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7], m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
const mean = (pts) => { const c = [0, 0, 0]; for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return c.map((v) => v / pts.length); };
/** Centre, longest direction and how much longer it is than the rest. */
function longAxis(pts) {
  const c = mean(pts), C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of pts) { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += d[i] * d[j]; }
  let v = [0.3, 1, 0.2], l = 0;
  for (let k = 0; k < 60; k++) { const w = [C[0] * v[0] + C[1] * v[1] + C[2] * v[2], C[3] * v[0] + C[4] * v[1] + C[5] * v[2], C[6] * v[0] + C[7] * v[1] + C[8] * v[2]]; l = Math.hypot(...w); v = w.map((x) => x / l); }
  return { c, dir: v, long: l / Math.max(1e-12, C[0] + C[4] + C[8] - l), len: Math.sqrt(l / pts.length) };
}
const inv3T = (m) => { // inverse transpose of a 3 × 3
  const [a, b, c, d, e, f, g, h, i] = m, det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [(e * i - f * h) / det, (f * g - d * i) / det, (d * h - e * g) / det, (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det, (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det];
};
/** The turn, even scaling and shift that best carries the points `a` onto the points `b`. */
function similarity(a, b, fixed) {
  const ca = mean(a), cb = mean(b), H = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let va = 0;
  for (let k = 0; k < a.length; k++) { const p = [a[k][0] - ca[0], a[k][1] - ca[1], a[k][2] - ca[2]], q = [b[k][0] - cb[0], b[k][1] - cb[1], b[k][2] - cb[2]]; va += p[0] * p[0] + p[1] * p[1] + p[2] * p[2]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H[i * 3 + j] += q[i] * p[j]; }
  let R = H.map((x) => x / Math.max(1e-12, va));
  for (let k = 0; k < 40; k++) { const t = inv3T(R); R = R.map((x, i) => 0.5 * (x + t[i])); }
  let tr = 0;
  for (let i = 0; i < 9; i++) tr += R[i] * H[i];
  const s = fixed ?? tr / va;
  return [s * R[0], s * R[1], s * R[2], cb[0] - s * (R[0] * ca[0] + R[1] * ca[1] + R[2] * ca[2]), s * R[3], s * R[4], s * R[5], cb[1] - s * (R[3] * ca[0] + R[4] * ca[1] + R[5] * ca[2]), s * R[6], s * R[7], s * R[8], cb[2] - s * (R[6] * ca[0] + R[7] * ca[1] + R[8] * ca[2])];
}
function solveSmall(Mx, rhs) { // Gauss–Jordan, n × n, several right-hand sides
  const n = Mx.length, a = Mx.map((r, i) => [...r, ...rhs[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k < a[r].length; k++) a[r][k] -= f * a[c][k]; }
  }
  return a.map((r, i) => r.slice(n).map((v) => v / r[i]));
}
/** The best linear map (stretch and shear allowed) carrying `a` onto `b`. */
function affine(a, b) {
  const ca = mean(a), N = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], R = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let k = 0; k < a.length; k++) { const p = [a[k][0] - ca[0], a[k][1] - ca[1], a[k][2] - ca[2], 1]; for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) N[i][j] += p[i] * p[j]; for (let c = 0; c < 3; c++) R[i][c] += p[i] * b[k][c]; } }
  const X = solveSmall(N, R); // 4 rows (x, y, z, 1) × 3 outputs
  const m = [];
  for (let c = 0; c < 3; c++) m.push(X[0][c], X[1][c], X[2][c], X[3][c] - (X[0][c] * ca[0] + X[1][c] * ca[1] + X[2][c] * ca[2]));
  return m;
}
const tmpV = new Vector3(), tmpHit = { point: new Vector3(), distance: 0, faceIndex: 0 };
function nearest(bvh, p) { bvh.closestPointToPoint(tmpV.set(p[0], p[1], p[2]), tmpHit); return { q: [tmpHit.point.x, tmpHit.point.y, tmpHit.point.z], d: tmpHit.distance }; }
const inv34 = (m) => { // inverse of a 3 × 4 map
  const t = inv3T([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]), r = [t[0], t[3], t[6], t[1], t[4], t[7], t[2], t[5], t[8]];
  return [r[0], r[1], r[2], -(r[0] * m[3] + r[1] * m[7] + r[2] * m[11]), r[3], r[4], r[5], -(r[3] * m[3] + r[4] * m[7] + r[5] * m[11]), r[6], r[7], r[8], -(r[6] * m[3] + r[7] * m[7] + r[8] * m[11])];
};
/**
 * Fits the mesh `src` (a Z-Anatomy bone) onto the mesh `dst` (the same Écorché bone): pairs
 * of closest points, best map, again. The pairs go both ways — every part of each bone
 * looks for its place on the other — so a bone can't slide along its shaft or shrink into
 * the other. First the bone keeps its proportions; `stretch` then lets it stretch a little.
 * `from`: the map to start
 * from (default: box onto box, or, for a long bone, shaft onto shaft); with `rigid` the
 * bone only settles (turn and shift) on the nearest surface, one way.
 */
function fit(src, dst, { from, stretch = true, rigid = false, rounds = 30 } = {}) {
  const S = sample(src.pos, 1400), T = sample(dst.pos, 1400), bvh = bvhOf(dst), back = bvhOf(src);
  const a = longAxis(S), b = longAxis(T), isLong = a.long > 6 && b.long > 6;
  let m = from;
  if (!m) {
    if (isLong) { // a long bone: shaft onto shaft, turned as little as possible
      if (a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2] < 0) b.dir = b.dir.map((x) => -x);
      const ends = (ax) => [-1.6, -0.8, 0, 0.8, 1.6].map((t) => ax.c.map((c, i) => c + ax.dir[i] * ax.len * t));
      // two extra points off the shaft keep the turn about it as it was
      const side = [a.dir[1], -a.dir[0], 0], off = (ax, k) => ax.c.map((c, i) => c + side[i] * 0.02 * k);
      m = similarity([...ends(a), off(a, 1), off(a, -1)], [...ends(b), off(b, b.len / a.len), off(b, -b.len / a.len)]);
    } else {
      const x = boxOf(src.pos), y = boxOf(dst.pos), k = [0, 1, 2].map((c) => (y.max[c] - y.min[c]) / Math.max(1e-6, x.max[c] - x.min[c]));
      m = [k[0], 0, 0, y.min[0] - k[0] * x.min[0], 0, k[1], 0, y.min[1] - k[1] * x.min[1], 0, 0, k[2], y.min[2] - k[2] * x.min[2]];
    }
  }
  const scale = Math.cbrt(Math.abs(m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8])));
  let rms = 0;
  for (let it = 0; it < rounds; it++) {
    const A = [], Bq = [], all = [];
    const keep = (pairs, share) => { const cut = Math.max(0.002, pairs.map((x) => x[2]).sort((x, y) => x - y)[Math.floor(pairs.length * share)]); for (const [a, b, d] of pairs) { all.push(d); if (d <= cut) { A.push(a); Bq.push(b); } } };
    keep(S.map((p) => { const h = nearest(bvh, apply(m, p)); return [p, h.q, h.d]; }), 0.9);
    if (!rigid) { const inv = inv34(m); keep(T.map((q) => { const h = nearest(back, apply(inv, q)); return [h.q, q, dist3(apply(m, h.q), q)]; }), 0.85); }
    m = rigid ? similarity(A, Bq, scale) : stretch && it >= rounds * (from ? 0.3 : 0.7) ? affine(A, Bq) : similarity(A, Bq);
    all.sort((x, y) => x - y);
    const used = all.slice(0, Math.floor(all.length * 0.85));
    rms = Math.sqrt(used.reduce((t, d) => t + d * d, 0) / used.length);
  }
  return { m, bvh, rms, shaft: a };
}
/** `k` points of a bone, spread evenly over it. */
function spread(src, k) {
  const S = sample(src.pos, 2500), out = [0], far = new Float64Array(S.length).fill(Infinity);
  while (out.length < Math.min(k, S.length)) {
    const last = S[out[out.length - 1]];
    let best = 0;
    for (let i = 0; i < S.length; i++) { far[i] = Math.min(far[i], (S[i][0] - last[0]) ** 2 + (S[i][1] - last[1]) ** 2 + (S[i][2] - last[2]) ** 2); if (far[i] > far[best]) best = i; }
    out.push(best);
  }
  return out.map((i) => S[i]);
}

// ── landmarks ───────────────────────────────────────────────────────
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const P = [], Q = [], SOFT = [], TAG = []; // Z-Anatomy points → Écorché points, and how loosely each is held
const halos = [];
const SNAP = 0.025, fits = [], LIMB = new Set(["Humerus", "Radius", "Ulna", "Femur", "Tibia", "Fibula"]);
function landmarks(src, f, k, tag, halo = false) {
  let count = 0;
  for (const p of spread(src, k)) {
    const q = apply(f.m, p), h = nearest(f.bvh, q);
    const on = h.d < SNAP ? h.q : q; // on the Écorché bone's own surface
    P.push(p); Q.push(on); SOFT.push(2e-5); TAG.push(tag);
    if (!halo || count++ % 3) continue;

    // A long bone of a limb: the flesh around it moves with it. Points 2.5 and 5 cm off the
    // shaft go where the bone's own fit takes them — without them the warp is only held on
    // the bone's surface, and squeezes or stretches what lies around it.
    const { c, dir } = f.shaft, t = (p[0] - c[0]) * dir[0] + (p[1] - c[1]) * dir[1] + (p[2] - c[2]) * dir[2];
    if (Math.abs(t) > 1.25 * f.shaft.len) continue; // not at the ends: there the next bone says where things go
    const r = [0, 1, 2].map((i) => p[i] - c[i] - dir[i] * t), l = Math.hypot(...r) || 1;
    for (const off of [0.025, 0.05]) { const ph = p.map((v, i) => v + (r[i] / l) * off); const qh = apply(f.m, ph); halos.push({ p: ph, q: qh.map((v, i) => v + on[i] - q[i]), tag }); }
  }
}
// The Écorché body is the same on both sides: the right side starts from the mirrored fit
// of the left one and only settles, so both sides come out alike.
const mirror = (m) => [m[0], -m[1], -m[2], -m[3], -m[4], m[5], m[6], m[7], -m[8], m[9], m[10], m[11]];
const leftFit = new Map();
const fitSide = (key, side, src, dst) => {
  const f = side === "r" && leftFit.has(key) ? fit(src, dst, { from: mirror(leftFit.get(key)), rounds: 10 }) : fit(src, dst);
  if (side === "l") leftFit.set(key, f.m);
  return f;
};
for (const b of BONES) {
  for (const side of b.sides) {
    const zOf = (ids) => zMesh(ids, side), whole = eMesh([b.e], side);
    if (!whole.pos.length) throw new Error(`Écorché bone not found: ${b.e} (${side})`);
    if (b.mode === "each") {
      const parts = pieces(whole);
      if (parts.length !== b.z.length) throw new Error(`${b.e} (${side}): ${parts.length} pieces for ${b.z.length} bones`);
      let prev = null; // the bone above: where a fit goes wrong, its map is a better start
      b.z.forEach((id, i) => {
        const src = zOf([id]);
        if (!src.pos.length) throw new Error(`Z-Anatomy bone not found: ${id}`);
        let f = fitSide(id, side, src, parts[i]);
        if (f.rms > 0.004 && prev) { const again = fit(src, parts[i], { from: prev.m }); if (again.rms < f.rms) { f = again; if (side === "l") leftFit.set(id, f.m); } }
        prev = f;
        fits.push([`${id} ${side}`, f.rms]); landmarks(src, f, b.k, `${id} ${side}`);
      });
    } else {
      const src = zOf(b.z);
      if (!src.pos.length) throw new Error(`Z-Anatomy bone not found: ${b.z[0]} (${side})`);
      const f = fitSide(b.e, side, src, whole);
      fits.push([`${b.e} ${side}`, f.rms]);
      if (b.mode === "refine") for (const id of b.marks) { const one = zOf([id]); if (!one.pos.length) continue; const g = fit(one, whole, { from: f.m, rigid: true, rounds: 6 }); landmarks(one, g, b.k, `${id} ${side}`); }
      else landmarks(src, f, b.k, `${b.e} ${side}`, LIMB.has(b.e));
    }
  }
}
// the points around the limb bones, except next to another bone (its landmarks say more)
for (const h of halos) {
  let free = true;
  for (let i = 0; i < P.length && free; i++) if (TAG[i] !== h.tag && dist(P[i], h.p) < 0.03) free = false;
  if (free) { P.push(h.p); Q.push(h.q); SOFT.push(1e-4); TAG.push(`${h.tag} around`); }
}
const boneLandmarks = P.length;

// the trunk's axis in each body: straight up through the middle of the rib cage and pelvis
const midZ = (p) => { const b = boxOf(p); return (b.min[2] + b.max[2]) / 2; };
const Z_AXIS = midZ(zMesh([...NUM.map((n) => `${n}_rib`), "Hip_bone"], "m").pos), E_AXIS = midZ(eMesh(["Rib_Cage", "Pelvis"], "m").pos);
{ // the abdominal wall: its outer face at the same height (between pubis and sternum) and the same angle around the trunk
  const zb = bvhOf(zMesh(WALL_Z, "m")), eb = bvhOf(eMesh(WALL_E, "m"));
  const span = (lo, hi) => [boxOf(lo).max[1], boxOf(hi).min[1]];
  const [zy0, zy1] = span(zMesh(["Pubic_symphysis"], "m").pos, zMesh(["Body_of_sternum"], "m").pos), [ey0, ey1] = span(eMesh(["Pubic_symphysis"], "m").pos, eMesh(["Body_Sternum"], "m").pos);
  const nearBone = (list, p) => { for (let i = 0; i < boneLandmarks; i++) if (dist(list[i], p) < 0.03) return true; return false; };
  const ray = new Ray(), outer = (bvh, y, ang, axisZ) => { const dx = Math.sin(ang), dz = Math.cos(ang); ray.origin.set(dx * 0.5, y, axisZ + dz * 0.5); ray.direction.set(-dx, 0, -dz); const h = bvh.raycastFirst(ray, DoubleSide); return h && h.distance < 0.49 ? [h.point.x, h.point.y, h.point.z] : null; };
  for (const f of [0.06, 0.2, 0.34, 0.48, 0.62, 0.76, 0.9]) for (let deg = -120; deg <= 120; deg += 15) {
    const a = (deg * Math.PI) / 180, p = outer(zb, zy0 + f * (zy1 - zy0), a, Z_AXIS), q = outer(eb, ey0 + f * (ey1 - ey0), a, E_AXIS);
    // only where the wall is free: next to a bone, the bone's own landmarks say where things go
    if (p && q && !nearBone(P, p) && !nearBone(Q, q)) { P.push(p); Q.push(q); SOFT.push(3e-4); TAG.push(`wall ${f} ${deg}`); }
  }
}

// ── thin-plate spline in 3D (kernel −r); `SOFT` lets a landmark be missed a little ──
const N = P.length;
function solve(a, b) { // Gaussian elimination with partial pivoting, in place; b: three columns
  const n = a.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    [a[col], a[piv]] = [a[piv], a[col]]; [b[col], b[piv]] = [b[piv], b[col]];
    const d = a[col][col], ac = a[col], bc = b[col];
    for (let r = col + 1; r < n; r++) {
      const ar = a[r], f = ar[col] / d;
      if (!f) continue;
      for (let c = col; c < n; c++) ar[c] -= f * ac[c];
      b[r][0] -= f * bc[0]; b[r][1] -= f * bc[1]; b[r][2] -= f * bc[2];
    }
  }
  for (let r = n - 1; r >= 0; r--) for (let c = 0; c < 3; c++) { let s = b[r][c]; for (let k = r + 1; k < n; k++) s -= a[r][k] * b[k][c]; b[r][c] = s / a[r][r]; }
  return b;
}
const A = Array.from({ length: N + 4 }, () => new Float64Array(N + 4));
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) A[i][j] = -dist(P[i], P[j]);
  A[i][i] = SOFT[i];
  A[i][N] = A[N][i] = 1;
  for (let c = 0; c < 3; c++) A[i][N + 1 + c] = A[N + 1 + c][i] = P[i][c];
}
const W = solve(A, [...Q.map((q) => Float64Array.from(q)), ...[0, 0, 0, 0].map(() => new Float64Array(3))]);
const PX = Float64Array.from(P.map((p) => p[0])), PY = Float64Array.from(P.map((p) => p[1])), PZ = Float64Array.from(P.map((p) => p[2]));
const WX = Float64Array.from(W.slice(0, N).map((w) => w[0])), WY = Float64Array.from(W.slice(0, N).map((w) => w[1])), WZ = Float64Array.from(W.slice(0, N).map((w) => w[2]));
function warp(p, out = [0, 0, 0]) {
  let x = W[N][0] + W[N + 1][0] * p[0] + W[N + 2][0] * p[1] + W[N + 3][0] * p[2];
  let y = W[N][1] + W[N + 1][1] * p[0] + W[N + 2][1] * p[1] + W[N + 3][1] * p[2];
  let z = W[N][2] + W[N + 1][2] * p[0] + W[N + 2][2] * p[1] + W[N + 3][2] * p[2];
  for (let i = 0; i < N; i++) { const a = p[0] - PX[i], b = p[1] - PY[i], c = p[2] - PZ[i], r = -Math.sqrt(a * a + b * b + c * c); x += WX[i] * r; y += WY[i] * r; z += WZ[i] * r; }
  out[0] = x; out[1] = y; out[2] = z;
  return out;
}
const misses = P.map((p, i) => [dist(warp(p), Q[i]), TAG[i]]).sort((a, b) => b[0] - a[0]);
const fitErr = misses[0][0];
if (process.env.DEEP_VERBOSE) console.log("landmarks missed the most (mm):", misses.slice(0, 25).map(([d, t]) => `${t} ${(d * 1000).toFixed(1)}`).join(", "));

// ── the Écorché body the muscles are fitted into ────────────────────
const ray = new Ray();
const isMuscle = (r) => r.collection === "Muscles" && !REMOVED.has(r.name) && nameOf(r.collection, r.name)?.kind === "unit";
const surface = bvhOf(eMesh(manifest.records.filter(isMuscle).map((r) => r.name), "m", isMuscle));
const skeleton = bvhOf(eMesh(manifest.records.filter((r) => ["Bones", "Skull"].includes(r.collection)).map((r) => r.name), "m", (r) => ["Bones", "Skull"].includes(r.collection)));
/** The line a muscle is wrapped around: a point on it and its direction. */
function axisOf(name, side) {
  if (name === "trunk") return { o: [0, 0, E_AXIS], d: [0, 1, 0] };
  const bones = { neck: ["Cervical"], thigh: ["Femur"], leg: ["Tibia", "Fibula"], arm: ["Humerus"], forearm: ["Radius", "Ulna"], foot: ["Foot"] }[name];
  const a = longAxis(sample(eMesh(bones, name === "neck" ? "m" : side).pos, 4000));
  return { o: a.c, d: a.dir };
}
const axes = new Map();
const axisFor = (name, side) => { const k = `${name}/${side}`; if (!axes.has(k)) axes.set(k, axisOf(name, side)); return axes.get(k); };

/**
 * Moves the vertices that lie on or outside the body's surface under it, towards the axis:
 * at least `MIN` under the outer face of the Écorché muscles, and `gap` under it where no
 * bone is in the way; and under every mesh of `below`. The move is a smooth field around
 * the axis (place along it × angle around it), the same for both faces of the muscle at a
 * place: it keeps its thickness and its surface stays even.
 */
const MIN = 0.0015, REACH = 0.008, AIR = 0.006;
function tuck(pos, axis, gap, below) {
  const n = pos.length / 3, push = new Float32Array(n), dirs = new Float32Array(n * 3), along = new Float32Array(n), around = new Float32Array(n);
  const ray = new Ray(), { o, d } = axis;
  const ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = new Vector3(...d).cross(new Vector3(...ref)).normalize(), v = new Vector3(...d).cross(u).normalize();
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const t = (x - o[0]) * d[0] + (y - o[1]) * d[1] + (z - o[2]) * d[2];
    let rx = x - o[0] - d[0] * t, ry = y - o[1] - d[1] * t, rz = z - o[2] - d[2] * t;
    const l = Math.hypot(rx, ry, rz) || 1; rx /= l; ry /= l; rz /= l;
    dirs[i * 3] = rx; dirs[i * 3 + 1] = ry; dirs[i * 3 + 2] = rz;
    along[i] = t; around[i] = Math.atan2(rx * v.x + ry * v.y + rz * v.z, rx * u.x + ry * u.y + rz * u.z);
    let must = 0, wish = 0;
    // outwards: how far under the body's surface the vertex is. The Écorché muscles are solids
    // lying against each other: the surface is where the ray leaves one and meets no other
    // within `AIR` — the faces between two muscles are not it.
    ray.origin.set(x, y, z); ray.direction.set(rx, ry, rz);
    const out = surface.raycast(ray, DoubleSide).filter((h) => h.distance < 0.2).sort((a, b) => a.distance - b.distance);
    let depth = -1; // −1: nothing over the vertex
    for (let k = 0; k < out.length; k++) {
      const leaving = out[k].face.normal.x * rx + out[k].face.normal.y * ry + out[k].face.normal.z * rz > 0, next = out[k + 1];
      if (!leaving) continue;
      if (!next) { depth = out[k].distance; break; }
      const entering = next.face.normal.x * rx + next.face.normal.y * ry + next.face.normal.z * rz < 0;
      if (entering && next.distance - out[k].distance > AIR) { depth = out[k].distance; break; }
    }
    if (depth < 0 && out.length) depth = out[out.length - 1].distance; // under faces that only enter: an open mesh
    if (depth < 0) { // on or outside the body — the first muscle inwards takes it in
      ray.direction.set(-rx, -ry, -rz);
      const inHit = surface.raycast(ray, DoubleSide).filter((h) => h.face.normal.x * rx + h.face.normal.y * ry + h.face.normal.z * rz > 0).sort((a, b) => a.distance - b.distance)[0];
      if (inHit && inHit.distance < REACH) { must = inHit.distance + MIN; wish = inHit.distance + gap; }
    } else if (depth < gap) { // close under the surface
      must = Math.max(0, MIN - depth); wish = gap - depth;
    }
    if (wish > 0) { // not through a bone
      ray.origin.set(x, y, z); ray.direction.set(-rx, -ry, -rz);
      const bone = skeleton.raycastFirst(ray, DoubleSide);
      if (bone) wish = Math.min(wish, Math.max(0, bone.distance - 0.001));
    }
    let need = Math.max(must, wish);
    // under the listed meshes: under every face of theirs that is over the vertex or just under it
    const FAR = 0.12;
    ray.origin.set(x + rx * FAR, y + ry * FAR, z + rz * FAR); ray.direction.set(-rx, -ry, -rz);
    for (const b of below) for (const h of b.raycast(ray, DoubleSide)) if (h.distance < FAR + 0.012 && h.distance + MIN > FAR) need = Math.max(need, h.distance + MIN - FAR);
    push[i] = Math.min(need, 0.04);
  }
  const CELL_T = 0.006, TURN = 120, CELL_A = (2 * Math.PI) / TURN; // 6 mm × 3°
  const wrap = (b) => ((b % TURN) + TURN) % TURN, K = (a, b) => a * 1000 + wrap(b);
  let grid = new Map();
  for (let i = 0; i < n; i++) { const k = K(Math.round(along[i] / CELL_T), Math.round(around[i] / CELL_A)); grid.set(k, Math.max(grid.get(k) ?? 0, push[i])); }
  for (let pass = 0; pass < 3; pass++) { // widen and soften: never less than what a cell needs
    const next = new Map();
    for (const [k, val] of grid) {
      const a = Math.floor(k / 1000), b = k - a * 1000;
      let sum = 0, cnt = 0;
      for (let p = -1; p <= 1; p++) for (let q = -1; q <= 1; q++) { const g = grid.get(K(a + p, b + q)); if (g !== undefined) { sum += g; cnt++; } }
      next.set(k, Math.max(val, sum / cnt));
      for (let p = -1; p <= 1; p++) for (let q = -1; q <= 1; q++) { const kk = K(a + p, b + q); if (!grid.has(kk) && !next.has(kk)) next.set(kk, val * 0.6); }
    }
    grid = next;
  }
  const at = (a, b) => grid.get(K(a, b)) ?? 0;
  let moved = 0, most = 0;
  for (let i = 0; i < n; i++) {
    const t = along[i] / CELL_T, a = around[i] / CELL_A, t0 = Math.floor(t), a0 = Math.floor(a), ft = t - t0, fa = a - a0;
    const m = (at(t0, a0) * (1 - fa) + at(t0, a0 + 1) * fa) * (1 - ft) + (at(t0 + 1, a0) * (1 - fa) + at(t0 + 1, a0 + 1) * fa) * ft;
    if (m > 1e-5) { pos[i * 3] -= dirs[i * 3] * m; pos[i * 3 + 1] -= dirs[i * 3 + 1] * m; pos[i * 3 + 2] -= dirs[i * 3 + 2] * m; moved++; most = Math.max(most, m); }
  }
  return { moved, most };
}

/**
 * Brings a muscle out of the bones. The Écorché skeleton is heavier than the Z-Anatomy one
 * (thicker shafts, larger joints): a muscle that lies on a bone there can come out partly
 * inside the bone here. Each vertex inside moves out through the nearest bone surface; the
 * move is a smooth field in space (the largest need around a place), so the muscle's other
 * face moves out with it and the muscle keeps its thickness.
 */
const insideBone = (x, y, z) => { ray.origin.set(x, y, z); ray.direction.set(0.3, 0.9, 0.2).normalize(); return skeleton.raycast(ray, DoubleSide).length % 2 === 1; };
function unbone(pos) {
  const n = pos.length / 3, need = new Float32Array(n), dir = new Float32Array(n * 3);
  let inside = 0, deepest = 0;
  for (let i = 0; i < n; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], h = nearest(skeleton, p), inB = insideBone(p[0], p[1], p[2]), s = h.d > 1e-7 ? (inB ? 1 : -1) / h.d : 0;
    for (let c = 0; c < 3; c++) dir[i * 3 + c] = (h.q[c] - p[c]) * s; // out of the bone
    if (inB) { need[i] = h.d + 0.0008; inside++; deepest = Math.max(deepest, h.d); }
  }
  if (!inside) return { inside: 0, deepest: 0 };
  const CELL = 0.007, K = (a, b, c) => `${a},${b},${c}`, cell = (v) => Math.round(v / CELL);
  let grid = new Map();
  for (let i = 0; i < n; i++) if (need[i] > 0) { const k = K(cell(pos[i * 3]), cell(pos[i * 3 + 1]), cell(pos[i * 3 + 2])); grid.set(k, Math.max(grid.get(k) ?? 0, need[i])); }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Map();
    for (const [k, val] of grid) {
      const [a, b, c] = k.split(",").map(Number);
      let sum = 0, cnt = 0;
      for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) for (let w = -1; w <= 1; w++) { const g = grid.get(K(a + u, b + v, c + w)); if (g !== undefined) { sum += g; cnt++; } }
      next.set(k, Math.max(val, sum / cnt));
      for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) for (let w = -1; w <= 1; w++) { const kk = K(a + u, b + v, c + w); if (!grid.has(kk) && !next.has(kk)) next.set(kk, val * 0.6); }
    }
    grid = next;
  }
  const at = (a, b, c) => grid.get(K(a, b, c)) ?? 0;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3] / CELL, y = pos[i * 3 + 1] / CELL, z = pos[i * 3 + 2] / CELL, x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), fx = x - x0, fy = y - y0, fz = z - z0;
    let m = 0;
    for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) for (let w = 0; w < 2; w++) m += at(x0 + u, y0 + v, z0 + w) * (u ? fx : 1 - fx) * (v ? fy : 1 - fy) * (w ? fz : 1 - fz);
    m = Math.max(m, need[i]);
    if (m > 1e-5) for (let c = 0; c < 3; c++) pos[i * 3 + c] += dir[i * 3 + c] * m;
  }
  return { inside, deepest };
}
/** What is still inside a bone after everything is laid on its surface. */
function settle(pos) {
  let left = 0;
  for (let i = 0; i < pos.length / 3; i++) {
    if (!insideBone(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])) continue;
    const h = nearest(skeleton, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]), out = h.d > 1e-6 ? 1 + 0.0006 / h.d : 1;
    for (let c = 0; c < 3; c++) pos[i * 3 + c] += (h.q[c] - pos[i * 3 + c]) * out;
    left++;
  }
  return left;
}

/** Smooth vertex normals (corners at the same place share one). */
function normals(pos, idx) {
  const n = pos.length / 3, acc = new Float32Array(n * 3), rep = new Uint32Array(n), first = new Map();
  for (let i = 0; i < n; i++) { const k = `${Math.round(pos[i * 3] * 2e5)},${Math.round(pos[i * 3 + 1] * 2e5)},${Math.round(pos[i * 3 + 2] * 2e5)}`; let r = first.get(k); if (r === undefined) first.set(k, (r = i)); rep[i] = r; }
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    a.fromArray(pos, idx[t] * 3); b.fromArray(pos, idx[t + 1] * 3); c.fromArray(pos, idx[t + 2] * 3);
    b.sub(a); c.sub(a); b.cross(c);
    for (const vi of [idx[t], idx[t + 1], idx[t + 2]]) { const r = rep[vi]; acc[r * 3] += b.x; acc[r * 3 + 1] += b.y; acc[r * 3 + 2] += b.z; }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = rep[i], l = Math.hypot(acc[r * 3], acc[r * 3 + 1], acc[r * 3 + 2]) || 1; out[i * 3] = acc[r * 3] / l; out[i * 3 + 1] = acc[r * 3 + 1] / l; out[i * 3 + 2] = acc[r * 3 + 2] / l; }
  return out;
}

if (process.env.DEEP_DEBUG) { // how well the warp lays the Z-Anatomy bones on the Écorché ones, and a muscle before tucking
  for (const [zid, e] of [["Tibia", "Tibia"], ["Fibula", "Fibula"], ["Femur", "Femur"], ["Hip_bone", "Pelvis"], ["Radius", "Radius"]]) {
    const src = zMesh([zid], "l").pos, bvh = bvhOf(eMesh([e], "l")), ds = [];
    for (let i = 0; i < src.length; i += 3 * 7) ds.push(nearest(bvh, warp([src[i], src[i + 1], src[i + 2]])).d);
    ds.sort((x, y) => x - y);
    console.log(`warped ${zid} → ${e}: median ${(ds[ds.length >> 1] * 1000).toFixed(1)} mm, 90% ${(ds[Math.floor(ds.length * 0.9)] * 1000).toFixed(1)}, max ${(ds[ds.length - 1] * 1000).toFixed(1)}`);
  }
  const r2 = new Ray();
  for (const id of ["popliteus-muscle", "tibialis-posterior-muscle", "adductor-brevis"]) {
    const src = zMesh([id], "l").pos; let inside = 0, zin = 0; const zsk = bvhOf(zMesh(["Tibia", "Fibula", "Femur", "Hip_bone"], "l"));
    for (let i = 0; i < src.length; i += 3) {
      const q = warp([src[i], src[i + 1], src[i + 2]]);
      r2.origin.set(q[0], q[1], q[2]); r2.direction.set(0.3, 0.9, 0.2).normalize(); if (skeleton.raycast(r2, DoubleSide).length % 2) inside++;
      r2.origin.set(src[i], src[i + 1], src[i + 2]); if (zsk.raycast(r2, DoubleSide).length % 2) zin++;
    }
    console.log(`${id}: inside a bone before tucking ${Math.round(inside / (src.length / 3) * 100)}% (in the Z-Anatomy body itself: ${Math.round(zin / (src.length / 3) * 100)}%)`);
  }
}

// ── build ───────────────────────────────────────────────────────────
const doc = new Document();
const buffer = doc.createBuffer(), scene = doc.createScene("deep");
const material = doc.createMaterial("muscle").setBaseColorFactor([0.5, 0.2, 0.17, 1]).setRoughnessFactor(0.6).setMetallicFactor(0);
const report = [], placed = new Map(); // id → placed meshes (for `below`)
const boned = [];
const missing = [], odd = []; // muscles not found; muscles whose size changed too much
for (const spec of DEEP) {
  const kind = spec.kind ?? "unit", nodes = zNodes.filter((n) => n.getExtras().id === spec.id && n.getExtras().kind === kind);
  if (!nodes.length) { missing.push(spec.id); continue; }
  const below = (spec.below ?? []).map((id) => bvhOf(merge(placed.get(id) ?? [])));
  for (const node of nodes) {
    const prim = node.getMesh().listPrimitives()[0], src = zWorld(node), n = src.length / 3, x = node.getExtras();
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
    // a muscle of the middle (the diaphragm) is wrapped around the middle line whatever its axis
    const side = x.side === "m" ? (mean(sample(pos, 400))[0] >= 0 ? "l" : "r") : x.side;
    const boneFix = unbone(pos);
    const tucked = tuck(pos, axisFor(x.side === "m" && spec.axis !== "neck" ? "trunk" : spec.axis, side), spec.gap, below);
    const idx = Uint32Array.from(prim.getIndices().getArray());
    (placed.get(spec.id) ?? placed.set(spec.id, []).get(spec.id)).push({ pos, idx });
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
    scene.addChild(doc.createNode(node.getName()).setMesh(doc.createMesh(node.getName()).addPrimitive(out)).setExtras({ ...x, depth: spec.depth, from: "zanatomy" }));
    const left = settle(pos);
    if (boneFix.inside / n > 0.15 && boneFix.deepest > 0.006) boned.push(`${x.id} ${x.side} ${Math.round((boneFix.inside / n) * 100)}% up to ${(boneFix.deepest * 1000).toFixed(1)} mm (${Math.round((left / n) * 100)}% flattened)`);
    const diag = (b) => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]), grew = diag(boxOf(pos)) / diag(boxOf(src));
    if (grew > 1.4 || grew < 0.7) odd.push(`${x.id} ${x.side} ×${grew.toFixed(2)}`);
    report.push(`${x.id} ${x.side}: ${n} vertices, ${tucked.moved} moved under the surface (up to ${(tucked.most * 1000).toFixed(1)} mm)`);
  }
}
if (missing.length) throw new Error(`not in the Z-Anatomy body: ${missing.join(", ")}`);
if (odd.length) console.log(`size changed a lot: ${odd.join(", ")}`);
if (boned.length) console.log(`were partly inside a bone, brought out: ${boned.join(", ")}`);

console.log(`${sex}: ${N} landmarks (${boneLandmarks} on bones), largest landmark miss ${(fitErr * 1000).toFixed(1)} mm`);
const worst = [...fits].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, r]) => `${k} ${(r * 1000).toFixed(1)}`).join(", ");
console.log(`bone fits, the loosest (mm): ${worst}`);
if (process.env.DEEP_FITS) console.log(fits.map(([k, r]) => `${k} ${(r * 1000).toFixed(1)}`).join(", "));
if (process.env.DEEP_VERBOSE) console.log(report.join("\n"));
else console.log(`${report.length} meshes; moved the most: ${[...report].sort((a, b) => parseFloat(b.split("up to ")[1]) - parseFloat(a.split("up to ")[1])).slice(0, 6).join(" | ")}`);

doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true);
const pack = [prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8, quantizeGeneric: 12 }), meshopt({ encoder: MeshoptEncoder, level: "high" })];
const write = async (d, name) => { const file = path.join("public/models/ecorche", sex, name); await io.write(file, d); console.log(`wrote ${file} (${(statSync(file).size / 1e6).toFixed(2)} MB)`); };
// phones: the same muscles with fewer triangles
const lite = cloneDocument(doc);
await lite.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.002, lockBorder: false }), ...pack);
await doc.transform(...pack);
await write(doc, "deep.glb");
await write(lite, "deep-lite.glb");
