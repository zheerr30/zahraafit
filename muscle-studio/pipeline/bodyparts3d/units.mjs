// Which BodyParts3D 4.0 parts become separate, selectable muscle meshes.
//
// Each unit lists the exact BodyParts3D English names (side words removed)
// whose OBJ files are merged into ONE mesh per side. Names were taken from the
// file headers of isa/partof_BP3D_4.0_obj_99 — nothing here is guessed.
// Mesh names in the output GLB are `${key}_l` / `${key}_r`.
//
// Muscles requested by the studio but ABSENT from BodyParts3D 4.0 (verified
// against all 2,234 OBJ headers): latissimus dorsi, rectus abdominis,
// internal oblique, transversus abdominis.

export const UNITS = [
  // ── Neck ──
  { key: "sternocleidomastoid", parts: ["sternocleidomastoid"] },
  { key: "splenius", parts: ["splenius capitis", "splenius cervicis"] },
  { key: "levator_scapulae", parts: ["levator scapulae"] },
  // ── Shoulder ──
  { key: "deltoid_anterior", parts: ["clavicular part of deltoid"] },
  { key: "deltoid_lateral", parts: ["acromial part of deltoid"] },
  { key: "deltoid_posterior", parts: ["spinal part of deltoid"] },
  { key: "supraspinatus", parts: ["supraspinatus"] },
  { key: "infraspinatus", parts: ["infraspinatus muscle"] },
  { key: "teres_minor", parts: ["teres minor"] },
  { key: "teres_major", parts: ["teres major"] },
  // ── Chest ──
  { key: "pectoralis_major_clavicular", parts: ["clavicular part of pectoralis major"] },
  { key: "pectoralis_major_sternocostal", parts: ["sternocostal part of pectoralis major"] },
  { key: "pectoralis_major_abdominal", parts: ["abdominal part of pectoralis major"] },
  { key: "pectoralis_minor", parts: ["pectoralis minor"] },
  { key: "serratus_anterior", parts: ["serratus anterior"] },
  // ── Back ──
  { key: "trapezius_descending", parts: ["descending part of trapezius"] },
  { key: "trapezius_transverse", parts: ["transverse part of trapezius"] },
  { key: "trapezius_ascending", parts: ["ascending part of trapezius"] },
  { key: "rhomboids", parts: ["rhomboid major", "rhomboid minor"] },
  {
    key: "erector_spinae",
    parts: [
      "iliocostalis cervicis",
      "iliocostalis thoracis",
      "iliocostalis lumborum",
      "longissimus capitis",
      "longissimus cervicis",
      "longissimus thoracis",
      "spinalis thoracis",
      "spinalis",
    ],
  },
  // ── Arm ──
  { key: "biceps_brachii", parts: ["long head of biceps brachii", "short head of biceps brachii"] },
  { key: "brachialis", parts: ["brachialis"] },
  { key: "coracobrachialis", parts: ["coracobrachialis"] },
  {
    key: "triceps_brachii",
    parts: ["long head of triceps brachii", "lateral head of triceps brachii", "medial head of triceps brachii"],
  },
  { key: "brachioradialis", parts: ["brachioradialis"] },
  {
    key: "forearm_flexors",
    parts: [
      "flexor carpi radialis",
      "palmaris longus",
      "humeral head of flexor carpi ulnaris",
      "ulnar head of flexor carpi ulnaris",
      "flexor digitorum superficialis",
      "humeral head of pronator teres",
      "ulnar head of pronator teres",
    ],
  },
  {
    key: "forearm_extensors",
    parts: [
      "extensor carpi radialis longus",
      "extensor carpi radialis brevis",
      "extensor carpi ulnaris",
      "extensor digitorum",
      "extensor digiti minimi",
    ],
  },
  // ── Trunk ──
  { key: "external_oblique", parts: ["external oblique"] },
  // ── Hip ──
  { key: "gluteus_maximus", parts: ["gluteus maximus"] },
  { key: "gluteus_medius", parts: ["gluteus medius"] },
  { key: "gluteus_minimus", parts: ["gluteus minimus"] },
  { key: "tensor_fasciae_latae", parts: ["tensor fasciae latae"] },
  { key: "iliopsoas", parts: ["psoas major", "iliacus"] },
  // ── Thigh ──
  { key: "rectus_femoris", parts: ["rectus femoris"] },
  { key: "vastus_lateralis", parts: ["vastus lateralis"] },
  { key: "vastus_medialis", parts: ["vastus medialis"] },
  { key: "vastus_intermedius", parts: ["vastus intermedius"] },
  { key: "sartorius", parts: ["sartorius"] },
  { key: "gracilis", parts: ["gracilis"] },
  { key: "pectineus", parts: ["pectineus"] },
  { key: "adductor_longus", parts: ["adductor longus"] },
  { key: "adductor_brevis", parts: ["adductor brevis"] },
  { key: "adductor_magnus", parts: ["adductor magnus"] },
  { key: "biceps_femoris", parts: ["long head of biceps femoris", "short head of biceps femoris"] },
  { key: "semitendinosus", parts: ["semitendinosus"] },
  { key: "semimembranosus", parts: ["semimembranosus"] },
  // ── Leg ──
  { key: "gastrocnemius", parts: ["medial head of gastrocnemius", "lateral head of gastrocnemius"] },
  { key: "soleus", parts: ["soleus"] },
  { key: "tibialis_anterior", parts: ["tibialis anterior"] },
  { key: "fibularis", parts: ["fibularis longus", "fibularis brevis"] },
  { key: "extensor_digitorum_longus", parts: ["extensor digitorum longus"] },
];

