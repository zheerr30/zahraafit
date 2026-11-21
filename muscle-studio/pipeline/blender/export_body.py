# Export the WHOLE body from the original Z-Anatomy Blender file
# (Startup.blend, CC BY-SA 4.0) without changing the anatomy:
#   * every structure is exported from its own object, world-space geometry
#     untouched (muscles and bones have no modifiers; insertion patches,
#     bursae, fasciae get the author's own Solidify/Subdivision modifiers
#     applied, as Blender displays them; nerve curves are meshed as displayed);
#   * the author's per-face "Tendon" / "Cartilage" material slots are kept
#     (one glTF primitive per slot);
#   * node extras: Z-Anatomy name, side, kind, system, hierarchy, material
#     slots, TA2 ID, Latin name, definition key (+ bone for attachment patches).
# Three files, so the web app can load the optional layers on demand:
#   <out>/core.glb         muscles, bones, cartilages, ligaments, fasciae, bursae
#   <out>/attachments.glb  origin / insertion patches
#   <out>/nerves.glb       peripheral (spinal + cranial) nerves
#   <out>/organs.glb, vessels.glb, skin.glb   other systems (reference layers)
#   <out>/definitions.json definitions of the exported structures
#
#   blender -b Startup.blend --python export_body.py -- TA2.csv <out dir>
import bpy, json, os, re, sys

ta2_path, out_dir = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(out_dir, exist_ok=True)
D = bpy.data

ta2 = {}
with open(ta2_path, encoding="utf-8-sig") as f:
    for line in f:
        row = line.strip().strip('"').split(";")
        if len(row) >= 3 and row[0].isdigit():
            ta2.setdefault(row[1].lower(), {"id": int(row[0]), "latin": row[2]})

SIDE_RE = re.compile(r"^(.*?)(?:\.([lr]))?$")
PATCH_RE = re.compile(r"^(.*)\.([oe])(\d*)([lr]?)$")
HELPER_RE = re.compile(r"\.[a-z]\d*[lr]?$")  # .g group, .j/.i/.s/.t label helpers …
CONNECTIVE = re.compile(r"bursa|fascia|sheath|retinacul|aponeurosis|septum|ligament|tendon\b|tendinous|tarsus$|trochlea|arch\b|tract\b|linea alba|ring$|capsule|membrane|labrum|meniscus|disc\b|pulley", re.I)
# Sheets that cover the muscles (shown on demand): fasciae, bursae, tendon sheaths, septa.
FASCIA = re.compile(r"fascia\b|fascia$|bursa|bursae|sheath|septum|investing", re.I)
DISC = re.compile(r"Intervertebral disc|Nucleus pulposus|Pubic symphysis|disc of|Annulus", re.I)
# Not part of the musculoskeletal atlas (and two of them are non-commercial models in Z-Anatomy).
EXCLUDE = re.compile(r"labyrinth|cochlea|semicircular|vestibul|ossicle|kidney|renal", re.I)

def top_collection(o):
    names = [c.name for c in o.users_collection]
    return next((n for n in names if re.match(r"^\d: ", n)), names[0] if names else "")

def chain(o):
    c, p = [], o.parent
    while p:
        if p.name.endswith(".g"):
            c.append(p.name[:-2])
        p = p.parent
    return list(reversed(c))

def geometric(o):
    if o.type == "MESH":
        return len(o.data.polygons) > 0
    return o.type == "CURVE" and o.data.bevel_depth > 0

