const {test,expect}=require('@playwright/test');
const {boot,attach,newHousehold}=require('../helpers/v117-p4-browser.cjs');
const {state}=require('../helpers/package5-fixture.cjs');
test.use({serviceWorkers:'allow',actionTimeout:15000});test.setTimeout(300000);
async function load(page,text,name,expected=text.split('\n').length-1){
  await page.evaluate(()=>openBankImportForOwner('gezamenlijk'));
  await page.locator('[data-u4-file]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(text)});
  if(expected===0)await expect(page.locator('#u4ImportModalRoot summary').filter({hasText:'Eerder geïmporteerd — overgeslagen'})).toContainText('1');
  await expect(page.locator('[data-u4-row]')).toHaveCount(expected);
  await page.locator('#u4ImportModalRoot details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  return page.locator('[data-u4-row]').evaluateAll(nodes=>nodes.map(n=>n.dataset.u4Row).sort());
}
async function approve(page,id,count){
  await page.locator(`[data-u4-row="${id}"] [data-u4-approve]`).click();
  await expect.poll(async()=>await page.locator('[data-u4-match-only]').isVisible()||await page.evaluate(()=>['2026-09','2026-10'].reduce((n,month)=>n+FinizeTransactions.effects({month}).length,0))>=count).toBe(true);
  if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();
  await expect.poll(()=>page.evaluate(()=>['2026-09','2026-10'].reduce((n,month)=>n+FinizeTransactions.effects({month}).length,0))).toBe(count);
}
const header='Datum;Omschrijving;Rekening;Tegenrekening;Bedrag\n';
for(const salaryMonth of ['2026-09','2026-10'])test(`P4 legacy salary ${salaryMonth} without reliable person blocks totals visibly and preserves data`,async({page})=>{
  const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  const {row,materialize}=require('../helpers/package5-fixture.cjs'),payment=row('Ongekoppeld salaris','salaris',2530);payment.bankOriginal.bankDate=salaryMonth+'-03';payment.processing.processingDate=salaryMonth+'-03';materialize(s,[payment]);
  await boot(page,f,s);await expect(page.getByRole('heading',{name:'Salaris koppelen'})).toBeVisible();await expect(page.locator('[data-salary-review]')).toHaveCount(1);
  expect(await page.evaluate(()=>state.transactions.filter(t=>t.recordRole!=='bank-source').map(t=>t.financialFor))).toEqual(['gezamenlijk']);
  expect(await page.evaluate(()=>FinizeTransactions.total('incomeImpact'))).toBe(2530);
  await page.locator('[data-tab-shortcut="data"]').click();await expect(page.getByRole('heading',{name:'Offline opslag',exact:true})).toBeVisible();
});
test('P4 salary person proposal, explicit correction, offline restart and second client preserve cents',async({page,browser})=>{
  const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:2500}],dara:[{effectiveFrom:'0000-01',salary:3200}]};
  await boot(page,f,s);await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await attach(page,f,{initialize:true});await page.context().setOffline(true);
  const ids=await load(page,header+'2026-10-03;Salaris werkgever A;NL01JOINT;NL10EMPLOYERA;2530\n2026-10-04;Salaris werkgever B;NL01JOINT;NL20EMPLOYERB;3200\n2026-10-05;Vakantiegeld;NL01JOINT;NL10EMPLOYERA;100\n2026-10-06;Bonus;NL01JOINT;NL10EMPLOYERA;50','salarissen.csv');
  const first=page.locator(`[data-u4-row="${ids[0]}"]`);await expect(first.locator('[data-u4-field="salaryPersonId"]')).toHaveValue('');
  await first.locator('[data-u4-approve]').click();await expect(first.locator('[data-u4-validation-field="salaryPersonId"]')).toBeVisible();expect(await page.evaluate(()=>FinizeTransactions.total('incomeImpact'))).toBe(0);
  await page.locator('[data-u4-validation-close]').click();
  for(const [i,person]of ['dion','dara'].entries()){
    await page.locator(`[data-u4-row="${ids[i]}"] [data-u4-field="salaryPersonId"]`).selectOption(person);
    if(i===0)await page.locator(`[data-u4-row="${ids[i]}"]`).screenshot({path:'backups/v117-stabilisatie/p4-salary-person-ui.png'});
    await approve(page,ids[i],i+1);
  }
  for(const i of [2,3]){await expect(page.locator(`[data-u4-row="${ids[i]}"] [data-u4-field="salaryPersonId"]`)).toHaveCount(0);await approve(page,ids[i],i+1);}
  await page.locator('.u4-modal-head [data-u4-close]').click();
  expect(await page.evaluate(()=>state.advanceLedger||[])).toEqual([]);
  expect(await page.evaluate(()=>({forecast:FinizeTransactions.forecast('2026-10').household.income,actual:FinizeTransactions.income('2026-10').amount,planned:FinizePlanning.income('2026-10','dion').salary}))).toEqual({forecast:5880,actual:5880,planned:2500});
  await page.reload();await page.waitForFunction(()=>window.__finizeBootstrap?.rendered);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10').household.income)).toBe(5880);
  await page.context().setOffline(false);await attach(page,f);expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');
  const historical=header+'2026-09-30;Salaris werkgever A september;NL01JOINT;NL10EMPLOYERA;2530';
  const [id]=await load(page,historical,'historisch-salaris.csv');const item=page.locator(`[data-u4-row="${id}"]`);
  await expect(item.locator('[data-u4-field="salaryPersonId"]')).toHaveValue('dion');await expect(item.locator('.u4-status')).toHaveText('Nakijken');expect(await page.evaluate(()=>['2026-09','2026-10'].reduce((n,month)=>n+FinizeTransactions.effects({month}).length,0))).toBe(4);
  await item.locator('[data-u4-field="salaryPersonId"]').selectOption('dara');await approve(page,id,5);await page.locator('.u4-modal-head [data-u4-close]').click();
  expect(await page.evaluate(()=>FinizeTransactions.income('2026-09','dara').amount)).toBe(2530);
  const previous=await page.evaluate(()=>state.transactions.find(t=>t.recordRole!=='bank-source'&&t.salaryMonth==='2026-09'));
  await page.evaluate(id=>FinizeUpdate4.openTransactionSource(id),previous.id);const edit=page.locator(`[data-u4-row="${id}"]`);
  await edit.locator('[data-u4-field="salaryPersonId"]').selectOption('dion');await edit.locator('[data-u4-approve]').click();
  if(await page.locator('[data-u4-match-only]').isVisible())await page.locator('[data-u4-match-only]').click();
  await expect.poll(()=>page.evaluate(()=>FinizeTransactions.income('2026-09','dion').amount)).toBe(2530);
  await page.locator('.u4-modal-head [data-u4-close]').click();
  expect(await page.evaluate(()=>FinizeTransactions.income('2026-09','dara').amount)).toBe(0);
  expect(await page.evaluate(id=>state.transactions.find(t=>t.id===id).bankOriginal,previous.id)).toEqual(previous.bankOriginal);
  // Re-import the exact same bank file: no sixth bank movement or effect.
  await load(page,historical,'historisch-salaris.csv',0);await page.locator('.u4-modal-head [data-u4-close]').click();expect(await page.evaluate(()=>['2026-09','2026-10'].reduce((n,month)=>n+FinizeTransactions.effects({month}).length,0))).toBe(5);
  expect((await page.evaluate(()=>p4.sync())).outcome).toBe('committed');expect((await page.evaluate(()=>p4.sync())).outcome).toBe('idle');
  const proof=await page.evaluate(()=>({oct:FinizeTransactions.forecast('2026-10'),sep:FinizeTransactions.forecast('2026-09'),sources:state.transactions.filter(t=>t.recordRole==='bank-source').map(t=>t.id).sort(),effects:['2026-09','2026-10'].flatMap(month=>FinizeTransactions.effects({month}).map(p=>p.id)).sort(),goals:state.savingsGoalLedger}));
  expect(proof.oct.household.income).toBe(5880);expect(proof.sep.owners.dion.salary).toBe(2530);expect(proof.sep.owners.dara.salary).toBe(3200);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',serviceWorkers:'block'});
  try{const second=await context.newPage();await boot(second,f);await attach(second,f);expect(await second.evaluate(()=>({oct:FinizeTransactions.forecast('2026-10'),sep:FinizeTransactions.forecast('2026-09'),sources:state.transactions.filter(t=>t.recordRole==='bank-source').map(t=>t.id).sort(),effects:['2026-09','2026-10'].flatMap(month=>FinizeTransactions.effects({month}).map(p=>p.id)).sort(),goals:state.savingsGoalLedger}))).toEqual(proof);}finally{await context.close();}
});
test('P4 manual salary person is editable while other income keeps its bank account destination',async({page})=>{
  const f=await newHousehold(),s=state();s.meta.selectedMonth='2026-10';s.monthRecords={};
  await boot(page,f,s);await page.evaluate(()=>FinizeManual.open('gezamenlijk'));
  await page.locator('#jointTxAmount').fill('2530');await page.locator('#jointTxDate').fill('2026-10-03');await page.locator('#jointTxType').selectOption('salaris');
  await page.locator('#jointTxSalaryPerson').selectOption('dion');await page.locator('#btnSaveJointTransaction').click();await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
  const id=await page.evaluate(()=>state.transactions.find(t=>t.source==='manual').id);
  expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','dion').amount)).toBe(2530);
  await page.evaluate(id=>FinizeManual.open('gezamenlijk',id),id);await page.locator('#jointTxSalaryPerson').selectOption('dara');await page.locator('#btnSaveJointTransaction').click();await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
  expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','dion').amount)).toBe(0);expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','dara').amount)).toBe(2530);
  await page.evaluate(id=>FinizeManual.open('gezamenlijk',id),id);await page.locator('#jointTxType').selectOption('vakantiegeld');await expect(page.locator('#jointTxSalaryPerson')).toBeHidden();await page.locator('#btnSaveJointTransaction').click();await expect(page.locator('#transactionModal')).not.toHaveClass(/open/);
  expect(await page.evaluate(()=>FinizeTransactions.income('2026-10','gezamenlijk').amount)).toBe(2530);expect(await page.evaluate(()=>FinizeTransactions.forecast('2026-10').owners.dara.salary)).toBe(2000);
});
