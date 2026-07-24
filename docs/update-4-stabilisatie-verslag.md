# Finize stabilisatie 4.1–4.7

## Gewijzigde onderdelen

- `index.html`: centrale transactierekenlaag, spaardoelverwerking, historische maandsnapshots, inkomensprioriteit, geselecteerde-maandberekening, versieerbare afsluiting en maandblokkades.
- `update4.js`: schema v8, genormaliseerde spaardoelledger, importmatching, undo/reconcile en behoud van late-importcorrecties.
- `service-worker.js`: cachemarker `finize-v17-stabilisatie`.
- `tests/`: afzonderlijke regressietests voor stabilisatie-updates 4.1 tot en met 4.7.

## Centrale functies

- `getTransactionExpenseImpact(tx)`
- `calculateGoalSavedAmount(state, goalId)` en `reconcileGoalSavedAmounts(state)`
- `getMonthFinancialResult(month)`
- `resolveMonthlyIncome(owner, month)`
- `getCalculationDateForSelectedMonth(month, owner)`
- `u3DeactivateClosingEffects(closingId)`
- `assertMonthMutationAllowed(month, mode)`

## Migraties

- Schema v6 breidt het bestaande `savingsGoalLedger` uit. Een deterministische openingsregel bewaart ieder bestaand spaardoelsaldo.
- Schema v7 voegt genormaliseerde financiële afsluitsnapshots toe. Oude snapshots worden uitsluitend uit reeds opgeslagen afsluitgegevens opgebouwd en als legacy gemarkeerd.
- Schema v8 versieert maandafsluitingen en vult `sourceClosingId` aan vanuit bestaande `closureId`-verwijzingen.
- Alle normalisaties zijn idempotent en verwijderen geen transacties, imports, doelen, voorschotten of afsluitingen.

## Tests

- Bestaande Update 2-, Update 3- en Update 4-tests.
- Salaris, uitgave, refund, interne overboeking, sparen, niet-meetellen en gekoppelde vaste lasten.
- Geplande versus werkelijke spaardinleg, afwijkingen, herimport en undo.
- Afgesloten historische maand, late correctie en jaarsom.
- Verwacht inkomen, expliciet nulinkomen, werkelijk inkomen en totale override.
- Inclusieve geselecteerde maand en reeds verwerkte maand.
- Vier afsluitversies met slechts één actieve set financiële effecten.
- Blokkades voor afgesloten en te corrigeren maanden.
- Verdeling vóór verkoop 44,87%/55,13% en minimum 40%/60%.
- JavaScript-syntax, HTML-structuur, service worker en whitespacecontrole.

## Resterende risico’s

- Oude afsluitsnapshots bevatten niet altijd alle moderne detailvelden. Ontbrekende gegevens worden bewust als legacy behouden en niet met huidige instellingen gereconstrueerd.
- Een import die nooit naar Firestore is gesynchroniseerd, kan op een ander apparaat nog steeds niet worden hersteld.

## Vormgeving

De kaartindeling, navigatie, teksten en mobiele vormgeving zijn niet herontworpen. Alleen de noodzakelijke functionele melding voor een beschermde maand is toegevoegd.
