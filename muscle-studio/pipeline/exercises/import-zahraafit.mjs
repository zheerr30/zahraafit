// Imports the exercise library of the ZahraaFit calorie / training program — the
// exercise names and the YouTube video chosen for each — into Muscle Studio.
//
// Source of truth: the `EX` list inside the program's index.html (repository root).
// Every exercise there is either
//   - merged into an exercise Muscle Studio already describes (it then takes the
//     program's name and video, and keeps its steps and target muscles), or
//   - added as a new exercise (name, video, the program's own tip), with its target
//     muscles given here as groups of the 3D model, or
//   - dropped as a repeat of another entry (the "support" programs repeat some).
// An exercise of the program that is in none of the three lists stops the import,
// so nothing is silently left out when the program's library grows.
//
//   node pipeline/exercises/import-zahraafit.mjs ../index.html data/exercises/zahraafit.ts
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const [src = "../index.html", out = "data/exercises/zahraafit.ts"] = process.argv.slice(2);
const html = readFileSync(src, "utf8");
const start = html.indexOf("[", html.indexOf("const EX = ["));
let depth = 0, end = start, quote = null;
for (; end < html.length; end++) {
  const c = html[end];
  if (quote) { if (c === "\\") end++; else if (c === quote) quote = null; continue; }
  if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
  if (c === "/" && html[end + 1] === "*") { end = html.indexOf("*/", end) + 1; continue; }
  if (c === "[") depth++;
  else if (c === "]" && --depth === 0) break;
}
const EX = vm.runInNewContext(`(${html.slice(start, end + 1)})`, {}, { timeout: 2000 });

/** program id → Muscle Studio exercise id (same exercise: takes the program's name and video). */
const MERGE = {
  bench: "bench-press", flatdb: "db-bench-press", inclinedb: "incline-db-press", pushup: "push-up", cablecross: "cable-fly", dips: "chest-dip",
  dbshoulder: "overhead-press", lateral: "lateral-raise", frontraise: "front-raise", reardelt: "reverse-fly", facepull: "face-pull",
  sup_shoulder_0: "band-external-rotation", sup_shoulder_1: "band-internal-rotation", sup_shoulder_5: "cross-body-shoulder",
  pullup: "pull-up", latpull: "lat-pulldown", bentrow: "barbell-row", dbrow: "db-row", seatedrow: "seated-row", birddog: "bird-dog", deadlift: "deadlift",
  dbcurl: "db-curl", hammer: "hammer-curl", pushdown: "triceps-pushdown", overheadtri: "overhead-triceps-ext", benchdip: "bench-dip",
  sup_wrist_3: "ball-squeeze", sup_wrist_0: "wrist-flexor-stretch", sup_wrist_1: "wrist-extensor-stretch",
  crunch: "crunch", plank: "plank", legraise: "leg-raise", bicycle: "bicycle-crunch", russian: "russian-twist", sideplank: "side-plank", deadbug: "dead-bug",
  sup_diastasis_0: "diaphragmatic-breathing", sup_diastasis_5: "tva-vacuum",
  glutebridge: "glute-bridge", clamshell: "clamshell", gobletsquat: "goblet-squat", squat: "back-squat", lunge: "lunge", bulgarian: "split-squat", stepup: "step-up",
  legext: "leg-extension", legpress: "leg-press", legcurl: "leg-curl", nordic: "nordic-curl", sidelyingadduction: "side-lying-adduction",
  calfraise: "calf-raise", seatedcalf: "seated-calf-raise", sup_knee_4: "hamstring-stretch",
  sup_neck_0: "upper-trap-stretch", sup_neck_1: "neck-rotation-stretch", sup_neck_2: "chin-tuck", sup_neck_3: "levator-stretch",
  sup_lowerback_1: "cat-cow", sup_lowerback_4: "knees-to-chest",
};

/** Repeats of another entry of the program (same exercise under a support program). */
const DROP = new Set("ytwraise_back sup_knee_2 sup_knee_5 sup_lowerback_2 sup_lowerback_5 sup_weakcore_0 sup_weakcore_1 sup_weakcore_2 sup_weakcore_4 sup_diastasis_1 sup_diastasis_2 sup_diastasis_3 sup_diastasis_4".split(" "));

