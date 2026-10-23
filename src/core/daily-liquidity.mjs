import { selectAccountBalance, balanceRequiredMonths, checkpointHistory } from './balance-checkpoints.mjs';
import { providerBalanceHistory } from './provider-balances.mjs';
import { validCalendarDate } from '../import/import-identity.mjs';
import { decimalAmountToCents } from '../import/bank-input-contract.mjs';
import { selectDependencyProjections, budgetActual, financialForecastForMonth } from './transaction-engine.mjs';
import { resolveFixedExpensesForMonth, resolveIncomeSourcesForMonth, resolveVariableBudgetsForMonth, resolvePlannedIncomeForMonth, nextPlanningMonth } from './planning-timeline.mjs';
import { plannedOccurrences } from './recurring-occurrences.mjs';
import { salaryPerson, salarySourceId } from './salary-assignment.mjs';
import { sourceRecordKey, bankSourceForTransaction, bankSourceActive } from './bank-sources.mjs';
import { liquidityBuffer, monthlyPaymentDate, fixedCashDate } from './liquidity-settings.mjs';

const owners = ['gezamenlijk','dion','dara'];
const cents = value => decimalAmountToCents(value);
const sum = values => values.reduce((a,b) => safe(a+b),0);
const safe = value => { if (!Number.isSafeInteger(value)) throw new Error('Prognosebedrag valt buiten het exacte centbereik.'); return value; };
export const shiftLiquidityDay = (date, offset) => {
  const parsed = new Date(date+'T12:00:00Z'); parsed.setUTCDate(parsed.getUTCDate()+offset); return parsed.toISOString().slice(0,10);
};
const monthEnd = month => shiftLiquidityDay(nextPlanningMonth(month)+'-01',-1);
const salaryDate = monthlyPaymentDate;
const event = values => ({id:'',accountProfileId:null,date:null,amountCents:0,type:'other',status:'planned',dateQuality:'unknown',sourceId:null,occurrenceId:null,replacedBy:[],warnings:[],...values});
const issue = (code, eventId='', severity='incomplete') => ({code,eventId,severity});
export function liquidityReasonMessage(reason) {
  return ({
    'intraday-provider-balance':'Het beginsaldo is een geboekte bankstand op het vermelde tijdstip; de bankdag is nog niet afgesloten.',
    'provider-sync-incomplete':'De laatste banksynchronisatie is onvolledig. Eerdere gegevens blijven behouden.',
    'missing-checkpoint':'Er is nog geen bruikbaar saldo-ijkpunt voor deze rekening.',
    'missing-period-opening':'Een beginsaldo vóór deze periode ontbreekt. De saldolijn begint bij het eerste bruikbare saldo-ijkpunt; eerdere saldi worden niet verzonnen.',
    'planning-basis':'Deze saldolijn is berekend uit de planning en beschikbare bankboekingen; dit is geen door de bank bevestigd historisch saldo.',
    'possible-planning-overlap':'Een geboekte mutatie kan bij een geplande post horen. Bevestig de koppeling; de mogelijke tweede kasmutatie staat niet op de saldolijn.',
    'missing-period':'Een benodigde opslagmaand ontbreekt.',
    'missing-reliable-horizon':'Een betrouwbare volgende ontvangst ontbreekt. Kies een einddatum.',
    'unknown-bank-coverage':'Niet bevestigd dat alle bankmutaties sinds het ijkpunt aanwezig zijn.',
    'partial-bank-coverage':'De bankgegevens dekken slechts een deel van de periode.',
    'awaiting-review':'Geboekte bankmutaties bij Nakijken tellen voorlopig mee.',
    'unknown-cash-date':'Een kasdatum is onbekend of een gepland bedrag staat nog open na de betaaldag.',
    'unresolved-account-profile':'Een gebeurtenis heeft nog geen betrouwbare fysieke rekening.',
    'unresolved-budget-account':'Een budget heeft nog geen aangewezen fysieke betaalrekening.',
    'unconfirmed-transfer-plan':'Een overboeking mist een bevestigde datum of twee fysieke rekeningen en telt niet als kasbeweging.',
    'joint-primary-account-not-selected':'Kies de primaire gezamenlijke betaalrekening voor de planning en veiligheidsbuffer.',
    'replacement-bank-source-unusable':'Een expliciet gekoppelde betaling mist een bruikbare bankbron in deze periode.',
    'ambiguous-income-occurrence':'Een ontvangst is aan een bron gekoppeld, maar niet aan een bewezen betaalmoment. Extra geplande ontvangst blijft buiten de kaslijn.',
    'ambiguous-fixed-occurrence':'Een betaling heeft een vaste-lastlink zonder bewezen occurrence; de resterende verplichting is onzeker.',
    'ambiguous-allowance-occurrence':'Een geboekte overboeking kan bij het geplande zakgeld horen. Bevestig eerst de verwerking; de extra ontvangst blijft buiten de kaslijn.',
    'planning-dependencies-unavailable':'De financiële afhankelijkheidsgegevens zijn niet volledig beschikbaar.',
    'financial-planning-unavailable':'Een deel van de bestaande financiële planning kan niet betrouwbaar worden berekend.',
    'conflicting-event':'Dezelfde gebeurtenis bevat tegenstrijdige gegevens.',
    'duplicate-reservation':'Een reservering kwam meer dan eenmaal voor en is slechts eenmaal opgenomen.',
    'imports-unavailable':'Importdetails zijn niet beschikbaar voor broncontrole.'
  })[reason.code] || 'De bankbron of saldo-uitgangspositie is niet volledig controleerbaar ('+reason.code+').';
}

