const { test, expect } = require('@playwright/test');
const { boot, navigate } = require('./helpers/v118-ux-fixture.cjs');

test.setTimeout(60000);

// Check children as well as page overflow: overflow:hidden used to hide broken cards.
async function expectContained(locator) {
  const failures = await locator.evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    return [...node.children].filter(child => {
      if (getComputedStyle(child).position === 'absolute') return false;
      const r = child.getBoundingClientRect();
      return r.width && (r.left < box.left - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1);
    }).map(child => `${node.className}: ${child.className}`);
  }));
  expect(failures).toEqual([]);
}

for (const width of [320,390,430,767,768,1024,1199,1200,1440]) {
  test(`layout fits ${width}px without changing financial state`, async ({ page }, info) => {
    await boot(page,width,false);
    const before = await page.evaluate(() => JSON.stringify(state));
    for (const owner of ['gezamenlijk','dion','dara']) {
      await navigate(page,owner);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      if (width < 768) {
        const grid = page.locator(`#tab-${owner} .mobile-kpi-grid`);
        expect(await grid.evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
        expect(await grid.evaluate(e=>e.getBoundingClientRect().right<=document.documentElement.clientWidth+1)).toBe(true);
        await expectContained(grid.locator(':scope > .mobile-kpi-card'));
        const cards = await page.locator(`#tab-${owner} .joint-two-column-row > .card`).evaluateAll(nodes => nodes.map(e => {
          const r=e.getBoundingClientRect(); return {top:r.top,bottom:r.bottom};
        }));
        expect(cards[1].top).toBeGreaterThanOrEqual(cards[0].bottom);
      } else if (width < 1200) {
        const cards = await page.locator(`#tab-${owner} .u5-joint-activity-row > .card`).evaluateAll(nodes => nodes.map(e => {
          const r=e.getBoundingClientRect(); return {top:r.top,bottom:r.bottom};
        }));
        expect(cards[1].top).toBeGreaterThanOrEqual(cards[0].bottom);
      }
    }
    await navigate(page,'spaardoelen');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if (width >= 768 && width < 1200) {
      await expectContained(page.locator('.u5-goal-detail-hero'));
      const panels = await page.locator('.u5-goal-master > .card').evaluateAll(nodes => nodes.map(e => {
        const r=e.getBoundingClientRect(); return {top:r.top,bottom:r.bottom};
      }));
      expect(panels[1].top).toBeGreaterThanOrEqual(panels[0].bottom);
    }
    await page.screenshot({path:info.outputPath(`goals-${width}.png`)});
    await navigate(page,'dashboard');
    const filters = page.locator('.p3-filters');
    expect(await filters.evaluate(e => e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
    await expectContained(filters);
    expect(await page.evaluate(() => JSON.stringify(state))).toBe(before);
  });
}

for (const iphone of [false,true]) test(`text sizes and info controls retain their original appearance (${iphone?'iPhone':'standard'})`, async ({browser}) => {
  const fs = require('node:fs');
  const css = fs.readFileSync('app.css','utf8').split('/* Finize bron: responsive-fit.css */')[0];
  const context = await browser.newContext(iphone ? {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'} : {});
  try {
    const baseline = await context.newPage(), current = await context.newPage();
    await baseline.route('**/app.css*', route => route.fulfill({contentType:'text/css',body:css}));
    const read = page => page.evaluate(() => {
      const selector = '.wrap.active :is(.mobile-kpi-label,.mobile-kpi-value,.mobile-kpi-edit-hint,.mobile-savings-kpis small,.mobile-savings-kpis strong,.mobile-goal-main em,.p3-info-button,.p3-filters button)';
      return [...document.querySelectorAll(selector)].filter(e=>e.getBoundingClientRect().width).map(e=>{
        const style=getComputedStyle(e),r=e.getBoundingClientRect();
        return {text:e.textContent,font:style.fontSize,...(e.matches('.p3-info-button')?{width:r.width,height:r.height,hit:getComputedStyle(e,'::after').inset}:{})};
      });
    });
    await boot(baseline,390,false);await boot(current,390,false);
    for(const tab of ['dashboard','gezamenlijk','dion','spaardoelen']){
      await navigate(baseline,tab);await navigate(current,tab);
      const original=await read(baseline);
      expect(original.length).toBeGreaterThan(0);
      expect(await read(current)).toEqual(original);
    }
  } finally {await context.close();}
});

test('mobile goal editor has one scroll owner and keeps save and close reachable', async ({page}) => {
  await boot(page,390,false);await navigate(page,'spaardoelen');
  const before=await page.evaluate(()=>JSON.stringify(state));
  await page.locator('[data-open-goal-editor]:visible').first().click();
  const dialog=page.getByRole('dialog',{name:'Spaardoel bewerken'});
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
  expect(await dialog.evaluate(e=>getComputedStyle(e).overflowY)).toBe('visible');
  expect(await page.locator('#incomeEditModal').evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
  await dialog.getByRole('button',{name:'Opslaan',exact:true}).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button',{name:'Opslaan',exact:true})).toBeInViewport();
  await dialog.getByRole('button',{name:'Sluiten',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.stringify(state))).toBe(before);
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
});
