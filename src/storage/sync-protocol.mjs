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
