import { resolveVariableBudgetsForMonth } from './planning-timeline.mjs';

export const budgetNameKey=value=>String(value||'').trim().toLocaleLowerCase('nl-NL');
// IDs are authoritative. Legacy names resolve only to one exact, month-specific row.
// This is a read-only compatibility rule, never a migration or a fuzzy match.
export function resolveBudgetAssignment(state,month,owner,{category='',budgetItemId=''}={},resolvedRows=null){
  const rows=resolvedRows||resolveVariableBudgetsForMonth(state,month,owner);
  const matches=budgetItemId?rows.filter(row=>row.id===budgetItemId):rows.filter(row=>budgetNameKey(row.post||row.categorie)===budgetNameKey(category));
  return matches.length===1?matches[0]:null;
}
export function budgetAssignmentMatches(state,month,owner,assignment,category,budgetItemId=''){
  const assigned=resolveBudgetAssignment(state,month,owner,assignment);
  if(budgetItemId)return assigned?.id===budgetItemId;
  const wanted=resolveBudgetAssignment(state,month,owner,{category});
  if(wanted)return assigned?.id===wanted.id;
  return !assignment.budgetItemId&&!assigned&&!!budgetNameKey(category)&&budgetNameKey(assignment.category)===budgetNameKey(category);
}
// Called only inside an explicit financial save. Old stored transactions remain untouched.
export function bindBudgetAssignment(state,month,owner,line){
  const row=resolveBudgetAssignment(state,month,owner,line);
  if(line.budgetItemId&&!row)throw new Error('De gekozen budgetpost bestaat niet in deze maand voor deze eigenaar. Kies de budgetpost opnieuw.');
  return row?.id||'';
}
