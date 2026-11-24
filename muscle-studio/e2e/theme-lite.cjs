// ZahraaFit theme (?theme=zahraafit) and the lightweight body for phones (?lite=1 / automatic).
//
// BASE=http://localhost:3001 SHOTS=dir node e2e/theme-lite.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
const SHOTS = process.env.SHOTS;
const results = [];
const ok = (name, cond, extra = '') => { results.push(!!cond); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const T = (page, fn, a) => page.evaluate(fn, a);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const PEC = 'sternocostal-head-of-pectoralis-major-muscle';
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const near = (a, b, tol = 2) => a.length >= 3 && b.every((v, i) => Math.abs(v - a[i]) <= tol);
// any CSS colour (the browser reports mixed ones as oklab) → [r, g, b, alpha 0–255]
const rgba = (page, color) => T(page, (c) => {
  const x = document.createElement('canvas'); x.width = x.height = 1;
  const g = x.getContext('2d', { willReadFrequently: true }); g.fillStyle = c; g.fillRect(0, 0, 1, 1);
  return [...g.getImageData(0, 0, 1, 1).data];
}, color);

async function open(browser, path, { phone = false } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true } : { viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(400000);
  const glb = [];
  const errors = [];
  page.on('request', (r) => { if (/\.glb(\?|$)/.test(r.url())) glb.push(r.url().split('/').pop()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + path, { timeout: 300000 });
  await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 });
  await page.waitForTimeout(12000);
  return { ctx, page, glb, errors };
}
// colour of the 3D view's backdrop: a pixel of the canvas in its top corner, away from the body
const backdrop = (page) => T(page, () => {
  const c = document.querySelector('canvas');
  const x = document.createElement('canvas'); x.width = 8; x.height = 8;
  const g = x.getContext('2d'); g.drawImage(c, 4, 4, 8, 8, 0, 0, 8, 8);
  return [...g.getImageData(4, 4, 1, 1).data].slice(0, 3);
});

// the body's files: full on large screens, the lighter build on phones (lib/region/profile.ts)
const FULL = 'core.glb';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ── desktop, default: dark theme, full body ──
  {
    const { ctx, page, glb, errors } = await open(browser, '/atlas?e2e=1&refine=0');
    ok('desktop: the full body is loaded', glb.includes(FULL) && !glb.includes('core-lite.glb'), glb.join(' '));
    ok('default theme is the dark one', (await T(page, () => document.documentElement.dataset.theme)) === undefined && near(rgb(await T(page, () => getComputedStyle(document.body).backgroundColor)), [5, 5, 5]));
    const b = await backdrop(page);
    ok('default backdrop is dark', b.every((v) => v < 70), b.join(','));
    ok('no page errors (default)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ── desktop, ZahraaFit theme with the light body asked for ──
  {
    const { ctx, page, glb, errors } = await open(browser, '/atlas?e2e=1&refine=0&theme=zahraafit&lite=1');
    ok('?lite=1 loads the lightweight body', glb.includes('core-lite.glb') && !glb.includes(FULL), glb.join(' '));
    const css = await T(page, () => {
      const cs = (sel) => getComputedStyle(document.querySelector(sel));
      return { theme: document.documentElement.dataset.theme, page: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.body).color, header: cs('header').backgroundColor, dock: cs('aside').backgroundColor, line: cs('header').borderBottomColor, region: cs('[data-region]').color };
    });
    ok('theme: cream page #F6F2EA', css.theme === 'zahraafit' && near(rgb(css.page), [246, 242, 234]), css.page);
    ok('theme: navy text #050F2C', near(rgb(css.text), [5, 15, 44]) && near(rgb(css.region), [5, 15, 44]), css.text);
    ok('theme: white bars and menus', near(rgb(css.header), [255, 255, 255]) && near(rgb(css.dock), [255, 255, 255]), `${css.header} ${css.dock}`);
    const line = await rgba(page, css.line);
    ok('theme: separators rgba(5,15,44,.1)', near(line, [5, 15, 44], 12) && Math.abs(line[3] - 25.5) <= 2, `${css.line} → ${line.join(',')}`);
    const b = await backdrop(page);
    ok('theme: light cream backdrop behind the model', near(b, [246, 242, 234], 6), b.join(','));
    await shot(page, 't1-desktop');

    await T(page, () => window.__backStudioTest.store.getState().focusRegion('chest'));
    await page.waitForTimeout(9000);
    const on = await T(page, () => getComputedStyle(document.querySelector('[data-region=chest]')).backgroundColor);
    ok('theme: the chosen item is orange #E8602C', near(rgb(on), [232, 96, 44]), on);
    await T(page, (u) => window.__backStudioTest.store.getState().selectUnit(u, 'l'), PEC);
    await page.waitForTimeout(9000);
    ok('the selected muscle takes the orange accent on the model', (await T(page, (u) => window.__backStudioTest.unitColor(u), PEC)) === '#e8602c');
    const panel = page.locator('[role=dialog][data-panel]');
    const pc = await T(page, () => { const p = document.querySelector('[role=dialog][data-panel]'); const b = p.querySelector('[data-action=learn-more]'); return { card: getComputedStyle(p).backgroundColor, btn: getComputedStyle(b).backgroundColor, name: getComputedStyle(p.querySelector('h3')).color }; });
    ok('theme: white muscle card, navy name, orange button', near(await rgba(page, pc.card), [255, 255, 255]) && near(rgb(pc.btn), [232, 96, 44]) && near(rgb(pc.name), [5, 15, 44]), JSON.stringify(pc));
    await shot(page, 't2-desktop-muscle');
    await panel.locator('[data-action=learn-more]').click();
    await panel.locator('[data-panel-tab=exercises]').click();
    await page.waitForTimeout(6000);
    ok('theme: exercises open in the same colours', (await panel.locator('[data-exercise]').count()) >= 3 && near(rgb(await T(page, () => getComputedStyle(document.querySelector('[data-panel-tab=exercises]')).backgroundColor)), [232, 96, 44]));
    await shot(page, 't3-desktop-exercises');
    ok('theme stays in the address while moving around', page.url().includes('theme=zahraafit') && page.url().includes('lite=1'), page.url());
    ok('no page errors (theme)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // ── phone: the light body by itself, theme from the address ──
  {
    const { ctx, page, glb, errors } = await open(browser, '/atlas?e2e=1&refine=0&theme=zahraafit', { phone: true });
    ok('phone: the lightweight body is loaded by itself', glb.includes('core-lite.glb') && !glb.includes(FULL), glb.join(' '));
    ok('phone: every muscle is there under the same name', (await T(page, (u) => { const s = window.__backStudioTest.store.getState(); s.selectUnit(u, 'l'); return window.__backStudioTest.store.getState().selected?.ar; }, PEC)) === 'الصدرية الكبرى — الرأس القصي الضلعي');
    await page.waitForTimeout(9000);
    await shot(page, 't4-phone-muscle');
    const sheet = await T(page, () => getComputedStyle(document.querySelector('[role=dialog][data-panel]')).backgroundColor);
    ok('phone: white sheet on the cream page', near(await rgba(page, sheet), [255, 255, 255]), sheet);
    ok('no page errors (phone)', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, glb } = await open(browser, '/atlas?e2e=1&refine=0&lite=0', { phone: true });
    ok('phone: ?lite=0 asks for the full body', glb.includes(FULL) && !glb.includes('core-lite.glb'), glb.join(' '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})();
