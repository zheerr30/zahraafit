// Chest & abdomen redesign (prototype) — visual geometry built FROM the original
// Z-Anatomy meshes, keeping identity, placement, attachments, fibre direction and
// relationships:
//
//   1. remesh: interpolating PN refinement until edges are ≤ ~3 mm (original vertices kept);
//   2. pin: author tendon / aponeurosis faces, bone contact (origins / insertions) and
//      seams with the neighbouring parts never move;
//   3. fair: Taubin λ|μ smoothing (volume-preserving) on the free belly only —
//      removes the scan wrinkles and lumps of the source;
//   4. volume: belly fullness along the normal, only on the exposed (outer) surface,
//      zero at the attachments, maximum mid-belly (geodesic distance from pins);
//      for the rectus this yields one bulge per segment between its tendinous
//      intersections;
//   5. rectus: clean tendinous-intersection bands from the author's own intersection
//      faces (heights clustered from the data), replacing ragged face flags;
//   6. sheath: oblique aponeurosis vertices lying on the rectus follow its new surface;
//   7. normals recomputed (welded); fibres, AO carried over.
//
// Output: public/models/zanatomy/<sex>/sculpt-trunk.glb (only the redesigned meshes,
// matched by Z-Anatomy name at load time) + a report with the measured changes.
//
//   node pipeline/sculpt/trunk.mjs public/models/zanatomy male
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MeshBVH } from "three-mesh-bvh";

const [root = "public/models/zanatomy", sex = "male"] = process.argv.slice(2);

/** Muscles redesigned in the prototype, with the belly volume added (metres). */
const TARGETS = [
  { re: /^Clavicular head of pectoralis major/, amp: 0.004 },
  { re: /^Sternocostal head of pectoralis major/, amp: 0.005 },
  { re: /^\(Abdominal part of pectoralis major/, amp: 0.003 },
  { re: /^Pectoralis minor/, amp: 0 },
  { re: /^Serratus anterior/, amp: 0.0015 },
  { re: /^External abdominal oblique/, amp: 0.002, sheath: true },
  { re: /^Internal abdominal oblique/, amp: 0, sheath: true },
  { re: /^Rectus abdominis/, amp: 0.0035, rectus: true },
  { re: /^Pyramidalis/, amp: 0.001 },
];
const MAX_EDGE = 0.003;
const FAIR_MAX = 0.002; // fairing: ≤ 2 mm from the original surface

await MeshoptDecoder.ready;
const t0 = Date.now();
const buf = readFileSync(path.join(root, sex, "core.glb"));
const gltf = await new Promise((ok, err) =>
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", ok, err),
);
gltf.scene.updateMatrixWorld(true);

/** World-space float copy of a mesh's geometry (positions, normals, all attributes). */
function worldGeometry(mesh) {
  const g = mesh.geometry;
  const out = new BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i);
    out.setAttribute(name, new BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(new BufferAttribute(Uint32Array.from(g.index.array), 1));
  out.applyMatrix4(mesh.matrixWorld); // positions + normals (uniform scale, no rotation in this file)
  return out;
}

const all = [];
gltf.scene.traverse((o) => o.isMesh && all.push(o));
const base = (m) => (m.userData.za_name ?? "").replace(/\.(l|r)$/, "");
const side = (m) => m.userData.side;

// Occluders / references (world space)
const boneGeo = mergeGeometries(all.filter((m) => m.userData.kind === "bone").map((m) => { const g = worldGeometry(m); for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k); return g; }));
const boneBVH = new MeshBVH(boneGeo);

const targets = [];
for (const m of all) {
  if (m.userData.kind !== "unit") continue;
  const t = TARGETS.find((x) => x.re.test(base(m)));
  if (t) targets.push({ mesh: m, cfg: t, name: m.userData.za_name, side: side(m), geo: worldGeometry(m) });
}
console.log(`[${sex}] ${targets.length} target meshes`);

