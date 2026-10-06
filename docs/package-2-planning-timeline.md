# Finize — Pakket 2: technische oplevering

Datum: 5 oktober 2026. Implementatie in de bestaande lokale repository, voortbouwend op de goedgekeurde Pakket-1-werkstand. Schema v11. Geen publicatie, push of wijziging van productie-Firestore uitgevoerd.

## A. INVENTARISATIE

De audit is vóór de vervanging uitgevoerd op de Pakket-1-bronnen, gegenereerde runtime, HTML, CSS, opslag-/cloudcode, importcode, tests en documentatie. De eerdere werkstand is afzonderlijk bewaard voor visuele vergelijking.

| Bestaande structuur | Betekenis / bevinding |
|---|---|
| `recurringFixedExpenses.voor/na` | Vaste lasten met stabiele IDs, recurrence, bedraghistorie en maanduitzonderingen; overige eigenschappen stonden doorgaans alleen op de huidige regel. |
| `amountHistory` | Bedragversies met `effectiveFrom`; zowel maand- als dagkeys kwamen voor. Geen betrouwbare oude historie van naam/eigenaar/categorie. |
| `monthOverrides` | Tijdelijke bedragen per maand. |
| `budgetDefaultsHistory.voor/na[owner]` | Historie van volledige budgetlijsten; geschikt voor toevoegen en beëindigen van categorieën. |
| `monthlyBudgets[month].voor/na` | Zowel door lezen aangemaakte kopieën van defaults als werkelijke afwijkingen; oudere kopieën hadden geen betrouwbaar onderscheidend kenmerk. |
| `incomeDefaultsHistory[owner]` | Handmatig geconfigureerd standaardsalaris en totale vaste teruggaven. |
| `monthlyIncomeOverrides`, `monthlyRefundOverrides` | Bestaande maanduitzonderingen, naast afzonderlijke actual-inkomensvelden. |
| `recurringIncomeSources` | Bestaande individuele inkomsten-/teruggaafplanning met recurrence en bedraghistorie. |
| `monthlySavingOverrides` | Persoonlijke waarden en afzonderlijke sleutels `gezamenlijkVoor/gezamenlijkNa`. |
| `monthRecords`, `closureHistory`, snapshots | Vastgelegde historie; mag niet opnieuw worden berekend door migratie. |

Relevante lezers waren `getMonthlyScenarioData`, `calcScenario`, `ensureMonthData`, `getVariableBudgetDefaultsAt`, `u3FixedOccurrences`, `u3VariableBudgets`, `u3BudgetSummary`, `u3ReserveDelta`, maand-/jaaroverzichten, afsluit-/planningscallers en dashboard/persoonlijke/gezamenlijke kaarten. Import gebruikte scenario voor classificatie, vaste-lastkeuzes, ID-lookup en expliciete planningsaanpassingen.

Editors: oude persoonlijke en gezamenlijke vaste-lastenmodals; `u3OpenPlanning`/`u3OpenRecurringEditor`; de variabele-budgeteditor; persoonlijke en gezamenlijke inkomenseditors; gezamenlijke en persoonlijke spaarplanning. Mobiel en desktop hadden eigen presentatie, maar konden dezelfde beheermodals gebruiken.

Directe huidige-waardelezers betroffen vaste lasten uit scenarioarrays, basisbudgetten en `row.bedrag` in kaart-/planningscallers. Die lezers krijgen nu opgeloste maandconfiguratie. `.bedrag` blijft geldig binnen een reeds opgelost object, transactie, editorconcept of legacy-migratiestap. Oude scenariointerpretatie blijft uitsluitend beschikbaar voor het lezen/converteren/valideren van oude schema's.

## B. DEPENDENCY-AUDIT `NA`

