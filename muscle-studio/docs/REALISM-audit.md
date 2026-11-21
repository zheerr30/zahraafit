# Visual realism: audit and back & shoulder prototype (2026-11-18)

Scope: the atlas viewer (`/back`, `/atlas`) and the shared materials. Nothing here changes the anatomy files
(`public/models/zanatomy/**` are untouched), the muscle list, selection, isolation, highlighting or the editor.

## 1. Audit — what the app had before

### 1.1 Geometry (Z-Anatomy source, exported unchanged)

Measured on the original Blender export with `pipeline/audit/geometry.mjs` (left side, all faces of each mesh):

| Muscle | Triangles | Median edge | 95th pct. edge | Median angle between neighbouring faces |
|---|---:|---:|---:|---:|
| Latissimus dorsi | 21,580 | 4.6 mm | 15.6 mm | 14.3° |
| Trapezius, descending / transverse / ascending | 6,760 / 2,992 / 4,596 | 4.1 / 3.8 / 4.3 mm | 15.2 / 16.5 / 15.0 mm | 17.4 / 18.1 / 17.3° |
| Deltoid, clavicular / acromial / spinal | 2,902 / 2,964 / 4,378 | 4.5 / 4.9 / 4.7 mm | 12.5 / 13.2 / 13.0 mm | 13.9 / 14.0 / 12.9° |
| Infraspinatus | 3,166 | 4.3 mm | 13.3 mm | 12.7° |
| Supraspinatus | 1,430 | 4.1 mm | 14.2 mm | 15.0° |
| Teres minor / major | 1,522 / 1,154 | 4.4 / 4.4 mm | 13.4 / 15.8 mm | 12.4 / 15.6° |
| Subscapularis | 2,954 | 3.3 mm | 12.7 mm | 12.9° |
| Rhomboid major | 4,800 | 2.8 mm | 10.5 mm | 17.3° |
| Gluteus maximus | 3,326 | 6.3 mm | 18.4 mm | 14.9° |
| Rectus femoris | 8,276 | 4.6 mm | 15.2 mm | 14.9° |

- **The export is already the full source resolution.** In `Startup.blend` the muscles carry **no subdivision
  modifiers** (only attachment patches, bursae and some nerves do), **no UV maps** and **no image textures**. Z-Anatomy's
  materials are function colour codes ("Adductor", "External rotation", …) plus "Tendon", "Cartilage" and "Ligament"
  face slots. There is no higher-resolution source to recover.
- At 3–6 mm edges with ~14° between neighbouring faces, silhouettes are visibly polygonal in close-ups, and shading
  interpolated across such large triangles looks soft and "plastic".
- Web compression is not the limit: positions are quantised to 16 bits per mesh (≈ 0.01 mm on a 50 cm muscle) and
  normals to 10 bits (≈ 0.1°).

### 1.2 Materials

| Tissue | Before |
|---|---|
| Muscle | One procedural shader: two sine-stripe scales (1.3 mm, 5 mm) along the baked fibre field; pinkish base `#C2575E`; relief in screen units (strength changed with zoom); straight linear blend into the author's tendon faces; constant roughness; vertex-baked AO only |
| Tendon / aponeurosis | Flat ivory `#E9E2D6`, no structure |
| Ligament, fascia, bursa | Flat colours, fascia/bursa translucent |
| Bone / cartilage | Flat ivory; cartilage faces only a vertex colour (same roughness as bone) |

No image textures were used anywhere, so there are no low-resolution assets to replace. What was missing was
micro-detail per tissue, fibre-aligned specular, a believable muscle–tendon junction and screen-space contact shading.

### 1.3 Rendering

Neutral tone mapping, sRGB output, default MSAA, camera-following key / fill / rim / under lights + hemisphere +
studio environment. **No shadows and no screen-space ambient occlusion** in the atlas (only the per-vertex AO baked
at 3–6 mm vertex spacing). The fibre field had a hidden defect: it flips sign half way between origin and insertion
(it points to the nearest tendon), which produced dotted lines where interpolation crossed the flip.

### 1.4 Blender vs Three.js

| Improvement | Where | Why |
|---|---|---|
| Smoother surfaces in close-ups | **Three.js (load time)** — `lib/three/refine.ts` | Interpolating PN-triangle refinement: original vertices unchanged, no file growth, can be switched off |
| Fibre detail, tissue materials, junctions | **Three.js shaders** — `lib/three/hdMaterials.ts` | Procedural from each muscle's own fibre field: sharp at any zoom, nothing repeats |
| AO, shadows, HDR, tone mapping | **Three.js** — `components/region/HDPipeline.tsx` | Rendering only |
| Baked texture maps (normal/roughness per muscle) | Blender — **not used** | Needs a new UV unwrap of ~930 meshes; maps blur when zooming and add tens of MB; per-pixel procedural detail is sharper and uses each muscle's real fibre direction |
| Blender subdivision modifier | Blender — **not used** | Catmull-Clark / Loop move the original vertices and shrink volumes, i.e. they change the anatomy |
| 68 muscles whose fibre direction falls back to their axis; missing attachment patches | Blender / pipeline — future | Source data, not rendering |

