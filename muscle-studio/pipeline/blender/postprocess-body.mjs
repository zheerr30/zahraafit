// Web post-process of the full-body Blender export (export_body.py).
// Geometry is NOT simplified, subdivided or re-meshed: every triangle of the
// export is kept (asserted per structure). The script:
//   1. merges each structure's primitives (one per Blender material slot) into
//      one, keeping the author's Tendon / Cartilage faces as vertex data;
//   2. names and groups the structures for both viewers (atlas + editor),
//      adds Arabic names, regions, TA2 / Latin / hierarchy (already in extras);
//   3. assigns origin / insertion patches to their muscle;
//   4. computes the depth layer of every muscle by peeling (what is visible
//      from outside, then what becomes visible when that layer is removed);
//   5. bakes occlusion and fibre direction (from the author's tendons, else
//      from the muscle's own attachment patches, else its long axis);
//   6. writes male files and a female variant: the same anatomy warped to the
//      female skeleton proportions of open-anatomy-3d (thin-plate spline on
//      skeleton landmarks, as in pipeline/bodyparts3d/build.mjs) — labelled as
//      an approximation; male genital organs are left out of the female files.
//
//   node --max-old-space-size=14000 pipeline/blender/postprocess-body.mjs <export dir> <out dir>
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, prune, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { bakeAppearance } from "../bodyparts3d/bake.mjs";
import { loadGlbScene, matchIsomorphicMeshes, meshWorld, PointGrid, TriangleSurface } from "../bodyparts3d/lib.mjs";
import { farthestPoints, fitTps } from "../bodyparts3d/tps.mjs";
import { UNITS as DETAIL_UNITS } from "../zanatomy/back-config.mjs";
import { EDITOR_UNIT_OF } from "../zanatomy/editor-units.mjs";
import { arabicOf } from "../zanatomy/lexicon-ar.mjs";

