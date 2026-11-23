/**
 * The Écorché model in the atlas: its parts are linked to the ids the atlas already uses,
 * so links (`?muscle=`), exercise groups and explanations keep working. The model files
 * themselves are not in the repository (licence): the checks that need them run only where
 * the web build is present (public/models/ecorche).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { UNIT_ALIAS, resolveUnit, withParts } from "@/data/exercises/aliases";
import { MUSCLE_GROUPS, groupsOfUnit } from "@/data/exercises/groups";
import { EXERCISES } from "@/data/exercises/exercises";
import { countForUnit, spotlightOf } from "@/lib/exercises";
import { explainMuscle } from "@/lib/exercises/describe";
import { PROFILES } from "@/lib/region/profile";
import { BONES, CARTILAGES, FAT, MUSCLES, OTHER, REMOVED } from "../pipeline/ecorche/names.mjs";
import { DEEP } from "../pipeline/ecorche/deep-list.mjs";

type Rec = { id: string; kind: string; region: string; ar: string; en: string; aliases: string[] };
const muscles = Object.values(MUSCLES as Record<string, Rec>);
const units = new Set(muscles.filter((m) => m.kind === "unit").map((m) => m.id));
const has = (id: string) => units.has(id);

// The muscles the ZahraaFit program links to (ATLAS_MUSCLE in the program's page).
const ZAHRAAFIT_LINKS = [
  "sternocostal-head-of-pectoralis-major-muscle", "latissimus-dorsi", "trapezius-middle", "deltoid-anterior", "deltoid-lateral", "deltoid-posterior",
  "long-head-of-biceps-brachii", "long-head-of-triceps-brachii", "rectus-abdominis-muscle", "external-abdominal-oblique-muscle",
  "rectus-femoris-muscle", "adductor-longus", "long-head-of-biceps-femoris", "gluteus-maximus-muscle", "medial-head-of-gastrocnemius",
];

describe("Écorché model: names and ids", () => {
  it("has 144 objects in the muscle layer, each with an id, a region and Arabic and English names", () => {
    expect(Object.keys(MUSCLES).length + REMOVED.size).toBe(144);
    for (const m of [...muscles, ...Object.values(CARTILAGES as Record<string, Rec>), ...Object.values(BONES as Record<string, Rec>), ...Object.values(FAT as Record<string, Rec>), ...Object.values(OTHER as Record<string, Rec>)]) {
      expect(m.id.length, JSON.stringify(m)).toBeGreaterThan(2);
      expect(m.ar.length, m.id).toBeGreaterThan(2);
      expect(m.en.length, m.id).toBeGreaterThan(2);
      expect(new RegExp("[" + "\\u064B-\\u0652\\u0670" + "]").test(m.ar), `${m.id}: no diacritics`).toBe(false);
    }
    expect(units.size).toBeGreaterThan(115);
  });

  it("every link the ZahraaFit program sends opens a muscle of the model", () => {
    for (const id of ZAHRAAFIT_LINKS) expect(resolveUnit(id, has), id).not.toBeNull();
    expect(resolveUnit("trapezius-middle", has)).toBe("trapezius");
    expect(resolveUnit("long-head-of-biceps-brachii", has)).toBe("biceps-brachii");
    expect(resolveUnit("long-head-of-triceps-brachii", has)).toBe("triceps-brachii");
    expect(resolveUnit("rectus-femoris-muscle", has)).toBe("rectus-femoris-muscle");
    expect(resolveUnit("no-such-muscle", has)).toBeNull();
  });

  it("a muscle that is one mesh here and several parts before keeps the parts' exercises and explanation", () => {
    for (const [part, whole] of Object.entries(UNIT_ALIAS)) {
      expect(units.has(whole), `${part} → ${whole}`).toBe(true);
      expect(withParts(whole)).toContain(part);
    }
    for (const id of ["trapezius", "biceps-brachii", "triceps-brachii"]) {
      expect(groupsOfUnit(id).length, id).toBeGreaterThan(0);
      const n = countForUnit(id);
      expect(n.strength + n.stretch, id).toBeGreaterThan(3);
      expect(explainMuscle(id, "back").about.length, id).toBeGreaterThan(20);
    }
    // an exercise lights the whole muscle through its parts
    const curl = EXERCISES.find((e) => e.primary.includes("biceps"))!;
    expect(spotlightOf(curl).primary).toContain("biceps-brachii");
  });

  it("most exercise groups have at least one muscle in the model", () => {
    const covered = MUSCLE_GROUPS.filter((g) => g.units.some((u) => resolveUnit(u, has)));
    expect(covered.length).toBeGreaterThan(MUSCLE_GROUPS.length * 0.75);
    // the groups people train are all there
    for (const id of ["chest", "lats", "delt-front", "delt-side", "delt-rear", "biceps", "triceps", "abs", "obliques", "glute-max", "quads", "hamstrings", "adductors", "calves"]) {
      const g = MUSCLE_GROUPS.find((x) => x.id === id)!;
      expect(g.units.some((u) => resolveUnit(u, has)), id).toBe(true);
    }
  });

  it("the layers: muscles and tendons open; bones, fat, vessels and skin are switched on from the list", () => {
    const p = PROFILES.ecorche;
    expect(p.layers).toEqual(["muscles", "tendons", "bones", "fat", "vessels", "skin"]);
    expect(p.defaults.muscles && p.defaults.tendons).toBe(true);
    for (const l of ["bones", "fat", "vessels", "skin"] as const) {
      expect(p.defaults[l], l).toBe(false);
      expect(p.lazy[l], l).toBeTruthy(); // loaded only when shown
    }
  });
});

describe("Écorché model: deep muscles brought over from Z-Anatomy", () => {
  const deep = (DEEP as { id: string; depth: number; kind?: string; below?: string[] }[]);
  const deepUnits = deep.filter((d) => !d.kind);

  it("only muscles the model does not have, each once, under the superficial ones", () => {
    expect(new Set(deep.map((d) => d.id)).size).toBe(deep.length);
    for (const d of deepUnits) {
      expect(units.has(d.id), `${d.id}: already in the model`).toBe(false);
      expect(UNIT_ALIAS[d.id], `${d.id}: already a part of a muscle of the model`).toBeUndefined();
      expect([2, 3], d.id).toContain(d.depth);
    }
    expect(deepUnits.length).toBeGreaterThan(45);
    // a muscle placed under another comes after it in the list
    deep.forEach((d, i) => { for (const b of d.below ?? []) expect(deep.findIndex((x) => x.id === b), `${d.id} under ${b}`).toBeLessThan(i); });
  });

  it("the deep muscles people ask about are there, with an explanation", () => {
    for (const id of ["transversus-abdominis-muscle", "internal-abdominal-oblique-muscle", "quadratus-lumborum-muscle", "multifidus-lumborum-muscle", "subscapularis",
      "piriformis-muscle", "vastus-intermedius-muscle", "adductor-brevis", "tibialis-posterior-muscle", "diaphragm", "pubococcygeus-muscle"]) {
      expect(deepUnits.some((d) => d.id === id), id).toBe(true);
      expect(explainMuscle(id, "abdomen").about.length, id).toBeGreaterThan(20);
    }
    expect(PROFILES.ecorche.also).toEqual(["deep"]);
    expect(PROFILES.ecorche.depth).toBe(true);
    expect(PROFILES.ecorche.credit).toContain("Z-Anatomy");
    expect(PROFILES.ecorche.credit).toContain("CC BY-SA 4.0");
  });
});

const BUILD = join(__dirname, "../public/models/ecorche");
describe.skipIf(!existsSync(join(BUILD, "male/core.glb")))("Écorché model: the web build (local only)", () => {
  // the scene structure of a built file: one record per mesh node (name + the atlas metadata)
  const load = async (rel: string) => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const doc = await io.readBinary(new Uint8Array(readFileSync(join(BUILD, rel))));
    return doc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => ({ name: n.getName(), userData: n.getExtras() as Record<string, unknown>, textures: n.getMesh()!.listPrimitives()[0].getMaterial()?.getBaseColorTexture() ? 1 : 0 }));
  };

  it("every muscle is a separate named mesh, both sides, in both bodies and both builds", async () => {
    for (const sex of ["male", "female"]) {
      const full = await load(`${sex}/core.glb`), lite = await load(`${sex}/core-lite.glb`);
      expect(lite.map((m) => m.name).sort()).toEqual(full.map((m) => m.name).sort());
      const ids = new Set(full.filter((m) => m.userData.kind === "unit").map((m) => m.userData.id as string));
      expect([...ids].sort(), sex).toEqual([...units].sort());
      for (const m of full) {
        expect(m.userData.src).toBe("ecorche");
        expect(typeof m.userData.ar).toBe("string");
        expect(["l", "r", "m"]).toContain(m.userData.side);
        expect(m.textures, `${m.name}: the model's own texture`).toBe(1);
      }
      // nothing of the removed block is in the file
      expect(full.some((m) => /butt/i.test(m.name))).toBe(false);
    }
  }, 240_000);

  it("the deep muscles: separate named meshes on both sides, the same in both bodies and both builds", async () => {
    const { NodeIO: IO } = await import("@gltf-transform/core");
    await MeshoptDecoder.ready;
    const io = new IO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const want = (DEEP as { id: string; depth: number }[]);
    for (const sex of ["male", "female"]) {
      const full = await load(`${sex}/deep.glb`), lite = await load(`${sex}/deep-lite.glb`);
      expect(lite.map((m) => m.name).sort()).toEqual(full.map((m) => m.name).sort());
      expect([...new Set(full.map((m) => m.userData.id as string))].sort(), sex).toEqual(want.map((d) => d.id).sort());
      for (const m of full) {
        const spec = want.find((d) => d.id === m.userData.id)!;
        expect(m.userData.from).toBe("zanatomy");
        expect(m.userData.depth, m.name).toBe(spec.depth);
        expect(typeof m.userData.ar).toBe("string");
        expect(m.textures, `${m.name}: drawn with the atlas's own muscle material`).toBe(0);
      }
      // both sides of a paired muscle
      for (const id of ["transversus-abdominis-muscle", "piriformis-muscle", "subscapularis"]) expect(full.filter((m) => m.userData.id === id).map((m) => m.userData.side).sort(), id).toEqual(["l", "r"]);
      // every deep muscle lies inside the body: within the box of the superficial muscles
      const box = (doc: Awaited<ReturnType<typeof io.readBinary>>) => {
        const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
        for (const n of doc.getRoot().listNodes()) { const mesh = n.getMesh(); if (!mesh) continue; const a = mesh.listPrimitives()[0].getAttribute("POSITION")!, lo = a.getMin([0, 0, 0]), hi = a.getMax([0, 0, 0]), w = n.getWorldMatrix(); for (const p of [lo, hi]) for (let c = 0; c < 3; c++) { const v = w[c] * p[0] + w[4 + c] * p[1] + w[8 + c] * p[2] + w[12 + c]; b.min[c] = Math.min(b.min[c], v); b.max[c] = Math.max(b.max[c], v); } }
        return b;
      };
      const body = box(await io.readBinary(new Uint8Array(readFileSync(join(BUILD, sex, "core.glb"))))), inner = box(await io.readBinary(new Uint8Array(readFileSync(join(BUILD, sex, "deep.glb")))));
      for (let c = 0; c < 3; c++) { expect(inner.min[c], `${sex} axis ${c}`).toBeGreaterThan(body.min[c] - 0.002); expect(inner.max[c], `${sex} axis ${c}`).toBeLessThan(body.max[c] + 0.002); }
    }
  }, 240_000);

  it("the phone build is well under half the download", async () => {
    const { statSync } = await import("node:fs");
    for (const sex of ["male", "female"]) expect(statSync(join(BUILD, sex, "core-lite.glb")).size / statSync(join(BUILD, sex, "core.glb")).size, sex).toBeLessThan(0.45);
  });
});
