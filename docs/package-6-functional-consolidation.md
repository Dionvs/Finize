# FINIZE — PAKKET 6/7

Technisch verslag A–K, 6 oktober 2026. Cumulatieve lokale werkboom bovenop P1–P5. Schema **v11 → v11**. Geen reset, productie-Firestore, push, deploy of P7.

De functionele consolidatie is geïmplementeerd. De gebruiker heeft bevestigd dat beide salarissen op Gezamenlijk binnenkomen en dat persoonlijk inkomen bestaat uit zakgeld plus persoonlijke teruggaven. Dion en Dara blijven afzonderlijke salarisbronnen; fysieke rekening en persoon voor salarisprecedence blijven strikt gescheiden. Er zijn geen open productvragen.

Verificatie: **44/44 Node-testbestanden; 373/373 geregistreerde node:test-cases**, plus assertions in bestaande script-tests. P6: 66 Node-cases (M/H/R plus 16 auditcases), 20 nieuwe browsercases op 390px/1440px. Volledige browsersuite: **136/136 PASS**. Syntax, CSS en reproduceerbare build PASS. Beide complete baselinecapturen zijn recursief exact gelijk: **categorie C = 0**. `app.css` is bytegelijk aan P5. Geen snapshots bijgewerkt.

## A. Audit + caller matrix

Gelezen/gecontroleerd: actuele repository en git status/diff, technische verslagen P1–P5 inclusief het definitieve gecorrigeerde P4-verslag, architectuur/README, bestaande unit-/browsertests, import-/cloudfacades en uitvoerende runtimes, financiële engine/model/processing, planningtimeline, migratie/ledger, closures en P1–P5-work/baseline-artifacts. De vooraf bestaande ongecommitte cumulatieve wijzigingen zijn behouden.

De actuele P5-werkboom is vóór P6 bevroren: `work/p6-baseline` bevat 179 bestanden met SHA-256-manifest. De reproduceerbare capturer `work/p6-financial-capture.cjs` opent twee datasets in afzonderlijke geïsoleerde browsercontexten: de visual fixture en de bestaande historische Firestore-export, uitsluitend als lokaal gelezen fixture. Firebase/Firestoreverzoeken zijn in deze capturer geblokkeerd. `p6-financial-before.json` / `after.json` bevatten volledige genormaliseerde state en maanduitkomsten. De oorspronkelijke export is niet geschreven.

