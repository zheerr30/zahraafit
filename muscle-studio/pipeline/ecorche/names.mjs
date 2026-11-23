// Names of the Écorché model's parts in the atlas.
//
// Every object of the model is linked to the id the atlas already uses for that structure
// (the ids of the exercise groups, of saved links and of the links coming from the ZahraaFit
// app), so `?muscle=<id>` keeps working. Where the model has one mesh for a muscle the
// previous body split into parts (trapezius, biceps, triceps, …), the mesh gets one id and
// the old part ids are listed as `aliases`: they resolve to it.
//
// [object name in the model]: [id, kind, region, Arabic name, English name, aliases?]
//   kind: unit (a muscle) | tendon | fascia | ligament — the layer it belongs to
//   Arabic names without diacritics (the interface shows none).

const U = (id, region, ar, en, aliases = [], depth = 1) => ({ id, kind: "unit", region, ar, en, aliases, depth });
const T = (id, kind, region, ar, en) => ({ id, kind, region, ar, en, aliases: [], depth: 1 });

export const MUSCLES = {
  // ── head and neck ──
  Frontalis: U("frontalis-muscle", "head-neck", "الجبهية", "Frontalis"),
  Occipitalis: U("occipitalis-muscle", "head-neck", "القذالية", "Occipitalis"),
  "Epicranial_Aponeurosis.001": T("Epicranial_aponeurosis", "tendon", "head-neck", "السفاق القحفي", "Epicranial aponeurosis"),
  Temporalis: U("temporalis-muscle", "head-neck", "الصدغية", "Temporalis"),
  Masseter: U("masseter-muscle", "head-neck", "الماضغة", "Masseter", ["superficial-part-of-masseter", "deep-part-of-masseter"]),
  Deep_Head_of_Medial_Pterygoid: U("medial-pterygoid-muscle", "head-neck", "الجناحية الإنسية", "Medial pterygoid"),
  Buccinator: U("bucinator", "head-neck", "المبوقة", "Buccinator"),
  Orbicularis_Oculi: U("orbicularis-oculi", "head-neck", "الدويرية العينية", "Orbicularis oculi", ["orbital-part-of-orbicularis-oculi", "palpebral-part-of-orbicularis-oculi"]),
  Orbicularis_Oris: U("orbicularis-oris-muscle", "head-neck", "الدويرية الفموية", "Orbicularis oris"),
  Corrugator_Supercilii: U("corrugator-supercilii", "head-neck", "المجعدة للحاجب", "Corrugator supercilii"),
  Procerus: U("procerus-muscle", "head-neck", "الهرمية الأنفية", "Procerus"),
  Nasalis: U("nasalis-muscle", "head-neck", "الأنفية", "Nasalis"),
  Alar_Nasalis: U("alar-part-of-nasalis", "head-neck", "الأنفية — الجزء الجناحي", "Nasalis, alar part"),
  Compressor_Narium_Minor: U("compressor-narium-minor", "head-neck", "ضاغطة المنخر الصغرى", "Compressor narium minor"),
  Dilator_Naris_Anterior: U("dilator-naris-anterior", "head-neck", "موسعة المنخر الأمامية", "Dilator naris anterior"),
  Depressor_Nasi: U("depressor-septi-nasi", "head-neck", "خافضة الحاجز الأنفي", "Depressor septi nasi"),
  Levator_Labii_Superioris_Alaeque_Nasi: U("levator-nasolabialis", "head-neck", "رافعة الشفة العليا وجناح الأنف", "Levator labii superioris alaeque nasi"),
  Levator_Labii_Superioris: U("levator-labii-superioris", "head-neck", "رافعة الشفة العليا", "Levator labii superioris"),
  Levator_Anguli_Oris: U("levator-anguli-oris", "head-neck", "رافعة زاوية الفم", "Levator anguli oris"),
  Zygomaticus_Major: U("zygomaticus-major-muscle", "head-neck", "الوجنية الكبرى", "Zygomaticus major"),
  Zygomaticus_Minor: U("zygomaticus-minor-muscle", "head-neck", "الوجنية الصغرى", "Zygomaticus minor"),
  Risotius: U("risorius-muscle", "head-neck", "الضاحكة", "Risorius"),
  Depressor_Anguli_Oris: U("depressor-anguli-oris", "head-neck", "خافضة زاوية الفم", "Depressor anguli oris"),
  Depressor_Labii_Inferioris: U("depressor-labii-inferioris", "head-neck", "خافضة الشفة السفلى", "Depressor labii inferioris"),
  Mentalis: U("mentalis-muscle", "head-neck", "الذقنية", "Mentalis"),
  Parotid_Gland: T("Parotid_gland", "fascia", "head-neck", "الغدة النكفية", "Parotid gland"),
  Platysma: U("platysma", "head-neck", "الجلدية العنقية", "Platysma"),
  Sternocleidomastoid: U("sternocleidomastoid-muscle", "head-neck", "القصية الترقوية الخشائية", "Sternocleidomastoid"),
  Anterior_Scalene: U("scalenus-anterior-muscle", "head-neck", "الأخمعية الأمامية", "Scalenus anterior"),
  Middle_Scalene: U("scalenus-medius-muscle", "head-neck", "الأخمعية الوسطى", "Scalenus medius"),
  Posterior_Scalene: U("scalenus-posterior-muscle", "head-neck", "الأخمعية الخلفية", "Scalenus posterior"),
  Digastric: U("digastric-muscle", "head-neck", "ذات البطنين", "Digastric", ["anterior-belly-of-digastric-muscle", "posterior-belly-of-digastric-muscle"]),
  Fibrous_Loop_For_Intermediate_Digastric_Tendon: T("Fibrous_loop_of_digastric", "tendon", "head-neck", "العروة الليفية لوتر ذات البطنين", "Fibrous loop for the digastric tendon"),
  Mylohyoid: U("mylohyoid-muscle", "head-neck", "الضرسية اللامية", "Mylohyoid"),
  Stylohyoid: U("stylohyoid-muscle", "head-neck", "الإبرية اللامية", "Stylohyoid"),
  Hyoglossus: U("hyoglossus-muscle", "head-neck", "اللامية اللسانية", "Hyoglossus"),
  Sternohyoid: U("sternohyoid-muscle", "head-neck", "القصية اللامية", "Sternohyoid"),
  Thyrohyoid: U("thyrohyoid-muscle", "head-neck", "الدرقية اللامية", "Thyrohyoid"),
  Superior_Belly_of_Omohyoid: U("omohyoid-muscle", "head-neck", "الكتفية اللامية", "Omohyoid"),
  Middle_Pharyngeal_Constrictor: U("middle-pharyngeal-constrictor", "head-neck", "العاصرة البلعومية الوسطى", "Middle pharyngeal constrictor"),
  Inferior_Pharyngeal_Constrictor: U("inferior-pharyngeal-constrictor", "head-neck", "العاصرة البلعومية السفلية", "Inferior pharyngeal constrictor"),
  Splenius_Capitis: U("splenius-capitis-muscle", "head-neck", "الطحالية الرأسية", "Splenius capitis"),
  Splenius_Cervicis: U("splenius-colli-muscle", "head-neck", "الطحالية العنقية", "Splenius cervicis"),
  Semispinalis_Capitis: U("semispinalis-capitis", "head-neck", "شبه الشوكية الرأسية", "Semispinalis capitis"),

  // ── back ──
  Trapezius: U("trapezius", "back", "شبه المنحرفة", "Trapezius", ["trapezius-upper", "trapezius-middle", "trapezius-lower"]),
  Latissimus_Dorsi: U("latissimus-dorsi", "back", "الظهرية العريضة", "Latissimus dorsi"),
  Rhomboid_Major: U("rhomboid-major", "back", "المعينية", "Rhomboid", ["rhomboid-minor"]),
  Levator_Scapulae: U("levator-scapulae", "back", "الرافعة للوح الكتف", "Levator scapulae"),
  Longissimus_Thoracis: U("erector-spinae", "back", "ناصبة الفقار", "Erector spinae"),
  Longissimus_Lumborum: U("erector-spinae", "back", "ناصبة الفقار", "Erector spinae"),

  // ── shoulders ──
  Deltoid_Front: U("deltoid-anterior", "shoulders", "الدالية — الرأس الأمامي", "Deltoid, anterior head"),
  Deltoid_Middle: U("deltoid-lateral", "shoulders", "الدالية — الرأس الأوسط", "Deltoid, lateral head"),
  Deltoid_Back: U("deltoid-posterior", "shoulders", "الدالية — الرأس الخلفي", "Deltoid, posterior head"),
  Supraspinatus: U("supraspinatus", "shoulders", "فوق الشوكة", "Supraspinatus"),
  infraspinatus: U("infraspinatus", "shoulders", "تحت الشوكة", "Infraspinatus"),
  Teres_Minor: U("teres-minor", "shoulders", "المدورة الصغيرة", "Teres minor"),
  Teres_Major: U("teres-major", "shoulders", "المدورة الكبيرة", "Teres major"),

  // ── chest ──
  "Pectoralis_Major_(Sternocostalis)": U("sternocostal-head-of-pectoralis-major-muscle", "chest", "الصدرية الكبرى — الرأس القصي الضلعي", "Pectoralis major, sternocostal head"),
  Pars_Clavicularis: U("clavicular-head-of-pectoralis-major-muscle", "chest", "الصدرية الكبرى — الرأس الترقوي", "Pectoralis major, clavicular head"),
  Pars_Abdominalis: U("abdominal-part-of-pectoralis-major-muscle", "chest", "الصدرية الكبرى — الجزء البطني", "Pectoralis major, abdominal part"),
  Pectoralis_Minor: U("pectoralis-minor-muscle", "chest", "الصدرية الصغرى", "Pectoralis minor"),
  Serratus_Anterior: U("serratus-anterior-muscle", "chest", "المنشارية الأمامية", "Serratus anterior"),

  // ── abdomen ──
  Rectus_Abdominis: U("rectus-abdominis-muscle", "abdomen", "المستقيمة البطنية", "Rectus abdominis"),
  "External Oblique": U("external-abdominal-oblique-muscle", "abdomen", "المائلة الخارجية للبطن", "External oblique"),

  // ── arms ──
  Biceps_Brachii: U("biceps-brachii", "arms", "ذات الرأسين العضدية", "Biceps brachii", ["long-head-of-biceps-brachii", "short-head-of-biceps-brachii"]),
  Bicipital_Aponeurosis: T("Bicipital_aponeurosis", "tendon", "arms", "السفاق ذو الرأسين", "Bicipital aponeurosis"),
  Brachialis: U("brachialis-muscle", "arms", "العضدية", "Brachialis"),
  Coracobrachialis: U("coracobrachialis-muscle", "arms", "الغرابية العضدية", "Coracobrachialis"),
  Triceps_Brachii: U("triceps-brachii", "arms", "ثلاثية الرؤوس العضدية", "Triceps brachii", ["long-head-of-triceps-brachii", "lateral-head-of-triceps-brachii", "medial-head-of-triceps-brachii"]),
  Anconeus: U("anconeus-muscle", "arms", "المرفقية", "Anconeus"),
  Brachioradialis: U("brachioradialis-muscle", "arms", "العضدية الكعبرية", "Brachioradialis"),
  Pronator_Teres: U("pronator-teres", "arms", "الكابة المدورة", "Pronator teres", ["superficial-head-of-pronator-teres", "deep-head-of-pronator-teres"]),
  Pronator_Quadratus: U("pronator-quadratus", "arms", "الكابة المربعة", "Pronator quadratus"),
  Flexor_Carpi_Radialis: U("flexor-carpi-radialis", "arms", "المثنية الكعبرية للرسغ", "Flexor carpi radialis"),
  Flexor_Carpi_Ulnaris: U("flexor-carpi-ulnaris", "arms", "المثنية الزندية للرسغ", "Flexor carpi ulnaris", ["humeral-head-of-flexor-carpi-ulnaris", "ulnar-head-of-flexor-carpi-ulnaris"]),
  Palmaris_Longus: U("palmaris-longus-muscle", "arms", "الراحية الطويلة", "Palmaris longus"),
  Palmaris_Brevis: U("palmaris-brevis", "arms", "الراحية القصيرة", "Palmaris brevis"),
  Palmar_Aponeurosis: T("Palmar_aponeurosis", "tendon", "arms", "السفاق الراحي", "Palmar aponeurosis"),
  Flexor_Digitorum_Superficialis: U("flexor-digitorum-superficialis", "arms", "المثنية السطحية للأصابع", "Flexor digitorum superficialis", ["humero-ulnar-head-of-flexor-digitorum-superficialis", "radial-head-of-flexor-digitorum-superficialis"]),
  Flexor_Digitorum_Profundus: U("flexor-digitorum-profundus", "arms", "المثنية العميقة للأصابع", "Flexor digitorum profundus"),
  Flexor_Pollicis_Longus: U("flexor-pollicis-longus", "arms", "المثنية الطويلة للإبهام", "Flexor pollicis longus"),
  Extensor_Carpi_Radialis_Longus: U("extensor-carpi-radialis-longus", "arms", "الباسطة الكعبرية الطويلة للرسغ", "Extensor carpi radialis longus"),
  Extensor_Carpi_Radialis_Brevis: U("extensor-carpi-radialis-brevis", "arms", "الباسطة الكعبرية القصيرة للرسغ", "Extensor carpi radialis brevis"),
  Extensor_Carpi_Ulnaris: U("extensor-carpi-ulnaris", "arms", "الباسطة الزندية للرسغ", "Extensor carpi ulnaris", ["humeral-head-of-extensor-carpi-ulnaris", "ulnar-head-of-extensor-carpi-ulnaris"]),
  Extensor_Digitorum: U("extensor-digitorum", "arms", "باسطة الأصابع", "Extensor digitorum"),
  Extensor_Digiti_Minimi: U("extensor-digiti-minimi", "arms", "باسطة الخنصر", "Extensor digiti minimi"),
  Extensor_Indicis: U("extensor-indicis", "arms", "باسطة السبابة", "Extensor indicis"),
  Extensor_Pollicis_Longus: U("extensor-pollicis-longus", "arms", "الباسطة الطويلة للإبهام", "Extensor pollicis longus"),
  Extensor_Pollicis_Brevis: U("extensor-pollicis-brevis", "arms", "الباسطة القصيرة للإبهام", "Extensor pollicis brevis"),
  Abductor_Pollicis_Longus: U("abductor-pollicis-longus", "arms", "المبعدة الطويلة للإبهام", "Abductor pollicis longus"),
  Extensor_Retinaculum: T("Extensor_retinaculum_of_wrist", "fascia", "arms", "قيد الباسطات في الرسغ", "Extensor retinaculum"),
  Abductor_Pollicis_Brevis: U("abductor-pollicis-brevis", "arms", "المبعدة القصيرة للإبهام", "Abductor pollicis brevis"),
  Abductor_Pollicis: U("adductor-pollicis", "arms", "المقربة للإبهام", "Adductor pollicis", ["oblique-head-of-adductor-pollicis", "transverse-head-of-adductor-pollicis"]),
  Flexor_Pollicis_Brevis: U("flexor-pollicis-brevis", "arms", "المثنية القصيرة للإبهام", "Flexor pollicis brevis", ["superficial-head-of-flexor-pollicis-brevis", "deep-head-of-flexor-pollicis-brevis"]),
  Opponens_Pollicis: U("opponens-pollicis-muscle", "arms", "المقابلة للإبهام", "Opponens pollicis"),
  Abductor_Digiti_Minimi: U("abductor-digiti-minimi-of-hand", "arms", "المبعدة لخنصر اليد", "Abductor digiti minimi"),
  Flexor_Digiti_Minimi_Brevis: U("flexor-digiti-minimi-of-hand", "arms", "المثنية القصيرة لخنصر اليد", "Flexor digiti minimi brevis"),
  Opponens_Digiti_Minimi: U("opponens-digiti-minimi-muscle-of-hand", "arms", "المقابلة لخنصر اليد", "Opponens digiti minimi"),
  Dorsal_Interosseous: U("dorsal-interossei-muscles-of-hand", "arms", "بين العظام الظهرية لليد", "Dorsal interossei of hand"),
  Third_Lumbrical: U("lumbrical-muscles-of-hand", "arms", "الخراطينية لليد", "Lumbricals of hand"),
  Fourth_Lumbrical: U("lumbrical-muscles-of-hand", "arms", "الخراطينية لليد", "Lumbricals of hand"),

  // ── pelvis and hip ──
  Gluteus_Maximus: U("gluteus-maximus-muscle", "pelvis", "الألوية الكبرى", "Gluteus maximus"),
  Gluteus_Medius: U("gluteus-medius-muscle", "pelvis", "الألوية الوسطى", "Gluteus medius"),
  Gluteus_Minimus: U("gluteus-minimus-muscle", "pelvis", "الألوية الصغرى", "Gluteus minimus"),
  Tensor_Fasciae_Latae: U("tensor-fasciae-latae", "pelvis", "موترة اللفافة العريضة", "Tensor fasciae latae"),
  Iliacus: U("iliacus-muscle", "pelvis", "الحرقفية", "Iliacus"),
  Psoas_Major: U("psoas-major", "pelvis", "القطنية الكبرى", "Psoas major"),
  "Iliotibial_Tract_(IT_Band)": T("Iliotibial_tract", "fascia", "thigh", "السبيل الحرقفي الظنبوبي", "Iliotibial tract"),
  "Iliotibial_Tract_(IT_Band)_2": T("Iliotibial_tract", "fascia", "thigh", "السبيل الحرقفي الظنبوبي", "Iliotibial tract"),

  // ── thigh ──
  Rectus_Femoris: U("rectus-femoris-muscle", "thigh", "المستقيمة الفخذية", "Rectus femoris"),
  Vastus_Lateralis: U("vastus-lateralis-muscle", "thigh", "المتسعة الوحشية", "Vastus lateralis"),
  Vastus_medialis: U("vastus-medialis-muscle", "thigh", "المتسعة الإنسية", "Vastus medialis"),
  Sartorius: U("sartorius-muscle", "thigh", "الخياطية", "Sartorius"),
  "Biceps_Femoris_(Long_Head)": U("long-head-of-biceps-femoris", "thigh", "ذات الرأسين الفخذية — الرأس الطويل", "Biceps femoris, long head"),
  "Biceps_Femoris_(Short_Head)": U("short-head-of-biceps-femoris", "thigh", "ذات الرأسين الفخذية — الرأس القصير", "Biceps femoris, short head"),
  Semitendinosus: U("semitendinosus-muscle", "thigh", "وترية النصف", "Semitendinosus"),
  Semimembranosus: U("semimembranosus-muscle", "thigh", "غشائية النصف", "Semimembranosus"),
  Fibrous_Joint_Capsule_of_knee: T("Fibrous_capsule_of_knee", "ligament", "thigh", "المحفظة الليفية لمفصل الركبة", "Fibrous capsule of the knee"),

  // ── adductors ──
  Adductor_Longus: U("adductor-longus", "adductors", "المقربة الطويلة", "Adductor longus"),
  "Adductor Magnus": U("adductor-magnus", "adductors", "المقربة الكبرى", "Adductor magnus"),
  Gracilis: U("gracilis-muscle", "adductors", "الناحلة", "Gracilis"),
  Pectineus: U("pectineus-muscle", "adductors", "العانية (المشطية)", "Pectineus"),

  // ── leg and foot ──
  Gastrocnemius_Medial_Head: U("medial-head-of-gastrocnemius", "legs", "الساقية البطنية — الرأس الإنسي", "Gastrocnemius, medial head"),
  Gastrocnemius_Lateral_Head: U("lateral-head-of-gastrocnemius", "legs", "الساقية البطنية — الرأس الوحشي", "Gastrocnemius, lateral head"),
  Soleus: U("soleus-muscle", "legs", "النعلية", "Soleus"),
  Calcaneal_Or_Achillies_Tendon: T("Calcaneal_tendon", "tendon", "legs", "وتر العرقوب (أخيل)", "Calcaneal (Achilles) tendon"),
  Tibialis_Anterior: U("tibialis-anterior-muscle", "legs", "الظنبوبية الأمامية", "Tibialis anterior"),
  Tibialis_Posterior_Tender_Sheath: T("Tibialis_posterior_tendon_sheath", "tendon", "legs", "غمد وتر الظنبوبية الخلفية", "Tibialis posterior tendon sheath"),
  Extensor_Digitorum_Longus: U("extensor-digitorum-longus", "legs", "الباسطة الطويلة لأصابع القدم", "Extensor digitorum longus"),
  Extensor_Hallucis_Longus: U("extensor-hallucis-longus", "legs", "الباسطة الطويلة لإبهام القدم", "Extensor hallucis longus"),
  Fibularis_Longus: U("fibularis-longus-muscle", "legs", "الشظوية الطويلة", "Fibularis longus"),
  Fibularis_revis: U("fibularis-brevis-muscle", "legs", "الشظوية القصيرة", "Fibularis brevis"),
  Fibularis_Tertius: U("fibularis-tertius-muscle", "legs", "الشظوية الثالثة", "Fibularis tertius"),
  Flexor_Digitorum_Longus: U("flexor-digitorum-longus", "legs", "المثنية الطويلة لأصابع القدم", "Flexor digitorum longus"),
  Flexor_Hallucis_Longus: U("flexor-hallucis-longus", "legs", "المثنية الطويلة لإبهام القدم", "Flexor hallucis longus"),
  Superior_Extensor_Retinaculum: T("Superior_extensor_retinaculum", "fascia", "legs", "قيد الباسطات العلوي في الكاحل", "Superior extensor retinaculum"),
  Inferior_Extensor_Retinaculum: T("Inferior_extensor_retinaculum", "fascia", "legs", "قيد الباسطات السفلي في الكاحل", "Inferior extensor retinaculum"),
  Extensor_Digitorum_Feet: U("extensor-digitorum-brevis", "legs", "الباسطة القصيرة لأصابع القدم", "Extensor digitorum brevis"),
  Abductor_Hallucis: U("abductor-hallucis", "legs", "المبعدة لإبهام القدم", "Abductor hallucis"),
  Abductor_Digiti_Minimi_Of_Foot: U("abductor-digiti-minimi-of-foot", "legs", "المبعدة لخنصر القدم", "Abductor digiti minimi of foot"),
  Flexor_Digitorum_Brevis: U("flexor-digitorum-brevis", "legs", "المثنية القصيرة لأصابع القدم", "Flexor digitorum brevis"),
  Dorsal_Interossei_Of_Foot: U("dorsal-interossei-muscles-of-foot", "legs", "بين العظام الظهرية للقدم", "Dorsal interossei of foot"),
  Merged_Fibula3: T("Fibular_tendons", "tendon", "legs", "أوتار الشظويتين عند الكاحل", "Fibular tendons at the ankle"),
};

