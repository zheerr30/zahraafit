// Builds public/models/back-shoulders/back-shoulders.glb from the Z-Anatomy
// FBX models (CC BY-SA 4.0): every muscle of the back/shoulder region as its
// own mesh per side, bones, attachment footprints (origin / insertion),
// tendons & ligaments, and peripheral nerves — in one metric frame.
//
//   node --max-old-space-size=12000 pipeline/zanatomy/build-back.mjs --za <z-anatomy repo>
import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { Vector3 } from "three";
import { TriangleSurface } from "../bodyparts3d/lib.mjs";
import { bakeAppearance } from "../bodyparts3d/bake.mjs";
import { BONES, CONTEXT_MUSCLES, DISC_PATTERN, NERVES, TENDONS, UNITS } from "./back-config.mjs";
import { fixWinding, loopSubdivide, meanEdge, normals, openEdgeShare, weld } from "./mesh.mjs";

globalThis.self = globalThis; // FBXLoader expects a browser-like global

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ZA = arg("--za", "/home/user/lluisv/z-anatomy");
const FBX = path.join(ZA, "Resources/Models/FBX");
const OUT = arg("--out", "public/models/back-shoulders");
const CM = 0.01;
/** Target mean edge length after subdivision (metres): smooth at extreme zoom. */
const TARGET_EDGE = { unit: 0.0024, context: 0.004, bone: 0.0032, attachment: 0.004, tendon: 0.0026, nerve: 0.004 };
const MAX_LEVELS = { unit: 1, context: 0, bone: 1, attachment: 0, tendon: 1, nerve: 0 };
/** Triangle caps (meshoptimizer, before refinement) for structures that are mostly hidden or seen from afar. */
const CAP = { context: 14000, attachment: 5000, bone: 16000 };

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const report = { source: "Z-Anatomy (CC BY-SA 4.0), https://github.com/LluisV/Z-Anatomy", units: {}, groups: {}, missing: [] };

// ───────────────────────── load ─────────────────────────
function loadFbx(file) {
  console.time(`load ${file}`);
  const buf = fs.readFileSync(path.join(FBX, file));
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  root.updateMatrixWorld(true);
  const list = [];
  const v = new Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    if (p.count <= 36) return; // label anchors (single triangles)
    const pos = new Float32Array(p.count * 3);
    let cx = 0;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).multiplyScalar(CM);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      cx += v.x;
    }
    cx /= p.count;
    list.push({ name: o.name, parent: o.parent?.name ?? "", pos, cx });
  });
  console.timeEnd(`load ${file}`);
  return list;
}
const SRC = {
  muscles: loadFbx("MuscularSystem100.fbx"),
  skeleton: loadFbx("SkeletalSystem100.fbx"),
  joints: loadFbx("Joints100.fbx"),
  nerves: loadFbx("NervousSystem100.fbx"),
};

const sideOf = (m) => (m.cx > 0.004 ? "l" : m.cx < -0.004 ? "r" : "m");
/** Meshes of `list` whose name is `base` (+ optional side letter), grouped by side. */
function pick(list, base) {
  const found = list.filter((m) => m.name === base || m.name === `${base}l` || m.name === `${base}r`);
  const bySide = new Map();
  for (const m of found) {
    const s = sideOf(m);
    if (!bySide.has(s)) bySide.set(s, []);
    bySide.get(s).push(m);
  }
  if (!found.length) report.missing.push(base);
  return bySide;
}
function concat(parts) {
  const n = parts.reduce((s, p) => s + p.pos.length, 0);
  const pos = new Float32Array(n);
  let o = 0;
  for (const p of parts) { pos.set(p.pos, o); o += p.pos.length; }
  return pos;
}
function prepare(rawPos) {
  const w = weld(rawPos, 1e-6);
  return { pos: w.pos, idx: w.idx };
}