| Dependency | Classificatie | Loskoppeling |
|---|---|---|
| Desktop-/mobiele selector en labels | A/G | Controls en scenariohandlers verwijderd. |
| `getMonthlyScenarioData`, budgetdefaults, `ensureMonthData` | B/H | Eén expliciete maand en vlakke planning; lezen maakt geen budgetscenario-kopieën meer. |
| `calcScenario`, fixed occurrences, samenvattingen, reserve | C/H | Bestaande Voor-formule op opgeloste maandconfiguratie; Na-hypotheekbranch verwijderd. |
| `meta.scenario` en Voor/Na-spaarvelden | D/H | Actieve selectie vervalt; gezamenlijke Voor-override wordt `gezamenlijk`. |
| Closure-/snapshotmetadata en importmanifesten | D/E/H | Bestaande financiële inhoud en provenance blijven exact behouden. |
| Importvoorstellen en vaste-lastdropdown | E/H | Zoeken in de voor de bank-/verwerkingsmaand geldige vaste lasten. Geen wijziging van approval of batch-gating. |
| Vaste-last-ID-lookup en import undo | D/E/H | Actieve flat-list plus niet-financiële legacyverwijzingen; undo herstelt alleen de eigen maandversie. |
| Na-only vaste lasten, budgetten, hypotheek en spaarplanning | F/G | Bewust niet opgenomen in de actieve tijdlijn. Origineel beschikbaar in migratieback-up. |

De actuele productcode heeft geen actieve `state.voor`, `state.na` of `state.meta.scenario` nodig. Sommige functienamen en optionele oude argumenten blijven tijdelijk als compatibiliteitscontract bestaan; zij selecteren geen financieel scenario meer.

In de aanwezige historische Firestore-back-up zijn 41 Voor-regels en 27 Na-regels gevonden. De Voor-regels zijn onafhankelijk behouden. Projectbrede code-audit en scan van die back-up, inclusief zes volledige imports, vonden geen externe actieve verwijzingen naar Na-only IDs. Dat bewijst niet de inhoud van nooit geladen productie-imports; daarvoor blijft lookup-provenance beschikbaar, zonder bedragen of heractivatie. Closures worden niet ontmanteld: hun eventuele scenario-label blijft herkomstmetadata.

Bewuste product-data removal: actieve `na`, Na-recurringconfiguratie, Na-budgethistorie/-maandkopieën, Na-hypotheek en `gezamenlijkNa`. Er is geen effective-from voor Na verzonnen en niets met Voor samengevoegd.

## C. HISTORISCHE RESOLVER

De pure centrale laag staat in `src/core/planning-timeline.mjs`:

- `resolveRecurringConfig` en `resolveRecurringAmount`;
- `resolveFixedExpensesForMonth`;
- `resolveVariableBudgetsForMonth`;
- `resolvePlannedIncomeForMonth` en `resolveIncomeSourcesForMonth`.

Alle readers vereisen een expliciete `YYYY-MM`. De laatste versie waarvan de ingangsmaand kleiner dan of gelijk aan de gevraagde maand is, geldt. Bestaande dagkeys blijven bewaard; binnen één maand geldt de laatst opgeslagen dagversie. Nieuwe versies gebruiken maandkeys. Geen willekeurige IDs, timestamps, actuele datum of viewportafhankelijkheid tijdens reads.

Vaste lasten gebruiken bestaande `amountHistory` met een aanvullende `config`-snapshot. Die bewaart naam, categorie, financiële eigenaar, rekening/context, verdeling, frequentie, begin/einde, administratieve afschrijfdatum en overige aanwezige configuratie. Een maandoverride kan `{amount, config}` bevatten; oude numerieke overrides blijven leesbaar. In de volgende maand vervalt een tijdelijke override vanzelf.

`validFrom` is inclusief; `validUntil` exclusief. Verwijderen vanaf november maakt november en later inactief, maar houdt record en ID beschikbaar. Bestaande exacte begin-/einddatums en recurrence-ankers blijven geldig. Een oude einddatum is inclusief; bestaande occurrence-generatie bewaakt ook de daggrens. Een administratieve betaaldagwijziging verplaatst niet automatisch recurrence-ankers of historische occurrence-IDs.

Budgetten gebruiken dezelfde maandsemantiek op volledige categorielijsten. Een categorie verdwijnt uit toekomstige actieve configuratie door een nieuwe lijstversie, niet door oude transacties te veranderen. Expliciete maandlijsten gaan voor defaults.

Gepland standaardinkomen gebruikt `incomeDefaultsHistory`, met behoud van bestaande handmatige maanduitzonderingen. De bestaande standaard-salarisbron leest dezelfde handmatige planning. Individuele recurring-inkomsten gebruiken hun opgeloste configuratie. Actual-salarisvervanging en teruggaaf-/inkomensaggregatie zijn niet opnieuw ontworpen.

