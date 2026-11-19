"""ZahraaFit anatomy: part definitions (original procedural model).

Every part is registered with a selectable group id (matching the page's DATA keys),
a layer, and a side: 'L' parts are built on the body's left (+x) and mirrored,
'M' parts are built whole on the midline.
"""
import numpy as np
from sculpt import (V, unit, smin, smax, prof, lin, spline, torso, torso_sdf, Limb, Strand,
                    sd_ell, sd_sphere, sd_capsule, sd_round_tube, tube_mesh, euler, rot)

PARTS = []

def sdf_part(name, g, layer, side, fn, lo, hi, h=None, skin=True, smooth=8, target=None):
    PARTS.append(dict(kind='sdf', name=name, g=g, layer=layer, side=side, fn=fn,
                      lo=np.asarray(lo, float), hi=np.asarray(hi, float), h=h, skin=skin, smooth=smooth, target=target))

def mesh_part(name, g, layer, side, VF):
    PARTS.append(dict(kind='mesh', name=name, g=g, layer=layer, side=side, V=VF[0], F=VF[1]))

# ------------------------------------------------------------------ landmarks (left side)
H = V(0.185, 1.415, -0.010)      # centre of humeral head
E = V(0.255, 1.115, -0.030)      # elbow
W = V(0.300, 0.860, 0.010)       # wrist
AC = V(0.090, 0.925, 0.020)      # hip joint (acetabulum)
K = V(0.095, 0.490, 0.000)       # knee
A = V(0.100, 0.075, -0.010)      # ankle
ME, LE = E + V(-0.032, 0, -0.004), E + V(0.030, 0, -0.004)
OL = E + V(-0.006, 0.004, -0.034)
CORA = V(0.165, 1.390, 0.042)
GT_H = V(0.205, 1.400, -0.030)
ACR = V(0.180, 1.462, -0.028)
ASIS, AIIS = V(0.125, 1.000, 0.070), V(0.112, 0.955, 0.055)
GTF = V(0.160, 0.905, -0.006)
ISCH = V(0.060, 0.838, -0.045)
FH = V(0.128, 0.458, -0.022)
CALC = V(0.100, 0.028, -0.072)
CR = V(0.0, 1.648, -0.012)
CRR = V(0.074, 0.088, 0.097)
MAST = V(0.058, 1.600, -0.022)

ARM = Limb(H, E, lin(0.030, 0.027), lin(0.029, 0.024))
FORE = Limb(E, W, lin(0.030, 0.021), lin(0.023, 0.013))
THIGH = Limb(V(0.108, 0.890, 0.006), K, lin(0.058, 0.040), lin(0.050, 0.037))
LEG = Limb(K, A, lin(0.040, 0.022), lin(0.034, 0.020))
NECK = Limb(V(0, 1.440, -0.016), V(0, 1.620, -0.008), lin(0.050, 0.044), lin(0.046, 0.042))

AXES = [(V(0, 0.85, 0), V(0, 1.46, -0.012)), (NECK.p0, NECK.p1), (V(0, 1.6, -0.01), V(0, 1.70, -0.012)),
        (H, E), (E, W), (W, V(0.32, 0.70, 0.02)), (THIGH.p0, K), (K, A), (V(0.1, 0.04, -0.04), V(0.115, 0.02, 0.15))]

CLAV = spline([V(0.022, 1.436, 0.068), V(0.070, 1.445, 0.064), V(0.130, 1.450, 0.035), V(0.176, 1.455, -0.008)], 40)
def clav(f):
    return CLAV[int(np.clip(f, 0, 1) * (len(CLAV) - 1))]

def skull(az, el, off=0.0):
    d = V(np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el))
    r = 1 / np.sqrt(np.sum((d / CRR) ** 2))
    return CR + d * (r + off)

def tline(t0, y0, t1, y1, n, off):
    return [torso(t0 + (t1 - t0) * f, y0 + (y1 - y0) * f, off) for f in np.linspace(0, 1, n)]

def muscle(name, g, strands, k=0.004, pad=0.006, h=None, side='L', target=None):
    lo = np.min([s.bbox()[0] for s in strands], axis=0) - pad
    hi = np.max([s.bbox()[1] for s in strands], axis=0) + pad
    def fn(P, strands=strands, k=k):
        d = None
        for s in strands:
            e = s.sdf(P, AXES)
            d = e if d is None else smin(d, e, k)
        return d
    sdf_part(name, g, 'muscles', side, fn, lo, hi, h=h, target=target)

def tendon(name, g, pts, r, flat=1.0, side='L', seg=8):
    mesh_part(name, g, 'muscles', side, tube_mesh(pts, r, n=48, seg=seg, flat=flat))

S = Strand
PI = np.pi

# ================================================================== TRUNK
# deep layer: intercostals + deep abdominal wall, a closed shell over the torso core
def deep_wall(P):
    d = np.abs(torso_sdf(P, -0.0022)) - 0.0024
    d = smax(d, P[:, 1] - 1.445, 0.004)
    return smax(d, 0.885 - P[:, 1], 0.004)
sdf_part('external intercostal and deep abdominal wall', 'intercostal', 'muscles', 'M', deep_wall,
         [-0.16, 0.87, -0.11], [0.16, 1.46, 0.115], h=0.0028, smooth=4, target=9000)

# rectus abdominis with tendinous intersections
def rect_th(y0, y1, base):
    def f(t):
        y = y0 + (y1 - y0) * t
        dip = sum(np.exp(-((y - yi) / 0.0055) ** 2) for yi in (1.065, 1.138, 1.205))
        return base * (1 - 0.7 * dip) * np.clip(np.sin(np.pi * np.clip(t, 0.02, 0.98)) ** 0.25, 0.3, 1)
    return f
ra = []
for tb, tt in [(0.055, 0.075), (0.12, 0.2), (0.17, 0.33)]:
    pts = tline(tb, 0.885, tt, 1.26, 8, 0.012)
    ra.append(S(pts, prof(0.017, 0.027, 0.027, 0.6), rect_th(0.885, 1.26, 0.0095)))
muscle('rectus abdominis', 'absfront', ra, k=0.01)
tendon('linea alba tendon', 'absfront', [torso(0, y, 0.008) for y in np.linspace(0.885, 1.25, 8)], 0.0055, flat=0.35, side='M')

# external oblique: from the lower ribs down and forward
eo = []
origins = [(0.68, 1.265), (0.85, 1.25), (1.02, 1.235), (1.22, 1.20), (1.42, 1.165), (1.62, 1.13), (1.82, 1.09)]
ins = [(0.40, 1.205), (0.40, 1.135), (0.40, 1.06), (0.42, 0.99), (0.75, 0.93), (1.15, 0.955), (1.55, 0.985)]
for (a0, y0), (a1, y1) in zip(origins, ins):
    eo.append(S(tline(a0, y0, a1, y1, 7, 0.011), 0.028, prof(0.004, 0.0085, 0.004)))
muscle('external oblique', 'absside', eo, k=0.014, h=0.0016)

# serratus anterior: separate finger-like slips
srr = []
for i, (a, y) in enumerate([(0.92, 1.345), (0.98, 1.305), (1.04, 1.265), (1.1, 1.225), (1.16, 1.185)]):
    srr.append(S(tline(a, y, 2.05, 1.39 - i * 0.022, 6, 0.009), prof(0.009, 0.011, 0.012), prof(0.003, 0.0055, 0.004, 0.3)))
muscle('serratus anterior', 'serratus', srr, k=0.0015, h=0.0015)

# pectoralis major
pec = []
orig = [clav(f) + V(0, 0.004, 0.006) for f in (0.02, 0.17, 0.32, 0.46)]
orig += [torso(0.04, y, 0.015) for y in (1.405, 1.36, 1.315, 1.275)] + [torso(0.2, 1.248, 0.016), torso(0.34, 1.242, 0.016)]
ipec = ARM(0.45, 0.19, 0.006)
for i, o in enumerate(orig):
    f = i / (len(orig) - 1)
    yo = o[1]
    mid = torso(0.62, yo + (1.36 - yo) * 0.45, 0.027)
    fold = V(0.155, 1.385 - 0.05 * f, 0.062 - 0.012 * f)
    pts = [o, (o + mid) / 2 + unit(mid - V(0, mid[1], 0)) * 0.006, mid, fold, ipec + V(0, 0.012 * (f - 0.5), 0)]
    pec.append(S(pts, prof(0.019, 0.027, 0.012, 0.4), prof(0.006, 0.013, 0.004, 0.45)))
muscle('pectoralis major', 'chest', pec, k=0.02, h=0.0017)

# latissimus dorsi
lat = []
lo_ = [(PI - 0.03, y) for y in (1.30, 1.24, 1.18, 1.12, 1.06)] + [(2.75, 1.0), (2.45, 0.995)]
ilat = ARM(-0.25, 0.17, 0.004)
for i, (a, y) in enumerate(lo_):
    f = i / (len(lo_) - 1)
    pts = tline(a, y, 2.05, 1.25 - 0.03 * f, 5, 0.012)
    pts += [torso(1.78, 1.29 - 0.02 * f, 0.026), V(0.168, 1.315, -0.03), ilat]
    lat.append(S(pts, prof(0.032, 0.036, 0.014, 0.55), prof(0.003, 0.007, 0.008, 0.75)))
muscle('latissimus dorsi', 'midback', lat, k=0.014, h=0.0017)