// ── geometry helpers ───────────────────────────────────────────────
/** PN-triangle refinement (same rules as lib/three/refine.ts): original vertices unchanged. */
function pnRefine(src) {
  const P = src.getAttribute("position").array, N = src.getAttribute("normal").array;
  const names = Object.keys(src.attributes).filter((n) => n !== "position" && n !== "normal");
  const idx = src.index.array, nV = P.length / 3, nT = idx.length / 3;
  const maxV = nV + nT * 3;
  const Pp = new Float32Array(maxV * 3), Nn = new Float32Array(maxV * 3);
  Pp.set(P); Nn.set(N);
  const ex = names.map((n) => { const a = src.getAttribute(n); const o = new Float32Array(maxV * a.itemSize); o.set(a.array); return { n, s: a.itemSize, o }; });
  const key = (i) => `${Math.round(Pp[i * 3] * 1e6)},${Math.round(Pp[i * 3 + 1] * 1e6)},${Math.round(Pp[i * 3 + 2] * 1e6)}`;
  const vk = Array.from({ length: nV }, (_, i) => key(i));
  const byPos = new Map(), byIdx = new Map();
  let n = nV;
  const mid = (a, b) => {
    const ik = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (byIdx.has(ik)) return byIdx.get(ik);
    const pk = vk[a] < vk[b] ? `${vk[a]}|${vk[b]}` : `${vk[b]}|${vk[a]}`;
    const v = n++;
    const A = [Pp[a * 3], Pp[a * 3 + 1], Pp[a * 3 + 2]], B = [Pp[b * 3], Pp[b * 3 + 1], Pp[b * 3 + 2]];
    const n1 = [Nn[a * 3], Nn[a * 3 + 1], Nn[a * 3 + 2]], n2 = [Nn[b * 3], Nn[b * 3 + 1], Nn[b * 3 + 2]];
    const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const len = Math.hypot(...d);
    let m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    if (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] > 0.5 && len > 0) {
      const w12 = d[0] * n1[0] + d[1] * n1[1] + d[2] * n1[2], w21 = -(d[0] * n2[0] + d[1] * n2[1] + d[2] * n2[2]);
      const c = [0, 1, 2].map((k) => (A[k] + 3 * ((2 * A[k] + B[k] - w12 * n1[k]) / 3) + 3 * ((2 * B[k] + A[k] - w21 * n2[k]) / 3) + B[k]) / 8);
      const o = [c[0] - m[0], c[1] - m[1], c[2] - m[2]], ol = Math.hypot(...o), lim = Math.min(0.2 * len, 0.0005);
      const s = ol > lim ? lim / ol : 1;
      m = [m[0] + o[0] * s, m[1] + o[1] * s, m[2] + o[2] * s];
    }
    if (byPos.has(pk)) { const q = byPos.get(pk); m = [Pp[q * 3], Pp[q * 3 + 1], Pp[q * 3 + 2]]; } else byPos.set(pk, v);
    Pp.set(m, v * 3);
    const nn = [n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]], nl = Math.hypot(...nn) || 1;
    Nn.set([nn[0] / nl, nn[1] / nl, nn[2] / nl], v * 3);
    for (const e of ex) {
      const flip = e.n === "_fiber" && e.o[a * 3] * e.o[b * 3] + e.o[a * 3 + 1] * e.o[b * 3 + 1] + e.o[a * 3 + 2] * e.o[b * 3 + 2] < 0 ? -1 : 1;
      for (let k = 0; k < e.s; k++) e.o[v * e.s + k] = (e.o[a * e.s + k] + flip * e.o[b * e.s + k]) / 2;
    }
    byIdx.set(ik, v);
    return v;
  };
  const out = new Uint32Array(nT * 12);
  for (let t = 0; t < nT; t++) {
    const a = idx[3 * t], b = idx[3 * t + 1], c = idx[3 * t + 2];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    out.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], t * 12);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(Pp.slice(0, n * 3), 3));
  g.setAttribute("normal", new BufferAttribute(Nn.slice(0, n * 3), 3));
  for (const e of ex) g.setAttribute(e.n, new BufferAttribute(e.o.slice(0, n * e.s), e.s));
  g.setIndex(new BufferAttribute(out, 1));
  return g;
}
function medianEdge(g) {
  const P = g.getAttribute("position").array, I = g.index.array, L = [];
  for (let t = 0; t < I.length; t += 3 * 7) { const a = I[t], b = I[t + 1]; L.push(Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2])); }
  L.sort((x, y) => x - y);
  return L[Math.floor(L.length / 2)];
}
/** Welded vertex graph: canonical index per position + neighbour lists. */
function weld(g) {
  const P = g.getAttribute("position").array, I = g.index.array, n = P.length / 3;
  const map = new Map(), canon = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = `${Math.round(P[i * 3] * 1e6)},${Math.round(P[i * 3 + 1] * 1e6)},${Math.round(P[i * 3 + 2] * 1e6)}`; if (!map.has(k)) map.set(k, i); canon[i] = map.get(k); }
  const nb = new Map();
  const add = (a, b) => { if (a === b) return; if (!nb.has(a)) nb.set(a, new Set()); nb.get(a).add(b); };
  for (let t = 0; t < I.length; t += 3) for (const [a, b] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) { add(canon[a], canon[b]); add(canon[b], canon[a]); }
  const reps = [...new Set(canon)];
  return { canon, reps, nb };
}
function computeNormals(g, canon) {
  const P = g.getAttribute("position").array, I = g.index.array, n = P.length / 3;
  const acc = new Float32Array(n * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = canon[I[t]], b = canon[I[t + 1]], c = canon[I[t + 2]];
    const u = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]], v = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const x of [a, b, c]) { acc[x * 3] += f[0]; acc[x * 3 + 1] += f[1]; acc[x * 3 + 2] += f[2]; }
  }
  const N = g.getAttribute("normal").array;
  for (let i = 0; i < n; i++) { const c = canon[i]; const l = Math.hypot(acc[c * 3], acc[c * 3 + 1], acc[c * 3 + 2]) || 1; N[i * 3] = acc[c * 3] / l; N[i * 3 + 1] = acc[c * 3 + 1] / l; N[i * 3 + 2] = acc[c * 3 + 2] / l; }
  g.getAttribute("normal").needsUpdate = true;
}
const volumeOf = (g) => {
  const P = g.getAttribute("position").array, I = g.index.array;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  return Math.abs(v);
};
const smooth01 = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ── 1. remesh ────────────────────────────────────────────────────────
const levelOf = new Map();
for (const T of targets) {
  const k = T.name.replace(/\.(l|r)$/, "");
  let lv = 0, e = medianEdge(T.geo);
  while (e > MAX_EDGE && lv < 2) { e /= 2; lv++; }
  levelOf.set(k, Math.max(levelOf.get(k) ?? 0, lv));
}
for (const T of targets) {
  T.orig = T.geo.clone();
  T.levels = levelOf.get(T.name.replace(/\.(l|r)$/, ""));
  for (let i = 0; i < T.levels; i++) T.geo = pnRefine(T.geo);
}

