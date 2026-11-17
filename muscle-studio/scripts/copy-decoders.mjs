// Copies Draco + Basis (KTX2) decoders from the installed three.js package into
// public/decoders so compressed GLBs load without any external CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const libs = join(root, "node_modules/three/examples/jsm/libs");
const out = join(root, "public/decoders");

for (const name of ["draco", "basis"]) {
  const src = join(libs, name);
  if (!existsSync(src)) {
    console.warn(`[copy-decoders] ${src} not found, skipping`);
    continue;
  }
  mkdirSync(out, { recursive: true });
  cpSync(src, join(out, name), { recursive: true });
}
console.log("[copy-decoders] decoders copied to public/decoders");
