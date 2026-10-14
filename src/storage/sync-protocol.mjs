import { normalizeAccountIban, assertAccountProfileMutation } from '../core/account-profiles.mjs';
import { validateLiquiditySettings } from '../core/liquidity-settings.mjs';
export const CLOUD_CONFLICT_CODE = "finize/cloud-conflict";

export function mergeAccountProfiles(base=[],local=[],remote=[]) {
  const conflict=()=>{throw Object.assign(new Error('Rekeninggegevens verschillen tussen lokaal en cloud. Beide versies blijven bewaard; beoordeel het rekeningconflict.'),{code:CLOUD_CONFLICT_CODE,accountProfileConflict:true});};
  for(const rows of [base,local,remote])if(!Array.isArray(rows)||new Set(rows.map(row=>row.id)).size!==rows.length)conflict();
  const b=new Map(base.map(row=>[row.id,row])),l=new Map(local.map(row=>[row.id,row])),r=new Map(remote.map(row=>[row.id,row]));
  const result=[];
  for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])){
    const previous=b.get(id),left=l.get(id),right=r.get(id);
    if(previous&&(!left||!right))conflict();
    if(!left||!right){result.push(copyValue(left||right));continue;}
    if(!previous&&!sameValue(left,right))conflict();
    const merged={};
    for(const key of new Set([...Object.keys(previous||{}),...Object.keys(left),...Object.keys(right)])){
      if(['updatedAt','lastAccountOperationId','lastAccountOperationSignature'].includes(key)){
        const latest=String(left.updatedAt||'')>String(right.updatedAt||'')?left:right;
        if(latest[key]!==undefined)merged[key]=copyValue(latest[key]);continue;
      }
      const a=previous?.[key],x=left[key],y=right[key];
      if(!sameValue(x,a)&&!sameValue(y,a)&&!sameValue(x,y))conflict();
      const value=sameValue(x,a)?y:x;
      if(value!==undefined)merged[key]=copyValue(value);
    }
    result.push(merged);
  }
  const seen=new Map();
  for(const row of result){
    const iban=normalizeAccountIban(row.identifier||row.iban);
    if(!iban)continue;
    // Pre-existing legacy ambiguity is preserved, never newly introduced.
    if(seen.has(iban)&&!base.some(a=>a.id===row.id&&normalizeAccountIban(a.identifier||a.iban)===iban)&&!base.some(a=>a.id===seen.get(iban)&&normalizeAccountIban(a.identifier||a.iban)===iban))conflict();
    if(seen.has(iban)){
      const oldMatches=base.filter(a=>normalizeAccountIban(a.identifier||a.iban)===iban);
      if(!oldMatches.some(a=>a.id===row.id)||!oldMatches.some(a=>a.id===seen.get(iban)))conflict();
    }
    seen.set(iban,row.id);
  }
  try { for (const profile of result) validateLiquiditySettings(profile,result); } catch { conflict(); }
  return result;
}
export function assertAccountProfilesPreserved(previous,next,base=null) {
  try{
    assertAccountProfileMutation(previous,next);
    if(base){
      const merged=mergeAccountProfiles(base.accountProfiles||[],previous.accountProfiles||[],next.accountProfiles||[]);
      const byId=rows=>JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)),(_,value)=>isPlainObject(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
      if(byId(merged)!==byId(next.accountProfiles||[]))throw new Error('Lokale rekeningwijzigingen ontbreken in de cloudstand.');
    }else{
      for(const row of previous.accountProfiles||[]){const incoming=(next.accountProfiles||[]).find(item=>item.id===row.id);if(row.lastAccountOperationId&&!sameValue(row,incoming))throw new Error('Lokale rekeningwijzigingen zijn nog niet gezamenlijk bevestigd.');}
    }
  }catch(error){throw Object.assign(new Error(error.message),{code:CLOUD_CONFLICT_CODE,accountProfileConflict:true});}
}

