// Income links are administrative; internal capital links retain their existing offset.
// Bank amounts, income, allowances and goal movements are never rewritten here.
const cents=value=>Math.round(Number(value)*100);
export const isSavingsIncomeSource=source=>source?.active&&source.effects.accountCashflow>0&&source.effects.incomeImpact>0;
export function savingsContributionCapacity(source){
  return Math.min(cents(source.amount),cents(source.effects.accountCashflow),cents(isSavingsIncomeSource(source)?source.effects.incomeImpact:source.transaction.processing?.contributionAmount));
}
export function applySavingsContributions(rows,state){
  const goals=new Set(Object.values(state.spaardoelen||{}).flat().map(goal=>goal.id));
  const byId=new Map(rows.map(p=>[p.id,p])),claims=new Map(),pending=[];
  for(const deposit of rows){
    const choice=deposit.transaction.processing||{},sourceId=choice.savingsContributionId;
    if(!sourceId)continue;
    const source=byId.get(sourceId),origin=source?.transaction.processing||{};
    const amount=Number(choice.savingsContributionAmount),amountCents=cents(amount);
    let error='';
    if(!deposit.active)continue;
    if(!source?.active)error='De gekoppelde inleg ontbreekt of is niet goedgekeurd.';
    else if(!isSavingsIncomeSource(source)&&(!['interne-overboeking','extra-bijdrage'].includes(source.transactionType)||source.effects.accountCashflow<=0))error='De bron moet ontvangen inkomen of een interne inleg zijn.';
    else if(!(deposit.effects.savingsDeposit>0)||!goals.has(deposit.savingsGoalId)||!isSavingsIncomeSource(source)&&origin.contributionGoalId!==deposit.savingsGoalId)error='De inleg en spaarboeking moeten hetzelfde bestaande spaardoel hebben.';
    else if(source.calendarMonth!==deposit.calendarMonth||source.financialFor!==deposit.financialFor)error='De inleg en spaarboeking moeten dezelfde maand en budgeteigenaar hebben.';
    else if(!Number.isSafeInteger(amountCents)||amountCents<=0||Math.abs(amount*100-amountCents)>1e-6||amountCents>cents(deposit.effects.savingsDeposit))error='De gekoppelde inleg moet binnen het spaarbedrag passen.';
    if(error){deposit.savingsContributionError=error;continue;}
    const cap=savingsContributionCapacity(source);
    if(!Number.isSafeInteger(cap)||cap<=0){deposit.savingsContributionError='Vul een geldig inlegbedrag in bij de interne ontvangst.';continue;}
    claims.set(sourceId,(claims.get(sourceId)||0)+amountCents);pending.push({deposit,sourceId,cap,amountCents,income:isSavingsIncomeSource(source)});
  }
  for(const {deposit,sourceId,cap,amountCents,income} of pending){
    if(claims.get(sourceId)>cap){deposit.savingsContributionError='Deze inleg is vaker of voor een hoger bedrag gekoppeld dan beschikbaar.';continue;}
    deposit.savingsContribution={sourceId,amountCents,kind:income?'income':'existing-capital'};
    if(!income)deposit.effects.existingCapitalDeposit=amountCents/100;
  }
}