## D. DATAMIGRATIE

De bestaande oplopende `migrateStateData`-route is uitgebreid: legacy → v10 → v11. Een v10-input gaat rechtstreeks door de planningsmigratie; transacties, ledger en closures worden niet opnieuw genormaliseerd. De v10-tussenstap is ook beschikbaar voor de rollbackback-up, binnen dezelfde migratieroute.

Exacte v10 → v11-stappen:

1. Clone invoer en controleer vereiste structuren; conflicterende gereserveerde namen of onbetrouwbare beginmaanden stoppen migratie.
2. Kopieer `voor` naar `planning` en behoud de baselinevelden.
3. Maak `recurringFixedExpenses` een lijst van uitsluitend de bestaande Voor-regels; behoud IDs, bedragen, historie-IDs en ingangskeys.
4. Voeg `validFrom`, provenance en volledige config-snapshots aan bestaande recurring-historie toe; geen nieuwe financiële regels of bedragen.
5. Maak budgethistorie vlak per eigenaar. Haal Voor-maandbudgetten uit hun wrapper. Gemarkeerde of afwijkende lijsten blijven overrides. Ongemarkeerde lijsten die semantisch gelijk zijn aan de toen geldende defaults worden als oude leescache behandeld.
6. Maak `gezamenlijkVoor` → `gezamenlijk`; behoud persoonlijke spaaroverrides.
7. Bewaar Na-only ID/name/context-provenance in `legacyPlanningReferences`, zonder financiële configuratie. Behoud onbekende recurring-containeruitbreidingen in `planning.legacyRecurringExtensions`.
8. Verwijder de hierboven genoemde actieve Na-data, `voor`-wrapper en `meta.scenario`; zet schema op 11 en valideer.

Onbekende overige statevelden, transacties, importgegevens, bankOriginal, doelen, ledger, closures en snapshots blijven behouden. De configgeschiedenis die nooit opgeslagen is, wordt niet achteraf verzonnen: legacy metadata vormt een gemarkeerde basis voor de aanwezige bedraghistorie.

Vóór persistent toepassen bewaart `ensureMigrationBackup` de oorspronkelijke lokale/cloud-/herstelinvoer inclusief Na én de v10-tussenstate in de bestaande, accountgebonden migratieback-upsleutel. De eerste originele kopie wordt niet overschreven. Verschillende latere oude herstelinputs krijgen aanvullende originelen; dezelfde input niet. Opslaan wordt teruggelezen en gecontroleerd. Quota-, validatie- en back-upfouten blokkeren het toepassen; originele opslag blijft bestaan en er worden geen defaults voor corrupte data geladen.

v11 nogmaals migreren valideert en cloneert zonder nieuwe historie, ledgerregels, imports, bedragen of timestampwijzigingen. Het syncprotocol met `syncVersion`, `commitId`, revision en conflict-/rebasebeveiliging blijft intact.

## E. WRITE-SEMANTIEK

| Actie | Centrale write / resultaat |
|---|---|
| Vanaf geselecteerde maand | `setRecurringFromMonth`: volledige configversie; latere versies/andere maandoverrides blijven behouden. |
| Alleen geselecteerde maand | Dezelfde service met `scope: once`; volledige tijdelijke config, daarna terug naar timeline. |
| Toevoegen | Stabiel nieuw ID bij de gebruikersactie, `validFrom` minstens geselecteerde maand; eerdere maanden kennen de regel niet. |
| Verwijderen vanaf maand | `endRecurringFromMonth`: end-exclusive grens; geen record/actual-links verwijderen. |
| Stoppen na maand | De bestaande Stop-route zet de grens op de volgende maand. |
| Eigenaar/categorie/bedrag/frequentie/betaaldag wijzigen | Snapshot via dezelfde service; oude maand houdt oude metadata. |
| Budgetlijst wijzigen/toevoegen/beëindigen | `setBudgetForMonth`, vanaf of alleen maand; geen recategorisatie van transacties. |
| Standaardinkomen wijzigen | `setPlannedIncomeFromMonth`; alleen gekozen manual configuration, actuals blijven apart. |
| Expliciete CSV-planningsaanpassing | `applyFixedPlanningAdjustment`; receipt van uitsluitend doelmaand. Undo controleert conflicts en bewaart toekomstige gebruikersversies. |

