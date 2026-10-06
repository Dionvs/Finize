# FINIZE — PAKKET 7/7

Definitief technisch verslag A–L, 6 oktober 2026. Cumulatieve lokale P1–P6-werkboom als uitgangspunt. **STATUS: READY** als lokaal getoetste release candidate. Release is niet uitgevoerd.

Schema **v11 → v11**. **45/45 Node-testbestanden, 402/402 geregistreerde node:test-cases; 150/150 browsertests PASS**. P7 voegt 29 gerichte Node-cases en 14 browsercases toe. Eindrun: 0 failures, 0 skips, 0 flaky cases, 0 productvragen. **Categorie C = 0**. CSS en bestaande snapshots zijn bytegelijk aan de P6-freeze. Productie-Firestore niet geraakt; geen commit, push, deploy of rules deployment.

## A. Freeze / uitgangsbaseline

Git HEAD is niet gebruikt als functionele baseline. De actuele ongecommitte P6-werkboom is vóór wijziging bevroren: **185 bestanden**, volledige SHA-256/byte-manifest, git status, volledige cumulatieve diff, diff/stat en HEAD. Bewijs staat in de lokale work-artifacts `p7-p6-freeze/`, `p7-p6-manifest.json`, `p7-freeze-metadata.json`, `p7-git-status-before.txt`, `p7-git-diff-before.txt` en `p7-git-stat-before.txt`. Het HEAD is na de audit gelijk. Geen reset of checkout naar HEAD.

| Contract | P6 vóór | P7 na |
|---|---|---|
| State schema | 11 | 11 |
| ImportStore database | 1, householdscoped | gelijk |
| Import cloud envelope | 2 | gelijk |
| Cachemarker | finize-v101-functional-consolidation | finize-v102-release-candidate |
| CSS SHA-256 | ba99ba8633c996ca0106b6db6417e2fd6141a635bd00ab202d2307fb2def975f | gelijk |
| Firestore rules SHA-256 | 4da9ac22e3cf36982d280a9dfebf61863ade58c03c5e1b1658c5055a9f00bc83 | gelijk |

Freeze registreert daarnaast generated app-hash, package/lock/buildconfig, testconfig, service worker en rules. Machineleesbare vóór/na-hashes staan in `docs/audit/package-7-verification.json` en het externe releasebestandsmanifest. De definitieve verslagen P1–P6 zijn bytegelijk gebleven, inclusief de gecorrigeerde P4-zakgeldregel en definitieve P5/P6-overdracht.

De reproduceerbare capturer opent dezelfde visual fixture en lokale historische export als P4–P6 in gescheiden browsercontexten; SDK/Firestoreverzoeken worden geblokkeerd. De export is uitsluitend gelezen. Complete genormaliseerde state plus alle relevante maandprojecties worden vastgelegd, niet alleen zichtbare KPI’s. Importcapturer assembleert alle zes opgeslagen headers/chunksets met de echte importreader. De originele input blijft onveranderd.

Begintoestand: 44/44 Node-bestanden, 373 cases en 136/136 browsercases groen. P7-before/P7-after zijn recursief exact gelijk voor beide financiële datasets en voor **6 imports met 176 bankregels**. Historische fixture: **186 transacties, 171 bankOriginal-objecten, 29 ledgerentries**. Visual fixture: 0 transacties, 6 ledgerentries. Private bankpayload blijft in lokale work-artifacts en is niet opgenomen in deze releasebestanden/bundle.

## B. Architectuur- en caller-audit

Gelezen/gecontroleerd: cumulatieve git diff en werkboom, README/actieve architectuur, definitieve P1–P6-verslagen, tests en baseline-artifacts, build/PWA/Firestore/securityconfig, model/processing/engine/timeline/normalisatie, import identity/lifecycle/sync/generation/journal en uitvoerende core/import runtimes. Facadebestanden zoals `import-store.js`, `import-sync.js`, `cloud-state.js` zijn adapters; de uitgevoerde implementaties zijn ook geaudit.

| Concept / callers | Canonieke route | Classificatie / uitkomst |
|---|---|---|
| Budget/fixed/income editors en readers | planning-timeline.mjs + recurring-occurrences.mjs | ACTIVE: dezelfde from/once/end/monthsemantiek |
| Maandspaarplanning | setSavingsPlanForMonth + bestaande month override | ACTIVE: uitsluitend geselecteerde maand; geen ledgerwrite |
| Manual create/edit, accountmodals, publieke save | upsertManualFinancialTransaction + validateManualTransactionInput + volledige preflight | ACTIVE; publieke wrapper kreeg dezelfde preflight vóór commit |
| Source activity/status/account/source | transaction-model.mjs | ACTIVE; geen UI-statuswaarheid toegevoegd |
| Actual/forecast/zakgeld/categorie/fixed | transaction-engine.mjs projectTransaction/selectors | ACTIVE; P7 verandert geen financiële formule |
| CSV create/approve/reopen/replacement | import/runtime → P3 processing → journal/commit | ACTIVE; P5 protocol ongewijzigd |
| Withdraw/restore/delete | import-lifecycle.mjs + complete candidate preflight | ACTIVE; geen alternatieve importwriter |
| Cloud/local | immutable generations, CAS/baseVersion, receipts, outbox, conflicts | ACTIVE; bestaand P5 protocol, niet vervangen |
| Savings ledger/correcties | data-normalization/processing + bestaande ledger | ACTIVE; geen balansreconstructie bij read |
| Accountlijsten | selectActiveTransactions({month,account}) | ACTIVE: fysieke rekening; categoriedetails gebruiken financiële bestemming |
| getMonthlyScenarioData / calcScenario | flat planningresolver / centrale forecast + presentatieadapter | ACTIVE wrappers; naam is legacy, geen Voor/Na-productbranch |
| Algemene oude manual namen | openTransactionModal/openGeneralTransactionModal → contextmodal | ACTIVE adapters; geen tweede formuliercontract |
| transactionReviewQueue | legacy opgeslagen data en compatibiliteitsreaders | COMPATIBILITY; bewust behouden |
| u3OpenReview / u3OpenTransfers | retained bindU3Admin + private compatibility-renderers | COMPATIBILITY-island; huidige dashboard rendert de oude admincontrols niet. XSS getest met werkelijk bronfunction-harness, niet gepresenteerd als normale zichtbare flow |
| renderRowsTable | alleen functiedefinitie, geen runtimecaller/export gevonden | DEAD kandidaat; behouden omdat verwijderen niet nodig is voor releasekwaliteit |
| Exported compatibilityhelpers/testfacades | bestaande publieke/testcontracten | ACTIVE/TEST-ONLY; behouden |

