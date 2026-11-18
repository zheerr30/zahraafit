# Back & shoulder — source asset investigation (Blender)

Status: **converted — the /back viewer runs on the original Z-Anatomy geometry** (see §7–§8).
Investigation: 2026-11-17 · Conversion & prototype: 2026-11-18. Blender used: 4.0.2 (Ubuntu 24.04 package), GUI under Xvfb with software OpenGL.

## 1. Sources and what could be obtained

| Source | URL | Access from this environment | What was obtained |
|---|---|---|---|
| Z-Anatomy website | https://www.z-anatomy.com/ | **Blocked** by the network policy (proxy refused the host) | — (its downloads point to the same Blender template / Google Drive) |
| Z-Anatomy GitHub models | https://github.com/Z-Anatomy/Models-of-human-anatomy | Git clone (public repo, commit `5868429d`) | `Z-Anatomy.zip` (86.7 MB, sha256 `e0296885…a736`) → **`Startup.blend`** (306.8 MB, saved by Blender 3.5, sha256 `9f08a17e…afcd`), `TA2.csv` (Terminologia Anatomica 2 table), `License.txt`, `Readme.md` |
| Z-Anatomy (Unity app repo, used in phase 1) | https://github.com/LluisV/Z-Anatomy | Git clone | FBX exports of the same models (`Resources/Models/FBX/*.fbx`) |
| BodyParts3D | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html | Direct download | Only the **99 %-reduced** polygon sets are published (`isa_/partof_BP3D_4.0_obj_99.zip`, 136 MB + 62 MB) and the name/element tables. No higher-resolution set is offered. |

## 2. Male / female availability (checked separately)

| Source | Male | Female |
|---|---|---|
| BodyParts3D 4.0 | Yes — "a three-dimensional whole-body model for an adult human male" (README_e) | **No** |
| Z-Anatomy | Yes — derived from BodyParts3D; contains male genital structures (testis, prostate, penis) | **No** — the repository's own *TO DO List* lists "CREATE A FEMALE HUMAN MODEL" as a mid-term goal (scan, CT, MRI still to be made) |

No openly licensed source with separated female musculature was found. A female back/shoulder model can only be made by adapting
the male anatomy (as done for the full-body female before), and must be labelled as such.

## 3. What the original `Startup.blend` contains

- 7,184 objects: 4,569 meshes, 951 curves, 1,660 text labels; **3,839 text datablocks** = per-structure definitions
  (Wikipedia-derived English text, CC BY-SA 3.0).
- Top collections: `1: Skeletal system`, `2: Muscular insertions` (705 origin/insertion patches), `3: Joints`, `4: Muscular system`,
  `5–8` other systems, `9: Regions of human body`.
- Modifiers: Subdivision Surface ×1,249, Solidify ×1,311 (mostly on insertion patches, fasciae, bursae), Hook ×1,076 (labels).
  **Muscle meshes themselves are triangle meshes without modifiers** — identical face counts to the FBX exports
  (e.g. latissimus dorsi 21,580 triangles per side). That is the original geometry.
- Materials: each muscle has **two material slots — a function material** (Abductor, Adductor, External rotation, Extension,
  Internal rotator, Levator) **and `Tendon`** assigned per face by the author. Bones have `Bone` + `Cartilage` (articular
  surfaces). Shading is procedural (anisotropic BSDF + AO node groups); no image textures exist to carry over.
- No vertex colours, no UV maps on the muscles.

### Region inventory (per side unless noted)

| Requested | Z-Anatomy object | Triangles | Tendon faces (author) | Definition text |
|---|---|---|---|---|
| Trapezius upper | `Ascending part of trapezius muscle` ⚠ | 4,596 | 53 % | yes |
| Trapezius middle | `Transverse part of trapezius muscle` | 2,992 | 70 % | yes |
| Trapezius lower | `Descending part of trapezius muscle` ⚠ | 6,760 | 47 % | yes |
| Latissimus dorsi | `Latissimus dorsi muscle` | 21,580 | 28 % | yes |
| Rhomboid major / minor | `Rhomboid major/minor muscle` | 4,800 / 1,494 | 35 % / 30 % | yes |
| Teres major / minor | `Teres major/minor muscle` | 1,154 / 1,522 | 0 % / 0 % | yes |
| Infraspinatus | `Infraspinatus muscle` | 3,166 | 16.5 % | yes |
| Supraspinatus | `Supraspinatus muscle` | 1,430 | 0 % | yes |
| Subscapularis | `Subscapularis muscle` | 2,954 | 0 % | yes |
| Levator scapulae | `Levator scapulae` | 3,082 | 46 % | yes |
| Erector spinae | 9 meshes: iliocostalis lumborum/thoracis/colli, longissimus thoracis/colli/capitis, spinalis thoracis/colli/capitis | 596 – 10,038 each | 0 % (spinalis capitis 25 %) | yes (each) |
| Deltoid anterior / lateral / posterior | `Clavicular / Acromial / Scapular spinal part of deltoid muscle` | 2,902 / 2,964 / 4,378 | 5 % / 4 % / 25 % | yes |
| Scapula, clavicle, humerus | `Scapula`, `Clavicle`, `Humerus` | 25,325 / 1,550 / 4,280 | — | yes |
| Thoracic vertebrae, ribs | `Vertebra T1…T12`, `First…Twelfth rib` | 1.9 k – 10 k each | — | yes |
| Rotator cuff tendons | not separate meshes — tendon faces inside the muscle meshes (only infraspinatus is segmented) | | | |
| Peripheral nerves | accessory (XI), dorsal scapular, suprascapular, axillary, upper/lower subscapular, thoracodorsal, long thoracic, brachial plexus | 576 – 15 k | — | yes |
| Origins / insertions | 112 patches for these muscles in `2: Muscular insertions`, **parented to the bone they lie on**, names `<muscle>.o…` (origin) / `<muscle>.e…` (insertion) | | | |