// Original rectus surfaces (for the sheath coupling) and neighbour BVHs (for seams)
const rectusOrig = new Map();
for (const T of targets) if (T.cfg.rectus) rectusOrig.set(T.side, { T, bvh: new MeshBVH(T.geo.clone()) });
const neighbourBVH = new Map();
for (const T of targets) neighbourBVH.set(T, new MeshBVH(T.geo.clone()));

// Exposure occluders: every core mesh except the abdominal wall sheets over the rectus.
const occGeo = mergeGeometries(all.filter((m) => m.userData.kind !== "fascia" && !/oblique|Rectus abdominis|Investing|Pyramidalis/.test(base(m)) && (m.userData.kind === "bone" || m.userData.kind === "unit" || m.userData.kind === "tendon")).map((m) => { const g = worldGeometry(m); for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k); return g; }));
const occBVH = new MeshBVH(occGeo);

const report = { sex, generated: new Date().toISOString(), method: "PN remesh → pinned Taubin fairing → exposed belly volume → rectus intersection bands → sheath coupling", meshes: [] };
const tmpP = new Vector3(), hit = {};

for (const T of targets) {
  const g = T.geo;
  const P = g.getAttribute("position").array, N = g.getAttribute("normal").array, A = g.getAttribute("_anat").array;
  const n = P.length / 3;
  const { canon, reps, nb } = weld(g);
  const P0 = Float32Array.from(P);
  // ── 2. pins ──
  const pin = new Float32Array(n);
  const bonePin = new Float32Array(n);
  for (const i of reps) {
    tmpP.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const tendon = smooth01(0.35, 0.85, A[i * 2 + 1]);
    const db = boneBVH.closestPointToPoint(tmpP, hit, 0, 0.03)?.distance ?? 1;
    const bone = 1 - smooth01(0.003, 0.01, db);
    let seam = 0;
    for (const [U, bvh] of neighbourBVH) {
      if (U === T || U.side !== T.side) continue;
      if ((T.cfg.rectus && U.cfg.sheath) || (T.cfg.sheath && U.cfg.rectus) || (T.cfg.sheath && U.cfg.sheath)) continue;
      const d = bvh.closestPointToPoint(tmpP, hit, 0, 0.01)?.distance ?? 1;
      seam = Math.max(seam, 1 - smooth01(0.001, 0.005, d));
    }
    pin[i] = Math.max(tendon, bone, seam);
    bonePin[i] = bone;
  }
  // ── 3. Taubin fairing on the free part ──
  const free = (i) => 1 - pin[i];
  const step = (lam) => {
    const D = new Float32Array(n * 3);
    for (const i of reps) {
      const s = nb.get(i);
      if (!s || !s.size) continue;
      let x = 0, y = 0, z = 0;
      for (const j of s) { x += P[j * 3]; y += P[j * 3 + 1]; z += P[j * 3 + 2]; }
      const k = s.size, w = lam * free(i);
      D[i * 3] = w * (x / k - P[i * 3]); D[i * 3 + 1] = w * (y / k - P[i * 3 + 1]); D[i * 3 + 2] = w * (z / k - P[i * 3 + 2]);
    }
    for (const i of reps) { P[i * 3] += D[i * 3]; P[i * 3 + 1] += D[i * 3 + 1]; P[i * 3 + 2] += D[i * 3 + 2]; }
  };
  // Fairing may not move any point more than FAIR_MAX from the original surface.
  const clamp = (lim) => {
    for (const i of reps) {
      const dx = P[i * 3] - P0[i * 3], dy = P[i * 3 + 1] - P0[i * 3 + 1], dz = P[i * 3 + 2] - P0[i * 3 + 2];
      const d = Math.hypot(dx, dy, dz);
      if (d > lim) { const k = lim / d; P[i * 3] = P0[i * 3] + dx * k; P[i * 3 + 1] = P0[i * 3 + 1] + dy * k; P[i * 3 + 2] = P0[i * 3 + 2] + dz * k; }
    }
  };
  for (let it = 0; it < 18; it++) { step(0.5); step(-0.53); clamp(FAIR_MAX); }
  for (let i = 0; i < n; i++) { const c = canon[i]; if (c !== i) { P[i * 3] = P[c * 3]; P[i * 3 + 1] = P[c * 3 + 1]; P[i * 3 + 2] = P[c * 3 + 2]; } }
  computeNormals(g, canon);
  // ── 4. belly volume on the exposed surface (geodesic distance from the pins) ──
  let dispMax = 0;
  if (T.cfg.amp > 0) {
    const D = new Float32Array(n).fill(Infinity);
    const queue = [];
    for (const i of reps) if (pin[i] > 0.5) { D[i] = 0; queue.push(i); }
    // Dijkstra-light (SPFA) over the welded graph
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      for (const j of nb.get(i) ?? []) {
        const w = Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
        if (D[i] + w < D[j] - 1e-7) { D[j] = D[i] + w; queue.push(j); }
      }
    }
    let Dmax = 0;
    for (const i of reps) if (Number.isFinite(D[i])) Dmax = Math.max(Dmax, D[i]);
    const ray = new Ray();
    const sheathRef = T.cfg.sheath ? rectusOrig.get(T.side)?.bvh : null;
    for (const i of reps) {
      if (!Number.isFinite(D[i]) || Dmax <= 0) continue;
      // the aponeurosis lying on the rectus follows the rectus (step 6), no own volume
      if (sheathRef) {
        tmpP.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        if (sheathRef.closestPointToPoint(tmpP, hit, 0, 0.012)) continue;
      }
      // fullness reaches its plateau a few centimetres from the attachments
      const belly = smooth01(0, Math.min(Dmax, T.cfg.rectus ? 0.022 : 0.05), D[i]);
      if (belly <= 0) continue;
      const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
      ray.origin.set(P[i * 3] + nx * 0.0006, P[i * 3 + 1] + ny * 0.0006, P[i * 3 + 2] + nz * 0.0006);
      ray.direction.set(nx, ny, nz);
      const h = occBVH.raycastFirst(ray, DoubleSide, 0, 0.025);
      if (h) continue; // inner / covered surface: no volume added
      const amp = T.cfg.amp * belly * free(i);
      P[i * 3] += nx * amp; P[i * 3 + 1] += ny * amp; P[i * 3 + 2] += nz * amp;
      dispMax = Math.max(dispMax, amp);
    }
    for (let i = 0; i < n; i++) { const c = canon[i]; if (c !== i) { P[i * 3] = P[c * 3]; P[i * 3 + 1] = P[c * 3 + 1]; P[i * 3 + 2] = P[c * 3 + 2]; } }
    for (let it = 0; it < 4; it++) { step(0.5); step(-0.53); clamp(FAIR_MAX + T.cfg.amp); } // blend the added volume
    for (let i = 0; i < n; i++) { const c = canon[i]; if (c !== i) { P[i * 3] = P[c * 3]; P[i * 3 + 1] = P[c * 3 + 1]; P[i * 3 + 2] = P[c * 3 + 2]; } }
    computeNormals(g, canon);
  }
  // ── 5. rectus: clean tendinous intersections from the author's own faces ──
  if (T.cfg.rectus) {
    const ys = [];
    let ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) { ymin = Math.min(ymin, P0[i * 3 + 1]); ymax = Math.max(ymax, P0[i * 3 + 1]); }
    const lo = ymin + 0.14 * (ymax - ymin), hi = ymax - 0.12 * (ymax - ymin);
    for (let i = 0; i < n; i++) if (A[i * 2 + 1] > 0.5 && P0[i * 3 + 1] > lo && P0[i * 3 + 1] < hi) ys.push(P0[i * 3 + 1]);
    ys.sort((a, b) => a - b);
    const bands = [];
    let cur = [];
    for (const y of ys) { if (cur.length && y - cur[cur.length - 1] > 0.012) { bands.push(cur); cur = []; } cur.push(y); }
    if (cur.length) bands.push(cur);
    T.intersections = bands.filter((b) => b.length > 40).map((b) => b[Math.floor(b.length / 2)]);
    for (let i = 0; i < n; i++) {
      const y = P0[i * 3 + 1];
      if (y <= lo || y >= hi) continue; // keep the author's pubic and costal attachments
      let band = 0;
      for (const yk of T.intersections) band = Math.max(band, Math.exp(-(((y - yk) / 0.0038) ** 2)));
      A[i * 2 + 1] = band > 0.15 ? band : 0;
    }
  }
  T.dispMax = dispMax;
  T.pin = pin; T.bonePin = bonePin; T.P0 = P0; T.canon = canon;
}

