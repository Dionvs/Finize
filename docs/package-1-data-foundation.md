# Finize — Pakket 1: canoniek datamodel en migratiefundament

Uitgevoerd op 5 oktober 2026 in `G:\Mijn Drive\Codex\financien\outputs\dion_dara_budget\webapp\github\Finize-live-repo`. Uitgangspunt was de laatst gecontroleerde GitHub-versie op `main`, commit `1836cfcf792d87bb5393246bddfd852386c9a897`; de checkout was schoon voordat het werk begon.

Het fundament is lokaal geïmplementeerd en getest. Er is niet gepusht of gepubliceerd. Productie-Firestore, productie-localStorage en bestaande imports zijn niet tijdens deze uitvoering gemigreerd. De historische back-up is uitsluitend gelezen. Pakket 2 is niet geïmplementeerd.

## A. INVENTARISATIE

### Architectuur en opslag

`index.html` laadt de gegenereerde `app.js` en `app.css`. `src/app-entry.js` installeert achtereenvolgens foutregistratie, platform, authenticatie, core, import, presentatie en service-workerregistratie. De belangrijkste logica staat in `src/core/runtime.js` en `src/import/runtime.js`; kleinere modules publiceren bestaande contracten. De mobiele en desktoprenderers bestaan afzonderlijk en gebruiken nog verschillende financiële lezers.

De inventarisatie omvatte de runtime, HTML/CSS en stijlbronnen, `firestore.rules`, `firebase.json`, `package.json`, build/testconfiguratie, migratie-, cloud-, import- en historische documentatie, en de gevraagde zoektermen. Er was geen toepasselijke `AGENTS.md` gevonden.

De gewone state bevat financiële transacties/effecten, rekeningprofielen, samenvattingen en `activeImportId`. Volledige importrecords met ruwe bankregels en verwerking staan in `ImportStore`, IndexedDB `finize-imports-v1`, naast journal en syncwachtrij. De cloud bewaart importheaders en chunks met aantallen en checksum. Deze opslaglagen zijn geen identieke kopieën: de compacte state kan bestaan terwijl volledige importdetails nog lokaal of in de cloud moeten worden opgehaald.

LocalStorage gebruikt de bestaande state-, last-good-back-up- en pre-schema-v5-sleutels. Met authenticatie hebben deze de bestaande account/huishouden-suffix. Actieve Firestore-paden zijn `households/{householdId}/budgetState/current` en `households/{householdId}/imports/{importId}/chunks/{chunkId}`. Het oude `budgetPlanners/finize`-pad bestaat als historische herstelbron; de aanwezige regels blokkeren browsertoegang tot dat pad. Oude documentatie vermeldde nog openbare legacytoegang; dat beschreef niet de huidige regels.

### Transactiemodellen en routes

| Model/route | Gegevens en gedrag |
|---|---|
| Handmatige legacytransactie | `id`, `date`, `owner`, `category`, `description`, `amount`, `note`; soms `kind`, `account`, `financialFor`, `reviewStatus` |
| Legacy CSV-reviewqueue | `transactionReviewQueue`; rekening in `account`, bestemming in `financialFor`/`owner`, `sourceFile`, `importedAt`, `rawData.cells`, reviewstatus en eventuele links |
| Huidige CSV-draft | Importrecord met `rows`: `bankOriginal`, profiel/context, certainty, herkenningsvoorstel, approvalmetadata en `processing`, inclusief splits |
| Verwerkte CSV-transactie | Hoofdstate met `importBatchId`, `importTransactionId`, eventuele `splitId`, kopie van `bankOriginal`, processing, impact en referenties |
| Aanverwante administratie | Replacements, voorschotten, repayments, interne transferparen en savings-ledger; niet alle administratieve regels zijn transacties |

Aanmaken gebeurt via `openTransactionModal`, `openGeneralTransactionModal`, `openJointTransactionModal`, `openPersonalTransactionModal`, `bankImportRows` → `u3OpenReview`, en `createImportDraft` → `planImportEffects` → `applyImportPlan`. De CSV-parser en review/verwerkingsinterface zijn niet herschreven.

Wijzigen gebeurt via `commitChange`, `updateItemById`, de persoonlijke/gezamenlijke editors, CSV-verwerkingskeuzes, `applyTransactionFamily`, importplannen, replacements en undo. Verwijder-/undo-functionaliteit blijft bestaan; een migratie voert die handelingen niet uit.

