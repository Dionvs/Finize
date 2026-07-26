/* =========================================================
   Finize — Budget Planner V3 (lokale HTML-versie)
   Rekenmotor is 1-op-1 gebaseerd op de formules uit het
   originele Excel-werkboek (V29).
   ========================================================= */

/* ---------- helpers ---------- */
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function eur(n){
  if (n === null || n === undefined || isNaN(n)) return '€ -';
  const sign = n < 0 ? '-' : '';
  return sign + '€ ' + Math.abs(n).toLocaleString('nl-NL', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function moneyToneClass(n, kind='signed'){
  if (kind === 'expense') return 'value neg';
  if (kind === 'income') return Number(n) < 0 ? 'value neg' : 'value pos';
  return Number(n) < 0 ? 'value neg' : 'value pos';
}
function pct(n){ return (Math.round((n||0)*1000)/10) + '%'; }
function percentInputValue(n){
  if (n === null || n === undefined || isNaN(n)) return '';
  return round2((Number(n)||0) * 100);
}
function uid(){
  if (globalThis.crypto?.randomUUID) return 'id-' + globalThis.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
}
function findItemById(path, id){
  const rows = getPath(state, path);
  return Array.isArray(rows) ? rows.find(item=>item?.id === id) || null : null;
}
function updateItemById(path, id, changes){
  const item = findItemById(path, id);
  if (!item) return false;
  Object.assign(item, typeof changes === 'function' ? changes({...item}) : changes);
  return true;
}
function removeItemById(path, id){
  const rows = getPath(state, path);
  if (!Array.isArray(rows)) return null;
  const index = rows.findIndex(item=>item?.id === id);
  if (index < 0) return null;
  return {item:rows.splice(index, 1)[0], index, path};
}
function moveItemById(sourcePath, targetPath, id, targetIndex){
  const source = getPath(state, sourcePath);
  const target = getPath(state, targetPath);
  if (!Array.isArray(source) || !Array.isArray(target)) return false;
  const sourceIndex = source.findIndex(item=>item?.id === id);
  if (sourceIndex < 0) return false;
  const item = source.splice(sourceIndex, 1)[0];
  const safeIndex = Number.isInteger(targetIndex) ? Math.max(0, Math.min(targetIndex, target.length)) : target.length;
  target.splice(safeIndex, 0, item);
  return {item, sourcePath, targetPath, sourceIndex, targetIndex:safeIndex};
}
function formatDateNL(value){
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d)) return value;
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}
function formatDayMonth(value){
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d)) return value;
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0');
}
function getPath(obj, path){
  return path.split('.').reduce((o,k)=> (o==null?o:o[k]), obj);
}
function setPath(obj, path, value){
  const keys = path.split('.');
  let o = obj;
  for (let i=0;i<keys.length-1;i++) o = o[keys[i]];
  o[keys[keys.length-1]] = value;
}
function sumBedrag(list){
  return round2((list||[]).reduce((s,r)=> s + (Number(r.bedrag)||0), 0));
}
function effectiveBedrag(row){
  const b = Number(row.bedrag)||0;
  return row.jaarlijks ? b/12 : b;
}
function sumEffective(list){
  return round2((list||[]).reduce((s,r)=> s + effectiveBedrag(r), 0));
}
function categoryIcon(categorie){
  return iconSvg(categoryIconName(categorie));
}
function normalizeCategoryName(categorie){
  const raw = String(categorie||'').trim();
  if (!raw) return 'Overig';
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
  const aliases = [
    [/^(belasting|belastingen)$/i, 'Belastingen'],
    [/^entertainment$/i, 'Entertainment'],
    [/^(internet|telefoon|internet\/telefoon|internet & telefoon)$/i, 'Internet/telefoon'],
    [/^verzekeringen?$/i, 'Verzekeringen'],
    [/^water$/i, 'Water'],
    [/^energie$/i, 'Energie'],
    [/^huis(dier)?$/i, raw.toLowerCase() === 'huisdier' ? 'Huisdier' : 'Huis'],
    [/^pensioen$/i, 'Pensioen'],
    [/^overig$/i, 'Overig'],
    [/^variabel$/i, 'Variabel'],
  ];
  for (const [re, label] of aliases) if (re.test(normalized)) return label;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
function clone(value){ return JSON.parse(JSON.stringify(value)); }
function monthKey(date=new Date()){
  return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0');
}
function previousMonthKey(key){
  const [y,m] = String(key||monthKey()).split('-').map(Number);
  const d = new Date(y, (m||1)-2, 1);
  return monthKey(d);
}
function monthLabel(key){
  const [y,m] = String(key||monthKey()).split('-').map(Number);
  const d = new Date(y, (m||1)-1, 1);
  return d.toLocaleDateString('nl-NL', {month:'long', year:'numeric'});
}
function monthOptions(centerKey=getSelectedMonth()){
  const [y] = String(centerKey||monthKey()).split('-').map(Number);
  const years = [y-1, y, y+1];
  return years.flatMap(year => Array.from({length:12}, (_,i)=> monthKey(new Date(year, i, 1))));
}
function yearsWithMonthData(selected=getSelectedMonth()){
  const years = new Set([String(selected).slice(0,4), String(monthKey()).slice(0,4)]);
  Object.keys(state.monthlyIncome || {}).forEach(key=>{ if (/^\d{4}-\d{2}$/.test(key)) years.add(key.slice(0,4)); });
  Object.keys(state.monthlyBudgets || {}).forEach(key=>{ if (/^\d{4}-\d{2}$/.test(key)) years.add(key.slice(0,4)); });
  (state.transactions || []).forEach(tx=>{
    const key = transactionMonth(tx);
    if (/^\d{4}-\d{2}$/.test(key)) years.add(key.slice(0,4));
  });
  return Array.from(years).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
}
function transactionMonth(tx){ return String(tx.date||'').slice(0,7); }
function getSelectedMonth(){
  if (!state?.meta?.selectedMonth) return monthKey();
  return state.meta.selectedMonth;
}
function setSelectedMonth(value){
  if (!/^\d{4}-\d{2}$/.test(String(value||''))) return;
  state.meta.selectedMonth = value;
  ensureMonthData(value);
}
function ensureMonthData(month=getSelectedMonth()){
  state.meta.selectedMonth = state.meta.selectedMonth || monthKey();
  state.monthlyIncome = isPlainObject(state.monthlyIncome) ? state.monthlyIncome : {};
  state.monthlyIncomeOverrides = isPlainObject(state.monthlyIncomeOverrides) ? state.monthlyIncomeOverrides : {};
  state.monthlyRefundOverrides = isPlainObject(state.monthlyRefundOverrides) ? state.monthlyRefundOverrides : {};
  state.incomeDefaultsHistory = isPlainObject(state.incomeDefaultsHistory) ? state.incomeDefaultsHistory : {};
  state.monthlyBudgets = isPlainObject(state.monthlyBudgets) ? state.monthlyBudgets : {};
  state.monthlyTeruggaven = isPlainObject(state.monthlyTeruggaven) ? state.monthlyTeruggaven : {};
  state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
  state.monthlyIncome[month] = state.monthlyIncome[month] || {
    dion: Number(state.personen?.dion?.salaris)||0,
    dara: Number(state.personen?.dara?.salaris)||0
  };
  state.monthlyTeruggaven[month] = isPlainObject(state.monthlyTeruggaven[month]) ? state.monthlyTeruggaven[month] : {dion:[],dara:[],gezamenlijk:[]};
  ['gezamenlijk','dion','dara'].forEach(owner=>{ if (!Array.isArray(state.monthlyTeruggaven[month][owner])) state.monthlyTeruggaven[month][owner] = []; });
  state.monthlyBudgets[month] = state.monthlyBudgets[month] || {};
  ['voor','na'].forEach(scenario=>{
    if (!state.monthlyBudgets[month][scenario]){
      state.monthlyBudgets[month][scenario] = {
        gezamenlijkVariabel: clone(state[scenario]?.gezamenlijk?.variabel || []),
        dionVariabel: clone(state[scenario]?.dion?.variabel || []),
        daraVariabel: clone(state[scenario]?.dara?.variabel || [])
      };
    }
    ['gezamenlijk','dion','dara'].forEach(owner=>{
      const key = `${owner}Variabel`;
      if (!Array.isArray(state.monthlyBudgets[month][scenario][key])) state.monthlyBudgets[month][scenario][key] = clone(state[scenario]?.[owner]?.variabel || []);
    });
  });
}
function normalizeGoalDefaults(){
  ['gezamenlijk','dion','dara'].forEach(group=>{
    (state.spaardoelen?.[group]||[]).forEach(goal=>{
      if (!goal.rendementPeriode) goal.rendementPeriode = 'jaarlijks';
      if (!['jaarlijks','maandelijks'].includes(goal.rendementPeriode)) goal.rendementPeriode = 'jaarlijks';
      if (goal.favoriet === undefined) goal.favoriet = false;
      goal.eigenaar = group;
      if (goal.ratoVerdeling === undefined) goal.ratoVerdeling = !goal.vastBedrag;
      goal.ratoVerdeling = !!goal.ratoVerdeling;
      goal.subdoelen = Array.isArray(goal.subdoelen) ? goal.subdoelen : [];
      let remaining = Math.max(0, Number(goal.algespaard)||0);
      goal.subdoelen = goal.subdoelen.filter(isPlainObject).map((child,index)=>{
        const target = Math.max(0, Number(child.doelbedrag)||0);
        const current = Number(child.gespaard);
        const saved = Number.isFinite(current) ? Math.min(target,Math.max(0,current)) : Math.min(target,remaining);
        remaining = Math.max(0,remaining-saved);
        return {id:child.id||uid(),naam:String(child.naam||`Subdoel ${index+1}`),doelbedrag:round2(target),gespaard:round2(saved),link:String(child.link||''),volgorde:index,voltooid:target>0&&saved>=target};
      });
      if (goal.subdoelen.length){
        goal.doelbedrag = round2(goal.subdoelen.reduce((sum,child)=>sum+child.doelbedrag,0));
        goal.algespaard = round2(goal.subdoelen.reduce((sum,child)=>sum+child.gespaard,0));
      }
    });
  });
}
function normalizePersonDefaults(target){
  target.personen = isPlainObject(target.personen) ? target.personen : {};
  ['dion','dara'].forEach(person=>{
    target.personen[person] = isPlainObject(target.personen[person]) ? target.personen[person] : {};
    target.personen[person].naam = target.personen[person].naam || (person === 'dion' ? 'Dion' : 'Dara');
    target.personen[person].salaris = Number(target.personen[person].salaris)||0;
    const rows = Array.isArray(target.personen[person].vasteTeruggaven) ? target.personen[person].vasteTeruggaven : [];
    target.personen[person].vasteTeruggaven = rows.filter(isPlainObject).map(row=>({
      id: row.id || uid(),
      omschrijving: row.omschrijving ?? row.post ?? '',
      bedrag: Number(row.bedrag)||0
    }));
  });
}

function normalizeIncomeDefaults(target){
  target.incomeDefaultsHistory=isPlainObject(target.incomeDefaultsHistory)?target.incomeDefaultsHistory:{};
  target.monthlyRefundOverrides=isPlainObject(target.monthlyRefundOverrides)?target.monthlyRefundOverrides:{};
  ['dion','dara'].forEach(person=>{
    const fallbackSalary=round2(Number(target.personen?.[person]?.salaris)||0);
    const fallbackRefund=round2(sumBedrag(target.personen?.[person]?.vasteTeruggaven||[]));
    const rows=Array.isArray(target.incomeDefaultsHistory[person])?target.incomeDefaultsHistory[person]:[];
    const normalized=rows.filter(isPlainObject).map(row=>({
      id:String(row.id||uid()),
      effectiveFrom:/^\d{4}-\d{2}$/.test(String(row.effectiveFrom||''))?String(row.effectiveFrom):'0000-01',
      salary:round2(Number(row.salary)||0),
      refund:round2(Number(row.refund)||0),
      updatedAt:String(row.updatedAt||new Date(0).toISOString())
    })).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
    if(!normalized.length)normalized.push({id:uid(),effectiveFrom:'0000-01',salary:fallbackSalary,refund:fallbackRefund,updatedAt:new Date(0).toISOString()});
    target.incomeDefaultsHistory[person]=normalized;
  });
}
function getIncomeDefaultsAt(person,month=getSelectedMonth()){
  const rows=Array.isArray(state.incomeDefaultsHistory?.[person])?state.incomeDefaultsHistory[person]:[];
  const selected=rows.filter(row=>String(row.effectiveFrom||'')<=month).sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom))).pop();
  return {salary:round2(Number(selected?.salary ?? state.personen?.[person]?.salaris)||0),refund:round2(Number(selected?.refund ?? sumBedrag(state.personen?.[person]?.vasteTeruggaven||[]))||0),effectiveFrom:selected?.effectiveFrom||'0000-01'};
}
function setIncomeDefaultsFromMonth(person,month,salary,refund){
  state.incomeDefaultsHistory=isPlainObject(state.incomeDefaultsHistory)?state.incomeDefaultsHistory:{};
  const rows=Array.isArray(state.incomeDefaultsHistory[person])?state.incomeDefaultsHistory[person]:[];
  const normalizedSalary=round2(Number(salary)||0);
  const normalizedRefund=round2(Number(refund)||0);
  const entry={id:uid(),effectiveFrom:month,salary:normalizedSalary,refund:normalizedRefund,updatedAt:new Date().toISOString()};
  const index=rows.findIndex(row=>row.effectiveFrom===month);
  if(index>=0)rows[index]={...rows[index],...entry,id:rows[index].id||entry.id}; else rows.push(entry);
  rows.sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
  state.incomeDefaultsHistory[person]=rows;

  // Een nieuwe standaard vanaf deze maand vervangt oude toekomstige maandafwijkingen.
  // Alleen expliciet opnieuw ingestelde maandafwijkingen na deze handeling blijven bestaan.
  Object.keys(state.monthlyIncomeOverrides||{}).filter(key=>key>=month).forEach(key=>{
    if(isPlainObject(state.monthlyIncomeOverrides[key])){
      delete state.monthlyIncomeOverrides[key][person];
      if(!Object.keys(state.monthlyIncomeOverrides[key]).length)delete state.monthlyIncomeOverrides[key];
    }
  });
  Object.keys(state.monthlyRefundOverrides||{}).filter(key=>key>=month).forEach(key=>{
    if(isPlainObject(state.monthlyRefundOverrides[key])){
      delete state.monthlyRefundOverrides[key][person];
      if(!Object.keys(state.monthlyRefundOverrides[key]).length)delete state.monthlyRefundOverrides[key];
    }
  });
  Object.keys(state.monthlyIncome||{}).filter(key=>key>=month).forEach(key=>{
    if(isPlainObject(state.monthlyIncome[key]))state.monthlyIncome[key][person]=normalizedSalary;
  });
}
function getDistributionIncomeParts(person,month=getSelectedMonth()){
  const defaults=getIncomeDefaultsAt(person,month);
  const salaryOverride=state.monthlyIncomeOverrides?.[month]?.[person];
  const refundOverride=state.monthlyRefundOverrides?.[month]?.[person];
  return {salary:Number.isFinite(Number(salaryOverride))?round2(Number(salaryOverride)):defaults.salary,refund:Number.isFinite(Number(refundOverride))?round2(Number(refundOverride)):defaults.refund};
}

/* ---------- Update 3: schema v4 en pure maandadministratie ---------- */
var U3_SCHEMA_VERSION = 9;
var U3_ACCOUNTS = ['gezamenlijk','dion','dara'];
var U3_FREQUENCY_UNITS = ['weken','maanden','jaren'];

function u3IsoDate(date){
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function u3ParseDate(value){
  const match = String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2])-1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2])-1 && date.getDate() === Number(match[3]) ? date : null;
}
function u3MonthBounds(month){
  const match = String(month||'').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]), index = Number(match[2])-1;
  return {start:new Date(year,index,1,12),end:new Date(year,index+1,0,12)};
}
function u3AnchoredDate(year, monthIndex, anchorDay){
  const lastDay = new Date(year,monthIndex+1,0,12).getDate();
  return new Date(year,monthIndex,Math.min(anchorDay,lastDay),12);
}
function u3AddAnchoredMonths(start, count){
  const absolute = start.getFullYear()*12 + start.getMonth() + count;
  return u3AnchoredDate(Math.floor(absolute/12), ((absolute%12)+12)%12, start.getDate());
}
function u3AddAnchoredYears(start, count){
  return u3AnchoredDate(start.getFullYear()+count,start.getMonth(),start.getDate());
}
function u3AmountAt(item, dateOrMonth){
  const key = String(dateOrMonth||'').slice(0,7);
  if (item?.monthOverrides && Number.isFinite(Number(item.monthOverrides[key]))) return round2(Number(item.monthOverrides[key]));
  const histories = Array.isArray(item?.amountHistory) ? item.amountHistory : [];
  const selected = histories
    .filter(row=>String(row.effectiveFrom||'').slice(0,7) <= key)
    .sort((a,b)=>String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)))
    .pop();
  const fallback = item?.bedrag ?? item?.verwachtBedrag ?? 0;
  return round2(Number(selected?.amount ?? fallback)||0);
}
function u3OccurrenceDates(item, month){
  const bounds = u3MonthBounds(month);
  const start = u3ParseDate(item?.begindatum);
  if (!bounds || !start || item?.actief === false) return [];
  const end = item?.einddatum ? u3ParseDate(item.einddatum) : null;
  const amount = Math.max(1,Math.floor(Number(item.frequentieAantal)||1));
  const unit = U3_FREQUENCY_UNITS.includes(item.frequentieEenheid) ? item.frequentieEenheid : 'maanden';
  const dates = [];
  if (unit === 'weken'){
    const stepMs = amount*7*86400000;
    let index = Math.max(0,Math.floor((bounds.start-start)/stepMs)-1);
    for (let guard=0; guard<64; guard++,index++){
      const date = new Date(start.getTime()+index*stepMs);
      if (date > bounds.end) break;
      if (date >= bounds.start && date >= start && (!end || date <= end)) dates.push(u3IsoDate(date));
    }
  }else{
    const multiplier = unit === 'jaren' ? 12*amount : amount;
    const monthDistance = (bounds.start.getFullYear()-start.getFullYear())*12 + bounds.start.getMonth()-start.getMonth();
    let index = Math.max(0,Math.floor(monthDistance/multiplier)-1);
    for (let guard=0; guard<8; guard++,index++){
      const date = unit === 'jaren' ? u3AddAnchoredYears(start,index*amount) : u3AddAnchoredMonths(start,index*amount);
      if (date > bounds.end) break;
      if (date >= bounds.start && date >= start && (!end || date <= end)) dates.push(u3IsoDate(date));
    }
  }
  return dates;
}
function u3MonthlyAverage(item){
  const amount = Math.abs(u3AmountAt(item,getSelectedMonth()));
  const count = Math.max(1,Number(item?.frequentieAantal)||1);
  if (item?.frequentieEenheid === 'weken') return round2(amount*(365.2425/12)/(7*count));
  if (item?.frequentieEenheid === 'jaren') return round2(amount/(12*count));
  return round2(amount/count);
}
function u3OccurrenceId(itemId,date){ return `${itemId}:${date}`; }
function u3PlannedOccurrences(items,month){
  return (items||[]).flatMap(item=>u3OccurrenceDates(item,month).map(date=>({
    id:u3OccurrenceId(item.id,date),itemId:item.id,date,month:String(date).slice(0,7),
    naam:item.naam,categorie:item.categorie||'',account:item.rekening||item.account||'gezamenlijk',
    financialFor:item.financialFor||item.eigenaar||item.rekening||'gezamenlijk',
    amount:u3AmountAt(item,date),source:item
  })));
}
function u3RecognitionFromLegacy(rule){
  return {
    id:rule.id||`recognition-${bankText(rule.match||rule.description||uid())}`,
    text:String(rule.text||rule.match||''),counterparty:String(rule.counterparty||''),
    account:U3_ACCOUNTS.includes(rule.account)?rule.account:'',
    category:String(rule.category||'Overig'),fixedExpenseId:rule.fixedExpenseId||'',
    incomeSourceId:rule.incomeSourceId||'',financialFor:U3_ACCOUNTS.includes(rule.financialFor)?rule.financialFor:'',
    amount:Number.isFinite(Number(rule.amount))?round2(Number(rule.amount)):null,
    tolerance:Number.isFinite(Number(rule.tolerance))?Math.max(0,round2(Number(rule.tolerance))):5,
    updatedAt:rule.updatedAt||new Date().toISOString()
  };
}
function u3LegacyStartMonth(target){
  const keys = [
    ...Object.keys(target?.monthlyIncome||{}),
    ...Object.keys(target?.monthlyBudgets||{}),
    String(target?.meta?.selectedMonth||'')
  ].filter(key=>/^\d{4}-\d{2}$/.test(key)).sort();
  return `${keys[0]||monthKey()}-01`;
}
function u3MigrateFixedExpenses(target){
  target.recurringFixedExpenses = isPlainObject(target.recurringFixedExpenses) ? target.recurringFixedExpenses : {};
  const start = u3LegacyStartMonth(target);
  ['voor','na'].forEach(scenario=>{
    const existing = Array.isArray(target.recurringFixedExpenses[scenario]) ? target.recurringFixedExpenses[scenario] : [];
    const ids = new Set(existing.map(item=>item.legacyKey).filter(Boolean));
    U3_ACCOUNTS.forEach(account=>{
      const groups = [{kind:'vasteLasten',rows:target?.[scenario]?.[account]?.vasteLasten||[]}];
      if (scenario === 'na' && account === 'gezamenlijk') groups.push({kind:'hypotheek',rows:target?.na?.gezamenlijk?.hypotheek||[]});
      groups.forEach(group=>group.rows.forEach(row=>{
        const legacyKey = `${scenario}:${account}:${group.kind}:${row.id}`;
        if (ids.has(legacyKey)) return;
        existing.push({
          id:`fixed-${scenario}-${account}-${row.id}`,legacyKey,naam:String(row.post||row.omschrijving||row.categorie||'Vaste last'),
          categorie:String(row.categorie||'Overig'),bedrag:round2(Number(row.bedrag)||0),rekening:account,
          frequentieAantal:row.jaarlijks?1:1,frequentieEenheid:row.jaarlijks?'jaren':'maanden',
          begindatum:start,einddatum:'',actief:true,amountHistory:[{id:`amount-${row.id}`,effectiveFrom:start,amount:round2(Number(row.bedrag)||0)}],
          monthOverrides:{},recognition:{text:bankText(row.post||row.omschrijving||''),counterparty:'',amountTolerance:5},legacyKind:group.kind
        });
        ids.add(legacyKey);
      }));
    });
    target.recurringFixedExpenses[scenario] = existing;
  });
}
function u3MigrateIncomeSources(target){
  target.recurringIncomeSources = Array.isArray(target.recurringIncomeSources) ? target.recurringIncomeSources : [];
  const existingIds = new Set(target.recurringIncomeSources.map(item=>item.id));
  const start = u3LegacyStartMonth(target);
  ['dion','dara'].forEach(owner=>{
    const salaryId = `income-loon-${owner}`;
    if (!existingIds.has(salaryId)){
      const base = round2(Number(target?.personen?.[owner]?.salaris)||0);
      const source = {id:salaryId,naam:`Loon ${owner==='dion'?'Dion':'Dara'}`,type:'loon',eigenaar:owner,rekening:'gezamenlijk',financialFor:'gezamenlijk',verwachtBedrag:base,meetellenVoorVerdeling:true,frequentieAantal:1,frequentieEenheid:'maanden',begindatum:start,einddatum:'',actief:true,amountHistory:[{id:`amount-${salaryId}`,effectiveFrom:start,amount:base}],monthOverrides:{},recognition:{text:'',counterparty:'',amountTolerance:100},legacyKind:'salary'};
      Object.entries(target.monthlyIncome||{}).forEach(([month,data])=>{
        const value = Number(data?.[owner]);
        if (Number.isFinite(value) && value !== 0 && round2(value)!==base) source.monthOverrides[month]=round2(value);
      });
      target.recurringIncomeSources.push(source); existingIds.add(salaryId);
    }
    (target?.personen?.[owner]?.vasteTeruggaven||[]).forEach(row=>{
      const id=`income-refund-${owner}-${row.id}`;
      if (existingIds.has(id)) return;
      const amount=round2(Number(row.bedrag)||0);
      target.recurringIncomeSources.push({id,naam:String(row.omschrijving||'Vaste vergoeding'),type:'vergoeding/teruggave',eigenaar:owner,rekening:'gezamenlijk',financialFor:'gezamenlijk',verwachtBedrag:amount,meetellenVoorVerdeling:true,frequentieAantal:1,frequentieEenheid:'maanden',begindatum:start,einddatum:'',actief:true,amountHistory:[{id:`amount-${id}`,effectiveFrom:start,amount}],monthOverrides:{},recognition:{text:bankText(row.omschrijving||''),counterparty:'',amountTolerance:10},legacyKind:'fixed-refund'});
      existingIds.add(id);
    });
  });
}
function u3NormalizeRecurringItem(item,kind){
  item.id=item.id||uid();
  item.naam=String(item.naam||'');
  item.rekening=U3_ACCOUNTS.includes(item.rekening)?item.rekening:'gezamenlijk';
  item.frequentieAantal=Math.max(1,Math.floor(Number(item.frequentieAantal)||1));
  item.frequentieEenheid=U3_FREQUENCY_UNITS.includes(item.frequentieEenheid)?item.frequentieEenheid:'maanden';
  item.begindatum=u3ParseDate(item.begindatum)?item.begindatum:`${monthKey()}-01`;
  item.einddatum=u3ParseDate(item.einddatum)?item.einddatum:'';
  item.actief=item.actief!==false;
  item.amountHistory=Array.isArray(item.amountHistory)?item.amountHistory.filter(isPlainObject):[];
  if(!item.amountHistory.length){
    const amount=round2(Number(kind==='income'?item.verwachtBedrag:item.bedrag)||0);
    item.amountHistory=[{id:`amount-${item.id}`,effectiveFrom:item.begindatum,amount}];
  }
  item.monthOverrides=isPlainObject(item.monthOverrides)?item.monthOverrides:{};
  item.recognition=isPlainObject(item.recognition)?item.recognition:{text:'',counterparty:'',amountTolerance:5};
  if(kind==='income'){
    item.type=['loon','toeslag','vergoeding/teruggave','overig'].includes(item.type)?item.type:'overig';
    item.eigenaar=U3_ACCOUNTS.includes(String(item.eigenaar).toLowerCase())?String(item.eigenaar).toLowerCase():'gezamenlijk';
    item.financialFor=U3_ACCOUNTS.includes(item.financialFor)?item.financialFor:item.rekening;
    item.meetellenVoorVerdeling=!!item.meetellenVoorVerdeling;
    item.verwachtBedrag=round2(Number(item.verwachtBedrag)||0);
  }else{
    item.categorie=String(item.categorie||'Overig');
    item.bedrag=round2(Number(item.bedrag)||0);
    item.financialFor=U3_ACCOUNTS.includes(item.financialFor)?item.financialFor:item.rekening;
  }
  return item;
}
function u3LegacyFinancialSnapshot(month,record,closure){
  const summary=isPlainObject(closure?.summary)?closure.summary:{};
  const actualIncome=round2(Number(summary.actualIncome)||0);
  const fixedExpenses=round2(Number(summary.plannedFixed)||0);
  const variableTotal=round2(Number(summary.actualExpenses)||0);
  const savings=round2(Number(summary.jointSaving)||0);
  return {
    month,version:1,status:record.status,legacy:true,
    income:{dion:0,dara:0,joint:actualIncome,total:actualIncome},
    fixedExpenses,
    variableExpenses:{dion:0,dara:0,joint:variableTotal,total:variableTotal},
    refunds:0,savings,
    allowance:{dion:round2(Number(summary.allowanceDion)||0),dara:round2(Number(summary.allowanceDara)||0)},
    contributions:{dion:0,dara:0,joint:0,total:0},
    remaining:round2(Number(summary.monthResult)||0),
    goalAllocations:[],
    closedAt:String(closure?.closedAt||record.closedAt||'')
  };
}
function u3NormalizeClosureSnapshot(month,record,closure){
  closure.id=closure.id||closure.closingId||`closure-${month}-${closure.revision||1}`;
  closure.closingId=closure.closingId||closure.id;
  closure.month=closure.month||month;
  closure.version=Math.max(1,Number(closure.version||closure.revision)||1);
  closure.revision=closure.version;
  closure.status=['actief','vervangen','teruggedraaid'].includes(closure.status)?closure.status:
    (record.activeClosureId===closure.closingId?'actief':'vervangen');
  closure.createdAt=closure.createdAt||closure.closedAt||record.closedAt||new Date(0).toISOString();
  closure.supersedesClosingId=String(closure.supersedesClosingId||'');
  closure.financialSnapshot=isPlainObject(closure.financialSnapshot)
    ? closure.financialSnapshot
    : u3LegacyFinancialSnapshot(month,record,closure);
  closure.financialSnapshot.month=month;
  closure.financialSnapshot.closedAt=closure.financialSnapshot.closedAt||closure.closedAt||record.closedAt||'';
  return closure;
}
function u3NormalizeState(target){
  target.meta=isPlainObject(target.meta)?target.meta:{};
  target.monthlyIncomeOverrides=isPlainObject(target.monthlyIncomeOverrides)?target.monthlyIncomeOverrides:{};
  target.monthlyRefundOverrides=isPlainObject(target.monthlyRefundOverrides)?target.monthlyRefundOverrides:{};
  normalizeIncomeDefaults(target);
  // Migreer de oude maandwaarden slechts één keer. Zonder deze markering werden
  // ze bij iedere start opnieuw als override aangemaakt en blokkeerden ze een
  // nieuw standaardsalaris voor toekomstige maanden.
  if(target.meta.incomeHistoryMigrated!==true){
    Object.entries(target.monthlyIncome||{}).forEach(([month,values])=>{
      if(!isPlainObject(values))return;
      const overrides=isPlainObject(target.monthlyIncomeOverrides[month])?target.monthlyIncomeOverrides[month]:{};
      ['dion','dara'].forEach(owner=>{
        if(!Object.prototype.hasOwnProperty.call(values,owner))return;
        const value=Number(values[owner]);
        const expected=Number(target.personen?.[owner]?.salaris)||0;
        if(Number.isFinite(value)&&(value===0||round2(value)!==round2(expected)))overrides[owner]=round2(value);
      });
      if(Object.keys(overrides).length)target.monthlyIncomeOverrides[month]=overrides;
    });
    target.meta.incomeHistoryMigrated=true;
  }
  u3MigrateFixedExpenses(target);
  u3MigrateIncomeSources(target);
  ['voor','na'].forEach(scenario=>{
    target.recurringFixedExpenses[scenario]=(target.recurringFixedExpenses[scenario]||[]).filter(isPlainObject).map(item=>u3NormalizeRecurringItem(item,'fixed'));
  });
  target.recurringIncomeSources=target.recurringIncomeSources.filter(isPlainObject).map(item=>u3NormalizeRecurringItem(item,'income'));
  target.transactionReviewQueue=Array.isArray(target.transactionReviewQueue)?target.transactionReviewQueue.filter(isPlainObject):[];
  target.recognitionRules=Array.isArray(target.recognitionRules)?target.recognitionRules.filter(isPlainObject).map(u3RecognitionFromLegacy):[];
  (target.bankImportRules||[]).forEach(rule=>{
    const normalized=u3RecognitionFromLegacy(rule);
    if(normalized.text && !target.recognitionRules.some(item=>item.text===normalized.text && item.account===normalized.account)) target.recognitionRules.push(normalized);
  });
  target.monthRecords=isPlainObject(target.monthRecords)?target.monthRecords:{};
  target.accountSettings=isPlainObject(target.accountSettings)?target.accountSettings:{};
  U3_ACCOUNTS.forEach(account=>{
    const row=isPlainObject(target.accountSettings[account])?target.accountSettings[account]:{};
    target.accountSettings[account]={openingBalance:round2(Number(row.openingBalance)||0),effectiveMonth:/^\d{4}-\d{2}$/.test(row.effectiveMonth)?row.effectiveMonth:String(target.meta.selectedMonth||monthKey()),openingBalanceSet:row.openingBalanceSet===true};
  });
  ['reserveLedger','advanceLedger','internalTransfers','monthCorrections'].forEach(key=>{target[key]=Array.isArray(target[key])?target[key].filter(isPlainObject):[];});
  target.transactions=Array.isArray(target.transactions)?target.transactions:[];
  target.transactions.forEach(tx=>{
    tx.reviewStatus=tx.reviewStatus||'bevestigd';
    tx.account=U3_ACCOUNTS.includes(tx.account)?tx.account:(U3_ACCOUNTS.includes(tx.owner)?tx.owner:'gezamenlijk');
    tx.financialFor=U3_ACCOUNTS.includes(tx.financialFor)?tx.financialFor:tx.account;
    tx.owner=tx.financialFor;
    tx.fixedExpenseId=tx.fixedExpenseId||'';
    tx.fixedOccurrenceId=tx.fixedOccurrenceId||'';
    tx.incomeSourceId=tx.incomeSourceId||'';
    tx.incomeOccurrenceId=tx.incomeOccurrenceId||'';
  });
  Object.entries(target.monthRecords).forEach(([month,record])=>{
    if(!isPlainObject(record)){delete target.monthRecords[month];return;}
    record.month=month; record.status=['afgesloten','correctie-nodig'].includes(record.status)?record.status:'open';
    record.closedAt=record.closedAt||''; record.reopenedAt=record.reopenedAt||'';
    record.closureHistory=(Array.isArray(record.closureHistory)?record.closureHistory.filter(isPlainObject):[])
      .map(closure=>u3NormalizeClosureSnapshot(month,record,closure));
    record.activeClosureId=record.activeClosureId||'';
  });
  ['reserveLedger','internalTransfers','monthCorrections','savingsGoalLedger'].forEach(key=>{
    (target[key]||[]).forEach(row=>{
      if(!row.sourceClosingId&&row.closureId)row.sourceClosingId=row.closureId;
    });
  });
  target.meta.schemaVersion=U3_SCHEMA_VERSION;
  return target;
}

function normalizeBudgetState(candidate){
  const normalized = candidate || defaultState();
  normalized.meta = isPlainObject(normalized.meta) ? normalized.meta : {};
  normalized.meta.scenario = ['voor','na'].includes(normalized.meta.scenario) ? normalized.meta.scenario : 'voor';
  normalized.meta.selectedMonth = normalized.meta.selectedMonth || monthKey();
  normalized.meta.schemaVersion = Number(normalized.meta.schemaVersion) || U3_SCHEMA_VERSION;
  normalized.meta.revision = Math.max(0, Number(normalized.meta.revision) || 0);
  normalized.meta.updatedAt = normalized.meta.updatedAt || '';
  normalized.meta.updatedBy = normalized.meta.updatedBy || getDeviceId();
  normalized.monthlyIncome = isPlainObject(normalized.monthlyIncome) ? normalized.monthlyIncome : {};
  normalized.monthlyBudgets = isPlainObject(normalized.monthlyBudgets) ? normalized.monthlyBudgets : {};
  normalized.monthlyTeruggaven = isPlainObject(normalized.monthlyTeruggaven) ? normalized.monthlyTeruggaven : {};
  normalized.spaardoelGeschiedenis = isPlainObject(normalized.spaardoelGeschiedenis) ? normalized.spaardoelGeschiedenis : {};
  normalized.transactions = Array.isArray(normalized.transactions) ? normalized.transactions : [];
  normalized.bankImportRules = Array.isArray(normalized.bankImportRules) ? normalized.bankImportRules : [];
  normalizePersonDefaults(normalized);
  normalizeIncomeDefaults(normalized);
  u3NormalizeState(normalized);
  state = normalized;
  ensureMonthData(normalized.meta.selectedMonth);
  normalizeGoalDefaults();
  ensurePersistentIds(normalized);
  return normalized;
}
function getMonthlyBaseIncome(person,month=getSelectedMonth()){
  ensureMonthData(month);
  return getDistributionIncomeParts(person,month).salary;
}
function sumVasteTeruggaven(person,month=getSelectedMonth()){
  ensureMonthData(month);
  return getDistributionIncomeParts(person,month).refund;
}
function sumMaandTeruggaven(person, month=getSelectedMonth()){
  ensureMonthData(month);
  return sumBedrag(state.monthlyTeruggaven?.[month]?.[person] || []);
}
function getTotalMonthlyIncome(person,month=getSelectedMonth()){
  const parts=getDistributionIncomeParts(person,month);
  return round2(parts.salary+parts.refund+sumMaandTeruggaven(person,month));
}
function getMonthlyIncome(person){ return getMonthlyBaseIncome(person); }
function setMonthlyIncome(person, amount){
  const month=getSelectedMonth();
  assertMonthMutationAllowed(month);ensureMonthData(month);
  state.monthlyIncomeOverrides[month]=isPlainObject(state.monthlyIncomeOverrides[month])?state.monthlyIncomeOverrides[month]:{};
  state.monthlyIncomeOverrides[month][person]=round2(Number(amount)||0);
  state.monthlyIncome[month][person]=round2(Number(amount)||0);
}
function getMonthlyScenarioData(scenario=state.meta.scenario){
  const month = getSelectedMonth();
  ensureMonthData(month);
  const base = state[scenario];
  const monthly = state.monthlyBudgets?.[month]?.[scenario];
  return {
    ...base,
    gezamenlijk: {
      ...base.gezamenlijk,
      variabel: monthly?.gezamenlijkVariabel || base.gezamenlijk.variabel
    },
    dion: {
      ...base.dion,
      variabel: monthly?.dionVariabel || base.dion.variabel
    },
    dara: {
      ...base.dara,
      variabel: monthly?.daraVariabel || base.dara.variabel
    }
  };
}
function getMonthTransactions(owner=null, month=getSelectedMonth()){
  return (state.transactions||[]).filter(tx => transactionMonth(tx) === month && (!owner || tx.owner === owner));
}
function normalizedTransactionType(tx){
  const values=[tx?.transactionType,tx?.type,tx?.processing?.transactionType,tx?.kind,tx?.category]
    .map(value=>String(value||'').trim().toLocaleLowerCase('nl-NL').replace(/[ _]+/g,'-'));
  const joined=values.join('|');
  if(/naar-?spaar-?rekening|storten-?naar-?spaar/.test(joined))return 'naar-spaarrekening';
  if(/van-?spaar-?rekening|opnemen-?van-?spaar/.test(joined))return 'van-spaarrekening';
  if(/interne-?overboeking|eigen-?rekening/.test(joined))return 'interne-overboeking';
  if(/maandelijkse-?bijdrage/.test(joined))return 'maandelijkse-bijdrage';
  if(/extra-?bijdrage/.test(joined))return 'extra-bijdrage';
  if(/vaste-?last|fixed-?expense/.test(joined))return 'vaste-last';
  if(/sparen|spaardoel/.test(joined))return 'sparen';
  return values.find(Boolean)||'';
}
function isBudgetExpenseTransaction(tx){
  if(!tx||tx.processing?.include===false||tx.kind==='niet-meetellen')return false;
  const kind=String(tx.kind||'').toLocaleLowerCase('nl-NL').replace(/[ _]+/g,'-');
  const type=normalizedTransactionType(tx);
  if(['inkomen','interne-overboeking','terugbetaling','niet-meetellen','vaste-last','fixed-expense'].includes(kind))return false;
  if(tx.fixedExpenseId||tx.processing?.fixedExpenseId||tx.vasteLastId||tx.processing?.vasteLastId)return false;
  if(['vaste-last','fixed-expense','sparen','naar-spaarrekening','van-spaarrekening','interne-overboeking','maandelijkse-bijdrage','extra-bijdrage','terugbetaling-voorschot','terugbetaling','niet-meetellen','salaris','vakantiegeld','nabetaling','vergoeding','belastingteruggave','overige-inkomsten'].includes(type))return false;
  return true;
}
function getTransactionExpenseImpact(tx){
  if(!isBudgetExpenseTransaction(tx))return 0;
  const stored=Number(tx.expenseImpact);
  if(tx.expenseImpact!==null&&tx.expenseImpact!==''&&Number.isFinite(stored))return round2(Math.max(0,stored));
  return round2(Math.abs(Number(tx.amount)||0));
}
function sumTransactions(owner=null, category=null, month=getSelectedMonth()){
  return round2(getMonthTransactions(owner, month).reduce((sum, tx)=>{
    if (category){
      const txCat = String(tx.category||'').toLowerCase();
      const wanted = String(category).toLowerCase();
      if (!txCat || !(txCat === wanted || txCat.includes(wanted) || wanted.includes(txCat))) return sum;
    }
    return sum + getTransactionExpenseImpact(tx);
  }, 0));
}
function transactionsByCategory(owner, month=getSelectedMonth()){
  const totals = {};
  getMonthTransactions(owner, month).forEach(tx=>{
    const key = tx.category || 'Overig';
    totals[key] = round2((totals[key]||0) + getTransactionExpenseImpact(tx));
  });
  return totals;
}
function dashboardIncomeBreakdown(month=getSelectedMonth()){
  const distributionIncome=round2(calcScenario(state).totaalSalaris);
  const standard={dion:getDistributionIncomeParts('dion',month),dara:getDistributionIncomeParts('dara',month)};
  const rows=(state.transactions||[]).filter(tx=>transactionMonth(tx)===month&&tx.reviewStatus!=='genegeerd'&&tx.processing?.include!==false&&tx.kind!=='niet-meetellen');
  const salaryActual={dion:0,dara:0,gezamenlijk:0};
  const salarySeen={dion:false,dara:false,gezamenlijk:false};
  let extraTransactions=0;
  rows.forEach(tx=>{
    const type=String(tx.transactionType||tx.type||'').toLowerCase();
    const kind=String(tx.kind||'').toLowerCase();
    const isIncome=kind==='inkomen';
    const isRefund=type==='terugbetaling'||kind==='terugbetaling';
    if(!isIncome&&!isRefund)return;
    const owner=u3IncomeTransactionOwner(tx);
    const amount=Math.abs(Number(tx.amount)||0);
    if(type==='salaris'&&(owner==='dion'||owner==='dara'||owner==='gezamenlijk')){salaryActual[owner]=round2(salaryActual[owner]+amount);salarySeen[owner]=true;return;}
    extraTransactions=round2(extraTransactions+amount);
  });
  const visibleBase=round2((salarySeen.dion?salaryActual.dion:standard.dion.salary)+standard.dion.refund+(salarySeen.dara?salaryActual.dara:standard.dara.salary)+standard.dara.refund+(salarySeen.gezamenlijk?salaryActual.gezamenlijk:0));
  const manualRefunds=round2(sumMaandTeruggaven('dion',month)+sumMaandTeruggaven('dara',month)+sumMaandTeruggaven('gezamenlijk',month));
  const extra=round2(extraTransactions+manualRefunds);
  return {distributionIncome,extra,total:round2(visibleBase+extra),visibleBase};
}
function budgetCategoryMatches(tx, category){
  const txCat=String(tx?.category||'').trim().toLocaleLowerCase('nl-NL');
  const wanted=String(category||'').trim().toLocaleLowerCase('nl-NL');
  return !!wanted && !!txCat && (txCat===wanted || txCat.includes(wanted) || wanted.includes(txCat));
}
function budgetStatus(used, budget){
  if (!budget) return {ratio:0, label:'Geen budget', cls:'muted'};
  const ratio = used / budget;
  if (ratio > 1) return {ratio, label:'Overschreden', cls:'red'};
  if (ratio >= .85) return {ratio, label:'Bijna vol', cls:'amber'};
  return {ratio, label:'Op schema', cls:''};
}
function textSafe(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function goalIcon(goal){
  return iconSvg(goalIconName(goal));
}
function goalThumbGradient(goal){
  const name = String(goal?.naam || '').toLowerCase();
  if (/vakantie|reis|travel|vliegtuig|japan|fonds/.test(name)) return 'linear-gradient(135deg,#8fb7d8,#5f8fb8)';
  if (/buffer|nood|reserve|veilig/.test(name)) return 'linear-gradient(135deg,#a7c8ba,#5f9c86)';
  if (/beleg|invest|aandeel/.test(name)) return 'linear-gradient(135deg,#c7cf8a,#8a9c4f)';
  if (/koffie|coffee/.test(name)) return 'linear-gradient(135deg,#d8b48f,#a8703f)';
  if (/huis|inrichting|wonen|keuken|tuin/.test(name)) return 'linear-gradient(135deg,#e0b98f,#c17f4a)';
  if (/hond|dieren|huisdier/.test(name)) return 'linear-gradient(135deg,#e0a2a2,#c46b6b)';
  if (/auto|vervoer/.test(name)) return 'linear-gradient(135deg,#b7b7c7,#7d7d99)';
  return 'linear-gradient(135deg, var(--green-soft), var(--green))';
}
function iconSvg(name){
  const icons = {
    income:'<path d="M4 15h10"/><path d="M4 10h16"/><path d="M4 19h12"/><circle cx="18" cy="16" r="3"/>',
    incomecard:'<rect x="3.5" y="6" width="17" height="11.5" rx="2.4"/><circle cx="12" cy="11.75" r="2.5"/><path d="M10.7 11.75h2.7"/><path d="M12 10.4v2.7"/><path d="M6.2 9.1h1.2M16.6 14.3h1.2"/>',
    jointfund:'<rect x="3.5" y="7" width="17" height="10.5" rx="2.3"/><path d="M7 7V5.8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2V7"/><path d="M8 12h8"/><path d="M12 9.7v4.6"/>',
    budgetmeter:'<path d="M5 17a7 7 0 0 1 14 0"/><path d="M12 10v4.5"/><path d="M17.5 10.5l-3.2 2.2"/><circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none"/><path d="M6.4 17H5"/><path d="M19 17h-1.4"/>',
    users:'<path d="M8 13a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Z"/><path d="M16.5 11.5a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z"/><path d="M3.5 19.5a5.5 5.5 0 0 1 9 0"/><path d="M13 19.5a4.5 4.5 0 0 1 7.5-2.5"/>',
    wallet:'<path d="M4 8.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M15 13.5h5"/><circle cx="15.5" cy="13.5" r=".5" fill="currentColor" stroke="none"/><path d="M6 8.5V7a2 2 0 0 1 2-2h9"/>',
    allowance:'<circle cx="17.5" cy="7.5" r="2.5"/><path d="M3.5 13.5h3v5.5h-3Z"/><path d="M6.5 16h3.2c.7 0 1.3-.6 1.3-1.3 0-.7-.6-1.2-1.3-1.2H8.8"/><path d="M6.5 17.9h7.1c.6 0 1.1-.2 1.5-.6l1.9-1.8c.3-.3.7-.5 1.1-.5H20"/><path d="M15.2 10.7h4.6"/>',
    split:'<path d="M12 5v14"/><path d="M8 9l4-4l4 4"/><path d="M8 15l4 4l4-4"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    chart:'<path d="M5 18V9"/><path d="M11 18V6"/><path d="M17 18V12"/><path d="M3 18h18"/>',
    list:'<path d="M9 7h10"/><path d="M9 12h10"/><path d="M9 17h10"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none"/>',
    person:'<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
    cart:'<circle cx="9" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/><path d="M4.5 6h2l1.6 8h8.7l1.7-6H7"/>',
    fuel:'<path d="M7 19V6.5A1.5 1.5 0 0 1 8.5 5h5A1.5 1.5 0 0 1 15 6.5V19"/><path d="M7 11h8"/><path d="M15 8h2l2 2v7a1.5 1.5 0 0 1-3 0v-3"/>',
    spark:'<path d="M12 4.5l1.9 4.1l4.6.5l-3.4 3l1 4.4L12 14.3L7.9 16.5l1-4.4l-3.4-3l4.6-.5L12 4.5Z"/>',
    home:'<path d="M4.5 11.5L12 5l7.5 6.5"/><path d="M6.5 10.5V19h11v-8.5"/><path d="M10 19v-4.5h4V19"/>',
    plane:'<path d="M21 4L10 13"/><path d="M21 4l-7 17l-4-8l-8-4l19-5Z"/>',
    shield:'<path d="M12 4l6 2v5c0 4.2-2.5 7.3-6 9c-3.5-1.7-6-4.8-6-9V6l6-2Z"/>',
    trend:'<path d="M4 16l5-5l3 3l7-7"/><path d="M14 7h5v5"/>',
    coffee:'<path d="M6 9h9v4a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9Z"/><path d="M15 10h1.5a2 2 0 0 1 0 4H15"/><path d="M8 5v2"/><path d="M11 5v2"/>',
    car:'<path d="M5 15l1.5-4h11L19 15"/><path d="M4 15h16v3H4Z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
    house:'<path d="M4.5 11.5L12 5l7.5 6.5"/><path d="M6.5 10.5V19h11v-8.5"/><path d="M10 19v-4.5h4V19"/>',
    heart:'<path d="M12 19s-6.5-4-8-7.8C2.8 8.8 4.3 6 7.2 6c1.8 0 3 .9 3.8 2c.8-1.1 2-2 3.8-2c2.9 0 4.4 2.8 3.2 5.2C18.5 15 12 19 12 19Z"/>',
    piggy:'<path d="M5.2 12.7c0-3.4 2.8-6.1 6.8-6.1c1.9 0 3.6.6 4.8 1.6l2.2-1.9v3.4c.8.7 1.3 1.6 1.5 2.6h1.3v3h-1.6c-.7 1.7-2.1 3-3.9 3.7v2H13.7v-1.5h-3.4V21H7.7v-2.6c-1.5-1.1-2.5-3.2-2.5-5.7Z"/><path d="M9.2 7.4c.3-2.1 1.6-3.8 3.3-3.8c1.8 0 3.1 1.9 3.3 4.1"/><path d="M9.7 8.6c1.6-.4 4-.5 5.7-.1"/><path d="M13.9 8.1h3.1"/><path d="M5.4 10.5c-1.1-.7-2-.4-2.2.4c-.2.8.5 1.4 1.5 1"/><circle cx="17.3" cy="12.2" r=".65" fill="currentColor" stroke="none"/>',
    euro:'<path d="M15.5 7.5a4.8 4.8 0 0 0-2.9-1c-2.5 0-4.6 1.8-5.1 4.2"/><path d="M6.5 11H13"/><path d="M6 14h6.5"/><path d="M7.5 14c.5 2.3 2.6 4 5 4c1.1 0 2.1-.3 3-.9"/>',
    drop:'<path d="M12 3.5s-5 5.4-5 9.5a5 5 0 0 0 10 0c0-4.1-5-9.5-5-9.5Z"/><path d="M9.3 14a2.8 2.8 0 0 0 2.7 2.7"/>',
    bolt:'<path d="M13 2.8L5.5 13h5L9.8 21.2L18.5 10h-5L13 2.8Z"/>',
    building:'<path d="M5 20V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V20"/><path d="M3.5 20h17"/><path d="M8 9h2M14 9h2M8 13h2M14 13h2M11 20v-4h2v4"/>',
    phone:'<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.5h2"/>',
    play:'<rect x="4.5" y="6.5" width="15" height="11" rx="2"/><path d="M10.5 9.5l4 2.5l-4 2.5Z"/>',
    receipt:'<path d="M6 4h12v16l-2-1.2L14 20l-2-1.2L10 20l-2-1.2L6 20V4Z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    more:'<circle cx="7" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    dashboard:'<rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/>',
    shared:'<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="8" r="2.6"/><path d="M3.8 18a4.2 4.2 0 0 1 8.4 0"/><path d="M11.8 18a4.2 4.2 0 0 1 8.4 0"/><path d="M10 11.8h4"/>',
    cloud:'<path d="M7.5 18H18a3 3 0 0 0 .4-6A5.5 5.5 0 0 0 8 10.2A4 4 0 0 0 7.5 18Z"/><path d="M9.5 14.5l2 2l3.5-4"/>',
    calendar:'<rect x="4" y="5.5" width="16" height="14.5" rx="2.2"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/><path d="M8 13h2M14 13h2M8 16.5h2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    edit:'<path d="M5 19l3.5-.8L19 7.7L16.3 5L5.8 15.5L5 19Z"/><path d="M14.8 6.5l2.7 2.7"/>',
    trash:'<path d="M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13M10 10.5v6M14 10.5v6"/>',
    upload:'<path d="M12 16V5M8 9l4-4l4 4"/><path d="M5 16v3h14v-3"/>',
    download:'<path d="M12 5v11M8 12l4 4l4-4"/><path d="M5 19h14"/>',
    sync:'<path d="M18 8a7 7 0 0 0-11-2L4 9"/><path d="M4 5v4h4"/><path d="M6 16a7 7 0 0 0 11 2l3-3"/><path d="M20 19v-4h-4"/>',
    undo:'<path d="M9 7L5 11l4 4"/><path d="M5 11h8a6 6 0 0 1 6 6"/>',
    check:'<path d="M5 12.5l4 4L19 6.5"/>',
    close:'<path d="M6 6l12 12M18 6L6 18"/>',
    filter:'<path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10.5V17"/><circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none"/>',
    warning:'<path d="M12 4l9 16H3L12 4Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none"/>',
    tax:'<path d="M6 4h9l3 3v13H6V4Z"/><path d="M15 4v4h4M9 11h6M9 15h4"/>',
    water:'<path d="M12 3.5s-5 5.4-5 9.5a5 5 0 0 0 10 0c0-4.1-5-9.5-5-9.5Z"/>',
    energy:'<path d="M13 2.8L5.5 13h5L9.8 21.2L18.5 10h-5L13 2.8Z"/>',
    internet:'<path d="M4 9a12 12 0 0 1 16 0M7 12a8 8 0 0 1 10 0M10 15a4 4 0 0 1 4 0"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>',
    pension:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    debt:'<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
    transfer:'<path d="M5 8h13M15 5l3 3l-3 3M19 16H6M9 13l-3 3l3 3"/>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    image:'<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M5.5 17l4.5-4l3 2.5l2.5-2l3 3.5"/>'
  };
  return `<svg viewBox="0 0 24 24" class="ui-svg" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.wallet}</svg>`;
}
function iconBadge(name, tone='green', extra=''){
  return `<span class="icon-badge tone-${tone} ${extra}">${iconSvg(name)}</span>`;
}

const FINIZE_NAV_ICONS={dashboard:'dashboard',gezamenlijk:'shared',dion:'person',dara:'person',spaardoelen:'target',data:'cloud'};
function finizeIconWrap(name, cls='finize-action-icon'){
  return `<span class="${cls}" aria-hidden="true">${iconSvg(name)}</span>`;
}
function applyFinizeIconSystem(root=document){
  root.querySelectorAll('.tab-btn[data-tab] .u5-nav-icon').forEach(slot=>{
    const tab=slot.closest('[data-tab]')?.dataset.tab;
    const iconName=FINIZE_NAV_ICONS[tab]||'dashboard';
    if(slot.dataset.finizeIcon===iconName) return;
    slot.dataset.finizeIcon=iconName;
    slot.innerHTML=iconSvg(iconName);
  });
  root.querySelectorAll('.bottom-nav-btn[data-tab] .bn-icon').forEach(slot=>{
    const tab=slot.closest('[data-tab]')?.dataset.tab;
    const iconName=FINIZE_NAV_ICONS[tab]||'dashboard';
    if(slot.dataset.finizeIcon===iconName) return;
    slot.dataset.finizeIcon=iconName;
    slot.innerHTML=iconSvg(iconName);
  });
  const monthButton=root.querySelector('#monthPickerButton');
  if(monthButton&&!monthButton.querySelector('.finize-action-icon')){
    const text=monthButton.textContent.trim();
    monthButton.innerHTML=finizeIconWrap('calendar')+`<span class="month-picker-label">${text}</span>`;
  }
  const buttonRules=[
    ['[data-open-transaction], [data-open-joint-transaction], [data-open-personal-transaction]', 'plus'],
    ['[data-addrow], [data-addrefund], [data-addgoal], [data-add-subgoal], [data-add-account]', 'plus'],
    ['[data-open-owner-fixed], [data-open-owner-variable], .joint-fixed-edit-btn, .joint-variable-edit-btn', 'edit'],
    ['[data-remove], [data-remove-transaction], .danger-ghost', 'trash'],
    ['#btnExport, [data-export]', 'download'],
    ['#btnImport, [data-import]', 'upload'],
    ['#btnRestoreBackup, [data-restore]', 'undo'],
    ['#btnConnectFirebase, #btnUploadCloud, [data-sync]', 'sync'],
    ['#btnSaveFirebaseConfig, #btnSaveTransaction, [data-save]', 'check'],
    ['#btnCloseTransaction, #btnCancelTransaction, [data-close]', 'close']
  ];
  buttonRules.forEach(([selector,name])=>{
    root.querySelectorAll(selector).forEach(btn=>{
      if(!(btn instanceof HTMLElement)||btn.querySelector(':scope > .finize-action-icon')) return;
      btn.classList.add('has-finize-icon');
      btn.insertAdjacentHTML('afterbegin',finizeIconWrap(name));
    });
  });
  root.querySelectorAll('button').forEach(btn=>{
    if(btn.querySelector(':scope > .finize-action-icon')) return;
    const cue=`${btn.textContent||''} ${btn.getAttribute('aria-label')||''} ${btn.title||''}`.toLowerCase();
    let name='';
    if(/verwijder|wissen|prullen/.test(cue)) name='trash';
    else if(/bewerk|aanpassen/.test(cue)) name='edit';
    else if(/toevoegen|nieuwe|uitgave toevoegen/.test(cue)) name='plus';
    else if(/opslaan|bevestig|goedkeur/.test(cue)) name='check';
    else if(/import/.test(cue)) name='upload';
    else if(/export/.test(cue)) name='download';
    else if(/herstel|terugzetten/.test(cue)) name='undo';
    else if(/synchron|cloud verbinden|verbinden met cloud/.test(cue)) name='sync';
    if(!name) return;
    btn.classList.add('has-finize-icon');
    btn.insertAdjacentHTML('afterbegin',finizeIconWrap(name));
  });
  root.querySelectorAll('td:first-child').forEach(cell=>{
    const text=cell.textContent.trim();
    if(/^[⌂~⚡◆▤▶◌▣□€•…]$/.test(text)){
      const row=cell.closest('tr');
      const category=row?.querySelector('input[data-path$=".categorie"]')?.value||row?.querySelector('td:nth-child(2) input')?.value||'';
      cell.classList.add('finize-icon-cell');
      cell.innerHTML=iconSvg(categoryIconName(category));
    }
  });
}
let finizeIconObserver;
function startFinizeIconObserver(){
  applyFinizeIconSystem(document);
  if(finizeIconObserver) return;
  let queued=false;
  finizeIconObserver=new MutationObserver(()=>{
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;applyFinizeIconSystem(document);});
  });
  finizeIconObserver.observe(document.body,{childList:true,subtree:true});
}
function dashboardSectionIconName(title){
  const t = String(title||'').toLowerCase();
  if (/gezamenlijke rekening/.test(t)) return 'wallet';
  if (/zakgeld/.test(t)) return 'allowance';
  if (/gezamenlijk budget/.test(t)) return 'chart';
  if (/spaardoelen/.test(t)) return 'piggy';
  if (/jaaroverzicht/.test(t)) return 'chart';
  if (/vaste lasten/.test(t)) return 'list';
  if (/gezamenlijk/.test(t)) return 'wallet';
  if (/dion|dara/.test(t)) return 'person';
  return 'wallet';
}
function categoryIconName(categorie){
  const c = String(categorie||'').toLowerCase();
  if (/boodschap|supermarkt|eten|restaurant/.test(c)) return 'cart';
  if (/benzine|tank|brandstof/.test(c)) return 'fuel';
  if (/auto|vervoer|ov|trein|bus/.test(c)) return 'car';
  if (/uitje|entertainment|vrije tijd|hobby|netflix|spotify|disney|prime/.test(c)) return 'spark';
  if (/hypotheek|huis|wonen|huur|vve/.test(c)) return 'house';
  if (/water|evides/.test(c)) return 'water';
  if (/energie|eneco|gas|stroom|warmtepomp/.test(c)) return 'energy';
  if (/verzeker/.test(c)) return 'shield';
  if (/belasting|gemeente|waterschap/.test(c)) return 'tax';
  if (/internet|wifi/.test(c)) return 'internet';
  if (/telefoon|mobiel/.test(c)) return 'phone';
  if (/pensioen/.test(c)) return 'pension';
  if (/schuld|duo|lening|correctie/.test(c)) return 'debt';
  if (/beleg|invest|aandeel/.test(c)) return 'trend';
  if (/spaar|buffer/.test(c)) return 'piggy';
  if (/inkom|salaris|teruggave|toeslag/.test(c)) return 'incomecard';
  if (/huisdier|hond|kat/.test(c)) return 'heart';
  return 'more';
}
function goalIconName(goal){
  const name = String(goal?.naam || '').toLowerCase();
  if (/vakantie|reis|travel|vliegtuig|japan/.test(name)) return 'plane';
  if (/buffer|nood|reserve|veilig/.test(name)) return 'shield';
  if (/beleg|invest|aandeel/.test(name)) return 'trend';
  if (/koffie|coffee/.test(name)) return 'coffee';
  if (/huis|inrichting|wonen|keuken|tuin/.test(name)) return 'home';
  if (/hond|dieren|huisdier/.test(name)) return 'heart';
  if (/auto|vervoer/.test(name)) return 'car';
  return 'target';
}
function ownerTone(owner){
  const o = String(owner||'').toLowerCase();
  if (o === 'dion') return 'dion';
  if (o === 'dara') return 'dara';
  return 'green';
}
function renderDashboardCardHead(title, hint='', tone='green'){
  return `<div class="card-head"><div class="card-head-title">${iconBadge(dashboardSectionIconName(title), tone, 'card-head-icon')}<h2>${title}</h2></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
}

function ownerLabel(owner){ return owner === 'gezamenlijk' ? 'Gezamenlijk' : (state.personen?.[owner]?.naam || (owner === 'dion' ? 'Dion' : 'Dara')); }
function renderJointFixedCostsCardHead(owner='gezamenlijk'){
  const name = ownerLabel(owner);
  return `<div class="card-head joint-fixed-card-head">
    <div class="card-head-title">${iconBadge(dashboardSectionIconName('Vaste lasten verdeling'), 'green', 'card-head-icon')}<h2>${owner === 'gezamenlijk' ? 'Vaste lasten verdeling' : `${name} vaste lasten`}</h2><button type="button" class="joint-fixed-edit-btn" data-open-owner-fixed="${owner}" aria-label="Vaste lasten aanpassen">${iconSvg('receipt')}</button></div>
  </div>`;
}
function renderJointVariableCostsCardHead(owner='gezamenlijk'){
  const name = ownerLabel(owner);
  return `<div class="card-head joint-variable-card-head">
    <div class="card-head-title">${iconBadge('chart', 'green', 'card-head-icon')}<h2>${owner === 'gezamenlijk' ? 'Variabele lasten' : `${name} variabele lasten`}</h2><button type="button" class="joint-variable-edit-btn" data-open-owner-variable="${owner}" aria-label="Variabele lasten aanpassen">${iconSvg('receipt')}</button></div>
  </div>`;
}
function jointVariableCategoryOptions(selectedCategory='', owner='gezamenlijk'){
  const scenarioData = getMonthlyScenarioData(state.meta.scenario);
  const seen = new Set();
  const categories = [];
  (scenarioData[owner]?.variabel || []).forEach(row=>{
    const rawLabel = String(row.post || row.categorie || '').trim();
    const key = rawLabel.toLocaleLowerCase();
    if (!rawLabel || seen.has(key)) return;
    seen.add(key);
    categories.push(key === 'overig' ? 'Overig' : rawLabel);
  });
  if (!seen.has('overig')) categories.push('Overig');
  const selectedKey = String(selectedCategory || '').trim().toLocaleLowerCase();
  if (selectedCategory && !seen.has(selectedKey)) categories.push(String(selectedCategory).trim());
  return categories;
}
function renderJointTransactionsCardHead(){
  return `<div class="card-head joint-transactions-card-head">
    <div class="card-head-title"><h2>Gezamenlijke transacties <span>— ${monthLabel(getSelectedMonth())}</span></h2><button type="button" class="joint-transaction-add-btn" data-open-joint-transaction aria-label="Gezamenlijke uitgave toevoegen">${iconSvg('receipt')}</button></div>
  </div>`;
}
function renderJointTransactionsCard(){
  const rows = getMonthTransactions('gezamenlijk').filter(isBudgetExpenseTransaction).sort((a,b)=>String(b.date || '').localeCompare(String(a.date || '')));
  const rowsHtml = rows.map(tx=>`<div class="joint-transaction-row" data-edit-joint-transaction="${tx.id}" role="button" tabindex="0" aria-label="Transactie ${textSafe(tx.description || tx.category || 'bewerken')} bewerken">
    <span class="joint-transaction-meta"><span class="joint-transaction-date" title="${formatDateNL(tx.date)}">${formatDayMonth(tx.date)}</span><span class="joint-transaction-category" title="${textSafe(tx.category || 'Overig')}">${textSafe(tx.category || 'Overig')}</span></span>
    <span class="joint-transaction-description"><span class="joint-transaction-description-text" title="${textSafe(tx.description || '')}">${textSafe(tx.description || '—')}</span>${tx.note ? `<span class="joint-transaction-note" title="${textSafe(tx.note)}">${textSafe(tx.note)}</span>` : ''}</span>
    <strong class="joint-transaction-amount">${eur(Number(tx.amount) || 0)}</strong>
    <button type="button" class="joint-transaction-delete" data-remove-transaction="${tx.id}" aria-label="Transactie verwijderen">×</button>
  </div>`).join('');
  return `<div class="card joint-two-column-card joint-transactions-card">${renderJointTransactionsCardHead()}<div class="joint-transactions-list">${rowsHtml || '<p class="joint-transactions-empty">Nog geen uitgaven deze maand.</p>'}</div><div class="joint-transactions-total"><span>Totaal uitgaven</span><strong>${eur(sumTransactions('gezamenlijk'))}</strong></div></div>`;
}

function legacyIconName(icon){
  const map={'▤':'receipt','◈':'wallet','↗':'trend','◔':'budgetmeter','▥':'dashboard','◎':'target','€':'euro','⌘':'list','☁':'cloud','✈':'plane','⌂':'house'};
  return map[String(icon||'').trim()] || (String(icon||'').includes('<svg') ? '' : String(icon||'').trim());
}
function renderIconContent(icon){
  if(String(icon||'').includes('<svg')) return icon;
  const name=legacyIconName(icon);
  return iconSvg(name||'wallet');
}
function renderIconKpi(icon, color, label, value, sub, opts={}){
  const valClass = opts.valueClass ? ` ${opts.valueClass}` : '';
  return `<div class="card metric-card icon-kpi ${opts.span || 'span-3'}">
    <div class="icon-kpi-top"><span class="icon-circle ${color}">${renderIconContent(icon)}</span><div class="metric-label">${label}</div></div>
    <div class="metric-value${valClass}">${value}</div>
    ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
  </div>`;
}
function renderStatusCard(icon, color, title, desc, extra=''){
  return `<div class="card status-card span-4">
    <span class="icon-circle ${color}">${renderIconContent(icon)}</span>
    <div><h3>${title}</h3><p>${desc}</p>${extra}</div>
  </div>`;
}
function renderEmptyState(icon, title, text, action=''){
  return `<div class="empty-state"><span class="icon-circle">${renderIconContent(icon)}</span><h4>${title}</h4><p>${text}</p>${action}</div>`;
}
function renderPageHeading(title, subtitle){
  return `<div class="page-heading"><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`;
}
function goalStatusBadge(progress){
  if (progress >= 1) return '<span class="status-badge">Op schema</span>';
  if (progress >= .75) return '<span class="status-badge amber">Bijna klaar</span>';
  return '<span class="status-badge muted">Nog te gaan</span>';
}
function renderModernGoalCard(item, owner, opts={}){
  const doel = item.doel || item;
  const doelbedrag = Number(doel.doelbedrag)||0;
  const algespaard = Number(doel.algespaard)||0;
  const progress = doelbedrag > 0 ? Math.min(1, algespaard / doelbedrag) : 0;
  const barPct = Math.round(progress * 100);
  const dateText = doel.doeldatum ? formatDateNL(doel.doeldatum) : 'Geen doeldatum';
  const goalImage = String(goalImageSource(doel) || '').replace(/'/g,'%27');
  const goalThumbStyle = goalImage
    ? `background-image:url('${goalImage}'); box-shadow:none;`
    : `background:${goalThumbGradient(doel)}; color:#fff; box-shadow:none;`;
  return `<div class="goal-card">
    <div class="goal-card-head">
      <div class="goal-card-title">
        <div class="goal-thumb${goalImage ? ' has-image' : ''}" style="${goalThumbStyle}">${goalImage ? '' : goalIcon(doel)}</div>
        <div>
          <h3>${textSafe(doel.naam || 'Spaardoel')}</h3>
          <div class="goal-owner">${textSafe(owner)}</div>
        </div>
      </div>
      ${goalStatusBadge(progress)}
    </div>
    <div class="goal-money"><span>${eur(algespaard)} van ${eur(doelbedrag)}</span><strong>${barPct}%</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${barPct}%"></div></div>
    <div class="goal-card-foot">
      <span>Doel: ${dateText}</span>
      <button class="ghost small" type="button" data-tab-shortcut="${opts.targetTab || 'spaardoelen'}">Bekijk doel</button>
    </div>
  </div>`;
}
function renderModernGoalCards(doelen, pot, owner, limit=null){
  let items = calcGroep(doelen || [], pot, TODAY);
  if (limit) items = items.slice(0, limit);
  if (!items.length) return '<p class="muted-empty">Nog geen spaardoelen.</p>';
  return `<div class="goal-card-grid">${items.map(item=>renderModernGoalCard(item, owner)).join('')}</div>`;
}
function goalMonthlyInlegText(item){
  const total=Number(item.werkelijkeInleg)||0;
  return `<span class="goal-inleg-breakdown"><b style="grid-column:1/-1"><span class="goal-inleg-label">Inleg deze maand</span><span class="goal-inleg-value">${eur(total)}</span></b></span>`;
}
function goalMonthlyInlegBreakdown(item){
  const fixed=Number(item.vasteInlegWerkelijk??item.doel.vasteInleg)||0;
  const extra=Number(item.berekendeExtraInleg)||0;
  return `<span class="goal-inleg-breakdown"><b><span class="goal-inleg-label">Vast</span><span class="goal-inleg-value">${eur(fixed)}</span></b><b><span class="goal-inleg-label">Naar rato</span><span class="goal-inleg-value">${eur(extra)}</span></b></span>`;
}
function goalNeededPerMonth(item){
  return `<span class="joint-savings-needed">Nodig p/m: ${item.benodigdPerMaand === null ? '—' : eur(item.benodigdPerMaand)}</span>`;
}
function goalImageStyle(goal){
  const source = String(goalImageSource(goal) || '').replace(/'/g,'%27');
  return source ? ` style="background-image:linear-gradient(rgba(35,45,30,.47),rgba(35,45,30,.62)),url('${source}')"` : '';
}
function goalImageIcon(goal){
  const source = String(goalImageSource(goal) || '').replace(/'/g,'%27');
  return `<span class="joint-savings-goal-icon${source?' has-image':''}"${source ? ` style="background-image:url('${source}')"` : ''}>${source ? '' : goalIcon(goal)}</span>`;
}
function renderJointSavingsOverviewCard(owner='gezamenlijk', savingPot=null){
  const r = calcScenario(state); const name = ownerLabel(owner);
  const goals = calcGroep(state.spaardoelen[owner] || [], savingPot ?? r.spaarpotDezeMaand, TODAY).sort((a,b)=>{ if (!!a.doel.favoriet !== !!b.doel.favoriet) return a.doel.favoriet ? -1 : 1; return (a.doel.doeldatum ? new Date(a.doel.doeldatum).getTime() : Infinity) - (b.doel.doeldatum ? new Date(b.doel.doeldatum).getTime() : Infinity); });
  const primary = goals.length >= 2 ? goals.slice(0,Math.min(3,goals.length)) : [];
  const compact = goals.length >= 3 ? goals.slice(3) : (goals.length === 1 ? goals : []);
  const primaryHtml = primary.map(item=>{ const goal=item.doel,target=Number(goal.doelbedrag)||0,saved=Number(goal.algespaard)||0,progress=target>0?Math.min(100,Math.round(saved/target*100)):0,hasImage=!!goalImageSource(goal); return `<button type="button" class="joint-savings-primary-goal${hasImage?' has-image':''}" data-tab-shortcut="spaardoelen"${goalImageStyle(goal)}>${goalImageIcon(goal)}<strong title="${textSafe(goal.naam || 'Spaardoel')}">${textSafe(goal.naam || 'Spaardoel')}</strong><span>${eur(saved)} / ${eur(target)}</span><span class="joint-savings-progress"><i style="width:${progress}%"></i></span><em>${progress}%</em>${goalNeededPerMonth(item)}${goalMonthlyInlegText(item)}</button>`; }).join('');
  const compactHtml = compact.length ? `<div class="joint-savings-rest-row">${compact.map(item=>{ const goal=item.doel,target=Number(goal.doelbedrag)||0,saved=Number(goal.algespaard)||0,progress=target>0?Math.min(100,Math.round(saved/target*100)):0; return `<button type="button" class="joint-savings-rest-goal" data-tab-shortcut="spaardoelen">${goalImageIcon(goal)}<span class="joint-savings-rest-copy"><strong title="${textSafe(goal.naam || 'Spaardoel')}">${textSafe(goal.naam || 'Spaardoel')}</strong><span>${eur(saved)} / ${eur(target)}</span>${goalNeededPerMonth(item)}${goalMonthlyInlegText(item)}</span><em>${progress}%</em></button>`; }).join('')}</div>` : '';
  return `<div class="card joint-single-card joint-savings-overview-card" aria-label="${name} spaardoelen"><div class="card-head joint-savings-card-head"><div class="card-head-title">${iconBadge('piggy', 'green', 'card-head-icon')}<h2>${owner === 'gezamenlijk' ? 'Gezamenlijke spaardoelen' : `${name} spaardoelen`}</h2></div><button type="button" class="ghost small" data-tab-shortcut="spaardoelen">Alle doelen</button></div>${primary.length ? `<div class="joint-savings-primary-grid goal-count-${primary.length}">${primaryHtml}</div>` : ''}${compactHtml || (!primary.length ? `<p class="hint" style="margin:0">Nog geen spaardoelen van ${name}.</p>` : '')}</div>`;
}
function renderDashboardGoalPreviewCard(item){
  const doel = item.doel || item;
  const owner = item.owner || doel.owner || 'Gezamenlijk';
  const doelbedrag = Number(doel.doelbedrag)||0;
  const algespaard = Number(doel.algespaard)||0;
  const progress = doelbedrag > 0 ? Math.min(1, algespaard / doelbedrag) : 0;
  const barPct = Math.round(progress * 100);
  const dateText = doel.doeldatum ? formatDateNL(doel.doeldatum) : 'Geen doeldatum';
  return `<div class="dashboard-goal-preview-item">
    <div class="dashboard-goal-preview-thumb tone-${ownerTone(owner)}">${iconSvg(goalIconName(doel))}</div>
    <div class="dashboard-goal-preview-main">
      <div class="dashboard-goal-preview-top"><strong>${textSafe(doel.naam || 'Spaardoel')}</strong><span>${eur(algespaard)} / ${eur(doelbedrag)}</span></div>
      <div class="dashboard-goal-preview-meta"><span>${textSafe(owner)}</span><span>Doel: ${dateText}</span></div>
      <div class="progress-track goal-positive"><div class="progress-fill goal-positive" style="width:${barPct}%"></div></div>
    </div>
  </div>`;
}
function renderManageSection(title, body, open=false, attributes=''){
  return `<details class="manage-section" ${String(attributes||'').trim()} ${open?'open':''}>
    <summary><span class="manage-title">${title}</span><span class="expand-chevron" aria-hidden="true"></span></summary>
    <div class="manage-body">${body}</div>
  </details>`;
}
function bindDashboardAccordionKeyboard(root){
  if(!root||root.dataset.dashboardAccordionKeyboardBound==='true')return;
  root.dataset.dashboardAccordionKeyboardBound='true';
  root.addEventListener('keydown',event=>{
    const summary=event.target.closest?.('[data-dashboard-accordion] > summary');
    if(!summary||!root.contains(summary)||!['Enter',' ','Spacebar'].includes(event.key))return;
    event.preventDefault();
    summary.parentElement.open=!summary.parentElement.open;
  });
}

let bankImportDraft = null;
let bankImportOpen = false;
function bankText(value){
  return String(value || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function bankCsvSplit(line, delimiter){
  const cells = []; let cell = ''; let quoted = false;
  for (let i=0; i<line.length; i++){
    const char = line[i];
    if (char === '"'){
      if (quoted && line[i+1] === '"'){ cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted){ cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}
function bankCsvDelimiter(line){
  return (line.match(/;/g)||[]).length >= (line.match(/,/g)||[]).length ? ';' : ',';
}
function bankDate(value){
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const nl = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!nl) return '';
  const year = nl[3].length === 2 ? `20${nl[3]}` : nl[3];
  return `${year}-${String(nl[2]).padStart(2,'0')}-${String(nl[1]).padStart(2,'0')}`;
}
function bankAmount(value){
  let text = String(value || '').trim().replace(/\s/g,'').replace(/€|EUR/gi,'');
  if (!text) return NaN;
  if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g,'').replace(',','.') : text.replace(/,/g,'');
  else text = text.replace(',','.');
  return Number(text);
}
function dataUrlByteSize(dataUrl){
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return 0;
  return Math.ceil(String(dataUrl).slice(comma + 1).length * 3 / 4);
}
async function compressGoalImage(file){
  if (!file) return '';
  if (!String(file.type || '').startsWith('image/')) throw new Error('Kies een geldig afbeeldingsbestand.');
  if (file.size > 12000000) throw new Error('Kies een afbeelding kleiner dan 12 MB.');

  let bitmap = null;
  let sourceUrl = '';
  if ('createImageBitmap' in window){
    bitmap = await createImageBitmap(file, {imageOrientation:'from-image'});
  }else{
    sourceUrl = URL.createObjectURL(file);
    bitmap = await new Promise((resolve,reject)=>{
      const image = new Image();
      image.onload = ()=>resolve(image);
      image.onerror = ()=>reject(new Error('De afbeelding kon niet worden gelezen.'));
      image.src = sourceUrl;
    });
  }
  try{
    const sourceWidth = bitmap.width || bitmap.naturalWidth;
    const sourceHeight = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(1, 640 / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));
    let result = '';
    for (let pass = 0; pass < 3; pass++){
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', {alpha:false});
      context.fillStyle = '#fffdfa'; context.fillRect(0,0,width,height);
      context.drawImage(bitmap,0,0,width,height);
      for (const quality of [.82,.72,.62,.52,.44]){
        result = canvas.toDataURL('image/webp', quality);
        if (!result.startsWith('data:image/webp')) result = canvas.toDataURL('image/jpeg', quality);
        if (dataUrlByteSize(result) <= 85000) return result;
      }
      width = Math.max(240, Math.round(width * .78));
      height = Math.max(240, Math.round(height * .78));
    }
    if (dataUrlByteSize(result) > 140000) throw new Error('De afbeelding kon niet klein genoeg worden gemaakt.');
    return result;
  } finally {
    if (typeof bitmap?.close === 'function') bitmap.close();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }
}
function bankColumnIndex(headers, patterns){
  return headers.findIndex(header=>patterns.some(pattern=>pattern.test(header)));
}
function bankOwnerCategories(owner){
  const scenarioData = getMonthlyScenarioData(state.meta.scenario);
  const rows = owner === 'gezamenlijk' ? scenarioData.gezamenlijk.variabel : (state[state.meta.scenario]?.[owner]?.variabel || []);
  const seen = new Set(); const categories = [];
  rows.forEach(row=>{
    const label = String(row.post || row.categorie || row || '').trim();
    const key = label.toLocaleLowerCase();
    if (!label || seen.has(key) || key === 'variabel') return;
    seen.add(key); categories.push(key === 'overig' ? 'Overig' : label);
  });
  if (!seen.has('overig')) categories.push('Overig');
  categories.push('Vaste lasten');
  return categories;
}
function bankSuggestedCategory(description, owner){
  const text = bankText(description);
  const rule = (state.bankImportRules || []).find(item=>text && text.includes(item.match));
  const categories = bankOwnerCategories(owner);
  return categories.find(category=>category.toLocaleLowerCase() === String(rule?.category || '').toLocaleLowerCase()) || 'Overig';
}
function bankIsDuplicate(row){
  const matches=tx=>(tx.account||tx.owner)===row.owner&&tx.date===row.date&&Math.abs((Number(tx.amount)||0)-Math.abs(row.amount))<.005&&bankText(tx.description)===bankText(row.description);
  return (state.transactions||[]).some(matches)||(state.transactionReviewQueue||[]).some(item=>(item.reviewStatus||'te-controleren')!=='genegeerd'&&matches(item));
}
function bankParseDraft(){
  if (!bankImportDraft) return;
  const {headers, rawRows, mapping, owner} = bankImportDraft;
  const dateIndex = Number(mapping.date), descriptionIndex = Number(mapping.description), amountIndex = Number(mapping.amount), directionIndex = Number(mapping.direction);
  bankImportDraft.rows = rawRows.map((cells,index)=>{
    const date = bankDate(cells[dateIndex]);
    const description = String(cells[descriptionIndex] || '').trim();
    let amount = bankAmount(cells[amountIndex]);
    const direction = directionIndex >= 0 ? bankText(cells[directionIndex]) : '';
    if (/^af|debit|debet/.test(direction)) amount = -Math.abs(amount);
    if (/^bij|credit|crediter/.test(direction)) amount = Math.abs(amount);
    const row = { id:`bank-${index}`, index, date, description, amount, owner, category:amount > 0 ? 'Teruggave' : bankSuggestedCategory(description, owner), valid:!!date && !!description && Number.isFinite(amount) };
    row.positive = row.amount > 0;
    row.duplicate = row.valid && row.amount < 0 && bankIsDuplicate(row);
    row.selected = row.valid && !row.duplicate;
    return row;
  });
}
function renderBankImportSection(){
  const draft = bankImportDraft;
  const ownerOptions = [['gezamenlijk','Gezamenlijk'],['dion','Dion'],['dara','Dara']].map(([value,label])=>`<option value="${value}" ${draft?.owner === value ? 'selected' : ''}>${label}</option>`).join('');
  const base = `<div class="bank-import-actions"><button type="button" class="primary" data-open-general-transaction>+ Uitgave invullen</button><label class="ghost bank-csv-button">Bank-CSV importeren<input type="file" accept=".csv,text/csv" data-bank-csv-file></label><label class="bank-import-owner">Rekening<select data-bank-import-owner>${ownerOptions}</select></label></div><p class="hint bank-import-hint">Kies eerst de rekening. CSV-bestanden worden alleen lokaal gelezen en pas na controle opgeslagen.</p>`;
  if (!draft) return `<div class="bank-import-panel">${base}</div>`;
  const mapSelect = (key,label)=>`<label>${label}<select data-bank-map="${key}"><option value="-1">Kies kolom</option>${draft.headers.map((header,index)=>`<option value="${index}" ${Number(draft.mapping[key]) === index ? 'selected' : ''}>${textSafe(header || `Kolom ${index+1}`)}</option>`).join('')}</select></label>`;
  const rows = draft.rows || [];
  const rowsHtml = rows.map(row=>{
    const categories = row.positive ? ['Teruggave'] : bankOwnerCategories(draft.owner);
    const status = !row.valid ? 'Niet leesbaar' : row.positive ? 'Teruggave bij inkomen' : row.duplicate ? 'Mogelijk dubbel' : 'Klaar';
    return `<div class="bank-review-row ${row.positive ? 'bank-credit' : ''} ${row.duplicate ? 'bank-duplicate' : ''}" data-bank-row="${row.index}">
      <input type="checkbox" data-bank-select="${row.index}" ${row.selected ? 'checked' : ''} ${(!row.valid || row.duplicate) ? 'disabled' : ''} aria-label="Transactie selecteren">
      <span class="bank-review-date">${row.date || '—'}</span><span class="bank-review-description" title="${textSafe(row.description)}">${textSafe(row.description || 'Onbekend')}</span><strong class="bank-review-amount">${Number.isFinite(row.amount) ? eur(Math.abs(row.amount)) : '—'}</strong>
      <select data-bank-category="${row.index}" ${!row.valid ? 'disabled' : ''}>${categories.map(category=>`<option value="${textSafe(category)}" ${String(category).toLocaleLowerCase() === String(row.category).toLocaleLowerCase() ? 'selected' : ''}>${textSafe(category)}</option>`).join('')}</select>
      <span class="bank-review-status">${status}</span><button type="button" class="ghost small" data-bank-import-row="${row.index}" ${(!row.selected || row.duplicate) ? 'disabled' : ''}>Toevoegen</button>
    </div>`;
  }).join('');
  return `<div class="bank-import-panel">${base}<div class="bank-mapping"><strong>${textSafe(draft.fileName)}</strong><div>${mapSelect('date','Datum')}${mapSelect('description','Omschrijving')}${mapSelect('amount','Bedrag')}${mapSelect('direction','Af/bij (optioneel)')}</div></div><div class="bank-review-head"><strong>Controle vóór import</strong><span>${rows.filter(row=>row.selected).length} uitgaven geselecteerd</span></div><div class="bank-review-list">${rowsHtml || '<p class="hint">Geen regels gevonden.</p>'}</div><button type="button" class="primary bank-import-all" data-bank-import-all ${rows.some(row=>row.selected) ? '' : 'disabled'}>Geselecteerde uitgaven importeren</button></div>`;
}
function renderAppSection(kicker, title, subtitle, content){
  return `<section class="app-section">
    <div class="section-header">
      <div><div class="section-kicker">${kicker}</div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
    </div>
    ${content}
  </section>`;
}
function availabilityBadge(amount){
  if (amount < 0) return '<span class="status-badge red">Tekort</span>';
  if (amount < 200) return '<span class="status-badge amber">Krap</span>';
  return '<span class="status-badge">Op schema</span>';
}
function personStatusBadge(amount){
  if (amount < 0) return '<span class="status-badge red">Uit reserve</span>';
  if (amount < 200) return '<span class="status-badge amber">Krap</span>';
  return '<span class="status-badge">Ruim</span>';
}
function copyPreviousMonth(){
  const month = getSelectedMonth();
  assertMonthMutationAllowed(month);
  const prev = previousMonthKey(month);
  const fallbackIncome = {dion:Number(state.personen?.dion?.salaris)||0, dara:Number(state.personen?.dara?.salaris)||0};
  const existingIncome = !!state.monthlyIncome?.[month] && JSON.stringify(state.monthlyIncome[month]) !== JSON.stringify(fallbackIncome);
  const defaultBudgets = {};
  ['voor','na'].forEach(scenario=> defaultBudgets[scenario] = { gezamenlijkVariabel: state[scenario]?.gezamenlijk?.variabel || [] });
  const existingBudgets = !!state.monthlyBudgets?.[month] && JSON.stringify(state.monthlyBudgets[month]) !== JSON.stringify(defaultBudgets);
  const existingTransactions = (state.transactions||[]).some(tx=>transactionMonth(tx) === month);
  ensureMonthData(prev);
  const hasData = existingIncome || existingBudgets || existingTransactions;
  if (hasData && !confirm('Deze maand heeft al maanddata. Inkomens en gezamenlijke budgetten overschrijven met vorige maand?')) return false;
  ensureMonthData(month);
  state.monthlyIncome[month] = clone(state.monthlyIncome[prev] || {
    dion: Number(state.personen.dion.salaris)||0,
    dara: Number(state.personen.dara.salaris)||0
  });
  state.monthlyBudgets[month] = clone(state.monthlyBudgets[prev] || {});
  ['voor','na'].forEach(scenario=>{
    if (!state.monthlyBudgets[month][scenario]){
      state.monthlyBudgets[month][scenario] = { gezamenlijkVariabel: clone(state[scenario].gezamenlijk.variabel || []) };
    }
  });
  return true;
}

/* ---------- rekenmotor ---------- */
function monthsRemaining(targetDateStr, today){
  if (!targetDateStr) return null;
  const t = new Date(targetDateStr);
  if (isNaN(t)) return null;
  const months = (t.getFullYear()-today.getFullYear())*12 + (t.getMonth()-today.getMonth());
  return Math.max(0, months+1);
}
function monthlyRateFromGoal(doel){
  const rate = Number(doel.rendement)||0;
  if (!rate) return 0;
  return doel.rendementPeriode === 'maandelijks' ? rate : Math.pow(1 + rate, 1/12) - 1;
}
function futureValue(current, monthlyFixed, monthlyRate, months){
  current = current || 0; monthlyFixed = monthlyFixed || 0;
  if (!monthlyRate) return current + monthlyFixed*months;
  const i = monthlyRate;
  const growth = Math.pow(1+i, months);
  return current*growth + monthlyFixed*((growth-1)/i);
}
function calcDoel(doel, today){
  const doelbedrag = Number(doel.doelbedrag)||0;
  const algespaard = Number(doel.algespaard)||0;
  const vasteInleg = Number(doel.vasteInleg)||0;
  const rendement = monthlyRateFromGoal(doel);
  const nogTeGaan = Math.max(0, doelbedrag - algespaard);
  const voortgang = doelbedrag>0 ? algespaard/doelbedrag : 0;
  let benodigdPerMaand = null, benodigdeExtraInleg = null, verwachteWaarde = null;
  const months = monthsRemaining(doel.doeldatum, today);
  if (months !== null && doelbedrag > 0){
    const fv = futureValue(algespaard, vasteInleg, rendement, months);
    verwachteWaarde = round2(fv);
    const tekort = doelbedrag - fv;
    if (!rendement){ benodigdeExtraInleg = round2(Math.max(0, tekort/months)); }
    else{
      const i = rendement;
      const annuiteit = (Math.pow(1+i,months)-1)/i;
      benodigdeExtraInleg = round2(Math.max(0, tekort/annuiteit));
    }
    benodigdPerMaand = round2(vasteInleg + benodigdeExtraInleg);
  }
  return { nogTeGaan, voortgang, benodigdPerMaand, benodigdeExtraInleg, verwachteWaarde, months };
}
function calcGroep(doelen, spaarpotDezeMaand, today){
  const berekend = doelen.map(d => ({ doel:d, ...calcDoel(d, today) }));
  const potCents = Math.max(0, Math.round((Number(spaarpotDezeMaand)||0)*100));
  // Ook vaste inleg stopt bij het resterende doelbedrag. Het vrijgevallen deel kan daarna naar andere doelen.
  const vasteCents = berekend.map(b=>Math.min(
    Math.max(0,Math.round((Number(b.doel.vasteInleg)||0)*100)),
    Math.max(0,Math.round((Number(b.nogTeGaan)||0)*100))
  ));
  const totaalVasteCents = vasteCents.reduce((sum,value)=>sum+value,0);
  const totaalVasteInleg = round2(totaalVasteCents/100);
  // Het extra overschot/tekort wordt alleen naar rato verdeeld over doelen die NIET op 'alleen vast bedrag' staan.
  const verdeelbaar = berekend.filter(b => !b.doel.vastBedrag);
  const totaalBenodigd = round2(verdeelbaar.reduce((s,b)=> s + (b.benodigdPerMaand||0), 0));
  const totaalExtraBenodigd = round2(verdeelbaar.reduce((s,b)=> s + (b.benodigdeExtraInleg||0), 0));
  const extraPotCents = Math.max(0,potCents-totaalVasteCents);
  let resterendePotCents = extraPotCents;
  const extraCents = berekend.map(()=>0);
  const capacities = berekend.map((b,index)=>Math.max(0,Math.round((Number(b.nogTeGaan)||0)*100)-vasteCents[index]));
  let active = berekend.map((b,index)=>({index,weight:Math.max(0,Number(b.benodigdeExtraInleg)||0)})).filter(item=>!berekend[item.index].doel.vastBedrag && item.weight>0 && capacities[item.index]>0);

  // Verdeel herhaaldelijk. Bereikt een doel zijn maximum, dan gaat het restant opnieuw naar rato naar de overige doelen.
  while (resterendePotCents>0 && active.length){
    const totalWeight=active.reduce((sum,item)=>sum+item.weight,0);
    if (!(totalWeight>0)) break;
    const capped=active.filter(item=>(resterendePotCents*(item.weight/totalWeight))>=capacities[item.index]);
    if (capped.length){
      const cappedIndexes=new Set(capped.map(item=>item.index));
      capped.forEach(item=>{const amount=capacities[item.index];extraCents[item.index]=amount;resterendePotCents-=amount;});
      active=active.filter(item=>!cappedIndexes.has(item.index));
      continue;
    }
    const shares=active.map(item=>{const raw=resterendePotCents*(item.weight/totalWeight);return {...item,cents:Math.floor(raw),fraction:raw-Math.floor(raw)};});
    let assigned=shares.reduce((sum,item)=>sum+item.cents,0);
    shares.sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
    for(let cent=0;cent<resterendePotCents-assigned;cent++) shares[cent%shares.length].cents+=1;
    shares.forEach(item=>{extraCents[item.index]=Math.min(item.cents,capacities[item.index]);});
    resterendePotCents=0;
  }

  const extraPot = round2(extraPotCents/100);
  const onverdeeld = round2(resterendePotCents/100);
  return berekend.map((b,index)=>{
    const vasteInleg=round2(vasteCents[index]/100);
    const berekendeExtraInleg=round2(extraCents[index]/100);
    return { ...b, berekendeExtraInleg, werkelijkeInleg:round2(vasteInleg+berekendeExtraInleg), vasteInlegWerkelijk:vasteInleg, totaalVasteInleg, totaalBenodigd, totaalExtraBenodigd, spaarpotDezeMaand:round2(potCents/100), extraPot, onverdeeld };
  });
}
function calcScenario(state){
  const scenario = state.meta.scenario;
  const selectedMonth=getSelectedMonth();
  const dionIncomeParts=getDistributionIncomeParts('dion',selectedMonth);
  const daraIncomeParts=getDistributionIncomeParts('dara',selectedMonth);
  const basisInkomenDion=dionIncomeParts.salary;
  const basisInkomenDara=daraIncomeParts.salary;
  const vasteTeruggavenDion=dionIncomeParts.refund;
  const vasteTeruggavenDara=daraIncomeParts.refund;
  const salarisDion = round2(basisInkomenDion + vasteTeruggavenDion);
  const salarisDara = round2(basisInkomenDara + vasteTeruggavenDara);
  const totaalSalaris = salarisDion + salarisDara;
  const inkomenRatioDion = totaalSalaris>0 ? salarisDion/totaalSalaris : 0;
  const inkomenRatioDara = totaalSalaris>0 ? salarisDara/totaalSalaris : 0;
  const s = getMonthlyScenarioData(scenario);
  const vasteLastenTotaal = sumEffective(s.gezamenlijk.vasteLasten);
  const variabelBudgetTotaal = sumBedrag(s.gezamenlijk.variabel);
  const variabelTotaal = sumTransactions('gezamenlijk');
  // Update 5: zakgeld blijft een geplande overdracht. Werkelijke transacties
  // worden uitsluitend in de realisatielaag en budgetverschillen gebruikt.
  const variabelVoorVerdelingTotaal = variabelBudgetTotaal;
  const spaarpotDezeMaand = Number(s.spaarpotDezeMaand)||0;

  let effDion, effDara, zakgeldDion, zakgeldDara, hypotheekBedrag = 0;
  if (scenario === 'voor'){
    const minDion = Number(s.verdeling.minimumDion);
    effDion = Math.max(minDion, inkomenRatioDion);
    effDara = 1 - effDion;
    const pot = vasteLastenTotaal + variabelVoorVerdelingTotaal + spaarpotDezeMaand;
    zakgeldDion = round2(salarisDion - pot*effDion);
    zakgeldDara = round2(salarisDara - pot*effDara);
  } else {
    const hypDion = Number(s.verdeling.hypotheekDion);
    const hypDara = 1 - hypDion;
    hypotheekBedrag = sumBedrag(s.gezamenlijk.hypotheek);
    const overigePot = vasteLastenTotaal + variabelVoorVerdelingTotaal + spaarpotDezeMaand;
    zakgeldDion = round2(salarisDion - (hypotheekBedrag*hypDion + overigePot*inkomenRatioDion));
    zakgeldDara = round2(salarisDara - (hypotheekBedrag*hypDara + overigePot*inkomenRatioDara));
    effDion = hypDion; effDara = hypDara;
  }
  function persoonlijk(p, zakgeld){
    const persoonlijkeVasteLasten = sumEffective(s[p].vasteLasten);
    const persoonlijkVariabelBudget = sumBedrag(s[p].variabel);
    const resterendVoorVariabel = round2(zakgeld - persoonlijkeVasteLasten);
    const variabeleUitgaven = sumTransactions(p);
    // v49: de spaarpot is een planningsbedrag en gebruikt daarom het
    // ingestelde variabele budget, niet de werkelijke transacties.
    const beschikbaarVoorSparen = round2(zakgeld - persoonlijkeVasteLasten - persoonlijkVariabelBudget);
    return { persoonlijkeVasteLasten, persoonlijkVariabelBudget, resterendVoorVariabel, variabeleUitgaven, beschikbaarVoorSparen };
  }
  const dion = { zakgeld: zakgeldDion, ...persoonlijk('dion', zakgeldDion) };
  const dara = { zakgeld: zakgeldDara, ...persoonlijk('dara', zakgeldDara) };
  return {
    basisInkomenDion, basisInkomenDara, vasteTeruggavenDion, vasteTeruggavenDara,
    salarisDion, salarisDara, totaalSalaris, inkomenRatioDion, inkomenRatioDara,
    vasteLastenTotaal: round2(vasteLastenTotaal + hypotheekBedrag),
    gezamenlijkeLastenTotaal: round2(vasteLastenTotaal + hypotheekBedrag + variabelVoorVerdelingTotaal),
    overigeVasteLastenTotaal: vasteLastenTotaal, hypotheekBedrag,
    variabelTotaal, variabelBudgetTotaal, variabelVoorVerdelingTotaal, spaarpotDezeMaand, effDion, effDara, dion, dara
  };
}

/* ---------- default data (zelfde uitgangspunt als het Excel-bestand) ---------- */
function defaultState(){
  const blankVar = (n) => Array.from({length:n}, ()=>({id:uid(), categorie:'Variabel', post:'', bedrag:0}));
  const blankGoal = (naam, rendement=0.0125) => ({ id:uid(), naam, doelbedrag:0, algespaard:0, doeldatum:'', vasteInleg:0, rendement, rendementPeriode:'jaarlijks', favoriet:false });

  return {
    meta: { scenario:'voor', selectedMonth: monthKey(), schemaVersion:5, revision:0, updatedAt:'', updatedBy:getDeviceId() },
    personen: {
      dion: { naam:'Dion', salaris:2450, vasteTeruggaven: [] },
      dara: { naam:'Dara', salaris:3010, vasteTeruggaven: [] },
    },
    voor: {
      verdeling: { minimumDion: 0.40 },
      spaarpotDezeMaand: 0,
      gezamenlijk: {
        vasteLasten: [
          {id:uid(), categorie:'Huis', post:'Hypotheek', bedrag:2000},
          {id:uid(), categorie:'Water', post:'Evides nieuw adres', bedrag:20},
          {id:uid(), categorie:'Water', post:'Evides oud adres', bedrag:20},
          {id:uid(), categorie:'Energie', post:'Eneco nieuw adres', bedrag:32},
          {id:uid(), categorie:'Energie', post:'Eneco oud adres', bedrag:50},
          {id:uid(), categorie:'Verzekeringen', post:'Woon nieuw adres', bedrag:24.23},
          {id:uid(), categorie:'Verzekeringen', post:'Woon oud adres', bedrag:9.29},
          {id:uid(), categorie:'Belastingen', post:'Gemeente', bedrag:83.96},
          {id:uid(), categorie:'Belastingen', post:'Waterschap', bedrag:37.22},
          {id:uid(), categorie:'Entertainment', post:'Netflix', bedrag:15.99},
          {id:uid(), categorie:'Overig', post:'ING', bedrag:4.55},
          {id:uid(), categorie:'Overig', post:'Sportschool', bedrag:62.95},
        ],
        variabel: [
          {id:uid(), categorie:'Variabel', post:'Boodschappen', bedrag:500},
          {id:uid(), categorie:'Variabel', post:'Benzine', bedrag:0},
          {id:uid(), categorie:'Variabel', post:'Uitjes', bedrag:0},
          ...blankVar(4),
        ],
      },
      dion: {
        vasteLasten: [
          {id:uid(), categorie:'Verzekeringen', post:'Autoverzekering', bedrag:28.89},
          {id:uid(), categorie:'Verzekeringen', post:'Zorgverzekering', bedrag:191.45},
          {id:uid(), categorie:'Internet/telefoon', post:'Telefoon', bedrag:7.5},
          {id:uid(), categorie:'Overig', post:'ANWB', bedrag:8.58},
          {id:uid(), categorie:'Overig', post:'ING', bedrag:3.9},
          {id:uid(), categorie:'Entertainment', post:'Spotify', bedrag:6.99},
          {id:uid(), categorie:'Entertainment', post:'Prime', bedrag:4.99},
          {id:uid(), categorie:'Belastingen', post:'Wegenbelasting', bedrag:23},
          {id:uid(), categorie:'Verzekeringen', post:'Reisverzekering', bedrag:23.12},
          {id:uid(), categorie:'Inkomsten/Correcties', post:'Zorgtoeslag', bedrag:0},
          {id:uid(), categorie:'Schuld/Correcties', post:'DUO', bedrag:-324},
          {id:uid(), categorie:'Belasting', post:'Belastingdienst', bedrag:0},
        ],
        variabel: ['Eten buiten de deur','Benzine/vervoer','Uitjes','Kleding/hobby','Overig']
          .map(post=>({id:uid(), categorie:'Variabel', post, bedrag:0})),
      },
      dara: {
        vasteLasten: [
          {id:uid(), categorie:'Huis', post:'Hypotheek', bedrag:907.51},
          {id:uid(), categorie:'Huis', post:'VVE', bedrag:164.1},
          {id:uid(), categorie:'Belastingen', post:'Wegenbelasting', bedrag:23},
          {id:uid(), categorie:'Belastingen', post:'Waterschap', bedrag:37.22},
          {id:uid(), categorie:'Belastingen', post:'Gemeente', bedrag:83.96},
          {id:uid(), categorie:'Verzekeringen', post:'Zorgverzekering', bedrag:225},
          {id:uid(), categorie:'Verzekeringen', post:'Auto', bedrag:43.59},
          {id:uid(), categorie:'Verzekeringen', post:'Fiets p/j', bedrag:9.66},
          {id:uid(), categorie:'Entertainment', post:'Prime', bedrag:4.99},
          {id:uid(), categorie:'Entertainment', post:'Disney+', bedrag:10.99},
          {id:uid(), categorie:'Internet/telefoon', post:'Telefoon', bedrag:10},
          {id:uid(), categorie:'Internet/telefoon', post:'Internet', bedrag:32.5},
          {id:uid(), categorie:'Overig', post:'ING', bedrag:3.9},
          {id:uid(), categorie:'Overig', post:'ANWB p/j', bedrag:6},
          {id:uid(), categorie:'Belasting', post:'Belastingteruggave', bedrag:-226},
        ],
        variabel: ['Eten buiten de deur','Benzine/vervoer','Uitjes','Kleding/hobby','Overig']
          .map(post=>({id:uid(), categorie:'Variabel', post, bedrag:0})),
      },
    },
    na: {
      verdeling: { hypotheekDion: 0.50 },
      spaarpotDezeMaand: 500,
      gezamenlijk: {
        hypotheek: [
          {id:uid(), categorie:'Huis', post:'Hypotheek', bedrag:2000},
        ],
        vasteLasten: [
          {id:uid(), categorie:'Water', post:'Evides', bedrag:20},
          {id:uid(), categorie:'Energie', post:'Eneco', bedrag:75},
          {id:uid(), categorie:'Verzekeringen', post:'Zorg Dara', bedrag:225},
          {id:uid(), categorie:'Verzekeringen', post:'Zorg Dion', bedrag:191.45},
          {id:uid(), categorie:'Verzekeringen', post:'Woon', bedrag:24.23},
          {id:uid(), categorie:'Verzekeringen', post:'Auto Dara', bedrag:43.59},
          {id:uid(), categorie:'Verzekeringen', post:'Auto Dion', bedrag:28.89},
          {id:uid(), categorie:'Verzekeringen', post:'Reis Dion', bedrag:9.64},
          {id:uid(), categorie:'Verzekeringen', post:'Fiets Dara', bedrag:0},
          {id:uid(), categorie:'Belastingen', post:'Weg Dara', bedrag:23},
          {id:uid(), categorie:'Belastingen', post:'Weg Dion', bedrag:23},
          {id:uid(), categorie:'Belastingen', post:'Gemeente', bedrag:83.96},
          {id:uid(), categorie:'Belastingen', post:'Waterschap', bedrag:37.22},
          {id:uid(), categorie:'Internet/telefoon', post:'Internet', bedrag:32.5},
          {id:uid(), categorie:'Internet/telefoon', post:'Tel Dara', bedrag:10},
          {id:uid(), categorie:'Internet/telefoon', post:'Tel Dion', bedrag:7.5},
          {id:uid(), categorie:'Entertainment', post:'Netflix', bedrag:15.99},
          {id:uid(), categorie:'Entertainment', post:'Disney+', bedrag:10.99},
          {id:uid(), categorie:'Entertainment', post:'Spotify Dion', bedrag:6.99},
          {id:uid(), categorie:'Pensioen', post:'SPF pensioen', bedrag:312},
          {id:uid(), categorie:'Overig', post:'ANWB', bedrag:18},
          {id:uid(), categorie:'Overig', post:'ING', bedrag:4.55},
          {id:uid(), categorie:'Overig', post:'Sportschool', bedrag:62.95},
          {id:uid(), categorie:'Overig', post:'Waterpomp', bedrag:17},
        ],
        variabel: [
          {id:uid(), categorie:'Variabel', post:'Boodschappen', bedrag:500},
          {id:uid(), categorie:'Variabel', post:'Benzine', bedrag:150},
          {id:uid(), categorie:'Variabel', post:'Uitjes', bedrag:0},
          {id:uid(), categorie:'Variabel', post:'overig', bedrag:100},
          ...blankVar(4),
        ],
      },
      dion: {
        vasteLasten: [{id:uid(), categorie:'Entertainment', post:'Prime', bedrag:4.99}],
        variabel: [{id:uid(), categorie:'Variabel', post:'Eten buiten de deur', bedrag:0}],
      },
      dara: {
        vasteLasten: [{id:uid(), categorie:'Entertainment', post:'Prime', bedrag:4.99}],
        variabel: [{id:uid(), categorie:'Variabel', post:'Eten buiten de deur', bedrag:0}],
      },
    },
    spaardoelen: {
      gezamenlijk: [
        {id:uid(), naam:'vakantie', doelbedrag:5000, algespaard:100, doeldatum:'2028-12-31', vasteInleg:0, rendement:0.0125},
        {id:uid(), naam:'buffer', doelbedrag:10000, algespaard:0, doeldatum:'2030-12-31', vasteInleg:0, rendement:0.0125},
        {id:uid(), naam:'Beleggen', doelbedrag:50000, algespaard:17941, doeldatum:'2030-12-31', vasteInleg:0, rendement:0.08, vastBedrag:true},
      ],
      dion: [
        {id:uid(), naam:'koffie', doelbedrag:300, algespaard:6.77, doeldatum:'2026-12-31', vasteInleg:0, rendement:0.0125},
        {id:uid(), naam:'buffer', doelbedrag:5000, algespaard:800, doeldatum:'2028-12-31', vasteInleg:0, rendement:0.0125},
        {id:uid(), naam:'Beleggen', doelbedrag:50000, algespaard:17941, doeldatum:'2030-12-31', vasteInleg:250, rendement:0.08, vastBedrag:true},
      ],
      dara: [],
    },
    monthlyIncome: {},
    monthlyBudgets: {},
    transactions: [],
    bankImportRules: [],
    recurringFixedExpenses: {voor:[],na:[]},
    recurringIncomeSources: [],
    transactionReviewQueue: [],
    recognitionRules: [],
    monthRecords: {},
    accountSettings: {},
    reserveLedger: [],
    advanceLedger: [],
    internalTransfers: [],
    monthCorrections: [],
  };
}

/* ---------- opslag: lokaal + optionele Firebase/Firestore-sync ---------- */
const STORAGE_KEY = 'finize-budget-planner-v1';
const BACKUP_STORAGE_KEY = 'finize-budget-planner-v1-last-good-backup';
const MIGRATION_BACKUP_STORAGE_KEY = 'finize-budget-planner-v1-pre-schema-v5';
const DEVICE_ID_STORAGE_KEY = 'finize-device-id';
const FIREBASE_CONFIG_STORAGE_KEY = 'finize-firebase-config';
const FIREBASE_SDK_VERSION = '11.10.0';
const FIRESTORE_COLLECTION = 'budgetPlanners';
const FIRESTORE_DOC_ID = 'finize';
const GOAL_IMAGE_DB_NAME = 'finize-goal-images-v1';
const GOAL_IMAGE_STORE_NAME = 'images';
const GOAL_IMAGE_REF_PREFIX = 'idb:goal-image:';

const GoalImageStore = {
  dbPromise:null,
  cache:new Map(),
  ref(goalId){ return GOAL_IMAGE_REF_PREFIX + goalId; },
  keyFromRef(value){
    const raw = String(value || '');
    return raw.startsWith(GOAL_IMAGE_REF_PREFIX) ? raw.slice(GOAL_IMAGE_REF_PREFIX.length) : '';
  },
  open(){
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve,reject)=>{
      if (!('indexedDB' in window)){
        reject(new Error('IndexedDB is niet beschikbaar op dit toestel.'));
        return;
      }
      const request = indexedDB.open(GOAL_IMAGE_DB_NAME, 1);
      request.onupgradeneeded = ()=>{
        const db = request.result;
        if (!db.objectStoreNames.contains(GOAL_IMAGE_STORE_NAME)) db.createObjectStore(GOAL_IMAGE_STORE_NAME);
      };
      request.onsuccess = ()=>resolve(request.result);
      request.onerror = ()=>reject(request.error || new Error('Afbeeldingenopslag openen mislukt.'));
    });
    return this.dbPromise;
  },
  async transact(mode, action){
    const db = await this.open();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(GOAL_IMAGE_STORE_NAME, mode);
      const store = tx.objectStore(GOAL_IMAGE_STORE_NAME);
      try{ action(store); }
      catch(error){ reject(error); return; }
      tx.oncomplete = ()=>resolve();
      tx.onerror = ()=>reject(tx.error || new Error('Afbeeldingenopslag mislukt.'));
      tx.onabort = ()=>reject(tx.error || new Error('Afbeeldingenopslag is afgebroken.'));
    });
  },
  async put(goalId, dataUrl){
    if (!goalId || !dataUrl) return;
    await this.transact('readwrite', store=>store.put(String(dataUrl), String(goalId)));
    this.cache.set(String(goalId), String(dataUrl));
  },
  async get(goalId){
    const key = String(goalId || '');
    if (!key) return '';
    if (this.cache.has(key)) return this.cache.get(key) || '';
    const db = await this.open();
    const value = await new Promise((resolve,reject)=>{
      const tx = db.transaction(GOAL_IMAGE_STORE_NAME, 'readonly');
      const request = tx.objectStore(GOAL_IMAGE_STORE_NAME).get(key);
      request.onsuccess = ()=>resolve(request.result || '');
      request.onerror = ()=>reject(request.error || new Error('Afbeelding laden mislukt.'));
    });
    if (value) this.cache.set(key, value);
    return value || '';
  },
  async remove(goalId){
    const key = String(goalId || '');
    if (!key) return;
    await this.transact('readwrite', store=>store.delete(key));
    this.cache.delete(key);
  },
  source(goal){
    const raw = String(goal?.afbeelding || '');
    const key = this.keyFromRef(raw);
    if (key) return this.cache.get(key) || '';
    return raw.startsWith('data:image/') ? raw : '';
  },
  async storeOrFallback(goalId, dataUrl){
    if (!dataUrl) return '';
    try{
      await this.put(goalId, dataUrl);
      return this.ref(goalId);
    }catch(error){
      console.warn('IndexedDB niet beschikbaar; spaardoelfoto blijft in lokale app-data.', error);
      return dataUrl;
    }
  },
  async initializeState(target){
    let changed = false;
    for (const owner of ['gezamenlijk','dion','dara']){
      for (const goal of (target?.spaardoelen?.[owner] || [])){
        const raw = String(goal.afbeelding || '');
        if (raw.startsWith('data:image/')){
          const stored = await this.storeOrFallback(goal.id, raw);
          if (stored !== raw){ goal.afbeelding = stored; changed = true; }
        }else{
          const key = this.keyFromRef(raw);
          if (key){
            try{ await this.get(key); }
            catch(error){ console.error('Spaardoelfoto laden mislukt', error); }
          }
        }
      }
    }
    return changed;
  },
  async expandStateForTransfer(target){
    for (const owner of ['gezamenlijk','dion','dara']){
      for (const goal of (target?.spaardoelen?.[owner] || [])){
        const key = this.keyFromRef(goal.afbeelding);
        if (!key) continue;
        const image = await this.get(key);
        if (!image) throw new Error('Een lokaal opgeslagen spaardoelfoto kon niet worden geladen.');
        goal.afbeelding = image;
      }
    }
    return target;
  }
};

function goalImageSource(goal){ return GoalImageStore.source(goal); }

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCiJHGv9nlC_o4c2Xyj9UcyqHWW-YTxKfY',
  authDomain: 'financien-7dd43.firebaseapp.com',
  projectId: 'financien-7dd43',
  storageBucket: 'financien-7dd43.firebasestorage.app',
  messagingSenderId: '487713041493',
  appId: '1:487713041493:web:68c897ae2fa06afd5838dc',
  measurementId: 'G-X2EXXZDK7S'
};

function getDeviceId(){
  try{
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id){
      id = uid();
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  }catch(e){
    if (!getDeviceId.fallback) getDeviceId.fallback = uid();
    return getDeviceId.fallback;
  }
}

function ensureRowIds(rows){
  if (!Array.isArray(rows)) return;
  const seen = new Set();
  rows.forEach(row=>{
    if (!isPlainObject(row)) return;
    if (!row.id || seen.has(row.id)) row.id = uid();
    seen.add(row.id);
  });
}

function ensurePersistentIds(target){
  ['voor','na'].forEach(scenario=>{
    ['gezamenlijk','dion','dara'].forEach(owner=>{
      ensureRowIds(target?.[scenario]?.[owner]?.vasteLasten);
      ensureRowIds(target?.[scenario]?.[owner]?.variabel);
    });
    ensureRowIds(target?.[scenario]?.gezamenlijk?.hypotheek);
  });
  ['dion','dara'].forEach(owner=>ensureRowIds(target?.personen?.[owner]?.vasteTeruggaven));
  Object.values(target?.monthlyBudgets || {}).forEach(monthData=>{
    ['voor','na'].forEach(scenario=>{
      ['gezamenlijkVariabel','dionVariabel','daraVariabel'].forEach(key=>ensureRowIds(monthData?.[scenario]?.[key]));
    });
  });
  Object.values(target?.monthlyTeruggaven || {}).forEach(monthData=>{
    ['gezamenlijk','dion','dara'].forEach(owner=>ensureRowIds(monthData?.[owner]));
  });
  ensureRowIds(target?.transactions);
  ['gezamenlijk','dion','dara'].forEach(owner=>ensureRowIds(target?.spaardoelen?.[owner]));
  ['voor','na'].forEach(scenario=>ensureRowIds(target?.recurringFixedExpenses?.[scenario]));
  ensureRowIds(target?.recurringIncomeSources);
  ensureRowIds(target?.transactionReviewQueue);
  ensureRowIds(target?.recognitionRules);
  ensureRowIds(target?.reserveLedger);
  ensureRowIds(target?.advanceLedger);
  ensureRowIds(target?.internalTransfers);
  ensureRowIds(target?.monthCorrections);
  Object.values(target?.monthRecords||{}).forEach(record=>ensureRowIds(record?.closureHistory));
}

function migrateBudgetState(candidate){
  const original = clone(candidate);
  const activeStateBeforeMigration = typeof state === 'undefined' ? null : state;
  try{
    const fromVersion = Number(candidate?.meta?.schemaVersion) || 1;
    if (fromVersion < U3_SCHEMA_VERSION){
      localStorage.setItem(MIGRATION_BACKUP_STORAGE_KEY, JSON.stringify({
        savedAt:new Date().toISOString(),
        fromVersion,
        state:original
      }));
    }
    const migrated = normalizeBudgetState(candidate);
    migrated.meta.schemaVersion = U3_SCHEMA_VERSION;
    ensurePersistentIds(migrated);
    const validation = validateBudgetState(migrated);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    return migrated;
  }catch(e){
    console.error('Datamigratie mislukt; oude gegevens blijven behouden', e);
    throw e;
  }finally{
    if (activeStateBeforeMigration) state = activeStateBeforeMigration;
  }
}

function isPlainObject(value){
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRows(rows, label, errors){
  if (!Array.isArray(rows)){
    errors.push(label + ' moet een lijst zijn.');
    return;
  }
  const ids = new Set();
  rows.forEach((row, i)=>{
    if (!isPlainObject(row)) errors.push(label + '[' + i + '] is geen geldige regel.');
    else if (!row.id) errors.push(label + '[' + i + '] mist een ID.');
    else if (ids.has(row.id)) errors.push(label + ' bevat een dubbele ID: ' + row.id + '.');
    else ids.add(row.id);
  });
}

function validateGoalRows(rows, label, errors){
  if (!Array.isArray(rows)){
    errors.push(label + ' moet een lijst zijn.');
    return;
  }
  validateRows(rows, label, errors);
  rows.forEach((goal,index)=>{
    if (!isPlainObject(goal)) return;
    if (goal.subdoelen !== undefined) validateRows(goal.subdoelen, `${label}[${index}].subdoelen`, errors);
    if (goal.eigenaar !== undefined && !['gezamenlijk','dion','dara'].includes(goal.eigenaar)){
      errors.push(`${label}[${index}].eigenaar is ongeldig.`);
    }
  });
}

function validateBudgetState(candidate){
  const errors = [];
  if (!isPlainObject(candidate)){
    return { ok:false, errors:['Het bestand bevat geen budgetplanner-gegevens.'] };
  }
  ['meta','personen','voor','na','spaardoelen'].forEach(key=>{
    if (!isPlainObject(candidate[key])) errors.push('Ontbrekend of ongeldig onderdeel: ' + key + '.');
  });
  if (errors.length) return { ok:false, errors };

  if (!['voor','na'].includes(candidate.meta.scenario)){
    errors.push('Scenario moet "voor" of "na" zijn.');
  }
  if (candidate.meta.selectedMonth && !/^\d{4}-\d{2}$/.test(String(candidate.meta.selectedMonth))){
    errors.push('Geselecteerde maand moet de vorm YYYY-MM hebben.');
  }
  ['dion','dara'].forEach(person=>{
    if (!isPlainObject(candidate.personen[person])) errors.push('Persoon ontbreekt: ' + person + '.');
    else if (candidate.personen[person].vasteTeruggaven !== undefined){
      validateRows(candidate.personen[person].vasteTeruggaven, 'personen.' + person + '.vasteTeruggaven', errors);
    }
  });

  ['voor','na'].forEach(scenario=>{
    const s = candidate[scenario];
    if (!isPlainObject(s.verdeling)) errors.push(scenario + '.verdeling ontbreekt.');
    if (!isPlainObject(s.gezamenlijk)) errors.push(scenario + '.gezamenlijk ontbreekt.');
    if (!isPlainObject(s.dion)) errors.push(scenario + '.dion ontbreekt.');
    if (!isPlainObject(s.dara)) errors.push(scenario + '.dara ontbreekt.');
    if (isPlainObject(s.gezamenlijk)){
      validateRows(s.gezamenlijk.vasteLasten, scenario + '.gezamenlijk.vasteLasten', errors);
      validateRows(s.gezamenlijk.variabel, scenario + '.gezamenlijk.variabel', errors);
      if (scenario === 'na') validateRows(s.gezamenlijk.hypotheek, 'na.gezamenlijk.hypotheek', errors);
    }
    ['dion','dara'].forEach(person=>{
      if (isPlainObject(s[person])){
        validateRows(s[person].vasteLasten, scenario + '.' + person + '.vasteLasten', errors);
        validateRows(s[person].variabel, scenario + '.' + person + '.variabel', errors);
      }
    });
  });

  ['gezamenlijk','dion','dara'].forEach(group=>{
    validateGoalRows(candidate.spaardoelen[group], 'spaardoelen.' + group, errors);
  });
  if (candidate.monthlyIncome !== undefined && !isPlainObject(candidate.monthlyIncome)){
    errors.push('monthlyIncome moet een object zijn.');
  }
  if (candidate.monthlyBudgets !== undefined && !isPlainObject(candidate.monthlyBudgets)){
    errors.push('monthlyBudgets moet een object zijn.');
  }
  if (candidate.transactions !== undefined){
    validateRows(candidate.transactions, 'transactions', errors);
  }
  if (!isPlainObject(candidate.recurringFixedExpenses)) errors.push('recurringFixedExpenses moet een object zijn.');
  else ['voor','na'].forEach(scenario=>validateRows(candidate.recurringFixedExpenses[scenario],`recurringFixedExpenses.${scenario}`,errors));
  validateRows(candidate.recurringIncomeSources,'recurringIncomeSources',errors);
  validateRows(candidate.transactionReviewQueue,'transactionReviewQueue',errors);
  validateRows(candidate.recognitionRules,'recognitionRules',errors);
  validateRows(candidate.reserveLedger,'reserveLedger',errors);
  validateRows(candidate.advanceLedger,'advanceLedger',errors);
  validateRows(candidate.internalTransfers,'internalTransfers',errors);
  validateRows(candidate.monthCorrections,'monthCorrections',errors);
  if (!isPlainObject(candidate.monthRecords)) errors.push('monthRecords moet een object zijn.');
  if (!isPlainObject(candidate.accountSettings)) errors.push('accountSettings moet een object zijn.');
  if (candidate.spaardoelGeschiedenis !== undefined){
    if (!isPlainObject(candidate.spaardoelGeschiedenis)) errors.push('spaardoelGeschiedenis moet een object zijn.');
    else Object.entries(candidate.spaardoelGeschiedenis).forEach(([key,entry])=>{
      if (!isPlainObject(entry)) errors.push(`spaardoelGeschiedenis.${key} is ongeldig.`);
      else{
        if (entry.id !== key) errors.push(`spaardoelGeschiedenis.${key} heeft een afwijkend ID.`);
        if (!/^(gezamenlijk|dion|dara):\d{4}-\d{2}$/.test(key)) errors.push(`spaardoelGeschiedenis.${key} heeft een ongeldige maand-ID.`);
        validateRows(entry.transacties, `spaardoelGeschiedenis.${key}.transacties`, errors);
      }
    });
  }

  return { ok:errors.length === 0, errors };
}

function backupLabel(){
  return new Date().toLocaleString('nl-NL');
}

function downloadJson(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function isStorageQuotaError(error){
  return error?.name === 'QuotaExceededError'
    || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error?.code === 22
    || error?.code === 1014;
}

function localSave(state){
  const serialized = JSON.stringify(state);
  try{
    localStorage.setItem(STORAGE_KEY, serialized);
  }catch(error){
    if (!isStorageQuotaError(error)) throw error;
    localStorage.removeItem(BACKUP_STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, serialized);
  }
}

function firebaseConfigTemplate(){
  return JSON.stringify(DEFAULT_FIREBASE_CONFIG, null, 2);
}

function loadFirebaseConfig(){
  try{
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return {...DEFAULT_FIREBASE_CONFIG};
    return {...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(raw)};
  }catch(e){
    console.error('Firebase-config laden mislukt', e);
    return {...DEFAULT_FIREBASE_CONFIG};
  }
}

function firebaseConfigIsComplete(config){
  return !!(config && config.apiKey && config.authDomain && config.projectId && config.appId);
}

function saveFirebaseConfigFromText(text){
  const parsed = JSON.parse(text);
  const config = {...DEFAULT_FIREBASE_CONFIG, ...parsed};
  if (!firebaseConfigIsComplete(config)){
    throw new Error('Firebase-config mist apiKey, authDomain, projectId of appId.');
  }
  localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  return config;
}

const CloudAdapter = {
  app:null, db:null, docRef:null, modules:null, unsubscribe:null, connectPromise:null,
  status:'Offline — lokaal bewaard', saveTimer:null, applyingRemote:false,
  pendingState:null, writeInFlight:false, retryTimer:null, retryAttempt:0,
  lastConfirmedRevision:0, lastFailureRetryable:true,
  config:loadFirebaseConfig(),
  statusText(){ return this.status; },
  isConfigured(){ return firebaseConfigIsComplete(this.config); },
  isConnected(){ return !!(this.db && this.docRef); },
  async loadModules(){
    if (this.modules) return this.modules;
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
    const [app, firestore] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-firestore.js`)
    ]);
    this.modules = {app, firestore};
    return this.modules;
  },
  async connect(){
    if (this.isConnected()) return true;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connectOnce();
    try{
      return await this.connectPromise;
    }finally{
      this.connectPromise = null;
    }
  },
  async connectOnce(){
    if (!this.isConfigured()){
      this.status = 'Offline — lokaal bewaard';
      renderCloudStatus();
      return false;
    }
    try{
      this.status = 'Opslaan…';
      renderCloudStatus();
      const {app, firestore} = await this.loadModules();
      this.app = app.getApps().length ? app.getApps()[0] : app.initializeApp(this.config);
      this.db = firestore.getFirestore(this.app);
      this.docRef = firestore.doc(this.db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);
      this.attachSnapshot();
      this.status = this.pendingState ? 'Opslaan…' : 'Lokaal opgeslagen';
      renderCloudStatus();
      this.flushQueue();
      window.dispatchEvent(new CustomEvent('finize:cloud-connected'));
      return true;
    }catch(e){
      console.error('Firebase verbinden mislukt', e);
      this.status = 'Synchronisatie mislukt';
      renderCloudStatus();
      return false;
    }
  },
  attachSnapshot(){
    if (this.unsubscribe || !this.docRef) return;
    const {firestore} = this.modules;
    this.unsubscribe = firestore.onSnapshot(this.docRef, async snap=>{
      if (!snap.exists()){
        this.status = 'Lokaal opgeslagen';
        renderCloudStatus();
        return;
      }
      const remote = snap.data().state;
      let normalizedRemote;
      try{ normalizedRemote = migrateBudgetState(remote); }
      catch(error){
        console.error('Firestore-data kon niet worden gemigreerd', error);
        this.status = 'Synchronisatie mislukt';
        renderCloudStatus();
        return;
      }
      const validation = validateBudgetState(normalizedRemote);
      if (!validation.ok){
        console.error('Firestore-data ongeldig', validation.errors);
        this.status = 'Synchronisatie mislukt';
        renderCloudStatus();
        return;
      }
      const previousState = state;
      const remoteRevision = Number(normalizedRemote.meta?.revision) || 0;
      const localRevision = Number(previousState.meta?.revision) || 0;
      const sameCommit = remoteRevision === localRevision
        && normalizedRemote.meta?.updatedBy === previousState.meta?.updatedBy;
      if (sameCommit){
        this.lastConfirmedRevision = Math.max(this.lastConfirmedRevision, remoteRevision);
        this.status = 'Cloud opgeslagen';
        renderCloudStatus();
        return;
      }
      const localIsFresh = !DataAdapter.loadedFromStorage && localRevision === 0;
      if (this.pendingState || this.writeInFlight || (!localIsFresh && remoteRevision <= localRevision)){
        this.status = this.pendingState || this.writeInFlight ? 'Opslaan…' : 'Lokaal opgeslagen';
        renderCloudStatus();
        return;
      }
      DataAdapter.backup(previousState, 'voor Firestore-sync');
      this.applyingRemote = true;
      state = normalizedRemote;
      window.state = state;
      committedStateSnapshot = clone(state);
      try{
        await GoalImageStore.initializeState(state);
        localSave(state);
      }catch(e){ console.error('lokale kopie Firestore-data opslaan mislukt', e); }
      DataAdapter.loadedFromStorage = true;
      this.applyingRemote = false;
      this.lastConfirmedRevision = remoteRevision;
      this.status = 'Cloud opgeslagen';
      renderActiveTab();
    }, err=>{
      console.error('Firestore live-sync fout', err);
      this.status = navigator.onLine ? 'Synchronisatie mislukt' : 'Offline — lokaal bewaard';
      renderCloudStatus();
    });
  },
  queueSave(state){
    if (this.applyingRemote) return;
    this.pendingState = clone(state);
    this.status = this.isConnected() ? 'Opslaan…' : 'Offline — lokaal bewaard';
    renderCloudStatus();
    if (!this.isConnected()) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(()=> this.flushQueue(), 350);
  },
  async flushQueue(){
    if (this.writeInFlight || !this.isConnected() || !this.pendingState) return false;
    const snapshot = this.pendingState;
    this.pendingState = null;
    this.writeInFlight = true;
    const ok = await this.saveNow(snapshot);
    this.writeInFlight = false;
    if (ok){
      this.retryAttempt = 0;
      clearTimeout(this.retryTimer);
      if (this.pendingState) return this.flushQueue();
      return true;
    }
    if (!this.lastFailureRetryable) return false;
    if (!this.pendingState || Number(this.pendingState.meta?.revision) < Number(snapshot.meta?.revision)){
      this.pendingState = snapshot;
    }
    this.scheduleRetry();
    return false;
  },
  scheduleRetry(){
    clearTimeout(this.retryTimer);
    const delay = Math.min(30000, 1000 * (2 ** Math.min(this.retryAttempt++, 5)));
    this.retryTimer = setTimeout(()=>this.flushQueue(), delay);
  },
  async saveNow(snapshot){
    if (!this.isConnected()) return false;
    this.lastFailureRetryable = true;
    try{
      const cloudSnapshot = clone(snapshot);
      await GoalImageStore.expandStateForTransfer(cloudSnapshot);
      const payloadBytes = new Blob([JSON.stringify(cloudSnapshot)]).size;
      if (payloadBytes > 900000){
        this.lastFailureRetryable = false;
        this.status = 'Synchronisatie mislukt';
        console.error('Cloudopslag overgeslagen: app-data is groter dan 900 kB.');
        renderCloudStatus();
        return false;
      }
      const validation = validateBudgetState(cloudSnapshot);
      if (!validation.ok){
        this.lastFailureRetryable = false;
        this.status = 'Synchronisatie mislukt';
        renderCloudStatus();
        return false;
      }
      const {firestore} = this.modules;
      await firestore.setDoc(this.docRef, {
        state:cloudSnapshot,
        updatedAt: firestore.serverTimestamp(),
        revision:Number(cloudSnapshot.meta?.revision)||0,
        updatedBy:cloudSnapshot.meta?.updatedBy || getDeviceId(),
        app: 'finize'
      }, {merge:true});
      this.lastConfirmedRevision = Number(cloudSnapshot.meta?.revision)||0;
      this.status = this.pendingState ? 'Opslaan…' : 'Cloud opgeslagen';
      renderCloudStatus();
      return true;
    }catch(e){
      console.error('Firestore opslaan mislukt', e);
      this.status = navigator.onLine ? 'Synchronisatie mislukt' : 'Offline — lokaal bewaard';
      renderCloudStatus();
      return false;
    }
  },
  async signOut(){
    if (this.unsubscribe){ this.unsubscribe(); this.unsubscribe = null; }
    this.app = null;
    this.db = null;
    this.docRef = null;
    this.status = 'Offline — lokaal bewaard';
    renderCloudStatus();
  }
};
window.CloudAdapter = CloudAdapter;

const DataAdapter = {
  loadedFromStorage:false,
  // Lokaal blijft altijd de eerste veiligheidslaag. Firestore is optionele live-sync erbovenop.
  // Firebase Storage is voor losse bestanden; Firestore is de juiste plek voor live app-data.
  // We bewaren dezelfde state-vorm als 1 groot JSON-document voor Finize.
  save(state){
    try{
      localSave(state);
      CloudAdapter.queueSave(state);
      return true;
    }catch(e){ console.error('opslaan mislukt', e); return false; }
  },
  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      this.loadedFromStorage = true;
      const parsed = JSON.parse(raw);
      const migrated = migrateBudgetState(parsed);
      const validation = validateBudgetState(migrated);
      if (!validation.ok){
        console.error('opgeslagen data ongeldig', validation.errors);
        return null;
      }
      return migrated;
    }catch(e){ console.error('laden mislukt', e); return null; }
  },
  backup(state, reason){
    try{
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        label: backupLabel(),
        reason,
        state
      }));
      return true;
    }catch(e){ console.error('back-up maken mislukt', e); return false; }
  },
  loadBackup(){
    try{
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ console.error('back-up laden mislukt', e); return null; }
  }
};

var state = null;
try{
  state = DataAdapter.load() || migrateBudgetState(defaultState());
}catch(error){
  window.__finizeInitError = {
    message: String(error?.message || error),
    stack: String(error?.stack || '')
  };
  console.error('Finize initialisatie mislukt', error);
  throw error;
}
window.state = state;
var committedStateSnapshot = clone(state);
let activeTab = 'dashboard';
const TODAY = new Date();

function commitChange(change, options={}){
  const before = clone(committedStateSnapshot||state);
  try{
    if (typeof change === 'function') change(state);
    else if (typeof change?.apply === 'function') change.apply(state);
    if(JSON.stringify(before)===JSON.stringify(state))return true;
    Object.entries(before.monthRecords||{}).forEach(([month,record])=>{
      if(!['afgesloten','correctie-nodig'].includes(record?.status))return;
      const afterRecord=state.monthRecords?.[month];
      const lateImportAllowed=['afgesloten','correctie-nodig'].includes(record.status)&&afterRecord?.status==='correctie-nodig'&&
        (afterRecord.lateImportTransactionIds||[]).length>(record.lateImportTransactionIds||[]).length;
      const monthData=snapshot=>({
        transactions:(snapshot.transactions||[]).filter(tx=>transactionMonth(tx)===month),
        income:snapshot.monthlyIncome?.[month]||null,
        incomeOverrides:snapshot.monthlyIncomeOverrides?.[month]||null,
        budgets:snapshot.monthlyBudgets?.[month]||null,
        refunds:snapshot.monthlyTeruggaven?.[month]||null,
        savings:(snapshot.savingsGoalLedger||[]).filter(row=>row.month===month),
        advances:(snapshot.advanceLedger||[]).filter(row=>row.month===month),
        repayments:(snapshot.advanceRepayments||[]).filter(row=>String(row.date||'').slice(0,7)===month),
        reserves:(snapshot.reserveLedger||[]).filter(row=>row.month===month),
        transfers:(snapshot.internalTransfers||[]).filter(row=>row.month===month)
      });
      if(!lateImportAllowed&&options.mutationMode!=='correction'&&JSON.stringify(monthData(before))!==JSON.stringify(monthData(state))){
        throw new Error('Deze maand is afgesloten. Heropen de maand of maak een correctie om financiële gegevens te wijzigen.');
      }
    });
    ensurePersistentIds(state);
    state.meta = isPlainObject(state.meta) ? state.meta : {};
    state.meta.schemaVersion = U3_SCHEMA_VERSION;
    state.meta.revision = Math.max(0, Number(state.meta.revision)||0) + 1;
    state.meta.updatedAt = new Date().toISOString();
    state.meta.updatedBy = getDeviceId();
    const validation = validateBudgetState(state);
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    if (!DataAdapter.save(state)) throw new Error('Lokale opslag is mislukt.');
    committedStateSnapshot = clone(state);
    if (options.render !== false) renderCloudStatus();
    return true;
  }catch(e){
    state = before;
    window.state = state;
    committedStateSnapshot = clone(before);
    CloudAdapter.status = 'Synchronisatie mislukt';
    renderCloudStatus();
    console.error('Wijziging opslaan mislukt', e);
    return false;
  }
}

function persist(){
  return commitChange(()=>{}, {render:false});
}

function renderCloudStatus(){
  const cloud = document.getElementById('cloudStatus');
  if (cloud) cloud.textContent = CloudAdapter.statusText();
  const save = document.getElementById('saveStatus');
  const status = CloudAdapter.statusText();
  const online = CloudAdapter.isConnected() && status !== 'Synchronisatie mislukt';
  if (save){
    save.textContent = status;
    save.title = status + ' · klik voor back-up en cloud';
    save.dataset.storageStatus = status;
    save.classList.toggle('offline', !online);
  }
  document.querySelectorAll('.mobile-status-pill').forEach(pill=>{
    pill.textContent = status;
    pill.classList.toggle('offline', !online);
  });
}

/* ---------- generieke input-binding ---------- */
// Elk element met data-path krijgt zijn waarde uit/naar de state via getPath/setPath.
function bindInputs(root){
  root.querySelectorAll('[data-month-income]').forEach(el=>{
    const person = el.dataset.monthIncome;
    el.value = getMonthlyIncome(person);
    const commit = ()=>{
      const parsed = parseFloat(String(el.value).replace(',', '.'));
      const value=Number.isFinite(parsed) ? parsed : 0;
      if(round2(Number(getMonthlyIncome(person))||0)===round2(value))return;
      setMonthlyIncome(person, value);
      persist();
      renderActiveTab();
    };
    el.addEventListener('change', commit);
  });
  root.querySelectorAll('[data-path]').forEach(el=>{
    const path = el.dataset.path;
    const type = el.type;
    const raw = getPath(state, path);
    if (type === 'checkbox') el.checked = !!raw;
    else if (el.dataset.percent === 'true') el.value = percentInputValue(raw);
    else el.value = raw === undefined || raw === null ? '' : raw;

    const commit = ()=>{
      let v = el.value;
      if (type === 'number'){
        v = v === '' ? 0 : parseFloat(v.replace(',', '.'));
        if (!Number.isFinite(v)) v = 0;
        if (el.dataset.percent === 'true') v = v / 100;
      }
      if (type === 'checkbox') v = el.checked;
      if(JSON.stringify(getPath(state,path))===JSON.stringify(v))return;
      setPath(state, path, v);
      persist();
      renderActiveTab();
    };
    el.addEventListener('change', commit);
  });
  root.querySelectorAll('[data-item-path][data-item-id][data-item-field]').forEach(el=>{
    const item = findItemById(el.dataset.itemPath, el.dataset.itemId);
    if (!item) return;
    const field = el.dataset.itemField;
    if (el.type === 'checkbox') el.checked = !!item[field];
    else if (el.dataset.percent === 'true') el.value = percentInputValue(item[field]);
    else el.value = item[field] ?? '';
    const save = ()=>{
      let value = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number'){
        const parsed = bankAmount(value);
        value = Number.isFinite(parsed) ? round2(parsed) : 0;
        if (el.dataset.percent === 'true') value /= 100;
      } else if (typeof value === 'string') value = value.trim();
      if(JSON.stringify(item[field])===JSON.stringify(value))return;
      commitChange(()=>updateItemById(el.dataset.itemPath, el.dataset.itemId, {[field]:value}), {render:false});
    };
    el.addEventListener('change', save);
  });
}

/* ---------- tabel-editor voor vaste lasten / variabel ---------- */
function sortedRowEntries(rows){
  return (rows||[]).map((row, index)=>({row, index})).sort((a,b)=>{
    const cat = String(a.row.categorie||'').localeCompare(String(b.row.categorie||''), 'nl', {sensitivity:'base'});
    if (cat) return cat;
    const post = String(a.row.post||'').localeCompare(String(b.row.post||''), 'nl', {sensitivity:'base'});
    if (post) return post;
    return a.index - b.index;
  });
}
function moveTargetOptions(basePath){
  const parts = basePath.split('.');
  if (parts.length !== 3 || parts[2] !== 'vasteLasten') return null;
  const scenario = parts[0];
  const current = parts[1];
  return ['gezamenlijk','dion','dara'].map(key=>{
    const label = key === 'gezamenlijk' ? 'Gezamenlijk' : (key === 'dion' ? 'Dion' : 'Dara');
    return `<option value="${scenario}.${key}.vasteLasten" ${key===current?'selected':''}>${label}</option>`;
  }).join('');
}
function renderRowsTable(basePath, rows, opts={}){
  const withJaar = !!opts.jaarlijks;
  const total = withJaar ? sumEffective(rows) : sumBedrag(rows);
  const useScroll = opts.fixedHeight !== false || (rows||[]).length > 5;
  const moveOptions = opts.moveable ? moveTargetOptions(basePath) : null;
  const moveHead = moveOptions ? '<th>Van/naar</th>' : '';
  const moveCol = (id)=> moveOptions ? `<td><select class="move-select" data-move-row-id="${textSafe(id)}" data-source-path="${basePath}" title="Verplaatsen naar">${moveOptions}</select></td>` : '';
  const rowsHtml = sortedRowEntries(rows).map(({row:r})=>{
    const eff = effectiveBedrag(r);
    const jaarHint = r.jaarlijks ? `<div class="progress-label" style="text-align:left;margin-top:2px">≈ ${eur(eff)}/mnd</div>` : '';
    return `
    <tr>
      <td style="width:26px;text-align:center;font-size:15px">${categoryIcon(r.categorie)}</td>
      <td><input type="text" data-item-path="${basePath}" data-item-id="${textSafe(r.id)}" data-item-field="categorie" placeholder="Categorie"></td>
      <td><input type="text" data-item-path="${basePath}" data-item-id="${textSafe(r.id)}" data-item-field="post" placeholder="Omschrijving"></td>
      <td class="num"><input type="number" step="0.01" data-item-path="${basePath}" data-item-id="${textSafe(r.id)}" data-item-field="bedrag">${jaarHint}</td>
      ${withJaar ? `<td style="text-align:center"><input type="checkbox" data-item-path="${basePath}" data-item-id="${textSafe(r.id)}" data-item-field="jaarlijks" title="Bedrag is jaarlijks (wordt /12 gerekend)"></td>` : ''}
      ${moveCol(r.id)}
      <td class="row-actions"><button class="danger-ghost" data-remove-id="${textSafe(r.id)}" data-remove-path="${basePath}" title="Verwijderen">×</button></td>
    </tr>`;
  }).join('');
  const colspan = 5 + (withJaar ? 1 : 0) + (moveOptions ? 1 : 0);
  return `
    <div class="${useScroll ? 'scroll-area table-scroll' : ''}">
    <table>
      <thead><tr>
        <th></th><th>Categorie</th><th>Omschrijving</th><th style="text-align:right">Bedrag</th>
        ${withJaar ? '<th style="text-align:center" title="Bedrag is jaarlijks">Jaarlijks?</th>' : ''}${moveHead}<th></th>
      </tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="${colspan}" style="color:var(--text-faint)">Nog geen posten toegevoegd.</td></tr>`}</tbody>
      <tfoot><tr class="tot-row"><td colspan="3">Totaal per maand</td><td class="num">${eur(total)}</td>${withJaar?'<td></td>':''}${moveOptions?'<td></td>':''}<td></td></tr></tfoot>
    </table>
    </div>
    <button class="ghost small add-row-btn" data-addrow="${basePath}">+ Post toevoegen</button>
  `;
}

function renderTeruggavenTable(basePath, rows){
  const total = sumBedrag(rows);
  const useScroll = (rows||[]).length > 5;
  const rowsHtml = (rows||[]).map(r=>`
    <tr>
      <td><input type="text" data-item-path="${basePath}" data-item-id="${textSafe(r.id)}" data-item-field="omschrijving" placeholder="Omschrijving"></td>
      <td class="num"><input type="number" step="0.01" data-item-path="${basePath}" data-item-id="${textSafe(r.id)}" data-item-field="bedrag"></td>
      <td class="row-actions"><button class="danger-ghost" data-remove-id="${textSafe(r.id)}" data-remove-path="${basePath}" title="Verwijderen">×</button></td>
    </tr>
  `).join('');
  return `
    <div class="${useScroll ? 'scroll-area table-scroll' : ''}">
    <table>
      <thead><tr><th>Omschrijving</th><th style="text-align:right">Bedrag</th><th></th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="3" style="color:var(--text-faint)">Nog geen vaste teruggaven.</td></tr>'}</tbody>
      <tfoot><tr class="tot-row"><td>Totaal per maand</td><td class="num">${eur(total)}</td><td></td></tr></tfoot>
    </table>
    </div>
    <button class="ghost small add-row-btn" data-addrefund="${basePath}">+ Teruggave toevoegen</button>
  `;
}

function handleTableClicks(root){
  root.querySelectorAll('[data-addrow]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const path = btn.dataset.addrow;
      commitChange(()=>getPath(state, path).push({id:uid(), categorie:'', post:'', bedrag:0}), {render:false});
      renderActiveTab();
    });
  });
  root.querySelectorAll('[data-addrefund]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const path = btn.dataset.addrefund;
      commitChange(()=>getPath(state, path).push({id:uid(), omschrijving:'', bedrag:0}), {render:false});
      renderActiveTab();
    });
  });
  root.querySelectorAll('[data-remove-id][data-remove-path]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const path = btn.dataset.removePath;
      const label = path.includes('spaardoelen') ? 'Spaardoel verwijderd'
        : path.includes('variabel') ? 'Variabel budget verwijderd'
        : path.toLowerCase().includes('teruggaven') ? 'Teruggave verwijderd'
        : 'Vaste last verwijderd';
      removeWithUndo(path, btn.dataset.removeId, label);
    });
  });
  root.querySelectorAll('[data-move-row-id][data-source-path]').forEach(select=>{
    select.addEventListener('change', ()=>{
      const sourcePath = select.dataset.sourcePath;
      const targetPath = select.value;
      const id = select.dataset.moveRowId;
      if (!targetPath || targetPath === sourcePath) return;
      let movement = null;
      if (!commitChange(()=>{ movement = moveItemById(sourcePath, targetPath, id); }, {render:false}) || !movement) return;
      renderActiveTab();
      showUndoToast('Vaste last verplaatst', ()=>{
        commitChange(()=>moveItemById(targetPath, sourcePath, id, movement.sourceIndex), {render:false});
        renderActiveTab();
      });
    });
  });
  root.querySelectorAll('[data-remove-transaction]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.removeTransaction;
      const tx=(state.transactions||[]).find(item=>item.id===id);
      try{if(tx)assertMonthMutationAllowed(transactionMonth(tx));}catch(error){alert(error.message);return;}
      removeWithUndo('transactions', id, 'Transactie verwijderd');
    });
  });
  root.querySelectorAll('[data-open-transaction]').forEach(btn=>{
    btn.addEventListener('click', ()=> openTransactionModal());
  });
}
function splitLastIndex(pathWithIndex){
  const parts = pathWithIndex.split('.');
  const idx = parts.pop();
  return [parts.join('.'), idx];
}

/* ---------- alleen-lezen spaardoelen-overzicht (voor Gezamenlijk/Dion/Dara tabs) ---------- */
function renderGoalOverviewTable(doelen, spaarpotDezeMaand){
  const berekend = calcGroep(doelen, spaarpotDezeMaand, TODAY);
  const totaalDoelbedrag = round2(berekend.reduce((s,b)=>s+(Number(b.doel.doelbedrag)||0),0));
  const totaalAlGespaard = round2(berekend.reduce((s,b)=>s+(Number(b.doel.algespaard)||0),0));
  const totaalNogTeGaan = round2(berekend.reduce((s,b)=>s+(b.nogTeGaan||0),0));
  const totaalBenodigd = round2(berekend.reduce((s,b)=>s+(b.benodigdPerMaand||0),0));
  const totaalVast = round2(berekend.reduce((s,b)=>s+(Number(b.doel.vasteInleg)||0),0));
  const totaalExtra = round2(berekend.reduce((s,b)=>s+(b.berekendeExtraInleg||0),0));
  const totaalWerkelijk = round2(berekend.reduce((s,b)=>s+(b.werkelijkeInleg||0),0));
  const rows = berekend.map(b=>{
    const barPct = Math.min(100, Math.round((b.voortgang||0)*100));
    return `<tr>
      <td>${b.doel.naam || '(naamloos)'}</td>
      <td class="num">${eur(Number(b.doel.doelbedrag)||0)}</td>
      <td class="num">${eur(Number(b.doel.algespaard)||0)}</td>
      <td class="num">${eur(b.nogTeGaan)}</td>
      <td><div class="progress-track"><div class="progress-fill" style="width:${barPct}%"></div></div><div class="progress-label">${pct(b.voortgang)}</div></td>
      <td>${formatDateNL(b.doel.doeldatum)}</td>
      <td class="num">${b.benodigdPerMaand===null?'—':eur(b.benodigdPerMaand)}</td>
      <td class="num">${eur(Number(b.doel.vasteInleg)||0)}</td>
      <td class="num">${eur(b.berekendeExtraInleg||0)}</td>
      <td class="num">${eur(b.werkelijkeInleg)}</td>
    </tr>`;
  }).join('');
  return `<div class="goal-table-wrap"><table class="goal-table">
    <thead><tr>
      <th class="col-name">Spaardoel</th><th class="col-money" style="text-align:right">Doelbedrag</th><th class="col-money" style="text-align:right">Al gespaard</th>
      <th class="col-money" style="text-align:right">Nog te gaan</th><th class="col-progress">Voortgang</th><th class="col-date">Doeldatum</th>
      <th class="col-money" style="text-align:right">Benodigde inleg/maand</th><th class="col-money" style="text-align:right">Vaste inleg/mnd</th>
      <th class="col-money" style="text-align:right">Extra deze maand</th><th class="col-money" style="text-align:right">Inleg deze maand</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="10" style="color:var(--text-faint)">Nog geen spaardoelen. Voeg ze toe op het tabblad Spaardoelen.</td></tr>`}</tbody>
    <tfoot><tr>
      <td>Totaal</td><td class="num">${eur(totaalDoelbedrag)}</td><td class="num">${eur(totaalAlGespaard)}</td>
      <td class="num">${eur(totaalNogTeGaan)}</td><td></td><td></td>
      <td class="num">${eur(totaalBenodigd)}</td><td class="num">${eur(totaalVast)}</td>
      <td class="num">${eur(totaalExtra)}</td><td class="num">${eur(totaalWerkelijk)}</td>
    </tr></tfoot>
  </table></div>`;
}


function renderGoalGroup(basePath, doelen, spaarpotDezeMaand){
  const berekend = calcGroep(doelen, spaarpotDezeMaand, TODAY);
  const rows = berekend.map((b,i)=>{
    const barPct = Math.min(100, Math.round((b.voortgang||0)*100));
    return `
    <tr>
      <td class="goal-favorite-cell">
        <label class="favorite-goal" title="Favoriet op dashboard">
          <input type="checkbox" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="favoriet">
          <span>★</span>
        </label>
      </td>
      <td class="goal-order-cell">
        <div class="goal-order" aria-label="Volgorde wijzigen">
          <button class="ghost small" data-move-goal="${basePath}|${textSafe(b.doel.id)}|-1" title="Omhoog" ${i===0?'disabled':''}>▲</button>
          <button class="ghost small" data-move-goal="${basePath}|${textSafe(b.doel.id)}|1" title="Omlaag" ${i===berekend.length-1?'disabled':''}>▼</button>
        </div>
      </td>
      <td data-label="Spaardoel"><input type="text" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="naam" placeholder="Naam spaardoel">
        <label style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--text-dim);margin-top:5px">
          <input type="checkbox" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="vastBedrag"> Vast bedrag
        </label>
      </td>
      <td data-label="Doelbedrag" class="num"><input type="number" step="0.01" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="doelbedrag"></td>
      <td data-label="Al gespaard" class="num"><input type="number" step="0.01" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="algespaard"></td>
      <td data-label="Nog te gaan" class="num">${eur(b.nogTeGaan)}</td>
      <td data-label="Voortgang"><div class="progress-track"><div class="progress-fill" style="width:${barPct}%"></div></div><div class="progress-label">${pct(b.voortgang)}</div></td>
      <td data-label="Doeldatum"><input type="date" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="doeldatum"></td>
      <td class="num">${b.benodigdPerMaand===null?'—':eur(b.benodigdPerMaand)}</td>
      <td data-label="Vaste inleg/mnd" class="num"><input type="number" step="0.01" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="vasteInleg"></td>
      <td data-label="Verwacht rendement %" class="num">
        <input type="number" step="0.01" data-percent="true" data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="rendement">
        <select data-item-path="${basePath}" data-item-id="${textSafe(b.doel.id)}" data-item-field="rendementPeriode" style="width:100%;margin-top:5px">
          <option value="jaarlijks">Jaarlijks</option>
          <option value="maandelijks">Maandelijks</option>
        </select>
      </td>
      <td class="num">${b.verwachteWaarde===null?'—':eur(b.verwachteWaarde)}</td>
      <td class="row-actions"><button class="danger-ghost" data-remove-id="${textSafe(b.doel.id)}" data-remove-path="${basePath}" title="Verwijderen">×</button></td>
    </tr>`;
  }).join('');
  const totBenodigd = round2(berekend.reduce((s,b)=>s+(b.benodigdPerMaand||0),0));
  const totDoelbedrag = round2(berekend.reduce((s,b)=>s+(Number(b.doel.doelbedrag)||0),0));
  const totAlGespaard = round2(berekend.reduce((s,b)=>s+(Number(b.doel.algespaard)||0),0));
  const totNogTeGaan = round2(berekend.reduce((s,b)=>s+(b.nogTeGaan||0),0));
  const totVast = round2(berekend.reduce((s,b)=>s+(Number(b.doel.vasteInleg)||0),0));
  const totVerwacht = round2(berekend.reduce((s,b)=>s+(b.verwachteWaarde||0),0));
  return `
    <div class="goal-table-wrap"><table class="goal-table">
      <thead><tr>
        <th class="col-favorite"></th><th class="col-order"></th><th class="col-name">Spaardoel</th><th class="col-money" style="text-align:right">Doelbedrag</th><th class="col-money" style="text-align:right">Al gespaard</th>
        <th class="col-money" style="text-align:right">Nog te gaan</th><th class="col-progress">Voortgang</th><th class="col-date">Doeldatum</th>
        <th class="col-money" style="text-align:right">Benodigde inleg/maand</th><th class="col-money" style="text-align:right">Vaste inleg/mnd</th>
        <th class="col-rate" style="text-align:right">Verwacht rendement %</th><th class="col-money" style="text-align:right">Verwachte waarde op datum</th><th class="col-actions"></th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="13" style="color:var(--text-faint)">Nog geen spaardoelen.</td></tr>`}</tbody>
      <tfoot><tr>
        <td></td><td class="goal-order-cell"></td><td data-label="Spaardoel">Totaal</td><td data-label="Doelbedrag" class="num">${eur(totDoelbedrag)}</td><td data-label="Al gespaard" class="num">${eur(totAlGespaard)}</td>
        <td class="num">${eur(totNogTeGaan)}</td><td></td><td></td>
        <td class="num">${eur(totBenodigd)}</td><td class="num">${eur(totVast)}</td><td></td>
        <td class="num">${eur(totVerwacht)}</td><td></td>
      </tr></tfoot>
    </table></div>
    <button class="ghost small add-row-btn" data-addgoal="${basePath}">+ Spaardoel toevoegen</button>
  `;
}
function handleGoalClicks(root){
  root.querySelectorAll('[data-move-goal]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [path,id,directionText] = btn.dataset.moveGoal.split('|');
      const direction = Number(directionText);
      const arr = getPath(state, path);
      const idx = arr.findIndex(goal=>goal.id === id);
      const next = idx + direction;
      if (!Array.isArray(arr) || next < 0 || next >= arr.length) return;
      commitChange(()=>moveItemById(path,path,id,next), {render:false}); renderActiveTab();
    });
  });
  root.querySelectorAll('[data-addgoal]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const path = btn.dataset.addgoal;
      commitChange(()=>getPath(state, path).push({id:uid(), naam:'Nieuw doel', doelbedrag:0, algespaard:0, doeldatum:'', vasteInleg:0, rendement:0.0125, rendementPeriode:'jaarlijks', favoriet:false}), {render:false});
      renderActiveTab();
    });
  });
}


/* ---------- dashboard ---------- */
function renderDashboard(){
  rescueMonthControl();
  const r = calcScenario(state);
  const scenarioData = getMonthlyScenarioData(state.meta.scenario);
  const gGoals = calcGroep(state.spaardoelen.gezamenlijk, r.spaarpotDezeMaand, TODAY);
  const dionGoals = calcGroep(state.spaardoelen.dion, r.dion.beschikbaarVoorSparen, TODAY);
  const daraGoals = calcGroep(state.spaardoelen.dara, r.dara.beschikbaarVoorSparen, TODAY);
  const allGoals = [
    ...gGoals.map(g=>({...g, owner:'Gezamenlijk'})),
    ...dionGoals.map(g=>({...g, owner:'Dion'})),
    ...daraGoals.map(g=>({...g, owner:'Dara'})),
  ];
  const totalZakgeld = round2(r.dion.zakgeld + r.dara.zakgeld);
  const incomeBreakdown = dashboardIncomeBreakdown(getSelectedMonth());
  const dashboardTotalIncome = incomeBreakdown.total;
  const jointRemaining = round2(r.totaalSalaris - r.gezamenlijkeLastenTotaal - r.spaarpotDezeMaand);
  const splitDion = totalZakgeld > 0 ? Math.max(0, r.dion.zakgeld / totalZakgeld) : .5;
  const variabelBudgetPct = r.variabelBudgetTotaal > 0 ? Math.min(100, Math.round((r.variabelTotaal / r.variabelBudgetTotaal) * 100)) : 0;
  const zakgeldTekort = totalZakgeld <= 0 || r.dion.zakgeld < 0 || r.dara.zakgeld < 0;
  const zakgeldTekortBarClass = !zakgeldTekort ? '' : (r.dion.zakgeld > 0 && r.dara.zakgeld <= 0 ? ' split-bar-single-color-dion' : (r.dara.zakgeld > 0 && r.dion.zakgeld <= 0 ? ' split-bar-single-color-dara' : ' split-bar-single-color'));
  const zakgeldCardBody = `<div class="allowance-return-body ${zakgeldTekort ? 'allowance-return-body-short' : 'allowance-return-body-split'}"><div class="metric-value">${eur(totalZakgeld)}</div>
       <div class="split-bar${zakgeldTekortBarClass}"><span style="width:${zakgeldTekort ? 100 : Math.round(splitDion*100)}%"></span><span style="width:${zakgeldTekort ? 0 : 100-Math.round(splitDion*100)}%"></span></div>
       <div class="summary-list">
         <div class="summary-line"><span class="summary-person-label"><span class="person-dot dion"></span>Dion</span><strong class="${zakgeldTekort ? (r.dion.zakgeld<0?'value neg':'value pos') : ''}">${eur(r.dion.zakgeld)}${zakgeldTekort ? '' : ` · ${pct(splitDion)}`}</strong></div>
         <div class="summary-line"><span class="summary-person-label"><span class="person-dot dara"></span>Dara</span><strong class="${zakgeldTekort ? (r.dara.zakgeld<0?'value neg':'value pos') : ''}">${eur(r.dara.zakgeld)}${zakgeldTekort ? '' : ` · ${pct(1-splitDion)}`}</strong></div>
       </div></div>`;
  const budgetRows = (scenarioData.gezamenlijk.variabel||[]).filter(row=>row.post || row.bedrag).map(row=>{
    const budget = Number(row.bedrag)||0;
    const used = sumTransactions('gezamenlijk', row.post);
    const ratio = budget > 0 ? Math.min(1, used / budget) : 0;
    const label=row.post || row.categorie || 'Budget';
    return `<button type="button" class="budget-preview-item budget-preview-button" data-open-budget-transactions="${textSafe(label)}" aria-label="Open transacties voor ${textSafe(label)}">
      <div class="budget-preview-thumb tone-green">${iconSvg(categoryIconName(label))}</div>
      <div class="budget-preview-main">
        <div class="budget-preview-top"><strong>${textSafe(label)}</strong><span><span class="neutral-amount">${eur(used)}</span> / <span class="neutral-amount">${eur(budget)}</span></span></div>
        <div class="progress-track budget-gradient"><div class="progress-fill budget-gradient" style="width:${Math.round(ratio*100)}%"></div></div>
      </div>
    </button>`;
  }).join('');
  const vasteByCat = {};
  (scenarioData.gezamenlijk.vasteLasten||[]).forEach(row=>{
    const cat = normalizeCategoryName(row.categorie);
    vasteByCat[cat] = round2((vasteByCat[cat]||0) + effectiveBedrag(row));
  });
  if (state.meta.scenario === 'na'){
    (scenarioData.gezamenlijk.hypotheek||[]).forEach(row=>{
      const cat = normalizeCategoryName(row.categorie || 'Huis');
      vasteByCat[cat] = round2((vasteByCat[cat]||0) + effectiveBedrag(row));
    });
  }
  const vasteEntriesSorted = Object.entries(vasteByCat).sort((a,b)=>b[1]-a[1]);
  const vasteRows = vasteEntriesSorted.map(([cat, amount])=>{
    const ratio = r.vasteLastenTotaal > 0 ? amount / r.vasteLastenTotaal : 0;
    const note = state.meta.scenario === 'na' && /huis|hypotheek|wonen/i.test(cat) && r.hypotheekBedrag > 0
      ? '<span class="joint-fixed-note">Hypotheek 50/50</span>'
      : '';
    return `<div class="progress-item ${note ? 'joint-fixed-has-note' : ''}">
      <div class="progress-item-icon tone-green">${iconSvg(jointFixedCategoryIconName(cat))}</div><div class="progress-top"><strong>${cat}</strong><span>${eur(amount)} · ${pct(ratio)}</span></div>
      ${note}
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round(ratio*100)}%"></div></div>
    </div>`;
  }).join('');
  const sortedGoals = [...allGoals].sort((a,b)=>{
    if (!!a.doel.favoriet !== !!b.doel.favoriet) return a.doel.favoriet ? -1 : 1;
    const ad = a.doel.doeldatum ? new Date(a.doel.doeldatum).getTime() : Infinity;
    const bd = b.doel.doeldatum ? new Date(b.doel.doeldatum).getTime() : Infinity;
    return ad - bd;
  });
  const favoriteGoals = sortedGoals.filter(item=>item.doel?.favoriet);
  const goalCardsDesktop = favoriteGoals.length
    ? `<div class="dashboard-goals-preview-list">${favoriteGoals.slice(0,4).map(g=>renderDashboardGoalPreviewCard(g)).join('')}</div>`
    : `<div class="u5-goal-fallback"><strong>Nog geen favoriete spaardoelen</strong><span>${allGoals.length} doelen beschikbaar</span></div>`;
  const goalCardsMobile = sortedGoals.length
    ? `<div class="dashboard-goals-preview-list">${sortedGoals.slice(0,3).map(g=>renderDashboardGoalPreviewCard(g)).join('')}</div>`
    : '';
  const year = Number(getSelectedMonth().slice(0,4));
  const yearData = Array.from({length:12}, (_,i)=>{
    const key = monthKey(new Date(year, i, 1));
    const monthResult=getMonthFinancialResult(key);
    const income=round2(Number(monthResult.income?.total)||0);
    const spent=round2((Number(monthResult.fixedExpenses)||0)+(Number(monthResult.variableExpenses?.total)||0));
    const saving=round2(Number(monthResult.savings)||0);
    return { key, name:['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'][i], income, spent, saving };
  });
  const maxYearValue = Math.max(1, ...yearData.flatMap(m=>[m.income, m.spent, m.saving]));
  const currentMonthKey = monthKey(TODAY);
  const yearTotals = {
    income: round2(yearData.reduce((s,m)=>s+m.income,0)),
    spent: round2(yearData.reduce((s,m)=>s+m.spent,0)),
    saving: round2(yearData.reduce((s,m)=>s+m.saving,0)),
  };
  const monthFinancialResult = getMonthFinancialResult(getSelectedMonth());
  const actualMonthResult = round2(Number(monthFinancialResult?.remaining)||0);
  const budgetDifference = round2(r.variabelBudgetTotaal - r.variabelTotaal);
  const CHART_H = 84;
  const monthBars = yearData.map(m=>{
    const isFuture = m.key > currentMonthKey;
    const active = m.key === getSelectedMonth() ? ' active' : '';
    const futureCls = isFuture ? ' future' : '';
    const hIncome = Math.max(2, Math.round((m.income/maxYearValue)*CHART_H));
    const hSpent = Math.max(2, Math.round((m.spent/maxYearValue)*CHART_H));
    const hSaving = Math.max(2, Math.round((m.saving/maxYearValue)*CHART_H));
    return `<div class="year-col${active}${futureCls}" title="${m.name}: inkomen ${eur(m.income)}, uitgaven ${eur(m.spent)}, sparen ${eur(m.saving)}">
      <div class="year-col-bars" style="height:${CHART_H}px">
        <span class="year-bar-v income" style="height:${hIncome}px"></span>
        <span class="year-bar-v spent" style="height:${hSpent}px"></span>
        <span class="year-bar-v saving" style="height:${hSaving}px"></span>
      </div>
      <div class="year-col-label">${m.name}</div>
    </div>`;
  }).join('');
  const personSummary = (label,rr)=>`
    <div class="card span-4 dash-status-card v4-desktop-only-block">
      ${renderDashboardCardHead(label, '', label === 'Dion' ? 'terracotta' : 'blue')}
      <div class="summary-list">
        <div class="summary-line"><span>Zakgeld ontvangen</span><strong class="${rr.zakgeld<0?'value neg':'value pos'}">${eur(rr.zakgeld)}</strong></div>
        <div class="summary-line"><span>Persoonlijke vaste lasten / correcties</span><strong class="value neg">${eur(rr.persoonlijkeVasteLasten)}</strong></div>
        <div class="summary-line"><span>Uitgaven deze maand</span><strong class="value neg">${eur(rr.variabeleUitgaven)}</strong></div>
        <div class="summary-line"><span>Beschikbaar voor sparen/vrij gebruik</span><strong class="${rr.beschikbaarVoorSparen<0?'value neg':'value pos'}">${eur(rr.beschikbaarVoorSparen)}</strong></div>
      </div>
    </div>`;
  const jointSummary = `
    <div class="card span-4 dash-status-card v4-desktop-only-block">
      ${renderDashboardCardHead('Gezamenlijk', '', 'green')}
      <div class="summary-list">
        <div class="summary-line"><span>Vaste lasten + budgetten</span><strong class="value neg">${eur(r.gezamenlijkeLastenTotaal)}</strong></div>
        <div class="summary-line"><span>Variabel gebruikt</span><strong class="value neg">${eur(r.variabelTotaal)}</strong></div>
        <div class="summary-line"><span>Sparen</span><strong class="value pos">${eur(r.spaarpotDezeMaand)}</strong></div>
        <div class="summary-line"><span>Resterend voor zakgeld</span><strong class="${jointRemaining<0?'value neg':'value pos'}">${eur(jointRemaining)}</strong></div>
      </div>
    </div>`;

  document.getElementById('tab-dashboard').innerHTML = `
    <div class="mobile-header-top v4-mobile-only-block">
      <div class="mobile-brand">
        <div class="mobile-brand-icon"><img src="data:image/png;base64,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" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="mobile-brand-icon-fallback">F</span></div>
        <div>
          <strong>Finize</strong>
          <button type="button" class="mobile-status-pill" data-tab-shortcut="data">Online</button>
        </div>
      </div>
      <div class="mobile-month-slot" id="mobileMonthSlot"></div>
    </div>
    <div class="mobile-dashboard-header v4-mobile-only-block">
      <div class="mobile-title-scenario-row">
        <div class="mobile-title-block">
          <h1>Dashboard</h1>
          <p>${monthLabel(getSelectedMonth())}</p>
        </div>
        <div class="scenario-toggle mobile-scenario-toggle" data-mobile-scenario>
          <button data-scenario="voor">Voor verkoop</button>
          <button data-scenario="na">Na verkoop</button>
        </div>
      </div>
      <button type="button" class="primary mobile-add-expense" data-open-transaction>+ Uitgave toevoegen</button>
    </div>
    <div class="v4-dashboard-heading v4-desktop-only-block">
      <div>
        <h2>Dashboard</h2>
        <p>Welkom terug! Hier is jullie financiële overzicht voor deze maand.</p>
      </div>
    </div>
    <div class="u5-primary-kpis v4-desktop-only-grid" aria-label="Geplande financiële verdeling">
      <button type="button" class="card u5-primary-kpi u5-income-kpi tone-income" data-open-total-income aria-label="Maandinkomen van Dion en Dara handmatig aanpassen"><div class="metric-label">Totaal inkomen</div><div class="metric-value value pos">${eur(dashboardTotalIncome)}</div><div class="metric-sub">Verdelingsinkomen ${eur(r.totaalSalaris)}${incomeBreakdown.extra ? ` · extra/teruggaven ${eur(incomeBreakdown.extra)}` : ''} · aanpassen</div></button>
      <div class="card u5-primary-kpi tone-budget"><div class="metric-label">Gezamenlijk budget</div><div class="metric-value">${eur(r.gezamenlijkeLastenTotaal)}</div><div class="metric-sub">Vaste lasten + vooraf ingestelde budgetten</div></div>
      <div class="card u5-primary-kpi tone-saving"><div class="metric-label">Gezamenlijk sparen</div><div class="metric-value value pos">${eur(r.spaarpotDezeMaand)}</div><div class="metric-sub">${monthLabel(getSelectedMonth())}</div></div>
      <div class="card u5-primary-kpi tone-allowance"><div class="metric-label">Zakgeld totaal</div><div class="metric-value ${totalZakgeld<0?'value neg':'value pos'}">${eur(totalZakgeld)}</div><div class="metric-sub">Vooraf berekende overdracht</div></div>
    </div>
    <div class="mobile-kpi-grid v4-mobile-only-grid">
      <button type="button" class="card mobile-kpi-card mobile-kpi-card--editable" data-income-edit="dion" data-income-label="Dion">
        <div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-dion">${iconSvg('euro')}</span><span class="mobile-kpi-chevron">›</span></div>
        <div class="mobile-kpi-label">Inkomen Dion</div>
        <div class="mobile-kpi-value value pos">${eur(r.salarisDion)}</div>
        <div class="mobile-kpi-edit-hint">${finizeIconWrap('edit')}<span>Tik om aan te passen</span></div>
      </button>
      <button type="button" class="card mobile-kpi-card mobile-kpi-card--editable" data-income-edit="dara" data-income-label="Dara">
        <div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-dara">${iconSvg('euro')}</span><span class="mobile-kpi-chevron">›</span></div>
        <div class="mobile-kpi-label">Inkomen Dara</div>
        <div class="mobile-kpi-value value pos">${eur(r.salarisDara)}</div>
        <div class="mobile-kpi-edit-hint">${finizeIconWrap('edit')}<span>Tik om aan te passen</span></div>
      </button>
      <div class="card mobile-kpi-card static mobile-kpi-card-total-joint mobile-kpi-card--joint-total">
        <div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-green">${iconSvg('wallet')}</span></div>
        <div class="mobile-kpi-label">Totaal gezamenlijke rekening</div>
        <div class="mobile-kpi-value value pos">${eur(dashboardTotalIncome)}</div>
        <div class="mobile-kpi-edit-hint mobile-kpi-edit-hint-placeholder" aria-hidden="true">${finizeIconWrap('edit')}<span>Tik om aan te passen</span></div>
      </div>
      <div class="card mobile-kpi-card static mobile-kpi-card--budget">
        <div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-green">${iconSvg('chart')}</span></div>
        <div class="mobile-kpi-label">Variabel gebruikt</div>
        <div class="mobile-kpi-value mobile-kpi-value-budget neutral-amount">${eur(r.variabelTotaal)} / ${eur(r.variabelBudgetTotaal)}</div>
        <div class="mobile-kpi-budget-track" style="--used-pct:${variabelBudgetPct}%" aria-label="Gezamenlijk variabel budget gebruikt: ${variabelBudgetPct}%"></div>
      </div>
    </div>
    <div class="dashboard-grid u5-planning-realisation v4-desktop-only-grid">
      <div class="card span-7 u5-planned-flow">
        ${renderDashboardCardHead('Geplande verdeling', 'op basis van budgetten', 'green')}
        <div class="u5-flow-list">
          <div><span>Totaal inkomen</span><strong class="value pos">${eur(r.totaalSalaris)}</strong></div>
          <div><span>Vaste gezamenlijke lasten${r.hypotheekBedrag ? ' + hypotheek' : ''}</span><strong>${eur(r.vasteLastenTotaal)}</strong></div>
          <div><span>Variabele kostenbudgetten</span><strong>${eur(r.variabelBudgetTotaal)}</strong></div>
          <div><span>Gezamenlijk sparen</span><strong>${eur(r.spaarpotDezeMaand)}</strong></div>
          <div class="u5-flow-result"><span>Zakgeld totaal</span><strong class="${totalZakgeld<0?'value neg':'value pos'}">${eur(totalZakgeld)}</strong></div>
        </div>
      </div>
      <div class="card span-5 u5-actual-result">
        ${renderDashboardCardHead('Werkelijk maandresultaat', 'realisatie', 'blue')}
        <div class="u5-result-value ${actualMonthResult<0?'value neg':'value pos'}">${eur(actualMonthResult)}</div>
        <div class="summary-list">
          <div class="summary-line"><span>Werkelijk variabel besteed</span><strong>${eur(r.variabelTotaal)}</strong></div>
          <div class="summary-line"><span>Budgetverschil</span><strong class="${budgetDifference<0?'value neg':budgetDifference>0?'value pos':''}">${eur(budgetDifference)}</strong></div>
        </div>
        <p class="hint">Deze realisatie verandert het vooraf berekende zakgeld niet.</p>
      </div>
      <div class="card span-12 u5-allowance-split">${renderDashboardCardHead('Verdeling Dion / Dara', 'bestaande verdelingsregels', 'terracotta')}${zakgeldCardBody}</div>
    </div>
    <div class="dashboard-grid dashboard-summary-row u5-mobile-dashboard-preserved">
      <div class="card span-6 joint-account-card">${renderDashboardCardHead('Gezamenlijke rekening', '', 'green')}<div class="summary-list"><div class="summary-line"><span>Totaal inkomen</span><strong class="value pos">${eur(dashboardTotalIncome)}</strong></div>${incomeBreakdown.extra ? `<div class="summary-line"><span>Waarvan extra / teruggaven</span><strong class="value pos">${eur(incomeBreakdown.extra)}</strong></div>` : ``}<div class="summary-line"><span>Vaste lasten + budgetten</span><strong class="value neg">${eur(r.gezamenlijkeLastenTotaal)}</strong></div><div class="summary-line joint-saving-line"><span>Gezamenlijk sparen</span><strong class="value pos">${eur(r.spaarpotDezeMaand)}</strong></div><div class="summary-line joint-remaining-line"><span>Resterend voor zakgeld</span><strong class="${jointRemaining<0?'value neg':'value pos'}">${eur(jointRemaining)}</strong></div></div></div>
      <div class="card span-6 allowance-return-card">${renderDashboardCardHead('Zakgeld teruggestort', 'Dion / Dara', 'terracotta')}${zakgeldCardBody}</div>
      ${jointSummary}
      ${personSummary('Dion',r.dion)}
      ${personSummary('Dara',r.dara)}
    </div>
    <div class="dashboard-grid dashboard-preview-row">
      <div class="card span-6 v4-bottom-card card-scroll budget-preview-card">${renderDashboardCardHead('Gezamenlijk budget deze maand', 'transacties vs budget', 'green')}<div class="scroll-area">${budgetRows || '<p class="hint">Nog geen variabele budgetten.</p>'}</div></div>
      <div class="card span-6 v4-bottom-card card-scroll dashboard-goals-preview v4-desktop-only-block">${renderDashboardCardHead('Spaardoelen preview', '', 'blue')}<div class="scroll-area">${goalCardsDesktop || '<p class="hint">Nog geen spaardoelen.</p>'}</div><button type="button" class="goals-preview-link" data-tab-shortcut="spaardoelen"><span>Alle spaardoelen bekijken</span><strong>›</strong></button></div>
      <div class="card span-6 dashboard-goals-preview savings-preview-card v4-mobile-only-block">${renderDashboardCardHead('Spaardoelen preview', '', 'blue')}${goalCardsMobile || '<p class="hint">Nog geen spaardoelen.</p>'}<button type="button" class="goals-preview-link" data-tab-shortcut="spaardoelen"><span>Alle spaardoelen</span><strong>›</strong></button></div>
    </div>
    <div class="manage-stack">
      ${renderU3AdminPanel()}
      ${renderManageSection('Bank import & uitgaven', renderBankImportSection(), bankImportOpen, 'data-dashboard-accordion="bank-import"')}
      ${renderManageSection(`Jaaroverzicht ${year}`, `<div class="card"><div class="year-legend top"><span><i class="income-dot"></i>Inkomen</span><span><i class="spent-dot"></i>Uitgaven</span><span><i class="saving-dot"></i>Sparen</span></div><div class="year-summary"><div><span>Inkomen dit jaar</span><strong class="value pos">${eur(yearTotals.income)}</strong></div><div><span>Uitgaven dit jaar</span><strong class="value neg">${eur(yearTotals.spent)}</strong></div><div><span>Sparen dit jaar</span><strong class="value pos">${eur(yearTotals.saving)}</strong></div></div><div class="year-chart">${monthBars}</div></div>`, false)}
    </div>
  `;
}
function renderRecentTransactionsList(owner, limit=4){
  const rows = getMonthTransactions(owner).filter(isBudgetExpenseTransaction).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,limit);
  if (!rows.length) return renderEmptyState('▤','Nog geen uitgaven deze maand.','Toegevoegde uitgaven verschijnen hier.', `<button class="ghost small" data-open-transaction>+ Uitgave toevoegen</button>`);
  return `<div class="summary-list">${rows.map(tx=>`<div class="summary-line"><span>${textSafe(tx.description || tx.category || 'Uitgave')}</span><strong class="value neg">${eur(Number(tx.amount)||0)} <span class="hint">· ${formatDateNL(tx.date)}</span></strong></div>`).join('')}</div>`;
}
function renderTransactionsTable(owner){
  const rows = getMonthTransactions(owner).filter(isBudgetExpenseTransaction).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(tx=>`
    <tr>
      <td>${formatDateNL(tx.date)}</td>
      <td>${tx.category || 'Overig'}</td>
      <td>${tx.description || ''}<div class="progress-label" style="text-align:left">${tx.note || ''}</div></td>
      <td class="num"><span class="value neg">${eur(Number(tx.amount)||0)}</span></td>
      <td class="row-actions"><button class="danger-ghost" data-remove-transaction="${tx.id}" title="Verwijderen">×</button></td>
    </tr>`).join('');
  const emptyIcon = owner ? '⌘' : '▤';
  const emptyText = owner ? `Je persoonlijke uitgaven verschijnen hier zodra je ze toevoegt.` : `Toegevoegde uitgaven verschijnen hier.`;
  const emptyRow = `<tr><td colspan="5" style="padding:0">${renderEmptyState(emptyIcon, owner ? 'Nog geen uitgaven deze maand' : 'Nog geen uitgaven deze maand.', emptyText, `<button class="ghost small" data-open-transaction>+ Uitgave toevoegen</button>`)}</td></tr>`;
  return `<div class="scroll-area large"><table>
    <thead><tr><th>Datum</th><th>Categorie</th><th>Omschrijving</th><th style="text-align:right">Bedrag</th><th></th></tr></thead>
    <tbody>${rows || emptyRow}</tbody>
  </table></div>`;
}
function renderBudgetUsageList(){
  const data = getMonthlyScenarioData(state.meta.scenario);
  return `<div class="progress-list">${(data.gezamenlijk.variabel||[]).filter(row=>row.post || row.bedrag).map(row=>{
    const budget = Number(row.bedrag)||0;
    const used = sumTransactions('gezamenlijk', row.post);
    const status = budgetStatus(used, budget);
    return `<div class="progress-item">
      <div class="progress-top"><strong>${row.post || row.categorie}</strong><span><span class="neutral-amount">${eur(used)}</span> / <span class="neutral-amount">${eur(budget)}</span> <span class="status-badge ${status.cls}">${status.label}</span></span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round(status.ratio*100))}%"></div></div>
    </div>`;
  }).join('') || '<p class="hint">Nog geen budgetten.</p>'}</div>`;
}

function renderRecurringFixedManage(owner){
  const scenario = state.meta.scenario;
  const rows = (state.recurringFixedExpenses?.[scenario] || []).filter(item=>{
    const financialFor = item.financialFor || item.rekening || 'gezamenlijk';
    return financialFor === owner && item.legacyKind !== 'hypotheek';
  });
  const month = getSelectedMonth();
  const total = round2(u3FixedOccurrences(month, scenario)
    .filter(item=>(item.financialFor || item.rekening || 'gezamenlijk') === owner && item.source?.legacyKind !== 'hypotheek')
    .reduce((sum,item)=>sum + (Number(item.amount)||0),0));
  const rowsHtml = rows.map(item=>`
    <div class="summary-line">
      <span><strong>${textSafe(item.naam || 'Vaste last')}</strong><small class="hint">${textSafe(item.categorie || 'Overig')} · elke ${Math.max(1, Number(item.frequentieAantal)||1)} ${textSafe(item.frequentieEenheid || 'maanden')}${item.actief === false ? ' · gestopt' : ''}</small></span>
      <span><strong>${eur(u3AmountAt(item, month))}</strong><button type="button" class="ghost small" data-u3-edit-recurring="fixed:${textSafe(item.id)}">Bewerken</button></span>
    </div>`).join('');
  return `<div class="card">
    <div class="card-head"><div><h2>Terugkerende vaste lasten</h2><span class="hint">Bron van het maandbedrag</span></div><button type="button" class="primary small" data-u3-add-recurring="fixed" data-u3-recurring-owner="${owner}">+ Vaste last</button></div>
    <div class="summary-list">${rowsHtml || '<p class="hint">Nog geen vaste lasten toegevoegd.</p>'}</div>
    <div class="card-total"><span>Totaal in ${monthLabel(month)}</span><strong class="value neg">${eur(total)}</strong></div>
  </div>`;
}

/* ---------- gezamenlijk / dion / dara ---------- */
function renderPersonOrJoint(tabId, key, label){
  const s = getMonthlyScenarioData(state.meta.scenario);
  const r = calcScenario(state);
  const isJoint = key === 'gezamenlijk';
  const data = s[key];
  const rr = isJoint ? null : r[key];
  const basisInkomen = isJoint ? 0 : getMonthlyBaseIncome(key);
  const vasteTeruggaven = isJoint ? 0 : sumVasteTeruggaven(key);
  const totaalInkomen = isJoint ? 0 : getTotalMonthlyIncome(key);
  const pageGreeting = isJoint
    ? 'Samen houden jullie grip op deze maand.'
    : `Jouw maand, jouw keuzes — zo sta je ervoor, ${label}.`;

  const refundsCard = isJoint ? '' : `
      <div class="card">
        <div class="card-head"><h2>Vaste teruggaven</h2></div>
        <p class="hint" style="margin-top:-4px">Toeslagen, vergoedingen en vaste correcties die maandelijks terugkomen.</p>
        ${renderTeruggavenTable(`personen.${key}.vasteTeruggaven`, state.personen[key].vasteTeruggaven)}
      </div>`;

  const spaarpotVoorGroep = isJoint ? r.spaarpotDezeMaand : rr.beschikbaarVoorSparen;
  const doelenVoorGroep = state.spaardoelen[key];
  const hypotheekCard = isJoint && state.meta.scenario==='na' ? `
    <div class="card">
      <div class="card-head"><h2>Hypotheek</h2></div>
      ${renderRowsTable('na.gezamenlijk.hypotheek', data.hypotheek)}
    </div>` : '';
  const savingsSummary = isJoint ? `
    <div class="savings-head">
      <div class="kpi"><div class="label">Maandelijkse lasten</div><div class="value">${eur(r.gezamenlijkeLastenTotaal)}</div></div>
      <div class="kpi">
        <div class="label">Spaargeld deze maand</div>
        <input type="number" step="0.01" data-path="${state.meta.scenario}.spaarpotDezeMaand" style="width:100%;font-size:16px;font-weight:700">
      </div>
    </div>` : `
    <div class="savings-head">
      <div class="kpi ${rr.beschikbaarVoorSparen<0?'neg':'pos'}"><div class="label">Beschikbaar voor sparen</div><div class="value ${rr.beschikbaarVoorSparen<0?'neg':'pos'}">${eur(rr.beschikbaarVoorSparen)}</div></div>
    </div>`;

  const transactionCard = `
    <div class="card card-scroll span-7">
      <div class="card-head"><h2>${isJoint?'Gezamenlijke transacties':'Persoonlijke uitgaven'} — ${monthLabel(getSelectedMonth())}</h2>${isJoint?'':'<button class="primary small" data-open-transaction>+ Uitgave toevoegen</button>'}</div>
      ${renderTransactionsTable(key)}
      <div class="card-total"><span>Totaal uitgaven</span><span class="value neg">${eur(sumTransactions(key))}</span></div>
    </div>`;

  const variabelBasePath = isJoint ? `monthlyBudgets.${getSelectedMonth()}.${state.meta.scenario}.gezamenlijkVariabel` : `${state.meta.scenario}.${key}.variabel`;
  const vasteTeruggavenTotal = round2((r.vasteTeruggavenDion||0) + (r.vasteTeruggavenDara||0));
  const resterendBudget = round2(r.variabelBudgetTotaal - r.variabelTotaal);
  const resterendPct = r.variabelBudgetTotaal > 0 ? Math.round((resterendBudget / r.variabelBudgetTotaal) * 100) : 0;

  const jointKpis = isJoint ? `
    <div class="overview-kpi-row">
      ${renderIconKpi('▤','green','Vaste lasten totaal', eur(r.vasteLastenTotaal), `Incl. teruggaven ${eur(vasteTeruggavenTotal)}`, {valueClass:'value neg'})}
      ${renderIconKpi('◈','blue','Variabel budget', eur(r.variabelBudgetTotaal), 'Budget deze maand')}
      ${renderIconKpi('↗','green','Uitgegeven deze maand', eur(r.variabelTotaal), `Van ${eur(r.variabelBudgetTotaal)}`, {valueClass:'value neg'})}
      ${renderIconKpi('◔','blue','Resterend budget', eur(resterendBudget), `${resterendPct}% over`, {valueClass: resterendBudget<0?'value neg':'value pos'})}
    </div>` : '';
  const personalKpis = !isJoint ? `
    <div class="overview-kpi-row">
      ${renderIconKpi('◈','green','Zakgeld ontvangen', eur(rr.zakgeld), monthLabel(getSelectedMonth()), {valueClass: rr.zakgeld<0?'value neg':'value pos'})}
      ${renderIconKpi('▤','blue','Vaste lasten', eur(rr.persoonlijkeVasteLasten), 'terugkerend', {valueClass: rr.persoonlijkeVasteLasten>0?'value neg':'value pos'})}
      ${renderIconKpi('▥','blue','Uitgaven deze maand', eur(rr.variabeleUitgaven), 'transacties', {valueClass:'value neg'})}
      ${renderIconKpi('◎','green','Beschikbaar voor sparen/vrij gebruik', eur(rr.beschikbaarVoorSparen), availabilityBadge(rr.beschikbaarVoorSparen), {valueClass: rr.beschikbaarVoorSparen<0?'value neg':'value pos'})}
    </div>` : '';
  const personalIncomeCard = !isJoint ? `
    <div class="card metric-card income-metric span-12">
      <div class="metric-label">Totaal inkomen ${label}</div>
      <div class="metric-value value pos">${eur(totaalInkomen)}</div>
      <div class="metric-sub">Totaal naar gezamenlijke rekening</div>
      <div class="income-breakdown">
        <div><span>Basisinkomen</span><input class="inline-edit" type="number" step="0.01" data-month-income="${key}"></div>
        <div><span>Vaste teruggaven</span><strong class="value pos">${eur(vasteTeruggaven)}</strong></div>
      </div>
    </div>` : '';
  const incomeManage = !isJoint ? `
    <div class="card">
      <div class="card-head"><h2>Inkomen</h2><span class="hint">${monthLabel(getSelectedMonth())}</span></div>
      <div class="summary-list">
        <div class="summary-line"><span>Basisinkomen deze maand</span><input class="inline-edit" type="number" step="0.01" data-month-income="${key}"></div>
        <div class="summary-line"><span>Vaste teruggaven</span><strong class="value pos">${eur(vasteTeruggaven)}</strong></div>
        <div class="summary-line"><span>Totaal naar gezamenlijke rekening</span><strong class="value pos">${eur(totaalInkomen)}</strong></div>
      </div>
    </div>
    ${refundsCard}` : '';

  document.getElementById(tabId).innerHTML = isJoint ? `
    ${renderPageHeading(`Gezamenlijk overzicht — ${monthLabel(getSelectedMonth())}`, pageGreeting)}
    ${jointKpis}
    <div class="dashboard-grid">
      <div class="card span-7"><div class="card-head"><h2>Budgetgebruik deze maand</h2><span class="hint">Dion / Dara</span></div>${renderBudgetUsageList()}</div>
      <div class="card span-5"><div class="card-head"><h2>Recente gezamenlijke uitgaven</h2></div>${renderRecentTransactionsList('gezamenlijk',4)}</div>
    </div>
    <div class="dashboard-grid">
      ${transactionCard}
      <div class="card span-5"><div class="card-head"><h2>Spaardoelen preview</h2><button class="ghost small" data-tab-shortcut="spaardoelen">Bekijk alle doelen →</button></div>${renderModernGoalCards(doelenVoorGroep, spaarpotVoorGroep, 'Gezamenlijk', 3)}</div>
    </div>
    <div class="manage-stack">
      ${hypotheekCard ? renderManageSection('Beheer hypotheek', hypotheekCard, false) : ''}
      ${renderManageSection('Beheer vaste lasten', renderRecurringFixedManage(key), false)}
      ${renderManageSection('Beheer variabele budgetten', `<div class="card">${renderRowsTable(variabelBasePath, data.variabel)}</div>`, false)}
      ${renderManageSection('Sparen', `<div class="card">${savingsSummary}${renderGoalOverviewTable(doelenVoorGroep, spaarpotVoorGroep)}</div>`, false)}
    </div>
  ` : `
    ${renderPageHeading(`${label} overzicht — ${monthLabel(getSelectedMonth())}`, pageGreeting)}
    ${personalKpis}
    <div class="dashboard-grid">
      ${personalIncomeCard}
    </div>
    <div class="dashboard-grid">
      ${transactionCard}
      <div class="card span-5"><div class="card-head"><h2>Persoonlijke spaardoelen</h2></div>${renderModernGoalCards(doelenVoorGroep, spaarpotVoorGroep, label, 3)}</div>
    </div>
    <div class="manage-stack">
      ${renderManageSection('Inkomen en vaste teruggaven', incomeManage, false)}
      ${renderManageSection('Eigen vaste lasten', renderRecurringFixedManage(key), false)}
      ${renderManageSection('Persoonlijke categorieën', `<div class="card">${renderRowsTable(variabelBasePath, data.variabel)}</div>`, false)}
      ${renderManageSection('Spaardoelen tabeloverzicht', `<div class="card">${renderGoalOverviewTable(doelenVoorGroep, spaarpotVoorGroep)}</div>`, false)}
    </div>
  `;
}

/* ---------- spaardoelen-tab ---------- */
function renderMobileGoalRow(item, owner){
  const goal = item.doel;
  const target = Number(goal.doelbedrag)||0;
  const saved = Number(goal.algespaard)||0;
  const progress = Math.min(100, Math.round((item.voortgang||0)*100));
  const goalImage = String(goalImageSource(goal) || '').replace(/'/g,'%27');
  const imageStyle = goalImage ? ` style="background-image:url('${goalImage}')"` : '';
  const iconToneClass = goalImage ? '' : ` tone-${owner === 'gezamenlijk' ? 'green' : owner}`;
  return `<div class="mobile-goal-row"><span class="mobile-goal-icon${iconToneClass}${goalImage ? ' has-image' : ''}"${imageStyle}>${goalImage ? '' : goalIcon(goal)}</span><div class="mobile-goal-main"><strong>${textSafe(goal.naam || 'Spaardoel')}</strong><span>${eur(saved)} van ${eur(target)}</span><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><em class="mobile-goal-needed">Nodig p/m: ${item.benodigdPerMaand === null ? '—' : eur(item.benodigdPerMaand)}</em>${goalMonthlyInlegText(item)}<em>Doel: ${goal.doeldatum ? formatDateNL(goal.doeldatum) : 'Geen einddatum'}</em></div><div class="mobile-goal-side"><b>${progress}%</b><button type="button" class="ghost small" data-open-goal-editor="${owner}:${textSafe(goal.id)}">Bekijk doel</button></div></div>`;
}
function renderMobileGoalGroup(group){
  const items = calcGroep(group.doelen, group.pot, TODAY);
  return `<section class="mobile-goal-section"><h2>${group.label}</h2><div class="card mobile-goal-list">${items.length ? items.map(item=>renderMobileGoalRow(item,group.key)).join('') : '<p class="hint">Nog geen spaardoelen.</p>'}</div></section>`;
}
function openMobileGoalEditor(owner,id){
  const index = state.spaardoelen?.[owner]?.findIndex(goal=>goal.id === id) ?? -1;
  const goal = index >= 0 ? state.spaardoelen?.[owner]?.[index] : null;
  if (!goal) return;
  const modal = document.getElementById('incomeEditModal');
  const name = ownerLabel(owner);
  modal.innerHTML = `<div class="modal goal-detail-editor"><div class="joint-variable-editor-header"><div><div class="section-kicker">${name} · ${monthLabel(getSelectedMonth())}</div><h2>Spaardoel bewerken</h2></div><button type="button" class="ghost" data-close-goal-editor>Sluiten</button></div><div class="modal-grid"><label class="full">Naam<input id="goalEditName" type="text" value="${textSafe(goal.naam || '')}"></label><label>Al gespaard<input id="goalEditSaved" type="number" step="0.01" inputmode="decimal" value="${Number(goal.algespaard)||0}"></label><label>Doelbedrag<input id="goalEditTarget" type="number" step="0.01" inputmode="decimal" value="${Number(goal.doelbedrag)||0}"></label><label>Doeldatum<input id="goalEditDate" type="date" value="${textSafe(goal.doeldatum || '')}"></label><label>Vaste inleg p/m<input id="goalEditMonthly" type="number" step="0.01" inputmode="decimal" value="${Number(goal.vasteInleg)||0}"></label><label class="goal-editor-fixed-only"><input id="goalEditFixedOnly" type="checkbox" ${goal.vastBedrag?'checked':''}> Alleen vaste inleg <span>— niet meedoen met verdeling naar rato</span></label><label>Rendement %<input id="goalEditReturn" type="number" step="0.01" inputmode="decimal" value="${Math.round((Number(goal.rendement)||0)*10000)/100}"></label><label>Periode<select id="goalEditPeriod"><option value="jaarlijks" ${goal.rendementPeriode !== 'maandelijks'?'selected':''}>Jaarlijks</option><option value="maandelijks" ${goal.rendementPeriode === 'maandelijks'?'selected':''}>Maandelijks</option></select></label><label class="full goal-editor-favorite"><input id="goalEditFavorite" type="checkbox" ${goal.favoriet?'checked':''}> Favoriet doel</label><section class="goal-calculation-card" id="goalEditCalculation"></section></div><div class="modal-actions"><button type="button" class="danger-ghost" id="goalEditDelete">Verwijderen</button><button type="button" class="primary" id="goalEditSave">Opslaan</button></div></div>`;
  modal.classList.add('open','goal-detail-editor-open');
  let goalImageData = String(goalImageSource(goal) || '');
  const imageField = document.createElement('label');
  imageField.className = 'full goal-image-field';
  imageField.innerHTML = `<span>Afbeelding</span><div class="goal-image-preview" ${goalImageData ? `style="background-image:url('${goalImageData.replace(/'/g,'%27')}')"` : ''}>${goalImageData ? '' : 'Geen afbeelding'}</div><input type="file" accept="image/*" id="goalEditImage"><small class="goal-image-status" id="goalEditImageStatus">Afbeeldingen worden automatisch verkleind voor betrouwbare opslag.</small><button type="button" class="ghost small" id="goalEditImageRemove" ${goalImageData ? '' : 'disabled'}>Afbeelding verwijderen</button>`;
  modal.querySelector('.modal-grid').appendChild(imageField);
  const imagePreview = imageField.querySelector('.goal-image-preview');
  const imageInput = imageField.querySelector('#goalEditImage');
  const imageStatus = imageField.querySelector('#goalEditImageStatus');
  const saveButton = modal.querySelector('#goalEditSave');
  let imageProcessing = false;
  imageInput.addEventListener('change',async event=>{
    const file=event.target.files?.[0]; if(!file)return;
    imageProcessing=true; saveButton.disabled=true; imageStatus.textContent='Afbeelding verwerken…';
    try{
      goalImageData=await compressGoalImage(file);
      imagePreview.style.backgroundImage=`url('${goalImageData.replace(/'/g,'%27')}')`; imagePreview.textContent='';
      imageField.querySelector('#goalEditImageRemove').disabled=false;
      imageStatus.textContent=`Klaar · ${Math.max(1,Math.round(dataUrlByteSize(goalImageData)/1024))} kB`;
    }catch(error){ event.target.value=''; imageStatus.textContent='Afbeelding verwerken mislukt.'; alert(error?.message || 'Afbeelding verwerken mislukt.'); }
    finally{ imageProcessing=false; saveButton.disabled=false; }
  });
  imageField.querySelector('#goalEditImageRemove').addEventListener('click',()=>{goalImageData='';imagePreview.style.backgroundImage='';imagePreview.textContent='Geen afbeelding';imageInput.value='';imageStatus.textContent='Afbeelding verwijderd. Sla het doel op om dit te bevestigen.';imageField.querySelector('#goalEditImageRemove').disabled=true;});
  const calculation = modal.querySelector('#goalEditCalculation');
  const draftItem=()=>{
    const draft={...goal,algespaard:round2(bankAmount(modal.querySelector('#goalEditSaved').value)||0),doelbedrag:round2(bankAmount(modal.querySelector('#goalEditTarget').value)||0),doeldatum:modal.querySelector('#goalEditDate').value,vasteInleg:round2(bankAmount(modal.querySelector('#goalEditMonthly').value)||0),rendement:(bankAmount(modal.querySelector('#goalEditReturn').value)||0)/100,rendementPeriode:modal.querySelector('#goalEditPeriod').value,vastBedrag:modal.querySelector('#goalEditFixedOnly').checked};
    const drafts=state.spaardoelen[owner].map((item,itemIndex)=>itemIndex===index?draft:item);
    const r=calcScenario(state); const pot=owner==='gezamenlijk'?r.spaarpotDezeMaand:r[owner].beschikbaarVoorSparen;
    return calcGroep(drafts,pot,TODAY)[index];
  };
  const renderCalculation=()=>{const item=draftItem(); calculation.innerHTML=`<h3>Berekening deze maand</h3><div class="goal-calculation-total"><span>Nodig per maand</span><strong>${item.benodigdPerMaand === null ? 'Geen einddatum' : eur(item.benodigdPerMaand)}</strong></div><div class="goal-calculation-total"><span>Inleg deze maand</span><strong>${eur(item.werkelijkeInleg)}</strong></div>${goalMonthlyInlegBreakdown(item)}<p class="goal-calculation-note">Spaargeld totaal ${eur(item.spaarpotDezeMaand)} − vaste inleg ${eur(item.totaalVasteInleg)} = ${eur(item.extraPot)} voor verdeling naar rato.</p>`;};
  ['goalEditSaved','goalEditTarget','goalEditDate','goalEditMonthly','goalEditReturn','goalEditPeriod','goalEditFixedOnly'].forEach(id=>modal.querySelector('#'+id).addEventListener('input',renderCalculation));
  renderCalculation();
  const close=()=>{modal.classList.remove('open','goal-detail-editor-open');modal.innerHTML='';renderActiveTab();};
  modal.querySelector('[data-close-goal-editor]').addEventListener('click',close);
  modal.querySelector('#goalEditSave').addEventListener('click',async ()=>{
    if(imageProcessing||saveButton.disabled)return;
    const previousImage = goalImageSource(goal);
    saveButton.disabled=true;
    try{
      const imageReference = await GoalImageStore.storeOrFallback(id, goalImageData);
      const savedAmount=round2(bankAmount(modal.querySelector('#goalEditSaved').value)||0);
      const changes={naam:modal.querySelector('#goalEditName').value.trim(),doelbedrag:round2(bankAmount(modal.querySelector('#goalEditTarget').value)||0),doeldatum:modal.querySelector('#goalEditDate').value,vasteInleg:round2(bankAmount(modal.querySelector('#goalEditMonthly').value)||0),vastBedrag:modal.querySelector('#goalEditFixedOnly').checked,rendement:(bankAmount(modal.querySelector('#goalEditReturn').value)||0)/100,rendementPeriode:modal.querySelector('#goalEditPeriod').value,favoriet:modal.querySelector('#goalEditFavorite').checked,afbeelding:imageReference};
      if(!commitChange(()=>{updateItemById(`spaardoelen.${owner}`,id,changes);u2SetGoalSavedAmount(goal,savedAmount);},{render:false})) throw new Error('Lokale opslag is mislukt.');
      if (!goalImageData){
        try{ await GoalImageStore.remove(id); }
        catch(error){ console.warn('Verwijderde spaardoelfoto kon niet uit IndexedDB worden opgeruimd.', error); }
      }
      showQuickToast('Spaardoel opgeslagen');
      close();
    }catch(error){
      try{
        if (previousImage) await GoalImageStore.put(id, previousImage);
        else await GoalImageStore.remove(id);
      }catch(ignore){}
      console.error('Spaardoel opslaan mislukt', error);
      alert('Opslaan is mislukt. De vorige gegevens zijn behouden.');
      saveButton.disabled=false;
    }
  });
  modal.querySelector('#goalEditDelete').addEventListener('click',()=>{ close(); removeWithUndo(`spaardoelen.${owner}`,id,'Spaardoel verwijderd'); });
}
function openMobileGoalManager(owner){
  const goals = state.spaardoelen?.[owner] || [];
  const modal = document.getElementById('incomeEditModal');
  const name = ownerLabel(owner);
  const r=calcScenario(state); const pot=owner==='gezamenlijk'?r.spaarpotDezeMaand:r[owner].beschikbaarVoorSparen;
  const items=calcGroep(goals,pot,TODAY);
  const rows = items.map((item,index)=>{const goal=item.doel;const goalImage=String(goalImageSource(goal)||'').replace(/'/g,'%27');const imageStyle=goalImage?` style="background-image:url('${goalImage}')"`:'';return `<div class="goal-manager-row" data-open-manager-goal="${textSafe(goal.id)}" role="button" tabindex="0"><span class="goal-manager-goal-icon${goalImage?' has-image':''}"${imageStyle}>${goalImage?'':goalIcon(goal)}</span><span class="goal-manager-copy"><strong>${textSafe(goal.naam || 'Spaardoel')}</strong><small>${eur(Number(goal.algespaard)||0)} / ${eur(Number(goal.doelbedrag)||0)}</small></span><span class="goal-manager-metric"><span>Nodig p/m</span><b>${item.benodigdPerMaand === null ? '—' : eur(item.benodigdPerMaand)}</b></span><span class="goal-manager-metric"><span>Deze maand</span><b>${eur(item.werkelijkeInleg)}</b></span><span class="goal-manager-moves"><button type="button" data-move-manager-goal="${textSafe(goal.id)}:-1" ${index===0?'disabled':''} aria-label="Doel omhoog">▲</button><button type="button" data-move-manager-goal="${textSafe(goal.id)}:1" ${index===items.length-1?'disabled':''} aria-label="Doel omlaag">▼</button></span><button type="button" class="joint-fixed-row-delete-compact" data-remove-manager-goal="${textSafe(goal.id)}" aria-label="Doel verwijderen">×</button></div>`;}).join('');
  modal.innerHTML=`<div class="modal goal-manager-editor"><div class="joint-variable-editor-header"><div><div class="section-kicker">${name} · ${monthLabel(getSelectedMonth())}</div><h2>Spaardoelen beheren</h2><p>Tik op een doel voor alle instellingen en de berekening.</p></div><button type="button" class="ghost" data-close-goal-manager>Sluiten</button></div><div class="goal-manager-list">${rows || '<p class="hint">Nog geen spaardoelen.</p>'}</div><div class="joint-variable-editor-actions"><button type="button" class="primary" data-close-goal-manager>Klaar</button><button type="button" class="ghost" data-add-manager-goal>+ Spaardoel</button></div></div>`;
  modal.classList.add('open','goal-manager-editor-open');
  const close=()=>{modal.classList.remove('open','goal-manager-editor-open');modal.innerHTML='';renderActiveTab();};
  modal.querySelectorAll('[data-close-goal-manager]').forEach(btn=>btn.addEventListener('click',close));
  modal.querySelectorAll('[data-open-manager-goal]').forEach(btn=>{const open=()=>{modal.classList.remove('open','goal-manager-editor-open');openMobileGoalEditor(owner,btn.dataset.openManagerGoal);};btn.addEventListener('click',open);btn.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});});
  modal.querySelectorAll('[data-move-manager-goal]').forEach(btn=>btn.addEventListener('click',event=>{event.stopPropagation();const [id,deltaText]=btn.dataset.moveManagerGoal.split(':');const index=goals.findIndex(goal=>goal.id===id);const target=index+Number(deltaText);if(index<0||target<0||target>=goals.length)return;commitChange(()=>moveItemById(`spaardoelen.${owner}`,`spaardoelen.${owner}`,id,target),{render:false});openMobileGoalManager(owner);}));
  modal.querySelectorAll('[data-remove-manager-goal]').forEach(btn=>btn.addEventListener('click',event=>{event.stopPropagation();modal.classList.remove('open','goal-manager-editor-open');removeWithUndo(`spaardoelen.${owner}`,btn.dataset.removeManagerGoal,'Spaardoel verwijderd');}));
  modal.querySelector('[data-add-manager-goal]').addEventListener('click',()=>{commitChange(()=>goals.push({id:uid(),naam:'Nieuw doel',doelbedrag:0,algespaard:0,doeldatum:'',vasteInleg:0,rendement:.0125,rendementPeriode:'jaarlijks',favoriet:false}),{render:false});openMobileGoalManager(owner);});
}
function renderMobileSpaardoelen(){
  const r=calcScenario(state);
  const groups=[{key:'gezamenlijk',label:'Gezamenlijk',pot:r.spaarpotDezeMaand,doelen:state.spaardoelen.gezamenlijk},{key:'dion',label:'Dion',pot:r.dion.beschikbaarVoorSparen,doelen:state.spaardoelen.dion},{key:'dara',label:'Dara',pot:r.dara.beschikbaarVoorSparen,doelen:state.spaardoelen.dara}];
  const calculated=groups.map(group=>({...group,items:calcGroep(group.doelen,group.pot,TODAY)}));
  const all=calculated.flatMap(group=>group.items); const saved=round2(all.reduce((sum,item)=>sum+(Number(item.doel.algespaard)||0),0)); const target=round2(all.reduce((sum,item)=>sum+(Number(item.doel.doelbedrag)||0),0)); const average=target>0?saved/target:0; const monthly=round2(all.reduce((sum,item)=>sum+(item.werkelijkeInleg||0),0));
  const groupSummary=calculated.map(group=>{const goalTarget=round2(group.items.reduce((sum,item)=>sum+(Number(item.doel.doelbedrag)||0),0));const goalSaved=round2(group.items.reduce((sum,item)=>sum+(Number(item.doel.algespaard)||0),0));const ratio=target>0?goalTarget/target:0;return {label:group.label,saved:goalSaved,target:goalTarget,ratio,monthly:round2(group.items.reduce((sum,item)=>sum+(item.werkelijkeInleg||0),0))};});
  const distribution=groupSummary.map(group=>`<div class="mobile-goal-summary-line"><span>${group.label}</span><i><b style="width:${Math.round(group.ratio*100)}%"></b></i><strong>${eur(group.target)} (${pct(group.ratio)})</strong></div>`).join('');
  const monthSummary=groupSummary.map(group=>`<div class="mobile-goal-summary-line"><span>${group.label}</span><i><b style="width:${monthly>0?Math.round(group.monthly/monthly*100):0}%"></b></i><strong>${eur(group.monthly)}</strong></div>`).join('');
  const root=document.getElementById('tab-spaardoelen');
  root.innerHTML=`${renderSharedEmptyTabHeader('Spaardoelen overzicht')}<div class="mobile-savings-overview"><div class="mobile-savings-kpis"><div class="card"><span>◈</span><small>Totaal gespaard</small><strong>${eur(saved)}</strong><em>van ${eur(target)}</em></div><div class="card"><span>◎</span><small>Totaal doelbedrag</small><strong>${eur(target)}</strong><em>alle doelen samen</em></div><div class="card"><span>↗</span><small>Gemiddelde voortgang</small><strong>${pct(average)}</strong><em>op basis van doelbedrag</em></div><div class="card"><span>€</span><small>Inleg deze maand</small><strong>${eur(monthly)}</strong><em>${monthLabel(getSelectedMonth())}</em></div></div>${groups.map(renderMobileGoalGroup).join('')}<div class="mobile-savings-summary-grid"><div class="card"><h2>Verdeling van spaardoelen</h2>${distribution}<p>Percentages gebaseerd op totaal doelbedrag per groep.</p></div><div class="card"><h2>Inleg deze maand</h2>${monthSummary}<strong class="mobile-savings-month-total">${eur(monthly)} totaal</strong></div></div><div class="manage-stack"><details class="manage-section"><summary><span class="manage-title">Spaardoelen beheren — Gezamenlijk</span><span class="expand-chevron"></span></summary><div class="manage-body"><div class="card">${renderGoalGroup('spaardoelen.gezamenlijk',state.spaardoelen.gezamenlijk,r.spaarpotDezeMaand)}</div></div></details><details class="manage-section"><summary><span class="manage-title">Spaardoelen beheren — Dion</span><span class="expand-chevron"></span></summary><div class="manage-body"><div class="card">${renderGoalGroup('spaardoelen.dion',state.spaardoelen.dion,r.dion.beschikbaarVoorSparen)}</div></div></details><details class="manage-section"><summary><span class="manage-title">Spaardoelen beheren — Dara</span><span class="expand-chevron"></span></summary><div class="manage-body"><div class="card">${renderGoalGroup('spaardoelen.dara',state.spaardoelen.dara,r.dara.beschikbaarVoorSparen)}</div></div></details></div></div>`;
  root.querySelectorAll('.manage-section').forEach((section,index)=>{
    const owners=['gezamenlijk','dion','dara'];
    const body=section.querySelector('.manage-body');
    if (body) body.innerHTML=`<button type="button" class="ghost mobile-goal-manage-open" data-open-goal-manager="${owners[index]}">Open full-screen beheer</button>`;
  });
}
function renderSpaardoelen(){
  const r = calcScenario(state);
  const groups = [
    {key:'gezamenlijk', label:'Gezamenlijk', pot:r.spaarpotDezeMaand, doelen:state.spaardoelen.gezamenlijk},
    {key:'dion', label:'Dion', pot:r.dion.beschikbaarVoorSparen, doelen:state.spaardoelen.dion},
    {key:'dara', label:'Dara', pot:r.dara.beschikbaarVoorSparen, doelen:state.spaardoelen.dara},
  ];
  const all = groups.flatMap(g=>calcGroep(g.doelen, g.pot, TODAY).map(item=>({...item, owner:g.label})));
  const totaalGespaard = round2(all.reduce((s,b)=>s+(Number(b.doel.algespaard)||0),0));
  const totaalDoel = round2(all.reduce((s,b)=>s+(Number(b.doel.doelbedrag)||0),0));
  const gemiddelde = totaalDoel>0 ? totaalGespaard/totaalDoel : 0;
  const inlegDezeMaand = round2(all.reduce((s,b)=>s+(b.werkelijkeInleg||0),0));
  const groupCards = groups.map((g,i)=>{
    const berekend = calcGroep(g.doelen, g.pot, TODAY);
    const doel = round2(berekend.reduce((s,b)=>s+(Number(b.doel.doelbedrag)||0),0));
    const gespaard = round2(berekend.reduce((s,b)=>s+(Number(b.doel.algespaard)||0),0));
    const p = doel>0 ? gespaard/doel : 0;
    return `<div class="card goal-group-block">
      <div class="goal-group-title"><h3>${g.label}</h3><span class="status-badge">${pct(p)}</span></div>
      ${renderModernGoalCards(g.doelen, g.pot, g.label)}
      <div class="card-total"><span>Totaal</span><span>${eur(gespaard)} van ${eur(doel)}</span></div>
    </div>`;
  }).join('');
  const distribution = groups.map(g=>{
    const total = round2(calcGroep(g.doelen, g.pot, TODAY).reduce((s,b)=>s+(Number(b.doel.doelbedrag)||0),0));
    const ratio = totaalDoel > 0 ? total / totaalDoel : 0;
    return `<div class="progress-item"><div class="progress-top"><strong>${g.label}</strong><span>${eur(total)} · ${pct(ratio)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(ratio*100)}%"></div></div></div>`;
  }).join('');

  const inlegColors = ['var(--green)','var(--blue)','var(--terracotta)'];
  const inlegPerGroup = groups.map((g,i)=>{
    const items = calcGroep(g.doelen, g.pot, TODAY).filter(item=>item.owner===undefined || true);
    const inleg = round2(calcGroep(g.doelen, g.pot, TODAY).reduce((s,b)=>s+(b.werkelijkeInleg||0),0));
    return {label:g.label, inleg, color:inlegColors[i]};
  });
  let cursor = 0;
  const gradientStops = inlegPerGroup.map(g=>{
    const pctSlice = inlegDezeMaand > 0 ? (g.inleg/inlegDezeMaand)*100 : 0;
    const start = cursor; cursor += pctSlice;
    return `${g.color} ${start}% ${cursor}%`;
  }).join(', ') || 'var(--border) 0% 100%';
  const donutCard = `<div class="card span-6">
    <div class="card-head"><h2>Inleg deze maand</h2></div>
    <div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${gradientStops})"><div class="donut-center">${eur(inlegDezeMaand)}<span>totaal</span></div></div>
      <div class="donut-legend">${inlegPerGroup.map(g=>`<div class="line"><span><span class="dot" style="background:${g.color}"></span>${g.label}</span><strong>${eur(g.inleg)} ${inlegDezeMaand>0?`(${Math.round((g.inleg/inlegDezeMaand)*100)}%)`:''}</strong></div>`).join('')}</div>
    </div>
  </div>`;

  document.getElementById('tab-spaardoelen').innerHTML = `
    ${renderPageHeading(`Spaardoelen overzicht — ${monthLabel(getSelectedMonth())}`, 'Elke maand een stap dichter bij wat jullie belangrijk vinden.')}
    <div class="overview-kpi-row cols-4">
      ${renderIconKpi('◈','green','Totaal gespaard', eur(totaalGespaard), `van ${eur(totaalDoel)}`, {valueClass:'value pos'})}
      ${renderIconKpi('◎','blue','Totaal doelbedrag', eur(totaalDoel), 'alle doelen samen')}
      ${renderIconKpi('↗','green','Gemiddelde voortgang', pct(gemiddelde), 'op basis van doelbedrag')}
      ${renderIconKpi('€','blue','Inleg deze maand', eur(inlegDezeMaand), monthLabel(getSelectedMonth()))}
    </div>
    <div class="goal-groups-grid">${groupCards}</div>
    <div class="dashboard-grid">
      <div class="card span-6"><div class="card-head"><h2>Verdeling van spaardoelen</h2></div><div class="progress-list">${distribution}</div><p class="hint" style="margin-top:6px">Percentages gebaseerd op totaal doelbedrag per groep.</p></div>
      ${donutCard}
    </div>
    <div class="manage-stack">
      ${renderManageSection('Spaardoelen beheren — Gezamenlijk', `<div class="card">${renderGoalGroup('spaardoelen.gezamenlijk', state.spaardoelen.gezamenlijk, r.spaarpotDezeMaand)}</div>`, false)}
      ${renderManageSection('Spaardoelen beheren — Dion', `<div class="card">${renderGoalGroup('spaardoelen.dion', state.spaardoelen.dion, r.dion.beschikbaarVoorSparen)}</div>`, false)}
      ${renderManageSection('Spaardoelen beheren — Dara', `<div class="card">${renderGoalGroup('spaardoelen.dara', state.spaardoelen.dara, r.dara.beschikbaarVoorSparen)}</div>`, false)}
    </div>
  `;
}
/* ---------- data & back-up tab ---------- */
function renderDataTab(){
  document.getElementById('tab-data')?.classList.remove('mobile-data-page');
  const lastBackup = DataAdapter.loadBackup();
  const lastBackupDate = lastBackup?.savedAt ? new Date(lastBackup.savedAt) : null;
  const isToday = lastBackupDate && lastBackupDate.toDateString() === new Date().toDateString();
  const backupDesc = lastBackupDate
    ? `${isToday ? 'Vandaag' : lastBackupDate.toLocaleDateString('nl-NL')} om ${lastBackupDate.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}`
    : 'Nog geen back-up gemaakt';
  const cloudConnected = CloudAdapter.isConnected();
  const cloudTitle = cloudConnected ? 'Cloud status: verbonden' : (CloudAdapter.isConfigured() ? 'Cloud status: klaar om te verbinden' : 'Cloud status: niet gekoppeld');

  document.getElementById('tab-data').innerHTML = `
    ${renderPageHeading('Data & back-up', 'Alles veilig op één plek — lokaal én klaar voor een back-up.')}
    <div class="dashboard-grid">
      ${renderStatusCard('✓','green','Lokale opslag actief','Je data wordt lokaal in je browser opgeslagen.')}
      ${renderStatusCard('◷','green',`Laatste back-up`, backupDesc, lastBackupDate ? `<span class="status-badge">${isToday?'Actueel':'Bewaard'}</span>` : '')}
      ${renderStatusCard('☁','terracotta', cloudTitle, cloudConnected ? 'Data synchroniseert live met Firebase.' : 'Verbind met Firebase om te synchroniseren (optioneel).')}
    </div>
    <div class="card">
      <div class="card-head"><h2>Back-up</h2></div>
      <p class="hint" style="margin-top:-4px">Exporteer, importeer of herstel je data. Aanbevolen: maak regelmatig een back-up.</p>
      <div class="toolbar">
        <button class="primary" id="btnExport">⬇ Exporteer back-up (JSON)</button>
        <button class="ghost" id="btnImport">⬆ Importeer back-up</button>
        <button class="ghost" id="btnRestoreBackup">◷ Herstel laatste lokale back-up</button>
        <button class="ghost" id="btnReset" style="border-color:var(--red);color:var(--red)">🗑 Alles wissen</button>
      </div>
      <input type="file" id="fileImport" accept="application/json" style="display:none">
    </div>
    <div class="card">
      <div class="card-head"><h2>Firebase / Firestore</h2><span class="hint" id="cloudStatus">${CloudAdapter.statusText()}</span></div>
      <p class="hint" style="margin-top:-4px">Verbind met Firebase om je data veilig in de cloud te bewaren en te synchroniseren tussen apparaten.</p>
      <textarea id="firebaseConfigInput" spellcheck="false" placeholder="${firebaseConfigTemplate().replaceAll('"','&quot;')}">${CloudAdapter.isConfigured() ? JSON.stringify(CloudAdapter.config, null, 2) : ''}</textarea>
      <div class="toolbar" style="margin-top:8px">
        <button class="ghost small" id="btnSaveFirebaseConfig">💾 Firebase-config opslaan</button>
        <button class="primary small" id="btnConnectFirebase">☁ Verbinden met cloud</button>
        <button class="ghost small" id="btnUploadCloud">⬆ Lokale stand naar cloud zetten</button>
        <button class="ghost small" id="btnFirebaseSignOut">⛓ Cloud loskoppelen</button>
      </div>
      <pre>Firestore rules voor openbaar lezen en bewerken:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /budgetPlanners/finize {
      allow read, write: if true;
      match /imports/{importId} {
        allow read, write: if true;
        match /chunks/{chunkId} {
          allow read, write: if true;
        }
      }
    }
  }
}</pre>
    </div>
    <div class="info-callout">
      <span class="icon-circle">ⓘ</span>
      <div>
        <h4>Hoe werkt het?</h4>
        <p>Je data wordt standaard lokaal in je browser opgeslagen. Dit is veilig en werkt ook offline.</p>
        <p>Cloud synchronisatie via Firebase is optioneel. Alleen jij hebt toegang tot je data.</p>
      </div>
    </div>
  `;
  document.getElementById('btnExport').addEventListener('click', async ()=>{
    try{
      const exportState = clone(state);
      await GoalImageStore.expandStateForTransfer(exportState);
      downloadJson('dion-dara-budget-backup-' + new Date().toISOString().slice(0,10) + '.json', exportState);
    }catch(error){
      console.error('Back-up exporteren mislukt', error);
      alert('De back-up kon niet volledig worden gemaakt omdat een spaardoelfoto niet kon worden geladen.');
    }
  });
  document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      try{
        const imported = JSON.parse(ev.target.result);
        const migratedImport = migrateBudgetState(imported);
        const validation = validateBudgetState(migratedImport);
        if (!validation.ok){
          alert('Deze back-up is niet geimporteerd:\n\n' + validation.errors.slice(0,6).join('\n'));
          e.target.value = '';
          return;
        }
        if (!confirm('Deze import vervangt alle huidige gegevens. De huidige stand wordt eerst als lokale nood-back-up bewaard. Doorgaan?')){
          e.target.value = '';
          return;
        }
        DataAdapter.backup(state, 'voor import van ' + file.name);
        DataAdapter.backup(state, 'voor JSON-import');
        state = migratedImport; window.state = state; committedStateSnapshot = clone(state);
        await GoalImageStore.initializeState(state);
        commitChange(()=>{}, {render:false});
        renderActiveTab();
        alert('Back-up geimporteerd.');
      }catch(err){ alert('Kon dit bestand niet lezen: ' + err.message); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
  document.getElementById('btnRestoreBackup').addEventListener('click', async ()=>{
    const backup = DataAdapter.loadBackup();
    if (!backup || !backup.state){
      alert('Er is nog geen lokale nood-back-up gevonden.');
      return;
    }
    const migratedBackup = migrateBudgetState(backup.state);
    const validation = validateBudgetState(migratedBackup);
    if (!validation.ok){
      alert('De lokale nood-back-up is ongeldig:\n\n' + validation.errors.slice(0,6).join('\n'));
      return;
    }
    const label = backup.label || backup.savedAt || 'onbekend moment';
    if (confirm('Laatste lokale nood-back-up herstellen van ' + label + '? De huidige stand wordt eerst opnieuw als nood-back-up bewaard.')){
      DataAdapter.backup(state, 'voor herstel lokale nood-back-up');
      DataAdapter.backup(state, 'voor herstel lokale back-up');
      state = migratedBackup; window.state = state; committedStateSnapshot = clone(state);
      await GoalImageStore.initializeState(state);
      commitChange(()=>{}, {render:false});
      renderActiveTab();
    }
  });
  document.getElementById('btnReset').addEventListener('click', ()=>{
    if (confirm('Weet je zeker dat je alle gegevens wilt wissen en opnieuw wilt beginnen? De huidige stand wordt eerst als lokale nood-back-up bewaard.')){
      DataAdapter.backup(state, 'voor alles wissen');
      state = normalizeBudgetState(defaultState()); window.state = state; committedStateSnapshot = clone(state);
      persist();
      renderActiveTab();
    }
  });
  document.getElementById('btnSaveFirebaseConfig').addEventListener('click', ()=>{
    try{
      CloudAdapter.config = saveFirebaseConfigFromText(document.getElementById('firebaseConfigInput').value);
      CloudAdapter.status = 'Firebase-config opgeslagen';
      renderCloudStatus();
    }catch(err){
      alert('Firebase-config niet opgeslagen: ' + err.message);
    }
  });
  document.getElementById('btnConnectFirebase').addEventListener('click', async ()=>{
    await CloudAdapter.connect();
  });
  document.getElementById('btnUploadCloud').addEventListener('click', async ()=>{
    if (!CloudAdapter.isConnected()){
      const connected = await CloudAdapter.connect();
      if (!connected) return;
    }
    if (confirm('Lokale stand naar Firestore schrijven? Dit overschrijft het Finize cloud-document.')){
      await CloudAdapter.saveNow(state);
    }
  });
  document.getElementById('btnFirebaseSignOut').addEventListener('click', async ()=>{
    await CloudAdapter.signOut();
  });
}

function renderMobileDataTab(){
  renderDataTab();
  const root=document.getElementById('tab-data');
  if (!root) return;
  root.classList.add('mobile-data-page');
  const heading=root.querySelector('.page-heading');
  if (heading) heading.outerHTML=renderSharedEmptyTabHeader('Data & back-up')+'<p class="mobile-data-intro">Beheer je data, maak back-ups en synchroniseer optioneel met de cloud.</p>';
  const infoParagraphs=root.querySelectorAll('.info-callout p');
  if (infoParagraphs[1]) infoParagraphs[1].textContent='Cloud synchronisatie via Firebase is optioneel. De toegang wordt bepaald door je ingestelde Firestore-beveiligingsregels.';
}

/* ---------- maandselectie en transactiemodal ---------- */
function renderMonthSelect(){
  const button = document.getElementById('monthPickerButton');
  const panel = document.getElementById('monthPickerPanel');
  if (!button || !panel) return;
  const selected = getSelectedMonth();
  const [selectedYear, selectedMonth] = selected.split('-').map(Number);
  const yearOptions = yearsWithMonthData(selected);
  const currentMonthKey = monthKey();
  const monthNames = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  button.textContent = monthLabel(selected);
  button.setAttribute('aria-expanded', document.getElementById('monthControl')?.classList.contains('open') ? 'true' : 'false');
  panel.innerHTML = `
    <div class="year-picker">
      ${yearOptions.map(year=>`<button type="button" data-month-year="${year}" class="${year===selectedYear?'active':''}">${year}</button>`).join('')}
    </div>
    <div class="month-grid">
      ${monthNames.map((name,i)=>{
        const month = i + 1;
        const key = selectedYear + '-' + String(month).padStart(2,'0');
        const classes = [key===selected ? 'active' : '', key===currentMonthKey ? 'current' : ''].filter(Boolean).join(' ');
        return `<button type="button" data-month-value="${key}" class="${classes}">${name}</button>`;
      }).join('')}
    </div>
    <details class="month-options-details">
      <summary><span>Maandopties</span><span class="expand-chevron" aria-hidden="true"></span></summary>
      <div class="month-options-body">
        <button type="button" class="ghost small" data-month-copy-previous>Kopieer vorige maand</button>
      </div>
    </details>`;
}
function closeMonthPicker(){
  const control = document.getElementById('monthControl');
  if (!control) return;
  control.classList.remove('open');
  document.getElementById('monthPickerButton')?.setAttribute('aria-expanded', 'false');
}
function openMonthPicker(){
  const control = document.getElementById('monthControl');
  if (!control) return;
  control.classList.add('open');
  document.getElementById('monthPickerButton')?.setAttribute('aria-expanded', 'true');
}
function bindModalBackdrop(modal,close){
  modal.__finizeBackdropClose=close;
  if(modal.dataset.finizeBackdropBound==='true')return;
  modal.dataset.finizeBackdropBound='true';
  modal.addEventListener('click',event=>{
    if(event.target===modal)modal.__finizeBackdropClose?.();
  });
}
function openTransactionModal(){
  const modal = document.getElementById('transactionModal');
  const today = getSelectedMonth() + '-' + String(new Date().getDate()).padStart(2,'0');
  modal.innerHTML = `
    <div class="modal">
      <div class="card-head"><h2>Uitgave toevoegen</h2><button class="danger-ghost" id="btnCloseTransaction">×</button></div>
      <div class="modal-grid">
        <label>Bedrag<input id="txAmount" type="number" step="0.01" placeholder="0,00"></label>
        <label>Datum<input id="txDate" type="date" value="${today}"></label>
        <label class="full">Omschrijving<input id="txDescription" type="text" placeholder="Bijvoorbeeld Albert Heijn"></label>
        <label>Categorie<select id="txCategory">
          ${['Boodschappen','Benzine / vervoer','Uit eten','Huis','Hond','Kleding','Gezondheid','Abonnementen','Overig'].map(c=>`<option>${c}</option>`).join('')}
        </select></label>
        <label>Betaald vanuit<select id="txOwner">
          <option value="gezamenlijk">Gezamenlijk</option>
          <option value="dion">Dion</option>
          <option value="dara">Dara</option>
        </select></label>
        <label class="full">Notitie<input id="txNote" type="text" placeholder="Optioneel"></label>
      </div>
      <div class="modal-actions">
        <button class="ghost" id="btnCancelTransaction">Annuleren</button>
        <button class="primary" id="btnSaveTransaction">Uitgave opslaan</button>
      </div>
    </div>`;
  modal.classList.add('open');
  const close = ()=> modal.classList.remove('open');
  document.getElementById('btnCloseTransaction').addEventListener('click', close);
  document.getElementById('btnCancelTransaction').addEventListener('click', close);
  bindModalBackdrop(modal,close);
  document.getElementById('btnSaveTransaction').addEventListener('click', ()=>{
    const saveButton = document.getElementById('btnSaveTransaction');
    if (saveButton.disabled) return;
    const amount = parseFloat(String(document.getElementById('txAmount').value).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0){
      alert('Vul een geldig bedrag in.');
      return;
    }
    const tx = {
      id: uid(),
      date: document.getElementById('txDate').value || today,
      owner: document.getElementById('txOwner').value,
      category: document.getElementById('txCategory').value,
      description: document.getElementById('txDescription').value.trim(),
      amount: round2(amount),
      note: document.getElementById('txNote').value.trim()
    };
    saveButton.disabled = true;
    if (!commitChange(()=>state.transactions.push(tx), {render:false})){ saveButton.disabled = false; return; }
    close();
    renderActiveTab();
  });
}

function openGeneralTransactionModal(){
  const modal = document.getElementById('transactionModal');
  const today = getSelectedMonth() + '-' + String(new Date().getDate()).padStart(2,'0');
  const ownerOptions = [['gezamenlijk','Gezamenlijk'],['dion','Dion'],['dara','Dara']];
  const categoryOptions = owner=>bankOwnerCategories(owner).map(category=>`<option value="${textSafe(category)}">${textSafe(category)}</option>`).join('');
  modal.innerHTML = `<div class="modal joint-transaction-fullscreen-editor general-transaction-editor">
    <div class="card-head"><h2>Transactie invullen</h2><button class="danger-ghost" id="btnCloseGeneralTransaction" aria-label="Sluiten">×</button></div>
    <div class="modal-grid"><label>Soort<select id="generalTxKind"><option value="uitgave">Uitgave</option><option value="inkomen">Inkomen</option></select></label><label>Bedrag<input id="generalTxAmount" type="number" step="0.01" inputmode="decimal" placeholder="0,00"></label><label>Datum<input id="generalTxDate" type="date" value="${today}"></label><label class="full">Omschrijving<input id="generalTxDescription" type="text" placeholder="Bijvoorbeeld Albert Heijn"></label><label>Fysieke rekening<select id="generalTxOwner">${ownerOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Financieel voor<select id="generalTxFinancialFor">${ownerOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Categorie<select id="generalTxCategory">${categoryOptions('gezamenlijk')}</select></label><label class="full">Notitie<input id="generalTxNote" type="text" placeholder="Optioneel"></label></div>
    <div class="modal-actions"><button class="ghost" id="btnCancelGeneralTransaction">Annuleren</button><button class="primary" id="btnSaveGeneralTransaction">Transactie opslaan</button></div>
  </div>`;
  modal.classList.add('open','joint-transaction-modal-open');
  const close = ()=>modal.classList.remove('open','joint-transaction-modal-open');
  document.getElementById('btnCloseGeneralTransaction').addEventListener('click',close);
  document.getElementById('btnCancelGeneralTransaction').addEventListener('click',close);
  document.getElementById('generalTxOwner').addEventListener('change',event=>{ document.getElementById('generalTxCategory').innerHTML = categoryOptions(event.target.value); });
  document.getElementById('btnSaveGeneralTransaction').addEventListener('click',()=>{
    const saveButton = document.getElementById('btnSaveGeneralTransaction');
    if (saveButton.disabled) return;
    const amount = bankAmount(document.getElementById('generalTxAmount').value);
    if (!Number.isFinite(amount) || amount <= 0){ alert('Vul een geldig bedrag in.'); return; }
    const owner = document.getElementById('generalTxOwner').value;
    const financialFor = document.getElementById('generalTxFinancialFor').value;
    const category = document.getElementById('generalTxCategory').value;
    saveButton.disabled = true;
    const selectedKind = document.getElementById('generalTxKind').value;
    const next = {id:uid(),date:document.getElementById('generalTxDate').value || today,owner:financialFor,account:owner,financialFor,reviewStatus:'bevestigd',category,description:document.getElementById('generalTxDescription').value.trim(),amount:round2(amount),note:document.getElementById('generalTxNote').value.trim(),kind:selectedKind==='inkomen'?'inkomen':(String(category).toLocaleLowerCase() === 'vaste lasten' ? 'vaste-last' : 'uitgave')};
    try{u3AssertMonthOpen(transactionMonth(next));}catch(error){alert(error.message);saveButton.disabled=false;return;}
    if (!commitChange(()=>{state.transactions.push(next);u3CreateAdvanceForTransaction(next);u3RememberRecognition(next);}, {render:false})){ saveButton.disabled = false; return; }
    close(); renderActiveTab();
  });
}
function bankRememberCategory(description, category){
  const match = bankText(description);
  if (!match || !category) return;
  state.bankImportRules = (state.bankImportRules || []).filter(rule=>rule.match !== match);
  state.bankImportRules.unshift({match,category});
  state.bankImportRules = state.bankImportRules.slice(0,200);
}
function bankImportRows(indexes){
  if (!bankImportDraft) return;
  const wanted = new Set(indexes);
  const rows = bankImportDraft.rows.filter(row=>wanted.has(row.index) && row.selected && !row.duplicate && row.valid);
  rows.forEach(row=>{
    const signature=`${bankImportDraft.fileName}|${row.index}|${row.date}|${row.owner}|${round2(row.amount)}|${bankText(row.description)}`;
    const id=`review-${signature}`.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,220);
    if(!(state.transactionReviewQueue||[]).some(item=>item.id===id)){
      const suggestion=u3SuggestedRecognition(row.description,row.owner,Math.abs(row.amount));
      state.transactionReviewQueue.push({id,date:row.date,account:row.owner,financialFor:suggestion?.financialFor||row.owner,owner:suggestion?.financialFor||row.owner,category:suggestion?.category||row.category,description:row.description,amount:round2(Math.abs(row.amount)),note:'',kind:row.positive?'inkomen':(String(row.category).toLocaleLowerCase()==='vaste lasten'?'vaste-last':'uitgave'),reviewStatus:'te-controleren',importedAt:new Date().toISOString(),sourceFile:bankImportDraft.fileName,rawData:{index:row.index,cells:bankImportDraft.rawRows[row.index]||[]}});
    }
    row.imported = true; row.selected = false;
  });
  if (!rows.length) return;
  persist();
  showQuickToast(`${rows.length} regel${rows.length === 1 ? '' : 's'} in de controlewachtrij gezet`);
  bankImportDraft = null;
  renderActiveTab();
}
function bindBankImport(root){
  root.querySelector('[data-dashboard-accordion="bank-import"]')?.addEventListener('toggle', event=>{ bankImportOpen = event.currentTarget.open; });
  root.querySelectorAll('[data-open-general-transaction]').forEach(button=>button.addEventListener('click',openGeneralTransactionModal));
  root.querySelector('[data-bank-import-owner]')?.addEventListener('change',event=>{
    if (!bankImportDraft) return;
    bankImportOpen = true;
    bankImportDraft.owner = event.target.value;
    bankParseDraft(); renderActiveTab();
  });
  root.querySelector('[data-bank-csv-file]')?.addEventListener('change',event=>{
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loaded=>{
      const lines = String(loaded.target.result || '').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
      const delimiter = bankCsvDelimiter(lines[0] || '');
      const headers = bankCsvSplit(lines.shift() || '',delimiter);
      const normalizedHeaders = headers.map(bankText);
      bankImportOpen = true;
      bankImportDraft = {fileName:file.name,headers,rawRows:lines.map(line=>bankCsvSplit(line,delimiter)),owner:'gezamenlijk',mapping:{date:bankColumnIndex(normalizedHeaders,[/datum|date|boekdatum|transactie datum/]),description:bankColumnIndex(normalizedHeaders,[/naam omschrijving|omschrijving|description|tegenpartij|mededelingen/]),amount:bankColumnIndex(normalizedHeaders,[/bedrag|amount|mutatie/]),direction:bankColumnIndex(normalizedHeaders,[/af bij|credit debit|debet credit/])}};
      bankParseDraft(); renderActiveTab();
    };
    reader.readAsText(file);
  });
  root.querySelectorAll('[data-bank-map]').forEach(select=>select.addEventListener('change',()=>{ bankImportOpen = true; bankImportDraft.mapping[select.dataset.bankMap] = select.value; bankParseDraft(); renderActiveTab(); }));
  root.querySelectorAll('[data-bank-select]').forEach(input=>input.addEventListener('change',()=>{ const row=bankImportDraft?.rows.find(item=>item.index === Number(input.dataset.bankSelect)); if (row) { bankImportOpen = true; row.selected = input.checked; renderActiveTab(); } }));
  root.querySelectorAll('[data-bank-category]').forEach(select=>select.addEventListener('change',()=>{ const row=bankImportDraft?.rows.find(item=>item.index === Number(select.dataset.bankCategory)); if (row) row.category = select.value; }));
  root.querySelector('[data-bank-import-all]')?.addEventListener('click',()=>bankImportRows(bankImportDraft.rows.filter(row=>row.selected).map(row=>row.index)));
  root.querySelectorAll('[data-bank-import-row]').forEach(button=>button.addEventListener('click',()=>bankImportRows([Number(button.dataset.bankImportRow)])));
}

function openJointTransactionModal(transactionId=''){
  const modal = document.getElementById('transactionModal');
  const today = getSelectedMonth() + '-' + String(new Date().getDate()).padStart(2,'0');
  const existing = (state.transactions || []).find(tx=>tx.id === transactionId && tx.owner === 'gezamenlijk');
  const categories = jointVariableCategoryOptions(existing?.category || '');
  const selectedCategory = existing?.category || categories[0] || 'Overig';
  modal.innerHTML = `
    <div class="modal joint-transaction-fullscreen-editor">
      <div class="card-head"><h2>${existing ? 'Gezamenlijke uitgave bewerken' : 'Gezamenlijke uitgave'}</h2><button class="danger-ghost" id="btnCloseJointTransaction" aria-label="Sluiten">×</button></div>
      <p class="hint" style="margin-top:-4px">${monthLabel(getSelectedMonth())} · wordt gekoppeld aan jullie variabele lasten</p>
      <div class="modal-grid">
        <label>Bedrag<input id="jointTxAmount" type="number" step="0.01" inputmode="decimal" placeholder="0,00" value="${existing ? Number(existing.amount) || '' : ''}"></label>
        <label>Datum<input id="jointTxDate" type="date" value="${textSafe(existing?.date || today)}"></label>
        <label class="full">Omschrijving<input id="jointTxDescription" type="text" placeholder="Bijvoorbeeld Albert Heijn" value="${textSafe(existing?.description || '')}"></label>
        <label>Categorie<select id="jointTxCategory">${categories.map(category=>`<option value="${textSafe(category)}" ${String(category).toLocaleLowerCase() === String(selectedCategory).toLocaleLowerCase() ? 'selected' : ''}>${textSafe(category)}</option>`).join('')}</select></label>
        <label>Eigenaar<select id="jointTxOwner"><option value="gezamenlijk">Gezamenlijk</option><option value="dion">Dion</option><option value="dara">Dara</option></select></label>
        <label class="full">Notitie<input id="jointTxNote" type="text" placeholder="Optioneel" value="${textSafe(existing?.note || '')}"></label>
      </div>
      <div class="modal-actions">
        <button class="ghost" id="btnCancelJointTransaction">Annuleren</button>
        <button class="primary" id="btnSaveJointTransaction">${existing ? 'Wijzigingen opslaan' : 'Uitgave opslaan'}</button>
      </div>
    </div>`;
  modal.classList.add('open', 'joint-transaction-modal-open');
  const close = ()=> modal.classList.remove('open', 'joint-transaction-modal-open');
  document.getElementById('btnCloseJointTransaction').addEventListener('click', close);
  document.getElementById('btnCancelJointTransaction').addEventListener('click', close);
  bindModalBackdrop(modal,close);
  document.getElementById('btnSaveJointTransaction').addEventListener('click', ()=>{
    const saveButton = document.getElementById('btnSaveJointTransaction');
    if (saveButton.disabled) return;
    const amount = parseFloat(String(document.getElementById('jointTxAmount').value).replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0){
      alert('Vul een geldig bedrag in.');
      return;
    }
    const next = {
      id: existing?.id || uid(),
      date: document.getElementById('jointTxDate').value || today,
      owner: document.getElementById('jointTxOwner').value,
      category: document.getElementById('jointTxCategory').value,
      description: document.getElementById('jointTxDescription').value.trim(),
      amount: round2(amount),
      note: document.getElementById('jointTxNote').value.trim()
    };
    saveButton.disabled = true;
    if (!commitChange(()=>{
      if (existing) updateItemById('transactions', existing.id, next);
      else state.transactions.push(next);
    }, {render:false})){ saveButton.disabled = false; return; }
    close();
    renderActiveTab();
  });
}

function showQuickToast(message){
  let toast = document.getElementById('quickToast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'quickToast';
    toast.className = 'quick-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showQuickToast._t);
  showQuickToast._t = setTimeout(()=> toast.classList.remove('show'), 1800);
}

function showUndoToast(message, undo){
  let toast = document.getElementById('quickToast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'quickToast';
    toast.className = 'quick-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>${textSafe(message)}</span> <button type="button" class="quick-toast-undo">Ongedaan maken</button>`;
  toast.classList.add('show');
  clearTimeout(showQuickToast._t);
  const button = toast.querySelector('.quick-toast-undo');
  button.addEventListener('click', ()=>{
    clearTimeout(showQuickToast._t);
    toast.classList.remove('show');
    undo();
  }, {once:true});
  showQuickToast._t = setTimeout(()=>toast.classList.remove('show'), 6000);
}

function removeWithUndo(path, id, message, rerender=true){
  let removed = null;
  const ok = commitChange(()=>{ removed = removeItemById(path, id); }, {render:false});
  if (!ok || !removed) return false;
  if (rerender) renderActiveTab();
  showUndoToast(message, ()=>{
    commitChange(()=>{
      const rows = getPath(state, removed.path);
      if (Array.isArray(rows) && !rows.some(item=>item?.id === removed.item.id)){
        rows.splice(Math.min(removed.index, rows.length), 0, removed.item);
      }
    }, {render:false});
    if (rerender) renderActiveTab();
  });
  return true;
}


function renderJointFixedCostsEditorRows(rows, options={}){
  const kind = options.kind || 'fixed';
  const idAttr = kind === 'mortgage' ? 'data-mortgage-id' : 'data-fixed-id';
  const fieldAttr = kind === 'mortgage' ? 'data-mortgage-field' : 'data-fixed-field';
  const removeAttr = kind === 'mortgage' ? 'data-mortgage-remove' : 'data-fixed-remove';
  const rowAttr = kind === 'mortgage' ? 'data-mortgage-row' : 'data-fixed-row';
  const note = options.note || '';
  const sourcePath = options.sourcePath || `${state.meta.scenario}.gezamenlijk.vasteLasten`;
  const moveOptions = kind === 'fixed' ? moveTargetOptions(sourcePath) : '';
  const header = `<div class="joint-fixed-editor-table-head" aria-hidden="true">
    <span></span>
    <span>Categorie</span>
    <span>Omschrijving</span>
    <span>Bedrag</span>
    <span>Jaarlijks?</span>
    <span>Van/naar</span>
    <span></span>
  </div>`;
  const sortedEntries = (rows||[]).map((row,index)=>({row,index})).sort((a,b)=>{
    const category=String(a.row.categorie||'').localeCompare(String(b.row.categorie||''),'nl',{sensitivity:'base'});
    if (category) return category;
    const description=String(a.row.post||'').localeCompare(String(b.row.post||''),'nl',{sensitivity:'base'});
    return description || a.index-b.index;
  });
  const body = sortedEntries.map(({row})=>{
    const bedrag = Number(row.bedrag)||0;
    const monthly = effectiveBedrag(row);
    return `<div class="joint-fixed-editor-row joint-fixed-editor-row-compact ${kind === 'mortgage' ? 'joint-fixed-editor-row-mortgage' : ''}" ${rowAttr}="${textSafe(row.id)}">
      <span class="joint-fixed-editor-row-icon tone-green">${iconSvg(jointFixedCategoryIconName(row.categorie || row.post || 'overig'))}</span>
      <input class="joint-fixed-editor-input" type="text" ${fieldAttr}="categorie" ${idAttr}="${textSafe(row.id)}" value="${textSafe(row.categorie || '')}" placeholder="Categorie" aria-label="Categorie">
      <input class="joint-fixed-editor-input" type="text" ${fieldAttr}="post" ${idAttr}="${textSafe(row.id)}" value="${textSafe(row.post || '')}" placeholder="Omschrijving" aria-label="Omschrijving">
      <div class="joint-fixed-editor-amount-cell">
        <input class="joint-fixed-editor-input joint-fixed-editor-amount" type="number" step="0.01" inputmode="decimal" ${fieldAttr}="bedrag" ${idAttr}="${textSafe(row.id)}" value="${bedrag}" aria-label="Bedrag">
        <small>${row.jaarlijks ? `≈ ${eur(monthly)}/mnd` : ''}</small>
      </div>
      <label class="joint-fixed-editor-check joint-fixed-editor-check-compact" aria-label="Jaarbedrag, reken per maand /12">
        <input type="checkbox" ${fieldAttr}="jaarlijks" ${idAttr}="${textSafe(row.id)}" ${row.jaarlijks ? 'checked' : ''}>
        <span>${kind === 'mortgage' ? '50/50' : ''}</span>
      </label>
      ${kind === 'fixed' ? `<select class="joint-fixed-editor-move" data-fixed-move-id="${textSafe(row.id)}" data-fixed-source-path="${sourcePath}" aria-label="Verplaatsen naar">${moveOptions}</select>` : '<span class="joint-fixed-editor-mortgage-note">50/50</span>'}
      <button type="button" class="joint-fixed-row-delete-compact" ${removeAttr}="${textSafe(row.id)}" aria-label="Post verwijderen">×</button>
      <div class="joint-fixed-editor-hint joint-fixed-editor-hint-compact">Gerekend als ${eur(monthly)} per maand${note ? ` · ${note}` : ''}</div>
    </div>`;
  }).join('');
  return header + body;
}

function renderJointVariableBudgetEditorRows(rows){
  return (rows||[]).map(row=>{
    const label = row.post || row.categorie || '';
    return `<div class="joint-variable-editor-row">
      <span class="joint-variable-editor-icon">${iconSvg(categoryIconName(label))}</span>
      <input type="text" data-variable-field="post" data-variable-id="${textSafe(row.id)}" value="${textSafe(label)}" placeholder="Categorie" aria-label="Categorie">
      <input type="number" step="0.01" inputmode="decimal" data-variable-field="bedrag" data-variable-id="${textSafe(row.id)}" value="${Number(row.bedrag)||0}" aria-label="Maandbudget">
      <button type="button" class="joint-variable-editor-delete" data-variable-remove="${textSafe(row.id)}" aria-label="Categorie verwijderen">×</button>
    </div>`;
  }).join('');
}

function openJointVariableCostsModal(focusLast=false, owner='gezamenlijk'){
  const modal = document.getElementById('incomeEditModal');
  const scenario = state.meta.scenario;
  const month = getSelectedMonth();
  ensureMonthData(month);
  const key = `${owner}Variabel`;
  const sourceRows = state.monthlyBudgets?.[month]?.[scenario]?.[key]
    || state[scenario]?.[owner]?.variabel
    || [];
  let draftRows = clone(sourceRows).map(row=>({
    ...row,
    id: row.id || uid(),
    categorie: String(row.categorie || 'Variabel'),
    post: String(row.post || ''),
    bedrag: round2(Number(row.bedrag)||0)
  }));
  const name = ownerLabel(owner);
  const scenarioLabel = scenario === 'voor' ? 'Voor verkoop' : 'Na verkoop';
  const total = ()=> round2(sumBedrag(draftRows));

  const draw = (focusNewest=false)=>{
    modal.innerHTML = `
      <div class="modal joint-variable-fullscreen-editor" role="dialog" aria-modal="true" aria-label="Variabele lasten aanpassen">
        <div class="joint-variable-editor-header">
          <div>
            <div class="section-kicker">${scenarioLabel} · ${monthLabel(month)}</div>
            <h2>${owner === 'gezamenlijk' ? 'Variabele lasten' : `${name} variabele lasten`}</h2>
            <p>Pas de maandbudgetten aan en bevestig ze met Opslaan.</p>
          </div>
          <button type="button" class="ghost joint-variable-editor-close" data-close-joint-variable-costs>Sluiten</button>
        </div>
        <div class="joint-variable-editor-summary"><span>Totaal maandbudget</span><strong>${eur(total())}</strong></div>
        <div class="joint-variable-editor-list">${draftRows.length ? renderJointVariableBudgetEditorRows(draftRows) : '<p class="hint" style="padding:10px;margin:0">Nog geen variabele budgetcategorieën.</p>'}</div>
        <div class="joint-variable-editor-actions">
          <button type="button" class="primary" data-variable-save>Opslaan</button>
          <button type="button" class="ghost" data-variable-add>+ Categorie</button>
        </div>
      </div>`;
    modal.classList.add('open','joint-variable-editor-open');

    const syncDraftFromInputs = ()=>{
      modal.querySelectorAll('[data-variable-field]').forEach(el=>{
        const row = draftRows.find(item=>item.id === el.dataset.variableId);
        if (!row) return;
        if (el.dataset.variableField === 'bedrag'){
          const parsed = parseFloat(String(el.value).replace(',', '.'));
          row.bedrag = Number.isFinite(parsed) ? round2(parsed) : 0;
        } else {
          row.post = el.value.trim();
          row.categorie = 'Variabel';
        }
      });
      const summary = modal.querySelector('.joint-variable-editor-summary strong');
      if (summary) summary.textContent = eur(total());
    };
    const close = ()=>{
      modal.classList.remove('open','joint-variable-editor-open');
      modal.innerHTML = '';
      renderActiveTab();
    };
    modal.querySelector('[data-close-joint-variable-costs]')?.addEventListener('click', close);
    modal.querySelectorAll('[data-variable-field]').forEach(el=>{
      el.addEventListener('input', syncDraftFromInputs);
      el.addEventListener('change', syncDraftFromInputs);
    });
    modal.querySelectorAll('[data-variable-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      syncDraftFromInputs();
      draftRows = draftRows.filter(row=>row.id !== btn.dataset.variableRemove);
      draw(false);
    }));
    modal.querySelector('[data-variable-add]')?.addEventListener('click',()=>{
      syncDraftFromInputs();
      draftRows.push({id:uid(), categorie:'Variabel', post:'', bedrag:0});
      draw(true);
    });
    modal.querySelector('[data-variable-save]')?.addEventListener('click',()=>{
      syncDraftFromInputs();
      const cleaned = draftRows.map(row=>({
        id: row.id || uid(),
        categorie:'Variabel',
        post:String(row.post||'').trim(),
        bedrag:round2(Number(row.bedrag)||0)
      }));
      const saved = commitChange(()=>{
        ensureMonthData(month);
        state.monthlyBudgets[month] = state.monthlyBudgets[month] || {};
        state.monthlyBudgets[month][scenario] = state.monthlyBudgets[month][scenario] || {};
        state.monthlyBudgets[month][scenario][key] = clone(cleaned);
      },{render:false});
      if (!saved){
        alert('De variabele budgetten konden niet worden opgeslagen. Probeer het opnieuw.');
        return;
      }
      showQuickToast('Variabele lasten opgeslagen');
      close();
    });
    if (focusNewest){
      requestAnimationFrame(()=>modal.querySelector('.joint-variable-editor-row:last-child input[data-variable-field="post"]')?.focus());
    }
  };
  draw(focusLast);
}

function openFixedExpenseAddModal(owner='gezamenlijk', draftSession=null){
  const modal = document.getElementById('incomeEditModal');
  const scenario = state.meta.scenario;
  const scenarioLabel = scenario === 'voor' ? 'Voor verkoop' : 'Na verkoop';
  modal.innerHTML = `<div class="modal income-sheet fixed-expense-add-modal" role="dialog" aria-modal="true" aria-label="Vaste last toevoegen">
    <div class="card-head"><h2>Vaste last toevoegen</h2><button type="button" class="danger-ghost" data-fixed-add-close aria-label="Sluiten">×</button></div>
    <p class="hint">${scenarioLabel}</p>
    <div class="modal-grid">
      <label>Categorie<input type="text" id="fixedAddCategory" autocomplete="off"></label>
      <label>Omschrijving<input type="text" id="fixedAddDescription" autocomplete="off"></label>
      <label>Bedrag<input type="number" id="fixedAddAmount" step="0.01" inputmode="decimal" value="0"></label>
      <label>Frequentie<select id="fixedAddFrequency"><option value="monthly">Maandelijks</option><option value="yearly">Jaarlijks</option></select></label>
      <label class="full">Eigenaar<select id="fixedAddOwner"><option value="gezamenlijk">Gezamenlijk</option><option value="dion">Dion</option><option value="dara">Dara</option></select></label>
    </div>
    <div class="modal-actions"><button type="button" class="ghost" data-fixed-add-cancel>Annuleren</button><button type="button" class="primary" data-fixed-add-save>Vaste last opslaan</button></div>
  </div>`;
  modal.classList.add('open','joint-fixed-editor-open');
  modal.querySelector('#fixedAddOwner').value = owner;
  let saving = false;
  const cancel = ()=>openJointFixedCostsModal(false, owner, draftSession);
  modal.querySelectorAll('[data-fixed-add-close],[data-fixed-add-cancel]').forEach(button=>button.addEventListener('click', cancel));
  modal.querySelector('[data-fixed-add-save]').addEventListener('click', ()=>{
    if (saving) return;
    const category = modal.querySelector('#fixedAddCategory').value.trim();
    const post = modal.querySelector('#fixedAddDescription').value.trim();
    if (!category && !post){ alert('Vul een categorie of omschrijving in.'); return; }
    const amount = bankAmount(modal.querySelector('#fixedAddAmount').value);
    if (!Number.isFinite(amount)){ alert('Vul een geldig bedrag in.'); return; }
    saving = true;
    const selectedOwner = modal.querySelector('#fixedAddOwner').value;
    const item = {id:uid(), categorie:category, post, bedrag:round2(amount), jaarlijks:modal.querySelector('#fixedAddFrequency').value === 'yearly'};
    const ok = commitChange(()=>{
      if (draftSession){
        state[scenario][owner].vasteLasten = clone(draftSession.rows || []);
        if (owner === 'gezamenlijk' && scenario === 'na') state[scenario][owner].hypotheek = clone(draftSession.mortgageRows || []);
      }
      state[scenario][selectedOwner].vasteLasten.push(item);
    }, {render:false});
    if (!ok){ saving = false; alert('Opslaan van de vaste last is mislukt.'); return; }
    showQuickToast('Vaste last opgeslagen');
    openJointFixedCostsModal(false, selectedOwner);
  });
}

function openJointFixedCostsModal(focusLast=false, owner='gezamenlijk', draftSession=null){
  const modal = document.getElementById('incomeEditModal');
  const scenario = state.meta.scenario;
  const account = state[scenario][owner];
  const hasMortgage = owner === 'gezamenlijk' && scenario === 'na';
  const session = draftSession && draftSession.scenario === scenario && draftSession.owner === owner
    ? draftSession
    : {scenario,owner,rows:clone(account.vasteLasten || []),mortgageRows:hasMortgage ? clone(account.hypotheek || []) : [],dirty:false};
  const rows = session.rows;
  const mortgageRows = session.mortgageRows;
  const name = ownerLabel(owner);
  const scenarioLabel = scenario === 'voor' ? 'Voor verkoop' : 'Na verkoop';
  const total = round2(sumEffective(rows) + (hasMortgage ? sumEffective(mortgageRows) : 0));
  const mortgageBlock = hasMortgage ? `
        <div class="joint-fixed-editor-subhead">
          <span>Hypotheek</span>
          <strong>50/50 verdeling</strong>
        </div>
        ${mortgageRows.length ? renderJointFixedCostsEditorRows(mortgageRows, {kind:'mortgage', note:'50/50 verdeeld'}) : '<p class="hint">Nog geen hypotheek toegevoegd.</p>'}
        <button type="button" class="ghost joint-fixed-add-mortgage" data-mortgage-add>+ Hypotheek toevoegen</button>
      ` : '';
  modal.innerHTML = `
    <div class="modal joint-fixed-fullscreen-editor" role="dialog" aria-modal="true" aria-label="Gezamenlijke vaste lasten aanpassen">
      <div class="joint-fixed-editor-header">
        <div>
          <div class="section-kicker">${scenarioLabel} · ${monthLabel(getSelectedMonth())}</div>
          <h2>${owner === 'gezamenlijk' ? 'Gezamenlijke vaste lasten' : `${name} vaste lasten`}</h2>
          <p>${hasMortgage ? 'Hypotheek staat in dit overzicht, maar wordt in de verdeling 50/50 gerekend.' : 'Voeg regels toe en bevestig alle wijzigingen met Opslaan.'}</p>
        </div>
        <button type="button" class="ghost joint-fixed-editor-close" data-close-joint-fixed-costs>Sluiten</button>
      </div>
      <div class="joint-fixed-editor-summary">
        <span>Totaal per maand</span>
        <strong>${eur(total)}</strong>
      </div>
      <div class="joint-fixed-editor-list">
        ${mortgageBlock}
        <div class="joint-fixed-editor-subhead">
          <span>Overige vaste lasten</span>
          ${scenario === 'na' ? '<strong>Naar rato</strong>' : ''}
        </div>
        ${rows.length ? renderJointFixedCostsEditorRows(rows, {sourcePath:`${scenario}.${owner}.vasteLasten`}) : '<p class="hint">Nog geen vaste lasten toegevoegd.</p>'}
      </div>
      <div class="joint-fixed-editor-actions">
        <button type="button" class="primary" data-fixed-save>Opslaan</button>
        <button type="button" class="ghost" data-fixed-add>+ Vaste last</button>
      </div>
    </div>`;
  modal.classList.add('open','joint-fixed-editor-open');

  const updateSummary = ()=>{
    const summary = modal.querySelector('.joint-fixed-editor-summary strong');
    if (summary) summary.textContent = eur(round2(sumEffective(rows) + (hasMortgage ? sumEffective(mortgageRows) : 0)));
  };

  const commitAllFields = ()=>{
    modal.querySelectorAll('[data-fixed-field], [data-mortgage-field]').forEach(el=>{
      const isMortgage = !!el.dataset.mortgageField;
      const collection = isMortgage ? mortgageRows : rows;
      const id = isMortgage ? el.dataset.mortgageId : el.dataset.fixedId;
      const field = isMortgage ? el.dataset.mortgageField : el.dataset.fixedField;
      const item = collection.find(row=>row.id === id);
      if (!item) return;
      if (field === 'bedrag'){
        const parsed = bankAmount(el.value);
        item[field] = Number.isFinite(parsed) ? round2(parsed) : 0;
      } else if (field === 'jaarlijks'){
        item[field] = !!el.checked;
      } else {
        item[field] = el.value.trim();
      }
    });
    updateSummary();
  };

  const close = (force=false)=>{
    if (!force && session.dirty && !confirm('Wijzigingen niet opgeslagen. Toch sluiten?')) return;
    modal.classList.remove('open','joint-fixed-editor-open');
    modal.innerHTML = '';
    renderActiveTab();
  };
  modal.querySelectorAll('[data-close-joint-fixed-costs]').forEach(btn=>btn.addEventListener('click', ()=>close(false)));

  const markDirty = ()=>{ session.dirty = true; };
  modal.querySelectorAll('[data-fixed-field], [data-mortgage-field]').forEach(el=>{
    const commit = ()=>{ commitAllFields(); markDirty(); };
    el.addEventListener('change', commit);
    if (el.type !== 'checkbox') el.addEventListener('input', commit);
  });

  modal.querySelectorAll('[data-fixed-move-id]').forEach(select=>{
    select.addEventListener('change', ()=>{
      commitAllFields();
      const targetPath = select.value;
      const sourcePath = select.dataset.fixedSourcePath;
      const id = select.dataset.fixedMoveId;
      if (!targetPath || targetPath === sourcePath) return;
      const previousRows = account.vasteLasten;
      const previousMortgage = hasMortgage ? account.hypotheek : null;
      account.vasteLasten = clone(rows);
      if (hasMortgage) account.hypotheek = clone(mortgageRows);
      const source = getPath(state, sourcePath);
      const target = getPath(state, targetPath);
      if (!Array.isArray(source) || !Array.isArray(target)){
        account.vasteLasten = previousRows;
        if (hasMortgage) account.hypotheek = previousMortgage;
        return;
      }
      const movement = moveItemById(sourcePath, targetPath, id);
      if (!movement) return;
      if (!persist()){
        moveItemById(targetPath, sourcePath, id, movement.sourceIndex);
        account.vasteLasten = previousRows;
        if (hasMortgage) account.hypotheek = previousMortgage;
        alert('Verplaatsen is mislukt.');
        return;
      }
      showUndoToast('Vaste last verplaatst', ()=>{
        commitChange(()=>moveItemById(targetPath, sourcePath, id, movement.sourceIndex), {render:false});
        renderActiveTab();
      });
      openJointFixedCostsModal(false, owner);
    });
  });

  modal.querySelectorAll('[data-fixed-remove]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      commitAllFields();
      const id = btn.dataset.fixedRemove;
      const idx = rows.findIndex(row=>row.id === id);
      if (idx < 0) return;
      const removed = clone(rows[idx]);
      const nextRows = rows.filter(row=>row.id !== id);
      if (!commitChange(()=>{ account.vasteLasten = clone(nextRows); }, {render:false})) return;
      rows.splice(idx, 1);
      session.dirty = false;
      openJointFixedCostsModal(false, owner, session);
      showUndoToast('Vaste last verwijderd', ()=>{
        commitChange(()=>{
          const target = state[scenario][owner].vasteLasten;
          if (!target.some(row=>row.id === id)) target.splice(Math.min(idx,target.length),0,removed);
        }, {render:false});
        openJointFixedCostsModal(false, owner);
      });
    });
  });

  modal.querySelectorAll('[data-mortgage-remove]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      commitAllFields();
      const id = btn.dataset.mortgageRemove;
      const idx = mortgageRows.findIndex(row=>row.id === id);
      if (idx < 0) return;
      const removed = clone(mortgageRows[idx]);
      const nextRows = mortgageRows.filter(row=>row.id !== id);
      if (!commitChange(()=>{ account.hypotheek = clone(nextRows); }, {render:false})) return;
      mortgageRows.splice(idx, 1);
      session.dirty = false;
      openJointFixedCostsModal(false, owner, session);
      showUndoToast('Vaste last verwijderd', ()=>{
        commitChange(()=>{
          const target = state[scenario][owner].hypotheek;
          if (!target.some(row=>row.id === id)) target.splice(Math.min(idx,target.length),0,removed);
        }, {render:false});
        openJointFixedCostsModal(false, owner);
      });
    });
  });

  modal.querySelector('[data-fixed-save]')?.addEventListener('click', ()=>{
    commitAllFields();
    const activeRows = rows.filter(row=>String(row.categorie||'').trim() || String(row.post||'').trim() || Number(row.bedrag));
    activeRows.forEach(row=>{ row.categorie = String(row.categorie||'').trim() || 'Overig'; });
    rows.splice(0, rows.length, ...activeRows);
    const previousRows = account.vasteLasten;
    const previousMortgage = hasMortgage ? account.hypotheek : null;
    account.vasteLasten = clone(rows);
    if (hasMortgage) account.hypotheek = clone(mortgageRows);
    if (!persist()){
      account.vasteLasten = previousRows;
      if (hasMortgage) account.hypotheek = previousMortgage;
      alert('Opslaan van de vaste lasten is mislukt. Controleer de beschikbare opslagruimte en probeer opnieuw.');
      return;
    }
    session.dirty = false;
    showQuickToast('Vaste lasten opgeslagen');
    close(true);
  });

  const add = modal.querySelector('[data-fixed-add]');
  if (add){
    add.addEventListener('click', ()=>{
      commitAllFields();
      openFixedExpenseAddModal(owner, session);
    });
  }

  const addMortgage = modal.querySelector('[data-mortgage-add]');
  if (addMortgage){
    addMortgage.addEventListener('click', ()=>{
      commitAllFields();
      mortgageRows.push({id:uid(), categorie:'Huis', post:'Hypotheek', bedrag:0, jaarlijks:false});
      session.dirty = true;
      openJointFixedCostsModal(false, owner, session);
    });
  }

  if (focusLast){
    requestAnimationFrame(()=>{
      const lastId = rows[rows.length-1]?.id;
      const last = modal.querySelector(`input[data-fixed-field="categorie"][data-fixed-id="${lastId}"]`);
      if (last) last.focus();
    });
  }
}

function openSavingEditModal(){
  const modal = document.getElementById('incomeEditModal');
  const scenario = state.meta.scenario;
  const data = getMonthlyScenarioData(scenario);
  const current = Number(data.spaarpotDezeMaand)||0;
  const scenarioLabel = scenario === 'voor' ? 'Voor verkoop' : 'Na verkoop';
  modal.innerHTML = `
    <div class="modal income-sheet">
      <div class="income-sheet-handle"></div>
      <div class="card-head"><h2>Sparen aanpassen</h2><button class="danger-ghost" id="btnCloseSavingEdit">×</button></div>
      <div class="income-sheet-meta">
        <span>${scenarioLabel}</span>
        <span>${monthLabel(getSelectedMonth())}</span>
      </div>
      <div class="income-sheet-total">
        <span>Sparen deze maand</span>
        <strong id="savingEditPreviewTotal">${eur(current)}</strong>
      </div>
      <label class="income-sheet-field">Bedrag om deze maand te sparen
        <input id="savingEditInput" type="number" step="0.01" inputmode="decimal" value="${current}">
      </label>
      <div class="income-sheet-readonly">
        <span>Wordt meegenomen in zakgeldberekening</span><strong>${eur(current)}</strong>
      </div>
      <div class="modal-actions">
        <button class="ghost" id="btnCancelSavingEdit">Annuleren</button>
        <button class="primary" id="btnSaveSavingEdit">Opslaan</button>
      </div>
    </div>`;
  modal.classList.add('open');
  const close = ()=> modal.classList.remove('open');
  const input = document.getElementById('savingEditInput');
  const preview = document.getElementById('savingEditPreviewTotal');
  input.addEventListener('input', ()=>{
    const parsed = parseFloat(String(input.value).replace(',', '.'));
    preview.textContent = eur(round2(Number.isFinite(parsed) ? parsed : 0));
  });
  document.getElementById('btnCloseSavingEdit').addEventListener('click', close);
  document.getElementById('btnCancelSavingEdit').addEventListener('click', close);
  bindModalBackdrop(modal,close);
  document.getElementById('btnSaveSavingEdit').addEventListener('click', ()=>{
    const parsed = parseFloat(String(input.value).replace(',', '.'));
    state[scenario].spaarpotDezeMaand = round2(Number.isFinite(parsed) ? parsed : 0);
    persist();
    close();
    renderActiveTab();
    showQuickToast('Sparen opgeslagen');
  });
}


function openIncomeEditModal(person, label){
  const modal = document.getElementById('incomeEditModal');
  const basis = getMonthlyBaseIncome(person);
  const teruggaven = sumVasteTeruggaven(person);
  const totaal = getTotalMonthlyIncome(person);
  modal.innerHTML = `
    <div class="modal income-sheet">
      <div class="income-sheet-handle"></div>
      <div class="card-head"><h2>Inkomen instellen</h2><button class="danger-ghost" id="btnCloseIncomeEdit">×</button></div>
      <div class="income-sheet-meta">
        <span>${label}</span>
        <span>${monthLabel(getSelectedMonth())}</span>
      </div>
      <div class="income-sheet-total">
        <span>Totaal inkomen ${label}</span>
        <strong>${eur(totaal)}</strong>
      </div>
      <label class="income-sheet-field">Standaardsalaris vanaf deze maand
        <input id="incomeEditInput" type="number" step="0.01" inputmode="decimal" value="${basis}">
      </label>
      <label class="income-sheet-field">Standaardteruggave vanaf deze maand<input id="incomeRefundInput" type="number" step="0.01" inputmode="decimal" value="${teruggaven}"></label>
      <div class="income-sheet-readonly">
        <span>Totaal naar gezamenlijke rekening</span><strong id="incomeEditPreviewTotal">${eur(totaal)}</strong>
      </div>
      <div class="modal-actions">
        <button class="ghost" id="btnCancelIncomeEdit">Annuleren</button>
        <button class="primary" id="btnSaveIncomeEdit">Opslaan</button>
      </div>
    </div>`;
  modal.classList.add('open');
  const close = ()=> modal.classList.remove('open');
  const input = document.getElementById('incomeEditInput');
  const refundInput=document.getElementById('incomeRefundInput');
  const preview = document.getElementById('incomeEditPreviewTotal');
  input.addEventListener('input', ()=>{
    const parsed = parseFloat(String(input.value).replace(',', '.'));
    const basisNow = Number.isFinite(parsed) ? parsed : 0;
    const refundNow=bankAmount(refundInput.value);preview.textContent=eur(round2(basisNow+(Number.isFinite(refundNow)?refundNow:0)));
  });
  refundInput.addEventListener('input',()=>input.dispatchEvent(new Event('input')));
  document.getElementById('btnCloseIncomeEdit').addEventListener('click', close);
  document.getElementById('btnCancelIncomeEdit').addEventListener('click', close);
  bindModalBackdrop(modal,close);
  document.getElementById('btnSaveIncomeEdit').addEventListener('click', ()=>{
    const parsed = parseFloat(String(input.value).replace(',', '.'));
    const refund=bankAmount(refundInput.value);
    setIncomeDefaultsFromMonth(person,getSelectedMonth(),Number.isFinite(parsed)?parsed:0,Number.isFinite(refund)?refund:0);
    persist();
    close();
    renderActiveTab();
    showQuickToast('Inkomen opgeslagen');
  });
}

function openTotalIncomeEditModal(){
  const modal=document.getElementById('incomeEditModal');
  const month=getSelectedMonth();
  const dion=getDistributionIncomeParts('dion',month);
  const dara=getDistributionIncomeParts('dara',month);
  const actualIncomePresent=['dion','dara','gezamenlijk'].some(owner=>u3ConfirmedTransactions(month).some(tx=>tx.kind==='inkomen'&&u3IncomeTransactionOwner(tx)===owner));
  modal.innerHTML=`
    <div class="modal income-sheet">
      <div class="income-sheet-handle"></div>
      <div class="card-head"><h2>Inkomen instellen</h2><button class="danger-ghost" id="btnCloseTotalIncomeEdit" aria-label="Sluiten">&times;</button></div>
      <div class="income-sheet-meta"><span>Dion en Dara</span><span>${monthLabel(month)}</span></div>
      <p class="hint">Standaardbedragen gelden vanaf deze maand voor alle volgende maanden. CSV-inkomsten wijzigen deze standaard niet en worden alleen gekoppeld aan de rekeninghouder van het gebruikte rekeningprofiel.</p>
      ${actualIncomePresent?'<div class="status-badge status-ok">Werkelijke CSV-inkomsten zijn voor deze maand zichtbaar</div>':''}
      <label class="income-sheet-field">Standaardsalaris Dion<input id="totalIncomeDion" type="number" step="0.01" inputmode="decimal" value="${dion.salary}"></label>
      <label class="income-sheet-field">Standaardteruggave Dion<input id="totalRefundDion" type="number" step="0.01" inputmode="decimal" value="${dion.refund}"></label>
      <label class="income-sheet-field">Standaardsalaris Dara<input id="totalIncomeDara" type="number" step="0.01" inputmode="decimal" value="${dara.salary}"></label>
      <label class="income-sheet-field">Standaardteruggave Dara<input id="totalRefundDara" type="number" step="0.01" inputmode="decimal" value="${dara.refund}"></label>
      <label class="income-sheet-readonly" style="justify-content:flex-start;gap:10px"><input id="incomeOnlyThisMonth" type="checkbox"><span>Alleen voor ${monthLabel(month)} aanpassen</span></label>
      <div class="income-sheet-total"><span>Verdeelbasis</span><strong id="totalIncomePreview">${eur(round2(dion.salary+dion.refund+dara.salary+dara.refund))}</strong></div>
      <div class="modal-actions"><button class="ghost" id="btnCancelTotalIncomeEdit">Annuleren</button><button class="primary" id="btnSaveTotalIncomeEdit">Opslaan</button></div>
    </div>`;
  modal.classList.add('open');
  const close=()=>{modal.classList.remove('open');modal.innerHTML='';};
  const ids=['totalIncomeDion','totalRefundDion','totalIncomeDara','totalRefundDara'];
  const inputs=ids.map(id=>document.getElementById(id));
  const amount=input=>{const parsed=bankAmount(input.value);return Number.isFinite(parsed)?round2(parsed):0;};
  const updatePreview=()=>{document.getElementById('totalIncomePreview').textContent=eur(round2(inputs.reduce((sum,input)=>sum+amount(input),0)));};
  inputs.forEach(input=>input.addEventListener('input',updatePreview));
  document.getElementById('btnCloseTotalIncomeEdit').addEventListener('click',close);
  document.getElementById('btnCancelTotalIncomeEdit').addEventListener('click',close);
  bindModalBackdrop(modal,close);
  document.getElementById('btnSaveTotalIncomeEdit').addEventListener('click',()=>{
    assertMonthMutationAllowed(month);ensureMonthData(month);
    const values={dion:{salary:amount(inputs[0]),refund:amount(inputs[1])},dara:{salary:amount(inputs[2]),refund:amount(inputs[3])}};
    const onlyMonth=document.getElementById('incomeOnlyThisMonth').checked;
    if(onlyMonth){
      state.monthlyIncomeOverrides[month]=isPlainObject(state.monthlyIncomeOverrides[month])?state.monthlyIncomeOverrides[month]:{};
      state.monthlyRefundOverrides[month]=isPlainObject(state.monthlyRefundOverrides[month])?state.monthlyRefundOverrides[month]:{};
      ['dion','dara'].forEach(person=>{state.monthlyIncomeOverrides[month][person]=values[person].salary;state.monthlyRefundOverrides[month][person]=values[person].refund;state.monthlyIncome[month][person]=values[person].salary;});
    }else{
      ['dion','dara'].forEach(person=>setIncomeDefaultsFromMonth(person,month,values[person].salary,values[person].refund));
      if(state.monthlyIncomeOverrides?.[month]){delete state.monthlyIncomeOverrides[month].dion;delete state.monthlyIncomeOverrides[month].dara;}
      if(state.monthlyRefundOverrides?.[month]){delete state.monthlyRefundOverrides[month].dion;delete state.monthlyRefundOverrides[month].dara;}
    }
    persist();close();renderActiveTab();showQuickToast(onlyMonth?'Maandinkomen opgeslagen':'Standaardinkomen opgeslagen');
  });
}


function renderSharedEmptyTabHeader(title){
  let header = `<div class="mobile-header-top v4-mobile-only-block">
      <div class="mobile-brand">
        <div class="mobile-brand-icon"><img src="data:image/png;base64,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" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="mobile-brand-icon-fallback">F</span></div>
        <div>
          <strong>Finize</strong>
          <button type="button" class="mobile-status-pill" data-tab-shortcut="data">Online</button>
        </div>
      </div>
      <div class="mobile-month-slot" id="mobileMonthSlot"></div>
    </div>
    <div class="mobile-dashboard-header v4-mobile-only-block">
      <div class="mobile-title-scenario-row">
        <div class="mobile-title-block">
          <h1>Dashboard</h1>
          <p>${monthLabel(getSelectedMonth())}</p>
        </div>
        <div class="scenario-toggle mobile-scenario-toggle" data-mobile-scenario>
          <button data-scenario="voor">Voor verkoop</button>
          <button data-scenario="na">Na verkoop</button>
        </div>
      </div>
      <button type="button" class="primary mobile-add-expense" data-open-transaction>+ Uitgave toevoegen</button>
    </div>
    `;
  header = header.replace('<h1>Dashboard</h1>', `<h1>${title}</h1>`);
  return header;
}


function jointFixedCategoryIconName(categorie){
  const c = String(categorie || '').toLowerCase().trim();

  if (/water|evides|waterschap/.test(c)) return 'drop';
  if (/energie|stroom|gas|elektra|eneco/.test(c)) return 'bolt';
  if (/belasting|belastingen|gemeente|heffing|btw|riool|afval/.test(c)) return 'building';
  if (/internet|wifi|telefoon|mobiel/.test(c)) return 'phone';
  if (/entertainment|netflix|spotify|stream|streaming|abonnement|vrije tijd|hobby/.test(c)) return 'play';
  if (/boodschap|supermarkt|eten|voeding|boer|slager|bakker/.test(c)) return 'cart';
  if (/benzine|tank|brandstof/.test(c)) return 'fuel';
  if (/auto|vervoer|ov|trein|bus|parkeer|parking/.test(c)) return 'car';
  if (/hypotheek|huur|wonen|huis|woon/.test(c)) return 'house';
  if (/zorg|medisch|arts|tand|apotheek|fysio|gezond/.test(c)) return 'heart';
  if (/verzeker|verzekering/.test(c)) return 'shield';
  if (/pensioen|beleg|invest/.test(c)) return 'trend';
  if (/sparen|spaar/.test(c)) return 'piggy';
  if (/kind|opvang|school|studie/.test(c)) return 'users';
  if (/vakantie|reis|vlucht/.test(c)) return 'plane';
  if (/koffie|horeca|restaurant|cafe/.test(c)) return 'coffee';
  if (/overig|algemeen|kosten|bank|ing/.test(c)) return 'receipt';
  return categoryIconName(categorie);
}

function renderJointFirstRow(){
  const r = calcScenario(state);
  const scenarioData = getMonthlyScenarioData(state.meta.scenario);
  const variabelBudgetPct = r.variabelBudgetTotaal > 0 ? Math.min(100, Math.round((r.variabelTotaal / r.variabelBudgetTotaal) * 100)) : 0;
  const variableBudgetMap = new Map();
  (scenarioData.gezamenlijk.variabel||[]).forEach(row=>{
    const label = String(row.post || row.categorie || '').trim();
    if (!label && !Number(row.bedrag)) return;
    const key = label.toLocaleLowerCase();
    const current = variableBudgetMap.get(key) || {label: label || 'Budget', budget:0};
    current.budget = round2(current.budget + (Number(row.bedrag)||0));
    variableBudgetMap.set(key, current);
  });
  const usedByBudgetKey = {};
  let unassignedUsed = 0;
  getMonthTransactions('gezamenlijk').forEach(tx=>{
    const key = String(tx.category || '').trim().toLocaleLowerCase();
    const amount = getTransactionExpenseImpact(tx);
    if (key && variableBudgetMap.has(key)) usedByBudgetKey[key] = round2((usedByBudgetKey[key]||0) + amount);
    else unassignedUsed = round2(unassignedUsed + amount);
  });
  const variableRows = Array.from(variableBudgetMap.entries()).map(([key,row])=>{
    const used = usedByBudgetKey[key] || 0;
    const ratio = row.budget > 0 ? Math.min(1, used / row.budget) : 0;
    return `<button type="button" class="budget-preview-item budget-preview-button" data-open-budget-transactions="${textSafe(row.label)}" data-budget-owner="gezamenlijk" aria-label="Open transacties voor ${textSafe(row.label)}">
      <div class="budget-preview-thumb tone-green">${iconSvg(categoryIconName(row.label))}</div>
      <div class="budget-preview-main">
        <div class="budget-preview-top"><strong>${textSafe(row.label)}</strong><span><span class="neutral-amount">${eur(used)}</span> / <span class="neutral-amount">${eur(row.budget)}</span></span></div>
        <div class="progress-track budget-gradient"><div class="progress-fill budget-gradient" style="width:${Math.round(ratio*100)}%"></div></div>
      </div>
    </button>`;
  });
  if (unassignedUsed > 0){
    variableRows.push(`<button type="button" class="budget-preview-item budget-preview-button joint-variable-unassigned" data-open-budget-transactions="Ongecategoriseerd" data-budget-owner="gezamenlijk">
      <div class="budget-preview-thumb">${iconSvg('more')}</div>
      <div class="budget-preview-main">
        <div class="budget-preview-top"><strong>Ongecategoriseerd</strong><span class="neutral-amount">${eur(unassignedUsed)}</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:100%"></div></div>
      </div>
    </button>`);
  }
  const vasteByCat = {};
  (scenarioData.gezamenlijk.vasteLasten||[]).forEach(row=>{
    const cat = normalizeCategoryName(row.categorie);
    vasteByCat[cat] = round2((vasteByCat[cat]||0) + effectiveBedrag(row));
  });
  const vasteEntriesSorted = Object.entries(vasteByCat).sort((a,b)=>b[1]-a[1]);
  const vasteRows = vasteEntriesSorted.map(([cat, amount])=>{
    const ratio = r.overigeVasteLastenTotaal > 0 ? amount / r.overigeVasteLastenTotaal : 0;
    return `<div class="progress-item">
      <div class="progress-item-icon tone-green">${iconSvg(jointFixedCategoryIconName(cat))}</div><div class="progress-top"><strong>${cat}</strong><span>${eur(amount)} · ${pct(ratio)}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round(ratio*100)}%"></div></div>
    </div>`;
  }).join('');
  return `<div class="mobile-kpi-grid v4-mobile-only-grid joint-first-row" aria-label="Gezamenlijk rij 1">
    <div class="mobile-kpi-card joint-kpi-card joint-total-income-card">
      <div class="mobile-kpi-top">
        <span class="mobile-kpi-icon tone-green">${iconSvg('jointfund')}</span>
      </div>
      <div class="mobile-kpi-label">Totaal gezamenlijk inkomen</div>
      <div class="mobile-kpi-value value pos">${eur(r.totaalSalaris)}</div>
      <div class="mobile-kpi-edit-hint-placeholder" aria-hidden="true">.</div>
    </div>
    <div class="mobile-kpi-card joint-kpi-card joint-fixed-costs-card">
      <div class="mobile-kpi-top">
        <span class="mobile-kpi-icon tone-green">${iconSvg('wallet')}</span>
      </div>
      <div class="mobile-kpi-label">Vaste lasten totaal</div>
      <div class="mobile-kpi-value value neg">${eur(r.vasteLastenTotaal)}</div>
      <div class="mobile-kpi-edit-hint-placeholder" aria-hidden="true">.</div>
    </div>
    <button type="button" class="mobile-kpi-card joint-kpi-card joint-saving-card" data-saving-edit>
      <div class="mobile-kpi-top">
        <span class="mobile-kpi-icon tone-green">${iconSvg('target')}</span>
        <span class="mobile-kpi-chevron">›</span>
      </div>
      <div class="mobile-kpi-label">Sparen</div>
      <div class="mobile-kpi-value value pos">${eur(r.spaarpotDezeMaand)}</div>
      <div class="mobile-kpi-edit-hint">${finizeIconWrap('edit')}<span>Tik om aan te passen</span></div>
    </button>
    <div class="mobile-kpi-card joint-kpi-card static joint-variable-card">
      <div class="mobile-kpi-top">
        <span class="mobile-kpi-icon tone-green">${iconSvg('chart')}</span>
      </div>
      <div class="mobile-kpi-label">Variabel gebruikt</div>
      <div class="mobile-kpi-value mobile-kpi-value-budget neu">${eur(r.variabelTotaal)} / ${eur(r.variabelBudgetTotaal)}</div>
      <div class="mobile-kpi-budget-track" style="--used-pct:${variabelBudgetPct}%" aria-label="Gezamenlijk variabel budget gebruikt: ${variabelBudgetPct}%"></div>
    </div>
  </div>
  <div class="card joint-fullwidth-card joint-fixed-category-card v4-mobile-only-block" aria-label="Gezamenlijk vaste lasten per categorie">
    ${renderJointFixedCostsCardHead()}
    <div class="joint-fixed-category-body">${vasteRows || '<p class="hint">Nog geen vaste lasten.</p>'}</div>
  </div>
  <div class="joint-two-column-row v4-mobile-only-grid" aria-label="Gezamenlijk rij 2">
    <div class="card joint-two-column-card joint-variable-overview-card">${renderJointVariableCostsCardHead()}<div class="joint-variable-overview-list">${variableRows.join('') || '<p class="hint" style="margin:0">Nog geen variabele budgetten.</p>'}</div></div>
    ${renderJointTransactionsCard()}
  </div>
  ${renderJointSavingsOverviewCard()}`;
}

function renderPersonalTransactionsCard(owner){
  const name = ownerLabel(owner);
  const rows = getMonthTransactions(owner).filter(isBudgetExpenseTransaction).sort((a,b)=>String(b.date || '').localeCompare(String(a.date || '')));
  const rowsHtml = rows.map(tx=>`<div class="joint-transaction-row" data-edit-personal-transaction="${tx.id}" data-owner="${owner}" role="button" tabindex="0" aria-label="Transactie bewerken">
    <span class="joint-transaction-meta"><span class="joint-transaction-date">${formatDayMonth(tx.date)}</span><span class="joint-transaction-category">${textSafe(tx.category || 'Overig')}</span></span>
    <span class="joint-transaction-description"><span class="joint-transaction-description-text">${textSafe(tx.description || '—')}</span>${tx.note ? `<span class="joint-transaction-note">${textSafe(tx.note)}</span>` : ''}</span>
    <strong class="joint-transaction-amount">${eur(Number(tx.amount) || 0)}</strong>
    <button type="button" class="joint-transaction-delete" data-remove-transaction="${tx.id}" aria-label="Transactie verwijderen">×</button>
  </div>`).join('');
  const total = round2(rows.reduce((sum, tx)=>sum + getTransactionExpenseImpact(tx), 0));
  return `<div class="card joint-two-column-card joint-transactions-card"><div class="card-head joint-transactions-card-head"><div class="card-head-title"><h2>${name} transacties <span>— ${monthLabel(getSelectedMonth())}</span></h2><button type="button" class="joint-transaction-add-btn" data-open-personal-transaction="${owner}" aria-label="Uitgave toevoegen">${iconSvg('receipt')}</button></div></div><div class="joint-transactions-list">${rowsHtml || '<p class="joint-transactions-empty">Nog geen uitgaven deze maand.</p>'}</div><div class="joint-transactions-total"><span>Totaal uitgaven</span><strong>${eur(total)}</strong></div></div>`;
}

function openPersonalTransactionModal(owner, transactionId=''){
  const modal = document.getElementById('transactionModal');
  const today = getSelectedMonth() + '-' + String(new Date().getDate()).padStart(2,'0');
  const existing = (state.transactions || []).find(tx=>tx.id === transactionId && tx.owner === owner);
  const categories = jointVariableCategoryOptions(existing?.category || '', owner);
  const selected = existing?.category || categories[0] || 'Overig';
  const name = ownerLabel(owner);
  modal.innerHTML = `<div class="modal joint-transaction-fullscreen-editor"><div class="card-head"><h2>${existing ? `${name} uitgave bewerken` : `${name} uitgave`}</h2><button class="danger-ghost" id="btnClosePersonalTransaction">×</button></div><p class="hint" style="margin-top:-4px">${monthLabel(getSelectedMonth())} · wordt gekoppeld aan ${name}s variabele lasten</p><div class="modal-grid"><label>Bedrag<input id="personalTxAmount" type="number" step="0.01" inputmode="decimal" value="${existing ? Number(existing.amount)||'' : ''}"></label><label>Datum<input id="personalTxDate" type="date" value="${textSafe(existing?.date || today)}"></label><label class="full">Omschrijving<input id="personalTxDescription" type="text" value="${textSafe(existing?.description || '')}"></label><label>Categorie<select id="personalTxCategory">${categories.map(category=>`<option value="${textSafe(category)}" ${String(category).toLowerCase()===String(selected).toLowerCase()?'selected':''}>${textSafe(category)}</option>`).join('')}</select></label><label>Eigenaar<select id="personalTxOwner"><option value="gezamenlijk">Gezamenlijk</option><option value="dion">Dion</option><option value="dara">Dara</option></select></label><label class="full">Notitie<input id="personalTxNote" type="text" value="${textSafe(existing?.note || '')}"></label></div><div class="modal-actions"><button class="ghost" id="btnCancelPersonalTransaction">Annuleren</button><button class="primary" id="btnSavePersonalTransaction">${existing?'Wijzigingen opslaan':'Uitgave opslaan'}</button></div></div>`;
  modal.classList.add('open','joint-transaction-modal-open');
  const close=()=>modal.classList.remove('open','joint-transaction-modal-open');
  document.getElementById('personalTxOwner').value = existing?.owner || owner;
  document.getElementById('btnClosePersonalTransaction').addEventListener('click',close); document.getElementById('btnCancelPersonalTransaction').addEventListener('click',close);
  document.getElementById('btnSavePersonalTransaction').addEventListener('click',()=>{ const button=document.getElementById('btnSavePersonalTransaction'); if(button.disabled)return; const amount=bankAmount(document.getElementById('personalTxAmount').value); if(!Number.isFinite(amount)||amount<=0){alert('Vul een geldig bedrag in.');return;} const next={id:existing?.id||uid(),date:document.getElementById('personalTxDate').value||today,owner:document.getElementById('personalTxOwner').value,category:document.getElementById('personalTxCategory').value,description:document.getElementById('personalTxDescription').value.trim(),amount:round2(amount),note:document.getElementById('personalTxNote').value.trim(),kind:'uitgave'}; try{assertMonthMutationAllowed(transactionMonth(next));}catch(error){alert(error.message);return;} button.disabled=true; if(!commitChange(()=>{if(existing)updateItemById('transactions',existing.id,next);else state.transactions.push(next);},{render:false})){button.disabled=false;return;} close(); renderActiveTab(); });
}

function renderPersonalFirstRow(owner){
  const r = calcScenario(state);
  const person = r[owner];
  const data = getMonthlyScenarioData(state.meta.scenario)[owner];
  const name = ownerLabel(owner);
  const budgets = new Map();
  (data.variabel || []).forEach(row=>{ const label=String(row.post || row.categorie || '').trim(); if(label) budgets.set(label.toLocaleLowerCase(),{label,budget:Number(row.bedrag)||0}); });
  const used = {};
  let uncategorized = 0;
  getMonthTransactions(owner).forEach(tx=>{ const key=String(tx.category||'').trim().toLocaleLowerCase(); const impact=getTransactionExpenseImpact(tx); if (budgets.has(key)) used[key]=round2((used[key]||0)+impact); else uncategorized=round2(uncategorized+impact); });
  const variableRows = [...budgets.entries()].map(([key,row])=>{ const amount=used[key]||0; const ratio=row.budget>0?Math.min(1,amount/row.budget):0; return `<button type="button" class="budget-preview-item budget-preview-button" data-open-budget-transactions="${textSafe(row.label)}" data-budget-owner="${owner}" aria-label="Open transacties voor ${textSafe(row.label)}"><div class="budget-preview-thumb tone-green">${iconSvg(categoryIconName(row.label))}</div><div class="budget-preview-main"><div class="budget-preview-top"><strong>${textSafe(row.label)}</strong><span>${eur(amount)} / ${eur(row.budget)}</span></div><div class="progress-track budget-gradient"><div class="progress-fill budget-gradient" style="width:${Math.round(ratio*100)}%"></div></div></div></button>`; });
  if (uncategorized>0) variableRows.push(`<button type="button" class="budget-preview-item budget-preview-button joint-variable-unassigned" data-open-budget-transactions="Ongecategoriseerd" data-budget-owner="${owner}"><div class="budget-preview-thumb">${iconSvg('more')}</div><div class="budget-preview-main"><div class="budget-preview-top"><strong>Ongecategoriseerd</strong><span>${eur(uncategorized)}</span></div><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div></div></button>`);
  const fixed={}; (data.vasteLasten||[]).forEach(row=>{ const cat=normalizeCategoryName(row.categorie); fixed[cat]=round2((fixed[cat]||0)+effectiveBedrag(row)); });
  const fixedRows=Object.entries(fixed).sort((a,b)=>b[1]-a[1]).map(([cat,amount])=>{ const ratio=person.persoonlijkeVasteLasten>0?amount/person.persoonlijkeVasteLasten:0; return `<div class="progress-item"><div class="progress-item-icon tone-green">${iconSvg(jointFixedCategoryIconName(cat))}</div><div class="progress-top"><strong>${cat}</strong><span>${eur(amount)} · ${pct(ratio)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(ratio*100)}%"></div></div></div>`; }).join('');
  const variableBudget=sumBedrag(data.variabel||[]); const variablePct=variableBudget>0?Math.min(100,Math.round((person.variabeleUitgaven/variableBudget)*100)):0;
  return `<div class="mobile-kpi-grid v4-mobile-only-grid joint-first-row" aria-label="${name} rij 1">
    <div class="mobile-kpi-card joint-kpi-card joint-total-income-card"><div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-green">${iconSvg('allowance')}</span></div><div class="mobile-kpi-label">Zakgeld</div><div class="mobile-kpi-value ${person.zakgeld<0?'value neg':'value pos'}">${eur(person.zakgeld)}</div><div class="mobile-kpi-edit-hint-placeholder">.</div></div>
    <div class="mobile-kpi-card joint-kpi-card joint-fixed-costs-card"><div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-green">${iconSvg('wallet')}</span></div><div class="mobile-kpi-label">Vaste lasten</div><div class="mobile-kpi-value value neg">${eur(person.persoonlijkeVasteLasten)}</div><div class="mobile-kpi-edit-hint-placeholder">.</div></div>
    <div class="mobile-kpi-card joint-kpi-card joint-saving-card"><div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-green">${iconSvg('piggy')}</span></div><div class="mobile-kpi-label">Sparen deze maand</div><div class="mobile-kpi-value ${person.beschikbaarVoorSparen<0?'value neg':'value pos'}">${eur(person.beschikbaarVoorSparen)}</div><div class="mobile-kpi-edit-hint-placeholder">.</div></div>
    <div class="mobile-kpi-card joint-kpi-card static joint-variable-card"><div class="mobile-kpi-top"><span class="mobile-kpi-icon tone-green">${iconSvg('chart')}</span></div><div class="mobile-kpi-label">Variabel gebruikt</div><div class="mobile-kpi-value mobile-kpi-value-budget neu">${eur(person.variabeleUitgaven)} / ${eur(variableBudget)}</div><div class="mobile-kpi-budget-track" style="--used-pct:${variablePct}%"></div></div>
  </div>
  <div class="card joint-fullwidth-card joint-fixed-category-card v4-mobile-only-block">${renderJointFixedCostsCardHead(owner)}<div class="joint-fixed-category-body">${fixedRows || '<p class="hint">Nog geen vaste lasten.</p>'}</div></div>
  <div class="joint-two-column-row v4-mobile-only-grid"><div class="card joint-two-column-card joint-variable-overview-card">${renderJointVariableCostsCardHead(owner)}<div class="joint-variable-overview-list">${variableRows.join('') || '<p class="hint" style="margin:0">Nog geen variabele budgetten.</p>'}</div></div>${renderPersonalTransactionsCard(owner)}</div>
  ${renderJointSavingsOverviewCard(owner, person.beschikbaarVoorSparen)}`;
}

function renderEmptyVisualTab(tabId, title){
  const el = document.getElementById(tabId);
  if (!el) return;
  const owner = tabId.replace('tab-','');
  const content = owner === 'gezamenlijk' ? renderJointFirstRow() : (['dion','dara'].includes(owner) ? renderPersonalFirstRow(owner) : '');
  el.innerHTML = renderSharedEmptyTabHeader(title || '') + content;
}


/* ---------- routing / init ---------- */
function updateV4SidebarMeta(){
  const monthEl = document.getElementById('v4SidebarMonth');
  const scenarioEl = document.getElementById('v4SidebarScenario');
  if (monthEl) monthEl.textContent = monthLabel(getSelectedMonth());
  if (scenarioEl) scenarioEl.textContent = (state.meta.scenario === 'voor' ? 'Voor verkoop' : 'Na verkoop') + ' scenario';
}


function parkMonthControlBeforeRender(){
  const control = document.getElementById('monthControl');
  const home = document.getElementById('topActionsHome');
  if (control && home && control.parentNode !== home){
    home.insertBefore(control, home.firstChild);
  }
}

function openBudgetTransactionsModal(category,owner='gezamenlijk'){
  const modal=document.getElementById('transactionModal');
  const month=getSelectedMonth();
  const rows=getMonthTransactions(owner,month)
    .filter(tx=>budgetCategoryMatches(tx,category) && Math.abs(getTransactionExpenseImpact(tx))>.004)
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const total=round2(rows.reduce((sum,tx)=>sum+getTransactionExpenseImpact(tx),0));
  modal.innerHTML=`<div class="modal budget-transactions-modal"><div class="modal-head"><div><h2>${textSafe(category)}</h2><p>${monthLabel(month)} · ${rows.length} transactie${rows.length===1?'':'s'} · ${eur(total)}</p></div><button type="button" class="ghost" data-close-budget-transactions>Sluiten</button></div><div class="budget-transactions-list">${rows.length?rows.map(tx=>`<button type="button" class="budget-transaction-row" data-open-budget-transaction-id="${textSafe(tx.id)}"><span><strong>${textSafe(tx.description||tx.category||'Transactie')}</strong><small>${formatDateNL(tx.date)} · ${textSafe(tx.category||'Overig')}</small></span><b class="${getTransactionExpenseImpact(tx)<0?'value pos':'value neg'}">${eur(getTransactionExpenseImpact(tx))}</b></button>`).join(''):'<p class="muted-empty">Geen budgettransacties in deze categorie.</p>'}</div></div>`;
  modal.classList.add('open');
  const close=()=>{modal.classList.remove('open');modal.innerHTML='';};
  modal.querySelector('[data-close-budget-transactions]')?.addEventListener('click',close);
  bindModalBackdrop(modal,close);
  modal.querySelectorAll('[data-open-budget-transaction-id]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.openBudgetTransactionId;close();owner==='gezamenlijk'?openJointTransactionModal(id):openPersonalTransactionModal(owner,id);}));
}
function renderActiveTab(){
  ensureMonthData(getSelectedMonth());
  renderMonthSelect();
  updateV4SidebarMeta();
  document.body.dataset.activeTab = activeTab;
  document.querySelectorAll('.tab-btn').forEach(b=> b.classList.toggle('active', b.dataset.tab===activeTab));
  document.querySelectorAll('.wrap').forEach(w=> w.classList.toggle('active', w.id === 'tab-'+activeTab));

  parkMonthControlBeforeRender();

  if (activeTab==='dashboard') renderDashboard();
  else if (activeTab==='gezamenlijk') window.innerWidth >= 768 ? renderPersonOrJoint('tab-gezamenlijk','gezamenlijk','Gezamenlijk') : renderEmptyVisualTab('tab-gezamenlijk', 'Gezamenlijk');
  else if (activeTab==='dion') window.innerWidth >= 768 ? renderPersonOrJoint('tab-dion','dion','Dion') : renderEmptyVisualTab('tab-dion', 'Dion');
  else if (activeTab==='dara') window.innerWidth >= 768 ? renderPersonOrJoint('tab-dara','dara','Dara') : renderEmptyVisualTab('tab-dara', 'Dara');
  else if (activeTab==='spaardoelen') window.innerWidth >= 768 && window.FinizeUpdate5?.renderGoals ? window.FinizeUpdate5.renderGoals() : renderMobileSpaardoelen();
  else if (activeTab==='data') window.innerWidth >= 768 && window.FinizeUpdate5?.renderData ? window.FinizeUpdate5.renderData() : renderMobileDataTab();

  if (['gezamenlijk','dion','dara','spaardoelen','data'].includes(activeTab)){
    document.body.dataset.activeTab = 'dashboard';
    document.body.dataset.realActiveTab = ['gezamenlijk','dion','dara'].includes(activeTab) ? 'gezamenlijk' : activeTab;
  } else {
    document.body.dataset.realActiveTab = activeTab;
  }

  document.querySelectorAll('.scenario-toggle button[data-scenario]').forEach(b=> b.classList.toggle('active', b.dataset.scenario===state.meta.scenario));

  const root = document.getElementById('tab-'+activeTab);
  bindInputs(root);
  handleTableClicks(root);
  handleGoalClicks(root);
  bindU3Admin(root);
  if (activeTab === 'dashboard'){
    bindDashboardAccordionKeyboard(root);
    bindBankImport(root);
  }
  root.querySelectorAll('[data-tab-shortcut]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeTab = btn.dataset.tabShortcut;
      renderActiveTab();
    });
  });
  root.querySelectorAll('[data-income-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openIncomeEditModal(btn.dataset.incomeEdit, btn.dataset.incomeLabel);
    });
  });
  root.querySelectorAll('[data-open-total-income]').forEach(btn=>{
    btn.addEventListener('click', openTotalIncomeEditModal);
  });
  root.querySelectorAll('[data-open-budget-transactions]').forEach(btn=>{
    btn.addEventListener('click',()=>openBudgetTransactionsModal(btn.dataset.openBudgetTransactions,btn.dataset.budgetOwner||'gezamenlijk'));
  });
  root.querySelectorAll('[data-open-goal-editor]').forEach(btn=>{
    btn.addEventListener('click',()=>{ const [owner,id]=btn.dataset.openGoalEditor.split(':'); openMobileGoalEditor(owner,id); });
  });
  root.querySelectorAll('[data-open-goal-manager]').forEach(btn=>{
    btn.addEventListener('click',()=>openMobileGoalManager(btn.dataset.openGoalManager));
  });
  root.querySelectorAll('.mobile-savings-overview .manage-section').forEach((section,index)=>{
    section.querySelector('summary')?.addEventListener('click',event=>{
      event.preventDefault();
      openMobileGoalManager(['gezamenlijk','dion','dara'][index]);
    });
  });
  root.querySelectorAll('[data-saving-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openSavingEditModal();
    });
  });
  root.querySelectorAll('[data-open-owner-fixed]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openJointFixedCostsModal(false, btn.dataset.openOwnerFixed);
    });
  });
  root.querySelectorAll('[data-open-owner-variable]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openJointVariableCostsModal(false, btn.dataset.openOwnerVariable);
    });
  });
  root.querySelectorAll('[data-open-joint-transaction]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      openJointTransactionModal();
    });
  });
  root.querySelectorAll('[data-open-personal-transaction]').forEach(btn=>{
    btn.addEventListener('click', ()=>openPersonalTransactionModal(btn.dataset.openPersonalTransaction));
  });
  root.querySelectorAll('[data-edit-personal-transaction]').forEach(row=>{
    const openEditor = event=>{ if (!event?.target.closest('button')) openPersonalTransactionModal(row.dataset.owner, row.dataset.editPersonalTransaction); };
    row.addEventListener('click', openEditor);
    row.addEventListener('keydown', event=>{ if (event.key === 'Enter' || event.key === ' '){ event.preventDefault(); openEditor(event); } });
  });
  root.querySelectorAll('[data-edit-joint-transaction]').forEach(row=>{
    const openEditor = event=>{
      if (event?.target.closest('button')) return;
      openJointTransactionModal(row.dataset.editJointTransaction);
    };
    row.addEventListener('click', openEditor);
    row.addEventListener('keydown', event=>{
      if (event.key === 'Enter' || event.key === ' '){
        event.preventDefault();
        openEditor(event);
      }
    });
  });
  root.querySelectorAll('[data-copy-previous-mobile]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if (copyPreviousMonth()){
        persist();
        renderActiveTab();
      }
    });
  });
  renderCloudStatus();
  placeMonthControl();
  placeDesktopPageHeading(root);
  window.FinizeUpdate5?.markNegativeValues(root);
}

function placeMonthControl(){
  const control = document.getElementById('monthControl');
  const home = document.getElementById('topActionsHome');
  if (!control || !home) return;

  const activeRoot = document.getElementById('tab-' + activeTab);
  const slot = activeRoot ? activeRoot.querySelector('#mobileMonthSlot') : null;
  const wantMobile = slot && window.innerWidth <= 767;

  if (wantMobile && control.parentNode !== slot){
    slot.appendChild(control);
  } else if (!wantMobile && control.parentNode !== home){
    home.insertBefore(control, home.firstChild);
  }
}
function placeDesktopPageHeading(root=document.getElementById('tab-' + activeTab)){
  const topbar = document.querySelector('.v4-main-topbar');
  if (!topbar) return;
  const parkedHeadings = [...topbar.querySelectorAll(':scope > .v4-dashboard-heading, :scope > .page-heading')];
  const activeRoot = root?.id === 'tab-' + activeTab ? root : document.getElementById('tab-' + activeTab);
  const rootHeading = activeRoot?.querySelector(':scope > .v4-dashboard-heading, :scope > .page-heading');
  const matchingParked = parkedHeadings.find(heading=>heading.dataset.headingOwner === activeTab);
  const heading = rootHeading || matchingParked;
  if (!heading || !activeRoot){
    parkedHeadings.forEach(item=>item.remove());
    return;
  }
  if (window.innerWidth >= 1024){
    parkedHeadings.forEach(item=>{ if(item !== heading)item.remove(); });
    heading.dataset.headingOwner = activeTab;
    if (heading.parentNode !== topbar) topbar.insertBefore(heading, topbar.firstChild);
  }else if (heading.parentNode !== activeRoot){
    const firstDesktopContent = activeRoot.querySelector('.u5-primary-kpis, .overview-kpi-row, .dashboard-grid, .u5-data-sections');
    activeRoot.insertBefore(heading, firstDesktopContent || activeRoot.firstChild);
    delete heading.dataset.headingOwner;
  }
}
function rescueMonthControl(){
  const control = document.getElementById('monthControl');
  const home = document.getElementById('topActionsHome');
  if (!control || !home) return;
  if (window.innerWidth > 767 && control.parentNode !== home){
    home.insertBefore(control, home.firstChild);
  }
}
window.addEventListener('resize', ()=>{
  placeMonthControl();
  placeDesktopPageHeading();
});

document.getElementById('bottomNav').addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  renderActiveTab();
});

document.getElementById('tabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  renderActiveTab();
});
document.getElementById('saveStatus').addEventListener('click', ()=>{
  activeTab = 'data';
  renderActiveTab();
});
document.body.addEventListener('click', (e)=>{
  const btn = e.target.closest('.scenario-toggle button[data-scenario]');
  if (!btn) return;
  state.meta.scenario = btn.dataset.scenario;
  persist();
  renderActiveTab();
});
document.getElementById('monthPickerButton').addEventListener('click', (e)=>{
  e.stopPropagation();
  const control = document.getElementById('monthControl');
  if (control.classList.contains('open')) closeMonthPicker();
  else openMonthPicker();
});
document.getElementById('monthPickerPanel').addEventListener('click', (e)=>{
  const copyBtn = e.target.closest('[data-month-copy-previous]');
  if (copyBtn){
    e.stopPropagation();
    if (copyPreviousMonth()){
      persist();
      closeMonthPicker();
      renderActiveTab();
    }
    return;
  }
  const yearBtn = e.target.closest('[data-month-year]');
  if (yearBtn){
    const currentMonth = getSelectedMonth().slice(5,7);
    setSelectedMonth(yearBtn.dataset.monthYear + '-' + currentMonth);
    persist();
    renderActiveTab();
    openMonthPicker();
    return;
  }
  const monthBtn = e.target.closest('[data-month-value]');
  if (monthBtn){
    setSelectedMonth(monthBtn.dataset.monthValue);
    persist();
    closeMonthPicker();
    renderActiveTab();
  }
});
document.addEventListener('click', (e)=>{
  if (!document.getElementById('monthControl')?.contains(e.target)) closeMonthPicker();
});
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') closeMonthPicker();
});
/* ---------- Update 2: slimme spaardoelenplanner ---------- */
const U2_SCHEMA_VERSION = 4;
const U2_OWNERS = ['gezamenlijk','dion','dara'];

function u2GoalTarget(goal){
  const children = Array.isArray(goal?.subdoelen) ? goal.subdoelen : [];
  return round2(children.length
    ? children.reduce((sum, child)=>sum + Math.max(0, Number(child.doelbedrag)||0), 0)
    : Math.max(0, Number(goal?.doelbedrag)||0));
}
function u2GoalSaved(goal){
  const children = Array.isArray(goal?.subdoelen) ? goal.subdoelen : [];
  return round2(children.length
    ? children.reduce((sum, child)=>sum + Math.max(0, Number(child.gespaard)||0), 0)
    : Math.max(0, Number(goal?.algespaard)||0));
}
function u2NormalizeChildren(goal){
  const children = Array.isArray(goal.subdoelen) ? goal.subdoelen.filter(isPlainObject) : [];
  let remaining = Math.max(0, Number(goal.algespaard)||0);
  goal.subdoelen = children.map((child, index)=>{
    const target = Math.max(0, Number(child.doelbedrag)||0);
    const existing = Number(child.gespaard);
    const saved = Number.isFinite(existing) ? Math.min(target, Math.max(0, existing)) : Math.min(target, remaining);
    remaining = Math.max(0, remaining - saved);
    return {
      id: child.id || uid(),
      naam: String(child.naam || `Subdoel ${index+1}`),
      doelbedrag: round2(target),
      gespaard: round2(saved),
      link: String(child.link || ''),
      volgorde: index,
      voltooid: saved >= target && target > 0
    };
  });
  if (goal.subdoelen.length){
    goal.doelbedrag = u2GoalTarget(goal);
    goal.algespaard = u2GoalSaved(goal);
  }
}
function u2NormalizeState(target, fromVersion=Number(target?.meta?.schemaVersion)||1){
  target.spaardoelGeschiedenis = isPlainObject(target.spaardoelGeschiedenis) ? target.spaardoelGeschiedenis : {};
  U2_OWNERS.forEach(owner=>{
    target.spaardoelen = isPlainObject(target.spaardoelen) ? target.spaardoelen : {};
    target.spaardoelen[owner] = Array.isArray(target.spaardoelen[owner]) ? target.spaardoelen[owner] : [];
    target.spaardoelen[owner].forEach(goal=>{
      goal.eigenaar = owner;
      if (goal.ratoVerdeling === undefined) goal.ratoVerdeling = !goal.vastBedrag;
      goal.ratoVerdeling = !!goal.ratoVerdeling;
      goal.vasteInleg = Math.max(0, Number(goal.vasteInleg)||0);
      goal.subdoelen = Array.isArray(goal.subdoelen) ? goal.subdoelen : [];
      u2NormalizeChildren(goal);
    });
  });
  target.meta.schemaVersion = Math.max(Number(target.meta.schemaVersion)||1,U2_SCHEMA_VERSION);
  return target;
}
function u2MonthHistory(owner){
  return Object.values(state.spaardoelGeschiedenis || {})
    .filter(entry=>entry?.eigenaar === owner && Array.isArray(entry.transacties))
    .sort((a,b)=>String(b.maand).localeCompare(String(a.maand)));
}
function u2AverageContribution(goal){
  const rows = u2MonthHistory(goal.eigenaar).slice(0,6);
  if (!rows.length) return null;
  const total = rows.reduce((sum, entry)=>{
    const transaction = entry.transacties.find(tx=>tx.doelId === goal.id);
    return sum + (Number(transaction?.bedrag)||0);
  },0);
  return round2(total / rows.length);
}
function u2ExpectedDate(goal, monthly){
  const target = u2GoalTarget(goal);
  let balance = u2GoalSaved(goal);
  if (target <= balance) return new Date();
  if (!(monthly > 0)) return null;
  const rate = monthlyRateFromGoal(goal);
  const reference=getCalculationDateForSelectedMonth(getSelectedMonth(),goal.eigenaar||'gezamenlijk');
  const date = new Date(reference.getFullYear(), reference.getMonth(), 1);
  for (let month=1; month<=1200; month++){
    balance = balance * (1 + rate) + monthly;
    date.setMonth(date.getMonth()+1);
    if (balance + .005 >= target) return new Date(date);
  }
  return null;
}
function u2DateLabel(date){
  return date instanceof Date && !isNaN(date)
    ? date.toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'})
    : 'Niet berekenbaar';
}
function u2Status(item){
  if (item.nogTeGaan <= 0) return {key:'voltooid', label:'Voltooid'};
  if (!(item.benodigdPerMaand > 0)) return {key:'geen-datum', label:'Doeldatum nodig'};
  const ratio = (Number(item.gemiddeldeInleg)||0) / item.benodigdPerMaand;
  if (ratio >= 1) return {key:'op-schema',label:'Op schema'};
  if (ratio >= .8) return {key:'bijna',label:'Bijna op schema'};
  return {key:'achter',label:'Achter op schema'};
}

calcDoel = function(doel, today){
  today=getCalculationDateForSelectedMonth(getSelectedMonth(),doel.eigenaar||'gezamenlijk');
  const doelbedrag = u2GoalTarget(doel);
  const algespaard = u2GoalSaved(doel);
  const vasteInleg = Math.max(0, Number(doel.vasteInleg)||0);
  const rendement = monthlyRateFromGoal(doel);
  const nogTeGaan = Math.max(0, round2(doelbedrag - algespaard));
  const voortgang = doelbedrag>0 ? Math.min(1, algespaard/doelbedrag) : 0;
  const months = monthsRemaining(doel.doeldatum, today);
  let benodigdeExtraInleg = null;
  let benodigdPerMaand = null;
  let verwachteWaarde = null;
  if (months !== null && months > 0 && doelbedrag > 0){
    const fv = futureValue(algespaard, vasteInleg, rendement, months);
    verwachteWaarde = round2(fv);
    const tekort = doelbedrag - fv;
    if (!rendement) benodigdeExtraInleg = round2(Math.max(0, tekort/months));
    else{
      const annuiteit = (Math.pow(1+rendement,months)-1)/rendement;
      benodigdeExtraInleg = round2(Math.max(0, tekort/annuiteit));
    }
    benodigdPerMaand = round2(vasteInleg + benodigdeExtraInleg);
  }else if(months===0){benodigdeExtraInleg=0;benodigdPerMaand=0;verwachteWaarde=round2(algespaard);}
  const historieGemiddelde = u2AverageContribution(doel);
  const gemiddeldeInleg = historieGemiddelde === null ? vasteInleg : historieGemiddelde;
  const verwachteEinddatum = u2ExpectedDate(doel, gemiddeldeInleg);
  const result = {nogTeGaan,voortgang,benodigdPerMaand,benodigdeExtraInleg,verwachteWaarde,months,gemiddeldeInleg,verwachteEinddatum,historieGemiddelde};
  result.status = u2Status(result);
  return result;
};

function u2DistributeCents(totalCents, candidates, capacities){
  const output = new Map(candidates.map(item=>[item.index,0]));
  let remaining = Math.max(0,totalCents);
  let active = candidates.filter(item=>item.weight>0 && capacities[item.index]>0);
  while (remaining>0 && active.length){
    const totalWeight = active.reduce((sum,item)=>sum+item.weight,0);
    if (!(totalWeight>0)) break;
    const capped = active.filter(item=>remaining*(item.weight/totalWeight)>=capacities[item.index]-output.get(item.index));
    if (capped.length){
      const cappedIds = new Set();
      capped.forEach(item=>{
        const room = capacities[item.index]-output.get(item.index);
        output.set(item.index,output.get(item.index)+room);
        remaining -= room;
        cappedIds.add(item.index);
      });
      active = active.filter(item=>!cappedIds.has(item.index));
      continue;
    }
    const shares = active.map(item=>{
      const raw=remaining*(item.weight/totalWeight);
      return {...item,cents:Math.floor(raw),fraction:raw-Math.floor(raw)};
    });
    let assigned=shares.reduce((sum,item)=>sum+item.cents,0);
    shares.sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
    for(let cent=0;cent<remaining-assigned;cent++) shares[cent%shares.length].cents++;
    shares.forEach(item=>output.set(item.index,output.get(item.index)+item.cents));
    remaining=0;
  }
  return {output,remaining};
}
calcGroep = function(doelen, spaarpotDezeMaand, today){
  const berekend = doelen.map(d=>{
    if (Array.isArray(d.subdoelen) && d.subdoelen.length){
      d.doelbedrag=u2GoalTarget(d); d.algespaard=u2GoalSaved(d);
    }
    return {doel:d,...calcDoel(d,today)};
  });
  const potCents=Math.max(0,Math.round((Number(spaarpotDezeMaand)||0)*100));
  const capacities=berekend.map(b=>Math.max(0,Math.round(b.nogTeGaan*100)));
  const vasteCents=berekend.map((b,index)=>Math.min(capacities[index],Math.max(0,Math.round((Number(b.doel.vasteInleg)||0)*100))));
  const totaalVasteCents=vasteCents.reduce((sum,value)=>sum+value,0);
  const onvoldoende=potCents<totaalVasteCents;
  const extraCents=berekend.map(()=>0);
  let resterendePotCents=onvoldoende ? potCents : Math.max(0,potCents-totaalVasteCents);
  if (!onvoldoende){
    const candidates=berekend.map((b,index)=>({index,weight:Math.max(0,Number(b.benodigdPerMaand)||0)}))
      .filter(item=>berekend[item.index].doel.ratoVerdeling && item.weight>0 && capacities[item.index]-vasteCents[item.index]>0);
    const rooms=capacities.map((capacity,index)=>Math.max(0,capacity-vasteCents[index]));
    const distributed=u2DistributeCents(resterendePotCents,candidates,rooms);
    distributed.output.forEach((value,index)=>extraCents[index]=value);
    resterendePotCents=distributed.remaining;
  }
  const totalNeeded=round2(berekend.reduce((sum,b)=>sum+(b.benodigdPerMaand||0),0));
  return berekend.map((b,index)=>{
    const result={
      ...b,
      vasteInlegWerkelijk: onvoldoende ? 0 : round2(vasteCents[index]/100),
      berekendeExtraInleg: onvoldoende ? 0 : round2(extraCents[index]/100),
      werkelijkeInleg: onvoldoende ? 0 : round2((vasteCents[index]+extraCents[index])/100),
      totaalVasteInleg:round2(totaalVasteCents/100),
      totaalBenodigd:totalNeeded,
      totaalExtraBenodigd:round2(Math.max(0,totalNeeded-totaalVasteCents/100)),
      spaarpotDezeMaand:round2(potCents/100),
      extraPot:round2(Math.max(0,potCents-totaalVasteCents)/100),
      onverdeeld:round2(resterendePotCents/100),
      onvoldoendeVasteInleg:onvoldoende
    };
    if (result.historieGemiddelde===null){
      result.gemiddeldeInleg=result.werkelijkeInleg;
      result.verwachteEinddatum=u2ExpectedDate(result.doel,result.gemiddeldeInleg);
      result.status=u2Status(result);
    }
    return result;
  });
};

function u2ActiveChild(goal){
  return (goal.subdoelen||[]).find(child=>!child.voltooid && Number(child.gespaard)<Number(child.doelbedrag)) || null;
}
function u2ApplyContribution(goal, amount){
  let cents=Math.max(0,Math.round(amount*100));
  if (goal.subdoelen?.length){
    goal.subdoelen.forEach(child=>{
      if (cents<=0) return;
      const room=Math.max(0,Math.round((Number(child.doelbedrag)||0)*100)-Math.round((Number(child.gespaard)||0)*100));
      const applied=Math.min(room,cents);
      child.gespaard=round2((Math.round((Number(child.gespaard)||0)*100)+applied)/100);
      child.voltooid=Number(child.doelbedrag)>0 && child.gespaard>=Number(child.doelbedrag);
      cents-=applied;
    });
    goal.doelbedrag=u2GoalTarget(goal);
    goal.algespaard=u2GoalSaved(goal);
  }else{
    goal.algespaard=round2(Math.min(u2GoalTarget(goal),(Number(goal.algespaard)||0)+amount));
  }
  return round2(cents/100);
}
function u2ReconcileSavingsGoals(goalIds=null){
  const runtime=window.FinizeUpdate4Runtime;
  if(runtime?.reconcileGoalSavedAmounts)runtime.reconcileGoalSavedAmounts(state,goalIds);
}
function u2SetGoalSavedAmount(goal,amount,source='manual-correction'){
  state.savingsGoalLedger=Array.isArray(state.savingsGoalLedger)?state.savingsGoalLedger:[];
  u2ReconcileSavingsGoals([goal.id]);
  const current=window.FinizeUpdate4Runtime?.calculateGoalSavedAmount
    ? window.FinizeUpdate4Runtime.calculateGoalSavedAmount(state,goal.id)
    : Number(goal.algespaard)||0;
  const difference=round2(Math.max(0,Number(amount)||0)-current);
  if(Math.abs(difference)<=.004)return;
  const id=`saving-correction-${goal.id}-${uid()}`;
  state.savingsGoalLedger.push({
    id,goalId:goal.id,month:getSelectedMonth(),plannedAmount:0,actualAmount:null,effectiveAmount:difference,
    status:'uitgevoerd',source,transactionId:'',active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  });
  u2ReconcileSavingsGoals([goal.id]);
}
function u2PotForOwner(owner){
  const result=calcScenario(state);
  return Math.max(0,round2(owner==='gezamenlijk' ? result.spaarpotDezeMaand : result[owner].beschikbaarVoorSparen));
}
function u2HistoryKey(owner,month=getSelectedMonth()){ return `${owner}:${month}`; }
function u2IsProcessed(owner,month=getSelectedMonth()){ return !!state.spaardoelGeschiedenis?.[u2HistoryKey(owner,month)]; }
function getCalculationDateForSelectedMonth(selectedMonth=getSelectedMonth(),owner='gezamenlijk'){
  const match=String(selectedMonth||'').match(/^(\d{4})-(\d{2})$/);
  if(!match)return new Date(TODAY.getFullYear(),TODAY.getMonth(),1);
  const record=state.monthRecords?.[selectedMonth];
  const processed=u2IsProcessed(owner,selectedMonth)||['afgesloten','correctie-nodig'].includes(record?.status);
  return new Date(Number(match[1]),Number(match[2])-1+(processed?1:0),1,12);
}
function u2FixedFallback(items,pot){
  const cents=Math.round(pot*100);
  const candidates=items.map((item,index)=>({index,weight:Math.max(0,Number(item.doel.vasteInleg)||0)})).filter(item=>item.weight>0);
  const capacities=items.map(item=>Math.max(0,Math.round(item.nogTeGaan*100)));
  const result=u2DistributeCents(cents,candidates,capacities);
  return items.map((item,index)=>round2((result.output.get(index)||0)/100));
}
function u2OpenProcessModal(owner){
  const month=getSelectedMonth();
  try{assertMonthMutationAllowed(month);}catch(error){alert(error.message);return;}
  if (u2IsProcessed(owner,month)){ alert(`${monthLabel(month)} is voor ${ownerLabel(owner)} al verwerkt.`); return; }
  const goals=state.spaardoelen[owner]||[];
  const pot=u2PotForOwner(owner);
  const items=calcGroep(goals,pot,TODAY);
  if (!goals.length){ alert('Voeg eerst minimaal één spaardoel toe.'); return; }
  let amounts=items.map(item=>item.werkelijkeInleg);
  const insufficient=items.some(item=>item.onvoldoendeVasteInleg);
  const modal=document.getElementById('transactionModal');
  const render=()=>{
    const total=round2(amounts.reduce((sum,value)=>sum+(Number(value)||0),0));
    const rows=items.map((item,index)=>`<label class="u2-process-row"><span><strong>${textSafe(item.doel.naam)}</strong><small>Vast ${eur(Number(item.doel.vasteInleg)||0)} · nodig ${item.benodigdPerMaand===null?'—':eur(item.benodigdPerMaand)}</small></span><input type="number" min="0" max="${item.nogTeGaan}" step="0.01" data-u2-process="${index}" value="${Number(amounts[index]).toFixed(2)}"></label>`).join('');
    modal.innerHTML=`<div class="modal u2-process-modal"><div class="u2-modal-head"><div><div class="section-kicker">${ownerLabel(owner)}</div><h2>Spaarpot ${monthLabel(month)}</h2></div><button class="ghost" data-u2-close>Sluiten</button></div>
      ${insufficient?`<div class="u2-warning"><strong>Onvoldoende spaargeld om alle vaste inleggen uit te voeren.</strong><span>Kies automatische ratoverdeling over de vaste inleggen of pas de bedragen zelf aan.</span><button class="ghost small" data-u2-fixed-ratio>Automatisch naar rato</button></div>`:''}
      <div class="u2-process-list">${rows}</div>
      <div class="u2-process-total"><span>Spaarpot ${eur(pot)}</span><strong data-u2-total>${eur(total)}</strong></div>
      <p class="hint" data-u2-error></p>
      <div class="modal-actions"><button class="ghost" data-u2-close>Annuleren</button><button class="primary" data-u2-confirm>Spaarpot verwerken</button></div></div>`;
    modal.classList.add('open','u2-process-open');
    const refresh=()=>{
      const total=round2(amounts.reduce((sum,value)=>sum+(Number(value)||0),0));
      modal.querySelector('[data-u2-total]').textContent=eur(total);
      const error=modal.querySelector('[data-u2-error]');
      error.textContent=total>pot+.005?'De verdeling is hoger dan de beschikbare spaarpot.':'';
    };
    modal.querySelectorAll('[data-u2-process]').forEach(input=>input.addEventListener('input',()=>{
      amounts[Number(input.dataset.u2Process)]=Math.max(0,round2(bankAmount(input.value)||0)); refresh();
    }));
    modal.querySelectorAll('[data-u2-close]').forEach(btn=>btn.addEventListener('click',()=>{modal.classList.remove('open','u2-process-open');modal.innerHTML='';}));
    modal.querySelector('[data-u2-fixed-ratio]')?.addEventListener('click',()=>{amounts=u2FixedFallback(items,pot);render();});
    modal.querySelector('[data-u2-confirm]').addEventListener('click',()=>{
      const total=round2(amounts.reduce((sum,value)=>sum+(Number(value)||0),0));
      const invalid=amounts.some((value,index)=>value<0 || value>items[index].nogTeGaan+.005);
      if(invalid){modal.querySelector('[data-u2-error]').textContent='Een bedrag is ongeldig of hoger dan de resterende doelruimte.';return;}
      if(total>pot+.005){modal.querySelector('[data-u2-error]').textContent='De verdeling is hoger dan de beschikbare spaarpot.';return;}
      const proposed=items.map(item=>item.werkelijkeInleg);
      const ok=commitChange(()=>{
        if (state.spaardoelGeschiedenis[u2HistoryKey(owner,month)]) throw new Error('Deze maand is al verwerkt.');
        const transactions=goals.map((goal,index)=>{
          const amount=round2(amounts[index]||0);
          const contributionId=`saving-planned-${owner}-${month}-${goal.id}`;
          state.savingsGoalLedger=Array.isArray(state.savingsGoalLedger)?state.savingsGoalLedger:[];
          if(!state.savingsGoalLedger.some(entry=>entry.id===contributionId))state.savingsGoalLedger.push({
            id:contributionId,goalId:goal.id,month,plannedAmount:amount,actualAmount:null,effectiveAmount:amount,
            status:'gepland',source:'planned',transactionId:'',active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
          });
          return {id:uid(),contributionId,type:'spaardoelInleg',doelId:goal.id,doelNaam:goal.naam,bedrag:amount,vasteInleg:Math.min(amount,Number(goal.vasteInleg)||0),ratoInleg:Math.max(0,round2(amount-(Number(goal.vasteInleg)||0))),handmatigeCorrectie:round2(amount-(proposed[index]||0))};
        });
        u2ReconcileSavingsGoals(goals.map(goal=>goal.id));
        state.spaardoelGeschiedenis[u2HistoryKey(owner,month)]={id:u2HistoryKey(owner,month),maand:month,eigenaar:owner,spaarpot:pot,verdeeld:total,onverdeeld:round2(pot-total),transacties:transactions,verwerktOp:new Date().toISOString(),updatedBy:getDeviceId()};
      },{render:false});
      if(!ok){modal.querySelector('[data-u2-error]').textContent='Verwerken is mislukt; de vorige gegevens zijn behouden.';return;}
      modal.classList.remove('open','u2-process-open');modal.innerHTML='';showQuickToast('Spaarpot verwerkt');renderActiveTab();
    });
    refresh();
  };
  render();
}

function u2RenderChildSummary(goal){
  const active=u2ActiveChild(goal);
  if(!goal.subdoelen?.length) return '';
  return `<div class="u2-next-goal">${active?`<span>Volgende doel</span><strong>${textSafe(active.naam)} · nog ${eur(Math.max(0,Number(active.doelbedrag)-Number(active.gespaard)))}</strong>`:'<strong>Alle subdoelen voltooid</strong>'}</div>`;
}
const u2OriginalDashboardGoalPreviewCard=renderDashboardGoalPreviewCard;
renderDashboardGoalPreviewCard=function(item){
  const goal=item.doel||item;
  const owner=item.owner||goal.owner||ownerLabel(goal.eigenaar||'gezamenlijk');
  const target=u2GoalTarget(goal),saved=u2GoalSaved(goal);
  const progress=target>0?Math.min(1,saved/target):0;
  const calculated=calcDoel(goal,TODAY);
  return `<div class="dashboard-goal-preview-item">
    <div class="dashboard-goal-preview-thumb tone-${ownerTone(owner)}">${goalImageIcon(goal)}</div>
    <div class="dashboard-goal-preview-main">
      <div class="dashboard-goal-preview-top"><strong>${textSafe(goal.naam||'Spaardoel')}</strong><span>${eur(saved)} / ${eur(target)}</span></div>
      <div class="dashboard-goal-preview-meta"><span>${textSafe(owner)}</span><span>Doel: ${goal.doeldatum?formatDateNL(goal.doeldatum):'Geen doeldatum'}</span></div>
      <div class="progress-track goal-positive"><div class="progress-fill goal-positive" style="width:${Math.round(progress*100)}%"></div></div>
      <div class="u2-dashboard-extra">${u2RenderChildSummary(goal)}<span>Verwacht gereed: ${u2DateLabel(calculated.verwachteEinddatum)}</span></div>
    </div>
  </div>`;
};

function u2RenderGoalRow(item,owner){
  const goal=item.doel;
  const target=u2GoalTarget(goal),saved=u2GoalSaved(goal),progress=target>0?Math.min(100,Math.round(saved/target*100)):0;
  const image=String(goalImageSource(goal)||'').replace(/'/g,'%27');
  return `<article class="card u2-goal-card">
    <button class="u2-goal-main" type="button" data-open-goal-editor="${owner}:${textSafe(goal.id)}">
      <span class="u2-goal-image${image?' has-image':''}"${image?` style="background-image:url('${image}')"`:''}>${image?'':goalIcon(goal)}</span>
      <span class="u2-goal-copy"><span class="u2-goal-title"><strong>${textSafe(goal.naam||'Spaardoel')}</strong><em class="u2-status ${item.status.key}">${item.status.label}</em></span><span>${eur(saved)} van ${eur(target)}</span><span class="progress-track"><span class="progress-fill" style="width:${progress}%"></span></span>${u2RenderChildSummary(goal)}</span>
      <span class="u2-goal-side"><b>${progress}%</b><small>Nog ${eur(item.nogTeGaan)}</small></span>
    </button>
    <div class="u2-prognosis"><span>Inleg deze maand <strong>${eur(item.werkelijkeInleg)}</strong></span><span>Benodigd p/m <strong>${item.benodigdPerMaand===null?'—':eur(item.benodigdPerMaand)}</strong></span><span>Verwacht gereed <strong>${u2DateLabel(item.verwachteEinddatum)}</strong></span></div>
  </article>`;
}
const u2OriginalMobileSpaardoelen=renderMobileSpaardoelen;
renderMobileSpaardoelen=function(){
  const r=calcScenario(state);
  const groups=[
    {key:'gezamenlijk',label:'Gezamenlijk',pot:Math.max(0,r.spaarpotDezeMaand)},
    {key:'dion',label:'Dion',pot:Math.max(0,r.dion.beschikbaarVoorSparen)},
    {key:'dara',label:'Dara',pot:Math.max(0,r.dara.beschikbaarVoorSparen)}
  ];
  const all=groups.flatMap(group=>calcGroep(state.spaardoelen[group.key],group.pot,TODAY));
  const saved=round2(all.reduce((sum,item)=>sum+u2GoalSaved(item.doel),0));
  const target=round2(all.reduce((sum,item)=>sum+u2GoalTarget(item.doel),0));
  const root=document.getElementById('tab-spaardoelen');
  root.innerHTML=`${renderSharedEmptyTabHeader('Slimme spaardoelen')}
    <div class="mobile-savings-overview u2-savings">
      <div class="mobile-savings-kpis"><div class="card"><small>Totaal gespaard</small><strong>${eur(saved)}</strong><em>van ${eur(target)}</em></div><div class="card"><small>Totale voortgang</small><strong>${target>0?Math.round(saved/target*100):0}%</strong><em>alle hoofddoelen</em></div><div class="card"><small>Openstaand</small><strong>${eur(Math.max(0,target-saved))}</strong><em>nog te sparen</em></div><div class="card"><small>Afgeronde maanden</small><strong>${Object.keys(state.spaardoelGeschiedenis||{}).length}</strong><em>in geschiedenis</em></div></div>
      ${groups.map(group=>{
        const items=calcGroep(state.spaardoelen[group.key],group.pot,TODAY);
        const processed=u2IsProcessed(group.key);
        return `<section class="u2-owner-section"><div class="u2-owner-head"><div><h2>${group.label}</h2><span>Spaarpot ${monthLabel(getSelectedMonth())}: ${eur(group.pot)}</span></div><div><button class="ghost small" data-open-goal-manager="${group.key}">Doelen beheren</button><button class="primary small" data-u2-process-owner="${group.key}" ${processed?'disabled':''}>${processed?'Maand verwerkt':'Spaarpot verwerken'}</button></div></div><div class="u2-goal-grid">${items.length?items.map(item=>u2RenderGoalRow(item,group.key)).join(''):'<div class="card"><p class="hint">Nog geen spaardoelen.</p></div>'}</div></section>`;
      }).join('')}
      <details class="card u2-history"><summary><strong>Spaargeschiedenis</strong><span>${Object.keys(state.spaardoelGeschiedenis||{}).length} maanden</span></summary><div>${Object.values(state.spaardoelGeschiedenis||{}).sort((a,b)=>String(b.maand).localeCompare(String(a.maand))).map(entry=>`<article><strong>${ownerLabel(entry.eigenaar)} · ${monthLabel(entry.maand)}</strong><span>Spaarpot ${eur(entry.spaarpot)} · verdeeld ${eur(entry.verdeeld)} · onverdeeld ${eur(entry.onverdeeld)}</span><small>${entry.transacties.map(tx=>`${textSafe(tx.doelNaam)} ${eur(tx.bedrag)}`).join(' · ')}</small></article>`).join('')||'<p class="hint">Nog geen maanden verwerkt.</p>'}</div></details>
    </div>`;
  root.querySelectorAll('[data-u2-process-owner]').forEach(btn=>btn.addEventListener('click',()=>u2OpenProcessModal(btn.dataset.u2ProcessOwner)));
};

renderDashboardGoalPreviewCard=function(item){
  const goal=item.doel||item;
  const original=u2OriginalDashboardGoalPreviewCard(item);
  if(!goal.subdoelen?.length) return original;
  const active=u2ActiveChild(goal);
  const calculated=calcDoel(goal,TODAY);
  const extra=`<div class="u2-dashboard-extra"><span>${active?`Volgende: ${textSafe(active.naam)}`:'Alle subdoelen voltooid'}</span><span>Verwacht gereed: ${u2DateLabel(calculated.verwachteEinddatum)}</span></div>`;
  return original.replace(/\s*<\/div>\s*<\/div>\s*$/,`${extra}</div></div>`);
};

const u2OriginalMobileGoalRow=renderMobileGoalRow;
renderMobileGoalRow=function(item,owner){
  const goal=item.doel;
  if(!goal.subdoelen?.length) return u2OriginalMobileGoalRow(item,owner);
  const active=u2ActiveChild(goal);
  const original=u2OriginalMobileGoalRow(item,owner);
  const children=goal.subdoelen.map(child=>{
    const target=Math.max(0,Number(child.doelbedrag)||0);
    const saved=Math.min(target,Math.max(0,Number(child.gespaard)||0));
    const progress=target>0?Math.min(100,Math.round(saved/target*100)):0;
    const stateClass=child.voltooid?'done':active?.id===child.id?'active':'';
    return `<div class="u2-accordion-child ${stateClass}"><strong>${textSafe(child.naam||'Subdoel')}</strong><span>${eur(saved)} / ${eur(target)}</span><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>`;
  }).join('');
  const body=`<div class="u2-accordion-body">${children}<button type="button" class="ghost small u2-accordion-edit" data-open-goal-editor="${owner}:${textSafe(goal.id)}">Subdoelen beheren</button></div>`;
  return original
    .replace('<div class="mobile-goal-row">','<details class="u2-goal-accordion"><summary><div class="mobile-goal-row">')
    .replace(/\s*<\/div>\s*$/,`</div></summary>${body}</details>`);
};

renderMobileSpaardoelen=function(){
  u2OriginalMobileSpaardoelen();
  const root=document.getElementById('tab-spaardoelen');
  const result=calcScenario(state);
  const groups=[
    {owner:'gezamenlijk',pot:Math.max(0,Number(result.spaarpotDezeMaand)||0)},
    {owner:'dion',pot:Math.max(0,Number(result.dion.beschikbaarVoorSparen)||0)},
    {owner:'dara',pot:Math.max(0,Number(result.dara.beschikbaarVoorSparen)||0)}
  ];
  root.querySelectorAll('.mobile-goal-section').forEach((section,index)=>{
    const group=groups[index];
    if(!group)return;
    const processed=u2IsProcessed(group.owner);
    const actions=document.createElement('div');
    actions.className='u2-inline-actions';
    actions.innerHTML=`<span>Spaarpot ${monthLabel(getSelectedMonth())}: ${eur(group.pot)}</span><button type="button" class="ghost small" data-u2-process-owner="${group.owner}" ${processed?'disabled':''}>${processed?'Maand verwerkt':'Spaarpot verwerken'}</button>`;
    section.querySelector('h2')?.insertAdjacentElement('afterend',actions);
  });
  const history=Object.values(state.spaardoelGeschiedenis||{}).sort((a,b)=>String(b.maand).localeCompare(String(a.maand)));
  const historyHtml=`<div class="u2-history-list">${history.map(entry=>`<article><strong>${ownerLabel(entry.eigenaar)} Â· ${monthLabel(entry.maand)}</strong><span>Spaarpot ${eur(entry.spaarpot)} Â· verdeeld ${eur(entry.verdeeld)} Â· onverdeeld ${eur(entry.onverdeeld)}</span><small>${entry.transacties.map(tx=>`${textSafe(tx.doelNaam)} ${eur(tx.bedrag)}`).join(' Â· ')}</small></article>`).join('')||'<p class="hint">Nog geen maanden verwerkt.</p>'}</div>`;
  root.insertAdjacentHTML('beforeend',`<div class="manage-stack u2-history-stack">${renderManageSection('Spaargeschiedenis',historyHtml,false)}</div>`);
  root.querySelectorAll('.u2-goal-accordion [data-open-goal-editor]').forEach(btn=>btn.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
  }));
  root.querySelectorAll('[data-u2-process-owner]').forEach(btn=>btn.addEventListener('click',()=>u2OpenProcessModal(btn.dataset.u2ProcessOwner)));
};

const u2BaseGoalEditor=openMobileGoalEditor;
openMobileGoalEditor=function(owner,id){
  u2BaseGoalEditor(owner,id);
  const modal=document.getElementById('incomeEditModal');
  const goal=state.spaardoelen?.[owner]?.find(item=>item.id===id);
  if(!goal||!modal.classList.contains('open')) return;
  const grid=modal.querySelector('.modal-grid');
  const targetInput=modal.querySelector('#goalEditTarget');
  let drafts=clone(goal.subdoelen||[]);
  const ownerField=document.createElement('label');
  ownerField.innerHTML=`Eigenaar<select id="u2GoalOwner">${U2_OWNERS.map(value=>`<option value="${value}" ${value===owner?'selected':''}>${ownerLabel(value)}</option>`).join('')}</select>`;
  const ratioField=document.createElement('label');
  ratioField.className='u2-checkbox';
  ratioField.innerHTML=`<input id="u2GoalRatio" type="checkbox" ${goal.ratoVerdeling?'checked':''}> Meedoen aan automatische ratoverdeling`;
  const section=document.createElement('section');
  section.className='full u2-subgoal-editor';
  const renderChildren=()=>{
    section.innerHTML=`<div class="u2-subgoal-head"><div><h3>Subdoelen</h3><p>Er wordt altijd van boven naar beneden gespaard.</p></div><button type="button" class="ghost small" data-u2-add-child>+ Subdoel</button></div><div class="u2-subgoal-list">${drafts.map((child,index)=>`<div class="u2-subgoal-row" draggable="true" data-u2-child="${index}"><span class="u2-drag" title="Sleep om te verplaatsen">⋮⋮</span><input aria-label="Naam subdoel" data-u2-child-name="${index}" value="${textSafe(child.naam||'')}"><input aria-label="Doelbedrag subdoel" type="number" min="0" step="0.01" data-u2-child-target="${index}" value="${Number(child.doelbedrag)||0}"><input aria-label="Link subdoel" type="url" data-u2-child-link="${index}" value="${textSafe(child.link||'')}" placeholder="Optionele link"><span>${eur(Number(child.gespaard)||0)}</span><button type="button" class="ghost small" data-u2-child-up="${index}" ${index===0?'disabled':''}>↑</button><button type="button" class="ghost small" data-u2-child-down="${index}" ${index===drafts.length-1?'disabled':''}>↓</button><button type="button" class="danger-ghost" data-u2-child-remove="${index}">×</button></div>`).join('')||'<p class="hint">Nog geen subdoelen. Het hoofddoelbedrag blijft handmatig instelbaar.</p>'}</div>`;
    targetInput.disabled=drafts.length>0;
    if(drafts.length) targetInput.value=round2(drafts.reduce((sum,child)=>sum+(Number(child.doelbedrag)||0),0));
    const sync=()=>{
      section.querySelectorAll('[data-u2-child-name]').forEach(input=>drafts[Number(input.dataset.u2ChildName)].naam=input.value);
      section.querySelectorAll('[data-u2-child-target]').forEach(input=>drafts[Number(input.dataset.u2ChildTarget)].doelbedrag=Math.max(0,round2(bankAmount(input.value)||0)));
      section.querySelectorAll('[data-u2-child-link]').forEach(input=>drafts[Number(input.dataset.u2ChildLink)].link=input.value);
      if(drafts.length) targetInput.value=round2(drafts.reduce((sum,child)=>sum+(Number(child.doelbedrag)||0),0));
    };
    section.querySelector('[data-u2-add-child]')?.addEventListener('click',()=>{sync();drafts.push({id:uid(),naam:'Nieuw subdoel',doelbedrag:0,gespaard:0,link:'',voltooid:false});renderChildren();});
    section.querySelectorAll('[data-u2-child-remove]').forEach(btn=>btn.addEventListener('click',()=>{sync();drafts.splice(Number(btn.dataset.u2ChildRemove),1);renderChildren();}));
    const move=(from,to)=>{sync();if(to<0||to>=drafts.length)return;const [child]=drafts.splice(from,1);drafts.splice(to,0,child);renderChildren();};
    section.querySelectorAll('[data-u2-child-up]').forEach(btn=>btn.addEventListener('click',()=>move(Number(btn.dataset.u2ChildUp),Number(btn.dataset.u2ChildUp)-1)));
    section.querySelectorAll('[data-u2-child-down]').forEach(btn=>btn.addEventListener('click',()=>move(Number(btn.dataset.u2ChildDown),Number(btn.dataset.u2ChildDown)+1)));
    let dragIndex=null;
    section.querySelectorAll('[data-u2-child]').forEach(row=>{
      row.addEventListener('dragstart',()=>{sync();dragIndex=Number(row.dataset.u2Child);row.classList.add('dragging');});
      row.addEventListener('dragend',()=>row.classList.remove('dragging'));
      row.addEventListener('dragover',event=>event.preventDefault());
      row.addEventListener('drop',event=>{event.preventDefault();const target=Number(row.dataset.u2Child);if(dragIndex!==null&&dragIndex!==target)move(dragIndex,target);});
    });
    section.querySelectorAll('input').forEach(input=>input.addEventListener('input',sync));
  };
  grid.insertBefore(ownerField,grid.firstChild);
  grid.insertBefore(ratioField,grid.querySelector('.goal-calculation-card'));
  grid.insertBefore(section,grid.querySelector('.goal-calculation-card'));
  renderChildren();
  const u2CloseButton=modal.querySelector('[data-close-goal-editor]');
  const u2CloseEditor=event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    modal.classList.remove('open','goal-detail-editor-open');
    modal.innerHTML='';
    renderActiveTab();
  };
  if(u2CloseButton){
    u2CloseButton.onclick=u2CloseEditor;
    u2CloseButton.addEventListener('pointerup',u2CloseEditor,{once:true});
  }
  modal.querySelector('#goalEditSave').addEventListener('click',()=>{
    section.querySelectorAll('input').forEach(input=>input.dispatchEvent(new Event('input')));
    const newOwner=modal.querySelector('#u2GoalOwner').value;
    const extras={
      naam:modal.querySelector('#goalEditName').value.trim(),
      doelbedrag:round2(bankAmount(modal.querySelector('#goalEditTarget').value)||0),
      doeldatum:modal.querySelector('#goalEditDate').value,
      vasteInleg:Math.max(0,round2(bankAmount(modal.querySelector('#goalEditMonthly').value)||0)),
      rendement:(bankAmount(modal.querySelector('#goalEditReturn').value)||0)/100,
      rendementPeriode:modal.querySelector('#goalEditPeriod').value,
      favoriet:modal.querySelector('#goalEditFavorite').checked,
      eigenaar:newOwner,
      ratoVerdeling:modal.querySelector('#u2GoalRatio').checked,
      vastBedrag:!modal.querySelector('#u2GoalRatio').checked,
      subdoelen:drafts.map((child,index)=>({...child,volgorde:index}))
    };
    const savedAmount=round2(bankAmount(modal.querySelector('#goalEditSaved').value)||0);
    u2NormalizeChildren(extras);
    commitChange(()=>{
      const source=state.spaardoelen[owner];
      const index=source.findIndex(item=>item.id===id);
      if(index<0)return;
      Object.assign(source[index],extras);
      u2NormalizeChildren(source[index]);
      u2SetGoalSavedAmount(source[index],savedAmount);
      if(newOwner!==owner){const [moved]=source.splice(index,1);state.spaardoelen[newOwner].push(moved);}
    },{render:false});
  },true);
  const calculation=grid.querySelector('.goal-calculation-card');
  const settingsDetails=document.createElement('details');
  settingsDetails.className='full u2-editor-details';
  settingsDetails.innerHTML='<summary>Verdeling en eigenaar</summary><div class="manage-body u2-editor-settings"></div>';
  grid.insertBefore(settingsDetails,ownerField);
  settingsDetails.querySelector('.manage-body').append(ownerField,ratioField);
  const subgoalDetails=document.createElement('details');
  subgoalDetails.className='full u2-editor-details';
  subgoalDetails.innerHTML=`<summary>Subdoelen${drafts.length?` (${drafts.length})`:''}</summary><div class="manage-body"></div>`;
  grid.insertBefore(subgoalDetails,section);
  subgoalDetails.querySelector('.manage-body').appendChild(section);
  if(calculation){
    const calculationDetails=document.createElement('details');
    calculationDetails.className='full u2-editor-details';
    calculationDetails.innerHTML='<summary>Prognose en maandberekening</summary><div class="manage-body"></div>';
    grid.insertBefore(calculationDetails,calculation);
    calculationDetails.querySelector('.manage-body').appendChild(calculation);
  }
};

const u2BaseGoalManager=openMobileGoalManager;
openMobileGoalManager=function(owner){
  u2BaseGoalManager(owner);
  const add=document.querySelector('#incomeEditModal [data-add-manager-goal]');
  if(add) add.addEventListener('click',()=>setTimeout(()=>{
    const goals=state.spaardoelen[owner]||[];
    const newest=goals[goals.length-1];
    if(newest&&!newest.eigenaar) commitChange(()=>Object.assign(newest,{eigenaar:owner,ratoVerdeling:true,subdoelen:[]}),{render:false});
  },0),true);
};

/* ---------- Update 3: rekenlaag en administratieve acties ---------- */
function u3ConfirmedTransactions(month=getSelectedMonth()){
  return (state.transactions||[]).filter(tx=>transactionMonth(tx)===month && (tx.reviewStatus||'bevestigd')==='bevestigd');
}
function u3IncomeOccurrences(month=getSelectedMonth()){
  return u3PlannedOccurrences(state.recurringIncomeSources||[],month).map(row=>{
    const source=(state.recurringIncomeSources||[]).find(item=>item.id===row.itemId);
    return {...row,source,type:source?.type||'overig',owner:source?.eigenaar||'gezamenlijk',meetellenVoorVerdeling:!!source?.meetellenVoorVerdeling};
  });
}
function u3FixedOccurrences(month=getSelectedMonth(),scenario=state.meta.scenario){
  return u3PlannedOccurrences(state.recurringFixedExpenses?.[scenario]||[],month);
}
function u3LinkedActual(kind,occurrenceId,month=getSelectedMonth()){
  const field=kind==='income'?'incomeOccurrenceId':'fixedOccurrenceId';
  return u3ConfirmedTransactions(month).find(tx=>tx[field]===occurrenceId)||null;
}
function u3IncomeOccurrenceValue(occurrence){
  const actual=u3LinkedActual('income',occurrence.id,occurrence.month);
  return actual?round2(Math.abs(Number(actual.amount)||0)):round2(occurrence.amount);
}
function u3IncomeForOwner(owner,options={}){
  const month=options.month||getSelectedMonth();
  return round2(u3IncomeOccurrences(month)
    .filter(row=>row.owner===owner && (options.type?row.type===options.type:true) && (options.distributionOnly?row.meetellenVoorVerdeling:true))
    .reduce((sum,row)=>sum+u3IncomeOccurrenceValue(row),0));
}
function u3IncomeTransactionOwner(tx){
  const source=(state.recurringIncomeSources||[]).find(item=>item.id===tx.incomeSourceId);
  return tx.accountOwner||tx.account||source?.eigenaar||tx.budgetOwner||tx.financialFor||tx.owner||'gezamenlijk';
}
function resolveMonthlyIncome(owner,month=getSelectedMonth()){
  if(owner==='total'){
    const aggregate=state.actualIncomeOverrides?.[month];
    if(Number.isFinite(Number(aggregate?.total)))return {amount:round2(Number(aggregate.total)),source:'actual'};
    const parts=['dion','dara','gezamenlijk'].map(key=>resolveMonthlyIncome(key,month));
    const sources=[...new Set(parts.map(item=>item.source))];
    return {amount:round2(parts.reduce((sum,item)=>sum+item.amount,0)),source:sources.length===1?sources[0]:'mixed'};
  }
  const manualActual=state.actualIncomeOverrides?.[month]?.[owner];
  if(Number.isFinite(Number(manualActual)))return {amount:round2(Number(manualActual)),source:'actual'};
  const actualRows=u3ConfirmedTransactions(month).filter(tx=>tx.kind==='inkomen'&&u3IncomeTransactionOwner(tx)===owner);
  if(actualRows.length)return {amount:round2(actualRows.reduce((sum,tx)=>sum+Math.abs(Number(tx.amount)||0),0)),source:'actual'};
  const monthOverrides=state.monthlyIncomeOverrides?.[month];
  if(isPlainObject(monthOverrides)&&Object.prototype.hasOwnProperty.call(monthOverrides,owner)){
    return {amount:round2(Number(monthOverrides[owner])||0),source:'monthly-override'};
  }
  const expected=round2(u3IncomeOccurrences(month).filter(row=>row.owner===owner).reduce((sum,row)=>sum+Number(row.amount||0),0));
  if(expected||owner==='gezamenlijk')return {amount:expected,source:expected?'expected':'none'};
  if(owner==='dion'||owner==='dara'){
    const parts=getDistributionIncomeParts(owner,month);
    return {amount:round2(parts.salary+parts.refund),source:'standard'};
  }
  return {amount:0,source:'none'};
}
function u3ActualIncome(month=getSelectedMonth(),financialFor=null){
  return resolveMonthlyIncome(financialFor||'total',month).amount;
}
function u3ActualExpenses(month=getSelectedMonth(),financialFor=null){
  return round2(u3ConfirmedTransactions(month).filter(tx=>(!financialFor||(tx.financialFor||tx.owner)===financialFor)).reduce((sum,tx)=>sum+getTransactionExpenseImpact(tx),0));
}
function u3ExpectedIncome(month=getSelectedMonth(),financialFor=null){
  return round2(u3IncomeOccurrences(month).filter(row=>!financialFor||row.financialFor===financialFor).reduce((sum,row)=>sum+Number(row.amount||0),0));
}
function u3PlannedFixedTotal(month=getSelectedMonth(),financialFor=null){
  return round2(u3FixedOccurrences(month).filter(row=>!financialFor||row.financialFor===financialFor).reduce((sum,row)=>sum+Number(row.amount||0),0));
}
function u3VariableBudgets(owner,month=getSelectedMonth(),scenario=state.meta.scenario){
  ensureMonthData(month);
  const key=`${owner}Variabel`;
  return state.monthlyBudgets?.[month]?.[scenario]?.[key]||[];
}
function u3BudgetSummary(owner,month=getSelectedMonth(),scenario=state.meta.scenario){
  const budgets=u3VariableBudgets(owner,month,scenario);
  const map=new Map();
  const ensure=(label,budget=null)=>{
    label=String(label||'Overig').trim()||'Overig';
    const key=label.toLocaleLowerCase();
    if(!map.has(key))map.set(key,{category:label,budget,actual:0});
    else if(budget!==null&&map.get(key).budget===null)map.get(key).budget=0;
    return map.get(key);
  };
  budgets.forEach(row=>{
    const label=String(row.post||row.categorie||'Overig').trim()||'Overig';
    const target=ensure(label,0);
    target.budget=round2((target.budget||0)+(Number(row.bedrag)||0));
  });
  const linkedTransactionIds=new Set();
  u3FixedOccurrences(month,scenario).filter(row=>row.financialFor===owner).forEach(occurrence=>{
    const target=ensure(occurrence.categorie||'Vaste lasten',0);
    target.budget=round2((target.budget||0)+(Number(occurrence.amount)||0));
    target.actual=round2(target.actual+(Number(occurrence.amount)||0));
    const actual=u3LinkedActual('fixed',occurrence.id,month);
    if(actual){linkedTransactionIds.add(actual.id);}
  });
  u3ConfirmedTransactions(month).filter(tx=>(tx.financialFor||tx.owner)===owner&&!linkedTransactionIds.has(tx.id)).forEach(tx=>{
    const target=ensure(tx.category||'Overig',null);
    target.actual=round2(target.actual+getTransactionExpenseImpact(tx));
  });
  return [...map.values()].map(row=>({...row,difference:round2((row.budget??0)-row.actual),status:row.budget===null?'geen-budget':row.actual>row.budget?'overschreden':'resterend'}));
}
function u3ReserveDelta(owner,month=getSelectedMonth(),scenario=state.meta.scenario){
  return round2(u3BudgetSummary(owner,month,scenario).reduce((sum,row)=>sum+row.difference,0));
}
function u3ReserveBalance(owner,throughMonth='9999-12'){
  return round2((state.reserveLedger||[]).filter(row=>row.owner===owner&&String(row.month||'')<=throughMonth&&row.status!=='vervallen').reduce((sum,row)=>sum+(Number(row.amount)||0),0));
}
function u3OpeningBalance(account,month){
  const setting=state.accountSettings?.[account]||{openingBalance:0,effectiveMonth:month};
  const previous=Object.values(state.monthRecords||{})
    .filter(record=>record?.status==='afgesloten'&&record.month<month&&record.activeClosureId)
    .sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0];
  const closure=previous?.closureHistory?.find(item=>item.id===previous.activeClosureId);
  return round2(Number(closure?.accountControl?.[account]?.administrativeEnd ?? setting.openingBalance)||0);
}
function u3ConfirmedTransfersInCalendarMonth(account,month){
  return (state.internalTransfers||[]).filter(row=>row.status==='uitgevoerd'&&String(row.date||'').slice(0,7)===month).reduce((sum,row)=>{
    const amount=Number(row.actualAmount??row.calculatedAmount)||0;
    if(row.sourceAccount===account) return sum-amount;
    if(row.targetAccount===account) return sum+amount;
    return sum;
  },0);
}
function u3AccountControl(month=getSelectedMonth()){
  const result={};
  U3_ACCOUNTS.forEach(account=>{
    const opening=u3OpeningBalance(account,month);
    const transactionDelta=u3ConfirmedTransactions(month).reduce((sum,tx)=>{
      if((tx.account||tx.owner)!==account)return sum;
      if(Number.isFinite(Number(tx.accountDelta)))return sum+Number(tx.accountDelta);
      const amount=Math.abs(Number(tx.amount)||0);
      return sum+(tx.kind==='inkomen'?amount:-amount);
    },0);
    const transferDelta=u3ConfirmedTransfersInCalendarMonth(account,month);
    const corrections=(state.monthCorrections||[]).filter(row=>row.account===account&&row.effectiveMonth===month&&row.status!=='vervallen').reduce((sum,row)=>sum+(Number(row.amount)||0),0);
    result[account]={opening,transactionDelta:round2(transactionDelta),transferDelta:round2(transferDelta),corrections:round2(corrections),calculatedEnd:round2(opening+transactionDelta+transferDelta+corrections)};
  });
  return result;
}
function u3CreateAdvanceForTransaction(tx){
  const account=tx.account||tx.owner;
  const financialFor=tx.financialFor||tx.owner;
  if(account===financialFor||!U3_ACCOUNTS.includes(account)||!U3_ACCOUNTS.includes(financialFor))return null;
  const existing=(state.advanceLedger||[]).find(row=>row.transactionId===tx.id);
  if(existing)return existing;
  const incoming=tx.kind==='inkomen';
  const debtor=incoming?account:financialFor;
  const creditor=incoming?financialFor:account;
  const amount=round2(Math.abs(Number(tx.amount)||0));
  const row={id:`advance-${tx.id}`,transactionId:tx.id,month:transactionMonth(tx),debtor,creditor,originalAmount:amount,outstandingAmount:amount,status:amount?'open':'voldaan',createdAt:new Date().toISOString(),settlementTransferIds:[]};
  state.advanceLedger.push(row);
  return row;
}
function u3OpenAdvances(month=null){
  return (state.advanceLedger||[]).filter(row=>row.status!=='voldaan'&&Number(row.outstandingAmount)>0&&(!month||row.month<=month));
}
function u3NetAdvances(month=getSelectedMonth()){
  const pairs=new Map();
  u3OpenAdvances(month).forEach(row=>{
    const forward=`${row.debtor}|${row.creditor}`;
    const amount=Number(row.outstandingAmount)||0;
    pairs.set(forward,(pairs.get(forward)||0)+amount);
  });
  const result=[];
  pairs.forEach((amount,key)=>{
    let [debtor,creditor]=key.split('|');
    if(amount>.004)result.push({debtor,creditor,amount:round2(amount)});
  });
  return result;
}
function u3MonthRecord(month=getSelectedMonth()){
  if(!isPlainObject(state.monthRecords[month]))state.monthRecords[month]={month,status:'open',closedAt:'',reopenedAt:'',activeClosureId:'',closureHistory:[]};
  return state.monthRecords[month];
}
function u3DeterministicTransferId(closureId,type,source,target){return `transfer-${closureId}-${type}-${source}-${target}`.replace(/[^a-zA-Z0-9_-]/g,'-');}
function u3TransferDrafts(month,closureId,scenarioResult){
  const drafts=[];
  const add=(type,source,target,amount,label)=>{
    amount=round2(Number(amount)||0); if(amount<=0)return;
    drafts.push({id:u3DeterministicTransferId(closureId,type,source,target),type,sourceAccount:source,targetAccount:U3_ACCOUNTS.includes(target)?target:'',destination:label||target,calculatedAmount:amount,actualAmount:amount,month,status:'nog-te-verwerken',date:'',correction:0,closureId,sourceClosingId:closureId,createdAt:new Date().toISOString()});
  };
  const addSigned=(type,source,target,amount,label)=>{
    amount=round2(Number(amount)||0);
    if(amount<0)add(`${type}-terug`,target,source,Math.abs(amount),`${label} terug naar gezamenlijk`);
    else add(type,source,target,amount,label);
  };
  addSigned('zakgeld-dion','gezamenlijk','dion',scenarioResult.dion.zakgeld,'Zakgeld Dion');
  addSigned('zakgeld-dara','gezamenlijk','dara',scenarioResult.dara.zakgeld,'Zakgeld Dara');
  add('gezamenlijk-sparen','gezamenlijk','',Math.max(0,scenarioResult.spaarpotDezeMaand),'Gezamenlijke spaarrekening');
  add('dion-sparen','dion','',Math.max(0,scenarioResult.dion.beschikbaarVoorSparen),'Dion spaarrekening');
  add('dara-sparen','dara','',Math.max(0,scenarioResult.dara.beschikbaarVoorSparen),'Dara spaarrekening');
  // Update 4: open voorschotten blijven informatief en worden alleen door een
  // expliciet als terugbetaling gemarkeerde banktransactie afgelost.
  return drafts;
}
function u3MonthSummary(month=getSelectedMonth()){
  const scenarioResult=calcScenario(state);
  const actualIncome=u3ActualIncome(month);
  const actualExpenses=u3ActualExpenses(month);
  return {
    month,scenario:state.meta.scenario,expectedIncome:u3ExpectedIncome(month),actualIncome,
    plannedFixed:u3PlannedFixedTotal(month),actualExpenses,monthResult:round2(actualIncome-actualExpenses),
    allowanceDion:round2(scenarioResult.dion.zakgeld),allowanceDara:round2(scenarioResult.dara.zakgeld),
    jointSaving:round2(scenarioResult.spaarpotDezeMaand),
    reserve:{gezamenlijk:u3ReserveDelta('gezamenlijk',month),dion:u3ReserveDelta('dion',month),dara:u3ReserveDelta('dara',month)}
  };
}
function u3WithSelectedMonth(month,callback){
  const previous=state.meta.selectedMonth;
  try{
    state.meta.selectedMonth=month;
    ensureMonthData(month);
    return callback();
  }finally{
    state.meta.selectedMonth=previous;
  }
}
function u3LiveFinancialSnapshot(month=getSelectedMonth()){
  return u3WithSelectedMonth(month,()=>{
    const scenarioResult=calcScenario(state);
    const dionIncome=resolveMonthlyIncome('dion',month);
    const daraIncome=resolveMonthlyIncome('dara',month);
    const jointIncome=resolveMonthlyIncome('gezamenlijk',month);
    const totalIncome=resolveMonthlyIncome('total',month);
    const income={
      dion:dionIncome.amount,
      dara:daraIncome.amount,
      joint:jointIncome.amount,
      total:totalIncome.amount,
      sources:{dion:dionIncome.source,dara:daraIncome.source,joint:jointIncome.source,total:totalIncome.source}
    };
    const variableExpenses={
      dion:round2(sumTransactions('dion',null,month)),
      dara:round2(sumTransactions('dara',null,month)),
      joint:round2(sumTransactions('gezamenlijk',null,month))
    };
    variableExpenses.total=round2(variableExpenses.dion+variableExpenses.dara+variableExpenses.joint);
    const fixedExpenses=round2(u3PlannedFixedTotal(month));
    const refunds=round2(sumMaandTeruggaven('dion',month)+sumMaandTeruggaven('dara',month)+sumMaandTeruggaven('gezamenlijk',month));
    const savings=round2(scenarioResult.spaarpotDezeMaand);
    const contributions={dion:0,dara:0,joint:0,total:0};
    (state.savingsGoalLedger||[]).filter(entry=>entry.active!==false&&entry.month===month&&!['geannuleerd','teruggedraaid'].includes(entry.status)).forEach(entry=>{
      const goalOwner=U3_ACCOUNTS.find(owner=>(state.spaardoelen?.[owner]||[]).some(goal=>goal.id===entry.goalId))||'gezamenlijk';
      contributions[goalOwner]=round2(contributions[goalOwner]+Number(entry.effectiveAmount||0));
    });
    contributions.total=round2(contributions.dion+contributions.dara+contributions.joint);
    return {
      month,version:2,status:'open',legacy:false,income,fixedExpenses,variableExpenses,refunds,savings,
      allowance:{dion:round2(scenarioResult.dion.zakgeld),dara:round2(scenarioResult.dara.zakgeld)},
      contributions,remaining:round2(income.total-fixedExpenses-variableExpenses.total-savings),
      goalAllocations:(state.savingsGoalLedger||[]).filter(entry=>entry.month===month&&entry.active!==false).map(entry=>({id:entry.id,goalId:entry.goalId,amount:round2(Number(entry.effectiveAmount)||0),status:entry.status})),
      closedAt:''
    };
  });
}
function getMonthFinancialResult(month=getSelectedMonth()){
  const record=state.monthRecords?.[month];
  if(record&&['afgesloten','correctie-nodig'].includes(record.status)&&record.activeClosureId){
    const closure=(record.closureHistory||[]).find(item=>(item.closingId||item.id)===record.activeClosureId);
    if(closure){
      const snapshot=clone(closure.financialSnapshot||u3LegacyFinancialSnapshot(month,record,closure));
      snapshot.status=record.status;
      snapshot.pendingCorrectionTransactionIds=[...(record.lateImportTransactionIds||[])];
      return snapshot;
    }
  }
  return u3LiveFinancialSnapshot(month);
}
function u3DeactivateClosingEffects(closingId){
  if(!closingId)return;
  (state.reserveLedger||[]).forEach(row=>{if((row.sourceClosingId||row.closureId)===closingId)row.status='vervallen';});
  (state.internalTransfers||[]).forEach(row=>{if((row.sourceClosingId||row.closureId)===closingId)row.status='vervallen';});
  (state.monthCorrections||[]).forEach(row=>{if((row.sourceClosingId||row.closureId)===closingId)row.status='vervallen';});
  (state.savingsGoalLedger||[]).forEach(row=>{
    if(row.sourceClosingId!==closingId)return;
    row.active=false;row.status='teruggedraaid';row.updatedAt=new Date().toISOString();
  });
  u2ReconcileSavingsGoals();
}
function u3CloseMonth(month=getSelectedMonth(),actualBalances={},correctionAccounts=[],options={}){
  const pending=u3PendingReviews(month);
  if(pending.length&&!options.force)return {requiresWarning:true,pendingCount:pending.length,month};
  const record=u3MonthRecord(month);
  if(record.status==='afgesloten')return record.closureHistory.find(row=>row.id===record.activeClosureId)||null;
  const previous=record.closureHistory[record.closureHistory.length-1]||null;
  const revision=Math.max(0,...record.closureHistory.map(item=>Number(item.version||item.revision)||0))+1;
  const closureId=`closure-${month}-${revision}`;
  const summary=u3MonthSummary(month);
  const accountControl=u3AccountControl(month);
  U3_ACCOUNTS.forEach(account=>{
    const actual=Number(actualBalances[account]);
    accountControl[account].actualBalance=Number.isFinite(actual)?round2(actual):null;
    accountControl[account].difference=Number.isFinite(actual)?round2(actual-accountControl[account].calculatedEnd):0;
    accountControl[account].administrativeEnd=accountControl[account].calculatedEnd;
    if(Number.isFinite(actual)&&correctionAccounts.includes(account)&&Math.abs(accountControl[account].difference)>.004){
      const id=`correction-${closureId}-${account}`;
      if(!state.monthCorrections.some(row=>row.id===id))state.monthCorrections.push({id,month,account,effectiveMonth:month,amount:accountControl[account].difference,reason:'Rekeningcorrectie bij maandafsluiting',closureId,sourceClosingId:closureId,status:'actief',createdAt:new Date().toISOString()});
      accountControl[account].administrativeEnd=round2(actual);
    }
  });
  const scenarioResult=calcScenario(state);
  const drafts=u3TransferDrafts(month,closureId,scenarioResult);
  if(previous){u3DeactivateClosingEffects(previous.closingId||previous.id);previous.status='vervangen';}
  drafts.filter(row=>row.calculatedAmount>.004).forEach(row=>{if(!state.internalTransfers.some(item=>item.id===row.id))state.internalTransfers.push(row);});
  U3_ACCOUNTS.forEach(owner=>{
    const id=`reserve-${closureId}-${owner}`;
    if(!state.reserveLedger.some(row=>row.id===id))state.reserveLedger.push({id,month,owner,amount:summary.reserve[owner],reason:'Netto budgetverschil',closureId,sourceClosingId:closureId,status:'actief',createdAt:new Date().toISOString()});
  });
  const financialSnapshot=u3LiveFinancialSnapshot(month);
  financialSnapshot.status='afgesloten';financialSnapshot.closedAt=new Date().toISOString();
  const closure={id:closureId,closingId:closureId,month,version:revision,revision,status:'actief',createdAt:financialSnapshot.closedAt,supersedesClosingId:previous?.closingId||previous?.id||'',closedAt:financialSnapshot.closedAt,summary,financialSnapshot,accountControl,transferIds:drafts.filter(row=>row.calculatedAmount>.004).map(row=>row.id),transferSnapshot:clone(drafts.filter(row=>row.calculatedAmount>.004)),correctionIds:(state.monthCorrections||[]).filter(row=>row.closureId===closureId).map(row=>row.id),updatedBy:getDeviceId()};
  record.status='afgesloten';record.closedAt=closure.closedAt;record.activeClosureId=closureId;record.closureHistory.push(closure);
  return closure;
}
function u3ReopenMonth(month=getSelectedMonth()){
  const record=u3MonthRecord(month);
  if(record.status!=='afgesloten')return false;
  const closure=record.closureHistory.find(item=>(item.closingId||item.id)===record.activeClosureId);
  if(closure){closure.status='teruggedraaid';closure.reopenedAt=new Date().toISOString();u3DeactivateClosingEffects(closure.closingId||closure.id);}
  record.status='open';record.reopenedAt=new Date().toISOString();record.activeClosureId='';return true;
}
function u3ApplyTransferToAdvances(transfer,amount){
  if(!String(transfer.type||'').includes('voorschot'))return;
  let remaining=round2(amount);
  u3OpenAdvances(transfer.month).filter(row=>row.debtor===transfer.sourceAccount&&row.creditor===transfer.targetAccount).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).forEach(row=>{
    if(remaining<=0)return;
    const applied=Math.min(remaining,Number(row.outstandingAmount)||0);
    row.outstandingAmount=round2((Number(row.outstandingAmount)||0)-applied);
    if(row.outstandingAmount<=.004){row.outstandingAmount=0;row.status='voldaan';}
    row.settlementTransferIds=Array.isArray(row.settlementTransferIds)?row.settlementTransferIds:[];
    if(!row.settlementTransferIds.includes(transfer.id))row.settlementTransferIds.push(transfer.id);
    remaining=round2(remaining-applied);
  });
}
function u3ConfirmTransfer(id,actualAmount,date,status='uitgevoerd'){
  const transfer=(state.internalTransfers||[]).find(row=>row.id===id);
  if(!transfer)return false;
  assertMonthMutationAllowed(transfer.month);
  if(transfer.status==='uitgevoerd'&&status==='uitgevoerd')return true;
  transfer.actualAmount=round2(Math.max(0,Number(actualAmount)||0));transfer.date=date||u3IsoDate(new Date());transfer.status=status;
  transfer.correction=round2(transfer.actualAmount-(Number(transfer.calculatedAmount)||0));
  if(status==='uitgevoerd'){
    u3ApplyTransferToAdvances(transfer,transfer.actualAmount);
    if(Math.abs(transfer.correction)>.004){
      const [year,month]=transfer.month.split('-').map(Number);
      const nextMonth=monthKey(new Date(year,month,1));
      const id=`transfer-correction-${transfer.id}`;
      if(!state.monthCorrections.some(row=>row.id===id))state.monthCorrections.push({id,month:transfer.month,account:transfer.sourceAccount,effectiveMonth:nextMonth,amount:round2(-transfer.correction),reason:'Afwijkend uitgevoerde interne overboeking',transferId:transfer.id,status:'actief',createdAt:new Date().toISOString()});
    }
  }
  return true;
}
function u3SuggestedRecognition(description,account,amount){
  const text=bankText(description);
  return (state.recognitionRules||[]).map(rule=>{
    let score=0;
    if(rule.text&&text.includes(bankText(rule.text)))score+=5;
    if(rule.counterparty&&text.includes(bankText(rule.counterparty)))score+=3;
    if(rule.account&&rule.account===account)score+=2;
    if(Number.isFinite(Number(rule.amount))&&Math.abs(Math.abs(Number(amount))-Math.abs(Number(rule.amount)))<=Number(rule.tolerance||5))score+=2;
    return {rule,score};
  }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score)[0]?.rule||null;
}
function u3RememberRecognition(tx){
  const text=bankText(tx.description);
  if(!text)return;
  const id=`recognition-${tx.account}-${text}`.replace(/[^a-z0-9_-]/g,'-').slice(0,180);
  const next={id,text,counterparty:'',account:tx.account,category:tx.category||'Overig',fixedExpenseId:tx.fixedExpenseId||'',incomeSourceId:tx.incomeSourceId||'',financialFor:tx.financialFor||tx.account,amount:round2(Math.abs(Number(tx.amount)||0)),tolerance:Math.max(5,round2(Math.abs(Number(tx.amount)||0)*.15)),updatedAt:new Date().toISOString()};
  const index=state.recognitionRules.findIndex(row=>row.id===id);
  if(index>=0)state.recognitionRules[index]=next;else state.recognitionRules.unshift(next);
  state.recognitionRules=state.recognitionRules.slice(0,300);
}

function u3PendingReviews(month=getSelectedMonth()){
  return (state.transactionReviewQueue||[]).filter(row=>(row.reviewStatus||'te-controleren')==='te-controleren'&&String(row.date||'').slice(0,7)===month);
}
function assertMonthMutationAllowed(month=getSelectedMonth(),mode='direct'){
  const status=state.monthRecords?.[month]?.status;
  if(!['afgesloten','correctie-nodig'].includes(status))return true;
  if(['reopen','correction','late-import'].includes(mode))return true;
  throw new Error('Deze maand is afgesloten. Heropen de maand of maak een correctie om financiële gegevens te wijzigen.');
}
function u3AssertMonthOpen(month=getSelectedMonth()){
  return assertMonthMutationAllowed(month);
}
function u3AccountLabel(value){return ownerLabel(value||'gezamenlijk');}
function u3AdminModal(html,extraClass=''){
  const modal=document.getElementById('incomeEditModal');
  modal.innerHTML=`<div class="modal u3-admin-modal ${extraClass}" role="dialog" aria-modal="true">${html}</div>`;
  modal.classList.add('open','u3-admin-open');
  const close=()=>{modal.classList.remove('open','u3-admin-open');modal.innerHTML='';renderActiveTab();};
  modal.querySelectorAll('[data-u3-close]').forEach(button=>button.addEventListener('click',close));
  return {modal,close};
}
function renderU3AdminPanel(){
  const month=getSelectedMonth();
  const summary=u3MonthSummary(month);
  const record=state.monthRecords?.[month];
  const pending=u3PendingReviews(month).length;
  const control=u3AccountControl(month);
  const needsCorrection=record?.status==='correctie-nodig';
  const status=record?.status==='afgesloten'?'closed':needsCorrection||pending?'pending':'ok';
  const statusLabel=record?.status==='afgesloten'?'Afgesloten':needsCorrection?'Correctie nodig':pending?`${pending} te controleren`:'Klaar voor controle';
  const body=`<section class="card u3-admin-card">
    <div class="u3-admin-head"><p>Verwacht, werkelijk, rekeningen, reserve en onderlinge voorschotten</p><span class="u3-status ${status}">${statusLabel}</span></div>
    <div class="u3-admin-metrics">
      <div class="u3-admin-metric"><span>Verwacht inkomen</span><strong>${eur(summary.expectedIncome)}</strong></div>
      <div class="u3-admin-metric"><span>Werkelijk inkomen</span><strong>${eur(summary.actualIncome)}</strong></div>
      <div class="u3-admin-metric"><span>Werkelijke uitgaven</span><strong>${eur(summary.actualExpenses)}</strong></div>
      <div class="u3-admin-metric"><span>Gezamenlijke rekening</span><strong>${eur(control.gezamenlijk.calculatedEnd)}</strong></div>
    </div>
    <div class="u3-admin-actions">
      <button type="button" class="ghost small" data-u3-open="planning">Vaste lasten & inkomsten</button>
      <button type="button" class="${pending?'primary':'ghost'} small" data-u3-open="review">Transacties controleren${pending?` (${pending})`:''}</button>
      <button type="button" class="ghost small" data-u3-open="actual-income">Werkelijk inkomen aanpassen</button>
      <button type="button" class="ghost small" data-u3-open="close">Maandafsluiting</button>
      <button type="button" class="ghost small" data-u3-open="transfers">Overboekingen</button>
    </div>
  </section>`;
  return renderManageSection('Maandadministratie',body,false,'data-dashboard-accordion="month-admin"');
}
function bindU3Admin(root){
  root.querySelectorAll('[data-u3-open]').forEach(button=>button.addEventListener('click',()=>{
    const view=button.dataset.u3Open;
    if(view==='planning')u3OpenPlanning();
    else if(view==='review')u3OpenReview();
    else if(view==='actual-income'){
      const month=getSelectedMonth();
      const current=state.actualIncomeOverrides?.[month]?.total;
      const value=prompt(`Werkelijk inkomen voor ${month}. Laat leeg om de handmatige correctie te verwijderen.`,Number.isFinite(Number(current))?String(current):String(u3ActualIncome(month)));
      if(value===null)return;
      const ok=commitChange(()=>{
        state.actualIncomeOverrides=isPlainObject(state.actualIncomeOverrides)?state.actualIncomeOverrides:{};
        if(!String(value).trim())delete state.actualIncomeOverrides[month];
        else{
          const amount=round2(bankAmount(value));
          if(!Number.isFinite(amount)||amount<0)throw new Error('Vul een geldig positief bedrag in.');
          state.actualIncomeOverrides[month]={total:amount,updatedAt:new Date().toISOString()};
        }
      });
      if(!ok)alert('Werkelijk inkomen aanpassen is niet opgeslagen.');
    }
    else if(view==='close')u3OpenClose();
    else if(view==='transfers')u3OpenTransfers();
  }));
  root.querySelectorAll('[data-u3-add-recurring]').forEach(button=>button.addEventListener('click',()=>{
    u3OpenRecurringEditor(button.dataset.u3AddRecurring, '', {owner:button.dataset.u3RecurringOwner});
  }));
  root.querySelectorAll('[data-u3-edit-recurring]').forEach(button=>button.addEventListener('click',()=>{
    const [kind,id]=button.dataset.u3EditRecurring.split(':');
    u3OpenRecurringEditor(kind,id);
  }));
}
function u3RecurringRows(kind){
  if(kind==='income')return state.recurringIncomeSources||[];
  return state.recurringFixedExpenses?.[state.meta.scenario]||[];
}
function u3OpenPlanning(){
  const fixed=u3RecurringRows('fixed');
  const incomes=u3RecurringRows('income');
  const rows=(items,kind)=>items.map(item=>`<article class="u3-admin-row"><div class="u3-row-head"><div><strong>${textSafe(item.naam||'Zonder naam')}</strong><br><small>${u3AccountLabel(item.rekening)} → ${u3AccountLabel(item.financialFor||item.rekening)} · elke ${item.frequentieAantal} ${textSafe(item.frequentieEenheid)}</small></div><div><span class="u3-status ${item.actief!==false?'ok':''}">${item.actief!==false?'Actief':'Gestopt'}</span> <button class="ghost small" data-u3-edit-recurring="${kind}:${item.id}">Bewerken</button></div></div><div>${eur(u3AmountAt(item,getSelectedMonth()))} <small>· gemiddeld ${eur(u3MonthlyAverage(item))} p/m</small></div></article>`).join('');
  const {modal}=u3AdminModal(`<div class="u3-admin-head"><div><div class="section-kicker">${monthLabel(getSelectedMonth())} · ${state.meta.scenario==='voor'?'Voor verkoop':'Na verkoop'}</div><h2>Planning beheren</h2><p>Bedragen kunnen voor één maand of vanaf deze maand wijzigen.</p></div><button class="ghost" data-u3-close>Sluiten</button></div>
    <div class="u3-steps">
      <section class="u3-step"><div class="u3-step-head"><div><h3>Vaste lasten</h3><p>${fixed.length} terugkerende posten in dit scenario</p></div><button class="primary small" data-u3-add-recurring="fixed">+ Vaste last</button></div><div class="u3-admin-list">${rows(fixed,'fixed')||'<div class="u3-empty">Nog geen vaste lasten.</div>'}</div></section>
      <section class="u3-step"><div class="u3-step-head"><div><h3>Inkomstenbronnen</h3><p>${incomes.length} terugkerende bronnen</p></div><button class="primary small" data-u3-add-recurring="income">+ Inkomstenbron</button></div><div class="u3-admin-list">${rows(incomes,'income')||'<div class="u3-empty">Nog geen inkomstenbronnen.</div>'}</div></section>
    </div>`);
  modal.querySelectorAll('[data-u3-add-recurring]').forEach(button=>button.addEventListener('click',()=>u3OpenRecurringEditor(button.dataset.u3AddRecurring)));
  modal.querySelectorAll('[data-u3-edit-recurring]').forEach(button=>button.addEventListener('click',()=>{const [kind,id]=button.dataset.u3EditRecurring.split(':');u3OpenRecurringEditor(kind,id);}));
}
function u3OpenRecurringEditor(kind,id='',defaults={}){
  const existing=u3RecurringRows(kind).find(item=>item.id===id);
  const income=kind==='income';
  const current=getSelectedMonth();
  const value=existing?u3AmountAt(existing,current):0;
  const defaultOwner=U3_ACCOUNTS.includes(defaults.owner)?defaults.owner:'gezamenlijk';
  const {modal}=u3AdminModal(`<div class="u3-admin-head"><div><div class="section-kicker">${income?'Inkomstenbron':'Vaste last'}</div><h2>${existing?'Bewerken':'Toevoegen'}</h2></div><button class="ghost" data-u3-close>Sluiten</button></div>
    <div class="u3-grid">
      <label class="full">Naam<input id="u3RecName" value="${textSafe(existing?.naam||'')}"></label>
      <label>Bedrag<input id="u3RecAmount" type="number" step="0.01" inputmode="decimal" value="${Number(value)||''}"></label>
      ${income?`<label>Type<select id="u3RecCategory">${['loon','toeslag','vergoeding/teruggave','overig'].map(value=>`<option ${existing?.type===value?'selected':''}>${value}</option>`).join('')}</select></label>`:`<label>Categorie<input id="u3RecCategory" value="${textSafe(existing?.categorie||'Overig')}"></label>`}
      <label>Fysieke rekening<select id="u3RecAccount">${U3_ACCOUNTS.map(value=>`<option value="${value}" ${(existing?.rekening||defaultOwner)===value?'selected':''}>${u3AccountLabel(value)}</option>`).join('')}</select></label>
      <label>Financieel voor<select id="u3RecFor">${U3_ACCOUNTS.map(value=>`<option value="${value}" ${(existing?.financialFor||existing?.rekening||defaultOwner)===value?'selected':''}>${u3AccountLabel(value)}</option>`).join('')}</select></label>
      ${income?`<label>Eigenaar<select id="u3RecOwner">${U3_ACCOUNTS.map(value=>`<option value="${value}" ${(existing?.eigenaar||'gezamenlijk')===value?'selected':''}>${u3AccountLabel(value)}</option>`).join('')}</select></label><label class="u2-checkbox"><input id="u3RecDistribution" type="checkbox" ${existing?.meetellenVoorVerdeling!==false?'checked':''}> Meetellen voor verdeling</label>`:''}
      <label>Elke<input id="u3RecFrequency" type="number" min="1" step="1" value="${existing?.frequentieAantal||1}"></label>
      <label>Frequentie<select id="u3RecUnit">${U3_FREQUENCY_UNITS.map(value=>`<option value="${value}" ${existing?.frequentieEenheid===value?'selected':''}>${value}</option>`).join('')}</select></label>
      <label>Begindatum<input id="u3RecStart" type="date" value="${textSafe(existing?.begindatum||`${current}-01`)}"></label>
      <label>Einddatum<input id="u3RecEnd" type="date" value="${textSafe(existing?.einddatum||'')}"></label>
      <label>Bedrag wijzigen<select id="u3RecScope"><option value="from">Vanaf ${monthLabel(current)}</option><option value="once">Alleen ${monthLabel(current)}</option></select></label>
      <label class="u2-checkbox"><input id="u3RecActive" type="checkbox" ${existing?.actief!==false?'checked':''}> Actief</label>
    </div>
    <div class="modal-actions">${existing?'<button class="danger-ghost" id="u3RecDelete">Stoppen</button>':''}<button class="ghost" data-u3-back-planning>Terug</button><button class="primary" id="u3RecSave">Opslaan</button></div>`);
  modal.querySelector('[data-u3-back-planning]')?.addEventListener('click',u3OpenPlanning);
  modal.querySelector('#u3RecDelete')?.addEventListener('click',()=>{
    try{u3AssertMonthOpen();commitChange(()=>{existing.actief=false;existing.einddatum=existing.einddatum||u3IsoDate(new Date(`${current}-01T12:00:00`));},{render:false});u3OpenPlanning();}catch(error){alert(error.message);}
  });
  modal.querySelector('#u3RecSave').addEventListener('click',()=>{
    try{
      u3AssertMonthOpen();
      const name=modal.querySelector('#u3RecName').value.trim();
      const amount=round2(bankAmount(modal.querySelector('#u3RecAmount').value));
      if(!name||!Number.isFinite(amount)||amount<0)throw new Error('Vul een naam en een geldig bedrag in.');
      commitChange(()=>{
        const item=existing||{id:uid(),amountHistory:[],monthOverrides:{},recognition:{text:'',counterparty:'',amountTolerance:5}};
        item.naam=name;item.rekening=modal.querySelector('#u3RecAccount').value;item.financialFor=modal.querySelector('#u3RecFor').value;
        item.frequentieAantal=Math.max(1,Math.floor(Number(modal.querySelector('#u3RecFrequency').value)||1));item.frequentieEenheid=modal.querySelector('#u3RecUnit').value;
        item.begindatum=modal.querySelector('#u3RecStart').value||`${current}-01`;item.einddatum=modal.querySelector('#u3RecEnd').value;item.actief=modal.querySelector('#u3RecActive').checked;
        if(income){item.type=modal.querySelector('#u3RecCategory').value;item.eigenaar=modal.querySelector('#u3RecOwner').value;item.meetellenVoorVerdeling=modal.querySelector('#u3RecDistribution').checked;item.verwachtBedrag=amount;}
        else{item.categorie=modal.querySelector('#u3RecCategory').value.trim()||'Overig';item.bedrag=amount;}
        item.amountHistory=Array.isArray(item.amountHistory)?item.amountHistory:[];item.monthOverrides=isPlainObject(item.monthOverrides)?item.monthOverrides:{};
        if(modal.querySelector('#u3RecScope').value==='once')item.monthOverrides[current]=amount;
        else{delete item.monthOverrides[current];item.amountHistory=item.amountHistory.filter(row=>String(row.effectiveFrom).slice(0,7)!==current);item.amountHistory.push({id:`amount-${item.id}-${current}`,effectiveFrom:`${current}-01`,amount});}
        if(!existing)u3RecurringRows(kind).push(item);
      },{render:false});
      u3OpenPlanning();
    }catch(error){alert(error.message);}
  });
}
function u3ReviewOccurrenceOptions(row){
  const month=String(row.date||'').slice(0,7)||getSelectedMonth();
  const fixed=u3FixedOccurrences(month).filter(item=>!u3LinkedActual('fixed',item.id,month)).map(item=>`<option value="fixed|${item.id}">Vaste last · ${textSafe(item.naam)} · ${eur(item.amount)}</option>`);
  const incomes=u3IncomeOccurrences(month).filter(item=>!u3LinkedActual('income',item.id,month)).map(item=>`<option value="income|${item.id}">Inkomen · ${textSafe(item.naam)} · ${eur(item.amount)}</option>`);
  return '<option value="">Geen koppeling</option>'+fixed.concat(incomes).join('');
}
function u3OpenReview(){
  const rows=u3PendingReviews();
  const rowHtml=rows.map(row=>{
    const suggestion=u3SuggestedRecognition(row.description,row.account,Math.abs(Number(row.amount)||0));
    const financialFor=suggestion?.financialFor||row.financialFor||row.account||'gezamenlijk';
    const category=suggestion?.category||row.category||'Overig';
    return `<article class="u3-admin-row" data-u3-review-row="${row.id}">
      <div class="u3-row-head"><div><strong>${textSafe(row.description||'Zonder omschrijving')}</strong><br><small>${textSafe(row.date)} · ${u3AccountLabel(row.account)} · ${row.kind==='inkomen'?'bijschrijving':'afschrijving'}</small></div><strong class="${row.kind==='inkomen'?'value pos':'value neg'}">${eur(Math.abs(Number(row.amount)||0))}</strong></div>
      <div class="u3-review-fields">
        <label>Financieel voor<select data-u3-review-for>${U3_ACCOUNTS.map(value=>`<option value="${value}" ${financialFor===value?'selected':''}>${u3AccountLabel(value)}</option>`).join('')}</select></label>
        <label>Categorie<input data-u3-review-category value="${textSafe(category)}"></label>
        <label class="full">Koppeling<select data-u3-review-link>${u3ReviewOccurrenceOptions(row)}</select></label>
        <label class="u2-checkbox"><input type="checkbox" data-u3-review-advance ${(row.account||'gezamenlijk')!==financialFor?'checked':''}> Voorschot/schuld bij afwijkende rekening</label>
      </div>
      <div class="u3-admin-actions"><button class="ghost small" data-u3-ignore-review="${row.id}">Negeren</button><button class="primary small" data-u3-confirm-review="${row.id}">Bevestigen</button></div>
    </article>`;
  }).join('');
  const {modal}=u3AdminModal(`<div class="u3-admin-head"><div><div class="section-kicker">${monthLabel(getSelectedMonth())}</div><h2>Transacties controleren</h2><p>Suggesties worden nooit automatisch bevestigd.</p></div><button class="ghost" data-u3-close>Sluiten</button></div><div class="u3-admin-list">${rowHtml||'<div class="u3-empty">Alles is gecontroleerd.</div>'}</div>`);
  modal.querySelectorAll('[data-u3-ignore-review]').forEach(button=>button.addEventListener('click',()=>{
    commitChange(()=>{const row=state.transactionReviewQueue.find(item=>item.id===button.dataset.u3IgnoreReview);if(row)row.reviewStatus='genegeerd';},{render:false});u3OpenReview();
  }));
  modal.querySelectorAll('[data-u3-confirm-review]').forEach(button=>button.addEventListener('click',()=>{
    try{
      u3AssertMonthOpen();
      const source=state.transactionReviewQueue.find(item=>item.id===button.dataset.u3ConfirmReview);
      const editor=button.closest('[data-u3-review-row]');
      if(!source||!editor)return;
      const financialFor=editor.querySelector('[data-u3-review-for]').value;
      const link=editor.querySelector('[data-u3-review-link]').value;
      const tx={...source,id:source.transactionId||uid(),reviewStatus:'bevestigd',owner:financialFor,account:source.account||'gezamenlijk',financialFor,category:editor.querySelector('[data-u3-review-category]').value.trim()||'Overig'};
      delete tx.rawData;delete tx.transactionId;
      tx.fixedExpenseId='';tx.fixedOccurrenceId='';tx.incomeSourceId='';tx.incomeOccurrenceId='';
      if(link){const separator=link.indexOf('|');const type=link.slice(0,separator);const occurrenceId=link.slice(separator+1);if(u3LinkedActual(type,occurrenceId,transactionMonth(tx)))throw new Error('Dit betaalmoment is al aan een andere transactie gekoppeld.');const occurrence=(type==='fixed'?u3FixedOccurrences(transactionMonth(tx)):u3IncomeOccurrences(transactionMonth(tx))).find(item=>item.id===occurrenceId);if(type==='fixed'){tx.fixedOccurrenceId=occurrenceId;tx.fixedExpenseId=occurrence?.itemId||'';tx.kind='vaste-last';}else{tx.incomeOccurrenceId=occurrenceId;tx.incomeSourceId=occurrence?.itemId||'';tx.kind='inkomen';}}
      commitChange(()=>{
        state.transactions.push(tx);
        source.reviewStatus='bevestigd';source.confirmedTransactionId=tx.id;
        u3RememberRecognition(tx);
        if(editor.querySelector('[data-u3-review-advance]').checked)u3CreateAdvanceForTransaction(tx);
      },{render:false});
      u3OpenReview();
    }catch(error){alert(error.message);}
  }));
}
function u3OpenClose(){
  const month=getSelectedMonth();
  const record=u3MonthRecord(month);
  const summary=u3MonthSummary(month);
  const control=u3AccountControl(month);
  const pending=u3PendingReviews(month).length;
  const budgets=U3_ACCOUNTS.flatMap(owner=>u3BudgetSummary(owner,month).map(row=>({...row,owner})));
  const budgetHtml=budgets.map(row=>`<div class="u3-budget-row"><strong>${u3AccountLabel(row.owner)} · ${textSafe(row.category)}</strong><span>${row.budget===null?'Geen budget ingesteld':eur(row.budget)}</span><span>${eur(row.actual)}</span><span class="${row.difference<0?'value neg':'value pos'}">${eur(row.difference)}</span></div>`).join('');
  const accounts=U3_ACCOUNTS.map(account=>{const setting=state.accountSettings[account];const row=control[account];return `<div class="u3-account-row"><div><strong>${u3AccountLabel(account)}</strong><br><small>Administratief ${eur(row.calculatedEnd)} · opening ${eur(row.opening)}</small></div><input data-u3-actual="${account}" type="number" step="0.01" inputmode="decimal" placeholder="Banksaldo"><label class="u2-checkbox"><input data-u3-correct="${account}" type="checkbox"> corrigeer verschil</label>${setting?.openingBalanceSet?'':`<div><input data-u3-opening="${account}" type="number" step="0.01" placeholder="Openingssaldo"><button class="ghost small" data-u3-save-opening="${account}">Eenmalig vastleggen</button></div>`}</div>`;}).join('');
  const {modal}=u3AdminModal(`<div class="u3-admin-head"><div><div class="section-kicker">${monthLabel(month)}</div><h2>Maandafsluiting</h2><p>Afgesloten geschiedenis blijft als onveranderlijke snapshot bewaard.</p></div><span class="u3-status ${record.status==='afgesloten'?'closed':pending?'pending':'ok'}">${record.status==='afgesloten'?'Afgesloten':pending?`${pending} transacties open`:'Open'}</span><button class="ghost" data-u3-close>Sluiten</button></div>
    <div class="u3-steps">
      <section class="u3-step"><div class="u3-step-head"><div><h3>1. Controle</h3><p>Alleen ongecontroleerde transacties blokkeren.</p></div><span class="u3-status ${pending?'warn':'ok'}">${pending?`${pending} te doen`:'Compleet'}</span></div><div class="u3-grid"><div>Verwacht inkomen<br><strong>${eur(summary.expectedIncome)}</strong></div><div>Werkelijk inkomen<br><strong>${eur(summary.actualIncome)}</strong></div><div>Geplande vaste lasten<br><strong>${eur(summary.plannedFixed)}</strong></div><div>Werkelijke uitgaven<br><strong>${eur(summary.actualExpenses)}</strong></div></div><div class="u3-budget-list">${budgetHtml||'<small>Geen variabele budgetten.</small>'}</div></section>
      <section class="u3-step"><div class="u3-step-head"><div><h3>2. Rekeningstanden</h3><p>Een verschil wijzigt alleen met een expliciete correctie het volgende saldo.</p></div></div>${accounts}</section>
      <section class="u3-step"><div class="u3-step-head"><div><h3>3. Overboekingen</h3><p>Zakgeld, sparen en netto voorschotten worden als voorstellen klaargezet.</p></div></div>${u3NetAdvances(month).map(row=>`<div>${u3AccountLabel(row.debtor)} → ${u3AccountLabel(row.creditor)} <strong>${eur(row.amount)}</strong></div>`).join('')||'<small>Geen openstaande voorschotten.</small>'}</section>
      <section class="u3-step"><div class="u3-step-head"><div><h3>4. Bevestigen</h3><p>Open bankcontroles geven een waarschuwing maar blokkeren afsluiten niet.</p></div></div><div class="modal-actions">${record.status==='afgesloten'?'<button class="danger-ghost" id="u3ReopenMonth">Maand heropenen</button>':pending?'<button class="ghost" id="u3GoTransactions">Ga naar banktransacties</button><button class="primary" id="u3CloseMonthForce">Toch maand sluiten</button>':'<button class="primary" id="u3CloseMonth">Maand afsluiten</button>'}</div></section>
    </div>`);
  modal.querySelectorAll('[data-u3-save-opening]').forEach(button=>button.addEventListener('click',()=>{
    const account=button.dataset.u3SaveOpening;const value=bankAmount(modal.querySelector(`[data-u3-opening="${account}"]`).value);
    if(!Number.isFinite(value)){alert('Vul een geldig openingssaldo in.');return;}
    commitChange(()=>{state.accountSettings[account]={openingBalance:round2(value),effectiveMonth:month,openingBalanceSet:true};},{render:false});u3OpenClose();
  }));
  modal.querySelector('#u3ReopenMonth')?.addEventListener('click',()=>{commitChange(()=>u3ReopenMonth(month),{render:false});u3OpenClose();});
  modal.querySelector('#u3GoTransactions')?.addEventListener('click',()=>{
    modal.closest('#incomeEditModal')?.classList.remove('open','u3-admin-open');
    bankImportOpen=true;renderActiveTab();
    [...document.querySelectorAll('.manage-section')].find(item=>item.querySelector('summary')?.textContent.includes('Bank import & uitgaven'))?.setAttribute('open','');
  });
  const closeMonth=(force=false)=>{
    try{
      const actual={};const corrections=[];
      U3_ACCOUNTS.forEach(account=>{const value=bankAmount(modal.querySelector(`[data-u3-actual="${account}"]`).value);if(Number.isFinite(value))actual[account]=value;if(modal.querySelector(`[data-u3-correct="${account}"]`).checked)corrections.push(account);});
      commitChange(()=>u3CloseMonth(month,actual,corrections,{force}),{render:false});u3OpenClose();
    }catch(error){alert(error.message);}
  };
  modal.querySelector('#u3CloseMonth')?.addEventListener('click',()=>closeMonth(false));
  modal.querySelector('#u3CloseMonthForce')?.addEventListener('click',()=>closeMonth(true));
}
function u3OpenTransfers(){
  const month=getSelectedMonth();
  const rows=(state.internalTransfers||[]).filter(row=>row.month===month);
  const html=rows.map(row=>`<article class="u3-admin-row"><div class="u3-transfer-row"><div><strong>${textSafe(row.destination||row.type)}</strong><br><small>${u3AccountLabel(row.sourceAccount)}${row.targetAccount?` → ${u3AccountLabel(row.targetAccount)}`:''} · ${row.status}</small></div><input data-u3-transfer-amount="${row.id}" type="number" step="0.01" value="${Number(row.actualAmount??row.calculatedAmount)||0}" ${row.status==='uitgevoerd'?'disabled':''}><button class="${row.status==='uitgevoerd'?'ghost':'primary'} small" data-u3-confirm-transfer="${row.id}" ${row.status==='uitgevoerd'?'disabled':''}>${row.status==='uitgevoerd'?'Uitgevoerd':'Bevestig'}</button></div></article>`).join('');
  const {modal}=u3AdminModal(`<div class="u3-admin-head"><div><div class="section-kicker">${monthLabel(month)}</div><h2>Interne overboekingen</h2><p>Uitvoering is handmatig; bevestigde aflossingen tellen niet als inkomen of uitgave.</p></div><button class="ghost" data-u3-close>Sluiten</button></div><div class="u3-admin-list">${html||'<div class="u3-empty">Nog geen voorstellen. Sluit de maand eerst af.</div>'}</div>`);
  modal.querySelectorAll('[data-u3-confirm-transfer]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.u3ConfirmTransfer;const amount=bankAmount(modal.querySelector(`[data-u3-transfer-amount="${id}"]`).value);
    if(!Number.isFinite(amount)||amount<0){alert('Vul een geldig bedrag in.');return;}
    commitChange(()=>u3ConfirmTransfer(id,amount,u3IsoDate(new Date())),{render:false});u3OpenTransfers();
  }));
}

const u3LegacyMonthlyScenarioData=getMonthlyScenarioData;
getMonthlyScenarioData=function(scenario=state.meta.scenario){
  const base=u3LegacyMonthlyScenarioData(scenario);
  const month=getSelectedMonth();
  const result=clone(base);
  U3_ACCOUNTS.forEach(account=>{
    const planned=u3FixedOccurrences(month,scenario).filter(row=>row.financialFor===account);
    result[account]=result[account]||{};
    result[account].vasteLasten=planned.filter(row=>row.source.legacyKind!=='hypotheek').map(row=>({id:row.id,categorie:row.categorie,post:row.naam,bedrag:row.amount,u3OccurrenceId:row.id}));
    if(account==='gezamenlijk')result[account].hypotheek=planned.filter(row=>row.source.legacyKind==='hypotheek').map(row=>({id:row.id,categorie:row.categorie,post:row.naam,bedrag:row.amount,u3OccurrenceId:row.id}));
  });
  return result;
};
// Update 41/42: behoud de historische standaardwaarden. De oude Update-3
// overrides hieronder mogen de nieuwe inkomenshistorie niet opnieuw vervangen.
getMonthlyBaseIncome=function(person,month=getSelectedMonth()){
  return getDistributionIncomeParts(person,month).salary;
};
sumVasteTeruggaven=function(person,month=getSelectedMonth()){
  return getDistributionIncomeParts(person,month).refund;
};
getMonthTransactions=function(owner=null,month=getSelectedMonth()){
  return (state.transactions||[]).filter(tx=>transactionMonth(tx)===month&&(tx.reviewStatus||'bevestigd')==='bevestigd'&&(!owner||(tx.financialFor||tx.owner)===owner));
};

window.FinizeUpdate3=Object.freeze({
  schemaVersion:U3_SCHEMA_VERSION,
  occurrenceDates:(item,month)=>u3OccurrenceDates(clone(item),month),
  plannedOccurrences:(items,month)=>u3PlannedOccurrences(clone(items),month),
  amountAt:(item,dateOrMonth)=>u3AmountAt(clone(item),dateOrMonth),
  monthlyAverage:item=>u3MonthlyAverage(clone(item)),
  budgetSummary:(owner,month,scenario)=>u3BudgetSummary(owner,month,scenario),
  monthSummary:month=>u3MonthSummary(month),
  accountControl:month=>u3AccountControl(month),
  expectedIncome:(month,financialFor)=>u3ExpectedIncome(month,financialFor),
  actualIncome:(month,financialFor)=>u3ActualIncome(month,financialFor),
  actualExpenses:(month,financialFor)=>u3ActualExpenses(month,financialFor),
  reserveDelta:(owner,month,scenario)=>u3ReserveDelta(owner,month,scenario),
  reserveBalance:(owner,throughMonth)=>u3ReserveBalance(owner,throughMonth),
  netAdvances:month=>u3NetAdvances(month),
  closeMonth:(month,actualBalances,correctionAccounts)=>u3CloseMonth(month,actualBalances,correctionAccounts),
  reopenMonth:month=>u3ReopenMonth(month),
  confirmTransfer:(id,amount,date,status)=>u3ConfirmTransfer(id,amount,date,status),
  suggestRecognition:(description,account,amount)=>clone(u3SuggestedRecognition(description,account,amount)),
  normalize:candidate=>u3NormalizeState(clone(candidate))
});

window.FinizeUpdate2=Object.freeze({
  schemaVersion:U2_SCHEMA_VERSION,
  calculateGroup:(goals,pot,today)=>calcGroep(clone(goals),pot,new Date(today)),
  normalizeSubgoals:goal=>{const copy=clone(goal);u2NormalizeChildren(copy);return copy;},
  historyKey:u2HistoryKey
});

u2NormalizeState(state);
ensurePersistentIds(state);
localSave(state);
committedStateSnapshot=clone(state);

window.__finizeBootstrap={
  coreReady:false,
  update4Ready:false,
  update5Ready:false,
  rendered:false,
  initialRenderCount:0
};
window.__finizeMaybeFinishBootstrap=function(){
  const bootstrap=window.__finizeBootstrap;
  if(bootstrap.rendered||!bootstrap.coreReady||!bootstrap.update4Ready||!bootstrap.update5Ready)return false;
  bootstrap.rendered=true;
  bootstrap.initialRenderCount+=1;
  renderActiveTab();
  CloudAdapter.connect();
  return true;
};
async function initializeApp(){
  try{
    const imagesMigrated = await GoalImageStore.initializeState(state);
    if (imagesMigrated) localSave(state);
  }catch(error){
    console.warn('Lokale spaardoelfoto-opslag kon niet worden voorbereid.', error);
  }
  window.__finizeBootstrap.coreReady=true;
  window.__finizeMaybeFinishBootstrap();
}
initializeApp();