// ── 6. sheath coupling: oblique aponeurosis vertices on the rectus follow its new surface ──
for (const T of targets) {
  if (!T.cfg.sheath) continue;
  const R = rectusOrig.get(T.side);
  if (!R) continue;
  const RP = R.T.geo.getAttribute("position").array, RP0 = R.T.P0;
  const idx = R.bvh.geometry.index.array; // reordered by MeshBVH: use its own index
  const P = T.geo.getAttribute("position").array;
  let moved = 0;
  for (let i = 0; i < P.length / 3; i++) {
    tmpP.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const h = R.bvh.closestPointToPoint(tmpP, hit, 0, 0.008);
    if (!h) continue;
    const f = h.faceIndex * 3, a = idx[f], b = idx[f + 1], c = idx[f + 2];
    // displacement of the nearest rectus vertex (by distance) — smooth enough on a 3 mm mesh
    let best = a, bd = Infinity;
    for (const v of [a, b, c]) { const d = (RP0[v * 3] - h.point.x) ** 2 + (RP0[v * 3 + 1] - h.point.y) ** 2 + (RP0[v * 3 + 2] - h.point.z) ** 2; if (d < bd) { bd = d; best = v; } }
    const w = 1 - smooth01(0.003, 0.008, h.distance);
    P[i * 3] += w * (RP[best * 3] - RP0[best * 3]); P[i * 3 + 1] += w * (RP[best * 3 + 1] - RP0[best * 3 + 1]); P[i * 3 + 2] += w * (RP[best * 3 + 2] - RP0[best * 3 + 2]);
    if (w > 0.5) moved++;
  }
  computeNormals(T.geo, T.canon);
  T.sheathMoved = moved;
}