const [exportDir, outDir] = process.argv.slice(2);
const OA3D = "pipeline/data/open-anatomy-3d";
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const report = { source: "Z-Anatomy Startup.blend via Blender (export_body.py)", files: {}, checks: {}, tendonSource: {}, depth: {}, regions: {}, attachments: {} };
const us = (s) => s.replace(/ /g, "_");
const slug = (s) => s.toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ───────── regions (the 10 study regions) ─────────
export function regionOf(kind, base, hierarchy) {
  const s = `${hierarchy.join(" > ")} > ${base}`;
  const n = base.toLowerCase();
  if (kind === "bone" || kind === "ligament") {
    if (/frontal|parietal|temporal|occipital|sphenoid|ethmoid|mandib|maxilla|zygomatic|nasal|lacrimal|palatine|vomer|concha|hyoid|incisor|canine|premolar|molar|malleus|incus|stapes|atlas|axis|vertebra c|disc c\d|pulposus c\d|thyroid cartilage|cricoid|arytenoid|corniculate|alar cartilage|septal cartilage|temporomandibular|stylo|sphenomandibular|pterygo|thyrohyoid|cricothyroid|cricopharyngeal|quadrangular|nuchal/.test(n)) return "head-neck";
    if (/rib\b|costal|sternum|manubrium|xiphoid|costoclavicular|interclavicular|sternoclavicular|intercostal|costotransverse|head of rib|sternocostal/.test(n)) return "chest";
    if (/^vertebra t|disc t|pulposus t|supraspinous|interspinous|flava|longitudinal|intertransverse/.test(n)) return "back";
    if (/^vertebra l|disc l|pulposus l|iliolumbar/.test(n)) return "abdomen";
    if (/scapula|clavicle|glenohumeral|acromioclavicular|coraco|conoid|trapezoid ligament|glenoid|transverse scapular|transverse humeral/.test(n)) return "shoulders";
    if (/humerus|radius|ulna|carp|metacarp|hand|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|elbow|radio|ulno|interosseous membrane of forearm|annular|oblique cord|wrist|piso|luno|scapho|trapezio|capito|triquetro/.test(n)) return "arms";
    if (/hip bone|sacrum|coccyx|pubic|sacro|acetabul|iliofemoral|ischiofemoral|pubofemoral|obturator membrane|head of femur|triradiate|interpubic/.test(n)) return "pelvis";
    if (/femur|patella|knee|menisc|cruciate|patellar|popliteal|tibial collateral|fibular collateral|infrapatellar|frenula/.test(n)) return "thigh";
    return "legs";
  }
  if (/bursa|retinacul|malleol|calcane|tibia\b|ankle|fibular|crural|plantar|of leg|digitorum longus|hallucis|tibialis/.test(n) && kind !== "unit") {
    if (/patell|knee|anserine|suprapatellar|semimembranosus bursa|biceps femoris|gastrocnemius|popliteal/.test(n)) return "thigh";
    if (/trochanteric|sciatic|piriformis|gluteal|obturator|iliopectineal|iliacus/.test(n)) return "pelvis";
    if (/acromial|subdeltoid|subacromial|infraspinatus|teres major|trapezius|coracobrachial/.test(n)) return "shoulders";
    return "legs";
  }
  if (/Cranial part|Cervical part|Suboccipital|Splenius|capitis|colli\b|Fasciae of head|Cervical fasciae/.test(s) && !/Iliocostalis|Longissimus|Spinalis|Semispinalis (colli|thoracis)|Multifidus|Rotator|Interspinales/.test(s)) return "head-neck";
  if (/Scapulohumeral|Rotator cuff|Deltoid|deltoid/.test(s) || /subacromial|subdeltoid|subcutaneous acromial|infraspinatus muscle\b|teres major muscle\b|bursa of trapezius|coracobrachial bursa/.test(n)) return "shoulders";
  if (/upper limb/.test(s)) return "arms";
  if (/Thoracic part|Fasciae of thorax/.test(s)) return "chest";
  if (/Abdominal part|Fasciae of abdomen|Endo-abdominal|inguinal|linea alba/i.test(s)) return "abdomen";
  if (/Dorsal part|Thoracolumbar/.test(s)) return "back";
  if (/Pelvic part|gluteal|Iliopsoas|Tensor fasciae|iliotibial/i.test(s)) return "pelvis";
  if (/Medial compartment of thigh/.test(s)) return "adductors";
  if (/Anterior compartment of thigh|Posterior compartment of thigh|Fasciae of lower limb/.test(s)) return /crural|plantar|leg/.test(n) ? "legs" : "thigh";
  if (/compartment of leg|Muscles of foot|Tendon sheaths of lower limb|lower limb/.test(s)) return /femoral|patell|lata|thigh/.test(n) ? "thigh" : "legs";
  return "other";
}

// ───────── read a file into structure items ─────────
async function readItems(file) {
  const doc = await io.read(file);
  const items = [];
  for (const node of doc.getRoot().listNodes()) {
    const x = node.getExtras();
    const mesh = node.getMesh();
    if (!mesh || !x?.kind || x.kind === "group") continue;
    const prims = mesh.listPrimitives();
    let nV = 0, nI = 0;
    for (const p of prims) { nV += p.getAttribute("POSITION").getCount(); nI += p.getIndices().getCount(); }
    const pos = new Float32Array(nV * 3), idx = new Uint32Array(nI), faceMat = new Uint8Array(nI / 3), vMat = new Uint8Array(nV);
    let vo = 0, io2 = 0;
    const tmp = [0, 0, 0];
    for (const p of prims) {
      const P = p.getAttribute("POSITION"), I = p.getIndices();
      const flag = /^(Tendon|Cartilage)/.test(p.getMaterial()?.getName() ?? "") ? 1 : 0;
      for (let i = 0; i < P.getCount(); i++) { pos.set(P.getElement(i, tmp), (vo + i) * 3); vMat[vo + i] = flag; }
      for (let i = 0; i < I.getCount(); i++) idx[io2 + i] = I.getScalar(i) + vo;
      faceMat.fill(flag, io2 / 3, (io2 + I.getCount()) / 3);
      vo += P.getCount();
      io2 += I.getCount();
    }
    const hierarchy = typeof x.hierarchy === "string" ? JSON.parse(x.hierarchy) : x.hierarchy ?? [];
    // A few source objects lack the .l/.r suffix and Blender's position test missed them
    // (e.g. the left "Iliocostalis colli muscle"): a structure lying clearly off the midline
    // (centroid further out than a quarter of its own width) gets its side from the geometry.
    let side = x.side;
    if (side === "m" && /^(muscle|tendon|fascia|ligament|bone|nerve)$/.test(x.kind)) {
      let cx = 0, lo = Infinity, hi = -Infinity;
      for (let i = 0; i < nV; i++) { const v = pos[i * 3]; cx += v; if (v < lo) lo = v; if (v > hi) hi = v; }
      cx /= nV;
      if (Math.abs(cx) > 0.25 * (hi - lo) && lo * hi > 0) side = cx > 0 ? "l" : "r";
    }
    items.push({ x, hierarchy, base: x.za_base, side, kind: x.kind, pos, idx, faceMat, vMat, tris: nI / 3, materialName: prims[0].getMaterial()?.getName() ?? "" });
  }
  return items;
}

