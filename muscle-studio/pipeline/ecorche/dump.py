"""Evaluate the purchased Écorché model for one sex and dump its geometry for the web build.

  venv/bin/python -I tools/dump.py <file.blend> <male|female> <out dir>

Output: <out>/geometry.bin (float32 / uint32 arrays) + <out>/manifest.json (one record per
mesh: name, collection, material, side, counts, offsets, bounds). Coordinates are converted to
the atlas convention: metres, Y up, +Z front, +X the body's left.

Nothing of the original file is copied anywhere else; this output stays in the working folder.
"""
import bpy, sys, json, math, os
import numpy as np

blend, sex, out = sys.argv[1], sys.argv[2], sys.argv[3]
female = sex == "female"
os.makedirs(out, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend, use_scripts=False)

# ── the sex: every shape key by hand (the file drives them from one control) ──
for key in bpy.data.shape_keys:
    key.animation_data_clear()
    for kb in key.key_blocks[1:]:
        n = kb.name
        if n == "Female": kb.value = 1.0 if female else 0.0
        elif n == "Male": kb.value = 0.0 if female else 1.0
        elif n == "Male-Hide": kb.value = 0.0 if female else 1.0
        elif n == "Venus": kb.value = 1.0 if female else 0.0
        else: kb.value = 0.0
for ob in bpy.data.objects:
    if ob.animation_data: ob.animation_data_clear()
    # keep the full-resolution surfaces; no half-body cut-away
    for md in ob.modifiers:
        if md.type in ("DECIMATE", "BOOLEAN", "MASK", "SUBSURF", "TRIANGULATE"): md.show_viewport = False
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

COLLECTIONS = ["Muscles", "Cartilages", "Skull", "Bones", "Fat Pads", "Veins", "Skin", "Eyes", "Clothes"]
# UDIM sets packed into one atlas image: columns × rows of tiles
ATLAS = {"Muscle": (2, 2), "Cartilages": (2, 2), "Bone": (2, 1)}

records, chunks, offset = [], [], 0
def push(arr):
    global offset
    b = np.ascontiguousarray(arr).tobytes()
    chunks.append(b)
    o = offset
    offset += len(b)
    return o

def emit(name, coll, mat, side, pos, nrm, uv, tris, mirrored):
    if len(tris) == 0: return
    # compact to the loops this part uses
    used = np.unique(tris)
    remap = np.full(len(pos), -1, np.int64); remap[used] = np.arange(len(used))
    p, n, t, i = pos[used], nrm[used], uv[used], remap[tris].astype(np.uint32)
    # Blender (x, y, z) → atlas (x, z, -y)
    p = np.stack([p[:, 0], p[:, 2], -p[:, 1]], 1).astype(np.float32)
    n = np.stack([n[:, 0], n[:, 2], -n[:, 1]], 1).astype(np.float32)
    records.append({
        "name": name, "collection": coll, "material": mat, "side": side, "mirrored": mirrored,
        "vertices": int(len(p)), "triangles": int(len(i)),
        "position": push(p), "normal": push(n), "uv": push(t.astype(np.float32)), "index": push(i),
        "min": [float(v) for v in p.min(0)], "max": [float(v) for v in p.max(0)],
    })

# Parts the file shows for one sex only (it hides them with gender-driven mask modifiers).
FEMALE_ONLY = {"Breasts", "Inner_Thigh", "Lateral_Gluteal", "Outer_Thigh", "Posterior_Gluteal-Fmale", "Rhombus_of_Michaelis", "Female-Clothes"}
MALE_ONLY = {"Flank", "Posterior_Gluteal1", "Posterior_Gluteal2", "Underwear"}

for cname in COLLECTIONS:
    for ob in bpy.data.collections[cname].objects:
        if ob.type not in ("MESH", "CURVE"): continue
        if ob.name in (MALE_ONLY if female else FEMALE_ONLY): continue
        ev = ob.evaluated_get(dg)
        try:
            me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        except RuntimeError:
            continue
        if len(me.polygons) == 0: continue
        me.transform(ob.matrix_world)
        me.calc_loop_triangles()
        nl = len(me.loops)
        vidx = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", vidx)
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        pos = co[vidx]
        nrm = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get("vector", nrm); nrm = nrm.reshape(-1, 3)
        uv = np.zeros((nl, 2), np.float32)
        if me.uv_layers.active:
            raw = np.empty(nl * 2, np.float32); me.uv_layers.active.data.foreach_get("uv", raw); uv = raw.reshape(-1, 2).copy()
        nt = len(me.loop_triangles)
        tris = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tris); tris = tris.reshape(-1, 3)
        tpoly = np.empty(nt, np.int32); me.loop_triangles.foreach_get("polygon_index", tpoly)
        mat = ob.material_slots[0].material.name if ob.material_slots and ob.material_slots[0].material else ""
        # per-polygon material (eyes: sclera + iris)
        pm = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("material_index", pm)
        slots = [s.material.name if s.material else "" for s in ob.material_slots] or [""]
        # UDIM tile of each polygon → place in the atlas
        grid = ATLAS.get(mat)
        if grid:
            cols, rows = grid
            lp = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("loop_start", lp)
            lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("loop_total", lt)
            poly_of_loop = np.repeat(np.arange(len(me.polygons)), lt)
            order = np.argsort(np.concatenate([np.arange(s, s + t) for s, t in zip(lp, lt)])) if not np.array_equal(np.cumsum(lt) - lt, lp) else None
            if order is not None: poly_of_loop = poly_of_loop[order]
            mean_u = np.bincount(poly_of_loop, uv[:, 0], len(me.polygons)) / np.maximum(lt, 1)
            mean_v = np.bincount(poly_of_loop, uv[:, 1], len(me.polygons)) / np.maximum(lt, 1)
            tu = np.clip(np.floor(mean_u), 0, cols * rows - 1).astype(np.int32)
            tv = np.floor(mean_v).astype(np.int32)
            col, row = tu % cols, tu // cols
            uv[:, 0] = (uv[:, 0] - tu[poly_of_loop] + col[poly_of_loop]) / cols
            # image row 0 is the top; Blender's v runs upward
            uv[:, 1] = (uv[:, 1] - tv[poly_of_loop] + (rows - 1 - row[poly_of_loop])) / rows
        mirrored = any(md.type == "MIRROR" for md in ob.modifiers)
        for si, sname in enumerate(slots):
            sel = pm[tpoly] == si if len(slots) > 1 else np.ones(nt, bool)
            if not sel.any(): continue
            T = tris[sel]
            nm = ob.name if len(slots) == 1 or si == 0 else f"{ob.name}:{sname}"
            if mirrored:
                cx = pos[T, 0].mean(1)
                emit(nm, cname, sname, "l", pos, nrm, uv, T[cx >= 0], True)
                emit(nm, cname, sname, "r", pos, nrm, uv, T[cx < 0], True)
            else:
                emit(nm, cname, sname, "m", pos, nrm, uv, T, False)
        bpy.data.meshes.remove(me)

open(os.path.join(out, "geometry.bin"), "wb").write(b"".join(chunks))
json.dump({"sex": sex, "records": records}, open(os.path.join(out, "manifest.json"), "w"))
tot_v = sum(r["vertices"] for r in records); tot_t = sum(r["triangles"] for r in records)
print(sex, len(records), "meshes", tot_v, "corners", tot_t, "triangles", round(offset / 1e6), "MB")
