# Full-body audit of the original Z-Anatomy Blender file (read-only).
# For each of the 10 study regions: independent muscle meshes, textbook
# checklist coverage (superficial / deep), bones, tendon faces and tendon /
# ligament objects, origin & insertion patches, TA2 naming, definitions.
#   blender -b Startup.blend --python audit_fullbody.py -- TA2.csv out.json
import bpy, json, re, sys
D = bpy.data
ta2_path, out_path = sys.argv[sys.argv.index("--") + 1:][:2]
ta2 = set()
with open(ta2_path, encoding="utf-8-sig") as f:
    for line in f:
        row = line.strip().strip('"').split(";")
        if len(row) >= 3 and row[0].isdigit():
            ta2.add(row[1].lower())

REGIONS = ["Head & neck", "Chest", "Back", "Shoulders", "Arms & forearms", "Abdomen & core", "Pelvis & glutes",
           "Quadriceps & hamstrings", "Adductors & abductors", "Calves & lower legs"]

# Textbook checklist per region (regex on lower-case Z-Anatomy base names): (label, regex, layer)
S, D_, I = "superficial", "deep", "intermediate"
CHECK = {
    "Head & neck": [
        ("Occipitofrontalis (frontal belly)", r"frontalis|frontal belly", S), ("Occipitofrontalis (occipital belly)", r"occipitalis|occipital belly", S),
        ("Temporalis", r"^temporalis", S), ("Masseter", r"masseter", S), ("Orbicularis oculi", r"orbicularis oculi", S),
        ("Orbicularis oris", r"orbicularis oris", S), ("Zygomaticus major", r"zygomaticus major", S), ("Buccinator", r"buc+inator", S),
        ("Platysma", r"^platysma", S), ("Sternocleidomastoid", r"sternocleidomastoid", S),
        ("Medial / lateral pterygoid", r"pterygoid", D_), ("Scalenes", r"scalenus", D_), ("Suprahyoid (digastric, mylohyoid…)", r"digastric|mylohyoid|stylohyoid|geniohyoid", I),
        ("Infrahyoid (sternohyoid, omohyoid…)", r"sternohyoid|omohyoid|sternothyroid|thyrohyoid", I), ("Longus colli / capitis", r"^longus (colli|capitis)", D_),
        ("Splenius capitis / colli", r"^splenius", I), ("Semispinalis capitis", r"semispinalis capitis", D_), ("Suboccipital muscles", r"rectus posterior|obliquus (inferior|superior) capitis", D_),
    ],
    "Chest": [
        ("Pectoralis major (clavicular head)", r"clavicular head of pectoralis major", S), ("Pectoralis major (sternocostal head)", r"sternocostal head of pectoralis major", S),
        ("Pectoralis major (abdominal part)", r"abdominal part of pectoralis major", S), ("Serratus anterior", r"serratus anterior", S),
        ("Pectoralis minor", r"pectoralis minor", D_), ("Subclavius", r"subclavius", D_), ("External intercostals", r"external intercostal", D_),
        ("Internal intercostals", r"internal intercostal", D_), ("Innermost intercostals", r"innermost intercostal", D_), ("Transversus thoracis", r"transversus thoracis", D_),
        ("Diaphragm", r"^diaphragm$", D_),
    ],
    "Back": [
        ("Trapezius (3 parts)", r"part of trapezius", S), ("Latissimus dorsi", r"latissimus dorsi", S), ("Rhomboid major", r"rhomboid major", I),
        ("Rhomboid minor", r"rhomboid minor", I), ("Levator scapulae", r"levator scapulae", I), ("Serratus posterior superior / inferior", r"serratus posterior", I),
        ("Iliocostalis", r"iliocostalis", D_), ("Longissimus", r"longissimus", D_), ("Spinalis", r"^spinalis", D_), ("Semispinalis", r"semispinalis", D_),
        ("Multifidus", r"multifidus", D_), ("Rotatores", r"rotator", D_), ("Interspinales", r"interspinales", D_), ("Levatores costarum", r"levatores", D_),
    ],
    "Shoulders": [
        ("Deltoid (clavicular / acromial / spinal)", r"part of deltoid", S), ("Supraspinatus", r"supraspinatus", D_), ("Infraspinatus", r"infraspinatus muscle", I),
        ("Teres minor", r"teres minor", I), ("Subscapularis", r"subscapularis", D_), ("Teres major", r"teres major", I),
    ],
    "Arms & forearms": [
        ("Biceps brachii (long / short head)", r"head of biceps brachii", S), ("Brachialis", r"^brachialis", D_), ("Coracobrachialis", r"coracobrachialis", D_),
        ("Triceps brachii (3 heads)", r"head of triceps brachii", S), ("Anconeus", r"anconeus", S), ("Brachioradialis", r"brachioradialis", S),
        ("Pronator teres", r"pronator teres", S), ("Flexor carpi radialis", r"flexor carpi radialis", S), ("Palmaris longus", r"palmaris longus", S),
        ("Flexor carpi ulnaris", r"flexor carpi ulnaris", S), ("Flexor digitorum superficialis", r"flexor digitorum superficialis", I),
        ("Extensor carpi radialis longus / brevis", r"extensor carpi radialis", S), ("Extensor digitorum", r"^extensor digitorum$|^extensor digitorum muscle", S),
        ("Extensor carpi ulnaris", r"extensor carpi ulnaris", S), ("Flexor digitorum profundus", r"flexor digitorum profundus", D_),
        ("Flexor pollicis longus", r"flexor pollicis longus", D_), ("Pronator quadratus", r"pronator quadratus", D_), ("Supinator", r"^supinator", D_),
        ("Abductor pollicis longus", r"abductor pollicis longus", D_), ("Extensor pollicis longus / brevis", r"extensor pollicis", D_), ("Extensor indicis", r"extensor indicis", D_),
        ("Hand intrinsics (thenar, hypothenar, interossei, lumbricals)", r"pollicis brevis|opponens|digiti minimi|interosse|lumbrical|adductor pollicis", D_),
    ],
    "Abdomen & core": [
        ("Rectus abdominis", r"rectus abdominis", S), ("External oblique", r"external abdominal oblique", S), ("Pyramidalis", r"pyramidalis", S),
        ("Internal oblique", r"internal abdominal oblique", I), ("Transversus abdominis", r"transversus abdominis", D_), ("Quadratus lumborum", r"quadratus lumborum", D_),
    ],
    "Pelvis & glutes": [
        ("Gluteus maximus", r"gluteus maximus", S), ("Gluteus medius", r"gluteus medius", I), ("Gluteus minimus", r"gluteus minimus", D_),
        ("Tensor fasciae latae", r"tensor fasciae latae", S), ("Piriformis", r"piriformis muscle", D_), ("Obturator internus / externus", r"obturator (internus|externus)", D_),
        ("Gemelli", r"gemellus", D_), ("Quadratus femoris", r"quadratus femoris", D_), ("Iliopsoas (psoas major, iliacus)", r"psoas major|iliacus", D_),
        ("Pelvic floor (levator ani, coccygeus)", r"levator ani|coccygeus|puborectalis|iliococcygeus|pubococcygeus", D_),
    ],
    "Quadriceps & hamstrings": [
        ("Rectus femoris", r"rectus femoris", S), ("Vastus lateralis", r"vastus lateralis", S), ("Vastus medialis", r"vastus medialis", S),
        ("Vastus intermedius", r"vastus intermedius", D_), ("Sartorius", r"sartorius", S), ("Biceps femoris (long / short head)", r"head of biceps femoris", S),
        ("Semitendinosus", r"semitendinosus", S), ("Semimembranosus", r"semimembranosus", D_),
    ],
    "Adductors & abductors": [
        ("Adductor longus", r"adductor longus", S), ("Adductor brevis", r"adductor brevis", D_), ("Adductor magnus", r"adductor magnus", D_),
        ("Adductor minimus", r"adductor minimus", D_), ("Gracilis", r"gracilis", S), ("Pectineus", r"pectineus", S),
        ("Abductors: gluteus medius / minimus, TFL (see Pelvis & glutes)", r"gluteus medius|gluteus minimus|tensor fasciae latae", I),
    ],
    "Calves & lower legs": [
        ("Gastrocnemius (medial / lateral head)", r"head of gastrocnemius|gastrocnemius", S), ("Soleus", r"soleus", S), ("Plantaris", r"plantaris muscle", I),
        ("Popliteus", r"popliteus", D_), ("Tibialis posterior", r"tibialis posterior", D_), ("Flexor digitorum longus", r"flexor digitorum longus", D_),
        ("Flexor hallucis longus", r"flexor hallucis longus", D_), ("Tibialis anterior", r"tibialis anterior", S), ("Extensor digitorum longus", r"extensor digitorum longus", S),
        ("Extensor hallucis longus", r"extensor hallucis longus", I), ("Fibularis longus / brevis / tertius", r"fibularis", S),
        ("Foot intrinsics", r"hallucis brevis|digitorum brevis|quadratus plantae|abductor hallucis|abductor digiti minimi of foot|lumbricals of foot|interossei of foot|plantar inteross|dorsal inteross", D_),
    ],
}
BONES = {
    "Head & neck": r"frontal bone|parietal|temporal bone|occipital bone|sphenoid|ethmoid|mandible|maxilla|zygomatic|nasal bone|atlas|axis|vertebra c|hyoid",
    "Chest": r"\brib\b|sternum|manubrium|xiphoid|costal cartilage",
    "Back": r"vertebra t|vertebra l",
    "Shoulders": r"^scapula|^clavicle|^humerus",
    "Arms & forearms": r"^humerus|^radius|^ulna|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid bone|capitate|hamate|metacarpal|phalanx.*of hand",
    "Abdomen & core": r"vertebra l",
    "Pelvis & glutes": r"hip bone|sacrum|coccyx|^femur",
    "Quadriceps & hamstrings": r"^femur|^patella|^tibia",
    "Adductors & abductors": r"hip bone|^femur",
    "Calves & lower legs": r"^tibia|^fibula|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx.*of foot",
}

