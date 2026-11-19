# Anatomy model data

Meshes used by `anatomy-3d.html`, decimated and packed from BodyParts3D v3.0
(STL conversion: github.com/Kevin-Mattheus-Moerman/BodyParts3D).

"BodyParts3D, (c) The Database Center for Life Science licensed under
CC Attribution-Share Alike 2.1 Japan" — https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

Because of the share-alike licence, these derived files are distributed under the same licence.

Format: `parts.json` lists every part (`name`, selectable group `g`, `layer`, byte offsets).
Each `*.wasm` file is raw binary (not WebAssembly): per part, uint16 xyz positions
quantised to the global box `lo`..`hi` (metres, y up, front +z), then uint16/uint32 triangle indices.
