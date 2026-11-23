import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { readFileSync } from "node:fs";
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const z = await io.read(`public/models/zanatomy/male/core-smooth.glb`), d = await io.read(`public/models/ecorche/male/deep.glb`);
const m = JSON.parse(readFileSync("/home/user/ecorche/work/male/manifest.json", "utf8")), bin = readFileSync("/home/user/ecorche/work/male/geometry.bin");
const world = (n) => { const a = n.getMesh().listPrimitives()[0].getAttribute("POSITION"), w = n.getWorldMatrix(), out = [], v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); out.push([w[0]*v[0]+w[4]*v[1]+w[8]*v[2]+w[12], w[1]*v[0]+w[5]*v[1]+w[9]*v[2]+w[13], w[2]*v[0]+w[6]*v[1]+w[10]*v[2]+w[14]]); } return out; };
const zn = (id, side) => z.getRoot().listNodes().filter((n) => n.getMesh() && n.getExtras().id === id && n.getExtras().side === side).flatMap(world);
const dn = (id, side) => d.getRoot().listNodes().filter((n) => n.getMesh() && n.getExtras().id === id && n.getExtras().side === side).flatMap(world);
const er = (name, side) => m.records.filter((r) => r.name === name && r.side === side).flatMap((r) => { const p = new Float32Array(bin.buffer.slice(bin.byteOffset + r.position, bin.byteOffset + r.position + r.vertices * 12)); const o = []; for (let i = 0; i < p.length; i += 3) o.push([p[i], p[i+1], p[i+2]]); return o; });
// slices by height: x/z extent of muscle vs bone
function slices(mus, bone, label) {
  const ys = mus.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  console.log(label, "y", y0.toFixed(3), y1.toFixed(3));
  for (let k = 1; k < 8; k += 2) {
    const y = y0 + (y1 - y0) * k / 8, sl = (pts) => pts.filter((p) => Math.abs(p[1] - y) < 0.008);
    const a = sl(mus), b = sl(bone), ext = (pts, c) => pts.length ? [Math.min(...pts.map((p) => p[c])), Math.max(...pts.map((p) => p[c]))].map((v) => v.toFixed(3)).join("..") : "-";
    console.log("  y", y.toFixed(3), "muscle x", ext(a, 0), "z", ext(a, 2), "| bone x", ext(b, 0), "z", ext(b, 2));
  }
}
const id = process.argv[2], zb = process.argv[3], eb = process.argv[4];
slices(zn(id, "l"), zn(zb, "l"), "Z-Anatomy " + id);
slices(dn(id, "l"), er(eb, "l"), "Écorché  " + id);
