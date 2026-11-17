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
export function bakeAppearance(meshes, { aoRays = 24, aoDistance = 0.045 } = {}) {
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
    // Tendon / aponeurosis = tissue much thinner than this muscle's own belly
    // (relative to its 90th-percentile thickness) and thin in absolute terms.
    const sortedTh = Array.from(thS).filter((t) => t < 0.05).sort((x, y) => x - y);
    const p90 = sortedTh.length ? sortedTh[Math.floor(sortedTh.length * 0.9)] : 0.02;
    const tendonThin = Math.min(0.18 * p90, 0.0045);
    const tendonThick = Math.min(0.32 * p90, 0.007);
    const anat = new Float32Array(n * 2);
    for (let v = 0; v < n; v++) {
      anat[v * 2] = Math.min(1, Math.max(0, aoS[v]));
      const x = Math.min(1, Math.max(0, (thS[v] - tendonThin) / Math.max(1e-4, tendonThick - tendonThin)));
      // 1 = tendon/aponeurosis, 0 = muscle belly. Meshes that are entirely
      // tendinous (e.g. linea alba) are flagged by the caller.
      anat[v * 2 + 1] = m.allTendon ? 1 : Math.max(1 - x * x * (3 - 2 * x), m.tendonFloor?.[v] ?? 0);
    }
    const tendon = new Float32Array(n);
    for (let v = 0; v < n; v++) tendon[v] = anat[v * 2 + 1];
    const { dir, seeded } = fibreFlow(m.pos, m.nrm, m.idx, tendon, principalAxis(m.pos));
    return { anat, fibre: dir, seeded };
  });
}

// ───────────────────────── fibre flow ─────────────────────────
// Muscle fibres run between attachments, i.e. towards the tendons. For each
// muscle we compute, on its own surface:
//   u = geodesic distance from its tendinous regions (or, for muscles with no
//       detected tendon, position along the muscle's long axis);
//   fibre direction = surface gradient of u, consistently oriented and smoothed.
// The shader draws fascicle striations along that direction (phasor noise),
// so they fan out, converge and curve with each muscle's real geometry.
// Directions are derived from the geometry only — nothing here is random anatomy.

function adjacency(idx, n) {
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  return nb.map((s) => [...s]);
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v;
    k.push(key); v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v;
    const top = [k[0], v[0]];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.k.length; }
}

/**
 * pos/nrm: Float32Array, idx: Uint32Array, tendon: Float32Array (0..1 per vertex).
 * Returns { dir: Float32Array(n*3) unit fibre direction, seeded: "tendon" | "axis" }.
 */
export function fibreFlow(pos, nrm, idx, tendon, axis) {
  const n = pos.length / 3;
  const nb = adjacency(idx, n);
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // 1. seeds
  let seeds = [];
  for (let v = 0; v < n; v++) if (tendon[v] > 0.6) seeds.push(v);
  let seeded = "tendon";
  if (seeds.length < Math.max(8, n * 0.01)) {
    seeded = "axis";
    const proj = [...Array(n).keys()].map((v) => [dot(P(v), axis), v]).sort((a, b) => a[0] - b[0]);
    seeds = proj.slice(0, Math.max(8, Math.floor(n * 0.03))).map((x) => x[1]);
  }

  // 2. geodesic distance u from the seeds (Dijkstra on mesh edges)
  const u = new Float64Array(n).fill(Infinity);
  const order = [];
  const heap = new MinHeap();
  for (const s of seeds) { u[s] = 0; heap.push(0, s); }
  const done = new Uint8Array(n);
  while (heap.size) {
    const [d, v] = heap.pop();
    if (done[v] || d > u[v]) continue;
    done[v] = 1; order.push(v);
    const pv = P(v);
    for (const w of nb[v]) {
      const nd = d + Math.hypot(...sub(P(w), pv));
      if (nd < u[w]) { u[w] = nd; heap.push(nd, w); }
    }
  }
  for (let v = 0; v < n; v++) if (!Number.isFinite(u[v])) { u[v] = 0; order.push(v); }

  // 3. fibre direction = least-squares surface gradient of u, smoothed
  let dir = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const pv = P(v), nv = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    let g = [0, 0, 0];
    for (const w of nb[v]) {
      const e = sub(P(w), pv);
      const l2 = dot(e, e) || 1e-12;
      const s = (u[w] - u[v]) / l2;
      g = [g[0] + e[0] * s, g[1] + e[1] * s, g[2] + e[2] * s];
    }
    if (seeded === "axis" || Math.hypot(...g) < 1e-9) g = axis;
    const gn = dot(g, nv);
    const t = norm([g[0] - nv[0] * gn, g[1] - nv[1] * gn, g[2] - nv[2] * gn]);
    dir.set(t, v * 3);
  }
  // Orient the line field consistently (BFS), so it interpolates across
  // triangles: the gradient flips where the fronts from two tendons meet.
  const seen = new Uint8Array(n);
  for (let r = 0; r < n; r++) {
    if (seen[r]) continue;
    seen[r] = 1;
    const queue = [r];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      for (const w of nb[v]) {
        if (seen[w]) continue;
        seen[w] = 1;
        if (dir[w * 3] * dir[v * 3] + dir[w * 3 + 1] * dir[v * 3 + 1] + dir[w * 3 + 2] * dir[v * 3 + 2] < 0) {
          dir[w * 3] *= -1; dir[w * 3 + 1] *= -1; dir[w * 3 + 2] *= -1;
        }
        queue.push(w);
      }
    }
  }
  for (let it = 0; it < 6; it++) {
    const next = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const d0 = [dir[v * 3], dir[v * 3 + 1], dir[v * 3 + 2]];
      let a = [d0[0] * 2, d0[1] * 2, d0[2] * 2];
      for (const w of nb[v]) {
        const dw = [dir[w * 3], dir[w * 3 + 1], dir[w * 3 + 2]];
        const s = dot(dw, d0) < 0 ? -1 : 1; // orientation-agnostic average
        a = [a[0] + dw[0] * s, a[1] + dw[1] * s, a[2] + dw[2] * s];
      }
      next.set(norm(a), v * 3);
    }
    dir = next;
  }
  return { dir, seeded };
}
