// Web build of the Écorché Male & Female model (purchased; the original files are NOT in
// this repository and must never be published — only the compressed files built here are).
//
// Input: the geometry evaluated from the model file for one sex (pipeline/ecorche/dump.py, run in the
// working folder: geometry.bin + manifest.json) and the model's own textures.
// Output, per sex, in public/models/ecorche/<sex>/:
//   core.glb     muscles, tendons / aponeuroses, cartilages, eyes   (always loaded)
//   bones.glb    skeleton                                           (layer, loaded on demand)
//   fat.glb      fat pads                                           (layer)
//   vessels.glb  superficial veins                                  (layer)
//   skin.glb     skin with its clothing                             (layer)
// and the same five as *-lite.glb for phones: fewer triangles and half-size textures; the
// surface detail is in the normal maps, so the picture stays the same.
//
// Every mesh keeps one node with the atlas's metadata in `extras`: kind, id (the id the
// atlas already used for that muscle), side, Arabic / English name, region, aliases.
// The original materials are kept: the model's base colour, normal and
// occlusion-roughness maps (its UDIM tiles packed into one atlas image per set).
//
//   ECORCHE_WORK=/path/to/work ECORCHE_TEX="/path/to/2K Textures" node pipeline/ecorche/build.mjs male
import { existsSync, readFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, prune, quantize, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { nameOf } from "./names.mjs";

const sex = process.argv[2] ?? "male";
const WORK = process.env.ECORCHE_WORK, TEX = process.env.ECORCHE_TEX;
if (!WORK || !TEX) throw new Error("set ECORCHE_WORK and ECORCHE_TEX");
const OUT = path.join("public/models/ecorche", sex);
mkdirSync(OUT, { recursive: true });
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

const manifest = JSON.parse(readFileSync(path.join(WORK, sex, "manifest.json"), "utf8"));
const bin = readFileSync(path.join(WORK, sex, "geometry.bin"));
const f32 = (off, n) => new Float32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * 4));
const u32 = (off, n) => new Uint32Array(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + n * 4));

const PART_OF = { Muscles: "core", Cartilages: "core", Eyes: "core", Skull: "bones", Bones: "bones", "Fat Pads": "fat", Veins: "vessels", Skin: "skin", Clothes: "skin" };
// Share of the triangles the phone build keeps, and the largest texture side of each build.
const LITE_KEEP = { core: 0.36, bones: 0.22, fat: 0.3, vessels: 0.3, skin: 0.55 };

// ── textures ────────────────────────────────────────────────────────
const webp = (img, quality) => img.webp({ quality, effort: 5 }).toBuffer();
/** UDIM tiles side by side in one image (cols × rows, tile 1001 top-left). */
async function atlas(pattern, tiles, cols, tile, quality) {
  const rows = Math.ceil(tiles.length / cols);
  const parts = await Promise.all(tiles.map(async (t, i) => ({ input: await sharp(path.join(TEX, pattern.replace("<UDIM>", t))).resize(tile, tile).toBuffer(), left: (i % cols) * tile, top: Math.floor(i / cols) * tile })));
  return webp(sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: "#808080" } }).composite(parts), quality);
}
const single = (file, size, quality) => webp(sharp(path.join(TEX, file)).resize(size, size), quality);