Lezen gebeurt onder meer via `getMonthTransactions`, `u3ConfirmedTransactions`, `transactionMonth`, `normalizedTransactionType`, `getTransactionExpenseImpact`, `sumTransactions`, `transactionsByCategory`, `resolveMonthlyIncome`, `u3BudgetSummary`, `u3AccountControl`, voorschotlogica en verschillende desktop/mobiele renderers. Hun financiële interpretatie is niet naar een nieuwe engine omgezet.

`date` blijft de bestaande transactiedatum. `bankOriginal.bankDate` blijft de originele bankdatum en `processing.processingDate` de bestaande verwerkingsdatum. Aanwezige `bookingDate`/`transactionDate`-uitbreidingen worden behouden; er is geen massale hernoeming of nieuw verzonnen datum.

### Legacyvelden en meerdere betekenissen

`owner`, `account`, `financialFor`, `budgetOwner`, `kind`, `type`, `transactionType`, `reviewStatus`, `certainty`, `recognitionState`, `expenseImpact`, `rawData`, `sourceFile` en diverse koppelingen blijven leesbaar. `kind`/`type`/categorie worden door bestaande lezers soms als typeaanwijzing gebruikt. `owner` betekent in budgetlezers een financiële bestemming, terwijl sommige rekeninglezers het als fysieke rekeningfallback gebruiken. Een hoge herkenningszekerheid is geen bewijs van gebruikersgoedkeuring.

CSV-brondata bevat onder meer bankdatum, bedrag, omschrijving, rekeningkenmerken, tegenrekening, currency, reference, notes, regelnummer, `rawCells`, importidentiteiten en fingerprint. De parser interpreteert dit bij eerste import. Latere verwerking hoort de bestaande bronwaarden niet opnieuw te normaliseren. De oude transactienormalizer herschreef rekeningkenmerken in `bankOriginal`; dat is gestopt. De oude legacybevestigingsroute verwijderde `rawData`; die bron blijft nu behouden.

### Savings en historische structuren

`savingsGoalLedger` bevat onder meer `legacy-opening`, `manual-correction`, `planned`, `bank-import` en `bank-match`. `calculateGoalSavedAmount` telt geplande inleg niet als werkelijk gespaard; actual bankeffecten en correcties volgen de bestaande regels. `reconcileGoalSavedAmounts` blijft beschikbaar bij expliciete import-, undo- en correctiehandelingen. Een handmatige goalcorrectie blijft een ledgerregel en wordt geen fictieve transactie.

De oude read-normalisatie voegde ontbrekende openingsregels per goal toe en reconcileerde saldi. De nieuwe route bewaart een bestaande gevulde ledger en bestaande goalsaldi. Alleen het oude formaat zonder ledger krijgt deterministische openingsregels uit het opgeslagen saldo.

Er bestaan al `amountHistory`, `monthOverrides`, `incomeDefaultsHistory`, `budgetDefaultsHistory`, maandinkomens/budgetten/saving-overrides, `monthRecords.closureHistory`, financiële snapshots en reserve-/correctiereferenties. Deze worden meegenomen. Een volledige historische maandresolver is niet gebouwd.

### Bestaande migratie-infrastructuur

Vooraf bestonden `normalizeBudgetState`, `migrateBudgetState`, `ensurePersistentIds`, Update 2-goalnormalisatie, `u3NormalizeState` en import-`normalizeCore`/`normalizeTransaction`/ledgernormalisatie. Core en import hanteerden schema 9; Update 2/3 bevatte oudere structurele conversies. Er waren meerdere normalisatiepasses bij bootstrap en verschillende gevallen van random IDs, actuele timestamps, veldselectie zonder spread, eigenaarherinterpretatie en saldoaanpassing bij lezen.

De bestaande publieke migratieroute is geconsolideerd; er is geen afzonderlijke opslag- of migratiemotor naast geplaatst. De oude financiële functies en productroutes blijven bestaan.

## B. WIJZIGINGEN