# thoracolumbar aponeurosis (white diamond over the lower back)
tlf = []
for a, top in [(PI - 0.02, 1.15), (PI - 0.16, 1.12), (PI - 0.3, 1.07), (PI - 0.42, 1.02)]:
    tlf.append(S(tline(a, 0.95, a, top, 5, 0.026), 0.022, 0.0016))
muscle('thoracolumbar fascia tendon', 'midback', tlf, k=0.006, h=0.0014)

# erector spinae
ere = []
for a, y0, y1, wm, tm in [(PI - 0.07, 0.95, 1.43, 0.012, 0.011), (PI - 0.2, 0.93, 1.42, 0.016, 0.014), (PI - 0.4, 0.96, 1.36, 0.014, 0.01)]:
    ere.append(S(tline(a, y0, a - 0.05, y1, 9, 0.004 + tm), prof(0.008, wm, 0.006, 0.3), prof(0.006, tm, 0.003, 0.25)))
muscle('erector spinae', 'lowerback', ere, k=0.005)

# trapezius
trp = []
for t, f in [(0.97, 0.3), (0.82, 0.5), (0.66, 0.68)]:
    o = NECK(PI - 0.04, t, 0.005)
    ins_ = clav(0.62 + 0.38 * (1 - f)) + V(0, 0.007, -0.004)
    pts = [o, NECK(PI - 0.7, t - 0.12, 0.012), V(0.07, 1.495 - 0.01 * f, -0.045), V(0.115, 1.468, -0.03), ins_]
    trp.append(S(pts, 0.03, prof(0.005, 0.009, 0.004, 0.45)))
for y, ins_ in [(1.475, ACR + V(0, 0.006, 0)), (1.43, V(0.16, 1.45, -0.055)), (1.385, V(0.13, 1.425, -0.08))]:
    trp.append(S(tline(PI - 0.02, y, PI - 0.8, (y + ins_[1]) / 2, 5, 0.022) + [ins_], 0.034, prof(0.004, 0.0065, 0.004)))
for y in (1.33, 1.27, 1.21, 1.16):
    trp.append(S(tline(PI - 0.02, y, PI - 0.5, 1.385, 6, 0.02) + [V(0.09, 1.405, -0.104)], prof(0.032, 0.03, 0.014), prof(0.003, 0.005, 0.004)))
muscle('trapezius', 'upperback', trp, k=0.014, h=0.0017)

# rhomboids (under trapezius)
rh = [S(tline(PI - 0.02, y, PI - 0.5, y - 0.06, 5, 0.012), 0.016, 0.0045) for y in (1.45, 1.42, 1.39, 1.36)]
muscle('rhomboid', 'rhomboid', rh, k=0.005)

# scapular muscles
inf_ = [S(tline(PI - 0.58 - 0.08 * i, 1.275 + 0.024 * i, PI - 1.15, 1.37, 5, 0.017) + [GT_H], prof(0.014, 0.018, 0.008), prof(0.004, 0.009, 0.004)) for i in range(5)]
muscle('infraspinatus', 'rotatorcuff', inf_, k=0.01, h=0.0017)
muscle('teres minor', 'rotatorcuff', [S(tline(PI - 1.0, 1.29, PI - 1.2, 1.35, 4, 0.016) + [GT_H + V(0, -0.012, -0.004)], 0.012, 0.008)])
muscle('supraspinatus', 'rotatorcuff', [S(tline(PI - 0.58, 1.418, PI - 0.95, 1.43, 4, 0.016) + [V(0.17, 1.44, -0.03), V(0.198, 1.428, -0.006)], 0.014, 0.009)])
muscle('teres major', 'teres', [S(tline(PI - 0.66, 1.245, PI - 0.95, 1.27, 4, 0.02) + [V(0.16, 1.295, -0.045), ARM(-0.35, 0.21, 0.004)], prof(0.014, 0.017, 0.009), prof(0.008, 0.012, 0.005))])

# ================================================================== SHOULDER & ARM
DT = ARM(1.15, 0.42, 0.004)
def deltoid(name, g, origins, azs):
    st = []
    for o, az in zip(origins, azs):
        d1 = unit(V(np.sin(az), 0.55, np.cos(az)))
        d2 = unit(V(np.sin(az) * 1.05, -0.45, np.cos(az)))
        pts = [o, H + d1 * 0.05, H + d2 * 0.052, DT]
        st.append(S(pts, prof(0.012, 0.018, 0.006, 0.45), prof(0.005, 0.0135, 0.004, 0.5), normal=('point', H)))
    muscle(name, g, st, k=0.006)
deltoid('deltoid clavicular part', 'frontdelt', [clav(f) + V(0, 0.005, 0.004) for f in (0.55, 0.68, 0.8, 0.92)], [0.15, 0.38, 0.6, 0.82])
deltoid('deltoid acromial part', 'sidedelt', [ACR + V(-0.004, 0.004, 0.022), ACR + V(0.006, 0.004, 0.006), ACR + V(0.004, 0.004, -0.01)], [1.05, 1.4, 1.75])
deltoid('deltoid spinal part', 'reardelt', [V(0.17, 1.452, -0.05), V(0.15, 1.44, -0.07), V(0.125, 1.425, -0.088), V(0.1, 1.41, -0.1)], [2.0, 2.3, 2.55, 2.8])

RT = E + V(-0.003, -0.045, 0.028)
UT = E + V(-0.01, -0.04, 0.016)
muscle('biceps brachii', 'biceps', [
    S([V(0.19, 1.408, 0.016), ARM(0.2, 0.16, 0.012), ARM(0.12, 0.52, 0.025), ARM(0.02, 0.83, 0.015), RT], prof(0.004, 0.017, 0.004, 0.55), prof(0.004, 0.016, 0.004, 0.55)),
    S([CORA, ARM(-0.35, 0.16, 0.012), ARM(-0.22, 0.52, 0.025), ARM(-0.08, 0.83, 0.014), RT], prof(0.004, 0.016, 0.004, 0.55), prof(0.004, 0.015, 0.004, 0.55))], k=0.005)
tendon('biceps distal tendon', 'biceps', [ARM(0, 0.86, 0.012), E + V(-0.002, -0.02, 0.034), RT], 0.0038)
muscle('brachialis', 'brachialis', [
    S([ARM(0.9, 0.45, 0.006), ARM(0.75, 0.72, 0.012), ARM(0.45, 0.93, 0.01), UT], prof(0.01, 0.02, 0.008), prof(0.004, 0.01, 0.004)),
    S([ARM(-0.6, 0.5, 0.006), ARM(-0.55, 0.75, 0.012), ARM(-0.3, 0.93, 0.01), UT], prof(0.01, 0.018, 0.008), prof(0.004, 0.01, 0.004))])
muscle('coracobrachialis', 'brachialis', [S([CORA, ARM(-0.65, 0.25, 0.01), ARM(-0.95, 0.48, 0.004)], prof(0.005, 0.01, 0.004), 0.007)])
IG = V(0.176, 1.385, -0.04)
muscle('triceps brachii', 'triceps', [
    S([IG, ARM(-2.55, 0.2, 0.012), ARM(-2.75, 0.5, 0.024), ARM(3.05, 0.8, 0.016), OL], prof(0.006, 0.017, 0.012, 0.5), prof(0.004, 0.016, 0.005, 0.5)),
    S([ARM(2.2, 0.12, 0.006), ARM(2.35, 0.4, 0.021), ARM(2.85, 0.76, 0.015), OL], prof(0.008, 0.017, 0.011, 0.45), prof(0.004, 0.015, 0.005, 0.45)),
    S([ARM(-2.0, 0.45, 0.006), ARM(-2.4, 0.75, 0.014), OL], prof(0.008, 0.014, 0.01), prof(0.004, 0.01, 0.005))], k=0.005)
muscle('triceps tendon plate', 'triceps', [S([ARM(3.1, 0.58, 0.03), ARM(3.12, 0.85, 0.022), OL + V(0, 0.004, -0.004)], prof(0.008, 0.014, 0.01), 0.0022)], k=0.002)