| Function / screen | Huidige writer → reader | Canonieke service / selector | Audit en P6-actie |
|---|---|---|---|
| Manual vanuit Gezamenlijk/Dion/Dara | Accountmodals → accountkaarten | `upsertManualFinancialTransaction`, P3 projection | Gedeelde modal/veldvalidatie uitgebreid met inkomsten en fixed occurrence; context blijft fysieke rekening. |
| Oud algemeen manual formulier | `openTransactionModal` / `openGeneralTransactionModal`, eigen push/velden | Dezelfde contextmodal en command | Twee onafhankelijke formulierimplementaties vervangen door adapters; normale invoer heeft geen ownerselector. |
| Manual edit | Oude accountmodal en transaction-ID lookup | Dezelfde upsert + `assertManualCandidateSafe` | ID/unknown fields behouden; geen remove/recreate; centrale preflight inclusief nested clone. |
| Desktop transactietabel | `renderTransactionsTable` | `selectActiveTransactions({month,account})` | Financiële eigenaarfilter/expense-only selectie vervangen; tabelrij krijgt bestaande editlistener, ook toetsenbord. |
| Mobiele accountlijsten / recent lijst | `renderJointTransactionsCard`, `renderPersonalTransactionsCard`, recent wrapper | Dezelfde fysieke-accountselector | Alle actieve bankbewegingen; geen eigen statusfilter. |
| Categorie-detail | `openBudgetTransactionsModal` | Financiële owner/categorie-projecties | Blijft financiële bestemming gebruiken, niet fysieke rekening; edit zoekt stabiel ID. |
| Expensecategorieën manual | `jointVariableCategoryOptions`, `bankOwnerCategories` | `expenseCategoriesForMonth` → P2 budgetresolver | Geen tweede hardcoded catalogus; geselecteerde transactiemaand + Overig. |
| CSV categorie/type-presentatie | `categoryOptions`, `INCOME_TYPES` | Dezelfde categoryreader/income-typeconstante | Importprocessor, approval, batch lifecycle en cloudprotocol blijven P5. |
| Budget add/edit/remove | Bestaande owner-variable editor | `setBudgetForMonth`, `resolveVariableBudgetsForMonth` | P2 from/once-service al correct; geen alternatieve writer toegevoegd. |
| Fixed add/edit/remove | `u3OpenRecurringEditor` | `setRecurringFromMonth`, `endRecurringFromMonth`, centrale occurrences | Bestaande historische versieproperties/IDs/actual links behouden. |
| Inkomstenbron planning | `u3OpenRecurringEditor`, `u3OpenPlanning` | `setIncomeSourceForMonth`, `endIncomeSourceFromMonth` | Planning-only reader; from/once/end standaard salaris gekoppeld aan bestaande planninghistory, geen actuals. |
| Persoonlijk gepland salaris | `openIncomeEditModal`, totalincome-editor | `setPlannedIncomeFromMonth` | Edit leest planning en bewaart vastgelegde editmaand; verwijdert persoonlijke dashboardoverride niet meer. |
| Handmatig dashboardsalaris / totalactual override | Bestaande maandoverride-/administratieroute | P4 salary precedence / actual-income compatibility | Nul behouden; onverdeelde actual niet over personen verdeeld; future administratieve actual geblokkeerd. |
| Gezamenlijke/persoonlijke spaarplanning | Bestaande savings editors | `setSavingsPlanForMonth` | Expliciet geselecteerde maand, nul geldig; uitsluitend die maand conform gebruikersantwoord. |
| Sparen/refund/coverage/correctie | Bestaande P4 UI/commands | P3/P4 engine + ledger/preflight | Conditionele velden gedeeld; geen nieuwe spaarcalculator of ledgerreconstructie. |
| CSV edit/reopen/batch/cloudconflict | Bestaande P3/P5 source commands | ImportStore/CAS/journal/generations/receipts | Ongewijzigd; normale lijsten sturen CSV terug naar bronverwerking. |
| Legacy reviewqueue | `u3OpenReview` → opgeslagen CSV compatibility | P1/P3 account/status/projection adapters | Niet verwijderd: actieve legacydata/callers; geen tweede manual formulier. |
| Dashboard/account Over deze maand/zakgeld | `calcScenario`, `monthlyFinancialForecast`, U3 wrappers | `financialForecastForMonth` + P2 planning + ledger | Centrale engine ongewijzigd; oude namen zijn wrappers, geen Voor/Na-branching. |
| Maandselector/future | Bestaande geselecteerde maand | Centrale month readers | History/future planning gecontroleerd; nieuwe manual future geblokkeerd. |
| Closures | Expliciete close/reopen/correctie | Bestaande `monthRecords`/locks | Geen wijziging; normale transactiedatum in gesloten maand vraagt bestaande reopen/correctie. |

Belangrijkste oude afwijkingen: algemene manualformulieren hadden eigen directe statewrites en categorielijsten; manual modals ondersteunden geen gewone inkomsten/fixed link; standaarddatum kon een onmogelijke/toekomstige kalenderdag zijn; accountlijsten filterden op financial owner en soms uitsluitend expenses; desktoprijen hadden geen dezelfde edittoegang als mobiel; inkomstenplanning kon een expliciete persoonlijke dashboardoverride wissen; “alleen deze maand” in de uitgebreide salarisplanning schreef een dashboardoverride; een gestopte standaard salarisbron kon via scalar salary fallback financieel blijven voorspeld worden.

Die laatste salarisgevallen worden uitsluitend door nieuwe expliciete planningcommands gecorrigeerd. Bestaande opgeslagen oude bronnen worden bij lezen niet heringedeeld. Bestaande compatibele vrije categorievelden in de legacy reviewqueue zijn geen nieuwe categoriecatalogus en zijn niet verwijderd.

## B. Manual transaction consolidation

Eén veldcontract, één validatiecontract, één commandroute. Desktopmodal en mobiele fullscreen-presentatie behouden bestaande classes, kaarten en layout. Basisset: datum, positief bedrag in exacte centen, type/richting, omschrijving, categorie waar relevant, notitie. Conditioneel: inkomenstype en inkomstenbronlink, fixed occurrence inclusief afzonderlijke occurrence-maand, savings goal, refundCategory/refundMonth. Geen manual split, geen nieuwe fysieke eigenaarselector, geen Onbekend/Nakijken.

`validateManualTransactionInput` wordt door create én edit aangeroepen. Hij controleert betrouwbare accountContext, kalenderdatum inclusief schrikkeljaar, datum ≤ lokale vandaag, exact-centbedrag, type, actieve budgetcategorie voor bankmaand/destination, relevante fixed/goal/refund/income-links, bestaande maandlocks en replacement/advance-dependencies. Nieuwe manual wordt direct goedgekeurd via `markManualTransaction`.

