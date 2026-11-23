// The interaction flow, driven by real taps / clicks on the running app:
//   tap a muscle on the 3D model → it is selected and highlighted → contextual panel →
//   "learn more" → "exercises" (strengthening / stretching, search, filters, bookmarks) →
//   an exercise lights its muscles on the model → isolate → back to the full body;
//   the same on a phone-sized screen; the standalone library and its link back into the model.
// BASE=http://localhost:3001 SHOTS=dir node e2e/exercise-flow.cjs
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
const SHOTS = process.env.SHOTS || null;
const PEC = 'sternocostal-head-of-pectoralis-major-muscle';
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };

async function open(page, path) {
  await page.goto(BASE + path, { timeout: 300000 });
  await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 });
  await page.waitForTimeout(2500);
}
const T = (page, fn, a) => page.evaluate(fn, a);
const state = (page) => T(page, () => { const s = window.__backStudioTest.store.getState(); return { sel: s.selected?.id ?? null, panel: s.panel, isolate: s.isolate, region: s.region, spot: s.spotlight }; });
const settle = async (page) => { await page.waitForTimeout(1500); let last = null, same = 0; for (let k = 0; k < 40 && same < 2; k++) { await page.waitForTimeout(600); const c = JSON.stringify(await T(page, () => window.__backStudioTest.cameraPos())); same = c === last ? same + 1 : 0; last = c; } };
const shot = async (page, name) => { if (!SHOTS) return; await page.waitForTimeout(2500); await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 900000 }); console.log('shot', name); };
async function tapMuscle(page, id, touch) {
  const p = await T(page, (u) => window.__backStudioTest.pointFor(u, 'l'), id);
  if (!p) return false;
  if (touch) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(1200);
  return true;
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  const PARTS = (process.env.PARTS || 'desktop,phone,library').split(',');
  // ── desktop ──────────────────────────────────────────────────────
  if (PARTS.includes('desktop')) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.setDefaultTimeout(120000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await open(page, '/atlas?e2e=1&refine=0');
    await T(page, () => window.__backStudioTest.store.getState().focusRegion('chest'));
    await settle(page);

    ok('tap selects the muscle', await tapMuscle(page, PEC) && (await state(page)).sel === PEC);
    ok('selected muscle is highlighted', (await T(page, (u) => window.__backStudioTest.unitColor(u), PEC)) === '#e8602c');
    const panel = page.locator('[role=dialog][data-panel]');
    ok('contextual panel: summary with name and actions', (await panel.getAttribute('data-panel')) === 'summary' && (await panel.locator('h3').innerText()).includes('الصدرية') && (await panel.locator('[data-action=learn-more]').count()) === 1 && (await panel.locator('[data-action=learn-more]').innerText()).includes('اعرف أكثر'));
    ok('address follows the selection', (await page.url()).includes(`muscle=${PEC}`));
    await shot(page, '1-summary');

    await panel.locator('[data-action=learn-more]').click();
    ok('learn more → explanation, with the exercises one tab away', (await panel.getAttribute('data-panel')) === 'details' && (await panel.innerText()).includes('ماذا تفعل') && (await panel.locator('[data-panel-tab=exercises]').count()) === 1);
    await shot(page, '2-learn-more');
    await panel.getByLabel('رجوع إلى ملخص العضلة').click();
    ok('back → summary', (await panel.getAttribute('data-panel')) === 'summary');

    await panel.locator('[data-action=learn-more]').click();
    await panel.locator('[data-panel-tab=exercises]').click();
    ok('learn more → exercises tab: library for this muscle', (await panel.getAttribute('data-panel')) === 'exercises');
    const cards = panel.locator('[data-exercise]');
    const nStrength = await cards.count();
    ok('strengthening exercises listed', nStrength >= 4, `(${nStrength})`);
    ok('cards have a picture, a name and information', (await cards.first().locator('[role=img], img').count()) >= 1 && (await cards.first().innerText()).length > 20);
    await panel.locator('[data-tab=stretch]').click();
    const nStretch = await cards.count();
    ok('stretching tab lists other exercises', nStretch >= 1 && (await cards.first().getAttribute('data-exercise')) === 'doorway-pec-stretch', `(${nStretch})`);
    await panel.locator('[data-tab=strength]').click();

    await panel.getByPlaceholder('ابحث باسم التمرين أو العضلة…').fill('push');
    await page.waitForTimeout(300);
    ok('search narrows the list', (await cards.count()) >= 1 && (await cards.count()) < nStrength && (await cards.allInnerTexts()).every((t) => /ضغط|بوش|push/i.test(t)));
    await panel.getByPlaceholder('ابحث باسم التمرين أو العضلة…').fill('');
    await panel.locator('[data-equipment=dumbbell]').click();
    await page.waitForTimeout(300);
    ok('equipment filter', (await cards.count()) >= 1 && (await cards.allInnerTexts()).every((t) => t.includes('دمبل')));
    await panel.locator('[data-equipment=dumbbell]').click();

    const first = cards.first();
    const firstId = await first.getAttribute('data-exercise');
    await first.locator('button[aria-expanded]').click();
    await page.waitForTimeout(800);
    let s = await state(page);
    ok('opening an exercise lights its muscles on the model', !!s.spot && s.spot.primary.includes(PEC) && s.spot.secondary.length > 0, firstId);
    const sec = s.spot.secondary[0];
    ok('helper muscles take the lighter tint', (await T(page, (u) => window.__backStudioTest.unitColor(u), sec)) === '#f4b096' || (await T(page, (u) => window.__backStudioTest.unitColor(u), sec)) !== (await T(page, (u) => window.__backStudioTest.unitColor(u), 'soleus-muscle')));
    ok('steps are shown', (await first.locator('ol li').count()) >= 3);
    // the exercise video (from the ZahraaFit program's library): a still with a play button, the player only on demand
    const vid = first.locator('[data-video]');
    ok('exercise has a video with a still picture', (await vid.count()) === 1 && (await first.locator('img[src*="i.ytimg.com/vi/"]').count()) >= 1 && (await vid.locator('iframe').count()) === 0);
    await vid.locator('[data-action=play-video]').click();
    ok('play loads the YouTube player in place', ((await vid.locator('iframe').getAttribute('src')) || '').startsWith('https://www.youtube-nocookie.com/embed/' + (await vid.getAttribute('data-video'))));
    ok('link to the video on YouTube', ((await vid.locator('a').getAttribute('href')) || '').startsWith('https://youtu.be/'));
    await settle(page);
    await shot(page, '3-exercises-spotlight');

    await first.locator('button[aria-pressed]').first().click();
    ok('bookmark is saved on the device', (await T(page, () => localStorage.getItem('muscle-studio:exercise-bookmarks:v1')) || '').includes(firstId));
    await panel.locator('[data-action=saved-filter]').click();
    await page.waitForTimeout(300);
    ok('bookmarks filter shows only saved exercises', (await cards.count()) === 1);
    await panel.locator('[data-action=saved-filter]').click();

    // a target muscle of the exercise → that muscle on the model, exercises stay open
    await cards.first().locator('dl button', { hasText: 'ثلاثية الرؤوس' }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    s = await state(page);
    ok('tapping a target muscle selects it on the model', s.sel === 'long-head-of-triceps-brachii' && s.panel === 'exercises', s.sel);

    await panel.getByLabel('رجوع إلى ملخص العضلة').click();
    await panel.locator('[data-action=isolate]').click();
    await page.waitForTimeout(1500);
    s = await state(page);
    const solid = await T(page, () => window.__backStudioTest.solidUnits());
    ok('isolate shows only the muscle', s.isolate && solid.length === 1 && solid[0] === 'long-head-of-triceps-brachii', solid.join(','));
    await shot(page, '4-isolated');
    await panel.locator('[data-action=full-body]').click();
    await page.waitForTimeout(1500);
    s = await state(page);
    ok('return to the full anatomy', !s.isolate && s.region === null && (await T(page, () => window.__backStudioTest.solidUnits())).length > 150);
    ok('no page errors (desktop)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── phone ──────────────────────────────────────────────────────
  if (PARTS.includes('phone')) {
    // a phone-sized touch screen (pixel ratio 1: software rendering at 3× is impractically slow)
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
    const page = await ctx.newPage();
    page.setDefaultTimeout(120000);
    await open(page, '/atlas?e2e=1&refine=0');
    await T(page, () => window.__backStudioTest.store.getState().focusRegion('abdomen'));
    await settle(page);
    ok('phone: tap selects the muscle', await tapMuscle(page, 'rectus-abdominis-muscle', true) && (await state(page)).sel === 'rectus-abdominis-muscle');
    const panel = page.locator('[role=dialog][data-panel]');
    const vp = page.viewportSize();
    let box = await panel.boundingBox();
    ok('phone: summary is a bottom sheet that leaves the model visible', box && box.y > vp.height * 0.45 && Math.abs(box.y + box.height - (vp.height - 56)) < 3, JSON.stringify(box)); // it rests on the control bar
    await shot(page, '5-phone-summary');
    await panel.locator('[data-action=learn-more]').tap();
    await panel.locator('[data-panel-tab=exercises]').tap();
    await page.waitForTimeout(600);
    box = await panel.boundingBox();
    ok('phone: exercises sheet with the model above it', (await panel.getAttribute('data-panel')) === 'exercises' && box.y > vp.height * 0.3 && (await panel.locator('[data-exercise]').count()) >= 3);
    await panel.locator('[data-exercise] button[aria-expanded]').first().tap();
    await page.waitForTimeout(800);
    ok('phone: opening an exercise lights its muscles', !!(await state(page)).spot);
    await settle(page);
    await shot(page, '6-phone-exercises');
    await ctx.close();
  }

  // ── the library page and its link into the model ───────────────────────────
  if (PARTS.includes('library')) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.setDefaultTimeout(120000);
    await page.goto(BASE + '/exercises', { timeout: 300000 });
    const cards = page.locator('[data-exercise]');
    await cards.first().waitFor();
    const all = await cards.count();
    ok('library page lists the strengthening exercises', all > 50, `(${all})`);
    await page.locator('[data-group=hamstrings]').click();
    await page.waitForTimeout(300);
    const n = await cards.count();
    ok('library: muscle filter', n >= 3 && n < all, `(${n})`);
    await page.locator('[data-action=video-filter]').click();
    await page.waitForTimeout(300);
    ok('library: "with video" filter', (await cards.count()) >= 3 && (await cards.count()) === (await page.locator('[data-exercise] img[src*="i.ytimg.com/vi/"]').count()));
    await page.locator('[data-action=video-filter]').click();
    await shot(page, '7-library');
    await cards.first().locator('button[aria-expanded]').click();
    const link = cards.first().locator('[data-action=open-in-atlas]');
    const href = await link.getAttribute('href');
    ok('library: "show on the 3D model" link', /\/atlas\?muscle=.+&panel=exercises&ex=/.test(href || ''), href);
    await page.goto(BASE + href + '&e2e=1&refine=0', { timeout: 300000 });
    await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 });
    await page.waitForFunction(() => window.__backStudioTest.store.getState().panel === 'exercises', null, { timeout: 60000 });
    const s = await state(page);
    ok('link opens the model on that muscle with its exercises and the exercise lit', s.sel && s.panel === 'exercises' && !!s.spot, JSON.stringify({ sel: s.sel, panel: s.panel }));
    await settle(page);
    await shot(page, '8-deep-link');
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
