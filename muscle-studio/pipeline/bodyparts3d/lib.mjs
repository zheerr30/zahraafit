// Shared helpers for the BodyParts3D muscle pipeline (Node only).
import fs from "node:fs";
import path from "node:path";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** Parse a BodyParts3D Wavefront OBJ (mm, Z-up) into flat arrays. */
export function parseObj(file) {
  const pos = [];
  const idx = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith("v ")) {
      const p = line.split(/\s+/);
      pos.push(+p[1], +p[2], +p[3]);
    } else if (line.startsWith("f ")) {
      const p = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1);
      for (let i = 1; i + 1 < p.length; i++) idx.push(p[0], p[i], p[i + 1]);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

/** Read the header of every OBJ (name, side, bounds) — same rules as open-anatomy-3d's index.mjs. */
export function indexObjDirs(dirs, elementLists) {
  const fjName = new Map();
  for (const f of elementLists) {
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/).slice(1)) {
      const [, name, fj] = line.trim().split(/\t/);
      if (name && fj && !fjName.has(fj)) fjName.set(fj, name);
    }
  }
  const seen = new Map();
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".obj") || seen.has(f)) continue;
      const p = path.join(dir, f);
      const fd = fs.openSync(p, "r");
      const buf = Buffer.alloc(2048);
      fs.readSync(fd, buf, 0, 2048, 0);
      fs.closeSync(fd);
      const head = buf.toString("utf8");
      const headerName = /English name : (.*)/.exec(head)?.[1]?.trim() || "";
      const b = /Bounds\(mm\): \(([^)]*)\)-\(([^)]*)\)/.exec(head);
      seen.set(f, {
        headerName,
        file: p,
        fj: f.replace(".obj", ""),
        name: headerName || fjName.get(f.replace(".obj", "")) || "",
        min: b?.[1].split(",").map(Number),
        max: b?.[2].split(",").map(Number),
      });
    }
  }
  const flip = (n) => n.replace(/(left|right|Left|Right)/g, (m) => ({ left: "right", right: "left", Left: "Right", Right: "Left" })[m]);
  for (const r of seen.values()) {
    if (r.headerName) continue;
    const twin = seen.get(r.fj.endsWith("M") ? r.fj.slice(0, -1) + ".obj" : r.fj + "M.obj");
    if (twin?.headerName) r.name = flip(twin.headerName);
  }
  return [...seen.values()];
}

/** BodyParts3D (mm, Z-up, anterior −Y, left +X) → open-anatomy-3d frame (m, Y-up, anterior +Z, feet y=0). */
export function makeToThree({ cx, cy, minZ }) {
  return (x, y, z) => [(x - cx) * 0.001, (z - minZ) * 0.001, -(y - cy) * 0.001];
}

