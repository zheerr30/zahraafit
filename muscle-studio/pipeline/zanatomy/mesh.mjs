// Mesh utilities for the Z-Anatomy region builds: welding, Loop subdivision,
// smooth normals and winding repair. Pure JS on typed arrays.

/** Weld coincident vertices (tolerance in source units) and drop degenerate triangles. */
export function weld(pos, tol) {
  const map = new Map();
  const out = [];
  const remap = new Uint32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) {
    const k = `${Math.round(pos[i * 3] / tol)},${Math.round(pos[i * 3 + 1] / tol)},${Math.round(pos[i * 3 + 2] / tol)}`;
    let j = map.get(k);
    if (j === undefined) {
      j = out.length / 3;
      map.set(k, j);
      out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    }
    remap[i] = j;
  }
  const idx = [];
  for (let t = 0; t < remap.length; t += 3) {
    const a = remap[t], b = remap[t + 1], c = remap[t + 2];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { pos: new Float32Array(out), idx: new Uint32Array(idx) };
}

export function meanEdge(pos, idx) {
  let s = 0;
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k], b = idx[t + ((k + 1) % 3)];
      s += Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
    }
  }
  return s / idx.length;
}

/**
 * One level of Loop subdivision (Loop 1987) with boundary rules. Extra
 * per-vertex attributes ({ array, size }) are interpolated linearly
 * (edge midpoints), so baked data follows the refined surface.
 */
export function loopSubdivide(pos, idx, attrs = []) {
  const n = pos.length / 3;
  const edges = new Map(); // key -> { a, b, opp: [], id }
  const key = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k], b = idx[t + ((k + 1) % 3)], c = idx[t + ((k + 2) % 3)];
      const kk = key(a, b);
      let e = edges.get(kk);
      if (!e) edges.set(kk, (e = { a, b, opp: [], id: 0 }));
      e.opp.push(c);
    }
  }
  const m = n + edges.size;
  const out = new Float32Array(m * 3);
  const outAttrs = attrs.map((at) => ({ array: new Float32Array(m * at.size), size: at.size }));

  // neighbours and boundary neighbours of each original vertex
  const nb = Array.from({ length: n }, () => []);
  const bnb = Array.from({ length: n }, () => []);
  let next = n;
  for (const e of edges.values()) {
    e.id = next++;
    nb[e.a].push(e.b);
    nb[e.b].push(e.a);
    if (e.opp.length !== 2) {
      bnb[e.a].push(e.b);
      bnb[e.b].push(e.a);
    }
    const o = e.id * 3;
    for (let c = 0; c < 3; c++) {
      out[o + c] =
        e.opp.length === 2
          ? 0.375 * (pos[e.a * 3 + c] + pos[e.b * 3 + c]) + 0.125 * (pos[e.opp[0] * 3 + c] + pos[e.opp[1] * 3 + c])
          : 0.5 * (pos[e.a * 3 + c] + pos[e.b * 3 + c]);
    }
    attrs.forEach((at, i) => {
      for (let c = 0; c < at.size; c++) outAttrs[i].array[e.id * at.size + c] = 0.5 * (at.array[e.a * at.size + c] + at.array[e.b * at.size + c]);
    });
  }
  for (let v = 0; v < n; v++) {
    const o = v * 3;
    if (bnb[v].length === 2) {
      const [p, q] = bnb[v];
      for (let c = 0; c < 3; c++) out[o + c] = 0.75 * pos[o + c] + 0.125 * (pos[p * 3 + c] + pos[q * 3 + c]);
    } else if (bnb[v].length > 0 || nb[v].length < 3) {
      for (let c = 0; c < 3; c++) out[o + c] = pos[o + c]; // corner / non-manifold: keep
    } else {
      const k = nb[v].length;
      const beta = k === 3 ? 3 / 16 : 3 / (8 * k);
      for (let c = 0; c < 3; c++) {
        let s = 0;
        for (const u of nb[v]) s += pos[u * 3 + c];
        out[o + c] = (1 - k * beta) * pos[o + c] + beta * s;
      }
    }
    attrs.forEach((at, i) => {
      for (let c = 0; c < at.size; c++) outAttrs[i].array[v * at.size + c] = at.array[v * at.size + c];
    });
  }
  const oi = new Uint32Array(idx.length * 4);
  let w = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ab = edges.get(key(a, b)).id, bc = edges.get(key(b, c)).id, ca = edges.get(key(c, a)).id;
    oi.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], w);
    w += 12;
  }
  return { pos: out, idx: oi, attrs: outAttrs };
}

/** Area-weighted smooth vertex normals. */
export function normals(pos, idx) {
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { nrm[v * 3] += nx; nrm[v * 3 + 1] += ny; nrm[v * 3 + 2] += nz; }
  }
  for (let v = 0; v < nrm.length; v += 3) {
    const l = Math.hypot(nrm[v], nrm[v + 1], nrm[v + 2]) || 1;
    nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l;
  }
  return nrm;
}

/** Signed volume; flips winding of a (mostly closed) mesh that is inside-out. */
export function fixWinding(pos, idx) {
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (vol < 0) for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; }
  return vol < 0;
}

/** Fraction of edges that are not shared by exactly two triangles. */
export function openEdgeShare(idx) {
  const cnt = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = idx[t + k], b = idx[t + ((k + 1) % 3)];
      const kk = a < b ? `${a},${b}` : `${b},${a}`;
      cnt.set(kk, (cnt.get(kk) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const c of cnt.values()) if (c !== 2) open++;
  return open / cnt.size;
}