Geen tweede actieve transaction-, planning-, budget- of zakgeldcalculator gevonden. Legacy scalar-/refundfallbacks blijven expliciete compatibility-adapters. Actieve vaste-last-/budget-maandlezers gebruiken de centrale maandsemantiek. Overgebleven Voor/Na-verwijzingen zitten in legacy migratie/validatie; er is geen scenarioselector of nieuwe active branching. Er is geen code verwijderd.

## C. Financiële invariant-audit

INV I1–I20 zijn afzonderlijk in het auditregister gedekt met bestaande en gerichte tests. AccountContext komt nooit uit financialFor/budgetOwner. De twee salarisbronnen kunnen fysiek op Gezamenlijk staan en blijven per persoon herkenbaar voor salary precedence. Persoonlijke ontvangstweergave omvat zakgeld en relevante fysieke receipts/teruggaven, geen gezamenlijk salaris.

Actual income is uitsluitend werkelijk/actief inkomen; planningfallback wordt niet als actual opgeslagen. Approval en lifecycle blijven centraal. CSV recognition/zekerheid keurt niets goed; Onbekend, Nakijken, Niet meetellen, withdrawn en deleted hebben geen actieve financiële effecten. Splits krijgen source-level approval en worden exact één keer geprojecteerd.

Fixed: planned100/actual105/deviation+5; meerdere actuals toegestaan; Betaald zodra minimaal één geldige actual aanwezig is. Bankcashflow gebruikt bankmaand, realization gebruikt occurrence-maand. Coverage verandert uitsluitend reguliere burden, niet planned/actual/deviation/Betaald. De nieuwe orphan-linkguard voorkomt een fixed-occurrenceverwijzing zonder corresponderende vaste last; opgeslagen legacydata wordt niet heringedeeld.

Expense blijft bruto realExpense. Refund blijft bankcashflow in bankmaand, geen income, correctie naar expliciete refundCategory/refundMonth, originele expense intact, geen negatieve categoriebelasting. Gemengde fixed/variable categorie houdt de eerder goedgekeurde afzonderlijke categoriecorrectie; er wordt geen aankoopkoppeling gegokt.

Deposit/withdrawal blijven goalbewegingen, geen gewone income/expense. Correctie is ledger-only. Coverage is many-to-many, exacte centen, actieve endpoints en dezelfde bankkalendermaand; fixed coverage vereist ook geldige occurrence-maand. Unused withdrawal verhoogt actuele beschikbare middelen en niet zakgeld.

**Zakgeld is ongewijzigd volledig planninggedreven**: budget500 bij actual0/300/400/700 reserveert500; savingsplan250 bij actual0/250/300 reserveert250; fixedplan100/actual105 reserveert100. Refund, coverage, extra/minder werkelijk sparen, unused withdrawal, manualexpense en batch withdraw/restore/delete herverdelen geen zakgeld. Actuele buffers bewegen wel. Alleen de bestaande inkomstenprecedence blijft gelden: active actual salary > expliciete persoonlijke manualdashboardwaarde > historisch planned salary; nul geldig, onverdeelde administrative total niet heuristisch verdeeld.

Bevestigde internal pair voorkomt dubbel external household effect. Expliciet intern maar unconfirmed behoudt accountcashflow en external impact0. Paarvoorgesteld is geen automatisch bevestigde pairing.

## D. Planning/manual audit

PLAN P1–P15 en MAN M1–M15 PASS. Nieuwe fixed-ID fixtures doorlopen meerdere maandgrenzen: budget januari500, maart600, juni550, september verwijderd, november700; tijdelijke juli575 valt terug. Fixed-properties inclusief eigenaar, bedrag, naam/categorie en betaaldag blijven historisch; end-exclusive stop en expliciete herstart bewaren het gat. Salary en overige income from/once/stop/restart houden eerdere planning en manualdashboardoverride apart. Savingsplan blijft month-only. Future planning maakt geen actuals.

Manual create/edit gebruiken één centrale validatie en behoud van ID/unknown fields/provenance. Getest: alle fysieke contexten, joint salarisbronnen, credit/debit, savings/refund/fixed conditionele velden, edit datum/bedrag/categorie/omschrijving/notitie, kalender/schrikkeljaar, vandaag/morgen, .01/zero/negative/subcent, source/fixed/dependencyfouten. Orphan fixed link en bedragen buiten veilige gehele-centrepresentatie zijn gereproduceerd en vóór mutatie geblokkeerd.

Gesloten oorspronkelijke én nieuwe bankmaand blokkeren datumedit; snapshots blijven gelijk. Savings-goal-/refund-month-/coverage-/replacement-/advance-edits gebruiken de bestaande complete dependency-preflight. Geen delete/recreate, silent remap/clipping of nieuwe closure-/productsemantiek.

## E. CSV/cloud/concurrency audit

CSV C1–C20 PASS met bestaande P5 lifecycle/synctests, cloudprotocoltests en aanvullende P7-crosscases. Meerdere open batches, partial individuele approval, exacte identiteit versus possible duplicate, explicit manual replacement, future-/invalid-rowdiagnostiek en multi-month verwerking zijn behouden. Na permanent delete kan dezelfde CSV onder een **nieuw batch-ID** als nieuw inactief voorstel worden ingevoerd; oude tombstone blijft terminal en approval blijft expliciet.

