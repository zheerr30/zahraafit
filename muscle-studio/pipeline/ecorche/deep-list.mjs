// The deep muscles the Écorché body gets from the Z-Anatomy body (pipeline/ecorche/deep.mjs).
//
// Not brought over: the muscles of the eye, the larynx, the pharynx and the tongue, the lateral
// pterygoid (the skull of this model is solid where it lies), the palmar interossei (the hands
// are posed differently) and the anal sphincter.
// depth: 2 under the superficial muscles, 3 the deepest. `axis`: the line the muscle is
// wrapped around (what "inwards" means for it). `gap`: how far under the body's surface it
// must lie at least. `below`: muscles of this list it must lie under.
const D = (id, depth, axis = "trunk", more = {}) => ({ id, depth, axis, gap: depth === 2 ? 0.005 : 0.009, ...more });
export const DEEP = [
  // abdomen
  D("internal-abdominal-oblique-muscle", 2, "trunk", { gap: 0.006 }),
  D("transversus-abdominis-muscle", 3, "trunk", { gap: 0.011, below: ["internal-abdominal-oblique-muscle"] }),
  D("Linea_alba", 3, "trunk", { kind: "tendon", gap: 0.008 }),
  D("quadratus-lumborum-muscle", 3),
  // chest
  D("external-intercostal-muscles", 2), D("internal-intercostal-muscles", 3), D("innermost-intercostal-muscles", 3),
  D("diaphragm", 3), D("levatores-breves-costarum", 3), D("levatores-longi-costarum", 3),
  D("subclavius-muscle", 2), D("transversus-thoracis-muscle", 3),
  // back
  D("serratus-posterior-superior-muscle", 2), D("serratus-posterior-inferior-muscle", 2),
  D("semispinalis-thoracis-muscle", 2), D("semispinalis-colli-muscle", 2, "neck"),
  D("multifidus-lumborum-muscle", 3), D("multifidus-thoracis-muscle", 3), D("multifidus-colli-muscle", 3, "neck"),
  D("rotatores", 3), D("interspinales-lumborum-muscles", 3), D("interspinales-thoracis-muscles", 3), D("interspinales-colli-muscles", 3, "neck"),
  D("dorsal-parts-of-lateral-intertransversarii-lumborum-muscles", 3), D("ventral-parts-of-lateral-intertransversarii-lumborum-muscles", 3),
  // neck and head
  D("longus-colli-muscle", 3, "neck"), D("longus-capitis-muscle", 3, "neck"),
  D("rectus-anterior-capitis-muscle", 3, "neck"), D("rectus-lateralis-capitis-muscle", 3, "neck"),
  D("obliquus-inferior-capitis-muscle", 3, "neck"), D("obliquus-superior-capitis-muscle", 3, "neck"),
  D("rectus-posterior-major-capitis-muscle", 3, "neck"), D("rectus-posterior-minor-capitis-muscle", 3, "neck"),
  D("sternothyroid-muscle", 2, "neck"), D("geniohyoid-muscle", 2, "neck"),
  // shoulder and arm
  D("subscapularis", 2), D("supinator", 2, "forearm"),
  // pelvis
  D("piriformis-muscle", 2), D("superior-gemellus-muscle", 2), D("inferior-gemellus-muscle", 2),
  D("obturator-internus", 2), D("quadratus-femoris-muscle", 2), D("obturator-externus", 3),
  D("coccygeus-muscle", 3), D("iliococcygeus-muscle", 3), D("pubococcygeus-muscle", 3), D("pubo-analis-muscle", 3),
  // thigh
  D("adductor-brevis", 2, "thigh"), D("adductor-minimus", 2, "thigh"), D("vastus-intermedius-muscle", 2, "thigh"),
  // leg and foot
  D("popliteus-muscle", 2, "leg"), D("plantaris-muscle", 2, "leg"), D("tibialis-posterior-muscle", 3, "leg"),
  D("quadratus-plantae-muscle", 2, "foot"), D("lumbrical-muscles-of-foot", 2, "foot"),
  D("oblique-head-of-adductor-hallucis", 2, "foot"), D("transverse-head-of-adductor-hallucis", 2, "foot"),
  D("lateral-head-of-flexor-hallucis-brevis", 2, "foot"), D("medial-head-of-flexor-hallucis-brevis", 2, "foot"),
  D("flexor-digiti-minimi-of-foot", 2, "foot"), D("opponens-digiti-minimi-muscle-of-foot", 2, "foot"),
  D("plantar-interossei-muscles", 3, "foot"),
];
