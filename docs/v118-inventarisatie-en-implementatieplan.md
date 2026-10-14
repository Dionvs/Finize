# Finize V118 — inventarisatie en implementatieplan

Datum: 12 oktober 2026. Status: **onderzoek afgerond; implementatievoorstel ter beoordeling**.

## 1. Samenvatting

V118 kan voortbouwen op een omvangrijke bestaande financiële motor. Rekeningprofielen, bronidentiteiten, expliciete CSV-goedkeuring, historische planning, maandprognoses, spaardoelen, refunds, bronherstel en duurzame lokale opslag bestaan al. **Rekeningbeheer hoeft niet opnieuw te worden gebouwd.**

De grootste ontbrekende laag is een **dagelijkse liquiditeitsprognose per fysieke bankrekening vanaf een gedateerd saldo-ijkpunt**. De bestaande maanduitkomst `available` is maandruimte volgens de verdelingsregels, geen gecontroleerd banksaldo. Bestaande openingssaldi en maandafsluitingen zijn bruikbaar als achtergrond, maar leveren nog geen algemene ijkpuntentijdlijn per rekeningprofiel.

P4 bestaat grotendeels: de app leert herkenningsregels uit handmatige goedkeuringen en doet al categorie-, vaste-last-, salaris- en spaardoelvoorstellen. V118 moet deze route gericht aanvullen en begrijpelijker maken. P5 vraagt een provideronafhankelijk invoercontract; de huidige verwerking is daarvoor een goed fundament, maar identificeert bankgegevens nog expliciet als CSV. Een bankadapter kan dus niet veilig alleen een ander `source`-label toevoegen.

Aanbevolen volgorde: **klein contractdeel P5 → P1 → P2 → P3 → gerichte aanvullingen P4 → contractcontrole P5 → één eindregressie**. P4 mag na vastlegging van de gedeelde identiteiten ook eerder worden opgepakt. De daadwerkelijke bankkoppeling en de uitgestelde productie-recordmigratie zijn geen V118-voorwaarde.

### 1.1 Onderzochte werkstand

| Onderdeel | Vastgesteld |
|---|---|
| Repository | `G:\Mijn Drive\Codex\financien\outputs\dion_dara_budget\webapp\github\Finize-live-repo` |
| Actieve branch | `agent/v117-stabilisatie` |
| HEAD | `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5` — Herstel budgetdetails en koppel interne inleg aan spaardoelen |
| Lokale wijzigingen bij aanvang | Geen; `git status --short --branch` was schoon |
| GitHub-main | `git ls-remote origin refs/heads/main` gaf dezelfde volledige commit terug |
| Lokale branch `main` | Nog op `a56e865`, zeven commits achter; deze branch is niet de onderzochte werkstand |
| Actieve assetversie | `117-p4r5` volgens de huidige releasewijziging |
| Financieel schema | 11; lokale huishoud-IndexedDB versie 4 |
| Nieuwe cloud-recordopslag | Gebouwd en getest in emulator; adapter is uitsluitend lokaal en opt-in. Niet geactiveerd voor productie |

De huidige HEAD staat aantoonbaar op remote main. Daarmee is nog niet bewezen dat de openbare site op dit moment exact deze assets serveert. Deze inventarisatie heeft geen nieuwe live publicatiecontrole uitgevoerd. Het aanwezige machineleesbare publicatiebewijs betreft de eerdere commit `745c814`, build `117-p4r4c`; het mag niet worden opgevoerd als assetbewijs van `fbf8b34`.

Onderzocht: bronstructuur en actieve imports, relevante berekenings-/verwerkings-/opslag-/UI-paden, alle test- en documentnamen, gerichte testasserties, relevante architectuur- en opleverdocumenten, lokale branches en Git-historie. Wrapperbestanden zoals `core/calculations.js`, `ui/render.js` en `storage/local-state.js` verwijzen veelal naar `core/runtime.js`; alleen de wrappers lezen zou de werkelijke implementatie missen. Historische HTML-experimenten naast de repository zijn niet als actieve app behandeld.

Er zijn geen volledige Node-, Playwright- of Firestore-reeksen gestart, geen schaalfixtures gemaakt en geen benchmarks uitgevoerd. Er bleef geen concrete codevraag over waarvoor een extra uitvoeringstest noodzakelijk was. Testbewijs hieronder bestaat uit **aanwezige testcontracten en opgeslagen uitslagen**, niet uit een nieuwe groene V118-run. Alleen dit rapport wordt toegevoegd. Applicatiecode, financiële gegevens, configuratie en bestaande tests blijven onaangeroerd.

### 1.2 Recente geschiedenis en bewijsniveau

| Commit/document | Betekenis voor V118 |
|---|---|
| `54e8d94` | Duurzame goedkeuring en afzonderlijke geselecteerde bankbronnen |
| `33154fe` | Atomaire lokale IndexedDB-opslag per huishouden |
| `3227586` → `1db602a` | Cloud-recordfundament, daarna integratie van geverifieerde perioden; eerste verslag is door aanvulling ingehaald |
| `745c814` → `1936319` | V117-client gepubliceerd met bestaande cloudsynchronisatie; publicatie- en herstartbewijs vastgelegd |
| `fbf8b34` | Budgetdetails gecorrigeerd; expliciete koppeling van ontvangen intern geld aan spaarinleg |
| [Laatste V117-verslag](audit/v117-p4r5-budget-en-spaarinleg.md) | Meldt 631 Node-gevallen in 61 bestanden, 53 unieke browsergevallen en afzonderlijk de nieuwe route op 390/1440 px. Dit is opgeslagen verslagbewijs; onderliggende privélogs zijn niet opnieuw doorgerekend |
| [Publicatiebewijs](audit/v117-publicatiebewijs.json) | Bewijst eerdere build p4r4c; vermeldt expliciet `productionRecordStorageActivated:false` |

De gebruiker beschouwt V117 functioneel als afgerond. Oude auditblokkades zijn daarom geen reden om de V117-stabilisatiewerkzaamheden opnieuw te starten. Wel blijven de bewust uitgestelde cloud-cutover, conflictinterface en grote-fixturegevallen afzonderlijke onderwerpen; ze worden niet stilzwijgend in V118 opgenomen.

## 2. Classificatie en bronregister

**A — Bestaat en werkt:** relevante implementatie én bestaand testbewijs aangetroffen. Dit is geen claim dat de tests nu opnieuw zijn uitgevoerd. **B — Bestaat gedeeltelijk:** bruikbaar fundament, maar de genoemde V118-uitkomst ontbreekt. **C — Ontbreekt:** geen implementatie van die uitkomst aangetroffen. **D — Onduidelijk:** productkeuze of aanvullende onderbouwing noodzakelijk.

De broncodes S1–S12 en testcodes T1–T10 in de matrix verwijzen naar onderstaande bestanden. Regels verwijzen naar de onderzochte HEAD; functienamen zijn de duurzame zoekankers.

### Technische bronnen

