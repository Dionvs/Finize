const {test}=require('node:test');const assert=require('node:assert/strict');
test('voorbereiding maakt rekening gelijk per toekomstig tijdvak zonder historie of transacties te veranderen',async()=>{
 const {prepareFixedAccountAlignment}=await import('../src/core/fixed-account-alignment.mjs');const {resolveRecurringConfig}=await import('../src/core/planning-timeline.mjs');
 const state={transactions:[{id:'tx',amount:20}],recurringFixedExpenses:[{id:'x',naam:'Voorbeeld',rekening:'gezamenlijk',financialFor:'dion',bedrag:100,begindatum:'2025-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{id:'old',effectiveFrom:'2025-01',amount:100},{id:'future',effectiveFrom:'2027-02',amount:125,config:{financialFor:'dara',categorie:'Verzekering'}}],monthOverrides:{'2026-11':{amount:110,config:{financialFor:'dara'}},'2027-03':{amount:130,config:{rekening:'dion'}}}}]};
 const before=structuredClone(state),{candidate,changes}=prepareFixedAccountAlignment(state);assert.deepEqual(state,before);assert.deepEqual(candidate.transactions,before.transactions);assert.equal(changes.length,1);
 for(const month of ['2026-10','2026-11','2026-12','2027-02','2027-03','2027-04']){
  const old=resolveRecurringConfig(before.recurringFixedExpenses[0],month),next=resolveRecurringConfig(candidate.recurringFixedExpenses[0],month);
  assert.equal(next.bedrag,old.bedrag);assert.equal(next.financialFor,old.financialFor);assert.equal(next.categorie,old.categorie);assert.equal(next.rekening,month<'2026-11'?old.rekening:old.financialFor);
 }
 assert.deepEqual(prepareFixedAccountAlignment(candidate).changes,[]);
});
test('reeds gelijke gegevens blijven ongewijzigd en ongeldige rekeningen blokkeren de voorbereiding',async()=>{
 const {prepareFixedAccountAlignment}=await import('../src/core/fixed-account-alignment.mjs');const item={id:'x',rekening:'dion',financialFor:'dion',bedrag:5,begindatum:'2026-01-01',actief:true};const state={recurringFixedExpenses:[item]};assert.deepEqual(prepareFixedAccountAlignment(state).candidate,state);assert.deepEqual(prepareFixedAccountAlignment(state).changes,[]);assert.throws(()=>prepareFixedAccountAlignment({recurringFixedExpenses:[{...item,financialFor:'onbekend'}]}),/Onbekende rekening/);
});
