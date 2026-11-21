// Renders the muscle-map sources: base front/back + one spotlight image per group and view.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.RAW || __dirname + '/raw';
fs.mkdirSync(OUT, { recursive: true });
const groups = JSON.parse(fs.readFileSync(process.env.GROUPS || __dirname + '/groups.json', 'utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1140, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(900000);
  await page.goto((process.env.BASE || 'http://localhost:3002') + '/atlas/?e2e=1&refine=0', { timeout: 300000 });
  await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 });
  await page.waitForTimeout(3000);
  const vp = await page.locator('main[data-viewport-wrap]').boundingBox();
  const T = (fn, a) => page.evaluate(fn, a);
  const settle = async () => { await page.waitForTimeout(2500); let last = null, same = 0; for (let k = 0; k < 40 && same < 2; k++) { await page.waitForTimeout(700); const c = JSON.stringify(await T(() => window.__backStudioTest.cameraPos())); same = c === last ? same + 1 : 0; last = c; } };
  const shot = async (name) => { await page.waitForTimeout(1800); await page.screenshot({ path: `${OUT}/${name}.png`, clip: vp, timeout: 900000 }); console.log('shot', name); };
  await T(() => window.__backStudioTest.store.getState().resetAll());
  for (const view of ['front', 'back']) {
    await T((v) => { const st = window.__backStudioTest.store.getState(); st.setSpotlight(null); st.view(v); }, view);
    await settle();
    await page.mouse.move(vp.x + 5, vp.y + 5);
    await shot(`base-${view}`);
    for (const g of groups) {
      if (fs.existsSync(`${OUT}/${g.id}-${view}.png`)) continue;
      await T((u) => window.__backStudioTest.store.getState().setSpotlight({ primary: u, secondary: [] }), g.units);
      await shot(`${g.id}-${view}`);
    }
  }
  await b.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
