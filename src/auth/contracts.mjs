export const FINIZE_ROLES = Object.freeze(['dion', 'dara']);

export function normalizeAccountEmail(value){
  return String(value || '').trim().toLocaleLowerCase('en-US');
}

export function persistenceMode(staySignedIn){
  return staySignedIn ? 'local' : 'session';
}

export function normalizeAssignment(candidate){
  if (!candidate || !FINIZE_ROLES.includes(candidate.role)) return null;
  const householdId = String(candidate.householdId || '').trim();
  if (!householdId) return null;
  return Object.freeze({
    householdId,
    role:candidate.role,
    displayName:String(candidate.displayName || (candidate.role === 'dara' ? 'Dara' : 'Dion')).trim()
  });
}

export function accountLinkDocumentId(email){
  return normalizeAccountEmail(email);
}

export function memberProfileDocumentId(user){
  return String(user?.uid || '').trim();
}

export function memberProfileSeed(user, assignment){
  const normalizedAssignment = normalizeAssignment(assignment);
  const uid = memberProfileDocumentId(user);
  const email = normalizeAccountEmail(user?.email);
  if (!normalizedAssignment || !uid || !email || !user?.emailVerified) return null;
  return Object.freeze({
    uid,
    email,
    householdId:normalizedAssignment.householdId,
    role:normalizedAssignment.role,
    displayName:normalizedAssignment.displayName,
    sharePersonalTab:false,
    hiddenKpis:[]
  });
}

export function authAccessState(user, assignment){
  if (!user) return 'signed-out';
  if (!user.emailVerified) return 'unverified';
  return normalizeAssignment(assignment) ? 'ready' : 'unassigned';
}