Bij edit blijven ID, unknown fields, bestaande audit/provenance, fysieke rekening en financiële bestemming behouden. Expliciete date/transactionDate-writes worden consistent gehouden; contradicties worden geblokkeerd. Redundante nested processingvelden volgen expliciete manual edits. Afwijkende legacy processedAmount/accountDelta/expenseImpact worden niet stil herberekend: de command blokkeert met concrete diagnostiek. Nieuwe IDs/timestamps ontstaan alleen bij expliciete invoer, nooit bij read/render.

Een bestaande cross-destination-transactie blijft cross-destination. `financialFor` wordt nooit als bewijs voor accountContext gebruikt. Een legacy transactie zonder betrouwbare fysieke rekening blijft leesbaar waar de bestaande compatibilityroute dit ondersteunt, maar kan niet via een gegokte accountcontext bewerkt worden.

## C. Category consolidation

`expenseCategoriesForMonth(state, month, owner, {existingCategory})` leest de actieve P2 budgetregels, gebruikt post/categorie, dedupliceert labels en levert Overig als fallback. Manual en CSV-presentatie gebruiken deze reader. Inkomstenclassificaties gebruiken de gedeelde `INCOME_TRANSACTION_TYPES`-constante; er is geen zelfstandig expense-categorymodel.

Nieuwe gewone manual expenses valideren strikt tegen de categorieën van hun transactiemaand. Een verwijderde categorie verschijnt nog op bestaande historische transacties. Een ongewijzigde bestaande legacycategorie mag bij een veilige edit behouden blijven; die uitzondering wordt niet aan nieuwe transacties doorgegeven. Datumwisseling herleest de juiste maandcategorieën. Historische refunds blijven de P4 herkenbaarheid van hun expliciete correctiemaand gebruiken.

Fixed/savings/refund zijn processingclassificaties, geen tweede expensecategoriecatalogus. Importvoorstellen en opgeslagen legacyclassificaties behouden hun bestaande P3/P5 compatibility; P6 voegt geen andere CSV-approvalwaarheid toe.

## D. Budget/fixed/income historical planning

Budgetten: bestaande `budgetDefaultsHistory` / maandoverride, meest recente effectiveFrom ≤ maand. Add/edit/remove blijft geselecteerde-maand from/once. Remove schrijft een latere categorieconfiguratie zonder oude transacties/categorieactuals te verwijderen.

Fixed: bestaande `amountHistory.config` en `monthOverrides`, `validFrom` inclusief en `validUntil` exclusief. Alle relevante properties worden via centrale resolver gelezen. Nieuwe/gewijzigde planning muteert geen actual, occurrence-link of bankOriginal. End behoudt een eerder opgeslagen end-boundary; een latere beëindiging mag een historische inactieve periode niet heropenen.

Income: uitgebreide broneditor leest `resolveIncomeSourcesForMonth(...,{planningOnly:true})`. `setIncomeSourceForMonth` en `endIncomeSourceFromMonth` gebruiken dezelfde P2 versieprimitives. Standaard salaris: from-edit synchroniseert de bestaande persoonlijke `incomeDefaultsHistory`; once-edit schrijft bestaande recurring monthOverride met `incomePlanningOverride`; een expliciete stop wordt via `incomeTimelineCommands` in de planningreader gerespecteerd. Een latere expliciete herstart is een nieuwe versie; oudere actieve/inactieve periodes blijven behouden. Dit zijn v11-compatible opt-in writevelden, geen nieuwe migratie of parallel timeline.

Persoonlijke `monthlyIncomeOverrides` blijven onafhankelijke expliciete dashboardkeuzes. Een planningedit wist die niet. Nul blijft geldig; een werkelijk salaris behoudt voorrang volgens P4. Overige inkomstenbronnen blijven historische configuratie; P6 introduceert geen nieuwe forecastfallback voor niet-salarisinkomen.

Spaargeldplanning blijft **alleen de geselecteerde maand**, zoals expliciet beantwoord. `setSavingsPlanForMonth` maakt geen transacties en verlaagt geen goalsaldi; alleen echte spaartransacties of expliciete ledgercorrecties wijzigen daadwerkelijk gespaard geld.

## E. Historical/future month behavior

Geselecteerde maand wordt expliciet doorgegeven aan budget/fixed/income/category/forecastreaders. Transactiedatum bepaalt bankmaand; fixed realization behoudt P3 occurrence-maand; refund correctiemaand blijft P4; coverage behoudt bankkalendermaandregels.

