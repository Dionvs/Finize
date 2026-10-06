import json,base64,time,urllib.request,urllib.error
from pathlib import Path
base='http://127.0.0.1:8181/v1/projects/demo-finize-release/databases/(default)/documents/'
assert base.startswith('http://127.0.0.1:')
def b64(obj):return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip('=')
token=b64({'alg':'none','typ':'JWT'})+'.'+b64({'iss':'https://securetoken.google.com/demo-finize-release','aud':'demo-finize-release','sub':'release-user','user_id':'release-user','iat':int(time.time()),'exp':int(time.time())+3600,'email':'release@example.invalid','email_verified':True,'firebase':{'sign_in_provider':'password'}})+'.'
def val(v):
 if isinstance(v,dict):return {'mapValue':{'fields':{k:val(x) for k,x in v.items()}}}
 if isinstance(v,bool):return {'booleanValue':v}
 if isinstance(v,int):return {'integerValue':str(v)}
 if isinstance(v,list):return {'arrayValue':{'values':[val(x) for x in v]}}
 return {'stringValue':v}
def request(method,path,data=None,admin=False,auth=True):
 headers={'Content-Type':'application/json'}
 if auth:headers['Authorization']='Bearer '+('owner' if admin else token)
 payload=None if data is None else json.dumps({'fields':{k:val(v) for k,v in data.items()}}).encode()
 try:
  with urllib.request.urlopen(urllib.request.Request(base+path,data=payload,method=method,headers=headers),timeout=15) as r:return r.status,json.load(r) if method!='DELETE' else {}
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def seed(path,data):
 status,res=request('PATCH',path,data,admin=True);assert status==200,(path,status,res)
results=[]
def check(name,method,path,data=None,allow=True,auth=True):
 status,res=request(method,path,data,auth=auth);ok=status==200 if allow else status==403
 results.append({'id':name,'pass':ok,'http':status})
 if not ok: print(json.dumps({'failure':name,'response':res}));raise AssertionError(name)
seed('accountLinks/release@example.invalid',{'householdId':'release-house','role':'dion','displayName':'Test'})
seed('households/release-house',{'label':'isolated'})
seed('households/other-house',{'label':'other isolated'})
seed('budgetPlanners/finize',{'closed':'legacy'})
check('E1-own-household','GET','households/release-house')
check('E2-cross-household-denied','GET','households/other-house',allow=False)
check('E3-default-deny','PATCH','unlisted/test',{'test':True},allow=False)
core='households/release-house/budgetState/current'
check('E4-core-create','PATCH',core,{'syncVersion':1,'commitId':'c1'})
check('E4-core-increment','PATCH',core,{'syncVersion':2,'commitId':'c2'})
check('E4-core-stale-denied','PATCH',core,{'syncVersion':2,'commitId':'stale'},allow=False)
batch='households/release-house/imports/b1'
check('E5-batch-create','PATCH',batch,{'version':1,'operationId':'op1','lifecycle':'active'})
chunk=batch+'/chunks/op2-0'
check('E6-chunk-create','PATCH',chunk,{'payload':'isolated test chunk'})
check('E6-chunk-identical-retry','PATCH',chunk,{'payload':'isolated test chunk'})
check('E6-chunk-overwrite-denied','PATCH',chunk,{'payload':'different'},allow=False)
check('E5-batch-CAS','PATCH',batch,{'version':2,'baseVersion':1,'operationId':'op2','lifecycle':'active'})
check('E5-batch-stale-denied','PATCH',batch,{'version':3,'baseVersion':1,'operationId':'stale','lifecycle':'active'},allow=False)
check('E7-terminal-tombstone','PATCH',batch,{'version':3,'baseVersion':2,'operationId':'delete','lifecycle':'deleted'})
check('E8-stale-resurrection-denied','PATCH',batch,{'version':4,'baseVersion':3,'operationId':'resurrect','lifecycle':'active'},allow=False)
check('E8-new-chunk-after-delete-denied','PATCH',batch+'/chunks/stale',{'payload':'stale'},allow=False)
check('E9-legacy-denied','GET','budgetPlanners/finize',allow=False)
check('E10-member-client-write','PATCH','households/release-house/members/release-user',{'uid':'release-user','email':'release@example.invalid','householdId':'release-house','role':'dion','displayName':'Test','sharePersonalTab':False,'hiddenKpis':[],'joinedAt':'isolated','updatedAt':'isolated'})
check('E10-unauthenticated-denied','GET','households/release-house',allow=False,auth=False)

