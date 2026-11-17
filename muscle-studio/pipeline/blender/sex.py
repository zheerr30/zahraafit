import bpy, re, json, sys
pat = re.compile(r"uterus|ovar|vagin|female|mammary|breast|clitor|labium|prostat|testis|penis|scrot|male", re.I)
hits = sorted({o.name for o in bpy.data.objects if pat.search(o.name) and o.type == "MESH" and len(o.data.polygons) > 0})
json.dump(hits, open(sys.argv[-1], "w"), indent=0)