/** Texture sets of the model: [base colour, normal, occlusion-roughness-metallic] as WebP buffers. */
async function textureSets(lite) {
  const k = lite ? 0.5 : 1;
  const M4 = ["1001", "1002", "1003", "1004"], B2 = ["1001", "1002"];
  const skin = sex === "female" ? "Skin/Female/Female-Mature" : "Skin/Male/Male-Fit";
  return {
    muscle: {
      base: await atlas("Muscles/MaleEcorche_Muscle_BaseColor.<UDIM>.jpg", M4, 2, 2048 * k, 84),
      normal: await atlas("Muscles/MaleEcorche_Muscle_Normal.<UDIM>.png", M4, 2, 2048 * k, 90),
      orm: await atlas("Muscles/MaleEcorche_Muscle_OcclusionRoughnessMetallic.<UDIM>.jpg", M4, 2, 1024 * k, 80),
    },
    bone: {
      base: await atlas("Skeleton/Skelton_BaseColor.<UDIM>.jpg", B2, 2, 1024 * k, 84),
      normal: await atlas("Skeleton/Skelton_Normal.<UDIM>.png", B2, 2, 2048 * k, 90),
      orm: await atlas("Skeleton/Skelton_OcclusionRoughnessMetallic.<UDIM>.jpg", B2, 2, 1024 * k, 80),
    },
    fat: { base: await single("Fat/MaleEcorche_Fat_BaseColor.jpg", 1024 * k, 84), normal: await single("Fat/MaleEcorche_Fat_Normal.png", 1024 * k, 90) },
    fatF: { base: await single("Fat/Female/Fat-Female_BaseColor.png", 1024 * k, 84), normal: await single("Fat/Female/Fat-Female_Normal.png", 1024 * k, 90) },
    skin: { base: await single(`${skin}_BaseColor.jpg`, 2048 * k, 84), normal: await single(`${skin}_Normal.png`, 2048 * k, 90) },
    sclera: { base: await single("Eyes/Sclera2_BaseColor.jpg", 512, 84) },
    iris: { base: await single("Eyes/Iris_BaseColor.jpg", 256, 86) },
  };
}
const SET_OF = { Muscle: "muscle", Cartilages: "muscle", Bone: "bone", Fat: "fat", "Fat-Female": "fatF", Skin: "skin", EyeBalls: "sclera", Iris: "iris" };
// Parts without an image: the colours the model's own materials give them.
const FLAT = { "Vein.002": { color: [0.0138, 0.0273, 0.104, 1], roughness: 0.3 }, Fabric: { color: [0.02, 0.02, 0.024, 1], roughness: 0.9 } };
const ROUGH = { fat: 0.35, fatF: 0.35, skin: 0.55, sclera: 0.12, iris: 0.4 };