| Code | Bestanden, functies en contracten |
|---|---|
| S1 | [transaction-model.mjs](../src/core/transaction-model.mjs), regels 1–91: `ACCOUNT_CONTEXTS`, rekeningresolutie, `getTransactionSource`, `getTransactionProcessingStatus`, `approveTransactionProcessing`, `isTransactionFinanciallyActive`. Fysieke context en financiële bestemming zijn verschillende dimensies |
| S2 | [bank-sources.mjs](../src/core/bank-sources.mjs), regels 3–86: `sourceRecordKey`, `ensureImportBankSources`, `selectBankTransactions`, `updateSourceApproval`. `bankSourceId`, `accountProfileId`, `bankOriginal`, `importReferences`, bron/effectscheiding |
| S3 | [runtime.js](../src/core/runtime.js), regels 6108–6135, 6252–6285, 6586–6620: `u3OpeningBalance`, `u3AccountControl`, `u3CloseMonth`, openingssaldo-editor. `accountSettings`, `monthCorrections`, `monthRecords.closureHistory.accountControl`, `internalTransfers` |
| S4 | [planning-timeline.mjs](../src/core/planning-timeline.mjs), [recurring-occurrences.mjs](../src/core/recurring-occurrences.mjs); runtime 6036–6061 en planningeditor vanaf 6440. Historische maandresolvers, `amountHistory`, `monthOverrides`, `validFrom/validUntil`, `begindatum`, frequentie, `afschrijfdatum`, occurrence-ID |
| S5 | [transaction-engine.mjs](../src/core/transaction-engine.mjs), vooral `selectTransactionProjections`, `fixedOccurrenceActuals`, `financialForecastForMonth` vanaf regel 367; runtime `monthlyFinancialForecast` 715 en `calcScenario` 1524 e.v. `allowanceBasis`, `available`, `accountCashflow`, `actualIncome`, `fixedRegularImpact` |
| S6 | [transaction-processing.mjs](../src/core/transaction-processing.mjs), [data-normalization.mjs](../src/core/data-normalization.mjs), [savings-contributions.mjs](../src/core/savings-contributions.mjs). `savingsGoalLedger`, `savingsCoverageAllocations`, `refundMonth/refundCategory`, `savingsContributionId`, correctie-/heropencommands |
| S7 | [import/runtime.js](../src/import/runtime.js): `recognitionProposal` 472, `classifyOriginal` 532, parser 577, `learnedRecognitionRules` 1290, herkenningsregels-editor 2153. [salary-assignment.mjs](../src/core/salary-assignment.mjs): `salaryLink`, `proposeSalaryPerson`; [budget-assignment.mjs](../src/core/budget-assignment.mjs) |
| S8 | [import-identity.mjs](../src/import/import-identity.mjs), [import-lifecycle.mjs](../src/import/import-lifecycle.mjs), [approval-group.mjs](../src/import/approval-group.mjs), [import-sync-protocol.mjs](../src/import/import-sync-protocol.mjs). `file-row`/`bank-id`-bewijs, duplicaatbeslissing, operatie-ID, journal, levenscyclus |
| S9 | [household-store.mjs](../src/storage/household-store.mjs), [commit-outcome.mjs](../src/storage/commit-outcome.mjs), [payload-parts.mjs](../src/storage/payload-parts.mjs), runtime `DataAdapter`, `commitChange`, `CloudAdapter`; [cloud-chunks.mjs](../src/storage/cloud-chunks.mjs), [sync-protocol.mjs](../src/storage/sync-protocol.mjs). Lokale atomaire opslag, ontvangstbewijzen, bestaande generatie-/pointercloud |
| S10 | [period-projections.mjs](../src/storage/period-projections.mjs), [period-workspace.mjs](../src/storage/period-workspace.mjs), [period-cache.mjs](../src/storage/period-cache.mjs), [record-session.mjs](../src/storage/record-session.mjs). Afhankelijkheidsgrafiek, hashes, `verifiedPeriods`, `period-incomplete`; recordadapter alleen localhost |
| S11 | [core/runtime.js](../src/core/runtime.js), dashboard/jaar 3373–3500, persoonlijk 3715 e.v., mobiel gezamenlijk/persoonlijk 5034 e.v., `getMonthFinancialResult` 6223; [ui/presentation.js](../src/ui/presentation.js), bestaande [styles](../src/styles). Gemeenschappelijke projecties, afzonderlijke presentaties |
| S12 | [account-scope.mjs](../src/storage/account-scope.mjs), [auth/contracts.mjs](../src/auth/contracts.mjs), [auth/runtime.js](../src/auth/runtime.js), [firestore.rules](../firestore.rules). Huishoud-/accountscope, geverifieerde accountkoppeling, rollen en lees-/schrijfrechten |

### Bestaande testcontracten

| Code | Bestanden en relevante dekking |
|---|---|
| T1 | [update3-administration](../tests/update3-administration.test.cjs), [update4-6-closing](../tests/update4-6-closing.test.cjs), [update4-7-closed-month](../tests/update4-7-closed-month.test.cjs): rekeningcontrole, openingssaldo, afsluiten/heropenen, onveranderde snapshots |
| T2 | [package3-transaction-engine](../tests/package3-transaction-engine.test.cjs): A1–A5 fysieke context, SP1–SP8 splits, IT1–IT4 overboekingen, R1–R6 vervanging; [v113-csv-processing](../tests/v113-csv-processing.test.cjs): bronbedragen, gedeelde bronnen, dubbeltellingen, bronherstel |
| T3 | [package2-planning-timeline](../tests/package2-planning-timeline.test.cjs), [update3-core](../tests/update3-core.test.cjs), [income-overview](../tests/income-overview.test.cjs): historische configuratie, maanduitzonderingen, recurrence en inkomensweergave |
| T4 | [package4-savings-refunds-forecast](../tests/package4-savings-refunds-forecast.test.cjs): S/C/RF/P-cases; [package4-allowance-planning-correction](../tests/package4-allowance-planning-correction.test.cjs): Z-cases; [v117-budget-detail-capital](../tests/v117-budget-detail-capital.test.cjs): interne spaarinleg en behoud maandruimte |
| T5 | [update4-import-engine](../tests/update4-import-engine.test.cjs), [update4-import-review-simplification](../tests/update4-import-review-simplification.test.cjs), [v117-p4-salary](../tests/v117-p4-salary.test.cjs): herkenning blijft voorstel, werkgevers-/ontvangstrekening, salaris versus extra inkomen |
| T6 | [v117-p1](../tests/v117-p1.test.cjs), [v117-p44](../tests/v117-p44.test.cjs), [v113-csv-processing](../tests/v113-csv-processing.test.cjs): geselecteerde bronnen, verloren bevestiging, identiteit, journalherstel en exacte financiële effecten |
| T7 | [v117-p2](../tests/v117-p2.test.cjs), [v117-p3](../tests/v117-p3.test.cjs), [v117-p3-periods](../tests/v117-p3-periods.test.cjs), [package5-sync](../tests/package5-sync.test.cjs), [cloud-sync-protocol](../tests/cloud-sync-protocol.test.cjs): opslagroundtrip, integriteit, afhankelijkheden, synchronisatie |
| T8 | [browser/v117-p3](../tests/browser/v117-p3.spec.cjs), [browser/v117-p44-period-window](../tests/browser/v117-p44-period-window.spec.cjs), [browser/package4-savings-refunds-forecast](../tests/browser/package4-savings-refunds-forecast.spec.cjs), [browser/update6-account-navigation](../tests/browser/update6-account-navigation.spec.cjs), [update5-responsive-structure](../tests/update5-responsive-structure.test.cjs): browserroutes, perioden en responsieve/contextweergave |
| T9 | [update6-account-scope](../tests/update6-account-scope.test.cjs), [update6-firestore-rules-contract](../tests/update6-firestore-rules-contract.test.cjs), [emulator/v117-p3](../tests/emulator/v117-p3.test.cjs), [emulator/v117-p4](../tests/emulator/v117-p4.test.cjs): scope, regels, conflicten en cloudgrenzen |
| T10 | [browser/v117-p2](../tests/browser/v117-p2.spec.cjs), [browser/v117-p2-migration](../tests/browser/v117-p2-migration.spec.cjs), [browser/v117-p44-group-recovery](../tests/browser/v117-p44-group-recovery.spec.cjs), [browser/pwa-offline](../tests/browser/pwa-offline.spec.cjs): duurzame opslag, herstart, herstel en offline |

## 3. Verschillenmatrix P1–P5

Risico betreft de latere wijziging, niet een uitspraak over een actuele fout. Geen test gevonden voor een nieuwe V118-uitkomst betekent niet dat de bestaande fundamenttests die uitkomst al bewijzen.

### P1 — Saldi en saldo-ijkpunten