Future planning is bereikbaar via dezelfde editors. Nieuwe future manual invoer is vóór opening/opslaan geblokkeerd; de importknop blijft bereikbaar omdat P5 individuele rowdates beoordeelt. Future administratieve actual-income-write is geblokkeerd. Geen toekomstige planning wordt als actual opgeslagen.

Browserbewijs op beide breedtes: januari 2027 budget 600/fixed150/salary3300; september blijft budget500/fixed100/salary3000. Transactieaantal blijft nul; maandwissel en reload behouden dit. Een historische handmatige transactie gebruikt categoriehistorie van zijn bankmaand, ongeacht de nu getoonde maand.

## F. Transaction lists + edit/reopen

Normale accountlijsten gebruiken `selectActiveTransactions(state,{month,account})`. Fysieke rekening bepaalt plaatsing; budgetdetails blijven financial owner gebruiken. Manual approved, inkomsten, refunds, savings en interne transfers verschijnen als hun fysieke beweging. Onbekend/Nakijken/Niet meetellen/withdrawn/deleted verschijnen niet als actieve gewone transactie.

Splits behouden de bestaande P3 identity/materialization/projectie. De weergavebedragen tonen het signed verwerkte lijnbedrag; originele bankcashflow blijft in de centrale sourceprojectie. Geen tweede financiële telling toegevoegd. “Totaal uitgaven” onder de rekeninglijst leest gross `realExpense` voor dezelfde fysieke rekening, op desktop en mobiel. Categorieactuals blijven netto budgetImpact.

Desktoptabelrijen openen nu dezelfde bestaande editor als de mobiele rijen, met Enter/Space en zonder delete-knopclicks als edit te behandelen. Normale CSV edit/remove routeert naar P5 source UI; onbetrouwbare legacy CSV behoudt de bestaande safety guard.

Manual wijzigingen worden eerst op een clone gevalideerd. Daarna volgt de bestaande commitbeveiliging met dezelfde command. Coverage overflow/maandconflict, negatieve goal, refund overflow, confirmed transferconflict en gekoppelde voorschot/aflossing/replacement kunnen vóór mutatie blokkeren. Geen silent clipping/remapping of dependencydelete. Manual delete gebruikt dezelfde aanvullende preflight. CSV reopen/reapproval/withdraw/restore/delete gebruiken ongewijzigde P3–P5 commands.

## G. Dashboard/account selectors + mobile/desktop parity

De P3/P4 engine is niet aangepast. `monthlyFinancialForecast` en `calcScenario` blijven adapters op één `financialForecastForMonth`. Hun actuals, forecast.household, allowanceBasis, zakgeld en buffers zijn afzonderlijke outputs van dezelfde engine. P6 wijzigt die formule niet.

Zakgeld blijft 100% historische geplande fixed/variabele budgets/gezamenlijke savings reserveren. Actual0/300/400/700 bij budget500 houdt reserve500; savingsactual0/250/300 bij plan250 houdt reserve250; fixedplan100/actual105 houdt reserve100, actual105/deviation5. Refund, coverage, unused withdrawal en CSV lifecycle veranderen geen zakgeldreserves. Werkelijke cashflow/actuals/buffers bewegen wel. Salary precedence actual > persoonlijke manual override (nul geldig) > historische planning blijft.

Persoonlijke/gezamenlijke totalen, categorieactuals, fixed actuals en Over deze maand blijven centrale selectors gebruiken. De gewijzigde accountlijstplaatsing en gross listfooter zijn presentatie van bestaande account/gross dimensies, geen financiële herclassificatie. Beide breedtes gebruiken dezelfde command/categoryreader/defaults/preflight. Geen aparte mobiele calculator of UI-unificatie/redesign.

Beide salarissen worden fysiek op Gezamenlijk ingevoerd. De bestaande standaardplanning legt dit al vast (`rekening: gezamenlijk`, `eigenaar: dion/dara`). De gezamenlijke manual flow biedt nu beide betrouwbare salarisbronnen. Een expliciet gekozen bron bepaalt voor een nieuwe transactie wiens actual salaris het is, terwijl accountContext gezamenlijk blijft. Bij ongewijzigde historische links wordt de financiële bestemming niet automatisch heringedeeld. Salaris is alleen zichtbaar in de gezamenlijke fysieke transactielijst; de persoonlijke actual-salarisselector blijft de bestaande per-persoon precedence leveren.

