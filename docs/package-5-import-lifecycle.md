# FINIZE — PAKKET 5/7

Technisch verslag A–K. Definitieve lokale oplevering, 6 oktober 2026.

Schema vóór/na: **v11 → v11**. ImportStore databaseversie blijft 1; import-envelope storageVersion blijft 2. P1–P4 zijn cumulatief behouden, inclusief het definitieve planninggedreven zakgeldcontract. Geen P6, publicatie, push, deploy of productie-Firestore.

**Resultaat:** 43/43 Node-testbestanden PASS, 307 geregistreerde node:test-cases PASS, daarnaast de assertions in bestaande script-tests. P5 omvat 92 cases: 68 verplichte test-ID’s en 24 auditcases. Browser 116/116 PASS, waaronder negen nieuwe P5-tests. Nul skips, failures of flaky tests. Baseline categorie C = 0. CSS is bytegelijk aan de bevroren P4-versie.

De repo bevatte vóór P5 al cumulatieve ongecommitte wijzigingen uit P1–P4. Daarom is P5 vergeleken met de vooraf bevroren actuele werkboom, niet uitsluitend met Git HEAD. Eerdere wijzigingen zijn niet gereset of opnieuw ontworpen.

## A. Audit huidige import/cloudarchitectuur + gereproduceerde race

Gelezen: actuele repository, git status/diff, verslagen P1/P2/P3 en het definitieve gecorrigeerde P4-verslag, architectuur, bestaande Node-/browsertests en lokale baseline-artifacts. De dunne facades src/import/import-store.js, import-sync.js en src/storage/cloud-state.js delegeren naar de runtime. De uitvoerende code staat in src/import/runtime.js en CloudAdapter in src/core/runtime.js. Die zijn aangepast; er is geen parallel systeem toegevoegd.

| Route | Oude writer/reader en probleem | P5-vervanging |
|---|---|---|
| Importconcept/processing | persistImportDraft, ImportStore, compacte importSummaries; onafhankelijke writes | Per-batch serialisatie, lokale versie/CAS, journal vóór details/outbox/corecommit |
| Cloud details | flushImportSync, vaste chunknamen, onvoorwaardelijke headerwrite/queue delete | Immutable operation-generaties; header/core samen in bestaande cloudtransactie; conditionele acknowledgement |
| Cloud lezen | resolveImportDetails koos lokaal zodra details bestonden | Connected refresh met version/baseVersion; pending conflict bewaren, cloudstand leidend |
| Compacte cloudstate | acceptRemote, rebasePendingOntoRemote, ID-array merge | Zelfde syncVersion-protocol, aangevuld met source-/relatieconflictpreflight |
| Approval | Eerste source kon uitsluitend draft approval krijgen; all-batch processing gate | Elke expliciete source approval direct via P3 command/projectie; batchstatus uitsluitend afgeleid |
| Heropenen/vervangen | P3 sourcecommands plus aparte detailwrites | Gemeenschappelijke journaled importcommand met volledige candidate |
| Batch undo | Destructieve legacy undo en mogelijke planningreversal | Centrale lifecycle activity; geen planningundo |
| Savings/refunds/coverage | P4 ledger en transaction projecties | Dezelfde engine/activity/preflight, geen losse herberekening |

De verloren-update-race is vóór implementatie op de oorspronkelijke P4-runtime gereproduceerd:

1. Lokale batch met categorie Before, status Nakijken, staat in de retryqueue onder batch-ID.
2. Upload van oude details pauzeert tijdens de eerste chunkwrite.
3. Een nieuwere lokale keuze verandert dezelfde batch naar After / Goedgekeurd en vervangt het queue-item met hetzelfde ID.
4. De oude upload hervat, publiceert de oude header en verwijdert onvoorwaardelijk het queue-item.
5. Cloud bevat Before/Nakijken; de nieuwere queued approval is verdwenen. Compacte state, listener en reload kunnen daardoor materialisatie en details van verschillende revisies lezen.

Ook vastgesteld: vaste chunknamen konden generaties mengen; lokale details konden nieuwere cloudkeuzes maskeren; de eerste compacte cloudsnapshot kon pending lokale importkeuzes verdringen. Reference/fingerprint-only deduplicatie kon verschillende bankregels hetzelfde behandelen.

