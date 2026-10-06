# FINIZE — PAKKET 4/7 — technisch opleveringsverslag

Bijgewerkt na de zakgeldcorrectieronde op 6 oktober 2026. Dit verslag vervangt de eerdere P4-oplevering. De laatste gebruikersbeslissing is leidend: zakgeld wordt op maandplanning bepaald; realisatie, overschrijding, onderschrijding, refunds en spaardekking veranderen dat bedrag niet. De expliciet bevestigde inkomstenprecedence blijft behouden.

## A. INVENTARISATIE

De audit en P3-baseline zijn vóór P4-wijzigingen vastgelegd in `work/p4-baseline`, `work/p4-financial-before.json` en de geïsoleerde baselinecapturer. De baseline bevat de bestaande visuele fixture en een lokaal gelezen historische back-up. Er is geen productie-Firestore benaderd. De vergelijking gebruikt genormaliseerde P3-state als uitgangspunt; bestaande P1/P2-migraties zijn daardoor niet ten onrechte als P4-wijziging geteld.

| Route / opslag | Writers | Readers / bestaande betekenis |
|---|---|---|
| Spaardoelsaldo / subdoelen | `u2SetGoalSavedAmount`, doelbewerker, bestaande subdoelbewerkers | `calculateGoalSavedAmount`, `reconcileGoalSavedAmounts`, `u2GoalSaved`, mobiele/desktop doelkaarten. Saldo is ledgergedreven; oude reconciliatie kon saldo boven de subdoelcapaciteit afkappen. |
| `savingsGoalLedger` | handmatige correctie, geplande maandinleg, importplan, source undo/reopen | `contributionAmount`, doelhistorie, live maandresultaat. Bronnen: `legacy-opening`, `manual-correction`, `planned`, `bank-import`, `bank-match`. Geplande entries hebben geen werkelijk saldofinancieel effect. |
| Spaartransacties | contextmodals, CSV-processing lines / materialized splits | P3 kende `sparen`, `naar-spaarrekening`, `van-spaarrekening` structureel; importledger behandelde niet alle richtingen gelijk. |
| Refunds / terugbetaling | handmatig formulier, CSV-typekeuze/splits | structurele P3-classificatie; er was geen centrale historische categoriecorrectie. Bestaande voorschotaflossing `terugbetaling-voorschot` is afzonderlijk gebleven. |
| Budgetten / categorieactuals | historische P2-configuratie en transactieprocessing | `sumTransactions`, `categoryActuals`, `u3BudgetSummary`, budgetdetail. Voor P4 ontbraken expliciete coverage en refundcorrectiedimensies. |
| Dashboard / Over deze maand / zakgeld | uitsluitend live readers; expliciete maandafsluiting slaat snapshot op | `calcScenario` als behouden functienaam zonder scenarioselectie, persoonlijke/joint kaarten, `u3LiveFinancialSnapshot`. De eerste P4-versie gebruikte ook voor zakgeld actuele reguliere belasting. De correctieronde heeft die interpretatie vervangen door volledige maandreservering, met behoud van de actuals en actuele huishoudprognose. |
| Advances / repayments | bestaande advanceLedger / advanceRepayments en importundo | behouden afzonderlijke P3-administratie en dependencychecks; geen gebruik voor spaardekking/refunds. |
| Source approval / reopen / undo | P3-sourcecommands, importjournal/commit | source-level approval, legacy-confirmed adapter, immutable bankOriginal. Extra P4-afhankelijkheden moesten vóór mutatie worden gevalideerd. |
| Closures / snapshots | expliciete afsluit-/correctieactie | opgeslagen closure wordt gelezen; live berekening mag opgeslagen financiële inhoud niet overschrijven. |

Persoonlijke en gezamenlijke spaarflows gebruiken dezelfde corefuncties. Er is geen apart mobiel financieel pad toegevoegd. Bestaande geplande belastingteruggaven en voorschotsemantiek zijn compatibility gebleven; aankooprefunds zijn een afzonderlijke transactiedimensie.

Aangetroffen legacy-afwijkingen: de historische fixture bevat 24 bekende spaarstortingen en 2 opnames zonder betrouwbare goal-link. Die blijven leesbaar met diagnostiek; er wordt geen doel/ledger/allocatie bij verzonnen. Een legacy aankooprefund heeft bankbedrag -€15: bron en classificatie blijven behouden, maar deze wordt geen fictieve inkomende P4-refund. Legacy CSV zonder betrouwbare source identity houdt de P3-blokkade voor onveilige bewerking/verwijdering.


De correctieronde is afzonderlijk gebaselined vóór wijzigingen: `work/p4-correction-baseline`, `work/p4-correction-financial-before.json` en de bijbehorende geïsoleerde capturer. Geaudit zijn de centrale `financialForecastForMonth`, `monthlyFinancialForecast`, `calcScenario`, desktop Geplande verdeling, mobiele zakgeldkaart, persoonlijke/joint Over deze maand, maandspaaroverrides, P2-budgetresolver en vaste-last-occurrences. Ze deelden één selector, maar interpreteerden de actuele `distributable` ook als te verdelen zakgeld. Er was geen tweede calculator nodig: dezelfde selector levert nu expliciete actual/forecastcomponenten én een afgeleide planningbasis.

