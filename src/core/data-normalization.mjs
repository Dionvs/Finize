import { CURRENT_SCHEMA_VERSION, normalizeDataTransaction, ACCOUNT_CONTEXTS } from './transaction-model.mjs';
import { migratePlanningTimeline } from './planning-timeline.mjs';
export { CURRENT_SCHEMA_VERSION };
const OWNERS = ACCOUNT_CONTEXTS;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const normalizeIban = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const epoch = new Date(0).toISOString();
function list(target,key) {
  if (target[key] === undefined) target[key] = [];
  if (!Array.isArray(target[key]) || target[key].some(row => !plain(row))) throw new Error(`${key}: ongeldige regels; oorspronkelijke data behouden.`);
  return target[key];
}
export function stableId(path, index) {
  return `schema-${encodeURIComponent(path)}-${index}`;
}
export function ensureStableRowIds(rows, path) {
  if (rows === undefined) return;
  if (!Array.isArray(rows)) throw new Error(`${path}: geen lijst; oorspronkelijke data behouden.`);
  const seen = new Set(rows.filter(plain).map(row=>row.id).filter(Boolean));
  const existing = new Set();
  rows.forEach((row,index)=>{
    if (!plain(row)) throw new Error(`${path}[${index}]: ongeldige regel.`);
    if (row.id) {
      if (existing.has(row.id)) throw new Error(`${path}: dubbel ID ${row.id}; verwijzingen worden niet gegokt.`);
      existing.add(row.id); return;
    }
    let suffix=0, id=stableId(path,index);
    while(seen.has(id)) id=`${stableId(path,index)}-${++suffix}`;
    row.id=id; seen.add(id); existing.add(id);
  });
}
export function detectSchemaVersion(candidate) {
  if (!plain(candidate)) throw new Error('State ontbreekt of is ongeldig; oorspronkelijke data behouden.');
  if (candidate.meta !== undefined && !plain(candidate.meta)) throw new Error('meta: ongeldig object; oorspronkelijke data behouden.');
  const raw=candidate.meta?.schemaVersion;
  if (raw === undefined) return 1;
  const version=Number(raw);
  if (!Number.isSafeInteger(version) || version < 1 || version > CURRENT_SCHEMA_VERSION) throw new Error(`Niet-ondersteunde schemaVersion: ${String(raw)}`);
  return version;
}
export function allGoals(state){
    return OWNERS.flatMap(owner=>(state?.spaardoelen?.[owner]||[]).map(goal=>({owner,goal})));
  }
export function contributionAmount(entry){
    if(entry?.active===false||['geannuleerd','teruggedraaid'].includes(entry?.status))return 0;
    // Een geplande maandinleg is alleen administratie. Alleen een werkelijk
    // verwerkte banktransactie of handmatige correctie wijzigt het doelsaldo.
    if(entry?.source==='planned')return 0;
    if(['bank-import','bank-match'].includes(entry?.source)&&entry?.transactionId){
      const actual=Number(entry?.actualAmount??entry?.amount??entry?.effectiveAmount);
      return Number.isFinite(actual)?round2(actual):0;
    }
    const value=Number(entry?.effectiveAmount??entry?.amount);
    return Number.isFinite(value)?round2(value):0;
  }
export function calculateGoalSavedAmount(state,goalId){
    return round2((state?.savingsGoalLedger||[]).filter(entry=>entry.goalId===goalId).reduce((sum,entry)=>sum+contributionAmount(entry),0));
  }
export function reconcileGoalSavedAmounts(state,goalIds=null){
    const selected=goalIds?new Set(goalIds):null;
    allGoals(state).forEach(({goal})=>{
      if(selected&&!selected.has(goal.id))return;
      const saved=Math.max(0,calculateGoalSavedAmount(state,goal.id));
      goal.algespaard=round2(saved);
      if(Array.isArray(goal.subdoelen)&&goal.subdoelen.length){
        let remaining=Math.round(saved*100);
        goal.subdoelen.forEach(child=>{
          const capacity=Math.max(0,Math.round((Number(child.doelbedrag)||0)*100));
          const applied=Math.min(capacity,Math.max(0,remaining));
          child.gespaard=round2(applied/100);
          child.voltooid=capacity>0&&applied>=capacity;
          remaining-=applied;
        });
        // The ledger owns the full balance, including money beyond completed subgoal targets.
        goal.algespaard=round2(saved);
      }
    });
    return state;
  }