// ───────────────────────── select ─────────────────────────
const items = []; // { kind, id, base, side, name, pos, idx, ... }
for (const u of UNITS) {
  report.units[u.id] = { parts: {} };
  for (const base of u.meshes) {
    for (const [side, parts] of pick(SRC.muscles, base)) {
      const m = prepare(concat(parts));
      items.push({ kind: "unit", unit: u.id, depth: u.depth, base, side, ...m });
      report.units[u.id].parts[`${base}:${side}`] = m.idx.length / 3;
    }
  }
}
const addGroup = (kind, list, names, test) => {
  for (const base of Object.keys(names)) {
    for (const [side, parts] of pick(list, base)) items.push({ kind, base, side, ...prepare(concat(parts)) });
  }
  if (test) {
    const seen = new Set();
    for (const m of list) {
      if (!test(m.name) || seen.has(m.name)) continue;
      seen.add(m.name);
      items.push({ kind, base: m.name, side: sideOf(m), ...prepare(m.pos) });
    }
  }
};
addGroup("context", SRC.muscles, CONTEXT_MUSCLES);
addGroup("bone", SRC.skeleton, BONES);
addGroup("bone", SRC.joints, {}, (n) => DISC_PATTERN.test(n));
addGroup("tendon", SRC.muscles, Object.fromEntries(Object.entries(TENDONS).filter(([k]) => /fascia|Linea_alba|bursa|sheath/.test(k))));
addGroup("tendon", SRC.joints, Object.fromEntries(Object.entries(TENDONS).filter(([k]) => !/fascia|Linea_alba|bursa|sheath/.test(k))));
addGroup("nerve", SRC.nerves, NERVES);

// Sanity: the trapezius parts must lie upper > middle > lower.
{
  const cy = (id) => { const ms = items.filter((m) => m.unit === id && m.side === "l"); let s = 0, n = 0; for (const m of ms) for (let i = 1; i < m.pos.length; i += 3) { s += m.pos[i]; n++; } return s / n; };
  const [u, mi, lo] = ["trapezius-upper", "trapezius-middle", "trapezius-lower"].map(cy);
  if (!(u > mi && mi > lo)) throw new Error(`trapezius parts out of order: ${u} ${mi} ${lo}`);
  report.trapeziusCentreY = { upper: +u.toFixed(3), middle: +mi.toFixed(3), lower: +lo.toFixed(3) };
}

// Nerves of the arm are cut at the elbow: the region ends with the humerus.
const humeri = items.filter((m) => m.kind === "bone" && m.base === "Humerus");
const elbowY = Math.min(...humeri.flatMap((h) => { let lo = Infinity; for (let i = 1; i < h.pos.length; i += 3) lo = Math.min(lo, h.pos[i]); return [lo]; })) - 0.01;
// Arm muscles of the context are cut there too (their forearm tendons would float).
for (const m of items) {
  if (m.kind !== "nerve" && m.kind !== "context") continue;
  const keep = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    const y = (m.pos[m.idx[t] * 3 + 1] + m.pos[m.idx[t + 1] * 3 + 1] + m.pos[m.idx[t + 2] * 3 + 1]) / 3;
    const x = Math.abs(m.pos[m.idx[t] * 3]);
    // the arm hangs lateral to the trunk: 12 cm for nerves, 19 cm for muscles (clear of the gluteals)
    if (!(y < elbowY && x > (m.kind === "nerve" ? 0.12 : 0.19))) keep.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]);
  }
  m.idx = new Uint32Array(keep);
}
report.elbowCutY = +elbowY.toFixed(3);

