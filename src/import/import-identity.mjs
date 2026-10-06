const original=row=>row.bankOriginal||row;
const accountKey=(row,batch)=>String(row.accountContext||row.accountOwner||batch?.accountOwner||'')+'|'+String(original(row).accountIdentifier||batch?.accountProfileId||'');
export function immutableBankFields(row){const bank=original(row);return JSON.stringify([bank.bankDate,bank.transactionTime||'',bank.bookingDate||'',bank.amount,bank.rawDescription||bank.description,bank.description,bank.counterpartyAccount||'',bank.currency||'',bank.reference||'',bank.code||'',bank.notes||'',bank.rawCells||[]]);}
export function classifyCsvDuplicate(row,batch,existingBatches=[]){
  let possible=null;
  for(const oldBatch of existingBatches){if(oldBatch.lifecycle==='deleted')continue;
    for(const oldRow of oldBatch.rows||[]){if(accountKey(row,batch)!==accountKey(oldRow,oldBatch))continue;
      const sameFields=immutableBankFields(row)===immutableBankFields(oldRow);
      const proof=row.sourceIdentityProof,oldProof=oldRow.sourceIdentityProof;
      // A reference/merchant/amount hash is never a bank identity. File evidence includes
      // the original text and the logical ordinal, preserving identical rows in one file.
      const sameFile=proof?.kind==='file-row'&&oldProof?.kind==='file-row'&&Number.isSafeInteger(proof.rowOrdinal)&&proof.rowOrdinal>0&&proof.rowOrdinal===oldProof.rowOrdinal&&((typeof batch.originalCsv==='string'&&batch.originalCsv===oldBatch.originalCsv)||(/^[a-f0-9]{64}$/.test(proof.fileDigest||'')&&proof.fileDigest===oldProof.fileDigest));
      const bankIdentity=proof?.kind==='bank-id'&&oldProof?.kind==='bank-id'&&typeof proof.authority==='string'&&proof.authority.trim()!==''&&typeof proof.id==='string'&&proof.id.trim()!==''&&proof.authority===oldProof.authority&&proof.id===oldProof.id;
      if(sameFields&&(sameFile||bankIdentity))return {duplicate:true,duplicateSource:{batchId:oldBatch.id,rowId:oldRow.id},reason:'proven-source-identity'};
      if(sameFields)possible={duplicate:false,possibleDuplicate:{batchId:oldBatch.id,rowId:oldRow.id},reason:'equal-bank-fields'};
    }
  }
  return possible||{duplicate:false};
}
export function validCalendarDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))return false;const parsed=new Date(date+'T12:00:00Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;}
export function importDateError(original,today){if(!validCalendarDate(original.bankDate))return {code:'invalid-transaction-date',row:original.lineNumber,date:original.bankDate,message:'Ongeldige transactiedatum.'};if(original.bankDate>today)return {code:'future-transaction-date',row:original.lineNumber,date:original.bankDate,message:`Bankregel ${original.lineNumber}: transactiedatum ${original.bankDate} ligt in de toekomst.`};return null;}

// SHA-256 over original UTF-8 bytes. It identifies the complete source file, never a
// merchant/date/amount heuristic; row ordinal preserves multiplicity within that file.
export function csvFileDigest(text){
 const bytes=new TextEncoder().encode(String(text)),length=bytes.length,padded=new Uint8Array((Math.floor((length+8)/64)+1)*64);padded.set(bytes);padded[length]=128;
 const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(length/0x20000000));view.setUint32(padded.length-4,length*8);
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),rot=(n,b)=>(n>>>b)|(n<<(32-b));
 for(let offset=0;offset<padded.length;offset+=64){for(let n=0;n<16;n++)w[n]=view.getUint32(offset+n*4);for(let n=16;n<64;n++){const a=w[n-15],b=w[n-2];w[n]=(w[n-16]+(rot(a,7)^rot(a,18)^(a>>>3))+w[n-7]+(rot(b,17)^rot(b,19)^(b>>>10)))>>>0;}
 let[a,b,c,d,e,f,g,z]=h;for(let n=0;n<64;n++){const first=(z+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+k[n]+w[n])>>>0,second=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0;}[a,b,c,d,e,f,g,z].forEach((v,n)=>h[n]=(h[n]+v)>>>0);}
 return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
export function assertNoDuplicateSources(previous,next){
 const groups=new Map();for(const tx of next.transactions||[]){if(!tx.importBatchId||!tx.importTransactionId||tx.batchLifecycle==='withdrawn'||tx.processingStatus!=='goedgekeurd')continue;const proof=tx.sourceIdentityProof;if(proof?.kind!=='file-row'||!proof.fileDigest)continue;
 const key=JSON.stringify([tx.accountContext,tx.bankOriginal?.accountIdentifier||tx.accountProfileId,proof.fileDigest,proof.rowOrdinal]);const source=tx.importBatchId+':'+tx.importTransactionId;
 const old=groups.get(key);if(old&&old.source!==source){const unchanged=(previous.transactions||[]).some(row=>row.id===tx.id&&JSON.stringify(row)===JSON.stringify(tx))&&(previous.transactions||[]).some(row=>row.id===old.tx.id&&JSON.stringify(row)===JSON.stringify(old.tx));if(!unchanged)throw Object.assign(new Error('Dezelfde bewezen CSV-bron heeft twee actieve imports. Herstel/goedkeuring is geblokkeerd.'),{code:'duplicate-source-conflict'});}else groups.set(key,{source,tx});
 }
}
