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

Comparisons (same camera states): `docs/realism/`.

## 3. Applying it to the whole body (after approval)

1. Enable HD in `/atlas` (and `/back` already) for both bodies; extend refinement to all regions — the 1.82 M
   muscle triangles of one body would become ~7.3 M, so refinement should run per region on demand (only the regions in view), or
   move to the build pipeline with a second LOD file.
2. Use the same materials and pipeline in the editor (`/editor`) and in high-resolution exports (`lib/three/capture.ts`
   renders tiles without the composer today).
3. Review every region's close-ups (front, back, both sides, deep layers), male and female, and tune the per-muscle
   fascicle scale where needed.
