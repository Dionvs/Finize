# Finize — actieve architectuur

Bijgewerkt voor Pakket 2: [schema v11 en de historische planningtijdlijn](package-2-planning-timeline.md), bovenop het [Pakket-1-migratiefundament](package-1-data-foundation.md). [Pakket 3](package-3-transaction-engine.md) centraliseert transaction semantics en actual-selectors; mobiele en desktoprenderers behouden hun bestaande layout.

## Runtime en build

`index.html` bevat alleen markup en laadt `app.css` en `app.js`. De browser heeft geen buildserver nodig.

- `src/app-entry.js` bepaalt de uitvoervolgorde.
- `src/core/` bevat de state-, migratie-, validatie- en rekencontracten.
- `src/storage/` bevat de lokale, cloud- en afbeeldingsopslagcontracten.
- `src/import/` bevat parser, classificatie, importopslag, synchronisatie en UI-contracten.
- `src/ui/` bevat rendering, presentatie, modals en iconen.
- `src/styles/` bevat de actieve CSS-bronnen voor tokens, basis, dashboard, spaardoelen, import, tablet en desktop.
- `scripts/build.mjs` bundelt JavaScript met esbuild en voegt CSS in vaste cascadevolgorde samen.
- `app.js` en `app.css` zijn gegenereerd, gecommitteerd en byte-reproduceerbaar.

De build bevat geen timestamp en geen sourcemap. CI voert dezelfde Node 24-build uit en faalt als de gecommitteerde runtime afwijkt.

## State en financiële kern

- `state` is de centrale, genormaliseerde budgetstate.
- `commitChange` blijft de transactionele kern voor gevalideerde statewijzigingen.
- Schema v10 introduceerde canonieke transactiemetadata; schema v11 voegt één historische planningtijdlijn toe via dezelfde migratieroute. Zie [Pakket 2](package-2-planning-timeline.md).
- De bestaande Voor-baseline heet nu `planning`; de verdelingsregel blijft `Math.max(0.40, inkomensaandeelDion)`.
- De centrale maandresolver bepaalt vaste-lastenconfiguratie, budgetlijsten en geplande inkomsten. Bedraghistorie bevat volledige configversies; toevoegen/beëindigen behoudt historische IDs. Na-only configuratie is niet actief; een bevestigde originele migratieback-up inclusief Na is verplicht vóór persistent toepassen.
- `transaction-model.mjs` bepaalt canonieke metadata; `transaction-engine.mjs` projecteert source/splits en biedt gedeelde selectors voor financiële actuals. `transaction-processing.mjs` voert uitsluitend expliciete sourcecommands uit via de bestaande commit/journal-route.
- `recurring-occurrences.mjs` deelt de bestaande P2-occurrenceberekening tussen importvalidatie en runtime.
- Schema blijft v11; projecties muteren geen bankOriginal/planning/ledger. Bestaande afgesloten snapshots blijven opgeslagen historische waarheid.
- CSV zonder betrouwbare sourceverwijzing blijft leesbaar via compatibility; onveilige manual edits zijn geblokkeerd en beschreven in Pakket 3.

## Opslagverantwoordelijkheden

| Opslag | Sleutel of pad | Verantwoordelijkheid |
|---|---|---|
| localStorage | `finize-budget-planner-v1` | compacte kernstate |
| localStorage | `finize-budget-planner-v1-last-good-backup` | laatst geldige lokale back-up |
| localStorage | `finize-budget-planner-v1-pre-schema-v5` | historische migratieback-up plus originele Pakket-1-/Pakket-2-input en v10-rollbackstage |
| localStorage | `finize-device-id` | stabiel apparaat-ID |
| localStorage | `finize-firebase-config` | lokale Firebase-configuratie |
| IndexedDB | `finize-goal-images-v1` | lokale spaardoelafbeeldingen |
| IndexedDB | Update 4 ImportStore | importdetails, journal en retrywachtrij |
| Firestore | `households/{householdId}/budgetState/current` | compacte kernstate |
| Firestore | `households/{householdId}/imports/{importId}` | importheader |
| Firestore | `households/{householdId}/imports/{importId}/chunks/{chunkId}` | importchunks |