/** Smooth normals, area-weighted, welded by position (no seams at material borders). */
function normals(pos, idx) {
  const key = new Map(), w = new Uint32Array(pos.length / 3);
  for (let v = 0; v < w.length; v++) {
    const k = `${Math.round(pos[v * 3] * 1e5)},${Math.round(pos[v * 3 + 1] * 1e5)},${Math.round(pos[v * 3 + 2] * 1e5)}`;
    let j = key.get(k);
    if (j === undefined) key.set(k, (j = key.size));
    w[v] = j;
  }
  const acc = new Float32Array(key.size * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { acc[w[v] * 3] += nx; acc[w[v] * 3 + 1] += ny; acc[w[v] * 3 + 2] += nz; }
  }
  const out = new Float32Array(pos.length);
  for (let v = 0; v < w.length; v++) {
    const j = w[v] * 3, l = Math.hypot(acc[j], acc[j + 1], acc[j + 2]) || 1;
    out[v * 3] = acc[j] / l; out[v * 3 + 1] = acc[j + 1] / l; out[v * 3 + 2] = acc[j + 2] / l;
  }
  return out;
}

// ───────── 1. core + attachments ─────────
console.time("read");
const core = await readItems(path.join(exportDir, "core.glb"));
const atts = await readItems(path.join(exportDir, "attachments.glb"));
console.timeEnd("read");
const muscles = core.filter((m) => m.kind === "muscle");

// atlas unit ids (16 detailed units keep their ids; every other muscle: one id per muscle, both sides)
const detailOf = new Map(DETAIL_UNITS.flatMap((u) => u.meshes.map((b) => [b.replace(/_/g, " "), u])));
for (const m of core) {
  m.region = regionOf(m.kind === "muscle" ? "unit" : m.kind, m.base, m.hierarchy);
  m.ar = arabicOf(m.base);
  if (m.kind === "muscle") {
    m.unit = detailOf.get(m.base)?.id ?? slug(m.base);
    m.editorKey = EDITOR_UNIT_OF.get(m.base) ?? null;
  }
}
report.checks.missingArabic = [...new Set(core.filter((m) => !m.ar).map((m) => m.base))];

// trapezius naming check (parts are reversed in Z-Anatomy)
const cy = (id) => { let s = 0, n = 0; for (const m of muscles) if (m.unit === id && m.side === "l") for (let i = 1; i < m.pos.length; i += 3) { s += m.pos[i]; n++; } return s / n; };
const ty = ["trapezius-upper", "trapezius-middle", "trapezius-lower"].map(cy);
if (!(ty[0] > ty[1] && ty[1] > ty[2])) throw new Error(`trapezius order ${ty}`);
report.checks.trapeziusCentreY = ty.map((v) => +v.toFixed(3));