| Bestand | Functies/secties en wijziging | Noodzaak binnen Pakket 1 |
|---|---|---|
| `src/core/transaction-model.mjs` — nieuw | Contextresolutie, bron/status/activity/original-bank-helpers, `normalizeDataTransaction`, `markManualTransaction`, bron-writeguard | Eén expliciet data-contract; geen nieuwe financiële berekening |
| `src/core/data-normalization.mjs` — nieuw | Schema 10, detectie, `migrateStateData`, stabiele IDs, shapechecks, importnormalisatie, veilige ledgernormalisatie; bestaande saved-amount/reconcile-functies gedeeld | Pure, deterministische migratie; originele velden/saldi behouden |
| `src/core/runtime.js` | `normalizeBudgetState`/`migrateBudgetState`, legacy/person/history/goalnormalizers, persistent IDs, `DataAdapter.load/save`, `localSave`, migratieback-up, cloudacceptatie/herstel, `commitChange`, manual writes en legacyreviewbevestiging | Eén loadroute; errors blokkeren overschrijving; back-up vóór opslag; nieuwe writes hebben expliciete herkomst/context; bronnen blijven behouden |
| `src/import/runtime.js` | Normalisatieadapters en gedeelde ledgerlezers, `ImportStore.putImport`, canonieke statuslezing, metadata in `planImportEffects`, read-only installatie/publicatie van helpers | Geen tweede bootmigratie/write; bankbron beschermen; expliciete approvalprovenance meenemen |
| `src/import/update4-runtime.cjs` | Dunne Node-adapter die dezelfde browserfactory/modulecontracten laadt | Tests oefenen de actieve code. De aparte gekopieerde testruntime is vervangen; productlegacyroutes zijn niet verwijderd |
| `app.js` | Gegenereerde bundle opnieuw gebouwd | De statische app gebruikt daadwerkelijk het nieuwe fundament |
| `index.html` | Uitsluitend assetcachetoken naar `96-data-foundation` | Nieuwe bundle betrouwbaar laden; markup/layout behouden |
| `service-worker.js` | Cachemarker en assettokens naar v96 | Bestaande PWA-cache-invalidation; geen datacache of opslag reset |
| `tests/package1-data-foundation.test.cjs` — nieuw | 16 gevraagde controles plus fout-, closure- en ID/ledgerchecks | Migratie- en databehoud bewijsbaar maken |
| `tests/helpers/migration-runtime.cjs` — nieuw | Testharness met echte coremigratiefuncties; klok/random/devicegebruik faalt | Test pure migratie, zonder actieve gebruikersstate te laden |
| `tests/browser/package1-data-foundation.spec.cjs` — nieuw | Acht browsergevallen voor schermen, fouten/back-up/bronbescherming en twee-devicecloud | Persistence/bootstrapcompatibiliteit en foutpaden controleren |
| `tests/update3-migration.test.cjs` | Schema 10; eigenaar/context niet meer gokken | Regressiecontract laten aansluiten op veilige migratie |
| `tests/update4-migration-storage.test.cjs` | Schema 10; legacy rule-uitbreidingen behouden | Unknown-field-preservation controleren |
| `tests/update4-stabilization-regression.test.cjs` | Verwacht schema 10 | Bestaande stabiliteitscheck behouden |
| `tests/update4-final-regression.test.cjs` | Schema/cacheverwachtingen bijgewerkt | Gegenereerde runtime en bestaand gedrag blijven getest |
| `tests/update5-budget-history-saving-overrides.test.cjs` | Stabiele-ID-helper in bestaande harness beschikbaar | Bestaande historiechecks gebruiken dezelfde deterministische normalizer |
| `tests/html-inline-syntax.test.cjs` | Verwachte assettokens v96 | Structuurcheck blijft geldig |
| `tests/service-worker-cache.test.cjs` | Verwachte cachemarker v96 | PWA-contract blijft getest |
| `tests/update5-responsive-structure.test.cjs` | Verwachte assettoken v96 | Bestaande responsive structuurcheck behouden |
| `README.md` | Schema 10 en verwijzing naar dit verslag | Actieve onderhoudsinformatie correct houden |
| `docs/v50-architecture.md` | Schema/cachemarker, bestaande accountscopes/Firestore-paden en actuele autorisatiebeschrijving | Documentatie laten overeenkomen met de aangetroffen architectuur |
| `docs/package-1-data-foundation.md` — nieuw | Dit technische verslag | Audit, beperkingen en vervolgafhankelijkheden overdraagbaar vastleggen |

`app.css`, stijlbronnen, navigatie, kaarten en responsive layout hebben geen inhoudelijke diff. `firestore.rules`, `firebase.json`, `package.json`, dependencies en financieel reken-/syncprotocol zijn niet gewijzigd.

## C. DATAMIGRATIE

Oud: actuele state schema 9; state zonder versie wordt als historische versie 1 herkend. Nieuw: `meta.schemaVersion = 10`, gedeeld door core en import. Een ongeldige versie, toekomstige versie of onbetrouwbare structuur geeft een expliciete fout.

De route is `migrateBudgetState(raw)` → gedeelde versiecontrole/clone → bestaande legacy structurele normalisatie → schema-9-compatibiliteitsbasis voor oudere versies → schema-10-datanormalisatie → bestaande validatie. Huidige v10-state doorloopt alleen stabiele normalisatie; geen opnieuw toegepaste financiële migratie.