def chain(o):
    c, p = [], o.parent
    while p:
        if p.name.endswith(".g"): c.append(p.name[:-2])
        p = p.parent
    return list(reversed(c))

def region_of(h, name):
    s = " > ".join(h) + " > " + name
    if re.search(r"Cranial part|Cervical part|Suboccipital|Splenius|capitis|colli\b", s) and not re.search(r"Iliocostalis|Longissimus|Spinalis|Semispinalis (colli|thoracis)|Multifidus|Rotator|Interspinales", s):
        return "Head & neck"
    if re.search(r"Scapulohumeral|Rotator cuff|Deltoid", s): return "Shoulders"
    if re.search(r"upper limb", s): return "Arms & forearms"
    if re.search(r"Thoracic part|Fasciae of thorax", s): return "Chest"
    if re.search(r"Abdominal part|Fasciae of abdomen|Endo-abdominal", s): return "Abdomen & core"
    if re.search(r"Dorsal part|Thoracolumbar", s): return "Back"
    if re.search(r"Pelvic part|gluteal|Iliopsoas", s): return "Pelvis & glutes"
    if re.search(r"Anterior compartment of thigh|Posterior compartment of thigh", s): return "Quadriceps & hamstrings"
    if re.search(r"Medial compartment of thigh", s): return "Adductors & abductors"
    if re.search(r"compartment of leg|Muscles of foot|Tendon sheaths of lower limb", s): return "Calves & lower legs"
    if re.search(r"lower limb", s): return "Calves & lower legs" if re.search(r"leg|foot|calcaneal|tarsal|plantar", name, re.I) else "Quadriceps & hamstrings"
    if re.search(r"Fasciae of head|Cervical fasciae", s): return "Head & neck"
    return None