De baseline is vóór wijzigingen vastgelegd in een geïsoleerde kopie met 159 bron-/test-/documentatiebestanden en SHA-256-manifest. Financiële capture gebruikt de bestaande visual fixture en een uitsluitend lokaal gelezen historische back-up als geïsoleerde fixture. Firebase SDK- en Firestore-netwerkverzoeken zijn geblokkeerd. De originele back-up is niet gewijzigd.

## B. Canonieke source/batch lifecycle

Een betrouwbare CSV-source behoudt batch-ID + row-ID, immutable bankOriginal en bestaande P3 processing lines/splits. sourceIdentityProof beschrijft expliciete herkomst: originele file/SHA-256 + logical row ordinal, of expliciete betrouwbare bank-ID. Reads/render/reload maken geen identities.

Nieuwe optionele metadata: batch lifecycle, version, baseVersion, operationId; transaction batchLifecycle; importfout/possible-duplicate-diagnostiek; technische importDeletionProofs. Geen schema-bump of tweede migratieroute. Approval history en processing blijven bestaan.

- active: centrale source approval bepaalt activiteit; open rows blijven inactief.
- withdrawn: alle batchsources financieel inactief, processing/approval/provenance behouden.
- deleted: terminal technisch bewijs; actieve batch-/sourcepayload verwijderd.

getTransactionProcessingStatus blijft de vier P3-statussen gebruiken. Niet meetellen blijft een afgehandelde source met nul effect, afzonderlijk van withdrawal/delete. isTransactionFinanciallyActive en de engineprojectie controleren lifecycle naast source approval; splitapproval kan een withdrawn parent niet activeren.

deriveBatchReviewStatus telt source states en leidt concept/gedeeltelijk/verwerkt af. Batchstatus bepaalt geen financiële approval. Meerdere open batches zijn toegestaan en blijven via importhistorie bereikbaar; activeImportId is alleen een geselecteerde referentie.

## C. Partial processing + dates

Iedere expliciet goedgekeurde source materialiseert onmiddellijk via dezelfde P3/P4-commandroute. Andere Onbekend/Nakijken-rows blokkeren hem niet. De groepsdialog past op soortgelijke rows uitsluitend voorstellen toe; iedere source vereist eigen expliciete approval. Geen bulkapproval.

Iedere row gebruikt zijn eigen transactionDate. Als transactiedatum én boekdatum bestaan, heeft transactionDate voor normale financiële plaatsing voorrang. Boekdatum, importdatum en processingdatum blijven metadata. Fixed realization behoudt occurrence month; refund behoudt bankmonth en expliciete refundMonth; inkomen blijft actual transaction month. P4 coverage behoudt same-bank-calendar-month en de fixed coverage-grens.

Een toekomstige of ongeldige kalenderdatum wordt een importfout met datum en bronregel. De row blijft als foutdiagnostiek bij de import, staat niet normaal in Onbekend/Nakijken en materialiseert geen financieel effect. Centrale sourcecommands blokkeren ook directe approval/replacement van zulke foutrows vóór mutatie. Geldige siblings gaan door. De datumcontrole gebruikt bij importcreatie een expliciet/injecteerbaar today; hij verzint geen historische ingangsmaand en verplaatst geen bankdatum.

## D. Duplicate detection + manual matching

Conform de gebruikerskeuze wordt automatisch overgeslagen alleen bij bewezen betrouwbare bronidentiteit, plus dezelfde fysieke accountcontext en immutable bronvelden. Identiek origineel bestand + dezelfde logical ordinal is file-row-herkomstbewijs; gelijke rows binnen hetzelfde bestand behouden hun afzonderlijke ordinals. SHA-256 wordt op originele UTF-8-bytes berekend. Een referentie, merchant, bedrag of omschrijvingshash is geen bewijs. Ontbrekende/ongeldige row ordinals of lege bank-ID/authority tellen evenmin als betrouwbaar bewijs.

Gelijke bankvelden zonder bewijs leveren een mogelijke duplicate op, geen auto-skip. Verschillende rekening, datum, bedrag of relevante bronvelden worden niet automatisch gededupliceerd. Candidate duplicate-source-preflight blokkeert twee actieve imports van dezelfde bewezen source vóór approval/restore.

