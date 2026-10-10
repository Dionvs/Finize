// A prepared journal is intent, never proof of a financial commit.
export const COMMIT_OUTCOMES = Object.freeze(['committed', 'rejected', 'uncertain']);

export function inspectCommitOutcome(state, operation) {
  if (!state || !operation?.intent?.operationId) return 'uncertain';
  const receipt = [...(state.importSummaries || []), ...(state.importDeletionProofs || [])]
    .find(row => row.id === operation.importId);
  if (receipt?.operationId === operation.intent.operationId
    && Number(receipt.version) === Number(operation.batch?.version)) return 'committed';
  return JSON.stringify(state) === (operation.durableBaseSignature ?? operation.baseSignature) ? 'rejected' : 'uncertain';
}

export async function readCommitOutcome(readState, operation) {
  try {
    const state = await readState();
    return { outcome: inspectCommitOutcome(state, operation), state };
  } catch {
    return { outcome: 'uncertain', state: null };
  }
}

export function commitOutcomeError(cause, outcome, operationId) {
  const error = new Error(outcome === 'uncertain'
    ? 'De uitkomst van de opslag is onzeker. Finize moet de opgeslagen toestand controleren voordat je opnieuw goedkeurt. ' + (cause?.message || '')
    : cause?.message || 'De financiële wijziging is afgewezen.', { cause });
  error.commitOutcome = outcome;
  error.operationId = operationId;
  error.code = cause?.code;
  error.storageFailure = true;
  return error;
}
