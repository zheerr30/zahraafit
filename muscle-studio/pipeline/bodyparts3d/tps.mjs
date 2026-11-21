// Regularized 3D thin-plate spline (kernel φ(r) = r, affine part 1,x,y,z).
// Solves [K + λI  P; Pᵀ 0] [W; A] = [Y; 0] for 3 output channels.

function solve(M, B) {
  // Gaussian elimination with partial pivoting; M: n×n (array of Float64Array), B: n×3
  const n = M.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    [B[c], B[p]] = [B[p], B[c]];
    const d = M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
      for (let k = 0; k < 3; k++) B[r][k] -= f * B[c][k];
    }
  }
  const X = Array.from({ length: n }, () => [0, 0, 0]);
  for (let r = n - 1; r >= 0; r--) {
    for (let k = 0; k < 3; k++) {
      let s = B[r][k];
      for (let c = r + 1; c < n; c++) s -= M[r][c] * X[c][k];
      X[r][k] = s / M[r][r];
    }
  }
  return X;
}

/** src, dst: arrays of [x,y,z] landmark pairs. Returns warp(x,y,z) → [x',y',z']. */
export function fitTps(src, dst, lambda) {
  const n = src.length;
  const N = n + 4;
  const M = Array.from({ length: N }, () => new Float64Array(N));
  const B = Array.from({ length: N }, () => [0, 0, 0]);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] = Math.hypot(src[i][0] - src[j][0], src[i][1] - src[j][1], src[i][2] - src[j][2]);
    // φ(r)=r is conditionally NEGATIVE definite, so regularization subtracts λ.
    M[i][i] -= lambda;
    const p = [1, src[i][0], src[i][1], src[i][2]];
    for (let k = 0; k < 4; k++) { M[i][n + k] = p[k]; M[n + k][i] = p[k]; }
    // Fit displacement (dst - src): λ then damps the non-affine part only.
    B[i] = [dst[i][0] - src[i][0], dst[i][1] - src[i][1], dst[i][2] - src[i][2]];
  }
  const X = solve(M, B);
  const W = X.slice(0, n), A = X.slice(n);
  return (x, y, z) => {
    const d = [A[0][0] + A[1][0] * x + A[2][0] * y + A[3][0] * z, A[0][1] + A[1][1] * x + A[2][1] * y + A[3][1] * z, A[0][2] + A[1][2] * x + A[2][2] * y + A[3][2] * z];
    for (let i = 0; i < n; i++) {
      const r = Math.hypot(x - src[i][0], y - src[i][1], z - src[i][2]);
      d[0] += W[i][0] * r; d[1] += W[i][1] * r; d[2] += W[i][2] * r;
    }
    return [x + d[0], y + d[1], z + d[2]];
  };
}

/** Farthest-point sampling of k points from a flat xyz array; returns indices. */
export function farthestPoints(pos, k) {
  const n = pos.length / 3;
  const dist = new Float64Array(n).fill(Infinity);
  const out = [0];
  for (let s = 1; s < k; s++) {
    const last = out[out.length - 1];
    let best = 0, bestD = -1;
    for (let i = 0; i < n; i++) {
      const d = (pos[i * 3] - pos[last * 3]) ** 2 + (pos[i * 3 + 1] - pos[last * 3 + 1]) ** 2 + (pos[i * 3 + 2] - pos[last * 3 + 2]) ** 2;
      if (d < dist[i]) dist[i] = d;
      if (dist[i] > bestD) { bestD = dist[i]; best = i; }
    }
    out.push(best);
  }
  return out;
}