Stresstests controleren detailsfailure vóór corepublicatie, interrupted journal/recovery, retry van dezelfde intent, generation/checksum/UTF8-grenzen, oudere uploadack versus nieuwere queue, echo, stale core/header, overlappende same-source edits versus onafhankelijke sources, cloudstand behouden/lokale keuze opnieuw toetsen en behoud van approved siblings. A→B approval→A, reload review/approved/withdrawn/restored, echte IndexedDB-huishoudenisolatie en stale rollback zijn opnieuw groen.

Authoritative sourceprocessing staat in versiegebonden batchdetails; compacte state bevat materialisatie plus receipt. Details/chunks gaan duurzaam vóór de corecommit. Core/headerpublicatie gebeurt in de bestaande Firestore-transactie met core syncVersion en batch baseVersion. Operationreceipt ack mag uitsluitend dezelfde operation/version verwijderen. Cloud is bij conflict actief; lokale keuze wordt afzonderlijk bewaard en opnieuw getoetst, zonder automatische approval. P7 heeft dit protocol niet inhoudelijk gewijzigd.

Dit bewijs komt uit lokale cloudmocks en geïsoleerde browsercontexts, niet uit productie-Firestore. De P5-race-reproducer (oudere upload wist nieuwere queue) blijft groen met de bestaande reparatie. Geen nieuwe importopslagarchitectuur of financieel replaymechanisme.

## F. Cross-feature edge cases

Alle CROSS X1–X15 zijn nieuwe gerichte P7-Nodechecks; elke combinatie controleert persistent state én financiële projectie.

| ID | Combinatie / gecontroleerd effect | Resultaat |
|---|---|---|
| X1 | CSV expense + withdrawal coverage + withdraw/restore: budget terug, unused stijgt, ledger/allocations niet dubbel | PASS |
| X2 | CSV historische refund + withdraw/restore: bankcashflow/correctie verdwijnen en komen exact eenmaal terug | PASS |
| X3 | Fixed actual105 + coverage40 + futureplan150: huidige plan100/actual105/deviation5/Betaald intact | PASS |
| X4 | Joint salary actual3100 + dashboardnul + futureplan3300: actual wint, planning ongewijzigd | PASS |
| X5 | Internal pair + withdrawn endpoint: onafhankelijke fysieke movement blijft, external niet dubbel | PASS |
| X6 | Manual replacement + CSV withdrawal: veilige manualfallback, één actief effect | PASS |
| X7 | Manual replacement + CSV delete: manual behouden, relation weg, geen dubbele actual | PASS |
| X8 | Expense300/coverage100/refund50 = budget150; conflicting edit blokkeert vóór mutatie | PASS |
| X9 | Partially unused withdrawal + refund in andere maand: aparte dimensies, geen normaal income | PASS |
| X10 | Verwijderde budgetcategorie blijft bruikbaar voor expliciete historische refund | PASS |
| X11 | Future planning + current actual: eerdere planning/current actual gelijk, toekomst geen fictieve actual | PASS |
| X12 | Gesloten originele/nieuwe bankmaand: edit geblokkeerd, snapshot gelijk | PASS |
| X13 | Zelfde source in fysieke accountlijst en financiële categoriedetail: geen dubbeltelling | PASS |
| X14 | Split fixed100 + ordinary50 + reopen: beide effects weg, plan/bankOriginal intact | PASS |
| X15 | Delete batchexpense met allocation naar onafhankelijke withdrawal: uitsluitend endpointrelation cleanup; correctie/planning/closure behouden | PASS |

## G. Storage/migration/closures

STORE S1–S12 PASS. Schema11-migratie blijft één clone/validate/back-up/persist-route. Geen v12, massamigratie, reconstructie van source IDs of onbekende datareparatie. Unknown fields, IDs, bankOriginal, imports, ledger, coverage en closures overleven JSON-roundtrip en pure selectors. Normale projection/timeline-read gebruikt geen Date.now/random of nieuwe ledger/history/source-identiteit.

Nieuwe IDs/timestamps bij expliciete command/import/sync-intent zijn operationmetadata, geen historische waarheid of render-normalisatie. Load-no-write/migratie-idempotentie en listenerstabiliteit zijn opnieuw getest. Bestaande complete ledger wordt niet opnieuw vanuit goal.algespaard opgebouwd. Original exporthash blijft gelijk; beide before/after captures zijn exact gelijk.

Closures blijven opgeslagen immutable snapshots. Live P4/P5-selectors kunnen volgens bestaand contract afwijken; P7 heeft geen snapshot opnieuw berekend/opgeslagen. Original en target bankmonth locks zijn getest; geen nieuwe closurepolicy voor historische refund-/fixedrealization-correcties bedacht. Legacyprovenance blijft leesbaar.

## H. UI/mobile/desktop/PWA

UI U1–U15 PASS: 390px en 1440px, shared manualcontract, categories, historical/future month, fixed/income/savingsplanning, source review, lifecycle, conflicts, dashboard/accountcards, fysieke lijsten en centrale Over-deze-maand/allowanceoutputs. Bestaande responsive suite omvat tevens 360/430/768/1024px. Visuele snapshots zijn gecontroleerd, niet geactualiseerd. Geen CSS- of kaart/layoutredesign.

Normale lijsten tonen actieve manual/approved CSV inclusief income/expense/savings/refund/internal; Onbekend/Nakijken/Niet meetellen/withdrawn/deleted blijven buiten gewone actieve lijsten. Account gebruikt fysieke rekening, budgetdetail financiële bestemming. Splits worden niet dubbel geteld; gross expense en budgetImpact blijven aparte outputs.

PWA W1–W8 PASS: echte Chrome-service-workerregistratie, critical assetcache bytegelijk aan runtime, cachemarker102, alleen Finizecaches opruimen, offline startup en reconnect/reload met persisted state, batchdetails, outboxreceipt en journal. HTTP503 of HTML met andere assetmarker kan de werkende offline shell niet meer vervangen. Installatie weigert mismatched root/index voordat een nieuwe worker activeert; candidatecache wordt verwijderd. Script/CSS-verzoeken krijgen nooit HTMLfallback. Interrupted journal/retry is daarnaast met P5 fault-injection gedekt. Geen nieuwe PWA-feature.

