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

export function authAccessState(user, assignment){
  if (!user) return 'signed-out';
  if (!user.emailVerified) return 'unverified';
  return normalizeAssignment(assignment) ? 'ready' : 'unassigned';
}