// Objects of the model that are left out of the atlas altogether.
//   Butt: the perineal / genital block of the muscle layer.
export const REMOVED = new Set(["Butt"]);

const C = (id, ar, en, region = "head-neck") => ({ id, kind: "tendon", region, ar, en, aliases: [], depth: 1 });
export const CARTILAGES = {
  Auricular_Cartilage: C("Auricular_cartilage", "غضروف الأذن", "Auricular cartilage"),
  Lateral: C("Lateral_nasal_cartilage", "الغضروف الأنفي الجانبي", "Lateral nasal cartilage"),
  Major_Alar: C("Major_alar_cartilage", "الغضروف الجناحي الكبير", "Major alar cartilage"),
  Minor_Alar: C("Minor_alar_cartilage", "الغضاريف الجناحية الصغيرة", "Minor alar cartilages"),
  Spetal: C("Nasal_septal_cartilage", "غضروف الحاجز الأنفي", "Septal nasal cartilage"),
  Fibro_Fatty_Tissue: C("Alar_fibrofatty_tissue", "النسيج الليفي الدهني لجناح الأنف", "Alar fibro-fatty tissue"),
  Hyoid: C("Hyoid_bone", "العظم اللامي", "Hyoid bone"),
  Thyroid_Cartilage: C("Thyroid_cartilage", "الغضروف الدرقي", "Thyroid cartilage"),
  Cricoid_Cartilage: C("Cricoid_cartilage", "الغضروف الحلقي", "Cricoid cartilage"),
  Thyroid_Membrane_And_Median_Thyrohyoid_Ligament: C("Thyrohyoid_membrane", "الغشاء الدرقي اللامي", "Thyrohyoid membrane"),
  "Cricotracheal And Cricothyroid Ligament.obj R": C("Cricothyroid_ligament", "الرباط الحلقي الدرقي والحلقي الرغامي", "Cricothyroid and cricotracheal ligaments"),
  Trachea: C("Trachea", "الرغامى (القصبة الهوائية)", "Trachea"),
};

