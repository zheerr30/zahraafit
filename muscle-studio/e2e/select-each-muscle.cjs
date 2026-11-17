// Real-click E2E: every muscle unit, both bodies, from the four named views.
// Usage: start the app (npm run dev, or npm start and append ?e2e=1 — already added), then
//   BASE=http://localhost:3000 node e2e/select-each-muscle.cjs
// Requires the `playwright` package and a Chromium build.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
const IDS = ["neck-muscles","deltoid","rotator-cuff","shoulder-girdle","pectoralis-major","intercostals","trapezius","deep-back","upper-arm","forearm","hand","abdominal-wall","diaphragm","pelvic-floor","iliopsoas","gluteal","quadriceps","hamstrings","adductors","calf","anterior-leg","foot"];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const summary = {};
  for (const g of ['male', 'female']) {
    await page.goto(`${BASE}/editor?new=1&gender=${g}&e2e=1`);
    await page.getByText(/22 من 22 وحدة عضلية مرتبطة/).waitFor({ timeout: 120000 });
    await page.waitForTimeout(1000);
    const ok = {}, wrong = [];
    for (const [key, view] of [['1','front'],['2','back'],['3','left'],['4','right']]) {
      await page.keyboard.press(key); await page.waitForTimeout(2500); // let the camera transition settle
      for (const id of IDS) {
        if (ok[id]) continue;
        await page.evaluate(() => window.__muscleStudioTest.clear());
        const p = await page.evaluate((m) => window.__muscleStudioTest.pointFor(m), id);
        if (!p) continue;
        await page.mouse.move(p.x, p.y); await page.waitForTimeout(60);
        await page.mouse.click(p.x, p.y); await page.waitForTimeout(120);
        const sel = await page.evaluate(() => window.__muscleStudioTest.selected());
        if (sel.length === 1 && sel[0] === id) {
          await page.mouse.click(p.x, p.y); await page.waitForTimeout(120);
          const after = await page.evaluate(() => window.__muscleStudioTest.selected());
          if (after.length === 0) ok[id] = view; else wrong.push(`${id}@${view}: second click left ${after}`);
        } else wrong.push(`${id}@${view}: got [${sel}]`);
      }
    }
    // Units never reachable by clicking from outside: verify they still select from the list.
    const viaList = [];
    for (const id of IDS.filter((i) => !ok[i])) {
      await page.evaluate(() => window.__muscleStudioTest.clear());
      await page.locator(`aside[aria-label="مكتبة العضلات"] button[data-muscle-id="${id}"]`).click();
      const sel = await page.evaluate(() => window.__muscleStudioTest.selected());
      viaList.push(`${id}:${sel.length === 1 && sel[0] === id ? 'ok' : 'FAIL ' + sel}`);
    }
    summary[g] = { clicked: Object.keys(ok).length, byView: ok, notClickableFromOutside: viaList, mismatches: wrong };
  }
  console.log(JSON.stringify(summary, null, 1));
  console.log('page errors', errs);
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
