// Writes the back & shoulder selection (from ../zanatomy/back-config.mjs) as
// JSON for the Blender exporter, with Blender's object names (spaces, not _).
import fs from "node:fs";
import { BONES, CONTEXT_MUSCLES, NERVES, TENDONS, UNITS } from "../zanatomy/back-config.mjs";
const sp = (s) => s.replace(/_/g, " ");
const out = {
  units: UNITS.map((u) => ({ id: u.id, depth: u.depth, meshes: u.meshes.map(sp), patches: [...u.meshes, ...u.patches].map(sp), insertionBones: u.insertionBones })),
  context: Object.keys(CONTEXT_MUSCLES).map(sp),
  tendons: Object.keys(TENDONS).map(sp),
  nerves: Object.keys(NERVES).map(sp),
  bones: Object.keys(BONES).map(sp),
  discPattern: "^Intervertebral disc (C|T|L)\\d+-(C|T|L|S)\\d+$",
};
fs.writeFileSync(process.argv[2] ?? "selection.json", JSON.stringify(out, null, 1));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