const B = (id, ar, en, region) => ({ id, kind: "bone", region, ar, en, aliases: [], depth: 1 });
export const BONES = {
  Cranium: B("Cranium", "الجمجمة", "Cranium", "head-neck"),
  Mandible: B("Mandible", "الفك السفلي", "Mandible", "head-neck"),
  Upper_Teeth: B("Upper_teeth", "الأسنان العلوية", "Upper teeth", "head-neck"),
  Lower_Teeth: B("Lower_teeth", "الأسنان السفلية", "Lower teeth", "head-neck"),
  Cervical: B("Cervical_vertebrae", "الفقرات العنقية", "Cervical vertebrae", "head-neck"),
  Thoracic: B("Thoracic_vertebrae", "الفقرات الصدرية", "Thoracic vertebrae", "back"),
  Lumbar: B("Lumbar_vertebrae", "الفقرات القطنية", "Lumbar vertebrae", "back"),
  Vertebral_Disc: B("Intervertebral_discs", "الأقراص بين الفقرات", "Intervertebral discs", "back"),
  Sacrum: B("Sacrum", "العجز", "Sacrum", "pelvis"),
  Coccyx: B("Coccyx", "العصعص", "Coccyx", "pelvis"),
  Pelvis: B("Hip_bone", "عظم الورك", "Hip bone", "pelvis"),
  Pubic_symphysis: B("Pubic_symphysis", "الارتفاق العاني", "Pubic symphysis", "pelvis"),
  Rib_Cage: B("Ribs", "الأضلاع", "Ribs", "chest"),
  Costal_Cartilage: B("Costal_cartilages", "الغضاريف الضلعية", "Costal cartilages", "chest"),
  Manubrium_Sterni: B("Manubrium_of_sternum", "قبضة القص", "Manubrium of sternum", "chest"),
  Body_Sternum: B("Body_of_sternum", "جسم القص", "Body of sternum", "chest"),
  Xiphoid_Process: B("Xiphoid_process", "الناتئ الرهابي", "Xiphoid process", "chest"),
  Clavicle: B("Clavicle", "الترقوة", "Clavicle", "shoulders"),
  Scapula: B("Scapula", "لوح الكتف", "Scapula", "shoulders"),
  Humerus: B("Humerus", "العضد", "Humerus", "arms"),
  Radius: B("Radius", "الكعبرة", "Radius", "arms"),
  Ulna: B("Ulna", "الزند", "Ulna", "arms"),
  Hand: B("Bones_of_hand", "عظام اليد", "Bones of the hand", "arms"),
  Femur: B("Femur", "عظم الفخذ", "Femur", "thigh"),
  Patella: B("Patella", "الرضفة", "Patella", "thigh"),
  Tibia: B("Tibia", "الظنبوب", "Tibia", "legs"),
  Fibula: B("Fibula", "الشظية", "Fibula", "legs"),
  Foot: B("Bones_of_foot", "عظام القدم", "Bones of the foot", "legs"),
};

