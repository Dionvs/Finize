# V118 — Vrij na verplichtingen en zacht spaardoel

Datum: 14 oktober 2026. Status: lokaal geïmplementeerd en gericht geverifieerd; niet gepubliceerd.

## Herstelpunt en afbakening

Vóór deze correctie is `../Finize-herstel-v118-vrij-spaardoel-20261014-201331` gemaakt: 371 bestanden, iedere kopie met SHA-256 tegen de bron gecontroleerd. Alle eerdere lokale V118-wijzigingen zijn behouden. Geen commit, push, merge, deployment of wijziging van productiegegevens uitgevoerd. HEAD blijft `e473dbb35e2e43d9e33e5eefe404f4f170cb8509`.

Deze correctie vervangt de beschikbaarheidsregel uit het eerdere verslag `v118-prognose-periodes-grafiek.md`: een verstreken tekort telt voortaan uitsluitend mee in de historische grafiek, niet in wat vandaag extra kan worden uitgegeven. Dat eerdere verslag en zijn auditbewijs zijn als historische bewijsstukken behouden.

## Gevonden probleem en exacte correctie

P2 zocht zowel het grafiekminimum als het minimum na reserveringen in alle weergegeven dagen. Bij **Deze maand** betekende dit dat bijvoorbeeld een tekort op 3 oktober de vrijwaarde op 14 oktober kon beperken, ook na een later positief saldo-ijkpunt.

De grafiek behoudt haar volledige tijdvenster. De beschikbaarheid gebruikt uitsluitend dagen vanaf vandaag tot en met de geselecteerde einddatum:

| Keuze | Beoordeling harde beschikbaarheid |
|---|---|
| Deze maand | Vandaag t/m laatste kalenderdag |
| 7 dagen | Vandaag plus de volgende zes dagen |
| 14 dagen | Vandaag plus de volgende dertien dagen |
| Eigen datum | Vandaag t/m gekozen datum |
| Volgend salaris | Vandaag t/m dag vóór het volgende betrouwbare relevante salaris |

Per dag blijft de bestaande P2-berekening van `afterReservationsCents` gelden: verwacht rekeninggeld minus nog resterende budgetten en ongedateerde verplichtingen. De exacte formule in eurocenten is:

```text
minimum = min(afterReservationsCents[d]) voor vandaag <= d <= einddatum
vrij = max(0, minimum - bufferCents)
```

De buffer wordt eenmaal toegepast. Deze uitgave vandaag verlaagt ieder volgend dagsaldo met hetzelfde bedrag; daarom bepaalt het laagste toekomstige saldo de harde grens. Bij onbetrouwbare essentiële gegevens blijft de definitieve waarde onbekend en behoudt de bestaande UI haar indicatieve status. Een tekort wordt niet verborgen: grafiek, minimumkaart en tekortinformatie blijven beschikbaar.

De selector levert aparte `availability`-metadata met vanaf-/einddatum, minimum, minimumdatum en betrouwbaarheid. De grafiek houdt haar bestaande `days`, gebeurtenissen, minimum en reconciliaties. Een handmatig eindsaldo-ijkpunt corrigeert vanaf die datum; eerdere dagen veranderen hierdoor niet.

## Budgetten, betalingen en rekeningcontext

De bestaande maandmotor levert budgetbedrag en daadwerkelijke budgetuitgaven. Alleen het positieve restant wordt conservatief gereserveerd. De dagelijkse spreiding blijft een schatting. Een betaling vóór het huidige saldo-ijkpunt wordt niet opnieuw als kasuitgave afgetrokken; haar budgeteffect verlaagt wel het nog te besteden budget.

Werkelijke bankbedragen blijven eenmaal in P1/P2. Bewezen koppelingen vervangen de juiste vaste-last-, salaris- of zakgeld-occurrence. Bij ontbreken van CSV blijft de planning bestaan. Onvoldoende bewezen koppelingen behouden hun onzekerheidsstatus. Betaalde vaste occurrences krijgen geen tweede reservering.

Alleen de geselecteerde fysieke rekening en haar buffer tellen mee. Gezamenlijke, Dion- en Dara-rekeningen blijven gescheiden. Het bestaande gezamenlijke spaardoel verschijnt uitsluitend bij de daarvoor aangewezen primaire rekening. Zakgeld houdt de bestaande bedragen, rekeningkeuze, ontvangst-/betaaldatum en beide kaszijden.

## Sparen en waarschuwing

De zakgeldformule in `transaction-engine.mjs` is niet gewijzigd. De bestaande maandmotor trekt de afgesproken spaarreserve al af bij het bepalen van de zakgeldverdeling. Dat effect op geplande zakgeldkasstromen blijft bestaan; er komt geen afzonderlijke harde spaarreservering bovenop.

Een nog geplande spaaroverboeking blijft zichtbaar op de grafiek, maar telt voor de harde bestedingsgrens als optioneel. P2 berekent hiervoor opnieuw met dezelfde invoer en dezelfde projector, zonder die optionele gebeurtenissen en hun specifieke ontbrekende-datum-/rekeningmeldingen. Andere onzekerheden blijven staan. Werkelijke bankoverboekingen naar sparen blijven echte kasuitgaven; bewezen vervangen plannen verdwijnen niet naast hun werkelijke betaling.

