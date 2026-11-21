import bpy, json, re, sys
D = bpy.data
TARGETS = ["trapezius", "latissimus", "rhomboid", "teres major", "teres minor", "infraspinatus", "supraspinatus", "subscapularis",
           "levator scapulae", "deltoid", "iliocostalis", "longissimus", "spinalis", "erector spinae"]
BONES = ["scapula", "clavicle", "humerus", "thoracic vertebra", "vertebra t", "rib"]
def path(o):
    cs = [c.name for c in o.users_collection]
    return cs
def coll_of(o):
    return [c.name for c in o.users_collection]
out = {"muscles": [], "insertions": [], "bones": [], "texts": {}}
for o in D.objects:
    n = o.name.lower()
    if o.type != "MESH": continue
    rec = None
    if any(t in n for t in TARGETS):
        me = o.data
        quads = sum(1 for p in me.polygons if len(p.vertices) == 4)
        rec = {"name": o.name, "collections": coll_of(o), "verts": len(me.vertices), "faces": len(me.polygons), "quads": quads,
               "mods": [(m.type, getattr(m, "levels", None), getattr(m, "render_levels", None), getattr(m, "thickness", None)) for m in o.modifiers],
               "props": {k: (o[k] if isinstance(o[k], (int, float, str)) else str(type(o[k]).__name__)) for k in o.keys() if k in ("muscle_color", "key_color", "M3")},
               "materials": [s.material.name if s.material else None for s in o.material_slots],
               "parent": o.parent.name if o.parent else None}
        top = " ".join(rec["collections"]).lower()
        if "insertion" in top or re.search(r"(origin|insertion|ins\.|\bo\d|\be\d)", n):
            out["insertions"].append(rec)
        else:
            out["muscles"].append(rec)
    elif any(t in n for t in BONES) and len(o.data.polygons) > 200:
        out["bones"].append({"name": o.name, "collections": coll_of(o), "faces": len(o.data.polygons), "mods": [m.type for m in o.modifiers]})
for t in D.texts:
    tn = t.name.lower()
    if any(x in tn for x in TARGETS):
        out["texts"][t.name] = t.as_string()[:600]
json.dump(out, open(sys.argv[-1], "w"), indent=1, ensure_ascii=False)
