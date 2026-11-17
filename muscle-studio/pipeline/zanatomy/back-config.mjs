// Phase 1 region: back and shoulders, from the Z-Anatomy models (CC BY-SA 4.0).
// Names are the exact Z-Anatomy mesh names without the trailing side letter
// (l/r); the side is taken from the geometry (left = +X).

const SIDE = "both";

/**
 * Selectable muscle units. `meshes` are Z-Anatomy mesh bases; `patches` are
 * extra prefixes of attachment footprints on bones (Z-Anatomy stores them in
 * the skeletal file as "<muscle>o[n]<side>" = origin and "<muscle>e[n]<side>"
 * = insertion). `insertionBones` overrides that suffix with the textbook
 * anatomy: a footprint lying on one of these bones is an insertion, on any
 * other bone an origin (null = keep Z-Anatomy's suffix). Footprints of a
 * muscle split into parts (trapezius, deltoid) are re-assigned to the part
 * whose surface actually touches them.
 */
export const UNITS = [
  // Z-Anatomy names the trapezius parts the other way round from the
  // Terminologia Anatomica: its "Ascending part" mesh is the upper (neck)
  // part — pars descendens — and its "Descending part" is the lower part.
  // Mapped by position here; build-back.mjs asserts the vertical order.
  { id: "trapezius-upper", depth: 1, meshes: ["Ascending_part_of_trapezius_muscle"], patches: [], insertionBones: ["Clavicle"] },
  { id: "trapezius-middle", depth: 1, meshes: ["Transverse_part_of_trapezius_muscle"], patches: [], insertionBones: ["Scapula"] },
  { id: "trapezius-lower", depth: 1, meshes: ["Descending_part_of_trapezius_muscle"], patches: [], insertionBones: ["Scapula"] },
  { id: "latissimus-dorsi", depth: 1, meshes: ["Latissimus_dorsi_muscle"], patches: [], insertionBones: ["Humerus"] },
  { id: "deltoid-anterior", depth: 1, meshes: ["Clavicular_part_of_deltoid_muscle"], patches: ["Deltoid_muscle"], insertionBones: ["Humerus"] },
  { id: "deltoid-lateral", depth: 1, meshes: ["Acromial_part_of_deltoid_muscle"], patches: ["Deltoid_muscle"], insertionBones: ["Humerus"] },
  { id: "deltoid-posterior", depth: 1, meshes: ["Scapular_spinal_part_of_deltoid_muscle"], patches: ["Deltoid_muscle"], insertionBones: ["Humerus"] },
  { id: "rhomboid-major", depth: 2, meshes: ["Rhomboid_major_muscle"], patches: [], insertionBones: ["Scapula"] },
  { id: "rhomboid-minor", depth: 2, meshes: ["Rhomboid_minor_muscle"], patches: [], insertionBones: ["Scapula"] },
  { id: "levator-scapulae", depth: 2, meshes: ["Levator_scapulae"], patches: [], insertionBones: ["Scapula"] },
  { id: "teres-major", depth: 2, meshes: ["Teres_major_muscle"], patches: [], insertionBones: ["Humerus"] },
  { id: "teres-minor", depth: 2, meshes: ["Teres_minor_muscle"], patches: [], insertionBones: ["Humerus"] },
  { id: "infraspinatus", depth: 2, meshes: ["Infraspinatus_muscle"], patches: [], insertionBones: ["Humerus"] },
  { id: "supraspinatus", depth: 2, meshes: ["Supraspinatus_muscle"], patches: [], insertionBones: ["Humerus"] },
  {
    id: "erector-spinae",
    depth: 3,
    meshes: [
      "Iliocostalis_lumborum_muscle", "Iliocostalis_thoracis_muscle", "Iliocostalis_colli_muscle",
      "Longissimus_thoracis_muscle", "Longissimus_colli_muscle", "Longissimus_capitis_muscle",
      "Spinalis_thoracis_muscle", "Spinalis_colli_muscle", "Spinalis_capitis_muscle",
    ],
    patches: ["Erector_spinae"],
    // Z-Anatomy's o/e labels are consistent for these columns (pelvis/sacrum
    // origins; ribs, transverse processes, skull insertions): keep them.
    insertionBones: null,
  },
  { id: "subscapularis", depth: 3, meshes: ["Subscapularis_muscle"], patches: [], insertionBones: ["Humerus"] },
];

