import { selectAccountBalance, balanceRequiredMonths, checkpointHistory } from './balance-checkpoints.mjs';
import { validCalendarDate } from '../import/import-identity.mjs';
import { decimalAmountToCents } from '../import/bank-input-contract.mjs';
import { selectDependencyProjections, budgetActual, financialForecastForMonth } from './transaction-engine.mjs';
import { resolveFixedExpensesForMonth, resolveIncomeSourcesForMonth, resolveVariableBudgetsForMonth, resolvePlannedIncomeForMonth, nextPlanningMonth } from './planning-timeline.mjs';
import { plannedOccurrences } from './recurring-occurrences.mjs';
import { salaryPerson, salarySourceId } from './salary-assignment.mjs';
import { sourceRecordKey, bankSourceForTransaction, bankSourceActive } from './bank-sources.mjs';
import { liquidityBuffer } from './liquidity-settings.mjs';

const owners = ['gezamenlijk','dion','dara'];
const cents = value => decimalAmountToCents(value);
const sum = values => values.reduce((a,b) => safe(a+b),0);
const safe = value => { if (!Number.isSafeInteger(value)) throw new Error('Prognosebedrag valt buiten het exacte centbereik.'); return value; };
export const shiftLiquidityDay = (date, offset) => {
  const parsed = new Date(date+'T12:00:00Z'); parsed.setUTCDate(parsed.getUTCDate()+offset); return parsed.toISOString().slice(0,10);
};
const monthEnd = month => shiftLiquidityDay(nextPlanningMonth(month)+'-01',-1);
const salaryDate = (month, day) => month+'-'+String(Math.min(day,Number(monthEnd(month).slice(8)))).padStart(2,'0');
const event = values => ({id:'',accountProfileId:null,date:null,amountCents:0,type:'other',status:'planned',dateQuality:'unknown',sourceId:null,occurrenceId:null,replacedBy:[],warnings:[],...values});
const issue = (code, eventId='', severity='incomplete') => ({code,eventId,severity});
export function liquidityReasonMessage(reason) {
  return ({
    'missing-checkpoint':'Er is nog geen bruikbaar saldo-ijkpunt voor deze rekening.',
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
    for (const [accountProfileId,sign] of [[source,-1],[target,1]]) result.push(event({id:'transfer:'+row.id+':'+(sign<0?'out':'in'),
      accountProfileId:resolved?accountProfileId:null,date,amountCents:sign*amount,type:'internal-transfer',transferId:row.id,
      dateQuality:date?'explicitly-planned':'unknown',month:row.month || date?.slice(0,7),horizonReceipt:sign>0,
      actualTransactionIds:[row.actualTransactionId,...(row.transactionIds || [])].filter(Boolean),
      warnings:resolved?[]:['unresolved-transfer-accounts']}));
  }
  return result;
}

/** Required periods are explicit. The caller can load these through the existing period session. */
export function liquidityRequiredMonths(state,{accountProfileId,asOfDate,endDate,scope}={}) {
  if (!validCalendarDate(asOfDate)) return [];
  const checkpoint = checkpointHistory(state,accountProfileId,scope).active.find(row => row.asOfDate <= asOfDate);
  const end = validCalendarDate(endDate) ? endDate : monthEnd(nextPlanningMonth(asOfDate.slice(0,7)));
  return balanceRequiredMonths(checkpoint && checkpoint.asOfDate < asOfDate ? checkpoint.asOfDate : asOfDate,end);
}

/** Adds physical cash timing to the existing financial selectors. Never persists or changes state. */
export function buildLiquidityInput(state,{accountProfileId,asOfDate,endDate,scope,imports=[],importsAvailable=true,coverage=[],monthlyForecast=financialForecastForMonth}={}) {
  if (!validCalendarDate(asOfDate) || endDate !== undefined && (!validCalendarDate(endDate) || endDate < asOfDate)) throw new Error('Kies geldige prognosedatums; de einddatum mag niet vóór de berekendatum liggen.');
  if (endDate && balanceRequiredMonths(asOfDate,endDate).length > 24) throw new Error('Kies een prognose van maximaal 24 kalendermaanden.');
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
      receipt=[...salaries,...transfers.filter(row=>profile?.accountOwner!=='gezamenlijk'&&row.amountCents>0&&row.date?.slice(0,7)===month)]
        .filter(row=>row.accountProfileId===accountProfileId&&row.date>asOfDate&&!row.replacedBy.length)
        .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0] || null;
    }
  }
  const horizonEnd=endDate || (receipt ? shiftLiquidityDay(receipt.date,-1) : null);
  const horizon={kind:endDate?'manual':'next-receipt',endDate:horizonEnd,receiptDate:receipt?.date || null,receiptId:receipt?.id || null,boundary:'end-of-previous-day'};
  if (!horizonEnd) reasons.push(issue('missing-reliable-horizon'));
  const requiredMonths=liquidityRequiredMonths(state,{accountProfileId,asOfDate,endDate:horizonEnd || asOfDate,scope});
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
    if (!relevant(row)) return;
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
    if (row.date && row.date>last) return;
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
  for (const month of balanceRequiredMonths(asOfDate,last)) {
    if (state.__finizePartialHistory&&!state.verifiedPeriods?.includes(month)) continue;
    for (const row of salaryPlans(state,month)) addPlan(row);
    try {
      for (const occurrence of plannedOccurrences(resolveFixedExpensesForMonth(state,month),month)) {
        const source=occurrence.source;
        const explicit=source.cashDates?.[occurrence.id];
        let date=validCalendarDate(explicit)?explicit:null;
        if (!date && validCalendarDate(source.afschrijfdatum)) {
          if (source.frequentieEenheid==='weken') date=source.afschrijfdatum===occurrence.date?occurrence.date:null;
          else date=salaryDate(month,Number(source.afschrijfdatum.slice(8)));
        }
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
      for(const owner of owners) if(physicalAccount(state,null,owner)===accountProfileId) savingsPlans.push({month,owner,amountCents:cents(forecast.allowanceBasis.owners[owner].savingsReserve)});
    } catch (error) { reasons.push({...issue('financial-planning-unavailable',month),message:error.message}); }
  }
  for (const row of transfers.filter(row=>!row.month || row.month>=asOfDate.slice(0,7)&&row.month<=last.slice(0,7))) addPlan(row);
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
    const covered=sum(events.filter(e=>e.status==='planned'&&e.date>asOfDate&&e.date<=horizon.endDate&&e.amountCents<0&&e.reservationId===row.id).map(e=>-e.amountCents));
    reservations.push({...row,coveredByConcreteCents:Math.min(row.amountCents,covered),amountCents:Math.max(0,row.amountCents-covered)});
  }
  const reserveCents=sum(reservations.map(row=>row.amountCents));
  const dated=events.filter(row=>['actual','provisional','planned'].includes(row.status)&&row.accountProfileId===input.accountProfileId&&row.date>asOfDate&&row.date<=horizon.endDate);
  const estimated=new Map();
  for(const row of reservations.filter(row=>row.type==='budget')) {
    const dates=[];for(let date=row.fromDate;date<=row.toDate;date=shiftLiquidityDay(date,1))dates.push(date);
    dates.forEach((date,index)=>estimated.set(date,safe((estimated.get(date)||0)+Math.floor(row.amountCents/dates.length)+(index<row.amountCents%dates.length?1:0))));
  }
  const days=[];
  if(opening.balanceCents!==null&&horizon.endDate) {
    let bank=opening.balanceCents,spent=0;
    for(let date=asOfDate;date<=horizon.endDate;date=shiftLiquidityDay(date,1)) {
      const rows=dated.filter(row=>row.date===date);
      bank=safe(bank+sum(rows.map(row=>row.amountCents)));spent=safe(spent+(estimated.get(date)||0));
      days.push({date,cashBalanceCents:bank,estimatedBudgetCents:estimated.get(date)||0,expectedBalanceCents:safe(bank-spent),
        afterReservationsCents:safe(bank-reserveCents),eventIds:rows.map(row=>row.id)});
    }
  }
  const min = field => days.reduce((best,row)=>!best||row[field]<best[field]?row:best,null);
  const expected=min('expectedBalanceCents'),conservative=min('afterReservationsCents');
  const distinct=[...new Map(reasons.map(row=>[row.code+':'+row.eventId,{...row,message:row.message || liquidityReasonMessage(row)}])).values()];
  const status=opening.balanceCents===null||!horizon.endDate?'unknown':distinct.some(row=>row.severity==='incomplete')?'incomplete':distinct.length?'provisional':'projected';
  const indicative=conservative?Math.max(0,safe(conservative.afterReservationsCents-bufferCents)):null;
  return {...input,events,reservations,reasons:distinct,status,days,reservedCents:reserveCents,
    savingsGoalCents:sum(input.savingsPlans.map(row=>row.amountCents)),
    minimumBalanceCents:expected?.expectedBalanceCents??null,minimumDate:expected?.date??null,
    minimumAfterReservationsCents:conservative?.afterReservationsCents??null,minimumAfterReservationsDate:conservative?.date??null,
    firstShortfallDate:days.find(row=>row.expectedBalanceCents<0)?.date??null,
    firstBufferBreachDate:days.find(row=>row.expectedBalanceCents<bufferCents)?.date??null,
    firstReservedBufferBreachDate:days.find(row=>row.afterReservationsCents<bufferCents)?.date??null,
    shortfallCents:expected?Math.max(0,-expected.expectedBalanceCents):null,
    reservedShortfallCents:conservative?Math.max(0,-conservative.afterReservationsCents):null,
    freeAfterObligationsCents:status==='projected'?indicative:null,indicativeFreeAfterObligationsCents:indicative,
    quality:{...opening.quality,forecast:status,budgetTiming:reservations.some(row=>row.type==='budget')?'estimated':'not-applicable'}};
}
export function selectDailyLiquidity(state, options) { return projectDailyLiquidity(buildLiquidityInput(state,options)); }