All exact names map to **TA2 IDs** in `TA2.csv` (e.g. 2231 Latissimus dorsi, 2226 Trapezius, 2454 Acromial part of deltoid), with
Latin, French, Spanish, Portuguese, Italian and Persian names (no Arabic).

### Origin / insertion verification (against standard anatomy)

| Muscle | Origin patch (bone) | Insertion patch (bone) | Verdict |
|---|---|---|---|
| Supraspinatus, infraspinatus, teres minor, subscapularis | Scapula | Humerus | ✔ correct |
| Deltoid (3 parts) | Clavicle / acromion / spine of scapula | Humerus (shared `Deltoid muscle.e`) | ✔ correct |
| Levator scapulae | C1–C4 | Scapula | ✔ correct |
| Erector spinae | Hip bone (`Erector spinae.o`) | Ribs, T1–L2, C4, occipital (`.e…`) | ✔ correct |
| Trapezius | `Ascending part.e` on **occipital**, `.o` on **clavicle**; `Descending part.o` on scapula | | ⚠ **parts named in reverse**: Z-Anatomy's "Ascending part" mesh is the upper (neck) part — its own definition text says "upper (descending)". Origin/insertion suffixes follow that reversal. Must be remapped by position. |
| Latissimus dorsi | Hip bone (iliac crest) | **Scapula** (inferior angle) | ⚠ the humeral insertion (intertubercular groove) has **no patch**; the `.e` patch sits on the scapula |
| Teres major | Scapula | — | ⚠ humeral insertion **missing** |
| Rhomboid major / minor | — | Scapula | ⚠ origins on spinous processes **missing** |
| Trapezius middle / lower | — | Scapula | ⚠ spinous-process origins **missing** |

Missing patches will **not** be generated; the app will show only the patches that exist and state the rest in text.

## 4. Licenses and attribution requirements

| Asset | License | Commercial use | Obligations |
|---|---|---|---|
| Z-Anatomy models, template, definitions | **CC BY-SA 4.0** (Readme, License.txt) | Allowed | Attribute; **any derivative (our GLB files) must be distributed under CC BY-SA 4.0**. Required credits: "Z-Anatomy — The libre 3D atlas of anatomy — CC-BY-SA 4.0" and "BodyParts3D — The Database Center for Life Science". Authors: Gauthier Kervyn (design, 3D, anatomy), Marcin Zielinski (Blender add-on), Lluis Vinent (app), Kousaku Okubo (BodyParts3D). |
| Definition texts in the .blend | Wikipedia, **CC BY-SA 3.0** | Allowed | Attribute; share-alike for derived text. (We do not plan to ship them; our Arabic cards are our own text.) |
| Other models adapted inside Z-Anatomy | Brainder/White matter (UW), Cranial nerves (Dundee, CC BY 4.0), **Inner ear (Dundee, CC BY-NC-SA 4.0)**, **Kidney (Lissie Cowley, CC BY-NC 4.0)** | **Non-commercial for inner ear and kidney** | Not part of the back/shoulder region — **must not be exported**. |
| BodyParts3D 4.0 | CC BY 4.0 (current README, 2025); Z-Anatomy cites the older CC BY-SA 2.1 JP | Allowed | "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International". |
| TA2.csv | from the Z-Anatomy repo (CC BY-SA 4.0); terms from Terminologia Anatomica 2 | Allowed | Attribute if shipped. |

## 5. Conversion plan (implemented — see §8)

Blender script, run headless on `Startup.blend`:
1. Select the region objects by exact name (muscles, bones, insertion patches, ligaments, nerves).
2. Apply only the author's modifiers that define shape (Solidify + Subdivision on patches, bursae, fasciae); keep muscle meshes as is.
3. Keep **one node per muscle per side**; keep the `Tendon` / `Cartilage` face assignment as a second primitive (or a per-face attribute) — no rule-based tendon guessing.
4. Write metadata into glTF `extras`: Z-Anatomy name, side, TA2 ID, Latin name, system/collection, function material, for patches the role (origin/insertion) and parent bone.
5. Rename the trapezius parts by position (documented), never by generated geometry.
6. Export GLB (Y-up, metres) with meshopt compression; verify the triangle counts equal the source.

