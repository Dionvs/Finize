const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');

(async()=>{
  const contract = await import(pathToFileURL(path.resolve(__dirname,'../src/auth/contracts.mjs')).href);
  assert.equal(contract.normalizeAccountEmail('  Dion@Example.COM '),'dion@example.com');
  assert.equal(contract.persistenceMode(true),'local');
  assert.equal(contract.persistenceMode(false),'session');
  assert.equal(contract.authAccessState(null,null),'signed-out');
  assert.equal(contract.authAccessState({emailVerified:false},null),'unverified');
  assert.equal(contract.authAccessState({emailVerified:true},null),'unassigned');
  assert.equal(contract.authAccessState({emailVerified:true},{householdId:'dion-dara',role:'dion'}),'ready');
  assert.equal(contract.normalizeAssignment({householdId:'dion-dara',role:'anders'}),null);
  assert.deepEqual(
    contract.normalizeAssignment({householdId:' dion-dara ',role:'dara',displayName:' Dara '}),
    {householdId:'dion-dara',role:'dara',displayName:'Dara'}
  );
  assert.equal(contract.accountLinkDocumentId(' DARA@Example.COM '),'dara@example.com');
  assert.equal(contract.memberProfileDocumentId({uid:' uid-123 '}),'uid-123');
  assert.equal(contract.memberProfileSeed({uid:'uid-123',email:'Dion@Example.com',emailVerified:false},{householdId:'thuis',role:'dion'}),null);
  assert.deepEqual(
    contract.memberProfileSeed(
      {uid:'uid-123',email:' Dion@Example.COM ',emailVerified:true},
      {householdId:' thuis ',role:'dion',displayName:' Dion '}
    ),
    {
      uid:'uid-123',email:'dion@example.com',householdId:'thuis',role:'dion',displayName:'Dion',
      sharePersonalTab:false,hiddenKpis:[]
    }
  );
  console.log('UPDATE6_AUTH_CONTRACT_OK');
})().catch(error=>{ console.error(error); process.exitCode=1; });