function physicalAccount(state, explicit, owner) {
  const profiles = state.accountProfiles || [];
  if (explicit && profiles.some(p => p.id === explicit)) return explicit;
  if (explicit && !owners.includes(explicit)) return null;
  const matches = profiles.filter(p => p.accountOwner === owner && p.status !== 'archived' && p.liquidity?.primaryForOwner);
  return matches.length === 1 ? matches[0].id : null;
}
function replacementKeys(p, state) {
  const keys = [];
  if (p.fixedOccurrenceId) keys.push('fixed:'+p.fixedOccurrenceId);
  if (p.incomeOccurrenceId) keys.push('income:'+p.incomeOccurrenceId);
  if (p.transactionType === 'salaris') {
    const person = salaryPerson(p.transaction,state);
    if (person) keys.push('salary:'+salarySourceId(person)+':'+p.calendarMonth);
  }
  return keys;
}
function salaryPlans(state, month) {
  return ['dion','dara'].map(person => {
    const amount = state.monthlyIncomeOverrides?.[month]?.[person] ?? resolvePlannedIncomeForMonth(state,month,person).salary;
    const profiles = (state.accountProfiles || []).filter(p => p.status !== 'archived' && p.liquidity?.salaryDays?.[person]);
    const profile = profiles.length === 1 ? profiles[0] : null;
    return event({id:'salary:'+salarySourceId(person)+':'+month,occurrenceId:salarySourceId(person)+':'+month,
      accountProfileId:profile?.id || null,date:profile ? salaryDate(month,profile.liquidity.salaryDays[person]) : null,
      amountCents:cents(amount),type:'salary',person,month,dateQuality:profile?'explicitly-planned':'unknown',horizonReceipt:true});
  }).filter(row => row.amountCents > 0);
}
function replacementIndex(projections,state) {
  const map = new Map();
  for (const p of projections) {
    const source=bankSourceForTransaction(state,p.transaction);
    // A retained, manually confirmed link remains evidence while the booked source
    // awaits review again. New recognition suggestions are never replacement proof.
    const retainedLink=p.transaction.approvalSource==='manual' && p.status==='goedgekeurd' && source && bankSourceActive(state,source);
    if ((!p.active&&!retainedLink) || !p.transaction.bankOriginal) continue;
    for (const key of replacementKeys(p,state)) {
      if (!map.has(key)) map.set(key,new Set());
      map.get(key).add(sourceRecordKey(p.transaction));
    }
  }
  return map;
}
function transferPlans(state) {
  const result=[];
  for (const row of state.internalTransfers || []) {
    if (!['gepland','planned','concept','nog-te-verwerken'].includes(row.status)) continue;
    const source = physicalAccount(state,row.sourceAccountProfileId || row.sourceAccount,null);
    const target = physicalAccount(state,row.targetAccountProfileId || row.targetAccount,null);
    const amount = cents(row.plannedAmount ?? row.calculatedAmount ?? row.amount ?? 0);
    if (amount <= 0) continue;
    // Owner labels alone never establish the two physical transfer endpoints.
    const resolved = source && target && source !== target;
    const date = validCalendarDate(row.plannedDate || row.date) ? row.plannedDate || row.date : null;
    const sourceProfile=(state.accountProfiles || []).find(p=>p.id===source),targetProfile=(state.accountProfiles || []).find(p=>p.id===target);
    const isSavingsPlan=['gezamenlijk-sparen','dion-sparen','dara-sparen','sparen','naar-spaarrekening'].includes(row.type) || !!(sourceProfile&&targetProfile?.accountType==='savings'&&sourceProfile.accountOwner===targetProfile.accountOwner);
    for (const [accountProfileId,sign] of [[source,-1],[target,1]]) result.push(event({id:'transfer:'+row.id+':'+(sign<0?'out':'in'),
      accountProfileId:resolved?accountProfileId:null,date,amountCents:sign*amount,type:'internal-transfer',transferId:row.id,isSavingsPlan,
      dateQuality:date?'explicitly-planned':'unknown',month:row.month || date?.slice(0,7),horizonReceipt:sign>0,
      actualTransactionIds:[row.actualTransactionId,...(row.transactionIds || [])].filter(Boolean),
      warnings:resolved?[]:['unresolved-transfer-accounts']}));
  }
  return result;
}

// Timing for the existing monthly allowance calculation, with one identity per side.
function allowancePlans(state,month,forecast,projections) {
  const result=[];
  for (const person of ['dion','dara']) {
    const profiles=(state.accountProfiles || []).filter(p=>p.status!=='archived'&&p.accountType==='payment'&&p.accountOwner===person&&p.liquidity?.allowanceDays?.[person]);
    if (!profiles.length) continue;
    const target=profiles.length===1?profiles[0]:null, joint=physicalAccount(state,null,'gezamenlijk');
    const amount=cents(forecast.owners[person].allowance);
    const date=target?monthlyPaymentDate(month,target.liquidity.allowanceDays[person]):null;
    const transferRows=(state.internalTransfers || []).filter(r=>r.month===month&&[ 'zakgeld-'+person,'zakgeld-'+person+'-terug'].includes(r.type)&&!['vervallen','cancelled'].includes(r.status));
    for (const [side,accountProfileId,amountCents] of [['out',joint,-amount],['in',target?.id,amount]]) {
      const actualIds=transferRows.flatMap(r=>[r.actualTransactionId,...(r.transactionIds || [])]).filter(Boolean);
      const replacedBy=projections.filter(p=>{
        const tx=p.transaction,source=bankSourceForTransaction(state,tx);
        const linked=p.active || tx.approvalSource==='manual'&&p.status==='goedgekeurd'&&source&&bankSourceActive(state,source);
        return linked&&tx.bankOriginal&&tx.accountProfileId===accountProfileId&&
          (actualIds.includes(tx.id)||actualIds.includes(tx.sourceTransactionId)||p.transactionType==='maandelijkse-bijdrage'&&p.financialFor===person&&p.calendarMonth===month)&&
          Math.sign(Number(tx.bankOriginal.amount))===Math.sign(amountCents);
      }).map(p=>sourceRecordKey(p.transaction));
      const ambiguous=!replacedBy.length&&projections.some(p=>p.transaction.bankOriginal&&p.transaction.accountProfileId===accountProfileId&&p.transactionType==='maandelijkse-bijdrage'&&p.financialFor===person&&p.calendarMonth===month&&Math.sign(Number(p.transaction.bankOriginal.amount))===Math.sign(amountCents));
      if(amountCents)result.push(event({id:`allowance:${person}:${month}:${side}`,transferId:`allowance:${person}:${month}`,accountProfileId:joint&&target?accountProfileId:null,
        date:ambiguous?null:date,amountCents,type:'allowance',person,month,dateQuality:!ambiguous&&date?'explicitly-planned':'unknown',replacedBy,warnings:ambiguous?['ambiguous-allowance-occurrence']:[]}));
    }
  }
  return result;
}

