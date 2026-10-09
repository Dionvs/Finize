// Preserve business validation messages; translate browser storage failures into actions.
export function describeMutationError(error) {
  if (['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name) || [22, 1014].includes(error?.code)) {
    return new Error('De browseropslag is vol. Maak eerst een back-up via Gegevens en maak ruimte vrij op je toestel. Wis de Finize-sitegegevens niet; daarin kunnen nog niet gesynchroniseerde transacties staan.', {cause:error});
  }
  if (error?.name === 'SecurityError') {
    return new Error('De browser blokkeert lokale opslag. Sta opslag voor Finize toe in de browserinstellingen en probeer opnieuw.', {cause:error});
  }
  return error instanceof Error ? error : new Error(String(error?.message || error || 'Onbekende opslagfout. Probeer opnieuw; blijft dit gebeuren, meld dan bij welke transactie het optreedt.'));
}
