const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async()=>{
  const scope = await import(pathToFileURL(path.resolve(__dirname,'../src/storage/account-scope.mjs')).href);
  const disabled = {status:'disabled'};
  const ready = {
    status:'ready',
    user:{uid:'user-dion'},
    assignment:{householdId:'dion-dara',role:'dion'}
  };

  assert.deepEqual(scope.storageKeysForSession(disabled),{
    state:'finize-budget-planner-v1',
    backup:'finize-budget-planner-v1-last-good-backup',
    migration:'finize-budget-planner-v1-pre-schema-v5'
  });
  assert.deepEqual(scope.cloudBudgetDocumentPath(disabled),['budgetPlanners','finize']);
  assert.deepEqual(scope.cloudImportDocumentPath(disabled,'import-1'),['budgetPlanners','finize','imports','import-1']);

  assert.deepEqual(scope.cloudBudgetDocumentPath(ready),['households','dion-dara','budgetState','current']);
  assert.deepEqual(scope.cloudImportDocumentPath(ready,'import-1'),['households','dion-dara','imports','import-1']);
  assert.deepEqual(scope.cloudImportChunkPath(ready,'import-1','0002'),['households','dion-dara','imports','import-1','chunks','0002']);
  assert.match(scope.storageKeysForSession(ready).state,/dion-dara:user-dion$/);
  assert.equal(scope.storageKeysForSession({status:'ready',user:{uid:'x'},assignment:{householdId:'h',role:'anders'}}),null);
  assert.equal(scope.cloudBudgetDocumentPath(null),null);

  console.log('UPDATE6_ACCOUNT_SCOPE_OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
