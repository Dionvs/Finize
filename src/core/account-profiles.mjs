// P1b uses the existing physical-account register. Ownership is deliberately
// unrestricted in this local version; these checks protect identity and history.
import { getTransactionProcessingStatus } from './transaction-model.mjs';
import { validateLiquiditySettings } from './liquidity-settings.mjs';
export const ACCOUNT_OWNERS = Object.freeze(['gezamenlijk','dion','dara']);
export const ACCOUNT_TYPES = Object.freeze(['payment','savings']);
export const normalizeAccountIban = value => String(value ?? '').toUpperCase().replace(/\s/g,'');
export const accountIsArchived = profile => profile?.status === 'archived';
export const availableAccountProfiles = (profiles, current='') => (profiles || []).filter(profile => !accountIsArchived(profile) || profile.id === current);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (code,message) => Object.assign(new Error(message),{code});
export function validDutchIban(value) {
  const iban = normalizeAccountIban(value);
  if (!/^NL\d{2}[A-Z]{4}\d{10}$/.test(iban)) return false;
  let remainder = 0;
  for (const char of iban.slice(4)+iban.slice(0,4)) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0)-55) : char;
    for (const digit of digits) remainder = (remainder*10+Number(digit))%97;
  }
  return remainder === 1;
}
export function accountHasReferences(state, profile, imports=[]) {
  const identifier = normalizeAccountIban(profile.identifier || profile.iban);
  const seen = new Set();
  function referenced(value) {
    if (typeof value === 'string') return value === profile.id || Boolean(identifier && normalizeAccountIban(value) === identifier);
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    return Object.values(value).some(referenced);
  }
  return Object.entries(state).some(([key,value]) => !['accountProfiles','meta','__finizePeriodContext'].includes(key) && referenced(value)) || referenced(imports);
}
function validateProfile(profile, previous, profiles) {
  validateLiquiditySettings(profile, profiles);
  if (typeof profile.id !== 'string' || !profile.id || !String(profile.name || '').trim() || String(profile.name).length>100) throw fail('invalid-account-name','Vul een herkenbare rekeningnaam van maximaal 100 tekens in.');
  if(String(profile.bank || '').length>100)throw fail('invalid-account-bank','Gebruik maximaal 100 tekens voor de banknaam.');
  if (!ACCOUNT_OWNERS.includes(profile.accountOwner)) throw fail('invalid-account-owner','Kies Gezamenlijk, Dion of Dara als eigenaar.');
  if ((!previous || profile.accountType !== previous.accountType) && !ACCOUNT_TYPES.includes(profile.accountType)) throw fail('invalid-account-type','Kies betaalrekening of spaarrekening.');
  if ((!previous || profile.status !== previous.status) && !['active','archived'].includes(profile.status)) throw fail('invalid-account-status','Kies een geldige rekeningstatus.');
  if (!previous || profile.identifier !== previous.identifier) {
    if (!validDutchIban(profile.identifier)) throw fail('invalid-iban','Vul een geldig Nederlands IBAN in, inclusief de juiste controlecijfers.');
    if (profiles.some(other => other.id !== profile.id && normalizeAccountIban(other.identifier || other.iban) === normalizeAccountIban(profile.identifier)))
      throw fail('duplicate-iban','Dit IBAN hoort al bij een rekening. Open die rekening of activeer haar opnieuw.');
  }
}
export function assertAccountProfileMutation(before, after, {imports=[]}={}) {
  const previous = new Map((before.accountProfiles || []).map(profile=>[profile.id,profile]));
  const next = after.accountProfiles || [];
  if (new Set(next.map(profile=>profile.id)).size !== next.length) throw fail('duplicate-account-id','Een rekening-ID komt dubbel voor.');
  for (const [id] of previous) if (!next.some(profile=>profile.id===id)) throw fail('account-delete-blocked','Archiveer de rekening; bestaande rekeningprofielen mogen niet worden verwijderd.');
  for (const profile of next) {
    const old = previous.get(profile.id);
    if (same(old,profile)) continue;
    validateProfile(profile,old,next);
    if (old && (old.identifier !== profile.identifier || old.accountOwner !== profile.accountOwner || old.iban !== profile.iban)) {
      if (before.__finizePartialHistory && !before.__finizePeriodContext?.explicitFullHistory)
        throw fail('account-history-incomplete','Laad eerst de volledige historie voordat je IBAN of eigenaar wijzigt.');
      if (accountHasReferences(before,old,imports)) throw fail('account-identity-in-use','Deze rekening heeft historie of verwijzingen. IBAN en eigenaar blijven behouden. Voeg voor een andere bankrekening een nieuw profiel toe.');
    }
  }
  const archived=new Set(next.filter(accountIsArchived).map(profile=>profile.id));
  const oldTransactions=new Map((before.transactions||[]).map(row=>[row.id,row]));
  const approved=row=>['goedgekeurd','niet-meetellen'].includes(getTransactionProcessingStatus(row||{}));
  for(const row of after.transactions||[]){
    if(!archived.has(row.accountProfileId))continue;
    const old=oldTransactions.get(row.id);
    if(row.recordRole==='bank-source' ? !old || !approved(old)&&approved(row) : !old && !(before.transactions||[]).some(source=>source.recordRole==='bank-source'&&source.bankSourceId===row.bankSourceId&&approved(source)))
      throw fail('account-archived','Heractiveer de rekening voordat je nieuwe transacties of bankmutaties toevoegt.');
  }
}
export function applyAccountProfileCommand(state, command, {imports=[]}={}) {
  if (typeof command?.operationId !== 'string' || !command.operationId || typeof command.id !== 'string' || !command.id || !Number.isFinite(Date.parse(command.createdAt))) throw fail('invalid-account-command','De opslagactie mist een geldige identiteit of vastlegtijd. Open het formulier opnieuw.');
  const profiles = state.accountProfiles || [], old = profiles.find(profile=>profile.id===command.id);
  const signature = JSON.stringify([command.type,command.id,command.values || {}]);
  if (old?.lastAccountOperationId === command.operationId) {
    if (old.lastAccountOperationSignature !== signature) throw fail('account-operation-conflict','Deze opslagactie is al voor andere rekeninggegevens gebruikt.');
    return old;
  }
  if (command.type === 'create' ? Boolean(old) : !old || !same(old,command.expectedProfile))
    throw fail('account-profile-conflict','De rekening is intussen gewijzigd. Open de actuele rekening opnieuw; je invoer blijft in dit formulier staan.');
  let profile;
  if (['create','update'].includes(command.type)) {
    const values = command.values || {};
    // Only explicitly editable metadata can enter the register.
    profile = {...old,id:command.id,name:String(values.name || '').trim(),bank:String(values.bank || '').trim(),
      identifier:command.type==='update' && values.identifier===old.identifier ? old.identifier : normalizeAccountIban(values.identifier),
      accountOwner:values.accountOwner,accountType:values.accountType,
      status:old?.status || 'active',csvFormat:old?.csvFormat || 'ing',createdAt:old?.createdAt || command.createdAt,updatedAt:command.createdAt};
    if (old?.iban && profile.identifier !== old.identifier) profile.iban = profile.identifier;
  } else if (command.type === 'liquidity-settings') {
    const values=command.values || {};
    profile={...old,liquidity:{version:1,primaryForOwner:values.primaryForOwner,bufferCents:values.bufferCents,salaryDays:structuredClone(values.salaryDays)},updatedAt:command.createdAt};
  } else if (['archive','reactivate'].includes(command.type)) profile = {...old,status:command.type==='archive'?'archived':'active',updatedAt:command.createdAt};
  else throw fail('invalid-account-command','Deze rekeningactie wordt niet ondersteund.');
  profile.lastAccountOperationId = command.operationId;
  profile.lastAccountOperationSignature = signature;
  const candidate = {...state,accountProfiles:old ? profiles.map(item=>item.id===old.id?profile:item) : [...profiles,profile]};
  assertAccountProfileMutation(state,candidate,{imports});
  state.accountProfiles = candidate.accountProfiles;
  return profile;
}