/** Required periods are explicit. The caller can load these through the existing period session. */
export function liquidityRequiredMonths(state,{accountProfileId,asOfDate,endDate,startDate,horizonLimitDate,scope}={}) {
  if (!validCalendarDate(asOfDate)) return [];
  const periodEnd=endDate || horizonLimitDate;
  const cutoff=periodEnd&&periodEnd<asOfDate?periodEnd:asOfDate;
  const checkpoint = startDate ? planningAnchor(state,{accountProfileId,asOfDate:cutoff,startDate,scope}) : checkpointHistory(state,accountProfileId,scope).active.find(row => row.asOfDate <= asOfDate);
  const end = validCalendarDate(periodEnd) ? periodEnd : monthEnd(nextPlanningMonth(asOfDate.slice(0,7)));
  return balanceRequiredMonths(startDate&&checkpoint?shiftLiquidityDay(checkpoint.asOfDate,1):checkpoint?.asOfDate || startDate || asOfDate,end);
}

/** Adds physical cash timing to the existing financial selectors. Never persists or changes state. */
export function buildLiquidityInput(state,{accountProfileId,asOfDate,endDate,scope,imports=[],importsAvailable=true,coverage=[],monthlyForecast=financialForecastForMonth,salaryOnly=false,planningBasis=false}={}) {
  if (!validCalendarDate(asOfDate) || endDate !== undefined && (!validCalendarDate(endDate) || endDate < asOfDate)) throw new Error('Kies geldige prognosedatums; de einddatum mag niet vóór de berekendatum liggen.');
  if (!planningBasis && endDate && balanceRequiredMonths(asOfDate,endDate).length > 24) throw new Error('Kies een prognose van maximaal 24 kalendermaanden.');
  const reasons=[],events=[],reservations=[],savingsPlans=[];
  const profile = (state.accountProfiles || []).find(p => p.id === accountProfileId);
  const opening = selectAccountBalance(state,{accountProfileId,toDate:asOfDate,scope,imports,importsAvailable,coverage});
  opening.reasons.forEach(row => reasons.push(issue(row.code,row.sourceId,opening.status==='incomplete'||opening.status==='unknown'?'incomplete':'provisional')));
  let projections=[];
  try { projections = selectDependencyProjections(state,{includeInactive:true}); }
  catch { reasons.push(issue('planning-dependencies-unavailable')); }
  const replaced = replacementIndex(projections,state);
  const transfers = transferPlans(state);
  const txById = new Map((state.transactions || []).map(tx => [tx.id,tx]));
  for (const transfer of transfers) transfer.replacedBy = [...new Set(transfer.actualTransactionIds.map(id=>txById.get(id)).filter(tx=>tx?.bankOriginal).map(sourceRecordKey))];
  let receipt=null;
  if (!endDate) {
    let month=asOfDate.slice(0,7);
    for (let i=0;i<13&&!receipt;i++,month=nextPlanningMonth(month)) {
      const salaries=salaryPlans(state,month).flatMap(row=>{
        if(!replaced.has(row.id))return [row];
        // Historical as-of projections may already contain a later real receipt.
        // Its proven bank date replaces the planned date as the horizon boundary.
        return projections.filter(p=>replaced.get(row.id).has(sourceRecordKey(p.transaction))&&p.transaction.accountProfileId===accountProfileId)
          .filter(p=>p.transaction.bankOriginal?.valid&&p.transaction.bankOriginal.currency==='EUR'&&(p.transaction.bankOriginal.bankStatus??'booked')==='booked'&&validCalendarDate(p.transaction.bankOriginal.bankDate))
          .map(p=>({...row,accountProfileId,date:p.transaction.bankOriginal.bankDate,dateQuality:'confirmed'}));
      });
      receipt=[...salaries,...transfers.filter(row=>!salaryOnly&&profile?.accountOwner!=='gezamenlijk'&&row.amountCents>0&&row.date?.slice(0,7)===month&&!(state.internalTransfers || []).some(t=>t.id===row.transferId&&t.type?.startsWith('zakgeld-')&&profile?.liquidity?.allowanceDays?.[profile.accountOwner]))]
        .filter(row=>row.accountProfileId===accountProfileId&&row.date>asOfDate&&!row.replacedBy.length)
        .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0] || null;
    }
  }
  const allowanceDay=!salaryOnly&&profile?.accountOwner!=='gezamenlijk'&&profile?.liquidity?.allowanceDays?.[profile.accountOwner];
  const allowanceWindow=allowanceDay ? monthEnd(monthlyPaymentDate(asOfDate.slice(0,7),allowanceDay)>asOfDate?asOfDate.slice(0,7):nextPlanningMonth(asOfDate.slice(0,7))) : null;
  const horizonEnd=endDate || (receipt ? shiftLiquidityDay(receipt.date,-1) : allowanceWindow);
  const horizon={kind:endDate?'manual':receipt?'next-receipt':allowanceWindow?'allowance-window':'next-receipt',endDate:horizonEnd,receiptDate:receipt?.date || null,receiptId:receipt?.id || null,boundary:!receipt?'end-of-day':'end-of-previous-day'};
  if (!horizonEnd) reasons.push(issue('missing-reliable-horizon'));
  const requiredMonths=liquidityRequiredMonths(state,{accountProfileId,asOfDate,endDate:horizonEnd || asOfDate,scope}).filter(month=>!planningBasis||month>=shiftLiquidityDay(asOfDate,1).slice(0,7));
  for (const month of requiredMonths) if(state.__finizePartialHistory&&!state.verifiedPeriods?.includes(month)) reasons.push(issue('missing-period',month));
  const last=horizonEnd || asOfDate;
  // Keep the starting checkpoint fixed even if a later observation is present.
  const future=selectAccountBalance(state,{accountProfileId,toDate:last,scope,imports,importsAvailable,coverage,checkpointId:opening.checkpoint?.id});
  future.reasons.filter(row=>!['unknown-bank-coverage','partial-bank-coverage'].includes(row.code)).forEach(row=>reasons.push(issue(row.code,row.sourceId,row.code==='awaiting-review'?'provisional':'incomplete')));
  for (const row of future.mutations.filter(row=>row.date>asOfDate)) {
    const linked=projections.filter(p=>sourceRecordKey(p.transaction)===row.sourceId);
    events.push(event({id:'bank:'+row.sourceId,accountProfileId,date:row.date,amountCents:row.amountCents,type:'bank',status:row.status==='confirmed'?'actual':'provisional',dateQuality:'confirmed',sourceId:row.sourceId,
      financialTypes:[...new Set(linked.map(p=>p.transactionType))],replaces:[...new Set(linked.filter(p=>p.active).flatMap(p=>replacementKeys(p,state)))]}));
  }
  const relevant = row => row.accountProfileId===accountProfileId || !row.accountProfileId;
  const addPlan = row => {
    row.replacedBy=[...new Set([...row.replacedBy,...(replaced.get(row.id)||[])])];
    row.replacedBy=row.replacedBy.filter(key=>projections.some(p=>sourceRecordKey(p.transaction)===key&&p.transaction.accountProfileId===row.accountProfileId&&Math.sign(Number(p.transaction.bankOriginal?.amount))===Math.sign(row.amountCents)));
    if (!relevant(row)) return;
    if(row.warnings.includes('ambiguous-allowance-occurrence')) reasons.push(issue('ambiguous-allowance-occurrence',row.id));
    if (row.type==='fixed' && projections.some(p=>p.active&&p.fixedExpenseId===row.planningSourceId&&!p.fixedOccurrenceId)) reasons.push(issue('ambiguous-fixed-occurrence',row.id));
    if (row.type==='income' && projections.some(p=>p.active&&p.incomeSourceId===row.planningSourceId&&!p.incomeOccurrenceId&&p.effects.incomeImpact>0&&p.calendarMonth===row.month)) {
      row.date=null;row.dateQuality='unknown';row.warnings.push('ambiguous-income-occurrence');reasons.push(issue('ambiguous-income-occurrence',row.id));
    }
    if (row.replacedBy.length) {
      row.status='replaced';events.push(row);
      // A replacement outside P1's usable sources must remain visible as uncertainty.
      for (const sourceId of row.replacedBy) {
        const p=projections.find(p=>sourceRecordKey(p.transaction)===sourceId);
        const bankDate=p?.transaction.bankOriginal?.bankDate;
        const bank=p?.transaction.bankOriginal;
        if (!bank?.valid || bank.currency!=='EUR' || (bank.bankStatus??'booked')!=='booked' || !validCalendarDate(bankDate) || bankDate>asOfDate && bankDate<=last && !future.mutations.some(m=>m.sourceId===sourceId)) reasons.push(issue('replacement-bank-source-unusable',row.id));
      }
      return;
    }
    const overlap=projections.some(p=>{
      const tx=p.transaction,b=tx.bankOriginal;
      if(!b?.valid||b.currency!=='EUR'||(b.bankStatus??'booked')!=='booked'||tx.accountProfileId!==row.accountProfileId||!validCalendarDate(b.bankDate)||Math.sign(Number(b.amount))!==Math.sign(row.amountCents))return false;
      return replacementKeys(p,state).includes(row.id)||row.type==='fixed'&&p.fixedExpenseId===row.planningSourceId&&p.calendarMonth===row.month;
    });
    if(overlap){row.plannedDate=row.date;row.date=null;row.dateQuality='unknown';row.warnings.push('possible-planning-overlap');reasons.push(issue('possible-planning-overlap',row.id));}
    if (row.date && row.date>last) return;
    if(planningBasis&&row.date&&row.date<=asOfDate)return;
    if (row.type==='internal-transfer' && (!row.accountProfileId || !row.date)) {
      row.status='unresolved';row.warnings.push('unconfirmed-transfer-plan');events.push(row);
      reasons.push(issue('unconfirmed-transfer-plan',row.id));return;
    }
    if (!row.accountProfileId) { row.warnings.push('unresolved-account-profile'); reasons.push(issue('unresolved-account-profile',row.id)); }
    if (row.date && row.date<=asOfDate) { row.warnings.push('overdue-unmatched-plan'); row.plannedDate=row.date;row.date=null; }
    if (!row.date) {
      row.warnings.push('unknown-cash-date');reasons.push(issue('unknown-cash-date',row.id,row.amountCents>0?'provisional':'incomplete'));
      // Positive undated income never increases spending capacity. Debits remain reserved.
      if (row.amountCents<0) { row.status='reservation';reservations.push({...row,id:'undated:'+row.id,amountCents:-row.amountCents,type:'undated-obligation'}); }
    }
    events.push(row);
  };
  for (const month of balanceRequiredMonths(planningBasis?shiftLiquidityDay(asOfDate,1):asOfDate,last)) {
    if (state.__finizePartialHistory&&!state.verifiedPeriods?.includes(month)) continue;
    for (const row of salaryPlans(state,month)) addPlan(row);
    try {
      for (const occurrence of plannedOccurrences(resolveFixedExpensesForMonth(state,month),month)) {
        const source=occurrence.source;
        const cashDate=fixedCashDate(occurrence);
        const date=validCalendarDate(cashDate)?cashDate:null;
        addPlan(event({id:'fixed:'+occurrence.id,occurrenceId:occurrence.id,planningSourceId:source.id,month,accountProfileId:physicalAccount(state,source.accountProfileId || occurrence.account,occurrence.account),
          amountCents:-cents(occurrence.amount),date,type:'fixed',dateQuality:date?'explicitly-planned':'unknown'}));
      }
      for (const occurrence of plannedOccurrences(resolveIncomeSourcesForMonth(state,month).filter(row=>row.legacyKind!=='salary'),month)) {
        const source=occurrence.source, explicit=source.cashDates?.[occurrence.id] || source.paymentDate;
        const date=validCalendarDate(explicit)?explicit:source.planningProvenance==='versioned-properties'?occurrence.date:null;
        addPlan(event({id:'income:'+occurrence.id,occurrenceId:occurrence.id,planningSourceId:source.id,month,date,type:'income',dateQuality:date?'explicitly-planned':'unknown',amountCents:cents(occurrence.amount),
          accountProfileId:physicalAccount(state,source.accountProfileId || occurrence.account,occurrence.account)}));
      }
      // Read the existing financial meaning, including historical budget/refund/savings contracts.
      // Future bank rows after the horizon must not consume this horizon's budget reservation.
      const budgetState={...state,__finizePartialHistory:false,transactions:(state.transactions || []).filter(tx=>String(tx.bankOriginal?.bankDate || tx.date || '')<=last)};
      for (const owner of owners) for (const budget of resolveVariableBudgetsForMonth(state,month,owner)) {
        const account=physicalAccount(state,budget.accountProfileId,owner);
        if (account && account!==accountProfileId) continue;
        const plannedCents=cents(Number(budget.bedrag || 0));
        const usedCents=cents(budgetActual(budgetState,month,owner,budget.post || budget.categorie,budget.id));
        const amountCents=Math.max(0,safe(plannedCents-usedCents));
        if (!amountCents) continue;
        const id='budget:'+owner+':'+month+':'+budget.id;
        if (!account) reasons.push(issue('unresolved-budget-account',id));
        reservations.push({id,accountProfileId:account,type:'budget',month,budgetItemId:budget.id,owner,plannedCents,usedCents,amountCents,
          fromDate:month===asOfDate.slice(0,7)?shiftLiquidityDay(asOfDate,1):month+'-01',toDate:last<monthEnd(month)?last:monthEnd(month),dateQuality:'estimated'});
      }
      const forecast=monthlyForecast(state.__finizePartialHistory?{...state,__finizePartialHistory:false}:state,month);
      for(const row of allowancePlans(state,month,forecast,projections)) addPlan(row);
      for(const owner of owners) if(physicalAccount(state,null,owner)===accountProfileId) {
        const realizedCents=sum(projections.filter(p=>p.active&&p.financialFor===owner&&p.calendarMonth===month&&String(p.transaction.bankOriginal?.bankDate || p.transaction.transactionDate || p.transaction.date || '')<=last).map(p=>safe(cents(p.effects.savingsDeposit || 0)-cents(p.effects.savingsWithdrawal || 0))));
        savingsPlans.push({month,owner,amountCents:cents(forecast.allowanceBasis.owners[owner].savingsReserve),realizedCents,monthlyRoomCents:cents(forecast.owners[owner].available)});
      }
    } catch (error) { reasons.push({...issue('financial-planning-unavailable',month),message:error.message}); }
  }
  for (const row of transfers.filter(row=>!row.month || row.month>=asOfDate.slice(0,7)&&row.month<=last.slice(0,7))) {
    const source=(state.internalTransfers || []).find(r=>r.id===row.transferId);
    if(events.some(e=>e.type==='allowance'&&e.month===source?.month&&['zakgeld-'+e.person,'zakgeld-'+e.person+'-terug'].includes(source?.type)))continue;
    addPlan(row);
  }
  if (profile?.accountOwner==='gezamenlijk'&&!physicalAccount(state,null,'gezamenlijk')) reasons.push(issue('joint-primary-account-not-selected'));
  return {accountProfileId,asOfDate,opening,horizon,events,reservations,savingsPlans,bufferCents:liquidityBuffer(profile),requiredMonths,reasons};
}

