// The redesigned atlas interface, driven by real clicks / taps: every control group
// still does its job (regions, layers, depth, muscle list, views, zoom, 360°, settings,
// body switch), the muscle panel is minimal with the technical data behind ⓘ, no
// message about the female model is shown, and the phone layout keeps the model in view.
// BASE=http://localhost:3001 [PARTS=desktop,phone] node e2e/atlas-ui.cjs
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3001';
const PARTS = (process.env.PARTS || 'desktop,phone').split(',');
const results = [];
const ok = (name, cond, extra = '') => { results.push(!!cond); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const T = (page, fn, a) => page.evaluate(fn, a);
const st = (page) => T(page, () => { const s = window.__backStudioTest.store.getState(); return { sel: s.selected?.id ?? null, region: s.region, depth: s.depthMode, layers: s.layers, dock: s.dock, insets: s.insets, sex: s.sex, auto: s.autoRotate, english: s.showEnglish, color: s.highlightColor, panel: s.panel }; });
const ready = async (page) => { await page.waitForFunction(() => window.__backStudioTest?.ready(), null, { timeout: 600000 }); await page.waitForTimeout(2500); };
// (software rendering draws a frame in seconds: wait before sampling, then for three equal readings)
const rest = async (page) => { await page.waitForTimeout(2500); let last = null, same = 0; for (let k = 0; k < 60 && same < 3; k++) { await page.waitForTimeout(700); const c = JSON.stringify(await T(page, () => window.__backStudioTest.cameraPos())); same = c === last ? same + 1 : 0; last = c; } };
const dist = (page) => T(page, () => { const p = window.__backStudioTest.cameraPos(); return Math.hypot(p[0], p[1] - 1, p[2]); });
// Framing: the share of the 3D view's height the body fills, and whether head and feet are inside it.
const framing = async (page) => { const b = await T(page, () => window.__backStudioTest.bodyBox()); return { ...b, fill: (b.bottom - b.top) / b.height, inside: b.top > 4 && b.bottom < b.height - 4, centre: Math.abs((b.left + b.right) / 2 - b.width / 2) / b.width }; };
const framed = (f) => f.fill >= 0.75 && f.fill <= 0.85 && f.inside;
const kinds = (page) => T(page, () => window.__backStudioTest.visibleKinds());
const WARN = /تقريب|لا يوجد مصدر|approximat|النموذج الذكري|تحذير/i;

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  if (PARTS.includes('desktop')) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(180000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/atlas?e2e=1&refine=0', { timeout: 300000 });
    await ready(page); await rest(page);

    // framing: the whole body is large, centred, and not cut
    let f = await framing(page);
    ok('full body fills 75–85 % of the view height, head and feet inside, centred', framed(f) && f.centre < 0.04, `${(f.fill * 100).toFixed(0)}% top ${f.top} bottom ${f.bottom}/${f.height}`);

    // regions
    ok('regions: equal-size buttons in a grid', await T(page, () => { const b = [...document.querySelectorAll('[data-region]')].map((e) => e.getBoundingClientRect()); return b.length === 10 && b.every((r) => Math.abs(r.width - b[0].width) < 1 && Math.abs(r.height - b[0].height) < 1); }));
    await page.locator('[data-region=chest]').click(); await rest(page);
    ok('region button focuses the region', (await st(page)).region === 'chest');
    const dChest = await dist(page);
    await page.getByRole('button', { name: 'الجسم كاملا' }).first().click(); await rest(page);
    ok('"whole body" returns to the full view', (await st(page)).region === null && (await dist(page)) > dChest * 1.3);

    // views, zoom, 360°
    const z0 = await T(page, () => window.__backStudioTest.cameraPos()[2]);
    await page.locator('[data-view=back]').click();
    await page.waitForFunction((z) => Math.sign(window.__backStudioTest.cameraPos()[2]) === -Math.sign(z), z0, { timeout: 120000 }).catch(() => {});
    await rest(page);
    const z1 = await T(page, () => window.__backStudioTest.cameraPos()[2]);
    ok('view buttons turn the body (front → back)', Math.sign(z0) === -Math.sign(z1) && Math.abs(z1) > 1, `${z0} → ${z1}`);
    f = await framing(page);
    ok('back view: the same framing', framed(f), `${(f.fill * 100).toFixed(0)}%`);
    await page.locator('[data-view=left]').click();
    await page.waitForFunction(() => Math.abs(window.__backStudioTest.cameraPos()[0]) > 1, null, { timeout: 120000 }).catch(() => {});
    await rest(page);
    ok('side view', Math.abs(await T(page, () => window.__backStudioTest.cameraPos()[0])) > 1);
    f = await framing(page);
    ok('side view: the same framing', framed(f), `${(f.fill * 100).toFixed(0)}%`);
    await page.locator('[data-view=front]').click(); await rest(page);
    const d0 = await dist(page);
    // (software rendering draws slowly: wait for the camera to actually move, then to rest)
    const moved = (from, closer) => page.waitForFunction(([f, c]) => { const p = window.__backStudioTest.cameraPos(); const d = Math.hypot(p[0], p[1] - 1, p[2]); return c ? d < f * 0.93 : d > f * 1.07; }, [from, closer], { timeout: 120000 }).catch(() => {});
    await page.locator('[data-action=zoom-in]').click(); await moved(d0, true); await rest(page);
    const d1 = await dist(page);
    await page.locator('[data-action=zoom-out]').click(); await moved(d1, false); await rest(page);
    const d2 = await dist(page);
    ok('zoom in / out buttons', d1 < d0 * 0.85 && d2 > d1 * 1.2, `${d0.toFixed(2)} → ${d1.toFixed(2)} → ${d2.toFixed(2)}`);
    await page.getByLabel('دوران 360°').click();
    const a0 = await T(page, () => window.__backStudioTest.cameraPos());
    // (a frame can take seconds here: wait for the camera to have turned, not for a fixed time)
    await page.waitForFunction((p) => { const q = window.__backStudioTest.cameraPos(); return q[0] !== p[0] || q[2] !== p[2]; }, a0, { timeout: 90000 }).catch(() => {});
    const a1 = await T(page, () => window.__backStudioTest.cameraPos());
    ok('360° rotation runs', (await st(page)).auto && (a0[0] !== a1[0] || a0[2] !== a1[2]));
    await page.getByLabel('دوران 360°').click();
    await page.locator('[data-view=front]').click(); await rest(page);

    // layers
    await page.locator('[data-dock-tab=layers]').click();
    const sw = (name) => page.getByRole('switch', { name, exact: true });
    ok('six layer switches with labels', (await page.locator('[data-dock-sheet] [role=switch]').count()) === 6);
    await sw('العضلات').click(); await page.waitForTimeout(1200);
    ok('muscles layer off', !(await kinds(page)).unit && (await kinds(page)).bone > 0);
    await sw('العضلات').click(); await page.waitForTimeout(1200);
    await sw('اللفافات والجرابات').click(); await page.waitForTimeout(1200);
    ok('fascia layer on', (await kinds(page)).unit > 0 && (await kinds(page)).fascia > 0);
    await sw('اللفافات والجرابات').click();
    await page.getByRole('radio', { name: 'العميقة فقط' }).click(); await page.waitForTimeout(1200);
    ok('depth: deep only', (await st(page)).depth === 'deep');
    await page.getByRole('button', { name: 'الهيكل العظمي فقط' }).click(); await page.waitForTimeout(1200);
    ok('skeleton only', Object.keys(await kinds(page)).join() === 'bone');
    await page.getByRole('button', { name: /إعادة جميع الطبقات/ }).click(); await page.waitForTimeout(1500);
    ok('reset restores the layers', (await kinds(page)).unit > 0 && (await st(page)).depth === 'all');

    // muscle list
    await page.locator('[data-dock-tab=muscles]').click();
    await page.getByLabel('بحث في العضلات').fill('الدالية');
    await page.waitForTimeout(400);
    const rows = page.locator('[data-dock-sheet] button[data-unit-id]:visible');
    ok('muscle search', (await rows.count()) === 3, `(${await rows.count()})`);
    await rows.first().click(); await rest(page);
    let s = await st(page);
    const panel = page.locator('[role=dialog][data-panel]');
    ok('list row selects the muscle and opens its panel', !!s.sel && s.sel.startsWith('deltoid') && (await panel.getAttribute('data-panel')) === 'summary');
    ok('the view makes room for the panel', s.insets.left > 300, JSON.stringify(s.insets));

    // minimal panel: name, group, function — technical data only behind ⓘ
    const text = await panel.innerText();
    ok('panel: name, group, short function', (await panel.locator('h3').innerText()).includes('الدالية') && text.includes('المجموعة: الكتفان') && (await panel.locator('[data-muscle-about]').innerText()).length < 120);
    ok('panel: no technical or source data in the summary', !/Z-Anatomy|TA2|المنشأ|المرتكز|التعصيب|طبقة|المصدر/.test(text), text.replace(/\s+/g, ' ').slice(0, 80));
    await panel.locator('[data-action=learn-more]').click();
    const det = await panel.innerText();
    ok('learn more opens a plain explanation: where it is, what it does, movements', (await panel.getAttribute('data-panel')) === 'details' && /أين تقع/.test(det) && /ماذا تفعل/.test(det) && /تعمل في/.test(det));
    ok('no source or database data anywhere in the panel', !/Z-Anatomy|TA2|Wikipedia|الكائن|التسلسل|تصنيف المؤلف|بصمات|بيانات المصدر|المنشأ|المرتكز|التعصيب/.test(det), det.replace(/\s+/g, ' ').slice(0, 80));
    ok('nothing to expand into source data', (await panel.locator('details').count()) === 0);
    await panel.getByLabel('إغلاق البطاقة').click(); await rest(page);
    s = await st(page);
    ok('closing the panel deselects and gives the view back', s.sel === null && s.insets.left === 0);
    await page.getByLabel('بحث في العضلات').fill('');

    // settings
    await page.getByLabel('الإعدادات').first().click();
    const menu = page.getByRole('dialog', { name: 'الإعدادات' });
    ok('settings menu opens above the view', await menu.isVisible());
    await menu.getByRole('switch', { name: 'الأسماء بالإنجليزية' }).click();
    ok('English names switch', (await st(page)).english === true);
    await menu.getByRole('switch', { name: 'الأسماء بالإنجليزية' }).click();
    await menu.getByLabel('لون #173F8A').click();
    ok('selection colour choice', (await st(page)).color === '#173F8A');
    await menu.locator('button[aria-label^="لون"]').first().click();
    ok('no orange among the colours', !(await menu.locator('button[aria-label^="لون"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).some((c) => /E8602C|EEA585/i.test(c)));
    await page.mouse.click(700, 500); await page.waitForTimeout(300);
    ok('settings menu closes on outside click', !(await menu.isVisible().catch(() => false)));
    await T(page, () => window.__backStudioTest.store.getState().select(null));

    // body switch: seamless, without any message about the female model
    await rest(page);
    await T(page, () => { window.__prev = window.__backStudioTest.rawModel(); });
    // (preparing a body blocks the page for a while under software rendering: generous timeouts)
    await page.locator('[data-sex=female]').click({ timeout: 400000 });
    await page.waitForTimeout(600);
    const during = await page.locator('body').innerText({ timeout: 400000 });
    ok('switching body keeps the view (no full-screen loading)', (await page.locator('main canvas').count()) === 1 && !/تحميل المجسم…/.test(during));
    await page.waitForFunction(() => { const m = window.__backStudioTest.rawModel(); return m && m !== window.__prev; }, null, { timeout: 600000 });
    await page.waitForTimeout(1500);
    const after = await page.locator('body').innerText();
    ok('female body loads', (await st(page)).sex === 'female');
    ok('no warning or note about the female model', !WARN.test(during) && !WARN.test(after), (after.match(WARN) || [''])[0]);
    await page.locator('[data-sex=male]').click();
    await page.waitForFunction(() => window.__backStudioTest.store.getState().sex === 'male');
    const marks = (await page.locator('body').innerText()).match(/[\u064B-\u0652\u0670]/g);
    ok('no Arabic diacritics in the interface', !marks, marks ? `${marks.length} marks` : '');
    ok('no page errors (desktop)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  if (PARTS.includes('phone')) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent });
    const page = await ctx.newPage(); page.setDefaultTimeout(180000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/atlas?e2e=1&refine=0', { timeout: 300000 });
    await ready(page); await rest(page);
    const vp = page.viewportSize();
    const canvas = await page.locator('main[data-viewport-wrap]').boundingBox();
    ok('phone: the model takes most of the screen', canvas.height > vp.height * 0.8, `${Math.round(canvas.height)} of ${vp.height}`);
    const pf = await framing(page);
    ok('phone: full body fills 75–85 % of the view height, head and feet inside, not cut at the sides', framed(pf) && pf.left > 0 && pf.right < pf.width, `${(pf.fill * 100).toFixed(0)}% top ${pf.top} bottom ${pf.bottom}/${pf.height} x ${pf.left}..${pf.right}/${pf.width}`);
    ok('phone: control sheets start closed', (await st(page)).dock === null && !(await page.locator('[data-dock-sheet]').isVisible()));
    ok('phone: no horizontal scrolling', await T(page, () => document.documentElement.scrollWidth <= window.innerWidth));
    const small = await T(page, () => [...document.querySelectorAll('header button, header a, [role=tablist] button, [data-view], [data-action=zoom-in], [data-action=zoom-out]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 32 || r.width < 32); }).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 16)));
    ok('phone: controls are large enough to tap', small.length === 0, small.join(', '));

    await page.locator('[data-dock-tab=regions]').tap(); await rest(page);
    let sheet = await page.locator('[data-dock-sheet]').boundingBox();
    let s = await st(page);
    ok('phone: regions sheet covers at most half the screen', s.dock === 'regions' && sheet.height <= vp.height * 0.5 + 1 && s.insets.bottom > 100, `${Math.round(sheet.height)}px`);
    await page.locator('[data-region=abdomen]').tap(); await rest(page);
    s = await st(page);
    ok('phone: choosing a region closes the sheet', s.region === 'abdomen' && s.dock === null && s.insets.bottom === 0);
    await page.locator('[data-dock-tab=layers]').tap(); await page.waitForTimeout(500);
    await page.getByRole('switch', { name: 'الأعصاب الطرفية', exact: true }).tap();
    await page.waitForFunction(() => window.__backStudioTest.visibleKinds().nerve > 0, null, { timeout: 240000 }).catch(() => {});
    ok('phone: layer switch works (nerves)', (await kinds(page)).nerve > 0);
    await page.getByRole('switch', { name: 'الأعصاب الطرفية', exact: true }).tap();
    await page.locator('[data-dock-tab=layers]').tap(); await rest(page);
    ok('phone: tapping the tab again closes the sheet', (await st(page)).dock === null);

    const p = await T(page, () => window.__backStudioTest.pointFor('rectus-abdominis-muscle', 'l'));
    await page.touchscreen.tap(p.x, p.y); await rest(page);
    s = await st(page);
    const panel = page.locator('[role=dialog][data-panel]');
    const box = await panel.boundingBox();
    ok('phone: tap selects; a short sheet shows name, group, function', s.sel === 'rectus-abdominis-muscle' && box.height < vp.height * 0.36 && (await panel.innerText()).includes('المجموعة: البطن'), `${Math.round(box.height)}px`);
    ok('phone: the muscle stays visible above the sheet', await T(page, () => { const q = window.__backStudioTest.pointFor('rectus-abdominis-muscle', 'l'); const top = document.querySelector('[role=dialog][data-panel]').getBoundingClientRect().top; return !!q && q.y < top - 20; }));
    await panel.locator('[data-action=learn-more]').tap(); await panel.locator('[data-panel-tab=exercises]').tap(); await rest(page);
    ok('phone: with the exercises sheet open the muscle is still in view', await T(page, () => { const q = window.__backStudioTest.pointFor('rectus-abdominis-muscle', 'l'); const top = document.querySelector('[role=dialog][data-panel]').getBoundingClientRect().top; return !!q && q.y < top - 10 && q.y > 48; }));
    await page.locator('[data-dock-tab=muscles]').tap(); await page.waitForTimeout(500);
    ok('phone: a control sheet takes the place of the muscle panel', (await st(page)).dock === 'muscles' && !(await panel.isVisible()));
    await page.locator('[data-dock-tab=muscles]').tap(); await page.waitForTimeout(500);
    ok('phone: …and the panel comes back', await panel.isVisible());
    ok('no page errors (phone)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
