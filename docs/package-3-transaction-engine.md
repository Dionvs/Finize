# FINIZE — Pakket 3: technisch verslag

Datum: 5 oktober 2026. Implementatie in de bestaande lokale repository, bovenop de aanwezige Pakket-1/2-werkboom. Schema blijft v11. De canonieke motor en de gekoppelde routes zijn geïmplementeerd en getest. Eén onderdeel blijft bewust geblokkeerd: herbewerking van legacy CSV zonder betrouwbare bronverwijzing. Daarom is een onvoorwaardelijke volledige Definition of Done voor alle oude CSV-data nog niet bereikt; zie K.

## A. INVENTARISATIE

Er bestaan drie generaties naast elkaar:

| Route | Bron, rekening en bestemming | Goedkeuring en maand | Readers/writers en koppelingen |
|---|---|---|---|
| Handmatig/oud algemeen formulier | `state.transactions`; actieve persoonlijke/gezamenlijke context of expliciete oude rekeningkeuze; `owner`, `financialFor`, `budgetOwner` waren deels verwisselbaar | Handmatig direct actief; oude `date`/`month`-interpretaties verspreid | Gezamenlijke/persoonlijke modals, algemeen formulier, verwijderen/undo, budgettransactielijst |
| Legacy CSV-reviewqueue | `transactionReviewQueue`, oude `rawData`/bronvelden; rekening soms aantoonbaar, soms ambigu | `reviewStatus: bevestigd`, koppeling na expliciete beoordeling | `u3ReviewSave`, `applyTransactionFamily`, vaste-last-/inkomstenoccurrences; oude rows zonder volledige import-ID blijven adapterdata |
| Huidige CSV-importengine | `ImportStore` volledige bankregels en processing, compacte `state.transactions` als gematerialiseerde regels | `certainty`, recognition, expliciete approval; processingDate werd soms als transactiejaar/maand gebruikt | `createImportDraft`, `planImportEffects`, `applyImportPlan`, `financialRows`, bestaande importmodal, journal/retry en compact summary |

Voor wijzigingen zijn runtime, importruntime, model, P2-resolver, opslagcontracten en tests onderzocht. De aangevraagde transaction/status/owner/month/split/link/advance-zoekpatronen zijn projectbreed nagelopen. De financiële nulmeting gebruikte een bewaarde kopie van de daadwerkelijke P2-runtime, vóór P3-wijzigingen.

Belangrijke lezers waren `getMonthTransactions` (declaratie én latere reassignment), `normalizedTransactionType`, `getTransactionExpenseImpact`, `sumTransactions`, `transactionsByCategory`, `resolveMonthlyIncome`, `u3ConfirmedTransactions`, `u3ActualIncome`, `u3ActualExpenses`, `u3BudgetSummary`, `u3AccountControl`, `u3LinkedActual` en de afzonderlijke mobiele/desktop-inkomenskaarten. Import had daarnaast een eigen `expenseImpact`/`transactionKind`-interpretatie.

Splits bestaan als parent processing-array én als compacte materialized rows met `splitId` en dezelfde importsource. Fixed links gebruiken `fixedExpenseId`, `fixedOccurrenceId`; income gebruikt `incomeSourceId`, `incomeOccurrenceId`. Vroeger werd bij een occurrence de eerste actual gevonden en werd een tweede actual geblokkeerd.

Savings-types en `savingsGoalId` produceren bestaande ledgerkoppelingen. Refund/terugbetaling-types, voorschotten, `advanceLedger`, `advanceRepayments`, replacement-records en transferpaarvoorstellen hebben afzonderlijke bestaande administratie. Deze zijn behouden. De legacy queue is nog actief en is dus niet verwijderd.

## B. CANONIEK MODEL

`transaction-model.mjs` blijft de enige modellaag. De engine breidt haar betekenis uit zonder fysieke massaconversie.