# forearm: each muscle is its own bundle so the seams read
fa = [
 ('brachioradialis', [ARM(1.0, 0.68, 0.006), ARM(0.9, 0.92, 0.014), FORE(0.9, 0.16, 0.016), FORE(0.75, 0.48, 0.012), FORE(0.85, 0.82, 0.004), W + V(0.024, 0.002, 0.002)], prof(0.008, 0.016, 0.005, 0.35), prof(0.005, 0.013, 0.003, 0.35)),
 ('extensor carpi radialis longus', [ARM(1.4, 0.84, 0.006), FORE(1.35, 0.16, 0.012), FORE(1.3, 0.5, 0.008), FORE(1.45, 0.92, 0.003)], prof(0.007, 0.012, 0.004, 0.35), prof(0.004, 0.009, 0.0025, 0.35)),
 ('extensor carpi radialis brevis', [LE, FORE(1.75, 0.22, 0.01), FORE(1.75, 0.55, 0.007), FORE(1.8, 0.93, 0.003)], prof(0.006, 0.011, 0.004, 0.4), prof(0.004, 0.008, 0.0025, 0.4)),
 ('extensor digitorum', [LE, FORE(2.2, 0.25, 0.011), FORE(2.35, 0.6, 0.008), FORE(2.45, 0.95, 0.003)], prof(0.006, 0.012, 0.006, 0.4), prof(0.004, 0.009, 0.0025, 0.4)),
 ('extensor carpi ulnaris', [LE + V(-0.004, -0.004, -0.006), FORE(2.8, 0.3, 0.01), FORE(2.95, 0.65, 0.007), W + V(-0.02, 0.004, -0.012)], prof(0.006, 0.01, 0.004, 0.4), prof(0.004, 0.008, 0.0025, 0.4)),
 ('abductor pollicis longus', [FORE(2.3, 0.5, 0.004), FORE(1.6, 0.74, 0.01), FORE(1.0, 0.93, 0.005), W + V(0.026, -0.012, 0.006)], prof(0.004, 0.008, 0.003), prof(0.003, 0.0055, 0.002)),
 ('pronator teres', [ME, FORE(-0.6, 0.15, 0.012), FORE(0.4, 0.35, 0.011), FORE(0.95, 0.47, 0.004)], prof(0.007, 0.012, 0.005), prof(0.005, 0.009, 0.003)),
 ('flexor carpi radialis', [ME, FORE(-0.4, 0.25, 0.013), FORE(0.1, 0.6, 0.008), FORE(0.35, 0.96, 0.003)], prof(0.006, 0.011, 0.003, 0.35), prof(0.005, 0.009, 0.0025, 0.35)),
 ('palmaris longus', [ME, FORE(-0.75, 0.3, 0.014), FORE(-0.25, 0.65, 0.006), FORE(0, 0.98, 0.002)], prof(0.005, 0.008, 0.002, 0.3), prof(0.004, 0.006, 0.0015, 0.3)),
 ('flexor digitorum superficialis', [ME, FORE(-0.95, 0.3, 0.008), FORE(-0.5, 0.65, 0.009), FORE(-0.25, 0.95, 0.003)], prof(0.008, 0.014, 0.008, 0.45), prof(0.005, 0.01, 0.003, 0.45)),
 ('flexor carpi ulnaris', [ME + V(0, 0, -0.01), FORE(-1.65, 0.25, 0.012), FORE(-1.75, 0.65, 0.008), W + V(-0.024, 0.004, 0.0)], prof(0.007, 0.012, 0.005, 0.4), prof(0.005, 0.009, 0.003, 0.4)),
]
for name, pts, w, th in fa:
    muscle(name, 'forearm', [S(pts, w, th)], k=0.003)
tendon('anconeus', 'triceps', [LE + V(0, 0, -0.008), FORE(2.6, 0.12, 0.008), OL + V(0, -0.03, 0)], 0.006, flat=0.6)

# ================================================================== HAND (bones + muscles)
MCP = {'index': V(0.316, 0.782, 0.017), 'middle': V(0.304, 0.778, 0.016), 'ring': V(0.292, 0.782, 0.014), 'little': V(0.281, 0.79, 0.012)}
BASE = {'index': V(0.313, 0.835, 0.016), 'middle': V(0.304, 0.838, 0.015), 'ring': V(0.294, 0.836, 0.013), 'little': V(0.285, 0.832, 0.012)}
PHAL = {'index': (0.040, 0.024, 0.018), 'middle': (0.045, 0.028, 0.019), 'ring': (0.042, 0.026, 0.018), 'little': (0.033, 0.019, 0.016)}
FINGER_DIR = {'index': unit(V(0.06, -1, 0.12)), 'middle': unit(V(0.0, -1, 0.13)), 'ring': unit(V(-0.05, -1, 0.13)), 'little': unit(V(-0.1, -1, 0.14))}
def finger_joints(f):
    p = MCP[f]; out = [p]; d = FINGER_DIR[f]
    for i, l in enumerate(PHAL[f]):
        d = unit(rot(V(1, 0, 0), -0.12 * (i + 1)) @ d)   # gentle curl toward the palm
        p = p + d * l
        out.append(p)
    return out
THUMB = [V(0.322, 0.84, 0.02), V(0.338, 0.807, 0.034), V(0.347, 0.778, 0.046), V(0.352, 0.758, 0.054)]

def hand_bones(P):
    d = sd_ell(P, V(0.302, 0.846, 0.012), V(0.024, 0.013, 0.011))
    for f in MCP:
        d = smin(d, sd_capsule(P, BASE[f], MCP[f], 0.0045, 0.0055), 0.003)
        j = finger_joints(f)
        for i in range(3):
            d = np.minimum(d, sd_capsule(P, j[i] + (j[i + 1] - j[i]) * 0.08, j[i + 1] - (j[i + 1] - j[i]) * 0.06, 0.0048 - 0.0007 * i, 0.0042 - 0.0007 * i))
    for i in range(3):
        d = np.minimum(d, sd_capsule(P, THUMB[i] + (THUMB[i + 1] - THUMB[i]) * 0.06, THUMB[i + 1], 0.0055 - 0.0006 * i, 0.0048 - 0.0006 * i))
    return d
sdf_part('hand bones', 'b_hand', 'bones', 'L', hand_bones, [0.255, 0.66, -0.01], [0.37, 0.875, 0.075], h=0.0011)
muscle('thenar eminence', 'hand', [S([V(0.313, 0.84, 0.024), V(0.332, 0.812, 0.036), V(0.338, 0.79, 0.04)], prof(0.008, 0.012, 0.005), prof(0.006, 0.009, 0.004), normal=('dir', V(0.3, 0, 1)))], h=0.0012)
muscle('hypothenar eminence', 'hand', [S([V(0.287, 0.838, 0.022), V(0.282, 0.812, 0.022), V(0.281, 0.79, 0.018)], prof(0.006, 0.009, 0.004), prof(0.005, 0.007, 0.003), normal=('dir', V(-0.3, 0, 1)))], h=0.0012)
muscle('first dorsal interosseous', 'hand', [S([V(0.322, 0.835, 0.008), V(0.326, 0.81, 0.008), V(0.318, 0.788, 0.008)], prof(0.004, 0.007, 0.003), prof(0.004, 0.006, 0.003), normal=('dir', V(0.4, 0, -1)))], h=0.0012)
for f in MCP:
    j = finger_joints(f)
    tendon('extensor tendon ' + f, 'forearm', [FORE(2.4, 0.97, 0.002), (BASE[f] + MCP[f]) / 2 + V(0, 0, -0.007), MCP[f] + V(0, 0, -0.0065), j[1] + V(0, 0, -0.005), j[2] + V(0, 0, -0.0045)], 0.0018, seg=6)

# ================================================================== HIP & THIGH
crest = [ASIS, V(0.145, 1.04, 0.045), V(0.152, 1.058, 0.0), V(0.135, 1.05, -0.045), V(0.098, 1.035, -0.075)]
muscle('gluteus medius', 'glutemed', [S([c + unit(c - V(0.06, 0.98, -0.01)) * 0.008, (c + GTF) / 2 + unit((c + GTF) / 2 - V(0.07, 0.97, -0.01)) * 0.022, GTF + V(0.006, 0.012, 0)], prof(0.016, 0.022, 0.012), prof(0.005, 0.013, 0.006), normal=('point', V(0.06, 0.96, -0.01))) for c in crest[1:]], k=0.006)
muscle('tensor fasciae latae', 'glutemed', [S([ASIS + V(0.006, -0.004, -0.006), V(0.152, 0.94, 0.045), THIGH(1.1, 0.13, 0.024)], prof(0.008, 0.014, 0.008), prof(0.006, 0.011, 0.004))])
muscle('iliotibial tract tendon', 'glutemed', [S([THIGH(1.25, 0.1, 0.032), THIGH(1.45, 0.4, 0.04), THIGH(1.5, 0.72, 0.034), V(0.136, 0.468, 0.008)], prof(0.02, 0.016, 0.008), 0.0018)], k=0.002)

Cg = V(0.075, 0.905, -0.03)
gm = []
go = [V(0.112, 1.03, -0.08), V(0.075, 1.005, -0.098), V(0.048, 0.965, -0.108), V(0.032, 0.925, -0.105), V(0.018, 0.885, -0.094)]
gi = [V(0.172, 0.885, -0.02), V(0.168, 0.862, -0.028), V(0.158, 0.84, -0.032), V(0.148, 0.82, -0.032), V(0.138, 0.8, -0.03)]
for o, i in zip(go, gi):
    m = Cg + unit((o + i) / 2 - Cg + V(0, -0.01, -0.03)) * 0.088
    gm.append(S([o, (o + m) / 2 + unit((o + m) / 2 - Cg) * 0.008, m, i], prof(0.02, 0.03, 0.016, 0.5), prof(0.007, 0.019, 0.007, 0.5), normal=('point', Cg)))
muscle('gluteus maximus', 'glutes', gm, k=0.012)

muscle('rectus femoris', 'quads', [S([AIIS, THIGH(0.12 * s, 0.12, 0.016), THIGH(0.09 * s, 0.45, 0.031), THIGH(0.05 * s, 0.8, 0.021), V(0.095, 0.535, 0.055)], prof(0.004, 0.017, 0.012, 0.45), prof(0.005, 0.021, 0.008, 0.45)) for s in (-1, 1)], k=0.004)
muscle('vastus lateralis', 'quads', [
    S([GTF + V(0, -0.012, 0.005), THIGH(1.25, 0.2, 0.022), THIGH(1.2, 0.55, 0.03), THIGH(0.85, 0.86, 0.018), V(0.118, 0.525, 0.045)], prof(0.016, 0.034, 0.012, 0.5), prof(0.008, 0.024, 0.008, 0.5)),
    S([THIGH(1.65, 0.16, 0.012), THIGH(1.75, 0.5, 0.026), THIGH(1.45, 0.82, 0.016), V(0.118, 0.52, 0.042)], prof(0.012, 0.03, 0.01, 0.5), prof(0.006, 0.02, 0.006, 0.5))], k=0.008)
