// Presentation only: translate reasons already returned by P2. No additional financial checks.
const explanations = {
  'missing-checkpoint':['Een bruikbaar banksaldo ontbreekt.','Zonder een werkelijk saldo met datum kan Finize het saldoverloop niet bepalen.','Vul een banksaldo met bijbehorende datum in.','balance'],
  'missing-period-opening':['Een beginsaldo vóór de gekozen periode ontbreekt.','De lijn kan pas beginnen bij het eerste bruikbare saldo. Eerdere saldi blijven onbekend.','Vul een eerder banksaldo met bijbehorende datum in.','balance'],
  'missing-reliable-horizon':['Een betrouwbare volgende ontvangstdatum ontbreekt.','Finize kan daardoor het einde van deze prognoseperiode niet bepalen.','Stel een ontvangstdatum in of kies een eigen einddatum.','settings'],
  'unknown-cash-date':['Een betaaldatum ontbreekt of een geplande betaling staat nog open.','De plaats van deze betaling in het saldoverloop is onzeker.','Controleer de betaalmomenten en de verwerking van de betreffende betaling.','payments'],
  'unresolved-account-profile':['Bij een betaling is de bankrekening niet duidelijk.','Finize kan deze betaling niet betrouwbaar aan deze rekening toewijzen.','Controleer de rekeningkeuze bij de betaling en je bankrekeningen.','accounts'],
  'unresolved-budget-account':['Een budget heeft geen betaalrekening.','De bijbehorende uitgaven kunnen niet betrouwbaar aan deze rekening worden toegewezen.','Controleer de primaire betaalrekening en de rekeningkeuze van je budget.','settings'],
  'joint-primary-account-not-selected':['De primaire gezamenlijke betaalrekening ontbreekt.','De gezamenlijke planning en buffer kunnen niet aan één rekening worden gekoppeld.','Kies de primaire gezamenlijke betaalrekening.','accounts'],
  'unconfirmed-transfer-plan':['Een geplande overboeking mist een datum of rekening.','Zonder beide rekeningen en een datum telt deze nog niet mee in het saldoverloop.','Controleer de datum en beide rekeningen van de overboeking.','payments'],
  'missing-period':['Niet alle benodigde maanden zijn beschikbaar.','Daardoor kunnen betalingen uit de ontbrekende maanden missen.','Haal de ontbrekende maandgegevens op via Data & back-up.','data'],
  'unknown-bank-coverage':['Niet bevestigd dat alle bankmutaties aanwezig zijn.','Het berekende saldo kan daardoor afwijken van je bank.','Controleer je bankimport en werk zo nodig het werkelijke saldo bij.','balance'],
  'partial-bank-coverage':['Bankmutaties zijn slechts voor een deel van de periode beschikbaar.','Betalingen buiten dat deel kunnen ontbreken.','Controleer de periode van je bankimport en werk het saldo bij.','balance'],
  'awaiting-review':['Er staan geboekte bankmutaties bij Nakijken.','Deze tellen voorlopig mee, maar zijn nog niet volledig gecontroleerd.','Controleer de betreffende bankmutaties in de import.','budgets'],
  'possible-planning-overlap':['Een bankmutatie hoort mogelijk bij een geplande betaling.','De mogelijke tweede betaling is niet nogmaals in de saldolijn opgenomen.','Controleer de koppeling tussen de bankmutatie en de planning.','payments'],
  'replacement-bank-source-unusable':['Bij een gekoppelde betaling ontbreken bruikbare bankgegevens.','De vervanging van de geplande betaling is daardoor niet betrouwbaar vast te stellen.','Controleer de oorspronkelijke bankmutatie en de koppeling.','payments'],
  'ambiguous-income-occurrence':['Een ontvangst is niet aan een duidelijk betaalmoment gekoppeld.','Een mogelijk dubbele geplande ontvangst blijft buiten de saldolijn.','Controleer welk gepland betaalmoment bij de ontvangst hoort.','payments'],
  'ambiguous-fixed-occurrence':['Een betaling is niet aan een duidelijk vaste-lastenmoment gekoppeld.','Het resterende bedrag van die verplichting is daardoor onzeker.','Controleer de koppeling met het geplande betaalmoment.','payments'],
  'ambiguous-allowance-occurrence':['Een overboeking hoort mogelijk bij het geplande zakgeld.','Een mogelijke tweede ontvangst blijft buiten de saldolijn.','Controleer de verwerking en koppeling van de zakgeldoverboeking.','payments'],
  'planning-basis':['De saldolijn gebruikt planning en beschikbare bankboekingen.','Verstreken dagen zijn hiermee niet automatisch door de bank bevestigd.','Vergelijk de lijn met je werkelijke bankmutaties.','balance'],
  'planning-dependencies-unavailable':['Niet alle gegevens voor de planning zijn beschikbaar.','De financiële samenhang kan daardoor niet volledig worden gecontroleerd.','Probeer opnieuw te laden en controleer de bestaande planning.','settings'],
  'financial-planning-unavailable':['Een deel van de planning kan niet worden berekend.','Daardoor is de prognose niet volledig controleerbaar.','Controleer de bestaande planning; gebruik de technische details bij een foutmelding.','settings'],
  'conflicting-event':['Bij dezelfde betaling staan tegenstrijdige gegevens.','Finize kan daardoor niet betrouwbaar bepalen welke gegevens gelden.','Controleer de betreffende betaling en eventuele synchronisatiemelding.','payments'],
  'duplicate-reservation':['Een reservering kwam meerdere keren voor.','Deze is slechts eenmaal opgenomen om dubbeltelling te voorkomen.','Controleer de betreffende reservering.','budgets'],
  'imports-unavailable':['Importgegevens zijn niet beschikbaar voor controle.','De oorspronkelijke bankgegevens kunnen daardoor niet worden gecontroleerd.','Probeer de bankimport opnieuw te openen of op te halen.','budgets']
};
for (const code of ['invalid-checkpoint-history','duplicate-checkpoint-id','invalid-checkpoint-revision','conflicting-checkpoint-revisions'])
  explanations[code]=['De vastgelegde saldi kunnen niet betrouwbaar worden gecontroleerd.','Er ontbreekt geldige of eenduidige saldo-informatie.','Controleer de eerdere saldi en eventuele synchronisatiemelding.','balance'];