| Functionaliteit | Status en exact verschil | Bronnen / velden | Testbewijs | Afhankelijkheid, hergebruik en risico |
|---|---|---|---|---|
| Rekeningbeheer | **A.** Profielen met stabiel ID, bank, rekeningkenmerk en eigenaar bestaan | S1/S7; `accountProfiles`, `accountProfileId`, `accountOwner` | T5 rekeningfixtures; T2 fysieke context | Behouden; laag |
| Administratief saldo per eigenaar | **A.** Opening + bankmutaties + uitgevoerde niet-dubbele transfers + correcties; afsluiting bewaart uitkomst | S3; `openingBalance`, `effectiveMonth`, `accountControl` | T1, T2 | Herbruikbare controle, maar drie eigenaarscontexten zijn geen willekeurige fysieke rekening-ID's; middel |
| Banksaldo per fysieke rekening | **B.** Bronnen zijn per `accountProfileId` selecteerbaar; saldo-instellingen worden nog per eigenaar bijgehouden | S2 `accountId`-filter; S3 | T2; geen algemene saldotijdlijntest | P5-identiteit + P1; hoog bij meerdere rekeningen van één eigenaar |
| Ijkpunten met peildatum | **B.** Eenmalige maandopening en werkelijke stand bij afsluiting bestaan; meerdere gedateerde waarnemingen per rekening ontbreken | S3 | T1; geen dagelijkse ijkpuntcases | Nieuw optioneel model; hoog wegens datumgrens |
| Aansluiting goedgekeurde CSV | **B.** Goedkeuringscontract én broncashflow bestaan, maar kiezen verschillende verzamelingen | S1/S2/S5 | T2/T6 | Expliciete brug nodig; hoog, zie §4 |
| Dubbeltelling voorkomen | **A** voor bestaande CSV-bronnen/splits/vervanging; **B** voor grens ijkpunt/prognose en toekomstige CSV/API-overlap | S2/S8; `bankSourceId`, bewijs, vervangingsrelatie | T2/T6 | Identiteiten hergebruiken; hoog bij nieuwe adapter |
| Ontbrekende transacties controleren | **B.** Saldo-afwijking, open reviews en ontbrekende opslagafhankelijkheden zijn zichtbaar; geen bankdekkingsbewijs voor compleet datumbereik | S3/S10 | T1/T7 | Geen mutaties kunnen ook een lege periode betekenen; middel/hoog |
| Corrigeren zonder bronwijziging | **A** voor bestaande maand-/doelcorrecties; **B** voor geversioneerde rekeningijkpunten | S3/S6; `monthCorrections`, ledgercorrectie | T1/T4 | Afzonderlijke correctie, oude bron/snapshot bewaren; hoog |
| Gezamenlijk/persoonlijk | **A** voor context en bestemming; **B** voor saldo per fysieke rekening binnen context | S1/S12 | T2/T9 | Geen eigenaar raden; middel |
| Spaarrekeningen/interne overboekingen | **B.** Spaarledger en expliciete transferparen werken; doelpotje is geen bankrekening, algemene rekening-doelrelatie ontbreekt | S5/S6; `internalTransferPairs`, `savingsGoalLedger` | T2 IT1–IT4, T4 | Mapping en twee kaszijden nodig; hoog |

### P2 — Prognose-engine

| Functionaliteit | Status en exact verschil | Bronnen / velden | Testbewijs | Afhankelijkheid, hergebruik en risico |
|---|---|---|---|---|
| Bestaande maandprognose | **A.** Eén gedeelde selector voor inkomen, actuele lasten, sparen, refunds en planninggedreven zakgeld | S5; `financialForecastForMonth`, `allowanceBasis` | T4/T5 | Behouden als contract; hoog indien betekenis verandert |
| Dagelijkse rekeningstand | **C.** Geen algemene cumulatieve kaslijn vanaf rekeningijkpunt | S2/S4/S5 als invoer | Nieuwe tests vereist | P1 + datum-/rekeningmapping; groot/hoog |
| Salaris en overige geplande inkomsten | **B.** Historische bedragen, bronnen en occurrences bestaan; betrouwbare volgende betaaldatum per fysieke rekening niet algemeen bewezen | S4/S7; `salaryPersonId`, `salarySourceId`, `salaryMonth`, `incomeOccurrenceId` | T3/T5 | Legacy begindatum kan migratieanker zijn; nooit als bewezen betaaldag promoveren; hoog |
| Vaste lasten met betaalmoment | **B.** Occurrences met datums bestaan; `afschrijfdatum` is losse administratieve metadata | S4; begin/eind/frequentie/historie | T3, T2 F-cases | Cashdatum moet expliciet zijn zonder occurrence-ID te wijzigen; hoog |
| Budgetruimte/verwachte uitgaven | **B.** Budgetplan en actuals bestaan; verdeling resterend budget over dagen ontbreekt | S4/S5; `budgetReserve`, `budgetImpact` | T4 Z-cases | Productkeuze §9, geen extra budgetaftrek; hoog |
| Spaarbewegingen/doelen | **B.** Werkelijke inleg/opnames, dekking en maandplanning bestaan; toekomstige kasmomenten/tegenrekening niet compleet | S6; overrides, ledger, interne inleg | T4 | P1 rekeningmapping; hoog |
| Historische correcties/refunds | **A** voor bestaande financiële semantiek; **B** voor doorwerking in dagelijkse lijn vanaf ijkpunt | S5/S6; bankdatum versus `refundMonth` | T4 RF/P-cases, T7 | Historische categoriecorrectie mag geen tweede kasontvangst worden; hoog |
| Horizon tot volgende salarisbetaling | **C/D.** Geen horizonselector; keuze bij twee salarissen/onbekende datum ontbreekt | S4/S7 als bron | Nieuwe tests vereist | §9; middel |
| Laagste saldo | **C.** Geen datum + minimum over dagelijkse rekeninglijn | Nieuwe afgeleide output | Nieuwe tests vereist | Daglijn compleet; middel |
| Veilig beschikbaar | **C/D.** Niet hetzelfde als `available`; buffers €200/€0 vastgelegd in opdracht, definitieve reken-/reserveringsafspraak nog nodig | Nieuwe afgeleide output/config | Nieuwe tests vereist | P1/P2 en §9; hoog |

### P3 — Dashboard en Vooruitblik

| Functionaliteit | Status en exact verschil | Bronnen / velden | Testbewijs | Afhankelijkheid, hergebruik en risico |
|---|---|---|---|---|
| Gezamenlijk/persoonlijk dashboard | **A.** Bestaande kaarten, rollen en mobiele presentatie | S11/S12 | T8/T9 | Hergebruiken; laag/middel |
| Actuele/voorspelde banksaldi | **B.** Administratieve maandcontrole aanwezig; geen hoofdweergave van dagelijkse P1/P2-banklijn | S3/S11 | T1/T8 voor basis | P1/P2; middel |
| Veilig beschikbaar | **C.** Nieuwe output, toelichting en onvolledigheidsstatus nodig | S11 + P2 | Nieuwe tests vereist | Geen vervanging zakgeldkaart; middel |
| Dagelijkse/maandelijkse vooruitblik | **B.** Maandselectie, planning, doelprognoses aanwezig; dagelijkse liquiditeitsweergave ontbreekt | S4/S5/S11 | T3/T4/T8 | Eén projectie voor beide viewports; middel |
| Inkomsten, verplichtingen, budgetten, sparen | **A** voor bestaande maandinformatie; **B** voor rekeninggebonden toekomstige gebeurtenissen | S4/S5/S6/S11 | T3/T4/T8 | Datum- en kwaliteitlabels toevoegen; middel |
| Toekomstige tekortwaarschuwing | **B.** Negatieve maandruimte wordt getoond; geen eerste tekortdatum/minimum binnen horizon | S11; negatieve `available` | T4/T8 voor basis | P2; middel |
| Jaaroverzicht geverifieerde maanden | **A** voor bestaande route: `getMonthFinancialResult`, opgeslagen afsluiting of bewezen samenvatting; **B** voor nieuwe dagelijkse banksaldo-informatie | S10/S11 | T7/T8; P3-aanvullingsverslag | Recordroute niet productieactief; geen cloud-cutover nodig; middel |

### P4 — Automatische transactiesuggesties