/** Non-selectable muscles shown for anatomical completeness (Arabic names). */
export const CONTEXT_MUSCLES = {
  // neck
  Sternocleidomastoid_muscle: "القصية الترقوية الخشائية",
  Splenius_capitis_muscle: "الطحالية الرأسية",
  Splenius_colli_muscle: "الطحالية العنقية",
  Semispinalis_colli_muscle: "شبه الشوكية العنقية",
  Semispinalis_thoracis_muscle: "شبه الشوكية الصدرية",
  Scalenus_anterior_muscle: "الأخمعية الأمامية",
  Scalenus_medius_muscle: "الأخمعية الوسطى",
  Scalenus_posterior_muscle: "الأخمعية الخلفية",
  Omohyoid_muscle: "الكتفية اللامية",
  Obliquus_superior_capitis_muscle: "المائلة الرأسية العلوية",
  Obliquus_inferior_capitis_muscle: "المائلة الرأسية السفلية",
  Rectus_posterior_major_capitis_muscle: "المستقيمة الرأسية الخلفية الكبرى",
  Rectus_posterior_minor_capitis_muscle: "المستقيمة الرأسية الخلفية الصغرى",
  // back (deep / intermediate)
  Serratus_posterior_superior_muscle: "المسننة الخلفية العلوية",
  Serratus_posterior_inferior_muscle: "المسننة الخلفية السفلية",
  Multifidus_colli_muscle: "متعددة الأقسام العنقية",
  Multifidus_thoracis_muscle: "متعددة الأقسام الصدرية",
  Multifidus_lumborum_muscle: "متعددة الأقسام القطنية",
  Interspinales_colli_muscles: "بين الشوكيات العنقية",
  Interspinales_thoracis_muscles: "بين الشوكيات الصدرية",
  Interspinales_lumborum_muscles: "بين الشوكيات القطنية",
  Levatores_breves_costarum: "رافعات الأضلاع القصيرة",
  Levatores_longi_costarum: "رافعات الأضلاع الطويلة",
  Quadratus_lumborum_muscle: "المربعة القطنية",
  // thorax
  Serratus_anterior_muscle: "المسننة الأمامية",
  External_intercostal_muscles: "الوربية الظاهرة",
  Pectoralis_minor_muscle: "الصدرية الصغرى",
  Clavicular_head_of_pectoralis_major_muscle: "الصدرية الكبرى — الرأس الترقوي",
  Sternocostal_head_of_pectoralis_major_muscle: "الصدرية الكبرى — الرأس القصي الضلعي",
  "(Abdominal_part_of_pectoralis_major_muscle)": "الصدرية الكبرى — الجزء البطني",
  Subclavius_muscle: "تحت الترقوة",
  // abdomen
  External_abdominal_oblique_muscle: "المائلة الخارجية للبطن",
  Rectus_abdominis_muscle: "المستقيمة البطنية",
  // arm
  Long_head_of_biceps_brachii: "ذات الرأسين العضدية — الرأس الطويل",
  Short_head_of_biceps_brachii: "ذات الرأسين العضدية — الرأس القصير",
  Brachialis_muscle: "العضدية",
  Coracobrachialis_muscle: "الغرابية العضدية",
  Long_head_of_triceps_brachii: "ثلاثية الرؤوس العضدية — الرأس الطويل",
  Lateral_head_of_triceps_brachii: "ثلاثية الرؤوس العضدية — الرأس الجانبي",
  Medial_head_of_triceps_brachii: "ثلاثية الرؤوس العضدية — الرأس الإنسي",
  // pelvis (lower boundary of the region)
  Gluteus_medius_muscle: "الألوية الوسطى",
  Gluteus_maximus_muscle: "الألوية الكبرى",
};

/** Tendons, aponeuroses, ligaments, capsules and bursae of the region. */
export const TENDONS = {
  Posterior_layer_of_thoracolumbar_fascia: "اللفافة الصدرية القطنية — الطبقة الخلفية",
  Middle_layer_of_thoracolumbar_fascia: "اللفافة الصدرية القطنية — الطبقة الوسطى",
  Anterior_layer_of_thoracolumbar_fascia: "اللفافة الصدرية القطنية — الطبقة الأمامية",
  Linea_alba: "الخط الأبيض",
  Articular_capsule_of_glenohumeral_joint: "محفظة المفصل الحقاني العضدي",
  Coracohumeral_ligament: "الرباط الغرابي العضدي",
  Superior_glenohumeral_ligament: "الرباط الحقاني العضدي العلوي",
  Middle_glenohumeral_ligament: "الرباط الحقاني العضدي الأوسط",
  Inferior_glenohumeral_ligament: "الرباط الحقاني العضدي السفلي",
  Glenoid_labrum: "الشفا الحقاني",
  Transverse_humeral_ligament: "الرباط العضدي المستعرض",
  Intertubercular_tendon_sheath: "غمد وتر ذات الرأسين بين الحدبتين",
  Acromioclavicular_ligament: "الرباط الأخرمي الترقوي",
  Articular_capsule_of_acromioclavicular_joint: "محفظة المفصل الأخرمي الترقوي",
  Conoid_ligament: "الرباط المخروطي",
  Trapezoid_ligament: "الرباط شبه المنحرف",
  Articular_capsule_of_sternoclavicular_joint: "محفظة المفصل القصي الترقوي",
  Subacromial_bursa: "الجراب تحت الأخرم",
  Subdeltoid_bursa: "الجراب تحت الدالية",
  Nuchal_ligament: "الرباط القفوي",
  Supraspinous_ligament: "الرباط فوق الشوكي",
  Interspinous_ligaments: "الأربطة بين الشوكية",
  Costotransverse_ligament: "الرباط الضلعي المستعرض",
};