- `accountContext`: uitsluitend aantoonbare fysieke rekeningcontext: Dion, Dara of Gezamenlijk. `financialFor`/`budgetOwner` bewijzen geen rekening. Ambigue oude `owner` levert canoniek `null` plus diagnostiek.
- Financiële bestemming: centrale `getTransactionFinancialDestination`, met de bestaande processing/budget-ownerprioriteit en legacy fallback. Deze kan van de fysieke rekening verschillen.
- Bron: manual/CSV via P1-helper. Bronidentity is importbatch + importregel, of bestaande transaction-ID.
- Bankgegevens: bestaande immutable `bankOriginal`; `transactionDate` of originele bankdatum bepaalt normale maand. Booking/processing date blijft metadata.
- Status: onbekend, nakijken, goedgekeurd, niet-meetellen via één P1-statushelper. Recognition confidence verleent geen approval.
- Classification: expliciete transactionType/processing-type gaat vóór legacy kind/categorie; sparen, refund, transfer en repayment blijven apart.
- Links: bestaande fixed/income/goal/import/replacement/pair-ID's; per split eigen fixed-occurrence-link.
- Projectie: pure afgeleide dimensies en diagnostics; geen nieuwe persistente tweede financiële waarheid.

De oude `owner`, `kind`, `expenseImpact`, reviewvelden en volledige processing-arrays blijven beschikbaar voor bestaande UI/opslag. Legacy read fallbacks vullen geen rekeningcontext in opgeslagen data in.

## C. ACTIVITY / APPROVAL

Nieuwe handmatige transacties zijn direct goedgekeurd. Nieuwe herkende CSV blijft Nakijken, onbekende CSV Onbekend, ook met hoge recognition certainty. Expliciete gebruikersactie maakt CSV actief; legacy-confirmed blijft actief zonder verzonnen approvedAt/approver.

`isTransactionFinanciallyActive` is leidend voor projectie/selectors. Niet-meetellen heeft nul effecten, blijft in bron/importhistorie en verdwijnt uit normale actieve lijsten. Gematerialiseerde siblings delen source approval: een bron met een ongoedgekeurde regel wordt niet deels financieel actief.

Heropening zet alle compacte regels van precies die source naar Nakijken. De bestaande ledger/advance/repayment-effecten worden gericht gedeactiveerd; records en bedragen blijven als historie aanwezig. Herapproval vervangt alleen die source-projectieregels en heractiveert bestaande ledgerregels, zonder rebuild/dubbeltelling. Approval-history blijft ook behouden wanneer nieuwe split-ID's ontstaan. Transferpaar wordt opnieuw voorgesteld.

Broncommands gebruiken het bestaande `commitChange`, importjournal en retry/herstelcontract. Journal-writefout blokkeert toepassing; bij details-writefout ná geslaagde corecommit wordt de toegepaste staat hersteld via journal. Een gewijzigd voorstel tijdens de journal-await wordt niet met een verouderde approval geactiveerd. Dit is gerichte source-verwerking, geen oplossing van de volledige CSV/cloud-race.

## D. FINANCIAL PROJECTION

`projectTransaction` en `selectTransactionProjections` onderscheiden `accountCashflow`, `householdCashflow`, `externalHouseholdCashflow`, `unconfirmedTransferCashflow`, `incomeImpact`, `realExpense`, `budgetImpact`, `fixedRealization` en structurele savings/refund/repayment-effecten.

Normale actieve uitgave 100: cash -100, echte uitgave 100 en budget 100. Normaal actief inkomen 100: cash +100 en income 100; geen negatieve expense. Inactieve/uitgesloten bron: alle effecten nul.

Normale maand is de werkelijke transactie-/bankdatum; import-, approval- en processingdatum verplaatsen deze niet. Voor een fixed-linked line bestaat afzonderlijk een occurrence-maand. Accountcashflow en echte uitgaven blijven in de bankkalendermaand; fixed realization en fixed-category actual gebruiken de occurrence-maand. Eén source kan dus regels met verschillende fixed-maanden hebben.

