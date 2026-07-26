/* ============================================================
   ZahraaFit — نقطة الذكاء الاصطناعي  (Vercel Serverless Function)
   المسار: api/generate.js   →   يُنادى من البرنامج بـ  /api/generate
   المفتاح يقعد هنا على الخادم ولا يصل المتصفح أبداً.
   ============================================================ */

const MODEL = "claude-sonnet-5";   // تقدرين تغيّرينه لـ claude-opus-5 لجودة أعلى وتكلفة أعلى

export default async function handler(req, res) {
  // ---- CORS (يفيد لو فتحتِ البرنامج من نطاق آخر) ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "POST فقط" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "مفتاح ANTHROPIC_API_KEY غير مضبوط في إعدادات Vercel" });

  try {
    const {
      client = {}, env, level, days, split, goal, aiRequest = "",
      conditions = [], available = [], minDaily = 4, maxDaily = 9,
      weeklyTargets = {}, gluteEmphasis = true
    } = req.body || {};

    if (!Array.isArray(available) || !available.length)
      return res.status(400).json({ error: "قائمة التمارين المتاحة فارغة" });

    const ENVN   = { gym: "نادي", home: "بيت", bodyweight: "وزن الجسم" };
    const LEVELN = { 1: "مبتدئة", 2: "متوسطة", 3: "متقدمة" };
    const GOALN  = { strength: "قوة", hypertrophy: "تضخيم", cutting: "تنشيف", general: "لياقة عامة" };

    /* التمارين تُرسل مضغوطة: المعرّف | الاسم | العضلة | مركّب أو عزل | مفضّل */
    const exLines = available
      .map(e => `${e.id} | ${e.name} | ${e.group} | ${e.type || ""}${e.fav ? " | مفضّل" : ""}`)
      .join("\n");

    const targetLines = Object.entries(weeklyTargets)
      .map(([m, v]) => `${m}=${v}`).join("، ");

    const system = `أنتِ مساعدة برمجة تدريب لمنصّة ZahraaFit. مهمتك اختيار التمارين وتوزيعها على الأيام.

قواعد ملزمة:
1. استخدمي معرّفات (id) من القائمة المُعطاة فقط. أي معرّف خارجها يُرفض كامل الناتج.
2. عدد الأيام بالضبط كما هو مطلوب.
3. عدد التمارين في اليوم بين ${minDaily} و ${maxDaily}.
4. رتّبي كل يوم: التمارين المركّبة أولاً ثم العزل، والعضلات الكبيرة قبل الصغيرة، والبطن آخراً.
5. لا تضعي البايسبس قبل الظهر ولا الترايسبس قبل الصدر في اليوم نفسه.
6. الأهداف الأسبوعية للمجموعات لكل عضلة: ${targetLines}. وزّعي التمارين لتقترب منها.
${gluteEmphasis ? "7. المؤخرة أولوية أولى: أعطيها أعلى حجم، وتأكّدي من وجود عمل مباشر لها (هيب ثرست/جسر/رفس) لا مجرد سكوات." : ""}

أعيدي JSON فقط بلا أي نص قبله أو بعده وبلا علامات كود:
{"plan":[{"title":"اسم اليوم","exerciseIds":["id1","id2"]}],"notes":"سطر واحد يشرح منطقك"}`;

    const user = `العميلة: ${client.name || "بدون اسم"}${client.age ? `، العمر ${client.age}` : ""}${client.gender === "male" ? "، ذكر" : "، أنثى"}
البيئة: ${ENVN[env] || env} | المستوى: ${LEVELN[level] || level} | الأيام: ${days} | التقسيمة: ${split} | الهدف: ${GOALN[goal] || goal}
${conditions.length ? `حالات صحية يجب مراعاتها: ${conditions.join("، ")}` : "لا توجد حالات صحية"}
${aiRequest ? `\nطلب خاص من المدربة (الأهم — نفّذيه):\n"""${aiRequest}"""` : ""}

التمارين المتاحة (id | الاسم | العضلة | النوع):
${exLines}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }]
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: "الاتصال بـ Anthropic فشل: " + t.slice(0, 300) });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === "text").map(b => b.text).join("\n")
      .replace(/```json|```/g, "").trim();

    let out;
    try { out = JSON.parse(text); }
    catch { return res.status(502).json({ error: "ناتج الذكاء ليس JSON صالحاً" }); }

    /* تنقية: نُبقي المعرّفات الموجودة فعلاً ونحذف المكرّر داخل اليوم */
    const valid = new Set(available.map(e => e.id));
    out.plan = (out.plan || []).map(d => ({
      title: String(d.title || "يوم").slice(0, 60),
      exerciseIds: [...new Set((d.exerciseIds || []).filter(id => valid.has(id)))]
    })).filter(d => d.exerciseIds.length);

    if (!out.plan.length)
      return res.status(502).json({ error: "لم يُنتج الذكاء أي تمرين صالح" });

    return res.status(200).json(out);

  } catch (e) {
    return res.status(500).json({ error: e.message || "خطأ غير متوقع" });
  }
}