## I. Security audit

SEC Q1–Q10 PASS binnen het expliciet genoemde verificatieniveau. Browsertests injecteren markup/eventhandlers in description/note/category, CSV bank/source/filename/reason, planning-ID, configtekst en status. Text en attributes worden contextueel escaped; oorspronkelijke opgeslagen waarden blijven intact. Private legacyreview/transferrenderers worden met echte bronfuncties in een beperkte harness aangeroepen omdat de oude admincontrols niet in de huidige normale dashboardmarkup zitten. De failing-before-test toont daar drie geïnjecteerde images; after0.

De Data & back-up-instructie bevatte obsolete openbare voorbeeldregels. Die tekst verwijst nu naar de actuele beveiligde `firestore.rules` en apart geautoriseerde publicatie. De daadwerkelijke rules zijn in P7 **niet gewijzigd**.

Statische rules/clientcontracten controleren geverifieerde accountkoppeling, household authorization, own-member invariants, default-deny, core syncVersion, batch CAS/baseVersion/echo, immutable chunks, terminal tombstone en gesloten oud openbaar pad. **Emulatorverificatie: niet uitgevoerd** (geen geïnstalleerde/geconfigureerde lokale emulator). **Productieverificatie: niet uitgevoerd**. Cloudmocks vervangen geen daadwerkelijke serverrule-evaluatie.

Release-source/bundle-scan: geen private keys/service-accountcredentials, tokenpatronen, lokale absolute ontwikkelpaden, debugger/console.log-spam of fixture/baselinedump-imports in runtime. Bestaande openbare Firebase-browserconfig blijft behouden; dat is geen service-accountcredential. Lokale automation/auth-preview is hostnamegebonden en geen productie-authbypass. Bestaande adminscripts zijn statisch gelezen/syntaxgecontroleerd, niet uitgevoerd.

## J. Bugfixes + gewijzigde/verwijderde bestanden

Alle reparaties vallen onder reeds besloten P1–P6-contracten. Voor elke A is een reproduceerbaar falend vóór-bewijs behouden en een groen na-bewijs aanwezig; de bewuste vóór-failures tellen niet als failures van de eindrun.

| A | Severity | Fout en bestaande vereiste | Reparatie / bewijs |
|---|---|---|---|
| A1 | high | Orphan fixed occurrence zonder fixedExpenseId kon normale variable burden omzeilen; P3/P6 vereisen geldige links | Centrale fixed-choiceguard. Vóór M12/C18 fail; na Node/browser groen |
| A2 | medium | Onveilig grote centinteger kwam door validation; P3/P4 vereisen exact cents | Safe-integercentguard in engine/manual. Vóór M13/I20 fail; na groen |
| A3 | high | Dynamic HTML/attributes konden opgeslagen config/status/planning/review/transferdata uitvoeren | textSafe/attrSafe; drie vóór-browserartifacts, Q1–Q8 na groen |
| A4 | high | Data-instructie adviseerde onbeveiligde oude Firestore-regels; strijd met P5 householdcontract | Beveiligde actuele bestandsreferentie; Q9 vóór fail/na groen; rules zelf gelijk |
| A5 | medium | Publieke manualsave ging eerst commit/rollback in; invalid command gaf false zonder concrete guard en kon readcaches terugrollen | Clonepreflight vóór commit. Ongeldige toekomstdate vóór geen error, na error én state exact gelijk |
| A6 | high | Fout/andere versie HTML kon werkende offline index overschrijven; gemengde install kon oude worker vervangen | Success/versioncheck bij navigation én install. Vóór W3/W5/install fail; na worker- en browsertests groen |

B: noodzakelijke cachemarkerupdate/generated bundle en documentatie/testregister. Geen financiële betekeniswijziging. D wordt hieronder expliciet behouden; geen nieuwe productregel gekozen.

| P7-bestand | Sectie / wijziging / reden |
|---|---|
| src/core/transaction-engine.mjs | validateTransactionProcessing: orphan fixed-choice en veilige exacte centrepresentatie |
| src/core/transaction-processing.mjs | validateManualTransactionInput: dezelfde centguard voor create/edit |
| src/core/runtime.js | Planning/legacyreview/transfer/config/status-escaping, veilige rules-instructie, FinizeManual.save clonepreflight |
| service-worker.js | Critical-shell installversiecontrole + veilige navigationcache; marker102 |
| index.html | JS/CSS assetmarker102, geen layoutwijziging |
| app.js | Reproduceerbaar gegenereerd uit bovenstaande sources |
| tests/package7-release-audit.test.cjs (nieuw) | 29 gerichte bug-/timeline/manual/cross/lifecycle/readpurity/PWA-cases |
| tests/browser/package7-release-audit.spec.cjs (nieuw) | 14 cases: 6 per viewport + 2 echte PWA-checks |
| tests/html-inline-syntax.test.cjs | Exacte assetmarkerassertions102 |
| tests/service-worker-cache.test.cjs | Exacte cachemarkerassertion102 |
| tests/update4-final-regression.test.cjs | Exacte marker102; overige voorwaarden intact |
| tests/update5-responsive-structure.test.cjs | Exacte marker102; responsive assertions intact |
| README.md / docs/v50-architecture.md | P7-verslaglink en actueel PWA-veiligheidscontract |
| docs/package-7-release-audit.md (nieuw) | Dit verslag |
| docs/audit/package-7-audit-register.json (nieuw) | 138 afzonderlijke auditchecks met bewijsbron/niveau |
| docs/audit/package-7-verification.json (nieuw) | Tests, hashes, baseline, A/D en exact cumulative latercommitlist |

**Verwijderde bestanden/routes: geen.** Stylesheets, app.css, daadwerkelijke rules, package/lock/build/testconfig, P1–P6-verslagen en snapshots zijn bytegelijk aan de freeze. Cumulatieve HEAD-diff bevat wél oudere P1–P6-rule/snapshot/sourcewijzigingen; die zijn geen nieuwe P7-edits. CRLF-statusverschillen zonder contentdiff zijn niet als inhoudelijke releasewijziging gerekend.

