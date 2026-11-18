// Real-click E2E: every muscle unit, both bodies, from the four named views.
// Usage: start the app (npm run dev, or npm start and append ?e2e=1 — already added), then
//   BASE=http://localhost:3000 node e2e/select-each-muscle.cjs
// Requires the `playwright` package and a Chromium build.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const summary = {};
  for (const g of (process.env.GENDERS || 'male,female').split(',')) {
    // A fresh page per body: unloading a 3.3M-triangle scene can stall a reused tab.
    const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}/editor?new=1&gender=${g}&e2e=1`, { timeout: 300000 });
    await page.getByText(/(\d+) من \1 وحدة عضلية مرتبطة/).waitFor({ timeout: 120000 });
    const IDS = await page.$$eval('aside[aria-label="مكتبة العضلات"] button[data-muscle-id]', (els) => [...new Set(els.map((e) => e.dataset.muscleId))]);
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
    summary[g] = { units: IDS.length, clicked: Object.keys(ok).length, byView: ok, notClickableFromOutside: viaList, mismatches: wrong };
    console.log(g, JSON.stringify(summary[g]));
    await page.close();
  }
  console.log(JSON.stringify(summary, null, 1));
  console.log('page errors', errs);
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