Maandspaarplanning is reeds betrouwbaar beschikbaar als expliciete `monthlySavingOverrides[maand]` met de bestaande `planning.spaarpotDezeMaand` als baseline. Een opgeslagen nul wordt gelezen als nul. Er is geen ingangsmaand verzonnen. De P2-resolver levert de variabele budgetregels; de gecombineerde budgetdetailteller waarin fixed actuals kunnen voorkomen wordt niet als reserveringsbron gebruikt.

## B. MODEL

P3 `transaction-engine.mjs` en `transaction-processing.mjs` zijn uitgebreid. `transaction-model.mjs` is byte-ongewijzigd. `accountContext`, financiële bestemming, source identity, approval en bankOriginal blijven P3-contracten.

Nieuwe optionele verwerking: `savingsGoalId`, `refundCategory`, `refundMonth` op de bestaande processing line/split. De refundvelden zijn geen bankvelden. Nieuwe afgeleide effecten: `savingsDeposit`, `savingsWithdrawal`, `goalDelta`, `savingsFunded`, `unusedSavings`, `refundCashflow`, `refundCorrection`, `categoryOnlyRefundCorrection`, `fixedRegularImpact`. Die worden niet als tweede opgeslagen financiële waarheid bijgehouden.

`state.savingsCoverageAllocations` wordt uitsluitend bij een expliciete coverage-actie geschreven. Een entry heeft een stabiel `id`, withdrawal-/expense-transactionreferenties, optionele sourceKey/splitId-referenties, gehele `amountCents`, `active` en auditmetadata/history. Er is geen migratie die lege allocations of verzonnen relaties toevoegt.

Een balanscorrectie is een bestaande `manual-correction` ledgerentry met eigen ID, delta, `balanceBefore`, `balanceAfter`, notitie en actor/tijd van de expliciete actie. Geen transactie/source-ID wordt als fictieve bankbeweging aangemaakt.

De correctieronde voegt uitsluitend het niet-persistente `allowanceBasis` aan de bestaande prognoseprojectie toe. Per eigenaar bevat dit `fixedReserve`, `budgetReserve`, `savingsReserve`, `totalReserve`; persoonlijk ook `automaticallyAvailableForSavings`. `distributable` en `income` benoemen de conservatieve gezamenlijke verdelingsbasis. Geen nieuwe statevelden, transactions, ledgerentries of schema worden hiervoor opgeslagen.

## C. SAVINGS

Naar sparen: betaalrekeningcashflow negatief, doel positief; geen real expense, budgetexpense of gewoon inkomen. Zowel `sparen` als `naar-spaarrekening` volgen deze regel. Van sparen: doel negatief, werkelijke inkomende bankcashflow waar die bestaat; geen gewoon inkomen/uitgave. Iedere nieuwe spaarbeweging vereist precies één bestaand doel. Eén source mag niet over meerdere doelen worden verdeeld.

`createTransactionSavingsEntry` maakt een stabiele ledgeridentiteit op basis van de bestaande processing-line-ID. `synchronizeChangedSavings` behandelt uitsluitend expliciet gewijzigde sources/lines; ongewijzigde historische entries worden niet gereconstrueerd. Raw P3-splits gebruiken `sourceTransactionId` zodat heropening van de parent ook eigen splitledgereffecten deactiveert. Reapproval hergebruikt dezelfde ledgerentry. Geplande inleg blijft planning en telt niet als werkelijk doelsaldo.

Handmatige balanscorrecties veranderen uitsluitend de ledger/goalpresentatie. Ze veranderen geen bankcashflow, transactieaantal, income, expense of Over deze maand. Een wijziging die het doel negatief maakt wordt vóór commit/journalmutatie geblokkeerd. Het volledige saldo boven doel-/subdoelcapaciteit blijft bewaard; capaciteit begrenst alleen de verdeling over subdoelen.

`unusedSavings = actieve opname − actuele geldige allocations`. Dit wordt telkens uit de actuele graph afgeleid; geen remaining-income-transactie, geen carry-over, geen extra ledgerentry.

## D. COVERAGE

Many-to-many werkt met expliciete allocations: één opname naar meerdere uitgaven en meerdere opnames naar één uitgave. De gebruiker heeft ook dekking uit verschillende doelen naar één uitgave toegestaan; iedere afzonderlijke opname blijft aan één doel gekoppeld.

Validatie rekent allocaties en limieten in gehele eurocenten. Bedrag moet positief zijn; beide endpoints actief; withdrawal werkelijk `van-spaarrekening` met geldig doel; expense werkelijk een financieel relevante expense line; dezelfde bankkalendermaand; totaal per withdrawal niet boven opname; totaal per expense niet boven relevante reguliere belasting. Bij gekoppelde vaste lasten moeten bankmaand en occurrence-maand gelijk zijn. Er is geen overboeking naar een volgende maand.

`realExpense` blijft gross. `savingsFunded` verlaagt alleen reguliere `budgetImpact` / `fixedRegularImpact`. Planned, actual en deviation van de vaste-last-occurrence blijven intact. Ongeldige of verdwenen splitreferenties worden behouden maar inactief met concrete diagnostiek; geen remapping naar een andere line. Overschrijding na bedragwijziging blokkeert de wijziging vóór mutatie.

Voorbeelden: 189/189 → realExpense 189, budgetImpact 0; 300/200 → realExpense 300, budgetImpact 100. Opname 500 met dekking 350 → doel -500, unused 150; later dekking 450 → unused 50 zonder nieuwe transactie.

## E. REFUNDS

Bankcashflow volgt transactionDate; `refundMonth` bepaalt uitsluitend de expliciete categoriecorrectie. Een septemberrefund van 30 naar augustus corrigeert de augustuscategorie, houdt +30 bankcashflow in september, en is geen normaal inkomen. De oorspronkelijke expense wordt niet gewijzigd en een purchase-link is niet verplicht.

