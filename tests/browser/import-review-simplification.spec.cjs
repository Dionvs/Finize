const {expect,test}=require('@playwright/test');

async function openReview(page){
  await page.goto('/');
  await page.evaluate(()=>{
    state.accountProfiles=[
      {id:'joint',name:'Gezamenlijk',identifier:'NL01JOINT',accountOwner:'gezamenlijk'},
      {id:'dion-account',name:'Dion',identifier:'NL01DION',accountOwner:'dion'},
      {id:'dara-account',name:'Dara',identifier:'NL01DARA',accountOwner:'dara'}
    ];
    state.recurringFixedExpenses[state.meta.scenario]=[
      {id:'fixed-energy',naam:'Energie',financialFor:'gezamenlijk',rekening:'gezamenlijk',amountHistory:[{effectiveFrom:'2026-01-01',amount:100}],monthOverrides:{}}
    ];
    state.spaardoelen.gezamenlijk=[{id:'goal-buffer',naam:'Buffer',doelbedrag:1000,algespaard:0}];
    window.__reviewDraft={
      id:'review-layout',fileName:'review.csv',bank:'ING',format:'ing',status:'concept',accountProfileId:'joint',accountOwner:'gezamenlijk',
      rows:[{id:'review-row',certainty:'nakijken',duplicate:false,reasons:[],bankOriginal:{valid:true,amount:-100,description:'Leverancier',rawDescription:'Leverancier',bankDate:'2026-08-05',accountIdentifier:'NL01JOINT',counterpartyAccount:'NL01OTHER',fingerprint:'review-row',lineNumber:1},processing:{processingDate:'2026-08-05',processedAmount:100,budgetOwner:'gezamenlijk',category:'Overig',transactionType:'uitgave',include:true,note:'',fixedExpenseId:'',fixedAmountMode:'none',savingsGoalId:'',sourceAccountProfileId:'',destinationAccountProfileId:'',repaymentAllocations:[],budgetItemId:'',splits:[],advanceMode:'auto'}}],
      summary:{}
    };
    window.FinizeUpdate4Runtime.testRenderDraftModal(window,window.__reviewDraft);
  });
  return page.locator('[data-u4-row="review-row"]');
}

test('CSV-controle toont vier hoofdvelden en alleen relevante vervolgkeuzes',async({page})=>{
  const row=await openReview(page);
  await expect(row.locator('.u4-row-grid > label')).toHaveCount(4);
  await expect(row.locator('.u4-row-grid')).toContainText('Datum');
  await expect(row.locator('.u4-row-grid')).toContainText('Bedrag');
  await expect(row.locator('.u4-row-grid')).toContainText('Budgeteigenaar');
  await expect(row.locator('.u4-row-grid')).toContainText('Transactie');
  await expect(page.locator('.u4-profile-section')).not.toHaveAttribute('open','');
  await expect(page.locator('.u4-bulk-section')).not.toHaveAttribute('open','');

  await row.locator('[data-u4-family]').selectOption('inkomen');
  await expect(row.locator('[data-u4-field="transactionType"]')).toBeVisible();
  await expect(row.locator('.u4-dependent-grid')).toContainText('Soort inkomen');
  expect(await page.evaluate(()=>window.__reviewDraft.rows[0].processing.transactionType)).toBe('overige-inkomsten');

  await row.locator('[data-u4-family]').selectOption('sparen');
  await expect(row.locator('[data-u4-field="savingsGoalId"]')).toBeVisible();
  await row.locator('[data-u4-field="savingsGoalId"]').selectOption('goal-buffer');
  expect(await page.evaluate(()=>window.__reviewDraft.rows[0].processing.savingsGoalId)).toBe('goal-buffer');

  await row.locator('[data-u4-family]').selectOption('uitgave');
  await row.locator('[data-u4-field="category"]').selectOption('Vaste lasten');
  await expect(row.locator('[data-u4-field="fixedExpenseId"]')).toBeVisible();
  await row.locator('[data-u4-field="fixedExpenseId"]').selectOption('fixed-energy');
  expect(await page.evaluate(()=>({type:window.__reviewDraft.rows[0].processing.transactionType,fixed:window.__reviewDraft.rows[0].processing.fixedExpenseId}))).toEqual({type:'vaste-last',fixed:'fixed-energy'});

  await row.locator('[data-u4-family]').selectOption('zakgeld');
  await expect(row.locator('[data-u4-field="budgetOwner"] option')).toHaveText(['Kies Dion of Dara','Dion','Dara']);
  await row.locator('[data-u4-field="budgetOwner"]').selectOption('dion');
  expect(await page.evaluate(()=>window.__reviewDraft.rows[0].processing.transactionType)).toBe('maandelijkse-bijdrage');

  await row.locator('[data-u4-family]').selectOption('extra-bijdrage');
  expect(await page.evaluate(()=>window.__reviewDraft.rows[0].processing.transactionType)).toBe('extra-bijdrage');

  await row.locator('[data-u4-family]').selectOption('overboeking');
  await expect(row.locator('[data-u4-field="sourceAccountProfileId"]')).toBeVisible();
  await expect(row.locator('[data-u4-field="destinationAccountProfileId"]')).toBeVisible();

  await row.locator('[data-u4-family]').selectOption('terugbetaling');
  await expect(row.locator('.u4-dependent-grid')).toContainText('Soort terugbetaling');

  await row.locator('[data-u4-family]').selectOption('niet-meetellen');
  expect(await page.evaluate(()=>({type:window.__reviewDraft.rows[0].processing.transactionType,include:window.__reviewDraft.rows[0].processing.include}))).toEqual({type:'niet-meetellen',include:false});
});

test('de vier hoofdvelden blijven op telefoon twee bij twee',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const row=await openReview(page);
  const columns=await row.locator('.u4-row-grid').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