export function normalizeSavingsLedger(target, { seedLegacyOpening = false } = {}) {
  const entries=list(target,'savingsGoalLedger');
  ensureStableRowIds(entries,'savingsGoalLedger');
  // Existing ledger values and goal balances are not reconciled during a read.
  entries.forEach(entry=>{
    if (entry.goalId === undefined) entry.goalId='';
    if (entry.effectiveAmount === undefined && entry.amount !== undefined) entry.effectiveAmount=entry.amount;
    if (entry.createdAt === undefined) entry.createdAt=epoch;
    if (entry.updatedAt === undefined) entry.updatedAt=entry.createdAt;
  });
  // Only the historical no-ledger format needs an opening. Never fill gaps in an existing ledger.
  const openingIds=new Set();
  if(seedLegacyOpening && !entries.length) allGoals(target).forEach(({goal})=>{
    if (!goal.id || !Number.isFinite(Number(goal.algespaard))) throw new Error('Legacy spaardoel mist een betrouwbaar ID of saldo.');
    if(openingIds.has(goal.id))throw new Error(`Dubbel spaardoel-ID ${goal.id}; openingssaldo wordt niet gegokt.`);
    openingIds.add(goal.id);
    entries.push({id:`saving-opening-${goal.id}`,goalId:goal.id,month:'',plannedAmount:0,actualAmount:null,
      effectiveAmount:Number(goal.algespaard),status:'uitgevoerd',source:'legacy-opening',transactionId:'',active:true,createdAt:epoch,updatedAt:epoch});
  });
}

export function normalizeImportCore(candidate, { diagnostics = [], seedLegacyOpening, legacyMain } = {}) {
  const from=detectSchemaVersion(candidate);
  const target=clone(candidate);
  target.meta=plain(target.meta)?target.meta:{};
  list(target,'accountProfiles'); ensureStableRowIds(target.accountProfiles,'accountProfiles');
  target.accountProfiles=target.accountProfiles.map(profile=>{
    const next={...profile};
    next.name=next.name || next.rekeningnaam || 'Rekening';
    next.identifier=next.identifier || normalizeIban(next.iban);
    if(!next.accountOwner && OWNERS.includes(next.owner))next.accountOwner=next.owner;
    next.bank=next.bank || 'ING'; next.csvFormat=next.csvFormat || 'ing';
    next.createdAt=next.createdAt || epoch; next.updatedAt=next.updatedAt || epoch;
    return next;
  });
  list(target,'importSummaries'); ensureStableRowIds(target.importSummaries,'importSummaries');
  target.importSummaries.forEach(summary=>{ if(summary.status === undefined)summary.status='concept'; });
  if(target.activeImportId === undefined)target.activeImportId='';
  normalizeSavingsLedger(target,{seedLegacyOpening:seedLegacyOpening ?? from < 10});
  ['manualTransactionReplacements','internalTransferPairs','advanceRepayments','recognitionRules','transactions'].forEach(key=>{
    list(target,key); ensureStableRowIds(target[key],key);
  });
  ['actualIncomeOverrides','monthlyIncomeOverrides'].forEach(key=>{
    if(target[key] === undefined)target[key]={};
    if(!plain(target[key]))throw new Error(`${key}: ongeldig object.`);
  });
  // Preserve rule fields including old hints. Classification continues to ignore ownership hints.
  target.recognitionRules=target.recognitionRules.map((rule,index)=>({
    ...rule,id:rule.id || stableId('recognitionRules',index),enabled:rule.enabled!==false,
    level:['counterparty','description','organization','keyword','prediction'].includes(rule.level)?rule.level:(rule.counterparty?'counterparty':'description'),
    value:String(rule.value || rule.counterparty || rule.text || rule.match || '').trim(),
    category:rule.category || 'Ongecategoriseerd',transactionType:rule.transactionType || rule.kind || 'uitgave',
    updatedAt:rule.updatedAt || epoch
  }));
  target.transactions=target.transactions.map(tx=>normalizeDataTransaction(tx,{accountProfiles:target.accountProfiles,legacyMain:legacyMain ?? from < 10,diagnostics}));
  if(Array.isArray(target.transactionReviewQueue))target.transactionReviewQueue=target.transactionReviewQueue.map(tx=>normalizeDataTransaction(tx,{accountProfiles:target.accountProfiles,diagnostics}));
  target.meta.schemaVersion=from >= 11 ? CURRENT_SCHEMA_VERSION : 10;
  return target;
}

