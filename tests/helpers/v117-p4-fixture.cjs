const {state,row,materialize}=require('./package5-fixture.cjs');
const commands=require('../../src/core/transaction-processing.mjs');
const {defaultPeriodWindow}=require('../../src/storage/period-cache.mjs');
function administration(months,bankMovements=months*150,{rich=false}={}){
  if(!Number.isInteger(months)||months<1||!Number.isInteger(bankMovements)||bankMovements<months*2*8)throw new Error('Ongeldige schaalfixture.');
  const s={...require('./migration-runtime.cjs')().migrateBudgetState(require('../fixtures/v50-visual-state.json')),...state()},imports=[];s.meta.selectedMonth='2026-10';s.monthRecords={};
  for(const owner of ['gezamenlijk','dion','dara'])s.budgetDefaultsHistory[owner]=[{id:'budget-'+owner,effectiveFrom:'0000-01',rows:[{id:'clothing-'+owner,post:'Kleding',bedrag:500}]},{id:'budget-history-'+owner,effectiveFrom:'2025-01',rows:[{id:'clothing-'+owner,post:'Kleding',bedrag:600}]}];
  s.accountProfiles.push({id:'dion',accountOwner:'dion',identifier:'NL02DION'},{id:'savings',accountOwner:'gezamenlijk',identifier:'NL03SAVINGS'});
  if(rich){s.accountProfiles.push({id:'dara',accountOwner:'dara',identifier:'NL04DARA'});s.incomeDefaultsHistory={dion:[{effectiveFrom:'0000-01',salary:3000},{effectiveFrom:'2025-01',salary:2500}],dara:[{effectiveFrom:'0000-01',salary:2000},{effectiveFrom:'2025-01',salary:3200}]};}
  s.recurringFixedExpenses=[{id:'rent',naam:'Huur',categorie:'Wonen',bedrag:100,financialFor:'gezamenlijk',rekening:'gezamenlijk',begindatum:'2020-01-01',actief:true,frequentieAantal:1,frequentieEenheid:'maanden',amountHistory:[{effectiveFrom:'2020-01-01',amount:100}]}];
  if(rich)s.recurringFixedExpenses[0].amountHistory.push({effectiveFrom:'2025-01-01',amount:120});
  const end=new Date(Date.UTC(2026,9,1));
  for(let m=months-1;m>=0;m--){
    const month=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-m,1)).toISOString().slice(0,7),previous=defaultPeriodWindow(month)[1];
    const accounts=rich?3:2;
    for(let account=0;account<accounts;account++){
      const owner=['gezamenlijk','dion','dara'][account],profile=['joint','dion','dara'][account],identifier=['NL01JOINT','NL02DION','NL04DARA'][account],rows=[];
      const bucket=(months-1-m)*accounts+account,count=Math.floor(bankMovements/(months*accounts))+(bucket<bankMovements%(months*accounts)?1:0);
      for(let i=0;i<count;i++){
        const regular=rich&&account>0&&i===0,extraIncome=rich&&account>0&&i===15;
        const id=month+'-'+owner+'-'+i,variant=i%15,amount=regular?(owner==='dion'?2530:3200):extraIncome?100:variant===0?1500:variant===2?25:variant===3?20:variant===5?-(rich&&month>='2025-01'?120:100):variant===6?-150:variant===1?-50:-10-(i%7);
        const type=regular?'salaris':extraIncome?'vakantiegeld':variant===0?'inkomen':variant===1?'naar-spaarrekening':variant===2?'van-spaarrekening':variant===3?'terugbetaling':variant===4?'interne-overboeking':variant===5?'vaste-last':'uitgave';
        const extra={budgetOwner:owner,savingsGoalId:['naar-spaarrekening','van-spaarrekening'].includes(type)?'goal':'',refundMonth:variant===3?previous:'',refundCategory:'Kleding',sourceAccountProfileId:profile,destinationAccountProfileId:account?'joint':'dion'};
        if(regular)Object.assign(extra,{salaryPersonId:owner,salarySourceId:'income-defaults-salary-'+owner,salaryMonth:month,salaryLinkVersion:117});
        if(variant===5)Object.assign(extra,{category:'Wonen',fixedExpenseId:'rent',fixedOccurrenceId:'rent:'+month+'-01',fixedOccurrenceMonth:month});
        if(variant===6)extra.splits=[{id:id+'-a',amount:100,category:'Wonen',transactionType:'vaste-last',budgetOwner:owner,fixedExpenseId:'rent',fixedOccurrenceId:'rent:'+previous+'-01',fixedOccurrenceMonth:previous},{id:id+'-b',amount:50,category:'Kleding',transactionType:'uitgave',budgetOwner:owner}];
        const r=row(id,type,amount,extra);r.accountOwner=owner;r.accountProfileId=profile;r.bankOriginal.bankDate=month+'-03';r.bankOriginal.accountIdentifier=identifier;r.processing.processingDate=month+'-03';if(regular)r.bankOriginal.counterpartyAccount=owner==='dion'?'NL10EMPLOYERA':'NL20EMPLOYERB';
        // Same visible name/date/amount; independent immutable raw bank identities.
        if(variant>=7){r.bankOriginal.description='Winkel X';r.processing.description='Winkel X';}
        rows.push(r);
      }
      const batch=materialize(s,rows,month+'-'+owner,{accountProfileId:profile,accountOwner:owner});batch.sourceFile={name:month+'-'+owner+'.csv',digest:'fixture-'+month+'-'+owner};batch.originalCsv=rows.map(r=>r.bankOriginal.rawCells.join(';')).join('\n');imports.push(batch);
    }
  }
  const withdrawal=s.transactions.find(t=>t.id==='tx-2026-10-gezamenlijk-2'),expense=s.transactions.find(t=>t.id==='tx-2026-10-gezamenlijk-7');
  if(withdrawal&&expense)commands.setSavingsCoverageAllocation(s,{id:'p4-coverage',withdrawalTransactionId:withdrawal.id,expenseTransactionId:expense.id,amountCents:1000});
  commands.correctGoalBalance(s,'goal',2150,{id:'p4-historical-correction',month:'2026-09'});
  return {state:s,imports,bankMovements,months};
}
module.exports={administration};