| Functionaliteit | Status en exact verschil | Bronnen / velden | Testbewijs | Afhankelijkheid, hergebruik en risico |
|---|---|---|---|---|
| Categorie en budget | **A.** Regelprioriteit tegenrekening → omschrijving → organisatie → trefwoord → voorspelling; categorie/budget-ID voorstel | S7; `recognitionRules`, `budgetItemId` | T5 | Gerichte conflictuitleg mogelijk; middel |
| Persoon/eigenaar | **B.** Fysieke eigenaar uit profiel; budgeteigenaar standaard profielcontext. Algemene geleerde bestemming per persoon ontbreekt in regelsignatuur | S1/S7 | T2/T5 | Geen nieuwe persoonsheuristiek zonder context; middel/hoog |
| Salaris/werkgever | **A.** Exacte werkgevers- én ontvangstrekening plus eerdere actieve handmatige goedkeuring kunnen persoon voorstellen; ambigu blijft leeg | S7; `proposeSalaryPerson` | T5 salarisgevallen | Behouden; geen bedragmatching als identiteit; laag |
| Vaste lasten | **A** voor regelkoppeling en bedragcontrole; **B** voor eenduidige toekomstige occurrence-/betaaldatumvoorstellen | S4/S7; `fixedExpenseId`, tolerance | T5/T2 | Bestaande tolerantie max(€5, 15%) bewijst geen bankidentiteit; middel |
| Interne overboekingen | **A** voor herkenning eigen tegenrekening en expliciete paarbevestiging; **B** voor complete rekeningpaarvoorstellen | S7/S5; `internalTransferPairs` | T5/T2 IT-cases | Twee echte bronnen nodig; hoog |
| Sparen/spaardoelen | **A** voor type/doelherkenning en verwerking; **B** voor contextcontrole en alle gerichte suggesties | S7/S6; `savingsGoalId` | T4/T5 | Interne inlegkoppeling nooit door bulk kopiëren; middel |
| Refunds/correcties | **B.** Refundtype en handmatige historische correctie bestaan; herkenningsregels leren geen bewezen aankoop-/correctiemaandrelatie | S7/S6; `refundCategory`, `refundMonth` | T4 RF-cases | Hoog, geen historische maand gokken |
| Leren van handmatige goedkeuring | **A.** Alleen expliciet goedgekeurde geldige niet-dubbele regels; eenduidige groepen; maximaal 300 regels | S7 1290–1318 | T5 Lidl/herkenning | Regelherkomst en context kunnen beter; middel |
| Onzeker/conflict/duplicaat | **A.** Redenen, onbekend/nakijken, mogelijke versus bewezen duplicaten; **B** voor provideroverschrijdende voorstellen | S7/S8 | T5/T6 | Bewijs en herkenning gescheiden; hoog |
| Handmatige eindgoedkeuring | **A.** Herkenning zet geen `approvalSource`; centrale expliciete goedkeuring en duurzame commit bestaan | S1/S7/S8/S9 | T5/T6/T10 | Onveranderd verplicht; hoog bij omzeilen |

### P5 — Voorbereiding bankkoppeling

| Functionaliteit | Status en exact verschil | Bronnen / velden | Testbewijs | Afhankelijkheid, hergebruik en risico |
|---|---|---|---|---|
| Gemeenschappelijk invoercontract | **B.** Immutable banklaag + processing bestaan; parser/lifecycle/sourceclassificatie zijn CSV-gebonden | S1/S2/S7/S8 | T2/T5/T6 | Kleine adaptergrens ontwerpen; middel/hoog |
| Rekening-/bronidentiteiten | **B.** Stabiel profiel en bron-ID; `bank-id` met `authority/id` herkenbaar, maar provideraccount-alias en volledige API-route ontbreken | S2/S8 | T2/T6; geen end-to-end PSD2-bewijs | ID's behouden; hoog |
| Idempotente import/sync | **A** voor huidige CSV/operaties; **B** voor API-paginering, pending→booked en CSV/API-overlap | S8/S9 | T6/T7/T10 | Nieuwe contracttests, geen netwerkadapter; hoog |
| CSV/API-veldverschillen | **B.** Datum, boekdatum, bedrag, valuta, referentie, tegenrekening, ruwe cellen bestaan; waardedatum, providerstatus en revisies niet uniform | S7 parser, S8 identiteit | T5 | Niet-EUR niet stil optellen; middel |
| Saldo/peildatum/dekking | **C** als gemeenschappelijk bankinvoercontract; bestaande maandcontrole is slechts basis | S3 + P1 | Nieuwe contracttests vereist | P1-modellen hergebruiken; hoog |
| Toestemming/verval/fouten | **C.** Geen banktoestemming- of banksessielevenscyclus aangetroffen; Firebase-inloggen is iets anders | S12 alleen app-auth | Nieuwe contracttests vereist | Alleen model/validatie in V118; middel |
| Offline/CSV-terugval | **B.** Offline lokale writes, herstel en CSV werken; API-versheid/foutstatus/terugvalrelatie ontbreken | S8/S9/S10 | T7/T10 | Laatst bewezen data behouden; middel |
| Huishoudscheiding/beveiliging | **A** voor bestaande huishoudgrens; **B** voor toekomstige bankverbinding/credentialgrens | S12; huishoudpaden | T9 | Geen tokens in client, aparte toekomstige servergrens; hoog |

## 4. Belangrijke contracten en verschillen

### 4.1 Bankbron, goedgekeurde verwerking en saldo

`selectBankTransactions` levert een bankbron eenmaal met het oorspronkelijke getekende bedrag. De selectie vereist een actieve importbron, maar **filtert niet op financiële goedkeuring**. Ook een nog te beoordelen bron kan dus in de banklijst en `u3AccountControl` voorkomen. De financiële engine activeert uitsluitend goedgekeurde verwerkingsregels; `bank-source`-headers zelf zijn daar geen effecten. Dit verschil is expliciet getest in `v113-csv-processing.test.cjs`, geval V113 27 voor onbekend, nakijken, niet-meetellen en goedgekeurd; V113 14 controleert één bankafschrijving bij een deels uitgesloten splitsing.

Dit zijn twee verschillende nuttige waarheden. V118 moet de bankcontrole niet stil wijzigen naar dezelfde selectie als budgetberekeningen. Voor de nieuwe prognose is voorgesteld: na het gekozen ijkpunt uitsluitend voldoende geïdentificeerde, goedgekeurde bronnen als bevestigde mutaties verwerken; overige bronnen apart tonen en betrouwbaarheid blokkeren of verlagen. De productkeuze staat in §9. Een bron die budgetmatig is uitgesloten kan fysiek wel degelijk het banksaldo beïnvloeden. Dat vraagt expliciete semantiek voor de banklijn, geen hergebruik van alleen `budgetImpact`.

Gebruik bankbedrag/datum voor kasbewegingen en verwerkingsbedrag/bestemming voor budgetimpact. Splits, een bronheader, meerdere importverwijzingen en een handmatige vervangingsboeking mogen samen nooit meerdere bankmutaties opleveren. Bankcashflow kan bewust afwijken van een bewerkt verwerkingsbedrag: T2 bevat daar een expliciete test voor.

### 4.2 Maandruimte, zakgeld en liquiditeit

`financialForecastForMonth` onderscheidt actuele lasten van de planningbasis voor zakgeld. Werkelijke salarisontvangst gaat vóór expliciete handmatige dashboardwaarde, die vóór historisch salarisplan gaat. Werkelijke inkomsten blijven afzonderlijk transactiegedreven. Een opgeslagen nul is geldig.

Vaste lasten met gekoppelde actieve actuals gebruiken het actualtotaal; anders geldt planning. De zakgeldbasis reserveert ondertussen het volledige maandplan voor vaste lasten, budgetten en gezamenlijk sparen. Refunds, onder-/overschrijding en spaardekking veranderen het afgesproken zakgeld niet. Zie [Pakket 4, definitieve correctie](package-4-savings-refunds-forecast.md) en T4.

De V118-daglijn is daarom een aanvullende projectie van dezelfde gebeurtenissen. Trek niet eerst `available` af en daarna dezelfde geplande lasten, budgetten of spaarinleg. Een refund heeft kaswerking op bankdatum en categoriecorrectie op `refundMonth`; alleen het eerste verandert de banklijn. De p4r5-uitzondering voor sparen uit bestaande interne inleg vermindert de maandlast, maar wist de echte bankafschrijving niet. Neem ook de runtime-adapter `monthlyFinancialForecast` mee: die levert `compatibilityIncome` voor bestaande vaste teruggaven. Alleen de pure selector met standaardargumenten aanroepen bewijst nog geen gelijkheid met het huidige dashboard.

### 4.3 Datums en rekeningen

Een occurrence-ID is gebaseerd op item-ID en recurrence-datum. De bestaande `afschrijfdatum` verplaatst dat anker niet automatisch. Oude salarisbronnen kregen bij migratie een begindatum vanuit de administratie; dat is geen bewijs voor de werkelijke salarisdag. Ook gebruikt de nieuwe salarislink een maandidentiteit `income-defaults-salary-{persoon}:{maand}`, terwijl algemene inkomensoccurrences datumidentiteiten hebben. De dagadapter moet die relaties expliciet verzoenen om dubbel ingepland salaris te voorkomen.

