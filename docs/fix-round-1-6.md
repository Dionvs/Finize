# Finize — fixronde 1–6 op v107

## A. Gecontroleerde startcommit / HEAD

Branch `main`, HEAD `ddbe310279591f18214ffac621b3e97bf847842f`. Dit is de opgegeven v107-release, met cachemarker `finize-v107-income-source-details` en schema 11. Er is geen reset, checkout naar een oudere release, commit of publicatie uitgevoerd.

Vóór wijzigingen zijn de actuele source, cumulatieve technische verslagen, definitieve P4/P5/P6/P7-contracten, hotfixverslagen en relevante tests gelezen. De freeze legt HEAD, status en SHA-256 van alle tracked bestanden vast. Elf bestaande testbestanden waren al gemarkeerd als gewijzigd door alleen regeleindes; hun inhoudelijke diff was leeg. Ook `firebase-debug.log` bestond al als untracked bestand. Deze zijn behouden.

Bewijsbestanden en screenshots staan buiten de repository in de lokale werkmap van deze chat. Ze bevatten uitsluitend geïsoleerde testfixtures. De ongewijzigde v107 is voor de vergelijkende testcontrole uit `git archive HEAD` uitgepakt buiten de repository.

## B. Root cause per punt

| Punt | Oorzaak in v107 | Minimale aanpassing | Impactgrens |
|---|---|---|---|
| 1 | `renderPersonalFirstRow` gaf mobiel een savingsbedrag met `data-personal-saving-edit`; desktop toonde de centrale persoonlijke beschikbare middelen. | Mobiele kaart leest eveneens `r.forecast.owners[owner].available`, toont Over deze maand en dezelfde hint, zonder editactie. | Alleen presentatie; bestaande privacyflag behouden. |
| 2 | Mobiele accounttabs gebruikten de aparte goal-card-preview, desktop gebruikte `renderDesktopGoalsPreview` en `renderGoalOverviewTable`. | Beide account-renderers gebruiken de bestaande tabel; beperkte horizontale scrollcontainer op mobiel. | Geen savingsberekening of dashboardpreview gewijzigd. |
| 3 | `index.html` was geldig UTF-8 maar bevatte al verkeerd gedecodeerde literals `â€¦` en `â€¹`. De builder leest UTF-8 en esbuild heeft `charset: utf8`. | Werkelijke ellipsis en chevron hersteld. | Geen pipeline-, tekst- of laadschermredesign. |
| 4 | Parent-, split-, bulk- en kopieerflows resetten typegebonden processingvelden niet consequent. Refundcategorie was vrije tekst. | Gedeelde typeovergang en centrale historische categoriedropdown. | P4-projectie, overflow- en dependencyregels behouden. |
| 5 | Processingdatum en fixed occurrence werden als volledige datums gepresenteerd; een occurrence werd niet consequent uit de bankmaand geïnitialiseerd. | Maandveld met default uit bankOriginal; vaste last via centrale occurrence resolver, automatisch alleen bij één geldige occurrence. | Bankdatum en occurrence blijven aparte dimensies. |
| 6 | Per-field persistence en meerdere async commits/hydraties konden een editor op een oude baseVersion of eerder gelezen operation houden. | Duurzaam lokaal editorjournal, geserialiseerde commitmomenten, bewezen eigen receipt-adoptie en hydration guards. | CAS, versioned chunks, conflictresolutie en financiële engine behouden. |

De v106→v107-diff bevatte geen wijziging in de import- en storageprotocollen. De inkomensrelease heeft dus niet een nieuwe importwriter geïntroduceerd.

## C. Bewezen oorzaak van self-conflicts

Twee afzonderlijke races zijn op de exacte ongewijzigde v107-runtime gereproduceerd:

1. **Eigen receipt met oude editorbase.** Eigen versie 2 wordt gepubliceerd. `ImportStore.confirmCloudReceipt` zet de opgeslagen base op 2, maar het geopende editorobject houdt baseVersion 0. De volgende lokale wijziging wordt versie 3 met base 0. `assertImportBase(cloudVersion2, localVersion3)` weigert terecht die stale base en rapporteert `import-conflict`. De fout was dat de editor zijn bewezen eigen receipt niet overnam; CAS zelf was correct.
2. **Async hydration retourneert eerdere eigen state.** Resolver start met versie 2. Tijdens zijn await voltooit de eigen approval versie 3. De resolver retourneert nog versie 2 als echo. Zonder een guard voor editorrevision én base-operation kon de UI die eerdere verwerking opnieuw presenteren, waarna vervolgacties stale werden.

V107 kopieerde gewone veldwijzigingen bovendien na een debounce naar de canonieke batch/summary/core/outbox. Herkenningsacties met meerdere matches en snel opeenvolgende approvals kwamen daardoor in dezelfde persistenceketen terecht als cloudhydration.

De fix slaat per-field wijzigingen alleen op als `editor-draft` in het bestaande lokale journal. Iedere batch heeft een editorbase, lokale revision, seriële lokale writeketen en seriële commitketen. Een volgende commit neemt uitsluitend een bewezen eigen operation receipt over. Een andere operation, ook bij gelijke versie, blijft een conflict. Async reads worden niet over een nieuwere editorrevision, nieuwere base-operation of lopende commit heen geadopteerd.

Dit is geen timerfix of LWW. De bestaande cloud-CAS wordt nog steeds uitgevoerd. Reproduceerbare bewijsuitvoer: `v107-race-proof.json` in de externe werkmap; gerichte regressies in `tests/fix-round-1-6.test.cjs` en de slow-hydration browsertest.

## D. Gewijzigde bestanden