Manual→CSV blijft een expliciet te bevestigen possible match. Voorstellen gebruiken betrouwbare accountcontext, exact cents-bedrag en een beperkte datumafstand; zij vervangen niets automatisch. Bevestiging gebruikt de P3 replacementcommand: CSV date/amount/description/bankOriginal winnen, veilige processing kan worden overgenomen, manual blijft auditbaar/suppressed, CSV gaat naar Nakijken. Splits, goal/refund/fixed/coverage/transfer/advance-dependencies blijven onder P3/P4-validatie.

## E. Withdraw / restore / delete

Terugtrekken: pure planImportCommand maakt een clone, deactiveert eigen sources via batchLifecycle en bewaart bankrows, processing, splits, links, approval/history en allocations. P4 synchroniseert uitsluitend gewijzigde source-ledgereffecten. Confirmed transferrelaties worden inactief zolang een endpoint inactief is. Batch-owned repayments worden veilig gedeactiveerd; onafhankelijke aflossingen/verrekeningen kunnen withdrawal vóór mutatie blokkeren.

Herstellen: de volledige resulterende candidate wordt vooraf gevalideerd. Alleen eerder approved geldige sources worden actief; open rows blijven open, Niet meetellen blijft nul. Split sum/processed amount, fixed occurrence, negative goal, coverage overflow/missing endpoint, refund overflow, replacement/pair, advances en bewezen dubbele source worden gecontroleerd. Herhaald restore is een no-op; geen partial silent restore.

Permanent verwijderen: uitsluitend batch-owned materialisaties, importdetails/rows/processing, eigen actual-ledger/advance/repayment-effects en relaties naar verdwenen endpoints verdwijnen. Een onafhankelijke planned-ledgerregel blijft bestaan; een link naar een verwijderde actual wordt losgekoppeld. Onafhankelijke manual transactions, goal corrections, planning/histories, andere imports en closures blijven behouden. Coverage/replacement/pair-relaties naar verwijderde endpoints worden op de candidate veilig verwijderd, zonder orphan actief effect.

Volgens de gebruikersbeslissing resteert alleen technisch verwijderbewijs: batch-ID, version, lifecycle deleted, deletion date/device en operation-ID; cloudtransport heeft daarnaast baseVersion. Geen bankregels, bedragen, categorieën of financieel auditoverzicht in dat bewijs. Het deletejournal bevat na voltooiing uitsluitend technische metadata; eigen oude journals/payloads/autosaves worden opgeruimd. Onafhankelijke exports/migratieback-ups worden niet herschreven.

Clouddelete publiceert eerst terminale tombstone samen met de corewijziging, daarna verwijdert hij alle chunkgeneraties. Onderbreking/offline laat cleanup in de retryqueue; de tombstone verhindert ondertussen heractivatie. Een cloudmocktest controleert expliciet dat na cleanup alle rows/sourcechunks weg zijn en uitsluitend technisch bewijs resteert.

Manual replacement volgt het bestaande P3-contract: withdrawal/delete deactiveert de replacementrelatie en laat de onafhankelijke manual baseline terugvallen. Restore activeert de geldige CSV-relatie weer, zodat beide nooit dubbel actief zijn. Een concurrerende replacement blokkeert restore.

## F. Cloud/local synchronization + revisions/conflicts

Authoritative persistent representation: gedetailleerde, versioned CSV-batch met immutable originele bankrows, processing en sourceapproval. Financiële materialisatie: compacte state.transactions en P4-ledgereffecten, gebonden aan dezelfde operation receipt. Financiële projecties blijven pure outputs van de ene P3/P4-engine. Geen tweede database/engine.

Lokale writes:

1. Expliciete intent en operation-ID bepalen, per batch serialiseren.
2. Actuele local version + immutable originals controleren.
3. Volledige candidate op clone maken en alle dependencies valideren.
4. Journal met intent/candidate/baseSignature vóór persistent wijzigen vastleggen.
5. Details en outbox duurzaam bewaren, daarna gevalideerde compacte corecommit.
6. Corecommitfout herstelt vorige details/outbox via een atomische expected-operation guard. Nieuwere keuzes worden niet gewist; onderbreking blijft journal-herstelbaar.
7. Journalreceipt afronden; voltooide candidate/backups uit het operationjournal verwijderen.