// attachments: owner unit(s) and role
const lc = (s) => s.toLowerCase();
const ownersOf = (patchMuscle) => {
  const exact = muscles.filter((m) => m.base === patchMuscle);
  if (exact.length) return [...new Set(exact.map((m) => m.unit))];
  const pm = lc(patchMuscle);
  return [...new Set(muscles.filter((m) => m.hierarchy.map(lc).includes(pm) || lc(m.base).endsWith(`of ${pm}`)).map((m) => m.unit))];
};
const family = (id) => id.split("-")[0];
const surfCache = new Map();
const unitSurf = (unit, side) => {
  const k = `${unit}|${side}`;
  if (!surfCache.has(k)) surfCache.set(k, muscles.filter((m) => m.unit === unit && m.side === side).map((m) => new TriangleSurface(m.pos, m.idx)));
  return surfCache.get(k);
};
const meanDist = (surfs, pos) => {
  const n = pos.length / 3, step = Math.max(1, Math.floor(n / 24));
  let d = 0, c = 0;
  for (let i = 0; i < n; i += step) { d += Math.min(...surfs.map((s) => s.distance(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))); c++; }
  return d / c;
};
const detailById = new Map(DETAIL_UNITS.map((u) => [u.id, u]));
const extraAtts = [];
for (const a of atts) {
  a.boneBase = (a.x.bone_za ?? "").replace(/\.[lr]$/, "");
  a.region = regionOf("bone", a.boneBase, []);
  let owners = ownersOf(a.x.muscle);
  // a split muscle (trapezius / deltoid / rhomboids): the part whose surface touches the patch owns it
  if (owners.length === 1 && detailById.has(owners[0])) {
    const sib = DETAIL_UNITS.filter((u) => family(u.id) === family(owners[0]));
    if (sib.length > 1 && a.side !== "m" && a.x.muscle !== "Deltoid muscle") owners = [sib.map((u) => [u.id, meanDist(unitSurf(u.id, a.side), a.pos)]).sort((p, q) => p[1] - q[1])[0][0]];
  }
  if (!owners.length) { (report.checks.unownedPatches ??= []).push(a.x.za_name); continue; }
  const roleFor = (unit) => {
    const d = detailById.get(unit);
    if (d?.insertionBones) return d.insertionBones.some((b) => us(a.boneBase).includes(b)) ? "insertion" : "origin";
    return a.x.suffix === "e" ? "insertion" : "origin";
  };
  a.unit = owners[0];
  a.role = roleFor(owners[0]);
  a.ar = `${a.role === "insertion" ? "مرتكز" : "منشأ"} ${arabicOf(a.x.muscle) ?? arabicOf(muscles.find((m) => m.unit === a.unit)?.base ?? "") ?? a.x.muscle}`;
  for (const u of owners.slice(1)) extraAtts.push({ ...a, unit: u, role: roleFor(u), shared: true });
  (report.attachments[a.unit] ??= []).push(`${a.role}:${a.side}:${a.boneBase}`);
}
atts.push(...extraAtts);