// ── skin: nothing of the body is kept under its clothing ────────────
// The skin layer is shown with the model's own garments (briefs; briefs and top for the
// female body). The body surface they cover — the genitals and everything else under the
// cloth — is taken out of the file, not just hidden: a triangle goes when all its corners
// lie under a garment (a ray along the skin's normal meets the cloth within 4 cm), and so
// does any piece left unattached.
const GARMENTS = new Set(["Underwear", "Female-Clothes"]);
const BODY_PIECE = 1500; // triangles: the trunk and the legs are far larger, loose bits far smaller
function uncoveredIndices(body, garments) {
  const pos = f32(body.position, body.vertices * 3), nrm = f32(body.normal, body.vertices * 3), idx = u32(body.index, body.triangles * 3);
  const covered = new Uint8Array(body.vertices);
  const ray = new Ray(), p = new Vector3(), n = new Vector3();
  for (const g of garments) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(f32(g.position, g.vertices * 3), 3));
    geo.setIndex(new BufferAttribute(u32(g.index, g.triangles * 3), 1));
    const bvh = new MeshBVH(geo);
    for (let i = 0; i < body.vertices; i++) {
      if (covered[i]) continue;
      p.fromArray(pos, i * 3); n.fromArray(nrm, i * 3);
      ray.origin.copy(p).addScaledVector(n, -0.004); ray.direction.copy(n);
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, 0.044);
      if (hit) covered[i] = 1;
    }
  }
  let kept = [];
  for (let t = 0; t < idx.length; t += 3) if (!(covered[idx[t]] && covered[idx[t + 1]] && covered[idx[t + 2]])) kept.push(t);
  // connected pieces (by position): cutting the band under the briefs leaves the trunk and
  // each leg as pieces of their own — they stay; small loose pieces (what the cloth test
  // missed inside the covered zone) go
  const key = (i) => `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
  const id = new Map(), parent = [];
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const node = (i) => { const k = key(i); let v = id.get(k); if (v === undefined) { v = parent.length; id.set(k, v); parent.push(v); } return v; };
  for (const t of kept) { const a = find(node(idx[t])), b = find(node(idx[t + 1])), c = find(node(idx[t + 2])); parent[b] = a; parent[find(c)] = a; }
  const size = new Map();
  for (const t of kept) { const r = find(node(idx[t])); size.set(r, (size.get(r) ?? 0) + 1); }
  const before = kept.length;
  if (process.env.ECORCHE_VERBOSE) console.log("skin pieces (triangles):", [...size.values()].sort((a, b) => b - a).join(" "));
  kept = kept.filter((t) => size.get(find(node(idx[t]))) >= BODY_PIECE);
  const out = new Uint32Array(kept.length * 3);
  kept.forEach((t, k) => { out[k * 3] = idx[t]; out[k * 3 + 1] = idx[t + 1]; out[k * 3 + 2] = idx[t + 2]; });
  return { indices: out, removed: body.triangles - kept.length, islands: before - kept.length };
}

// ── one file per part ───────────────────────────────────────────────
async function buildPart(part, lite, sets) {
  const doc = new Document();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const buffer = doc.createBuffer();
  const scene = doc.createScene(part);
  const materials = new Map();
  const material = (name) => {
    if (materials.has(name)) return materials.get(name);
    const m = doc.createMaterial(name).setMetallicFactor(0).setDoubleSided(name === "Fabric" || name === "Fat" || name === "Fat-Female");
    const set = sets[SET_OF[name]];
    if (set) {
      const tex = (buf, n) => doc.createTexture(`${SET_OF[name]}-${n}`).setImage(buf).setMimeType("image/webp");
      m.setBaseColorTexture(tex(set.base, "base"));
      if (set.normal) m.setNormalTexture(tex(set.normal, "normal"));
      if (set.orm) { const t = tex(set.orm, "orm"); m.setOcclusionTexture(t).setMetallicRoughnessTexture(t).setRoughnessFactor(1); } else m.setRoughnessFactor(ROUGH[SET_OF[name]] ?? 0.6);
    } else {
      const f = FLAT[name] ?? { color: [0.6, 0.6, 0.6, 1], roughness: 0.6 };
      m.setBaseColorFactor(f.color).setRoughnessFactor(f.roughness);
    }
    materials.set(name, m);
    return m;
  };
  const report = { meshes: 0, triangles: 0, removed: [] };
  for (const r of manifest.records) {
    const meta = nameOf(r.collection, r.name);
    // a part shown with the muscles travels in the core file, whatever its collection
    if ((meta?.show === "muscles" ? "core" : PART_OF[r.collection]) !== part) continue;
    if (!meta) { if (!report.removed.includes(r.name)) report.removed.push(r.name); continue; }
    let indices = u32(r.index, r.triangles * 3);
    if (part === "skin" && r.name === "Body") {
      const cut = uncoveredIndices(r, manifest.records.filter((g) => GARMENTS.has(g.name)));
      indices = cut.indices;
      report.underClothing = { trianglesRemoved: cut.removed, looseTrianglesRemoved: cut.islands };
    }
    const uv = f32(r.uv, r.vertices * 2);
    for (let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i]; // image space: v runs downward
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(f32(r.position, r.vertices * 3)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(f32(r.normal, r.vertices * 3)).setBuffer(buffer))
      .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer))
      .setMaterial(material(r.material));
    const name = `${r.name.replace(/[^A-Za-z0-9]+/g, "_")}_${r.side}`;
    const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)).setExtras({
      src: "ecorche", kind: meta.kind, id: meta.id, side: r.side, ar: meta.ar, en: meta.en, region: meta.region, depth: meta.depth,
      ...(meta.aliases.length ? { aliases: meta.aliases } : {}),
      ...(meta.show ? { show: meta.show } : {}),
    });
    scene.addChild(node);
    report.meshes++;
  }
  if (!report.meshes) return null;
  await doc.transform(weld());
  if (lite) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: LITE_KEEP[part], error: 0.004, lockBorder: false }));
  for (const mesh of doc.getRoot().listMeshes()) report.triangles += mesh.listPrimitives()[0].getIndices().getCount() / 3;
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  await doc.transform(prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
  const io = new NodeIO().registerExtensions([EXTTextureWebP, EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const file = path.join(OUT, `${part}${lite ? "-lite" : ""}.glb`);
  await io.write(file, doc);
  report.bytes = statSync(file).size;
  return report;
}

// ECORCHE_PARTS=skin rebuilds only the named parts (the others keep their files and their record)
const ONLY = process.env.ECORCHE_PARTS?.split(",");
const previous = ONLY && existsSync(path.join(OUT, "build.json")) ? JSON.parse(readFileSync(path.join(OUT, "build.json"), "utf8")).files : {};
const summary = { sex, source: "Écorché Male & Female (purchased licence; original files not distributed)", files: { ...previous } };
for (const lite of [false, true]) {
  const sets = await textureSets(lite);
  for (const part of ["core", "bones", "fat", "vessels", "skin"]) {
    if (ONLY && !ONLY.includes(part)) continue;
    const r = await buildPart(part, lite, sets);
    if (!r) continue;
    summary.files[`${part}${lite ? "-lite" : ""}.glb`] = r;
    console.log(`${sex} ${part}${lite ? "-lite" : ""}: ${r.meshes} meshes, ${Math.round(r.triangles)} triangles, ${(r.bytes / 1e6).toFixed(2)} MB${r.removed.length ? ` (left out: ${r.removed.join(", ")})` : ""}${r.underClothing ? ` (under clothing: ${r.underClothing.trianglesRemoved} triangles removed)` : ""}`);
  }
}
writeFileSync(path.join(OUT, "build.json"), JSON.stringify(summary, null, 1));