root='households/release-house/budgetState/current'
gen=root+'/generations/g1'
meta={'schemaVersion':11,'revision':5000,'updatedAt':'isolated','updatedBy':'device-a'}
descriptor={'generation':'g1','stateFormat':'finize-json-chunks-v1','schema':11,'stateMeta':meta,'chunkCount':2,'totalByteLength':2,'totalSha256':'a'*64,'complete':False}
check('T15-generation-create','PATCH',gen,descriptor)
header={'app':'finize','schema':11,'revision':5000,'syncVersion':3,'baseVersion':2,'commitId':'g1','stateFormat':'finize-json-chunks-v1','activeGeneration':'g1','chunkCount':2,'totalByteLength':2,'totalSha256':'a'*64,'stateMeta':meta}
check('T9-incomplete-current-denied','PATCH',root,header,allow=False)
check('T9-no-chunks-seal-denied','PATCH',gen,{**descriptor,'complete':True},allow=False)
def chunk(n):return {'generation':'g1','sequence':n,'chunkCount':2,'payload':'x','byteLength':1,'cumulativeBytes':n+1,'sha256':'b'*64}
check('T9-out-of-order-chunk-denied','PATCH',gen+'/chunks/1',chunk(1),allow=False)
check('T5-first-chunk-create','PATCH',gen+'/chunks/0',chunk(0))
check('T15-chunk-overwrite-denied','PATCH',gen+'/chunks/0',{**chunk(0),'payload':'changed'},allow=False)
check('T9-partial-seal-denied','PATCH',gen,{**descriptor,'complete':True},allow=False)
check('T5-second-chunk-create','PATCH',gen+'/chunks/1',chunk(1))
check('T10-complete-seal','PATCH',gen,{**descriptor,'complete':True})
check('T10-complete-current','PATCH',root,header)
check('T11-stale-current-denied','PATCH',root,header,allow=False)
check('T12-backward-revision-denied','PATCH',root,{**header,'syncVersion':4,'baseVersion':3,'revision':4998,'stateMeta':{**meta,'revision':4998}},allow=False)
check('T15-complete-descriptor-immutable','PATCH',gen,{**descriptor,'complete':True,'totalSha256':'f'*64},allow=False)
check('T15-complete-chunk-immutable','PATCH',gen+'/chunks/1',{**chunk(1),'payload':'wrong'},allow=False)
check('T15-chunk-delete-denied','DELETE',gen+'/chunks/1',allow=False)
check('T15-other-household-read-denied','GET','households/other-house/budgetState/current/generations/g1',allow=False)
check('T15-other-household-write-denied','PATCH','households/other-house/budgetState/current/generations/g1',descriptor,allow=False)
check('T15-other-generation-current-denied','PATCH',root,{**header,'syncVersion':4,'baseVersion':3,'activeGeneration':'other-house-g1'},allow=False)
check('T15-header-count-mismatch-denied','PATCH',root,{**header,'syncVersion':4,'baseVersion':3,'chunkCount':1},allow=False)
check('T15-legacy-client-inline-rollback-denied','PATCH',root,{'state':{'meta':{'schemaVersion':9}},'syncVersion':4,'commitId':'legacy','revision':5001},allow=False)
check('T15-own-chunk-read','GET',gen+'/chunks/0')
check('T15-own-generation-read','GET',gen)
print(json.dumps({'emulator':'PASS','checks':len(results),'productionAccess':False,'results':results}))
