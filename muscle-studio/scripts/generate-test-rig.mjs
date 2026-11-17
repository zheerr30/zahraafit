// Generates public/models/test-rig/pipeline-test-rig.glb
//
// THIS IS NOT AN ANATOMICAL MODEL. It is a stylized mannequin made from
// ellipsoids, with one separately named mesh per muscle id, used to verify the
// asset pipeline (mesh-name mapping, selection, highlighting, labels, export)
// before licensed anatomical GLB assets are installed.
//
// Mesh names deliberately mix naming conventions (snake_case, dotted Blender
// suffixes, CamelCase, side prefixes, aliases) to exercise the mapping layer.
//
// Usage: node scripts/generate-test-rig.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CapsuleGeometry, Euler, Matrix4, Quaternion, SphereGeometry, Vector3 } from "three";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/models/test-rig/pipeline-test-rig.glb");
const DEG = Math.PI / 180;

/** @type {{name:string, geo:import('three').BufferGeometry, material:number}[]} */
const parts = [];

function transform(geo, [x, y, z], [sx, sy, sz] = [1, 1, 1], rotZ = 0, rotX = 0) {
  const m = new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(rotX * DEG, 0, rotZ * DEG)),
    new Vector3(sx, sy, sz),
  );
  geo.applyMatrix4(m);
  return geo;
}

function ellipsoid(center, radii, rotZ = 0, rotX = 0) {
  return transform(new SphereGeometry(1, 28, 20), center, radii, rotZ, rotX);
}

function capsule(center, radius, length, scale = [1, 1, 1], rotZ = 0) {
  return transform(new CapsuleGeometry(radius, length, 6, 20), center, scale, rotZ);
}

const BASE = 0;
const MUSCLE = 1;

/** Add a bilateral part; names: [leftName, rightName]. Left side is +X (model faces +Z). */
function bilateral(names, make, material = MUSCLE) {
  const [l, r] = names;
  parts.push({ name: l, geo: make(1), material });
  parts.push({ name: r, geo: make(-1), material });
}

// ── Base body (non-muscle, listed as ignored in the manifest) ──
parts.push({ name: "Body_Base_Torso", geo: capsule([0, 1.22, 0], 0.13, 0.3, [1.15, 1, 0.75]), material: BASE });
parts.push({ name: "Body_Base_Pelvis", geo: ellipsoid([0, 0.93, 0], [0.16, 0.11, 0.105]), material: BASE });
parts.push({ name: "Body_Base_Neck", geo: capsule([0, 1.56, -0.005], 0.048, 0.08), material: BASE });
parts.push({ name: "Body_Base_Head", geo: ellipsoid([0, 1.69, 0.005], [0.095, 0.115, 0.105]), material: BASE });
bilateral(["Body_Base_UpperArm_L", "Body_Base_UpperArm_R"], (s) => capsule([0.24 * s, 1.27, 0], 0.042, 0.22, [1, 1, 1], 10 * s), BASE);
bilateral(["Body_Base_Forearm_L", "Body_Base_Forearm_R"], (s) => capsule([0.2825 * s, 1.005, 0], 0.033, 0.2, [1, 1, 1], 8 * s), BASE);
bilateral(["Body_Base_Hand_L", "Body_Base_Hand_R"], (s) => ellipsoid([0.305 * s, 0.81, 0.005], [0.028, 0.062, 0.042], 5 * s), BASE);
bilateral(["Body_Base_Thigh_L", "Body_Base_Thigh_R"], (s) => capsule([0.1025 * s, 0.71, 0], 0.068, 0.3, [1, 1, 1], 2 * s), BASE);
bilateral(["Body_Base_Shin_L", "Body_Base_Shin_R"], (s) => capsule([0.1125 * s, 0.295, -0.005], 0.042, 0.32), BASE);
bilateral(["Body_Base_Foot_L", "Body_Base_Foot_R"], (s) => ellipsoid([0.115 * s, 0.04, 0.045], [0.04, 0.032, 0.11]), BASE);