Mobiele en desktop editors gebruiken dezelfde writes. De oude vaste-lasteneditors openen de bestaande canonieke editor. De terugkerende inkomensbronnen zijn in de bestaande planningeditor bereikbaar per context, volgens de gekozen implementatie; geen nieuwe kaartindeling. Gesloten-maandbeveiliging blijft gelden.

## F. GEWIJZIGDE BESTANDEN

| Bestand | Wat / waarom / vervangen caller |
|---|---|
| `src/core/planning-timeline.mjs` | Nieuwe gedeelde maandresolver, versie-writes, veilige v11-conversie en gerichte import-undo. Vervangt verspreide planninginterpretatie. |
| `src/core/data-normalization.mjs` | v11 in bestaande migratieroute; v10-read slaat legacy financiële normalisatie over. |
| `src/core/transaction-model.mjs` | Huidige persistente schemaversie 11; canonieke transactieregels ongewijzigd. |
| `src/core/runtime.js` | Maandlezers/overzichten, gedeelde editors, toekomstige maandselectie, scenario-uitfasering, validatie, migratieback-up en herstelguards. Vervangt directe scenarioarrays/destructieve configwrites. |
| `src/import/runtime.js` | Maandgebonden vaste-last-/categoriekeuzes en classifier-input; gerichte planningswrites/undo; ongeldige brondatum blijft bewaard. Geen nieuwe review-engine. |
| `index.html` | Scenario-controls en label verwijderd; onzichtbare niet-interactieve desktopruimte behoudt bestaande kaartposities. Cacheversie bijgewerkt. |
| `service-worker.js` | Cachemarker 97-planning-timeline voor vernieuwde runtime. |
| `app.js` | Opnieuw gegenereerde runtime. |
| `README.md`, `docs/v50-architecture.md` | Actueel schema en timelinearchitectuur gedocumenteerd. |
| `docs/package-2-planning-timeline.md` | Dit verslag. |
| `tests/package2-planning-timeline.test.cjs` | H/B/I/S-tests en aanvullende veiligheidstests. |
| `tests/browser/package2-planning-timeline.spec.cjs` | Echte editors, historie/future/reload, migratieback-upfout, kaartgeometrie en afzonderlijke cloudmock-devicecontext. |
| `tests/browser/desktop-special-tabs.spec.cjs` | Canonieke editor-/historische writes en Voor-baseline zonder selector. |
| `tests/browser/import-listener-stability.spec.cjs` | Flat timelinefixtures; behoud importlisteners/contextkeuzes. |
| `tests/browser/import-review-simplification.spec.cjs` | Flat fixedfixtures; bestaande approval-/reviewasserties behouden. |
| `tests/browser/modal-and-commit-stability.spec.cjs` | Normale planning en vlakke gezamenlijke spaaroverride; bestaande no-op/cloudconflictchecks. |
| `tests/browser/package1-data-foundation.spec.cjs` | Foundationchecks op v11/flatstate; oorspronkelijke back-up-/foutguards behouden. |

De Node-/structuurtests zijn aangepast waar hun VM-harnas losse runtimefragmenten leest: de nieuwe geïmporteerde helpers worden daarin expliciet aangeboden. Schema-/cacheasserties volgen v11/97; legacy financiële checks blijven bestaan. Het technische testbestandregister hieronder vermeldt ieder aangepast testbestand afzonderlijk.

`app.css`, CSS-bronnen, Firestore-regels, Firebase-paden, package dependencies en de layout-renderers zijn niet herontworpen. De reeds aanwezige Pakket-1-bestanden en wijzigingen blijven behouden; niet iedere afwijking van de Git-HEAD is nieuw in Pakket 2.


Technisch testbestandregister (werkstand inclusief behouden Pakket 1; per bestand zijn verwachtingen/harnas aangepast aan de huidige geïntegreerde runtime):

