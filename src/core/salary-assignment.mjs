import { getTransactionClassification, getTransactionFinancialDestination, getTransactionDate, isTransactionFinanciallyActive } from './transaction-model.mjs';

export const SALARY_PERSON_IDS=Object.freeze(['dion','dara']);
export const salarySourceId=person=>SALARY_PERSON_IDS.includes(person)?`income-defaults-salary-${person}`:'';
export function salaryPerson(tx,state={}){
  const explicit=tx.salaryPersonId||tx.processing?.salaryPersonId;
  if(explicit)return SALARY_PERSON_IDS.includes(explicit)?explicit:null;
  const destination=getTransactionFinancialDestination(tx);
  const source=(state.recurringIncomeSources||[]).find(row=>row.id===(tx.incomeSourceId||tx.processing?.incomeSourceId)&&row.legacyKind==='salary');
  if(source&&SALARY_PERSON_IDS.includes(source.eigenaar))return SALARY_PERSON_IDS.includes(destination)&&destination!==source.eigenaar?null:source.eigenaar;
  return SALARY_PERSON_IDS.includes(destination)?destination:null;
}
export function salaryLink(tx,state={},{requireChoice=false}={}){
  if(tx.bankOriginal&&Number(tx.bankOriginal.amount)<=0)throw Object.assign(new Error('Een salarisontvangst moet een bijschrijving zijn. Classificeer een terugboeking expliciet volgens haar financiële betekenis.'),{code:'salary-direction',field:'transactionType'});
  const person=requireChoice?(tx.salaryPersonId||tx.processing?.salaryPersonId):salaryPerson(tx,state);
  if(!SALARY_PERSON_IDS.includes(person))throw Object.assign(new Error('Kies Dion of Dara voor deze salarisbetaling. De salarisplanning kan pas daarna betrouwbaar worden vergeleken.'),{code:'salary-person-required',field:'salaryPersonId'});
  const month=getTransactionDate(tx).slice(0,7),sourceId=salarySourceId(person);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Een geldige bankmaand is vereist voor salaris.');
  const sources=(state.recurringIncomeSources||[]).filter(row=>row.legacyKind==='salary'&&row.eigenaar===person);
  const selected=sources.find(row=>row.id===(tx.incomeSourceId||tx.processing?.incomeSourceId))||(sources.length===1?sources[0]:null);
  return {salaryPersonId:person,salarySourceId:sourceId,salaryMonth:month,incomeSourceId:selected?.id||'',incomeOccurrenceId:`${sourceId}:${month}`};
}
const accountKey=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
// Only an exact employer account plus receiving account and prior manual approvals
// may propose a person. Neither amount similarity nor recognition rules decide it.
export function proposeSalaryPerson(original,transactions=[]){
  const employer=accountKey(original.counterpartyAccount),account=accountKey(original.accountIdentifier);
  if(!employer||!account)return '';
  const people=new Set(transactions.filter(tx=>tx.recordRole!=='bank-source'&&tx.approvalSource==='manual'&&isTransactionFinanciallyActive(tx)&&getTransactionClassification(tx)==='salaris'&&accountKey(tx.bankOriginal?.counterpartyAccount)===employer&&accountKey(tx.bankOriginal?.accountIdentifier)===account).map(tx=>salaryPerson(tx)).filter(Boolean));
  return people.size===1?[...people][0]:'';
}