De persoonlijke inkomenskaart gebruikt in zowel zelfstandige als ingelogde modus hetzelfde zakgeld zonder verrekening/verkleining. Persoonlijke actieve receipts/teruggaven staan daarnaast; joint-account receipts worden niet als persoonlijk ontvangen inkomen gepresenteerd alleen vanwege financialFor. P4-teruggavecompatibility blijft behouden. Een persoonlijke refund van €30 verhoogt de getoonde kaarttotaal met €30 zonder zakgeld, actual income of engineformules te wijzigen. Dit is een presentatiecorrectie; geen nieuwe bankbeweging of ledgerregel.

## H. Compatibility / P5 protection / closures

Schema blijft v11; geen migrateState-wijziging, massamigratie, reconstructie of schema-v12. Nieuwe opt-in planningmetadata wordt alleen bij een expliciete income-planningactie geschreven. Clone/validate/commit blijft de bestaande route; onbekende velden behouden. Normale loads genereren geen nieuwe ID, ledgerregel of migratiewrite.

Ongewijzigd tegenover P5: ImportStore/import-sync/cloud-state facades, versioned batchdetails, sourceIdentityProof, immutable generations, CAS/baseVersion, operation receipts, journal/recovery, householdscoping, conflictkeuze, meerdere open batches, partial approval, duplicateproof, future row errors, withdraw/restore/delete en technisch deletion proof. In `src/import/runtime.js` zijn uitsluitend category/type-readers voor presentatie geconsolideerd.

Ongewijzigd: bankOriginal, imported sourcegegevens/IDs/processing/approvals, replacements/pairs, planning histories bij alleen lezen, savingsGoalLedger/goals/allocations, advances/repayments, closures/snapshots. Bestaande saved closures worden niet live herberekend of herschreven. Bestaande locks/reopen/correctie blijven. Compatibele legacy helpers/queue/globals blijven waar data/tests/callers daarvan afhangen.

## I. Gewijzigde en verwijderde bestanden

De lijst is P6 relatief aan de bevroren P5-werkboom, niet Git HEAD.

| Bestand | P6-wijziging / reden / vervangen caller |
|---|---|
| `src/core/planning-timeline.mjs` | Centrale categoryreader/month-only savings writer; planning-only income reader; gedeelde income from/once/end commands; persoonlijke dashboardoverride behouden; eerdere end-boundary respecteren. Oude directe income/savings-writers vervangen. |
| `src/core/transaction-model.mjs` | Gedeelde income-typeconstante voor manual/import-presentatie; geen andere model/status/migratiewijziging. |
| `src/core/transaction-processing.mjs` | Zelfde manual create/edit-validatie en clonepreflight; date/processingconsistentie; fysieke context en dependencies bewaken; unknown/provenance behouden. |
| `src/core/runtime.js` | Twee oude manualimplementaties vervangen door contextadapters; gezamenlijke manual create/edit conditional fields; fysieke actieve lijsten en signed lijnbedragen; centrale gross footers; expliciete salarisbronkeuze op Gezamenlijk; persoonlijke inkomenspresentatie zonder salaris/zakgeldverlaging; desktop editlistener; captured planningmaand; centrale savings/income writers. |
| `src/import/runtime.js` | Categoryreader en income-typeconstante gedeeld; geen importwriter/sync/lifecycleverandering. |
| `app.js` | Gegenereerde runtime opnieuw gebouwd uit sources; byte-reproduceerbaar. |
| `index.html`, `service-worker.js` | Alleen cache/assetmarker `101-functional-consolidation`; bestaande PWA/offline/securitygedrag behouden. |
| `tests/package6-functional-consolidation.test.cjs` | 66 gerichte P6-/auditcases met vaste IDs en expliciete today. |
| `tests/browser/package6-functional-consolidation.spec.cjs` | 20 nieuwe cases, twee breedtes, alle U-ID’s + history/future/reload, twee gezamenlijke salarissen met persoonlijke precedence, persoonlijke refund zonder vermindering van zakgeld. |
| `tests/package4-allowance-planning-correction.test.cjs` | De bestaande month-end fixture gebruikt expliciete test-today 31 oktober; financiële assertions ongewijzigd. |
| `tests/package4-savings-refunds-forecast.test.cjs` | Cross-destination fixture geeft actieve categorie; bestaande legacy raw manual split wordt als opgeslagen compatibilitydata ingevoerd, niet als verboden nieuwe manual split. Oude financiële assertions behouden. |
| `tests/browser/dynamic-html-security.spec.cjs` | XSS-fixture bevat expliciete manual rekeningcontext zodat de normale fysieke lijst hem toont; alle securityassertions behouden. |
| `tests/browser/modal-and-commit-stability.spec.cjs` | Gemeenschappelijke modaltitels/veldlocator; backdropcheck start in expliciete Dion-context; persoonlijk inkomenskaartcontract volgt expliciete gebruikersbevestiging: zakgeld, geen salaris; extra inkomenfixture bevat betrouwbare fysieke context. |
| `tests/browser/update6-account-navigation.spec.cjs` | Extra-inkomenfixture heeft expliciete fysieke Dion-context; geen rekeningheuristiek, desktop/mobile dezelfde bronnen. |
| `tests/service-worker-cache.test.cjs`, `tests/html-inline-syntax.test.cjs`, `tests/update4-final-regression.test.cjs`, `tests/update5-responsive-structure.test.cjs` | Exacte cachemarkerassertion bijgewerkt; geen versoepeling. |
| `README.md`, `docs/v50-architecture.md`, dit verslag | P6-routes/contracts/cachemarker/verificatie en bevestigde salarisrekening vastgelegd. |