Herstel schrijft details/outbox vóór financiële corestate en controleert opnieuw dat de base niet veranderde. Receipt maakt replay idempotent. Een gewijzigde core bewaart de keuze als expliciet conflict; hij wordt niet blind vervangen.

Cloudwrites:

1. Alleen details die bij de snapshot receipt horen voorbereiden.
2. Rows en originele CSV publiceren onder immutable operation-generaties; UTF-8/grenzen/checksums/SHA-256 controleren.
3. In de bestaande Firestore-transactie core syncVersion/signature én batch baseVersion lezen/valideren.
4. Headers en compacte financiële snapshot samen publiceren.
5. Acknowledgement verwijdert alleen exact geüploade operation/version. Een intussen nieuwere queue blijft staan en krijgt de bevestigde baseVersion.

Listener echo van dezelfde operation is idempotent. Oudere/inconsistente syncVersion blijft onder het bestaande protocol geweigerd. Retry herhaalt dezelfde intent; incomplete chunks/detailsfailure publiceren geen compacte nieuwe financiële waarheid. Legacy queued details krijgen alleen tijdens expliciete write/retry transportmetadata, niet bij normale read.

Conflicten: cloudstand blijft actief, lokale keuze wordt duurzaam afzonderlijk in ImportStore-journal bewaard. UI: Cloudstand behouden of Lokale keuze opnieuw toetsen. Bij lokale processingkeuze worden alleen gewijzigde betrokken sources heropend naar Nakijken, zonder automatische approval. Ongewijzigde approved siblings blijven actief. Lifecyclekeuzes worden opnieuw als complete command op actuele cloudstate getoetst. Een compacte keuze met meerdere imports wordt niet blind teruggezet; betrokken imports worden afzonderlijk beoordeeld. Geen silent last-write-wins.

LocalStorage blijft het corecontract. ImportStore gebruikt dezelfde stores/databaseversie met huishouden-suffix; een browsertest controleert dat identieke batch-ID’s van twee huishoudens elkaar niet zien. Legacy unscoped details worden alleen overgenomen op basis van expliciet bestaande batchreferenties.

## G. P4 savings/refund/coverage/fixed/replacement lifecycle

| Component | Withdraw | Restore | Delete |
|---|---|---|---|
| Savings deposit/withdrawal | Alleen eigen goal-effect inactief; ledgerhistorie behouden | Exact één effect; stabiele ledger-ID | Eigen actualeffect weg; onafhankelijke opening/correction/planning behouden |
| Coverage withdrawal endpoint | Allocation inactief; expense krijgt reguliere impact terug | Geldig endpoint en volledige candidate vereist | Relation naar verwijderd endpoint veilig weg |
| Coverage expense endpoint | Allocation inactief; actieve withdrawal unused stijgt | Coverage terug indien geldig | Endpointcleanup, andere expenses intact |
| Refund | Bankcashflow/historische correctie nul | Beide exact eenmaal actief | Eigen refundsource/effect verwijderd |
| Fixed actual | Realization nul; planned reserve blijft | Actual/deviation/Betaald via P3 | Actuallink weg; planning/historie intact |
| Manual replacement | Onafhankelijke manual valt terug | CSV leidend; geen dubbele actual | Manual blijft, replacementrelatie weg |
| Confirmed internal pair | Pair inactief als endpoint inactief | Beide endpoints en validatie vereist | Relatie naar verdwenen endpoint weg |

Geen planningbedragen of historische closures worden herschreven. Real expense blijft bruto; coverage/refunds beïnvloeden hun bestaande P4-dimensies. Negatieve goals/refund- of coverageconflicten blokkeren vóór mutatie; er wordt geen interpretatie gegokt.

## H. Compatibility/storage + P4 allowance protection

Schema v11 blijft behouden. Optionele concurrency/lifecyclevelden passen in de bestaande migratie/normalisatie en JSON-route. Onbekende velden en immutable bankOriginal blijven behouden. Geen v12, reset, massaherclassificatie, goalheuristiek of refundMonth-heuristiek.

