// Per-vertex appearance data baked into the muscle GLBs (written as glTF
// custom attributes, read by the studio's realistic muscle shader):
//   _ANAT  (vec2) x = ambient occlusion (1 open … 0 enclosed)
//               y = tendon/aponeurosis factor from local tissue thickness
//   _FIBER (vec3) dominant fibre direction of the muscle (unit vector)
// Everything is computed from the BodyParts3D geometry itself.
import { BufferAttribute, BufferGeometry, DoubleSide, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";

function bvhFor(pos, idx) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  return new MeshBVH(g);
}

/** Fibonacci directions on the unit hemisphere around +Z, cosine-weighted. */
function hemisphere(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const r = Math.sqrt(u);
    const phi = i * 2.399963229728653;
    out.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)]);
  }
  return out;
}

function basis(n) {
  const a = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  const l = Math.hypot(...t) || 1;
  const tt = t.map((x) => x / l);
  const b = [n[1] * tt[2] - n[2] * tt[1], n[2] * tt[0] - n[0] * tt[2], n[0] * tt[1] - n[1] * tt[0]];
  return [tt, b];
}

/** Average each vertex value with its neighbours (light denoising). */
function smooth(values, idx, n, comps, iterations) {
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  let cur = values;
  for (let it = 0; it < iterations; it++) {
    const next = new Float32Array(cur.length);
    for (let v = 0; v < n; v++) {
      for (let k = 0; k < comps; k++) {
        let s = cur[v * comps + k] * 2, c = 2;
        for (const u of nb[v]) { s += cur[u * comps + k]; c++; }
        next[v * comps + k] = s / c;
      }
    }
    cur = next;
  }
  return cur;
}

/** Principal (longest) axis of a point cloud — the muscle's dominant fibre direction. */
export function principalAxis(pos) {
  const n = pos.length / 3;
  const m = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) m[k] += pos[i * 3 + k] / n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const d = [pos[i * 3] - m[0], pos[i * 3 + 1] - m[1], pos[i * 3 + 2] - m[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  let v = [0.3, 0.9, 0.2];
  for (let it = 0; it < 60; it++) {
    const w = [0, 1, 2].map((a) => C[a][0] * v[0] + C[a][1] * v[1] + C[a][2] * v[2]);
    const l = Math.hypot(...w) || 1;
    v = w.map((x) => x / l);
  }
  return v;
}

/**
 * meshes: [{ pos, idx, nrm }] in one shared frame (metres).
 * Returns per mesh { anat: Float32Array(n*2), fiber: [x,y,z] }.
 */
export function bakeAppearance(meshes, { aoRays = 24, aoDistance = 0.045, tendonThin = 0.0011, tendonThick = 0.0024 } = {}) {
  // Occluders: every mesh together.
  let total = 0, totalIdx = 0;
  for (const m of meshes) { total += m.pos.length; totalIdx += m.idx.length; }
  const allPos = new Float32Array(total), allIdx = new Uint32Array(totalIdx);
  let po = 0, io = 0;
  for (const m of meshes) {
    allPos.set(m.pos, po);
    for (let i = 0; i < m.idx.length; i++) allIdx[io + i] = m.idx[i] + po / 3;
    po += m.pos.length; io += m.idx.length;
  }
  const world = bvhFor(allPos, allIdx);
  const dirs = hemisphere(aoRays);
  const ray = new Ray(new Vector3(), new Vector3());

  return meshes.map((m) => {
    const n = m.pos.length / 3;
    const self = bvhFor(m.pos, m.idx);
    const ao = new Float32Array(n);
    const thick = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const p = [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
      const nn = [m.nrm[v * 3], m.nrm[v * 3 + 1], m.nrm[v * 3 + 2]];
      const [t, b] = basis(nn);
      // Ambient occlusion
      let occ = 0;
      for (const d of dirs) {
        const w = [0, 1, 2].map((k) => t[k] * d[0] + b[k] * d[1] + nn[k] * d[2]);
        ray.origin.set(p[0] + nn[0] * 4e-4, p[1] + nn[1] * 4e-4, p[2] + nn[2] * 4e-4);
        ray.direction.set(w[0], w[1], w[2]);
        const hit = world.raycastFirst(ray, DoubleSide, 0, aoDistance);
        if (hit) occ += 1 - hit.distance / aoDistance;
      }
      ao[v] = 1 - occ / dirs.length;
      // Thickness: distance through the muscle along the inward normal.
      ray.origin.set(p[0] - nn[0] * 2e-4, p[1] - nn[1] * 2e-4, p[2] - nn[2] * 2e-4);
      ray.direction.set(-nn[0], -nn[1], -nn[2]);
      const hit = self.raycastFirst(ray, DoubleSide, 0, 0.05);
      thick[v] = hit ? hit.distance : 0.05;
    }
    const aoS = smooth(ao, m.idx, n, 1, 2);
    const thS = smooth(thick, m.idx, n, 1, 6);
    const anat = new Float32Array(n * 2);
    for (let v = 0; v < n; v++) {
      anat[v * 2] = Math.min(1, Math.max(0, aoS[v]));
      const x = Math.min(1, Math.max(0, (thS[v] - tendonThin) / (tendonThick - tendonThin)));
      // 1 = tendon/aponeurosis, 0 = muscle belly. Meshes that are entirely
      // tendinous (e.g. linea alba) are flagged by the caller.
      anat[v * 2 + 1] = m.allTendon ? 1 : 1 - x * x * (3 - 2 * x);
    }
    return { anat, fiber: principalAxis(m.pos) };
  });
}
