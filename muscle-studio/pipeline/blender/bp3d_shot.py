# BodyParts3D 4.0 OBJ files of the region imported into a fresh Blender scene.
import bpy, os, re, subprocess, glob
BP = os.environ["BP3D_DATA"]
OUT = os.environ.get("SHOTS_OUT", "shots")
want = re.compile(r"^# (left |right )?(.*(trapezius|deltoid|infraspinatus|supraspinatus|teres (major|minor)|rhomboid (major|minor)|levator scapulae|scapula|clavicle|humerus|iliocostalis|longissimus thoracis|spinalis thoracis)[^\n]*)$", re.I)
files = []
pat = re.compile(r"^((descending|transverse|ascending) part of (left|right) trapezius|(clavicular|acromial|spinal) part of (left|right) deltoid)$|^(left|right) ((descending|transverse|ascending) part of (left |right )?trapezius|(clavicular|acromial|spinal) part of (left |right )?deltoid|infraspinatus( muscle)?|supraspinatus|teres major|teres minor|rhomboid major|rhomboid minor|levator scapulae|scapula|clavicle|humerus)$", re.I)
fj = {}
for lst in ("partof_element_parts.txt", "isa_element_parts.txt"):
    for line in open(os.path.join(BP, lst), encoding="utf8").read().splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) >= 3 and pat.match(parts[1].strip()):
            fj.setdefault(parts[2].strip(), parts[1].strip())
for d in ("partof_BP3D_4.0_obj_99", "isa_BP3D_4.0_obj_99"):
    for k, n in fj.items():
        f = os.path.join(BP, d, k + ".obj")
        if os.path.exists(f): files.append((f, [n]))
seen = set()
for f, names in files:
    if f in seen: continue
    seen.add(f)
    bpy.ops.wm.obj_import(filepath=f, forward_axis="NEGATIVE_Y", up_axis="Z")
    for o in bpy.context.selected_objects:
        o.name = names[0]
open(os.path.join(OUT, "bp3d_files.txt"), "w").write("\n".join(f"{os.path.basename(f)}\t{n}" for f, n in files))
for o in bpy.data.objects:
    if o.type in ("CAMERA", "LIGHT") or o.name == "Cube": bpy.data.objects.remove(o)
def area(kind):
    w = bpy.context.window_manager.windows[0]
    return w, max((a for a in w.screen.areas if a.type == kind), key=lambda a: a.width * a.height)
steps = []
def setup():
    w, a = area("VIEW_3D")
    sp = a.spaces[0]
    sp.shading.type = "SOLID"; sp.shading.color_type = "RANDOM"
    sp.overlay.show_wireframes = True; sp.overlay.wireframe_threshold = 1.0; sp.overlay.show_stats = True
    r = [x for x in a.regions if x.type == "WINDOW"][0]
    with bpy.context.temp_override(window=w, area=a, region=r):
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.view3d.view_axis(type="BACK")
        bpy.ops.view3d.view_selected()
        bpy.ops.object.select_all(action="DESELECT")
def shot():
    subprocess.run(["import", "-window", "root", os.path.join(OUT, "08-bodyparts3d-obj-imported-in-blender.png")])
    bpy.ops.wm.quit_blender()
seq = [lambda: subprocess.run(["xdotool", "key", "Escape"]), setup, lambda: None, shot]
i = [0]
def tick():
    seq[i[0]](); i[0] += 1
    return 8.0 if i[0] < len(seq) else None
bpy.app.timers.register(tick, first_interval=6.0)