picked = {"core": [], "attachments": [], "nerves": [], "organs": [], "vessels": [], "skin": []}
for o in D.objects:
    if not geometric(o) or EXCLUDE.search(o.name):
        continue
    top = top_collection(o)
    h = chain(o)
    if top.startswith("2: Muscular insertions"):
        pm = PATCH_RE.match(o.name)
        if pm:
            picked["attachments"].append((o, "attachment", {"muscle": pm.group(1), "suffix": pm.group(2), "patchIndex": pm.group(3), "side": pm.group(4) or "m", "bone_za": o.parent.name if o.parent else ""}))
        continue
    if HELPER_RE.search(o.name) and not SIDE_RE.match(o.name).group(2):
        continue
    if top.startswith("7: Nervous"):
        if "Peripheral nervous system" in h or "Cranial nerves" in h or "Spinal nerves" in h:
            picked["nerves"].append((o, "nerve", {}))
        continue
    if top.startswith("5: Cardiovascular"):
        picked["vessels"].append((o, "vessel", {}))
        continue
    if o.type != "MESH":
        continue
    if top.startswith("8: Visceral"):
        picked["organs"].append((o, "organ", {}))
    elif top.startswith("9: Regions"):
        picked["skin"].append((o, "skin", {}))
    elif top.startswith("4: Muscular"):
        kind = ("fascia" if FASCIA.search(o.name) and not re.search(r"Tensor fasciae", o.name) else "tendon") if CONNECTIVE.search(o.name) and not re.search(r"Tensor fasciae latae", o.name) else "muscle"
        picked["core"].append((o, kind, {}))
    elif top.startswith("1: Skeletal"):
        picked["core"].append((o, "bone", {}))
    elif top.startswith("3: Joints"):
        picked["core"].append((o, "bone" if DISC.search(o.name) else "ligament", {}))

def side_of(o, side):
    if side in ("l", "r"):
        return side
    vs = list(o.data.vertices)[:: max(1, len(o.data.vertices) // 200)] if o.type == "MESH" else []
    if not vs:
        x = o.matrix_world.translation.x
    else:
        x = sum((o.matrix_world @ v.co).x for v in vs) / len(vs)
    return "l" if x > 0.4 else "r" if x < -0.4 else "m"  # source units: cm

dg = bpy.context.evaluated_depsgraph_get()
defs, report = {}, {}
for part, items in picked.items():
    coll = D.collections.new("EXPORT_" + part)
    bpy.context.scene.collection.children.link(coll)
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
    rep = report.setdefault(part, {"objects": 0, "triangles": 0, "by_kind": {}})
    for o, kind, extra in items:
        if kind == "attachment":
            b, side = extra["muscle"], extra["side"]
        else:
            m = SIDE_RE.match(o.name)
            b, side = m.group(1), m.group(2) or ""
        side = side_of(o, side)
        me = D.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=False, depsgraph=dg)
        me.transform(o.matrix_world)
        if o.type == "MESH" and o.matrix_world.determinant() < 0:
            me.flip_normals()
        for i, slot in enumerate(o.material_slots):
            if i < len(me.materials):
                me.materials[i] = slot.material
        c = D.objects.new(o.name, me)
        coll.objects.link(c)
        h = chain(o)
        term = ta2.get(b.lower(), {})
        if b in D.texts and b not in defs:
            defs[b] = D.texts[b].as_string().strip()
        c["kind"] = kind
        c["za_name"] = o.name
        c["za_base"] = b
        c["side"] = side
        c["system"] = top_collection(o)
        c["hierarchy"] = json.dumps(h)
        c["materials"] = json.dumps([s.material.name if s.material else None for s in o.material_slots])
        if term:
            c["ta2_id"] = term["id"]
            c["latin"] = term["latin"]
        if b in D.texts:
            c["definition"] = b
        for k, v in extra.items():
            if k != "side":
                c[k] = v
        c.parent = group_node([c["system"]] + h)
        tri = sum(len(p.vertices) - 2 for p in me.polygons)
        rep["objects"] += 1
        rep["triangles"] += tri
        k = rep["by_kind"].setdefault(kind, {"objects": 0, "triangles": 0})
        k["objects"] += 1
        k["triangles"] += tri
    for ob in bpy.context.view_layer.objects:
        ob.select_set(False)
    for ob in coll.objects:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, part + ".glb"), export_format="GLB", use_selection=True, export_extras=True,
        export_yup=True, export_apply=False, export_normals=True, export_texcoords=False, export_materials="EXPORT",
        export_colors=False, export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False,
    )
    bpy.context.scene.collection.children.unlink(coll)

json.dump({"source": "Z-Anatomy Startup.blend (CC BY-SA 4.0); definitions: Wikipedia (CC BY-SA 3.0) via Z-Anatomy", "definitions": defs},
          open(os.path.join(out_dir, "definitions.json"), "w"), ensure_ascii=False)
print("EXPORT_REPORT " + json.dumps(report))
