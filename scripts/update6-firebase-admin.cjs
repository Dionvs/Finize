const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const projectId = 'financien-7dd43';
const apiKey = 'AIzaSyCiJHGv9nlC_o4c2Xyj9UcyqHWW-YTxKfY';
const root = path.resolve(__dirname,'..');
const localLinkFile = path.join(root,'backups','update6-account-linking.local.json');
const firebaseToolsRoot = path.join(process.env.APPDATA || '','npm','node_modules','firebase-tools');

function firebaseModule(relative){ return require(path.join(firebaseToolsRoot,'lib',relative)); }

async function accessToken(){
  const {configstore} = firebaseModule('configstore');
  const refreshToken = configstore.get('tokens.refresh_token');
  if (!refreshToken) throw new Error('Firebase CLI is niet ingelogd.');
  const token = await firebaseModule('auth').getAccessToken(refreshToken,[]);
  return token.access_token;
}

async function api(url,{method='GET',body,allowMissing=false}={}){
  const response = await fetch(url,{
    method,
    headers:{Authorization:`Bearer ${await accessToken()}`,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  if (allowMissing && response.status === 404) return null;
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`${method} ${new URL(url).pathname} gaf ${response.status}: ${payload.error?.message || response.statusText}`);
  return payload;
}

function documentUrl(documentPath){
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath.split('/').map(encodeURIComponent).join('/')}`;
}

function collectionUrl(parentPath,collectionId){
  const parent=parentPath?`/${parentPath.split('/').map(encodeURIComponent).join('/')}`:'';
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents${parent}/${encodeURIComponent(collectionId)}`;
}

function stringValue(value){ return {stringValue:String(value)}; }
function integerValue(value){ return {integerValue:String(value)}; }
function fieldString(document,key){ return document?.fields?.[key]?.stringValue || ''; }
function fieldInteger(document,key){ return Number(document?.fields?.[key]?.integerValue || 0); }

async function readDocument(documentPath){ return api(documentUrl(documentPath),{allowMissing:true}); }

async function readCollection(parentPath,collectionId){
  const documents=[];
  let pageToken='';
  do{
    const url=new URL(collectionUrl(parentPath,collectionId));
    url.searchParams.set('pageSize','1000');
    if(pageToken)url.searchParams.set('pageToken',pageToken);
    const page=await api(url.toString());
    documents.push(...(page.documents||[]));
    pageToken=page.nextPageToken||'';
  }while(pageToken);
  return documents;
}

function documentId(document){ return decodeURIComponent(String(document.name||'').split('/').at(-1)); }

async function readLegacyImports(){
  const headers=await readCollection('budgetPlanners/finize','imports');
  return Promise.all(headers.map(async header=>({
    header,
    chunks:await readCollection(`budgetPlanners/finize/imports/${documentId(header)}`,'chunks')
  })));
}

async function createOrVerifyDocument(documentPath,fields){
  const existing = await readDocument(documentPath);
  if (existing){
    assert.deepEqual(existing.fields,fields,`Bestaand document wijkt af: ${documentPath}`);
    return 'verified';
  }
  await api(`${documentUrl(documentPath)}?currentDocument.exists=false`,{method:'PATCH',body:{fields}});
  return 'created';
}

async function replaceDocument(documentPath,fields){
  await api(documentUrl(documentPath),{method:'PATCH',body:{fields}});
  return 'replaced';
}

async function authConfig(){
  return api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`);
}

async function googleProvider(){
  return api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com`,{allowMissing:true});
}

async function authUsersByEmail(emails){
  const result=await api(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,{method:'POST',body:{email:emails}});
  return result.users||[];
}

