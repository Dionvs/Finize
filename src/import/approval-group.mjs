// A group is a sequence of individually durable source operations.
export async function runApprovalGroup(requests, approve) {
  const results = [];
  let stopped = false;
  for (const request of requests) {
    if (stopped) {
      results.push({ rowId: request.rowId, operationId: request.operationId, status: 'niet-geprobeerd' });
      continue;
    }
    try {
      const result = await approve(request);
      if (result?.outcome !== 'committed') {
        throw Object.assign(new Error('De duurzame goedkeuring is nog niet bevestigd.'), {
          commitOutcome: result?.outcome || 'uncertain', operationId: result?.operationId || request.operationId
        });
      }
      results.push({ rowId: request.rowId, operationId: result?.operationId || request.operationId, status: 'geslaagd', outcome: 'committed' });
    } catch (error) {
      const conflict = error?.code === 'import-conflict';
      const invalid = error?.code === 'approval-validation';
      const uncertain = error?.commitOutcome === 'uncertain';
      results.push({ rowId: request.rowId, operationId: error?.operationId || request.operationId,
        status: uncertain ? 'onzeker' : conflict ? 'conflicterend' : error?.storageFailure ? 'opslagfout' : 'ongeldig',
        outcome: error?.commitOutcome || 'rejected', message: error?.message || String(error) });
      // Validation/conflict concerns this source. Storage/scope/unknown failures stop the group.
      stopped = uncertain || (!invalid && !conflict);
    }
  }
  return { results, total: requests.length, committed: results.filter(row => row.status === 'geslaagd').length };
}

export function approvalGroupSummary(group) {
  const labels = { ongeldig: 'ongeldig', conflicterend: 'conflict', 'niet-geprobeerd': 'niet geprobeerd', onzeker: 'uitkomst onzeker', opslagfout: 'niet opgeslagen door een opslagfout' };
  const parts = [`${group.committed} van ${group.total} transacties goedgekeurd.`];
  for (const [status, label] of Object.entries(labels)) {
    const count = group.results.filter(row => row.status === status).length;
    if (count) parts.push(`${count} ${label}.`);
  }
  return parts.join(' ');
}
