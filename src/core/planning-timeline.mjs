// Planning only. Transactions, approvals, ledger balances and saved closures are never resolved here.
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const owners = ['gezamenlijk','dion','dara'];
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function assertPlanningMonth(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) throw new Error('Planning vereist een expliciete maand (YYYY-MM).');
  return month;
}
export function nextPlanningMonth(month) {
  assertPlanningMonth(month);
  const [year,number] = month.split('-').map(Number);
  return number === 12 ? `${String(year+1).padStart(4,'0')}-01` : `${String(year).padStart(4,'0')}-${String(number+1).padStart(2,'0')}`;
}
function latest(history,month) {
  return (history||[]).filter(entry=>String(entry.effectiveFrom).slice(0,7)<=month)
    .slice().sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom))).pop();
}
function snapshot(item) {
  const result=clone(item);
  ['amountHistory','monthOverrides','bedrag','verwachtBedrag'].forEach(key=>delete result[key]);
  return result;
}
export function resolveRecurringAmount(item,month) {
  assertPlanningMonth(month);
  const override=item.monthOverrides?.[month];
  const entry=latest(item.amountHistory,month);
  const amount=plain(override)?override.amount:(override!==null&&override!==''?override:undefined);
  return round(amount ?? entry?.amount ?? item.bedrag ?? item.verwachtBedrag ?? 0);
}
export function resolveRecurringConfig(item,month,{includeInactive=false}={}) {
  assertPlanningMonth(month);
  const history=(item.amountHistory||[]).filter(entry=>String(entry.effectiveFrom).slice(0,7)<=month)
    .slice().sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
  let result={...snapshot(item)};
  history.forEach(entry=>{if(plain(entry.config)) result={...result,...clone(entry.config)};});
  const amount=resolveRecurringAmount(item,month);
  const override=item.monthOverrides?.[month];
  if(plain(override)) result={...result,...clone(override.config||{})};
  result={...result,id:item.id,bedrag:round(amount),verwachtBedrag:round(amount)};
  const start=result.validFrom || String(result.begindatum||'').slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) throw new Error(`Regel ${item.id}: betrouwbare beginmaand ontbreekt.`);
  const beginMonth=String(result.begindatum||'').slice(0,7),endMonth=String(result.einddatum||'').slice(0,7);
  const active=month>=start&&month>=beginMonth&&(!endMonth||month<=endMonth)&&(!result.validUntil||month<result.validUntil)&&result.actief!==false;
  result.timelineActive=active;
  return active||includeInactive ? result : null;
}
export function resolveFixedExpensesForMonth(state,month,owner=null) {
  return (state.recurringFixedExpenses||[]).map(item=>resolveRecurringConfig(item,month)).filter(item=>item&&(!owner||(item.financialFor||item.rekening)===owner));
}
export function resolveIncomeSourcesForMonth(state,month,owner=null,{planningOnly=false}={}) {
  return (state.recurringIncomeSources||[]).map(item=>resolveRecurringConfig(item,month)).filter(item=>item&&(!owner||item.eigenaar===owner))
    .map(item=>{
      // The manual salary history is the authority for the existing standard salary source.
      if(item.legacyKind==='salary'&&['dion','dara'].includes(item.eigenaar)) {
        const amount=(!planningOnly?state.monthlyIncomeOverrides?.[month]?.[item.eigenaar]:undefined) ?? resolvePlannedIncomeForMonth(state,month,item.eigenaar).salary;
        return {...item,bedrag:amount,verwachtBedrag:amount};
      }
      return item;
    });
}
export function resolveVariableBudgetsForMonth(state,month,owner,{defaultsOnly=false}={}) {
  assertPlanningMonth(month);
  if(!owners.includes(owner))throw new Error('Onbekende budgeteigenaar.');
  const override=state.monthlyBudgets?.[month]?.[`${owner}Variabel`];
  const rows=!defaultsOnly&&Array.isArray(override)?override:latest(state.budgetDefaultsHistory?.[owner],month)?.rows ?? state.planning?.[owner]?.variabel ?? [];
  return clone(rows);
}
// One expense-category source; special processing choices are not budget categories.
export function expenseCategoriesForMonth(state,month,owner,{existingCategory=''}={}) {
  const categories=[],seen=new Set();
  resolveVariableBudgetsForMonth(state,month,owner).forEach(row=>{
    const label=String(row.post||row.categorie||'').trim(),key=label.toLocaleLowerCase();
    if(label&&key!=='variabel'&&!seen.has(key)){seen.add(key);categories.push(key==='overig'?'Overig':label);}
  });
  if(!seen.has('overig'))categories.push('Overig');
  if(existingCategory&&!categories.some(label=>label.toLocaleLowerCase()===existingCategory.toLocaleLowerCase()))categories.push(existingCategory);
  return categories;
}
export function setSavingsPlanForMonth(state,owner,month,amount) {
  assertPlanningMonth(month);
  if(!owners.includes(owner)||!Number.isFinite(Number(amount))||Number(amount)<0||Math.abs(Number(amount)*100-Math.round(Number(amount)*100))>1e-6)throw new Error('Vul een geldig niet-negatief spaarbedrag in eurocenten in.');
  state.monthlySavingOverrides=state.monthlySavingOverrides||{};
  state.monthlySavingOverrides[month]={...(state.monthlySavingOverrides[month]||{}),[owner]:round(amount)};
}
export function resolvePlannedIncomeForMonth(state,month,owner) {
  assertPlanningMonth(month);
  const entry=latest(state.incomeDefaultsHistory?.[owner],month);
  let salary=round(entry?.salary ?? state.personen?.[owner]?.salaris ?? 0);
  // Only explicit new income-editor commands opt into recurring validity. Never
  // reinterpret old stopped sources or old month/dashboard overrides on load.
  const controlled=(state.recurringIncomeSources||[]).filter(item=>item.legacyKind==='salary'&&item.incomeTimelineCommands&&resolveRecurringConfig(item,month,{includeInactive:true})?.eigenaar===owner);
  if(controlled.length===1){
    const source=controlled[0],config=resolveRecurringConfig(source,month,{includeInactive:true});
    if(!config.timelineActive)salary=0;
    else if(source.monthOverrides?.[month]?.incomePlanningOverride)salary=resolveRecurringAmount(source,month);
  }
  return {salary,refund:round(entry?.refund ?? (state.personen?.[owner]?.vasteTeruggaven||[]).reduce((sum,row)=>sum+Number(row.bedrag||0),0)),effectiveFrom:entry?.effectiveFrom||'0000-01'};
}
function upsert(history,month,changes,id) {
  let index=-1;
  history.forEach((entry,i)=>{if(String(entry.effectiveFrom).slice(0,7)===month&&(index<0||String(entry.effectiveFrom)>=String(history[index].effectiveFrom)))index=i;});
  const entry={...(index>=0?history[index]:{id}),...clone(changes),effectiveFrom:index>=0?history[index].effectiveFrom:month};
  if(index>=0)history[index]=entry;else history.push(entry);
  history.sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
  return entry;
}
export function setRecurringFromMonth(item,month,changes,{scope='from',isNew=false}={}) {
  assertPlanningMonth(month);
  if(!['from','once'].includes(scope))throw new Error('Onbekende geldigheid voor planning.');
  if(!item?.id)throw new Error('Planning mist een stabiel ID.');
  const resolved=isNew?snapshot(item):resolveRecurringConfig(item,month,{includeInactive:true});
  const amount=Number(changes.bedrag ?? changes.verwachtBedrag ?? resolved.bedrag ?? item.bedrag ?? item.verwachtBedrag);
  if(!Number.isFinite(amount)||amount<0)throw new Error('Ongeldig planningsbedrag.');
  const config=snapshot({...resolved,...changes,id:item.id});
  delete config.timelineActive;
  if(isNew)config.validFrom=String(config.begindatum||'').slice(0,7)>month?String(config.begindatum).slice(0,7):month;
  item.amountHistory=item.amountHistory||[];
  item.monthOverrides=item.monthOverrides||{};
  item.planningProvenance='versioned-properties';
  if(scope==='once'&&!isNew)item.monthOverrides[month]={amount:round(amount),config};
  else {
    upsert(item.amountHistory,month,{amount:round(amount),config},`amount-${item.id}-${month}`);
    delete item.monthOverrides[month];
    // Keep the legacy basis untouched: older months must never inherit a later edit.
    if(isNew)Object.assign(item,config,{bedrag:round(amount),verwachtBedrag:round(amount)});
  }
  return item;
}
export function endRecurringFromMonth(item,month) {
  assertPlanningMonth(month);
  const existing=item.validUntil;
  item.validUntil=existing&&existing<month?existing:month;
  // The lifetime boundary applies even if a future configuration snapshot exists.
  const retainEarlierEnd=config=>{config.validUntil=config.validUntil&&config.validUntil<item.validUntil?config.validUntil:item.validUntil;};
  (item.amountHistory||[]).forEach(entry=>{if(entry.config)retainEarlierEnd(entry.config);});
  Object.values(item.monthOverrides||{}).forEach(entry=>{if(plain(entry)&&entry.config)retainEarlierEnd(entry.config);});
  return item;
}
export function setBudgetForMonth(state,owner,month,rows,{scope='from'}={}) {
  assertPlanningMonth(month);
  if(!['from','once'].includes(scope))throw new Error('Onbekende geldigheid voor budget.');
  if(!owners.includes(owner)||!Array.isArray(rows))throw new Error('Ongeldig budget.');
  const ids=new Set();
  rows.forEach(row=>{if(!row.id||ids.has(row.id)||!Number.isFinite(Number(row.bedrag))||Number(row.bedrag)<0)throw new Error('Ongeldige budgetregel.');ids.add(row.id);});
  state.monthlyBudgets=state.monthlyBudgets||{};
  if(scope==='once') {
    state.monthlyBudgets[month]=state.monthlyBudgets[month]||{};
    state.monthlyBudgets[month][`${owner}Variabel`]=clone(rows);
  }else {
    state.budgetDefaultsHistory=state.budgetDefaultsHistory||{};
    const history=state.budgetDefaultsHistory[owner]=state.budgetDefaultsHistory[owner]||[];
    upsert(history,month,{rows},`budget-history-${owner}-${month}`);
    if(state.monthlyBudgets[month])delete state.monthlyBudgets[month][`${owner}Variabel`];
  }
}
export function setPlannedIncomeFromMonth(state,owner,month,salary,refund) {
  assertPlanningMonth(month);
  if(!['dion','dara'].includes(owner)||![salary,refund].every(value=>Number.isFinite(Number(value))&&Number(value)>=0))throw new Error('Ongeldige inkomensplanning.');
  state.incomeDefaultsHistory=state.incomeDefaultsHistory||{};
  const history=state.incomeDefaultsHistory[owner]=state.incomeDefaultsHistory[owner]||[];
  upsert(history,month,{salary:round(salary),refund:round(refund)},`income-history-${owner}-${month}`);
  const source=(state.recurringIncomeSources||[]).find(item=>item.legacyKind==='salary'&&item.eigenaar===owner&&item.incomeTimelineCommands);
  if(source){
    const config=resolveRecurringConfig(source,month,{includeInactive:true});
    if(!config.timelineActive)source.validUntil=null;
    setRecurringFromMonth(source,month,{verwachtBedrag:Number(salary),actief:true,validUntil:null,einddatum:'',bedrag:Number(salary)});
    // Reactivation is a new version from this month; prior inactive months keep
    // their stored end boundary. No old versions or actual transactions change.
    if(!config.timelineActive)source.monthOverrides=source.monthOverrides||{};
  }
  // Personal dashboard month overrides remain explicit independent choices.
}
export function setIncomeSourceForMonth(state,item,month,changes,{scope='from',isNew=false}={}) {
  const candidate=clone(state),record=isNew?clone(item):(candidate.recurringIncomeSources||[]).find(row=>row.id===item.id);
  if(!record)throw new Error('De inkomstenbron bestaat niet meer.');
  if(record.legacyKind==='salary'&&changes.eigenaar!==resolveRecurringConfig(record,month,{includeInactive:true}).eigenaar)throw new Error('Een standaard salarisbron kan niet naar een andere persoon worden verplaatst; dit botst met de afzonderlijke persoonlijke salarisplanning.');
  setRecurringFromMonth(record,month,changes,{scope,isNew});
  if(record.legacyKind==='salary'){
    record.incomeTimelineCommands=true;
    if(scope==='once')record.monthOverrides[month].incomePlanningOverride=true;
    else setPlannedIncomeFromMonth(candidate,changes.eigenaar,month,Number(changes.verwachtBedrag),resolvePlannedIncomeForMonth(candidate,month,changes.eigenaar).refund);
  }
  if(isNew)(candidate.recurringIncomeSources=candidate.recurringIncomeSources||[]).push(record);
  state.recurringIncomeSources=candidate.recurringIncomeSources;
  if(candidate.incomeDefaultsHistory)state.incomeDefaultsHistory=candidate.incomeDefaultsHistory;
}
export function endIncomeSourceFromMonth(state,item,month){
  const candidate=clone(state),record=(candidate.recurringIncomeSources||[]).find(row=>row.id===item.id);
  if(!record)throw new Error('De inkomstenbron bestaat niet meer.');
  endRecurringFromMonth(record,month);
  if(record.legacyKind==='salary'){
    record.incomeTimelineCommands=true;
    setRecurringFromMonth(record,month,{actief:false,validUntil:record.validUntil});
  }
  state.recurringIncomeSources=candidate.recurringIncomeSources;
}
function semantic(value) {
  if(Array.isArray(value))return value.map(semantic);
  if(plain(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,semantic(value[key])]));
  return value;
}
function equal(a,b){return JSON.stringify(semantic(a))===JSON.stringify(semantic(b));}
function adjustmentSlice(item,month) {
  const entries=(item.amountHistory||[]).filter(entry=>String(entry.effectiveFrom).slice(0,7)===month);
  return {entry:clone(latest(entries,month)||null),entries:clone(entries),override:clone(item.monthOverrides?.[month]??null)};
}
export function applyFixedPlanningAdjustment(item,adjustment) {
  const before=adjustmentSlice(item,adjustment.month);
  setRecurringFromMonth(item,adjustment.month,{bedrag:adjustment.amount},{scope:adjustment.mode==='month'?'once':'from'});
  adjustment.timelineReceipt={before,after:adjustmentSlice(item,adjustment.month)};
}
export function undoFixedPlanningAdjustment(item,adjustment,{dryRun=false}={}) {
  if(!item)return; // Removed Na provenance is never reactivated.
  const receipt=adjustment.timelineReceipt,current=adjustmentSlice(item,adjustment.month);
  let before;
  if(receipt) {
    if(equal(current,receipt.before))return; // Repeat undo is a no-op.
    if(!equal(current,receipt.after))throw new Error('De planning is na de import gewijzigd; terugdraaien zou die wijziging overschrijven.');
    before=receipt.before;
  }else {
    // Legacy manifests know only the amount. Refuse a later full configuration edit.
    const applied=adjustment.mode==='month'?current.override:current.entry;
    const amount=plain(applied)?applied.amount:applied;
    if(Number(amount)!==Number(adjustment.amount)||plain(applied)&&applied.config&&item.planningProvenance!=='legacy-properties-without-history')throw new Error('Oude importaanpassing conflicteert met gewijzigde planning.');
    const entries=(adjustment.before?.amountHistory||[]).filter(entry=>String(entry.effectiveFrom).slice(0,7)===adjustment.month)
      .map(entry=>({...clone(entry),...(current.entry?.config?{config:clone(current.entry.config)}:{})}));
    before={entries,entry:latest(entries,adjustment.month)||null,override:adjustment.before?.monthOverrides?.[adjustment.month]??null};
  }
  if(dryRun)return;
  item.amountHistory=(item.amountHistory||[]).filter(entry=>String(entry.effectiveFrom).slice(0,7)!==adjustment.month);
  item.amountHistory.push(...clone(before.entries|| (before.entry?[before.entry]:[])));
  item.amountHistory.sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
  if(before.override===null)delete item.monthOverrides[adjustment.month];else item.monthOverrides[adjustment.month]=clone(before.override);
}
function migrateRecurring(item) {
  if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(String(item.begindatum||'')))throw new Error(`Regel ${item.id}: begin ontbreekt; geen datum verzonnen.`);
  item.validFrom=item.validFrom||item.begindatum.slice(0,7);
  // A legacy stopped row with an inclusive end was still active in the earlier months.
  const basis=snapshot(item);
  if(item.actief===false&&item.einddatum)basis.actief=true;
  item.planningProvenance=item.planningProvenance||'legacy-properties-without-history';
  item.amountHistory=(item.amountHistory||[]).map(entry=>({...entry,config:entry.config||clone(basis)}));
  if(!item.amountHistory.length)throw new Error(`Regel ${item.id}: bedragenhistorie ontbreekt.`);
  return item;
}
export function validateTimelineState(state) {
  const errors=[];
  if(!plain(state.planning)||!plain(state.planning.verdeling))errors.push('planning ontbreekt.');
  if(!Array.isArray(state.recurringFixedExpenses))errors.push('recurringFixedExpenses moet één lijst zijn.');
  const recurring=[...(Array.isArray(state.recurringFixedExpenses)?state.recurringFixedExpenses:[]),...(state.recurringIncomeSources||[])];
  const ids=new Set();
  recurring.forEach(item=>{
    if(!item.id||ids.has(item.id))errors.push('Ontbrekend/dubbel planning-ID.');ids.add(item.id);
    if(!Array.isArray(item.amountHistory)||!item.amountHistory.length)errors.push(`Historie ontbreekt: ${item.id}.`);
    (item.amountHistory||[]).forEach(entry=>{
      try{assertPlanningMonth(String(entry.effectiveFrom).slice(0,7));}catch(error){errors.push(error.message);}
      if(!Number.isFinite(Number(entry.amount)))errors.push('Ongeldig historisch bedrag.');
    });
    try{resolveRecurringConfig(item,item.validFrom||String(item.begindatum).slice(0,7),{includeInactive:true});}catch(error){errors.push(error.message);}
  });
  owners.forEach(owner=>{
    if(!Array.isArray(state.budgetDefaultsHistory?.[owner]))errors.push(`Budgethistorie ontbreekt: ${owner}.`);
    (state.budgetDefaultsHistory?.[owner]||[]).forEach(entry=>{
      try{assertPlanningMonth(entry.effectiveFrom);}catch(error){errors.push(error.message);}
      if(!Array.isArray(entry.rows))errors.push('Budgetregels ontbreken.');
    });
  });
  return {ok:!errors.length,errors};
}
export function migratePlanningTimeline(candidate) {
  const target=clone(candidate);
  if(Number(target.meta?.schemaVersion)>=11) {
    const result=validateTimelineState(target);if(!result.ok)throw new Error(result.errors.join(' '));return target;
  }
  if(!plain(target.voor)||!Array.isArray(target.recurringFixedExpenses?.voor)||!plain(target.budgetDefaultsHistory?.voor))throw new Error('v10-planning ontbreekt; oorspronkelijke state behouden.');
  if(target.planning!==undefined)throw new Error('De nieuwe planningnaam is al in gebruik; oorspronkelijke data behouden voor controle.');
  target.planning=clone(target.voor);
  const extensions=Object.fromEntries(Object.entries(target.recurringFixedExpenses).filter(([key])=>!['voor','na'].includes(key)));
  if(Object.keys(extensions).length){
    if(target.planning.legacyRecurringExtensions!==undefined)throw new Error('Onbekende planningsmetadata conflicteert; oorspronkelijke data behouden.');
    target.planning.legacyRecurringExtensions=clone(extensions);
  }
  target.recurringFixedExpenses=target.recurringFixedExpenses.voor.map(migrateRecurring);
  // Lookup-only provenance for old links, including full imports that have not been loaded yet.
  if(target.legacyPlanningReferences!==undefined&&!Array.isArray(target.legacyPlanningReferences))throw new Error('Ongeldige bestaande herkomstmetadata; oorspronkelijke data behouden.');
  target.legacyPlanningReferences=target.legacyPlanningReferences||[];
  (candidate.recurringFixedExpenses?.na||[]).forEach(item=>{
    const reference={id:item.id,legacyKey:item.legacyKey||'',naam:item.naam,categorie:item.categorie||'',rekening:item.rekening,financialFor:item.financialFor,legacyKind:item.legacyKind||'',inactive:true,scenarioProvenance:'na'};
    const existing=target.legacyPlanningReferences.find(row=>row.id===item.id);
    if(existing)Object.assign(existing,reference);else target.legacyPlanningReferences.push(reference);
  });
  const history=target.budgetDefaultsHistory;
  target.budgetDefaultsHistory={...Object.fromEntries(Object.entries(history).filter(([key])=>!['voor','na'].includes(key))),...clone(history.voor)};
  const monthly={};
  Object.entries(target.monthlyBudgets||{}).forEach(([month,data])=>{
    const remaining=Object.fromEntries(Object.entries(data).filter(([key])=>!['voor','na'].includes(key)));
    const baseline=data.voor||{};
    owners.forEach(owner=>{
      const key=`${owner}Variabel`,rows=baseline[key];
      if(rows===undefined)return;
      const defaults=resolveVariableBudgetsForMonth(target,month,owner,{defaultsOnly:true});
      const explicit=baseline.explicit===true||baseline.overrides?.[owner]===true||baseline[`${owner}Override`]===true;
      if(explicit||!equal(rows,defaults))remaining[key]=clone(rows);
    });
    Object.entries(baseline).filter(([key])=>!owners.some(owner=>`${owner}Variabel`===key)).forEach(([key,value])=>{remaining[key]=clone(value);});
    if(Object.keys(remaining).length)monthly[month]=remaining;
  });
  target.monthlyBudgets=monthly;
  Object.values(target.monthlySavingOverrides||{}).forEach(entry=>{
    if(Object.hasOwn(entry,'gezamenlijkVoor'))entry.gezamenlijk=entry.gezamenlijkVoor;
    delete entry.gezamenlijkVoor;delete entry.gezamenlijkNa;
  });
  target.recurringIncomeSources=(target.recurringIncomeSources||[]).map(migrateRecurring);
  delete target.voor;delete target.na;delete target.meta.scenario;
  target.meta.schemaVersion=11;
  const result=validateTimelineState(target);if(!result.ok)throw new Error(result.errors.join(' '));
  return target;
}
