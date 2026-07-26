/* ============================================================
   ZahraaFit — نقطة الذكاء الاصطناعي (نسخة مخففة)
   المسار: api/generate.js
   ------------------------------------------------------------
   سبب التعديل: حساب Vercel Hobby يقطع الدالة بعد 30 ثانية،
   والنسخة السابقة كانت ترسل 137 تمريناً وتطلب رداً طويلاً فتتجاوز الحد.
   التخفيف: قائمة مضغوطة · رد أقصر · نموذج أسرع · مهلة داخلية 24 ثانية.
   ============================================================ */

export const config = { maxDuration: 30 };

const MODEL = "claude-haiku-4-5-20251001";   // أسرع نموذج — يرد في ثوانٍ
const SOFT_TIMEOUT = 24000;                  // نقطع قبل حد Vercel لنرجع رسالة مفهومة

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY غير مضبوط في Vercel" });

  try {
    const {
      client = {}, env, level, days, split, goal, aiRequest = "",
      conditions = [], available = [], minDaily = 4, maxDaily = 9,
      weeklyTargets = {}, gluteEmphasis = true
    } = req.body || {};

    if (!Array.isArray(available) || !available.length)
      return res.status(400).json({ error: "قائمة التمارين فارغة" });

    /* ---- تخفيف 1: نقصّ القائمة إلى 12 تمريناً لكل عضلة كحد أقصى ----
       المفضّل أولاً ثم المركّب. 137 تمريناً في الطلب كانت تُبطئ الرد كثيراً. */
    const byGroup = {};
    available.forEach(e => { (byGroup[e.group] = byGroup[e.group] || []).push(e); });
    const trimmed = [];
    Object.values(byGroup).forEach(list => {
      list.sort((a, b) =>
        (b.fav ? 1 : 0) - (a.fav ? 1 : 0) ||
        (a.type === "compound" ? 0 : 1) - (b.type === "compound" ? 0 : 1)
      );
      trimmed.push(...list.slice(0, 12));
    });

    /* ---- تخفيف 2: سطر واحد قصير لكل تمرين (بلا أسماء إنجليزية ولا تفاصيل) ---- */
    const exLines = trimmed.map(e => `${e.id}|${e.group}|${e.type === "compound" ? "م" : "ع"}`).join("\n");

    const targetLines = Object.entries(weeklyTargets).map(([m, v]) => `${m}=${v}`).join(",");
    const ENVN = { gym: "نادي", home: "بيت", bodyweight: "وزن الجسم" };
    const LEVELN = { 1: "مبتدئة", 2: "متوسطة", 3: "متقدمة" };
    const GOALN = { strength: "قوة", hypertrophy: "تضخيم", cutting: "تنشيف", general: "لياقة" };

    /* ---- تخفيف 3: نطلب معرّفات فقط بلا شرح، فيقصر الرد كثيراً ---- */
    const system = `أنتِ مساعدة برمجة تدريب. اختاري التمارين ووزّعيها على الأيام.

قواعد:
1. معرّفات (id) من القائمة فقط. أي معرّف خارجها يُرفض.
2. ${days} أيام بالضبط، و${minDaily}-${maxDaily} تمرين في اليوم.
3. المركّب (م) أولاً ثم العزل (ع). العضلات الكبيرة قبل الصغيرة. البطن آخراً.
4. لا بايسبس قبل ظهر، ولا ترايسبس قبل صدر، في اليوم نفسه.
5. أهداف المجموعات الأسبوعية: ${targetLines}
${gluteEmphasis ? "6. المؤخرة أولوية: أعلى حجم + عمل مباشر لها (هيب ثرست/جسر/رفس)." : ""}

أعيدي JSON فقط بلا أي نص أو علامات كود، وبلا حقل notes:
{"plan":[{"title":"اسم اليوم","exerciseIds":["id1","id2"]}]}`;

    const user = `${ENVN[env] || env} | ${LEVELN[level] || level} | ${days} أيام | ${split} | ${GOALN[goal] || goal}${client.gender === "male" ? " | ذكر" : ""}
${conditions.length ? `حالات صحية: ${conditions.join("،")}` : ""}
${aiRequest ? `طلب المدربة (الأهم): """${aiRequest}"""` : ""}

التمارين (id|عضلة|نوع):
${exLines}`;

    /* ---- تخفيف 4: مهلة داخلية قبل حد Vercel لنرجع رسالة واضحة ---- */
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SOFT_TIMEOUT);

    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,        // كان 4000
          temperature: 0.3,        // رد أسرع وأكثر ثباتاً
          system,
          messages: [{ role: "user", content: user }]
        })
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError")
        return res.status(504).json({ error: "الذكاء تأخّر أكثر من 24 ثانية — استخدمي التوليد السريع" });
      throw e;
    }
    clearTimeout(timer);

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: "Anthropic: " + t.slice(0, 250) });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === "text").map(b => b.text).join("\n")
      .replace(/```json|```/g, "").trim();

    let out;
    try { out = JSON.parse(text); }
    catch { return res.status(502).json({ error: "ناتج الذكاء ليس JSON صالحاً" }); }

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