| Bestand | Aanpassing / doel |
|---|---|
| `tests/html-inline-syntax.test.cjs` | Cache 97 / actieve HTML-syntaxcontracten. |
| `tests/service-worker-cache.test.cjs` | Cache 97 / actieve HTML-syntaxcontracten. |
| `tests/update3-administration.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update3-core.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update3-migration.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update4-final-regression.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update4-migration-storage.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update4-stabilization-regression.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update4-undo.test.cjs` | VM/helpercontext en schema-/flatstatecompatibiliteit; bestaande financiële of opslagregressie behouden. |
| `tests/update5-allowance-budget-regression.test.cjs` | Voor-baseline zonder scenarioselectie; bestaande budget-/actual-bedragchecks. |
| `tests/update5-budget-history-saving-overrides.test.cjs` | Vlakke budgethistorie, toekomstige uitzonderingen behouden en gezamenlijk-spaaroverride. |
| `tests/update5-responsive-structure.test.cjs` | Centrale planningreaders/writes en scenario-uitfasering in structuurasserties; layoutcontracten behouden. |

Aanvullende browsercontractbestanden: `tests/browser/update6-account-navigation.spec.cjs` (vervallen scenario-control, bestaande accountrechten), `tests/browser/update6-auth-shell.spec.cjs` (cachemarker), `tests/browser/v50-visual-baseline.spec.cjs` (fixture lokaal houden en actuele productweergave vergelijken). De baseline-afbeeldingen zijn gelijk aan de bestaande referenties; kaartgeometrie is bovendien afzonderlijk met de Pakket-1-runtime gemeten.

## G. TESTRESULTATEN

| Test | Status | Controle |
|---|---|---|
| H1 | PASS | Sep 1807, okt/nov 1850. |
| H2 | PASS | Dec 1850, jan 1900. |
| H3 | PASS | Alleen november 1900; december terug 1850, ook metadata hersteld. |
| H4 | PASS | Nieuw vanaf oktober, niet in september. |
| H5 | PASS | November end-exclusive, record/ID blijft. |
| H6 | PASS | September Dion, oktober gezamenlijk. |
| H7 | PASS | Oude categorie/bedrag/naam/rekening/verdeling behouden. |
| H8 | PASS | Oude betaalmetadata behouden. |
| B1 | PASS | Sep 500, okt 550. |
| B2 | PASS | Januari 600; eerdere maanden en expliciete toekomstige override behouden. |
| B3 | PASS | Nieuwe categorie vanaf oktober. |
| B4 | PASS | Beëindigde categorie vanaf november niet actief. |
| B5 | PASS | Historische transactie blijft Kleding. |
| I1 | PASS | Sep 2600, okt 2700. |
| I2 | PASS | Januariwijziging raakt december niet. |
| S1 | PASS | Voor fixed-IDs behouden. |
| S2 | PASS | Voor budgethistorie behouden. |
| S3 | PASS | Historie/maanduitzonderingen en afwijkende budgetkopieën behouden. |
| S4 | PASS | Ledger en doelen exact gelijk. |
| S5 | PASS | Transacties, bedragen, categorieën, bankOriginal en status exact gelijk. |
| S6 | PASS | Imports en referenties behouden. |
| S7 | PASS | Na-only configuratie niet actief; geen bedragen in lookupmetadata. |
| S8 | PASS | Voor/Na-controls en labels ontbreken. |
| S9 | PASS | Geen actieve Na-branch; legacy conversie blijft. |
| S10 | PASS | Baseline behoeft geen Voor-selectie. |
| S11 | PASS | Closure-/snapshotprovenance en onbekende velden behouden. |
| S12 | PASS | Deterministisch/idempotent; geen nieuwe regels. |

Aanvullend: pure reads/JSON-roundtrip, import-undo/conflict, onbetrouwbare beginmaand, onbekende containerdata, meerdere dagversies in één maand, oude inclusieve einddatum en ongeldige CSV-brondatum: PASS. Nieuw Node-bestand: 34 cases. Alle 36 Node-testbestanden: PASS. JavaScript-syntax: PASS. CSS-parser/tokens: PASS (971 hoofdnodes, geen bekende ontbrekende tokens). Build en generated check: PASS, byte-reproduceerbaar.

