// P3 is presentation only. P2 owns every liquidity amount and event.
import {shiftLiquidityDay} from '../core/daily-liquidity.mjs';
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
  const from=p.asOfDate.slice(0,4)===p.horizon.endDate.slice(0,4)?date(p.asOfDate):dated(p.asOfDate);
  return `${from} – ${dated(p.horizon.endDate)} · ${p.horizon.kind==='manual'?'Einddatum inbegrepen':'Tot vóór volgend salaris'}`;
}
export function pointMeaning(events,isMinimum){
  const income=events.some(e=>e.amountCents>0),expense=events.some(e=>e.amountCents<0);
  return {income,expense,isMinimum,label:[isMinimum?'Laagste prognose':'',income?'Inkomst':'',expense?'Uitgave':'',!income&&!expense?'Saldopunt zonder concrete betaling':''].filter(Boolean).join(' · ')};
}
export function horizonEnd(filter,today,custom){
  if(filter==='salary')return undefined;
  if(filter==='7'||filter==='14')return shiftLiquidityDay(today,Number(filter));
  if(filter==='month'){const d=new Date(today+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,0);return d.toISOString().slice(0,10);}
  return custom || undefined;
}
export function primaryAccount(profiles,owner){
  const matches=profiles.filter(p=>p.status!=='archived'&&p.accountOwner===owner&&p.accountType==='payment'&&p.liquidity?.primaryForOwner);
  return matches.length===1?matches[0]:null;
}
export function paymentEvents(p){return (p?.events||[]).filter(e=>e.accountProfileId===p.accountProfileId&&['actual','provisional','planned'].includes(e.status)&&e.date>p.asOfDate&&e.date<=p.horizon.endDate).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
export function liquidityView(p){return {free:p.freeAfterObligationsCents??p.indicativeFreeAfterObligationsCents,indicative:p.freeAfterObligationsCents==null,savings:p.savingsGoalCents,balance:p.opening.balanceCents,minimum:p.minimumBalanceCents,minimumDate:p.minimumDate,buffer:p.bufferCents};}
export function yearView(year,getMonth){
  const months=Array.from({length:12},(_,i)=>{const key=`${year}-${String(i+1).padStart(2,'0')}`;try{const m=getMonth(key);const values=[m.income?.total,m.fixedExpenses,m.variableExpenses?.total,m.savings];if(!values.every(Number.isFinite))return {key,missing:true};return {key,income:Math.round(values[0]*100),spent:Math.round((values[1]+values[2])*100),saving:Math.round(values[3]*100)};}catch{return {key,missing:true};}});
  const known=months.filter(m=>!m.missing),total=field=>known.length?known.reduce((sum,m)=>sum+m[field],0):null;
  return {months,count:known.length,income:total('income'),spent:total('spent'),saving:total('saving'),average:known.length?Math.round(total('spent')/known.length):null};
}
const head=(title,action='')=>`<div class="p3-head"><h2>${title}</h2>${action}</div>`;
const action=(name,label='Bekijk alles')=>`<button type="button" class="p3-link" data-p3-action="${name}">${label}<span aria-hidden="true"> ›</span></button>`;
const meter=(value,label)=>`<progress max="100" value="${Math.max(0,Math.min(100,value))}" aria-label="${escape(label)}"></progress>`;
function paymentsHtml(p,label,all=false,canOpen=()=>false){const rows=paymentEvents(p);return rows.slice(0,all?rows.length:6).map(e=>`<li${canOpen(e)?'':' class="p3-payment"'}>${canOpen(e)?`<button type="button" class="p3-payment p3-payment-button" data-p3-event="${escape(e.id)}">`:''}<time datetime="${e.date}">${date(e.date)}</time><span class="p3-event-icon ${e.amountCents<0?'out':'in'}" aria-hidden="true">${e.amountCents<0?'↗':'↙'}</span><span class="p3-payment-copy"><strong>${escape(label(e))}</strong><small>${status(e.status)}${e.dateQuality==='estimated'?' · Geschat':''}</small></span><strong class="${e.amountCents<0?'':'p3-positive'}">${e.amountCents>0?'+ ':''}${money(e.amountCents)}</strong>${canOpen(e)?'</button>':''}</li>`).join('')||'<li class="p3-empty">Geen gedateerde betalingen binnen deze periode.</li>';}
function chartHtml(p,width=720){
  width=Math.max(210,width);const plotStart=76,plotEnd=width-24;
  if(!p?.days.length)return '<p class="p3-empty">Nog geen saldo-ontwikkeling beschikbaar. Stel je saldo en salarisdatum in.</p>';
  const days=p.days,values=days.map(d=>d.expectedBalanceCents),lo=Math.min(0,p.bufferCents,...values),hi=Math.max(p.bufferCents,...values,100),range=hi-lo||1;
  const chartHeight=width>=440?205:245,baseline=chartHeight-40;
  const x=i=>plotStart+i*(plotEnd-plotStart)/Math.max(1,days.length-1),y=v=>baseline-(v-lo)/range*(baseline-32);
  const line=days.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(d.expectedBalanceCents).toFixed(2)}`).join(' ');
  const ticks=[0,1,2,3].map(i=>{const v=lo+range*i/3,yy=y(v);return `<line x1="${plotStart}" x2="${plotEnd}" y1="${yy}" y2="${yy}" class="p3-gridline"/><text x="${plotStart-5}" y="${yy+4}" text-anchor="end">${money(Math.round(v)).replace(',00','')}</text>`;}).join('');
  const labels=[...new Set([0,Math.floor((days.length-1)/2),days.length-1])].map(i=>`<text x="${x(i)}" y="${chartHeight-11}" text-anchor="${i===0?'start':i===days.length-1?'end':'middle'}">${date(days[i].date)}</text>`).join('');
  const events=paymentEvents(p),points=days.map((d,i)=>({d,i,events:events.filter(e=>e.date===d.date)})).filter(({d,i,events})=>events.length||d.date===p.minimumDate||i===0||i===days.length-1);
  const markers=points.map(({d,i,events})=>{
    const meaning=pointMeaning(events,d.date===p.minimumDate),cx=x(i),cy=y(d.expectedBalanceCents);
    const dot=meaning.income?'p3-income':meaning.expense?'p3-expense':'p3-neutral';
    return `<g role="button" tabindex="0" data-p3-point="${d.date}" aria-label="${date(d.date)}: ${money(d.expectedBalanceCents)} · ${meaning.label}" aria-pressed="false"><circle class="p3-hit" cx="${cx}" cy="${cy}" r="22" fill="transparent"/>${meaning.isMinimum?`<rect class="p3-min" x="${cx-7}" y="${cy-7}" width="14" height="14" rx="2" transform="rotate(45 ${cx} ${cy})"/>`:''}<circle cx="${cx}" cy="${cy}" r="${meaning.isMinimum?3:4}" class="${dot}"/>${meaning.income&&meaning.expense?`<circle cx="${cx}" cy="${cy}" r="8" class="p3-mixed"/>`:''}${meaning.isMinimum?`<text class="p3-min-label" x="${Math.max(plotStart,Math.min(plotEnd-6,cx))}" y="${Math.max(15,cy-16)}" text-anchor="${cx>(plotStart+plotEnd)/2?'end':'start'}">Minimum · ${date(d.date)}</text>`:''}</g>`;
  }).join('');
  return `<div class="p3-chart"><svg viewBox="0 0 ${width} ${chartHeight}" role="group" aria-label="Verwachte saldo-ontwikkeling; selecteer een dag voor bedragen en gebeurtenissen">${ticks}<path d="${line} L${plotEnd},${baseline} L${plotStart},${baseline} Z" class="p3-area"/><line x1="${plotStart}" x2="${plotEnd}" y1="${y(p.bufferCents)}" y2="${y(p.bufferCents)}" class="p3-buffer-line"/><path d="${line}" class="p3-line"/>${markers}${labels}</svg><div class="p3-chart-legend"><span>● Verwacht saldo / neutraal</span><span class="p3-income-key">● Inkomsten</span><span class="p3-expense-key">● Uitgaven</span><span>◇ Minimum</span><span>┄ Buffer ${money(p.bufferCents)}</span></div><div class="p3-chart-controls"><label class="p3-day-select">Bekijk een dag <select data-p3-day aria-label="Dag in saldo-ontwikkeling">${days.map(d=>`<option value="${d.date}">${date(d.date)}</option>`).join('')}</select></label><div class="p3-point-detail" data-p3-point-detail aria-live="polite"></div></div></div>`;
}
function outlookHtml(p,profile,label,iconSvg){
  if(!profile)return `<p class="p3-empty">Kies de primaire betaalrekening voor deze context. Er wordt geen willekeurige rekening gebruikt.</p>${action('accounts','Rekening instellen')}`;
  if(!p)return '<p class="p3-empty" role="status">Vooruitblik laden…</p>';
  const v=liquidityView(p),kpi=(title,value,sub,icon,act='')=>`<${act?'button type="button"':'article'} class="p3-kpi" ${act?`data-p3-action="${act}"`:''}><span class="p3-kpi-icon" aria-hidden="true">${iconSvg(icon)}</span><span class="p3-kpi-copy"><span>${title}</span><strong>${value}</strong><small>${sub}</small></span></${act?'button':'article'}>`;
  const warning=v.minimum!==null&&v.minimum<v.buffer?`<div class="p3-warning" role="status">${p.status!=='projected'?`${status(p.status)} · `:''}Op ${date(v.minimumDate)} wordt ${money(v.minimum)} verwacht. ${v.minimum<0?'Dit is onder € 0. ':''}Dat is ${money(v.buffer-v.minimum)} onder je buffer van ${money(v.buffer)}.</div>`:'';
  const help=`<details class="p3-explanation"><summary>Hoe wordt Vrij na verplichtingen bepaald?</summary><p>P2 houdt rekening met bekende verplichtingen, budgetreserveringen en de ingestelde veiligheidsbuffer. Het spaardoel is een ingecalculeerd streven in de zakgeldplanning en wordt hier niet nogmaals afgetrokken. Periode: ${date(p.asOfDate)} tot en met ${date(p.horizon.endDate)}.</p></details>`;
  const quality=p.reasons.length?`<div class="p3-quality"><details><summary>${status(p.status)} · ${escape(p.reasons[0]?.message)}</summary><ul>${[...new Set(p.reasons.map(r=>r.message))].map(message=>`<li>${escape(message)}</li>`).join('')}</ul></details><div class="p3-quality-actions">${action('settings',p.reasons.some(r=>r.code==='missing-reliable-horizon')?'Salarisdatum instellen':'Prognose instellen')}${v.balance===null?action('balance','Saldo instellen'):''}</div></div>`:'';
  return `<div class="p3-kpis">${kpi('Vrij na verplichtingen',money(v.free),`${v.indicative&&v.free!==null?'Indicatie · ':''}Spaardoel: ${money(v.savings)}`,'income')}${kpi('Huidig saldo',v.balance===null?'Saldo onbekend':money(v.balance),`${status(p.opening.status)} · ${date(p.opening.toDate||p.asOfDate)} · Saldo bijwerken`,'wallet','balance')}${kpi('Laagste prognose',money(v.minimum),`${date(v.minimumDate)} · ${status(p.status)}`,'chart')}${kpi('Buffer',money(v.buffer),'Veiligheidsmarge · Instellen','shield','settings')}</div>${warning}<div class="p3-outlook-footer">${help}${quality}</div>`;
}
function yearHtml(year,getMonth){
  const v=yearView(year,getMonth),max=Math.max(1,...v.months.filter(m=>!m.missing).flatMap(m=>[m.income,m.spent]));
  return `${head(`Jaaroverzicht ${year}`,`<label class="p3-year-select">Jaar <select data-p3-year>${Array.from({length:11},(_,i)=>year-5+i).map(y=>`<option ${y===year?'selected':''}>${y}</option>`).join('')}</select></label>`)}<p class="p3-caption">Huishouden · bestaande maandprojecties${v.count<12?` · Onvolledig: ${v.count} van 12 maanden beschikbaar`:''}. Open en toekomstige maanden zijn prognoses.</p><div class="p3-year-body"><div class="p3-year-kpis">${[['Totaal besteed',v.spent],['Totaal inkomen',v.income],['Totaal gespaard',v.saving],['Gemiddeld per maand',v.average]].map(([title,value])=>`<div><span>${title}</span><strong>${money(value)}</strong></div>`).join('')}</div><div class="p3-year-chart"><div class="p3-chart-legend"><span>■ Inkomsten</span><span class="p3-muted-key">■ Uitgaven</span></div><div class="p3-year-bars">${v.months.map(m=>`<div title="${m.key}: ${m.missing?'Niet beschikbaar':`inkomen ${money(m.income)}, uitgaven ${money(m.spent)}`}"><div class="p3-bar-pair">${m.missing?'<span>—</span>':`<i style="height:${Math.max(0,m.income/max*100)}%"></i><i style="height:${Math.max(0,m.spent/max*100)}%"></i>`}</div><span>${new Intl.DateTimeFormat('nl-NL',{month:'short',timeZone:'UTC'}).format(new Date(m.key+'-01T12:00:00Z'))}</span></div>`).join('')}</div></div></div>`;
}
export function createDashboard(deps){
  let controller=null,chartObserver=null,chartFrame=0,selectedDay=null,lastChartWidth=0;
  let generation=0,projection=null,filter='salary',custom='',context='gezamenlijk',year=null,localPerson='dion';
  try{const pref=JSON.parse(localStorage.getItem('finize-dashboard-context')||'null');if(pref?.context==='persoonlijk')context=pref.context;if(['dion','dara'].includes(pref?.person))localPerson=pref.person;}catch{}
  function owner(){return context==='gezamenlijk'?'gezamenlijk':deps.personalRole()||localPerson;}
  function savePreference(){try{localStorage.setItem('finize-dashboard-context',JSON.stringify({context,person:localPerson}));}catch{}}
  function renderLower(root){
    const data=deps.summary(owner());
    root.querySelector('[data-p3-summary]').innerHTML=`<section class="p3-panel p3-budget">${head('Budgetten',action('budgets'))}<p class="p3-caption">${escape(deps.monthLabel())} · ${escape(deps.ownerLabel(owner()))}</p><div class="p3-budget-body"><div class="p3-ring" style="--progress:${Math.max(0,Math.min(100,data.budget?data.used/data.budget*100:0))}%"><strong>${deps.eur(data.used)}</strong><span>van ${deps.eur(data.budget)}</span></div><dl><dt>Besteed</dt><dd>${deps.eur(data.used)}</dd><dt>Resterend</dt><dd>${deps.eur(data.budget-data.used)}</dd></dl></div></section><section class="p3-panel p3-allowance">${head('Zakgeld',action('allowance'))}<p class="p3-caption">Geplande verdeling</p>${data.allowances.map(p=>{const share=allowanceShare(p.amount,data.allowanceDistribution);return `<div class="p3-allowance-row"><strong>${escape(p.name)}</strong><span>${deps.eur(p.amount)} · ${share===null?'Verdeling niet beschikbaar':new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1}).format(share)+'%'}</span>${share===null?'':meter(share,'Aandeel '+p.name)}</div>`;}).join('')}</section><section class="p3-panel p3-goals">${head('Spaardoelen',action('goals'))}<div class="p3-goal-list">${data.goals.slice(0,2).map(g=>{const target=Number(g.doel.doelbedrag)||0,saved=Number(g.doel.algespaard)||0,progress=target>0?saved/target*100:0;return `<div class="p3-goal">${deps.goalIcon(g.doel)}<div><strong>${escape(g.doel.naam)}</strong><span>${deps.eur(saved)} / ${deps.eur(target)} · ${Math.round(progress)}%</span>${meter(progress,g.doel.naam)}</div></div>`;}).join('')||'<p class="p3-empty">Nog geen spaardoelen in deze context.</p>'}</div></section>`;
    root.querySelector('[data-p3-year-panel]').innerHTML=yearHtml(year,deps.getMonth);
  }
  function showDay(root,day){if(!projection)return;const d=projection.days.find(d=>d.date===day);if(!d)return;selectedDay=day;root.querySelectorAll('g[data-p3-point]').forEach(point=>point.setAttribute('aria-pressed',String(point.dataset.p3Point===day)));root.querySelector('[data-p3-day]').value=day;root.querySelector('[data-p3-point-detail]').innerHTML=`<strong>${date(day)} · ${money(d.expectedBalanceCents)}</strong><span>${paymentEvents(projection).filter(e=>e.date===day).map(e=>`${escape(deps.eventLabel(e))}: ${money(e.amountCents)} (${status(e.status)})`).join(' · ')||'Geen concrete betaling'}${d.estimatedBudgetCents?` · Budgetschatting ${money(d.estimatedBudgetCents)}`:''}</span>`;}
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
    if(projection.days.length)showDay(root,projection.days.some(day=>day.date===selectedDay)?selectedDay:projection.days[0].date);
    if(focusDay)[...host.querySelectorAll('[data-p3-point]')].find(point=>point.dataset.p3Point===focusDay)?.focus({preventScroll:true});
    else if(focusSelect)host.querySelector('[data-p3-day]')?.focus({preventScroll:true});
  }
  function observeChart(root){
    const schedule=()=>{if(chartFrame)return;chartFrame=requestAnimationFrame(()=>{chartFrame=0;drawChart(root);});};
    if(typeof ResizeObserver==='function'){chartObserver=new ResizeObserver(schedule);chartObserver.observe(root.querySelector('[data-p3-chart]'));}
    else window.addEventListener('resize',schedule,{signal:controller.signal});
  }
  async function load(root){
    const token=++generation;projection=null;const profile=primaryAccount(deps.profiles(),owner());root.querySelector('[data-p3-outlook]').innerHTML=outlookHtml(null,profile,deps.eventLabel,deps.iconSvg);root.querySelector('[data-p3-chart]').innerHTML='<p class="p3-empty">Saldo-ontwikkeling laden…</p>';root.querySelector('[data-p3-payments]').innerHTML='';root.querySelector('[data-p3-period]').textContent='Prognoseperiode laden…';lastChartWidth=0;
    if(!profile){root.querySelector('[data-p3-period]').textContent=forecastPeriod(null);root.querySelector('[data-p3-chart]').innerHTML=chartHtml(null);root.querySelector('[data-p3-payments]').innerHTML='<li class="p3-empty">Stel eerst je rekening in.</li>';return;}
    try{const p=await deps.project({accountProfileId:profile.id,asOfDate:deps.today(),endDate:horizonEnd(filter,deps.today(),custom)});if(token!==generation||!root.isConnected)return;projection=p;root.querySelector('[data-p3-outlook]').innerHTML=outlookHtml(p,profile,deps.eventLabel,deps.iconSvg);root.querySelector('[data-p3-period]').textContent=forecastPeriod(p);drawChart(root,true);root.querySelector('[data-p3-payments]').innerHTML=paymentsHtml(p,deps.eventLabel,false,deps.canOpenEvent);}catch(e){if(token!==generation||!root.isConnected)return;root.querySelector('[data-p3-outlook]').innerHTML=`<p class="p3-empty" role="status">${escape(e.message)}</p>${action('settings','Prognose instellen')}`;root.querySelector('[data-p3-period]').textContent=forecastPeriod(null);root.querySelector('[data-p3-chart]').innerHTML=chartHtml(null);root.querySelector('[data-p3-payments]').innerHTML='<li class="p3-empty">Betalingen konden niet worden geladen.</li>';}
  }
  return {unmount,mount(root){
    unmount();controller=new AbortController();const signal=controller.signal;
    year??=Number(deps.month().slice(0,4));root.classList.add('p3-dashboard');root.insertAdjacentHTML('beforeend',`<div class="p3-surface"><section class="p3-panel p3-outlook"><div class="p3-toolbar"><div><h2>Vooruitblik</h2><p class="p3-caption">Je verwachte saldo en aankomende betalingen.</p></div><div class="p3-context" role="group" aria-label="Dashboardcontext">${['gezamenlijk','persoonlijk'].map(c=>`<button type="button" data-p3-context="${c}" aria-pressed="${context===c}">${c==='gezamenlijk'?'Gezamenlijk':'Persoonlijk'}</button>`).join('')}</div>${!deps.personalRole()?`<label class="p3-person" ${context==='gezamenlijk'?'hidden':''}>Persoon <select data-p3-person><option value="dion" ${localPerson==='dion'?'selected':''}>Dion</option><option value="dara" ${localPerson==='dara'?'selected':''}>Dara</option></select></label>`:''}<div class="p3-filters" role="group" aria-label="Prognoseperiode">${[['salary','Volgende salaris'],['7','7 dagen'],['14','14 dagen'],['month','Einde maand'],['custom','Eigen datum']].map(([value,title])=>`<button type="button" data-p3-filter="${value}" aria-pressed="${filter===value}">${title}</button>`).join('')}</div></div><label class="p3-custom" ${filter==='custom'?'':'hidden'}>Tot en met <input type="date" data-p3-custom min="${deps.today()}" value="${custom}" required></label><div data-p3-outlook></div></section><div class="p3-main"><section class="p3-panel">${head('Saldo-ontwikkeling')}<p class="p3-period" data-p3-period aria-live="polite"></p><p class="p3-caption">Verwacht saldo · ongedateerde budgetuitgaven zijn gelijkmatig geschat.</p><div data-p3-chart></div></section><section class="p3-panel">${head('Komende betalingen',action('payments'))}<ul class="p3-payments" data-p3-payments></ul></section></div><div class="p3-summary" data-p3-summary></div><section class="p3-panel p3-year" data-p3-year-panel></section></div>`);
    renderLower(root);observeChart(root);load(root);
    root.addEventListener('keydown',e=>{const point=e.target.closest('g[data-p3-point]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();showDay(root,point.dataset.p3Point);}},{signal});
    root.addEventListener('click',e=>{const point=e.target.closest('g[data-p3-point]');if(point)showDay(root,point.dataset.p3Point);const button=e.target.closest('button');if(!button)return;if(button.dataset.p3Context){context=button.dataset.p3Context;savePreference();root.querySelectorAll('[data-p3-context]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p3Context===context)));const person=root.querySelector('.p3-person');if(person)person.hidden=context==='gezamenlijk';renderLower(root);load(root);}if(button.dataset.p3Filter){filter=button.dataset.p3Filter;root.querySelectorAll('[data-p3-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p3Filter===filter)));root.querySelector('.p3-custom').hidden=filter!=='custom';if(filter==='custom'&&!custom){++generation;projection=null;root.querySelector('[data-p3-period]').textContent='Kies een einddatum';root.querySelector('[data-p3-outlook]').innerHTML='<p class="p3-empty" role="status">Kies een einddatum voor je prognose.</p>';root.querySelector('[data-p3-chart]').innerHTML=chartHtml(null);root.querySelector('[data-p3-payments]').innerHTML='<li class="p3-empty">Kies eerst een einddatum.</li>';root.querySelector('[data-p3-custom]').focus();}else load(root);}if(button.dataset.p3Event){const event=paymentEvents(projection).find(e=>e.id===button.dataset.p3Event);if(event)deps.openEvent(event);}if(button.dataset.p3Point)showDay(root,button.dataset.p3Point);if(button.dataset.p3Action){const profile=primaryAccount(deps.profiles(),owner());switch(button.dataset.p3Action){case 'balance':deps.balance(profile?.id);break;case 'settings':profile?deps.settings(profile.id):deps.balance();break;case 'accounts':deps.balance();break;case 'payments':deps.modal(`<h2>Betalingen binnen je prognoseperiode</h2><p>${date(projection?.asOfDate)} tot en met ${date(projection?.horizon?.endDate)}</p><ul class="p3-payments">${projection?paymentsHtml(projection,deps.eventLabel,true,deps.canOpenEvent):'<li>Stel eerst je prognose in.</li>'}</ul>`,id=>{const event=paymentEvents(projection).find(e=>e.id===id);if(event)deps.openEvent(event);});break;case 'goals':deps.navigate('spaardoelen');break;default:deps.navigate(owner());}}},{signal});
    root.addEventListener('change',e=>{if(e.target.matches('[data-p3-custom]')&&e.target.reportValidity()){custom=e.target.value;load(root);}if(e.target.matches('[data-p3-person]')){localPerson=e.target.value;savePreference();renderLower(root);load(root);}if(e.target.matches('[data-p3-day]'))showDay(root,e.target.value);if(e.target.matches('[data-p3-year]')){year=Number(e.target.value);root.querySelector('[data-p3-year-panel]').innerHTML=yearHtml(year,deps.getMonth);}},{signal});
  }};
}