Nieuwe verwerking vereist incoming refund, herkenbare historische `refundCategory` en geldige `YYYY-MM` refundMonth. Herkenbaarheid leest P2-budget/fixed-configuratie voor die maand en bestaande opgeslagen categoriehistorie. Een later beëindigde categorie blijft historisch bruikbaar. Geen merchant-/aankoop-/maandheuristiek of autoapproval.

Gecombineerde categorieactual: gross relevante expense − savings coverage − refund correction. Gross realExpense, funded en refund blijven afzonderlijk beschikbaar. Expense 300, coverage 100, refund 50 → budgetImpact 150, realExpense 300.

Jouw expliciete laatste keuze is toegepast: als dezelfde categoriecontext actieve vaste-lastbetalingen heeft, blijft de refund een aparte categoriecorrectie. Er wordt geen bedrag verdeeld over vast en variabel. De variabele teller en fixed actual blijven intact, terwijl de gecombineerde categorieactual volledig wordt gecorrigeerd. Een context met uitsluitend gewone uitgaven wordt volledig in de variabele categorie gecorrigeerd. `categoryOnlyRefundCorrection` en de bestaande categoriedetail-/administratieweergave maken dit zichtbaar. De grens gebruikt werkelijk actieve vaste-lastbetalingen in de correctiemaand, geen gok op basis van alleen een geplande post.

Een refund boven de resterende categoriebelasting na coverage wordt vóór nieuwe verwerking/approval/dependencywijziging geblokkeerd. Geen negatieve-budgetregel, cap, inkomen of carry-over is ingevoerd.

## F. MAANDPROGNOSE

`financialForecastForMonth` blijft de enige centrale pure selector; `monthlyFinancialForecast` is de runtime-ingang. Dashboard, zakgeld, persoonlijke/joint Over deze maand en live snapshots gebruiken dezelfde projectie. De selector onderscheidt drie betekenissen:

1. **Werkelijke actuals:** `actualIncome`, `realExpense`, `budgetImpact`, fixed actual/deviation, cashflow, refunds, coverage en werkelijke savings blijven uitsluitend transactie-/ledgergedreven. Planning wordt hiervoor niet als actual opgeslagen.
2. **Actuele prognose / beschikbare middelen:** salarisfallback en bestaande P4-lastensemantiek blijven geldig. Fixed zonder actieve actual gebruikt planning, met actieve actual het actualtotaal na geldige coverage. Variabele belasting gebruikt werkelijk budgetImpact. Stortingen verlagen beschikbaar; opnames dragen uitsluitend unused bij; refunds leveren eenmaal bankmaandcredit. Interne transfers houden P3-semantiek. Het huishoudelijke beschikbare totaal verandert niet door de zakgeldcorrectie.
3. **Conservatieve zakgeldbasis:** volledige geldige maandplanning voor vaste lasten, variabele budgetten en gezamenlijk sparen wordt gereserveerd. Deze basis verandert niet door uitgaven, over-/onderschrijding, refunds, coverage, werkelijke spaarrealisatie of unused withdrawal. Alleen expliciete planningwijzigingen of de behouden inkomstenprecedence beïnvloeden de berekening.

Inkomstenprecedence, door de gebruiker opnieuw bevestigd: actief werkelijk salaris > expliciete persoonlijke handmatige dashboardwaarde > historisch gepland salaris. Expliciete nul is geldig. Extra werkelijk inkomen telt afzonderlijk. `actualIncome` blijft zonder echte income transaction nul; gepland salaris en de dashboardfallback worden geen fictieve income transactions. Een onverdeelde administrative actual-income-totaloverride wordt niet heuristisch over Dion/Dara verdeeld. De bestaande legacy salaryassignmentadapter wordt exact eenmaal toegepast.

Budgetreserve leest uitsluitend `resolveVariableBudgetsForMonth(state, maand, eigenaar)` en reserveert 100% van het geldige geplande bedrag, onafhankelijk van actuals. Budget 500 met uitgaven 0/300/400/700 blijft reserve 500. Een refund of coverage verlaagt de werkelijke categorieactual, maar niet de reserve. Vaste lasten worden afzonderlijk uit de historische geplande occurrences gereserveerd, niet nogmaals uit de gecombineerde categorieactual. De bestaande verdelingsratio, minimum-Dion en gelijk verdeelde fixed-configuratie blijven behouden.

Fixed planning 100 met actual 105 blijft voor zakgeld reserve 100; actuele fixed burden blijft 105, deviation +5 en status Betaald. Het verschil belast de rekeningbuffer. Ook meerdere actuals of coverage veranderen de geplande zakgeldreserve niet. Dit volgt de laatste verduidelijking dat werkelijke realisatie zakgeld niet wijzigt; het planned→actual-contract blijft in actuals/prognose bestaan.

Gezamenlijk gepland sparen wordt volledig gereserveerd via de expliciete maandoverride, anders de bestaande planningbaseline. Plan 250 met geen storting, storting 250 of storting 300 houdt dezelfde reserve 250 en hetzelfde zakgeld: geen tweede aftrek. De verschillen blijven buffer/werkelijke middelen. Persoonlijke spaaroverrides blijven binnen het bestaande eigen zakgelddeel; ze veranderen de gezamenlijke verdeling niet. De bestaande automatische persoonlijke spaarplanning wordt nu afgeleid uit zakgeld minus geplande persoonlijke fixed/budgetlasten, niet uit wisselende actuals. Expliciet nul blijft geldig; een negatieve automatisch beschikbare ruimte blijft als tekort zichtbaar en maakt geen negatieve automatische spaarreserve.