Bij authenticatie krijgen de lokale state-, back-up- en migratiesleutels de bestaande suffix `:account:{householdId}:{uid}`. Het oude `budgetPlanners/finize`-pad is een historische herstelbron; de huidige regels blokkeren browsertoegang tot dat pad.

Pakket 5 publiceert gedetailleerde importheaders en de compacte financiële snapshot als één Firestore-transactie. Source processing/approval staat in de gedetailleerde batch; `state.transactions` bevat de versiegebonden financiële materialisatie. De centrale P3/P4-engine blijft alle effecten afleiden. Zie [Pakket 5](package-5-import-lifecycle.md).

ImportStore gebruikt dezelfde drie IndexedDB-stores en databaseversie 1, met een suffix per huishouden. Bestaande unscoped details worden alleen overgenomen voor expliciet opgeslagen batchreferenties. Elke write krijgt een batchversie, baseVersion en operationId; normale reads genereren niets. Het journal bewaart intent/candidate vóór details → outbox → corecommit. Herstel gebruikt operation receipts en controleert opnieuw de volledige candidate. Core/header-publicatie controleert zowel syncVersion als batch-baseVersion; chunks zijn immutable generaties.

Bij een conflict blijft de cloudstand actief en wordt de lokale keuze apart duurzaam bewaard. De gebruiker kan cloud behouden of de lokale verwerking opnieuw laten toetsen; processing komt dan terug in Nakijken, zonder automatische approval. Queue-acknowledgement mag uitsluitend de daadwerkelijk geüploade operation/version verwijderen.

Batchstatus is presentatie. Alleen source approval plus centrale activity bepaalt financiële invloed; meerdere open batches zijn toegestaan. Terugtrekken bewaart bankdata/processing/history en deactiveert eigen effecten. Herstellen toetst de volledige resulterende state. Permanent verwijderen bewaart uitsluitend een technisch deletion proof, verwijdert uitsluitend batch-owned data en ruimt cloudchunks na de terminale tombstone op. Onafhankelijke planning, manual transactions/corrections en opgeslagen closures blijven behouden.

## Compatibiliteit

De bestaande interne contracten blijven beschikbaar:

- `window.FinizeUpdate4`;
- `window.FinizeUpdate5`;
- `window.FinizeUpdate4Runtime`;
- `window.FinizeUpdate4Process`;
- `window.DataAdapter`;
- `window.CloudAdapter`.

Er is geen externe API toegevoegd. Klassieke globals die door de bestaande runtime en regressietests nodig zijn, worden expliciet gepubliceerd.

## PWA

De cachemarker is `finize-v102-release-candidate`. Alleen caches met de prefix `finize-` worden opgeruimd. Alleen navigatieverzoeken mogen offline op `index.html` terugvallen; ontbrekende scripts, CSS en afbeeldingen krijgen nooit HTML als vervanging. Optionele pictogrammen kunnen een installatie niet blokkeren. Installatie controleert dat de gecachte HTML dezelfde assetversie noemt; een onvolledige publicatie activeert geen gemengde offline shell. Alleen succesvolle navigatie-HTML met dezelfde assetversie mag de werkende offlinekopie vervangen.

Een gewijzigde openbare productlink bij een subdoel wordt eenmalig via de Microlink-metadata-API gelezen. Titel, europrijs, afbeelding, bronlink en ophaaltijd worden als compacte momentopname in het subdoel bewaard; dezelfde link veroorzaakt daarna geen nieuwe aanvraag. Bij een geblokkeerde winkel, netwerkfout of daglimiet blijven de handmatig ingevulde naam en het doelbedrag leidend.