// ───────────────────────── attachments ─────────────────────────
const boneItems = items.filter((m) => m.kind === "bone" && !DISC_PATTERN.test(m.base));
const boneSurf = new Map();
const surfOf = (b) => { if (!boneSurf.has(b)) boneSurf.set(b, new TriangleSurface(b.pos, b.idx)); return boneSurf.get(b); };
function nearestBone(pos) {
  const n = pos.length / 3;
  let best = null, bd = Infinity;
  for (const b of boneItems) {
    // sample a few patch vertices: the centroid of a curved patch may float
    let d = 0;
    const step = Math.max(1, Math.floor(n / 24));
    let cnt = 0;
    for (let i = 0; i < n; i += step) { d += surfOf(b).distance(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); cnt++; }
    d /= cnt;
    if (d < bd) { bd = d; best = b; }
  }
  return { bone: best, distance: bd };
}
report.attachments = {};
const family = (id) => id.split("-")[0];
const unitSurf = new Map();
function unitDistance(unitId, side, pos) {
  const key = `${unitId}|${side}`;
  if (!unitSurf.has(key)) {
    const parts = items.filter((m) => m.kind === "unit" && m.unit === unitId && m.side === side);
    unitSurf.set(key, parts.map((m) => new TriangleSurface(m.pos, m.idx)));
  }
  const n = pos.length / 3, step = Math.max(1, Math.floor(n / 24));
  let d = 0, c = 0;
  for (let i = 0; i < n; i += step) { d += Math.min(...unitSurf.get(key).map((s) => s.distance(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))); c++; }
  return d / c;
}
const reFor = (prefixes) => new RegExp(`^(${prefixes.map((p) => p.replace(/[()]/g, "\\$&")).join("|")})([oe])(\\d*)([lr]?)$`);
for (const m of SRC.skeleton) {
  const direct = UNITS.filter((u) => reFor(u.meshes).test(m.name));
  const viaAlias = UNITS.filter((u) => u.patches.length && reFor(u.patches).test(m.name));
  if (!direct.length && !viaAlias.length) continue;
  const side = sideOf(m);
  const w = prepare(m.pos);
  const { bone, distance } = nearestBone(w.pos);
  if (!bone || distance > 0.006) continue;
  const suffix = (reFor(["[A-Za-z_()]+?"]).exec(m.name) ?? [])[2];
  let owners = viaAlias;
  if (direct.length) {
    // split muscles: the part whose surface touches the footprint owns it
    const sib = UNITS.filter((u) => family(u.id) === family(direct[0].id));
    owners = [sib.length > 1 && side !== "m" ? sib.map((u) => [u, unitDistance(u.id, side, w.pos)]).sort((a, b) => a[1] - b[1])[0][0] : direct[0]];
  }
  for (const u of owners) {
    const role = u.insertionBones ? (u.insertionBones.some((b) => bone.base.includes(b)) ? "insertion" : "origin") : suffix === "e" ? "insertion" : "origin";
    items.push({ kind: "attachment", unit: u.id, side, role, base: m.name, bone, ...w });
    const r = (report.attachments[u.id] ??= {});
    (r[`${role}:${side}`] ??= []).push(`${bone.base}${bone.side === "m" ? "" : `(${bone.side})`} ← ${m.name}`);
  }
}