async function inspect(){
  const linking = JSON.parse(fs.readFileSync(localLinkFile,'utf8'));
  const legacy = await readDocument('budgetPlanners/finize');
  const imports = await readLegacyImports();
  const target = await readDocument(`households/${linking.householdId}/budgetState/current`);
  const links = await Promise.all(linking.accounts.map(account=>readDocument(`accountLinks/${account.email.trim().toLowerCase()}`)));
  const config = await authConfig();
  const google = await googleProvider();
  const authUsers = await authUsersByEmail(linking.accounts.map(account=>account.email.trim().toLowerCase()));
  console.log(JSON.stringify({
    legacy:{exists:!!legacy,syncVersion:fieldInteger(legacy,'syncVersion'),revision:fieldInteger(legacy,'revision'),stateBytes:JSON.stringify(legacy?.fields?.state||{}).length,imports:imports.length,chunks:imports.reduce((sum,item)=>sum+item.chunks.length,0)},
    secureTarget:{exists:!!target,syncVersion:fieldInteger(target,'syncVersion'),revision:fieldInteger(target,'revision'),stateBytes:JSON.stringify(target?.fields?.state||{}).length},
    accountLinks:links.map((document,index)=>({role:linking.accounts[index].role,exists:!!document,householdId:fieldString(document,'householdId')})),
    auth:{emailEnabled:config.signIn?.email?.enabled===true,passwordRequired:config.signIn?.email?.passwordRequired===true,googleEnabled:google?.enabled===true,authorizedDomains:config.authorizedDomains || [],accounts:linking.accounts.map(account=>{const user=authUsers.find(item=>String(item.email||'').toLowerCase()===account.email.trim().toLowerCase());return {role:account.role,exists:!!user,emailVerified:user?.emailVerified===true,disabled:user?.disabled===true,providers:(user?.providerUserInfo||[]).map(provider=>provider.providerId)};})}
  },null,2));
}

async function backup(){
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const legacy = await readDocument('budgetPlanners/finize');
  if (!legacy) throw new Error('Het bestaande Finize-document ontbreekt.');
  const imports = await readLegacyImports();
  const config = await authConfig();
  const google = await googleProvider();
  const firestoreFile=path.join(root,'backups',`update6-firestore-before-${stamp}.json`);
  const authFile=path.join(root,'backups',`update6-auth-before-${stamp}.json`);
  fs.writeFileSync(firestoreFile,JSON.stringify({legacy,imports},null,2));
  fs.writeFileSync(authFile,JSON.stringify({config,google},null,2));
  console.log(JSON.stringify({firestore:path.basename(firestoreFile),auth:path.basename(authFile),stateBytes:JSON.stringify(legacy.fields?.state||{}).length,imports:imports.length,chunks:imports.reduce((sum,item)=>sum+item.chunks.length,0)}));
}

async function migrate({replaceState=false}={}){
  const linking = JSON.parse(fs.readFileSync(localLinkFile,'utf8'));
  assert.equal(linking.accounts.length,2,'Update 6 verwacht exact twee accounts.');
  assert.deepEqual(new Set(linking.accounts.map(account=>account.role)),new Set(['dion','dara']));
  const legacy = await readDocument('budgetPlanners/finize');
  if (!legacy) throw new Error('Het bestaande Finize-document ontbreekt.');

  const householdFields={
    name:stringValue('Dion & Dara'),
    memberLimit:integerValue(2),
    updateVersion:integerValue(6)
  };
  const householdResult=await createOrVerifyDocument(`households/${linking.householdId}`,householdFields);
  const statePath=`households/${linking.householdId}/budgetState/current`;
  const stateResult=replaceState
    ? await replaceDocument(statePath,legacy.fields)
    : await createOrVerifyDocument(statePath,legacy.fields);
  const legacyImports=await readLegacyImports();
  let importCount=0;
  let chunkCount=0;
  for(const item of legacyImports){
    const importId=documentId(item.header);
    await createOrVerifyDocument(`households/${linking.householdId}/imports/${importId}`,item.header.fields||{});
    importCount+=1;
    for(const chunk of item.chunks){
      await createOrVerifyDocument(`households/${linking.householdId}/imports/${importId}/chunks/${documentId(chunk)}`,chunk.fields||{});
      chunkCount+=1;
    }
  }
  const linkResults=[];
  for (const account of linking.accounts){
    const email=String(account.email||'').trim().toLowerCase();
    const displayName=account.role==='dara'?'Dara':'Dion';
    linkResults.push(await createOrVerifyDocument(`accountLinks/${email}`,{
      email:stringValue(email),role:stringValue(account.role),householdId:stringValue(linking.householdId),displayName:stringValue(displayName)
    }));
  }
  const target=await readDocument(`households/${linking.householdId}/budgetState/current`);
  assert.deepEqual(target.fields,legacy.fields,'De beveiligde state wijkt af van het bestaande document.');
  console.log(JSON.stringify({household:householdResult,state:stateResult,accountLinks:linkResults,stateExact:true,imports:importCount,chunks:chunkCount}));
}

async function enableEmailAuth(){
  const url=`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`;
  const result=await api(url,{method:'PATCH',body:{signIn:{email:{enabled:true,passwordRequired:true}}}});
  console.log(JSON.stringify({emailEnabled:result.signIn?.email?.enabled===true,passwordRequired:result.signIn?.email?.passwordRequired===true}));
}

