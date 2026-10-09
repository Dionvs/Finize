const {test}=require('node:test'),assert=require('node:assert/strict');
test('Opslagmeldingen behouden financiële oorzaak en geven concrete browseracties',async()=>{
 const {describeMutationError}=await import('../src/core/mutation-errors.mjs');
 const business=new Error('Onvoldoende saldo in spaardoel Vakantie: €40,00 beschikbaar.');assert.equal(describeMutationError(business),business);
 for(const name of ['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED']){const error={name};assert.match(describeMutationError(error).message,/browseropslag is vol/);assert.equal(describeMutationError(error).cause,error);}
 assert.match(describeMutationError({code:22}).message,/browseropslag is vol/);
 assert.match(describeMutationError({code:1014}).message,/browseropslag is vol/);
 assert.match(describeMutationError({name:'SecurityError'}).message,/browserinstellingen/);
 assert.match(describeMutationError(null).message,/Onbekende opslagfout/);
 assert.equal(describeMutationError({message:'Specifieke validatiefout'}).message,'Specifieke validatiefout');
});
