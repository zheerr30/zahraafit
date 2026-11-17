# MUSCLE STUDIO 3D

An anatomical muscle visualization and illustration studio for fitness coaches, trainers, exercise
educators and anatomy learners. Select muscles on male and female 3D models, highlight primary and
secondary movers, and export high-resolution 2D illustrations (PNG, including transparent PNG).

> **Anatomical assets are not included.** The app never presents a placeholder or generic mannequin
> as anatomy. Until you install licensed GLB models, the editor shows an **Asset setup required**
> state. A clearly labeled, **non-anatomical** *pipeline test rig* is bundled only so you can try
> selection, colors and export before your real assets arrive. Exports made with it are watermarked.

---

## Contents

- [Quick start](#quick-start)
- [Commands](#commands)
- [Architecture](#architecture)
- [Adding male and female GLB models](#adding-male-and-female-glb-models)
- [Mesh naming conventions](#mesh-naming-conventions)
- [Mapping meshes to muscle IDs](#mapping-meshes-to-muscle-ids)
- [Exporting illustrations](#exporting-illustrations)
- [Projects and persistence](#projects-and-persistence)
- [Configuring Supabase (optional)](#configuring-supabase-optional)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Deployment](#deployment)
- [Status: what works and what needs assets](#status-what-works-and-what-needs-assets)

---

## Quick start

Requirements: Node.js ≥ 20.9 and npm.

```bash
cd muscle-studio
npm install          # also copies Draco/KTX2 decoders into public/decoders
npm run dev          # http://localhost:3000
```

Open **Setup → Open editor with test rig** to try the full workflow immediately, or drop your GLB
files into `public/models/…` (see below).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack). Picks up new files in `public/` live. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. **Restart after adding model files** — the production server only serves `public/` files that existed at startup. |
| `npm test` | Unit tests (Vitest): selection, colors, undo/redo, persistence, mesh mapping, search. |
| `npm run typecheck` | Strict TypeScript check. |
| `npm run lint` | ESLint (Next.js + React Compiler rules). |
| `npm run generate:test-rig` | Regenerates the non-anatomical test rig GLB. |

## Architecture

```
app/                      Routes (App Router): dashboard, /editor, /projects, /library, /setup
components/
  anatomy/                React Three Fiber: viewport, model loader/selection, camera rig, lights, error boundary
  editor/                 Editor shell, toolbar, settings panel, asset inspector, viewport overlays
  library/                Muscle selector (search + groups) and library catalog
  export/                 Export studio dialog
  dashboard/              Dashboard sections, project cards, header
  setup/                  Storage / Supabase sign-in panel
  ui/                     Buttons, segmented controls, dialog, toasts, icons
data/
  muscles/muscles.ts      Muscle database (ids, EN/AR names, regions, mesh names, aliases, views)
  models/manifest.ts      Anatomical asset manifest (URLs, views, per-asset mesh maps)
lib/
  anatomy/                Name normalization, mesh→muscle resolver, bilingual search (no Three.js)
  three/                  Model preparation, materials, camera poses, export renderer, disposal
  storage/                Zod schemas, repository interface, localStorage + Supabase repositories
  supabase/               Optional Supabase client
hooks/                    Active asset resolution, save, projects, keyboard shortcuts, local file loading
stores/                   Zustand stores: editor (undoable document), assets, toasts
types/                    Domain types
public/models/            GLB assets (male/, female/, test-rig/)
supabase/migrations/      SQL for the cloud projects table
scripts/                  Decoder copy + test-rig generator
tests/                    Vitest suites
```

Key design decisions:

- **Data is separate from rendering.** `data/` and `lib/anatomy/` contain no Three.js code and are
  fully unit-tested. Rendering lives in `lib/three/` and `components/anatomy/`.
- **Mapping layer, never raw names.** Meshes are resolved to stable muscle IDs through
  normalization + aliases + per-asset/per-user overrides (`lib/anatomy/resolver.ts`). Ambiguous or
  unknown names are reported as *unmapped*, never guessed.
- **Undoable document.** Everything saved in a project (selections, colors, gender, visual settings)
  is one immutable document in the editor store with an undo/redo history; rapid slider/color edits
  are coalesced into single steps.
- **Materials are swapped, never mutated.** Each mesh's original material is preserved and restored;
  highlight colors come from a cached material library, so recoloring one muscle cannot affect
  another. Geometries, materials and textures are disposed when a model is replaced.
- **Client-only WebGL.** The viewport is loaded with `next/dynamic({ ssr: false })`, wrapped in an
  error boundary, with WebGL-support and context-loss handling.

## Adding male and female GLB models

1. Obtain anatomical models with **superficial musculature where each muscle is a separate mesh**
   (left and right separately is ideal). A merged single-mesh body cannot support per-muscle
   highlighting; the app detects this and shows a warning. Check that the license permits your use
   (including publishing exported illustrations).
2. Export as binary glTF (`.glb`) with textures embedded. Draco, Meshopt and KTX2 compression are
   supported and decoded locally (no CDN).
3. Copy the files to:

   | File | Used for |
   | --- | --- |
   | `public/models/male/male-superficial.glb` | Male, all views |
   | `public/models/female/female-superficial.glb` | Female, all views |
   | `public/models/male/male-superficial-posterior.glb` | *Optional* dedicated male back view |
   | `public/models/female/female-superficial-posterior.glb` | *Optional* dedicated female back view |

4. Reload (restart `npm start` in production). The dashboard and **Setup** page show which assets
   were found. To change paths, add views, or rotate a model, edit `data/models/manifest.ts`.

Orientation and scale: models should be Y-up facing +Z (the glTF default). Any scale works — models
are normalized to 1.8 m tall with feet at y = 0. For other orientations set `rotation` (radians) on
the asset entry.

You can also try a model without installing it: **Load GLB…** in the editor loads a file from your
computer via an object URL (it is never uploaded).

## Mesh naming conventions

Name each muscle mesh (or its parent node) with the canonical name plus a side suffix:

```
Pectoralis_Major_L     Pectoralis_Major_R
Latissimus_Dorsi_L     Latissimus_Dorsi_R
Deltoid_Anterior_L     Deltoid_Lateral_L     Deltoid_Posterior_L
Gluteus_Maximus_L      Biceps_Femoris_R      …
```

The full list of canonical names per muscle is on the **Anatomy library** page and in
`data/muscles/muscles.ts` (`meshNames`). The normalizer also accepts:

- `.L` / `.R`, `_Left` / `_Right`, `Left_` / `Right_` prefixes, `l`/`r`/`lt`/`rt`
- CamelCase / PascalCase (`LatissimusDorsi_Left`), kebab-case, spaces
- Blender duplicate suffixes (`Trapezius_L.001`) — including GLTFLoader's sanitized form
  (`Trapezius_L001`); the authored node name from `userData.name` is used when available
- filler words like `Muscle` / `Mesh` (`Brachialis_Muscle_L`)
- unambiguous aliases (`Rear_Delt_L`, `Lats_R`, `VMO_L`, `Calves_L`)

Generic mesh names (`Mesh_12`, `Object_3`) fall back to the parent node's name. Non-muscle meshes
(bones, tendons, skin) are rendered with the *shadow* color and are not selectable; list them in the
asset's `ignoreMeshes` to hide them from the unmapped report.

## Mapping meshes to muscle IDs

Resolution order for each mesh (first match wins):

1. **User overrides** assigned in the editor's *Asset inspector* (stored per asset in this browser)
2. **Asset overrides** — `meshMap` in `data/models/manifest.ts` (exact authored mesh name → muscle id)
3. **Canonical mesh names / ids** from the muscle database (normalized, side detected)
4. **Unambiguous aliases** (an alias shared by two muscles is never used)

Workflow for a new model:

1. Load it (install it, or **Load GLB…**).
2. Open **Asset inspector** in the right panel. It shows mesh count, mapped muscles (e.g. `28/32`),
   unmapped meshes and muscles missing from the asset.
3. Click an unmapped mesh in the viewport to find it in the list, then pick the muscle it represents.
   The change applies instantly.
4. Click **Copy meshMap** and paste the result into the asset's entry in `data/models/manifest.ts`
   so the mapping ships to everyone:

   ```ts
   {
     id: "male-superficial",
     …
     meshMap: {
       "Object_217": "gluteus-medius",
       "m_quad_vl.left": "vastus-lateralis",
     },
   }
   ```

Muscle ids are stable and stored in saved projects — never rename an existing id.

## Exporting illustrations

Click **Export** (or `Ctrl/⌘ + E`). The export studio renders the **3D scene only** — never a
screenshot of the interface — at full resolution:

- **Compositions:** current view, front, back, left, right, **front + back sheet** (two panels), or
  **selected muscles** (camera framed on the highlighted muscles).
- **Resolutions:** portrait 2400×3000, poster 3000×4000, square 2048, HD, 4K, viewport ×2 or custom
  up to 8192 px per side. Large images are rendered in GPU-sized tiles, so they work even on GPUs with
  small drawing-buffer limits.
- **Backgrounds:** black, white, or **transparent PNG** (true alpha channel).
- **Annotations:** callout labels (placed only on muscle surfaces actually visible in that view, found
  by raycasting), a legend of selected muscles, an optional title, in English, Arabic or both.

The export waits for pending material updates and renders synchronously, then restores the
interactive camera and canvas. The dialog shows a live preview before you download.

## Projects and persistence

**Save** (`Ctrl/⌘ + S`) stores the selected muscles, tones and custom colors, palette, gender, camera
position/target, background, lighting, model transform, label settings and a thumbnail.
Projects can be reopened, renamed, duplicated and deleted from the dashboard or **Illustrations**.

- Without Supabase, projects are stored in the browser's `localStorage`, validated with Zod on read
  (corrupt records are skipped, not fatal). Quota errors are reported clearly.
- Persistence goes through the `ProjectRepository` interface (`lib/storage/repository.ts`), so local
  and cloud storage are interchangeable.

## Configuring Supabase (optional)

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_projects.sql` (SQL editor or `supabase db push`). It creates the
   `projects` table with Row Level Security so users can only access their own rows.
3. Enable **Email** auth (magic link) and add your site URL to the redirect allow-list.
4. Create `.env.local` from `.env.example`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Restart the app and sign in on the **Setup** page. While signed in, projects are saved to the
   cloud; signed out, they stay in the browser.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z`, `Ctrl + Y` | Redo |
| `Ctrl/⌘ + S` | Save |
| `Ctrl/⌘ + E` | Export |
| `R` / `Home` | Reset camera |
| `1` `2` `3` `4` | Front / Back / Left / Right |
| `F` | Frame selected muscles |
| `X` | Swap paint tone (primary ↔ secondary) |
| `/` | Search muscles |
| `?` | Shortcut help |

Viewport: drag to orbit, scroll/pinch to zoom, right-drag/two-finger drag to pan. Click a muscle to
highlight it with the active paint tone; click again to remove it.

## Deployment

The app lives in the `muscle-studio/` subfolder so the repository's existing static site is not
affected. On Vercel, create a separate project with **Root Directory = `muscle-studio`** (framework
preset: Next.js). Commit your licensed GLB files under `public/models/…` (or host them on a CDN and
point the manifest URLs there).

## Status: what works and what needs assets

Works now (verified in a headless browser against the production build, plus 48 unit tests):

- Dashboard, illustrations manager, anatomy library (EN/AR), setup page; responsive down to phones
- 3D viewport: GLB loading with progress and errors, studio lighting, contact shadows, orbit/zoom/pan,
  front/back/left/right views with smooth transitions, reset, frame selection
- Click-to-select on separate meshes, multi-select, group select, bilingual search, primary/secondary
  tones, per-muscle colors, reset, undo/redo, hover cross-highlighting between list and model
- Male/female switching with per-gender asset resolution and optional posterior assets
- PNG export (high-res, tiled, transparent), front+back sheets, callouts and legend
- Project save / reopen / rename / duplicate / delete (local); Supabase repository + migration
- Single-mesh asset detection, unmapped-mesh inspector and mapping export

Requires your anatomical assets:

- **Anatomically accurate rendering** of male and female musculature. Nothing anatomical is bundled;
  the test rig is geometric and labeled as such.
- Per-model mapping review (via the Asset inspector) once real meshes are installed.
- Supabase cloud storage was implemented against the documented API but needs your project
  credentials to be exercised end-to-end.
