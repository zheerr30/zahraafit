// Real-click E2E for the back & shoulders viewer (/back): every muscle unit,
// both sides, is found on screen and clicked with the mouse; the info card
// must open for that unit, and per-muscle hide / isolate / reset must work.
// Usage: npm run dev (or npm start and add ?e2e=1), then
//   BASE=http://localhost:3000 node e2e/back-select-each.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/back?e2e=1`);
  await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const T = (fn, arg) => page.evaluate(fn, arg);
  const ids = await page.$$eval('button[data-unit-id]', (els) => els.map((e) => e.dataset.unitId));
  const result = { units: ids.length, clicked: {}, failed: [], checks: {} };
  // Views × depth modes: the deep muscles appear once the superficial layers are hidden.
  const plan = [];
  for (const depth of ['all', 'no-superficial', 'deep']) for (const view of ['back', 'left', 'right', 'front']) plan.push([depth, view]);
  for (const side of ['l', 'r']) {
    for (const [depth, view] of plan) {
      const todo = ids.filter((id) => !result.clicked[`${id}:${side}`]);
      if (!todo.length) break;
      await T(([d, v]) => { const s = window.__backStudioTest.store.getState(); s.select(null); s.setDepthMode(d); s.view(v); }, [depth, view]);
      await page.waitForTimeout(3200); // camera transition + layer fades
      for (const id of todo) {
        await T(() => window.__backStudioTest.store.getState().select(null));
        const p = await T(([id, side]) => window.__backStudioTest.pointFor(id, side), [id, side]);
        if (!p) continue;
        await page.mouse.move(p.x, p.y); await page.waitForTimeout(80);
        await page.mouse.click(p.x, p.y); await page.waitForTimeout(250);
        const sel = await T(() => window.__backStudioTest.selected());
        const card = await page.locator('[role="dialog"]').getAttribute('aria-label').catch(() => null);
        if (sel && sel.kind === 'unit' && sel.id === id && card && card.includes(sel.ar)) {
          const color = await T(([id, side]) => window.__backStudioTest.unitColor(id, side), [id, side]);
          if (color !== '#e8602c') result.failed.push(`${id}:${side} not highlighted (${color})`);
          result.clicked[`${id}:${side}`] = `${view}/${depth}`;
        } else result.failed.push(`${id}:${side}@${view}/${depth}: got ${sel ? sel.kind + ':' + sel.id : 'nothing'}`);
      }
    }
  }
  // Per-muscle hide / show from the list.
  await T(() => window.__backStudioTest.store.getState().resetAll()); await page.waitForTimeout(800);
  await page.locator('button[aria-label="إخفاء الظهرية العريضة"]').click(); await page.waitForTimeout(300);
  result.checks.hideOne = !(await T(() => window.__backStudioTest.visibleUnits())).includes('latissimus-dorsi');
  result.checks.othersStay = (await T(() => window.__backStudioTest.visibleUnits())).length === ids.length - 1;
  await page.locator('button[aria-label="إظهار الظهرية العريضة"]').click(); await page.waitForTimeout(300);
  result.checks.showAgain = (await T(() => window.__backStudioTest.visibleUnits())).length === ids.length;
  // Isolate from the card, skeleton-only, nerves & tendons, reset.
  await page.locator('button[data-unit-id="infraspinatus"]').click(); await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'عزل', exact: true }).click(); await page.waitForTimeout(500);
  result.checks.isolate = JSON.stringify(await T(() => window.__backStudioTest.visibleUnits())) === '["infraspinatus"]';
  await page.getByRole('button', { name: 'الهيكل العظمي فقط' }).click(); await page.waitForTimeout(500);
  const sk = await T(() => window.__backStudioTest.visibleKinds());
  result.checks.skeletonOnly = Object.keys(sk).join() === 'bone';
  await page.getByRole('button', { name: 'إظهار الأعصاب والأوتار' }).click(); await page.waitForTimeout(500);
  const nt = await T(() => window.__backStudioTest.visibleKinds());
  result.checks.nervesTendons = nt.nerve > 0 && nt.tendon > 0;
  await page.getByRole('button', { name: /إعادة جميع الطبقات/ }).click(); await page.waitForTimeout(600);
  result.checks.reset = (await T(() => window.__backStudioTest.visibleUnits())).length === ids.length && !(await T(() => window.__backStudioTest.visibleKinds())).nerve;
  result.clickedCount = Object.keys(result.clicked).length;
  console.log(JSON.stringify(result, null, 1));
  console.log('page errors', errs);
  await b.close();
  if (result.failed.length || Object.values(result.checks).some((v) => !v) || result.clickedCount !== ids.length * 2) process.exit(1);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