Onder de hoofdwaarde staan **Gepland sparen** en, indien onderbouwd, **Ruimte boven spaardoel**. De doelbedragen komen uit `financialForecastForMonth().allowanceBasis`; netto gerealiseerde spaarstortingen en -opnamen komen uit de actieve bestaande financiële projecties. Een reeds gerealiseerd doel wordt niet opnieuw gevraagd.

Voor iedere relevante maandultimo:

```text
resterend maanddoel = max(0, gepland maanddoel - netto gerealiseerd sparen)
cumulatief doel = som resterende maanddoelen t/m deze maand
kasruimte = verwacht saldo na resterende reserveringen - rekeningbuffer
overschot = kasruimte - cumulatief doel
ruimte boven spaardoel = max(0, min(harde vrijwaarde, laagste overschot))
```

Dit gebruikt de werkelijke verwachte kasontwikkeling, inclusief de bestaande zakgeldplanning. Het is geen automatische aftrek van spaardoel van de hoofdwaarde. Getest voorbeeld: €700 hard vrij, €500 doel, maar €400 latere ontvangst maakt de doelruimte €600 in plaats van €200. Wanneer sparen via de bestaande zakgeldverdeling al voldoende is beschermd, volgt geen onterechte extra waarschuwing.

Een korte grafiekperiode verandert de maandelijkse doeltermijn niet: uitsluitend voor de zachte beoordeling loopt dezelfde P2-projector door tot de laatste dag van de laatste geselecteerde maand. De grafiek en harde bestedingsgrens blijven binnen de gekozen periode. Onzekerheid buiten die korte periode kan daardoor alleen de spaardoeltoelichting onzeker maken. Er wordt dan geen doelruimte of waarschuwing met een gefingeerde drempel getoond.

Een waarschuwing verschijnt als besteding binnen de harde vrijwaarde het nog te realiseren doel kan raken. Bij een reeds onvoldoende doelruimte vermeldt de UI dat het doel al niet volledig haalbaar lijkt. Er komt geen blokkade of tweede primaire bestedingswaarde.

## Gerichte verificatie

- **349 Node-tests geslaagd, 0 fouten**, inclusief 21 nieuwe scenario's. Getest: historisch tekort, toekomstig tekort, één buffer, werkelijk saldo, budgetrestant, vaste-occurrencevervanging, ontbrekende CSV, vijf periodes, korte versus maandelijkse doeltermijn, onzekere gegevens, gerealiseerd sparen, optionele spaarplanning, ongewijzigde zakgeldformule, gescheiden eigenaren, meerdere maanddoelen, ongewijzigde grafiekdagen en codec/herladen.
- **30 gerichte browsertests geslaagd, 0 fouten**, inclusief drie nieuwe end-to-end-scenario's op 1440, 390 en 320 px. Deze combineren historisch negatief saldo, €1.200 huidig saldo, toekomstige vaste last, €200 resterend budget, €200 buffer en €500 spaardoel: hard vrij €700, doelruimte €200. Dagmutaties sluiten in centen; kleuren, datumdetails, korte periode en herladen zijn gecontroleerd.
- Bestaande browsercontroles voor hover, tikken, toetsenbord, vijf perioden, CSV-vervanging, ontbrekend beginsaldo, handmatige ijkpunten, rekeninginstellingen en opslagfouten blijven slagen. Bestaande gerichte Node-controles voor meerdere maanden, historische wijzigingen, maandwisselingen en februari/schrikkeljaar blijven slagen.
- Syntax, CSS, byte-reproduceerbare build en `git diff --check` geslaagd. De al bestaande CSS-melding over `--line` blijft aanwezig. De Impeccable-detector meldt geen bevindingen. Screenshots zijn geopend en visueel gecontroleerd.

De browsertests gebruiken synthetische lokale fixtures en blokkeren Firebase-/backendverkeer. Geen productiecloudtest, nieuwe schaalbenchmark of volledige regressie uitgevoerd. Laatste groene logs, screenshots, herstelpunt en bestands-hashes staan in [het auditbewijs](audit/v118-vrij-na-verplichtingen-spaardoel-bewijs.json).

## Bestanden en grenzen

Sinds het herstelpunt gewijzigd: `src/core/daily-liquidity.mjs`, `src/ui/dashboard.mjs`, `src/styles/dashboard-p3.css`, gegenereerde `app.js`/`app.css` en de verwachte spaartekst in `tests/browser/v118-p3-dashboard.spec.cjs`. Toegevoegd: `tests/v118-vrij-spaardoel.test.cjs`, `tests/browser/v118-vrij-spaardoel.spec.cjs`, dit verslag en het auditbewijs. Andere eerdere lokale V118-wijzigingen zijn behouden.

De beoordeling gebruikt de bekende huidige planning; toekomstige wijzigingen in inkomsten, lasten en doelen kunnen haar wijzigen. Budgettiming blijft geschat. De doeltermijn is maandultimo, zonder nieuwe afzonderlijke spaardoel-deadlines of allocatiemodel. Maandelijkse budgetruimte is geen bankstand. Ontbrekende opslaghistorie, onbetrouwbare kasdata of onvoldoende bankdekking blijven expliciet onzeker.

**Lokaal gereed voor beoordeling. Nog niet gepubliceerd.**
