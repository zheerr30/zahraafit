import bpy, json, os
OUT = (os.environ.get("SHOTS_OUT", "shots"))
region = json.load(open(os.environ.get("REGION_JSON", "region.json")))
MUSCLES = {m["name"] for m in region["muscles"] if m["faces"] > 0 and "region" not in m["name"].lower()}
INSERT = {m["name"] for m in region["insertions"] if m["faces"] > 0}
BONE_KEYS = ("Scapula", "Clavicle", "Humerus", "Vertebra T", "Vertebra C", "Vertebra L", "rib.", "Sacrum", "Hip bone", "Atlas", "Axis", "Occipital", "Parietal", "Temporal bone", "Sternum", "Manubrium", "Body of sternum")
log = open(os.path.join(OUT, "log.txt"), "w")

def unhide_collections(lc):
    lc.exclude = False
    lc.hide_viewport = False
    lc.collection.hide_viewport = False
    for c in lc.children: unhide_collections(c)

def show_only(pred):
    vl = bpy.context.view_layer
    for o in bpy.context.scene.objects:
        keep = pred(o)
        try:
            o.hide_viewport = False
            o.hide_set(not keep)
        except RuntimeError:
            pass

def win_area(kind):
    win = bpy.context.window_manager.windows[0]
    areas = [a for a in win.screen.areas if a.type == kind]
    return win, max(areas, key=lambda a: a.width * a.height) if areas else None

def view3d(fn, **kw):
    win, area = win_area("VIEW_3D")
    region = [r for r in area.regions if r.type == "WINDOW"][0]
    with bpy.context.temp_override(window=win, area=area, region=region):
        fn(**kw)

def set_shading(kind="SOLID", color="MATERIAL", wire=False, xray=False):
    win, area = win_area("VIEW_3D")
    sp = area.spaces[0]
    sp.shading.type = kind
    if kind == "SOLID":
        sp.shading.color_type = color
        sp.shading.light = "STUDIO"
    sp.overlay.show_wireframes = wire
    sp.overlay.wireframe_threshold = 1.0
    sp.shading.show_xray = xray
    sp.overlay.show_text = True
    sp.overlay.show_stats = True
    sp.show_region_toolbar = False

def select(names, active=None):
    bpy.ops.object.select_all(action="DESELECT") if False else None
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for n in names:
        o = bpy.data.objects.get(n)
        if o and o.visible_get():
            o.select_set(True)
    if active and bpy.data.objects.get(active):
        bpy.context.view_layer.objects.active = bpy.data.objects[active]

def outliner_show_active():
    win, area = win_area("OUTLINER")
    if not area: return
    region = [r for r in area.regions if r.type == "WINDOW"][0]
    with bpy.context.temp_override(window=win, area=area, region=region):
        try: bpy.ops.outliner.show_active()
        except Exception as e: log.write(f"outliner {e}\n")

def text_editor(name):
    win = bpy.context.window_manager.windows[0]
    cands = [a for a in win.screen.areas if a.type in ("PROPERTIES", "TEXT_EDITOR")]
    if not cands: return
    a = cands[0]
    a.type = "TEXT_EDITOR"
    a.spaces[0].text = bpy.data.texts.get(name)
    a.spaces[0].show_word_wrap = True

def shot(name):
    import subprocess
    subprocess.run(["import", "-window", "root", os.path.join(OUT, name + ".png")], check=False)
    log.write(f"shot {name}\n"); log.flush()

is_bone = lambda o: o.type == "MESH" and any(k in o.name for k in BONE_KEYS) and len(o.data.polygons) > 200

steps = []
def step(f): steps.append(f); return f

def xdo(*args):
    import subprocess
    subprocess.run(["xdotool", *args], check=False)

@step
def s_dismiss():
    xdo("mousemove", "1165", "598", "click", "1")   # "Ignore" on the auto-run warning (scripts stay disabled)
@step
def s_dismiss2():
    xdo("key", "Escape")
    xdo("mousemove", "150", "950", "click", "1")    # close the splash screen
    xdo("mousemove", "1290", "1070")

@step
def s0():
    unhide_collections(bpy.context.view_layer.layer_collection)
    win = bpy.context.window_manager.windows[0]
    log.write("areas " + ", ".join(f"{a.type}:{a.width}x{a.height}" for a in win.screen.areas) + "\n")
    # whole muscular + skeletal systems: the dataset as shipped
    skinlike = lambda o: any(k in o.name.lower() for k in ("fascia", "region", "aponeurosis of", "investing", "skin", "bursa", "sheath", "retinacul"))
    show_only(lambda o: o.type == "MESH" and len(o.data.polygons) > 60 and not skinlike(o) and (any(c.name.startswith(("1: Skeletal", "4: Muscular")) for c in o.users_collection) or o.name in MUSCLES))
    set_shading("MATERIAL")
    select([o.name for o in bpy.context.scene.objects if o.visible_get() and o.type == "MESH"])
    view3d(bpy.ops.view3d.view_axis, type="BACK")
    view3d(bpy.ops.view3d.view_selected)
    select([])
