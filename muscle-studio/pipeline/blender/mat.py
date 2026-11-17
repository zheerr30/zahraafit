import bpy, json, sys
D = bpy.data
out = {"images": [(i.name, list(i.size), i.filepath, i.packed_file is not None) for i in D.images]}
for name in ["Latissimus dorsi muscle.l", "Descending part of trapezius muscle.l", "Infraspinatus muscle.l", "Scapula.l", "Infraspinatus muscle.ol"]:
    o = D.objects.get(name)
    me = o.data
    rec = {"attributes": [(a.name, a.domain, a.data_type) for a in me.attributes],
           "color_attributes": [(a.name, a.domain, a.data_type) for a in me.color_attributes],
           "uv_layers": [u.name for u in me.uv_layers],
           "materials": []}
    for slot in o.material_slots:
        m = slot.material
        nodes = []
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                nd = {"type": n.bl_idname, "name": n.name}
                if n.bl_idname == "ShaderNodeAttribute": nd["attr"] = n.attribute_name
                if n.bl_idname == "ShaderNodeVertexColor": nd["layer"] = n.layer_name
                if n.bl_idname == "ShaderNodeTexImage": nd["image"] = n.image.name if n.image else None
                if n.bl_idname == "ShaderNodeGroup": nd["group"] = n.node_tree.name if n.node_tree else None
                nodes.append(nd)
        rec["materials"].append({"name": m.name if m else None, "diffuse": list(m.diffuse_color) if m else None, "nodes": nodes})
    out[name] = rec
# vertex colour statistics for the latissimus
o = D.objects["Latissimus dorsi muscle.l"]
ca = o.data.color_attributes
if len(ca):
    a = ca[0]
    vals = [tuple(round(c, 2) for c in d.color) for d in a.data]
    import collections
    out["lat_color_hist"] = collections.Counter(vals).most_common(8)
    out["lat_color_count"] = len(vals)
json.dump(out, open(sys.argv[-1], "w"), indent=1, default=str)
