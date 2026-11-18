# Full-body anatomy audit (2026-11-18)

Scope: every anatomical region, every view, both bodies, both viewers. **No visual or geometry changes were made for
this audit.** Evidence: `docs/audit/*.jpg` (renders of the original Blender file and of the app), `docs/audit/zanatomy-fullbody.json`
(machine audit of the original file, `pipeline/blender/audit_fullbody.py`), `pipeline/audit/audit-models.mjs` (audit of the app's GLB files).

## 1. Root cause of the inconsistent look

The app currently renders **two different anatomical models with two different pipelines**:

| | `/back` | `/editor` (male and female) |
|---|---|---|
| Source | Z-Anatomy original Blender file, geometry unchanged | BodyParts3D 99 %-reduced OBJ muscles **+** open-anatomy-3d body (bones, skull, organs) |
| Body coverage | head to pelvis, arms to the elbow | full body |
| Muscle geometry | original triangles | selectable muscles simplified to 30 % (≤ 0.15 mm mean error); **non-selectable muscles simplified to 8 % with a topology-agnostic simplifier** |
| Tendons | author's per-face tendon map where it exists, else thickness estimate | thickness estimate + hand-written rules (linea alba, rectus sheath) |
| Bones | Z-Anatomy bones (dense), with articular cartilage | open-anatomy-3d bones (coarse; the skull is visibly faceted) |
| Muscle colour | `#C2575E`, Z-Anatomy-specific tone variation | `#C2575E`, different variation; deeper-looking crimson because of different normals/AO density |
| Lighting | lights attached to the camera | fixed studio lights (back/side views darker) |
| Female | not available | male anatomy warped to a female skeleton |

So the "latest visual improvements" are **not** applied consistently: they exist only in `/back`, for the regions that page contains.

## 2. Verified defects (from the renders)

| Where | Defect | Cause |
|---|---|---|
| `/editor` forearms, hands, feet, neck (context muscles) | torn / stringy geometry, holes | 8 % *sloppy* simplification of non-selectable muscles — **this damages anatomy and must be removed** |
| `/editor` head | low-poly faceted skull; no head or face muscles | open-anatomy-3d skull; BodyParts3D has no head muscles |
| `/editor` abdomen | pale grey "sheath" over the whole rectus area | my rectus-sheath rule (BodyParts3D has no rectus abdominis) |
| `/editor` back/lateral views | darker, flatter than the front | fixed lights |
| `/back` abdomen (close-up) | chaotic fibre streaks on the external oblique, white blotches on rectus abdominis | fibre direction estimated from thickness where the author painted no tendon; author tendon faces on the rectus (tendinous intersections) rendered with a hard edge |
| `/back` head | skull only, head muscles not exported | region selection |
| `/back` | no forearm, thigh or leg at all | region selection |

## 3. Original Z-Anatomy file: per-region asset audit (male; there is no female)

Original Blender file for **all** regions: `Startup.blend` (Z-Anatomy, CC BY-SA 4.0) — one file, all systems.
Counts are meshes in the muscular system (left + right). "Checklist" = textbook muscles of the region found as meshes.

| Region | Muscle meshes (unique) | Superficial / deep checklist | Bones | Ligaments / capsules | Fasciae, sheaths, bursae | Muscles with author tendon faces | Origin / insertion patches (muscles with O / E / both) | TA2 name / definition | Source triangles |
|---|---|---|---|---|---|---|---|---|---|
| 1 Head & neck | 153 (77) | 10/10 · 7/8 | 23 | 7 | 8 | 19 | 33 / 17 / 14 | 77 / 75 | 323 k |
| 2 Chest | 25 (13) | 4/4 · 7/7 | 25 | 4 | 4 | 4 | 6 / 4 / 2 | 13 / 13 | 337 k |
| 3 Back | 58 (29) | 2/2 · 12/12 | 17 | 3 | 6 | 10 | 5 / 10 / 3 | 29 / 28 | 249 k |
| 4 Shoulders | 16 (8) | 1/1 · 5/5 | 3 | 4 | 2 | 4 | 8 / 4 / 4 | 8 / 8 | 41 k |
| 5 Arms & forearms (+hand) | 86 (43) | 11/11 · 11/11 | 30 | 12 | 48 | 41 | 23 / 16 / 13 | 43 / 41 | 205 k |
| 6 Abdomen & core | 12 (6) | 3/3 · 3/3 | 5 | 0 | 9 | 1 | 4 / 1 / 1 | 6 / 6 | 235 k |
| 7 Pelvis & glutes | 34 (17) | 2/2 · 8/8 | 4 | 5 | 4 | 8 | 9 / 4 / 4 | 17 / 17 | 179 k |
| 8 Quadriceps & hamstrings | 20 (10) | 6/6 · 2/2 | 3 | 6 | 80 | 9 | 8 / 4 / 3 | 10 / 9 | 113 k |
| 9 Adductors & abductors | 14 (7) (+ glutei medius/minimus, TFL in 7) | 3/3 · 4/4 | 2 | 2 | — | 4 | 5 / 4 / 4 | 7 / 7 | 46 k |
| 10 Calves & lower legs (+foot) | 60 (30) | 5/5 · 7/7 | 28 | 12 | 30 | 19 | 22 / 18 / 14 | 30 / 29 | 169 k |

Missing in the source: **semispinalis capitis** (definition text exists, no mesh). Everything else on the checklist exists.
Origin/insertion metadata is **partial everywhere** — only about half of the muscles have both an origin and an insertion patch.
All muscle names are TA2 names; Latin and 5 other languages come from TA2.csv (no Arabic: the app's Arabic lexicon is needed).

## 4. App status per region (what is actually rendered today)

| Region | `/back` (Z-Anatomy benchmark) | `/editor` male / female (BodyParts3D) |
|---|---|---|
| 1 Head & neck | neck muscles ✔; head: skull only (head muscles not exported) | no head muscles (not in source); faceted skull; neck context muscles damaged by simplification |
| 2 Chest | ✔ benchmark quality | selectable pectoral units ✔; deep chest context simplified |
| 3 Back | ✔ benchmark quality | ✔ but coarser; no latissimus dorsi (not in BodyParts3D) |
| 4 Shoulders | ✔ benchmark quality | ✔ coarser |
| 5 Arms & forearms | arm ✔ (to elbow); **forearm/hand: not included** | biceps/triceps ✔; forearm/hand context **damaged** |
| 6 Abdomen & core | present; **fibre artefacts** (see §2) | no rectus abdominis / internal oblique (not in source); pale sheath rule |
| 7 Pelvis & glutes | gluteus medius/maximus partly (region edge) | ✔ glutes; deep hip context simplified |
| 8 Quadriceps & hamstrings | **not included** | ✔ selectable, BodyParts3D quality |
| 9 Adductors & abductors | **not included** | ✔ selectable, BodyParts3D quality |
| 10 Calves & lower legs | **not included** | ✔ calf units; foot/deep leg context damaged |
| Female | **not available** (no source) | warped male anatomy (approximation) |

**Conclusion:** no region of the app is at the benchmark standard in *both* viewers, and regions 8–10 plus the
forearm, hand and head muscles have never been built from the Z-Anatomy source. The whole body is **not** updated.

## 5. What reaching the benchmark everywhere requires (not started)

1. One model and one pipeline for the whole body: export **all ten regions** from the Z-Anatomy file with
   `pipeline/blender/export_back.py` (generalised), geometry unchanged — replaces BodyParts3D + open-anatomy-3d in
   `/editor` and removes the damaging simplification. Estimated ≈ 4.5 M triangles for muscles + bones → needs
   per-region loading (one GLB per region) to stay usable on the web.
2. One material standard (one shader, one palette, one tendon rule, camera-attached lighting) applied to every
   region; fibre direction from the author's tendon faces, with a reviewed fallback for muscles without them.
3. Arabic names and cards for the remaining ≈ 200 muscles (today 16 cards in `/back`, 51 units in `/editor`).
4. Female: the only option remains adapting the male anatomy (no open female musculature exists); must stay labelled.
