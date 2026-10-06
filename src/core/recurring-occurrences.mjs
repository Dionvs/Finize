import { resolveRecurringAmount, resolveRecurringConfig } from './planning-timeline.mjs';
const U3_FREQUENCY_UNITS=['weken','maanden','jaren'];
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
function u3AmountAt(item,dateOrMonth){
  return resolveRecurringAmount(item,String(dateOrMonth).slice(0,7));
}
function u3OccurrenceDates(item, month){
  item=resolveRecurringConfig(item,month);
  if(!item)return [];
  const bounds = u3MonthBounds(month);
  const start = u3ParseDate(item?.begindatum);
  const end = item?.einddatum ? u3ParseDate(item.einddatum) : null;
  if (!bounds || !start || (item?.actief === false && !end)) return [];
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
function u3OccurrenceId(itemId,date){ return `${itemId}:${date}`; }
function u3PlannedOccurrences(items,month){
  return (items||[]).map(item=>resolveRecurringConfig(item,month)).filter(Boolean).flatMap(item=>u3OccurrenceDates(item,month).map(date=>({
    id:u3OccurrenceId(item.id,date),itemId:item.id,date,month:String(date).slice(0,7),
    naam:item.naam,categorie:item.categorie||'',account:item.rekening||item.account||'gezamenlijk',
    financialFor:item.financialFor||item.eigenaar||item.rekening||'gezamenlijk',
    amount:u3AmountAt(item,date),source:item
  })));
}

export { u3PlannedOccurrences as plannedOccurrences, u3OccurrenceDates as occurrenceDates };