muscle('vastus medialis', 'quads', [
    S([THIGH(-0.75, 0.35, 0.008), THIGH(-0.85, 0.65, 0.02), THIGH(-0.75, 0.87, 0.028), V(0.076, 0.528, 0.046)], prof(0.01, 0.03, 0.012, 0.75), prof(0.004, 0.024, 0.008, 0.72)),
    S([THIGH(-1.1, 0.45, 0.008), THIGH(-1.1, 0.75, 0.022), THIGH(-0.95, 0.92, 0.018), V(0.076, 0.522, 0.04)], prof(0.01, 0.026, 0.01, 0.7), prof(0.004, 0.02, 0.006, 0.7))], k=0.008)
tendon('patellar ligament tendon', 'quads', [V(0.095, 0.494, 0.052), V(0.096, 0.462, 0.05), V(0.096, 0.436, 0.044)], 0.0075, flat=0.45)
tendon('quadriceps tendon', 'quads', [V(0.095, 0.56, 0.05), V(0.095, 0.538, 0.054)], 0.008, flat=0.5)
muscle('sartorius', 'sartorius', [S([ASIS, THIGH(0.6, 0.08, 0.016), THIGH(-0.25, 0.32, 0.034), THIGH(-1.15, 0.62, 0.032), THIGH(-1.75, 0.9, 0.022), V(0.07, 0.445, 0.024)], prof(0.007, 0.013, 0.005), prof(0.004, 0.0065, 0.003))])
muscle('adductor longus', 'adductors', [S([V(0.03, 0.876, 0.068), THIGH(-1.2, 0.25, 0.014), THIGH(-1.6, 0.52, 0.004)], prof(0.008, 0.022, 0.01), prof(0.007, 0.014, 0.005))])
muscle('pectineus', 'adductors', [S([V(0.05, 0.89, 0.06), THIGH(-0.9, 0.12, 0.012), THIGH(-1.4, 0.26, 0.004)], prof(0.008, 0.012, 0.006), 0.008)])
muscle('adductor magnus', 'adductors', [
    S([V(0.045, 0.845, -0.012), THIGH(-1.95, 0.3, 0.02), THIGH(-1.95, 0.65, 0.016), V(0.072, 0.53, -0.01)], prof(0.014, 0.028, 0.008), prof(0.008, 0.016, 0.004)),
    S([V(0.055, 0.84, -0.04), THIGH(-2.35, 0.35, 0.018), THIGH(-2.15, 0.7, 0.012), V(0.075, 0.535, -0.016)], prof(0.012, 0.024, 0.006), prof(0.007, 0.014, 0.004))], k=0.006)
muscle('gracilis', 'adductors', [S([V(0.02, 0.872, 0.042), THIGH(-1.55, 0.2, 0.03), THIGH(-1.68, 0.6, 0.027), THIGH(-1.85, 0.9, 0.017), V(0.068, 0.45, 0.004)], prof(0.012, 0.014, 0.004), prof(0.005, 0.006, 0.003))])
muscle('biceps femoris', 'hamstrings', [
    S([ISCH, THIGH(-3.0, 0.2, 0.026), THIGH(2.8, 0.55, 0.029), THIGH(2.4, 0.85, 0.018), FH], prof(0.008, 0.022, 0.007), prof(0.008, 0.021, 0.005)),
    S([THIGH(2.2, 0.5, 0.008), THIGH(2.3, 0.8, 0.014), FH], prof(0.01, 0.016, 0.006), prof(0.006, 0.01, 0.004))], k=0.006)
muscle('semitendinosus', 'hamstrings', [S([ISCH + V(0, 0, 0.004), THIGH(-2.72, 0.25, 0.031), THIGH(-2.6, 0.6, 0.029), THIGH(-2.3, 0.88, 0.018), V(0.066, 0.45, 0.012)], prof(0.01, 0.019, 0.003, 0.4), prof(0.008, 0.018, 0.003, 0.4))])
muscle('semimembranosus', 'hamstrings', [S([ISCH + V(0.004, -0.004, 0.006), THIGH(-2.45, 0.35, 0.014), THIGH(-2.35, 0.72, 0.026), V(0.072, 0.47, -0.02)], prof(0.01, 0.026, 0.012, 0.7), prof(0.004, 0.019, 0.008, 0.7))])

# ================================================================== LEG & FOOT
muscle('tibialis anterior', 'tibialis', [S([V(0.122, 0.465, 0.028), LEG(0.6, 0.12, 0.016), LEG(0.5, 0.45, 0.02), LEG(0.25, 0.75, 0.01), LEG(-0.2, 0.93, 0.006), V(0.085, 0.044, 0.062)], prof(0.01, 0.016, 0.004, 0.4), prof(0.008, 0.016, 0.003, 0.4))])
muscle('extensor digitorum longus', 'tibialis', [S([V(0.13, 0.46, 0.01), LEG(1.05, 0.15, 0.012), LEG(0.9, 0.5, 0.013), LEG(0.45, 0.88, 0.006), V(0.108, 0.062, 0.036)], prof(0.008, 0.012, 0.003, 0.4), prof(0.006, 0.011, 0.003, 0.4))])
muscle('fibularis longus', 'fibularis', [S([FH + V(0.006, 0, 0), LEG(1.75, 0.1, 0.012), LEG(1.8, 0.45, 0.014), LEG(2.0, 0.8, 0.006), V(0.133, 0.07, -0.035), V(0.126, 0.034, -0.018)], prof(0.008, 0.014, 0.004, 0.35), prof(0.006, 0.012, 0.003, 0.35))])
muscle('fibularis brevis', 'fibularis', [S([LEG(1.95, 0.45, 0.006), LEG(2.05, 0.72, 0.012), V(0.134, 0.08, -0.03), V(0.132, 0.03, 0.03)], prof(0.008, 0.011, 0.003), prof(0.005, 0.008, 0.003))])
muscle('gastrocnemius medial head', 'calves', [S([V(0.076, 0.52, -0.026), LEG(-2.6, 0.12, 0.03), LEG(-2.75, 0.3, 0.036), LEG(-2.95, 0.5, 0.013), LEG(3.1, 0.6, 0.008)], prof(0.012, 0.03, 0.012, 0.4), prof(0.008, 0.024, 0.004, 0.42))])
muscle('gastrocnemius lateral head', 'calves', [S([V(0.12, 0.52, -0.026), LEG(2.55, 0.12, 0.026), LEG(2.7, 0.28, 0.03), LEG(2.95, 0.45, 0.011), LEG(3.1, 0.55, 0.008)], prof(0.011, 0.024, 0.01, 0.38), prof(0.007, 0.02, 0.004, 0.4))])
muscle('soleus', 'calves', [
    S([LEG(2.4, 0.1, 0.006), LEG(2.25, 0.35, 0.016), LEG(2.5, 0.62, 0.014), LEG(3.0, 0.82, 0.006)], prof(0.014, 0.024, 0.008), prof(0.006, 0.013, 0.004)),
    S([LEG(-2.2, 0.25, 0.006), LEG(-2.15, 0.5, 0.015), LEG(-2.6, 0.75, 0.01), LEG(-3.0, 0.84, 0.005)], prof(0.012, 0.022, 0.008), prof(0.006, 0.012, 0.004))], k=0.006)
tendon('calcaneal tendon', 'calves', [LEG(3.14, 0.55, 0.018), LEG(3.14, 0.8, 0.01), V(0.1, 0.07, -0.055), CALC + V(0, 0.004, 0.004)], lambda t: 0.0085 - 0.003 * t, flat=0.5)
muscle('extensor digitorum brevis', 'foot', [S([V(0.128, 0.042, 0.02), V(0.123, 0.034, 0.07)], prof(0.008, 0.012, 0.006), 0.005, normal=('dir', V(0.3, 1, 0)))], h=0.0012)
muscle('abductor hallucis', 'foot', [S([V(0.086, 0.03, -0.045), V(0.082, 0.026, 0.01), V(0.084, 0.018, 0.075)], prof(0.008, 0.012, 0.005), prof(0.006, 0.011, 0.004), normal=('dir', V(-1, 0, 0)))], h=0.0014)
muscle('abductor digiti minimi of foot', 'foot', [S([V(0.122, 0.024, -0.05), V(0.132, 0.02, 0.01), V(0.137, 0.014, 0.075)], prof(0.007, 0.01, 0.004), prof(0.006, 0.009, 0.004), normal=('dir', V(1, 0, 0)))], h=0.0014)
TOE = [V(0.087, 0.012, 0.17), V(0.103, 0.011, 0.162), V(0.116, 0.01, 0.152), V(0.127, 0.01, 0.141), V(0.137, 0.009, 0.128)]
MTH = [V(0.087, 0.016, 0.12), V(0.103, 0.015, 0.118), V(0.116, 0.014, 0.112), V(0.127, 0.013, 0.104), V(0.137, 0.012, 0.094)]
for i in range(1, 5):
    tendon(f'extensor digitorum longus tendon {i}', 'tibialis', [V(0.108, 0.062, 0.036), (V(0.108, 0.05, 0.05) + MTH[i]) / 2 + V(0, 0.012, 0), MTH[i] + V(0, 0.007, 0), TOE[i] + V(0, 0.004, -0.006)], 0.0016, seg=6)