Geen bestand verwijderd. Alleen de twee onafhankelijke oude manualformulierbodies zijn vervangen; hun publieke functionnamen blijven adapters. Bereikbare legacyqueue, exported helpers, scenario-genaamde baselinewrappers en andere compatibilitycode zijn niet “voor de netheid” verwijderd. `renderRowsTable` heeft geen actieve productcaller, maar is in deze ronde ook niet verwijderd: daar is geen functionele noodzaak voor.

`app.css`, stijlbronnen, kaarten, navigatie, spacing/kleuren/responsive layout, Firestore rules en syncprotocol zijn P6-ongewijzigd. Eventuele Git-diff daarin hoort bij de vooraf aanwezige P1–P5-werkboom.

## J. Tests + baseline A/B/C

| Test | Resultaat | Controle |
|---|---|---|
| M1 | PASS | Dion-context |
| M2 | PASS | Dara-context |
| M3 | PASS | Gezamenlijk-context |
| M4 | PASS | financialFor verandert accountContext niet |
| M5 | PASS | expense debit |
| M6 | PASS | income credit |
| M7 | PASS | vandaag geldig |
| M8 | PASS | verleden geldig |
| M9 | PASS | future vóór mutatie geblokkeerd |
| M10 | PASS | actieve budgetcategorie/Overig |
| M11 | PASS | verwijderde categorie niet nieuw selecteerbaar |
| M12 | PASS | direct approved |
| M13 | PASS | geen manual reviewstate |
| M14 | PASS | geen nieuwe manual split |
| M15 | PASS | edit dezelfde validatie + stabiel ID |

| Test | Resultaat | Controle |
|---|---|---|
| H1 | PASS | budget from geselecteerde maand |
| H2 | PASS | eerdere maand gelijk |
| H3 | PASS | future budgetplanning |
| H4 | PASS | budget remove vanaf maand |
| H5 | PASS | historische categorie/transactie behouden |
| H6 | PASS | fixed property edit from maand |
| H7 | PASS | oude fixed configuratie gelijk |
| H8 | PASS | fixed actual intact |
| H9 | PASS | fixed toekomst beëindigen |
| H10 | PASS | planned income from maand |
| H11 | PASS | actual salary intact |
| H12 | PASS | historisch salaris gelijk |
| H13 | PASS | future planning zonder actual |
| H14 | PASS | historische refundcategorie |
| H15 | PASS | expliciete geselecteerde maand |

| Test | Resultaat | Controle |
|---|---|---|
| U1 | PASS | desktop gedeelde manual flow |
| U2 | PASS | mobile gedeelde manual flow |
| U3 | PASS | zelfde veldcontract |
| U4 | PASS | zelfde categorysource |
| U5 | PASS | zelfde validatie |
| U6 | PASS | zelfde financial output |
| U7 | PASS | dashboard centrale forecast |
| U8 | PASS | Dion fysieke/centrale selector |
| U9 | PASS | Dara fysieke/centrale selector |
| U10 | PASS | Gezamenlijk fysieke/centrale selector |
| U11 | PASS | activity in transactionlijst |
| U12 | PASS | withdrawn niet normaal zichtbaar |
| U13 | PASS | Niet meetellen niet normaal zichtbaar |
| U14 | PASS | refund geen gewoon income |
| U15 | PASS | savings geen gewone expense/income |