1. Clone de input; mutatie van de originele state of actieve globale state is uitgesloten.
2. Controleer bestaande structuren. Ongeldige regels worden niet weggefilterd of vervangen door defaults. Bestaande dubbele IDs worden niet willekeurig hernummerd.
3. Geef alleen ontbrekende IDs een deterministische waarde uit structuurpad/index. Bestaande closure-identiteit via `closingId` blijft leidend als `id` ontbreekt.
4. Gebruik bestaande legacyconversies voor ontbrekende historische structuren. Een noodzakelijke ingangsmaand moet uit opgeslagen maandgegevens blijken; de huidige datum wordt niet gegokt. Moderne terugkerende planning wordt niet telkens opnieuw uit oude lijsten opgebouwd.
5. Behoud uitbreidingsvelden via clone/spread. Voeg ontbrekende optionele collecties en compatibiliteitsmetadata toe. Historische overrides worden bij lezen niet meer opgeruimd.
6. Normaliseer transacties additief: bron, context/evidence/resolution en verwerkingsstatus. Eigenaarvelden en originele bedragen/bronvelden worden niet herschreven.
7. Markeer reeds actieve legacy-hoofdstatetransacties waar approvalbewijs ontbreekt als `approvalSource: legacy-confirmed`. Dit is compatibiliteitsprovenance, geen nieuwe gebruikersgoedkeuring; er wordt geen `approvedAt` of gebruiker verzonnen. Drafts en queue krijgen dit privilege niet.
8. Bewaar bestaande ledgerregels, bedragen en goalsaldi. Alleen een geheel lege/ontbrekende historische ledger krijgt eenmaal `saving-opening-{goalId}` uit het opgeslagen goalbalance; tegenstrijdige IDs blokkeren dit. Een gevulde ledger wordt niet aangevuld met veronderstelde verschillen.
9. Zet schema 10 en valideer. Vóór persistent opslaan van een oude versie wordt de originele lokale/cloudstate in de bestaande migratieback-up bewaard. Bij een fout wordt de originele opslag niet vervangen door defaults.

Toegevoegde velden, waar bewijs bestaat: `source`, `accountContext`, `accountContextEvidence`, `accountContextResolution`, `processingStatus` en zo nodig ontbrekende legacyprojecties `account`/`accountOwner`/`budgetOwner`/`financialFor`/`owner`. Bij ambiguïteit blijft de fysieke context onopgelost; bestaande waarden blijven staan. Nieuwe expliciete goedkeuringen behouden hun eigen approvalmetadata.

`bankOriginal`, oorspronkelijke CSV-velden, importreferenties, scenario’s, onbekende uitbreidingen en legacyvelden blijven bestaan. Alleen ontbrekende administratieve timestamps krijgen bij normalisatie de vaste epoch; dat stelt geen echte historische gebeurtenis voor. Nieuwe gebruikershandelingen mogen wel nieuwe IDs/timestamps maken.

Idempotentie volgt uit versionering, stabiele IDs, vaste timestamps, geen random/device/viewportafhankelijkheid, geen dubbele ledgeraanvulling en het behouden van bestaande velden. De test vergelijkt zowel twee onafhankelijke migraties van dezelfde input als een tweede migratie van de output.

De bestaande pre-v5-back-up wordt niet overschreven: `package1Original` en zo nodig `package1CloudOriginal` worden er eenmalig naast bewaard, met oorspronkelijke state en `fromVersion`. Migratie-opslag ruimt bij quota-errors de last-good-back-up niet op. Expliciet back-upherstel stopt als de huidige state niet eerst kan worden geback-upt.

## D. COMPATIBILITY

De bestaande financiële lezers blijven voorlopig `date`, `kind`, `transactionType`, `owner`, `financialFor`, `budgetOwner`, reviewvelden en impact lezen. Canonieke helpers worden gebruikt in normalisatie, nieuwe writes, statuscompatibiliteit en bronbescherming; ze veranderen niet zelfstandig de huidige financiële aggregaties.

`getTransactionAccountContext` accepteert betrouwbare expliciete rekeningvelden en profiel/bankaanwijzingen. Eén consistente uitkomst geeft Dion, Dara of Gezamenlijk. Ontbrekende/tegenstrijdige informatie geeft `null` en een diagnose. `owner` en `financialFor` zijn geen bewijs van een fysieke rekening. Een opgeslagen ambiguïteitsmarkering voorkomt dat een latere lezer zonder profielinformatie alsnog een rekening gokt.

