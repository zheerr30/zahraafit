import bpy, json, collections, sys
out = {}
D = bpy.data
out["file_version"] = list(D.version)
out["counts"] = {k: len(getattr(D, k)) for k in ["objects","meshes","collections","materials","texts","images","curves","fonts"]}
types = collections.Counter(o.type for o in D.objects)
out["object_types"] = dict(types)
mods = collections.Counter(m.type for o in D.objects for m in o.modifiers)
out["modifier_types"] = dict(mods)
props = collections.Counter(k for o in D.objects for k in o.keys())
out["object_custom_props"] = dict(props.most_common(30))
mprops = collections.Counter(k for m in D.meshes for k in m.keys())
out["mesh_custom_props"] = dict(mprops.most_common(30))
out["texts"] = [t.name for t in D.texts][:40]
# collection tree (top 3 levels)
def tree(c, depth):
    d = {"objects": len(c.objects), "children": {}}
    if depth < 3:
        for ch in c.children: d["children"][ch.name] = tree(ch, depth + 1)
    return d
out["scene_tree"] = {c.name: tree(c, 0) for c in bpy.context.scene.collection.children}
json.dump(out, open(sys.argv[-1], "w"), indent=1, ensure_ascii=False)