Bestaande facades en publieke FinizeUpdate4/FinizeTransactions/CloudAdapter-API’s blijven consumers van dezelfde modules. Pure legacy undo-adapters blijven waar regressie/legacy ze gebruikt; de actieve UI en lifecycle commands gebruiken P5. Legacy CSV zonder betrouwbare source identity blijft leesbaar; onveilige lifecycle/edit blijft concreet geblokkeerd.

Zakgeld: P5 wijzigt geen forecast-/allowanceformule. FixedReserve, budgetReserve en savingsReserve blijven 100% van historische maandplanning. Expense 0/300/400/700 bij budget500 verandert de reserve niet. Planned saving250 blijft250 bij actual0/250/300; fixed plan100/actual105 reserveert100. Refund, coverage en unused withdrawal herverdelen zakgeld niet. Buffers/actuele available en actual selectors volgen lifecycle wel.

Inkomstenprecedence blijft: active salary > expliciete persoonlijke manual dashboard salary > historische planned salary; expliciete nul geldig. Lifecycle van een salarisbron kan volgens dit contract de inkomstenbasis wijzigen. Lastenrealisatie wijzigt de geplande zakgeldreservering nooit. Administrative total-income correction wordt niet heuristisch over personen verdeeld.

Closures/snapshots, planninghistorie en goal corrections worden niet bij load herbouwd. PWA-cachemarker wordt finize-v100-import-lifecycle; dat is geen schemawijziging.

## I. Gewijzigde bestanden

Uitsluitend P5 ten opzichte van de bevroren P4-werkboom:

| Bestand | Wijziging / reden / vervangen caller |
|---|---|
| src/import/import-lifecycle.mjs (nieuw) | Pure planner/preflight vervangt actieve destructieve batch undo |
| src/import/import-identity.mjs (nieuw) | Duplicateproof, kalender/future-diagnostiek, SHA-256 en candidate duplicate conflict |
| src/import/import-sync-protocol.mjs (nieuw) | Batch-CAS, receipts, source-/relatieconflict en pure detailmergeprimitive |
| src/import/runtime.js | Store/parser/journal/recovery, individual approval, conflict UI, lifecycle, generationcloudsync, scoped storage; vervangt gate/lokale-prioriteit/queue delete |
| src/core/runtime.js | CloudAdapter atomic header/core, pending protection, conflict/rebasepreflight, householdscope; syncVersion behouden |
| src/core/transaction-model.mjs | Centrale activity respecteert withdrawn/deleted; overige status/ownerbetekenis behouden |
| src/core/transaction-engine.mjs | Split activity respecteert lifecycle; pairconfirm negeert inactieve historische pair; geen allowancewijziging |
| firestore.rules | Batch CAS/terminal tombstone/immutable chunks; huishoudautorisatie behouden; niet gedeployed |
| index.html | Assettag 100-import-lifecycle |
| service-worker.js | PWA-cachemarker; offline-routecontract behouden |
| app.js | Reproduceerbaar uit sources gegenereerd |
| tests/package5-lifecycle.test.cjs (nieuw) | L/D/DT/P4L/R en dependency/privacy/pair/advance-auditcases |
| tests/package5-sync.test.cjs (nieuw) | SY/race/conflicten/interruptions/detailsfailure/Unicode/deletecleanup |
| tests/helpers/package5-fixture.cjs (nieuw) | Geïsoleerde fixed-ID planning/savings/cloudmocks |
| tests/browser/package5-import-lifecycle.spec.cjs (nieuw) | Desktop/mobiel lifecycle, meerdere batches/dates/duplicate, adaptercloudmock/twee devices/echte IDB-isolatie/stale rollback |
| tests/package3-processing-integration.test.cjs | Details-before-core failureverwachting, journal-intent en volledig opslagmock; P3-assertions behouden |
| tests/package4-processing-integration.test.cjs | Mock uitgebreid met outbox-read/delete; financiële assertions behouden |
| tests/update4-import-engine.test.cjs | Duplicatefixture vereist sourceprovenance in plaats van fingerprint alleen |
| tests/update4-cloud-import.test.cjs | CAS/atomair receiptcloudmock; legacy readcontract behouden |
| tests/update4-ui-structure.test.cjs | Lifecycle controls vervangen all-batch/destructieve undo UI |
| tests/browser/import-review-simplification.spec.cjs | Partial-source test vervangt oude all-batch-gate verwachting |
| tests/browser/package3-transaction-engine.spec.cjs | Wacht op core/sourcecommit, niet optimistische certainty |
| tests/browser/package4-savings-refunds-forecast.spec.cjs | Zelfde commitwait; P4-financiële assertions behouden |
| tests/html-inline-syntax.test.cjs | Nieuwe assettag |
| tests/service-worker-cache.test.cjs | Nieuwe cachemarker |
| tests/update4-final-regression.test.cjs | Release/cachemarker; overige regressievoorwaarden behouden |
| tests/update5-responsive-structure.test.cjs | Assetmarker; responsive assertions behouden |
| README.md | Actuele P5-opslag/lifecycle en verslaglink |
| docs/v50-architecture.md | Authority, atomic publication, conflicten en P4-contract |
| docs/package-5-import-lifecycle.md (nieuw) | Dit verslag |