/** Target muscles of the new exercises: "prime movers|helpers" (groups of data/exercises/groups.ts) → program ids. */
const TARGETS = [
  ["chest|delt-front triceps", "chestpress dbfloorpress declinepush"],
  ["chest|triceps delt-front serratus abs", "widepush inclinepush kneepush negpush archerpush"],
  ["chest-upper|chest delt-front triceps", "inclinemachine"],
  ["chest|delt-front", "bandfly pecdeck svendpress"],
  ["lats|biceps brachialis rhomboids", "closegrippull bandlatpull"],
  ["lats|triceps traps-lower", "straightpull"],
  ["traps-lower traps-mid|delt-rear rhomboids", "reverssnow"],
  ["lats rhomboids|biceps traps-mid delt-rear", "tablerow doorrow"],
  ["traps-lower lats|rhomboids", "scappull"],
  ["rhomboids traps-mid lats|biceps delt-rear", "bandrow invertedrow towelrow machinerow"],
  ["rhomboids traps-mid lats|erectors biceps delt-rear", "tbar"],
  ["erectors|glute-max", "superman"],
  ["delt-front delt-side|triceps traps-upper serratus", "ohp arnold"],
  ["delt-front|delt-side triceps traps-upper", "pike elevatedpike"],
  ["delt-front chest|triceps", "wallpush"],
  ["delt-front abs|tva obliques serratus", "shouldertap"],
  ["delt-front abs|quads serratus tva", "bearcrawl"],
  ["delt-side|traps-upper rotator-cuff", "bandlateral cablelateral selflateral"],
  ["delt-side|delt-front delt-rear rotator-cuff", "armcircle"],
  ["delt-side traps-upper|biceps delt-front", "uprightrow"],
  ["traps-lower traps-mid|delt-rear rotator-cuff", "ytwraise"],
  ["rotator-cuff delt-side|delt-front serratus", "sup_shoulder_2"],
  ["traps-lower|serratus rotator-cuff", "sup_shoulder_3"],
  ["rhomboids traps-mid|", "sup_shoulder_4"],
  ["biceps|brachialis forearm-flexors", "barbellcurl bandcurl bwcurl isocurl preachercurl concentration cablecurl spidercurl selfcurl"],
  ["biceps lats|brachialis rhomboids", "chinup chinnegative"],
  ["biceps rhomboids|lats traps-mid brachialis", "invertedcurl"],
  ["forearm-flexors forearm-extensors|hand", "sup_wrist_2 sup_wrist_4"],
  ["triceps|", "skull bandpush ropepush kickbacktri overheadrope bwskull"],
  ["triceps|chest delt-front", "diamondpush closegrippress closegrippush walltri kneeclosepush sphinxpush"],
  ["quads glute-max|hamstrings adductors erectors abs", "bandsquat hacksquat frontsquat chairsquat temposquat"],
  ["quads glute-max|hamstrings calves adductors", "jumpsquat"],
  ["quads glute-max|hamstrings glute-med adductors", "reverselunge splitsquat"],
  ["adductors glute-max quads|hamstrings", "sumosquat sumosquat2 plie"],
  ["quads|glute-max", "wallsit sup_knee_3"],
  ["quads|", "sup_knee_0"],
  ["quads hip-flexors|abs", "sup_knee_1"],
  ["calves|", "legpresscalf donkeycalf singlecalf stepcalf"],
  ["calves|quads foot", "jumprope"],
  ["calves|foot", "tiptoewalk"],
  ["hamstrings|calves glute-max", "bandlegcurl swissball towellegcurl gluteham"],
  ["hamstrings glute-max|erectors", "rdl stiffdl singleleg goodmorning bwgoodmorning slhambridge slgbridge hamwalkout"],
  ["glute-max hamstrings|erectors", "revhyper"],
  ["glute-max|hamstrings", "hipthrust hipthrustdb kickback bandkick cablekick donkeykick glutemachine"],
  ["glute-max|hamstrings adductors", "frogpump"],
  ["glute-med|glute-max", "abduction hipabduct"],
  ["glute-max adductors quads|glute-med hamstrings", "sidelunge"],
  ["glute-max glute-med quads|adductors hamstrings", "curtsy"],
  ["abs tva|obliques glute-max serratus", "sup_lowerback_3"],
  ["abs hip-flexors|obliques tva", "vups"],
  ["abs hip-flexors|obliques forearm-flexors", "hangingraise"],
  ["abs hip-flexors|delt-front obliques quads", "mountain"],
  ["abs tva|glute-max", "sup_lowerback_0"],
  ["obliques ql|glute-med tva", "sup_weakcore_3"],
  ["glute-max tva|hamstrings abs", "sup_weakcore_5"],
  ["obliques|abs delt-front", "woodchop"],
  ["adductors|", "hipadduction cableadduction bandadduction adductorsqueeze sidelyingraise"],
  ["adductors|obliques", "copenhagen"],
  ["adductors quads glute-max|hamstrings glute-med", "cossack slidelunge"],
  ["traps-upper|levator", "sup_neck_4"],
];

