import { buildRecordSnapshot,decodeRecordValues,recordChanges } from './cloud-record-model.mjs';
import { encodeHouseholdState,decodeHouseholdState } from './household-store.mjs';
import { canonical,digest,storageError,cumulativeFinancials,periodFinancials } from './period-projections.mjs';
import { manifestBucket,manifestRoots } from './record-manifest.mjs';
import { contributionAmount } from '../core/data-normalization.mjs';
const same=(a,b)=>canonical(a)===canonical(b);
const copy=value=>structuredClone(value);
const transactionGlobals=new Set(['transactions','meta','spaardoelen','savingsGoalLedger','importSummaries','activeImportId','transactionReviewQueue','recognitionRules','advanceLedger','advanceRepayments','internalTransferPairs','savingsCoverageAllocations','manualTransactionReplacements','monthRecords','__finizePartialHistory','verifiedPeriods','__finizePeriodContext']);
export function workspaceNeedsFullHistory(before,after){
  const ids=value=>Object.values(value.spaardoelen||{}).flatMap(rows=>rows.map(row=>row.id)).sort();
  if(!same(ids(before),ids(after)))return true;
  const life=row=>row?.lifecycle||(row?.status==='teruggedraaid'?'withdrawn':'active');
  if((before.importSummaries||[]).some(row=>{const next=(after.importSummaries||[]).find(value=>value.id===row.id);return !next||life(row)!==life(next);}))return true;
  const loaded=new Set(before.verifiedPeriods||[]);
  return [...new Set([...Object.keys(before),...Object.keys(after)])].some(key=>{
    if(same(before[key],after[key])||transactionGlobals.has(key))return false;
    return !key.startsWith('monthly')||!Object.keys({...before[key],...after[key]}).filter(month=>!same(before[key]?.[month],after[key]?.[month])).every(month=>loaded.has(month));
  });
}
// Apply an already validated intent to an expanded dependency set, preserving other rows.
// This is a state patch, never a second implementation of financial rules or approvals.
export function mergeWorkspaceIntent(before,after,expanded,{strict=true}={}){
  function merge(a,b,current,path){
    if(same(a,b))return copy(current);
    const list=value=>Array.isArray(value)&&value.every(row=>typeof row?.id==='string')&&new Set(value.map(row=>row.id)).size===value.length;
    if(list(a)&&list(b)&&list(current)){
      const values=new Map(current.map(row=>[row.id,row])),old=new Map(a.map(row=>[row.id,row])),next=new Map(b.map(row=>[row.id,row]));
      for(const id of new Set([...old.keys(),...next.keys()]))if(!same(old.get(id),next.get(id))){if(!next.has(id)){if(strict&&!same(values.get(id),old.get(id)))throw storageError('storage-conflict','Een afhankelijke regel wijzigde tijdens voorbereiden: '+path);values.delete(id);}else values.set(id,merge(old.get(id),next.get(id),values.get(id),path+'.'+id));}
      return [...values.values()];
    }
    if(a&&b&&current&&typeof a==='object'&&typeof b==='object'&&typeof current==='object'&&!Array.isArray(a)&&!Array.isArray(b)&&!Array.isArray(current)){
      const result=copy(current);for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(!same(a[key],b[key])){if(!(key in b)){if(strict&&!same(current[key],a[key]))throw storageError('storage-conflict','Een verwijderde afhankelijkheid wijzigde: '+path+'.'+key);delete result[key];}else result[key]=merge(a[key],b[key],current[key],path+'.'+key);}return result;
    }
    if(strict&&!same(current,a))throw storageError('storage-conflict','Een afhankelijke waarde wijzigde tijdens voorbereiden: '+path);
    return copy(b);
  }
  const result=copy(expanded);
  for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(!['meta','__finizePartialHistory','verifiedPeriods','__finizePeriodContext'].includes(key)&&!same(before[key],after[key])){if(!(key in after))delete result[key];else result[key]=merge(before[key],after[key],expanded[key],key);}
  return result;
}
export function completeDependencyState(state){
  const result=copy(state);delete result.__finizePartialHistory;delete result.__finizePeriodContext;delete result.verifiedPeriods;return result;
}
export async function workspaceState(proof,selectedMonth=proof.periods[0]?.month){
  const values=await decodeRecordValues(proof.records),layout={};
  for(const[key,kind]of Object.entries(proof.head.layout))if(!key.startsWith('@'))layout[key]=kind==='list'?{kind,ids:values.filter(row=>row.collection===key).sort((a,b)=>a.ordinal-b.ordinal).map(row=>row.recordId)}:{kind};
  const state=decodeHouseholdState({storageVersion:1,schemaVersion:11,layout},values);
  state.__finizePartialHistory=true;state.verifiedPeriods=proof.periods.map(row=>row.month);state.meta.selectedMonth=selectedMonth;state.__finizePeriodContext=copy(proof);return state;
}
export function refreshWorkspaceTotals(before,next){
  if(!next.__finizePartialHistory)return;
  assertWorkspaceMutation(before,next);
  const a=cumulativeFinancials(completeDependencyState(before)),b=cumulativeFinancials(completeDependencyState(next)),result=copy(before.__finizePeriodContext.localCumulative||JSON.parse(before.__finizePeriodContext.global.payload));
  for(const key of Object.keys(result.totalsCents))result.totalsCents[key]+=b.totalsCents[key]-a.totalsCents[key];
  for(const key of ['bankSourceCount','approvedEffectCount'])result[key]+=b[key]-a[key];
  result.goals=b.goals;next.__finizePeriodContext.localCumulative=result;
}
export function requiredMutationPeriods(before,after){
  const a=new Map(encodeHouseholdState({transactions:before.transactions,savingsGoalLedger:before.savingsGoalLedger}).records.map(row=>[row.id,row]));
  const b=new Map(encodeHouseholdState({transactions:after.transactions,savingsGoalLedger:after.savingsGoalLedger}).records.map(row=>[row.id,row]));
  const changed=[...new Set([...a.keys(),...b.keys()])].filter(id=>!same(a.get(id),b.get(id)));
  const ids=new Set(changed.map(id=>JSON.parse(id)[1]));
  for(const key of ['internalTransferPairs','savingsCoverageAllocations','manualTransactionReplacements']){
    const old=new Map((before[key]||[]).map(row=>[row.id,row]));
    for(const ref of [...(after[key]||[]),...(before[key]||[])])if(!same(old.get(ref.id),(after[key]||[]).find(row=>row.id===ref.id)))for(const id of [...(ref.transactionIds||[]),ref.withdrawalTransactionId,ref.expenseTransactionId,ref.manualTransactionId,ref.importedTransactionId].filter(Boolean))ids.add(id);
  }
  const changedMonths=Object.keys({...before.monthRecords,...after.monthRecords}).filter(month=>!same(before.monthRecords?.[month],after.monthRecords?.[month]));
  for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(key.startsWith('monthly'))for(const month of Object.keys({...before[key],...after[key]}))if(/^\d{4}-\d{2}$/.test(month)&&!same(before[key]?.[month],after[key]?.[month]))changedMonths.push(month);
  const direct=[...a.values(),...b.values()].filter(row=>ids.has(row.recordId)).flatMap(row=>row.periods);
  return [...new Set([...changedMonths,...direct,...changed.flatMap(id=>[...(a.get(id)?.periods||[]),...(b.get(id)?.periods||[])]),...(before.__finizePeriodContext?.records||[]).filter(row=>row.collection==='transactions'&&ids.has(row.recordId)).flatMap(row=>row.periods)])].sort();
}
export function assertWorkspaceMutation(before,after){
  const loaded=new Set(before.verifiedPeriods||[]),needed=requiredMutationPeriods(before,after);
  if(needed.some(month=>!loaded.has(month)))throw storageError('dependency-required','Laad eerst de afhankelijke financiële maanden: '+needed.filter(month=>!loaded.has(month)).join(', '));
  if(workspaceNeedsFullHistory(before,after)&&!before.__finizePeriodContext?.explicitFullHistory)throw storageError('full-history-required','Deze bewerking vereist controle van globale planning, historische doelverwijzingen of een volledige importlevenscyclus.');
  for(const key of ['internalTransferPairs','savingsCoverageAllocations','manualTransactionReplacements'])if(!same(before[key],after[key])){
    const ids=new Set((after.transactions||[]).map(row=>row.id));
    for(const ref of after[key]||[]){if(ref.active===false)continue;const links=[...(ref.transactionIds||[]),ref.withdrawalTransactionId,ref.expenseTransactionId,ref.manualTransactionId,ref.importedTransactionId].filter(Boolean);if(links.some(id=>!ids.has(id)))throw storageError('dependency-required','Een vereiste gekoppelde bankbron is niet geladen.');}
  }
}
export function createPeriodWorkspace({transport,context,loadPeriod,stageOperation,recover,applicationProjection}){
  async function openWorkspace(months,{explicitFullHistory=false}={}){
    const c=await context(),head=c.head.data;
    if(explicitFullHistory){months=[...new Set([...months,...Object.keys(head.periodHashes)])];months=[...new Set([...months,...[...new Set(months.map(month=>month.slice(0,4)))].flatMap(year=>Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0')))])];}
    if(!head.manifestHashes||!head.settingsHash)throw storageError('manifest-missing','Een gecontroleerde eenmalige manifestmigratie is nodig.');
    const settings=(await transport.get(c.root+'/globals/settings'))?.data;
    if(!settings||await digest(settings)!==head.settingsHash)throw storageError('period-incomplete','De vereiste instellingen zijn niet geverifieerd.');
    const records=[];
    for(const dep of settings.dependencies){const row=(await transport.get(c.root+'/records/'+dep.id))?.data;if(!row||row.hash!==dep.hash)throw storageError('period-incomplete','Een vereiste instelling ontbreekt.');records.push(row);}
    const periods=[],emptyMonths=[],globalDocument=(await transport.get(c.root+'/globals/financial'))?.data;
    if(!globalDocument||await digest(globalDocument)!==head.globalHash)throw storageError('period-incomplete','De cumulatieve basis is niet geverifieerd.');
    const global=JSON.parse(globalDocument.payload);
    for(const month of [...new Set(months)]){
      if(!head.periodHashes[month]){if((await transport.query(c.root+'/records',{field:'periods',op:'ARRAY_CONTAINS',value:month})).length)throw storageError('period-incomplete','Deze financiële maand heeft bronnen maar geen projectiebewijs.');emptyMonths.push(month);continue;}
      const result=await loadPeriod(month);if(result.revision!==head.revision||result.epoch!==head.epoch)throw storageError('cloud-conflict','De periodebasis wijzigde tijdens laden.');
      for(const row of result.records)if(!records.some(old=>old.id===row.id))records.push(row);
      periods.push((await transport.get(c.root+'/periods/'+month)).data);
    }
    if(!months.length)throw storageError('invalid-period','Kies ten minste één financiële maand.');
    const values=await decodeRecordValues(records),layout={};
    for(const[key,kind]of Object.entries(head.layout))if(!key.startsWith('@'))layout[key]=kind==='list'?{kind,ids:values.filter(row=>row.collection===key).sort((a,b)=>a.ordinal-b.ordinal).map(row=>row.recordId)}:{kind};
    const state=decodeHouseholdState({storageVersion:1,schemaVersion:11,layout},values);
    const emptyPeriod=month=>({id:month,month,projectionVersion:1,dependencies:[],payload:canonical(periodFinancials({...state,transactions:[],savingsGoalLedger:state.savingsGoalLedger.filter(row=>!row.month||row.month===month)},month,{applicationProjection}))});
    for(const month of emptyMonths)periods.push(emptyPeriod(month));
    const proof={epoch:head.epoch,revision:head.revision,head:copy(head),records,periods,global:globalDocument,settings,imports:[],explicitFullHistory};
    proof.emptyPeriods=emptyMonths;proof.summaries={};
    // The existing Dashboard needs twelve summaries, not twelve months of bank records.
    for(const year of new Set(months.map(month=>month.slice(0,4))))for(let i=1;i<=12;i++){
      const month=year+'-'+String(i).padStart(2,'0');let document=periods.find(row=>row.month===month);
      if(!document&&head.periodHashes[month]){document=(await transport.get(c.root+'/periods/'+month))?.data;if(!document||await digest(document)!==head.periodHashes[month])throw storageError('period-incomplete','Een vereiste Dashboard-projectie ontbreekt.');}
      if(!document){if((await transport.query(c.root+'/records',{field:'periods',op:'ARRAY_CONTAINS',value:month})).length)throw storageError('period-incomplete','Een maandbron heeft geen geverifieerde projectie.');document=emptyPeriod(month);}
      proof.summaries[month]=JSON.parse(document.payload);
    }
    proof.ledgerBaseline=Object.fromEntries(Object.values(global.goals||{}).flatMap(goals=>goals.map(goal=>[goal.id,Math.round(Number(goal.algespaard||0)*100)/100-(state.savingsGoalLedger||[]).filter(entry=>entry.goalId===goal.id).reduce((sum,entry)=>sum+contributionAmount(entry),0)])));
    state.__finizePartialHistory=true;state.verifiedPeriods=periods.map(row=>row.month);state.meta.selectedMonth=months[0];state.__finizePeriodContext=proof;
    if(!same(head,(await transport.get(c.root+'/meta/head'))?.data))throw storageError('cloud-conflict','De administratie wijzigde tijdens periodeladen.');
    return state;
  }
  async function importRecords(id,c){
    const logicalId=await digest(JSON.stringify(['@imports',id])),headers=await transport.query(c.root+'/records',{field:'logicalId',value:logicalId}),rows=await transport.query(c.root+'/records',{field:'collection',value:'@rows:'+id});
    const records=[...headers,...rows].map(row=>row.data),buckets=new Map();
    for(const row of records){const key=manifestBucket(row);if(!buckets.has(key)){const manifest=(await transport.get(c.root+'/manifests/'+key))?.data;if(!manifest||await digest(manifest)!==c.head.data.manifestHashes[key])throw storageError('record-integrity','Het importmanifest ontbreekt.');buckets.set(key,manifest);}if(buckets.get(key).entries[row.id]!==await digest(row))throw storageError('record-integrity','Het importrecord wijkt af van het manifest.');}
    await decodeRecordValues(records);return records;
  }
  async function prepareWorkspaceCommit(before,state,imports=[]){
    assertWorkspaceMutation(before,state);
    const c=await context(),proof=before.__finizePeriodContext;
    if(!proof||proof.epoch!==c.head.data.epoch||proof.revision!==c.head.data.revision||!same(proof.head,c.head.data))throw storageError('cloud-conflict','De geverifieerde periodebasis is verouderd; behoud de lokale bewerking.');
    const selected=requiredMutationPeriods(before,state);
    // A changed global planning rule may affect every period, and is explicit rather than implicit.
    const affected=workspaceNeedsFullHistory(before,state)?state.verifiedPeriods:selected.length?selected:[state.meta.selectedMonth];
    if(affected.some(month=>!state.verifiedPeriods.includes(month)))throw storageError('dependency-required','Niet alle wijzigingsafhankelijkheden zijn geladen.');
    const scratch=completeDependencyState(state),oldState=completeDependencyState(before);
    const next=await buildRecordSnapshot(scratch,imports,{onlyPeriods:affected,applicationProjection});
    const oldRecords=copy(proof.records);
    for(const batch of imports)for(const row of await importRecords(batch.id,c))if(!oldRecords.some(old=>old.id===row.id))oldRecords.push(row);
    const ordinals=new Map(oldRecords.map(row=>[row.logicalId,row.ordinal]));let ordinal=c.head.data.recordCount;
    for(const row of next.records){if(!ordinals.has(row.logicalId))ordinals.set(row.logicalId,ordinal++);row.ordinal=ordinals.get(row.logicalId);const old=oldRecords.find(old=>old.id===row.id);if(row.collection==='transactions')row.periods=[...new Set([...(old?.periods||[]).filter(month=>!affected.includes(month)),...row.periods])].sort();}
    const old={records:oldRecords,periods:proof.periods.filter(row=>affected.includes(row.month)&&proof.head.periodHashes[row.month]),global:proof.global,settings:proof.settings};
    // Only rows explicitly present in this workspace may be removed.
    const changes=recordChanges(old,{...next,manifests:[]});
    const hashes=copy(c.head.data.manifestHashes),buckets=new Map();
    for(const change of changes.filter(row=>row.path.startsWith('records/'))){
      const key=manifestBucket(change.after);
      if(!buckets.has(key)){const stored=(await transport.get(c.root+'/manifests/'+key))?.data||{id:key,entries:{}};if(hashes[key]&&await digest(stored)!==hashes[key])throw storageError('record-integrity','Een gewijzigd recordmanifest wijkt af.');buckets.set(key,{before:hashes[key]?copy(stored):null,after:copy(stored)});}
      const bucket=buckets.get(key);
      if(!change.before&&!bucket.after.entries[change.after.id]){
        const previous=(await transport.get(c.root+'/'+change.path))?.data;
        if(previous){
          if(!previous.removed)throw storageError('record-integrity','Een bestaand record ontbreekt uit het actuele manifest.');
          if(previous.sourceHash!==change.after.sourceHash)throw storageError('source-immutable','Een terugkerende bankbron heeft andere oorspronkelijke gegevens.');
          change.before=previous;
        }
      }
      if(change.before&&!change.before.removed&&bucket.after.entries[change.before.id]!==await digest(change.before)||!change.before&&bucket.after.entries[change.after.id])throw storageError('cloud-conflict','Het oorspronkelijke financiële record wijzigde.');
      if(change.after.removed)delete bucket.after.entries[change.after.id];else bucket.after.entries[change.after.id]=await digest(change.after);
    }
    for(const[id,bucket]of buckets){hashes[id]=await digest(bucket.after);changes.push({id:'manifests_'+id,path:'manifests/'+id,...bucket});}
    // Reuse the canonical engine on the complete dependency domain; apply only its delta.
    const a=cumulativeFinancials(oldState),b=cumulativeFinancials(scratch),cumulative=JSON.parse(proof.global.payload);
    for(const key of Object.keys(cumulative.totalsCents))cumulative.totalsCents[key]+=b.totalsCents[key]-a.totalsCents[key];
    for(const key of ['bankSourceCount','approvedEffectCount'])cumulative[key]+=b[key]-a[key];
    cumulative.goals=b.goals;
    const global={id:'financial',projectionVersion:1,payload:canonical(cumulative)};
    const globalChange=changes.find(row=>row.path==='globals/financial');if(globalChange)globalChange.after=global;else if(!same(global,proof.global))changes.push({id:'globals_financial',path:'globals/financial',before:proof.global,after:global});
    const periodHashes={...c.head.data.periodHashes,...next.periodHashes},roots=await manifestRoots(hashes);
    const recordDelta=changes.filter(row=>row.path.startsWith('records/')).reduce((n,row)=>n+(!row.before||row.before.removed?1:0)-(row.after.removed?1:0),0);
    const importDelta=changes.filter(row=>row.path.startsWith('records/')&&row.after.collection==='@imports'&&row.after.part===0).reduce((n,row)=>n+(!row.before||row.before.removed?1:0)-(row.after.removed?1:0),0);
    return {...next,...roots,layout:{...c.head.data.layout,...next.layout},globalHash:await digest(global),periodHashes,manifestHashes:hashes,recordCount:c.head.data.recordCount+recordDelta,importCount:c.head.data.importCount+importDelta,targeted:true,preparedChanges:changes,requestHash:await digest({before,state,imports})};
  }
  async function commitWorkspace({before,state,imports=[],operationId,members=[],checkpoint=()=>{}}){
    if(!/^[A-Za-z0-9_-]{1,160}$/.test(operationId||''))throw storageError('operation-id','Een stabiel operatie-ID is vereist.');
    members=[...members].sort((a,b)=>a.id.localeCompare(b.id));
    const c=await context({allowPending:true}),existing=(await transport.get(c.root+'/operations/'+operationId))?.data,requestHash=await digest({before,state,imports});
    if(existing){
      if(existing.requestHash!==requestHash||existing.memberHash!==await digest(members))throw storageError('operation-reused','Het operatie-ID hoort bij andere periodegegevens.');
      if(existing.phase==='prepared'&&c.head.data.phase==='ready')await stageOperation(c,await prepareWorkspaceCommit(before,state,imports),operationId,members,checkpoint);
      return recover(operationId,{checkpoint});
    }
    const next=await prepareWorkspaceCommit(before,state,imports);await stageOperation(c,next,operationId,members,checkpoint);return recover(operationId,{checkpoint});
  }
  return {openWorkspace,prepareWorkspaceCommit,commitWorkspace};
}