## 2. Back & shoulder prototype (HD)

`/back` now opens in HD; `?hd=0` shows the previous rendering with the same cameras, and the "تفاصيل عالية HD" button
switches live. `/atlas` and `/editor` are unchanged until approval.

- **Surface refinement** (back & shoulder muscles, 74 meshes): 289,910 → 1,159,640 triangles. Every original vertex
  keeps its exact position (tested); new edge vertices sit on the smooth patch defined by the original vertices and
  normals — on average 0.065 mm and at most 0.5 mm (capped) from the straight edge; creases (> 60°) stay straight;
  no cracks (tested: open edges only where the source has them).
- **Muscle**: three nested fibre scales (bundles ≈ 7 mm, fascicles ≈ 2 mm with soft perimysium grooves, fibres
  ≈ 0.4 mm), each fading to its mean before it can alias; per-muscle seed and fascicle size (large muscles coarser);
  cm-scale colour and moisture mottling; physically scaled relief (bundles 0.35 mm, fascicles 0.12 mm, fibres
  0.012 mm); natural red `#B9474E` with deeper crimson grooves and lighter crests; satin sheen, light clearcoat,
  anisotropic specular along the fibres (consistently oriented fibre field); staggered myotendinous junction into
  pearly tendon / aponeurosis (`#DCD2C2`) with fine collagen striation and stronger anisotropy.
- **Other tissues**: bone with porous micro-relief and mottling; cartilage faces glossy and bluish-white; tendons,
  ligaments and fasciae striated along their principal axis with their own roughness / anisotropy / translucency.
- **Rendering**: multisampled half-float HDR target, GTAO ambient occlusion (radius follows viewing distance),
  shadow-casting key light with a frustum fitted to the view every frame, warm fill; ghosted / translucent structures
  neither cast shadows nor occlude in the AO, so isolation reads exactly as before. Deeper muscle layers yield in the
  depth test where surfaces nearly coincide (render order only).
- **Interaction unchanged**: same meshes, ids, picking (BVH rebuilt on the refined geometry), selection colours,
  isolation, layers; `tests/realism.test.ts` + the existing suites and click tests.

Verification: `tests/realism.test.ts` (original vertices identical, ×4 triangles, offsets ≤ 0.5 mm, no new open
edges, HD materials on every structure, highlight colour applied/removed) and the full suite (66/66). Real-click test
`e2e/back-select-each.cjs` on the HD page: hide / show / isolate / skeleton-only / nerves & tendons / reset all pass;
46 of 58 back & shoulder muscles clicked directly in the first pass; the deep ones it missed (multifidus,
semispinalis thoracis, rhomboid major) were then all clicked successfully once the camera was given time to settle —
software rendering in the test machine draws HD at well under 1 frame/s. No page errors.

Comparisons (same camera states): `docs/realism/`.

Known limits of the prototype: surfaces facing away from the key light in extreme close-ups still read a deep
maroon; a few thin bright lines in macro views are where two source meshes interpenetrate (geometry, not shading);
HD costs about 4× the muscle triangles of the region and a GTAO + shadow pass per frame.

## 3. Applying it to the whole body (after approval)

1. Enable HD in `/atlas` (and `/back` already) for both bodies; extend refinement to all regions — the 1.82 M
   muscle triangles of one body would become ~7.3 M, so refinement should run per region on demand (only the regions in view), or
   move to the build pipeline with a second LOD file.
2. Use the same materials and pipeline in the editor (`/editor`) and in high-resolution exports (`lib/three/capture.ts`
   renders tiles without the composer today).
3. Review every region's close-ups (front, back, both sides, deep layers), male and female, and tune the per-muscle
   fascicle scale where needed.

## Whole-body visual redesign (matte atlas style)

Brief: one consistent professional look for the entire muscular system, taken
from the user's references (sculpted écorché renders and printed atlas plates),
with the original Z-Anatomy geometry intact.

**What was wrong with the previous HD look** (measured against the references)