base = lambda n: re.sub(r"\.([lr]|[oe]\d*[lr]?)$", "", n)
is_conn = lambda n: re.search(r"bursa|fascia|sheath|aponeurosis|retinacul|linea alba|tendon$|tendon\.|septum|ligament", n, re.I)

out = {r: {"muscles": [], "connective": [], "bones": set(), "ligaments": 0} for r in REGIONS}
muscle_objs = {}
for o in D.objects:
    if o.type != "MESH" or not len(o.data.polygons): continue
    coll = next((c.name for c in o.users_collection), "")
    if not coll.startswith("4: Muscular"): continue
    r = region_of(chain(o), o.name)
    if not r: continue
    slots = [s.material.name if s.material else "" for s in o.material_slots]
    tend = sum(1 for p in o.data.polygons if p.material_index < len(slots) and slots[p.material_index] == "Tendon")
    rec = {"name": o.name, "base": base(o.name), "faces": len(o.data.polygons), "tendonFaces": tend}
    (out[r]["connective"] if is_conn(o.name) else out[r]["muscles"]).append(rec)
    if not is_conn(o.name): muscle_objs[o.name] = r
# bones and ligaments
for o in D.objects:
    if o.type != "MESH" or len(o.data.polygons) < 100: continue
    coll = next((c.name for c in o.users_collection), "")
    n = base(o.name).lower()
    if coll.startswith("1: Skeletal"):
        for r, rx in BONES.items():
            if re.search(rx, n): out[r]["bones"].add(base(o.name))
    if coll.startswith("3: Joints"):
        for r, rx in {"Head & neck": r"temporomandibular|atlanto|cervical|nuchal|hyoid|stylo", "Chest": r"costo|sternocostal|stern|intercostal membrane",
                      "Back": r"supraspinous|interspinous|flava|longitudinal ligament|intertransverse|costotransverse", "Shoulders": r"glenohumeral|acromioclavicular|coraco|conoid|trapezoid ligament|glenoid|transverse humeral|sternoclavicular",
                      "Arms & forearms": r"elbow|radio|ulnar collateral|radial collateral|annular|carp|metacarp|interphalangeal joints$|interosseous membrane of forearm|of hand|digits of hand",
                      "Abdomen & core": r"iliolumbar|inguinal", "Pelvis & glutes": r"sacro|hip joint|acetabular|iliofemoral|ischiofemoral|pubofemoral|pubic|obturator membrane",
                      "Quadriceps & hamstrings": r"knee|patellar|cruciate|meniscus|collateral ligament of knee", "Adductors & abductors": r"hip joint|pubofemoral",
                      "Calves & lower legs": r"ankle|talo|calcane|tarsal|tibiofibular|deltoid ligament|plantar|metatars|of foot|interosseous membrane of leg"}.items():
            if re.search(rx, n): out[r]["ligaments"] += 1