| Bestand | Wijziging / reden |
|---|---|
| `src/core/runtime.js` | Drie minimale renderaanpassingen: persoonlijke mobiele KPI en twee mobiele account-goaltabellen. |
| `src/styles/base.css` | Zeven regels, uitsluitend account-goaltabelscroll en bestaande actiebalk op mobiel. |
| `index.html` | Twee aantoonbaar verkeerd gecodeerde statische tekens. |
| `src/import/runtime.js` | Typeovergangen, centrale refunddropdown, fixed maand-UI en lokale editor-/commitcoördinatie. |
| `src/core/transaction-processing.mjs` | Kleine compositiecommand voor gezamenlijke reopen/replacement/preflight van expliciet geselecteerde sources. |
| `app.js`, `app.css` | Reproduceerbare gegenereerde output van bovenstaande sources. |
| `tests/fix-round-1-6.test.cjs` | 33 gerichte Node-cases. |
| `tests/browser/fix-round-1-6.spec.cjs` | 12 browsercases op 390/1440px en async hydration. |
| `tests/browser/package4-savings-refunds-forecast.spec.cjs` | Bestaande CSV-refundtest selecteert de aangevraagde dropdown met `selectOption`; alle inhoudelijke assertions behouden. |
| `tests/browser/package1-data-foundation.spec.cjs` | Na afzonderlijke toestemming: oude cloudmock uitgebreid voor echte chunk/generation-hydration en twee onafhankelijke browsercontexts. Bestaande write/schema-assertions behouden; back-up, volledige device-state, forecast/effects en echo-gelijkheid toegevoegd. |
| `tests/browser/package2-planning-timeline.spec.cjs` | Na toestemming: 1024px-hoogte 132 uit ongewijzigde v107; bestaande toleranties behouden, netwerk beperkt tot loopback. |
| `tests/browser/v50-visual-baseline.spec.cjs` | Testnetwerk uitsluitend loopback; snapshotassertion en pixeltolerantie ongewijzigd. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-768.png` | Handmatig beoordeelde v107-capture; alleen oude Voor/Na en oude incomehint verschillen. |
| `tests/browser/v50-visual-baseline.spec.cjs-snapshots/v50-1024.png` | Handmatig beoordeelde v107-capture; oude scenario-controls en incomehint vervangen door de reeds gepubliceerde presentatie. |
| `docs/audit/fix-round-1-6-test-baseline.json` | Herkomstcommit, oude/nieuwe screenshot-SHA-256, gemeten kaartgrenzen en handmatige goedkeuring vastgelegd. |
| `docs/fix-round-1-6.md` | Dit technische verslag. |
| `docs/audit/fix-round-1-6-verification.json` | Machineleesbaar lokaal verificatieresultaat. |

Er is geen legacyroute verwijderd. De al aanwezige regeleindemarkeringen en debuglog zijn geen onderdeel van deze fix.

## E. Gewijzigde functies / modules

- Core presentatie: `renderPersonalFirstRow`, mobiele gezamenlijke/persoonlijke renderers; hergebruik van `renderDesktopGoalsPreview` → `renderGoalOverviewTable`.
- Typeverwerking: `setProcessingType`, `applyTransactionFamily`, copied processing, split- en bulkhandlers. Bij wisselen worden oude fixed-, savings-, refund-, transfer- en repaymentvelden gereset; originele sourcevelden blijven staan.
- Fixed/refund-UI: `selectFixedOccurrence`, `refundFieldsHtml`, maand-/categoriehandlers. Historische categorieën blijven via de centrale herkenbaarheidscontrole bereikbaar.
- Editor: `sameEditorBase`, `beginImportEditor`, `persistLocalImportEditor`, `commitImportEditor`, `acknowledgeRecoveredEditor`, guards in `openDraft`/refresh, save/close/approval/group/lifecyclehandlers.
- Commands: uitbreiding van `commitImportCommandUnlocked` met `editor-commit`; `commitProcessedSourceGroup` composeert bestaande source-reopen/replacement en savingsreconciliation op één clone met één volledige eindpreflight.

Een expliciet geselecteerde groep wordt atomair getoetst. Expense plus refund worden bijvoorbeeld op de volledige resulterende categoriebelasting gevalideerd, niet op een tijdelijke refund-first toestand. Een gewijzigde approved source retireert eerst uitsluitend zijn oude eigen effecten binnen dezelfde candidate. Afhankelijke repayments blokkeren vóór mutatie.

## F. Nieuwe tests per punt / verplichte matrix

De nieuwe Node-suite bevat 33 cases; de nieuwe browsersuite 12 cases. Onderstaande IDs zijn de 59 verplichte controles uit de opdracht, geen 59 extra afzonderlijke testfuncties. Meerdere controles worden gezamenlijk bewezen door één flow en bestaande regressies.

| ID | Controle | Uitkomst / bewijs |
|---|---|---|
| 1 | Dion mobiel Over deze maand = desktop | PASS — F1 selector + viewport parity |
| 2 | Dara mobiel Over deze maand = desktop | PASS — F1 selector + viewport parity |
| 3 | KPI opent geen savingseditor | PASS — geen editattribute; dezelfde centrale value |
| 4 | Savingsedit via goals | PASS — 390/1440, beide persoonlijke editors |
| 5 | Dashboardpreview behouden | PASS — dashboardcards en statevergelijking |
| 6 | Gezamenlijk tabel | PASS — 10 kolommen + totaal |
| 7 | Dion tabel | PASS — 10 kolommen + totaal |
| 8 | Dara tabel | PASS — 10 kolommen + totaal |
| 9 | Mobiel dezelfde tabeldata | PASS — identieke tekst en centrale output bij viewportwissel |
| 10 | Savingsplanedit bereikbaar | PASS — openen/annuleren; bestaande planningedittests groen |
| 11 | Loadingellipsis | PASS — UTF-8 statische test |
| 12 | Geen bekende loadingmojibake | PASS — gerichte literalcontrole |
| 13 | Expense → savings | PASS — transition Node/browser |
| 14 | Savings → expense | PASS — transition Node/browser |
| 15 | Savings → refund | PASS — transition Node/browser |
| 16 | Refund → savings | PASS — transition Node/browser |
| 17 | Expense → refund | PASS — transition Node/browser |
| 18 | Refund → expense | PASS — transition Node/browser |
| 19 | Stale typevelden nul effect | PASS — parent/split cleanup + directe reclassification |
| 20 | Refundcategorie dropdown | PASS — centrale historische lijst op beide viewports |
| 21 | Refund corrigeert gekozen maand | PASS — P4 + gerichte 120−40=80 case |
| 22 | Refund geen inkomen | PASS — incomeImpact 0 |
| 23 | Refund bankmaand blijft ontvangst | PASS — cashflow in oktober, correctie september |
| 24 | Expense onveranderd | PASS — deepEqual oorspronkelijke expense |
| 25 | Sept17 → september occurrence | PASS — centrale resolver |
| 26 | Geen verplichte dag01 invoer | PASS — automatisch geldige occurrence en maandinput |
| 27 | Andere occurrence maand | PASS — oktober selecteerbaar |
| 28 | BankOriginal immutable | PASS — deepEqual + browser sourcecapture |
| 29 | Fixed realization occurrence maand | PASS — gerichte projectiontest |
| 30 | Bankcashflow werkelijke maand | PASS — centrale engine, aparte dimension |
| 31 | Lokale edit geen core/cloudcommit | PASS — journal only, commitcounter 0 |
| 32 | Meerdere edits geen concurrentwrites | PASS — 20 lokale edits, seriële keten |
| 33 | Herkenningsregel meerdere matches | PASS — 19 voorstellen, geen self-conflict |
| 34 | Groepsapproval consistente batch | PASS — één commit en volledige candidatepreflight |
| 35 | Volgende regel zonder heropenen | PASS — group + next-source flow |
| 36 | Save/close synchroniseert concept | PASS — approved edit blijft oud tot close/save, daarna review |
| 37 | Proposal financieel inactief | PASS — transactions/core blijven ongewijzigd |
| 38 | Eigen echo geen conflict | PASS — receipt en vertraagde hydration |
| 39 | Echte andere operation conflict | PASS — stale remote en gelijke versie/andere operation |
| 40 | Lokale keuze behouden | PASS — conflictjournal exact bewaarde note |
| 41 | CAS actief | PASS — `assertImportBase` en P5-contracttests |
| 42 | Identieke state geen generation | PASS — nooptest + Sync Hotfix 3 |
| 43 | Geen publishable intent geen coresave | PASS — stage.stages leeg, outbox leeg |
| 44 | Chunkreload geen write | PASS — bestaande storage/sync hotfix browsercases |
| 45 | Geen sync-loop | PASS — bestaande Sync Hotfix 3 suite |
| 46 | Dashboard income breakdown | PASS — bestaande income-overview suite |
| 47 | Joint income breakdown | PASS — dezelfde suite |
| 48 | Mobiele income modal | PASS — dezelfde suite |
| 49 | Eén salaryregel incl expliciet0 | PASS — income-overview + income Node |
| 50 | Alleen aanvullende bronnen in totaal | PASS — bestaande centexact incomecontracten |
| 51 | Dion breakdown | PASS — income-overview |
| 52 | Dara breakdown | PASS — income-overview |
| 53 | Persoonlijke incomeeditor | PASS — bestaande browserregressie |
| 54 | Bronklik actieve transacties | PASS — bestaande source-detail cases |
| 55 | Meerdere source-transacties | PASS — bestaande source-detail cases |
| 56 | Splits | PASS — bestaande split-source cases |
| 57 | Planningbron geen verzonnen tx | PASS — bestaande planning-only details |
| 58 | Privacy persoonlijke details | PASS — bestaande income privacy + KPIflag |
| 59 | Bronview geen save | PASS — bestaande deepEqual/writecounter |

Extra audit-derived cases: edit tijdens async commit, interrupted journal recovery, terminal deleted guard, historische unversioned batch compatibility, profilecontextbehoud, directe approved reclassification en afhankelijk repaymentconflict.

## G. Totale Node-resultaten

**49/49 testbestanden PASS; 462/462 geregistreerde node:test-cases PASS.** De file runner omvat daarnaast bestaande scripts met eigen assertions zonder node:test-registratie. Nieuwe suite: **33/33 PASS**. Geen failure, skip of cancellation.

P1–P7, income/source-details, import/lifecycle, storagehotfixes en Sync Hotfix 3 zijn inbegrepen. Geen assertion of tolerantie versoepeld.

## H. Totale browser-resultaten

Laatste volledige run na het afzonderlijk geautoriseerde testherstel: **203/203 PASS; 0 failures, 0 skips, 0 flaky cases**. Nieuwe fixsuite: **12/12 PASS** op 390px en 1440px. Gerichte testblockercontrole: **9/9 PASS** (cloud, kaartmaten, zes screenshots en computed styles).

De eerste volledige fixronde eindigde met 199/203 PASS. De vier failures zijn eerst alle vier gereproduceerd op ongewijzigde v107. Vervolgens heeft de gebruiker afzonderlijk toestemming gegeven om deze testblockers te herstellen:

| Test | Oorspronkelijke failure | Gecontroleerd herstel |
|---|---|---|
| `package1-data-foundation.spec.cjs` | Twee-device cloudmigratie timeout: oude mock miste doc/getDoc/setDoc/updateDoc en chunked generation-contract. | Mock voert nu het werkelijke chunked contract uit. Device A migreert één keer naar v11/syncVersion4; originele cloudback-up exact gelijk; echo verandert geen clouddocument. Device B heeft eigen browserstorage, leest dezelfde chunks en schrijft nul keer. Volledige gerenderde state, forecast en effects A/B gelijk. |
| `package2-planning-timeline.spec.cjs` | Verouderde 1024px-hoogte 140,375. | Gemeten op ongewijzigde v107: y164, hoogte132. Alleen die verwachting aangepast; toleranties niet vergroot. |
| `v50-visual-baseline.spec.cjs`, 768px | 1.508 afwijkende pixels t.o.v. oude snapshot. | Nieuwe referentie uitsluitend uit ongewijzigde v107: scenario-controls terecht verdwenen en reeds gepubliceerde income breakdown zichtbaar. |
| `v50-visual-baseline.spec.cjs`, 1024px | 30.332 afwijkende pixels t.o.v. oude snapshot. | Zelfde handmatige beoordeling; juiste v107-presentatie overgenomen. |

Alle zes dashboardcaptures (360, 390, 430, 768, 1024, 1440px) zijn na gecontroleerde offline boot **bytegelijk tussen ongewijzigde v107 en de lokale fix**. Dit bewijst dat geen nieuw UI-gedrag in deze snapshots is geaccepteerd. De twee vernieuwde screenshots zijn bekeken vóór ze individueel naar de snapshotbestanden zijn gekopieerd. Er is geen `--update-snapshots` gebruikt. De andere vier screenshots zijn ongewijzigd. Alle oude/nieuwe hashes en exacte kaartgrenzen staan in `docs/audit/fix-round-1-6-test-baseline.json`.

Geen snapshotassertion, pixeltolerantie of financiële assertion is versoepeld. Geen skip of retry toegevoegd. SDK- en overige externe requests zijn in de herstelde tests geblokkeerd; alleen loopback wordt toegelaten.

Bij de eerste nieuwe UI-baselinecapture was de synthetische fixture gewijzigd maar nog niet gerenderd. De fixture wordt vóór de eerste meting gerenderd; volledige state/effects/forecast equality blijft onverkort asserted. De twee-device cloudtest vergelijkt eveneens de volledig gerenderde state van beide devices, zodat de bestaande lege maandbucket-init geen vergelijking van raw cloudpayload met gerenderde UI-state veroorzaakt.

## I. Build / syntax / CSS / runtime

- `node scripts/check-syntax.mjs`: PASS.
- `node scripts/check-css.mjs`: PASS; 976 rootnodes, 0 ongedefinieerde tokens.
- `node scripts/build.mjs`: PASS.
- `node scripts/build.mjs --check`: PASS; gegenereerde output byte-reproduceerbaar.
- `git diff --check`: PASS.
- CSS uitsluitend zeven account-goaltabelregels; geen kleuren, kaarten, navigatie of algemene spacing gewijzigd.

Kaartbeelden handmatig beoordeeld: persoonlijke mobiele/desktop accounts, gezamenlijke accounts, horizontaal gescrollde tabel en fixed maandmodal. De bestaande compacte mobiele KPI-layout blijft behouden. De lange hint staat volledig in de DOM; binnen de bestaande kleine kaarten is beperkte zichtbare ruimte, zoals bij andere lange KPI-inhoud. Geen redesign uitgevoerd.

## J. Financiële baselinevergelijking

Freeze vóór implementatie en nacapture gebruiken exact dezelfde geïsoleerde P5/P4-fixture. De volledige persistent state, alle transaction projections en centrale forecast zijn recursief **exact gelijk** zonder nieuwe gebruikersactie. Dit omvat bankOriginal, imports/lifecycle, planninghistories, ledger/allocations, replacements/pairs, advances en closuredata.

| Dimensie (oktober 2026) | Vóór | Na |
|---|---:|---:|
| Accountcashflow | 2.050,00 | 2.050,00 |
| Householdcashflow | 2.050,00 | 2.050,00 |
| External householdcashflow | 2.300,00 | 2.300,00 |
| Actual income / incomeImpact | 2.600,00 | 2.600,00 |
| RealExpense | 300,00 | 300,00 |
| BudgetImpact | 300,00 | 300,00 |
| FixedRealization | 0,00 | 0,00 |
| Werkelijke savings deposit / goal delta | 250,00 | 250,00 |
| Refund correction | 0,00 | 0,00 |
| Forecast household income | 4.600,00 | 4.600,00 |
| Forecast household available | 4.050,00 | 4.050,00 |
| Dion zakgeld / available | 2.176,09 | 2.176,09 |
| Dara zakgeld / available | 1.673,91 | 1.673,91 |
| Joint available na zakgeld | 200,00 | 200,00 |
| Geplande budgetreserve | 500,00 | 500,00 |
| Geplande gezamenlijke savingsreserve | 250,00 | 250,00 |

Geen scenario teruggebracht. Canonieke engine, planningtimeline, transactionmodel en financiële formules zijn hash-ongewijzigd. Bij expliciete reclassification/approval veranderen alleen de volgens bestaande regels bedoelde effecten (categorie A); renderen verandert niets. Baseline zonder actie: **A=0, B=0, C=0**. De bekende oudere testcontractfailures worden afzonderlijk gerapporteerd, niet als nieuwe financiële regressie weggeschreven.

## K. V107 inkomensfunctionaliteit

Behouden: gezamenlijke breakdowns en mobiele read-only modal, persoonlijke breakdowns/editor, salarisprecedence incl expliciet0, bronlabels en actieve sourcetransacties, meerdere transacties/splits, planning-only uitleg en privacy. Income/source-detailfuncties zijn inhoudelijk niet gewijzigd. De bestaande income-overview browser- en Node-regressies zijn groen; bronview schrijft geen state/cloud.

## L. Immutable bankOriginal / source-data

Originele bankdate, amount, description, rawcells en source-identiteiten blijven ongewijzigd. Typeovergangen en occurrence-keuze muteren uitsluitend processing. De commit controleert brondata vóór journal/coremutatie. Tests vergelijken originele sourceobjecten exact. De bankdatum wordt read-only getoond; occurrence wordt als maand getoond en mag afwijken.

## M. Schema

**11 → 11**. Geen migratie, geen nieuwe persistente schemaroute, geen identitygeneratie bij read/render. Lokale concepten gebruiken het bestaande journalcontract. Expliciet opgeslagen unversioned batches blijven via vergelijking van hun volledige opgeslagen base leesbaar; er wordt geen bankveldenidentiteit gegokt.

## N. CAS / echte conflictbeveiliging

CAS/baseVersion en immutable operation generations blijven intact. Er is geen LWW, blind overwrite of conflictbypass. Alleen bewezen eigen receipts worden geadopteerd. Een andere operation/version blokkeert commit vóór financiële mutatie en bewaart de lokale keuze veilig. Cloudstand en expliciete cloud/local conflictkeuze blijven via P5 werken. Terminal tombstones blokkeren opnieuw opgeslagen lokale payload.

## O. Sync Hotfix 3

Behouden en getest: eigen commit-herkenning na async hydration, zero-publishable intent zonder coresave, no-opguard, CAS, geen generation bij identieke state, chunkreload zonder write, geen syncVersion/generation-loop en adoptie van echte latere remote commits. Opslagprotocol-, cloud-state-, import-sync- en Firestore rules-bestanden zijn ongewijzigd.

## P. Productie / publicatie

Productie-financiële data gewijzigd: **nee**. Productie-Firestore gebruikt: **nee**. Echte CSV geïmporteerd: **nee**. Testdata naar productie: **nee**. Closures/snapshots herschreven: **nee**. Commit: **nee**. Push: **nee**. Deploy/rulesdeployment: **nee**.

## Q. Resterende risico’s

1. De vier oude testblockers zijn na afzonderlijke toestemming hersteld; zie H. De Windows-pixelsuite blijft afhankelijk van hetzelfde platform/letterrendering als de bestaande suite. Deze ronde is op Windows uitgevoerd.
2. Lokale editorconcepten zijn apparaat-/householdgebonden en worden pas op expliciete commitmomenten gedeeld. Bij verlies van browseropslag vóór commit blijft een niet-gepubliceerd concept lokaal kwetsbaar; dit is geen cloudapproval.
3. Legacy CSV zonder betrouwbare source identity behoudt de bestaande safety guard. Geen heuristische reconstructie uitgevoerd.
4. Een open lokaal bewerkte editor wordt niet stil overschreven door refresh. Een echte andere batchcommit wordt bij de volgende eigen commit als conflict getoetst; de lokale keuze blijft bewaard.
5. Cachemarker is bewust nog v107: dit is een lokale, niet-gepubliceerde wijziging. Een eventueel later geautoriseerde release vereist een nieuwe consistente marker/assetrelease.
6. De bestaande compacte persoonlijke mobiele KPI heeft beperkte ruimte voor lange hints; de betekenis, centrale waarde en volledige hinttekst zijn behouden zonder kaartredesign.

## R. Vragen / niet zelfstandig ingevulde beslissingen

Twee eerder besproken keuzes zijn verwerkt: gewijzigde approved sources houden hun oude financiële effecten tot expliciet opslaan/sluiten/goedkeuren; een expliciet geselecteerde groep mag atomair goedgekeurd worden. Herkenning zelf keurt niets goed.

De gebruiker heeft vervolgens afzonderlijk toestemming gegeven voor herstel van de vier oude testblockers. Er is geen financiële of UX-productregel gewijzigd en er zijn geen resterende vragen. Die toestemming betrof uitsluitend lokale testcorrecties, geen publicatie.

**RELEASEBEOORDELING: READY**

De eerdere NOT READY-status wegens vier oude browserblockers is historisch vastgelegd in de externe verificatiecapture. Na het afzonderlijk geautoriseerde testherstel zijn 49/49 Node-bestanden, 462/462 geregistreerde Node-cases en 203/203 browsercases groen. Syntax, CSS, build en byte-reproduceerbaarheid zijn opnieuw gecontroleerd. Financiële baseline C=0, schema11, CAS, inkomensfunctionaliteit en Sync Hotfix3 blijven intact. Deze extra ronde heeft geen runtime/source/CSS gewijzigd. READY betreft de lokale wijziging voor beoordeling; commit, push en publicatie zijn niet uitgevoerd.
