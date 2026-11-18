import { BufferAttribute, BufferGeometry } from "three";

/**
 * Interpolating surface refinement for close-up inspection, without changing
 * the anatomy:
 *
 * every original vertex keeps its exact position; each triangle is split in
 * four and the three new edge vertices are placed on the curved PN-triangle
 * patch (Vlachos et al. 2001) defined by the ORIGINAL vertices and their
 * smooth normals — i.e. on the smooth surface the source mesh already
 * describes, not on a new shape. Silhouettes and shading of coarse source
 * triangles (median edge 3–6 mm, up to ~2 cm in Z-Anatomy) become smooth at
 * close range.
 *
 * Safety rules, so the refinement can never invent geometry:
 *  - creases (normals more than CREASE apart, e.g. the thin free edge of a
 *    flat muscle) keep the straight midpoint;
 *  - an edge vertex never moves more than 20 % of the edge length, and never
 *    more than 0.5 mm, away from the straight midpoint (stacked muscle layers
 *    can lie less than a millimetre apart);
 *  - edge vertices are keyed by position, so triangles that share an edge
 *    (also across duplicated seam vertices) share the same new vertex: no cracks.
 *
 * All other vertex attributes (normal, the baked `_anat` / `_fiber`, colours)
 * are interpolated; normals use the PN quadratic normal field.
 */

const CREASE = Math.cos((60 * Math.PI) / 180);
const MAX_OFFSET = 0.2;
/** Absolute cap (mesh units = metres): stacked muscle layers can lie < 1 mm apart. */
const MAX_OFFSET_ABS = 0.0005;

export interface RefineStats {
  trianglesBefore: number;
  trianglesAfter: number;
  /** Largest distance (in mesh units) of a new vertex from its straight edge midpoint. */
  maxOffset: number;
  /** Mean distance of new vertices from the straight edge midpoint. */
  meanOffset: number;
}

export function refineGeometry(src: BufferGeometry): { geometry: BufferGeometry; stats: RefineStats } {
  const pos = src.getAttribute("position");
  const nrm = src.getAttribute("normal");
  const index = src.getIndex();
  if (!pos || !nrm || !index) throw new Error("refineGeometry: indexed geometry with normals required");
  const names = Object.keys(src.attributes).filter((n) => n !== "position" && n !== "normal");
  const nV = pos.count;
  const nT = index.count / 3;

  // Output buffers (upper bound: one new vertex per edge ≤ 3 per triangle).
  const maxV = nV + nT * 3;
  const P = new Float32Array(maxV * 3);
  const N = new Float32Array(maxV * 3);
  const extra = names.map((n) => {
    const a = src.getAttribute(n);
    return { name: n, size: a.itemSize, src: a, out: new Float32Array(maxV * a.itemSize) };
  });
  for (let i = 0; i < nV; i++) {
    P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i);
    N[i * 3] = nrm.getX(i); N[i * 3 + 1] = nrm.getY(i); N[i * 3 + 2] = nrm.getZ(i);
    // getX..getW de-normalise quantised attributes (getComponent would not).
    for (const e of extra) for (let k = 0; k < e.size; k++) e.out[i * e.size + k] = k === 0 ? e.src.getX(i) : k === 1 ? e.src.getY(i) : k === 2 ? e.src.getZ(i) : e.src.getW(i);
  }

  // Position key (quantised to 1 µm-ish relative units) so seam duplicates share edges.
  const key = (i: number) => `${Math.round(P[i * 3] * 1e6)},${Math.round(P[i * 3 + 1] * 1e6)},${Math.round(P[i * 3 + 2] * 1e6)}`;
  const vkey: string[] = new Array(nV);
  for (let i = 0; i < nV; i++) vkey[i] = key(i);
  const edgeVert = new Map<string, number>();
  let nOut = nV;
  let maxOff = 0, sumOff = 0, nOff = 0;

  const mid = (a: number, b: number): number => {
    const ka = vkey[a], kb = vkey[b];
    // Keyed by position AND by the attribute side (a seam may carry two different
    // normals / fibres for the same position: keep one vertex per side).
    const ek = (ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`) + `#${a < b ? a : b}:${a < b ? b : a}`;
    const posKey = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const hit = edgeVert.get(ek);
    if (hit !== undefined) return hit;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const n1x = N[a * 3], n1y = N[a * 3 + 1], n1z = N[a * 3 + 2];
    const n2x = N[b * 3], n2y = N[b * 3 + 1], n2z = N[b * 3 + 2];
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz;
    const len = Math.sqrt(len2);
    let mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    let nx = n1x + n2x, ny = n1y + n2y, nz = n1z + n2z;
    const crease = n1x * n2x + n1y * n2y + n1z * n2z < CREASE;
    if (!crease && len2 > 0) {
      // Cubic Bézier edge of the PN patch, evaluated at t = 0.5.
      const w12 = dx * n1x + dy * n1y + dz * n1z;
      const w21 = -(dx * n2x + dy * n2y + dz * n2z);
      const b210x = (2 * ax + bx - w12 * n1x) / 3, b210y = (2 * ay + by - w12 * n1y) / 3, b210z = (2 * az + bz - w12 * n1z) / 3;
      const b120x = (2 * bx + ax - w21 * n2x) / 3, b120y = (2 * by + ay - w21 * n2y) / 3, b120z = (2 * bz + az - w21 * n2z) / 3;
      let px = (ax + 3 * b210x + 3 * b120x + bx) / 8, py = (ay + 3 * b210y + 3 * b120y + by) / 8, pz = (az + 3 * b210z + 3 * b120z + bz) / 8;
      let ox = px - mx, oy = py - my, oz = pz - mz;
      const off = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const lim = Math.min(MAX_OFFSET * len, MAX_OFFSET_ABS);
      if (off > lim) {
        const s = lim / off;
        ox *= s; oy *= s; oz *= s;
        px = mx + ox; py = my + oy; pz = mz + oz;
      }
      const o = Math.min(off, lim);
      if (o > maxOff) maxOff = o;
      sumOff += o;
      nOff++;
      mx = px; my = py; mz = pz;
      // PN quadratic normal at the edge midpoint.
      const v12 = (2 * (dx * (n1x + n2x) + dy * (n1y + n2y) + dz * (n1z + n2z))) / len2;
      const hx = n1x + n2x - v12 * dx, hy = n1y + n2y - v12 * dy, hz = n1z + n2z - v12 * dz;
      const hl = Math.hypot(hx, hy, hz) || 1;
      nx = 0.25 * n1x + 0.5 * (hx / hl) + 0.25 * n2x;
      ny = 0.25 * n1y + 0.5 * (hy / hl) + 0.25 * n2y;
      nz = 0.25 * n1z + 0.5 * (hz / hl) + 0.25 * n2z;
    }
    // Same position for every side of a seam: reuse the position computed first.
    const shared = edgeVert.get(posKey);
    const v = nOut++;
    if (shared !== undefined) {
      mx = P[shared * 3]; my = P[shared * 3 + 1]; mz = P[shared * 3 + 2];
    } else edgeVert.set(posKey, v);
    const nl = Math.hypot(nx, ny, nz) || 1;
    P[v * 3] = mx; P[v * 3 + 1] = my; P[v * 3 + 2] = mz;
    N[v * 3] = nx / nl; N[v * 3 + 1] = ny / nl; N[v * 3 + 2] = nz / nl;
    for (const e of extra) {
      // Line fields (fibres): align the two directions before averaging.
      const flip = e.name === "_fiber" && e.out[a * 3] * e.out[b * 3] + e.out[a * 3 + 1] * e.out[b * 3 + 1] + e.out[a * 3 + 2] * e.out[b * 3 + 2] < 0 ? -1 : 1;
      for (let k = 0; k < e.size; k++) e.out[v * e.size + k] = (e.out[a * e.size + k] + flip * e.out[b * e.size + k]) / 2;
    }
    edgeVert.set(ek, v);
    return v;
  };

  const idx = new Uint32Array(nT * 12);
  for (let t = 0; t < nT; t++) {
    const a = index.getX(3 * t), b = index.getX(3 * t + 1), c = index.getX(3 * t + 2);
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], t * 12);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(P.slice(0, nOut * 3), 3));
  g.setAttribute("normal", new BufferAttribute(N.slice(0, nOut * 3), 3));
  for (const e of extra) {
    const out = e.out.slice(0, nOut * e.size);
    // Unit vectors stay unit vectors after averaging.
    if (e.name === "_fiber") {
      for (let i = nV; i < nOut; i++) {
        const l = Math.hypot(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]) || 1;
        out[i * 3] /= l; out[i * 3 + 1] /= l; out[i * 3 + 2] /= l;
      }
    }
    g.setAttribute(e.name, new BufferAttribute(out, e.size));
  }
  g.setIndex(new BufferAttribute(idx, 1));
  for (const gr of src.groups) g.addGroup(gr.start * 4, gr.count * 4, gr.materialIndex);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return { geometry: g, stats: { trianglesBefore: nT, trianglesAfter: nT * 4, maxOffset: maxOff, meanOffset: nOff ? sumOff / nOff : 0 } };
}