Over deze maand gebruikt de actuele componenten **na** de geplande zakgeldverdeling. Gezamenlijk: actuele middelen vóór zakgeld minus de twee vooraf berekende zakgeldbedragen. Daardoor blijft ongebruikte budget-/spaarreserve op de gezamenlijke rekening zichtbaar; overschrijding vermindert die buffer, niet het zakgeld. Persoonlijk: eigen vooraf berekend zakgeld minus actuele eigen belasting. Huishoudelijk blijft het bestaande P4-beschikbare totaal gelijk. Dit zijn expliciete outputs van dezelfde engine, geen tweede financiële waarheid of persistente herverdeling.

`unusedSavings = actieve opname − geldige coverage` blijft ongewijzigd: een echte ongebruikte opname verhoogt actuele beschikbare middelen, maar wordt niet opnieuw als zakgeld verdeeld. Er is geen extra transaction, income of ledgerentry gemaakt. Refund-bankmaand en historische correctiemaand blijven gescheiden. Opgeslagen closures blijven ongewijzigd; nieuwe live berekeningen tonen de gecorrigeerde planningbasis.

## G. ACTIVITY / UNDO

P3 source-level approval blijft leidend: manual direct approved; CSV Onbekend/Nakijken inactief; uitsluitend expliciete approval activeert; Niet meetellen heeft nul financiële effecten. Recognition certainty geeft geen approval.

Reopen/exclusion deactiveert uitsluitend de eigen savings-ledgereffecten en laat audit/provenance bestaan. Allocations blijven opgeslagen maar worden dynamisch inactief als withdrawal of expense inactief wordt. Expensebudget keert terug zonder withdrawalcoverage; bij inactieve expense stijgt unused. Inactieve refund corrigeert geen historische categorie. Reapproval hergebruikt dezelfde entries en activeert geldige allocations exact eenmaal.

Import/source/manualcommands werken eerst op een clone en valideren negatieve doelen, coverageoverflow, refundoverflow en bestaande advance-dependencies vóór mutatie. Importjournal-/commitbeveiliging is behouden. `applyFinancialCandidate` neemt een gevalideerde clone over met behoud van objectreferenties die bestaande editors vasthouden; dit voorkomt dat een tweede editoractie op een achtergebleven goalobject schrijft. No-op commits schrijven geen revision/state. BankOriginal-beveiliging blijft aanwezig.

## H. COMPATIBILITY / OPSLAG

Schema blijft v11. Er is geen v11→v12-migratie en geen P4-write bij uitsluitend laden. Optional processingvelden en allocations passen in de bestaande v11-JSON/cloudserialization. P1-backup/migratieroute, P2-historie, P3 source identity en conflict/rebaseprotocol zijn behouden. Geen imports, bankvelden, transacties, planning, ledger, advances of snapshots zijn massaal herschreven.

De P3-loadbaseline met 186 historische transacties en 29 ledgerentries blijft recursief inhoudelijk identiek in alle beschermde onderdelen; saldo/goalvelden blijven gelijk. Dezelfde opgeslagen state levert na reload of op cloudmock-device B dezelfde P4-projectie. Herhaalde cloudacceptance veroorzaakt geen migratie-echo-write. Er is geen productiecloudtest gedaan.

Bestaande gesloten snapshots blijven historische opgeslagen waarden. Nieuwe live/open berekeningen gebruiken snapshotversie 3; alleen een expliciete nieuwe afsluitactie slaat de actuele snapshot op. Oudere gesloten snapshots worden bij lezen niet herberekend of overschreven.

De PWA asset/cacheversie is lokaal verhoogd van 98-transaction-engine naar 99-savings-refunds-forecast zodat gewijzigde JS na een toekomstige, afzonderlijk geautoriseerde release niet de oude cache gebruikt. Dit is geen schemawijziging en er is niets gepubliceerd.

## I. GEWIJZIGDE BESTANDEN

Dit overzicht is ten opzichte van de vooraf vastgelegde P3-baseline, niet ten opzichte van de oudere Git-HEAD. Bestaande P1/P2/P3-werkbestanden zijn behouden.

