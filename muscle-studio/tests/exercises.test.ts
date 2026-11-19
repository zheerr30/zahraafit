import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { beforeAll, describe, expect, it } from "vitest";
import { EXERCISES, EXERCISE_BY_ID } from "@/data/exercises/exercises";
import { ZF_MERGE, ZF_ROWS } from "@/data/exercises/zahraafit";
import { GROUP_AREAS, GROUP_BY_ID, MUSCLE_GROUPS, groupsOfUnit } from "@/data/exercises/groups";
import { MAP_OVERLAYS } from "@/data/exercises/maps";
import { countForUnit, filterExercises, functionOfUnit, relevance, spotlightOf, viewOf, youtubeId } from "@/lib/exercises";
import { applyStyle, prepareRegionModel, secondaryHighlight, type RegionModel } from "@/lib/region/backModel";
import { backStore } from "@/stores/backStore";
import { exerciseStore } from "@/stores/exerciseStore";
import type { MeshPhysicalMaterial } from "three";

const PUBLIC = join(__dirname, "../public");
let model: RegionModel;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const buf = readFileSync(join(PUBLIC, "models/zanatomy/male/core-smooth.glb"));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise<{ scene: Group }>((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(ab, "", ok, err));
  model = prepareRegionModel(gltf.scene);
}, 120_000);

describe("exercise muscle groups are the muscles of the 3D model", () => {
  it("every unit id of every group exists in the model", () => {
    for (const g of MUSCLE_GROUPS) {
      expect(g.units.length, g.id).toBeGreaterThan(0);
      for (const u of g.units) expect(model.units.has(u), `${g.id}: ${u}`).toBe(true);
    }
  });

  it("every group is in one filter area and has a muscle-map image for its own view", () => {
    const inAreas = GROUP_AREAS.flatMap((a) => a.groups);
    expect(new Set(inAreas).size).toBe(inAreas.length);
    // Two groups cannot be seen from outside even with the covering layers removed
    // (inside the pelvis; under the neck muscles): their cards show the plain figure.
    const HIDDEN = ["pelvic-floor", "levator"];
    for (const g of MUSCLE_GROUPS) {
      expect(inAreas, g.id).toContain(g.id);
      const has = existsSync(join(PUBLIC, `exercise-maps/${g.id}-${g.view}.webp`));
      expect(has, `${g.id}-${g.view}.webp`).toBe(!HIDDEN.includes(g.id));
      expect(MAP_OVERLAYS.has(`${g.id}-${g.view}`), g.id).toBe(has);
    }
    for (const key of MAP_OVERLAYS) expect(existsSync(join(PUBLIC, `exercise-maps/${key}.webp`)), key).toBe(true);
    for (const v of ["front", "back"]) expect(existsSync(join(PUBLIC, `exercise-maps/base-${v}.webp`))).toBe(true);
  });

  it("the muscles people train have a function line and exercises", () => {
    for (const u of ["sternocostal-head-of-pectoralis-major-muscle", "rectus-abdominis-muscle", "latissimus-dorsi", "gluteus-maximus-muscle", "rectus-femoris-muscle", "long-head-of-biceps-femoris", "deltoid-lateral", "soleus-muscle"]) {
      expect(functionOfUnit(u), u).toBeTruthy();
      const c = countForUnit(u);
      expect(c.strength, `${u} strength`).toBeGreaterThan(0);
      expect(c.stretch, `${u} stretch`).toBeGreaterThan(0);
    }
    // a muscle nobody trains in the gym: no group, no exercises, no crash
    expect(groupsOfUnit("risorius-muscle")).toEqual([]);
    expect(countForUnit("risorius-muscle")).toEqual({ strength: 0, stretch: 0 });
  });
});