tendon('extensor hallucis longus tendon', 'tibialis', [LEG(0.2, 0.85, 0.004), V(0.092, 0.06, 0.05), MTH[0] + V(0, 0.009, 0), TOE[0] + V(0, 0.005, -0.006)], 0.0022, seg=6)

# ================================================================== NECK
muscle('sternocleidomastoid', 'neck', [
    S([V(0.013, 1.437, 0.072), V(0.03, 1.48, 0.058), V(0.048, 1.548, 0.022), MAST], prof(0.006, 0.01, 0.01), prof(0.004, 0.0075, 0.005)),
    S([clav(0.18) + V(0, 0.004, 0.004), V(0.05, 1.49, 0.046), MAST + V(0, -0.006, 0.004)], prof(0.008, 0.01, 0.008), prof(0.003, 0.006, 0.004))], k=0.004)
muscle('splenius capitis', 'neck', [S([V(0.004, 1.475, -0.068), V(0.03, 1.535, -0.062), V(0.056, 1.6, -0.036)], 0.014, 0.006)])
muscle('levator scapulae', 'neck', [S([V(0.034, 1.585, -0.03), V(0.062, 1.5, -0.052), V(0.088, 1.437, -0.086)], prof(0.008, 0.012, 0.01), 0.008)])
muscle('scalenes', 'neck', [S([V(0.026, 1.565, -0.012), V(0.046, 1.495, 0.0), V(0.058, 1.448, 0.022)], prof(0.006, 0.011, 0.01), 0.007)])
muscle('infrahyoid strap muscles', 'neck', [S([V(0.012, 1.432, 0.058), V(0.012, 1.49, 0.058), V(0.01, 1.527, 0.048)], prof(0.006, 0.007, 0.006), 0.003, normal=('dir', V(0, 0, 1)))], h=0.0012)
sdf_part('deep neck muscles', 'neck', 'muscles', 'M', lambda P: sd_capsule(P, V(0, 1.425, -0.024), V(0, 1.6, -0.02), 0.04, 0.036), [-0.05, 1.38, -0.07], [0.05, 1.64, 0.025], h=0.0025)
sdf_part('thyroid cartilage', 'neck', 'muscles', 'M', lambda P: sd_ell(P, V(0, 1.503, 0.048), V(0.016, 0.019, 0.011)), [-0.02, 1.48, 0.03], [0.02, 1.53, 0.065], h=0.001)

# ================================================================== HEAD & FACE
EYE = V(0.032, 1.646, 0.068)
muscle('temporalis', 'face', [S([skull(az, el, 0.002), skull(1.35, 0.02, 0.008), V(0.064, 1.588, 0.026), V(0.047, 1.565, 0.036)], prof(0.016, 0.018, 0.006), prof(0.002, 0.0065, 0.004), normal=('point', CR)) for az, el in [(0.95, 0.42), (1.25, 0.47), (1.55, 0.46), (1.85, 0.38), (2.1, 0.25)]], k=0.006)
muscle('frontalis', 'face', [S([skull(az, 0.78, 0.0), skull(az, 0.5, 0.001), skull(az, 0.2, 0.0)], 0.017, 0.0033, normal=('point', CR)) for az in (0.06, 0.25, 0.45)], k=0.006)
muscle('occipitalis', 'face', [S([skull(az, 0.5, 0.0), skull(az, 0.18, 0.001)], 0.016, 0.003, normal=('point', CR)) for az in (PI - 0.12, PI - 0.38)], k=0.005)
muscle('epicranial aponeurosis tendon', 'face', [S([skull(az, 0.74, -0.0005), skull(az * 0.8, 1.2, 0.0), skull(PI - az * 0.6, 1.0, 0.0), skull(PI - az, 0.5, -0.0005)], 0.03, 0.0016, normal=('point', CR)) for az in (0.12, 0.42, 0.75)], k=0.01)
ring = [EYE + V(0.03 * np.cos(a), 0.024 * np.sin(a), 0.008 - 0.012 * (np.cos(a) > 0.3) * np.cos(a)) for a in np.linspace(0, 2 * PI, 13)]
muscle('orbicularis oculi', 'face', [S(ring, 0.0075, 0.0032, normal=('dir', V(0.25, 0, 1)), n=60)], h=0.001)
mouth = [V(0.0, 1.558, 0.093), V(0.016, 1.555, 0.09), V(0.027, 1.545, 0.083), V(0.016, 1.535, 0.089), V(0.0, 1.532, 0.091)]
muscle('orbicularis oris', 'face', [S(mouth, 0.0065, 0.0042, normal=('point', V(0, 1.545, 0.055)))], h=0.001)
muscle('zygomaticus major', 'face', [S([V(0.056, 1.612, 0.058), V(0.043, 1.58, 0.075), V(0.027, 1.548, 0.083)], 0.005, 0.003, normal=('point', V(0, 1.58, 0.02)))], h=0.001)
muscle('levator labii superioris', 'face', [S([V(0.03, 1.622, 0.083), V(0.022, 1.59, 0.09), V(0.014, 1.562, 0.093)], 0.0055, 0.0026, normal=('point', V(0, 1.58, 0.02)))], h=0.001)
muscle('masseter', 'face', [S([V(0.06 + 0.002 * i, 1.597, 0.04 - 0.012 * i), V(0.064, 1.56, 0.03 - 0.012 * i), V(0.058, 1.528, 0.03 - 0.016 * i)], 0.009, prof(0.005, 0.009, 0.005), normal=('point', V(0, 1.56, 0.0))) for i in range(3)], k=0.005)
muscle('mentalis and depressors', 'face', [S([V(0.012, 1.526, 0.09), V(0.02, 1.508, 0.086)], 0.007, 0.003, normal=('dir', V(0, 0, 1))), S([V(0.026, 1.538, 0.084), V(0.028, 1.515, 0.08)], 0.006, 0.0028, normal=('dir', V(0.2, 0, 1)))], h=0.001)
muscle('buccinator', 'face', [S([V(0.026, 1.545, 0.075), V(0.045, 1.548, 0.05)], 0.011, 0.003, normal=('dir', V(1, 0, 0.3)))], h=0.0012)
sdf_part('eyeball', 'face', 'muscles', 'L', lambda P: sd_sphere(P, EYE + V(0, 0, -0.002), 0.0122), EYE - 0.016, EYE + 0.016, h=0.0008)
sdf_part('nasal cartilage', 'face', 'muscles', 'M', lambda P: smin(sd_ell(P, V(0, 1.6, 0.098), V(0.007, 0.022, 0.012), euler(0.35, 0, 0)), sd_ell(P, V(0, 1.578, 0.104), V(0.014, 0.009, 0.011)), 0.006), [-0.025, 1.56, 0.075], [0.025, 1.63, 0.12], h=0.0009)
def ear(P):
    c = V(0.077, 1.632, -0.012)
    body = sd_ell(P, c, V(0.006, 0.03, 0.018), euler(0, 0.3, 0.1))
    rim = sd_round_tube(P, [c + V(0.002, -0.022, 0.004), c + V(0.004, 0.0, -0.016), c + V(0.004, 0.026, -0.004), c + V(0.003, 0.02, 0.01)], 0.0035)
    return smin(body, rim, 0.004)
sdf_part('ear cartilage', 'face', 'muscles', 'L', ear, [0.064, 1.592, -0.04], [0.09, 1.672, 0.016], h=0.0009)

# ================================================================== SKELETON
def skull_sdf(P):
    d = sd_ell(P, CR, CRR)
    d = smin(d, sd_ell(P, V(0, 1.618, 0.06), V(0.058, 0.04, 0.036)), 0.02)            # forehead / brow
    d = smin(d, sd_ell(P, V(0, 1.578, 0.058), V(0.04, 0.036, 0.04)), 0.014)            # maxilla
    for s in (-1, 1):
        d = smin(d, sd_ell(P, V(0.05 * s, 1.607, 0.053), V(0.016, 0.014, 0.014)), 0.008)
        d = smin(d, sd_round_tube(P, [V(0.054 * s, 1.602, 0.044), V(0.066 * s, 1.6, 0.012), V(0.066 * s, 1.602, -0.01)], 0.0045), 0.004)
        d = smin(d, sd_ell(P, V(0.057 * s, 1.598, -0.026), V(0.008, 0.012, 0.009)), 0.006)  # mastoid
        d = smin(d, sd_capsule(P, V(0.05 * s, 1.53, -0.002), V(0.056 * s, 1.588, -0.013), 0.0085, 0.007), 0.006)  # ramus
        d = smin(d, sd_capsule(P, V(0.05 * s, 1.545, 0.004), V(0.046 * s, 1.568, 0.028), 0.005, 0.004), 0.004)  # coronoid
        d = smax(d, -sd_sphere(P, V(0.032 * s, 1.646, 0.074), 0.0195), 0.004)                # orbit
    d = smin(d, sd_round_tube(P, [V(-0.05, 1.53, 0.0), V(-0.044, 1.522, 0.042), V(0, 1.515, 0.074), V(0.044, 1.522, 0.042), V(0.05, 1.53, 0.0)], 0.0085), 0.006)
    d = smin(d, sd_ell(P, V(0, 1.513, 0.074), V(0.016, 0.012, 0.01)), 0.006)
    d = smax(d, -sd_ell(P, V(0, 1.598, 0.086), V(0.011, 0.016, 0.02)), 0.003)            # nasal aperture
    return d