Cloudwrites gebruiken een Firestore-transactie met een serverbrede `syncVersion` en unieke `commitId`. De eerste geldige cloudsnapshot is leidend; een apparaat-lokale `revision` bepaalt nooit meer welke apparaatstand wint. Als de cloud sinds de laatste bevestiging is veranderd, wordt de lokale stand als nood-back-up bewaard en daarna door de actuele cloudstand vervangen. Expliciet herstel van een JSON- of noodback-up wordt atomair als nieuwe cloudversie opgeslagen; de schermstand wisselt pas na bevestiging door Firestore. Vertraagd binnenkomende snapshots met een lagere of inconsistente `syncVersion` worden altijd genegeerd.

## Herstel en bewust behouden uitvoer

De tag `v50-audit-baseline`, de lokale Git-bundle en de back-up onder `backups/` vormen de herstelroute. De verwijderde legacy-HTML- en updatebestanden blijven via die route beschikbaar.

De bekende mojibake en de bestaande spaardoel-progressiebalkafwijking zijn bewust onderdeel van de bevroren v50-uitvoer en zijn niet in deze technische opschoning aangepast.

## Uitgestelde risico's

- De bestaande accountkoppeling en Firestore-autorisatie blijven ongewijzigd; Pakket 1 introduceert geen nieuw toegangssysteem.
- Het hoofdstate-document wordt niet opgesplitst.
- Doelafbeeldingen krijgen geen nieuwe cloudopslag.
- State-schema blijft v11; importtransportversies zijn concurrency receipts, geen tweede state-migratiesysteem.
- Bestaande visueel noodzakelijke `!important`- en tabselectors blijven staan wanneer verwijderen de bevroren uitvoer verandert.


## Behouden P4-planningscontract

Actuals, actuele prognose en conservatieve zakgeldbasis zijn verschillende outputs van dezelfde engine. Zakgeld reserveert historische planned fixed, variabele budgetten en geplande gezamenlijke savings volledig. Uitgaven, coverage, refunds en savingsrealisatie veranderen die reserve niet; buffers bewegen wel. Actief salaris > expliciete persoonlijke manual dashboard salary (nul geldig) > historisch planned salary blijft de inkomstenprecedence. Batch lifecycle wijzigt uitsluitend de daadwerkelijke source activity; hij schrijft geen planning, zakgeld of closures om.

## P6 gebruikerslaag

Accountmodals en oude publieke manualwrappers delegeren aan één create/edit-command (`upsertManualFinancialTransaction`) met dezelfde datum/category/goal/refund/fixed/dependencyvalidatie. De contexttab bepaalt fysieke rekening. Normale rekeninglijsten lezen `selectActiveTransactions({month,account})`; categorie-details lezen financiële bestemming. Desktop en mobiel gebruiken dezelfde readers/writers.

Expensecategorieën komen via `expenseCategoriesForMonth` uit historische budgetplanning, met Overig en expliciete bestaande categoriecompatibility. Income editors lezen planning-only; from/once/end gebruikt de bestaande timeline. Persoonlijke manual-dashboardoverrides blijven onafhankelijk. Opt-in `incomeTimelineCommands`/`incomePlanningOverride` wordt uitsluitend door expliciete planningcommands geschreven; bestaande oude sources worden bij load niet heringedeeld. Maandspaarplanning geldt uitsluitend voor de geselecteerde maand. Schema blijft v11; P3/P4 engine en P5 syncprotocol blijven intact. Beide standaard salarisbronnen hebben de gezamenlijke fysieke rekening en houden Dion/Dara als persoon voor salarisprecedence. Manual joint entry biedt beide bronnen; expliciete bronkeuze bepaalt de financiële salarisbestemming zonder accountContext te veranderen. Persoonlijke inkomenskaarten tonen zakgeld zonder verrekening en persoonlijke receipts/teruggaven, in iedere auth-/viewportmodus. Geen engineformule of bestaande transactie wordt hiervoor heringedeeld. Zie het P6-verslag voor verificatie.