`getTransactionSource` gebruikt CSV-bronbewijzen voordat een tegenstrijdig manual-label wordt vertrouwd. Bij geheel ontbrekende herkomst blijft de bron onbekend. Handmatige nieuwe transacties krijgen de door hun bestaande invoerroute expliciet gekozen rekeningcontext en direct goedgekeurde status.

`getTransactionProcessingStatus` levert `onbekend`, `nakijken`, `goedgekeurd` of `niet-meetellen`. Ontbrekend bruikbaar voorstel is onbekend; herkenning is nooit approval. Expliciete CSV-goedkeuring en herkenbare legacybevestiging blijven uitleesbaar. `include:false`/Niet meetellen is pas afgehandeld als approval/reviewbewijs bestaat. `isTransactionFinanciallyActive` betekent hier canoniek goedgekeurd; de huidige engine gebruikt nog haar legacyfilters en financiële type/impactregels.

`getTransactionOriginalBankData` geeft een diep bevroren kopie. State-commits en importwrites vergelijken bronnen van bestaande IDs en blokkeren gewijzigde/verdwenen `bankOriginal`. Objectkey-volgorde mag verschillen na Firestore-roundtrip; bronwaarden en arrayvolgorde mogen niet verschillen. Expliciete verwijdering/undo blijft beschikbaar.

Cloudschema en concurrency zijn afzonderlijke begrippen: `schemaVersion` beschrijft data; bestaande `syncVersion`, `commitId`, revision, signatures, stale-snapshotcontrole en rebase blijven het syncprotocol. Een noodzakelijke cloudmigratie gebruikt één reguliere guarded write met de bestaande revision/update-metadata. Een v10-echo of tweede actuele client migreert niet opnieuw. Importchunk-storageversion is niet gewijzigd.

## E. SCENARIO-AUDIT

Beide scenario’s behouden vaste lasten, variabele budgetten, verdelingsconfiguratie, gezamenlijke spaarplanning en hun eigen terugkerende vaste lasten. Historie en maandbudgetten zijn scenario-gepartitioneerd; gezamenlijke saving-overrides gebruiken `gezamenlijkVoor` en `gezamenlijkNa`. Persoonlijke saving-overrides en income/ledgerdata zijn grotendeels scenario-overstijgend.

De gelezen historische back-up van 22 augustus 2026 bevat:

| Structuur | Voor | Na |
|---|---:|---:|
| Gezamenlijke legacy vaste lasten | 17 | 24 |
| Dion legacy vaste lasten | 11 | 1 |
| Dara legacy vaste lasten | 13 | 1 |
| Variabele budgetregels gezamenlijk/Dion/Dara | 3 / 4 / 5 | 3 / 1 / 1 |
| Afzonderlijke hypotheekregels | 0 | 1 |
| Terugkerende vaste lasten | 41 | 27 |

Deze back-up heeft `meta.scenario = voor`; dat is de bestaande baseline in die snapshot. Dit is geen claim over niet-geïnspecteerde actuele productiegegevens. Onder `na` staan 19 vaste-lastpostnamen per eigenaar die onder `voor` ontbreken, plus de afzonderlijke hypotheekstructuur en andere configuratie/budgetten. Naamvergelijking bewijst informatieverschil, geen veilige financiële conversie. `na` kan dus niet zonder keuzes worden verwijderd of automatisch op ingangsmaanden worden geprojecteerd.

Belangrijke callers blijven: `getMonthlyScenarioData`, `getVariableBudgetDefaultsAt`, `setVariableBudgetDefaultsFromMonth`, `ensureMonthData`, `calcScenario`, `u3FixedOccurrences`, `u3VariableBudgets`, `u3BudgetSummary`, `u3ReserveDelta`, afsluit-/planningcallers, vaste-lasten/budget/spaar-editors en desktop/mobiele scenario-controls. Import gebruikt scenario bij draftclassificatie, vaste-lastkeuzes, `findFixedById` en geselecteerde vaste-lastaanpassingen.

Het migratiepad is daarom behoud van beide namespaces en bestaande verwijzingen. Voor latere uitfasering moeten verschillen eerst expliciet op één tijdlijn/effective-from worden afgebeeld, met behoud van bron/provenance en oude closure/importreferenties. De scenario-UI blijft in Pakket 1 staan.

## F. OWNER/ACCOUNT-AUDIT

