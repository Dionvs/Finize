# Pakket 2 — applicatiebug 02: leeg importscherm na groepsgoedkeuring

**Status: bewezen op 390 en 1440 px; niet gerepareerd. Pakket 2 is onderbroken voor een afzonderlijk gebruikersbesluit.**

## Reproductie en verwacht gedrag

1. Open de lokale app met de fictieve importfixture uit `finize-audit-herstel.spec.cjs`.
2. Importeer zeven vergelijkbare fictieve uitgaven in oktober 2026.
3. Open de eerste transactiekaart via de zichtbare titelknop.
4. Kies expliciet verwerken, deselecteer de zevende bron en keur de zes geselecteerde transacties goed.
5. Probeer terug te gaan naar de importlijst of de maandkeuze te gebruiken.

Verwacht: de geopende transactie en haar terugknop blijven bereikbaar, of de app keert terug naar de bruikbare importlijst. De zes goedkeuringen zijn duurzaam opgeslagen; de zevende blijft onbevestigd.

Werkelijk: de importmodal toont vrijwel alleen de kop met Sluiten. De actieve transactiekaart zit in de ingeklapte groep Goedgekeurd. De focusmodus verbergt de andere lijstonderdelen. Zowel de terugknop als de maandkeuze is daardoor onbereikbaar.

## Technische oorzaak

`src/import/runtime.js`, `renderDraftModalPreservingView` (rond regel 2114), bewaart de eerdere open-/dichttoestand van alle groepen. `renderDraftModal` verplaatst na goedkeuring de actieve kaart van Nakijken naar Goedgekeurd. Tijdens die rendering opent `applyImportFocus` terecht de groep van de actieve kaart. Daarna schrijft `renderDraftModalPreservingView` echter de eerdere, gesloten toestand van Goedgekeurd terug. De kaart houdt `.u4-focus-row`, de modal houdt `.u4-focus-mode`, maar de omvattende `<details>` wordt gesloten.

Dit is een applicatiefout die na herstel van de oude testroute zichtbaar werd. De twee nog falende importgevallen worden daarom niet langer uitsluitend als foutieve testbediening geclassificeerd. De test wordt niet met geforceerde klikken of verzwakte assertions groen gemaakt.

## Bewijs

Twee afzonderlijke browserreproducties, op 390 en 1440 px, bevestigen dezelfde combinatie:

| Eigenschap na zes expliciete goedkeuringen | Waarde |
|---|---|
| Modal heeft focusmodus | `true` |
| Actieve kaart in groep | `u4-section-approved` |
| Die groep geopend | `false` |
| Actieve kaart zichtbaar | `false` |
| Terugknop zichtbaar | `false` |
| Maandkeuze zichtbaar | `false` |
| Financiële transacties opgeslagen | 6 |

De diagnostische proeven slagen 2/2 doordat ze deze fout aantonen; dit is **geen** geslaagde acceptatietest voor de gewenste werking. Screenshot 390 px is daadwerkelijk geopend en gecontroleerd.

Een aanvullende ronde slaagt eveneens 2/2 en controleert een tijdelijke uitweg: Sluiten en opnieuw openen maakt de maandkeuze en de zes goedgekeurde regels weer bereikbaar. De zes opgeslagen financiële effecten blijven behouden. Bewijs: `.cache/pakket2/approval-focus-recovery.json`.

Lokale ruwe bewijzen staan onder `.cache/pakket2/`: `approval-focus-reproduction-final.json`, `approval-focus-390.json`, `approval-focus-1440.json` en de overeenkomstige PNG's. De voorafgaande echte importtests slagen 8/10; de twee mislukkingen lopen vast op bediening van deze verborgen kaart/groep. De brede inventaris is bij ontdekking gestopt en heeft geen complete einduitslag.

## Ernst, gegevens en herstelvoorstel

Ernst: middel voor de bediening, omdat de importcontrole na een normale groepsgoedkeuring tijdelijk onbruikbaar wordt. In de synthetische reproducties zijn de zes goedkeuringen en financiële effecten behouden. Er is hier geen gegevensverlies of dubbele verwerking aangetoond.

De kleinste voorgestelde correctie is om **na** het herstellen van de eerdere groeptoestanden opnieuw de bestaande `applyImportFocus` toe te passen. Alleen de groep van de actieve kaart moet geopend blijven. De overige groepen behouden hun bestaande toestand. Dit raakt de presentatie-/focusvolgorde, zonder wijziging aan goedkeuring, bedragen, financiële verwerking of opslagmodel.

Na afzonderlijk akkoord moeten regressietests minimaal de zichtbare actieve kaart, terugkeer naar de lijst, maandkeuze, behoud van zes goedkeuringen, de ongekeurde zevende bron, herladen en de bestaande gedeeltelijke-opslagfoutproef controleren. Zowel mobiel als desktop blijven vereist.

## Stop en bewaarde status

- Geen applicatiereparatie voor deze bug uitgevoerd.
- Huidige herstelbranch blijft behouden. Geen push, samenvoeging of publicatie.
- De 1.372 normale Node-gevallen, 42 records-emulatorgevallen, vier native bankretentiegevallen, één backend-HTTP-geval, 38 smoke-gevallen en 59 prioriteitsgevallen waren geslaagd in hun beschreven rondes. Deze aantallen overlappen gedeeltelijk en mogen niet zonder meer worden opgeteld.
- De brede ronde van de overige 582 gevallen is onvolledig. De voortgangslog is bewaard; niet-uitgevoerde gevallen worden niet als geslaagd gerapporteerd.
- Gerichte testaanpassingen in `finize-audit-herstel.spec.cjs` en `fix-round-1-6.spec.cjs` blijven lokaal bewaard en zijn nog niet als afgeronde fase gecommit. Het tweede bestand moet nog worden herhaald.
- Productiegegevens, bankverbindingen, de oorspronkelijke Google Drive-werkmap en de bestaande Git-indexlock zijn ongemoeid gebleven.