export function assertCheckpointHistoryPreserved(previous, next) {
  const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const rows=new Map((next.balanceCheckpoints||[]).map(row=>[row.id,row]));
  for(const row of previous.balanceCheckpoints||[])if(canonical(rows.get(row.id))!==canonical(row))
    throw Object.assign(new Error('De cloudstand mist een bestaande saldo-waarneming of heeft deze gewijzigd. De lokale historie blijft behouden.'),{code:CLOUD_CONFLICT_CODE});
}

export function cloudDocumentVersion(documentData) {
  const value = Number(documentData?.syncVersion);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function cloudStateSignature(state) {
  const meta = state?.meta || {};
  return [
    Number(meta.revision) || 0,
    String(meta.updatedAt || ""),
    String(meta.updatedBy || "")
  ].join("|");
}

export function assertCloudBase(documentData, expectedVersion, expectedSignature) {
  // A confirmed missing document is the initial base used by attachSnapshot.
  // Never accept disappearance of an existing revision or signed state.
  if (!documentData && expectedVersion === 0 && expectedSignature === '') return 0;
  const actualVersion = cloudDocumentVersion(documentData);
  const actualSignature = cloudStateSignature(documentData?.state || { meta: documentData?.stateMeta });
  if (actualVersion !== expectedVersion || actualSignature !== expectedSignature) {
    const error = new Error("De cloud is intussen op een ander apparaat gewijzigd.");
    error.code = CLOUD_CONFLICT_CODE;
    error.actualVersion = actualVersion;
    error.actualSignature = actualSignature;
    throw error;
  }
  return actualVersion;
}

export function isStaleCloudSnapshot(documentData, currentVersion, currentSignature) {
  const incomingVersion = cloudDocumentVersion(documentData);
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 0) return false;
  if (incomingVersion < currentVersion) return true;
  return incomingVersion === currentVersion
    && !!currentSignature
    && cloudStateSignature(documentData?.state || { meta: documentData?.stateMeta }) !== currentSignature;
}

export function removeStaleIncomeOverrides(target) {
  let changed = false;
  const histories = target?.incomeDefaultsHistory || {};
  const overrides = target?.monthlyIncomeOverrides || {};
  const monthlyIncome = target?.monthlyIncome || {};
  Object.entries(overrides).forEach(([month, values]) => {
    if (!isPlainObject(values)) return;
    ["dion", "dara"].forEach(person => {
      if (!Object.prototype.hasOwnProperty.call(values, person)) return;
      const selected = (Array.isArray(histories[person]) ? histories[person] : [])
        .filter(row => String(row?.effectiveFrom || "") <= month)
        .sort((left, right) => String(left.effectiveFrom).localeCompare(String(right.effectiveFrom)))
        .at(-1);
      const storedMonthly = monthlyIncome?.[month]?.[person];
      if (!selected || !Number.isFinite(Number(storedMonthly))) return;
      if (Number(storedMonthly) === Number(selected.salary) && Number(values[person]) !== Number(selected.salary)) {
        delete values[person];
        changed = true;
      }
    });
    if (!Object.keys(values).length) delete overrides[month];
  });
  return changed;
}

function copyValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isIdArray(...values) {
  const rows = values.flat().filter(value => value !== undefined);
  return rows.length > 0 && rows.every(value => isPlainObject(value) && typeof value.id === "string" && value.id);
}

function rebaseIdArray(base, local, remote) {
  const baseById = new Map(base.map(item => [item.id, item]));
  const localById = new Map(local.map(item => [item.id, item]));
  const locallyDeleted = new Set(base.filter(item => !localById.has(item.id)).map(item => item.id));
  let result = remote
    .filter(item => !locallyDeleted.has(item.id))
    .map(item => {
      if (!localById.has(item.id)) return copyValue(item);
      return rebaseLocalChanges(baseById.get(item.id), localById.get(item.id), item);
    });
  const resultIds = new Set(result.map(item => item.id));
  local.forEach(item => {
    if (!resultIds.has(item.id) && (!baseById.has(item.id) || !sameValue(item, baseById.get(item.id)))) {
      result.push(copyValue(item));
    }
  });
  const baseOrder = base.map(item => item.id).filter(id => localById.has(id));
  const localOrder = local.map(item => item.id).filter(id => baseById.has(id));
  if (!sameValue(localOrder, baseOrder)) {
    const resultById = new Map(result.map(item => [item.id, item]));
    const locallyOrdered = local.map(item => resultById.get(item.id)).filter(Boolean);
    const localIds = new Set(locallyOrdered.map(item => item.id));
    result = [...locallyOrdered, ...result.filter(item => !localIds.has(item.id))];
  }
  return result;
}