// ───────────────────────── aponeuroses ─────────────────────────
// Z-Anatomy models the latissimus and trapezius as one sheet each, including
// their flat tendons, and those regions are not thinner than the muscle. The
// tendinous parts are marked from textbook anatomy, positioned with landmarks
// measured on this model's own vertebrae and pelvis:
//  • latissimus dorsi: the thoracolumbar aponeurosis, medial to a muscle–
//    tendon line running ≈1 cm from the midline at T7, ≈3.5 cm at T12 and
//    ≈8 cm at the iliac crest (the posterior fascia layer it fuses with spans
//    0–7.2 cm in this model);
//  • trapezius: the tendinous "diamond" around C7–T1 (≈2.8 cm half-width,
//    from C5 to T3) and the narrow strip along the spinous processes.
{
  const centreY = (base) => { const b = items.find((m) => m.kind === "bone" && m.base === base); let s = 0; for (let i = 1; i < b.pos.length; i += 3) s += b.pos[i]; return s / (b.pos.length / 3); };
  const yT7 = centreY("Vertebra_T7"), yT12 = centreY("Vertebra_T12"), yC7 = centreY("Vertebra_C7");
  const hip = items.find((m) => m.kind === "bone" && m.base === "Hip_bone");
  let crest = -Infinity; for (let i = 1; i < hip.pos.length; i += 3) crest = Math.max(crest, hip.pos[i]);
  const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const lerpY = (pts, y) => { // pts: [[y, x]...] descending y
    if (y >= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (y >= pts[i][0]) { const [y0, x0] = pts[i - 1], [y1, x1] = pts[i]; return x1 + ((y - y1) / (y0 - y1)) * (x0 - x1); }
    return pts[pts.length - 1][1];
  };
  const latLine = [[yT7 + 0.02, 0], [yT7, 0.012], [yT12, 0.035], [crest, 0.08], [crest - 0.1, 0.09]];
  for (const m of items) {
    if (m.kind !== "unit") continue;
    const n = m.pos.length / 3;
    if (m.unit === "latissimus-dorsi") {
      m.tendonFloor = new Float32Array(n);
      for (let v = 0; v < n; v++) {
        const x = Math.abs(m.pos[v * 3]), y = m.pos[v * 3 + 1];
        const edge = lerpY(latLine, y);
        m.tendonFloor[v] = edge > 0 ? 1 - ss(edge - 0.006, edge + 0.006, x) : 0;
      }
    } else if (m.unit.startsWith("trapezius")) {
      m.tendonFloor = new Float32Array(n);
      const y0 = yC7 - 0.008, half = 0.055;
      for (let v = 0; v < n; v++) {
        const x = Math.abs(m.pos[v * 3]), y = m.pos[v * 3 + 1];
        const w = 0.028 * Math.max(0, 1 - Math.abs(y - y0) / half);
        const diamond = w > 0 ? 1 - ss(w - 0.004, w + 0.004, x) : 0;
        const strip = y < y0 ? 1 - ss(0.003, 0.006, x) : 0;
        m.tendonFloor[v] = Math.max(diamond, strip);
      }
    }
  }
  report.aponeurosisLandmarks = { yC7: +yC7.toFixed(3), yT7: +yT7.toFixed(3), yT12: +yT12.toFixed(3), iliacCrest: +crest.toFixed(3) };
}

// ───────────────────────── appearance bake (coarse) ─────────────────────────
console.time("bake");
const tissue = items.filter((m) => m.kind === "unit" || m.kind === "context");
for (const m of tissue) { fixWinding(m.pos, m.idx); m.nrm = normals(m.pos, m.idx); }
const baked = bakeAppearance(tissue);
tissue.forEach((m, i) => { m.anat = baked[i].anat; m.fibre = baked[i].fibre; m.seeded = baked[i].seeded; });
console.timeEnd("bake");

// ───────────────────────── refine ─────────────────────────
console.time("subdivide");
const tri = {};
for (const m of items) {
  if (m.kind === "bone" || m.kind === "tendon" || m.kind === "nerve") fixWinding(m.pos, m.idx);
  m.srcTris = m.idx.length / 3;
  if (CAP[m.kind] && m.srcTris > CAP[m.kind]) {
    const [s] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, CAP[m.kind] * 3, 0.004, []);
    // compact, carrying baked attributes
    const remap = new Int32Array(m.pos.length / 3).fill(-1);
    let n = 0;
    for (const i of s) if (remap[i] < 0) remap[i] = n++;
    const pick = (arr, k) => { const o = new Float32Array(n * k); for (let v = 0; v < remap.length; v++) if (remap[v] >= 0) o.set(arr.subarray(v * k, v * k + k), remap[v] * k); return o; };
    m.pos = pick(m.pos, 3);
    if (m.anat) { m.anat = pick(m.anat, 2); m.fibre = pick(m.fibre, 3); }
    m.idx = Uint32Array.from(s, (i) => remap[i]);
  }
  const e0 = meanEdge(m.pos, m.idx);
  let levels = 0;
  for (let e = e0; e > TARGET_EDGE[m.kind] && levels < MAX_LEVELS[m.kind]; e /= 2) levels++;
  for (let l = 0; l < levels; l++) {
    const attrs = m.anat ? [{ array: m.anat, size: 2 }, { array: m.fibre, size: 3 }] : [];
    const s = loopSubdivide(m.pos, m.idx, attrs);
    m.pos = s.pos; m.idx = s.idx;
    if (m.anat) {
      m.anat = s.attrs[0].array;
      const f = s.attrs[1].array; // renormalise interpolated directions
      for (let i = 0; i < f.length; i += 3) { const k = Math.hypot(f[i], f[i + 1], f[i + 2]) || 1; f[i] /= k; f[i + 1] /= k; f[i + 2] /= k; }
      m.fibre = f;
    }
  }
  m.levels = levels;
  m.meanEdgeMm = +((meanEdge(m.pos, m.idx) * 1000).toFixed(2));
  m.nrm = normals(m.pos, m.idx);
  tri[m.kind] = (tri[m.kind] ?? 0) + m.idx.length / 3;
}
console.timeEnd("subdivide");