| Bestand | Wijziging / reden / vervangen reader of writer |
|---|---|
| `src/core/transaction-engine.mjs` | Bestaande projectie verrijkt met savings, coverage, refund, gecombineerde categorieactual en maandprognose; P3 selectors lezen dezelfde dimensies. Sourcecashflow/immutable parentmetadata blijven leidend; splits houden eigen verwerking. Vervangt verspreide impact/maand/prognoseinterpretaties. |
| `src/core/transaction-processing.mjs` | Gevalideerde clone-adoptie, expliciete changed-source ledger sync, allocationcommands, doelcorrectie en preflight. Uitbreiding bestaande sourcecommands, geen tweede commandmodel. |
| `src/core/data-normalization.mjs` | Expliciete reconciliatie bewaart volledige ledgerbalance boven subdoelcapaciteit. Loadnormalisatie/migratie blijft onveranderd. |
| `src/core/runtime.js` | Bestaande dashboard-/Over deze maand-/zakgeld-/budget-/live-snapshotcallers aangesloten op core; contextmanualmodals voorzien van uitsluitend relevante goal/refundvelden; coveragebeheer via bestaande editors/modalcomponenten; categoriedetail inclusief correcties. Goalcorrectie gebruikt ledgercommand. |
| `src/import/runtime.js` | Processing/splits voor alle savingsrichtingen en refundvelden; approval/replacement/apply/undo preflight met dezelfde core; bestaande sourceeditor opent gedeeld coveragebeheer. Batch gating, opslag, sync en journalarchitectuur behouden. |
| `app.js` | Reproduceerbaar gegenereerde runtime uit bovenstaande bronnen. |
| `index.html` | Alleen versioned asset-URL naar lokale P4-build; geen navigatie/markupredesign. |
| `service-worker.js` | Alleen cache/assetversie naar dezelfde P4-build; offlinegedrag behouden. |
| `tests/package4-savings-refunds-forecast.test.cjs` | 70 gerichte pure core/commandcases met vaste IDs, inclusief alle 52 voorgeschreven cases en gemengde refundregel. |
| `tests/package4-processing-integration.test.cjs` | 5 import/sourceintegratiecases voor preflight vóór journal/state, dependent mutations en stabiele herhaalde undo. |
| `tests/browser/package4-savings-refunds-forecast.spec.cjs` | 11 P4-browsertests: gedeelde flows op 390/1440px, cloudmock A/B, mixed-refunddetail. |
| `tests/update3-administration.test.cjs` | Extracted-runtime testharnas krijgt echte centrale prognosedependency. |
| `tests/update4-2-savings-ledger.test.cjs` | Authored bankfixture heeft expliciete P3-approval/context; shared helper krijgt state. |
| `tests/update4-ledgers.test.cjs` | Zelfde expliciete approval/context/statecontract voor ledgerintegratie. |
| `tests/update4-undo.test.cjs` | Zelfde P3/P4-fixturecontract; undo blijft inhoudelijk gecontroleerd. |
| `tests/update5-allowance-budget-regression.test.cjs` | Verwachtingen volgen de gecorrigeerde maandplanning: onder-/overschrijding en persoonlijke realisatie veranderen gezamenlijk zakgeld niet; harnas leest dezelfde maandspaarplanning als runtime. |
| `tests/update5-responsive-structure.test.cjs` | Controleert gedeelde forecastreader in plaats van oude lokale formules; cacheverwachting 99. |
| `tests/browser/modal-and-commit-stability.spec.cjs` | Refund telt niet als normaal inkomen; inkomensverwachting aangepast voor de expliciete P4-regel. |
| `tests/browser/update6-account-navigation.spec.cjs` | Zelfde income/refundscheiding met behoud van afzonderlijke overige inkomensbron. |
| `tests/browser/v50-visual-baseline.spec.cjs` | Wacht expliciet op gerenderde bootstrap vóór screenshot/stijlmeting; bestaande timing-race in het testharnas opgelost zonder stijlasserties te wijzigen. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-360.png` | Handmatig vervangen na beoordeling van uitsluitend vereiste prognosecijfers/tabelkolombreedte. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-390.png` | Zelfde inhoudelijke review; geen automatische snapshotupdate. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-430.png` | Zelfde inhoudelijke review; stijlcontract ongewijzigd. |
| `tests/service-worker-cache.test.cjs` | Nieuwe cacheversie 99; overige offlinecontracten gelijk. |
| `tests/html-inline-syntax.test.cjs` | Nieuwe assetversie 99; syntax/HTMLcontract gelijk. |
| `tests/update4-final-regression.test.cjs` | Nieuwe cacheversie 99; overige regressieasserties gelijk. |
| `tests/package4-allowance-planning-correction.test.cjs` | 18 cases: Z1–Z15 en aanvullende overschrijding, geen fixed/budgetdubbeltelling en persoonlijke spaar-/nulsemantiek. |
| `tests/browser/package4-allowance-planning-correction.spec.cjs` | 2 desktop/mobielcases: geplande reserve/zakgeld gelijk na gedeeltelijke uitgaven en fixed realisatie, plan-card blijft gepland bedrag tonen, reload/viewport/persistentie stabiel. |
| `docs/package-4-savings-refunds-forecast.md` | Dit bijgewerkte technische verslag. |

De correctieronde zelf wijzigt uitsluitend `transaction-engine.mjs` (afgeleide planningbasis binnen bestaande forecast), `runtime.js` (calcScenario en Geplande verdeling lezen die basis), gegenereerde `app.js`, de genoemde zakgeldregressietest, de twee nieuwe correctietestbestanden, drie handmatig beoordeelde mobiele cijferreferenties en dit verslag. Import/sourcecommands, normalisatie, storage/cloud, assetversie en stylesheetbronnen zijn in deze ronde niet gewijzigd.

`app.css`, alle stylesheetbronnen, `transaction-model.mjs`, `planning-timeline.mjs` en `recurring-occurrences.mjs` zijn byte-ongewijzigd ten opzichte van P3. CSS SHA256: `ba99ba8633c996ca0106b6db6417e2fd6141a635bd00ab202d2307fb2def975f`.

## J. TESTRESULTATEN

Alle onderstaande verplichte cases zijn afzonderlijk uitgevoerd in `package4-savings-refunds-forecast.test.cjs`.

| Test | Resultaat | Controle |
|---|---|---|
| S1 | PASS | 250 naar sparen: cash -250, goal +250, geen expense/budget, prognose -250. |
| S2 | PASS | 500 opname zonder dekking: goal -500, income 0, unused 500. |
| S3 | PASS | 500 opname / 350 dekking: unused 150, goal volledige -500. |
| S4 | PASS | Latere +100 dekking: unused 50 zonder nieuwe transactie. |
| S5 | PASS | Saldo +100 alleen ledgercorrectie; transactie/prognose gelijk. |
| S6 | PASS | Nieuwe savings zonder goal geblokkeerd vóór mutatie. |
| C1 | PASS | 189 volledig gedekt: gross 189, budget 0. |
| C2 | PASS | 300 / 200 gedekt: gross 300, budget 100. |
| C3 | PASS | Eén withdrawal dekt meerdere expenses. |
| C4 | PASS | Meerdere withdrawals dekken één expense. |
| C5 | PASS | Coverage boven withdrawal atomair geblokkeerd. |
| C6 | PASS | Coverage boven expense atomair geblokkeerd. |
| C7 | PASS | Andere kalendermaand geblokkeerd. |
| C8 | PASS | Inactieve withdrawal deactiveert allocationeffect. |
| C9 | PASS | Inactieve expense verhoogt unused dynamisch. |
| C10 | PASS | 0,10 + 0,20 exact 0,30; fractional-cent allocation ongeldig. |
| RF1 | PASS | Augustus 100→70; september cash +30; income 0. |
| RF2 | PASS | Originele expense recursief gelijk. |
| RF3 | PASS | Ontbrekende refundcategorie blokkeert. |
| RF4 | PASS | Ontbrekende refundmaand blokkeert. |
| RF5 | PASS | Recognition blijft Nakijken/inactief. |
| RF6 | PASS | Inactieve refund corrigeert niets. |
| RF7 | PASS | Later beëindigde categorie blijft historisch herkenbaar. |
| RF8 | PASS | 300−100−50=150 budget; gross 300. |
| P1 | PASS | Geen actual: actualIncome 0, prognosesalaris 2600. |
| P2 | PASS | Actual 2645 vervangt 2600; geen 5245. |
| P3 | PASS | 2645 salaris + 100 extra = 2745. |
| P4 | PASS | Storting verlaagt beschikbare middelen zonder expense. |
| P5 | PASS | 500/350 levert uitsluitend unused 150 als opnamecomponent. |
| P6 | PASS | Coverage verlaagt budgetImpact, gross intact. |
| P7 | PASS | Historische correctie; refund cashcredit exact eenmaal in bankmaand. |
| U1 | PASS | Niet meetellen verwijdert eigen goal-effect. |
| U2 | PASS | Reopen withdrawal deactiveert eigen goal/coverage. |
| U3 | PASS | Reapproval exact eenmaal, dubbele actie financieel stabiel. |
| U4 | PASS | Reopen expense deactiveert dekking, unused stijgt. |
| U5 | PASS | Reopen refund verwijdert historische correctie. |
| U6 | PASS | Ledgerentryaantal gelijk na reopen/reapproval. |
| U7 | PASS | Negatief doel door dependency blokkeert vóór mutatie. |
| SP1 | PASS | Expense split ontvangt eigen dekking. |
| SP2 | PASS | Andere split onveranderd. |
| SP3 | PASS | Refundsplit corrigeert eigen categorie/maand. |
| SP4 | PASS | P3 exacte splitsomvalidatie blijft intact. |
| R1 | PASS | Fysieke accountContext los van financial destination. |
| R2 | PASS | Fixed occurrence-maand blijft correct. |
| R3 | PASS | Salarislink verplaatst actual bankmaand niet. |
| R4 | PASS | Internal pair: accountcashflow behouden, extern huishouden nul. |
| R5 | PASS | Expliciete manual→CSV replacement blijft Nakijken en onderdrukt dubbel effect. |
| R6 | PASS | BankOriginal onveranderd; verwerkt bedrag blijft afzonderlijk. |
| R7 | PASS | Niet meetellen: alle projectie-effecten nul. |
| R8 | PASS | Geen CSV-autoapproval. |
| R9 | PASS | Planning/budget/incomehistorie recursief gelijk. |
| R10 | PASS | Alleen lezen wijzigt closures/snapshots/state niet. |

Aanvullende corecases: fixed coverage zonder planned/actualmutatie; crossmonth fixed blokkade; refundoverflow/dependent mutation; bankmaandcredit eenmaal; explicit-zero salaryoverride; subgoalsaldo boven capaciteit; meerdere doelen; ontbrekende splitreferentie/bedragkrimp; legacy missing goal/negatieve refund; JSON/pure reads; ledgermonthwijziging zonder duplicate; editorobjectreferenties; raw-split ledgeridentity; legacy jointsalary exact eenmaal; immutable parentmetadata; fixed-only en gemengde refundcategorie. Plus refundsplitvalidatie op de eigen financiële bestemming. Alle 18 PASS. Samen: 70 corecases.

Import/sourceintegratie: negatieve afhankelijkheid bij reopen vóór journal; te grote opname bij herapproval vóór journal; covered expense verkleinen vóór journal; refundoverflow vóór applyImportPlan; herhaalde undo zonder auditverdubbeling. Alle 5 PASS. Samen met core: 75 oorspronkelijke P4-Nodecases; daarnaast 18 correctiecases, dus 93 gerichte P4-Nodecases totaal.

Volledige Node-suite: **41/41 testbestanden PASS**, inclusief P1/P2/P3 en bestaande cloud/ledger/import/closure/UI/securitycontracten. Deze suite bevat ook scriptasserties; 41 is het aantal bestanden, niet een claim over het totale aantal individuele asserties. P3-core/processing omvatten afzonderlijk 62 + 7 cases en blijven groen.

Browser: **107/107 PASS**, waarvan 94 bestaande, 11 oorspronkelijke P4-cases en 2 correctiecases. Gedeelde P4-flows op 390px en 1440px: manual saving/deposit/withdrawal, volledige/gedeeltelijke many-to-many, allocatie wijzigen/verwijderen, saldo corrigeren, historische refund, splitcoverage/splitrefund, CSV Onbekend/Nakijken/approval/Niet meetellen/reopen/reapproval, reload/maand-/viewportwissel, validatie vóór writes, gemengde refundregel. Cloudmock A/B bewaart dezelfde state/projectie en herhaalde load heeft nul migratie-echo. Bestaande responsive checks lopen op 360/390/430/768/1024/1440px. Geen productiecloud gebruikt. P4-tests controleren page/console errors, dubbele effecten, ledgeraantal, bankOriginal, planning en opgeslagen state.

Testtooling: repositorydependencies zijn niet geüpgraded. De geïsoleerde lokale mirror gebruikte de beschikbare gebundelde Playwright 1.62.1 met geïnstalleerde Chrome; package.json blijft op Playwright 1.55.0. Browserresultaten gelden voor deze daadwerkelijk uitgevoerde Chrome/Windows-omgeving, niet als afzonderlijke Safari/Firefox-testclaim.

Syntax PASS; CSS PASS (971 hoofdnodes, nul ongedefinieerde tokens); build PASS; generated/runtime-byte-reproducibility PASS; computed-style-contract PASS; PWA/offline PASS. Drie mobiele numerieke screenshots zijn na visuele diffreview handmatig vernieuwd; 768/1024/1440-referenties bleven passend. Geen automatische snapshotupdate of verruimde tolerantie.

Correctieronde: alle verplichte zakgeldcases afzonderlijk uitgevoerd in `package4-allowance-planning-correction.test.cjs`.

| Test | Resultaat | Controle |
|---|---|---|
| Z1 | PASS | Budget 500 / actual 0: volledige reserve 500. |
| Z2 | PASS | Budget 500 / actual 300: reserve en zakgeld gelijk; buffer 200. |
| Z3 | PASS | Budget 500 / eindmaandactual 400: resterend 100 blijft buffer. |
| Z4 | PASS | Gepland sparen 250 / geen transaction: reserve 250. |
| Z5 | PASS | Plan 250 / storting 250: totale zakgeldreserve 250, niet 500. |
| Z6 | PASS | Niet uitgevoerd sparen 250 blijft gereserveerd; geen extra zakgeld. |
| Z7 | PASS | Plan 300 / expense 200 / refund 50: actual 150, reserve 300. |
| Z8 | PASS | Plan 300 / expense 200 / coverage 100: actual 100, reserve 300. |
| Z9 | PASS | Actual salaris vervangt planning; volledige budget-/spaarreserve blijft. |
| Z10 | PASS | Expliciete nul salarisoverride blijft nul. |
| Z11 | PASS | September/oktober gebruiken eigen historische budget- en spaarplanning. |
| Z12 | PASS | Forecast-read wijzigt state, income, categorieactuals en transaction effects niet. |
| Z13 | PASS | Ook storting 300 bij plan 250 verandert zakgeld niet; buffer -50. |
| Z14 | PASS | Fixed plan 100 / actual 105: reserve 100, burden 105, deviation +5. |
| Z15 | PASS | Opname 500 / coverage 350: unused 150 verhoogt actual beschikbaar, zakgeld gelijk. |

Aanvullend PASS: overschrijding 700 tegenover budget 500 raakt alleen buffer; variabele reservering plus fixed-reserve niet dubbel geteld; persoonlijke savingoverride/nul blijft binnen eigen verdeling. Samen 18 correctiecases. De twee nieuwe browsertests controleren op 390/1440px dezelfde geplande reservering en zichtbaar zakgeld vóór/na een handmatige budgetuitgave, fixed plan100/actual105, reload en viewportwisseling.

De oorspronkelijke P3→P4-audit blijft beschikbaar in `work/p4-baseline`. Voor deze correctie is opnieuw vóór/na vergeleken met de oorspronkelijke P4-runtime. Alle beschermde persistenties zijn recursief gelijk: transacties/bedragen/bankOriginal, planning/fixed-/budget-/incomehistorie, goals/ledger, advances/repayments, imports/referenties, transfers/replacements en closures/snapshots. Actual income, real expenses, accountresultaten, volledige categorieactuals, fixed actuals en **alle transaction effects** zijn exact gelijk op alle vier fixture-maanden. Ook het volledige `forecast.household` is exact gelijk.

Onderstaande cijfers vervangen de eerdere onjuiste P4-zakgeldbaseline. Bedragen in euro; buffer is de gezamenlijke actuele prognose ná geplande zakgeldverdeling.

| Fixture / maand | Dion onjuiste P4 → correctie | Dara onjuiste P4 → correctie | Huishoudelijk beschikbaar (gelijk) | Gezamenlijke buffer na correctie |
|---|---|---|---|---|
| visual-fixture / 2026-07 | 1.390,94 → 1.166,58 | 1.708,87 → 1.433,23 | 1.788,97 | 500,00 |
| historical-backup / 2026-06 | 1.550,21 → 1.189,92 | 1.694,07 → 1.300,36 | 930,49 | 754,00 |
| historical-backup / 2026-07 | 1.090,24 → 1.086,27 | 2.666,55 → 2.660,60 | 1.841,94 | 9,92 |
| historical-backup / 2026-08 | 1.231,09 → 876,42 | 1.733,19 → 1.233,86 | 930,29 | 854,00 |

Gezamenlijke reserveringen fixed / variabel / sparen: visual juli 2.360,19 / 500 / 0; historische juni 2.979,72 / 600 / 154; juli 2.679,72 / 650 / 154; augustus 2.679,72 / 700 / 154. De historische juli-reserve voor variabel/sparen is 650 + 154 = 804; werkelijke variabele belasting 771,22 plus stortingen 22,86 is 794,08. Het verschil 9,92 blijft gezamenlijke buffer; ook de budgetoverschrijding verandert de geplande verdeling niet. De bestaande negatieve persoonlijke fixed-planningregel van -25,58 in de visuele fixture is een legacyconfiguratie en niet in deze ronde geherclassificeerd.

Categorie A (correctieronde): verplichte volledige budget-/spaar-/fixedreservering voor zakgeld, geen herverdeling op basis van realisatie, en overeenkomstige verschuiving van actuele accountbuffers. Inkomstenprecedence blijft conform de expliciete gebruikersbevestiging. De oorspronkelijke vereiste P4-effecten voor savings/refunds/coverage blijven gelden en zijn in deze ronde niet opnieuw gewijzigd.

Categorie B: aanvullende pure `allowanceBasis` en getoonde geplande bedragen/numerieke screenshotreferenties. Geen persistente representatieconversie of nieuwe schema.

**Categorie C: 0 regressies.** Minder uitgeven levert buffer op; meer uitgeven gebruikt buffer, zonder zakgeldverlaging. Werkelijke actuals worden niet door planning vervangen.

De uitvoerbestanden bij dit verslag bevatten de volledige Node-resultaten, browser-JSON en financiële correctievergelijking. Voor reproductie: `node scripts/run-node-tests.mjs`, `node scripts/check-syntax.mjs`, `node scripts/check-css.mjs`, `node scripts/build.mjs`, `node scripts/build.mjs --check`, `playwright test`. De daadwerkelijk uitgevoerde browsersuite gebruikte de geïsoleerde mirrorconfiguratie met Chrome en gebundelde Playwright. Node 41/41, browser 107/107, syntax/CSS/build/reproducibility, cloudmock, load-no-write, PWA/offline en responsive/stylechecks zijn groen. Snapshots zijn na inhoudelijke beoordeling van vereiste cijfers handmatig bijgewerkt; tolerantie is niet verruimd.

## K. OPEN RISICO'S / PAKKET-5-AFHANKELIJKHEDEN

| Punt | Exacte afhankelijkheid / waarom behouden | Minimale vervolgstap |
|---|---|---|
| Volledige CSV/cloud lifecycle-race | `src/import/import-store.js`, `src/import/import-sync.js`, bestaande ImportStore/journal/batchflow in `src/import/runtime.js`, `src/storage/cloud-state.js`. P4 heeft financiële preflight toegevoegd, geen opslag-/raceprotocol vervangen. | In P5 geïsoleerde batch/lifecycle- en cloudcoördinatieaudit met eigen regressies; niet heuristisch in P4 oplossen. |
| Legacy CSV zonder betrouwbare source identity | Bestaande source-edit/removeguards in `src/core/runtime.js` en sourcecommands in `transaction-processing.mjs`; ontbreken importBatchId/importTransactionId. | Alleen expliciet verifieerbare provenance herstellen of blokkade behouden; geen bron reconstrueren op omschrijving/bedrag. |
| Historische savings zonder goal | `applySavingsAndRefundEffects` diagnostic `legacy-savings-goal-missing`; `createTransactionSavingsEntry` maakt zonder doel geen entry. Bekende cashrichting mag forecast lezen; saldoreconstructie/coverage niet. | Expliciete gebruikerskoppeling/correctie indien later gewenst; geen massamigratie. |
| Legacy refund met uitgaande bankrichting / ontbrekende context | `legacy-refund-direction` / `legacy-refund-context-missing` in dezelfde engine. Bankgegevens blijven leidend; geen fictieve inkomende correctie. | Alleen een expliciete veilige herverwerking met geldige source/context; originele bankwaarde niet wijzigen. |
| Oude gesloten snapshots wijken mogelijk af van live P4-prognose | `getMonthFinancialResult`, `u3LegacyFinancialSnapshot`, `monthRecords.closureHistory` bewaren opgeslagen historische semantiek. | Een afzonderlijk geautoriseerde closurecorrectie-/rapportagekeuze; geen ongevraagde rebuild. |
| Advance-afhankelijkheden / uitgevoerde verrekeningen | P3 `reopenSourceInPlace` en importundo blijven afhankelijkheden vóór heropening blokkeren. P4 gebruikt ze niet als coverage/refundadministratie. | Expliciete correctiecommand voor die eigen administratie in passende latere scope. |
| Onverdeelde actual-income-totaloverride | `actualIncomeForMonth` heeft bestaand manual-correctioncontract; prognose verdeelt dit niet heuristisch over Dion/Dara. | Alleen bij expliciete productkeuze een eigenaar-specifieke correctieroute; P4 per-persoon forecastcontract intact laten. |

Pakket 5 is niet geïmplementeerd. Er is geen deploy/publicatie/push uitgevoerd en productie-Firestore is niet geraakt. Schema blijft v11 en layout/CSS zijn behouden.
