// Read-only UI comparison; all financial writes are confined to synthetic browser storage.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { boot, navigate } = require('../tests/browser/helpers/v118-ux-fixture.cjs');
const output = process.argv[2];
if (!output) throw new Error('Geef een uitvoermap voor de screenshots op.');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const results = [], errors = [];
  try {
    for (const width of [320,390,430,768,1024,1440]) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push({ width, message: e.message }));
      await boot(page, width);
      async function capture(name) {
        await page.evaluate(() => scrollTo(0,0)); await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
        results.push({ width, name, ...await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          boxes: [...document.querySelectorAll('.wrap.active .card,.wrap.active .p3-panel,.wrap.active .p3-kpi,.v4-sidebar,.v4-bottom-nav,.modal-backdrop.open .modal')]
            .filter(e => e.getBoundingClientRect().width && e.getBoundingClientRect().height).map(e => {
              const r=e.getBoundingClientRect();return { cls:e.className,x:r.x,y:r.y,w:r.width,h:r.height };
            })
        })) });
      }
      for (const tab of ['dashboard','gezamenlijk','dion','dara','spaardoelen','settings','data']) {
        await navigate(page,tab); await capture(tab);
      }
      await navigate(page,'dashboard');
      results.push({ width, name:'financial-before', values: await page.evaluate(async () => ({
        scenario:FinizeUpdate3.scenarioResult(),
        months:Array.from({length:12},(_,i)=>FinizeTransactions.forecast(`2026-${String(i+1).padStart(2,'0')}`)),
        projections:await Promise.all(['gezamenlijk','dion','dara'].map(owner=>FinizeLiquidity.project({accountProfileId:`ux-${owner}`,asOfDate:'2026-10-14',startDate:'2026-10-01',endDate:'2026-10-31'})))
      })) });
      if(await page.locator('[data-p3-info]').count()){
        for(const key of ['free','balance','minimum','buffer','chart']){
          await page.locator(`[data-p3-info="${key}"]`).click();await capture(`informatie-${key}`);await page.keyboard.press('Escape');
        }
      }
      const saved = await page.evaluate(() => JSON.stringify(state.balanceCheckpoints));
      await page.locator('[data-p3-context="persoonlijk"]').click(); await page.waitForTimeout(200); await capture('vooruitblik-persoonlijk');
      await page.locator('[data-p3-context="gezamenlijk"]').click(); await page.waitForTimeout(200);
      await page.evaluate(()=>{state.balanceCheckpoints.find(c=>c.accountProfileId==='ux-gezamenlijk').amountCents=10000;});
      await navigate(page,'dashboard'); await capture('prognose-negatief');
      await page.evaluate(()=>{state.balanceCheckpoints=[];}); await navigate(page,'dashboard'); await capture('prognose-onbekend');
      await page.evaluate(saved=>{state.balanceCheckpoints=JSON.parse(saved);state.balanceCheckpoints.find(c=>c.accountProfileId==='ux-gezamenlijk').asOfDate='2026-10-13';},saved);
      await navigate(page,'dashboard'); await capture('prognose-later-ijkpunt');
      await page.evaluate(saved=>{state.balanceCheckpoints=JSON.parse(saved);},saved);
      await navigate(page,'gezamenlijk'); await page.evaluate(()=>openTransactionModal()); await capture('transactie');
      await page.locator('#btnCancelJointTransaction').click();
      await navigate(page,'dion'); await page.getByRole('button',{name:'Maandbudgetten van Dion wijzigen'}).click(); await capture('budget');
      await page.locator('[data-close-joint-variable-costs]').click();
      await navigate(page,'spaardoelen'); await page.locator('[data-open-goal-editor]:visible').first().click(); await capture('spaardoel');
      await page.locator('[data-close-goal-editor]').click();
      await navigate(page,'gezamenlijk'); await page.evaluate(()=>openBankImportForOwner('gezamenlijk')); await capture('bankimport');
      await page.locator('[data-u4-close]').click();
      // Reuse the existing synthetic import draft without approving or processing any row.
      const source=fs.readFileSync(path.join(__dirname,'../tests/browser/import-review-simplification.spec.cjs'),'utf8');
      const start=source.indexOf('await page.evaluate(()=>{')+'await page.evaluate('.length;
      const end=source.indexOf('\n  });',start);
      await page.evaluate('('+source.slice(start,end)+'\n})()'); await capture('importcontrole');
      await context.close();
      fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));
      console.log(`Nulmeting/vergelijking ${width}px vastgelegd`);
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