| Belangrijke plaats | Aangetroffen vermenging / huidige grens |
|---|---|
| Oude `u3NormalizeState` | Schreef `owner = financialFor` en kon `account` uit `owner` of gezamenlijk afleiden. Deze herinterpretatie is uit readmigratie gehaald |
| Oude import-`normalizeTransaction` | Koos fysieke `accountOwner` via `accountOwner || account || owner`, met gezamenlijke fallback; herschreef owner naar budgetOwner. Vervangen door behoudende canonical adapter |
| `openTransactionModal` | “Betaald vanuit” selecteert owner; nieuwe writes markeren dat nu als expliciete fysieke context. De legacy keuze-interface blijft |
| `openGeneralTransactionModal` | Selecteert fysieke rekening en afzonderlijke financiële bestemming; owner wordt financiële bestemming. Canonical context volgt de rekening, niet financialFor |
| Gezamenlijke/persoonlijke transaction editors | Selectie/bewerking van bestaande transacties gebruikt owner. Nieuwe writes krijgen tabcontext; bestaande classificatie wordt niet omgezet |
| `bankImportRows` / `u3OpenReview` | Queueaccount komt uit importcontext; herkenning kan financialFor/owner voorstellen. Bevestiging houdt de fysieke broncontext/ruwe data en expliciete approvalmetadata |
| `createImportDraft` | Detecteert rekeningprofiel op CSV-rekeningkenmerk en gebruikt anders entryOwner-profielen. Een gedetecteerd profiel kan afwijken van de actieve importtab. Deze bestaande workflow is geïnventariseerd, niet opnieuw ontworpen |
| `classifyOriginal` / `planImportEffects` | accountOwner komt uit profiel; budgetOwner uit verwerking/split; owner/financialFor projecteren de budgetbestemming. Canonical rekeningcontext is aanvullend profielcontext |
| `getMonthTransactions`, `u3ActualExpenses`, `u3BudgetSummary` | Filteren financiële bestemming via financialFor/owner; vervangen door rekeningcontext zou nu financiële resultaten veranderen. Daarom behouden |
| `bankIsDuplicate`, `u3AccountControl`, `u3CreateAdvanceForTransaction` | Gebruiken account/owner-fallback voor rekening of vergelijken rekening met financialFor. Ambigue legacydata kan hier nog verschillend worden geïnterpreteerd |
| `u3IncomeTransactionOwner` / `resolveMonthlyIncome` | Fallbackketen bevat accountOwner, account, inkomensbron-eigenaar, budgetOwner, financialFor, owner en gezamenlijk. Canonieke ombouw hoort bij de latere engine |
| Importfilters/historie en vaste-lastselecties | Rekeningprofiel/accountOwner voor importlocatie; financiële eigenaar voor gekoppelde planning. Beide betekenissen blijven afzonderlijk nodig |

In de historische back-up conflicteren bij 44 transacties de opgeslagen rekening/profielaanwijzingen met een bankrekeningkenmerk dat bij een ander profiel past. Deze records krijgen een ambiguïteitsdiagnose. Hun originele eigenaarvelden, rekeningvelden, broninformatie, bedragen en financiële activiteit blijven behouden. De migratie kiest geen “juiste” eigenaar.

Alle 186 reeds bestaande hoofdstatetransacties in deze back-up misten de nieuwe expliciete approvalprovenance. Zij krijgen alleen de herkenbare `legacy-confirmed`-compatibiliteitsmarkering; er worden geen historische goedkeurder of tijdstip gefabriceerd.

## G. TESTRESULTATEN

Uitvoering: Node 24.19.0; browserchecks met gebundelde Playwright 1.62.1 en geïnstalleerde Chrome 154.0.8037.93 in een geïsoleerde lokale testkopie. De repositorydependency blijft Playwright 1.55.0. Geen dependencies of browsers geïnstalleerd. Mobiel is een responsive viewport, geen fysieke iPhone/Safari-test.

