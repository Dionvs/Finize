const { expect, test } = require('@playwright/test');

test('vijftig importrenders houden één gedelegeerde click- en change-handler', async ({ page }) => {
  await page.goto('/');
  const counts = await page.evaluate(() => {
    document.getElementById('u4ImportModalRoot')?.remove();
    const modal = document.createElement('div');
    modal.id = 'u4ImportModalRoot';
    document.body.appendChild(modal);
    const registrations = { click: 0, change: 0 };
    const nativeAdd = modal.addEventListener.bind(modal);
    modal.addEventListener = (type, listener, options) => {
      if (type === 'click' || type === 'change') registrations[type] += 1;
      return nativeAdd(type, listener, options);
    };
    const draft = {
      id: 'listener-test',
      fileName: 'listener-test.csv',
      bank: 'ING',
      format: 'ing',
      status: 'concept',
      accountOwner: 'gezamenlijk',
      rows: [],
      summary: {}
    };
    for (let index = 0; index < 50; index += 1) {
      window.FinizeUpdate4Runtime.testRenderDraftModal(window, draft);
    }
    return registrations;
  });
  expect(counts).toEqual({ click: 1, change: 1 });
});

test('vaste lasten volgen de budgeteigenaar en datums zijn Nederlands', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    state.recurringFixedExpenses[state.meta.scenario] = [
      {id:'fixed-joint',naam:'Gezamenlijke verzekering',financialFor:'gezamenlijk',rekening:'gezamenlijk'},
      {id:'fixed-dion',naam:'Dion telefoon',financialFor:'dion',rekening:'dion'},
      {id:'fixed-dara',naam:'Dara telefoon',financialFor:'dara',rekening:'dara'}
    ];
    const draft = {
      id:'fixed-owner-test',fileName:'test.csv',bank:'ING',format:'ing',status:'concept',accountOwner:'dion',
      rows:[{id:'row-fixed',certainty:'nakijken',duplicate:false,reasons:[],bankOriginal:{valid:true,amount:-10,description:'Test',bankDate:'2026-08-03',accountIdentifier:'NL01TEST',counterpartyAccount:'',fingerprint:'fixed-test',lineNumber:1},processing:{processingDate:'2026-08-03',processedAmount:10,budgetOwner:'dion',category:'Overig',transactionType:'uitgave',include:true,note:'',fixedExpenseId:'fixed-dion',splits:[]}}],
      summary:{}
    };
    window.FinizeUpdate4Runtime.testRenderDraftModal(window,draft);
  });
  const modal=page.locator('#u4ImportModalRoot');
  await expect(modal).toContainText('03-08-2026');
  await expect(modal.locator('[data-u4-field="fixedExpenseId"] option')).toHaveText(['Geen vaste last','Dion telefoon']);
  await modal.locator('[data-u4-field="budgetOwner"]').selectOption('dara');
  await expect(modal.locator('[data-u4-field="fixedExpenseId"] option')).toHaveText(['Geen vaste last','Dara telefoon']);
  await expect(modal.locator('[data-u4-field="fixedExpenseId"]')).toHaveValue('');
});

test('importkaart toont geselecteerde maand en historie heeft maandkoppen', async ({ page }) => {
  await page.goto('/');
  const result=await page.evaluate(() => {
    state.meta.selectedMonth='2026-08';
    state.accountProfiles=[{id:'account-dion',name:'Betaalrekening',identifier:'NL01TEST0000000001',accountOwner:'dion'}];
    state.importSummaries=[
      {id:'aug',accountProfileId:'account-dion',status:'verwerkt',periodFrom:'2026-08-01',periodTo:'2026-08-31',importDate:'2026-08-31',newCount:3,duplicateCount:0,totalExpenses:30},
      {id:'jul',accountProfileId:'account-dion',status:'verwerkt',periodFrom:'2026-07-01',periodTo:'2026-07-31',importDate:'2026-07-31',newCount:2,duplicateCount:0,totalExpenses:20}
    ];
    const host=document.createElement('div');
    host.innerHTML=renderBankImportSection();
    document.body.appendChild(host);
    const compact=[...host.querySelectorAll('[data-u4-open-receipt]')].map(item=>item.dataset.u4OpenReceipt);
    bindBankImport(host);
    host.querySelector('[data-u4-all-imports]').click();
    const headings=[...document.querySelectorAll('#u4ImportModalRoot .u4-import-month h3')].map(item=>item.textContent);
    const accountLabel=host.querySelector('[data-u4-open-receipt] strong')?.textContent;
    host.remove();
    return {compact,headings,accountLabel};
  });
  expect(result.compact).toEqual(['aug']);
  expect(result.headings).toEqual(['augustus 2026','juli 2026']);
  expect(result.accountLabel).toBe('Betaalrekening · NL01TEST0000000001');
});
