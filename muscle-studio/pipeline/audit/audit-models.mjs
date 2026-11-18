// Audit of every mesh the app renders: model, anatomical region, whether it
// gets the écorché muscle shader inputs (_ANAT/_FIBER), where its tendon data
// comes from, and its material class. Read-only.
//   node pipeline/audit/audit-models.mjs > audit.json
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const REGIONS = ["head", "neck", "chest", "abdomen", "back", "shoulder", "arm", "forearm-hand", "pelvis-glutes", "thigh", "leg-foot"];

// ── Z-Anatomy region model (/back) — region from the source's own hierarchy ──
function zaRegion(h, name) {
  const s = [...h, name].join(" / ");
  if (/Bones of cranium|Extracranial bones of head|Muscles of head|Facial|Masticatory|Mandible|Maxilla|Occipital|Parietal|Temporal|Frontal|Sphenoid|Zygomatic|Nasal/.test(s)) return "head";
  if (/Cervical|neck|Splenius|Scalen|Sternocleidomastoid|Omohyoid|capitis|colli|Nuchal|Atlas|Axis|Vertebra C/.test(s)) return "neck";
  if (/Gluteus|Hip bone|Sacrum|Coccyx|Bony pelvis|Iliolumbar/.test(s)) return "pelvis-glutes";
  if (/forearm|Forearm|antebrachial|hand|Radius|Ulna/.test(s)) return "forearm-hand";
  if (/arm\b|Biceps|Brachialis|Coracobrachialis|Triceps|Humerus|brachial cutaneous|Radial nerve|Axillary|Musculocutaneous/.test(s)) return "arm";
  if (/Deltoid|deltoid|Rotator cuff|Teres|spinatus|Subscapularis|Scapula|Clavicle|glenohumeral|Acromioclavicular|Coraco|Conoid|Trapezoid|Glenoid|humeral|Subacromial|bursa/i.test(s)) return "shoulder";
  if (/abdom|Abdom|Rectus abdominis|oblique|Linea alba|Quadratus lumborum|lumbar|Lumbar|Vertebra L|thoracolumbar/i.test(s)) return "abdomen";
  if (/Pectoral|pectoral|Serratus anterior|intercostal|Intercostal|Subclavius|Sternum|sternum|rib|Rib|Costal|Manubrium|Xiphoid|thorax|Thoracic part/.test(s)) return "chest";
  return "back";
}

// ── BodyParts3D muscles (/editor) — region from the unit / context key ──
function bpRegion(key) {
  const k = key.replace(/^ctx_/, "").replace(/_[lr]$/, "");
  const rules = [
    [/sternocleidomastoid|scalen|splenius|neck|levator_scapulae/, "neck"],
    [/pectoralis|serratus_anterior|intercostal|diaphragm/, "chest"],
    [/oblique|rectus_abdominis|linea_alba|transversus/, "abdomen"],
    [/trapezius|rhomboid|erector|latissimus|back_deep|serratus_posterior|multifidus/, "back"],
    [/deltoid|supraspinatus|infraspinatus|teres|subscapularis|shoulder/, "shoulder"],
    [/biceps|triceps|brachialis|coracobrachialis|arm_other/, "arm"],
    [/forearm|hand|brachioradialis|wrist|finger|pollicis/, "forearm-hand"],
    [/glute|piriformis|hip_deep|iliopsoas|pelvic_floor|tensor/, "pelvis-glutes"],
    [/quadriceps|rectus_femoris|vastus|sartorius|adductor|gracilis|hamstring|biceps_femoris|semitend|semimem|pectineus/, "thigh"],
    [/gastrocnemius|soleus|tibialis|peroneus|fibularis|leg_|foot|extensor_digitorum_longus|plantaris/, "leg-foot"],
  ];
  return rules.find(([re]) => re.test(k))?.[1] ?? "other:" + k;
}

async function meshes(file) {
  const doc = await io.read(file);
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    let p = node.getParentNode(), group = "";
    while (p) { if (!p.getMesh()) group = group || p.getName(); p = p.getParentNode(); }
    const prim = mesh.listPrimitives()[0];
    out.push({ name: node.getName(), x: node.getExtras() ?? {}, group, anat: !!prim.getAttribute("_ANAT"), fiber: !!prim.getAttribute("_FIBER"), color: !!prim.getAttribute("COLOR_0"), tris: mesh.listPrimitives().reduce((s, q) => s + (q.getIndices()?.getCount() ?? 0) / 3, 0) });
  }
  return out;
}

const audit = { models: {} };
// /back
{
  const ms = await meshes("public/models/back-shoulders/back-shoulders-za.glb");
  const rep = JSON.parse(fs.readFileSync("public/models/back-shoulders/build-report-za.json", "utf8"));
  const rows = ms.filter((m) => m.x.kind).map((m) => ({
    name: m.x.za_name, kind: m.x.kind, region: zaRegion(m.x.hierarchy ?? [], m.x.za_name ?? ""),
    shader: m.x.kind === "unit" || m.x.kind === "context" ? (m.anat && m.fiber ? "muscle shader (fibres, tendons, AO)" : "MISSING shader data") : "plain PBR",
    tendon: m.x.kind === "unit" || m.x.kind === "context" ? rep.tendonSource[m.x.za_name] ?? "?" : "-",
    cartilage: m.color, tris: m.tris,
  }));
  audit.models["/back (Z-Anatomy original)"] = rows;
}
// /editor
for (const sex of ["male", "female"]) {
  const ms = await meshes(`public/models/bodyparts3d/muscles-${sex}.glb`);
  const body = await meshes(`public/models/open-anatomy-3d/anatomy-${sex}.glb`);
  const rows = ms.map((m) => ({
    name: m.name, kind: m.group === "muscles" ? "unit" : m.group === "muscles_context" ? "context" : m.group,
    region: m.group === "skeleton" ? "skeleton" : bpRegion(m.name),
    shader: m.anat && m.fiber ? "muscle shader (fibres, tendons, AO)" : "plain",
    tendon: m.anat ? "thickness (+ rules: linea alba, rectus sheath)" : "-", tris: m.tris,
  }));
  const sys = {};
  for (const m of body) { const s = m.group || "?"; sys[s] = (sys[s] ?? 0) + 1; }
  audit.models[`/editor ${sex} (BodyParts3D muscles + open-anatomy-3d body)`] = rows;
  audit[`openAnatomyBody_${sex}_meshesBySystem`] = sys;
}
// coverage matrix
audit.coverage = {};
for (const [model, rows] of Object.entries(audit.models)) {
  const c = {};
  for (const r of REGIONS) {
    const rr = rows.filter((x) => x.region === r && (x.kind === "unit" || x.kind === "context"));
    c[r] = { muscles: rr.length, withShader: rr.filter((x) => x.shader.startsWith("muscle")).length, authorTendon: rr.filter((x) => String(x.tendon).startsWith("author")).length };
  }
  c.unclassified = rows.filter((x) => String(x.region).startsWith("other")).map((x) => x.name);
  audit.coverage[model] = c;
}
console.log(JSON.stringify(audit, null, 1));
