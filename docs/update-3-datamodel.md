# Finize Update 3 — datamodel v4

De bestaande state blijft achterwaarts importeerbaar. Update 3 voegt de volgende velden toe.

## Hoofdcollecties

| Veld | Doel |
|---|---|
| `recurringFixedExpenses.voor/na` | Scenario-afhankelijke vaste lasten en hun terugkeerregels |
| `recurringIncomeSources` | Structurele en incidentele inkomstenbronnen |
| `transactionReviewQueue` | Ruwe, nog te bevestigen bankregels inclusief brongegevens |
| `recognitionRules` | Suggestieregels; nooit automatische bevestiging |
| `monthRecords` | Status, actieve afsluiting en onveranderbare `closureHistory` |
| `accountSettings` | Eenmalig openingssaldo en ingangsmaand per rekening |
| `reserveLedger` | Reserveboekingen per financiële bestemming en afsluiting |
| `advanceLedger` | Voorschotten, schulden, openstaand bedrag en aflossingen |
| `internalTransfers` | Deterministische overboekingsvoorstellen en uitvoering |
| `monthCorrections` | Expliciete saldo- en overboekingscorrecties |

## Transactie

Een schema-v4-transactie gebruikt:

- `reviewStatus`: `te-controleren`, `bevestigd` of `genegeerd`;
- `account`: de fysieke rekening waarop de bankmutatie plaatsvindt;
- `financialFor`: de bestemming voor budget, resultaat en reserve;
- `category`;
- `fixedExpenseId` en `fixedOccurrenceId`;
- `incomeSourceId` en `incomeOccurrenceId`;
- optioneel een gekoppelde regel in `advanceLedger`.

`owner` blijft voor oude imports bestaan en wordt bij schema v4 gelijk gehouden aan `financialFor`.

## Financiële richting

- De fysieke rekening bepaalt alleen de mutatie van het administratieve banksaldo.
- `financialFor` bepaalt budgetgebruik, maandresultaat en reserve.
- Een uitgave op een andere rekening maakt de financiële bestemming schuldenaar en de rekeninghouder schuldeiser.
- Een inkomende betaling op een andere rekening werkt omgekeerd.
- Een bevestigde interne aflossing vermindert alleen de schuldpositie.

## Afsluiting

Elke afsluiting krijgt een stabiel `closure-<maand>-<revisie>`-ID. De snapshot bevat:

- maand- en budgetsamenvatting;
- rekeningcontrole;
- transfer-snapshot en transfer-ID's;
- correctie-ID's;
- datum, revisie en apparaat-ID.

Heropenen verwijdert geen snapshot of uitgevoerde overboeking.