`ACCOUNT_CONTEXTS` bevat gezamenlijk, Dion en Dara. `accountProfiles` kan fysieke rekeningen onderscheiden. P1/P2 moeten op profiel-ID rekenen en pas daarna optellen per eigenaar. Een spaardoel is een bestemming van geld en mag niet als extra bankvermogen bovenop de spaarrekening worden opgeteld. Handmatige regels zonder fysieke rekening blijven zichtbaar als onopgeloste toewijzing; geen willekeurig eerste profiel kiezen. `u3OpeningBalance` leest de laatste eerdere afgesloten maand, ook wanneer die niet direct voorafgaat. De nieuwe daglijn moet alle tussenliggende mutaties vanaf het ijkpunt verwerken en kan deze maandhelper dus niet zonder aanpassing als dagelijkse openingsstand gebruiken.

### 4.4 Volledigheid en privacy

Een geverifieerde opslagperiode bewijst dat de bekende records compleet en integer zijn, niet dat alle banktransacties zijn aangeleverd. Een sluitende saldoreconciliatie is nuttig bewijs, maar kan twee ontbrekende tegengestelde mutaties niet uitsluiten. CSV-minimum-/maximumdatum alleen bewijst evenmin een volledig bankbereik. Bewaar daarom bankdekking, reviewstatus en opslagintegriteit als afzonderlijke kwaliteitsdimensies.

De huidige Firestore-regels begrenzen toegang per gekoppeld huishouden. Financiële huishoudstate is voor gekoppelde leden leesbaar; een verborgen persoonlijke tab bewijst geen afzonderlijke serverzijdige geheimhouding binnen dat huishouden. [PRODUCT.md](../PRODUCT.md) formuleert privacy breder. Voor een toekomstige persoonlijke bankverbinding moet de credential-/toestemmingsgrens expliciet op gebruiker/verbinding worden gelegd. Dit rapport claimt niet dat die bankprivacy al bestaat en stelt geen wijziging van de bestaande financiële deelafspraken voor.

## 5. Eerdere afspraken: besloten, gebouwd of voorstel

| Onderwerp | Herkomst en type | Conclusie voor V118 |
|---|---|---|
| V117 afgerond; rekeningbeheer behouden; geen motorvervanging of prestatieproject | Huidige gebruikersopdracht, expliciet | Leidende scope |
| Handmatige saldo-ijkpunten, later aanvulbaar door bank | Huidige opdracht, expliciet | Bouwen; nog geen implementatie van algemene dagijkpunten gevonden |
| Horizon volgende salarisbetaling; alternatieve einddatum | Huidige opdracht, expliciet | Doel staat vast; keuze bij meerdere salarissen en onbekende betaaldatum nog uitwerken |
| Buffers gezamenlijk €200, persoonlijk €0 | Huidige opdracht, expliciet | Defaults; toerekening bij meerdere fysieke rekeningen nog kiezen |
| Handmatige eindgoedkeuring | Huidige opdracht plus S1/S7/T5/T6 | Bestaand contract handhaven |
| Zakgeld volgt volledige maandplanning | Expliciete gebruikerskeuze vastgelegd in [Pakket 4](package-4-savings-refunds-forecast.md), geïmplementeerd en getest | Dagelijkse vooruitblik wijzigt deze berekening niet |
| Werkelijk vervangt gepland | Gebouwd in S5 en salariscontract; genuanceerd door zakgeldafspraak | Vervang alleen overeenkomstige prognosegebeurtenis; laat planningbasis intact |
| Refund met vaste én variabele categorie blijft afzonderlijke categoriecorrectie | Laatste keuze in Pakket 4; T4 | Niet naar rato over vast/variabel verdelen |
| Cloud-recordopslag en geverifieerde perioden | Gebouwd/testbaar, productieactivering expliciet uitgesteld op 12 oktober | Geen bank-/P1-afhankelijkheid maken van omschakeling |
| Conflictinterface voor afwijkende brongoedkeuringen | [Functioneel ontwerp](audit/v117-conflictroute-functioneel-ontwerp.md), niet geïmplementeerd | Niet als V117-functie presenteren; afzonderlijke goedkeuring vereist |
| Spaarinleg uit ontvangen intern geld | Nieuwste [p4r5-verslag](audit/v117-p4r5-budget-en-spaarinleg.md), gebouwd | Zelfde maand/eigenaar/doel; dubbele toerekening blokkeert. Geen koppelingen tussen maanden of gesplitste ontvangsten toevoegen onder P1 |

Documentconflicten: oudere Update-4-documenten noemen schema v5 en `budgetPlanners/finize`; huidige code gebruikt schema 11 en huishoudpaden. Het architectuurdocument noemt nog localStorage als kernstate; V117 P2 en de actuele DataAdapter gebruiken duurzame IndexedDB-opslag. Het vroege P3-verslag noemt ontbrekende integratie die later is toegevoegd. Oude algemene vrijgaveblokkades zijn ingehaald door het expliciete besluit tot compatibele V117-publicatie, maar niet door toestemming voor record-cutover. De in §4.4 genoemde privacyclaim is evenmin automatisch bewezen door tabverberging. Geen van deze verschillen is tijdens dit onderzoek gerepareerd.

In de relevante repositorydocumenten en onderzochte Git-berichten is geen afzonderlijk eerder V118-ontwerp voor de buffers/ijkpunten gevonden. De meegeleverde opdracht is daarvoor de expliciete bron; dit is geen claim over ongeopende chats of documenten buiten deze repository.

## 6. Concrete implementatiepakketten

Alle namen van nieuwe velden/modules hieronder zijn **voorstellen**, geen bestaande of reeds goedgekeurde implementatie. Alle wijzigingen lopen later via bestaande commands, kandidaatvalidatie, commit, opslag en sync.

### P5a — Leg vooraf de kleine gedeelde invoergrens vast

Doel: voorkomen dat P1 een CSV-specifieke saldostructuur krijgt die voor bankgegevens opnieuw moet worden gebouwd.

- Definieer een versieerbaar genormaliseerd broncontract met huishoudscope, bestaand `accountProfileId`, bronkanaal, provider-/authoritynamespace, bronidentiteit, getekend bedrag in gehele centen, valuta, transactie-/boek-/optionele waardedatum, bankstatus en onveranderlijke herkomst.
- Scheid drie invoertypen: banktransactie, saldo-waarneming en dekkingsinformatie. Een saldo-waarneming is nooit een transactie. Een import-/ophaaloperatie is geen bankidentiteit.
- Hergebruik CSV-parser en bronbewijs; leg conversie naar het bestaande `bankOriginal`/processing-contract vast. Begin met contract en pure normalisatie/validatie. Geen endpoint, OAuth, scheduler of externe call.
- Houd bestaande CSV-payloads en ID's exact leesbaar. Nieuwe bronkanalen mogen niet ongecontroleerd door `getTransactionSource` als manual of CSV worden geïnterpreteerd.
- De huidige duplicaatfunctie verlangt naast bronbewijs ook gelijkheid van `immutableBankFields`, inclusief CSV-`rawCells`. CSV en API hebben niet vanzelf dezelfde ruwe representatie. Leg daarom expliciet vast welke canonieke feiten bij kanaaloverlap moeten overeenkomen, met behoud van beide originele bewijzen; verruim de bestaande CSV-identiteitscontrole niet stilzwijgend.
- Acceptatie:zelfde CSV geeft dezelfde bestaande bron/effecten; ontbrekende identity blijft onzeker; niet-EUR of onbekende status wordt expliciet geblokkeerd/uitgesteld; geen goedkeuring door normaliseren.

Dit deel is klein en loopt vóór P1. Verdere lifecyclevoorbereiding staat onder P5b.

### P1 — Rekeninggebonden saldo-ijkpunten

**Functionaliteit.** Op een bestaand rekeningprofiel een saldo en peildatum vastleggen, historie inzien, nieuw ijkpunt toevoegen en de aansluiting op bekende mutaties beoordelen. Gezamenlijk, persoonlijk en sparen gebruiken dezelfde bronstructuur.

**Technische wijzigingen.** Voeg optioneel `balanceCheckpoints` toe met stabiel ID, `accountProfileId`, `amountCents`, `currency`, peildatum/-semantiek, bronkanaal, actor/tijd, revisie en eventueel `supersedesId`. Bewaar vervallen waarnemingen; verander `bankOriginal` niet. Voeg een pure saldoselector toe die het laatste geldige ijkpunt vóór de gevraagde datum kiest, gebeurtenissen op bronidentiteit dedupliceert en kwaliteit/afwijkingen teruggeeft. Corrigeren van een waarneming is geen inkomsten-/uitgavenboeking.

