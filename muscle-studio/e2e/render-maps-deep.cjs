// Second pass of the muscle-map renders: groups that cannot be seen on the surface
// (deep muscles, or covered by an aponeurosis) are rendered with the covering layers
// removed — "@d2": without the superficial muscles, "@d3": deep muscles only,
// "@nt": tendons / aponeuroses hidden — each with its own plain base image.
// node render-maps-deep.cjs  (reads groups.json and needs.json next to it)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.RAW || __dirname + '/raw';
const groups = JSON.parse(fs.readFileSync(process.env.GROUPS || __dirname + '/groups.json', 'utf8'));
const needs = JSON.parse(fs.readFileSync(process.env.NEEDS || __dirname + '/needs.json', 'utf8')); // ["pec-minor-front", ...]
const VARIANTS = { d2: ['no-superficial', true], d3: ['deep', true], nt: ['all', false] };
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
  const shot = async (name, wait = 1800) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${name}.png`, clip: vp, timeout: 900000 }); console.log('shot', name); };
  await T(() => window.__backStudioTest.store.getState().resetAll());
  for (const view of ['front', 'back']) {
    const list = groups.filter((g) => needs.includes(`${g.id}-${view}`));
    if (!list.length) continue;
    await T((v) => { const st = window.__backStudioTest.store.getState(); st.setSpotlight(null); st.view(v); }, view);
    await settle();
    await page.mouse.move(vp.x + 5, vp.y + 5);
    for (const [tag, [depth, tendons]] of Object.entries(VARIANTS)) {
      await T(([d, t]) => { const st = window.__backStudioTest.store.getState(); st.setSpotlight(null); st.setDepthMode(d); st.setLayer('tendons', t); }, [depth, tendons]);
      await shot(`base-${view}@${tag}`, 7000); // layers fade out over several frames
      for (const g of list) {
        await T((u) => window.__backStudioTest.store.getState().setSpotlight({ primary: u, secondary: [] }), g.units);
        await shot(`${g.id}-${view}@${tag}`);
      }
    }
    await T(() => { const st = window.__backStudioTest.store.getState(); st.setSpotlight(null); st.setDepthMode('all'); st.setLayer('tendons', true); });
    await page.waitForTimeout(7000);
  }
  await b.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
