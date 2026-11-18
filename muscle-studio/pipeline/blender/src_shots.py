# Blender GUI screenshots of the ORIGINAL Z-Anatomy file for every region (display only; nothing saved).
import bpy, os, re, subprocess, sys
sys.path.insert(0, "/home/user/zahraafit/muscle-studio/pipeline/blender")
OUT = os.environ.get("SHOTS_OUT", "source")
os.makedirs(OUT, exist_ok=True)
src = open("/home/user/zahraafit/muscle-studio/pipeline/blender/audit_fullbody.py").read()
ns = {}
exec(src[src.index("def chain(o):"):src.index("base = lambda")], {"re": re}, ns)
chain, region_of = ns["chain"], ns["region_of"]
skin = lambda n: re.search(r"fascia|region|investing|skin|bursa|sheath|retinacul|aponeurosis of|Platysma", n, re.I)
def is_tissue(o):
    if o.type != "MESH" or len(o.data.polygons) < 60 or skin(o.name): return False
    c = next((c.name for c in o.users_collection), "")
    return c.startswith(("1: Skeletal", "4: Muscular"))
def unhide(lc):
    lc.exclude = False; lc.hide_viewport = False; lc.collection.hide_viewport = False
    for c in lc.children: unhide(c)
def area(kind):
    w = bpy.context.window_manager.windows[0]
    return w, max((a for a in w.screen.areas if a.type == kind), key=lambda a: a.width * a.height)
def v3d(fn, **kw):
    w, a = area("VIEW_3D"); r = [x for x in a.regions if x.type == "WINDOW"][0]
    with bpy.context.temp_override(window=w, area=a, region=r): fn(**kw)
def show(pred):
    for o in bpy.context.scene.objects:
        try: o.hide_viewport = False; o.hide_set(not pred(o))
        except RuntimeError: pass
def select(objs):
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in objs:
        if o.visible_get(): o.select_set(True)
def frame(objs, axis):
    select(objs); v3d(bpy.ops.view3d.view_axis, type=axis); v3d(bpy.ops.view3d.view_selected); select([])
def shot(name): subprocess.run(["import", "-window", "root", os.path.join(OUT, name + ".png")])
def xdo(*a): subprocess.run(["xdotool", *a])
REG = {}
for o in bpy.data.objects:
    if o.type == "MESH" and len(o.data.polygons) and any(c.name.startswith("4: Muscular") for c in o.users_collection):
        r = region_of(chain(o), o.name)
        if r: REG.setdefault(r, []).append(o)
steps = []
steps.append(lambda: xdo("mousemove", "1165", "598", "click", "1"))
steps.append(lambda: (xdo("key", "Escape"), xdo("mousemove", "150", "950", "click", "1"), xdo("mousemove", "1290", "1070")))
def setup():
    unhide(bpy.context.view_layer.layer_collection)
    w, a = area("VIEW_3D"); sp = a.spaces[0]
    sp.shading.type = "MATERIAL"; sp.overlay.show_stats = True; sp.show_region_toolbar = False; sp.show_region_ui = False
    show(is_tissue)
steps.append(setup)
tissue = lambda: [o for o in bpy.context.scene.objects if is_tissue(o)]
for name, axis in [("S-full-anterior", "FRONT"), ("S-full-posterior", "BACK"), ("S-full-left", "LEFT")]:
    steps.append(lambda axis=axis: frame(tissue(), axis)); steps.append(lambda: None); steps.append(lambda name=name: shot(name))
for reg, axis in [("Head & neck", "FRONT"), ("Chest", "FRONT"), ("Back", "BACK"), ("Shoulders", "BACK"), ("Arms & forearms", "FRONT"),
                  ("Abdomen & core", "FRONT"), ("Pelvis & glutes", "BACK"), ("Quadriceps & hamstrings", "FRONT"), ("Adductors & abductors", "FRONT"), ("Calves & lower legs", "BACK")]:
    objs = [o for o in REG.get(reg, []) if o.name.endswith(".l") or reg in ("Head & neck", "Chest", "Back", "Abdomen & core")]
    fn = "R-" + re.sub(r"[^a-z]+", "-", reg.lower()).strip("-")
    steps.append(lambda objs=objs, axis=axis: frame(objs, axis)); steps.append(lambda: None); steps.append(lambda fn=fn: shot(fn))
steps.append(lambda: bpy.ops.wm.quit_blender())
i = [0]
def tick():
    steps[i[0]](); i[0] += 1
    return 7.0 if i[0] < len(steps) else None
bpy.app.timers.register(tick, first_interval=10.0)