const F = (id, ar, en, region) => ({ id, kind: "fat", region, ar, en, aliases: [], depth: 1 });
export const FAT = {
  Abdominal_Fat_Pad: F("Abdominal_fat", "دهون البطن", "Abdominal fat pad", "abdomen"),
  Flank: F("Flank_fat", "دهون الخاصرة", "Flank fat pad", "abdomen"),
  Chest_Fat_Pad: F("Chest_fat", "دهون الصدر", "Chest fat pad", "chest"),
  Breasts: F("Breast", "الثدي", "Breast", "chest"),
  Pubic_Fat_Pad: F("Pubic_fat", "دهون العانة", "Pubic fat pad", "pelvis"),
  Posterior_Gluteal: F("Gluteal_fat", "دهون الألية", "Gluteal fat pad", "pelvis"),
  Posterior_Gluteal1: F("Gluteal_fat", "دهون الألية", "Gluteal fat pad", "pelvis"),
  Posterior_Gluteal2: F("Gluteal_fat", "دهون الألية", "Gluteal fat pad", "pelvis"),
  "Posterior_Gluteal-Fmale": F("Gluteal_fat", "دهون الألية", "Gluteal fat pad", "pelvis"),
  Lateral_Gluteal: F("Lateral_gluteal_fat", "دهون الورك الجانبية", "Lateral gluteal fat pad", "pelvis"),
  Rhombus_of_Michaelis: F("Sacral_fat", "دهون أسفل الظهر", "Sacral fat pad", "back"),
  Inner_Thigh: F("Inner_thigh_fat", "دهون الفخذ الداخلية", "Inner thigh fat pad", "adductors"),
  Outer_Thigh: F("Outer_thigh_fat", "دهون الفخذ الخارجية", "Outer thigh fat pad", "thigh"),
  Infrapatellar_Fat_Pad: F("Infrapatellar_fat", "الوسادة الدهنية تحت الرضفة", "Infrapatellar fat pad", "thigh"),
  Popliteal_Fat_Pad: F("Popliteal_fat", "الوسادة الدهنية المأبضية", "Popliteal fat pad", "thigh"),
  Fat_Kagers: F("Kager_fat", "وسادة كاغر الدهنية (خلف الكاحل)", "Kager's fat pad", "legs"),
  Foot_Fat_Pads: F("Foot_fat", "الوسائد الدهنية للقدم", "Fat pads of the foot", "legs"),
};
// The fat compartments of the face: one structure in the atlas.
for (const n of ["Central_Forehead", "Middle_Forehead", "Lateral_Temporal", "Superior_Orbital", "Inferior_Orbital", "Lateral_Orbital", "Medial_Cheek", "Middle_Cheek", "Nasolabial", "Superior_Jowl", "Inferior_Jowl", "Submandibular_Jowl", "Mental", "Inferior_Mental", "Submental"])
  FAT[n] = F("Facial_fat", "الوسائد الدهنية للوجه", "Facial fat compartments", "head-neck");