sdf_part('skull', 'b_skull', 'bones', 'M', skull_sdf, [-0.085, 1.49, -0.12], [0.085, 1.745, 0.1], h=0.0018)
sdf_part('teeth', 'b_skull', 'bones', 'M', lambda P: smax(sd_round_tube(P, [V(-0.03, 1.548, 0.05), V(-0.022, 1.548, 0.072), V(0, 1.548, 0.082), V(0.022, 1.548, 0.072), V(0.03, 1.548, 0.05)], 0.008), np.abs(P[:, 1] - 1.548) - 0.009, 0.002), [-0.045, 1.53, 0.035], [0.045, 1.566, 0.095], h=0.0009)

# spine
SPN = spline([V(0, 0.975, -0.05), V(0, 1.05, -0.036), V(0, 1.14, -0.044), V(0, 1.22, -0.058), V(0, 1.32, -0.068), V(0, 1.40, -0.06), V(0, 1.46, -0.045), V(0, 1.52, -0.032), V(0, 1.575, -0.03)], 400)
def spine_at(f):
    i = int(np.clip(f, 0, 1) * (len(SPN) - 1))
    j = min(i + 1, len(SPN) - 1)
    return SPN[i], unit(SPN[j] - SPN[max(i - 1, 0)])
NV = 23
for i in range(NV):
    f = (i + 0.5) / NV
    c, t = spine_at(f)
    region = 'L' if i < 5 else ('T' if i < 17 else 'C')
    r = {'L': 0.021, 'T': 0.0145 - 0.0002 * (i - 5), 'C': 0.0105}[region]
    hgt = (0.585 / NV) * 0.36
    back = unit(V(0, 0, -1) - t * t[2])
    if region == 'L':
        tip = c + back * 0.052 + V(0, -0.006, 0); trl = 0.03
    elif region == 'T':
        tip = c + back * 0.05 + V(0, -0.028, 0); trl = 0.026
    else:
        tip = c + back * 0.036 + V(0, -0.008, 0); trl = 0.022
    def vert(P, c=c, t=t, r=r, hgt=hgt, back=back, tip=tip, trl=trl, region=region):
        d = sd_capsule(P, c - t * hgt, c + t * hgt, r, r)
        arch = c + back * (r + 0.008)
        d = smin(d, sd_capsule(P, c + back * r * 0.6, arch, 0.006, 0.0055), 0.004)
        d = smin(d, sd_capsule(P, arch, tip, 0.0055, 0.004 if region != 'L' else 0.006), 0.004)
        for s in (-1, 1):
            tp = arch + V(s * trl, 0.004 if region == 'T' else 0, -0.004)
            d = smin(d, sd_capsule(P, arch, tp, 0.0045, 0.0035), 0.003)
        return d
    lo = np.minimum(c - 0.04, tip - 0.01); hi = np.maximum(c + 0.04, tip + 0.01)
    lo[0], hi[0] = -0.045, 0.045
    sdf_part(f'vertebra {region}{i}', 'b_spine', 'bones', 'M', vert, lo, hi, h=0.0012, target=1400)
    if i < NV - 1:
        c2, t2 = spine_at((i + 1) / NV)
        sdf_part(f'intervertebral disk cartilage {i}', 'b_spine', 'bones', 'M', lambda P, c2=c2, t2=t2, r=r: sd_capsule(P, c2 - t2 * 0.0035, c2 + t2 * 0.0035, r * 0.95, r * 0.95), c2 - 0.03, c2 + 0.03, h=0.0012, target=500)
def sacrum(P):
    d = sd_ell(P, V(0, 0.935, -0.068), V(0.05, 0.058, 0.013), euler(-0.55, 0, 0))
    d = smax(d, np.abs(P[:, 0]) - (0.012 + 0.6 * np.clip(P[:, 1] - 0.88, 0, 1)), 0.006)
    d = smin(d, sd_capsule(P, V(0, 0.885, -0.088), V(0, 0.862, -0.074), 0.008, 0.005), 0.006)
    return d
sdf_part('sacrum and coccyx', 'b_spine', 'bones', 'M', sacrum, [-0.055, 0.85, -0.1], [0.055, 1.0, -0.035], h=0.0016)

# ribs and costal cartilage
for i in range(12):
    yb = 1.437 - i * 0.0215
    drop = 0.045 + 0.007 * i
    a_end = [0.2, 0.2, 0.2, 0.2, 0.22, 0.25, 0.3, 0.55, 0.7, 0.85, 1.45, 1.75][i]
    def rib_pt(a):
        f = np.clip((PI - 0.1 - a) / (PI - 0.1 - a_end), 0, 1)
        return torso(a, yb - drop * (3 * f * f - 2 * f ** 3), -0.0075)
    pts = [V(0.016, yb + 0.006, spine_at((yb - 0.975) / 0.6)[0][2] - 0.006)] + [rib_pt(a) for a in np.linspace(PI - 0.12, a_end, 14)]
    s = S(pts, 0.0072 if i > 0 else 0.0085, 0.0034, n=40)
    sdf_part(f'rib {i + 1}', 'b_ribs', 'bones', 'L', lambda P, s=s: s.sdf(P, AXES), *s.bbox(), h=0.0013, target=1600)
    end = rib_pt(a_end)
    if i < 7:
        cpts = [end, torso(0.12, end[1] - 0.004, -0.006), torso(0.04, 1.42 - i * 0.026 if i else 1.425, -0.004)]
    elif i < 10:
        cpts = [end, torso(a_end * 0.6, end[1] + 0.02, -0.006), torso(0.25 + 0.02 * (9 - i), 1.235 + 0.008 * (9 - i), -0.006)]
    else:
        cpts = [end, torso(a_end - 0.15, end[1] - 0.005, -0.007)]
    cs = S(cpts, 0.0055, 0.0032, n=24)
    sdf_part(f'costal cartilage {i + 1}', 'b_ribs', 'bones', 'L', lambda P, s=cs: s.sdf(P, AXES), *cs.bbox(), h=0.0013, target=700)
def sternum(P):
    d = sd_ell(P, V(0, 1.405, 0.083), V(0.025, 0.024, 0.0075), euler(-0.3, 0, 0))
    d = smin(d, sd_ell(P, V(0, 1.325, 0.094), V(0.016, 0.065, 0.0065), euler(-0.16, 0, 0)), 0.008)
    return smin(d, sd_ell(P, V(0, 1.248, 0.101), V(0.008, 0.016, 0.004)), 0.004)
sdf_part('sternum', 'b_ribs', 'bones', 'M', sternum, [-0.035, 1.22, 0.06], [0.035, 1.44, 0.115], h=0.0012)

# shoulder girdle and arm
sdf_part('clavicle', 'b_clavicle', 'bones', 'L', lambda P: sd_round_tube(P, list(CLAV[::8]) + [CLAV[-1]], lambda t: 0.0068 + 0.0028 * (np.abs(t - 0.5) * 2) ** 3), [0.005, 1.42, -0.025], [0.195, 1.47, 0.085], h=0.0013)
def scapula(P):
    med = [torso(PI - 0.55 - 0.07 * f, 1.433 - 0.198 * f, 0.004) for f in np.linspace(0, 1, 6)]
    latb = [torso(PI - 0.62 - 0.6 * f, 1.235 + 0.14 * f, 0.004) for f in np.linspace(0, 1, 6)]
    d = None
    for m, l in zip(med, latb[::-1]):
        e = sd_capsule(P, m, l, 0.0035, 0.0045)
        d = e if d is None else smin(d, e, 0.012)
    d = smin(d, sd_round_tube(P, [torso(PI - 0.55, 1.393, 0.012), torso(PI - 0.9, 1.42, 0.02), V(0.163, 1.45, -0.046), ACR], 0.0052), 0.005)
    d = smin(d, sd_ell(P, ACR, V(0.017, 0.0055, 0.013), euler(0, -0.3, 0)), 0.004)
    d = smin(d, sd_ell(P, H + V(-0.026, 0, -0.006), V(0.008, 0.017, 0.012)), 0.006)
    d = smin(d, sd_round_tube(P, [V(0.15, 1.42, 0.0), V(0.16, 1.415, 0.025), CORA + V(0, 0.004, -0.004)], 0.0055), 0.004)
    return d
sdf_part('scapula', 'b_scapula', 'bones', 'L', scapula, [0.04, 1.21, -0.135], [0.2, 1.48, 0.06], h=0.0016)
def humerus(P):
    d = sd_sphere(P, H, 0.0235)
    d = smin(d, sd_sphere(P, GT_H + V(-0.004, 0.006, 0.012), 0.012), 0.006)
    d = smin(d, sd_round_tube(P, [H + V(0.004, -0.02, 0), (H + E) / 2 + V(0.004, 0, 0.002), E + V(0, 0.035, 0)], 0.0115, 0.0105), 0.01)
    d = smin(d, sd_ell(P, E + V(0, 0.004, 0), V(0.03, 0.012, 0.015)), 0.012)
    d = smin(d, sd_sphere(P, ME, 0.008), 0.004)
    return smin(d, sd_sphere(P, LE + V(-0.004, 0, 0), 0.0065), 0.004)
sdf_part('humerus', 'b_humerus', 'bones', 'L', humerus, [0.14, 1.09, -0.06], [0.3, 1.445, 0.03], h=0.0016)
def ulna(P):
    d = sd_ell(P, OL + V(0, 0.006, 0.006), V(0.011, 0.016, 0.011))
    d = smin(d, sd_round_tube(P, [E + V(-0.008, -0.004, -0.018), (E + W) / 2 + V(-0.015, 0, -0.008), W + V(-0.019, 0.016, -0.006)], 0.0085, 0.0058), 0.008)
    return smin(d, sd_sphere(P, W + V(-0.02, 0.002, -0.006), 0.0068), 0.004)
