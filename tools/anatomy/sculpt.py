"""Signed-distance sculpting helpers for the ZahraaFit anatomy model.

Everything here is original procedural geometry: muscles are swept elliptical
fibre bundles between anatomical landmarks, bones and organs are blends of
simple shapes. Units are metres, y is up, the body faces +z, and the body's
left side is +x. Parts are built for the left side and mirrored.
"""
import numpy as np
from scipy.interpolate import make_interp_spline

# ---------------------------------------------------------------- basics
def V(*a):
    return np.array(a, dtype=float)

def unit(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)

def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def smax(a, b, k):
    return -smin(-a, -b, k)

def prof(w0, wm, w1, peak=0.5):
    """Width profile along a fibre: w0 at origin, wm at the belly, w1 at insertion."""
    def f(t):
        t = np.asarray(t, float)
        a = np.sin(0.5 * np.pi * np.clip(t / peak, 0, 1))
        b = np.cos(0.5 * np.pi * np.clip((t - peak) / (1 - peak), 0, 1))
        return np.where(t < peak, w0 + (wm - w0) * a, w1 + (wm - w1) * b)
    return f

def spline(points, n=32):
    P = np.array(points, float)
    if len(P) == 2:
        t = np.linspace(0, 1, n)[:, None]
        return P[0] * (1 - t) + P[1] * t
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    d /= d[-1]
    k = min(3, len(P) - 1)
    sp = make_interp_spline(d, P, k=k)
    return sp(np.linspace(0, 1, n))

# ---------------------------------------------------------------- body surfaces
# Torso "core" (rib cage + deep abdominal wall) as a superellipse stack.
TY = np.array([0.84, 0.90, 0.96, 1.02, 1.08, 1.14, 1.20, 1.26, 1.32, 1.38, 1.42, 1.455, 1.48])
TA = np.array([0.120, 0.140, 0.148, 0.134, 0.124, 0.128, 0.136, 0.142, 0.143, 0.136, 0.118, 0.085, 0.058])
TB = np.array([0.082, 0.086, 0.086, 0.080, 0.080, 0.085, 0.093, 0.098, 0.097, 0.090, 0.078, 0.062, 0.050])
TZ = np.array([-0.004, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.004, -0.010, -0.016, -0.020, -0.020])
TP = 2.35

def torso_abz(y):
    return np.interp(y, TY, TA), np.interp(y, TY, TB), np.interp(y, TY, TZ)

def torso(theta, y, off=0.0):
    """Point on the torso core at angle theta (0 front, +pi/2 left side, pi back), height y, pushed out by off."""
    a, b, zc = torso_abz(y)
    s, c = np.sin(theta), np.cos(theta)
    e = 2.0 / TP
    x = a * np.sign(s) * np.abs(s) ** e
    z = zc + b * np.sign(c) * np.abs(c) ** e
    n = unit(V(x / a ** 2, 0.0, (z - zc) / b ** 2))
    return V(x, y, z) + n * off

def torso_sdf(P, shrink=0.0):
    a, b, zc = torso_abz(P[:, 1])
    a = a - shrink
    b = b - shrink
    r = ((np.abs(P[:, 0]) / a) ** TP + (np.abs(P[:, 2] - zc) / b) ** TP) ** (1 / TP)
    return (r - 1) * np.minimum(a, b)

class Limb:
    """Cylindrical frame along a limb segment. phi=0 points to the front (+z), +phi to the lateral side."""
    def __init__(self, p0, p1, rlat, rfront, side=1):
        self.p0, self.p1 = V(*p0), V(*p1)
        self.u = unit(self.p1 - self.p0)
        self.len = np.linalg.norm(self.p1 - self.p0)
        f = V(0, 0, 1) - self.u * self.u[2]
        self.f = unit(f)
        self.l = unit(np.cross(self.u, self.f)) * (-1 if np.cross(self.u, self.f)[0] * side < 0 else 1)
        self.rlat, self.rfront = rlat, rfront   # callables of t

    def axis(self, t):
        return self.p0 + self.u * self.len * t

    def __call__(self, phi, t, off=0.0):
        rl, rf = self.rlat(t), self.rfront(t)
        d = self.f * np.cos(phi) * rf + self.l * np.sin(phi) * rl
        n = unit(self.f * np.cos(phi) / rf + self.l * np.sin(phi) / rl)
        return self.axis(t) + d + n * off

def lin(a, b):
    return lambda t: a + (b - a) * t

# ---------------------------------------------------------------- tube SDF
def tube_sdf(P, C, W, TH, N, band=0.014):
    """Swept elliptical tube: centres C (M,3), half-width W, half-thickness TH, outward normals N.
    Points farther than `band` get a cheap bounding-sphere estimate instead of the exact value."""
    mids = (C[1:] + C[:-1]) / 2
    rads = np.linalg.norm(C[1:] - C[:-1], axis=1) / 2 + np.maximum(np.maximum(W[1:], W[:-1]), np.maximum(TH[1:], TH[:-1]))
    coarse = np.full(len(P), np.inf)
    for m, r in zip(mids, rads):
        coarse = np.minimum(coarse, np.linalg.norm(P - m, axis=1) - r)
    mask = coarse < band
    if not mask.any():
        return coarse
    out = coarse.copy()
    out[mask] = _tube_exact(P[mask], C, W, TH, N)
    return out