Voorstel peildatum: saldo aan het einde van de gekozen bankdag, zodat alleen latere bankdatums het saldo aanvullen. Bij een toekomstig banksaldo met tijdstip maar transacties zonder tijd is een inclusiebewijs of nieuwe daggrens nodig; niet achteraf een willekeurige volgorde gokken. Het gekozen ijkpunt mag mutaties die al in de waarneming zitten nooit opnieuw optellen.

**Migratie.** Geen bulkconversie van `accountSettings` of spaardoelsaldi naar dagelijkse banksaldi. Bied bestaande openings-/afsluitwaarden alleen als expliciet te bevestigen kandidaat aan wanneer profiel en datum eenduidig zijn. Nieuwe velden uitsluitend bij de gebruikersactie opslaan. De generieke huishoudcodec kan optionele velden behouden; voeg gerichte roundtrip- en synchronisatiecontroles toe. Verhoog schema of databaseversie alleen als een concrete opslagbeperking dat nodig maakt; huidige code en regels accepteren expliciet schema 11.

**UI.** Breid de bestaande rekeningbediening uit met saldo, datum en herkomst; gebruik bestaande modals, datum-/bedragvelden en historiepatronen. Mobiel dezelfde acties en validatie in één kolom. Toon onbekend/onvolledig, nooit een verzonnen €0.

**Acceptatie en gerichte tests.**

1. Ijkpunt €1.000 aan einde 10 oktober, goedgekeurde afschrijving €100 op 11 oktober → €900; mutatie op 10 oktober wordt niet nogmaals meegenomen.
2. Bron met drie splits of twee bewezen importverwijzingen verandert saldo eenmaal; manual replacement evenmin dubbel.
3. Nieuw ijkpunt vervangt voor latere projecties de basis; oude waarneming, transacties en afgesloten snapshots blijven gelijk.
4. Meerdere rekeningen van dezelfde eigenaar houden afzonderlijke standen. Doelsaldo wordt niet bij rekeningvermogen opgeteld.
5. Ontbrekend ijkpunt, onzekere bron, ontbrekende dekking of scopeconflict levert concrete status; geen betrouwbaar-etiket zonder bewijs.
6. Herladen, JSON-roundtrip, lokale abort en synchronisatie behouden exact dezelfde centen en historie.

Hergebruik T1/T2/T6/T7; voeg kleine ijkpunt-/datumgrenscases en één bestaande-editorroute op desktop/mobiel toe. Afhankelijk: P5a en keuzes 1/4 in §9.

### P2 — Dagelijkse prognose als aanvullende pure projectie

**Functionaliteit.** Dagstanden per fysieke rekening vanaf P1, standaard tot de volgende relevante salarisbetaling, alternatieve einddatum, minimum met datum, eerste tekortdatum en veilig beschikbaar.

**Technische wijzigingen.** Maak een gebeurtenisadapter boven S2/S4/S5/S6. Elke gebeurtenis krijgt een stabiele logische sleutel, fysieke rekening, kasdatum, getekende centen, status werkelijk/gepland/reservering en onderliggende bron-/occurrenceverwijzingen. De bestaande maandselectors blijven de bron voor financiële betekenis en bedragprecedence. De nieuwe laag verzorgt uitsluitend rekening, timing, ijkpuntgrens en cumulatie.

Koppel werkelijke betalingen aan het relevante plan via bestaande expliciete links. Houd de matchinformatie ook wanneer een echte betaling vóór het ijkpunt viel: de betaling zit dan al in het saldo, maar het bijbehorende plan moet nog steeds worden onderdrukt. Laat meerdere gekoppelde actuals samen dezelfde geplande gebeurtenis vervangen. Een onbewezen mogelijke match blijft onzeker; geen stille deduplicatie op bedrag/naam.

Bij overlopende maanden blijft bankdatum leidend voor liquiditeit, occurrence-maand voor vaste-lastadministratie en refundmaand voor historische categoriecorrectie. Gebruik voor salaris de persoon-/maandlink én de bevestigde betalingsplanning; tel de algemene legacy-inkomensoccurrence niet nogmaals als loon op. Een vaste last met gedeeltelijke actuals behoudt het huidige vervangingscontract; voeg geen vermeend restant toe zonder een afzonderlijke productbeslissing.

Voor resterende budgetten en ongedateerd sparen is een expliciet beleid nodig. Voorgesteld: reserveer bekende verplichtingen conservatief en label hun datum als aanname; niet-ontvangen onzeker inkomen verhoogt veilig beschikbaar niet. Houd reserveringen buiten echte transacties/ledger. Trek dezelfde reservering niet opnieuw af bij het berekenen van veilig beschikbaar.

**Voorgestelde formule.** Neem de beginstand en alle dagstanden binnen de horizon mee. Als de dekking en noodzakelijke datums voldoende zijn: `veiligBeschikbaar = max(0, minimumGeprojecteerdSaldo - veiligheidsbuffer)`. Toon een tekort daarnaast apart, zodat de begrenzing op nul het tekort niet verbergt. Ontbreekt betrouwbare invoer, geef geen definitief veilig bedrag. De standaardhorizon loopt voorgesteld tot vlak vóór de volgende salarisontvangst; die ontvangst verlengt pas daarna de volgende horizon. Voor dezelfde dag met onbekende volgorde: toon dat het om een dagprognose gaat, geen garantie over tussentijdse bankstanden.

**Migratie.** Afgeleide dagstanden niet als tweede financiële waarheid opslaan. Alleen expliciet ingevoerde betaaldag-/rekening-/bufferinstellingen optioneel bewaren, met ingangsdatum en historie. Geen legacy-migratieanker tot salarisdag verklaren. Lees- en projectiefuncties schrijven niets.

**UI.** P2 levert de selector plus instellingen in bestaande planning-/rekeningeditors; de presentatie volgt in P3. Onbekende betalingstijd blijft herkenbaar. Beide viewports gebruiken dezelfde projectie.

**Acceptatie en gerichte tests.**

1. Begin €500, afschrijving €400, latere ontvangst €200 → minimum €100; bij €200 buffer is veilig beschikbaar €0, tekort tot buffer €100. Horizon beïnvloedt welke ontvangst wordt meegenomen.
2. Salaris gepland €2.500 en expliciet ontvangen €2.530 → één ontvangst €2.530; bonus blijft apart; datum-/maandgrens en expliciete nul zijn gedekt.
3. Vaste-lastplan €100 met gekoppelde actual €105 → één kasbetaling volgens bankbedrag; zakgeldreserve blijft €100.
4. Refund augustus met ontvangst september → categoriecorrectie augustus, uitsluitend september kascredit. Spaarinleg/coverage/interne inleg houden bestaande doelen en maandruimte intact.
5. Actual vóór ijkpunt, betaling na occurrence-maand, heropening, meerdere actuals, einde maand, schrikkeldag en twee salarissen geven deterministische resultaten.
6. Maand-/jaarprojecties, bestaande zakgeldberekening en financiële bronstate blijven voor dezelfde invoer identiek. Vereiste historische dependencies ontbreken → onvolledig, niet nul.

Hergebruik T2/T3/T4/T5/T7. Voeg uitsluitend kleine daglijnfixtures toe, inclusief expliciete cashflow-/budgetbrug. Afhankelijk: P1, P5a en keuzes 1–3 in §9.

### P3 — Bestaand dashboard aanvullen met Vooruitblik

**Functionaliteit.** Rekeningstanden, veilig beschikbaar, komende inkomsten/verplichtingen, dagelijkse lijn/lijst, tekortdatum en doorklik naar bron/plan. Gezamenlijk en persoonlijk behouden hun bekende context. Geen nieuw visueel concept.

**Technische wijzigingen.** Eén presentatieadapter leest de P1/P2-output. Bestaande maandkaarten blijven op de huidige selectors. Breid jaaroverzicht alleen uit via `getMonthFinancialResult` en geverifieerde samenvattingen. Sommeer kasstromen/maandresultaten waar dat inhoudelijk klopt, maar tel banksaldi van twaalf maanden niet op als jaarinkomen of vermogen. Gebruik voor begin/eind/minimum expliciete periodebetekenis.