Originele bankcashflow wordt exact eenmaal per source geprojecteerd. Verwerkt bedrag kan volgens de bevestigde bestaande processingkeuze afwijken: bankcash gebruikt bankOriginal, budget/splits gebruiken verwerkt bedrag. Het verschil wordt in de bestaande importdetails zichtbaar gemaakt.

Selectors bieden actieve transacties, fysieke rekening, financiële bestemming, maand/dimensie, categoriegebruik, fixed actuals en actual income. `FinizeTransactions` ontsluit deze als compacte runtime-API. Forecast/planning en actual selectors zijn expliciet onderscheiden.

## E. FIXED EXPENSES

De P2-configuratie blijft centraal opgelost. Bestaande recurrenceberekening is zonder formulewijziging verplaatst naar `recurring-occurrences.mjs`, zodat runtime en import dezelfde geldige betaalmomenten valideren.

`fixedOccurrenceActuals` retourneert planned, som van alle actieve actuals, deviation en Betaald zodra minstens één actieve actual/split gekoppeld is. 60+20 op planned 100 geeft actual 80, deviation -20 en Betaald. Er is geen nieuwe openstaand-restbedragstatus.

Planning wordt niet gewijzigd door herkenning/approval. Alleen de al bestaande expliciete planningactie kan een planningwijziging toepassen. Een afschrijving op 1 november gekoppeld aan oktober behoudt novemberbankdatum en realiseert oktober. Fixed IDs en historische links worden behouden.

Een split kan zelfstandig fixedExpenseId/occurrence dragen. Een parent fixed-link wordt niet impliciet op een gewone andere split gekopieerd. De bestaande fixed-lastweergave toont betaaldstatus, actual en verschil binnen dezelfde kaartenstructuur.

## F. SPLITS

Parent bewaart bronidentity, fysieke rekening en bankOriginal. Processing lines hebben eigen bedrag, categorie, bestemming, type, fixed-occurrence-link en bestaande goal-link. De engine herkent al gematerialiseerde CSV-siblings en expandt hun herhaalde split-array niet opnieuw.

`validateTransactionProcessing` vergelijkt integercenten exact. Getekende -100/-50 op -150 en het bestaande UI-formaat met positieve absolute splitbedragen zijn ondersteund. Lege/null/subcentbedragen, corrupte splitstructuur, ontbrekende vereiste velden en ongeldige fixed/goal-links blokkeren approval/verwerking. BankOriginal wordt nooit passend gemaakt.

Approval blijft source-level. Complete splits op Nakijken hebben nul effecten. Na expliciete approval verschijnen ze eenmaal. Ook als de eerste processing line uitgesloten is, blijft de oorspronkelijke bankcashflow eenmaal bij de eerste actieve line beschikbaar.

## G. INCOME / INTERNAL TRANSFERS

Actual salary vervangt voorspeld salary voor de actual/forecast-maandberekening; extra income telt afzonderlijk op. Planned salary blijft configuratie. 2600 planned + 2645 actual salary + 100 extra geeft actual income 2745 en een salary-forecastcomponent 2645, geen 5245. Zonder actual salary behoudt de voorspelling haar bestaande planned salary; de actual-selector telt planning niet als werkelijk inkomen.

Een income-link naar oktoberplanning verplaatst bankinkomen van november niet. Actieve bankactuals gaan vóór een oude manual actual override. Zonder bankactual kan een bestaande expliciete handmatige actualcorrectie blijven meetellen, met provenance `manual-correction`.

Voor grandfathered salarisrows zonder persoonlijke financiële bestemming is de oude employer/bedrag-toewijzing uitsluitend als begrensde forecast-compatibilityadapter behouden. Deze wijzigt geen accountContext, financialFor of opgeslagen data; nieuwe CSV krijgt deze heuristiek niet. Actual-selectors gebruiken de canonieke bestemming.