// ── report (measured) ──
for (const T of targets) {
  const P = T.geo.getAttribute("position").array, P0 = T.P0;
  let pinnedMax = 0, mean = 0, max = 0, cnt = 0;
  for (let i = 0; i < P.length / 3; i++) {
    const d = Math.hypot(P[i * 3] - P0[i * 3], P[i * 3 + 1] - P0[i * 3 + 1], P[i * 3 + 2] - P0[i * 3 + 2]);
    max = Math.max(max, d); mean += d; cnt++;
    if (T.bonePin[i] > 0.95) pinnedMax = Math.max(pinnedMax, d);
  }
  const v0 = volumeOf(T.orig), v1 = volumeOf(T.geo);
  report.meshes.push({
    name: T.name,
    trianglesBefore: T.orig.index.count / 3,
    trianglesAfter: T.geo.index.count / 3,
    remeshLevels: T.levels,
    meanDisplacementMm: +((mean / cnt) * 1000).toFixed(2),
    maxDisplacementMm: +(max * 1000).toFixed(2),
    boneAttachmentMaxDisplacementMm: +(pinnedMax * 1000).toFixed(3),
    volumeChangePct: +(((v1 - v0) / v0) * 100).toFixed(1),
    intersectionsY: T.intersections?.map((y) => +y.toFixed(3)),
    sheathVerticesMoved: T.sheathMoved,
  });
}