## 6. Screenshots (Blender 4.0.2, original file)

`docs/blender-inspection/`:
01 full model (back) · 02 back & shoulder muscles, latissimus selected + its definition · 03 trapezius wireframe (original triangles) ·
04 deep layer · 05 origin (crimson) / insertion (blue) patches on the bones · 06 three deltoid parts (lateral) ·
07 author's tendon faces (ivory) vs muscle faces · 08 BodyParts3D 4.0 OBJ files of the region imported for comparison (no latissimus; 99 % reduced).

## 7. Report on the 8 inspected assets

| # | Asset (screenshot) | Formats available | Each muscle an independent mesh? | Anatomical metadata | Suitable for GLB? | What needed optimizing |
|---|---|---|---|---|---|---|
| 1 | Z-Anatomy full model (01) | `.blend` (Blender 3.5, original), FBX exports (LluisV/Z-Anatomy), `TA2.csv` | Yes — 4,569 meshes, one per structure and side | Names, 3,839 definitions, TA2 IDs (via TA2.csv), collection + group hierarchy, function materials, per-face tendon/cartilage | Yes, through Blender's glTF exporter | Region selection only (1.75 M of ≈ 8 M triangles); labels, curves, hooks and non-commercial models (inner ear, kidney) excluded |
| 2 | Back & shoulder muscles (02) | `.blend` / FBX | Yes — 16 units × 2 sides = 48 meshes (erector spinae 9 per side) | Name, TA2 ID + Latin, hierarchy, function material, definition | Yes — closed (0 open edges), triangulated, smooth-shaded, identity transforms, no modifiers | Nothing geometric; compression only |
| 3 | Trapezius geometry (03) | `.blend` / FBX | Yes — 3 parts per side | as above | Yes | Part names are reversed in the source → mapped by position (asserted) |
| 4 | Deep layer (04) | `.blend` / FBX | Yes | as above | Yes (some meshes have 2–3 disconnected pieces, as authored) | — |
| 5 | Origin / insertion patches (05) | `.blend` only (FBX has the un-thickened patches) | Yes — 112 patches, parented to their bone | Muscle name, `.o`/`.e` role, bone (parent), `Origin-`/`End-` material | Yes after applying the author's Solidify + Subdivision | Modifiers applied at export (patches grow 63 k → 274 k triangles for the region); trapezius & latissimus roles corrected by bone (§3) |
| 6 | Deltoid parts (06) | `.blend` / FBX | Yes — 3 parts per side + deltoid fascia | as above; shared insertion patch | Yes | Shared insertion attached to all three parts |
| 7 | Author's tendon faces (07) | `.blend` only (material per face) | — | Tendon segmentation per face (28–70 % of superficial muscles) | Yes — exported as one glTF primitive per material | Merged into one primitive per structure; tendon kept as vertex data `_ANAT.y` |
| 8 | BodyParts3D 4.0 (08) | OBJ (one file per part, 99 %-reduced only) + name tables | Yes per part, but no latissimus dorsi | FMA/element tables only | Technically yes, but coarse | Not used for this region (Z-Anatomy is denser and complete) |

## 8. What was done (export + web optimisation)

1. `pipeline/blender/selection.mjs` → selection list from `pipeline/zanatomy/back-config.mjs`.
2. `pipeline/blender/export_back.py` (Blender 4.0.2, headless) on the original `Startup.blend`:
   459 structures (48 selectable muscle meshes, 84 context muscles, 119 bones/discs, 112 attachment patches,
   40 ligaments/fasciae/bursae, 56 nerves). Nerves are Z-Anatomy bevelled curves, converted to meshes exactly as
   displayed. Median, ulnar and musculocutaneous nerves were left out (they run into the forearm and hand, which
   are outside the region; nothing is cut). Geometry is world-space, metres, Y-up. Node extras keep: Z-Anatomy name,
   side, system, hierarchy, material slots, TA2 ID, Latin name, definition key. 189 definitions written to
   `definitions.json`.
3. `pipeline/blender/postprocess.mjs`: one primitive per structure (author's Tendon faces → `_ANAT.y`, Cartilage
   faces → `COLOR_0`), baked occlusion and fibre direction (from the authored tendons where they exist, otherwise
   from tissue thickness), attachment owner and role, then quantization (16-bit positions) + meshopt.
   **No simplification, subdivision or re-meshing**: every triangle of the export is kept (asserted per structure).
   Blender's glTF exporter itself dropped one face of *longissimus capitis* per side (1,574 → 1,573).
4. Result: `public/models/back-shoulders/back-shoulders-za.glb` — 1,753,415 triangles, **13.5 MB** (raw export
   36.5 MB); `definitions.json` 0.8 MB (0.17 MB gzipped), loaded only when a description is opened;
   `build-report-za.json` with per-structure tendon source and attachment assignments.

The earlier FBX-based build (Loop-subdivided muscles, rule-based aponeuroses) was removed; the viewer now uses
only the original geometry.