/** Nerves of the region (peripheral nerves of the back, shoulder and arm). */
export const NERVES = {
  "Accessory_nerve_(XI)": "العصب الإضافي (القحفي الحادي عشر)",
  Dorsal_scapular_nerve: "العصب الكتفي الظهري",
  Suprascapular_nerve: "العصب فوق الكتفي",
  Axillary_nerve: "العصب الإبطي",
  Muscular_branches_of_axillary_nerve: "الفروع العضلية للعصب الإبطي",
  Superior_lateral_brachial_cutaneous_nerve: "العصب الجلدي العضدي الوحشي العلوي",
  Superior_subscapular_nerve: "العصب تحت الكتفي العلوي",
  Inferior_subscapular_nerve: "العصب تحت الكتفي السفلي",
  Thoracodorsal_nerve: "العصب الصدري الظهري",
  Long_thoracic_nerve: "العصب الصدري الطويل",
  Roots_of_brachial_plexus: "جذور الضفيرة العضدية",
  Superior_trunk_of_brachial_plexus: "الجذع العلوي للضفيرة العضدية",
  Middle_trunk_of_brachial_plexus: "الجذع الأوسط للضفيرة العضدية",
  Inferior_trunk_of_brachial_plexus: "الجذع السفلي للضفيرة العضدية",
  Anterior_division_of_superior_trunk_of_brachial_plexus: "الشعبة الأمامية للجذع العلوي",
  Anterior_division_of_middle_trunk_of_brachial_plexus: "الشعبة الأمامية للجذع الأوسط",
  Anterior_division_of_inferior_trunk_of_brachial_plexus: "الشعبة الأمامية للجذع السفلي",
  Posterior_division_of_superior_trunk_of_brachial_plexus: "الشعبة الخلفية للجذع العلوي",
  Posterior_division_of_middle_trunk_of_brachial_plexus: "الشعبة الخلفية للجذع الأوسط",
  Posterior_division_of_inferior_trunk_of_brachial_plexus: "الشعبة الخلفية للجذع السفلي",
  Posterior_cord_of_brachial_plexus: "الحبل الخلفي للضفيرة العضدية",
  Radial_nerve: "العصب الكعبري",
  Muscular_branches_of_radial_nerve: "الفروع العضلية للعصب الكعبري",
  Musculocutaneous_nerve: "العصب العضلي الجلدي",
  Median_nerve: "العصب الناصف",
  Ulnar_nerve: "العصب الزندي",
  Medial_pectoral_nerve: "العصب الصدري الإنسي",
  Lateral_pectoral_nerve: "العصب الصدري الوحشي",
  Medial_brachial_cutaneous_nerve: "العصب الجلدي العضدي الإنسي",
  Subclavian_nerve: "العصب تحت الترقوي",
  Intercostal_nerves: "الأعصاب الوربية",
};

const ORD = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
const ORD_AR = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];

/** Bones of the region with Arabic names. */
export const BONES = {
  Scapula: "لوح الكتف",
  Clavicle: "الترقوة",
  Humerus: "العضد",
  Manubrium_of_sternum: "مقبض القص",
  Body_of_sternum: "جسم القص",
  Xiphoid_process: "الناتئ الرهابي",
  Hip_bone: "عظم الورك",
  Sacrum: "العجز",
  Coccyx: "العصعص",
  "Atlas_(C1)": "الفقرة العنقية الأولى (الفهقة)",
  "Axis_(C2)": "الفقرة العنقية الثانية (المحور)",
  Occipital_bone: "العظم القذالي",
  Parietal_bone: "العظم الجداري",
  Temporal_bone: "العظم الصدغي",
  Frontal_bone: "العظم الجبهي",
  Sphenoid_bone: "العظم الوتدي",
  Mandible: "الفك السفلي",
  Maxilla: "الفك العلوي",
  Zygomatic_bone: "العظم الوجني",
  Nasal_bone: "عظم الأنف",
  Hyoid_bone: "العظم اللامي",
};
for (let i = 3; i <= 7; i++) BONES[`Vertebra_C${i}`] = `الفقرة العنقية ${ORD_AR[i - 1]}`;
for (let i = 1; i <= 12; i++) BONES[`Vertebra_T${i}`] = `الفقرة الصدرية ${ORD_AR[i - 1]}`;
for (let i = 1; i <= 5; i++) BONES[`Vertebra_L${i}`] = `الفقرة القطنية ${ORD_AR[i - 1]}`;
ORD.forEach((o, i) => {
  BONES[`${o}_rib`] = `الضلع ${ORD_AR[i]}`;
  if (i < 10) BONES[`Costal_cartilage_of_${o.toLowerCase()}_rib`] = `الغضروف الضلعي ${ORD_AR[i]}`;
});

/** Intervertebral discs: shown with the skeleton. */
export const DISC_PATTERN = /^Intervertebral_disc_(C|T|L)\d+-(C|T|L|S)\d+$/;

export const SIDE_MODE = SIDE;