| Gevraagde test | Resultaat | Toelichting |
|---|---|---|
| 1 — Oude state laden | PASS | Zonder schemaVersion bruikbaar naar v10; input blijft gelijk |
| 2 — Idempotentie | PASS | Tweede migratie en onafhankelijke herhaling zijn deep-equal |
| 3 — Transacties behouden | PASS | Aantallen gelijk; historische snapshot 186 → 186 |
| 4 — Bedragen behouden | PASS | Transactie-/verwerkingsbedragen exact behouden, inclusief meer decimalen |
| 5 — CSV-bron behouden | PASS | bankOriginal en legacy rawData blijven identiek |
| 6 — Imports behouden | PASS | Batch/rowreferenties, summaries en activeImportId behouden |
| 7 — Savings ledger behouden | PASS | Bestaande regels/bedragen gelijk; snapshot 29 → 29 |
| 8 — Spaardoelbalansen | PASS | Geen dubbele opening/correctie; gevulde ledger niet aangevuld uit verschil |
| 9 — Accountcontext | PASS | Dion, Dara en Gezamenlijk expliciet te onderscheiden |
| 10 — Ambigue legacy owner | PASS | Geen physical context uit financialFor/owner; profielconflict blijft onopgelost |
| 11 — BankOriginal immutable | PASS | Processing laat bron gelijk; ongeldige state/IDB-write geblokkeerd; keyvolgorde toegestaan |
| 12 — Statuscompatibiliteit | PASS | Unknown/review/manual approval/legacy approval/excluded uitleesbaar; zekerheid keurt niet goed |
| 13 — Onbekende velden | PASS | Root/nested uitbreidingen, regels, profielen, goals en settings behouden |
| 14 — Scenariodata | PASS | Voor/na en beide gezamenlijke saving-overrides behouden |
| 15 — Cloud serialization | PASS | JSON-roundtrip verliest geen fields; mocked guarded sync werkt op twee clients |
| 16 — Desktop/mobile onafhankelijk | PASS | Dezelfde migratieoutput bij 390/1440px; geen klok/device/random/global-stategebruik |

De nieuwe Node-testfile bevat 19 testgevallen: de 16 gevraagde tests plus malformed/future/duplicate-errorcontrole, closure-referencecontrole en stabiele ontbrekende IDs/geen ledger-gapfill. Alle 35 Node-testbestanden slagen, inclusief bestaande financiële/import/undo/auth/syncregressies.

Alle 83 browsertests slagen: 75 bestaande plus 8 nieuwe Pakket 1-gevallen. Nieuwe controles omvatten zes schermen op 390/1440px, stabiele herstart, corrupte localStorage, quota-error bij migratieback-up, quota-error bij state-opslag met behoud van back-ups, herstel zonder succesvolle back-up blokkeren, bronbescherming bij state-commit/ImportStore en één cloudmigratiewrite zonder echo-/tweede-clientwrite.

Syntaxcheck: PASS. CSS-parser: PASS, 971 hoofdnodes en nul ongedefinieerde tokens. Gegenereerde runtime: PASS, byte-reproduceerbaar. `git diff --check`: PASS. Zes bestaande screenshotbaselines en computed-stylecontract: PASS. `app.css` heeft geen inhoudelijke wijziging.

Daarnaast zijn Dashboard, Gezamenlijk, Dion, Dara, Spaardoelen en Data & back-up visueel bekeken via twaalf screenshots op 390/1440px. Schermen openen; kaarten, navigatie en spacing blijven behouden. Browserregressies controleren bestaande transacties, vaste lasten, budgetten, goals en bereikbare importinformatie. Normale navigatie geeft geen console-/page-errors, extra revisions of statewrites. Herladen geeft geen migratieloop.

De historische snapshotcontrole gebruikte de echte migratieroute en vergeleek recursief ieder oorspronkelijk veld. Van bestaande waarden wijzigde uitsluitend `meta.schemaVersion` van 9 naar 10; alle overige wijzigingen waren additief. De input en het back-upbestand bleven onveranderd. Behouden: 186 transacties, 171 bankOriginal-objecten, 6 summaries, 6 volledige imports in de oorspronkelijke back-up, 9 goals en 29 ledgerregels. De 9 opgeslagen goalbalansen kwamen al overeen met de bestaande ledgerberekening; de migratie heeft ze niet aangepast.

Cloud is getest met het bestaande transactionele API-contract in mocks en bestaande Node-syncchecks. Er is geen levende Firestore/emulator-integratietest uitgevoerd, en de historische back-up bewijst niet de inhoud van actuele productie. De testomgeving liet verifiëren dat v9 één guarded v10-write krijgt, syncVersion 3 → 4 gaat en herhaalde v10-snapshots/tweede client geen nieuwe migratiewrite veroorzaken.

## H. OPEN RISICO'S