// ── write the override file ──
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("sculpt-trunk");
for (const T of targets) {
  const g = T.geo;
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(Float32Array.from(g.getAttribute("position").array)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(Float32Array.from(g.getAttribute("normal").array)).setBuffer(buffer))
    .setAttribute("_ANAT", doc.createAccessor().setType("VEC2").setArray(Float32Array.from(g.getAttribute("_anat").array)).setBuffer(buffer))
    .setAttribute("_FIBER", doc.createAccessor().setType("VEC3").setArray(Float32Array.from(g.getAttribute("_fiber").array)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(Uint32Array.from(g.index.array)).setBuffer(buffer));
  const node = doc.createNode(T.mesh.name).setMesh(doc.createMesh(T.mesh.name).addPrimitive(prim)).setExtras({ za_name: T.name, sculpt: "trunk-v1" });
  scene.addChild(node);
}
await MeshoptEncoder.ready;
await doc.transform(quantize({ quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const out = path.join(root, sex, "sculpt-trunk.glb");
await io.write(out, doc);
writeFileSync(path.join(root, sex, "sculpt-trunk.json"), JSON.stringify(report, null, 1));
console.log(`[${sex}] wrote ${out} (${(readFileSync(out).length / 1e6).toFixed(2)} MB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.table(report.meshes.map((m) => ({ name: m.name.slice(0, 34), tri: `${m.trianglesBefore}→${m.trianglesAfter}`, mean: m.meanDisplacementMm, max: m.maxDisplacementMm, attach: m.boneAttachmentMaxDisplacementMm, vol: m.volumeChangePct })));