def _tube_exact(P, C, W, TH, N):
    best = np.full(len(P), np.inf)
    for i in range(len(C) - 1):
        A, B = C[i], C[i + 1]
        AB = B - A
        L2 = AB @ AB
        if L2 < 1e-12:
            continue
        t = np.clip(((P - A) @ AB) / L2, 0, 1)
        c = A + t[:, None] * AB
        w = W[i] + (W[i + 1] - W[i]) * t
        th = TH[i] + (TH[i + 1] - TH[i]) * t
        d = P - c
        T = AB / np.sqrt(L2)
        n = unit(N[i][None, :] * (1 - t)[:, None] + N[i + 1][None, :] * t[:, None])
        n = unit(n - (n @ T)[:, None] * T)
        bv = np.cross(T, n)
        a = np.einsum('ij,ij->i', d, n)
        b = np.einsum('ij,ij->i', d, bv)
        e = d @ T
        r = np.minimum(w, th)
        q = np.sqrt((a / th) ** 2 + (b / w) ** 2 + (e / r) ** 2)
        best = np.minimum(best, (q - 1) * r)
    return best

class Strand:
    """One fibre bundle. pts: control points; w, th: profiles (callables of t);
    normal: 'axis' (away from nearest body axis), a point (away from it) or a fixed vector."""
    def __init__(self, pts, w, th, normal='axis', n=30):
        self.C = spline(pts, n)
        t = np.linspace(0, 1, n)
        self.W = np.maximum(w(t) if callable(w) else np.full(n, w), 6e-4)
        self.TH = np.maximum(th(t) if callable(th) else np.full(n, th), 6e-4)
        self.normal = normal

    def bbox(self):
        r = max(self.W.max(), self.TH.max()) + 0.004
        return self.C.min(0) - r, self.C.max(0) + r

    def normals(self, axes):
        C = self.C
        if isinstance(self.normal, str):
            return np.array([axis_normal(p, axes) for p in C])
        kind, v = self.normal
        if kind == 'dir':
            return np.tile(unit(np.asarray(v, float)), (len(C), 1))
        return unit(C - np.asarray(v, float))   # ('point', centre)

    def sdf(self, P, axes):
        return tube_sdf(P, self.C, self.W, self.TH, self.normals(axes))

def axis_normal(p, axes):
    best, bn = 1e9, V(0, 0, 1)
    for a, b in axes:
        ab = b - a
        t = np.clip((p - a) @ ab / (ab @ ab), 0, 1)
        c = a + ab * t
        d = np.linalg.norm(p - c)
        if d < best:
            best = d
            n = p - c
            u = unit(ab)
            n = n - (n @ u) * u
            bn = unit(n) if np.linalg.norm(n) > 1e-9 else V(0, 0, 1)
    return bn

# ---------------------------------------------------------------- simple SDFs
def sd_ell(P, c, r, R=None):
    q = P - c
    if R is not None:
        q = q @ R
    k0 = np.linalg.norm(q / r, axis=1)
    return (k0 - 1) * min(r)

def sd_sphere(P, c, r):
    return np.linalg.norm(P - c, axis=1) - r

def sd_capsule(P, a, b, ra, rb):
    ab = b - a
    t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + ab * t[:, None]), axis=1) - (ra + (rb - ra) * t)

def sd_round_tube(P, pts, r0, r1=None, n=24):
    C = spline(pts, n)
    r1 = r0 if r1 is None else r1
    R = np.linspace(r0, r1, n) if not callable(r0) else r0(np.linspace(0, 1, n))
    best = np.full(len(P), np.inf)
    for i in range(n - 1):
        best = np.minimum(best, sd_capsule(P, C[i], C[i + 1], R[i], R[i + 1]))
    return best

def rot(ax, ang):
    ax = unit(ax)
    x, y, z = ax
    c, s = np.cos(ang), np.sin(ang)
    C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])

def euler(rx, ry, rz):
    return rot(V(1, 0, 0), rx) @ rot(V(0, 1, 0), ry) @ rot(V(0, 0, 1), rz)

# ---------------------------------------------------------------- parametric tube mesh
def tube_mesh(pts, radius, n=64, seg=10, cap=True, flat=1.0):
    """Mesh a smooth tube along control points (for tendons, vessels, intestines)."""
    C = spline(pts, n) if len(pts) < n else np.asarray(pts, float)
    m = len(C)
    T = unit(np.gradient(C, axis=0))
    ref = V(0, 0, 1) if abs(T[0][2]) < 0.9 else V(1, 0, 0)
    Nv = unit(np.cross(T[0], ref))
    Ns = [Nv]
    for i in range(1, m):
        v = Ns[-1] - (Ns[-1] @ T[i]) * T[i]
        Ns.append(unit(v))
    Ns = np.array(Ns)
    Bs = np.cross(T, Ns)
    R = radius(np.linspace(0, 1, m)) if callable(radius) else np.full(m, radius)
    ang = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    verts = []
    for i in range(m):
        for a in ang:
            verts.append(C[i] + R[i] * (Ns[i] * np.cos(a) * flat + Bs[i] * np.sin(a)))
    verts = np.array(verts)
    faces = []
    for i in range(m - 1):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            c = (i + 1) * seg + j
            d = (i + 1) * seg + (j + 1) % seg
            faces += [[a, c, b], [b, c, d]]
    if cap:
        s0 = len(verts)
        verts = np.vstack([verts, C[0], C[-1]])
        for j in range(seg):
            faces.append([s0, j, (j + 1) % seg])
            o = (m - 1) * seg
            faces.append([s0 + 1, o + (j + 1) % seg, o + j])
    return verts, np.array(faces)