## K. Tests + baseline A/B/C/D

| Verificatie | Eindresultaat |
|---|---|
| Alle Node-bestanden incl. P1–P7 en legacy scripts | PASS 45/45; 402/402 geregistreerde node:test-cases, legacy assertions daarnaast |
| Gerichte P7 Node | PASS 29/29 |
| Volledige browser | PASS 150/150; retries0, skips0, fails0, flaky0 |
| Gerichte P7 browser | PASS 14/14; 390/1440px en echte worker/offline |
| P5 cloud/device/journal/retry/lifecycle | PASS, opnieuw volledig meegenomen; mocks + echte lokale IDB |
| Auditregister | 138 checks I20/P15/M15/C20/X15/S12/U15/Q10/W8/D8; geen 138 kunstmatig nieuwe testcases |
| Syntax | PASS actieve bundle/SW/index én 47 source/toolingfiles |
| CSS | PASS 971 hoofdnodes, 0 ongedefinieerde tokens; SHA bytegelijk |
| Build / build --check | PASS pinned esbuild0.25.9/postcss8.5.6; independent rebuild app.js/app.css hashgelijk |
| Migration/load-no-write/JSON | PASS P1/P2/P5/P7 en listener/bootstrapregressies |
| Responsive/visueel | PASS bestaande suites; geen snapshotupdates |
| Security/rules | PASS dynamic HTML + static rules/client contracts; emulator/live niet uitgevoerd |
| Baseline persistent/financial | Beide complete captures recursief exact gelijk |
| Historische importdetails | 6 batches/176 rows exact gelijk; immutable input onaangetast |

Dependencyversies zijn de vastgelegde repositoryversies (@playwright/test1.55.0, esbuild0.25.9, postcss8.5.6). Browser draait met beschikbare lokale Chrome; niet gepresenteerd als Safari/iOS-deviceverificatie. Geïsoleerde mirrortests gebruiken actuele bronnen, fixtures en bevroren snapshots; productieconnecties zijn geblokkeerd/gemockt.

Baseline hieronder is vóór/na **gelijk**. Forecast available is geen actual-income-selector; persoonlijke buffers zijn engine available, geen geïmporteerd banksaldo.

| Fixture | Maand | Dion zakgeld | Dara zakgeld | Huishoud beschikbaar | Actual income | Real expense | Gezamenlijke buffer | Dion buffer | Dara buffer |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| visual-fixture | 2026-07 | 1.166,58 | 1.433,23 | 1.788,97 | 0,00 | 0,00 | 500,00 | 1.192,16 | 96,81 |
| historical-backup | 2026-06 | 1.189,92 | 1.300,36 | 930,49 | 0,00 | 584,71 | 754,00 | 170,97 | 5,52 |
| historical-backup | 2026-07 | 1.086,27 | 2.660,60 | 1.841,94 | 5.335,85 | 4.164,83 | 9,92 | 466,26 | 1.365,76 |
| historical-backup | 2026-08 | 876,42 | 1.233,86 | 930,29 | 0,00 | 452,71 | 854,00 | 137,27 | -60,98 |

Planningreserves fixed/budget/savings: visual juli 2.360,19/500/0; historical juni2.979,72/600/154, juli2.679,72/650/154, augustus2.679,72/700/154. Complete vergelijking omvat bankOriginal/source/approval/import/lifecycle/deletionproof/journal waar aanwezig, replacements/pairs, histories/goal/ledger/allocation/refund/advance/closure, alle transactioneffects/cashflows/income/category/fixedactuals/deviation/status, forecast.household, allowanceBasis en alle buffers. Nieuwe P7 faultfixtures dekken relaties die niet in oude export aanwezig zijn.

Classificatie:

- **A:** zes bewezen contractbuggroepen. Alleen nieuwe ongeldige processingcommands/XSS/offlinefaultcases veranderen bewust. Geen financiële wijziging in onaangeraakte P6-datasets.
- **B:** cachemarker/bundle/documentatie/testrepresentatie; geen financial effect.
- **C: 0.** Geen regressie of baselineverschil.
- **D:** acht hieronder beschreven behouden risicogroepen; geen heuristische correctie.

Reproductie: `node scripts/run-node-tests.mjs`, `node scripts/check-syntax.mjs`, `node scripts/check-css.mjs`, `node scripts/build.mjs`, `node scripts/build.mjs --check`, `playwright test`. De uitgevoerde browserconfig gebruikt lokale Chrome en geïsoleerde mirror. Quality-script bouwt afzonderlijk uit sources en vergelijkt SHA-256. Geen assertions/toleranties versoepeld, geen snapshots automatisch geaccepteerd, geen skips toegevoegd.

Vóór/na-bugbewijs: `p7-failing-before-fixes.log`, `p7-security-before.json`, `p7-attributes-before.json`, `p7-legacy-attributes-before.json`, `p7-preflight-before.json`, `p7-pwa-before.log`, `p7-pwa-install-before.log`; eindbewijs: `p7-node-final.log`, `p7-browser-final.json`, `p7-quality-results.json`. Reproduceren van het vóór-bewijs gebruikt kopieën van de freeze, nooit een reset van de cumulatieve werkboom.

## L. RELEASE READINESS

**STATUS: READY**

De lokale release candidate voldoet aan de gecontroleerde P1–P6-contracten: volledige eindrun groen, C=0, geen open kritieke/high bug of productvraag, schema11, centrale engine/timeline, beschermd bankOriginal/ledger, reproducible build, storage/load/cloudmock/security/PWA/parity groen. Dit is geen claim dat de niet-uitgevoerde productierelease of serverrule-evaluatie al is goedgekeurd/getest.

### Bekende D-risico’s, bewust behouden

