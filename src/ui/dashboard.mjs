// P3 is presentation only. P2 owns every liquidity amount and event.
import {shiftLiquidityDay} from '../core/daily-liquidity.mjs';
import {explainLiquidityReasons} from './liquidity-explanations.mjs';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = cents => Number.isSafeInteger(cents) ? new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100) : '—';
const date = value => value ? new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')) : 'Datum onbekend';
const status = value => ({projected:'Prognose',confirmed:'Bevestigd',provisional:'Voorlopig',incomplete:'Onvolledig',unknown:'Onbekend',actual:'Werkelijk',planned:'Gepland'}[value] || 'Onbekend');
// Derived presentation shares; the two amounts are always supplied by V117.
export function allowanceShare(amount,distribution){
  const total=distribution.reduce((sum,value)=>sum+value,0);
  return total>0&&distribution.every(value=>value>=0)?amount/total*100:null;
}
export function forecastPeriod(p){
  if(!p?.horizon?.endDate)return `Prognoseperiode onbekend${p?` · ${status(p.status)}`:''}`;
  const dated=value=>new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  const start=p.displayStartDate || p.asOfDate;
  const from=start.slice(0,4)===p.horizon.endDate.slice(0,4)?date(start):dated(start);
  return `${from} – ${dated(p.horizon.endDate)} · ${p.horizon.kind==='allowance-window'?'Zakgeldprognose tot einde maand':['manual','month-limit'].includes(p.horizon.kind)?'Einddatum inbegrepen':p.horizon.boundary==='end-of-day'?'Tot volgend salaris · Einddatum inbegrepen':'Tot vóór volgend salaris'}`;
}
export function pointMeaning(events,isMinimum){
  const income=events.some(e=>e.amountCents>0),expense=events.some(e=>e.amountCents<0);
  return {income,expense,isMinimum,label:[isMinimum?'Laagste prognose':'',income?'Inkomst':'',expense?'Uitgave':'',!income&&!expense?'Saldopunt zonder concrete betaling':''].filter(Boolean).join(' · ')};
}
export function horizonEnd(filter,today,custom){
  if(filter==='salary')return undefined;
  if(filter==='7'||filter==='14')return shiftLiquidityDay(today,Number(filter)-1);
  if(filter==='month'){const d=new Date(today+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,0);return d.toISOString().slice(0,10);}
  return custom || undefined;
}
export const horizonStart=(filter,today)=>filter==='month'?today.slice(0,7)+'-01':today;
export function dashboardPeriod({month,today,filter='month',custom=''}){
  const first=month+'-01',last=horizonEnd('month',first);
  const anchor=today.slice(0,7)===month?today:first;
  const startDate=filter==='month'?first:anchor;
  if(filter==='custom'&&(!/^\d{4}-\d{2}-\d{2}$/.test(custom)||custom<startDate||custom>last||new Date(custom+'T12:00:00Z').toISOString().slice(0,10)!==custom))throw new Error('Kies een einddatum binnen de geselecteerde maand, vanaf '+date(startDate)+'.');
  const endDate=filter==='salary'?undefined:filter==='month'?last:filter==='custom'?custom:[horizonEnd(filter,anchor),last].sort()[0];
  return {startDate,endDate,currentCashBasis:true,salaryOnly:false,incomeOnly:filter==='salary',includeReceipt:filter==='salary',horizonReferenceDate:anchor,horizonLimitDate:filter==='salary'?undefined:last,minDate:anchor,maxDate:last};
}
// Unknown calendar days belong on the axis, but never become zero balances.
export function chartDays(p){
  if(!p?.horizon?.endDate)return [];
  const known=new Map(p.days.map(day=>[day.date,day])),days=[];
  for(let day=p.displayStartDate || p.asOfDate;day<=p.horizon.endDate;day=shiftLiquidityDay(day,1))days.push(known.get(day)||{date:day,openingBalanceCents:null,expectedBalanceCents:null,mutationCents:null,eventIds:[]});
  return days;
}
export function chartSegments(days,today){const index=days.findIndex(d=>d.date>=today);return {past:days.filter(d=>d.date<today),future:index<0?[]:days.slice(index)};}
export function primaryAccount(profiles,owner){
  const matches=profiles.filter(p=>p.status!=='archived'&&p.accountOwner===owner&&p.accountType==='payment'&&p.liquidity?.primaryForOwner);
  return matches.length===1?matches[0]:null;
}
// This list shows upcoming recurring plans; bank history stays in the chart.
function chartPaymentEvents(p){return (p?.events||[]).filter(e=>e.accountProfileId===p.accountProfileId&&['actual','provisional','planned'].includes(e.status)&&(p.displayStartDate?e.date>=p.displayStartDate:e.date>p.asOfDate)&&e.date<=p.horizon.endDate).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
export function paymentEvents(p){return chartPaymentEvents(p).filter(e=>e.status==='planned'&&['fixed','income','salary','allowance'].includes(e.type)&&e.date>p.asOfDate);}
export function liquidityView(p){return {free:p.freeAfterObligationsCents??p.indicativeFreeAfterObligationsCents,indicative:p.freeAfterObligationsCents==null,savings:p.savingsGoalCents,balance:(p.currentBalance || p.opening).balanceCents,minimum:p.minimumBalanceCents,minimumDate:p.minimumDate,buffer:p.bufferCents};}
export function savingsNote(p){
  const s=p.softSavings;
  const planned=`<span data-p3-savings-plan>Gepland sparen: ${money(s?.goalCents??p.savingsGoalCents)}</span>`;
  if(!s||s.status==='none')return planned;
  if(s.status==='unknown')return planned+'<span data-p3-savings-unknown>Spaarruimte nog niet betrouwbaar vast te stellen.</span>';
  if(!s.remainingGoalCents)return planned+'<span>Spaardoel al gerealiseerd.</span>';
  const room=`<span data-p3-savings-room>Ruimte boven spaardoel: ${money(s.headroomCents)}</span>`;
  const warning=!s.warning?'':s.shortfallCents>0?'<span data-p3-savings-warning>Het spaardoel lijkt al niet volledig haalbaar. Extra uitgaven kunnen dit verder verlagen.</span>':`<span data-p3-savings-warning>Boven ${money(s.headroomCents)} extra uitgaven kan je geplande spaardoel in gevaar komen.</span>`;
  return planned+room+warning;
}
export function yearView(year,getMonth){
  const months=Array.from({length:12},(_,i)=>{const key=`${year}-${String(i+1).padStart(2,'0')}`;try{const m=getMonth(key);const values=[m.income?.total,m.fixedExpenses,m.variableExpenses?.total,m.savings];if(!values.every(Number.isFinite))return {key,missing:true};return {key,income:Math.round(values[0]*100),spent:Math.round((values[1]+values[2])*100),saving:Math.round(values[3]*100)};}catch{return {key,missing:true};}});
  const known=months.filter(m=>!m.missing),total=field=>known.length?known.reduce((sum,m)=>sum+m[field],0):null;
  return {months,count:known.length,income:total('income'),spent:total('spent'),saving:total('saving'),average:known.length?Math.round(total('spent')/known.length):null};
}
const head=(title,action='')=>`<div class="p3-head"><h2>${title}</h2>${action}</div>`;
const action=(name,label='Bekijk alles')=>`<button type="button" class="p3-link" data-p3-action="${name}">${label}<span aria-hidden="true"> ›</span></button>`;
const meter=(value,label)=>`<progress max="100" value="${Math.max(0,Math.min(100,value))}" aria-label="${escape(label)}"></progress>`;
function paymentsHtml(p,label,canOpen=()=>false){const rows=paymentEvents(p);return rows.map(e=>`<li${canOpen(e)?'':' class="p3-payment"'}>${canOpen(e)?`<button type="button" class="p3-payment p3-payment-button" data-p3-event="${escape(e.id)}">`:''}<time datetime="${e.date}">${date(e.date)}</time><span class="p3-event-icon ${e.amountCents<0?'out':'in'}" aria-hidden="true">${e.amountCents<0?'↗':'↙'}</span><span class="p3-payment-copy"><strong>${escape(label(e))}</strong><small>${status(e.status)}${e.dateQuality==='estimated'?' · Geschat':''}</small></span><strong class="${e.amountCents<0?'':'p3-positive'}">${e.amountCents>0?'+ ':''}${money(e.amountCents)}</strong>${canOpen(e)?'</button>':''}</li>`).join('')||'<li class="p3-empty">Geen toekomstige vaste betalingen of inkomsten binnen deze periode.</li>';}
function chartHtml(p,width=720){
  width=Math.max(210,width);const plotStart=76,plotEnd=width-24;
  if(p&&!p.horizon.endDate)return '<p class="p3-empty">Een betrouwbaar volgend salaris- of zakgeldmoment ontbreekt. Kies een andere periode of controleer de inkomensplanning bij Bankrekeningen.</p>';
  if(!p)return '<p class="p3-empty">Een bruikbaar beginsaldo ontbreekt. Stel een saldo-ijkpunt in.</p>';
  const days=chartDays(p),known=days.filter(d=>Number.isSafeInteger(d.expectedBalanceCents)),values=known.map(d=>d.expectedBalanceCents),lo=Math.min(0,p.bufferCents,...values),hi=Math.max(p.bufferCents,...values,100),range=hi-lo||1;
  const chartHeight=width>=440?205:245,baseline=chartHeight-40;
  const x=i=>plotStart+i*(plotEnd-plotStart)/Math.max(1,days.length-1),y=v=>baseline-(v-lo)/range*(baseline-32);
  const segments=chartSegments(known,p.asOfDate),pathFor=rows=>rows.map((d,i)=>`${i?'L':'M'}${x(days.indexOf(d)).toFixed(2)},${y(d.expectedBalanceCents).toFixed(2)}`).join(' ');
  const segment=(rows,kind)=>{if(!rows.length)return '';const lineRows=kind==='history'&&segments.future.length?[...rows,segments.future[0]]:rows;const path=pathFor(lineRows),from=x(days.indexOf(lineRows[0])),to=x(days.indexOf(lineRows.at(-1)));return `<path d="${path} L${to},${baseline} L${from},${baseline} Z" class="p3-area p3-${kind}"/><path d="${path}" class="p3-line p3-${kind}" data-from="${rows[0].date}" data-to="${rows.at(-1).date}"/>`;};
  const todayIndex=days.findIndex(d=>d.date===p.asOfDate),today=segments.past.length&&todayIndex>=0?`<line class="p3-today" x1="${x(todayIndex)}" x2="${x(todayIndex)}" y1="28" y2="${baseline}"/><text class="p3-today-label" x="${Math.max(plotStart,Math.min(plotEnd-48,x(todayIndex)+5))}" y="20">Vandaag</text>`:'';
  const ticks=[0,1,2,3].map(i=>{const v=lo+range*i/3,yy=y(v);return `<line x1="${plotStart}" x2="${plotEnd}" y1="${yy}" y2="${yy}" class="p3-gridline"/><text x="${plotStart-5}" y="${yy+4}" text-anchor="end">${money(Math.round(v)).replace(',00','')}</text>`;}).join('');
  const labels=[...new Set([0,Math.floor((days.length-1)/2),days.length-1])].map(i=>`<text x="${x(i)}" y="${chartHeight-11}" text-anchor="${i===0?'start':i===days.length-1?'end':'middle'}">${date(days[i].date)}</text>`).join('');
  const events=chartPaymentEvents(p),points=days.map((d,i)=>({d,i,events:events.filter(e=>e.date===d.date)})).filter(({d,i,events})=>Number.isSafeInteger(d.expectedBalanceCents)&&(events.length||d.date===p.minimumDate||d===known[0]||i===days.length-1));
  const markers=points.map(({d,i,events})=>{
    const meaning=pointMeaning(events,d.date===p.minimumDate),cx=x(i),cy=y(d.expectedBalanceCents);
    const dot=meaning.income?'p3-income':meaning.expense?'p3-expense':'p3-neutral';
    return `<g role="button" tabindex="0" data-p3-point="${d.date}" aria-label="${meaning.isMinimum?'Minimum · ':''}${date(d.date)}: ${money(d.expectedBalanceCents)} · ${meaning.label}" aria-pressed="false"><circle class="p3-hit" cx="${cx}" cy="${cy}" r="22" fill="transparent"/>${meaning.isMinimum?`<rect class="p3-min" x="${cx-7}" y="${cy-7}" width="14" height="14" rx="2" transform="rotate(45 ${cx} ${cy})"/>`:''}<circle cx="${cx}" cy="${cy}" r="${meaning.isMinimum?3:4}" class="${dot}"/>${meaning.income&&meaning.expense?`<circle cx="${cx}" cy="${cy}" r="8" class="p3-mixed"/>`:''}${meaning.isMinimum?`<text class="p3-min-label" x="${Math.max(plotStart,Math.min(plotEnd-6,cx))}" y="${Math.max(15,cy-16)}" text-anchor="${cx>(plotStart+plotEnd)/2?'end':'start'}">Minimum · ${date(d.date)}</text>`:''}</g>`;
  }).join('');
  const unknown=days.filter(d=>!Number.isSafeInteger(d.expectedBalanceCents));
  const gap=unknown.length?`<p class="p3-caption" data-p3-unknown-days>${date(unknown[0].date)} – ${date(unknown.at(-1).date)}: saldo onbekend. Een bruikbaar beginsaldo ontbreekt voor deze dagen; de lijn begint bij het eerste bekende saldo.</p>`:'';
  return `<div class="p3-chart">${gap}<svg viewBox="0 0 ${width} ${chartHeight}" role="group" aria-label="Verwachte saldo-ontwikkeling; selecteer een dag voor bedragen en gebeurtenissen">${known.length?ticks:''}${segment(segments.past,'history')}${segment(segments.future,'future')}${known.length?`<line x1="${plotStart}" x2="${plotEnd}" y1="${y(p.bufferCents)}" y2="${y(p.bufferCents)}" class="p3-buffer-line"/>`:''}${today}${markers}${labels}</svg><div class="p3-chart-legend">${segments.past.length?'<span class="p3-history-key"><i aria-hidden="true">━</i> Verstreken dagen</span>':''}<span>━ Vandaag en toekomst</span><span class="p3-income-key">● Inkomsten</span><span class="p3-expense-key">● Uitgaven</span><span>◇ Minimum</span><span>┄ Buffer ${money(p.bufferCents)}</span></div><div class="p3-chart-controls"><label class="p3-day-select">Bekijk een dag <select data-p3-day aria-label="Dag in saldo-ontwikkeling">${days.map(d=>`<option value="${d.date}">${date(d.date)}${Number.isSafeInteger(d.expectedBalanceCents)?'':' · onbekend'}</option>`).join('')}</select></label><div class="p3-point-detail" data-p3-point-detail aria-live="polite"></div></div></div>`;
}
const info=(key,title,content)=>`<button type="button" class="p3-info-button" data-p3-info="${key}" aria-label="Uitleg over ${escape(title)}" aria-controls="p3-info-${key}" aria-expanded="false">ⓘ</button><div class="p3-info-popover" id="p3-info-${key}" popover="auto" role="dialog" aria-modal="false" aria-label="${escape(title)}" data-p3-info-panel="${key}"><div class="p3-info-heading"><strong>${title}</strong><button type="button" class="ghost small" data-p3-close-info="${key}" aria-label="Sluiten · uitleg over ${escape(title)}">Sluiten</button></div>${content}</div>`;
const savingDate=value=>value?new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'maandultimo';
const calculationHelp=p=>{const s=p.monthEndSavings;return s?`<p>Het maximaal over te boeken bedrag op ${savingDate(s.transferDate)}. Dit is geen geld dat vandaag vrij besteedbaar is.</p><p>Verwacht eindsaldo: ${money(s.expectedEndBalanceCents)}<br>Nodig vanaf volgende maand: ${money(s.requiredOpeningCents)}<br>Inclusief permanente buffer: ${money(s.bufferCents??p.bufferCents)}.</p><p>De hele volgende maand telt mee, plus de periode tot en met de eerstvolgende salaris- of zakgeldontvangst daarna (${date(s.assessmentEndDate)}). De volledige resterende budgetpot wordt vanaf het begin van iedere betrokken maand beschermd, ook in de maand van die ontvangst. De dagelijkse budgetschatting wordt hier niet daarnaast afgetrokken. Gepland sparen en Extra ruimte zijn alleen een vergelijking; de bestaande planning wordt niet automatisch gewijzigd.</p>`:'';};
function qualityHelp(p){
  const reasons=explainLiquidityReasons({...p,reasons:[...p.reasons,...(p.monthEndSavings?.reasons||[])]});
  return reasons.length?`<p>${status(p.status)}. De onderstaande punten zijn door de huidige prognose vastgesteld.</p>${reasons.map(r=>`<section data-p3-reason="${escape(r.code)}"><strong>${escape(r.problem)}</strong><p>${escape(r.why)}</p><p><b>Wat kun je doen?</b> ${escape(r.solution)}</p>${action(r.action,r.action==='balance'?'Saldo controleren':r.action==='payments'?'Betalingen bekijken':r.action==='data'?'Data & back-up openen':r.action==='accounts'?'Bankrekeningen openen':r.action==='budgets'?'Overzicht openen':'Prognose instellen')}<details><summary>Technische details</summary><p>${escape(r.detail)} (${escape(r.code)})</p></details></section>`).join('')}`:`<p>${status(p.status)}. Er zijn voor deze prognose geen aanvullende oorzaken gemeld. Een prognose blijft een verwachting; bedragen en betaalmomenten kunnen veranderen.</p>`;
}
function outlookHtml(p,profile,label,iconSvg,bankMarkup=''){
  if(!profile)return `<p class="p3-empty">Kies de primaire betaalrekening voor deze context. Er wordt geen willekeurige rekening gebruikt.</p>${action('accounts','Rekening instellen')}`;
  if(!p)return '<p class="p3-empty" role="status">Vooruitblik laden…</p>';
  const v=liquidityView(p),balance=p.currentBalance || p.opening;
  const kpi=(key,title,value,sub,icon,explanation,act='')=>`<article class="p3-kpi">${act?`<button type="button" class="ux-card-primary" data-p3-action="${act}" aria-label="${title} ${escape(value)} · ${act==='balance'?'Saldo bijwerken':'Buffer instellen'}"></button>`:''}<span class="p3-kpi-icon" aria-hidden="true">${iconSvg(icon)}</span><span class="p3-kpi-copy"><span class="p3-kpi-title"><span>${title}</span>${info(key,title,explanation)}</span><strong>${value}</strong><small>${sub}</small>${key==='balance'?bankMarkup:''}</span></article>`;
  const warning=v.minimum!==null&&v.minimum<v.buffer?`<div class="p3-warning" role="status">${p.status!=='projected'?`${status(p.status)} · `:''}Op ${date(v.minimumDate)} wordt ${money(v.minimum)} verwacht. ${v.minimum<0?'Dit is onder € 0. ':''}Dat is ${money(v.buffer-v.minimum)} onder je buffer van ${money(v.buffer)}.</div>`:'';
  const saving=p.monthEndSavings,amount=saving?.safeCents??saving?.indicativeCents??null;
  const savingTitle='Veilig te sparen op '+savingDate(saving?.transferDate);
  const freeSub=`${amount===null?'Onvolledige prognose · bedrag niet vast te stellen':saving.status==='provisional'?'Indicatie':''}<span data-p3-savings-plan>Gepland sparen: ${money(saving?.plannedCents)}</span>${amount===null?'':`<span data-p3-savings-extra>Extra ruimte: ${money(saving.extraCents)}</span>`}`;
  const savingsWarning=amount===null?'<div class="p3-warning" role="status">Onvolledige spaarprognose. Controleer de saldobasis en betaalmomenten; een veilig spaarbedrag is nog niet vast te stellen.</div>':'';
  const balanceDate=balance.checkpoint?.asOfDate;
  const balanceSub=`${status(balance.status)}${balanceDate?` · Berekend t/m ${date(balance.toDate||p.asOfDate)}`:''}${bankMarkup?'':' · Saldo bijwerken'}`;
  const reconciliations=(p.reconciliations || []).filter(r=>r.differenceCents!==null&&r.differenceCents!==0).map(r=>`<p class="p3-caption">Saldo-ijkpunt ${date(r.date)}: ${money(r.observedCents)} · berekend ${money(r.modeledCents)} · verschil ${money(r.differenceCents)}. Vanaf deze dag loopt de berekening verder met het handmatig ingestelde saldo.</p>`).join('');
  const qualityActions=p.reasons.length?`<div class="p3-quality-actions">${action('settings',p.reasons.some(r=>r.code==='missing-reliable-horizon')?'Salarisdatum instellen':'Prognose instellen')}${v.balance===null?action('balance','Saldo instellen'):''}</div>`:'';
  return `<div class="p3-kpis">${kpi('free',savingTitle,amount===null?'—':money(amount),freeSub,'income',calculationHelp(p)+qualityHelp(p))}${kpi('balance',p.horizon.endDate<p.asOfDate?'Saldo op '+date(p.horizon.endDate):'Huidig saldo',v.balance===null?'Saldo onbekend':money(v.balance),balanceSub,'wallet',`<p>Dit is de rekeningstand op basis van je vastgelegde banksaldo en beschikbare bankboekingen. ${balanceDate?`Het startpunt is het saldo-ijkpunt van ${date(balanceDate)}. Daarna tellen beschikbare bankboekingen mee tot en met ${date(balance.toDate||p.asOfDate)}.`:''} Dit is geen automatische bevestiging van je bank.</p>${qualityHelp(p)}`,'balance')}${kpi('minimum','Laagste prognose',money(v.minimum),`${date(v.minimumDate)} · ${status(p.status)}`,'chart',`<p>Het laagste verwachte saldo vanaf vandaag tot vlak vóór je volgende salaris- of zakgeldontvangst, inclusief je huidige saldo. Deze KPI verandert niet wanneer je de grafiekperiode wisselt.</p>${qualityHelp(p)}`)}${kpi('buffer','Buffer',money(v.buffer),'Buffer instellen','shield',`<p>De buffer is de veiligheidsmarge die je op deze rekening wilt houden. Veilig te sparen op maandultimo beschermt deze marge. Je buffer is geen aparte bankboeking.</p>`,'settings')}</div>${warning}${savingsWarning}<div class="p3-outlook-footer"><span class="p3-account-name">Rekening: ${escape(profile.name)}</span>${qualityActions}${reconciliations}</div>`;
}
function yearHtml(year,getMonth){
  const v=yearView(year,getMonth),max=Math.max(1,...v.months.filter(m=>!m.missing).flatMap(m=>[m.income,m.spent]));
  return `${head(`Jaaroverzicht ${year}`,`<label class="p3-year-select">Jaar <select data-p3-year>${Array.from({length:11},(_,i)=>year-5+i).map(y=>`<option ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>`)}<p class="p3-caption">Huishouden · bestaande maandprojecties${v.count<12?` · Onvolledig: ${v.count} van 12 maanden beschikbaar`:''}. Open en toekomstige maanden zijn prognoses.</p><div class="p3-year-body"><div class="p3-year-kpis">${[['Totaal besteed',v.spent],['Totaal inkomen',v.income],['Totaal gespaard',v.saving],['Gemiddeld per maand',v.average]].map(([title,value])=>`<div><span>${title}</span><strong>${money(value)}</strong></div>`).join('')}</div><div class="p3-year-chart"><div class="p3-chart-legend"><span class="p3-year-income-key"><i aria-hidden="true">■</i> Inkomsten</span><span class="p3-year-expense-key"><i aria-hidden="true">■</i> Uitgaven</span></div><div class="p3-year-bars">${v.months.map(m=>`<div tabindex="0" role="img" aria-label="${m.key}: ${m.missing?'Niet beschikbaar':`inkomen ${money(m.income)}, uitgaven ${money(m.spent)}`}" title="${m.key}: ${m.missing?'Niet beschikbaar':`inkomen ${money(m.income)}, uitgaven ${money(m.spent)}`}"><div class="p3-bar-pair">${m.missing?'<span>—</span>':`<i style="height:${Math.max(0,m.income/max*100)}%"></i><i style="height:${Math.max(0,m.spent/max*100)}%"></i>`}</div><span>${new Intl.DateTimeFormat('nl-NL',{month:'short',timeZone:'UTC'}).format(new Date(m.key+'-01T12:00:00Z'))}</span></div>`).join('')}</div></div></div>`;
}
export function createDashboard(deps){
  let controller=null,chartObserver=null,chartFrame=0,selectedDay=null,lastChartWidth=0;
  let generation=0,projection=null,filter='month',custom='',context='gezamenlijk',year=null,localPerson='dion',selectedMonth=null;
  try{const pref=JSON.parse(localStorage.getItem('finize-dashboard-context')||'null');if(pref?.context==='persoonlijk')context=pref.context;if(['dion','dara'].includes(pref?.person))localPerson=pref.person;if(['month','7','14','custom','salary'].includes(pref?.filter))filter=pref.filter;if(pref?.month===deps.month())custom=pref.custom || '';else filter='month';if(filter==='custom'){try{dashboardPeriod({month:deps.month(),today:deps.today(),filter,custom});}catch{custom='';filter='month';}}}catch{}
  function owner(){return context==='gezamenlijk'?'gezamenlijk':deps.personalRole()||localPerson;}
  function savePreference(){try{localStorage.setItem('finize-dashboard-context',JSON.stringify({context,person:localPerson,filter,custom,month:deps.month()}));}catch{}}
  function renderLower(root){
    const data=deps.summary(owner());
    root.querySelector('[data-p3-summary]').innerHTML=`<section class="p3-panel p3-budget">${head('Budgetten',action('budgets'))}<p class="p3-caption">${escape(deps.monthLabel())} · ${escape(deps.ownerLabel(owner()))}</p><div class="p3-budget-body"><div class="p3-ring" style="--progress:${Math.max(0,Math.min(100,data.budget?data.used/data.budget*100:0))}%"><strong>${deps.eur(data.used)}</strong><span>van ${deps.eur(data.budget)}</span></div><dl><dt>Besteed</dt><dd>${deps.eur(data.used)}</dd><dt>Resterend</dt><dd>${deps.eur(data.budget-data.used)}</dd></dl></div></section><section class="p3-panel p3-allowance">${head('Zakgeld',action('allowance'))}<p class="p3-caption">${escape(deps.monthLabel())} · Geplande verdeling</p>${data.retainedJointIncome?`<p class="p3-caption" data-p3-retained-income>${deps.eur(data.retainedJointIncome)} inkomen blijft bij gezamenlijk en wordt niet als zakgeld verdeeld.</p>`:''}${data.allowances.map(p=>{const share=allowanceShare(p.amount,data.allowanceDistribution);return `<div class="p3-allowance-row"><strong>${escape(p.name)}</strong><span>${deps.eur(p.amount)} · ${share===null?'Verdeling niet beschikbaar':new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1}).format(share)+'%'}</span>${share===null?'':meter(share,'Aandeel '+p.name)}</div>`;}).join('')}</section><section class="p3-panel p3-goals">${head('Spaardoelen',action('goals'))}<p class="p3-caption">Huidige stand · planning ${escape(deps.monthLabel())}</p><div class="p3-goal-list">${data.goals.slice(0,2).map(g=>{const target=Number(g.doel.doelbedrag)||0,saved=Number(g.doel.algespaard)||0,progress=target>0?saved/target*100:0;return `<div class="p3-goal">${deps.goalIcon(g.doel)}<div><strong>${escape(g.doel.naam)}</strong><span>${deps.eur(saved)} / ${deps.eur(target)} · ${Math.round(progress)}%</span>${meter(progress,g.doel.naam)}</div></div>`;}).join('')||'<p class="p3-empty">Nog geen spaardoelen in deze context.</p>'}</div></section>`;
    root.querySelector('[data-p3-year-panel]').innerHTML=yearHtml(year,deps.getMonth);
  }
  function showDay(root,day){
    if(!projection)return;const d=chartDays(projection).find(d=>d.date===day);if(!d)return;
    selectedDay=day;root.querySelectorAll('g[data-p3-point]').forEach(point=>point.setAttribute('aria-pressed',String(point.dataset.p3Point===day)));
    root.querySelector('[data-p3-day]').value=day;
    const detail=root.querySelector('[data-p3-point-detail]');detail.hidden=false;detail.removeAttribute('data-hover-detail');detail.removeAttribute('data-hover-tooltip');detail.removeAttribute('style');
    const signed=value=>(value>0?'+ ':'')+money(value);
    if(!Number.isSafeInteger(d.expectedBalanceCents)){detail.innerHTML=`<div class="p3-detail-heading"><strong>${date(day)} ${day.slice(0,4)}</strong><button type="button" class="ghost small" data-p3-close-detail aria-label="Sluiten · datumdetails">Sluiten</button></div><p>Saldo onbekend: er is voor deze dag geen bruikbaar beginsaldo. Er wordt geen saldo teruggerekend uit een later ijkpunt.</p>${action('balance','Saldo controleren')}`;return;}
    const rows=projection.events.filter(e=>d.eventIds.includes(e.id));
    const replaced=e=>(e.replacedPlans || []).map(plan=>` (planning ${money(Math.abs(plan.amountCents))} vervangen)`).join('');
    detail.innerHTML=`<div class="p3-detail-heading"><strong>${date(day)} ${day.slice(0,4)}</strong><button type="button" class="ghost small" data-p3-close-detail aria-label="Sluiten · datumdetails">Sluiten</button></div><span>Berekend beginsaldo: ${money(d.openingBalanceCents)}</span><ul>${rows.map(e=>`<li>${escape(e.type==='balance-basis'?'Actuele saldobasis':e.type==='checkpoint'?'Handmatig saldo-ijkpunt':deps.eventLabel(e))}: <strong>${signed(e.amountCents)}</strong>${escape(replaced(e))} <span>(${e.type==='balance-basis'?'Aansluiting van historisch model op actueel saldo · alleen in deze grafiek':e.type==='checkpoint'?('Saldo ingesteld op '+money(e.observedBalanceCents)):e.type==='bank'?(e.status==='provisional'?'Voorlopig verwerkt · geboekt, nog nakijken':'Werkelijk'):e.type==='fixed'?'Geplande vaste last':e.type==='allowance'||e.type==='internal-transfer'?'Geplande interne overboeking':'Geplande inkomsten'})</span></li>`).join('')||(d.estimatedBudgetCents?'':'<li>Geen mutaties</li>')}${d.estimatedBudgetCents?`<li>Geschatte resterende budgetuitgaven: <strong>${signed(-d.estimatedBudgetCents)}</strong></li>`:''}</ul><span>Totaal mutaties: ${signed(d.mutationCents)}</span><strong>Berekend eindsaldo: ${money(d.expectedBalanceCents)}</strong><span>${d.checkpointId?'Saldo-ijkpunt aan het einde van deze dag · beginsaldo onbekend':'Berekend uit planning en beschikbare bankboekingen'} · ${status(projection.status)}</span>`;
  }
  function chartDay(root,e){
    if(!chartDays(projection).length)return;
    const svg=e.target.closest('[data-p3-chart] svg');if(!svg)return;
    const point=e.target.closest('[data-p3-point]');if(point)return point.dataset.p3Point;
    const rect=svg.getBoundingClientRect(),x=(e.clientX-rect.left)*svg.viewBox.baseVal.width/rect.width;
    const index=Math.round(Math.max(0,Math.min(1,(x-76)/(svg.viewBox.baseVal.width-100)))*(chartDays(projection).length-1));
    return chartDays(projection)[index]?.date;
  }
  function unmount(){
    ++generation;controller?.abort();chartObserver?.disconnect();chartObserver=null;
    if(chartFrame)cancelAnimationFrame(chartFrame);chartFrame=0;lastChartWidth=0;projection=null;
  }
  function drawChart(root,force=false){
    const host=root.querySelector('[data-p3-chart]');
    if(!host||!root.isConnected||!projection)return;
    const width=host.getBoundingClientRect().width;
    if(width<=0||!force&&Math.abs(width-lastChartWidth)<.5)return;
    const focused=document.activeElement,focusDay=host.contains(focused)?focused.dataset?.p3Point:null;
    const focusSelect=host.contains(focused)&&focused.matches('[data-p3-day]');
    lastChartWidth=width;host.innerHTML=chartHtml(projection,width);
    const days=chartDays(projection);if(days.length)showDay(root,days.some(day=>day.date===selectedDay)?selectedDay:days[0].date);
    if(focusDay)[...host.querySelectorAll('[data-p3-point]')].find(point=>point.dataset.p3Point===focusDay)?.focus({preventScroll:true});
    else if(focusSelect)host.querySelector('[data-p3-day]')?.focus({preventScroll:true});
  }
  function observeChart(root){
    const schedule=()=>{if(chartFrame)return;chartFrame=requestAnimationFrame(()=>{chartFrame=0;drawChart(root);});};
    if(typeof ResizeObserver==='function'){chartObserver=new ResizeObserver(schedule);chartObserver.observe(root.querySelector('[data-p3-chart]'));}
    else window.addEventListener('resize',schedule,{signal:controller.signal});
  }
  async function load(root,retry=0){
    const token=++generation;projection=null;const profile=primaryAccount(deps.profiles(),owner());root.querySelector('[data-p3-outlook]').innerHTML=outlookHtml(null,profile,deps.eventLabel,deps.iconSvg);root.querySelector('[data-p3-chart]').innerHTML='<p class="p3-empty">Saldo-ontwikkeling laden…</p>';root.querySelector('[data-p3-payments]').innerHTML='';root.querySelector('[data-p3-period]').textContent='Prognoseperiode laden…';lastChartWidth=0;
    if(!profile){root.querySelector('[data-p3-period]').textContent=forecastPeriod(null);root.querySelector('[data-p3-chart]').innerHTML=chartHtml(null);root.querySelector('[data-p3-payments]').innerHTML='<li class="p3-empty">Stel eerst je rekening in.</li>';return;}
    try{const asOfDate=deps.today(),period=dashboardPeriod({month:deps.month(),today:asOfDate,filter,custom});const kpis=await deps.project({accountProfileId:profile.id,asOfDate,incomeKpis:true,monthEndSavingsMonth:deps.month(),withFinancialBasis:true});if(token!==generation||!root.isConnected)return;const p=await deps.project({accountProfileId:profile.id,asOfDate,withFinancialBasis:true,...period});if(token!==generation||!root.isConnected)return;if(kpis.financialBasis!==p.financialBasis){if(retry<1)return load(root,retry+1);throw new Error('De gegevens wijzigden tijdens het berekenen. Open het dashboard opnieuw.');}projection=p;root.querySelector('[data-p3-outlook]').innerHTML=outlookHtml(kpis,profile,deps.eventLabel,deps.iconSvg,deps.bankMarkup?.(profile)||'');deps.bindBank?.(root.querySelector('[data-p3-outlook]'),profile);root.querySelector('[data-p3-period]').textContent=forecastPeriod(p);drawChart(root,true);root.querySelector('[data-p3-payments]').innerHTML=paymentsHtml(p,deps.eventLabel,deps.canOpenEvent);}catch(e){if(token!==generation||!root.isConnected)return;root.querySelector('[data-p3-outlook]').innerHTML=`<p class="p3-empty" role="status">${escape(e.message)}</p>${action('settings','Prognose instellen')}`;root.querySelector('[data-p3-period]').textContent=forecastPeriod(null);root.querySelector('[data-p3-chart]').innerHTML=chartHtml(null);root.querySelector('[data-p3-payments]').innerHTML='<li class="p3-empty">Betalingen konden niet worden geladen.</li>';}
  }
  return {unmount,mount(root){
    unmount();controller=new AbortController();const signal=controller.signal;
    const month=deps.month();if(selectedMonth!==null&&selectedMonth!==month){filter='month';custom='';selectedDay=null;year=Number(month.slice(0,4));savePreference();}selectedMonth=month;year??=Number(month.slice(0,4));const bounds=dashboardPeriod({month,today:deps.today()});root.classList.add('p3-dashboard');root.insertAdjacentHTML('beforeend',`<div class="p3-surface"><section class="p3-panel p3-outlook"><div class="p3-toolbar"><div><h2>Vooruitblik</h2></div><div class="p3-context" role="group" aria-label="Dashboardcontext">${['gezamenlijk','persoonlijk'].map(c=>`<button type="button" data-p3-context="${c}" aria-pressed="${context===c}">${c==='gezamenlijk'?'Gezamenlijk':'Persoonlijk'}</button>`).join('')}</div>${!deps.personalRole()?`<label class="p3-person" ${context==='gezamenlijk'?'hidden':''}>Persoon <select data-p3-person><option value="dion" ${localPerson==='dion'?'selected':''}>Dion</option><option value="dara" ${localPerson==='dara'?'selected':''}>Dara</option></select></label>`:''}<div class="p3-filters" role="group" aria-label="Prognoseperiode">${[['month','Deze maand'],['7','7 dagen'],['14','14 dagen'],['custom','Eigen datum'],['salary','Volgend salaris']].map(([value,title])=>`<button type="button" data-p3-filter="${value}" aria-pressed="${filter===value}">${title}</button>`).join('')}</div></div><label class="p3-custom" ${filter==='custom'?'':'hidden'}>Tot en met <input type="date" data-p3-custom min="${bounds.minDate}" max="${bounds.maxDate}" value="${custom}" required></label><div data-p3-outlook></div></section><div class="p3-main"><section class="p3-panel">${head('Saldo-ontwikkeling',info('chart','Saldo-ontwikkeling','<p>Berekend saldo uit planning en bankboekingen. Oranje toont het verleden, groen vandaag en de toekomst. Budgetuitgaven zonder datum zijn geschat.</p><p>Het minimum en de bufferlijn blijven in de grafiek zichtbaar. Kies een dag voor de bijbehorende bedragen en betalingen.</p>'))}<p class="p3-period" data-p3-period aria-live="polite"></p><div data-p3-chart></div></section><section class="p3-panel">${head('Betalingen in deze periode')}<p class="p3-caption">Toekomstige vaste lasten en inkomsten na vandaag.</p><ul class="p3-payments" data-p3-payments tabindex="0" aria-label="Toekomstige vaste betalingen en inkomsten"></ul></section></div><div class="p3-summary" data-p3-summary></div><section class="p3-panel p3-year" data-p3-year-panel></section></div>`);
    const isInfoOpen=panel=>typeof panel.showPopover==='function'?panel.matches(':popover-open'):panel.dataset.open==='true';
    const closeInfo=panel=>{if(!panel)return;const key=panel.dataset.p3InfoPanel;if(typeof panel.hidePopover==='function'){if(isInfoOpen(panel))panel.hidePopover();}else{delete panel.dataset.open;}root.querySelector(`[data-p3-info="${key}"]`)?.setAttribute('aria-expanded','false');};
    root.addEventListener('toggle',e=>{if(e.target.matches('[data-p3-info-panel]'))root.querySelector(`[data-p3-info="${e.target.dataset.p3InfoPanel}"]`)?.setAttribute('aria-expanded',String(e.newState==='open'));},{capture:true,signal});
    root.addEventListener('click',e=>{
      const button=e.target.closest('[data-p3-info]'),close=e.target.closest('[data-p3-close-info]');
      if(close){const panel=root.querySelector(`#p3-info-${close.dataset.p3CloseInfo}`);closeInfo(panel);root.querySelector(`[data-p3-info="${close.dataset.p3CloseInfo}"]`)?.focus();return;}
      if(!button)return;e.preventDefault();const panel=root.querySelector(`#p3-info-${button.dataset.p3Info}`);
      if(isInfoOpen(panel)){closeInfo(panel);return;}
      root.querySelectorAll('[data-p3-info-panel]').forEach(closeInfo);
      if(typeof panel.showPopover==='function')panel.showPopover();else panel.dataset.open='true';button.setAttribute('aria-expanded','true');
      const anchor=button.getBoundingClientRect(),box=panel.getBoundingClientRect();
      panel.style.left=Math.max(12,Math.min(innerWidth-box.width-12,anchor.left))+'px';panel.style.top=Math.max(12,Math.min(innerHeight-box.height-12,anchor.bottom+8))+'px';
    },{signal});
    root.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=[...root.querySelectorAll('[data-p3-info-panel]')].find(isInfoOpen);if(open){e.preventDefault();e.stopImmediatePropagation();closeInfo(open);root.querySelector(`[data-p3-info="${open.dataset.p3InfoPanel}"]`)?.focus();}},{signal});
    document.addEventListener('click',e=>{root.querySelectorAll('[data-p3-info-panel][data-open]').forEach(panel=>{if(!panel.contains(e.target)&&!e.target.closest('[data-p3-info]'))closeInfo(panel);});},{signal});
    renderLower(root);observeChart(root);load(root);
    const hideHover=()=>{
      const detail=root.querySelector('[data-p3-point-detail][data-hover-detail]');if(!detail)return;
      detail.hidden=true;detail.removeAttribute('data-hover-detail');detail.removeAttribute('data-hover-tooltip');detail.removeAttribute('style');
      root.querySelectorAll('[data-p3-point]').forEach(point=>point.setAttribute('aria-pressed','false'));
    };
    root.addEventListener('pointermove',e=>{
      if(e.pointerType!=='mouse'||e.buttons)return;const day=e.target.closest('[data-p3-point]')?.dataset.p3Point;if(!day){hideHover();return;}
      if(day!==selectedDay||root.querySelector('[data-p3-point-detail]')?.hidden)showDay(root,day);
      const detail=root.querySelector('[data-p3-point-detail]');
      detail?.setAttribute('data-hover-detail','');
      if(innerWidth>=768&&detail){
        detail.setAttribute('data-hover-tooltip','');const chart=detail.closest('.p3-chart').getBoundingClientRect();
        detail.style.maxWidth=Math.max(44,Math.min(innerWidth-16,chart.width-16))+'px';detail.style.maxHeight=Math.max(44,Math.min(innerHeight-16,chart.height-16))+'px';
        const box=detail.getBoundingClientRect();detail.style.left=Math.max(8,chart.left+8,Math.min(innerWidth-box.width-8,chart.right-box.width-8,e.clientX+16))+'px';detail.style.top=Math.max(8,chart.top+8,Math.min(innerHeight-box.height-8,chart.bottom-box.height-8,e.clientY+16))+'px';
      }
    },{signal});
    root.addEventListener('pointerout',e=>{if(e.pointerType==='mouse'&&e.target.closest('[data-p3-point]')!==e.relatedTarget?.closest?.('[data-p3-point]'))hideHover();},{signal});
    root.addEventListener('keydown',e=>{if(e.key==='Escape'){const detail=root.querySelector('[data-p3-point-detail]');if(detail)detail.hidden=true;}const point=e.target.closest('g[data-p3-point]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();showDay(root,point.dataset.p3Point);}},{signal});
    root.addEventListener('click',e=>{const day=chartDay(root,e);if(day)showDay(root,day);if(e.target.closest('[data-p3-close-detail]')){root.querySelector('[data-p3-point-detail]').hidden=true;selectedDay=null;root.querySelectorAll('[data-p3-point]').forEach(p=>p.setAttribute('aria-pressed','false'));}const button=e.target.closest('button');if(!button)return;if(button.dataset.p3Context){context=button.dataset.p3Context;savePreference();root.querySelectorAll('[data-p3-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p3Context===context)));const person=root.querySelector('.p3-person');if(person)person.hidden=context==='gezamenlijk';renderLower(root);load(root);}if(button.dataset.p3Filter){filter=button.dataset.p3Filter;savePreference();root.querySelectorAll('[data-p3-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p3Filter===filter)));root.querySelector('.p3-custom').hidden=filter!=='custom';if(filter==='custom'&&!custom){++generation;projection=null;root.querySelector('[data-p3-period]').textContent='Kies een einddatum';root.querySelector('[data-p3-outlook]').innerHTML='<p class="p3-empty" role="status">Kies een einddatum voor je prognose.</p>';root.querySelector('[data-p3-chart]').innerHTML=chartHtml(null);root.querySelector('[data-p3-payments]').innerHTML='<li class="p3-empty">Kies eerst een einddatum.</li>';root.querySelector('[data-p3-custom]').focus();}else load(root);}if(button.dataset.p3Event){const event=paymentEvents(projection).find(e=>e.id===button.dataset.p3Event);if(event)deps.openEvent(event);}if(button.dataset.p3Point)showDay(root,button.dataset.p3Point);if(button.dataset.p3Action){const profile=primaryAccount(deps.profiles(),owner());switch(button.dataset.p3Action){case 'balance':deps.balance(profile?.id);break;case 'settings':profile?deps.settings(profile.id):deps.balance();break;case 'accounts':deps.balance();break;case 'payments':deps.modal(`<h2>Betalingen binnen je prognoseperiode</h2><p>${date(projection?.displayStartDate || projection?.asOfDate)} tot en met ${date(projection?.horizon?.endDate)}</p><ul class="p3-payments">${projection?paymentsHtml(projection,deps.eventLabel,deps.canOpenEvent):'<li>Stel eerst je prognose in.</li>'}</ul>`,id=>{const event=paymentEvents(projection).find(e=>e.id===id);if(event)deps.openEvent(event);});break;case 'goals':deps.navigate('spaardoelen');break;default:deps.navigate(owner());}}},{signal});
    root.addEventListener('change',e=>{if(e.target.matches('[data-p3-custom]')){custom=e.target.value;savePreference();load(root);}if(e.target.matches('[data-p3-person]')){localPerson=e.target.value;savePreference();renderLower(root);load(root);}if(e.target.matches('[data-p3-day]'))showDay(root,e.target.value);if(e.target.matches('[data-p3-year]')){year=Number(e.target.value);root.querySelector('[data-p3-year-panel]').innerHTML=yearHtml(year,deps.getMonth);}},{signal});
  }};
}
