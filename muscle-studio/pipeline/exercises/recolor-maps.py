"""Recolour the muscle-map overlays to the selection colour without re-rendering.

The overlays (public/exercise-maps/<group>-<view>.webp) are renders of the model with
a muscle group lit in the selection colour. When that colour changes, re-running the
render pass (e2e/render-maps*.cjs + maps.py) gives the exact result; this script gives
the same picture at thumbnail size in seconds: every overlay pixel keeps its shading
(its brightness relative to the lit colour) and takes the new colour's hue and saturation.

  python3 pipeline/exercises/recolor-maps.py public/exercise-maps "#A5111F" "#E8602C"
"""
import sys, glob, os, colorsys
from PIL import Image

folder, old, new = sys.argv[1:4]
rgb = lambda h: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
oh, os_, ov = colorsys.rgb_to_hsv(*rgb(old))
nh, ns, nv = colorsys.rgb_to_hsv(*rgb(new))

n = 0
for path in sorted(glob.glob(f"{folder}/*-*.webp")):
    if os.path.basename(path).startswith("base-"):
        continue
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # shading of the old render, applied to the new colour (highlights stay a little lighter)
            shade = min(1.25, v / ov)
            s2 = min(1.0, ns * (0.55 + 0.45 * min(1.0, s / os_)))
            r2, g2, b2 = colorsys.hsv_to_rgb(nh, s2, min(1.0, nv * shade))
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    im.save(path, quality=84, method=6)
    n += 1
print(n, "overlays recoloured", old, "->", new)
