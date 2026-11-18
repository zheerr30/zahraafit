# Export the back & shoulder region of the original Z-Anatomy Blender file
# (Startup.blend, CC BY-SA 4.0) to an uncompressed GLB, without changing the
# anatomy:
#   * every structure is exported from its own object, geometry untouched
#     (muscles and bones have no modifiers; insertion patches, bursae and
#     fasciae get the author's own Solidify/Subdivision modifiers applied, as
#     they appear in Blender);
#   * the author's per-face "Tendon" / "Cartilage" material assignment is kept
#     (one glTF primitive per material slot);
#   * the anatomical hierarchy (Z-Anatomy's group objects "….g") becomes glTF
#     group nodes; attachment patches are children of their bone;
#   * metadata goes into node extras: Z-Anatomy name, side, kind, TA2 ID,
#     Latin name, function material, hierarchy, definition key.
#
#   blender -b Startup.blend --python export_back.py -- selection.json TA2.csv out.glb definitions.json
import bpy, csv, json, re, sys
from mathutils import Matrix

sel_path, ta2_path, out_glb, out_defs = sys.argv[sys.argv.index("--") + 1:][:4]
S = json.load(open(sel_path))
D = bpy.data

# ── TA2 terms (Terminologia Anatomica 2) by English name ──
ta2 = {}
with open(ta2_path, encoding="utf-8-sig") as f:
    for line in f:
        row = line.strip().strip('"').split(";")
        if len(row) >= 3 and row[0].isdigit():
            ta2.setdefault(row[1].lower(), {"id": int(row[0]), "latin": row[2]})

SIDE_RE = re.compile(r"^(.*?)(?:\.([lr]))?$")
PATCH_RE = re.compile(r"^(.*)\.([oe])(\d*)([lr]?)$")

def base_side(name):
    m = SIDE_RE.match(name)
    return m.group(1), m.group(2) or ""

def hierarchy(o):
    chain, p = [], o.parent
    while p:
        n = p.name
        if n.endswith(".g"):
            chain.append(n[:-2])
        p = p.parent
    top = next((c.name for c in o.users_collection), "")
    return list(reversed(chain)), top

def mesh_objects(pred):
    # meshes, plus bevelled curves (Z-Anatomy draws nerves as curves with a bevel)
    return [o for o in D.objects if ((o.type == "MESH" and len(o.data.polygons)) or (o.type == "CURVE" and o.data.bevel_depth > 0)) and pred(o)]

# Nerves that run mainly into the forearm and hand: the region ends with the
# humerus and original geometry is never cut, so they are left out.
NERVE_EXCLUDE = {"Median nerve", "Ulnar nerve", "Musculocutaneous nerve"}

# ── selection ──
picked = []  # (object, kind, extra)
unit_of = {}
for u in S["units"]:
    for m in u["meshes"]:
        unit_of[m] = u
for o in mesh_objects(lambda o: True):
    b, side = base_side(o.name)
    coll = next((c.name for c in o.users_collection), "")
    if coll.startswith("2: Muscular insertions"):
        pm = PATCH_RE.match(o.name)
        if pm:
            for u in S["units"]:
                if pm.group(1) in u["patches"]:
                    picked.append((o, "attachment", {"muscle": pm.group(1), "suffix": pm.group(2), "patchIndex": pm.group(3), "side": pm.group(4) or "m"}))
                    break
        continue
    if o.type == "CURVE" and b not in S["nerves"]:
        continue
    if b in unit_of:
        picked.append((o, "unit", {"unit": unit_of[b]["id"], "depth": unit_of[b]["depth"]}))
    elif b in S["context"]:
        picked.append((o, "context", {}))
    elif b in S["tendons"]:
        picked.append((o, "tendon", {}))
    elif b in S["nerves"] and b not in NERVE_EXCLUDE:
        picked.append((o, "nerve", {}))
    elif b in S["bones"] or re.match(S["discPattern"], b):
        picked.append((o, "bone", {}))