// ───────── 2. depth layers by peeling ─────────
console.time("depth");
const bones = core.filter((m) => m.kind === "bone");
function exposure(layerMuscles, occluders) {
  const all = [...layerMuscles, ...occluders];
  let nT = 0, nV = 0;
  for (const m of all) { nT += m.idx.length; nV += m.pos.length; }
  // owner per VERTEX: MeshBVH reorders triangles while building, vertices stay put
  const pos = new Float32Array(nV), idx = new Uint32Array(nT), owner = new Int32Array(nV / 3);
  let vo = 0, to = 0;
  all.forEach((m, k) => {
    pos.set(m.pos, vo);
    for (let i = 0; i < m.idx.length; i++) idx[to + i] = m.idx[i] + vo / 3;
    owner.fill(k < layerMuscles.length ? k : -1, vo / 3, (vo + m.pos.length) / 3);
    vo += m.pos.length; to += m.idx.length;
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  const bvh = new MeshBVH(g);
  const dirs = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) dirs.push(new Vector3(x, y, z).normalize());
  const ray = new Ray(new Vector3(), new Vector3());
  return layerMuscles.map((m, k) => {
    const n = m.pos.length / 3, step = Math.max(1, Math.floor(n / 160));
    let seen = 0, total = 0;
    for (let v = 0; v < n; v += step) {
      total++;
      const p = new Vector3(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
      for (const d of dirs) {
        ray.origin.copy(p).addScaledVector(d, 2);
        ray.direction.copy(d).negate();
        const hit = bvh.raycastFirst(ray, DoubleSide, 0, 2.003);
        if (hit && owner[hit.face.a] === k && hit.point.distanceTo(p) < 0.004) { seen++; break; }
      }
    }
    return seen / total;
  });
}
const DEPTH_T = 0.12;
let remaining = muscles;
for (const layer of [1, 2]) {
  const e = exposure(remaining, bones);
  const next = [];
  remaining.forEach((m, k) => { if (e[k] >= DEPTH_T) m.depth = layer; else next.push(m); m.exposure ??= +e[k].toFixed(2); });
  remaining = next;
}
for (const m of remaining) m.depth = 3;
for (const m of muscles) report.depth[`${m.x.za_name}`] = m.depth;
console.timeEnd("depth");

// ───────── 3. appearance bake (author tendons, attachment seeds) ─────────
console.time("bake");
const tissue = muscles;
const welded = tissue.map((m) => {
  const map = new Map(), remap = new Uint32Array(m.pos.length / 3), wp = [];
  for (let v = 0; v < remap.length; v++) {
    const k = `${Math.round(m.pos[v * 3] * 1e6)},${Math.round(m.pos[v * 3 + 1] * 1e6)},${Math.round(m.pos[v * 3 + 2] * 1e6)}`;
    let j = map.get(k);
    if (j === undefined) { j = wp.length / 3; map.set(k, j); wp.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); }
    remap[v] = j;
  }
  const n = wp.length / 3, P = new Float32Array(wp);
  const idx = Uint32Array.from(m.idx, (i) => remap[i]);
  const nrm = normals(P, idx);
  const tend = new Float32Array(n), cnt = new Float32Array(n);
  for (let t = 0; t < m.faceMat.length; t++) for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; tend[v] += m.faceMat[t]; cnt[v] += 1; }
  for (let v = 0; v < n; v++) tend[v] = cnt[v] ? tend[v] / cnt[v] : 0;
  const share = m.faceMat.reduce((a, b) => a + b, 0) / m.faceMat.length;
  const authored = share > 0.005;
  // seeds: muscle vertices within 4 mm of this muscle's own attachment patches
  const patches = atts.filter((a) => a.unit === m.unit && a.side === m.side);
  let flowSeeds;
  if (patches.length) {
    let tot = 0;
    for (const a of patches) tot += a.pos.length;
    const pp = new Float32Array(tot);
    let o = 0;
    for (const a of patches) { pp.set(a.pos, o); o += a.pos.length; }
    const grid = new PointGrid(pp, 0.004);
    const s = [];
    for (let v = 0; v < n; v++) {
      const r = grid.knn(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], 1, 1)[0];
      if (r && r[1] < 0.004 * 0.004) s.push(v);
    }
    flowSeeds = s;
  }
  report.tendonSource[m.x.za_name] = authored ? `author ${(share * 100).toFixed(1)}%` : flowSeeds?.length >= 8 ? "thickness + attachment fibres" : "thickness";
  return { pos: P, idx, nrm, remap, ...(authored ? { tendonOverride: tend } : {}), ...(flowSeeds?.length >= 8 ? { flowSeeds } : {}) };
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
  m.fibreFrom = baked[i].seeded;
});
console.timeEnd("bake");
report.fibreSource = {};
for (const m of tissue) report.fibreSource[m.fibreFrom] = (report.fibreSource[m.fibreFrom] ?? 0) + 1;