# attachment patches
patches = {}
for o in D.objects:
    if o.type != "MESH" or not len(o.data.polygons): continue
    if not any(c.name.startswith("2: Muscular insertions") for c in o.users_collection): continue
    m = re.match(r"^(.*)\.([oe])\d*[lr]?$", o.name)
    if m: patches.setdefault(m.group(1), set()).add(m.group(2))

all_bases = sorted({m["base"] for r in REGIONS for m in out[r]["muscles"]})
all_bases_any = sorted({base(o.name) for o in D.objects if o.type == "MESH" and len(o.data.polygons) and any(c.name.startswith("4: Muscular") for c in o.users_collection)})
report = {}
for r in REGIONS:
    ms = out[r]["muscles"]
    bases = sorted({m["base"] for m in ms})
    names = [b.lower() for b in bases]
    checklist = []
    for label, rx, layer in CHECK[r]:
        hits = [b for b in bases if re.search(rx, b.lower())] or [b for b in all_bases_any if re.search(rx, b.lower())]
        checklist.append({"muscle": label, "layer": layer, "present": bool(hits), "meshes": hits[:6]})
    faces = sum(m["faces"] for m in ms)
    tfaces = sum(m["tendonFaces"] for m in ms)
    report[r] = {
        "muscleMeshes": len(ms),
        "uniqueMuscles": len(bases),
        "checklist": checklist,
        "superficialFound": f'{sum(c["present"] for c in checklist if c["layer"] == S)}/{sum(1 for c in checklist if c["layer"] == S)}',
        "deepFound": f'{sum(c["present"] for c in checklist if c["layer"] != S)}/{sum(1 for c in checklist if c["layer"] != S)}',
        "missing": [c["muscle"] for c in checklist if not c["present"]],
        "triangles": faces,
        "tendonFacePct": round(100 * tfaces / max(1, faces), 1),
        "musclesWithTendonFaces": len({m["base"] for m in ms if m["tendonFaces"]}),
        "connectiveObjects": len(out[r]["connective"]),
        "connectiveExamples": sorted({c["base"] for c in out[r]["connective"]})[:8],
        "bones": sorted(out[r]["bones"]),
        "ligaments": out[r]["ligaments"],
        "withOrigin": sum(1 for b in bases if "o" in patches.get(b, set())),
        "withInsertion": sum(1 for b in bases if "e" in patches.get(b, set())),
        "withBoth": sum(1 for b in bases if patches.get(b) == {"o", "e"}),
        "ta2Named": sum(1 for n in names if n in ta2),
        "withDefinition": sum(1 for b in bases if b in D.texts),
    }
report["_probe"] = {n: [o.name for o in D.objects if n.lower() in o.name.lower() and o.type == "MESH"][:6] for n in ["Semispinalis capitis", "Tensor fasciae", "Levatores", "Bucinator", "Rotatores", "Innermost intercostal", "Popliteus", "Plantaris"]}
report["_texts_only"] = [t for t in ["Semispinalis capitis muscle", "Tensor fasciae latae"] if t in D.texts]
json.dump(report, open(out_path, "w"), indent=1)
print("AUDIT_OK")