/** Pure cent arithmetic. Reservations have one identity and one deduction, with a separate estimated day distribution. */
export function projectDailyLiquidity(input) {
  const {opening,horizon,asOfDate,bufferCents}=input;
  const reasons=[...input.reasons],events=[],seen=new Map();
  for(const row of input.events) {
    if(!row.id || !Number.isSafeInteger(row.amountCents) || row.date && !validCalendarDate(row.date)) throw new Error('Een prognosegebeurtenis mist een geldig ID, kasdatum of exact centbedrag.');
    if(seen.has(row.id)) { if(JSON.stringify(seen.get(row.id))!==JSON.stringify(row)) reasons.push(issue('conflicting-event',row.id)); continue; }
    seen.set(row.id,row);events.push(row);
  }
  const reservations=[],reservationIds=new Set();
  for(const row of input.reservations) {
    if(!row.id || !Number.isSafeInteger(row.amountCents) || row.amountCents<0) throw new Error('Een prognosereservering mist een geldig ID of niet-negatief centbedrag.');
    if(reservationIds.has(row.id)) {reasons.push(issue('duplicate-reservation',row.id));continue;}
    reservationIds.add(row.id);
    const covered=sum(events.filter(e=>e.status==='planned'&&(e.date>asOfDate||e.date===asOfDate&&opening.boundary==='timestamp')&&e.date<=horizon.endDate&&e.amountCents<0&&e.reservationId===row.id).map(e=>-e.amountCents));
    reservations.push({...row,coveredByConcreteCents:Math.min(row.amountCents,covered),amountCents:Math.max(0,row.amountCents-covered)});
  }
  const reserveCents=sum(reservations.filter(row=>row.reserveForDisplay!==false).map(row=>row.amountCents));
  const dated=events.filter(row=>['actual','provisional','planned'].includes(row.status)&&row.accountProfileId===input.accountProfileId&&(row.date>asOfDate||row.date===asOfDate&&row.status==='planned'&&opening.boundary==='timestamp')&&row.date<=horizon.endDate);
  const estimated=new Map(),allocations=new Map();
  const distribute=(row,fromDate=row.fromDate)=>{
    const previous=allocations.get(row.id) || new Map();
    for(const [date,amount] of previous)if(date>=fromDate){estimated.set(date,safe((estimated.get(date)||0)-amount));previous.delete(date);}
    const dates=[];for(let date=fromDate;date<=row.toDate;date=shiftLiquidityDay(date,1))dates.push(date);
    dates.forEach((date,index)=>{const amount=Math.floor(row.amountCents/dates.length)+(index<row.amountCents%dates.length?1:0);previous.set(date,amount);estimated.set(date,safe((estimated.get(date)||0)+amount));});
    allocations.set(row.id,previous);
  };
  for(const row of reservations.filter(row=>row.type==='budget'))distribute(row);
  const observations=new Map((input.observations || []).map(row=>[row.asOfDate,row]));
  const days=[];
  if(opening.balanceCents!==null&&horizon.endDate) {
    let bank=opening.balanceCents,spent=0,earlierEstimated=0,lastObservationMonth=null;
    for(let date=asOfDate;date<=horizon.endDate;date=shiftLiquidityDay(date,1)) {
      const rows=dated.filter(row=>row.date===date);
      const openingBalanceCents=safe(bank-spent);
      let mutationCents=safe(sum(rows.map(row=>row.amountCents))-(estimated.get(date)||0));
      bank=safe(bank+sum(rows.map(row=>row.amountCents)));spent=safe(spent+(estimated.get(date)||0));
      if(input.displayStartDate&&date<input.displayStartDate.slice(0,7)+'-01')earlierEstimated=safe(earlierEstimated+(estimated.get(date)||0));
      const observation=observations.get(date);
      if(observation){
        // A timestamp observation is not an end-of-day observation: retain today's
        // still-planned cash events rather than swallowing them into the bank stand.
        const remainingPlans=observation.boundary==='timestamp'?sum(rows.filter(row=>row.status==='planned').map(row=>row.amountCents)):0;
        const modeledCents=safe(bank-spent-remainingPlans),amountCents=safe(observation.amountCents-modeledCents);
        const adjustment=event({id:'checkpoint:'+observation.id,accountProfileId:input.accountProfileId,date,amountCents,type:'checkpoint',status:'observed',dateQuality:'confirmed',observedBalanceCents:observation.amountCents,modeledBalanceCents:modeledCents});
        events.push(adjustment);rows.push(adjustment);mutationCents=safe(mutationCents+amountCents);
        bank=safe(observation.amountCents+remainingPlans);spent=0;earlierEstimated=0;lastObservationMonth=date.slice(0,7);
        // An observation confirms cash, not budget spending. Reuse the existing
        // unspent budget reservation after this end-of-day anchor.
        for(const row of reservations.filter(row=>row.type==='budget'&&row.fromDate<=date&&row.toDate>date))distribute(row,shiftLiquidityDay(date,1));
      }
      if(input.displayStartDate&&date<input.displayStartDate)continue;
      days.push({date,openingBalanceCents,mutationCents,cashBalanceCents:bank,estimatedBudgetCents:estimated.get(date)||0,expectedBalanceCents:safe(bank-spent),
        afterReservationsCents:safe(bank-earlierEstimated-sum(reservations.filter(row=>row.reserveForDisplay!==false&&(!lastObservationMonth||row.type!=='budget'||row.month>=lastObservationMonth)).map(row=>row.amountCents))),eventIds:rows.map(row=>row.id)});
    }
  }
  const availabilityFromDate=input.availabilityFromDate || asOfDate;
  const availabilityDays=days.filter(row=>row.date>=availabilityFromDate);
  const min = (field,rows=days) => rows.reduce((best,row)=>!best||row[field]<best[field]?row:best,null);
  const expected=min('expectedBalanceCents'),conservative=min('afterReservationsCents',availabilityDays);
  const distinct=[...new Map(reasons.map(row=>[row.code+':'+row.eventId,{...row,message:row.message || liquidityReasonMessage(row)}])).values()];
  const status=opening.balanceCents===null||!horizon.endDate?'unknown':distinct.some(row=>row.severity==='incomplete')?'incomplete':distinct.length?'provisional':'projected';
  const indicative=conservative?Math.max(0,safe(conservative.afterReservationsCents-bufferCents)):null;
  return {...input,events,reservations,reasons:distinct,status,days,reservedCents:reserveCents,
    availability:{fromDate:availabilityFromDate,toDate:horizon.endDate,minimumCents:conservative?.afterReservationsCents??null,minimumDate:conservative?.date??null,status},
    savingsGoalCents:sum(input.savingsPlans.map(row=>row.amountCents)),
    minimumBalanceCents:expected?.expectedBalanceCents??null,minimumDate:expected?.date??null,
    minimumAfterReservationsCents:conservative?.afterReservationsCents??null,minimumAfterReservationsDate:conservative?.date??null,
    firstShortfallDate:days.find(row=>row.expectedBalanceCents<0)?.date??null,
    firstBufferBreachDate:days.find(row=>row.expectedBalanceCents<bufferCents)?.date??null,
    firstReservedBufferBreachDate:availabilityDays.find(row=>row.afterReservationsCents<bufferCents)?.date??null,
    shortfallCents:expected?Math.max(0,-expected.expectedBalanceCents):null,
    reservedShortfallCents:conservative?Math.max(0,-conservative.afterReservationsCents):null,
    freeAfterObligationsCents:status==='projected'?indicative:null,indicativeFreeAfterObligationsCents:indicative,
    quality:{...opening.quality,forecast:status,budgetTiming:reservations.some(row=>row.type==='budget')?'estimated':'not-applicable'}};
}