app.css, stylesheetbronnen en visuele snapshots zijn niet gewijzigd. Andere cumulatief dirty bestanden uit P1–P4 zijn geen nieuwe P5-wijzigingen als hun frozen hash gelijk bleef.

## J. Tests + baseline A/B/C

Alle vaste test-ID’s hieronder zijn individueel PASS. De 24 extra auditcases controleren SHA-256/fileordinals, ontbrekende endpoints, replacementconflict, planningbehoud, queue-overrun, startupconflict, beide conflictkeuzes, Unicode, interrupted saves/recovery, deleteprivacy, confirmed pair en onafhankelijke advance-afhankelijkheid.

### L

| Test | Resultaat | Controle |
|---|---|---|
| L1 | PASS | Partial batch: vier source states. |
| L2 | PASS | Approved source onmiddellijk actief. |
| L3 | PASS | Terugtrekken. |
| L4 | PASS | Financieel nul na withdraw. |
| L5 | PASS | Bank/processing/metadata behouden. |
| L6 | PASS | Herstellen. |
| L7 | PASS | Repeated restore geen duplicaat. |
| L8 | PASS | Open rows blijven open. |
| L9 | PASS | Niet meetellen nul. |
| L10 | PASS | Complete restoreconflict blokkeert vóór mutatie. |
| L11 | PASS | Delete batch-owned effecten. |
| L12 | PASS | Onafhankelijke data overleeft. |

### D

| Test | Resultaat | Controle |
|---|---|---|
| D1 | PASS | Bewezen file-row-identiteit overgeslagen. |
| D2 | PASS | Andere account geen duplicate. |
| D3 | PASS | Andere datum geen duplicate. |
| D4 | PASS | Ander bedrag geen duplicate. |
| D5 | PASS | Andere bronomschrijving geen auto duplicate. |
| D6 | PASS | Fuzzy/equal fields zonder proof nooit autoskip. |
| D7 | PASS | Manual possible match uitsluitend voorstel. |
| D8 | PASS | Expliciete replacement volgens P3/P4. |

### DT

| Test | Resultaat | Controle |
|---|---|---|
| DT1 | PASS | Multi-month CSV. |
| DT2 | PASS | Transaction date boven booking/processing. |
| DT3 | PASS | Fixed occurrence uitzondering. |
| DT4 | PASS | Refund bank/correction month. |
| DT5 | PASS | Income actual month. |
| DT6 | PASS | Future row importfout. |
| DT7 | PASS | Geldige siblings gaan door. |

### SY

| Test | Resultaat | Controle |
|---|---|---|
| SY1 | PASS | Device A→B: details/core zelfde commit. |
| SY2 | PASS | B→A: verwerking/versie behouden. |
| SY3 | PASS | Stale revision vóór overwrite geweigerd. |
| SY4 | PASS | Listener/commit echo idempotent. |
| SY5 | PASS | Reload review. |
| SY6 | PASS | Reload approved. |
| SY7 | PASS | Reload withdrawn. |
| SY8 | PASS | Reload restored. |
| SY9 | PASS | Viewport onafhankelijke projectie/JSON. |
| SY10 | PASS | Interrupted journal exactly-once herstel. |
| SY11 | PASS | Retry zelfde intent. |
| SY12 | PASS | Detailsfailure publiceert geen core. |
| SY13 | PASS | Oude upload kan nieuwe queue niet verwijderen. |
| SY14 | PASS | Originele CSV/bankrows/processing behouden. |