# Midline-named left objects (e.g. "Iliocostalis colli muscle") get their side from position.
def side_of(o, side):
    if side in ("l", "r"):
        return side
    vs = list(o.data.vertices)[:: max(1, len(o.data.vertices) // 200)]
    x = sum((o.matrix_world @ v.co).x for v in vs) / len(vs)
    return "l" if x > 0.004 else "r" if x < -0.004 else "m"

# ── build export copies (world-space, modifiers as authored) ──
coll = D.collections.new("EXPORT_back_shoulder")
bpy.context.scene.collection.children.link(coll)
dg = bpy.context.evaluated_depsgraph_get()
groups = {}
def group_node(path):
    parent = None
    for i in range(len(path)):
        key = "/".join(path[: i + 1])
        if key not in groups:
            e = D.objects.new(path[i], None)
            coll.objects.link(e)
            e["kind"] = "group"
            e["hierarchy"] = json.dumps(path[: i + 1])
            if parent:
                e.parent = parent
            groups[key] = e
        parent = groups[key]
    return parent

copies = {}
report = {"objects": 0, "triangles_src": 0, "triangles_out": 0, "missing_definitions": [], "by_kind": {}}
defs = {}
for o, kind, extra in picked:
    b, side = base_side(o.name)
    if kind == "attachment":
        b, side = extra["muscle"], extra["side"]
    side = side_of(o, side)
    ev = o.evaluated_get(dg)
    me = D.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
    me.transform(o.matrix_world)
    if o.type == "MESH" and o.matrix_world.determinant() < 0:
        me.flip_normals()
    for i, slot in enumerate(o.material_slots):  # keep slot structure for per-face materials
        if i < len(me.materials):
            me.materials[i] = slot.material
    c = D.objects.new(o.name, me)
    coll.objects.link(c)
    chain, top = hierarchy(o)
    term = ta2.get(b.lower(), {})
    defkey = b if b in D.texts else None
    if defkey and defkey not in defs:
        defs[defkey] = D.texts[defkey].as_string().strip()
    if not defkey:
        report["missing_definitions"].append(b)
    c["kind"] = kind
    c["za_name"] = o.name
    c["za_base"] = b
    c["side"] = side
    c["system"] = top
    c["hierarchy"] = json.dumps(chain)
    c["materials"] = json.dumps([s.material.name if s.material else None for s in o.material_slots])
    if term:
        c["ta2_id"] = term["id"]
        c["latin"] = term["latin"]
    if defkey:
        c["definition"] = defkey
    for k, v in extra.items():
        if k != "side":
            c[k] = v
    if kind == "attachment" and o.parent:
        c["bone"] = o.parent.name
    copies[o.name] = (c, kind, chain)
    tri_src = sum(len(p.vertices) - 2 for p in (o.data.polygons if o.type == "MESH" else me.polygons))
    tri_out = sum(len(p.vertices) - 2 for p in me.polygons)
    report["objects"] += 1
    report["triangles_src"] += tri_src
    report["triangles_out"] += tri_out
    k = report["by_kind"].setdefault(kind, {"objects": 0, "triangles": 0})
    k["objects"] += 1
    k["triangles"] += tri_out

# hierarchy: structures under their anatomical group; attachment patches under their bone
for name, (c, kind, chain) in copies.items():
    if kind == "attachment" and c.get("bone") in copies:
        c.parent = copies[c["bone"]][0]
    else:
        c.parent = group_node([c["system"]] + chain)

# ── export ──
for ob in bpy.context.view_layer.objects:
    ob.select_set(False)
for ob in coll.objects:
    ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_apply=False,
    export_normals=True,
    export_texcoords=False,
    export_materials="EXPORT",
    export_colors=False,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_skins=False,
    export_morph=False,
)
json.dump({"source": "Z-Anatomy Startup.blend (CC BY-SA 4.0); definitions: Wikipedia (CC BY-SA 3.0) via Z-Anatomy", "definitions": defs}, open(out_defs, "w"), ensure_ascii=False, indent=0)
report["definitions"] = len(defs)
print("EXPORT_REPORT " + json.dumps(report))
