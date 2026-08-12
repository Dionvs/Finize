export const CLOUD_CONFLICT_CODE = "finize/cloud-conflict";

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
  const actualVersion = cloudDocumentVersion(documentData);
  const actualSignature = cloudStateSignature(documentData?.state);
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
    && cloudStateSignature(documentData?.state) !== currentSignature;
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
  const result = remote
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
  return result;
}

// Neem de nieuwste cloudstand als basis en leg uitsluitend lokale verschillen
// daar opnieuw bovenop. Zo kan een vertraagde snapshot nooit een zojuist
// ingevoerde wijziging terugdraaien en worden onaangeraakte cloudvelden behouden.
export function rebaseLocalChanges(base, local, remote) {
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