@step
def s0w(): pass
@step
def s0w2(): pass
@step
def s0w3(): pass
@step
def s1(): shot("01-zanatomy-full-body-back")
@step
def s2():
    show_only(lambda o: o.name in MUSCLES or is_bone(o))
    set_shading("MATERIAL")
    select([n for n in MUSCLES], active="Latissimus dorsi muscle.l")
    view3d(bpy.ops.view3d.view_axis, type="BACK")
    view3d(bpy.ops.view3d.view_selected)
    select(["Latissimus dorsi muscle.l"], active="Latissimus dorsi muscle.l")
    outliner_show_active()
    text_editor("Latissimus dorsi muscle")
@step
def s3(): shot("02-back-shoulder-muscles-selected-latissimus")
@step
def s4():
    show_only(lambda o: o.name in MUSCLES or is_bone(o))
    select(["Descending part of trapezius muscle.l", "Transverse part of trapezius muscle.l", "Ascending part of trapezius muscle.l"], active="Transverse part of trapezius muscle.l")
    view3d(bpy.ops.view3d.view_selected)
    set_shading("SOLID", "MATERIAL", wire=True)
    outliner_show_active()
    text_editor("Trapezius muscle")
@step
def s5(): shot("03-trapezius-wireframe-original-geometry")
@step
def s6():
    deep = {n for n in MUSCLES if not any(k in n for k in ("trapezius", "Latissimus", "deltoid", "fascia"))}
    show_only(lambda o: o.name in deep or is_bone(o))
    set_shading("MATERIAL")
    select([n for n in deep], active="Infraspinatus muscle.l")
    view3d(bpy.ops.view3d.view_axis, type="BACK")
    view3d(bpy.ops.view3d.view_selected)
    select(["Infraspinatus muscle.l"], active="Infraspinatus muscle.l")
    outliner_show_active()
    text_editor("Infraspinatus muscle")
@step
def s7(): shot("04-deep-layer-rotator-cuff-rhomboids-erector")
@step
def s8():
    show_only(lambda o: o.name in INSERT or is_bone(o))
    for o in bpy.context.scene.objects:
        if o.name in INSERT:
            suf = o.name.rsplit(".", 1)[-1]
            o.color = (0.75, 0.08, 0.2, 1) if suf.startswith("o") else (0.15, 0.4, 0.95, 1)
        elif is_bone(o):
            o.color = (0.9, 0.86, 0.76, 1)
    set_shading("SOLID", "OBJECT")
    sc = [o.name for o in bpy.context.scene.objects if o.name in ("Scapula.l", "Humerus.l", "Clavicle.l")]
    select(sc, active="Scapula.l")
    view3d(bpy.ops.view3d.view_axis, type="BACK")
    view3d(bpy.ops.view3d.view_selected)
    select(["Infraspinatus muscle.ol", "Infraspinatus muscle.el"], active="Infraspinatus muscle.ol")
    outliner_show_active()
@step
def s9(): shot("05-origin-insertion-patches-on-scapula-humerus")
@step
def s10():
    show_only(lambda o: o.name in MUSCLES or is_bone(o))
    set_shading("MATERIAL")
    view3d(bpy.ops.view3d.view_axis, type="LEFT")
    select(["Acromial part of deltoid muscle.l", "Clavicular part of deltoid muscle.l", "Scapular spinal part of deltoid muscle.l"], active="Acromial part of deltoid muscle.l")
    view3d(bpy.ops.view3d.view_selected)
    outliner_show_active()
    text_editor("Deltoid muscle")
@step
def s11(): shot("06-deltoid-three-parts-lateral")
@step
def s12a():
    # Face-level tendon segmentation painted by the Z-Anatomy author (material slot "Tendon").
    sel = [n for n in MUSCLES if any(k in n for k in ("trapezius", "Latissimus", "Rhomboid", "Levator", "deltoid", "Infraspinatus")) and "fascia" not in n]
    show_only(lambda o: o.name in sel or is_bone(o))
    for o in bpy.context.scene.objects:
        if o.name in sel:
            for slot in o.material_slots:
                if slot.material: slot.material.diffuse_color = (0.93, 0.9, 0.84, 1) if slot.material.name == "Tendon" else (0.62, 0.16, 0.17, 1)
    set_shading("SOLID", "MATERIAL")
    view3d(bpy.ops.view3d.view_axis, type="BACK")
    select(sel, active="Latissimus dorsi muscle.l")
    view3d(bpy.ops.view3d.view_selected)
    select([])
@step
def s12b(): shot("07-tendon-faces-segmented-by-author")
@step
def s12():
    log.write("done\n"); log.close()
    bpy.ops.wm.quit_blender()

i = [0]
def tick():
    try:
        steps[i[0]]()
    except Exception as e:
        log.write(f"step {i[0]} error {e!r}\n"); log.flush()
    i[0] += 1
    return 12.0 if i[0] < len(steps) else None
bpy.app.timers.register(tick, first_interval=8.0)
