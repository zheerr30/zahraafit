/**
 * The look of the muscles on the model (HD standard): calm natural tones that differ
 * from muscle to muscle, the orange accent on the selected muscle with every other
 * muscle in a neutral tone, and a quiet face.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MeshoptDecoder } from "meshoptimizer";
import { Color, SRGBColorSpace, type Group, type MeshPhysicalMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SELECTION_ACCENT, SELECTION_ACCENT_SOFT } from "@/lib/highlight";
import { applyStyle, prepareRegionModel, type RegionMesh, type RegionModel } from "@/lib/region/backModel";
import { MUSCLE_BASE, muscleTones, neutralTone } from "@/lib/three/palette";
import { backStore } from "@/stores/backStore";

const PUBLIC = join(__dirname, "../public");
let model: RegionModel;
let units: RegionMesh[];

const hsl = (hex: string) => {
  const o = { h: 0, s: 0, l: 0 };
  new Color(hex).getHSL(o, SRGBColorSpace);
  return o;
};
// distance of two colours as seen (sRGB, 0…~1.7)
const apart = (a: string, b: string) => {
  const x = new Color(a).convertLinearToSRGB(), y = new Color(b).convertLinearToSRGB();
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
};
const shown = (m: RegionMesh) => `#${(m.mesh.material as MeshPhysicalMaterial).color.getHexString()}`;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(PUBLIC, "models/zanatomy/male/core-lite.glb"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  model = prepareRegionModel(gltf.scene, { hd: true });
  units = model.meshes.filter((m) => m.kind === "unit");
}, 240_000);

describe("muscle colours", () => {
  it("the base is a calm tissue tone, not a saturated red", () => {
    const b = hsl(MUSCLE_BASE);
    expect(b.h < 0.06 || b.h > 0.97).toBe(true); // a warm red-brown hue
    expect(b.s).toBeLessThan(0.45);
    expect(b.l).toBeGreaterThan(0.4);
    expect(b.l).toBeLessThan(0.6);
  });

  it("every muscle has its own tone: not one uniform colour, and never a loud one", () => {
    const body = units.filter((m) => !m.meta.hierarchy.includes("Muscles of head"));
    const tones = new Set(body.map((m) => m.baseHex));
    expect(tones.size).toBeGreaterThan(150);
    const ls = body.map((m) => hsl(m.baseHex).l), ss = body.map((m) => hsl(m.baseHex).s);
    expect(Math.max(...ls) - Math.min(...ls)).toBeGreaterThan(0.07); // visible differences between neighbours
    expect(Math.max(...ls) - Math.min(...ls)).toBeLessThan(0.2); // …but one family of tones
    expect(Math.max(...ss)).toBeLessThan(0.5);
    // the two sides of a muscle match
    const tonesOf = (id: string, side: string) => [...new Set(body.filter((x) => x.id === id && x.side === side).map((x) => x.baseHex))].sort();
    for (const id of new Set(body.map((m) => m.id))) {
      const r = tonesOf(id, "r");
      if (r.length) expect(r, id).toEqual(tonesOf(id, "l"));
    }
  });

  it("is deterministic, and deeper layers are a little darker", () => {
    expect(muscleTones("gluteus-maximus-muscle")).toEqual(muscleTones("gluteus-maximus-muscle"));
    expect(hsl(muscleTones("x", { depth: 3 }).base).l).toBeLessThan(hsl(muscleTones("x", { depth: 1 }).base).l);
  });

  it("the face is quiet: its muscles are far less coloured than the body's", () => {
    const face = units.filter((m) => m.meta.hierarchy.includes("Muscles of head"));
    expect(face.length).toBeGreaterThan(40);
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const body = units.filter((m) => !m.meta.hierarchy.includes("Muscles of head"));
    expect(mean(face.map((m) => hsl(m.baseHex).s))).toBeLessThan(mean(body.map((m) => hsl(m.baseHex).s)) * 0.72);
    for (const m of face) expect(((m.mesh.material as MeshPhysicalMaterial).userData.msUniforms as { uDetail: { value: number } }).uDetail.value, m.id).toBeLessThan(0.5);
    // teeth and nose cartilages are no longer the brightest things on the model
    const teeth = model.meshes.filter((m) => m.kind === "bone" && m.meta.hierarchy.some((h) => h === "Teeth" || h === "Nasal cartilages"));
    expect(teeth.length).toBeGreaterThan(20);
    for (const m of teeth) expect(hsl(m.baseHex).l, m.id).toBeLessThan(0.75);
  });
});

describe("selection", () => {
  it("the accent is the orange of the ZahraaFit identity, in the store as well", () => {
    expect(SELECTION_ACCENT).toBe("#E8602C");
    expect(backStore.getState().highlightColor).toBe(SELECTION_ACCENT);
  });

  it("selected muscle: the accent; every other muscle: its neutral tone; deselect: everything as before", () => {
    const before = new Map(units.map((m) => [m, shown(m)]));
    for (const m of units) expect(before.get(m), m.id).toBe(m.baseHex);
    const sel = { kind: "unit" as const, id: "rectus-femoris-muscle", side: "l" as const, ar: "", en: "" };
    for (const m of model.meshes) applyStyle(m, sel, null, SELECTION_ACCENT);
    let nearest = Infinity;
    for (const m of units) {
      if (m.id === sel.id) {
        expect(shown(m)).toBe(SELECTION_ACCENT.toLowerCase());
        continue;
      }
      expect(shown(m), m.id).toBe(m.neutralHex);
      expect(hsl(m.neutralHex!).s, m.id).toBeLessThan(0.22); // neutral: hardly any colour left
      nearest = Math.min(nearest, apart(m.neutralHex!, SELECTION_ACCENT));
    }
    expect(nearest).toBeGreaterThan(0.45); // the accent stands clear of every neutral tone
    // tendons, bones and the rest keep their own (already neutral) colours
    for (const m of model.meshes) if (m.kind !== "unit") expect(shown(m), m.id).toBe(m.baseHex);
    for (const m of model.meshes) applyStyle(m, null, null, SELECTION_ACCENT);
    for (const m of units) expect(shown(m), `${m.id} restored`).toBe(before.get(m));
  });

  it("an exercise: prime movers in the accent, helpers lighter, the rest neutral", () => {
    const sets = { primary: new Set(["rectus-femoris-muscle"]), secondary: new Set(["adductor-magnus"]) };
    for (const m of model.meshes) applyStyle(m, null, null, SELECTION_ACCENT, sets);
    for (const m of units) {
      const want = sets.primary.has(m.id) ? SELECTION_ACCENT.toLowerCase() : sets.secondary.has(m.id) ? SELECTION_ACCENT_SOFT.toLowerCase() : m.neutralHex;
      expect(shown(m), m.id).toBe(want);
    }
    for (const m of model.meshes) applyStyle(m, null, null, SELECTION_ACCENT, null);
    for (const m of units) expect(shown(m), m.id).toBe(m.baseHex);
  });

  it("selecting a bone leaves the muscles in their own colours", () => {
    const bone = model.meshes.find((m) => m.kind === "bone")!;
    const sel = { kind: "bone" as const, id: bone.id, side: bone.side, ar: "", en: "" };
    for (const m of model.meshes) applyStyle(m, sel, null, SELECTION_ACCENT);
    for (const m of units) expect(shown(m), m.id).toBe(m.baseHex);
    for (const m of model.meshes) applyStyle(m, null, null, SELECTION_ACCENT);
  });

  it("a neutral tone keeps the muscle's lightness family (shape and fibres stay readable)", () => {
    const n = hsl(neutralTone(MUSCLE_BASE)), b = hsl(MUSCLE_BASE);
    expect(n.s).toBeLessThan(b.s * 0.4);
    expect(Math.abs(n.l - b.l)).toBeLessThan(0.16);
  });
});