| D | Exacte afhankelijke code / risico | Guard / minimale toekomstige actie |
|---|---|---|
| D1 | transaction-model/processing + core importadapters: legacy source/account ambigu; export bevat44 onbetrouwbare fysieke contexten | Leesbaar, unsafe edits geblokkeerd; alleen expliciet uniek provenancebewijs, niet gokken |
| D2 | engine legacy-savings-goal-missing / legacy-refund-context-missing | Expliciete herverwerking indien nodig; geen goal/refundMonth invullen bij load |
| D3 | core monthRecords/closure locks: snapshots kunnen van actuele live semantics afwijken | Bestaande reopen/correctie; geen rebuild of nieuwe closuresemantiek |
| D4 | processing advanceguards / lifecycle preflight: onafhankelijke repayments/replacements | Conflict blokkeert vóór mutatie; afhankelijke administratie apart veilig corrigeren |
| D5 | import cleanupDeletedCloudChunks/outbox/retry: offline chunkcleanup nog online te voltooien | Terminale tombstone verhindert stale resurrection; technische proof, geen financieel deleteaudit |
| D6 | rules/CloudAdapter/ImportStore: emulator/live-server niet getoetst; quota/netwerk omgeving | Faultguards/journal behouden; afzonderlijk geautoriseerde release met echte client/rules smoke |
| D7 | renderRowsTable / legacyqueue / private renderers/exported helpers | Callerregister en compatibility behouden; geen agressieve cleanup |
| D8 | Bestaande visuele/legacy signed planning quirks | Bevroren uitvoer behouden; geen ongevraagde financial cap/herclassificatie/redesign |

### Exacte bestanden voor een latere commit

Onderstaande lijst is **de volledige cumulatieve contentdiff plus nieuwe relevante bestanden**, niet alleen P7. De aanvullende CSV/JSON-releasebestandsmanifesten bevatten per bestand status, klasse, bytes en SHA-256. `app.css` is reeds tracked en inhoudelijk ongewijzigd; package/lock/config eveneens. Backups, .firebaserc, node_modules, tijdelijke work/artifacts en persoonlijke bankcaptures vallen buiten de commitlist.

```text
README.md
app.js
docs/audit/package-7-audit-register.json
docs/audit/package-7-verification.json
docs/package-1-data-foundation.md
docs/package-2-planning-timeline.md
docs/package-3-transaction-engine.md
docs/package-4-savings-refunds-forecast.md
docs/package-5-import-lifecycle.md
docs/package-6-functional-consolidation.md
docs/package-7-release-audit.md
docs/v50-architecture.md
firestore.rules
index.html
service-worker.js
src/core/data-normalization.mjs
src/core/planning-timeline.mjs
src/core/recurring-occurrences.mjs
src/core/runtime.js
src/core/transaction-engine.mjs
src/core/transaction-model.mjs
src/core/transaction-processing.mjs
src/import/import-identity.mjs
src/import/import-lifecycle.mjs
src/import/import-sync-protocol.mjs
src/import/runtime.js
src/import/update4-runtime.cjs
tests/browser/desktop-special-tabs.spec.cjs
tests/browser/dynamic-html-security.spec.cjs
tests/browser/import-listener-stability.spec.cjs
tests/browser/import-review-simplification.spec.cjs
tests/browser/modal-and-commit-stability.spec.cjs
tests/browser/package1-data-foundation.spec.cjs
tests/browser/package2-planning-timeline.spec.cjs
tests/browser/package3-transaction-engine.spec.cjs
tests/browser/package4-allowance-planning-correction.spec.cjs
tests/browser/package4-savings-refunds-forecast.spec.cjs
tests/browser/package5-import-lifecycle.spec.cjs
tests/browser/package6-functional-consolidation.spec.cjs
tests/browser/package7-release-audit.spec.cjs
tests/browser/update6-account-navigation.spec.cjs
tests/browser/v50-visual-baseline.spec.cjs
tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-360.png
tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-390.png
tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-430.png
tests/helpers/migration-runtime.cjs
tests/helpers/package5-fixture.cjs
tests/html-inline-syntax.test.cjs
tests/package1-data-foundation.test.cjs
tests/package2-planning-timeline.test.cjs
tests/package3-processing-integration.test.cjs
tests/package3-transaction-engine.test.cjs
tests/package4-allowance-planning-correction.test.cjs
tests/package4-processing-integration.test.cjs
tests/package4-savings-refunds-forecast.test.cjs
tests/package5-lifecycle.test.cjs
tests/package5-sync.test.cjs
tests/package6-functional-consolidation.test.cjs
tests/package7-release-audit.test.cjs
tests/service-worker-cache.test.cjs
tests/update3-administration.test.cjs
tests/update3-core.test.cjs
tests/update3-migration.test.cjs
tests/update4-1-expense-impact.test.cjs
tests/update4-2-savings-ledger.test.cjs
tests/update4-4-zero-income.test.cjs
tests/update4-cloud-import.test.cjs
tests/update4-final-regression.test.cjs
tests/update4-import-engine.test.cjs
tests/update4-ledgers.test.cjs
tests/update4-migration-storage.test.cjs
tests/update4-stabilization-regression.test.cjs
tests/update4-ui-structure.test.cjs
tests/update4-undo.test.cjs
tests/update5-allowance-budget-regression.test.cjs
tests/update5-budget-history-saving-overrides.test.cjs
tests/update5-responsive-structure.test.cjs
```

### Eventuele releasevolgorde, uitsluitend na aparte toestemming

1. Laat finale cumulatieve diff en exacte bestandslijst controleren; voeg uitsluitend die bestanden toe en commit pas na expliciete toestemming.
2. Push pas na toestemming; controleer de CI/build en behoud de bevroren rollbackroute.
3. Controleer de P5-client/rulescompatibiliteit in een geïsoleerde emulator/staging als releasecheck. Regelsdeployment is een apart geautoriseerde stap; bestaande productieclient en householdautorisatie moeten compatibel blijven. Geen automatisch gekoppelde deploy.
4. Publiceer de complete Pages-assets atomair als één geautoriseerde release; marker102 in index/SW/assets gelijk. Geen handmatige enkelvoudige oude/new-filemix.
5. Voer de afzonderlijk geautoriseerde live smoke uit; maak geen echte financiële wijzigingen of CSV-imports zonder daarvoor specifieke toestemming.

