// ============================================================
// ZahraaFit — دالة خلفية لتوليد جدول بالذكاء الاصطناعي
// تعمل على Vercel كـ Serverless Function
// المفتاح ANTHROPIC_API_KEY محفوظ في إعدادات Vercel (لا يظهر للعميل)
// ============================================================

export default async function handler(req, res) {
  // السماح فقط بطلبات POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "لم يتم ضبط مفتاح الـ API في إعدادات الاستضافة." });
  }

  try {
    const { client, env, level, days, split, dailyCount, conditions, available, aiRequest, goal } = req.body || {};
    const goalNames = { strength:"القوة (أوزان عالية، تكرارات 3-6)", hypertrophy:"بناء العضل/التضخيم (تكرارات 8-12)", cutting:"التنشيف وحرق الدهون (تكرارات 12-20)", general:"لياقة عامة (تكرارات 10-15)" };

    // نبني تعليمات واضحة لـ Claude
    const prompt = `أنت مدرّب لياقة محترف في "ZahraaFit". صمّم جدول تمارين مخصصاً بناءً على:
- الاسم: ${client?.name || "المشتركة"} | الجنس: ${client?.gender === "male" ? "ذكر" : "أنثى"}
- العمر: ${client?.age || "?"} | الطول: ${client?.height || "?"} | الوزن: ${client?.weight || "?"}
- بيئة التمرين: ${env}
- المستوى: ${level}
- عدد الأيام: ${days}
- نظام التقسيم: ${split}
- عدد التمارين المطلوب لكل يوم: ${dailyCount}
- حالات صحية يجب مراعاتها وتجنّب إجهادها: ${(conditions || []).join("، ") || "لا يوجد"}
- الهدف من البرنامج: ${goalNames[goal] || goalNames.hypertrophy}
${aiRequest ? `- طلب خاص من المدربة (مهم جداً، نفّذه بدقة): ${aiRequest}` : ""}

اختر التمارين فقط من هذه القائمة المتاحة (لا تخترع تمارين جديدة، استخدم الـ id كما هو):
${JSON.stringify(available)}

أعد الناتج بصيغة JSON فقط دون أي نص إضافي، بهذا الشكل:
{"plan":[{"title":"اسم اليوم","exerciseIds":["id1","id2",...]}]}
وزّع التمارين بذكاء: العضلات الكبيرة (صدر، ظهر، فخذ، مؤخرة) تأخذ تمارين أكثر، تجنّب التمارين الخطرة على الحالات الصحية، لا تكرّر نفس العضلة في يومين متتاليين، والتزم بعدد الأيام وعدد التمارين المطلوب. الأهم: نفّذ الطلب الخاص من المدربة إن وُجد.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      return res.status(502).json({ error: "تعذّر الاتصال بالذكاء الاصطناعي", detail: txt });
    }

    const data = await response.json();
    let text = (data.content || []).map(b => b.text || "").join("").trim();
    // تنظيف أي أسوار كود
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: "ناتج الذكاء غير صالح", raw: text });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "خطأ داخلي", detail: String(err) });
  }
}
