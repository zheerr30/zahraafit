/* ============================================================
   ZahraaFit — وسيط قراءة الشيت
   المسار: /api/sheet?url=...
   المتصفح يمنع القراءة من نطاق آخر (CORS)، والخادم لا يمنعه شيء.
   ============================================================ */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const target = req.query.url;
  if (!target) return res.status(400).send("مطلوب معامل url");

  let u;
  try { u = new URL(target); } catch { return res.status(400).send("رابط غير صالح"); }
  if (!/^https?:$/.test(u.protocol)) return res.status(400).send("البروتوكول غير مسموح");

  const ok = /(^|\.)google\.com$|(^|\.)googleusercontent\.com$|(^|\.)script\.google\.com$|(^|\.)airtable\.com$|(^|\.)notion\.so$/;
  if (!ok.test(u.hostname)) return res.status(403).send("النطاق غير مسموح: " + u.hostname);

  try {
    const r = await fetch(u.toString(), { redirect: "follow", headers: { "User-Agent": "ZahraaFit/4" } });
    const text = await r.text();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(r.ok ? 200 : r.status).send(text);
  } catch (e) {
    return res.status(502).send("فشل الجلب: " + e.message);
  }
}
