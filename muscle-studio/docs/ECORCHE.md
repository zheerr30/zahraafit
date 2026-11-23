# Écorché Male & Female model in the atlas

The atlas can show the **Écorché Male & Female** model (bought by the owner from Superhive,
commercial licence) instead of the open Z-Anatomy body: sculpted muscles with their own
painted textures and normal maps, and real male and female shapes.

**The original model files are not in this repository and must never be published.** They
stay in a working folder outside it. Only the compressed web build is used by the atlas, and
that build is kept out of git as well (`public/models/ecorche/` is ignored) until the owner
approves the result.

| | |
|---|---|
| Open it | `/atlas?model=ecorche` (the default body is set in `lib/region/profile.ts`) |
| Links from the ZahraaFit app | `?muscle=<id>&sex=female|male&theme=zahraafit` — unchanged ids |

## What the model is

One Blender 5.1 file for both sexes (a shape key turns the male shapes into the female ones):
144 separate, named objects in the muscle layer (one side, mirrored), 12 cartilages, 28 bones,
32 fat pads, superficial veins, the skin with its clothing, the eyes. 2K textures: base
colour, normal and occlusion-roughness maps in UDIM tiles.

## Build

1. `tools/dump.py` (working folder, Blender 5.1 as the `bpy` Python module): opens the file,
   sets the sex, evaluates every object at full resolution (mirror applied, no half-body
   cut-away), splits mirrored objects into left and right, packs the UDIM tiles' UVs into one
   atlas, and writes the geometry — metres, Y up, +Z front, +X the body's left.
2. `pipeline/ecorche/build.mjs <sex>`: builds `core.glb` (muscles, tendons and aponeuroses,
   cartilages, eyes) and one file per layer — `bones`, `fat`, `vessels`, `skin` — each also as
   `*-lite.glb` for phones. Textures become WebP atlases (the phone build: half the size);
   geometry is welded, quantised and meshopt-compressed; the phone build keeps about 40 % of
   the triangles (the surface detail is in the normal maps).

| File | Male | Female |
|---|---:|---:|
| `core.glb` (516 k triangles) | 13.1 MB | 13.1 MB |
| `core-lite.glb` (≈ 220 k) | 5.0 MB | 4.9 MB |
| `bones` / `fat` / `vessels` / `skin` | 5.9 / 0.9 / 0.8 / 1.4 MB | 5.9 / 1.4 / 0.7 / 1.3 MB |
| the same, lite | 1.6 / 0.5 / 0.25 / 0.4 MB | 1.6 / 0.7 / 0.25 / 0.45 MB |

## Removed from the model

- **The genital / perineal block of the muscle layer** (the object `Butt`) is left out.
- **Skin layer:** it is shown with the model's own garments (briefs; briefs and top on the
  female body). The body surface under the cloth — genitals included — is deleted from the
  file, not just covered (`uncoveredIndices` in the build; checked: no body triangle is left in
  the pelvic zone).

## Names and ids (`pipeline/ecorche/names.mjs`)

Every object is linked to the id the atlas already used for that structure, with Arabic and
English names and a study region. 127 muscle ids; tendons, aponeuroses, retinacula and
cartilages are structures of the "tendons" layer.

Where the model has one mesh for a muscle the previous body split into parts, the mesh gets
one id and the part ids resolve to it (`data/exercises/aliases.ts`, generated):
trapezius ← upper / middle / lower; biceps brachii ← long / short head; triceps ← three heads;
masseter, digastric, orbicularis oculi, pronator teres, flexor / extensor carpi ulnaris, flexor
digitorum superficialis, flexor pollicis brevis, adductor pollicis, rhomboid ← minor.

## Deep muscles (`pipeline/ecorche/deep.mjs`, `deep-list.mjs`)

This is an artist's écorché: it has the superficial muscles only. The deep ones — 61 muscles:
internal oblique, transversus abdominis, quadratus lumborum, the intercostals and the
diaphragm, multifidus / rotatores / semispinalis and the small muscles of the spine, serratus
posterior, the deep neck muscles, subscapularis, supinator, the deep hip rotators, the pelvic
floor, adductor brevis, vastus intermedius, popliteus, tibialis posterior, plantaris and the
deep muscles of the sole — are taken from the Z-Anatomy body (CC BY-SA 4.0: the credit line
under the model names it) and fitted into this one, for each sex:

1. **Bones.** Every Z-Anatomy bone is fitted onto the same bone of the Écorché skeleton —
   each rib and each vertebra on its own (the Écorché rib cage and spine are separate pieces,
   matched top to bottom). The fit is two-way closest points, so a bone cannot slide along its
   shaft or shrink; the right side starts from the mirrored fit of the left. Fits are within
   1–5 mm. About 2600 points on the bones become landmarks, each moved onto the Écorché
   bone's own surface; around the long bones of the limbs, more points 2.5 and 5 cm off the
   shaft make the flesh around a bone move with it (without them the warp squeezes it).
2. **Abdominal wall.** No bone under it: landmarks are taken on the outer face of the rectus
   and the external oblique of both bodies, at the same height and angle around the trunk.
3. **Warp.** A thin-plate spline through all landmarks carries the deep muscles over.
4. **Out of the bones.** The Écorché skeleton is heavier (thicker shafts, larger joints): a
   muscle lying on a bone can come out partly inside it. It is moved out through the nearest
   bone surface by a smooth field, so it keeps its thickness.
5. **Tuck.** A vertex left on or outside the surface of the body is moved under the Écorché
   muscles (5–11 mm under the body's outer face, by depth — the faces between two muscles do
   not count), towards the axis of its region (trunk, neck, thigh, leg, forearm, foot), never
   through a bone; the move is a smooth field, the same for both faces of a muscle.
   Transversus is kept under the internal oblique.
6. Normals are rebuilt, fibre directions follow the warp; the muscles are drawn with the
   atlas's own muscle material in the colour of this body (`muscleBase` of the profile).

`deep.glb` (6.1 MB) and `deep-lite.glb` (2.8 MB, phones) load right after the body. In the
app the deep muscles have depth 2 or 3: the depth control peels the layers over them, and a
selected deep muscle is seen through the muscles over it and beside it (they turn into a
faint ghost; what lies deeper stays as its background).

Not brought over: the muscles of the eye, larynx, pharynx and tongue, the lateral pterygoid
(the skull of this model is solid where it lies), the palmar interossei (the hands are posed
differently) and the anal sphincter.

  ECORCHE_WORK=/path/to/work node pipeline/ecorche/deep.mjs male     (then: female)

## In the app

- `lib/region/profile.ts` — files, layers and defaults of each body. Layers of this model:
  muscles and tendons / cartilages (shown), bones, fat, vessels, skin (off; each file is
  downloaded the first time its layer is switched on).
- `lib/three/texturedLook.ts` — the model's own materials are used. The selection accent
  (brand orange) and the neutral state of the other muscles are laid over the texture, so
  fibres and tendons stay visible. Maps use anisotropic filtering.
- A muscle chosen by a link or from the list: the camera turns to the side of the body it is
  on (`face` camera command: the mean direction of the muscle's surface).
- `?sex=` chooses the body.
