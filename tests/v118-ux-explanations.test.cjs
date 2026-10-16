const {test}=require('node:test');const assert=require('node:assert/strict');
test('uitleg is afgeleid van bestaande redenen zonder eigen classificatie of mutatie',async()=>{
  const {explainLiquidityReasons}=await import('../src/ui/liquidity-explanations.mjs');
  const p={status:'incomplete',reasons:[{code:'missing-checkpoint',message:'bronbericht'},{code:'missing-checkpoint',eventId:'tweede'},{code:'unknown-future-reason',message:'diagnostiek'}]};
  const before=JSON.stringify(p),rows=explainLiquidityReasons(p);
  assert.equal(rows.length,2);assert.match(rows[0].solution,/banksaldo/);assert.equal(rows[0].detail,'bronbericht');
  assert.equal(rows[1].problem,'De precieze oorzaak is niet bekend.');assert.equal(rows[1].detail,'diagnostiek');
  assert.equal(JSON.stringify(p),before);assert.deepEqual(explainLiquidityReasons({reasons:[]}),[]);
});
