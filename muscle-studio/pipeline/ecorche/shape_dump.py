"""Skin and clothing of the purchased Écorché model in three builds — base, thin, overweight —
for one sex, with the same vertices and triangles in each (only positions and normals differ).

  venv/bin/python -I shape_dump.py <file.blend> <male|female> <out dir>

The file's own control is reproduced: Body["Weight"] −1 (thin) … +1 (overweight) drives the
skin keys <Sex>-Thin / <Sex>-Overweight, and the garments follow with their own keys
(Female-Clothes: "Overweight" is its thin fit, "Obese" its overweight fit; Underwear: Thin, Fat).
Output per build: <out>/<build>/geometry.bin + manifest.json, in the atlas convention (metres,
Y up, +Z front, +X the body's left). Nothing of the original file is copied anywhere else.
"""
import bpy, sys, json, os
import numpy as np

blend, sex, out = sys.argv[1], sys.argv[2], sys.argv[3]
female = sex == "female"
bpy.ops.wm.open_mainfile(filepath=blend, use_scripts=False)
for key in bpy.data.shape_keys: key.animation_data_clear()
for ob in bpy.data.objects:
    if ob.animation_data: ob.animation_data_clear()
    for md in ob.modifiers:
        if md.type in ("DECIMATE", "BOOLEAN", "MASK", "SUBSURF", "TRIANGULATE"): md.show_viewport = False

def pose(build):
    thin, over = float(build == "thin"), float(build == "over")
    for key in bpy.data.shape_keys:
        owner = key.user.name if key.user else ""
        for kb in key.key_blocks[1:]:
            n = kb.name
            if n == "Female": v = 1.0 if female else 0.0
            elif n in ("Male", "Male-Hide"): v = 0.0 if female else 1.0
            elif n == "Venus": v = 1.0 if female else 0.0
            elif n == "Female-Thin": v = thin if female else 0.0
            elif n == "Female-Overweight": v = over if female else 0.0
            elif n == "Male-Thin": v = 0.0 if female else thin
            elif n == "Male-Overweight": v = 0.0 if female else over
            # the garments' own fits
            elif n == "Obese": v = over if female else 0.0
            elif n == "Overweight": v = thin if female else 0.0   # (named so in the file: driven by Female-Thin)
            elif n == "Thin": v = 0.0 if female else thin
            elif n == "Fat": v = 0.0 if female else over
            else: v = 0.0
            kb.value = v
    bpy.context.view_layer.update()
    return bpy.context.evaluated_depsgraph_get()

SKIP = {"Underwear"} if female else {"Female-Clothes"}
for build in ("base", "thin", "over"):
    dg = pose(build)
    records, chunks, offset = [], [], 0
    def push(arr):
        global offset
        b = np.ascontiguousarray(arr).tobytes(); chunks.append(b); o = offset; offset += len(b); return o
    for cname in ("Skin", "Clothes"):
        for ob in bpy.data.collections[cname].objects:
            if ob.type != "MESH" or ob.name in SKIP: continue
            me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
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
            tris = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("loops", tris)
            mat = ob.material_slots[0].material.name if ob.material_slots and ob.material_slots[0].material else ""
            p = np.stack([pos[:, 0], pos[:, 2], -pos[:, 1]], 1).astype(np.float32)
            n = np.stack([nrm[:, 0], nrm[:, 2], -nrm[:, 1]], 1).astype(np.float32)
            records.append({"name": ob.name, "collection": cname, "material": mat, "side": "m", "vertices": int(nl), "triangles": int(nt),
                            "position": push(p), "normal": push(n), "uv": push(uv), "index": push(tris.astype(np.uint32)),
                            "min": [float(v) for v in p.min(0)], "max": [float(v) for v in p.max(0)]})
            bpy.data.meshes.remove(me)
    d = os.path.join(out, build); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "geometry.bin"), "wb").write(b"".join(chunks))
    json.dump({"sex": sex, "build": build, "records": records}, open(os.path.join(d, "manifest.json"), "w"))
    print(sex, build, [(r["name"], r["vertices"], r["triangles"], [round(v, 3) for v in r["min"]], [round(v, 3) for v in r["max"]]) for r in records])
