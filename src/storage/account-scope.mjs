const LEGACY_STORAGE_KEY = 'finize-budget-planner-v1';
const LEGACY_BACKUP_KEY = 'finize-budget-planner-v1-last-good-backup';
const LEGACY_MIGRATION_KEY = 'finize-budget-planner-v1-pre-schema-v5';

function cleanSegment(value){
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g,'_');
}

export function normalizeAccountSession(session){
  if (session?.status === 'disabled') return Object.freeze({mode:'legacy'});
  const uid = cleanSegment(session?.user?.uid);
  const householdId = cleanSegment(session?.assignment?.householdId);
  const role = cleanSegment(session?.assignment?.role);
  if (session?.status !== 'ready' || !uid || !householdId || !['dion','dara'].includes(role)) return null;
  return Object.freeze({mode:'account',uid,householdId,role});
}

export function storageKeysForSession(session){
  const scope = normalizeAccountSession(session);
  if (!scope) return null;
  if (scope.mode === 'legacy') return Object.freeze({
    state:LEGACY_STORAGE_KEY,
    backup:LEGACY_BACKUP_KEY,
    migration:LEGACY_MIGRATION_KEY
  });
  const suffix = `${scope.householdId}:${scope.uid}`;
  return Object.freeze({
    state:`${LEGACY_STORAGE_KEY}:account:${suffix}`,
    backup:`${LEGACY_BACKUP_KEY}:account:${suffix}`,
    migration:`${LEGACY_MIGRATION_KEY}:account:${suffix}`
  });
}

export function cloudBudgetDocumentPath(session){
  const scope = normalizeAccountSession(session);
  if (!scope) return null;
  return scope.mode === 'legacy'
    ? Object.freeze(['budgetPlanners','finize'])
    : Object.freeze(['households',scope.householdId,'budgetState','current']);
}

export function cloudImportDocumentPath(session,importId){
  const scope = normalizeAccountSession(session);
  const id = cleanSegment(importId);
  if (!scope || !id) return null;
  return scope.mode === 'legacy'
    ? Object.freeze(['budgetPlanners','finize','imports',id])
    : Object.freeze(['households',scope.householdId,'imports',id]);
}

export function cloudImportChunkPath(session,importId,chunkId){
  const parent = cloudImportDocumentPath(session,importId);
  const id = cleanSegment(chunkId);
  return parent && id ? Object.freeze([...parent,'chunks',id]) : null;
}