// Every other BodyParts3D muscle structure, kept (merged per group) as
// non-selectable context so the musculature stays anatomically complete.
// Midline groups have no side suffix.
export const CONTEXT = [
  { key: "neck_other", parts: ["inferior oblique part of longus colli", "digastric", "longus capitis", "mylohyoid", "obliquus capitis inferior", "obliquus capitis superior", "omohyoid", "platysma", "rectus capitis anterior", "rectus capitis lateralis", "rectus capitis posterior major", "rectus capitis posterior minor", "scalenus anterior", "scalenus medius", "scalenus posterior", "sternohyoid", "sternothyroid", "stylohyoid", "thyrohyoid", "set of anterior cervical intertransversarii", "set of interspinales cervicis", "set of posterior cervical intertransversarii", "superior oblique part of longus colli", "vertical intermediate part of longus colli"] },
  { key: "shoulder_other", parts: ["subscapularis", "serratus posterior inferior", "serratus posterior superior", "subclavius"] },
  { key: "back_deep_other", parts: ["lateral lumbar intertransversarius", "medial lumbar intertransversarius", "cervical rotator", "interspinalis thoracis", "lumbar rotator", "semispinalis capitis", "semispinalis cervicis", "semispinalis thoracis", "set of interspinales lumborum", "set of levatores costarum breves", "set of levatores costarum longi", "thoracic rotator"] },
  { key: "intercostals", parts: ["external intercostal muscle", "innermost intercostal muscle", "internal intercostal muscle", "transversus thoracis"] },
  { key: "arm_other", parts: ["anconeus"] },
  { key: "forearm_deep", parts: ["abductor pollicis longus", "extensor indicis", "extensor pollicis longus", "flexor digitorum profundus", "flexor pollicis longus", "pronator quadratus", "supinator"] },
  { key: "hand", parts: ["abductor digiti minimi of hand", "flexor digiti minimi brevis of hand", "abductor pollicis brevis", "extensor pollicis brevis", "opponens pollicis", "oblique head of adductor pollicis", "opponens digiti minimi of hand", "flexor pollicis brevis", "set of dorsal interossei of hand", "set of lumbricals of hand", "set of palmar interossei of hand", "superficial head of flexor pollicis brevis", "transverse head of adductor pollicis"] },
  { key: "hip_deep", parts: ["gemellus inferior", "gemellus superior", "obturator externus", "obturator internus", "piriformis", "quadratus femoris", "iliotibial tract"] },
  { key: "adductor_minimus", parts: ["adductor minimus"] },
  { key: "leg_deep", parts: ["calcaneal tendon", "flexor digitorum longus", "flexor hallucis longus", "plantaris", "popliteus", "tibialis posterior"] },
  { key: "leg_anterior_other", parts: ["extensor hallucis longus", "fibularis tertius"] },
  { key: "foot", parts: ["abductor digiti minimi of foot", "first lumbrical of foot", "first plantar interosseous of foot", "flexor digiti minimi brevis of foot", "fourth lumbrical of foot", "lateral head of flexor hallucis brevis", "abductor hallucis", "extensor hallucis brevis", "flexor accessorius", "flexor digitorum brevis", "medial head of flexor hallucis brevis", "oblique head of adductor hallucis", "opponens digiti minimi of foot", "second lumbrical of foot", "second plantar interosseous of foot", "third lumbrical of foot", "third plantar interosseous of foot", "transverse head of adductor hallucis"] },
  { key: "linea_alba", parts: ["linea alba"], midline: true },
  { key: "diaphragm", parts: ["diaphragm"], midline: true },
  { key: "pelvic_floor", parts: ["external anal sphincter", "coccygeus", "iliococcygeus", "pubococcygeus", "puborectalis", "tendinous arch of levator ani"], midline: true },
];

/** Bare structure name: lower case, side words removed (same rule as open-anatomy-3d). */
export function bareName(name) {
  return name
    .toLowerCase()
    .replace(/^(left|right) /, "")
    .replace(/ of (left|right) /g, " of ")
    .trim();
}

export function sideOf(name, centerX) {
  const l = name.toLowerCase();
  if (/\bleft\b/.test(l)) return "l";
  if (/\bright\b/.test(l)) return "r";
  return centerX > 0 ? "l" : "r"; // BodyParts3D: patient's left = +X
}