// ── Muscles ──
const M = (names, center, radii, rotZ = 0, rotX = 0) =>
  bilateral(names, (s) => ellipsoid([center[0] * s, center[1], center[2]], radii, rotZ * s, rotX));

// Chest
M(["Pectoralis_Major_L", "Pectoralis_Major_R"], [0.08, 1.34, 0.083], [0.085, 0.065, 0.035], -10);
M(["pectoralis-minor.L", "pectoralis-minor.R"], [0.12, 1.385, 0.07], [0.045, 0.03, 0.025], -20);
// Back
M(["LatissimusDorsi_Left", "LatissimusDorsi_Right"], [0.115, 1.21, -0.06], [0.075, 0.15, 0.045], -12);
M(["Trapezius_L", "Trapezius_R"], [0.06, 1.4, -0.075], [0.075, 0.14, 0.035]);
M(["Trapezius_L.001", "Trapezius_R.001"], [0.1, 1.49, -0.03], [0.08, 0.035, 0.035], -25);
M(["Rhomboids_L", "Rhomboids_R"], [0.055, 1.33, -0.085], [0.04, 0.06, 0.025]);
M(["Teres_Major.L", "Teres_Major.R"], [0.155, 1.33, -0.07], [0.04, 0.025, 0.03], -30);
M(["Erector_Spinae_L", "Erector_Spinae_R"], [0.03, 1.1, -0.085], [0.028, 0.16, 0.03]);
// Shoulders
M(["Deltoid_Anterior_L", "Deltoid_Anterior_R"], [0.19, 1.42, 0.045], [0.045, 0.07, 0.035], 20);
M(["Deltoid_Lateral_L", "Deltoid_Lateral_R"], [0.235, 1.42, 0], [0.04, 0.075, 0.045], 15);
M(["Rear_Delt_L", "Rear_Delt_R"], [0.19, 1.42, -0.045], [0.045, 0.07, 0.035], 20);
// Arms
M(["Biceps_Brachii_L", "Biceps_Brachii_R"], [0.2375, 1.284, 0.035], [0.032, 0.085, 0.032], 10);
M(["Brachialis_Muscle_L", "Brachialis_Muscle_R"], [0.267, 1.2, 0.02], [0.028, 0.05, 0.028], 10);
M(["Left_Triceps_Brachii", "Right_Triceps_Brachii"], [0.2375, 1.29, -0.035], [0.038, 0.1, 0.035], 10);
M(["Forearm_Flexors_L", "Forearm_Flexors_R"], [0.277, 1.042, 0.02], [0.033, 0.09, 0.028], 8);
M(["Forearm_Extensors_L", "Forearm_Extensors_R"], [0.282, 1.042, -0.018], [0.033, 0.09, 0.028], 8);
// Core
M(["Rectus_Abdominis_L", "Rectus_Abdominis_R"], [0.035, 1.13, 0.09], [0.033, 0.13, 0.025]);
M(["External_Oblique_L", "External_Oblique_R"], [0.115, 1.12, 0.05], [0.045, 0.11, 0.045]);
M(["Internal_Oblique_L", "Internal_Oblique_R"], [0.1, 1.02, 0.065], [0.04, 0.05, 0.03]);
// Glutes
M(["Gluteus_Maximus_L", "Gluteus_Maximus_R"], [0.08, 0.88, -0.075], [0.085, 0.1, 0.06]);
M(["Gluteus_Medius_L", "Gluteus_Medius_R"], [0.135, 0.96, -0.035], [0.055, 0.06, 0.05]);
M(["Gluteus_Minimus_L", "Gluteus_Minimus_R"], [0.145, 0.94, -0.01], [0.035, 0.04, 0.035]);
// Legs
M(["Rectus_Femoris_L", "Rectus_Femoris_R"], [0.1, 0.7, 0.055], [0.04, 0.16, 0.035], 2);
M(["Vastus_Lateralis_L", "Vastus_Lateralis_R"], [0.15, 0.68, 0.015], [0.04, 0.16, 0.045], 2);
M(["VMO_L", "VMO_R"], [0.065, 0.57, 0.045], [0.035, 0.075, 0.035]);
M(["Vastus_Intermedius_L", "Vastus_Intermedius_R"], [0.105, 0.68, 0.035], [0.04, 0.14, 0.035], 2);
M(["Biceps_Femoris_L", "Biceps_Femoris_R"], [0.13, 0.68, -0.045], [0.035, 0.15, 0.035], 2);
M(["Semitendinosus_L", "Semitendinosus_R"], [0.085, 0.69, -0.055], [0.032, 0.15, 0.032], 2);
M(["Semimembranosus_L", "Semimembranosus_R"], [0.07, 0.63, -0.045], [0.03, 0.11, 0.03], 2);
M(["Adductor_Magnus_L", "Adductor_Magnus_R"], [0.045, 0.75, 0], [0.035, 0.13, 0.05], 2);
M(["Gastrocnemius_L", "Gastrocnemius_R"], [0.112, 0.37, -0.035], [0.045, 0.1, 0.04]);
M(["Soleus_L", "Soleus_R"], [0.115, 0.25, -0.025], [0.04, 0.09, 0.035]);
M(["Tibialis_Anterior_L", "Tibialis_Anterior_R"], [0.125, 0.3, 0.035], [0.022, 0.13, 0.022]);

