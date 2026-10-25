import assert from 'node:assert/strict';
import { createBankService } from '../../functions/src/enable-banking.mjs';
import { digest, adoptLegacyBankMetadata, normalizeIban } from '../../functions/src/bank-registry.mjs';

export const clock = Date.parse('2026-10-25T12:00:00Z');
export function syntheticIban(number) {
  const account=String(number).padStart(10,'0'), rearranged='INGB'+account+'NL00'; let remainder=0;
  for(const char of rearranged)for(const digit of /[A-Z]/.test(char)?String(char.charCodeAt(0)-55):char)remainder=(remainder*10+Number(digit))%97;
  return 'NL'+String(98-remainder).padStart(2,'0')+'INGB'+account;
}
export function memoryBankStore() {
  const records=new Map();let queue=Promise.resolve();
  const clone=value=>value===undefined?null:structuredClone(value);
  const store={get:async key=>clone(records.get(key)),set:async(key,value)=>{records.set(key,clone(value));},
    transaction(action){const task=queue.then(async()=>{const writes=new Map();let writing=false;
      const result=await action({get:async key=>{assert(!writing,'Firestore reads must precede writes');return clone(records.get(key));},set:(key,value)=>{writing=true;writes.set(key,clone(value));}});
      for(const [key,value] of writes)records.set(key,value);return result;});queue=task.catch(()=>{});return task;},
    update(key,fn){return store.transaction(async tx=>{const value=fn(await tx.get(key));tx.set(key,value);return value;});},
    listRetired:async(limit=6,prefix='retired-')=>[...records].filter(([key,value])=>key.startsWith(prefix)&&value?.revokePending).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([key,value])=>({key,value:clone(value)}))};
  return {store,records};
}
export function multiFixture() {
  const {store,records}=memoryBankStore(),calls=[],sessions=new Map(),states=new Map(),disabledUsers=new Set();
  let time=clock,exchangeOverride=null,transactionHook=null,revokeFailure=false;
  const entries=['dion','gezamenlijk','dara'].map((owner,i)=>({owner,actorRole:owner==='gezamenlijk'?'dion':owner,
    accountProfileId:'profile-'+owner,uid:owner==='dara'?'uid-dara':'uid-dion',email:owner==='dara'?'dara@example.invalid':'dion@example.invalid',
    householdId:'synthetic-house',iban:syntheticIban(i+1),accountHash:'hash-'+owner,enabled:true,providerLinked:true}));
  const dion=entries[0],config={enabled:true,applicationId:'synthetic-app',...dion,email:dion.email,aspspName:'ING',redirectUrl:'https://synthetic.invalid/callback',
    registry:{version:1,providerMode:'restricted',controlPanelUid:'uid-dion',accounts:entries}};
  const profiles=new Map(entries.map(entry=>[entry.accountProfileId,{id:entry.accountProfileId,accountOwner:entry.owner,identifier:entry.iban,status:'active'}]));
  const assignments=new Map([['dion@example.invalid',{householdId:'synthetic-house',role:'dion'}],['dara@example.invalid',{householdId:'synthetic-house',role:'dara'}]]);
  const until=()=>new Date(time+86400000).toISOString();
  const account=entry=>({uid:'account-'+entry.owner,identification_hash:entry.accountHash,identification_hashes:[entry.accountHash],account_id:{iban:entry.iban}});
  records.set('connection',{uid:dion.uid,householdId:dion.householdId,accountProfileId:dion.accountProfileId,sessionId:'session-dion',accountUid:'account-dion',accountHash:dion.accountHash,validUntil:until(),retentionVersion:1,revocationVersion:0,requiredPsuHeaders:[]});
  records.set('account-binding',{version:1,uid:dion.uid,householdId:dion.householdId,accountProfileId:dion.accountProfileId,ibanHash:digest(normalizeIban(dion.iban)),accountHash:dion.accountHash,establishedAt:time-1000});
  sessions.set('session-dion',{entry:dion,account:account(dion),validUntil:until()});
  const provider=async(method,path,body)=>{
    calls.push({method,path,body});
    if(path.startsWith('/aspsps'))return {aspsps:[{name:'ING',country:'NL',psu_types:['personal'],maximum_consent_validity:86400}]};
    if(path==='/auth') {const entry=entries.find(e=>e.iban===body.access.accounts[0].iban);states.set(entry.owner,body.state);return {url:'https://auth.enablebanking.com/ais/start?synthetic=1'};}
    if(path==='/sessions') {const owner=body.code.replace('code-',''),entry=entries.find(e=>e.owner===owner);const result=exchangeOverride?await exchangeOverride(entry):{session_id:'session-'+owner,access:{valid_until:until()},accounts:[account(entry),...(owner==='gezamenlijk'?[account(dion)]:[])]};
      if(!sessions.has(result.session_id))sessions.set(result.session_id,{entry,account:account(entry),validUntil:result.access.valid_until});return result;}
    if(path.startsWith('/sessions/')) {const id=decodeURIComponent(path.slice('/sessions/'.length)),session=sessions.get(id);if(method==='DELETE'){if(revokeFailure)throw new Error('Synthetic revoke failure');sessions.delete(id);return {};}
      return session?{status:'AUTHORIZED',access:{valid_until:session.validUntil},accounts:[session.account.uid],accounts_data:[session.account]}:{status:'EXPIRED'};}
    if(path.includes('/transactions?')) {if(transactionHook)await transactionHook(path);return {transactions:[{entry_reference:'same-reference-across-accounts',status:'BOOK',booking_date:'2026-10-25',transaction_amount:{amount:'10.00',currency:'EUR'},credit_debit_indicator:'DBIT',remittance_information:['Synthetic test']}],continuation_key:null};}
    if(path.endsWith('/balances'))return {balances:[]};
    throw new Error('Unexpected synthetic request');
  };
  const dependencies={config,store,provider,now:()=>time,verifyToken:async token=>({uid:'uid-'+token,email:token+'@example.invalid',email_verified:true}),
    verifyIdentity:async(uid,email)=>!disabledUsers.has(uid)&&entries.some(e=>e.uid===uid&&e.email===email),
    readAssignment:async email=>assignments.get(email),readProfile:async(house,id)=>house==='synthetic-house'?profiles.get(id):null};
  const service=()=>createBankService(dependencies);
  return {config,entries,dion,store,records,calls,sessions,states,profiles,assignments,disabledUsers,dependencies,service,account,
    adopt:apply=>adoptLegacyBankMetadata({config,store,apply,now:time}),
    async connect(owner,token=owner==='dara'?'dara':'dion'){await service().start(token,'profile-'+owner);await service().callback({state:states.get(owner),code:'code-'+owner});},
    sync:(owner,token=owner==='dara'?'dara':'dion')=>service().sync(token,{accountProfileId:'profile-'+owner,fromDate:'2026-10-24',toDate:'2026-10-25'}),
    overrideExchange:hook=>{exchangeOverride=hook;},onTransactions:hook=>{transactionHook=hook;},failRevoke:value=>{revokeFailure=value;},advance:ms=>{time+=ms;}};
}
