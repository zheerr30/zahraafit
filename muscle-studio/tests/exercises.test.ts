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
import { Color, type MeshPhysicalMaterial } from "three";
import { SELECTION_ACCENT, SELECTION_ACCENT_SOFT } from "@/lib/highlight";
import { describeMuscle, explainMuscle } from "@/lib/exercises/describe";
import { neutralTone } from "@/lib/three/palette";
import { plainArabic } from "@/lib/anatomy/normalize";

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
  it("spotlight: prime movers in the highlight colour, helpers lighter, the rest neutral; then restored", () => {
    const squat = EXERCISES.find((e) => e.id === "goblet-squat")!;
    const spot = spotlightOf(squat);
    expect(viewOf(squat)).toBe("front");
    expect(spot.primary).toContain("rectus-femoris-muscle");
    expect(spot.secondary).toContain("adductor-magnus");
    expect(spot.primary.some((u) => spot.secondary.includes(u))).toBe(false);
    const sets = { primary: new Set(spot.primary), secondary: new Set(spot.secondary) };
    const hex = (id: string) => `#${(model.byUnit.get(id)![0].mesh.material as MeshPhysicalMaterial).color.getHexString()}`;
    const before = { quad: hex("rectus-femoris-muscle"), add: hex("adductor-magnus"), bic: hex("long-head-of-biceps-brachii") };
    for (const m of model.meshes) applyStyle(m, null, null, SELECTION_ACCENT, sets);
    expect(hex("rectus-femoris-muscle")).toBe(SELECTION_ACCENT.toLowerCase());
    expect(hex("adductor-magnus")).toBe(SELECTION_ACCENT_SOFT.toLowerCase());
    expect(secondaryHighlight("#173F8A")).not.toBe("#173f8a"); // any other colour: a lighter tint of itself
    expect(hex("long-head-of-biceps-brachii")).toBe(model.byUnit.get("long-head-of-biceps-brachii")![0].neutralHex);
    for (const m of model.meshes) applyStyle(m, null, null, SELECTION_ACCENT, null);
    expect(hex("long-head-of-biceps-brachii")).toBe(before.bic);
    expect(hex("rectus-femoris-muscle")).toBe(before.quad);
    expect(hex("adductor-magnus")).toBe(before.add);
  });

  it("selection: the orange accent, clearly apart from what the other muscles show, and fully undone on deselect", () => {
    expect(backStore.getState().highlightColor).toBe(SELECTION_ACCENT);
    const red = new Color(SELECTION_ACCENT);
    const units = [...model.units.keys()];
    const state = (id: string) => {
      const mat = model.byUnit.get(id)![0].mesh.material as MeshPhysicalMaterial;
      return `${mat.color.getHexString()}|${mat.emissive.getHexString()}|${mat.sheen.toFixed(3)}|${mat.clearcoat.toFixed(3)}`;
    };
    let nearest = Infinity;
    for (const id of units) {
      const before = state(id);
      const own = (model.byUnit.get(id)![0].mesh.material as MeshPhysicalMaterial).color.clone();
      const sel = { kind: "unit" as const, id, side: "l" as const, ar: id, en: id };
      for (const m of model.byUnit.get(id)!) applyStyle(m, sel, null, SELECTION_ACCENT);
      const mat = model.byUnit.get(id)![0].mesh.material as MeshPhysicalMaterial;
      expect(mat.color.getHexString(), id).toBe(SELECTION_ACCENT.slice(1).toLowerCase()); // the same colour for every muscle
      expect(mat.emissive.r, id).toBeGreaterThan(0); // readable in shadow, from every side
      // distance from the muscle's own colour, in sRGB (0…~1.7)
      // (while a muscle is selected the others are in their neutral tones)
      const a = new Color(neutralTone(own)).convertLinearToSRGB(), b = red.clone().convertLinearToSRGB();
      nearest = Math.min(nearest, Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b));
      for (const m of model.byUnit.get(id)!) applyStyle(m, null, null, SELECTION_ACCENT);
      expect(state(id), `${id} restored`).toBe(before); // deselected: exactly its original appearance
    }
    expect(units.length).toBeGreaterThan(220);
    expect(nearest).toBeGreaterThan(0.25);
  });

  it("no Arabic diacritics in what the interface shows", () => {
    const marks = /[\u064B-\u0652\u0670]/;
    for (const e of EXERCISES) for (const t of [e.ar, e.dose, e.tip, ...e.steps]) expect(marks.test(t), `${e.id}: ${t}`).toBe(false);
    for (const g of MUSCLE_GROUPS) for (const t of [g.ar, g.fn, g.where, ...g.does, ...g.moves]) expect(marks.test(t), `${g.id}: ${t}`).toBe(false);
    for (const a of GROUP_AREAS) expect(marks.test(a.ar), a.id).toBe(false);
    // names read from the model files are shown without them too
    for (const m of model.meshes) expect(marks.test(m.ar), `${m.kind} ${m.id}: ${m.ar}`).toBe(false);
    expect(plainArabic("\u0627\u0644\u0645\u0642\u0631\u0651\u0650\u0628\u0629 \u0627\u0644\u0637\u0648\u064A\u0644\u0629\u064F")).toBe("المقربة الطويلة"); // written with escapes: this file is kept free of the marks too
  });

  it("every muscle is explained in plain words: what it does, and for trained muscles where it is and its movements", () => {
    for (const u of model.units.values()) {
      const x = explainMuscle(u.id, u.region);
      expect(x.about.length, u.id).toBeGreaterThan(15);
      for (const t of [x.about, x.where ?? "", ...x.does, ...x.moves]) expect(/Z-Anatomy|TA2|[A-Za-z]{6,}/.test(t), `${u.id}: ${t}`).toBe(false);
    }
    for (const g of MUSCLE_GROUPS) {
      const x = explainMuscle(g.units[0]);
      expect(x.where && x.where.length > 10, g.id).toBeTruthy();
      expect(x.does.length, g.id).toBeGreaterThanOrEqual(2);
      expect(x.moves.length, g.id).toBeGreaterThanOrEqual(2);
    }
    expect(explainMuscle("zygomaticus-major-muscle", "head-neck").where).toContain("الوجه");
  });

  it("every muscle has a short, plain description", () => {
    const jargon = /إنسي|وحشي|تبعيد|أخمصي|ظهري|الحق|استلقاء الساعد|العضد\b/;
    for (const u of model.units.values()) {
      const text = describeMuscle(u.id, u.region);
      expect(text.length, u.id).toBeGreaterThan(15);
      expect(text.length, u.id).toBeLessThan(120);
      expect(text.split(/[.؟!]\s/).filter((x) => x.trim()).length, u.id).toBeLessThanOrEqual(2);
      expect(jargon.test(text), `${u.id}: ${text}`).toBe(false);
    }
    expect(describeMuscle("rectus-abdominis-muscle")).toContain("البطن");
    expect(describeMuscle("zygomaticus-major-muscle", "head-neck")).toContain("تعابير الوجه");
    // only a few muscles fall back to the plain "a muscle of the … region" line
    const generic = [...model.units.values()].filter((u) => /^عضلة (صغيرة )?من عضلات/.test(describeMuscle(u.id, u.region)));
    expect(generic.length, generic.map((u) => u.id).join(" ")).toBeLessThan(6);
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