/** Goal context comes from the existing month motor; cash capacity comes from P2,
 * never from subtracting a goal from the minimum spending-capacity value. */
export function savingsGuidance(projection, spendingLimitCents=projection.indicativeFreeAfterObligationsCents) {
  const from=projection.availability.fromDate,end=projection.horizon.endDate;
  const plans=projection.savingsPlans.filter(row=>row.month>=from.slice(0,7));
  const goalCents=sum(plans.map(row=>row.amountCents));
  const remainingGoalCents=sum(plans.map(row=>Math.max(0,safe(row.amountCents-(row.realizedCents || 0)))));
  const base={goalCents,remainingGoalCents,status:goalCents>0?'unknown':'none',headroomCents:null,expectedSavingsCapacityCents:null,warning:false,shortfallCents:null,assessmentEndDate:end};
  if(!goalCents)return base;
  if(projection.availability.status!=='projected'||!end||end!==monthEnd(end.slice(0,7))||!plans.length)return base;
  let cumulative=0,headroom=null,capacity=null;
  for(const plan of plans){
    const day=projection.days.find(row=>row.date===monthEnd(plan.month));if(!day)return base;
    cumulative=safe(cumulative+Math.max(0,safe(plan.amountCents-(plan.realizedCents || 0))));
    const room=safe(day.afterReservationsCents-projection.bufferCents),surplus=safe(room-cumulative);
    if(headroom===null||surplus<headroom){headroom=surplus;capacity=Math.max(0,room);}
  }
  const hard=spendingLimitCents;
  return {...base,status:'known',headroomCents:Math.max(0,Math.min(hard,headroom)),expectedSavingsCapacityCents:capacity,
    warning:remainingGoalCents>0&&(headroom<0||headroom<hard),shortfallCents:Math.max(0,-headroom)};
}
function hardAvailability(projection,input,fromDate) {
  const softIds=new Set(input.events.filter(row=>row.isSavingsPlan&&row.status!=='replaced').map(row=>row.id));
  const currentAnchor=projection.currentBalance?.checkpoint || projection.opening.checkpoint;
  const hardReasons=input.reasons.filter(row=>row.code!=='missing-period-opening'&&
    !(row.code==='missing-period'&&row.eventId<fromDate.slice(0,7)&&currentAnchor?.asOfDate>=fromDate.slice(0,7)+'-01')&&
    (!softIds.has(row.eventId)||!['unknown-cash-date','unconfirmed-transfer-plan','unresolved-account-profile'].includes(row.code)));
  const hard=softIds.size||hardReasons.length!==input.reasons.length?projectDailyLiquidity({...input,availabilityFromDate:fromDate,
    events:input.events.filter(row=>!softIds.has(row.id)),
    reservations:input.reservations.filter(row=>!softIds.has(row.id.replace(/^undated:/,''))),
    reasons:hardReasons}):projection;
  return {hard,softIds};
}
function withAvailability(projection,input,fromDate,goalInputFor) {
  const {hard,softIds}=hardAvailability(projection,input,fromDate);
  let goalProjection=hard;
  const end=hard.horizon.endDate;
  // A monthly goal needs its month-end cash outlook, even when the graph and
  // hard spending limit cover only seven days. Reuse P2 with the same inputs.
  if(end&&end!==monthEnd(end.slice(0,7))&&hard.savingsPlans.some(row=>row.amountCents>0)&&goalInputFor){
    const goalInput=goalInputFor(monthEnd(end.slice(0,7)));
    goalProjection=hardAvailability({...projectDailyLiquidity(goalInput),currentBalance:projection.currentBalance},goalInput,fromDate).hard;
  }
  const guidance=savingsGuidance(goalProjection,hard.indicativeFreeAfterObligationsCents);
  return {...projection,freeAfterObligationsCents:hard.freeAfterObligationsCents,indicativeFreeAfterObligationsCents:hard.indicativeFreeAfterObligationsCents,
    availability:{...hard.availability,excludedSavingsPlanIds:[...softIds]},softSavings:guidance};
}
function liquidityObservations(state,accountProfileId,toDate,scope) {
  const rows=new Map(checkpointHistory(state,accountProfileId,scope).active.filter(row=>row.asOfDate<=toDate).map(row=>[row.asOfDate,row]));
  for(const row of providerBalanceHistory(state,accountProfileId,toDate,scope))rows.set(row.asOfDate,row);
  return [...rows.values()].sort((a,b)=>b.asOfDate.localeCompare(a.asOfDate));
}
function planningAnchor(state,{accountProfileId,asOfDate,startDate,scope}) {
  const history=liquidityObservations(state,accountProfileId,asOfDate,scope);
  return history.find(row=>row.asOfDate<startDate) || history.filter(row=>row.asOfDate>=startDate&&row.asOfDate<=asOfDate).at(-1) || null;
}
export function selectDailyLiquidity(state, options) {
  if(!options.startDate){const input=buildLiquidityInput(state,options);return withAvailability(projectDailyLiquidity(input),input,options.asOfDate,endDate=>buildLiquidityInput(state,{...options,endDate,salaryOnly:false}));}
  const {startDate,asOfDate}=options;
  if(!validCalendarDate(startDate)||!validCalendarDate(asOfDate)||options.endDate!==undefined&&(!validCalendarDate(options.endDate)||options.endDate<startDate))throw new Error('Kies een geldige begin- en einddatum voor de prognose.');
  if(options.horizonLimitDate!==undefined&&(!validCalendarDate(options.horizonLimitDate)||options.horizonLimitDate<startDate))throw new Error('Kies een geldige maandgrens voor de prognose.');
  if(balanceRequiredMonths(startDate,options.endDate || asOfDate).length>24)throw new Error('Kies een prognose van maximaal 24 kalendermaanden.');
  // Observation cutoff and visible calendar range are separate: future months
  // roll forward from known cash; historical months never borrow later anchors.
  const periodEnd=options.endDate || options.horizonLimitDate;
  const referenceCutoff=periodEnd&&periodEnd<asOfDate?periodEnd:asOfDate;
  const horizon={...buildLiquidityInput(state,{...options,asOfDate:options.horizonReferenceDate || referenceCutoff}).horizon};
  if(options.horizonLimitDate&&horizon.endDate>options.horizonLimitDate){horizon.endDate=options.horizonLimitDate;horizon.kind='month-limit';horizon.boundary='end-of-day';}
  const cutoff=horizon.endDate&&horizon.endDate<referenceCutoff?horizon.endDate:referenceCutoff;
  const current=buildLiquidityInput(state,{...options,asOfDate:cutoff,endDate:cutoff,salaryOnly:false});
  const anchor=planningAnchor(state,{...options,asOfDate:cutoff});
  const availabilityFromDate=asOfDate>=startDate&&asOfDate<=horizon.endDate?asOfDate:startDate;
  const origin=anchor?.asOfDate || shiftLiquidityDay(startDate,-1);
  const inputFor=endDate=>{
  const input=buildLiquidityInput(state,{...options,asOfDate:origin,endDate,salaryOnly:false,planningBasis:true});
  input.displayStartDate=startDate;input.availabilityFromDate=availabilityFromDate;
  input.observations=liquidityObservations(state,options.accountProfileId,cutoff,options.scope).filter(row=>row.asOfDate>origin&&row.asOfDate<=endDate);
  for(const row of current.opening.reasons)input.reasons.push(issue(row.code,row.sourceId,current.opening.status==='incomplete'||current.opening.status==='unknown'?'incomplete':'provisional'));
  if(!anchor||origin>=startDate)input.reasons.push(issue('missing-period-opening'));
  input.reservations=input.reservations.map(row=>({...row,reserveForDisplay:row.type!=='budget'||row.month>=startDate.slice(0,7)}));
  input.savingsPlans=input.savingsPlans.filter(row=>row.month>=startDate.slice(0,7));
  return input;
  };
  const input=inputFor(horizon.endDate || options.horizonLimitDate || (startDate>cutoff?startDate:cutoff));
  input.horizon=horizon;
  if(!horizon.endDate)input.reasons.push(issue('missing-reliable-horizon'));
  const result=projectDailyLiquidity(input);
  for(const row of result.events.filter(row=>row.type==='bank'))row.replacedPlans=result.events.filter(plan=>plan.status==='replaced'&&plan.replacedBy.includes(row.sourceId)).map(plan=>({id:plan.id,type:plan.type,amountCents:plan.amountCents,date:plan.date,planningSourceId:plan.planningSourceId,person:plan.person}));
  if(origin>=startDate&&result.days[0]?.date===origin)result.days[0]={...result.days[0],openingBalanceCents:null,checkpointId:anchor.id};
  const reconciliations=result.events.filter(row=>row.type==='checkpoint'&&row.date>=startDate&&row.date<=horizon.endDate).map(row=>{
    return {checkpointId:row.id.slice('checkpoint:'.length),date:row.date,observedCents:row.observedBalanceCents,modeledCents:row.modeledBalanceCents,differenceCents:row.amountCents};
  });
  return withAvailability({...result,asOfDate,calculationStartDate:origin,currentBalance:current.opening,displayStartDate:startDate,historyComplete:!!anchor&&origin<startDate,reconciliations},input,availabilityFromDate,inputFor);
}