/**
 * The baked fibre field is a line field: ±F are the same fibre. The bake points
 * it toward the nearest tendon, so it flips sign half way between origin and
 * insertion. Averaging or interpolating across such a flip gives ~0 (a garbage
 * direction / specular sparkles). Orient every vector to the muscle's dominant
 * fibre axis (largest eigenvector of Σ f fᵀ) so neighbours agree.
 */
export function orientFibres(g: BufferGeometry): void {
  const f = g.getAttribute("_fiber");
  if (!f) return;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < f.count; i++) {
    const x = f.getX(i), y = f.getY(i), z = f.getZ(i);
    xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z;
  }
  let ax = 0.3, ay = 1, az = 0.2;
  for (let k = 0; k < 40; k++) {
    const nx = xx * ax + xy * ay + xz * az, ny = xy * ax + yy * ay + yz * az, nz = xz * ax + yz * ay + zz * az;
    const l = Math.hypot(nx, ny, nz) || 1;
    ax = nx / l; ay = ny / l; az = nz / l;
  }
  const out = new Float32Array(f.count * 3);
  for (let i = 0; i < f.count; i++) {
    let x = f.getX(i), y = f.getY(i), z = f.getZ(i);
    if (x * ax + y * ay + z * az < 0) { x = -x; y = -y; z = -z; }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  g.setAttribute("_fiber", new BufferAttribute(out, 3));
}

/** Per-vertex tangent (vec4) along the fibre direction, for anisotropic specular. */
export function fibreTangents(g: BufferGeometry): void {
  const f = g.getAttribute("_fiber");
  if (!f) return;
  const t = new Float32Array(f.count * 4);
  for (let i = 0; i < f.count; i++) {
    t[i * 4] = f.getX(i); t[i * 4 + 1] = f.getY(i); t[i * 4 + 2] = f.getZ(i); t[i * 4 + 3] = 1;
  }
  g.setAttribute("tangent", new BufferAttribute(t, 4));
}
