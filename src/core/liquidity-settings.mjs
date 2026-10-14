// Optional metadata on the existing physical account. No financial bookings.
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
    if (!['dion','dara'].includes(person) || !Number.isInteger(day) || day < 1 || day > 31) fail('Kies voor salaris een dag van 1 tot en met 31, of laat het veld leeg.');
    if (profiles.some(p => p.id !== profile.id && p.liquidity?.salaryDays?.[person])) fail('Dit salaris is al aan een andere rekening gekoppeld. Verwijder die betaaldag daar eerst.');
  }
}
