# Finize Update 4 — implementatieplan

## Basis

- Startpunt: commit `649f1de` op `agent/update4-slimme-bankimport`.
- Actieve app: `index.html`; vanilla HTML, CSS en JavaScript.
- Bestaande functies blijven leidend: `commitChange`, `CloudAdapter`, `GoalImageStore`, de CSV-parser, `transactionReviewQueue`, `recognitionRules`, terugkerende inkomsten/vaste lasten, spaardoelen, maandafsluiting en `advanceLedger`.
- Grote importdetails komen niet in het bestaande Firestore-kerndocument. De kern bewaart alleen profielen, transacties en compacte importsamenvattingen.

## Schema v5

Nieuwe kerncollecties:

- `accountProfiles`
- `importSummaries`
- `activeImportId`
- `savingsGoalLedger`
- `manualTransactionReplacements`
- `actualIncomeOverrides`

Banktransacties krijgen een onveranderbare `bankOriginal`-laag en een aanpasbare `processing`-laag. `accountOwner` komt uitsluitend uit het rekeningprofiel. `budgetOwner` bepaalt budget en administratie. De bestaande velden `account`, `financialFor` en `owner` blijven tijdelijk compatibiliteitsvelden.

## Opslag en herstel

- IndexedDB-store `finize-imports-v1` bewaart concepten, importregels en een operation journal.
- Firestore gebruikt `budgetPlanners/finize/imports/{importId}` plus chunkdocumenten onder de import.
- Verwerking is lokaal-first. Een journalrecord wordt vóór de kernwijziging geschreven en na een geslaagde `commitChange` voltooid.
- Alle effecten hebben deterministische ID's, zodat herstel, opnieuw laden en undo idempotent zijn.

## Belangrijkste conflicten

- De huidige CSV-import is vluchtig en bevestigt regels afzonderlijk; Update 4 vervangt dit door één bewaard concept en één verwerkingsactie.
- Bestaande herkenningsregels kunnen rekening/eigenaar bevatten; de v5-migratie verwijdert die velden.
- Update 3 nettosaldeert tegengestelde voorschotten; Update 4 toont directionele saldi zonder automatische verrekening.
- Maandafsluiting blokkeert nu op open reviews; Update 4 maakt dit een bevestigbare waarschuwing.
- De huidige Firestore-state heeft een grens van circa 900 kB; importdetails worden daarom gesplitst opgeslagen.

## Teststrategie

- Bestaande Update 2- en Update 3-tests blijven verplicht groen.
- Nieuwe Node-tests dekken migratie, parser, profielherkenning, fingerprints, regels, splits, verwerking, sparen, voorschotten en undo.
- Browsercontrole op desktop, 430 px en 384 px controleert console, full-screen modal, sticky actieknop, lange omschrijvingen en veel regels.
- PWA-controle omvat syntax, cachemarker, reload en offline lokale verwerking.
- Drie echte geanonimiseerde ING-exports zijn vereist voor de laatste acceptatie; zolang deze ontbreken worden representatieve fixtures gebruikt.

## Acceptatie

- Geen financieel effect vóór `Alles verwerken`.
- Geen eigenaar in herkenningsregels.
- Duplicaten blijven herkenbaar na bewerken.
- Verwerking en undo zijn idempotent.
- Oude data laadt zonder verlies.
- Importcorrecties blijven in hun oorspronkelijke maand.
- `Ongecategoriseerd` telt mee in totale uitgaven.