def radius_(P):
    d = sd_capsule(P, E + V(0.016, -0.008, 0.002), E + V(0.017, -0.02, 0.003), 0.0105, 0.009)
    d = smin(d, sd_round_tube(P, [E + V(0.017, -0.02, 0.003), (E + W) / 2 + V(0.018, 0, 0.006), W + V(0.012, 0.016, 0.004)], 0.0062, 0.0092), 0.006)
    return smin(d, sd_ell(P, W + V(0.01, 0.002, 0.004), V(0.016, 0.009, 0.011)), 0.008)
sdf_part('ulna', 'b_forearm', 'bones', 'L', ulna, [0.21, 0.84, -0.07], [0.3, 1.14, 0.02], h=0.0014)
sdf_part('radius', 'b_forearm', 'bones', 'L', radius_, [0.24, 0.84, -0.03], [0.33, 1.12, 0.03], h=0.0014)

# pelvis
def hipbone(P):
    d = None
    for c in crest:
        e = sd_capsule(P, c, AC + unit(c - AC) * 0.025, 0.0045, 0.009)
        d = e if d is None else smin(d, e, 0.022)
    d = smin(d, sd_round_tube(P, crest + [V(0.06, 1.0, -0.085), V(0.04, 0.965, -0.08)], 0.0068), 0.008)
    d = smin(d, smax(np.abs(sd_sphere(P, AC, 0.028)) - 0.0042, -((P - AC) @ unit(V(0.6, -0.35, 0.3))), 0.003), 0.006)
    d = smin(d, sd_capsule(P, AC + V(-0.016, -0.004, 0.024), V(0.008, 0.882, 0.074), 0.0085, 0.0075), 0.008)
    d = smin(d, sd_capsule(P, AC + V(-0.004, -0.022, -0.02), ISCH, 0.011, 0.012), 0.008)
    d = smin(d, sd_capsule(P, V(0.009, 0.864, 0.066), ISCH + V(-0.006, 0.0, 0.006), 0.0068, 0.0075), 0.006)
    return d
sdf_part('hip bone', 'b_pelvis', 'bones', 'L', hipbone, [0.0, 0.81, -0.105], [0.17, 1.075, 0.09], h=0.0016)

# lower limb bones
def femur(P):
    d = sd_sphere(P, AC, 0.0225)
    d = smin(d, sd_capsule(P, AC, GTF + V(-0.01, -0.006, 0), 0.0135, 0.016), 0.006)
    d = smin(d, sd_ell(P, GTF + V(0, 0.0, -0.002), V(0.014, 0.022, 0.018)), 0.008)
    d = smin(d, sd_sphere(P, V(0.112, 0.858, -0.012), 0.008), 0.006)
    d = smin(d, sd_round_tube(P, [GTF + V(-0.012, -0.03, 0.002), V(0.125, 0.72, 0.01), V(0.1, 0.56, 0.0)], 0.0135, 0.014), 0.008)
    d = smin(d, sd_ell(P, V(0.077, 0.505, -0.008), V(0.019, 0.024, 0.028)), 0.012)
    return smin(d, sd_ell(P, V(0.116, 0.505, -0.008), V(0.019, 0.024, 0.027)), 0.012)
sdf_part('femur', 'b_femur', 'bones', 'L', femur, [0.05, 0.47, -0.045], [0.185, 0.955, 0.05], h=0.0018)
sdf_part('patella', 'b_patella', 'bones', 'L', lambda P: sd_ell(P, V(0.095, 0.515, 0.046), V(0.02, 0.024, 0.0095), euler(0.12, 0, 0)), [0.07, 0.485, 0.03], [0.12, 0.545, 0.062], h=0.0011)
def tibia(P):
    d = sd_ell(P, V(0.096, 0.47, -0.004), V(0.041, 0.016, 0.03))
    d = smin(d, sd_ell(P, V(0.097, 0.44, 0.032), V(0.01, 0.017, 0.008)), 0.008)
    d = smin(d, sd_round_tube(P, [V(0.096, 0.455, 0.0), V(0.096, 0.28, 0.004), V(0.098, 0.1, -0.004)], 0.0145, 0.0118), 0.012)
    d = smin(d, sd_ell(P, V(0.096, 0.09, -0.006), V(0.02, 0.018, 0.019)), 0.01)
    return smin(d, sd_ell(P, V(0.077, 0.075, -0.004), V(0.007, 0.016, 0.01)), 0.005)
sdf_part('tibia', 'b_shin', 'bones', 'L', tibia, [0.045, 0.05, -0.04], [0.145, 0.495, 0.05], h=0.0016)
def fibula(P):
    d = sd_sphere(P, FH, 0.0105)
    d = smin(d, sd_round_tube(P, [FH, V(0.124, 0.25, -0.02), V(0.128, 0.09, -0.022)], 0.0055), 0.006)
    return smin(d, sd_ell(P, V(0.13, 0.068, -0.024), V(0.0085, 0.019, 0.0095)), 0.006)
sdf_part('fibula', 'b_shin', 'bones', 'L', fibula, [0.11, 0.04, -0.04], [0.145, 0.475, -0.005], h=0.0013)
def foot(P):
    d = sd_ell(P, V(0.1, 0.062, -0.006), V(0.017, 0.014, 0.022))
    d = smin(d, sd_capsule(P, V(0.1, 0.042, -0.018), CALC + V(0, 0.002, 0.004), 0.019, 0.017), 0.008)
    d = smin(d, sd_ell(P, V(0.09, 0.05, 0.024), V(0.016, 0.012, 0.01)), 0.006)
    d = smin(d, sd_ell(P, V(0.094, 0.042, 0.045), V(0.023, 0.012, 0.012)), 0.006)
    d = smin(d, sd_ell(P, V(0.121, 0.032, 0.026), V(0.012, 0.013, 0.018)), 0.006)
    for i in range(5):
        base = V(0.087 + 0.0125 * i, 0.038 - 0.003 * i, 0.055 - 0.004 * i)
        d = smin(d, sd_capsule(P, base, MTH[i], 0.0085 if i == 0 else 0.0058, 0.0072 if i == 0 else 0.005), 0.003)
        d = np.minimum(d, sd_capsule(P, MTH[i] + (TOE[i] - MTH[i]) * 0.12, TOE[i], 0.0068 if i == 0 else 0.0042, 0.0058 if i == 0 else 0.0036))
    return d
sdf_part('foot bones', 'b_foot', 'bones', 'L', foot, [0.06, -0.005, -0.1], [0.16, 0.085, 0.185], h=0.0014)

# ================================================================== ORGANS
def gyri(P, amp):
    x, y, z = P[:, 0] * 260, P[:, 1] * 260, P[:, 2] * 260
    return amp * (np.sin(x + 1.7 * np.sin(z * 0.6)) * np.sin(y * 1.1 + np.sin(x * 0.7)) + 0.6 * np.sin(z * 1.3 + np.sin(y * 0.8) * 1.5))
def hemisphere(P):
    d = sd_ell(P, V(0.034, 1.665, -0.01), V(0.034, 0.058, 0.08))
    d = smax(d, -sd_ell(P, V(0.04, 1.6, 0.01), V(0.03, 0.02, 0.03)), 0.01)
    return d + gyri(P, 0.0018)
sdf_part('cerebral hemisphere', 'o_brain', 'organs', 'L', hemisphere, [-0.002, 1.6, -0.095], [0.072, 1.728, 0.075], h=0.0012, smooth=2, skin=False)
sdf_part('cerebellum', 'o_brain', 'organs', 'L', lambda P: sd_ell(P, V(0.024, 1.598, -0.06), V(0.026, 0.02, 0.026)) + 0.0009 * np.sin(P[:, 1] * 900), [-0.004, 1.574, -0.09], [0.054, 1.622, -0.03], h=0.0009, smooth=2, skin=False)
sdf_part('brainstem', 'o_brain', 'organs', 'M', lambda P: sd_capsule(P, V(0, 1.625, -0.028), V(0, 1.548, -0.04), 0.011, 0.009), [-0.015, 1.53, -0.055], [0.015, 1.64, -0.012], h=0.0012, skin=False)

def lung(P):
    d = torso_sdf(P, 0.011)
    d = smax(d, 0.016 - P[:, 0], 0.006)
    base = 1.165 - 0.05 * np.clip(-P[:, 2] / 0.08, 0, 1) + 0.03 * (P[:, 0] / 0.13) ** 2
    d = smax(d, base - P[:, 1], 0.012)
    d = smax(d, P[:, 1] - 1.475, 0.01)
    d = smax(d, -sd_ell(P, V(0.022, 1.265, 0.04), V(0.06, 0.07, 0.055), euler(-0.4, 0, 0.6)), 0.006)   # cardiac notch
    fiss = np.abs(P[:, 1] - (1.3 - 0.55 * P[:, 2])) - 0.0012
    return smax(d, -fiss, 0.001)