// One ordered route; the runtime supplies its established legacy structural conversion.
export function migrateStateData(candidate, { normalizeLegacy, validate, diagnostics = [], targetVersion = CURRENT_SCHEMA_VERSION } = {}) {
  const from=detectSchemaVersion(candidate);
  let target=clone(candidate);
  if(from < 10) {
    if(normalizeLegacy) assertPersistentShapes(target);
    if(normalizeLegacy) { target=normalizeLegacy(target,from); target.meta.schemaVersion=9; }
    target=normalizeImportCore(target,{diagnostics,seedLegacyOpening:true,legacyMain:true});
  }
  if(targetVersion >= 11)target=migratePlanningTimeline(target);
  if(validate) { const result=validate(target); if(!result.ok)throw new Error(result.errors.join(' ')); }
  return target;
}

function assertPersistentShapes(target) {
  // Missing optional structures may be added; malformed existing structures cannot be replaced.
  const optionalObject=(value,path)=>{if(value!==undefined&&!plain(value))throw new Error(`${path}: ongeldig object.`);};
  const optionalRows=(value,path)=>{if(value!==undefined)ensureStableRowIds(value,path);};
  ['personen','voor','na','spaardoelen'].forEach(key=>{
    if(!plain(target[key]))throw new Error(`${key}: verplicht onderdeel ontbreekt of is ongeldig.`);
  });
  ['incomeDefaultsHistory','budgetDefaultsHistory','monthlyIncomeOverrides','monthlyRefundOverrides','accountSettings','monthRecords','recurringFixedExpenses'].forEach(key=>{
    if(target[key]!==undefined&&!plain(target[key]))throw new Error(`${key}: ongeldig object.`);
  });
  ['transactions','bankImportRules','transactionReviewQueue','recognitionRules','reserveLedger','advanceLedger','internalTransfers','monthCorrections','recurringIncomeSources'].forEach(key=>{
    if(target[key]!==undefined&&(!Array.isArray(target[key])||target[key].some(row=>!plain(row))))throw new Error(`${key}: ongeldige regels.`);
  });
  ['dion','dara'].forEach(owner=>{
    if(!plain(target.personen[owner]))throw new Error(`personen.${owner}: ongeldig onderdeel.`);
    if(target.personen[owner].vasteTeruggaven!==undefined)ensureStableRowIds(target.personen[owner].vasteTeruggaven,`personen.${owner}.vasteTeruggaven`);
    if(target.incomeDefaultsHistory?.[owner]!==undefined)ensureStableRowIds(target.incomeDefaultsHistory[owner],`incomeDefaultsHistory.${owner}`);
  });
  ['voor','na'].forEach(scenario=>{
    optionalObject(target.budgetDefaultsHistory?.[scenario],`budgetDefaultsHistory.${scenario}`);
    ['gezamenlijk','dion','dara'].forEach(owner=>{
      optionalObject(target.accountSettings?.[owner],`accountSettings.${owner}`);
      const path=`budgetDefaultsHistory.${scenario}.${owner}`,history=target.budgetDefaultsHistory?.[scenario]?.[owner];
      optionalRows(history,path);
      (history||[]).forEach((entry,index)=>optionalRows(entry.rows,`${path}.${index}.rows`));
      (target.spaardoelen?.[owner]||[]).forEach((goal,index)=>optionalRows(goal.subdoelen,`spaardoelen.${owner}.${index}.subdoelen`));
    });
    optionalRows(target.recurringFixedExpenses?.[scenario],`recurringFixedExpenses.${scenario}`);
  });
  const recurring=[...(target.recurringIncomeSources||[]),...['voor','na'].flatMap(scenario=>target.recurringFixedExpenses?.[scenario]||[])];
  recurring.forEach((row,index)=>{
    optionalRows(row.amountHistory,`recurring.${index}.amountHistory`);
    optionalObject(row.monthOverrides,`recurring.${index}.monthOverrides`);
    optionalObject(row.recognition,`recurring.${index}.recognition`);
  });
  Object.entries(target.monthRecords||{}).forEach(([month,row])=>{
    if(!plain(row))throw new Error(`monthRecords.${month}: ongeldig record.`);
    if(Array.isArray(row.closureHistory))row.closureHistory.forEach(closure=>{
      if(plain(closure)&&!closure.id&&closure.closingId)closure.id=closure.closingId;
    });
    optionalRows(row.closureHistory,`monthRecords.${month}.closureHistory`);
    (row.closureHistory||[]).forEach((closure,index)=>optionalObject(closure.financialSnapshot,`monthRecords.${month}.closureHistory.${index}.financialSnapshot`));
  });
}