Transfers behouden beide fysieke accountcashflows. Expliciete bevestiging controleert twee actieve source-transacties, verschillende betrouwbare rekeningen en exact tegengestelde bedragen. Detection blijft voorstel; geen automatische definitieve pairing. Bevestigde pair heeft geen externe huishoudimpact. Nog onbevestigde transfercashflow is afzonderlijk beschikbaar en telt volgens de bevestigde productkeuze niet als externe huishoudincome/expense.

Expliciete manual/CSV replacement behoudt de manual row en suppresses diens projectie met een replacement-record. CSV bronvelden winnen, veilige processingkeuzes kunnen worden gekopieerd, resultaat blijft Nakijken. Afwijkende overgenomen splits blokkeren approval. Een possible match of alleen manualMatchId is onvoldoende voor replacement. Eén manual kan niet door twee sources tegelijk vervangen worden.

## H. MIGRATIE / COMPATIBILITY

Schema blijft **v11**. Pure engine/helpers vereisen geen v12-conversie; bestaande state wordt niet opnieuw geclassificeerd of massaal herschreven. P1/P2-migratieroute, rollbackback-ups, version/revision/syncprotocol blijven bestaan.

Nieuwe persistente metadata ontstaat uitsluitend bij expliciete acties: per-split occurrence-links, goedkeurings-/source-processinghistory, replacement-status en transferbevestiging. Geen Date.now/random tijdens projectie of read-normalization. Werkelijke expliciete approval mag de bestaande actuele gebruikersactie-timestamp opslaan.

Oude opgeslagen expenseImpact blijft waar passend compatibilityinput voor gewone budgetuitgaven. Legacy owner/account fallback in rekeningrapportage bewaart bestaande uitkomsten zonder een fysieke rekening op te slaan. Onbekende velden, bankOriginal, raw bankvelden, importidentity, planning, snapshots en ledger blijven behouden.

CSV met importreferentie gaat bij bewerking naar de bestaande source-reviewmodal. CSV zonder betrouwbare source-verwijzing blijft financieel leesbaar; de handmatige edit/remove-route wordt geblokkeerd met uitleg. Voor die specifieke data is reconstructie niet uitgevoerd; zie K.

## I. GEWIJZIGDE BESTANDEN

De tabel betreft P3 bovenop de bewaarde P2-runtime. De reeds aanwezige P1/P2-wijzigingen zijn niet teruggedraaid.