export async function loadGlbScene(file) {
  await MeshoptDecoder.ready;
  const b = fs.readFileSync(file);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const gltf = await new Promise((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

/** World-space positions (Float32Array xyz) and index of a three.js mesh. */
export function meshWorld(mesh) {
  const g = mesh.geometry;
  const p = g.attributes.position;
  const out = new Float32Array(p.count * 3);
  const e = mesh.matrixWorld.elements;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    out[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
    out[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    out[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  return { pos: out, idx: Uint32Array.from(g.index.array) };
}

/** Uniform-grid nearest-neighbour index over 3D points. */
export class PointGrid {
  constructor(pos, cell = 0.01) {
    this.pos = pos;
    this.cell = cell;
    this.map = new Map();
    for (let i = 0; i < pos.length / 3; i++) {
      const k = this.key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      let a = this.map.get(k);
      if (!a) this.map.set(k, (a = []));
      a.push(i);
    }
  }
  key(x, y, z) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)},${Math.floor(z / this.cell)}`;
  }
  /** k nearest points (indices + squared distances), searching rings up to maxRing cells. */
  knn(x, y, z, k = 1, maxRing = 6) {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell), cz = Math.floor(z / this.cell);
    let best = [];
    for (let r = 0; r <= maxRing; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let l = -r; l <= r; l++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(l)) !== r) continue;
        const a = this.map.get(`${cx + i},${cy + j},${cz + l}`);
        if (!a) continue;
        for (const idx of a) {
          const dx = this.pos[idx * 3] - x, dy = this.pos[idx * 3 + 1] - y, dz = this.pos[idx * 3 + 2] - z;
          best.push([idx, dx * dx + dy * dy + dz * dz]);
        }
      }
      if (best.length >= k) {
        best.sort((a, b) => a[1] - b[1]);
        // Anything closer must lie within the next ring only if the k-th distance exceeds r cells.
        if (Math.sqrt(best[k - 1][1]) <= r * this.cell) return best.slice(0, k);
      }
    }
    best.sort((a, b) => a[1] - b[1]);
    return best.slice(0, k);
  }
}

/**
 * Recover the vertex correspondence between two meshes with identical
 * connectivity but renumbered vertices (Weisfeiler–Lehman colour refinement
 * plus propagation through matched neighbours). Returns Int32Array map
 * a→b (−1 where unresolved).
 */
export function matchIsomorphicMeshes(idxA, nA, idxB, nB) {
  const adj = (idx, n) => {
    const s = Array.from({ length: n }, () => new Set());
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      s[a].add(b); s[a].add(c); s[b].add(a); s[b].add(c); s[c].add(a); s[c].add(b);
    }
    return s.map((x) => [...x]);
  };
  const A = adj(idxA, nA), B = adj(idxB, nB);
  const table = new Map();
  const id = (sig) => {
    let v = table.get(sig);
    if (v === undefined) table.set(sig, (v = table.size));
    return v;
  };
  let ca = A.map((n) => id(`d${n.length}`)), cb = B.map((n) => id(`d${n.length}`));
  let prevDistinct = -1;
  for (let it = 0; it < 40; it++) {
    const na = A.map((n, v) => id(`${ca[v]}|${n.map((u) => ca[u]).sort((x, y) => x - y).join(",")}`));
    const nb = B.map((n, v) => id(`${cb[v]}|${n.map((u) => cb[u]).sort((x, y) => x - y).join(",")}`));
    ca = na; cb = nb;
    const distinct = new Set(ca).size;
    if (distinct === prevDistinct) break;
    prevDistinct = distinct;
  }
  const map = new Int32Array(nA).fill(-1);
  const byColorB = new Map();
  cb.forEach((c, v) => {
    const a = byColorB.get(c);
    if (a) a.push(v);
    else byColorB.set(c, [v]);
  });
  const countA = new Map();
  for (const c of ca) countA.set(c, (countA.get(c) ?? 0) + 1);
  ca.forEach((c, v) => {
    const b = byColorB.get(c);
    if (b && b.length === 1 && countA.get(c) === 1) map[v] = b[0];
  });
  // Propagate: an unmatched vertex whose matched neighbours all point at a
  // unique common neighbour (with the same colour) in B gets that vertex.
  const usedB = new Uint8Array(nB);
  for (const v of map) if (v >= 0) usedB[v] = 1;
  for (let pass = 0; pass < 10; pass++) {
    let added = 0;
    for (let v = 0; v < nA; v++) {
      if (map[v] >= 0) continue;
      let cand = null;
      for (const u of A[v]) {
        if (map[u] < 0) continue;
        const opts = B[map[u]].filter((w) => !usedB[w] && cb[w] === ca[v]);
        cand = cand === null ? opts : cand.filter((w) => opts.includes(w));
      }
      if (cand && cand.length === 1) { map[v] = cand[0]; usedB[cand[0]] = 1; added++; }
    }
    if (!added) break;
  }
  return map;
}

/** Exact point-to-triangle distance (Ericson, Real-Time Collision Detection 5.1.5). */
function pointTriangleDistanceSq(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q;
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
      else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
            else { const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
          }
        }
      }
    }
  }
  const d = sub(p, q);
  return dot(d, d);
}

/** Closest point on triangle abc to p, as barycentric weights [wa, wb, wc]. */
export function closestBarycentric(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return [1, 0, 0];
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return [0, 1, 0];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [1 - v, v, 0]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return [0, 0, 1];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [1 - w, 0, w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [0, 1 - w, w]; }
  const den = 1 / (va + vb + vc);
  const v = vb * den, w = vc * den;
  return [1 - v - w, v, w];
}

/** Approximate nearest-surface distance using the k nearest triangle centroids. */
export class TriangleSurface {
  constructor(pos, idx) {
    this.pos = pos;
    this.idx = idx;
    const c = new Float32Array(idx.length);
    for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) c[t + k] = (pos[idx[t] * 3 + k] + pos[idx[t + 1] * 3 + k] + pos[idx[t + 2] * 3 + k]) / 3;
    this.grid = new PointGrid(c, 0.01);
  }
  /** Nearest triangle and barycentric weights of the closest point. */
  closest(x, y, z, k = 12) {
    let best = { t: -1, bary: null, d2: Infinity };
    const v = (i) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
    for (const [t] of this.grid.knn(x, y, z, k)) {
      const a = v(this.idx[t * 3]), b = v(this.idx[t * 3 + 1]), c = v(this.idx[t * 3 + 2]);
      const bary = closestBarycentric([x, y, z], a, b, c);
      if (!bary.every(Number.isFinite)) continue; // degenerate triangle
      const q = [0, 1, 2].map((k2) => bary[0] * a[k2] + bary[1] * b[k2] + bary[2] * c[k2]);
      const d2 = (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2;
      if (d2 < best.d2) best = { t, bary, d2 };
    }
    return best;
  }

  distance(x, y, z, k = 12) {
    let best = Infinity;
    const v = (i) => [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
    for (const [t] of this.grid.knn(x, y, z, k)) {
      const d = pointTriangleDistanceSq([x, y, z], v(this.idx[t * 3]), v(this.idx[t * 3 + 1]), v(this.idx[t * 3 + 2]));
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
}

/**
 * Complete a per-vertex displacement field over a mesh: known values stay
 * fixed, unknown ones become the harmonic (neighbour-average) interpolation.
 */
export function harmonicFill(idx, n, known, disp, iterations = 300) {
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  const nbs = nb.map((x) => [...x]);
  const out = Float32Array.from(disp);
  const has = Uint8Array.from(known);
  for (let it = 0; it < iterations; it++) {
    let changed = 0;
    for (let v = 0; v < n; v++) {
      if (known[v]) continue;
      let sx = 0, sy = 0, sz = 0, c = 0;
      for (const u of nbs[v]) if (has[u]) { sx += out[u * 3]; sy += out[u * 3 + 1]; sz += out[u * 3 + 2]; c++; }
      if (!c) continue;
      out[v * 3] = sx / c; out[v * 3 + 1] = sy / c; out[v * 3 + 2] = sz / c;
      if (!has[v]) { has[v] = 1; changed++; }
    }
    if (!changed && it > 50) break;
  }
  return { disp: out, filled: has };
}