for (const code of ['invalid-bank-source','invalid-bank-amount','conflicting-bank-source','pending-bank-source','unknown-bank-status','bank-sources-unavailable','possible-duplicate'])
  explanations[code]=['Een bankmutatie is nog niet betrouwbaar bruikbaar.','De bron, het bedrag, de boekingsstatus of de identiteit moet eerst worden gecontroleerd.','Controleer de betreffende bankmutatie in de import.','budgets'];
for (const code of ['manual-without-bank-evidence','manual-transfer-unresolved'])
  explanations[code]=['Bij een handmatige registratie ontbreekt bewijs uit de bank.','Deze registratie is geen aangetoonde bankmutatie op deze rekening.','Controleer de bankmutatie of werk het werkelijke saldo bij.','balance'];
Object.assign(explanations,{
  'invalid-bank-amount':['Een bankmutatie heeft geen geldig bedrag.','Deze kan niet exact in eurocenten worden berekend en telt niet mee.','Controleer het bedrag in de oorspronkelijke bankgegevens.','budgets'],
  'pending-bank-source':['Een bankreservering is nog niet geboekt.','Deze telt nog niet mee als werkelijke bankmutatie.','Controleer of de betaling inmiddels bij je bank is geboekt.','budgets'],
  'unknown-bank-status':['De boekingsstatus van een bankmutatie is onbekend.','Finize kan niet bevestigen dat de mutatie werkelijk is geboekt.','Controleer de oorspronkelijke boekingsstatus bij de bank.','budgets'],
  'conflicting-bank-source':['Bij dezelfde bankmutatie staan tegenstrijdige gegevens.','Deze bron telt niet mee zolang niet duidelijk is welke gegevens gelden.','Controleer de oorspronkelijke bankmutatie en eventuele synchronisatiemelding.','budgets'],
  'possible-duplicate':['Een bankbron is mogelijk dubbel aangeleverd.','Zonder betrouwbare identiteitskeuze telt deze niet nogmaals mee.','Controleer de mogelijke dubbele bron in de bankimport.','budgets'],
  'bank-sources-unavailable':['Bankbronnen konden niet volledig worden gelezen.','De beschikbare betalingen kunnen daardoor niet volledig worden gecontroleerd.','Probeer de bankimport opnieuw te openen of op te halen.','budgets'],
  'duplicate-checkpoint-id':['Een vastgelegd saldo komt met hetzelfde kenmerk meermaals voor.','De saldohistorie is daardoor niet eenduidig controleerbaar.','Controleer de eerdere saldi en eventuele synchronisatiemelding.','balance'],
  'conflicting-checkpoint-revisions':['Voor dezelfde dag staan tegenstrijdige saldi.','Finize kan niet betrouwbaar kiezen welk saldo geldt.','Controleer de eerdere saldi en eventuele synchronisatiemelding.','balance'],
  'invalid-checkpoint-revision':['Bij een saldocorrectie ontbreekt een geldige eerdere waarneming.','De volgorde van de saldocorrecties kan niet worden gecontroleerd.','Controleer de eerdere saldi en eventuele synchronisatiemelding.','balance']
});

export function explainLiquidityReasons(projection) {
  const seen=new Set();
  return (projection?.reasons || []).filter(reason=>{if(seen.has(reason.code))return false;seen.add(reason.code);return true;}).map(reason=>{
    const entry=explanations[reason.code] || ['De precieze oorzaak is niet bekend.','De bestaande prognose kan niet volledig worden gecontroleerd.','Controleer je rekeninggegevens en prognose-instellingen.','settings'];
    return {code:reason.code,problem:entry[0],why:entry[1],solution:entry[2],action:entry[3],detail:reason.message || ''};
  });
}