export const OTHER = {
  Veins: { id: "Superficial_veins", kind: "vessel", region: "other", ar: "الأوردة السطحية", en: "Superficial veins", aliases: [], depth: 1 },
  Body: { id: "Skin", kind: "skin", region: "other", ar: "الجلد", en: "Skin", aliases: [], depth: 1 },
  Underwear: { id: "Skin", kind: "skin", region: "other", ar: "الجلد", en: "Skin", aliases: [], depth: 1 },
  "Female-Clothes": { id: "Skin", kind: "skin", region: "other", ar: "الجلد", en: "Skin", aliases: [], depth: 1 },
  EyeBalls: { id: "Eyeball", kind: "tendon", region: "head-neck", ar: "مقلة العين", en: "Eyeball", aliases: [], depth: 1 },
  "EyeBalls:Iris": { id: "Eyeball", kind: "tendon", region: "head-neck", ar: "مقلة العين", en: "Eyeball", aliases: [], depth: 1 },
};

/** Record of a model object, or null when it is not part of the atlas. */
export function nameOf(collection, object) {
  if (REMOVED.has(object)) return null;
  const table = collection === "Muscles" ? MUSCLES : collection === "Cartilages" ? CARTILAGES : collection === "Skull" || collection === "Bones" ? BONES : collection === "Fat Pads" ? FAT : OTHER;
  const r = table[object];
  if (!r) throw new Error(`no name for ${collection} / ${object}`);
  return r;
}