/** English names the program leaves empty (its support exercises). */
const EN = {
  sup_knee_0: "Seated Knee Extension", sup_knee_1: "Straight Leg Raise", sup_knee_3: "Wall Slide Squat", sup_lowerback_0: "Posterior Pelvic Tilt",
  sup_lowerback_3: "Knee Plank", sup_shoulder_2: "Scaption Raise", sup_shoulder_3: "Wall Angel", sup_shoulder_4: "Scapular Squeeze",
  sup_weakcore_3: "Knee Side Plank", sup_weakcore_5: "Glute Bridge with Abdominal Brace", sup_wrist_2: "Wrist Circles",
  sup_wrist_4: "Light Wrist Flexion & Extension", sup_neck_4: "Shoulder Rolls",
};

const targetOf = new Map();
for (const [t, ids] of TARGETS) for (const id of ids.split(" ")) {
  if (targetOf.has(id)) throw new Error(`target given twice: ${id}`);
  targetOf.set(id, t);
}

function equipment(e) {
  const en = (e.en || EN[e.id] || "").toLowerCase(), ar = e.name;
  if (/jump rope|table inverted row/.test(en)) return "bodyweight";
  if (/stiff-leg/.test(en)) return "dumbbell";
  if (/band|banded/.test(en) || /بالشريط/.test(ar)) return "band";
  if (/barbell|t-bar|close-grip bench/.test(en) || /بالبار\b/.test(ar)) return "barbell";
  if (/dumbbell|arnold|hammer|goblet|concentration|spider|svend|plié|front raise|upright row|rear delt fly/.test(en) || /بالدمبل|بوزن خفيف/.test(ar)) return "dumbbell";
  if (/cable|rope|pulldown|face pull|woodchop/.test(en)) return "cable";
  if (/machine|leg press|pec deck|hack|preacher|glute ham/.test(en)) return "machine";
  if (/pull-up|chin-up|hanging|inverted row/.test(en)) return "bar";
  if (/swiss ball/.test(en) || /كرة/.test(ar)) return "ball";
  return "bodyweight";
}
const STRETCH = new Set(["إطالة", "مرونة", "استرخاء"]);
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const videoOf = (e) => {
  const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/.exec(e.video ?? "");
  if (!m) throw new Error(`no YouTube video for ${e.id}: ${e.video}`);
  return `https://youtu.be/${m[1]}`;
};

const merge = {}, rows = [], seen = new Set();
for (const e of EX) {
  if (seen.has(e.id)) throw new Error(`duplicate id in the program: ${e.id}`);
  seen.add(e.id);
  if (DROP.has(e.id)) continue;
  const video = videoOf(e), en = clean(e.en) || EN[e.id] || "";
  if (MERGE[e.id]) {
    merge[MERGE[e.id]] = { ar: clean(e.name), en, video };
    continue;
  }
  const t = targetOf.get(e.id);
  if (!t) throw new Error(`"${e.id}" (${e.name}) is new in the program: add it to MERGE, TARGETS or DROP`);
  if (!en) throw new Error(`no English name for ${e.id}`);
  const [primary, secondary] = t.split("|");
  rows.push({ id: `zf-${e.id.replace(/_/g, "-")}`, ar: clean(e.name), en, type: STRETCH.has(e.supType) ? "stretch" : "strength", primary, secondary, equipment: equipment(e), level: e.level, tip: clean(e.tip), video });
}
for (const id of [...Object.keys(MERGE), ...targetOf.keys(), ...DROP]) if (!seen.has(id)) throw new Error(`not in the program any more: ${id}`);

const q = JSON.stringify;
let ts = `// Generated by pipeline/exercises/import-zahraafit.mjs from the ZahraaFit program's exercise library
// (index.html at the repository root) — do not edit by hand; edit the program or the importer.
// ${EX.length} exercises in the program: ${Object.keys(merge).length} merged into existing exercises, ${rows.length} added, ${DROP.size} repeats dropped.
import type { Equipment, ExerciseType, Level } from "./exercises";

/** Name and video the program gives to an exercise Muscle Studio already describes (by exercise id). */
export const ZF_MERGE: Record<string, { ar: string; en: string; video: string }> = {
${Object.entries(merge).map(([id, m]) => `  ${q(id)}: { ar: ${q(m.ar)}, en: ${q(m.en)}, video: ${q(m.video)} },`).join("\n")}
};

/** Exercises of the program that are new to Muscle Studio: [id, ar, en, type, primary, secondary, equipment, level, tip, video]. */
export const ZF_ROWS: [string, string, string, ExerciseType, string, string, Equipment, Level, string, string][] = [
${rows.map((r) => `  [${q(r.id)}, ${q(r.ar)}, ${q(r.en)}, ${q(r.type)}, ${q(r.primary)}, ${q(r.secondary)}, ${q(r.equipment)}, ${r.level}, ${q(r.tip)}, ${q(r.video)}],`).join("\n")}
];
`;
writeFileSync(out, ts);
const by = (f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
console.log(`${EX.length} in the program → merged ${Object.keys(merge).length}, added ${rows.length}, dropped ${DROP.size}`);
console.log("equipment", by((r) => r.equipment), "type", by((r) => r.type));