describe("exercise library", () => {
  it("is well formed: unique ids, known groups, steps and dose", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(EXERCISES).toHaveLength(232);
    expect(EXERCISES.filter((e) => e.type === "strength").length).toBeGreaterThan(190);
    expect(EXERCISES.filter((e) => e.type === "stretch").length).toBeGreaterThan(25);
    for (const e of EXERCISES) {
      expect(e.primary.length, e.id).toBeGreaterThan(0);
      for (const g of [...e.primary, ...e.secondary]) expect(GROUP_BY_ID.has(g), `${e.id}: ${g}`).toBe(true);
      expect(e.primary.some((g) => e.secondary.includes(g)), e.id).toBe(false);
      // written exercises have steps and a dose; the program's own come with a video and a tip
      const video = youtubeId(e.media?.video);
      if (e.id.startsWith("zf-")) expect(video, e.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      else expect(e.steps.length >= 3 && e.dose.length > 0, e.id).toBe(true);
      if (e.media?.video) expect(video, e.id).not.toBeNull();
      expect(e.ar.length && e.en.length && e.tip.length, e.id).toBeTruthy();
    }
  });

  it("every group is the main target of at least one exercise", () => {
    for (const g of MUSCLE_GROUPS) expect(EXERCISES.some((e) => e.primary.includes(g.id)), g.id).toBe(true);
  });

  it("filters by type, text (Arabic / English), equipment, level, muscle and bookmarks", () => {
    const chest = filterExercises({ type: "strength", groups: ["chest"] });
    expect(chest.length).toBeGreaterThan(3);
    expect(relevance(chest[0], ["chest"])).toBe(2); // prime movers first
    expect(chest.every((e) => e.type === "strength")).toBe(true);
    expect(filterExercises({ query: "push-up" }).map((e) => e.id)).toContain("push-up");
    expect(filterExercises({ query: "الضغط" }).map((e) => e.id)).toContain("push-up");
    expect(filterExercises({ query: "الظهرية" }).length).toBeGreaterThan(2); // by muscle name
    expect(filterExercises({ equipment: "band" }).every((e) => e.equipment === "band")).toBe(true);
    expect(filterExercises({ level: 3 }).every((e) => e.level === 3)).toBe(true);
    expect(filterExercises({ bookmarks: new Set(["plank", "cobra"]) }).map((e) => e.id).sort()).toEqual(["cobra", "plank"]);
    expect(filterExercises({ type: "stretch", groups: ["hamstrings"], query: "zzz" })).toEqual([]);
    const withVideo = filterExercises({ video: true });
    expect(withVideo.length).toBeGreaterThan(180);
    expect(withVideo.every((e) => !!e.media?.video)).toBe(true);
  });

  it("carries the ZahraaFit program's library: its names and the YouTube video of each exercise", () => {
    // 202 in the program, 13 repeats dropped: 59 merged into written exercises, 130 added
    expect(Object.keys(ZF_MERGE)).toHaveLength(59);
    expect(ZF_ROWS).toHaveLength(130);
    for (const id of Object.keys(ZF_MERGE)) expect(EXERCISE_BY_ID.has(id), id).toBe(true);
    const bench = EXERCISE_BY_ID.get("bench-press")!;
    expect(bench.ar).toBe("بنش بريس بالبار"); // the program's name…
    expect(youtubeId(bench.media?.video)).toBe("SCVCLChPQFY"); // …and video,
    expect(bench.steps.length).toBeGreaterThanOrEqual(3); // with the steps written here
    const pec = EXERCISE_BY_ID.get("zf-pecdeck")!;
    expect(pec.ar).toBe("جهاز التفتيح (بيك ديك)");
    expect(pec.primary).toEqual(["chest"]);
    expect(pec.equipment).toBe("machine");
    // exercises with a video come first for a muscle, written steps before video-only
    const chest = filterExercises({ type: "strength", groups: ["chest"] });
    expect(chest[0].media?.video && chest[0].steps.length).toBeTruthy();
    expect(youtubeId("https://www.youtube.com/watch?v=SCVCLChPQFY&t=3s")).toBe("SCVCLChPQFY");
    expect(youtubeId("https://youtube.com/shorts/SCVCLChPQFY?feature=share")).toBe("SCVCLChPQFY");
    expect(youtubeId("https://example.com/clip.mp4")).toBeNull();
  });

  it("bookmarks toggle", () => {
    const st = exerciseStore.getState();
    st.toggle("plank");
    expect(exerciseStore.getState().bookmarks.has("plank")).toBe(true);
    exerciseStore.getState().toggle("plank");
    expect(exerciseStore.getState().bookmarks.has("plank")).toBe(false);
  });
});

describe("an exercise lights its muscles on the model", () => {
  it("spotlight: prime movers in the highlight colour, helpers lighter, the rest untouched; then restored", () => {
    const squat = EXERCISES.find((e) => e.id === "goblet-squat")!;
    const spot = spotlightOf(squat);
    expect(viewOf(squat)).toBe("front");
    expect(spot.primary).toContain("rectus-femoris-muscle");
    expect(spot.secondary).toContain("adductor-magnus");
    expect(spot.primary.some((u) => spot.secondary.includes(u))).toBe(false);
    const sets = { primary: new Set(spot.primary), secondary: new Set(spot.secondary) };
    const hex = (id: string) => `#${(model.byUnit.get(id)![0].mesh.material as MeshPhysicalMaterial).color.getHexString()}`;
    const before = { quad: hex("rectus-femoris-muscle"), add: hex("adductor-magnus"), bic: hex("long-head-of-biceps-brachii") };
    for (const m of model.meshes) applyStyle(m, null, null, "#E8602C", sets);
    expect(hex("rectus-femoris-muscle")).toBe("#e8602c");
    expect(hex("adductor-magnus")).toBe(secondaryHighlight("#E8602C").toLowerCase());
    expect(hex("long-head-of-biceps-brachii")).toBe(before.bic);
    for (const m of model.meshes) applyStyle(m, null, null, "#E8602C", null);
    expect(hex("rectus-femoris-muscle")).toBe(before.quad);
    expect(hex("adductor-magnus")).toBe(before.add);
  });

  it("store: a new selection opens the summary and clears the spotlight; full body leaves isolation", () => {
    const st = () => backStore.getState();
    st().selectUnit("rectus-abdominis-muscle");
    expect(st().panel).toBe("summary");
    st().setPanel("exercises");
    st().setSpotlight({ primary: ["rectus-abdominis-muscle"], secondary: [] });
    st().selectUnit("rectus-abdominis-muscle"); // same muscle: the open panel stays
    expect(st().panel).toBe("exercises");
    expect(st().spotlight).not.toBeNull();
    st().selectUnit("latissimus-dorsi");
    expect(st().panel).toBe("summary");
    expect(st().spotlight).toBeNull();
    st().setIsolate(true);
    expect(st().isolate).toBe(true);
    st().showFullBody();
    expect(st().isolate).toBe(false);
    expect(st().region).toBeNull();
    expect(st().selected?.id).toBe("latissimus-dorsi"); // still selected, back in the whole anatomy
    st().resetAll();
  });
});
