// Optional metadata on the existing physical account. No financial bookings.
import { validCalendarDate } from '../import/import-identity.mjs';
export const validPaymentDay = day => day === 'last' || Number.isInteger(day) && day >= 1 && day <= 31;
export function monthlyPaymentDate(month, day) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !validPaymentDay(day)) return null;
  const last = new Date(Number(month.slice(0,4)),Number(month.slice(5)),0,12).getDate();
  return month+'-'+String(day==='last'?last:Math.min(day,last)).padStart(2,'0');
}
export function fixedPaymentDay(source) {
  if (Object.hasOwn(source,'afschrijfdag')) return source.afschrijfdag;
  return validCalendarDate(source.afschrijfdatum) ? Number(source.afschrijfdatum.slice(8)) : '';
}
export function fixedCashDate(occurrence) {
  const source=occurrence.source;
  if (source.cashDates?.[occurrence.id]) return source.cashDates[occurrence.id];
  if (source.frequentieEenheid==='weken') return Object.hasOwn(source,'afschrijfdag') ? occurrence.date : source.afschrijfdatum===occurrence.date?occurrence.date:null;
  return monthlyPaymentDate(occurrence.month,fixedPaymentDay(source));
}
export function liquidityBuffer(profile) {
  return profile?.liquidity?.bufferCents ?? (profile?.accountOwner === 'gezamenlijk' && profile?.liquidity?.primaryForOwner ? 20000 : 0);
}
export function validateLiquiditySettings(profile, profiles) {
  const value = profile.liquidity;
  if (value === undefined) return;
  const fail = message => { throw Object.assign(new Error(message), {code:'invalid-liquidity-settings'}); };
  if (!value || value.version !== 1 || typeof value.primaryForOwner !== 'boolean' || !Number.isSafeInteger(value.bufferCents) || value.bufferCents < 0)
    fail('Vul een niet-negatieve veiligheidsbuffer in hele eurocenten in.');
  if (value.primaryForOwner && profile.accountType !== 'payment') fail('Kies een betaalrekening voor de maandplanning.');
  if (value.primaryForOwner && profiles.some(p => p.id !== profile.id && p.accountOwner === profile.accountOwner && p.liquidity?.primaryForOwner))
    fail('Er is al een rekening voor deze maandplanning. Schakel die keuze daar eerst uit.');
  if (profile.accountOwner === 'gezamenlijk' && !value.primaryForOwner && value.bufferCents !== 0)
    fail('De gezamenlijke buffer hoort alleen bij de primaire gezamenlijke betaalrekening.');
  if (!value.salaryDays || typeof value.salaryDays !== 'object' || Array.isArray(value.salaryDays)) fail('Controleer de salarisbetaaldagen.');
  for (const [person, day] of Object.entries(value.salaryDays)) {
    if (!['dion','dara'].includes(person) || !validPaymentDay(day)) fail('Kies voor salaris een dag van 1 tot en met 31, de laatste dag, of laat het veld leeg.');
    if (profiles.some(p => p.id !== profile.id && p.liquidity?.salaryDays?.[person])) fail('Dit salaris is al aan een andere rekening gekoppeld. Verwijder die betaaldag daar eerst.');
  }
  if(value.allowanceDays!==undefined&&(!value.allowanceDays||typeof value.allowanceDays!=='object'||Array.isArray(value.allowanceDays)))fail('Controleer de zakgeldbetaaldagen.');
  for (const [person,day] of Object.entries(value.allowanceDays || {})) {
    if (!['dion','dara'].includes(person) || profile.accountOwner!==person || profile.accountType!=='payment' || !validPaymentDay(day)) fail('Koppel zakgeld aan de persoonlijke betaalrekening van de juiste eigenaar en kies een afschrijfdag.');
    if (profiles.some(p=>p.id!==profile.id && p.liquidity?.allowanceDays?.[person])) fail('Dit zakgeld is al aan een andere rekening gekoppeld. Verwijder die betaaldag daar eerst.');
  }
}
