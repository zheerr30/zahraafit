"""Build the ZahraaFit anatomy model: sculpt every part, mesh it, and pack it for anatomy-3d.html.

Usage: python3 build.py [out_dir] [name_filter]
"""
import json, os, sys, time
import numpy as np
import trimesh, fast_simplification
from multiprocessing import Pool
from skimage.measure import marching_cubes
from scipy.ndimage import gaussian_filter
from sculpt import V, torso_sdf, sd_capsule
import anatomy as A

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'anatomy')
FILTER = sys.argv[2] if len(sys.argv) > 2 else None
PARTS = [p for p in A.PARTS if not FILTER or FILTER in p['name'] or FILTER in p['g']]

# skin field grid (symmetric in x so left parts can be mirrored by flipping the index)
SH = 0.005
SX = np.linspace(-0.40, 0.40, 161)
SY = np.arange(-0.02, 1.785, SH)
SZ = np.arange(-0.16, 0.205, SH)

DENSITY = {'muscles': 1.5e5, 'bones': 1.25e5, 'organs': 1.1e5}

def eval_grid(fn, xs, ys, zs):
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    out = np.empty(len(P))
    for s in range(0, len(P), 250000):
        out[s:s + 250000] = fn(P[s:s + 250000])
    return out.reshape(X.shape)

def finish(Vs, F, layer, target=None, smooth=0):
    m = trimesh.Trimesh(Vs, F, process=True)
    m.remove_unreferenced_vertices()
    # orient outward while the mesh is still closed (decimation keeps the winding)
    if m.volume < 0:
        m.invert()
    if smooth:
        v0 = m.vertices.copy()
        trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=smooth)
        moved = np.linalg.norm(m.vertices - v0, axis=1) > 0.004
        if moved.any():
            v = m.vertices.copy(); v[moved] = v0[moved]; m.vertices = v
    tgt = target or int(np.clip(m.area * DENSITY.get(layer, 1.3e5), 220, 8000))
    if len(m.faces) > tgt:
        lo0, hi0 = m.bounds
        for agg in (6, 3, 1):
            v, f = fast_simplification.simplify(np.asarray(m.vertices, np.float32), np.asarray(m.faces, np.int64), target_reduction=1 - tgt / len(m.faces), agg=agg)
            # the decimator occasionally throws a vertex far away; reject that result
            if (v.min(0) >= lo0 - 0.002).all() and (v.max(0) <= hi0 + 0.002).all():
                m = trimesh.Trimesh(v, f, process=True)
                break
        else:
            tgt = len(m.faces)
    pass
    return np.asarray(m.vertices, np.float32), np.asarray(m.faces, np.uint32)

def work(i):
    p = PARTS[i]
    t0 = time.time()
    skin = None
    if p['kind'] == 'mesh':
        Vs, F = finish(p['V'], p['F'], p['layer'], target=max(200, min(len(p['F']), 6000)))
    else:
        lo, hi = p['lo'], p['hi']
        h = p['h'] or float(np.clip((np.prod(hi - lo) / 350000) ** (1 / 3), 0.0012, 0.0035))
        xs, ys, zs = (np.arange(lo[k], hi[k] + h, h) for k in range(3))
        vol = eval_grid(p['fn'], xs, ys, zs)
        if vol.min() >= 0 or vol.max() <= 0:
            return i, None, None, f"EMPTY {p['name']}"
        vol = np.pad(vol, 1, constant_values=vol.max())
        verts, faces, _, _ = marching_cubes(vol, 0.0, spacing=(h, h, h))
        verts = verts + lo - h
        Vs, F = finish(verts, faces[:, ::-1], p['layer'], target=p.get('target'), smooth=p['smooth'])
        if p['skin'] and p['layer'] in ('muscles', 'bones'):
            ix = np.where((SX >= lo[0] - 0.01) & (SX <= hi[0] + 0.01))[0]
            iy = np.where((SY >= lo[1] - 0.01) & (SY <= hi[1] + 0.01))[0]
            iz = np.where((SZ >= lo[2] - 0.01) & (SZ <= hi[2] + 0.01))[0]
            if len(ix) and len(iy) and len(iz):
                sub = eval_grid(p['fn'], SX[ix], SY[iy], SZ[iz]).astype(np.float32)
                skin = (ix[0], iy[0], iz[0], sub)
    return i, (Vs, F), skin, f"{p['name']}: {len(F)} tris {time.time() - t0:.1f}s"

