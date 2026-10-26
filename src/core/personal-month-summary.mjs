import { decimalAmountToCents } from '../import/bank-input-contract.mjs';

/** Personal overview arithmetic; never adds income to the household or changes savings. */
export function personalMonthRemaining({income,fixed,usedBudget}){
  const cents=decimalAmountToCents(income)-decimalAmountToCents(fixed)-decimalAmountToCents(usedBudget);
  if(!Number.isSafeInteger(cents))throw new Error('Maandbedrag valt buiten het exacte centbereik.');
  return cents/100;
}