// Attachment footprints sit exactly on the (refined) bone, lifted 0.3 mm.
for (const m of items) {
  if (m.kind !== "attachment") continue;
  const s = new TriangleSurface(m.bone.pos, m.bone.idx);
  const n = m.pos.length / 3;
  for (let v = 0; v < n; v++) {
    const c = s.closest(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
    if (c.t < 0) continue;
    const [a, b, d] = [m.bone.idx[c.t * 3], m.bone.idx[c.t * 3 + 1], m.bone.idx[c.t * 3 + 2]];
    for (let k = 0; k < 3; k++) {
      const p = c.bary[0] * m.bone.pos[a * 3 + k] + c.bary[1] * m.bone.pos[b * 3 + k] + c.bary[2] * m.bone.pos[d * 3 + k];
      const nn = c.bary[0] * m.bone.nrm[a * 3 + k] + c.bary[1] * m.bone.nrm[b * 3 + k] + c.bary[2] * m.bone.nrm[d * 3 + k];
      m.pos[v * 3 + k] = p + nn * 0.0003;
    }
  }
  m.nrm = normals(m.pos, m.idx);
}

// ───────────────────────── report ─────────────────────────
report.triangles = tri;
report.meshes = {};
for (const m of items) {
  const k = `${m.kind}:${m.unit ?? m.base}:${m.kind === "unit" ? `${m.base}:` : ""}${m.side}${m.role ? `:${m.role}` : ""}`;
  report.meshes[k] = { srcTris: m.srcTris, tris: m.idx.length / 3, levels: m.levels, meanEdgeMm: m.meanEdgeMm, open: +openEdgeShare(m.idx).toFixed(3), ...(m.seeded ? { fibres: m.seeded } : {}) };
}
for (const u of UNITS) {
  const sides = new Set(items.filter((m) => m.kind === "unit" && m.unit === u.id).map((m) => m.side));
  report.units[u.id].sides = [...sides].sort();
}

// ───────────────────────── write ─────────────────────────
const doc = new Document();
doc.getRoot().getAsset().copyright =
  "Z-Anatomy models (c) Gauthier Kervyn / Z-Anatomy, CC BY-SA 4.0 (https://github.com/LluisV/Z-Anatomy), " +
  "based on BodyParts3D (c) The Database Center for Life Science. Region extract, subdivision and appearance data: MUSCLE STUDIO 3D, CC BY-SA 4.0.";
const buffer = doc.createBuffer();
const scene = doc.createScene("back-shoulders");
const groups = {};
for (const g of ["muscles", "muscles_context", "bones", "attachments", "tendons", "nerves"]) scene.addChild((groups[g] = doc.createNode(g)));
const groupOf = { unit: "muscles", context: "muscles_context", bone: "bones", attachment: "attachments", tendon: "tendons", nerve: "nerves" };
for (const m of items) {
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(m.pos).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(m.nrm).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(m.pos.length / 3 > 65535 ? m.idx : Uint16Array.from(m.idx)).setBuffer(buffer));
  if (m.anat) {
    prim
      .setAttribute("_ANAT", doc.createAccessor().setType("VEC2").setArray(m.anat).setBuffer(buffer))
      .setAttribute("_FIBER", doc.createAccessor().setType("VEC3").setArray(m.fibre).setBuffer(buffer));
  }
  const id = m.kind === "unit" || m.kind === "attachment" ? m.unit : m.base;
  const disc = DISC_PATTERN.exec(m.base) && /^Intervertebral_disc_(.+)$/.exec(m.base)[1].replace("-", "–");
  const ar = disc ? `القرص بين الفقرتين ${disc}` : (CONTEXT_MUSCLES[m.base] ?? TENDONS[m.base] ?? NERVES[m.base] ?? BONES[m.base] ?? null);
  const name = [m.kind, id, m.side, m.kind === "unit" ? m.base : m.role ?? ""].filter(Boolean).join("|");
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)).setExtras({
    kind: m.kind,
    id,
    side: m.side,
    source: m.base,
    ...(ar ? { ar } : {}),
    ...(m.kind === "unit" ? { depth: m.depth } : {}),
    ...(m.kind === "attachment" ? { role: m.role, bone: m.bone.base } : {}),
  });
  groups[groupOf[m.kind]].addChild(node);
}
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await doc.transform(reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ quantizePosition: 16, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, "back-shoulders.glb");
await io.write(file, doc);
report.bytes = fs.statSync(file).size;
fs.writeFileSync(path.join(OUT, "build-report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ triangles: tri, bytes: report.bytes, missing: report.missing, counts: Object.fromEntries(Object.entries(groupOf).map(([k]) => [k, items.filter((m) => m.kind === k).length])) }, null, 1));