Browsertests: 88/88 PASS. De volledige eindbatch leverde 87 PASS en één verouderde scenariofixture op; na omzetting van die laatste fixture naar de vlakke spaaroverride slaagde de gerichte hercontrole (1/1). Geen overige failures of skips. Uitgevoerd met geïsoleerde Chrome-contexten op Windows en Playwright 1.62.1 uit de beschikbare runtime; de repository pin blijft 1.55.0, dependencies zijn niet gewijzigd. Desktop/mobiel openen Dashboard, Gezamenlijk, Dion, Dara, Spaardoelen en Data & back-up; bestaande data/importinformatie blijven bereikbaar. De nieuwe editorchecks veranderen fixed bedrag/naam en budget vanaf een toekomstige maand, bezoeken eerdere maanden, wisselen viewport en herladen. Zij bewaken console/page-errors, stabiele opslag/back-up en geen voortdurende writes. Cloud wordt gemockt; productie-Firestore en echte externe devices zijn niet beschreven.

De Pakket-1-versie en huidige versie zijn met dezelfde fixture vergeleken op 390/768/1024/1440px: kaartposities en afmetingen gelijk. Zes schermen op 390 en 1440 zijn daarnaast vastgelegd voor visuele controle. Geen CSS-layoutwijziging.

Read-only data-audit van de bestaande Firestore-export: 186 transacties, 171 bankOriginal-objecten, 6 import summaries en 6 volledige imports, 9 spaardoelen, 29 savings-ledgerregels blijven behouden. 27 overige top-levelvelden inhoudelijk gelijk. 41 Voor-fixedregels behouden; 27 Na-fixedregels niet actief overgenomen. De 12 oude maandbudgetcachemaanden bevatten uitsluitend kopieën van de toenmalige defaults. Migratie is idempotent; bronbestand ongewijzigd. SHA-256: `af0ad3bb97c315ffe4bfd73e477fc78cb192d9e0d952457c456d5179eb7bc6a5`.

## H. REGRESSIECONTROLE

Transacties gelijk; bedragen gelijk; bankOriginal gelijk; imports/importreferenties gelijk; savingsGoalLedger gelijk; opgeslagen spaardoelbalansen gelijk. Closure-/snapshotinhoud wordt niet herberekend. CSV-status-/approvalchecks slagen; geen automatische goedkeuring toegevoegd. Geen historische recategorisatie, refundverwerking, savings coverage, nieuwe transactiemotor of cloud/importarchitectuur ingevoerd. Geen mobiel/desktop redesign; alleen de expliciet gevraagde scenario-controls/labels vervallen.

## I. OPEN RISICO'S

- Oude niet-opgeslagen metadatahistorie kan niet worden gereconstrueerd. De bestaande metadata vormt de expliciet gemarkeerde legacybasis; nieuwe edits zijn volledig versioned.
- Een ongemarkeerde maandbudgetkopie die identiek aan de toenmalige defaults is, kan technisch niet van een bewust identieke override worden onderscheiden. De gekozen compatibiliteitsregel behandelt die als cache; het complete origineel blijft in de migratieback-up.
- LocalStorage-quota kan de vereiste originele back-up blokkeren. Dan stopt migratie zonder Na uit persistente opslag te verwijderen; geen stil terugvallen op lege state.
- De read-only back-upaudit is een historische export, geen inspectie van alle actuele productiedocumenten. Oude Na-only links in later geladen imports blijven leesbaar als provenance en worden niet opnieuw actief.
- Totale handmatige vaste-teruggaafplanning en individuele bestaande teruggaafbronnen zijn verschillende legacyrepresentaties. Een nieuwe allocatie-/actualregel zou buiten Pakket 2 vallen; de bestaande transactieberekening blijft. Ook bestaande actual-ownerinterpretatie wordt niet vervangen.
- Volledige CSV/cloud-race, batch-gating, split-engine, refunds, savings coverage en één volledige financiële engine blijven voor latere pakketten.
- Sync is met mocks en geïsoleerde browseropslag gecontroleerd. Geen live cross-device Firestoretest of productie-deployment uitgevoerd.

## J. VERVOLG

Technische afhankelijkheden voor Pakket 3: gebruik `planning`/schema v11 en de centrale resolver; behandel nieuwe full-config-versies en end-exclusive levensduur; behoud occurrence-/fixed-IDs en legacy lookup-provenance; actual transactiebedragen/owner/status blijven via Pakket-1-contracten leesbaar; behoud manual planning versus actual en de bestaande ledger-/closure-/syncguards. Eventuele consolidatie van actual inkomsten/teruggaven vereist eerst een expliciet passend transactiemodel. Pakket 3 is niet geïmplementeerd.