1. De 44 historische rekeningconflicten vragen om broncontrole/expliciete beslissing in een later pakket. Canonical helpers melden ambiguïteit; legacy financiële callers behouden hun bestaande fallbacks.
2. Oude bevestigde records hebben niet overal historisch approvalbewijs. `legacy-confirmed` bewaart hun bestaande activiteit en maakt die beperking zichtbaar; het bewijst geen specifieke gebruikersactie.
3. `na` bevat unieke planning/configuratie. Er is geen betrouwbare automatische maandtoewijzing ontworpen of uitgevoerd. Beide scenario’s blijven nodig tot een gecontroleerde conversie.
4. Bestaande manual routes blijven verschillende modals. De generieke rekeningselector, alleen-uitgave-routes en ontbrekende uniforme controle op toekomstige transactiedata wijken af van de toekomstige regels. Het model ondersteunt manual income/expense; de flows zijn niet samengevoegd.
5. De bestaande CSV-profiel/tabkeuze kan conflicteren. Er is geen batch-gating-, race-condition-, cloud/import-retry- of review-engineoplossing toegevoegd.
6. Financiële callers combineren nog planned/actual afhankelijk van hun bestaande functie; geselecteerde CSV-vaste-lastaanpassingen bestaan nog. Geen automatische herkenningshandeling is nieuw financieel actief gemaakt, maar de volledige scheiding vereist latere processing/enginewerkzaamheden.
7. De bestaande engine kan afgeleide goalwaarden in het werkgeheugen berekenen en bevat legacy rekening/ownership-fallbacks. Pure migratie voegt geen render-ledgerregels/IDs/timestamps toe; een algemene herschrijving van alle berekeningsfuncties is bewust uitgebleven.
8. Voor reeds gevulde ledgers wordt een eventueel verschil met goal.algespaard niet gerepareerd of aangevuld. Het originele saldo blijft behouden; herstel van inconsistenties is een afzonderlijke expliciete handeling.
9. Corrupte state, dubbele IDs, ontbrekende noodzakelijke legacy-ingangsmaand of onvoldoende back-upruimte blokkeert laden/migratie met foutregistratie. Originele opslag blijft bestaan; er is geen nieuw herstel-dashboard toegevoegd. Back-upgrootte kan localStoragequota bereiken.
10. Bestaande doelafbeeldingsopslag en cloudimport-envelopes zijn geen nieuw bestandsback-upsysteem. Aanwezige rawText blijft lokaal behouden; de bestaande cloudheader sluit rawText uit en gebruikt bankOriginal/rawCells in chunks. Reeds vóór dit pakket verloren broninformatie kan niet worden gereconstrueerd.
11. Devices met een oude gecachte runtime kennen schema 10 niet en kunnen aanvullende velden opnieuw normaliseren/droppen. Bestaande legacyvelden blijven leesbaar, maar een oudere client is niet tot een nieuwe client omgebouwd. De nieuwe PWA-cachemarker ondersteunt een normale update; geen gedwongen deployment is uitgevoerd.
12. Live Firestore, werkelijke devices/Safari en actuele privé-productiedata zijn niet getest. De bekende document-/chunklimieten en bestaande syncconflictbeveiliging zijn niet vervangen.

Refunds, refundCategory/refundMonth-verwerking, savings coverage/many-to-many, historische resolver, Over deze maand, split-engine/fixed splits, transferaggregatie en desktop/mobielengine-samenvoeging zijn niet geïmplementeerd. Er is geen productfunctionaliteit of legacyreviewqueue verwijderd.

## I. VERVOLG

Uitsluitend technische afhankelijkheden voor Pakket 2:

- Bouw de historische resolver op de behouden `amountHistory`, bestaande defaults-histories en maand-overrides, met expliciete effective-from-semantiek en behoud van closure-/importreferenties.
- Gebruik schema 10 en de gedeelde migratieroute; voeg een volgende versie pas toe als een concrete dataconversie nodig is. Behoud determinisme, error-stop en back-up vóór persistentie.
- Houd planned configuratie en actual transacties afzonderlijk in het resolvercontract; bestaande financial readers moeten eerst geïnventariseerd worden voordat callers worden omgezet.
- Laat rekeningconflicten onopgelost totdat betrouwbare context beschikbaar is. Een toekomstige resolver mag budgetOwner/financialFor niet als fysieke rekening substitueren.
- Behoud beide scenario-namespaces tot unieke `na`-data expliciet aan maanden is gekoppeld; scenarioverwijdering is geen prerequisite voor het veilige datamodel.
- Behoud de savings-ledgerberekening en bestaande snapshots als regressiecontract. Vermijd automatische openings-/correctieaanvulling tijdens resolverlezingen.
- Hergebruik de Pakket 1-fixtures en breid maandgrens-/historiechecks uit; controleer later de actuele cloudroute en cache-update in een daarvoor geschikte testomgeving.

Er is geen code voor Pakket 2 toegevoegd.
