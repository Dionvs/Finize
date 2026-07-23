const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function u3RecognitionFromLegacy');
const end = html.indexOf('function normalizeBudgetState', start);
assert.ok(start >= 0 && end > start, 'Update 3 migratielaag is niet gevonden');

let generated=0;
const context={
  console,Date,Math,Number,String,Array,Object,
  U3_ACCOUNTS:['gezamenlijk','dion','dara'],
  U3_FREQUENCY_UNITS:['weken','maanden','jaren'],
  U3_SCHEMA_VERSION:4,
  isPlainObject:value=>value!==null&&typeof value==='object'&&!Array.isArray(value),
  round2:value=>Math.round((Number(value)+Number.EPSILON)*100)/100,
  bankText:value=>String(value||'').trim().toLowerCase(),
  uid:()=>`generated-${++generated}`,
  monthKey:()=> '2026-07',
  u3ParseDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?new Date(`${value}T12:00:00`):null
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context,{filename:'update3-migration-inline.js'});

function fixture(version){
  const account=()=>({vasteLasten:[],variabel:[]});
  const makeScenario=()=>({verdeling:{},gezamenlijk:account(),dion:account(),dara:account()});
  const voor=makeScenario();
  const na=makeScenario();
  voor.gezamenlijk.vasteLasten.push({id:'rent',categorie:'Wonen',post:'Huur',bedrag:800});
  na.gezamenlijk.vasteLasten.push({id:'rent-after',categorie:'Wonen',post:'Huur nieuw',bedrag:900});
  na.gezamenlijk.hypotheek=[];
  return {
    meta:{schemaVersion:version,selectedMonth:'2026-07'},
    voor,na,
    personen:{
      dion:{salaris:2000,vasteTeruggaven:[{id:'refund',omschrijving:'Reiskosten',bedrag:50}]},
      dara:{salaris:2500,vasteTeruggaven:[]}
    },
    monthlyIncome:{'2026-07':{dion:2100,dara:2500}},
    monthlyBudgets:{},
    transactions:[{id:'legacy-tx',date:'2026-07-01',owner:'dion',category:'Overig',description:'Test',amount:10}],
    bankImportRules:[{match:'test',category:'Overig'}]
  };
}

for(const version of [1,2,3]){
  const migrated=context.u3NormalizeState(fixture(version));
  assert.equal(migrated.meta.schemaVersion,4);
  assert.equal(migrated.transactions[0].account,'dion');
  assert.equal(migrated.transactions[0].financialFor,'dion');
  assert.equal(migrated.transactions[0].reviewStatus,'bevestigd');
  assert.equal(migrated.advanceLedger.length,0,'Migratie mag geen kunstmatige schuld maken');
  assert.ok(migrated.recurringFixedExpenses.voor.some(row=>row.id==='fixed-voor-gezamenlijk-rent'));
  assert.ok(migrated.recurringIncomeSources.some(row=>row.id==='income-loon-dion'));
  assert.equal(migrated.recurringIncomeSources.find(row=>row.id==='income-loon-dion').monthOverrides['2026-07'],2100);
  const fixedCount=migrated.recurringFixedExpenses.voor.length;
  const incomeCount=migrated.recurringIncomeSources.length;
  context.u3NormalizeState(migrated);
  assert.equal(migrated.recurringFixedExpenses.voor.length,fixedCount);
  assert.equal(migrated.recurringIncomeSources.length,incomeCount);
}

console.log('UPDATE3_MIGRATION_OK');
