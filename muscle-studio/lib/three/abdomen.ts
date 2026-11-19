import { BufferAttribute, Matrix4, Vector3, type Mesh } from "three";
import { MeshBVH } from "three-mesh-bvh";

/**
 * The anterior abdominal wall, rendered as it is built — without touching the
 * geometry.
 *
 * In Z-Anatomy the external and internal oblique meshes continue medially as
 * their aponeuroses, which form the rectus sheath: those parts lie on the
 * surface of the rectus abdominis (often < 1 mm away). Rendered as muscle they
 * show oblique fibres over the "six-pack" and fight the rectus in the depth
 * buffer (jagged lines, specks). Here every oblique vertex gets a sheath factor
 * from its distance to the rectus surface of the same side:
 *
 *   |`_sheath`| ∈ [0, 1] sheath factor, + up to 1 more in front of the rectus
 *                  itself (there the film is thinner, so the segments read clearly);
 *   `_sheath` > 0  external oblique → drawn as a translucent, glossy, pearly
 *                  aponeurosis (the anterior rectus sheath) through which the
 *                  rectus and its tendinous intersections are seen;
 *   `_sheath` < 0  internal oblique → its lamina in front of the rectus is fused
 *                  into the same sheath, so it is not drawn twice.
 *
 * The factor is read by the HD muscle shader (alpha-to-coverage, no sorting).
 */

const NEAR = 0.003; // fully sheath within 3 mm of the rectus surface
const FAR = 0.008; // muscle beyond 8 mm
const BIN = 0.004; // footprint: 4 mm horizontal slices of the rectus

/**
 * Frontal footprint of a rectus (world space): per horizontal slice, the lateral
 * border |x| and the back of the muscle. Anterior to the rectus the obliques are
 * aponeurosis only — whatever their distance to its (bulging, segmented) surface —
 * so the sheath is defined by the footprint as well as by proximity. Without it,
 * oblique parts in the grooves between rectus segments (> 8 mm away) were drawn as
 * muscle bands across the "six-pack".
 */
function footprint(r: Mesh) {
  const pos = r.geometry.getAttribute("position");
  const v = new Vector3();
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(r.matrixWorld);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  const nb = Math.max(1, Math.ceil((y1 - y0) / BIN) + 1);
  const xs = new Float32Array(nb).fill(-1), zs = new Float32Array(nb).fill(Infinity);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(r.matrixWorld);
    const b = Math.floor((v.y - y0) / BIN);
    xs[b] = Math.max(xs[b], Math.abs(v.x)); zs[b] = Math.min(zs[b], v.z);
  }
  // close one-slice gaps and soften the outline
  const X = new Float32Array(nb), Z = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    X[b] = Math.max(xs[b], xs[b - 1] ?? -1, xs[b + 1] ?? -1);
    Z[b] = Math.min(zs[b], zs[b - 1] ?? Infinity, zs[b + 1] ?? Infinity);
  }
  /** 1 over the rectus, 0 lateral to it (2 mm inside → 6 mm outside the border). */
  return (q: Vector3) => {
    const b = Math.floor((q.y - y0) / BIN);
    if (b < 0 || b >= nb || X[b] < 0 || q.z < Z[b] - 0.003) return 0;
    const d = Math.abs(q.x) - X[b];
    return d <= -0.002 ? 1 : d >= 0.006 ? 0 : 1 - (d + 0.002) / 0.008;
  };
}

const nameOf = (m: Mesh) => ((m.userData.za_name ?? m.userData.source ?? m.name) as string).replace(/[._](l|r)$/i, "");
const sideOf = (m: Mesh): string => {
  const s = (m.userData.side as string | undefined) ?? (/[._]l$/i.test((m.userData.za_name as string) ?? "") ? "l" : /[._]r$/i.test((m.userData.za_name as string) ?? "") ? "r" : "m");
  return s === "left" ? "l" : s === "right" ? "r" : s;
};

const KIND = [
  { re: /^External abdominal oblique muscle/i, sign: 1 },
  { re: /^Internal abdominal oblique muscle/i, sign: -1 },
] as const;
const RECTUS = /^Rectus abdominis muscle/i;

export interface SheathStats {
  meshes: number;
  sheathVertices: number;
}

/** Adds the `_sheath` attribute to the oblique muscles of every side found in `meshes`. */
export function markRectusSheath(meshes: Iterable<Mesh>): SheathStats {
  const all = [...meshes];
  const rectus = new Map<string, Mesh>();
  for (const m of all) if (RECTUS.test(nameOf(m))) rectus.set(sideOf(m), m);
  const stats: SheathStats = { meshes: 0, sheathVertices: 0 };
  const inv = new Matrix4();
  const p = new Vector3();
  const hit = { point: new Vector3(), distance: 0, faceIndex: 0 } as unknown as Parameters<MeshBVH["closestPointToPoint"]>[1];
  const bvhs = new Map<Mesh, MeshBVH>();
  const prints = new Map<Mesh, ReturnType<typeof footprint>>();
  const w = new Vector3();
  for (const m of all) {
    const k = KIND.find((x) => x.re.test(nameOf(m)));
    if (!k || m.geometry.getAttribute("_sheath")) continue;
    const r = rectus.get(sideOf(m));
    if (!r) continue;
    let bvh = bvhs.get(r);
    if (!bvh) {
      bvh = new MeshBVH(r.geometry.clone());
      bvhs.set(r, bvh);
    }
    m.updateMatrixWorld(true);
    r.updateMatrixWorld(true);
    let over = prints.get(r);
    if (!over) {
      over = footprint(r);
      prints.set(r, over);
    }
    // oblique local → rectus local
    inv.copy(r.matrixWorld).invert().multiply(m.matrixWorld);
    const pos = m.geometry.getAttribute("position");
    const out = new Float32Array(pos.count);
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      w.copy(p).applyMatrix4(m.matrixWorld);
      p.applyMatrix4(inv);
      const res = bvh.closestPointToPoint(p, hit, 0, FAR * 1.5);
      const d = res ? res.distance : Infinity;
      const f = over(w);
      const s = Math.max(d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR), f);
      out[i] = k.sign * (s + f); // |value| > 1: in front of the rectus (thinner film)
      if (s > 0.5) n++;
    }
    m.geometry.setAttribute("_sheath", new BufferAttribute(out, 1));
    stats.meshes++;
    stats.sheathVertices += n;
  }
  return stats;
}

/**
 * Anatomical layer used for depth-test priority where layers nearly coincide.
 * Z-Anatomy's exposure-based depth puts the internal oblique on the surface
 * (it is visible at the flank); anatomically it lies deep to the external oblique.
 */
export function renderDepth(name: string, depth: number | undefined): number {
  if (/^Internal abdominal oblique/i.test(name)) return Math.max(2, depth ?? 1);
  if (/^Transversus abdominis/i.test(name)) return Math.max(3, depth ?? 1);
  return depth ?? 1;
}