**Desktop/mobiel.** Hergebruik kaarten, kleuren, bedragen, modalbediening en maandkiezer. Desktop kan de daglijn met gebeurtenislijst naast elkaar tonen; mobiel onder elkaar met dezelfde selectie. Een tekst-/tabelweergave blijft beschikbaar voor toetsenbord en toegankelijkheid. Toon peildatum, horizon, buffer, actual/plan, ontbrekende gegevens en laatste bevestiging bij het bedrag. Ontwerpbeslissingen blijven onderdeel van latere implementatie; nu is geen scherm gebouwd.

**Migratie.** Geen financiële migratie. Hoogstens optionele weergave-/horizonvoorkeur. Geen nieuw opslag- of renderpad voor mobiel.

**Acceptatie/tests.** Desktop 1440, mobiel 390 en compacte breedte 320: dezelfde centen en gebeurtenissen; geen horizontaal onbereikbare bediening; Nederlandse labels en focus. Ontbrekend ijkpunt, onvoldoende dekking, offline oude gegevens, geen salarisdatum, negatief saldo en lege rekening krijgen afzonderlijke begrijpelijke staten. Gesloten maanden houden snapshots; jaarcijfers halen geen ongeverifieerde ontbrekende maand als nul binnen.

Hergebruik T8 en financiële fixtures uit P2; één gerichte browserroute per werkelijk gewijzigd pad. Afhankelijk: P1/P2. Risico middel: vooral verwarring tussen maandruimte en banksaldo voorkomen.

### P4 — Bestaande suggesties gericht uitbreiden

**Functionaliteit.** Toon waarom een voorstel is gedaan, welke eerdere goedkeuring of regel relevant is en wat nog onzeker is. Vul alleen aantoonbare gaten aan: contextgebonden budgetbestemming, occurrencekeuze en expliciete historische refundvoorstellen waar voldoende bewijs bestaat.

**Technische wijzigingen.** Breid de bestaande regel-/voorstelstructuur uit met optionele herkomst en rekening-/bestemmingscontext. Controleer geldigheid van budget-, vaste-last- en doel-ID voor de relevante maand. De huidige regelsignatuur bevat geen algemene `budgetOwner`; leer die niet blind op organisatienaam over rekeningen heen. Bewaar bestaande regels en laat ambigue regels als voorstel functioneren. Werk nooit bestaande transacties achteraf massaal bij door een gewijzigde regel.

Salarispersoon blijft alleen voorstel bij één eenduidige combinatie van werkgever en ontvangstrekening. Interne paren vereisen aantoonbare kanten en expliciete bevestiging. Refundcategorie/-maand en dekking blijven handmatig als er geen unieke onderbouwde relatie bestaat. Kopieer geen `savingsContributionId` of andere unieke financiële bronrelatie naar een bulkselectie.

**Migratie.** Geen verplichte conversie van oude regels. Herkomstloos betekent legacy/onbekende herkomst, geen verzonnen eerdere goedkeuring. Nieuwe auditvelden uitsluitend bij nieuwe expliciete leeractie.

**UI.** Bestaande importlijst/editor en regelbeheer aanvullen met compacte reden, onzekerheid en keuzemogelijkheid. De bestaande goedkeuringsknop blijft beslissend op desktop én mobiel.

**Acceptatie/tests.** Onbekende match boekt niets; conflicterende regels kiezen niet automatisch; verkeerde rekening/persoon/maand blokkeert onveilige overname; reapproval en herstart geven exact één effect. Selectie van vijf uit tien bronnen raakt alleen die vijf en behoudt individuele bedragen/IDs. Bestaande categorie-, salaris-, savings- en refundtests blijven ongewijzigd geldig.

Hergebruik T5/T6 plus geraakte T2/T4-contracten. Afhankelijk: gedeelde P5-identiteiten; alleen nieuwe dag-occurrencevoorstellen wachten op P2. Omvang blijft begrensd door eerst vast te leggen welke ontbrekende suggesties werkelijk nodig zijn.

### P5b — Provideronafhankelijk contract afronden, zonder koppeling

**Functionaliteit.** Leg vast hoe toekomstige bankgegevens dezelfde importreview, saldo-ijkpunten en herstelroute kunnen gebruiken. Implementatie beperkt tot lokale contracten/normalisatie en kleine synthetische adaptertests.

| Invoer | Contract voor later |
|---|---|
| Bankrekening | Bestaand profiel blijft interne identiteit; provideraccount-ID is een expliciete alias binnen huishouden, provider en verbinding. Gewijzigde IBAN/alias nooit blind samenvoegen |
| Geboekte transactie | Provider-ID met authority + rekeningcontext; originele payloadreferentie en genormaliseerde immutable velden. Conflicterend bedrag bij hetzelfde ID wordt een afwijking, geen overwrite |
| Pending/reservering | Apart voorstel/status; geen geboekte actual. Overgang naar booked via expliciete alias-/opvolgingsrelatie, zodat beide niet samen meetellen |
| CSV/API-overlap | Alleen hard bronbewijs mag samenvoegen; gelijk bedrag/datum/omschrijving geeft mogelijke duplicaatmelding. Herhaald ophalen behoudt multipliciteit van echte gelijke betalingen |
| Saldo | Type booked/available/ander, valuta, peiltijd en inclusiegrens expliciet. Pending mag niet nogmaals worden afgetrokken van een available balance waarin het al verwerkt is |
| Dekking | Van/tot, volledigheidsindicatie, laatste succesvolle ontvangst en reden voor gaten; cursor en paginavolledigheid zijn ophaalmetadata, geen bewijs op zichzelf |
| Toestemming | Voorgestelde statusreeks niet-verbonden, actief, verlopen, ingetrokken, herauthenticatie-nodig, fout; alleen metadata, geen echte toestemming of externe handeling |
| Fouten/offline | Laatst bewezen records behouden; verlopen/niet-bereikbaar/geen-toegang/ongeldige-data verschillend tonen. Geen leegmaking of automatische CSV-herimport |

**Veiligheidsgrens.** Toekomstige tokens/secrets horen achter een geautoriseerde servergrens, niet in PWA, localStorage, IndexedDB-export, Git of herkenningsregels. Bankverbindingen moeten per huishouden en bevoegde gebruiker worden gecontroleerd. Beschrijf dit als integratievoorwaarde; bouw geen server of providerintegratie en doe geen complianceclaim over niet onderzochte providers.

**Migratie/UI.** Geen bestaande bankbronnen herschrijven; kanaalversie backward-compatible. Geen knop die een werkende bankkoppeling suggereert. CSV blijft de bestaande bedienbare route. Toekomstige connectieschermen vallen buiten deze implementatie.

**Acceptatie/tests.** Twee synthetische adapters leveren inhoudelijk dezelfde canonieke transactie; tweemaal dezelfde bewezen invoer geeft één bron; twee identieke maar verschillende bank-ID's blijven twee bronnen. Pending→booked, CSV/API-onzekerheid, veranderd payloadbedrag, valuta, saldopeiltijd, verlopen consent en verkeerde huishoudscope zijn contractcases zonder netwerk. De bestaande CSV-flow blijft exact gelijk. Controleer alleen geraakte S1/S2/S8/S9-code; bestaande Firestore-configuratie blijft buiten scope.

## 7. Financiële risico's, afhankelijkheden en omvang

| Risico | Voorwaarde voor veilige implementatie |
|---|---|
| Maandruimte als banksaldo presenteren | Gescheiden outputs/namen; saldo altijd herleidbaar tot rekening, ijkpunt en kasmutaties |
| Geld tweemaal tellen | Bron-/gebeurtenissleutel en vervangingsrelatie; nooit bron + splits + plan + ledger als losse kasbewegingen optellen |
| Goedkeuring versus echte bankmutatie | Besluit §9 vastleggen; bankreviewstatus, budgetactivatie en prognosebetrouwbaarheid apart modelleren |
| Onzekere datum of salarisontvangst | Datum bevestigen of als onzeker tonen; geen zekere bestedingsruimte uit onzeker inkomen |
| Spaarpot als extra vermogen | Pot-/rekeningrelatie expliciet; interne transfers bewaren beide kaszijden en tellen huishoudelijk niet als externe inkomsten |
| Oude correctie verandert historie | Geen bronmutatie, snapshots behouden, ijkpunt-/correctiehistorie met revisie |
| Verkeerde rekening of huishouden | Op stabiel profiel-ID rekenen, scope controleren vóór lezen/schrijven, geen eigenaar raden |
| Ontbrekende maand/CSV-regels | Geen nul-fallback of volledigheidsclaim; bankdekking los van opslagintegriteit |
| Opslagfout/verloren bevestiging | Bestaande atomaire commit, operatie-ID/readback en onzekere uitkomst hergebruiken |
| Gedeeltelijk geladen geschiedenis | Nieuwe globale instellingen en saldohistorie toevoegen aan bestaande dependency-/projectiecontracten; recordroute testbaar houden zonder activering |
| Oude clients en nieuwe velden | Roundtrip/sync-behoud bewijzen; versie-/writebeveiliging alleen indien concrete compatibiliteitsproef dit vereist. Geen stille productie-cutover |

