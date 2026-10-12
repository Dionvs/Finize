const {expect}=require('@playwright/test');
async function savingsSourceProof(page,ids){
  return page.evaluate(ids=>{
    const sources=state.transactions.filter(r=>r.recordRole==='bank-source'&&ids.includes(r.id));
    const bankIds=new Set(sources.map(r=>r.bankSourceId));
    return {sources,effects:state.transactions.filter(r=>r.recordRole!=='bank-source'&&bankIds.has(r.bankSourceId)),savings:FinizeTransactions.total('savingsDeposit',{month:'2026-10'})};
  },ids);
}
function assertSavingsSourceProof(proof,count,originals=null){
  expect(proof.sources).toHaveLength(count);expect(proof.effects).toHaveLength(count);
  expect(new Set(proof.sources.map(r=>r.id)).size).toBe(count);
  expect(new Set(proof.sources.map(r=>r.bankSourceId)).size).toBe(count);
  expect(new Set(proof.effects.map(r=>r.id)).size).toBe(count);
  for(const source of proof.sources){
    expect(source.processingStatus).toBe('goedgekeurd');expect(source.approvalSource).toBe('manual');
    expect(source.approvedProcessing.transactionType).toBe('naar-spaarrekening');expect(source.approvedProcessing.savingsGoalId).toBe('goal');
    const effects=proof.effects.filter(r=>r.bankSourceId===source.bankSourceId);expect(effects).toHaveLength(1);
    const effect=effects[0];expect(effect.processingStatus).toBe('goedgekeurd');expect(effect.savingsGoalId||effect.processing?.savingsGoalId).toBe('goal');
    expect(Math.round(Math.abs(effect.amount)*100)).toBe(Math.round(Math.abs(source.bankOriginal.amount)*100));
    expect(effect.bankOriginal).toEqual(source.bankOriginal);
    expect(effect.transactionDate||effect.bankOriginal.bankDate||effect.date).toBe(source.bankOriginal.bankDate);
    expect(effect.accountProfileId).toBe(source.accountProfileId);
    if(originals)expect(source.bankOriginal).toEqual(originals.find(r=>r.id===source.id)?.bankOriginal);
  }
}
module.exports={savingsSourceProof,assertSavingsSourceProof};