Noodzakelijke post-deploy smokes: login/household isolation; schema/migratieback-up/load-no-write; beide jointsalarybronnen en persoonlijke receipts; historische/current/future planning; fysieke accountlijsten versus categoriedetails; actual/forecast/zakgeldreserve; bestaande importhistorie/source statuses; worker marker102/assetversie/reload/offlineupdate; console/page-errors en geen write-loop. Lifecycle/cloudconflict/device approval blijft primair in staging/sandbox te oefenen. Controleer eventuele online terminal-chunkcleanup en geen stale resurrection. Rules blijven echte serververificatie nodig hebben; het lokale auditbewijs vervangt dat niet.

**Productie-Firestore geraakt: nee. Commit: nee. Push: nee. Deploy/rules deployment: nee.** Geen Pakket8/new feature. P7 stopt bij dit oordeel; release wacht op afzonderlijke expliciete toestemming.

### Bijlage: afzonderlijke auditchecks

Dit register is een dekkingsmatrix van bestaande/nieuwe tests en statische audits. Het aantal checks is niet het aantal nieuwe testcases. Q10 is statische rulesverificatie; D1–D8 zijn caller-/compatibilityaudits. Het JSON-register bevat per check alle bewijsbestanden.

#### INV

| ID | Resultaat | Controle |
|---|---|---|
| I1 | PASS | Fysieke rekening en financiële bestemming gescheiden |
| I2 | PASS | Beide salarisbronnen fysiek Gezamenlijk; persoonlijke receipts apart |
| I3 | PASS | Onbekend/Nakijken/Niet meetellen/withdrawn/deleted financieel nul |
| I4 | PASS | Manual direct approved, geen manual splits |
| I5 | PASS | Recognition certainty is geen approval |
| I6 | PASS | Bankmaand versus fixed occurrence/refund correctiemaand |
| I7 | PASS | Actual income zonder fictieve planned transactions |
| I8 | PASS | Actual salary boven manual override boven historische planning |
| I9 | PASS | Expliciete nul en onverdeelde administrative total blijven veilig |
| I10 | PASS | Fixed plan/actual/deviation en meerdere actuals; Betaald bij één actual |
| I11 | PASS | Real expense blijft bruto |
| I12 | PASS | Refund geen inkomen, categoriebelasting niet negatief |
| I13 | PASS | Savings beweging precies één goal bij nieuwe verwerking |
| I14 | PASS | Goal correction ledger-only, geen cashflow |
| I15 | PASS | Many-to-many coverage, centen, actieve endpoints en maandgrenzen |
| I16 | PASS | Unused withdrawal beschikbaar, geen inkomen/extra zakgeld |
| I17 | PASS | Internal pair en expliciet unconfirmed intern: account/external apart |
| I18 | PASS | Budget 500 bij actual 0/300/400/700 reserveert 500 |
| I19 | PASS | Saving plan 250 bij actual 0/250/300 en fixed plan100 actual105 |
| I20 | PASS | Exacte veilige centrepresentatie; geen overflow approval |

#### PLAN

| ID | Resultaat | Controle |
|---|---|---|
| P1 | PASS | Budget januari500/maart600/juni550 |
| P2 | PASS | Budget beëindiging september |
| P3 | PASS | Budget herstart november700 |
| P4 | PASS | Fixed historische eigenschappen inclusief eigenaar/dag |
| P5 | PASS | Fixed stop end-exclusive en expliciete herstart |
| P6 | PASS | Salary from/once/stop/restart |
| P7 | PASS | Budget once override valt terug |
| P8 | PASS | Fixed once override valt terug |
| P9 | PASS | Salary once override valt terug |
| P10 | PASS | Overige income versioning |
| P11 | PASS | Savings uitsluitend geselecteerde maand |
| P12 | PASS | Budget timeline JSON/read purity |
| P13 | PASS | Fixed eerdere maand na latere wijziging intact |
| P14 | PASS | Dashboardoverride blijft apart van incomeplanning |
| P15 | PASS | Future planning zonder actualmaterialisatie |

#### MAN

| ID | Resultaat | Controle |
|---|---|---|
| M1 | PASS | Dion context create/edit |
| M2 | PASS | Dara context create/edit |
| M3 | PASS | Gezamenlijke context create/edit |
| M4 | PASS | Salaris Dion op Gezamenlijk |
| M5 | PASS | Salaris Dara op Gezamenlijk |
| M6 | PASS | Persoonlijk extra income |
| M7 | PASS | Savings/refund/fixed conditionele velden, geen splits |
| M8 | PASS | Amount/date/category/description edit behoudt ID |
| M9 | PASS | Unknown fields en fysieke context blijven behouden |
| M10 | PASS | Oorspronkelijke gesloten bankmaand blokkeert edit |
| M11 | PASS | Nieuwe gesloten bankmaand blokkeert edit |
| M12 | PASS | Orphan fixed occurrence blokkeert vóór mutatie |
| M13 | PASS | Unsafe cent amount en publieke adapter preflight |
| M14 | PASS | Leap date/today/tomorrow kalendergrenzen |
| M15 | PASS | Zero/negative/subcent ongeldig; .01 en geldig schrikkeljaar geldig |

#### CSV

| ID | Resultaat | Controle |
|---|---|---|
| C1 | PASS | Meerdere open batches |
| C2 | PASS | Partial individuele approval direct actief |
| C3 | PASS | Exact identityproof duplicate versus possible duplicate |
| C4 | PASS | Manual possible match uitsluitend voorstel |
| C5 | PASS | Expliciete replacement blijft Nakijken |
| C6 | PASS | Future/invalid rows diagnostiek; siblings doorgaan |
| C7 | PASS | Multi-month eigen bankdata |
| C8 | PASS | Repeated withdraw/restore idempotent |
| C9 | PASS | Restoreconflict blokkeert vóór mutatie |
| C10 | PASS | Permanent delete eigen payload; technische tombstone |
| C11 | PASS | Stale resurrection na delete geweigerd |
| C12 | PASS | Nieuwe batchidentity na oude delete mogelijk |
| C13 | PASS | Detailsfailure geen corepublicatie |
| C14 | PASS | Interrupted journal recovery exactly once |
| C15 | PASS | Retry behoudt intent/operationreceipt |
| C16 | PASS | Listener echo en oude ack wissen nieuwe queue niet |
| C17 | PASS | Stale/same-source conflict expliciet, verschillende sources behouden |
| C18 | PASS | Orphan fixed source/split processing blokkeren |
| C19 | PASS | Cloudkeuze en lokale keuze opnieuw toetsen, unchanged siblings actief |
| C20 | PASS | Reload/viewport/reconnect/huishoudenisolatie |

