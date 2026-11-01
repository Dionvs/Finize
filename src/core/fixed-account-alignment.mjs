// Explicit preparation only: never invoked on app startup or on live data automatically.
import {assertPlanningMonth,resolveRecurringConfig,setRecurringFromMonth} from './planning-timeline.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
const owners=new Set(['gezamenlijk','dion','dara']);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

export function prepareFixedAccountAlignment(state,fromMonth='2026-11'){
  assertPlanningMonth(fromMonth);
  if(!state||!Array.isArray(state.recurringFixedExpenses))throw new Error('Vaste lasten ontbreken in de aangeleverde gegevens.');
  const candidate=copy(state),changes=[];
  for(let index=0;index<state.recurringFixedExpenses.length;index++){
    const original=state.recurringFixedExpenses[index],item=candidate.recurringFixedExpenses[index];
    const base=copy(original);base.monthOverrides={};
    const historyMonths=[...new Set((original.amountHistory||[]).map(entry=>String(entry.effectiveFrom||'').slice(0,7)).filter(month=>month>fromMonth))].sort();
    const overrideMonths=Object.keys(original.monthOverrides||{}).filter(month=>month>=fromMonth).sort();
    const months=[fromMonth,...historyMonths,...overrideMonths];
    const inspect=(source,month)=>{
      const config=resolveRecurringConfig(source,month,{includeInactive:true});
      const owner=config.financialFor||config.rekening||'gezamenlijk';
      if(!owners.has(owner)||!owners.has(config.rekening||'gezamenlijk'))throw new Error(`Onbekende rekening voor vaste last ${original.id}.`);
      return {owner,account:config.rekening||'gezamenlijk',amount:config.bedrag};
    };
    const relevant=months.map(month=>({month,...inspect(original,month)}));
    const baseRelevant=[fromMonth,...historyMonths].map(month=>({month,...inspect(base,month)}));
    if(!relevant.some(row=>row.owner!==row.account)&&!baseRelevant.some(row=>row.owner!==row.account))continue;
    const overrides=copy(item.monthOverrides||{}),initial=inspect(base,fromMonth);
    // Resolve the base without a one-month override before inserting a version.
    const originalOverrides=item.monthOverrides;item.monthOverrides={};
    setRecurringFromMonth(item,fromMonth,{rekening:initial.owner,bedrag:initial.amount},{scope:'from'});
    item.monthOverrides=originalOverrides;
    item.monthOverrides=overrides;
    for(const entry of item.amountHistory||[]){
      const month=String(entry.effectiveFrom||'').slice(0,7);
      if(month<=fromMonth)continue;
      const owner=inspect(base,month).owner;
      entry.config={...(entry.config||{}),rekening:owner};
    }
    for(const month of overrideMonths){
      const before=original.monthOverrides[month],owner=inspect(original,month).owner;
      item.monthOverrides[month]=before!==null&&typeof before==='object'&&!Array.isArray(before)
        ?{...copy(before),config:{...(before.config||{}),rekening:owner}}
        :{amount:before,config:{rekening:owner}};
    }
    const periods=baseRelevant.filter(row=>row.owner!==row.account).map(row=>({kind:'vanaf',month:row.month,fromAccount:row.account,toAccount:row.owner,amount:row.amount}));
    for(const month of overrideMonths){const row=inspect(original,month);if(row.owner!==row.account)periods.push({kind:'maanduitzondering',month,fromAccount:row.account,toAccount:row.owner,amount:row.amount});}
    changes.push({id:original.id,naam:original.naam||'',fromMonth,periods});
  }
  return {candidate,changes};
}
