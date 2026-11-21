import bpy, json, sys
region = json.load(open("region.json"))
out = {}
for m in region["muscles"]:
    o = bpy.data.objects.get(m["name"])
    if not o or o.type != "MESH" or not len(o.data.polygons): continue
    slots = [s.material.name if s.material else None for s in o.material_slots]
    cnt = [0] * len(slots)
    for p in o.data.polygons: cnt[p.material_index] += 1
    out[m["name"]] = dict(zip(slots, cnt))
mg = bpy.data.node_groups.get("Muscle-Default")
out["_Muscle-Default nodes"] = sorted({n.bl_idname for n in mg.nodes}) if mg else None
json.dump(out, open(sys.argv[-1], "w"), indent=1)