### P4L

| Test | Resultaat | Controle |
|---|---|---|
| P4L1 | PASS | Savings deposit withdraw. |
| P4L2 | PASS | Savings restore eenmaal. |
| P4L3 | PASS | Withdrawal allocation inactief. |
| P4L4 | PASS | Expense endpoint inactief: unused stijgt. |
| P4L5 | PASS | Allocation restore zonder duplicaat. |
| P4L6 | PASS | Refund withdraw. |
| P4L7 | PASS | Refund restore eenmaal. |
| P4L8 | PASS | Fixed actual withdraw. |
| P4L9 | PASS | Fixed actual restore. |
| P4L10 | PASS | Planningreserve gelijk bij fixed/savings lifecycle. |
| P4L11 | PASS | Zakgeld gelijk bij onder-/overspend. |
| P4L12 | PASS | Actuele buffers bewegen correct. |

### R

| Test | Resultaat | Controle |
|---|---|---|
| R1 | PASS | Accountcontextcontract behouden. |
| R2 | PASS | Fixed planning/historie behouden. |
| R3 | PASS | Income planning/precedence behouden. |
| R4 | PASS | Pairrelaties + P3 transferregressies. |
| R5 | PASS | Replacementrelaties + P3 matchingregressies. |
| R6 | PASS | bankOriginal exact behouden. |
| R7 | PASS | Allocations behouden bij reversible lifecycle. |
| R8 | PASS | Savings ledger zonder dubbeltelling. |
| R9 | PASS | Onafhankelijke advances behouden. |
| R10 | PASS | Closures/snapshots onveranderd. |
| R11 | PASS | Budgethistorie ongewijzigd. |
| R12 | PASS | Schema blijft 11. |
| R13 | PASS | JSON roundtrip. |
| R14 | PASS | Scenario blijft verwijderd. |
| R15 | PASS | P4 allowanceBasis exact gelijk na restore. |



### Volledige verificatie

| Controle | Resultaat / omvang |
|---|---|
| Node P1–P5 en bestaande suites | PASS 43/43 bestanden; 307 geregistreerde cases, 0 fails/skips; legacy script-assertions daarnaast |
| P5 | PASS 92/92: 68 verplichte ID’s + 24 auditcases |
| Browser | PASS 116/116, 0 failed/skipped/flaky; Chrome, geïsoleerde lokale mirror |
| Desktop/mobile | 390/1440px P5-flows; bestaande responsive/visuele suite PASS; snapshots niet bijgewerkt |
| Cloudmock/device | Atomic core/header, A→B approval→A, stale/echo/retry/startupconflict/detailsfailure/journal/IDB-isolatie PASS |
| Syntax | PASS, inclusief inline-scriptcontrole |
| CSS | PASS: 971 hoofdnodes, 0 bekende ongedefinieerde tokens; bytegelijk P4 |
| Build/reproducibility | PASS: app.js/app.css byte-reproduceerbaar |
| PWA/offline | Bestaande service-worker/cache en browseroffline tests PASS |
| Migration/load-no-write/JSON | P1/P2/P4/legacy storagetests en P5 roundtrip/readtests PASS |
| Security | Auth/account/Firestore-regelscontracten en dynamic-HTML-tests PASS |
| Baseline | Protected state + volledige financial outputs exact gelijk, C=0 |

De Firebase SDK is vervangen door geïsoleerde mocks. Regels zijn via statische securitycontracten gecontroleerd; geen Firebase-emulator/live-servertest of regelsdeployment. Dit wordt niet als live Firestore-verificatie gepresenteerd.

### P4→P5-baseline

Alle onderstaande bedragen zijn vóór/na exact gelijk. Forecast household is actuele beschikbare ruimte; zakgeld komt uit de planningbasis van dezelfde centrale engine.

| Fixture / maand | Dion zakgeld | Dara zakgeld | Huishoudelijk beschikbaar | Gezamenlijke buffer | Actual income | Real expense |
|---|---:|---:|---:|---:|---:|---:|
| visual / 2026-07 | 1.166,58 | 1.433,23 | 1.788,97 | 500,00 | 0,00 | 0,00 |
| historical / 2026-06 | 1.189,92 | 1.300,36 | 930,49 | 754,00 | 0,00 | 584,71 |
| historical / 2026-07 | 1.086,27 | 2.660,60 | 1.841,94 | 9,92 | 5.335,85 | 4.164,83 |
| historical / 2026-08 | 876,42 | 1.233,86 | 930,29 | 854,00 | 0,00 | 452,71 |