// ───────── 4. female warp (skeleton proportions) ─────────
console.time("female-fit");
const maleOA = await loadGlbScene(path.join(OA3D, "anatomy-male.glb"));
const femaleOA = await loadGlbScene(path.join(OA3D, "anatomy-female.glb"));
// a) Z-Anatomy frame → open-anatomy-3d frame: similarity transform by ICP on the bones
const oaBones = [];
maleOA.getObjectByName("skeleton").traverse((o) => { if (o.isMesh) oaBones.push(meshWorld(o)); });
let tot = 0;
for (const b of oaBones) tot += b.idx.length;
const oaPos = new Float32Array(oaBones.reduce((s, b) => s + b.pos.length, 0)), oaIdx = new Uint32Array(tot);
{ let vo = 0, to = 0; for (const b of oaBones) { oaPos.set(b.pos, vo); for (let i = 0; i < b.idx.length; i++) oaIdx[to + i] = b.idx[i] + vo / 3; vo += b.pos.length; to += b.idx.length; } }
const oaSurf = new TriangleSurface(oaPos, oaIdx);
const zPts = [];
for (const b of bones.filter((m) => !/disc|pulposus|cartilage|incisor|canine|molar|concha/i.test(m.base))) for (let i = 0; i < b.pos.length; i += 3 * 37) zPts.push([b.pos[i], b.pos[i + 1], b.pos[i + 2]]);
let T = { s: 1, R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };
const apply = (T, p) => [0, 1, 2].map((r) => T.s * (T.R[r][0] * p[0] + T.R[r][1] * p[1] + T.R[r][2] * p[2]) + T.t[r]);
function umeyama(A, B) {
  const n = A.length, ma = [0, 0, 0], mb = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { ma[k] += A[i][k] / n; mb[k] += B[i][k] / n; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let va = 0;
  for (let i = 0; i < n; i++) {
    const a = A[i].map((x, k) => x - ma[k]), b = B[i].map((x, k) => x - mb[k]);
    va += a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += b[r] * a[c] / n;
  }
  va /= n;
  // polar decomposition of S by iteration (rotation part), scale from trace
  let R = S.map((r) => r.slice());
  for (let it = 0; it < 50; it++) {
    const inv = inv3(R), Rt = [0, 1, 2].map((r) => [0, 1, 2].map((c) => inv[c][r]));
    R = R.map((row, r) => row.map((x, c) => 0.5 * (x + Rt[r][c])));
  }
  let tr = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tr += R[r][c] * S[r][c];
  const s = tr / va;
  const t = [0, 1, 2].map((r) => mb[r] - s * (R[r][0] * ma[0] + R[r][1] * ma[1] + R[r][2] * ma[2]));
  return { s, R, t };
}
function inv3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
let icpErr = 0;
for (let it = 0; it < 12; it++) {
  const A = [], Bp = [];
  icpErr = 0;
  for (const p of zPts) {
    const q = apply(T, p);
    const c = oaSurf.closest(q[0], q[1], q[2], 8);
    if (c.t < 0) continue;
    const [i0, i1, i2] = [oaIdx[c.t * 3], oaIdx[c.t * 3 + 1], oaIdx[c.t * 3 + 2]];
    const r = [0, 1, 2].map((k) => c.bary[0] * oaPos[i0 * 3 + k] + c.bary[1] * oaPos[i1 * 3 + k] + c.bary[2] * oaPos[i2 * 3 + k]);
    icpErr += Math.sqrt(c.d2);
    if (Math.sqrt(c.d2) < 0.02) { A.push(p); Bp.push(r); }
  }
  icpErr /= zPts.length;
  T = umeyama(A, Bp);
}
report.femaleAlignment = { method: "ICP similarity, Z-Anatomy bones → open-anatomy-3d male skeleton", meanMm: +(icpErr * 1000).toFixed(2), scale: +T.s.toFixed(4), translation: T.t.map((v) => +v.toFixed(4)) };
const Tinv = (() => { const Ri = inv3(T.R); return (q) => { const d = [q[0] - T.t[0], q[1] - T.t[1], q[2] - T.t[2]]; return [0, 1, 2].map((r) => (Ri[r][0] * d[0] + Ri[r][1] * d[1] + Ri[r][2] * d[2]) / T.s); }; })();
// b) TPS male → female skeleton (open-anatomy-3d), as in the BodyParts3D build
const skS = [], skD = [];
maleOA.getObjectByName("skeleton").traverse((m) => {
  if (!m.isMesh) return;
  const f = femaleOA.getObjectByName(m.name);
  if (!f) return;
  const A = meshWorld(m), B = meshWorld(f);
  if (A.idx.length !== B.idx.length || A.pos.length !== B.pos.length) return;
  const map = matchIsomorphicMeshes(A.idx, A.pos.length / 3, B.idx, B.pos.length / 3);
  for (let v = 0; v < map.length; v++) if (map[v] >= 0) { skS.push(A.pos[v * 3], A.pos[v * 3 + 1], A.pos[v * 3 + 2]); skD.push(B.pos[map[v] * 3], B.pos[map[v] * 3 + 1], B.pos[map[v] * 3 + 2]); }
});
const lm = farthestPoints(Float32Array.from(skS), 520).filter((_, i) => i % 5 !== 0);
const pt = (arr, i) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
const tps = fitTps(lm.map((i) => pt(skS, i)), lm.map((i) => pt(skD, i)), 1);
const warp0 = (x, y, z) => Tinv(tps(...apply(T, [x, y, z])));
// The open-anatomy-3d female skeleton is not exactly bilateral (its neck leans ~6 mm to the
// left) while Z-Anatomy is mirror-symmetric about x = 0. Average the warp with its mirror so the
// female body keeps the female proportions but stays left/right symmetric.
const warp = (x, y, z) => {
  const a = warp0(x, y, z), b = warp0(-x, y, z);
  return [(a[0] - b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
};
let asym = 0, asymMax = 0;
for (const i of lm) {
  const [x, y, z] = Tinv(pt(skS, i));
  const a = warp0(x, y, z), b = warp0(-x, y, z);
  const d = Math.hypot(a[0] + b[0], a[1] - b[1], a[2] - b[2]) / 2;
  asym += d; asymMax = Math.max(asymMax, d);
}
report.femaleWarp = {
  method: "regularized thin-plate spline on open-anatomy-3d skeleton landmarks (male → female), symmetrised left/right",
  landmarks: lm.length,
  removedAsymmetryMm: { mean: +((asym / lm.length) * 1000).toFixed(1), max: +(asymMax * 1000).toFixed(1) },
  note: "approximation: male anatomy with female skeletal proportions",
};
console.timeEnd("female-fit");
const warpPos = (pos) => { const o = new Float32Array(pos.length); for (let i = 0; i < pos.length; i += 3) o.set(warp(pos[i], pos[i + 1], pos[i + 2]), i); return o; };
const warpDir = (pos, dir, wpos) => {
  const o = new Float32Array(dir.length), e = 0.002;
  for (let i = 0; i < pos.length; i += 3) {
    const q = warp(pos[i] + dir[i] * e, pos[i + 1] + dir[i + 1] * e, pos[i + 2] + dir[i + 2] * e);
    const d = [q[0] - wpos[i], q[1] - wpos[i + 1], q[2] - wpos[i + 2]], l = Math.hypot(...d) || 1;
    o[i] = d[0] / l; o[i + 1] = d[1] / l; o[i + 2] = d[2] / l;
  }
  return o;
};

// ───────── 5. write ─────────
const COPY =
  "Z-Anatomy (Gauthier Kervyn et al., https://github.com/Z-Anatomy/Models-of-human-anatomy) CC BY-SA 4.0, based on BodyParts3D (c) DBCLS. " +
  "Export & web post-process by MUSCLE STUDIO 3D, CC BY-SA 4.0.";
const BONE_RGB = [0.89, 0.86, 0.78], CART_RGB = [0.8, 0.85, 0.86];
const MALE_ONLY = /penis|testis|prostate|scrot|epididym|seminal|ductus deferens|spermatic|glans|bulbo-urethral|corpus cavernosum|corpus spongiosum/i;

function groupOf(m) {
  if (m.kind === "muscle") return m.editorKey ? "muscles" : "muscles_context";
  return { tendon: "tendons", fascia: "fasciae", ligament: "ligaments", bone: "skeleton", attachment: "attachments", nerve: "nerves", organ: "organs", vessel: "vessels", skin: "skin" }[m.kind];
}
function nodeName(m) {
  if (m.kind === "muscle" && m.editorKey) return `${m.editorKey}_${m.side}`;
  return `${us(m.base)}${m.side === "m" ? "" : `_${m.side}`}`;
}
async function writeFile(items, file, sex) {
  const doc = new (await import("@gltf-transform/core")).Document();
  doc.getRoot().getAsset().copyright = COPY + (sex === "female" ? " Female variant: male anatomy warped to open-anatomy-3d female skeletal proportions (approximation)." : "");
  const buffer = doc.createBuffer();
  const scene = doc.createScene(path.basename(file, ".glb"));
  const groups = {};
  const mats = {};
  let tris = 0;
  for (const m of items) {
    if (sex === "female" && MALE_ONLY.test(m.base)) continue;
    const pos = sex === "female" ? (m.fpos ??= warpPos(m.pos)) : m.pos;
    const nrm = normals(pos, m.idx);
    const g = groupOf(m);
    if (!groups[g]) scene.addChild((groups[g] = doc.createNode(g)));
    const matName = m.kind;
    mats[matName] ??= doc.createMaterial(matName);
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nrm).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(pos.length / 3 > 65535 ? m.idx : Uint16Array.from(m.idx)).setBuffer(buffer))
      .setMaterial(mats[matName]);
    if (m.anat) {
      const fib = sex === "female" ? (m.ffibre ??= warpDir(m.pos, m.fibre, pos)) : m.fibre;
      prim.setAttribute("_ANAT", doc.createAccessor().setType("VEC2").setArray(m.anat).setBuffer(buffer));
      prim.setAttribute("_FIBER", doc.createAccessor().setType("VEC3").setArray(fib).setBuffer(buffer));
    }
    if (m.kind === "bone" && m.vMat.some((f) => f)) {
      const col = new Float32Array(m.vMat.length * 3);
      for (let v = 0; v < m.vMat.length; v++) col.set(m.vMat[v] ? CART_RGB : BONE_RGB, v * 3);
      prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(col).setBuffer(buffer));
    }
    const name = nodeName(m) + (m.shared ? `|${m.unit}` : "");
    const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
    const kind = m.kind === "muscle" ? "unit" : m.kind;
    node.setExtras({
      kind,
      id: m.kind === "muscle" || m.kind === "attachment" ? m.unit : us(m.base),
      side: m.side,
      source: us(m.base),
      ...(m.ar ? { ar: m.ar } : {}),
      ...(m.region ? { region: m.region } : {}),
      ...(m.kind === "muscle" ? { depth: m.depth, editorKey: m.editorKey ?? undefined, fibre: m.fibreFrom } : {}),
      ...(m.kind === "attachment" ? { role: m.role, bone: us(m.boneBase), shared: !!m.shared, muscle: m.x.muscle } : {}),
      za_name: m.x.za_name,
      hierarchy: m.hierarchy,
      system: m.x.system,
      materials: typeof m.x.materials === "string" ? JSON.parse(m.x.materials) : m.x.materials,
      ...(m.x.ta2_id ? { ta2: m.x.ta2_id, latin: m.x.latin } : {}),
      ...(m.x.definition ? { definition: m.x.definition } : {}),
    });
    groups[g].addChild(node);
    tris += m.idx.length / 3;
  }
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(prune(), reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeColor: 8 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await io.write(file, doc);
  const bytes = fs.statSync(file).size;
  report.files[path.relative(outDir, file)] = { bytes, triangles: tris };
  console.log("wrote", file, (bytes / 1e6).toFixed(1), "MB", tris, "tris");
}
for (const m of [...core, ...atts]) if (m.tris !== m.idx.length / 3) throw new Error(`triangle count changed: ${m.x.za_name}`);

const parts = { core, attachments: atts };
for (const name of ["nerves", "organs", "vessels", "skin"]) {
  const f = path.join(exportDir, `${name}.glb`);
  if (!fs.existsSync(f)) continue;
  parts[name] = await readItems(f);
  for (const m of parts[name]) { m.ar = arabicOf(m.base); m.region = null; }
}
for (const sex of ["male", "female"]) {
  for (const [name, items] of Object.entries(parts)) {
    console.time(`${sex}/${name}`);
    await writeFile(items, path.join(outDir, sex, `${name}.glb`), sex);
    console.timeEnd(`${sex}/${name}`);
    if (sex === "female") for (const m of items) { delete m.fpos; delete m.ffibre; }
  }
}
fs.copyFileSync(path.join(exportDir, "definitions.json"), path.join(outDir, "definitions.json"));
report.counts = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.length]));
report.depthCounts = { 1: muscles.filter((m) => m.depth === 1).length, 2: muscles.filter((m) => m.depth === 2).length, 3: muscles.filter((m) => m.depth === 3).length };
report.regions = {};
for (const m of muscles) (report.regions[m.region] ??= new Set()).add(m.unit);
report.regions = Object.fromEntries(Object.entries(report.regions).map(([k, v]) => [k, v.size]));
fs.writeFileSync(path.join(outDir, "build-report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ files: report.files, depthCounts: report.depthCounts, regions: report.regions, fibre: report.fibreSource, align: report.femaleAlignment, missingArabic: report.checks.missingArabic, unowned: report.checks.unownedPatches?.length }, null, 1));
