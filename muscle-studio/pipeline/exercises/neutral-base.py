"""Bring the body of the exercise muscle maps to the neutral tones the model shows while
muscles are highlighted (lib/three/palette.ts: neutralTone), without re-rendering.

The base pictures (public/exercise-maps/base-<view>.webp) were rendered with the muscles in
their own colour. On the model, every muscle that is not highlighted is now shown in a warm
neutral tone, so the highlighted ones stand out; this gives the thumbnails the same look:
muscle-coloured pixels lose most of their colour and turn slightly lighter; tendons, bones
and the backdrop are left as they are. Running it twice changes nothing more.

  python3 pipeline/exercises/neutral-base.py public/exercise-maps
"""
import sys, glob, colorsys
from PIL import Image

folder = sys.argv[1]
NEUTRAL_HUE = 0.07
n = 0
for path in sorted(glob.glob(f"{folder}/base-*.webp")):
    im = Image.open(path).convert("RGB")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < 0.3 or not (h < 0.06 or h > 0.94):
                continue  # not muscle: tendon, bone, backdrop — or already neutral
            r2, g2, b2 = colorsys.hsv_to_rgb(NEUTRAL_HUE, s * 0.3, min(1.0, v * 0.94 + 0.08))
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255))
    im.save(path, quality=86, method=6)
    n += 1
print(n, "base pictures set to neutral tones")