sdf_part('lung', 'o_lungs', 'organs', 'L', lung, [0.005, 1.09, -0.11], [0.15, 1.49, 0.11], h=0.0022, skin=False)
mesh_part('trachea and bronchi', 'o_lungs', 'organs', 'M', tube_mesh([V(0, 1.53, 0.028), V(0, 1.45, 0.016), V(0, 1.38, 0.004)], lambda t: 0.0085 * (1 + 0.12 * (np.sin(t * 2 * PI * 14) > 0.3)), n=90, seg=14))
mesh_part('left main bronchus', 'o_lungs', 'organs', 'L', tube_mesh([V(0, 1.382, 0.004), V(0.03, 1.36, -0.002), V(0.055, 1.33, -0.008)], 0.006, n=30, seg=10))

HR = rot(V(0, 0, 1), 0.6) @ rot(V(1, 0, 0), -0.45)
def heart(P):
    d = sd_ell(P, V(0.018, 1.265, 0.035), V(0.043, 0.055, 0.039), HR)
    d = smin(d, sd_ell(P, V(0.002, 1.305, 0.012), V(0.04, 0.03, 0.03)), 0.012)
    d = smin(d, sd_ell(P, V(-0.03, 1.29, 0.02), V(0.022, 0.026, 0.025)), 0.01)
    return d + 0.0008 * np.sin(P[:, 0] * 300) * np.sin(P[:, 1] * 260)
sdf_part('wall of heart', 'o_heart', 'organs', 'M', heart, [-0.06, 1.2, -0.03], [0.08, 1.35, 0.09], h=0.0014, skin=False)
mesh_part('aorta', 'o_heart', 'organs', 'M', tube_mesh([V(0.002, 1.31, 0.03), V(0.004, 1.365, 0.026), V(0.016, 1.395, 0.0), V(0.026, 1.37, -0.035), V(0.024, 1.3, -0.045), V(0.018, 1.15, -0.042), V(0.012, 0.99, -0.03)], lambda t: 0.012 - 0.003 * t, n=90, seg=14))
mesh_part('pulmonary trunk', 'o_heart', 'organs', 'M', tube_mesh([V(-0.004, 1.3, 0.055), V(0.012, 1.335, 0.05), V(0.03, 1.35, 0.02), V(0.05, 1.335, 0.0)], 0.01, n=40, seg=12))
mesh_part('right pulmonary artery', 'o_heart', 'organs', 'M', tube_mesh([V(0.025, 1.348, 0.022), V(0.0, 1.35, 0.0), V(-0.05, 1.335, -0.002)], 0.007, n=30, seg=10))
mesh_part('superior vena cava vein', 'o_heart', 'organs', 'M', tube_mesh([V(-0.024, 1.43, 0.004), V(-0.026, 1.36, 0.008), V(-0.026, 1.31, 0.016)], 0.009, n=30, seg=12))
mesh_part('inferior vena cava vein', 'o_heart', 'organs', 'M', tube_mesh([V(-0.026, 1.25, 0.008), V(-0.024, 1.12, -0.02), V(-0.022, 0.985, -0.03)], 0.0095, n=40, seg=12))
mesh_part('common carotid artery', 'o_heart', 'organs', 'L', tube_mesh([V(0.014, 1.39, 0.002), V(0.022, 1.45, 0.012), V(0.03, 1.58, 0.0)], 0.0042, n=40, seg=8))
mesh_part('internal jugular vein', 'o_heart', 'organs', 'L', tube_mesh([V(0.008, 1.42, 0.01), V(0.036, 1.47, 0.008), V(0.042, 1.58, -0.012)], 0.0055, n=40, seg=8))
mesh_part('subclavian and brachial artery', 'o_heart', 'organs', 'L', tube_mesh([V(0.016, 1.392, 0.0), V(0.06, 1.43, 0.0), V(0.13, 1.42, 0.0), V(0.17, 1.37, 0.0), ARM(-0.6, 0.5, 0.002), E + V(-0.01, -0.02, 0.016)], 0.004, n=80, seg=8))
mesh_part('iliac and femoral artery', 'o_heart', 'organs', 'L', tube_mesh([V(0.012, 0.99, -0.03), V(0.05, 0.93, -0.004), V(0.075, 0.88, 0.045), THIGH(-0.8, 0.3, 0.004), THIGH(-1.6, 0.7, 0.002), V(0.09, 0.5, -0.03)], 0.005, n=80, seg=8))
mesh_part('iliac and femoral vein', 'o_heart', 'organs', 'L', tube_mesh([V(-0.006, 0.99, -0.03), V(0.035, 0.93, -0.006), V(0.063, 0.88, 0.04), THIGH(-1.0, 0.3, 0.0), THIGH(-1.75, 0.7, 0.0), V(0.085, 0.5, -0.032)], 0.0055, n=80, seg=8))

def liver(P):
    d = smin(sd_ell(P, V(-0.05, 1.165, 0.012), V(0.095, 0.065, 0.075)), sd_ell(P, V(0.035, 1.182, 0.04), V(0.055, 0.032, 0.045)), 0.02)
    d = smax(d, torso_sdf(P, 0.01), 0.01)
    return smax(d, P[:, 1] - (1.225 + 0.02 * (np.abs(P[:, 0] + 0.05) < 0.05)), 0.02)
sdf_part('liver', 'o_liver', 'organs', 'M', liver, [-0.15, 1.09, -0.07], [0.1, 1.25, 0.11], h=0.002, skin=False)
sdf_part('gallbladder', 'o_liver', 'organs', 'M', lambda P: sd_ell(P, V(-0.035, 1.115, 0.066), V(0.011, 0.022, 0.011), euler(0.5, 0, 0.3)), [-0.06, 1.085, 0.045], [-0.01, 1.145, 0.09], h=0.001, skin=False)
sdf_part('stomach', 'o_stomach', 'organs', 'M', lambda P: sd_round_tube(P, [V(0.03, 1.215, -0.012), V(0.07, 1.215, 0.002), V(0.086, 1.17, 0.022), V(0.068, 1.11, 0.042), V(0.028, 1.088, 0.055), V(-0.016, 1.102, 0.05)], lambda t: 0.012 + 0.032 * np.sin(np.pi * np.clip(t * 1.15, 0, 1)) ** 0.8, n=40), [-0.035, 1.05, -0.04], [0.135, 1.25, 0.1], h=0.0018, skin=False)
mesh_part('esophagus', 'o_stomach', 'organs', 'M', tube_mesh([V(0, 1.5, -0.022), V(0, 1.4, -0.03), V(0.006, 1.3, -0.036), V(0.03, 1.215, -0.014)], 0.0075, n=50, seg=10))
sdf_part('spleen', 'o_spleen', 'organs', 'M', lambda P: sd_ell(P, V(0.105, 1.15, -0.05), V(0.024, 0.045, 0.018), euler(0, 0.6, -0.3)), [0.07, 1.1, -0.09], [0.14, 1.2, -0.01], h=0.0014, skin=False)
sdf_part('pancreas', 'o_pancreas', 'organs', 'M', lambda P: sd_round_tube(P, [V(-0.03, 1.105, 0.03), V(0.03, 1.115, 0.012), V(0.09, 1.135, -0.034)], 0.017, 0.009), [-0.055, 1.08, -0.05], [0.105, 1.16, 0.055], h=0.0014, skin=False)
sdf_part('kidney', 'o_kidneys', 'organs', 'L', lambda P: smax(sd_ell(P, V(0.06, 1.085, -0.058), V(0.024, 0.05, 0.019), euler(0, 0.35, -0.22)), -sd_sphere(P, V(0.034, 1.085, -0.048), 0.014), 0.006), [0.025, 1.025, -0.085], [0.095, 1.145, -0.03], h=0.0012, skin=False)
mesh_part('ureter', 'o_kidneys', 'organs', 'L', tube_mesh([V(0.038, 1.075, -0.05), V(0.04, 1.0, -0.045), V(0.045, 0.92, -0.01), V(0.018, 0.895, 0.035)], 0.0025, n=40, seg=6))
sdf_part('urinary bladder', 'o_bladder', 'organs', 'M', lambda P: sd_ell(P, V(0, 0.895, 0.05), V(0.032, 0.027, 0.029)), [-0.04, 0.86, 0.015], [0.04, 0.93, 0.085], h=0.0013, skin=False)
colon = [V(-0.08, 0.935, 0.042), V(-0.09, 1.0, 0.04), V(-0.088, 1.075, 0.045), V(-0.06, 1.1, 0.064), V(0.0, 1.092, 0.074), V(0.06, 1.1, 0.064), V(0.09, 1.098, 0.04), V(0.096, 1.02, 0.032), V(0.09, 0.95, 0.03), V(0.06, 0.912, 0.032), V(0.028, 0.906, 0.012), V(0.008, 0.92, -0.04)]
mesh_part('colon', 'o_intestine', 'organs', 'M', tube_mesh(spline(colon, 260), lambda t: 0.019 * (1 + 0.14 * np.sin(t * 2 * PI * 34) ** 2) * (1 - 0.35 * t ** 4), seg=16))
si = []
rows = np.linspace(1.065, 0.95, 7)
for li, z in enumerate((0.058, 0.03)):
    for r, y in enumerate(rows):
        xs = np.linspace(-0.062, 0.062, 7)
        if (r + li) % 2:
            xs = xs[::-1]
        for k, x in enumerate(xs):
            si.append(V(x, y + 0.008 * np.sin(k * 2.1 + r), z + 0.01 * np.sin(k * 1.7 + r * 0.9)))
mesh_part('small intestine', 'o_intestine', 'organs', 'M', tube_mesh(spline(si, 700), 0.0118, seg=12))