// Neem de nieuwste cloudstand als basis en leg uitsluitend lokale verschillen
// daar opnieuw bovenop. Zo kan een vertraagde snapshot nooit een zojuist
// ingevoerde wijziging terugdraaien en worden onaangeraakte cloudvelden behouden.
export function rebaseLocalChanges(base, local, remote) {
  if([base,local,remote].some(value=>isPlainObject(value)&&Object.hasOwn(value,'accountProfiles'))){
    const profiles=mergeAccountProfiles(base?.accountProfiles||[],local?.accountProfiles||[],remote?.accountProfiles||[]);
    const without=value=>{if(!isPlainObject(value))return value;const copy={...value};delete copy.accountProfiles;return copy;};
    const result=rebaseLocalChanges(without(base),without(local),without(remote));
    result.accountProfiles=profiles;return result;
  }
  // Checkpoint history is append-only, including the first optional field from two
  // devices and snapshots from clients that do not yet know this field.
  if ([base,local,remote].some(value=>isPlainObject(value)&&Object.hasOwn(value,'balanceCheckpoints'))) {
    const rows=new Map(),canonical=value=>JSON.stringify(value,(_,item)=>isPlainObject(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
    for(const value of [base,remote,local]) {
      if(value?.balanceCheckpoints!==undefined&&!Array.isArray(value.balanceCheckpoints))throw Object.assign(new Error('De saldo-ijkpunthistorie is ongeldig; beide standen blijven behouden.'),{code:CLOUD_CONFLICT_CODE});
      for(const row of value?.balanceCheckpoints||[]) {
        if(!row?.id||rows.has(row.id)&&canonical(rows.get(row.id))!==canonical(row))throw Object.assign(new Error('Een bestaande saldo-waarneming is gewijzigd; beide standen blijven behouden.'),{code:CLOUD_CONFLICT_CODE});
        rows.set(row.id,copyValue(row));
      }
    }
    const without=value=>{if(!isPlainObject(value))return value;const result={...value};delete result.balanceCheckpoints;return result;};
    const result=rebaseLocalChanges(without(base),without(local),without(remote));
    if(!isPlainObject(result))throw Object.assign(new Error('De huishoudstand ontbreekt bij saldo-synchronisatie.'),{code:CLOUD_CONFLICT_CODE});
    result.balanceCheckpoints=[...rows.values()];
    return result;
  }
  if (sameValue(local, base)) return copyValue(remote);
  if (sameValue(remote, base)) return copyValue(local);
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    return isIdArray(base, local, remote) ? rebaseIdArray(base, local, remote) : copyValue(local);
  }
  if (isPlainObject(base) && isPlainObject(local) && isPlainObject(remote)) {
    const result = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    keys.forEach(key => {
      const baseHas = Object.prototype.hasOwnProperty.call(base, key);
      const localHas = Object.prototype.hasOwnProperty.call(local, key);
      const remoteHas = Object.prototype.hasOwnProperty.call(remote, key);
      if (baseHas && !localHas) return;
      if (!baseHas && localHas) {
        result[key] = copyValue(local[key]);
        return;
      }
      if (!localHas) {
        if (remoteHas) result[key] = copyValue(remote[key]);
        return;
      }
      result[key] = rebaseLocalChanges(base[key], local[key], remoteHas ? remote[key] : undefined);
    });
    return result;
  }
  return copyValue(local);
}
