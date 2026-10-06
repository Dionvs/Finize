import { ACCOUNT_CONTEXTS, getTransactionAccountContext, getTransactionFinancialDestination, getTransactionSource, getTransactionProcessingStatus, getTransactionDate, getTransactionClassification, isTransactionFinanciallyActive } from './transaction-model.mjs';
import { resolvePlannedIncomeForMonth, resolveFixedExpensesForMonth, resolveVariableBudgetsForMonth } from './planning-timeline.mjs';
import { plannedOccurrences } from './recurring-occurrences.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const money=value=>Math.round((Number(value||0)+Number.EPSILON)*100)/100;
const cents=value=>Math.round(Number(value)*100);
const incomeTypes=new Set(['inkomen','salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten']);
const savingsTypes=new Set(['sparen','naar-spaarrekening','van-spaarrekening']);
const transferTypes=new Set(['interne-overboeking','maandelijkse-bijdrage','extra-bijdrage']);
const monthOf=value=>/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(String(value))?String(value).slice(0,7):null;
export function transactionSourceKey(tx) {return tx.importBatchId&&tx.importTransactionId?`${tx.importBatchId}:${tx.importTransactionId}`:tx.id;}
export function getTransactionFinancialMonth(tx,{dimension='calendar',occurrence=null}={}) {
  if(dimension==='fixed')return occurrence?.month || tx.fixedOccurrenceMonth || tx.processing?.fixedOccurrenceMonth || monthOf(String(tx.fixedOccurrenceId||tx.processing?.fixedOccurrenceId||'').slice(-10));
  return monthOf(getTransactionDate(tx));
}
function amountOf(tx){return money(Math.abs(Number(tx.amount??tx.processing?.processedAmount??tx.bankOriginal?.amount??0)));}
function sourceCash(tx){
  if(Number.isFinite(Number(tx.bankOriginal?.amount)))return money(tx.bankOriginal.amount);
  if(tx.accountDelta!==undefined&&Number.isFinite(Number(tx.accountDelta)))return money(tx.accountDelta);
  const amount=amountOf(tx);return incomeTypes.has(getTransactionClassification(tx))||['van-spaarrekening','terugbetaling','refund'].includes(getTransactionClassification(tx))||tx.kind==='inkomen'?amount:-amount;
}
function replacementSuppresses(tx,state){return(state.manualTransactionReplacements||[]).some(row=>row.active!==false&&(row.manualTransaction?.id===tx.id||row.manualTransactionId===tx.id));}
function pairFor(tx,state){return(state.internalTransferPairs||[]).find(pair=>['bevestigd','confirmed','uitgevoerd'].includes(pair.status)&&pair.active!==false&&(pair.transactionIds||[]).some(id=>id===tx.id||id===tx.sourceTransactionId||((state.transactions||[]).find(row=>row.id===id)&&transactionSourceKey((state.transactions||[]).find(row=>row.id===id))===transactionSourceKey(tx))));}
function projectBaseTransaction(tx,{state={},materialized=false,sourceApproved=null,sourceCashflow=null}={}) {
  const status=getTransactionProcessingStatus(tx),active=!['withdrawn','deleted'].includes(tx.batchLifecycle)&&(sourceApproved??isTransactionFinanciallyActive(tx))&&status==='goedgekeurd'&&!replacementSuppresses(tx,state);
  const accountContext=getTransactionAccountContext(tx,{accountProfiles:state.accountProfiles||[]}),financialFor=getTransactionFinancialDestination(tx);
  let type=getTransactionClassification(tx);
  const linkedSource=(state.recurringIncomeSources||[]).find(source=>source.id===(tx.incomeSourceId||tx.processing?.incomeSourceId));
  if(linkedSource?.legacyKind==='salary'&&incomeTypes.has(type))type='salaris';
  const amount=amountOf(tx),calendarMonth=getTransactionFinancialMonth(tx),key=transactionSourceKey(tx);
  const diagnostics=[];if(!accountContext)diagnostics.push({code:'ambiguous-account-context',id:tx.id});if(!calendarMonth)diagnostics.push({code:'missing-transaction-date',id:tx.id});
  const rawSplits=tx.processing?.splits||tx.splits;
  const processing=tx.processing||{},fixedId=tx.fixedOccurrenceId||processing.fixedOccurrenceId||'';
  const fixedMonth=fixedId?getTransactionFinancialMonth(tx,{dimension:'fixed'}):null;
  const fixed=type==='vaste-last'||!!(tx.fixedExpenseId||processing.fixedExpenseId||fixedId);
  const income=incomeTypes.has(type);
  const refund=type==='terugbetaling'||type==='refund';
  const special=savingsTypes.has(type)||transferTypes.has(type)||type==='terugbetaling-voorschot'||refund;
  const stored=tx.expenseImpact,legacyStored=stored!==undefined&&stored!==null&&stored!==''&&Number.isFinite(Number(stored));
  const paired=!!pairFor(tx,state);
  const budget=active&&!fixed&&!income&&!special&&!paired?money(legacyStored?Math.max(0,Number(stored)):amount):0;
  const realExpense=active&&!income&&!special&&!paired?amount:0;
  const cash=active?money(sourceCashflow??sourceCash(tx)):0;
  const pair=pairFor(tx,state),internal=transferTypes.has(type)||!!pair;
  const structural=savingsTypes.has(type)||type==='terugbetaling-voorschot';
  const effects={accountCashflow:cash,householdCashflow:cash,externalHouseholdCashflow:internal||structural?0:cash,unconfirmedTransferCashflow:internal&&!pair?cash:0,incomeImpact:active&&income&&!internal?amount:0,realExpense,budgetImpact:budget,fixedRealization:active&&fixedId?amount:0,savingsEffect:active&&savingsTypes.has(type)?amount:0,refundEffect:active&&refund?amount:0,advanceRepaymentEffect:active&&type==='terugbetaling-voorschot'?amount:0};
  const result={id:tx.id,sourceKey:key,source:getTransactionSource(tx),accountContext,financialFor,status,active,transactionType:type,category:tx.category||processing.category||'Overig',amount,calendarMonth,financialMonth:fixedMonth||calendarMonth,fixedMonth,fixedOccurrenceId:fixedId,fixedExpenseId:tx.fixedExpenseId||processing.fixedExpenseId||'',incomeSourceId:tx.incomeSourceId||processing.incomeSourceId||'',incomeOccurrenceId:tx.incomeOccurrenceId||processing.incomeOccurrenceId||'',splitId:tx.splitId||'',effects,diagnostics,transaction:tx};
  // Existing stored rows are already materialized processing lines, even though the source's
  // full split list is repeated on every row. Only an unmaterialized source is expanded.
  if(!materialized&&!tx.splitId&&Array.isArray(rawSplits)&&rawSplits.length){
    const cashIndex=rawSplits.findIndex(split=>split.include!==false&&split.transactionType!=='niet-meetellen');
    result.lines=rawSplits.map((split,index)=>projectBaseTransaction({...tx,...split,source:tx.source,bankOriginal:tx.bankOriginal,rawData:tx.rawData,accountContext:tx.accountContext,accountContextEvidence:tx.accountContextEvidence,account:tx.account,accountOwner:tx.accountOwner,accountProfileId:tx.accountProfileId,transactionDate:tx.transactionDate,date:tx.date,bookingDate:tx.bookingDate,importBatchId:tx.importBatchId,importTransactionId:tx.importTransactionId,processingStatus:tx.processingStatus,certainty:tx.certainty,reviewStatus:tx.reviewStatus,approvalSource:tx.approvalSource,approvedAt:tx.approvedAt,id:`${tx.id}:split:${split.id||index}`,splitId:split.id||String(index),sourceTransactionId:tx.id,expenseImpact:split.expenseImpact,amount:split.amount,transactionType:split.transactionType||(type==='vaste-last'?'uitgave':type),fixedExpenseId:split.fixedExpenseId||'',fixedOccurrenceId:split.fixedOccurrenceId||'',fixedOccurrenceMonth:split.fixedOccurrenceMonth||'',budgetOwner:split.budgetOwner||financialFor,financialFor:split.financialFor||split.budgetOwner||financialFor,category:split.category,processing:{...processing,...split,fixedExpenseId:split.fixedExpenseId||'',fixedOccurrenceId:split.fixedOccurrenceId||'',fixedOccurrenceMonth:split.fixedOccurrenceMonth||'',splits:[]}}, {state,materialized:true,sourceApproved:active,sourceCashflow:index===cashIndex?cash:0}));
    for(const dimension of ['incomeImpact','realExpense','budgetImpact','fixedRealization','savingsEffect','refundEffect','advanceRepaymentEffect'])result.effects[dimension]=money(result.lines.reduce((sum,line)=>sum+line.effects[dimension],0));
  }
  return result;
}
export function selectTransactionProjections(state,{month=null,dimension='calendar',account=null,owner=null,includeInactive=false}={}) {
  const groups=new Map();(state.transactions||[]).forEach(tx=>{const key=transactionSourceKey(tx);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(tx);});
  const projections=[];
  groups.forEach(group=>{
    const csvMaterialized=group.some(tx=>tx.importBatchId&&tx.importTransactionId&&(tx.splitId||tx.accountDelta!==undefined))||group.length>1;
    const approved=group.every(tx=>['goedgekeurd','niet-meetellen'].includes(getTransactionProcessingStatus(tx)))&&group.some(isTransactionFinanciallyActive);
    const cashTarget=group.find(isTransactionFinanciallyActive);
    const cashEvidence=group.find(tx=>tx.bankOriginal)||group.find(tx=>Number(tx.accountDelta)!==0)||group[0];
    group.forEach(tx=>{
      const p=projectBaseTransaction(tx,{state,materialized:csvMaterialized,sourceApproved:approved,sourceCashflow:csvMaterialized?(tx===cashTarget?sourceCash(cashEvidence):0):null});
      projections.push(...(p.lines||[p]));
    });
  });
  applySavingsAndRefundEffects(projections,state);
  return projections.filter(p=>(includeInactive||p.active)&&(!month||(dimension==='fixed'?p.fixedMonth:dimension==='budget'&&p.effects.refundCorrection?p.refundMonth:p.calendarMonth)===month)&&(!account||p.accountContext===account)&&(!owner||p.financialFor===owner));
}
export function selectActiveTransactions(state,options={}) {
  const seen=new Set();return selectTransactionProjections(state,options).map(p=>p.transaction).filter(tx=>{if(seen.has(tx.id))return false;seen.add(tx.id);return true;});
}
export function sumTransactionEffects(state,dimension,options={}) {return money(selectTransactionProjections(state,{...options,...(dimension==='budgetImpact'?{dimension:'budget'}:{})}).reduce((sum,p)=>sum+Number(p.effects[dimension]||0),0));}
export function categoryActuals(state,month,owner) {
  const result={};selectTransactionProjections(state,{month,owner,dimension:'budget'}).forEach(p=>{const category=p.effects.refundCorrection?p.refundCategory:p.category;if(p.effects.budgetImpact)result[category]=money((result[category]||0)+p.effects.budgetImpact);});return result;
}
export function fixedOccurrenceActuals(state,occurrence) {
  const rows=selectTransactionProjections(state,{month:occurrence.month,dimension:'fixed'}).filter(p=>p.fixedOccurrenceId===occurrence.id);
  const actual=money(rows.reduce((sum,p)=>sum+p.effects.fixedRealization,0)),planned=money(occurrence.amount);
  return {planned,actual,deviation:money(actual-planned),paid:rows.length>0,status:rows.length?'Betaald':'Niet betaald',rows};
}
export function actualIncomeForMonth(state,month,owner=null) {
  const rows=selectTransactionProjections(state,{month}).filter(p=>p.effects.incomeImpact>0);
  if(rows.length)return {amount:money(rows.filter(p=>!owner||p.financialFor===owner).reduce((sum,p)=>sum+p.effects.incomeImpact,0)),source:'transactions',rows};
  const override=state.actualIncomeOverrides?.[month],manual=owner?override?.[owner]:override?.total;
  return {amount:Number.isFinite(Number(manual))?money(manual):0,source:manual!==undefined?'manual-correction':'none',rows:[]};
}
// Compatibility only for grandfathered salary rows that the old forecast assigned by
// employer group/amount. It never changes canonical financialFor or physical account.
export function legacySalaryForecastOwners(state,month,planned){
  const groups=new Map(),result=new Map();
  selectTransactionProjections(state,{month}).filter(p=>p.transactionType==='salaris'&&p.effects.incomeImpact>0&&!['dion','dara'].includes(p.financialFor)&&(p.transaction.approvalSource==='legacy-confirmed'||p.transaction.reviewStatus==='bevestigd'&&!p.transaction.approvalSource)).forEach(p=>{
    const description=String(p.transaction.description||p.transaction.title||p.transaction.name||'');
    const key=description.split(/[\u2014\u2013]/)[0].toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()||String(p.id);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
  });
  groups.forEach(rows=>{const amount=money(rows.reduce((sum,p)=>sum+p.effects.incomeImpact,0));const owner=Math.abs(amount-planned.dion.salary)<=Math.abs(amount-planned.dara.salary)?'dion':'dara';rows.forEach(p=>result.set(p.id,owner));});
  return result;
}
export function incomeProjectionForMonth(state,month,owner,planned,{legacyOwners=new Map()}={}) {
  const rows=selectTransactionProjections(state,{month}).filter(p=>p.effects.incomeImpact>0&&(legacyOwners.get(p.id)||p.financialFor)===owner),salary=rows.filter(p=>p.transactionType==='salaris');
  return {salary:salary.length?money(salary.reduce((sum,p)=>sum+p.effects.incomeImpact,0)):money(planned.salary),salaryActual:salary.length>0,extra:money(rows.filter(p=>p.transactionType!=='salaris').reduce((sum,p)=>sum+p.effects.incomeImpact,0)),rows};
}
export function validateTransactionProcessing(source,{fixedOccurrences=null,validFixedId=null,goalExists=null,refundCategoryExists=null}={}) {
  const p=source.processing||source,errors=[];
  const amount=p.processedAmount??source.amount??source.bankOriginal?.amount;
  const validMoney=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number.isSafeInteger(cents(value))&&Math.abs(Number(value)*100-cents(value))<1e-6;
  if(!validMoney(amount))errors.push({code:'amount',message:'Bedrag moet een geldig bedrag in eurocenten zijn.'});
  const splits=p.splits??source.splits;
  if(splits!==undefined&&!Array.isArray(splits))errors.push({code:'splits',message:'Ongeldige splitstructuur.'});
  if(Array.isArray(splits)&&splits.length){
    const signed=splits.some(split=>Number(split.amount)<0);
    const total=splits.reduce((sum,split)=>sum+(validMoney(split.amount)?cents(split.amount):0),0);
    const expected=signed?(Number(amount)<0?cents(amount):-Math.abs(cents(amount))):Math.abs(cents(amount));
    if(total!==expected||splits.some(split=>!validMoney(split.amount)))errors.push({code:'splits',message:'Splitbedragen moeten exact optellen tot het verwerkte bedrag.'});
  }
  (Array.isArray(splits)&&splits.length?splits:[p]).forEach(line=>{
    const type=line.transactionType||p.transactionType||source.transactionType||source.kind;
    if(!type||!line.category||!ACCOUNT_CONTEXTS.includes(line.budgetOwner||line.financialFor||p.budgetOwner||source.financialFor))errors.push({code:'split-fields',message:'Iedere verwerkingsregel heeft een type, categorie en financiële bestemming nodig.'});
    const fixed=line.fixedExpenseId||(!splits?.length?p.fixedExpenseId:'');
    const occurrenceId=line.fixedOccurrenceId||(!splits?.length?p.fixedOccurrenceId:'');
    if(occurrenceId&&!fixed)errors.push({code:'fixed-choice',message:'Kies de vaste last die bij het geplande betaalmoment hoort.'});
    if(type==='vaste-last'&&!fixed)errors.push({code:'fixed-choice',message:'Kies de vaste last en het betaalmoment.'});
    if(fixed&&validFixedId&&!validFixedId(fixed,line.fixedOccurrenceMonth||p.fixedOccurrenceMonth))errors.push({code:'fixed',message:'Ongeldige vaste-lastkoppeling.'});
    if(fixed&&fixedOccurrences&&(!occurrenceId||!fixedOccurrences.some(row=>row.id===occurrenceId&&row.itemId===fixed)))errors.push({code:'fixed',message:'Kies een geldig gepland betaalmoment.'});
    if(savingsTypes.has(type)&&!line.savingsGoalId)errors.push({code:'goal-choice',message:'Kies één spaardoel voor iedere spaarbeweging.'});
    if(['terugbetaling','refund'].includes(type)){
      const category=line.refundCategory,month=line.refundMonth;
      if(!category)errors.push({code:'refund-category',message:'Kies de historische refundcategorie.'});
      if(!validMonth(month))errors.push({code:'refund-month',message:'Kies een geldige refundmaand.'});
      if(category&&validMonth(month)&&refundCategoryExists&&!refundCategoryExists(category,month,line.budgetOwner||line.financialFor||p.budgetOwner||p.financialFor||source.financialFor))errors.push({code:'refund-category',message:'Deze categorie is niet herkenbaar in de gekozen historische context.'});
      const cash=source.bankOriginal?.amount??source.accountDelta;
      if(!(Number(line.amount??amount)>0)||cash!==undefined&&!(Number(cash)>0))errors.push({code:'refund-direction',message:'Een aankooprefund moet een inkomende betaling zijn.'});
    }
    if(line.savingsGoalId&&goalExists&&!goalExists(line.savingsGoalId))errors.push({code:'split-goal',message:'Het gekoppelde spaardoel bestaat niet.'});
  });
  const goalIds=new Set((Array.isArray(splits)&&splits.length?splits:[p]).filter(line=>savingsTypes.has(line.transactionType||p.transactionType)).map(line=>line.savingsGoalId).filter(Boolean));
  if(goalIds.size>1)errors.push({code:'goal-choice',message:'Eén spaarbeweging kan niet over meerdere spaardoelen worden verdeeld.'});
  return {ok:!errors.length,errors};
}
export function confirmInternalTransferPair(state,id) {
  const pair=(state.internalTransferPairs||[]).find(row=>row.id===id);if(!pair)throw new Error('Transferpaar ontbreekt.');
  const groups=(pair.transactionIds||[]).map(id=>(state.transactions||[]).find(tx=>tx.id===id));
  if(groups.length!==2||groups.some(tx=>!tx||!isTransactionFinanciallyActive(tx)))throw new Error('Beide transfers moeten financieel actief zijn.');
  const [a,b]=groups,accountA=getTransactionAccountContext(a,{accountProfiles:state.accountProfiles||[]}),accountB=getTransactionAccountContext(b,{accountProfiles:state.accountProfiles||[]});
  if(!accountA||!accountB||accountA===accountB||cents(sourceCash(a))+cents(sourceCash(b))!==0)throw new Error('Rekeningen of bedragen vormen geen geldig intern paar.');
  if((state.internalTransferPairs||[]).some(row=>row.id!==id&&row.active!==false&&['bevestigd','confirmed','uitgevoerd'].includes(row.status)&&(row.transactionIds||[]).some(txid=>pair.transactionIds.includes(txid))))throw new Error('Een transactie is al gekoppeld.');
  pair.status='bevestigd';return pair;
}
export function confirmManualReplacement(state,row,manualId,importId) {
  const manual=(state.transactions||[]).find(tx=>tx.id===manualId&&!tx.importBatchId);if(!manual)throw new Error('Handmatige transactie ontbreekt.');
  const id=`replacement-${importId}-${manualId}`,existing=(state.manualTransactionReplacements||[]).find(item=>item.id===id);
  if((state.manualTransactionReplacements||[]).some(item=>item.active!==false&&(item.manualTransactionId===manualId||item.manualTransaction?.id===manualId)&&(item.importBatchId!==importId||item.importTransactionId!==row.id)))throw new Error('Handmatige transactie is al vervangen.');
  state.manualTransactionReplacements=state.manualTransactionReplacements||[];
  if(!existing)state.manualTransactionReplacements.push({id,manualTransactionId:manualId,manualTransaction:copy(manual),importBatchId:importId,importTransactionId:row.id,active:true});
  if(existing)existing.active=true;
  const p=row.processing;
  for(const field of ['category','budgetOwner','transactionType','fixedExpenseId','fixedOccurrenceId','fixedOccurrenceMonth','savingsGoalId','refundCategory','refundMonth','splits']){
    const value=manual.processing?.[field]??manual[field]??(field==='budgetOwner'?getTransactionFinancialDestination(manual):undefined);
    if(value!==undefined)p[field]=copy(value);
  }
  p.manualMatchId=manualId;p.processedAmount=Math.abs(Number(row.bankOriginal.amount));p.processingDate=row.bankOriginal.bankDate;p.description=row.bankOriginal.description;
  row.certainty='nakijken';row.processingStatus='nakijken';row.approvalSource='';row.approvedAt='';return row;
}


