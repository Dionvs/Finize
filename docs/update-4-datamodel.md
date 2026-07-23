# Update 4 — datamodel en opslag

## Kernstate (schema v5)

De bestaande state blijft het financiële bronbestand. Update 4 voegt hier alleen compacte, direct benodigde gegevens aan toe:

- `accountProfiles`: rekeningkenmerk, bank en vaste `accountOwner`;
- `importSummaries`: compacte bonnetjes en status;
- `activeImportId`: maximaal één open concept;
- `savingsGoalLedger`: deterministische spaardoelmutaties;
- `manualTransactionReplacements`: herstelarchief voor vervangen handmatige transacties;
- `internalTransferPairs`: voorgestelde, nooit automatisch verwerkte paren;
- `advanceRepayments`: expliciete allocaties op directionele voorschotten;
- `actualIncomeOverrides`: afzonderlijke handmatige correctie op werkelijk inkomen.

Een geïmporteerde transactie heeft `bankOriginal` als onveranderbare banklaag en `processing` als aanpasbare verwerkingslaag. `accountOwner` komt uitsluitend uit het rekeningprofiel. De tijdelijke velden `account`, `financialFor` en `owner` projecteren respectievelijk `accountOwner` en `budgetOwner`.

## Importdetails

IndexedDB-database `finize-imports-v1` heeft de stores `imports`, `journal` en `syncQueue`. Conceptregels, originele velden, splits en effectmanifesten blijven daar lokaal beschikbaar. Firestore synchroniseert deze gegevens naar:

`budgetPlanners/finize/imports/{importId}/chunks/{chunkId}`

Chunks blijven onder circa 700 kB. De bestaande kernstate in `budgetPlanners/finize` bevat alleen de compacte importsamenvatting.

## Atomaire verwerking en herstel

Verwerken, corrigeren en undo schrijven eerst een journalrecord. Daarna past één `commitChange` een volledig gevalideerde statewijziging toe. Effecten gebruiken deterministische ID's. Een herstart classificeert een achtergebleven journalactie daarom veilig als voltooid of teruggedraaid.

Undo verwijdert geïmporteerde transacties, spaardoelregels, voorschotten, aflossingen en interne paren. Ook worden handmatige transacties, vaste-lastenplanning en maandstatus hersteld.