| Test | Resultaat | Controle |
|---|---|---|
| R1 | PASS | accountContext/destination gescheiden |
| R2 | PASS | bankOriginal/read pure |
| R3 | PASS | CSV geen autoapproval |
| R4 | PASS | partial batches |
| R5 | PASS | duplicateproof vereist |
| R6 | PASS | replacementmetadata behouden |
| R7 | PASS | fixed occurrence-maand |
| R8 | PASS | actual income bankmaand |
| R9 | PASS | savings goal/ledger |
| R10 | PASS | coverage |
| R11 | PASS | refund |
| R12 | PASS | internal transfer |
| R13 | PASS | volledige budgetreserve |
| R14 | PASS | volledige savingsreserve |
| R15 | PASS | fixed plan100 actual105 reserve100 |
| R16 | PASS | buffers volgen actuals |
| R17 | PASS | closures gelijk |
| R18 | PASS | P5 stale conflict |
| R19 | PASS | P5 deletion proof zonder payload |
| R20 | PASS | schema v11/JSON |

| Test | Resultaat | Controle |
|---|---|---|
| A1 | PASS | kalender/centvalidatie |
| A2 | PASS | ambigu legacy account niet gegokt |
| A3 | PASS | coverage overflow edit atomair geblokkeerd |
| A4 | PASS | confirmed transferedit geblokkeerd |
| A5 | PASS | advance edit/remove guard |
| A6 | PASS | month-only savings/expliciete nul |
| A7 | PASS | salaryplan behoudt dashboardnul |
| A8 | PASS | once salaris is planning |
| A9 | PASS | salary stop/herstart/inactieve gap |
| A10 | PASS | legacycategorie veilige edit |
| A11 | PASS | lifecycle actuals versus allowance |
| A12 | PASS | redundante datum/processingconsistentie |
| A13 | PASS | tegenstrijdige datums geblokkeerd |
| A14 | PASS | overige inkomstenbron property/ownerhistory |
| A15 | PASS | standaard salaris ownerconflict guard |
| A16 | PASS | nested processing onveranderd na ongeldige edit |

**Aanvullende browsercontroles na salarisbevestiging:** beide joint salarisbronnen kiezen, accountCashflow gezamenlijk €5.200 / persoonlijk €0, actual salaris Dion €3.100 en Dara €2.100, persoonlijke lijsten bevatten geen joint salaries, persoonlijke inkomenskaart bevat Zakgeld zonder Salaris, reload identiek. Persoonlijke refund €30 geeft kaarttotaal +€30 met identiek Zakgeld/allowanceBasis en actualIncome €0. Beide controles PASS op 390px en 1440px. De eerste salarisfixture miste verplichte amountHistory; de test bevat nu volledige geldige P2-planning en assert expliciet dat fixturecommit slaagt. Geen productvalidatie of assertion versoepeld.

**Volledige regressie:** 44/44 Node-testbestanden, 373 geregistreerde node:test-cases PASS; daarnaast bestaande scriptassertions. P1/P2/P3/P4/P5 blijven groen; P5 92/92 cases. P6 66 Node-cases en 20 nieuwe browsercases. Volledige browser 136/136 PASS, nul skips/flaky cases. Syntax/CSS/build/check-generated PASS. CSS SHA-256 gelijk aan P5; bestaande responsive/visual snapshots zonder updates PASS.

De bestaande suites dekken ook cloudmock/device A→B/B→A, stale revisions/conflict, versioned headers/details/receipts, listener echo, journal interruption/recovery/retry, JSON roundtrip, migration/back-up/load-no-write, PWA/offline, veiligheid en dynamische HTML. De tests gebruiken geïsoleerde fixtures/mocks; er is niet met een ingelogd productiehuishouden getest.

Voor de nieuwe browserflows worden pageerrors/consoleerrors gecontroleerd, datum/preflightfouten inline verwacht, fysieke plaatsing en forecast gelijk vergeleken op 390/1440px. Reload bewaart state/revision/planning/ledger; viewportwisseling schrijft niet. Bestaande modal-/lijstfixtures zijn waar nodig bijgewerkt met betrouwbare fysieke context; het oude zelfstandige persoonlijke salarislabel is conform de expliciete gebruikersbevestiging vervangen door zakgeld (zie I). Geen financiële assertions, toleranties of snapshots zijn automatisch gewijzigd om fouten te maskeren.

**Baseline zonder P6-useraction:** volledige genormaliseerde state, transacties/bankOriginal, import/lifecycle/deletion proofs/processing/replacement/pair data, planning/budget/fixed/income history, goals/ledger/allocations/refunds/advances/closures zijn recursief exact gelijk. Alle captured actual income, gross expenses, category/budget actuals, fixed actuals, fysieke account/householdcashflow, forecast.household, allowanceBasis, zakgeld en buffers eveneens exact gelijk.