Gezamenlijke fixed/budget/savings-reserve: visual juli 2.360,19 / 500 / 0; historische juni 2.979,72 / 600 / 154; juli 2.679,72 / 650 / 154; augustus 2.679,72 / 700 / 154. Persoonlijke allowanceBasis/reserves/buffers zijn eveneens recursief gelijk.

Protected state: visual 0 transactions, historische fixture 186 transactions, bedragen/bankOriginal ongewijzigd. Planning/fixed-/budget-/incomehistorie, goals/ledger/allocations, importreferenties, advances/repayments, replacements/pairs en closures zijn recursief gelijk. Financial comparison omvat alle maandtransactioneffects, income/expenses, accounts, categories, fixed actuals, month summaries en volledige forecast inclusief allowanceBasis.

- A: vereiste P5-verschillen bij nieuwe lifecycle/importacties: individuele approval actief; withdraw/restore/delete source-effects; bewezen duplicate skip; future row geweigerd; staleconflict expliciet. Fixed-ID fixtures testen deze correcties; de onaangeraakte P4-baseline blijft gelijk.
- B: optionele transport/lifecycle/receipt/diagnostiekmetadata en controls; geen verandering van financiële betekenis of schema.
- C: **0 regressies**. Zonder nieuwe P5-handeling zijn state en financiële outputs exact gelijk.

Reproductie: node scripts/run-node-tests.mjs; node scripts/check-syntax.mjs; node scripts/check-css.mjs; node scripts/build.mjs; node scripts/build.mjs --check; playwright test. De uitgevoerde browserconfig gebruikt de lokale mirror en beschikbare Chrome met Firebase/Firestore geblokkeerd of gemockt. Capture serveert frozen P4 en huidige runtime met dezelfde input. Geen assertions/toleranties versoepeld; geen snapshots automatisch geaccepteerd.

Bijlagen: Finize-P5-Node-testresultaten.txt, Finize-P5-browser-testresultaten.json, Finize-P5-baselinevergelijking.json en Finize-P5-verificatie.json.

## K. Open risico's / concrete P6-dependencies

| Punt | Exacte code / reden | Minimale vervolgstap |
|---|---|---|
| Legacy CSV zonder betrouwbare source identity | planImportCommand, P3 sourceguards in core/runtime + transaction-processing; ontbrekend batch/row-detailbewijs | Leesbaar houden; alleen expliciet uniek provenancebewijs of geautoriseerde herstelroute; geen heuristiek |
| Ontbrekende oude savings/refundcontext | P4 legacy-savings-goal-missing / legacy-refund-context-missing in transaction-engine | Expliciete source-herverwerking/correctie indien nodig; geen goal/refundMonth gokken |
| Historische gesloten snapshots | monthRecords en closure readers | Alleen afzonderlijk geautoriseerde correctie; P5 rebuildt niets |
| Uitgevoerde advanceverrekening/independent repayment | planImportCommand preflight en transaction-processing advanceguards | Afhankelijke eigen administratie eerst via veilige expliciete correctie; lifecycle blokkeert vóór mutatie |
| Regel-/clientrelease niet gepubliceerd | firestore.rules, generationwriters/core CAS | Bij geautoriseerde release emulator/live-stagingtest en clientcompatibiliteit controleren; niets gedeployed |
| Offline permanente delete | cleanupDeletedCloudChunks/outbox/retry | Online cleanup voltooien; terminale tombstone verhindert stale heractivatie; geen financial deleteaudit |
| Lokale opslag-/netwerkfout | ImportStore journal/CAS, CloudAdapter conflict UI | Opslagfout blokkeert vóór financiële mutatie; keuze opnieuw expliciet beoordelen, geen stille overwrite |

Geen open productvragen: keuzes over deletebewijs, cloudconflicten, duplicatebewijs en meerdere open batches zijn verwerkt. Geen P6 geïmplementeerd. Productie-Firestore niet geraakt; niets gepusht, gepubliceerd of gedeployed. Schema blijft v11.