### Omvang en volgorde

Dit zijn relatieve inspanningsschattingen, geen uren- of opleverbelofte. Eén werkeenheid is één afgebakende implementatiestap met gerichte verificatie. Besluiten uit §9 en onverwachte legacyambiguïteit bepalen de werkelijke duur.

| Pakket | Omvang | Concrete werkeenheden | Risico |
|---|---|---|---|
| P5a | Klein–middel | 1–2: contract/identitygrens en CSV-compatibiliteitsproef | Middel/hoog |
| P1 | Middel–groot | 4–6: ijkpuntmodel, selector/reconciliatie, rekeningkoppeling, editor/historie, opslag/sync | Hoog |
| P2 | Groot, grootste pakket | 6–9: gebeurtenisadapter, actualvervanging, salaris/datums, budget/sparen, daglijn/horizon, minimum/buffer, grensgevallen | Hoog |
| P3 | Middel | 3–5: gedeelde presentatielaag, desktop/mobiel, kwaliteitsstaten, jaarroute/toegankelijkheid | Middel |
| P4 | Klein–middel bij gerichte scope | 2–4: herkomst/context, gekozen ontbrekende voorstellen, review/bulkregressie | Middel/hoog |
| P5b | Middel | 2–3: status-/veldcontracten, lokale adaptercases, security-/offlinegrenzen | Hoog voor latere integratie, nu begrensd |
| Eindcontrole | Apart plannen | Eén definitieve-buildregressie en bewijsrapport; duur pas bij vastgestelde scope ramen | Afhankelijk van wijzigingen |

Een puur cosmetische V118 is dit niet: P1/P2 introduceren tijd- en rekeninggebonden betekenis die nu nog niet overal expliciet bestaat. De omvang wordt beperkt door maandmotor, rekeningbeheer, ledgers, importeditor en opslag te hergebruiken. Geen pakket vraagt een nieuwe financiële hoofdmotor, vervanging van IndexedDB of vervanging van Firestore-synchronisatie.

## 8. Efficiënte teststrategie

### Tijdens implementatie

1. Leg per pakket de geraakte selectors/commands en bijbehorende T-codes vast. Voer alleen die bestaande contracten plus nieuwe kleine gevallen uit. Een bestaande gehele testfile mag als dat sneller en betrouwbaarder is dan fragiele naamfilters.
2. Test pure berekeningen met kleine data en bedragen in centen. Vergelijk vóór/na `bankOriginal`, bron-ID's, transacties, ledger, planninghistorie, maandafsluitingen en bestaande projecties. Geen productiegegevens of grote nieuwe fixtures nodig.
3. Voeg browsercontrole uitsluitend toe voor echte editor-, review-, opslaan-/herladen- en presentatiepaden. Hergebruik de bestaande 390/1440-viewportaanpak en één compacte breedtecontrole voor gewijzigde UI.
4. Test atomaire opslag/herstart bij P1 en relevante nieuwe commands; gebruik bestaande abort-/lost-ack-hulpmiddelen. Draai Firestore-emulatorgevallen alleen als de wijziging cloudcontracten raakt. Niet automatisch de hele emulatorreeks per pakket.
5. Controleer build/syntax/gegenereerde assets wanneer implementatie die raakt. Geen CSS-/cachewijziging nu; later gegenereerde bestanden en assetversies volgens bestaande buildroute synchroniseren.
6. Herhaal dure suites niet na iedere document- of UI-tekstwijziging. Nieuwe fouten of gewijzigde financiële code rechtvaardigen wel hercontrole van de betreffende contracten.

### Eén integrale eindregressie

Pas wanneer alle goedgekeurde V118-pakketten klaarstaan: één vastgelegde definitieve commit/build met volledige relevante functionele Node-/browserregressie en de benodigde storage-/sync-/regelgevallen. Maak vooraf één manifest van de te draaien gevallen; sluit de expliciet verboden 500-/5.400-transactieschaaltests en prestatiebenchmarks uit. Een ongemodificeerd `pnpm test` kan bredere browsergevallen meenemen: controleer de testselectie vooraf.

Bewaar buildhash, geselecteerde suites, geslaagde/mislukte/overgeslagen aantallen en grenzen. Doe vervolgens geen financiële codewijziging zonder bijpassende hercontrole. Publicatie is een afzonderlijke geautoriseerde stap, niet het automatische gevolg van dit plan.

De aanwezige GitHub-workflow `verify.yml` draait bij PR's en push naar `refactor/finize-cleanup`; een push naar main is daardoor op zichzelf geen bewijs van een volledige regressie. Het eindbewijs moet expliciet aan de definitieve V118-build worden gekoppeld.

## 9. Uitsluitend noodzakelijke openstaande productkeuzes

Deze vragen blokkeren het rapport niet, maar hun antwoord is nodig vóór implementatie van het betreffende gedrag. De eerder afgesproken bedragen, behoud van rekeningbeheer en handmatige goedkeuring hoeven niet opnieuw te worden bevestigd.

1. **Welke bankmutaties bepalen de nieuwe betrouwbare saldoprognose?** De bestaande bankcontrole ziet ook nog te beoordelen of budgetmatig uitgesloten bronnen. Voorstel: toon bekende bankmutaties afzonderlijk, laat nieuwe prognoseverwerking op expliciete goedkeuring aansluiten en geef geen definitief veilig bedrag zolang relevante bankregels onbeslist zijn. Leg daarbij vast dat budgetmatig 'Niet meetellen' een echte bankafschrijving niet kan laten verdwijnen. Kies tevens de voorgestelde einde-bankdagsemantiek voor handmatige ijkpunten, of benoem een andere peilgrens.
2. **Welke salarisontvangst bepaalt de standaardhorizon?** Bij gezamenlijk twee salarissen: voorstel is de eerstvolgende door de gebruiker bevestigde geplande salarisdatum op de gekozen rekening, tot vlak vóór die ontvangst. Persoonlijke rekeningen kunnen vooral zakgeld ontvangen; moet hun horizon de huishoudsalarisdatum volgen of de eerstvolgende geplande persoonlijke ontvangst? Onbekende datums vragen invoer en activeren geen verzonnen standaarddag.
3. **Hoe reserveert Vooruitblik ongedateerde budgetruimte en spaarplanning?** Voorstel: resterende verplichtingen conservatief reserveren vanaf de start; dagelijkse gelijkmatige verdeling uitsluitend als expliciet gekozen schatting tonen. Bevestig of geplande spaarinleg volledig als verplichting meetelt. Deze keuze verandert veilig beschikbaar, maar niet het bestaande zakgeldcontract.
4. **Hoe verdelen we de buffer en doelen over meerdere fysieke rekeningen?** De €200 gezamenlijke buffer mag niet ongemerkt per extra gezamenlijke rekening verdubbelen. Voorstel: koppel hem aan de primaire gezamenlijke betaalrekening, persoonlijk €0; wijs doelen waar nodig aan een spaarrekening toe zonder saldo te verdubbelen. Onbekende rekeningtoewijzingen blijven onopgelost tot keuze.

Overige keuzes, zoals een modulebestandsnaam, tabelindeling of optionele metadatavelden, kunnen binnen een goedgekeurd pakket technisch worden opgelost. Providerkeuze, echte toestemming, serverimplementatie, productie-recordcutover en conflictinterface vragen nu geen besluit: zij vallen buiten deze opdracht.

## 10. Opleverstatus

De inventarisatie, verschillenmatrix, hergebruikmogelijkheden, concrete pakketten, veiligheidsvoorwaarden en gerichte testaanpak zijn vastgelegd. **Er is geen V118-functionaliteit geïmplementeerd.** Na beoordeling kan één duidelijk afgebakend pakket worden vrijgegeven. Tot die tijd stopt het werk bij dit rapport.