| Dataset / maand | Transacties dataset | Dion zakgeld | Dara zakgeld | Huishoudelijk beschikbaar | Gezamenlijke buffer |
|---|---:|---:|---:|---:|---:|
| Visual fixture / juli 2026 | 0 | 1166,58 | 1433,23 | 1788,97 | 500,00 |
| Historische fixture / juni 2026 | 186 | 1189,92 | 1300,36 | 930,49 | 754,00 |
| Historische fixture / juli 2026 | 186 | 1086,27 | 2660,60 | 1841,94 | 9,92 |
| Historische fixture / augustus 2026 | 186 | 876,42 | 1233,86 | 930,29 | 854,00 |

Deze cijfers zijn vóór/na identiek. Actual income historisch juni/juli/augustus: 0 / 5335,85 / 0; realExpense: 584,71 / 4164,83 / 452,71. Historische ledger: 29 entries, inhoudelijk gelijk. De volledige capturen zijn de reproduceerbare bewijzen, niet alleen deze samenvatting.

Classificatie zonder actie: **A = 0; B = 0; C = 0** voor captured persistente/financiële uitkomsten. Bewuste P6-interactioncorrecties (A): fysieke accountlijstplaatsing; normal income/savings/refund/fixed zichtbaarheid; gross accountlistfooter; future/invalid/manual-split rejection; historische planningwrite vs dashboardoverride scheiding; expliciete salary stop/herstart; expliciete bronkeuze voor joint salaris; persoonlijke inkomenskaart toont zakgeld plus eigen receipts/teruggaven zonder salaris of automatische zakgeldverlaging. Representatie (B): gedeelde modalnaam/velden en cachemarker. Geen nieuwe financiële engineformule; geen ongeautoriseerde categorie-C-correctie.

## K. Open risico’s / concrete P7-dependencies

1. **Salarisrekening bevestigd, geen open vraag.** Beide salarissen komen op Gezamenlijk. `eigenaar` bij de standaardbron identificeert de persoon voor persoonlijke salarisplanning/precedence en wordt niet naar gezamenlijk omgezet. De guard tegen het verwisselen van Dion/Dara standaardbronnen blijft als identitybeveiliging (A15); hij blokkeert geen keuze voor de gezamenlijke rekening. Geen heuristische verdeling van een ongekoppeld of onverdeeld inkomenstotaal.
2. **Legacy zonder betrouwbare fysieke account/sourceidentity.** P1/P3/P5 adapters/safety guards behouden. De historische fixture bevat 44 onzekere fysieke contexten. Niet op financialFor gegokt. Onveilige edits/removals blijven geblokkeerd; provenanceherstel vereist bewijs, geen heuristiek.
3. **Legacy manual splits / afwijkende cash/impact/processingvelden.** Bestaande data blijft leesbaar; nieuwe manual split of onveilige edit wordt geweigerd. Geen reconstructie/dependencydelete. Eventuele herstelworkflow valt buiten deze consolidatie.
4. **Bestaande closures en oudere live/snapshotverschillen.** `monthRecords`, close/reopen/correctie blijven ongewijzigd. Geen snapshotrebuild of nieuw lockbeleid. Eventueel later onderzoek moet expliciete historische contracten bewaren.
5. **Legacy reviewqueue/compatibilitywrappers blijven actief of exported.** Geen aantoonbaar veilige volledige uitfasering zonder datamigratie; behouden. P7 kan callerbewijs uitbreiden, niet impliciet stored identity reconstrueren.
6. **Overige planned income en bestaande geplande teruggaven.** Configuratie blijft via timeline; P4 forecast behoudt bestaande salarisfallback/teruggavecompatibility. Geen nieuwe forecastregel voor aanvullende geplande inkomsten in P6 verzonnen.
7. **P7 uitsluitend technische verificatie/afwerking na afzonderlijke opdracht.** Geen P7 geïmplementeerd. P5 cloud/lifecycle/security, P4 allowance/savings/refund/coverage en P2 timeline vormen verplichte regressieafhankelijkheden. Echte productie-sync/deploy is niet uitgevoerd en is geen bewijsclaim in dit verslag.

Alle gevraagde P6-wijzigingen zijn concreet geïmplementeerd en lokaal getest. Er zijn geen andere open productvragen gevonden. Productie-Firestore niet geraakt; niets gepusht of gedeployed.