#### CROSS

| ID | Resultaat | Controle |
|---|---|---|
| X1 | PASS | CSV expense + coverage + withdraw/restore |
| X2 | PASS | CSV refund + historical category + withdraw/restore |
| X3 | PASS | Fixed actual + coverage + future planning |
| X4 | PASS | Salary actual + zero dashboardoverride + future planning |
| X5 | PASS | Internal pair met withdrawn endpoint |
| X6 | PASS | Manual replacement met CSV withdrawal |
| X7 | PASS | Manual replacement met permanent CSV delete |
| X8 | PASS | Expense + coverage + refund, overflow blokkeert |
| X9 | PASS | Unused withdrawal + onafhankelijke historische refund |
| X10 | PASS | Verwijderde historische categorie + refund |
| X11 | PASS | Future planning + current actual |
| X12 | PASS | Closed original/target bankmonth edit |
| X13 | PASS | Fysieke accountlist + financiële categoriedetail zonder dubbeltelling |
| X14 | PASS | Split fixed link + source reopen |
| X15 | PASS | Batch delete relation naar onafhankelijke withdrawal/correction |

#### STORE

| ID | Resultaat | Controle |
|---|---|---|
| S1 | PASS | JSON roundtrip financiële betekenis |
| S2 | PASS | Unknown fields behouden |
| S3 | PASS | bankOriginal/source identity onveranderd |
| S4 | PASS | Stabiele ledger/coverage IDs en readpurity |
| S5 | PASS | Schema v11 en deterministische migratieroute |
| S6 | PASS | Migrate tweemaal idempotent, geen defaultsreset bij fout |
| S7 | PASS | Geen clock/random in pure projection/timeline |
| S8 | PASS | Closures/snapshots niet herschreven |
| S9 | PASS | Import versions/receipts/deletion proof behouden |
| S10 | PASS | Load/reload zonder migratie/cloudwrite-loop |
| S11 | PASS | Householdscoped IDB/core isolation |
| S12 | PASS | Import chunk assembly exact, generation/checksum/UTF8 guards |

#### UI

| ID | Resultaat | Controle |
|---|---|---|
| U1 | PASS | Manual create 390px/1440px |
| U2 | PASS | Manual edit 390px/1440px |
| U3 | PASS | Categories historische budgetbron |
| U4 | PASS | Historical maandselector |
| U5 | PASS | Future planning |
| U6 | PASS | Income planning/salarisbronnen |
| U7 | PASS | Fixed planning/actualweergave |
| U8 | PASS | Savings month planning |
| U9 | PASS | CSV review approval |
| U10 | PASS | Batch withdraw/restore/delete |
| U11 | PASS | Conflict UI |
| U12 | PASS | Dashboard centrale forecast/allowance |
| U13 | PASS | Accounttabs fysieke transactielijsten |
| U14 | PASS | Persoonlijke inkomenskaart zakgeld + fysieke receipts |
| U15 | PASS | Over deze maand/zakgeld apart, visuele baseline ongewijzigd |

#### SEC

| ID | Resultaat | Controle |
|---|---|---|
| Q1 | PASS | Firebaseconfig textarea escaped, oorspronkelijke tekst intact |
| Q2 | PASS | Cloudstatus HTML escaped |
| Q3 | PASS | Manual description/note inert |
| Q4 | PASS | CSV bankdescription/sourcevelden inert |
| Q5 | PASS | Filename/source errors inert |
| Q6 | PASS | Category/income labels inert |
| Q7 | PASS | Opgeslagen IDs/attributes escaped |
| Q8 | PASS | Legacy review/transfer metadata escaped (private renderer harness) |
| Q9 | PASS | Data-instructie verwijst naar beveiligde actuele regels |
| Q10 | PASS | Verified household/CAS/chunk/tombstone/default-deny statisch contract |

#### PWA

| ID | Resultaat | Controle |
|---|---|---|
| W1 | PASS | Critical shell install en daadwerkelijke workerregistratie |
| W2 | PASS | HTML/assetmarkergelijk; mismatch install weigert |
| W3 | PASS | Partiële release behoudt oude offline shell |
| W4 | PASS | Offline startup met persisted data |
| W5 | PASS | 503/foutpagina overschrijft cached shell niet |
| W6 | PASS | Reconnect behoudt journal/outbox/details |
| W7 | PASS | Oude Finizecaches weg, andere cache blijft |
| W8 | PASS | Geen script/CSS HTMLfallback; retry/journal reeds P5 gedekt |

#### DEAD

| ID | Resultaat | Controle |
|---|---|---|
| D1 | PASS | renderRowsTable definition-only, behouden zonder noodzakelijke cleanup |
| D2 | PASS | getMonthlyScenarioData ACTIVE flat timeline wrapper |
| D3 | PASS | calcScenario ACTIVE engine/allowance presentatieadapter |
| D4 | PASS | transactionReviewQueue COMPATIBILITY, opgeslagen data behouden |
| D5 | PASS | u3OpenReview/u3OpenTransfers compatibility renderer + retained binder |
| D6 | PASS | openGeneralTransactionModal/openTransactionModal ACTIVE canonical adapters |
| D7 | PASS | Exported compatibilityhelpers ACTIVE/TEST-ONLY contract behouden |
| D8 | PASS | Geen agressieve deletions; geen actieve Voor/Na financiële branching |