| Bestand | Wijziging, reden en vervangen caller |
|---|---|
| `src/core/transaction-model.mjs` | Centrale bestemming, datum en expliciete classificatie; statuscompatibility gebruikt canonieke heropening boven legacy-confirmed. Breidt bestaande P1-laag uit. |
| `src/core/transaction-engine.mjs` (nieuw) | Pure projection/selectors, exacte splitvalidatie, fixed/income-aggregatie, pairing en replacement. Vervangt verspreide betekenisregels. |
| `src/core/transaction-processing.mjs` (nieuw) | Gerichte expliciete source-reopen/replacecommands met ledger/provenancebehoud en dependency-preflight. Vervangt per-view financiële undo. |
| `src/core/recurring-occurrences.mjs` (nieuw) | Gedeelde bestaande recurrenceprimitives voor dezelfde P2-occurrences in import en runtime. |
| `src/core/runtime.js` | Maand-/type-/impactreaders, actuals, categorieën, rekeningcontrole en inkomenskaarten consumeren engine; reviewqueue adapter, meerdere actuals, CSV editredirect/legacy guard en compacte API. |
| `src/import/runtime.js` | Canonieke verwerking, bronvelden, splitfixedlinks, source-approval/reopen/replacement via bestaand journal, pairbevestiging en validatiefouten binnen huidige modal. Herkenning/lifecycle/cloudopslag blijven bestaande architectuur. |
| `src/import/update4-runtime.cjs` | VM-testadapter laadt dezelfde gedeelde helpers en verwerkt CRLF veilig. |
| `app.js` | Reproduceerbaar opnieuw gebouwd uit bovengenoemde modules. |
| `index.html`, `service-worker.js` | Bestaande asset-/PWA-cachemarker naar v98 voor de gewijzigde runtime; geen markup/layoutredesign. |
| `tests/package3-transaction-engine.test.cjs` | 62 gerichte corecases, inclusief alle 47 aangevraagde IDs plus edgecases. |
| `tests/package3-processing-integration.test.cjs` | 7 source/journal/ledger-integratiecases inclusief opslagfouten en stale approval. |
| `tests/browser/package3-transaction-engine.spec.cjs` | 6 desktop/mobiel browserflows voor source approval, splits, fixeds, income, pairing, replacement, legacyguard en reload. |
| `tests/update3-administration.test.cjs` | VM injecteert gedeelde model/engine/occurrences; transaction actual gaat boven manual override. |
| `tests/update3-core.test.cjs` | VM injecteert dezelfde centrale transaction- en occurrencehelpers. |
| `tests/update4-1-expense-impact.test.cjs` | Centrale expense-wrapper getest met aantoonbaar bevestigde fixtures. |
| `tests/update4-4-zero-income.test.cjs` | Geen planned-as-actual; transactions/manual-correction provenance en financiële bestemming expliciet. |
| `tests/update4-stabilization-regression.test.cjs` | VM gebruikt gedeelde engine; bevestigde historische fixturestatus expliciet. |
| `tests/update4-undo.test.cjs` | Manual blijft bewaard; engine onderdrukt alleen het bevestigde duplicaat. |
| `tests/html-inline-syntax.test.cjs` | Controle van reproduceerbare runtime-assetmarker v98. |
| `tests/service-worker-cache.test.cjs` | Verwachte nieuwe cachemarker; bestaande offline veiligheidschecks behouden. |
| `tests/update4-final-regression.test.cjs` | Cachemarker v98; bestaande financiële regressies behouden. |
| `tests/update5-responsive-structure.test.cjs` | Cachemarker en centrale dashboard-income-reader; layoutcontract behouden. |
| `tests/browser/dynamic-html-security.spec.cjs` | Bestaande actieve fixturestatus expliciet; HTML-injectiecontrole behouden. |
| `tests/browser/import-review-simplification.spec.cjs` | Label Verwerkingsdatum; bestaande review/approval-interfacechecks behouden. |
| `tests/browser/modal-and-commit-stability.spec.cjs` | Goedgekeurde fixtures expliciet voor canonieke income/transfer-readers; no-op/reload/modalchecks behouden. |
| `tests/browser/update6-account-navigation.spec.cjs` | Actieve inkomensfixturestatus expliciet; rekeningnavigatie en toegangschecks behouden. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-360.png` | Beoordeelde mobiele golden image voor vervallen P2-scenarioselectie en echte actual-jaartotalen. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-390.png` | Zelfde gecontroleerde inhoudelijke baselinewijziging op 390 px; kaarten behouden. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-430.png` | Zelfde gecontroleerde inhoudelijke baselinewijziging op 430 px; kaarten behouden. |
| `README.md` | Verwijst naar centrale transactiemotor en dit verslag. |
| `docs/v50-architecture.md` | Beschrijft gedeelde engine/commands/occurrences en cache v98. |
| `docs/package-3-transaction-engine.md` | Volledig A–K-verslag met testbewijs, verschillen en de concrete legacyblokkade. |

`app.css` en alle CSS-bronnen zijn bytegelijk aan de P2-nulmeting. Package/dependencies, Firestore-regels, Firebase-configuratie en importopslagpaden zijn niet gewijzigd door P3.

## J. TESTRESULTATEN

| Test | Resultaat | Toelichting |
|---|---|---|
| T1 | PASS | manual goedgekeurd/actief |
| T2 | PASS | herkend CSV Nakijken/inactief |
| T3 | PASS | onbekend CSV inactief |
| T4 | PASS | hoge zekerheid is geen approval |
| T5 | PASS | expliciete CSV approval actief |
| T6 | PASS | Niet meetellen nul effecten, bron bewaard |
| T7 | PASS | legacy-confirmed zonder fictieve metadata |
| T8 | PASS | source heropenen deactiveert alle oude regels; repeat is stabiel |
| A1 | PASS | Dion-rekening → Dion-bestemming; cashflow -100, budget 100. |
| A2 | PASS | Dion-rekening → Gezamenlijk-bestemming; beide onafhankelijk. |
| A3 | PASS | Gezamenlijke rekening → Dion-bestemming; beide onafhankelijk. |
| A4 | PASS | Dara-rekening → Gezamenlijk-bestemming; beide onafhankelijk. |
| A5 | PASS | ambigu owner wordt geen fysieke rekening |
| N1 | PASS | normale expense heeft real/budget 100 |
| N2 | PASS | income is geen negatieve expense |
| N3 | PASS | niet-goedgekeurd alle effecten nul |
| N4 | PASS | uitgesloten alle effecten nul |
| N5 | PASS | transactiedatum voor booking/processing date |
| F1 | PASS | planned 100 actual 105 deviation 5; geen planningwrite |
| F2 | PASS | twee actuals 60+40 Betaald |
| F3 | PASS | 60+20 ook Betaald en deviation -20 |
| F4 | PASS | geen actual niet Betaald |
| F5 | PASS | bankmaand november/fixed oktober |
| F6 | PASS | alle actualtransacties tellen |
| F7 | PASS | alleen fixed splitbedrag actual |
| SP1 | PASS | signed -100/-50 sommeert exact -150 |
| SP2 | PASS | som -140 blokkeert bron -150 |
| SP3 | PASS | eigen categorie per split |
| SP4 | PASS | eigen financialFor per split |
| SP5 | PASS | fixed-link per split |
| SP6 | PASS | parent bankOriginal onveranderd |
| SP7 | PASS | complete splits Nakijken blijven nul |
| SP8 | PASS | precies eenmaal, ook gematerialiseerde legacy-siblings |
| I1 | PASS | actual salary replaces forecast salary |
| I2 | PASS | planning blijft intact |
| I3 | PASS | extra income 100 geeft 2745 |
| I4 | PASS | inkomstenlink naar oktober verplaatst november niet |
| IT1 | PASS | beide accounts behouden cashflow |
| IT2 | PASS | confirmed pair nul externe impact |
| IT3 | PASS | onbevestigd blijft apart; geen auto pairing |
| IT4 | PASS | zelfde bedrag geen automatische koppeling |
| R1 | PASS | possible match vervangt niets zonder gebruikersactie |
| R2 | PASS | bevestiging onderdrukt manual zonder verwijderen |
| R3 | PASS | CSV source fields winnen |
| R4 | PASS | processing overname behoudt categorie/splits |
| R5 | PASS | replacement altijd Nakijken |
| R6 | PASS | afwijkende overgenomen splits blokkeren approval |

Aanvullend: **62 corecases + 7 processing-integratiecases = 69 P3-Nodecases PASS**. Alle **38 Node-testbestanden PASS**, inclusief P1/P2-historie, migratie, bankOriginal, ledgers, import en cloudcontracten. Alle **94 browsertests PASS** op de uiteindelijke build, zonder automatische snapshotupdates in de eindrun.

Browserchecks omvatten Dashboard/Gezamenlijk/Dion/Dara, transactielijsten, manual invoer, Onbekend/Nakijken, expliciete approval/Niet-meetellen, splits, fixed-link/meerdere actuals, salaris, pair/replacement, eerdere maand, viewportwissel en reload. P3-flows lopen op 390 en 1440 px; bestaande responsivetests bestrijken 320–1440 px. Console/page-errors in P3-flows: geen. Reload behoudt transactions/ledger/planning/revision exact. No-op/browserbootstrap- en cloud-echo-tests voorkomen ongewenste herhaalde writes.

Testomgeving: lokaal, productie-Firebase geblokkeerd. Chrome headless met de beschikbare gebundelde Playwright 1.62.1; het project-pinned pakket 1.55.0 en packagebestand zijn ongewijzigd. Twee-devices/cloudmock-, JSON-roundtrip- en bestaande conflict/rebase-tests PASS; live productiesynchronisatie is niet getest.

Syntax PASS; CSS PASS (971 hoofdnodes, nul bekende ongedefinieerde tokens); build PASS; gegenereerde runtime byte-reproduceerbaar PASS. Alle CSS exact gelijk aan de nulmeting. Mobiel/desktop-kaartgeometrie en computed-stylecontract PASS. De drie mobiele golden images zijn handmatig op hun verschillen beoordeeld vóór bijwerken.

**Financiële baselinevergelijking**

De beschermde state is recursief vergeleken vóór/na, met de vooraf bewaarde P2-build en dezelfde input. Beide fixtures: transactions, planning/fixed/budget/income-histories, ledger, goals, closures en importreferenties EXACT gelijk. Alle Dion/Dara/Gezamenlijk-rekeningrapportages EXACT gelijk.

| Fixture | Maand | Actual income vóór → na | Real expenses vóór → na | Netto actual huishouden vóór → na |
|---|---|---|---|---|
| visual-fixture | 2026-07 | 5460 → 0 | 0 → 0 | 5460 → 0 |
| historical-backup | 2026-06 | 6224 → 0 | 584.71 → 584.71 | 5639.29 → -584.71 |
| historical-backup | 2026-07 | 8585.85 → 5335.85 | 1567.19 → 4164.83 | 7018.66 → 1171.02 |
| historical-backup | 2026-08 | 5644 → 0 | 439.22 → 452.71 | 5204.78 → -452.71 |

Historische fixture: 186 transacties vóór/na, 29 ledgerentries vóór/na, ledger effectiveAmount en opgeslagen doelbalansen 19995.89 vóór/na; actualAmount-som 9.14 gelijk. Visual fixture: 0 transacties, 6 ledgerentries en doelbalansen/effectiveAmount 36788.77 gelijk. In beide bestaande fixtures zijn nul expliciete fixed-occurrence-linked actuals: die links/actuals blijven nul; nieuwe/multiple/split-fixedrealization is aanvullend getest met F1–F7 en browserfixtures. Ongekoppelde oude fixed-transacties krijgen geen gegokte occurrence.

**Categorie A — expliciet vereiste correcties:**

1. Zonder echte inkomensactual wordt planned income niet langer als actual geteld. Dit verklaart 5460→0 (visual juli), 6224→0 (historisch juni), 5644→0 (historisch augustus).
2. In historische juli tellen actieve inkomensactuals 5335.85; de eerdere manual override/planned fallback 8585.85 wordt niet opgeteld of leidend gemaakt.
3. Actieve vaste-lastbetalingen zijn echte uitgaven: historische juli +2597.64 en augustus +13.49. Planning blijft gelijk; bedragen/bankcashflow zijn niet aangepast.
4. Fixed-category actuals tellen gekoppelde actieve betalingen in plaats van onbetaalde planned bedragen. Bij afwezigheid van links wordt actual 0, geen fictieve betaling. Afgeleide verschil/reservecijfers veranderen hierdoor. Het afzonderlijke JSON-verslag specificeert iedere gewijzigde categorie: visual juli 20; historische juni 22, juli 26, augustus 24.

**Categorie B — representatie:** source/split-groepering en afzonderlijke cashflow/household-dimensies veranderen geen opgeslagen bronbedragen. **Categorie C — regressie:** geen aangetroffen in de vergeleken fixtures en gerichte tests. De netto-huishoudkolom is actual income minus real expenses; externe-transferdimension is daarnaast afzonderlijk gedekt door IT1–IT4 en browser-pairtests.

Regressiecontrole: geen transacties/bedragen/bankOriginal/imports verdwenen of veranderd; savingsGoalLedger en opgeslagen goal balances intact; closure/snapshots intact; approval-provenance in bestaande state gelijk; geen CSV autoapproval, geen scenario teruggebracht, geen layoutredesign. Reopen/replacement veranderen effecten uitsluitend na de expliciete geteste gebruikersactie.

## K. OPEN RISICO'S EN PAKKET-4-AFHANKELIJKHEDEN

**Gestopt onderdeel: legacy CSV-herbewerking zonder sourceidentity.**

1. Blokkade: sommige oude CSV-rows hebben geen betrouwbare importBatchId/importTransactionId of parent-sourceverwijzing. Daaruit kan geen goedkeuringsgroep, immutable bronrecord of gerichte ledger-undo betrouwbaar worden gereconstrueerd.
2. Afhankelijke code: oude reviewqueue/state.transactions met sourceFile/rawData; `openJointTransactionModal`, `openPersonalTransactionModal`, transaction-remove/undo. `routeImportedTransactionEdit` bewaakt deze routes. Nieuwe sourcecommands vereisen de betrouwbare importbatch/source-ID's.
3. Minimale opties: (a) behouden als leesbare legacy-confirmed compatibiliteit en onveilige edits blokkeren — geïmplementeerd; (b) gecontroleerd koppelen aan een aantoonbaar unieke identieke originele bronregel, met expliciete provenance en migratietests; (c) volledige reconstructie oude importopslag/lifecycle, wat Pakket-5-scope raakt.
4. Aanbeveling: optie b alleen voor bewijsbaar unieke bronmatches in een later afzonderlijk geautoriseerd herstelonderdeel; anders optie a behouden. Geen heuristic account/source guessing of opslagreconstructie in P3 uitgevoerd.

Overige concrete vervolgpunten:

- Pakket 4 kan de aanwezige savings/refund/repayment-dimensies uitbreiden met savings coverage, many-to-many allocation, refundCategory/refundMonth en correcties. Bestaande savingsGoalLedger blijft het contract; nu geen coverage of historische refundcorrectie geïmplementeerd.
- Source-heropening met latere externe advance-aflossingen/uitgevoerde settlements wordt geblokkeerd vóór mutatie. Veilige expliciete correcties van die afhankelijke administratie vragen een apart contract; geen aflossingsgeschiedenis gegokt/verwijderd.
- De bekende volledige CSV/cloud-race, batch lifecycle, Terugtrekken/Verwijderen en importopslagarchitectuur blijven bestaande scope voor later. Source-journaltests bewijzen lokale commands, niet de volledige cloud-lifecycle.
- De begrensde oude salary-forecast-owneradapter blijft nodig voor ambigue grandfathered salarissen. Nieuwe transacties gebruiken expliciete bestemming; historische bestemming wordt niet heuristisch herschreven.
- Bestaande verdeling/zakgeld/spaarplanning en legacy live-snapshotvelden bevatten planningcomponenten. De actual-selectors en bankeffecten zijn gecentraliseerd; een nieuw Over-deze-maand-/closure-aggregatiebeleid is niet ingevoerd. Opgeslagen closures worden niet opnieuw berekend. Eventuele verdere vervanging vraagt de bedoelde productsemantiek, geen stille financiële correctie.
- Pure validatie kan corrupte oude processing rapporteren, maar reeds bestaande ambigue transacties zijn niet massaal geherclassificeerd. Legacy reviewqueue blijft als actieve compatibilityroute bestaan.

Pakket 4 is niet geïmplementeerd. Voor vervolg zijn de engine-dimensies/selectors, source-level approval, exacte splitcenten, immutable bronidentity en P2-monthresolver de technische aansluiting.