async function authorizeDomain(){
  const domain=String(process.argv[3]||'').trim().toLowerCase();
  if(!/^[a-z0-9.-]+$/.test(domain))throw new Error('Geef een geldige domeinnaam op.');
  const config=await authConfig();
  const authorizedDomains=[...new Set([...(config.authorizedDomains||[]),domain])];
  const url=`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`;
  const result=await api(url,{method:'PATCH',body:{authorizedDomains}});
  assert.equal(result.authorizedDomains?.includes(domain),true,'Het domein is niet opgeslagen.');
  console.log(JSON.stringify({authorized:true,domainCount:result.authorizedDomains.length}));
}

async function verifyPublicBoundary(){
  const linking = JSON.parse(fs.readFileSync(localLinkFile,'utf8'));
  const status = async documentPath=>(await fetch(documentUrl(documentPath))).status;
  const result={
    legacy:await status('budgetPlanners/finize'),
    secureState:await status(`households/${linking.householdId}/budgetState/current`),
    accountLink:await status('accountLinks/unlinked-user@example.test')
  };
  assert.equal(result.legacy,200,'Het tijdelijke oude pad moet tijdens de overgang bereikbaar blijven.');
  assert.equal(result.secureState,403,'Het beveiligde huishoudpad mag niet openbaar leesbaar zijn.');
  assert.equal(result.accountLink,403,'Accountkoppelingen mogen niet openbaar leesbaar zijn.');
  console.log(JSON.stringify(result));
}

async function verifyFinalBoundary(){
  const linking = JSON.parse(fs.readFileSync(localLinkFile,'utf8'));
  const status = async documentPath=>(await fetch(documentUrl(documentPath))).status;
  const result={
    legacy:await status('budgetPlanners/finize'),
    secureState:await status(`households/${linking.householdId}/budgetState/current`),
    accountLink:await status('accountLinks/unlinked-user@example.test')
  };
  assert.deepEqual(result,{legacy:403,secureState:403,accountLink:403});
  console.log(JSON.stringify(result));
}

async function testAuthenticatedBoundary(){
  const linking=JSON.parse(fs.readFileSync(localLinkFile,'utf8'));
  const suffix=`${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const email=`update6-e2e-${suffix}@example.test`;
  const password=`Finize-${crypto.randomBytes(18).toString('base64url')}!`;
  let localId='';
  let idToken='';
  let linkCreated=false;
  try{
    const signupResponse=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})
    });
    const user=await signupResponse.json();
    if(!signupResponse.ok)throw new Error(user.error?.message||'Testaccount kon niet worden gemaakt.');
    localId=user.localId;
    await api(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,{
      method:'POST',body:{localId,emailVerified:true,displayName:'Update 6 test'}
    });
    await createOrVerifyDocument(`accountLinks/${email}`,{
      email:stringValue(email),role:stringValue('dion'),householdId:stringValue(linking.householdId),displayName:stringValue('Update 6 test')
    });
    linkCreated=true;
    const loginResponse=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})
    });
    const login=await loginResponse.json();
    if(!loginResponse.ok)throw new Error(login.error?.message||'Testaccount kon niet inloggen.');
    idToken=login.idToken;
    const authenticatedStatus=async documentPath=>(await fetch(documentUrl(documentPath),{headers:{Authorization:`Bearer ${idToken}`}})).status;
    const result={
      ownLink:await authenticatedStatus(`accountLinks/${email}`),
      otherLink:await authenticatedStatus('accountLinks/unlinked-user@example.test'),
      secureState:await authenticatedStatus(`households/${linking.householdId}/budgetState/current`)
    };
    assert.deepEqual(result,{ownLink:200,otherLink:403,secureState:200});
    console.log(JSON.stringify({...result,cleanup:'pending'}));
  }finally{
    if(linkCreated)await api(documentUrl(`accountLinks/${email}`),{method:'DELETE'}).catch(()=>{});
    if(localId)await api(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchDelete`,{method:'POST',body:{localIds:[localId],force:true}}).catch(()=>{});
    if(localId)console.log(JSON.stringify({testAccountRemoved:true,testLinkRemoved:true}));
  }
}

const command=process.argv[2];
({inspect,backup,migrate,'migrate-latest':()=>migrate({replaceState:true}),'enable-email-auth':enableEmailAuth,'authorize-domain':authorizeDomain,'verify-public-boundary':verifyPublicBoundary,'verify-final-boundary':verifyFinalBoundary,'test-auth-boundary':testAuthenticatedBoundary}[command] || (()=>{throw new Error('Onbekende Update 6-beheeropdracht.');}))()
  .catch(error=>{console.error(error.message);process.exitCode=1;});
