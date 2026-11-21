// A model download cut off by the connection: retried automatically; when every
// attempt fails, the error card offers "try again", which loads the model.
// BASE=http://localhost:3001 node e2e/load-retry.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
const results = [];
const ok = (name, cond, extra = '') => { results.push(!!cond); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const run = async (failures) => {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    page.setDefaultTimeout(300000);
    let hits = 0;
    await page.route('**/models/zanatomy/male/core-smooth.glb', (route) => (++hits <= failures ? route.abort('connectionreset') : route.continue()));
    await page.goto(BASE + '/atlas?e2e=1&refine=0&hd=0', { timeout: 300000 });
    return { page, hits: () => hits };
  };
  // 1. two dropped downloads, then it works — no error shown
  {
    const { page, hits } = await run(2);
    await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 });
    ok('two dropped downloads are retried automatically', hits() === 3 && (await page.locator('[data-load-error]').count()) === 0, `requests: ${hits()}`);
    await page.close();
  }
  // 2. three dropped downloads — error card with a retry button; pressing it loads the model
  {
    const { page, hits } = await run(3);
    const alert = page.locator('[data-load-error]');
    await alert.waitFor({ timeout: 120000 });
    const text = await alert.innerText();
    ok('after three failures: a clear message', hits() === 3 && text.includes('انقطع الاتصال') && text.includes('إعادة المحاولة'), text.replace(/\s+/g, ' ').slice(0, 90));
    await alert.locator('[data-action=retry-load]').click();
    await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 });
    ok('"try again" loads the model', hits() === 4 && (await page.locator('[data-load-error]').count()) === 0, `requests: ${hits()}`);
    await page.close();
  }
  await browser.close();
  console.log(`${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