// ── GLB writer ──
const chunks = [];
let byteOffset = 0;
const bufferViews = [];
const accessors = [];

function pushView(typedArray, target) {
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  chunks.push(bytes, Buffer.alloc(pad));
  bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
  byteOffset += bytes.length + pad;
  return bufferViews.length - 1;
}

function pushAccessor(typedArray, componentType, type, count, target, minmax) {
  const view = pushView(typedArray, target);
  accessors.push({ bufferView: view, componentType, count, type, ...(minmax ?? {}) });
  return accessors.length - 1;
}

const nodes = [];
const meshes = [];
for (const part of parts) {
  const g = part.geo.index ? part.geo : part.geo;
  g.computeVertexNormals();
  const pos = new Float32Array(g.attributes.position.array);
  const nrm = new Float32Array(g.attributes.normal.array);
  const count = pos.length / 3;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  }
  const P = pushAccessor(pos, 5126, "VEC3", count, 34962, { min, max });
  const N = pushAccessor(nrm, 5126, "VEC3", count, 34962);
  const idxSrc = g.index.array;
  const idx = count < 65536 ? new Uint16Array(idxSrc) : new Uint32Array(idxSrc);
  const I = pushAccessor(idx, count < 65536 ? 5123 : 5125, "SCALAR", idx.length, 34963);
  meshes.push({ name: part.name, primitives: [{ attributes: { POSITION: P, NORMAL: N }, indices: I, material: part.material }] });
  nodes.push({ name: part.name, mesh: meshes.length - 1 });
}

const bin = Buffer.concat(chunks);
const gltf = {
  asset: { version: "2.0", generator: "muscle-studio generate-test-rig (NON-ANATOMICAL)" },
  scene: 0,
  scenes: [{ name: "PipelineTestRig", nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials: [
    { name: "TestRig_Base", pbrMetallicRoughness: { baseColorFactor: [0.42, 0.43, 0.45, 1], metallicFactor: 0, roughnessFactor: 0.7 } },
    { name: "TestRig_Muscle", pbrMetallicRoughness: { baseColorFactor: [0.55, 0.22, 0.17, 1], metallicFactor: 0, roughnessFactor: 0.55 } },
  ],
  accessors,
  bufferViews,
  buffers: [{ byteLength: bin.length }],
  extras: { warning: "Not an anatomical model. Diagnostic asset for pipeline testing only." },
};

let json = Buffer.from(JSON.stringify(gltf), "utf8");
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // "glTF"
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(json.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // "BIN\0"

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, jsonHeader, json, binHeader, bin]));
console.log(`[test-rig] wrote ${parts.length} meshes → ${OUT} (${((12 + 16 + json.length + bin.length) / 1024).toFixed(0)} KB)`);