| Aspect | Before | References | Now |
| --- | --- | --- | --- |
| Finish | wet: roughness 0.40, clearcoat 0.40, specular 0.85 → white glints everywhere | matte / satin, broad soft highlights | roughness 0.62, clearcoat 0.05, specular 0.40, satin sheen |
| Muscle colour | muted rose `#A0605F` | warm brick red, salmon highlights | `#B24E41`, grooves deeper red, crests warm salmon, slow orange ↔ crimson drift |
| Tendons / aponeuroses | glossy silver-white `#D3D0CC` | matte cream | `#DDCDA9`, roughness 0.46 |
| Bones | near white | cream / khaki | cream tint, roughness 0.70 |
| Fibres | three scales (7 mm … 0.4 mm), all faded out at body distance → flat from afar | sculpted strands visible on the whole figure | fourth scale added: strand groups ≈ 2 cm, 0.55 mm relief |
| Myotendinous junction | short staggered edge | long interdigitating fingers | bundle- and fascicle-scale fingers |
| Lighting | four camera lights of similar strength | one large key, weak fill, rim | key 5.0 (upper left, soft shadows), fill 0.55, rim 1.5, bounce 0.25 |
| Backdrop | flat black | charcoal studio vignette | radial charcoal gradient (pre-compensated for the tone mapper's toe) |
| Abdomen | oblique aponeuroses drawn as a pale plate over the rectus | rectus segments, cream intersections and linea alba | anterior layer of the rectus sheath opened in front of the rectus (see below) |

**Abdominal wall** (`lib/three/abdomen.ts`). In the source the aponeuroses of the
external oblique, internal oblique and (below the arcuate line) transversus lie in
front of the rectus. They are now classified by the frontal outline of the rectus
and by which side of its mid-plane they lie on: triangles of the anterior layer
wholly in front of the rectus are left out of the index — the atlas convention of
showing the rectus with its sheath opened. No vertex is moved or removed; the
posterior lamina stays as a cream sheet; the aponeurosis fades in at the lateral
border of the rectus (linea semilunaris). The opened layer is absent from colour,
shadow, ambient-occlusion and picking alike, so a click on a rectus segment
selects the rectus. The rectus' baked AO (computed under the sheath) is lifted.

**Geometry.** See the next section (muscle surfaces refined; everything else unchanged).

**Not changed:** selection, isolation, highlighting, labels, layers, camera,
anatomy data. The non-HD mode keeps its previous look.

## Muscle surface refinement (whole body)

Feedback on the redesign: tendons and fasciae are fine; the muscle surfaces looked
irregular, wrinkled, patchy and noisy, with harsh grooves — chest and abdomen most.

Two causes, both addressed for all 466 muscles of both bodies in one pass:

1. **Source mesh.** Z-Anatomy muscles are low resolution (the sternocostal pectoral
   head has 1,653 vertices, ≈ 1 cm edges) with modelled ridges, lumps and ragged
   facets. `pipeline/sculpt/body.mjs` fairs the muscle bellies (Taubin λ|μ, no
   shrinkage) and writes `core-smooth.glb`, which the atlas and the editor now load
   (`?sculpt=0` in the atlas shows the original `core.glb`).
   - never moved: the author's tendon / aponeurosis faces, bone contact (origins,
     insertions), open borders, seams where another structure lies side by side;
   - no vertex moves more than 2 mm, and towards the nearest other structure by at
     most 40 % of the original gap — layers cannot come to cross;
   - same nodes, names, ids, vertex and triangle counts; tendons, ligaments,
     fasciae and bones are not moved (the file is only re-compressed).

   Measured (`core-smooth.json`): max displacement 2.0 mm, mean 0.51 mm (male) /
   0.42 mm (female); tendon vertices 0 mm; bone attachments ≤ 0.02 mm; mean angle
   between neighbouring facets 19.9° → 16.3°. Volume changes are within ± 0.5 % for
   the large muscles; a handful of tiny ones (anal sphincter, intercostals, a thenar
   head) change by 5–16 % of their very small volume.

2. **Shading.** The fibre relief and colour contrast added in the redesign were too
   strong and patchy. Relief is now 0.05–0.1 mm (was up to 0.55 mm), the fibre lines
   are fine and regular, mottling and per-bundle tone patches are nearly removed, the
   baked per-vertex ambient occlusion is smoothed over the surface and used gently,
   and the screen-space AO and key shadow are softer (less harsh separations).

Also (abdominal wall, after close-up review on a phone):

- In the source the internal oblique and transversus cross the outer surface of the
  external oblique at the flank, which rendered as a mottled patch. `body.mjs` moves
  those vertices of the two deep sheets 1.2 mm beneath that surface (≈ 250–1,060
  vertices per sheet, ≤ 5.2 mm; hidden layer only, the superficial muscle untouched).
  A depth-test bias tried first was dropped: it let ribs lying just under the
  internal oblique show through it.
- The opening of the anterior rectus sheath now ends 2–8 mm inside the lateral
  border of the rectus and 4–12 mm short of its ends, so the cut edge of the
  aponeurosis always lies on the muscle. Opened to the border, an oblique view
  looked past the rounded edge of the rectus into the deeper layers, and the slip
  of pectoralis major that arises from the sheath hung over a hole.
- The edge where the aponeurosis fades in is crisp instead of dithered.
