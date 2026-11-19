# ZahraaFit anatomy model

Original 3D anatomy used by `anatomy-3d.html`. Every muscle, bone and organ here is
procedurally sculpted by `tools/anatomy/` (no third-party scan data):
muscles are swept fibre bundles between anatomical origin and insertion landmarks,
bones and organs are blended implicit shapes, all meshed with marching cubes.

Rebuild: `cd tools/anatomy && python3 build.py` (needs numpy, scipy, scikit-image, trimesh, fast-simplification).

Format: `parts.json` lists every part (`name`, selectable group `g`, `layer`, byte offsets).
Each `*.wasm` file is raw binary (not WebAssembly — the extension is only so artifact hosting serves it):
per part, uint16 xyz positions quantised to the box `lo`..`hi` (metres, y up, front +z),
then uint16/uint32 triangle indices.