def skin_cores(P):
    """Solid fill so the skin wraps the body, not the gaps between muscles."""
    d = torso_sdf(P, -0.004)
    d = np.where((P[:, 1] > 0.86) & (P[:, 1] < 1.47), d, 1.0)
    for s in (-1, 1):
        m = V(s, 1, 1)
        for a, b, ra, rb in [(A.H, A.E, 0.03, 0.026), (A.E, A.W, 0.026, 0.018), (A.THIGH.p0 + V(0, 0.04, 0), A.K, 0.06, 0.04), (A.K, A.A, 0.038, 0.02), (V(0.0, 0.93, -0.03), A.THIGH.p0, 0.06, 0.06)]:
            d = np.minimum(d, sd_capsule(P, a * m, b * m, ra, rb))
    d = np.minimum(d, sd_capsule(P, V(0, 1.42, -0.02), V(0, 1.62, -0.015), 0.045, 0.042))
    return d

def main():
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    results = {}
    skin_field = np.full((len(SX), len(SY), len(SZ)), 1.0, np.float32)
    with Pool(4) as pool:
        for i, mesh, skin, msg in pool.imap_unordered(work, range(len(PARTS))):
            print(msg, flush=True)
            if mesh is None:
                continue
            results[i] = mesh
            if skin is not None:
                x0, y0, z0, sub = skin
                sl = (slice(x0, x0 + sub.shape[0]), slice(y0, y0 + sub.shape[1]), slice(z0, z0 + sub.shape[2]))
                skin_field[sl] = np.minimum(skin_field[sl], sub)
                if PARTS[i]['side'] == 'L':
                    mx = slice(len(SX) - x0 - sub.shape[0], len(SX) - x0)
                    skin_field[mx, sl[1], sl[2]] = np.minimum(skin_field[mx, sl[1], sl[2]], sub[::-1])
    parts = []
    for i in sorted(results):
        p = PARTS[i]
        Vs, F = results[i]
        parts.append((p['name'], p['g'], p['layer'], Vs, F))
        if p['side'] == 'L':
            Vm = Vs.copy(); Vm[:, 0] *= -1
            parts.append(('right ' + p['name'], p['g'], p['layer'], Vm, F[:, ::-1].copy()))
    if not FILTER:
        print('skin...', flush=True)
        core = eval_grid(skin_cores, SX, SY, SZ).astype(np.float32)
        field = gaussian_filter(np.minimum(skin_field, core), 1.1)
        verts, faces, _, _ = marching_cubes(field, 0.0028, spacing=(SH, SH, SH))
        verts = verts + V(SX[0], SY[0], SZ[0])
        m = trimesh.Trimesh(verts, faces[:, ::-1], process=True)
        comps = m.split(only_watertight=False)
        m = max(comps, key=lambda c: len(c.faces))
        trimesh.smoothing.filter_taubin(m, iterations=6)
        Vs, F = finish(m.vertices, m.faces, 'skin', target=60000)
        parts.append(('skin', 'skin', 'skin', Vs, F))
    allv = np.concatenate([p[3] for p in parts])
    lo, hi = allv.min(0) - 1e-4, allv.max(0) + 1e-4
    meta = {'lo': lo.tolist(), 'hi': hi.tolist(), 'offset': [0.0, 0.0, 0.0], 'parts': []}
    bufs = {}
    for name, g, layer, Vs, F in parts:
        b = bufs.setdefault(layer, bytearray())
        q = np.round((Vs - lo) / (hi - lo) * 65535).astype(np.uint16)
        while len(b) % 4: b.append(0)
        off = len(b); b += q.tobytes()
        i32 = len(q) >= 65536
        while len(b) % 4: b.append(0)
        ioff = len(b); b += F.astype(np.uint32 if i32 else np.uint16).ravel().tobytes()
        meta['parts'].append(dict(name=name, g=g, layer=layer, off=off, nv=len(q), ioff=ioff, ni=int(F.size), i32=i32))
    for layer, b in bufs.items():
        open(os.path.join(OUT, layer + '.wasm'), 'wb').write(b)
        print(layer, len(b) // 1024, 'KB')
    json.dump(meta, open(os.path.join(OUT, 'parts.json'), 'w'), separators=(',', ':'))
    print('parts', len(parts), 'tris', sum(len(p[4]) for p in parts), f'{time.time() - t0:.0f}s')

if __name__ == '__main__':
    main()
