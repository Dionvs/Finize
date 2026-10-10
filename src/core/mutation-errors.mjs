// Preserve business validation messages; translate browser storage failures into actions.
export function describeMutationError(error) {
  const explain=message=>Object.assign(new Error(message,{cause:error}),Object.fromEntries(['commitOutcome','operationId','storageFailure'].filter(key=>error?.[key]!==undefined).map(key=>[key,error[key]])));
  if (['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name) || [22, 1014].includes(error?.code)) {
    return explain('De browseropslag is vol. Maak eerst een back-up via Gegevens en maak ruimte vrij op je toestel. Wis de Finize-sitegegevens niet; daarin kunnen nog niet gesynchroniseerde transacties staan.');
  }
  if (error?.name === 'SecurityError') {
    return explain('De browser blokkeert lokale opslag. Sta opslag voor Finize toe in de browserinstellingen en probeer opnieuw.');
  }
  return error instanceof Error ? error : new Error(String(error?.message || error || 'Onbekende opslagfout. Probeer opnieuw; blijft dit gebeuren, meld dan bij welke transactie het optreedt.'));
}