// P4 enriches the same P3 projections. These readers never mutate persistent state.
const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||''));
const categoryKey=value=>String(value||'').trim().toLocaleLowerCase('nl-NL');
const categoryContext=(owner,month,category)=>`${owner}|${month}|${categoryKey(category)}`;
const goalExistsIn=(state,id)=>ACCOUNT_CONTEXTS.some(owner=>(state.spaardoelen?.[owner]||[]).some(goal=>goal.id===id));
export function projectionLineReference(p){return {transactionId:p.id,sourceKey:p.transaction?.sourceTransactionId||p.sourceKey,splitId:p.splitId||''};}
function allocationEndpoint(rows,allocation,side){
  const source=allocation[`${side}SourceKey`],split=allocation[`${side}SplitId`]||'',id=allocation[`${side}TransactionId`];
  return source?rows.find(p=>{const ref=projectionLineReference(p);return ref.sourceKey===source&&ref.splitId===split;}):rows.find(p=>p.id===id);
}
export function refundCategoryIsRecognizable(state,category,month,owner){
  if(!validMonth(month)||!ACCOUNT_CONTEXTS.includes(owner)||!category)return false;
  const names=[...resolveVariableBudgetsForMonth(state,month,owner).map(row=>row.post||row.categorie),...resolveFixedExpensesForMonth(state,month,owner).map(row=>row.categorie),...(state.transactions||[]).filter(tx=>getTransactionFinancialDestination(tx)===owner&&getTransactionFinancialMonth(tx)===month).map(tx=>tx.category)];
  return names.some(value=>categoryKey(value)===categoryKey(category));
}
function coverageEligibility(withdrawal,expense,state){
  if(!withdrawal||!expense)return 'coverage-missing-reference';
  if(!withdrawal.active||!expense.active)return 'coverage-inactive-reference';
  if(withdrawal.transactionType!=='van-spaarrekening'||!withdrawal.savingsGoalId||!goalExistsIn(state,withdrawal.savingsGoalId))return 'coverage-withdrawal';
  if(!(expense.effects.realExpense>0)||!(expense.regularExpenseBase>0))return 'coverage-expense';
  if(!withdrawal.calendarMonth||withdrawal.calendarMonth!==expense.calendarMonth)return 'coverage-month';
  if(expense.fixedOccurrenceId&&expense.fixedMonth!==expense.calendarMonth)return 'coverage-fixed-month';
  return '';
}
function applySavingsAndRefundEffects(rows,state){
  const eligible=[],withdrawalTotals=new Map(),expenseTotals=new Map(),occurrenceCache=new Map();
  rows.forEach(p=>{
    const tx=p.transaction,processing=tx.processing||{};
    p.savingsGoalId=tx.savingsGoalId||processing.savingsGoalId||'';
    p.refundCategory=tx.refundCategory||processing.refundCategory||'';
    p.refundMonth=tx.refundMonth||processing.refundMonth||'';
    p.budgetCategory=p.category;
    if(p.fixedOccurrenceId&&validMonth(p.fixedMonth)){if(!occurrenceCache.has(p.fixedMonth))occurrenceCache.set(p.fixedMonth,plannedOccurrences(resolveFixedExpensesForMonth(state,p.fixedMonth),p.fixedMonth));p.budgetCategory=occurrenceCache.get(p.fixedMonth).find(row=>row.id===p.fixedOccurrenceId)?.categorie||p.category;}
    p.regularExpenseBase=p.fixedOccurrenceId?p.effects.realExpense:Math.min(p.effects.realExpense,p.effects.budgetImpact);
    p.effects.savingsDeposit=p.active&&['sparen','naar-spaarrekening'].includes(p.transactionType)?p.amount:0;
    p.effects.savingsWithdrawal=p.active&&p.transactionType==='van-spaarrekening'?p.amount:0;
    p.effects.goalDelta=p.savingsGoalId&&goalExistsIn(state,p.savingsGoalId)?money(p.effects.savingsDeposit-p.effects.savingsWithdrawal):0;
    p.effects.savingsFunded=0;p.effects.unusedSavings=p.effects.savingsWithdrawal;p.effects.refundCorrection=0;p.effects.categoryOnlyRefundCorrection=0;
    const refund=['terugbetaling','refund'].includes(p.transactionType),incoming=sourceCash(tx)>0;
    p.effects.refundCashflow=p.active&&refund&&incoming?p.amount:0;
    p.effects.refundEffect=p.effects.refundCashflow;
    p.effects.fixedRegularImpact=p.fixedOccurrenceId?p.effects.realExpense:0;
    if(savingsTypes.has(p.transactionType)&&!p.savingsGoalId)p.diagnostics.push({code:'legacy-savings-goal-missing',id:p.id});
    if(refund&&(!incoming||!p.refundCategory||!validMonth(p.refundMonth)))p.diagnostics.push({code:!incoming?'legacy-refund-direction':'legacy-refund-context-missing',id:p.id});
    p.coverageAllocations=[];
  });
  (state.savingsCoverageAllocations||[]).filter(a=>a.active!==false).forEach(allocation=>{
    const withdrawal=allocationEndpoint(rows,allocation,'withdrawal'),expense=allocationEndpoint(rows,allocation,'expense');
    const amount=Number(allocation.amountCents),reason=coverageEligibility(withdrawal,expense,state)||(!Number.isSafeInteger(amount)||amount<=0?'coverage-cents':'');
    const status={id:allocation.id,active:false,reason,amountCents:amount,withdrawalTransactionId:withdrawal?.id||allocation.withdrawalTransactionId,expenseTransactionId:expense?.id||allocation.expenseTransactionId};
    if(withdrawal)withdrawal.coverageAllocations.push(status);if(expense)expense.coverageAllocations.push(status);
    if(reason)return;
    eligible.push({allocation,withdrawal,expense,status});
    withdrawalTotals.set(withdrawal.id,(withdrawalTotals.get(withdrawal.id)||0)+amount);
    expenseTotals.set(expense.id,(expenseTotals.get(expense.id)||0)+amount);
  });
  eligible.forEach(({allocation,withdrawal,expense,status})=>{
    const reason=withdrawalTotals.get(withdrawal.id)>cents(withdrawal.amount)?'coverage-exceeds-withdrawal':expenseTotals.get(expense.id)>cents(expense.regularExpenseBase)?'coverage-exceeds-expense':'';
    if(reason){status.reason=reason;expense.diagnostics.push({code:reason,allocationId:allocation.id});return;}
    status.active=true;
    expense.effects.savingsFunded=money(expense.effects.savingsFunded+allocation.amountCents/100);
    withdrawal.effects.unusedSavings=money(withdrawal.effects.unusedSavings-allocation.amountCents/100);
  });
  const categoryCapacity=new Map(),fixedCategories=new Set(),refundGroups=new Map();
  rows.forEach(p=>{
    if(!p.active)return;
    if(p.effects.realExpense>0){
      const amount=money(p.regularExpenseBase-p.effects.savingsFunded);
      if(p.fixedOccurrenceId)p.effects.fixedRegularImpact=amount;else p.effects.budgetImpact=amount;
      const key=categoryContext(p.financialFor,p.fixedOccurrenceId?p.fixedMonth:p.calendarMonth,p.budgetCategory);
      categoryCapacity.set(key,(categoryCapacity.get(key)||0)+cents(amount));
      if(p.fixedOccurrenceId)fixedCategories.add(key);
    }
    if(p.effects.refundCashflow&&validMonth(p.refundMonth)&&p.refundCategory){
      const key=categoryContext(p.financialFor,p.refundMonth,p.refundCategory);
      if(!refundGroups.has(key))refundGroups.set(key,[]);refundGroups.get(key).push(p);
    }
  });
  refundGroups.forEach((refunds,key)=>{
    const total=refunds.reduce((sum,p)=>sum+cents(p.amount),0);
    if(total>(categoryCapacity.get(key)||0)){refunds.forEach(p=>p.diagnostics.push({code:'refund-exceeds-category',id:p.id,month:p.refundMonth,category:p.refundCategory}));return;}
    // A refund has no purchase link: do not allocate a mixed fixed/variable category correction.
    refunds.forEach(p=>{p.effects.refundCorrection=p.amount;p.effects.categoryOnlyRefundCorrection=fixedCategories.has(key)?p.amount:0;p.effects.budgetImpact=fixedCategories.has(key)?0:-p.amount;});
  });
}
export function projectTransaction(tx,{state={},...options}={}){
  const present=(state.transactions||[]).some(row=>row===tx||row.id===tx.id);
  const candidate=present?state:{...state,transactions:[...(state.transactions||[]),tx]};
  const base=projectBaseTransaction(tx,{state:candidate,...options});
  const refs=base.lines||[base],rows=selectTransactionProjections(candidate,{includeInactive:true});
  const projected=refs.map(line=>rows.find(p=>p.id===line.id)||line);
  if(!base.lines)return projected[0];
  base.lines=projected;
  for(const dimension of Object.keys(projected[0]?.effects||{}))base.effects[dimension]=money(projected.reduce((sum,line)=>sum+Number(line.effects[dimension]||0),0));
  return base;
}
export function coverageAllocationStatus(state){
  const rows=selectTransactionProjections(state,{includeInactive:true}),statuses=new Map(rows.flatMap(p=>p.coverageAllocations||[]).map(a=>[a.id,a]));
  return (state.savingsCoverageAllocations||[]).map(a=>a.active===false?{id:a.id,active:false,reason:'removed',amountCents:a.amountCents}:statuses.get(a.id)||{id:a.id,active:false,reason:'coverage-missing-reference',amountCents:a.amountCents});
}
export function validateSavingsCoverageAllocation(state,allocation){
  const rows=selectTransactionProjections(state,{includeInactive:true}),withdrawal=allocationEndpoint(rows,allocation,'withdrawal'),expense=allocationEndpoint(rows,allocation,'expense');
  const code=coverageEligibility(withdrawal,expense,state);
  if(code)throw new Error(coverageMessage(code));
  if(!Number.isSafeInteger(allocation.amountCents)||allocation.amountCents<=0)throw new Error(coverageMessage('coverage-cents'));
}
export function coverageMessage(code){return {'coverage-missing-reference':'De gekoppelde bronregel bestaat niet meer.','coverage-inactive-reference':'Beide transacties moeten financieel actief zijn.','coverage-withdrawal':'Kies een actieve spaaropname met een geldig spaardoel.','coverage-expense':'Kies een echte uitgave met reguliere maandbelasting.','coverage-month':'Spaardekking kan alleen binnen dezelfde bankkalendermaand.','coverage-fixed-month':'Bij vaste lasten moeten bankmaand en geplande occurrence-maand gelijk zijn.','coverage-cents':'Het dekkingsbedrag moet positief zijn en uit gehele eurocenten bestaan.','coverage-exceeds-withdrawal':'De totale dekking is hoger dan de spaaropname.','coverage-exceeds-expense':'De totale dekking is hoger dan de relevante uitgave.'}[code]||code;}
export function categoryFinancialActuals(state,month,owner=null){
  const map=new Map(),ensure=category=>{const key=categoryKey(category);if(!map.has(key))map.set(key,{category,realExpense:0,savingsFunded:0,refundCorrection:0,categoryOnlyRefundCorrection:0,budgetImpact:0});return map.get(key);};
  selectTransactionProjections(state).forEach(p=>{
    if(owner&&p.financialFor!==owner)return;
    const expenseMonth=p.fixedOccurrenceId?p.fixedMonth:p.calendarMonth;
    if(expenseMonth===month&&p.effects.realExpense>0){const row=ensure(p.budgetCategory||p.category);row.realExpense=money(row.realExpense+p.effects.realExpense);row.savingsFunded=money(row.savingsFunded+p.effects.savingsFunded);row.budgetImpact=money(row.budgetImpact+p.regularExpenseBase-p.effects.savingsFunded);}
    if(p.refundMonth===month&&p.effects.refundCorrection){const row=ensure(p.refundCategory);row.refundCorrection=money(row.refundCorrection+p.effects.refundCorrection);row.categoryOnlyRefundCorrection=money(row.categoryOnlyRefundCorrection+p.effects.categoryOnlyRefundCorrection);row.budgetImpact=money(row.budgetImpact-p.effects.refundCorrection);}
  });return [...map.values()];
}
export function financialForecastForMonth(state,month,{compatibilityIncome={},plannedIncome=null,fixedOccurrences=null}={}){
  if(!validMonth(month))throw new Error('Ongeldige prognosemaand.');
  const planned=Object.fromEntries(['dion','dara'].map(owner=>{
    const config=plannedIncome?.[owner]||resolvePlannedIncomeForMonth(state,month,owner),manual=state.monthlyIncomeOverrides?.[month]?.[owner];
    return [owner,{...config,salary:manual!==undefined?money(manual):money(config.salary)}];
  }));
  const legacyOwners=legacySalaryForecastOwners(state,month,planned),rows=selectTransactionProjections(state),owners=Object.fromEntries(ACCOUNT_CONTEXTS.map(owner=>[owner,{owner,income:money(compatibilityIncome[owner]),salary:0,salarySource:'none',extraIncome:0,fixedBurden:0,variableBurden:0,savingsDeposit:0,savingsFunded:0,unusedSavings:0,refundCashflow:0,available:0}]));
  ['dion','dara'].forEach(owner=>{const income=incomeProjectionForMonth(state,month,owner,planned[owner],{legacyOwners});owners[owner].salary=income.salary;owners[owner].salarySource=income.salaryActual?'transactions':state.monthlyIncomeOverrides?.[month]?.[owner]!==undefined?'manual':'planned';owners[owner].extraIncome=income.extra;owners[owner].income=money(owners[owner].income+income.salary+income.extra);});
  rows.filter(p=>p.calendarMonth===month).forEach(p=>{
    const target=owners[p.financialFor];if(!target)return;
    if(p.financialFor==='gezamenlijk'&&!legacyOwners.has(p.id))target.income=money(target.income+p.effects.incomeImpact);
    target.variableBurden=money(target.variableBurden+(p.effects.realExpense>0&&!p.fixedOccurrenceId?p.effects.budgetImpact:0));
    for(const field of ['savingsDeposit','savingsFunded','unusedSavings','refundCashflow'])target[field]=money(target[field]+p.effects[field]);
  });
  const occurrences=fixedOccurrences||plannedOccurrences(resolveFixedExpensesForMonth(state,month),month);
  const allowanceOwners=Object.fromEntries(ACCOUNT_CONTEXTS.map(owner=>[owner,{fixedReserve:0,budgetReserve:money(resolveVariableBudgetsForMonth(state,month,owner).reduce((sum,row)=>sum+Number(row.bedrag||0),0)),savingsReserve:0,totalReserve:0}]));
  let equalJointReserve=0;
  occurrences.forEach(occurrence=>{
    const actualRows=rows.filter(p=>p.active&&p.fixedOccurrenceId===occurrence.id),amount=actualRows.length?money(actualRows.reduce((sum,p)=>sum+p.effects.fixedRegularImpact,0)):money(occurrence.amount);
    const owner=owners[occurrence.financialFor];if(!owner)return;owner.fixedBurden=money(owner.fixedBurden+amount);
    allowanceOwners[occurrence.financialFor].fixedReserve=money(allowanceOwners[occurrence.financialFor].fixedReserve+Number(occurrence.amount));
    if(occurrence.financialFor==='gezamenlijk'&&occurrence.source?.distributionMode==='equal')equalJointReserve=money(equalJointReserve+Number(occurrence.amount));
  });
  const dion=owners.dion,dara=owners.dara,joint=owners.gezamenlijk,incomeBasis=money(dion.income+dara.income),minimum=Number(state.planning?.verdeling?.minimumDion??.4),ratioDion=Math.max(minimum,incomeBasis>0?dion.income/incomeBasis:0),ratioDara=1-ratioDion;
  const burden=owner=>money(owner.fixedBurden+owner.variableBurden+owner.savingsDeposit-owner.unusedSavings-owner.refundCashflow);
  // Allowance is determined by month planning. Actual spending, refunds, coverage and
  // savings realizations only affect forecast/account buffers, never this reservation.
  const savingsOverrides=state.monthlySavingOverrides?.[month]||{};
  const jointPlan=allowanceOwners.gezamenlijk;
  jointPlan.savingsReserve=money(Object.hasOwn(savingsOverrides,'gezamenlijk')?savingsOverrides.gezamenlijk:state.planning?.spaarpotDezeMaand);
  jointPlan.totalReserve=money(jointPlan.fixedReserve+jointPlan.budgetReserve+jointPlan.savingsReserve);
  const distributable=money(incomeBasis+joint.income-jointPlan.totalReserve);
  const ratioCosts=money(jointPlan.totalReserve-equalJointReserve-joint.income);
  dion.allowance=money(dion.income-equalJointReserve*.5-ratioCosts*ratioDion);dara.allowance=money(dara.income-equalJointReserve*.5-ratioCosts*ratioDara);
  ['dion','dara'].forEach(owner=>{const plan=allowanceOwners[owner];plan.automaticallyAvailableForSavings=money(owners[owner].allowance-plan.fixedReserve-plan.budgetReserve);plan.savingsReserve=Object.hasOwn(savingsOverrides,owner)?money(savingsOverrides[owner]):Math.max(0,plan.automaticallyAvailableForSavings);plan.totalReserve=money(plan.fixedReserve+plan.budgetReserve+plan.savingsReserve);});
  dion.available=money(dion.allowance-burden(dion));dara.available=money(dara.allowance-burden(dara));
  joint.availableBeforeAllowance=money(incomeBasis+joint.income-burden(joint));joint.available=money(joint.availableBeforeAllowance-dion.allowance-dara.allowance);
  const household={income:money(ACCOUNT_CONTEXTS.reduce((sum,owner)=>sum+owners[owner].income,0)),available:money(ACCOUNT_CONTEXTS.reduce((sum,owner)=>sum+owners[owner].income-burden(owners[owner]),0)),actualIncome:actualIncomeForMonth(state,month).amount,realExpense:sumTransactionEffects(state,'realExpense',{month}),savingsFunded:sumTransactionEffects(state,'savingsFunded',{month}),unusedSavings:sumTransactionEffects(state,'unusedSavings',{month}),refundCashflow:sumTransactionEffects(state,'refundCashflow',{month})};
  return {month,owners,household,ratioDion,ratioDara,distributable,allowanceBasis:{owners:allowanceOwners,distributable,income:money(incomeBasis+joint.income)},coverage:coverageAllocationStatus(state)};
}
