# Finize v50 — code-audit en voorbereiding volledige opschoning

**Status:** audit-only
**Referentieversie:** v50 `finize-v50-icon-system`
**Belangrijk:** tijdens deze audit zijn geen appbestanden, berekeningen, state, Firebase-regels of weergaven gewijzigd. De mislukte v51/v52-layoutwijzigingen vallen buiten de referentieversie.

## 1. Doel en afbakening

Deze audit brengt de huidige technische toestand van Finize in kaart voordat een volledige opschoning wordt uitgevoerd. Het doel is niet om de app opnieuw te ontwerpen, maar om de bestaande werking en weergave reproduceerbaar te behouden terwijl dubbele, conflicterende en vermoedelijk dode code later gecontroleerd kan worden verwijderd.

Gecontroleerd:

- actieve HTML, inline CSS en inline JavaScript;
- `update4.js` en `update4.css`;
- `update5.js` en `update5.css` als tablet-/desktoplaag;
- opslag, state, migraties en cloudsync;
- bankimport en importmodal;
- service worker en PWA-app-shell;
- Firestore-regels;
- manifest;
- repository- en releasehygiëne;
- syntax, statische HTML-structuur, CSS-parser en opvallende runtime-risico’s.

Niet gewijzigd:

- financiële formules;
- opgeslagen gebruikersdata;
- Firestore-documenten;
- GitHub-bestanden;
- CSS;
- JavaScript;
- service worker;
- Firebase-regels.

## 2. Bevroren auditbasis

| Bestand | SHA-256 |
|---|---|
| `index.html` | `92ae487875d88358193005476672538fd7d9b7977c111445ae0cad734f424c69` |
| `update4.js` | `f9fb3000507b7af4bdc8747bca8ab0dfb8f69102303716227adc00b7b56a5215` |
| `update4.css` | `db7eafb2aca30f0eed973b0e3bbeb4c299894955cd8218ec73200fa5fe25c5a7` |
| `service-worker.js` | `b8db43bbb8992a35e80b86f57f765c689ea37d2b6235a53a1a38e751f6262995` |
| `firebase.json` | `e87125f3ec6439a59ba44d80a6dcc46378a27a0644b0cda30abeafd2efb67e20` |
| `firestore.rules` | `e08800c22d8dc555640a2ff9da60a18a526e29dc7eb113d9607f0140bd51bfd9` |
| `README.md` | `7f6aef9a9465d5181e37f096aeeddf9318922344b86941f81046f04e96d40713` |

Deze hashes moeten worden bewaard naast de toekomstige opschoonbranch. Daarmee kan altijd worden vastgesteld of een “alleen opschonen”-commit inhoudelijk buiten de afgesproken scope is gegaan.

## 3. Actieve laadketen

De huidige app bestaat functioneel uit meerdere lagen die elkaar achteraf aanpassen:

1. `index.html`
   - basis-HTML;
   - ongeveer 206 kB inline CSS;
   - ongeveer 742 kB inline JavaScript;
   - kernstate, berekeningen, opslag, rendering en veel oudere updateblokken.
2. `update4.css`
   - bankimport en latere importdialogcorrecties.
3. `update5.css`
   - tablet- en desktopweergave vanaf 768 px.
4. `update4.js`
   - huidige CSV-import, IndexedDB-importopslag, importchunks, herstel en sync.
5. `update5.js`
   - tablet-/desktop-presentatie en alternatieve spaardoelenweergave.
6. `service-worker.js`
   - cache en offline app-shell.
7. Firestore
   - hoofdstate in één document;
   - importheaders en importchunks in subcollecties.

De kern van het onderhoudsprobleem is dat latere lagen bestaande functies en CSS niet alleen aanvullen, maar geregeld overschrijven. Daardoor is de uiteindelijke werking afhankelijk van bronvolgorde, specificiteit, `!important` en het moment waarop scripts worden geladen.

## 4. Kwantitatieve nulmeting

| Onderdeel | Gemeten omvang |
|---|---:|
| `index.html` | 953.053 bytes / 11.517 regels |
| Inline CSS in `index.html` | 206.347 tekens / 5.365 regels |
| Inline JavaScript in `index.html` | 741.548 tekens |
| Grootste inline kernscript | 6.042 regels |
| `update4.js` | 125.444 bytes / 1.817 regels |
| `update4.css` | 14.436 bytes / 226 regels |
| CSS-regels in grootste inline stijlblok | 1.290 |
| Dubbele selectors in exact dezelfde CSS-context | 81 |
| `!important` in grootste inline stijlblok | 1.621 |
| `innerHTML =`-toewijzingen in kern + Update 4 | 59 |
| `addEventListener` in kern + Update 4 | 183 |
| `alert()`-aanroepen | 44 |
| `confirm()`-aanroepen | 10 |

De hoeveelheid code is op zichzelf niet het hoofdprobleem. Het probleem is de combinatie van:

- veel verantwoordelijkheid in één HTML-bestand;
- herhaalde definities;
- globale mutable state;
- veel volledige re-renders;
- veel afzonderlijk gekoppelde eventlisteners;
- zware CSS-specificiteit en `!important`;
- achteraf aangebrachte monkey patches.

## 5. Positieve bevindingen

De codebase is niet “kapot” of waardeloos. Er zijn meerdere goede fundamenten die bij de opschoning behouden moeten blijven:

- JavaScript-syntaxcontrole slaagt voor het kernscript en `update4.js`.
- De CSS-parser vindt geen structurele syntaxfouten.
- De statische HTML bevat geen dubbele IDs.
- Er zijn geen inline `onclick`-attributen en geen `eval`.
- Er bestaan statevalidatie, migraties en herstelpaden.
- Voor een migratie of cloudconflict wordt een lokale back-up gemaakt.
- De importopslag gebruikt IndexedDB, een journal en een aparte syncqueue.
- Cloudimports worden opgesplitst in chunks en gecontroleerd op aantal regels en checksum.
- Importchunks worden vóór de header geschreven, waardoor een half afgemaakte upload minder snel als compleet wordt gezien.
- De importcloudsync heeft een centrale actieve promise-lock.
- `textSafe()` en `esc()` bestaan al; de ontbrekende stap is consequente toepassing.
- De service worker is klein en daardoor goed te vervangen zonder apparchitectuur te herschrijven.
- De tablet-/desktoplaag zit grotendeels apart in `update5.*`, wat een bruikbare toekomstige modulegrens is.

## 6. Bevindingen op prioriteit

### P0 — beveiliging en data-eigendom

#### SEC-001 — Firestore is publiek leesbaar en schrijfbaar

`firestore.rules` staat voor het hoofddocument, importheaders en importchunks `allow read, write: if true` toe (`firestore.rules:6–15`).

Impact:

- iedere bezoeker die project-ID en vaste documentpaden kent, kan financiële data lezen;
- data kan worden overschreven of verwijderd;
- importdetails kunnen worden gelezen of gemanipuleerd;
- de openbare Firebase-webconfiguratie is niet het probleem; de regels zijn het probleem.

Voor veilige opschoning:

1. eerst authenticatie of een ander expliciet toegangsmodel ontwerpen;
2. daarna regels per gebruiker of huishouden afschermen;
3. pas na migratietest de publieke regels sluiten;
4. herstelprocedure en back-up vooraf testen.

Dit is de enige bevinding die niet alleen onderhoudbaarheid, maar direct gegevensbescherming raakt.

#### SEC-002 — niet alle dynamische HTML wordt escaped

Voorbeelden in `index.html`:

- `renderTransactionsTable()` plaatst `tx.category`, `tx.description`, `tx.note` en `tx.id` rechtstreeks in een template (`index.html:8376–8384`);
- `renderBudgetUsageList()` plaatst `row.post` en `row.categorie` rechtstreeks in HTML (`index.html:8393–8401`).

Andere onderdelen gebruiken `textSafe()` wel. De toepassing is dus inconsistent.

Impact:

- CSV-tekst of gemanipuleerde clouddata kan als HTML worden geïnterpreteerd;
- door de publieke Firestore-regels wordt dit risico groter.

Opschoonactie:

- één verplichte escape-helper voor tekstnodes;
- één veilige builder voor attributen;
- geen user-/CSV-data rechtstreeks in `innerHTML`;
- regressietest met `<img onerror=...>` als onschadelijke teststring.

### P1 — stabiliteit en incidenteel vastlopen

#### STAB-001 — eventlisteners stapelen zich op in de bankimportmodal

`renderDraftModal()` gebruikt steeds hetzelfde `#u4ImportModalRoot`, vervangt de `innerHTML` en roept daarna opnieuw `bindDraftModal()` aan (`update4.js:1426–1445`).

`bindDraftModal()` koppelt vervolgens opnieuw gedelegeerde `change`- en `click`-listeners direct aan dat blijvende root-element (`update4.js:1543–1583`).

Omdat het root-element niet wordt vervangen, blijven eerdere listeners bestaan. Een nieuwe render kan daardoor meerdere handlers op dezelfde gebruikersactie activeren.

Dit past bij de gemelde symptomen:

- incidenteel vastlopen;
- acties die soms dubbel lopen;
- steeds zwaardere import na meerdere bewerkingen;
- niet-reproduceerbaar verschil tussen de eerste en latere interacties.

Veilige oplossing:

- listeners exact één keer koppelen bij `ensureModalRoot()`;
- actuele draft via `UI.draft` ophalen in de handler;
- of bij iedere bind een `AbortController` gebruiken en de vorige controller aborten;
- test na 50 re-renders dat precies één click- en één change-handler actief is.

#### STAB-002 — dubbele inputevents veroorzaken dubbele opslag

In `bindInputs()`:

- checkboxes krijgen zowel `change` als `click` met dezelfde commitfunctie (`index.html:7811–7847`);
- andere itemvelden krijgen zowel `change` als `blur` (`index.html:7848–7866`).

Een normale handeling kan daardoor twee keer:

- de state valideren;
- de revision verhogen;
- de volledige state opslaan;
- cloudsync starten;
- rendering triggeren.

Opschoonactie:

- checkbox: alleen `change`;
- tekst/nummer: één gekozen eventstrategie;
- guard die ongewijzigde waarden niet opnieuw opslaat;
- unit-test op één revision per interactie.

#### STAB-003 — `{once:true}` op conditionele backdrophandlers

Meerdere modals gebruiken een listener zoals:

```js
modal.addEventListener('click', event => {
  if (event.target === modal) close();
}, { once:true });
```

Als de gebruiker eerst binnen de modal klikt, wordt de listener al verwijderd, ook wanneer niet wordt gesloten. Later klikken op de backdrop werkt dan niet meer.

Aangetroffen rond `index.html:8981`, `9121`, `9662`, `9716`, `9758` en `10021`.

Opschoonactie:

- geen `once:true` op conditionele backdrophandlers;
- handler verwijderen bij expliciete modal teardown;
- of één generieke modaldienst gebruiken.

#### STAB-004 — meerdere initiële renders

De actieve laadketen kan bij start meerdere keren renderen:

- het kernscript initialiseert en rendert;
- Update 4 wrapt de renderer en rendert;
- Update 5 roept aan het einde opnieuw `renderActiveTab()` aan.

Impact:

- extra DOM-werk;
- listeners worden sneller dubbel gekoppeld;
- racegevoeligheid bij IndexedDB/Firebase-initialisatie.

Doel voor opschoning:

- één `bootstrap()`-functie;
- één initvolgorde;
- één eerste render nadat migratie, lokale opslag en adapters gereed zijn.

### P1 — CSS en visuele regressies

#### CSS-001 — 81 dubbele selectors in dezelfde context

In het grootste inline stijlblok zijn 81 selectors binnen exact dezelfde mediaquery/context meermaals gedefinieerd.

Voorbeelden:

- `.mobile-kpi-edit-hint`: 8 definities;
- `.v4-main`: 6 definities;
- `.mobile-kpi-icon`: 6 definities;
- `.mobile-kpi-top`: 6 definities;
- `.mobile-kpi-budget-track`: 6 definities;
- `#tab-dashboard`: 5 definities;
- `.mobile-title-block h1`: 4 conflicterende definities;
- `.joint-fixed-fullscreen-editor`: 4 verschillende paddings.

Dit is de directe technische oorzaak waardoor een kleine CSS-wijziging op een onverwachte plek de app kan veranderen.

Veilige opschoonregel:

- nooit meerdere componenten tegelijk consolideren;
- per component computed styles vastleggen;
- alleen eerdere overschreven declaraties verwijderen;
- na iedere stap pixel- en interactievergelijking;
- geen nieuwe `!important`-laag toevoegen.

#### CSS-002 — 1.621 `!important`-declaraties

De huidige cascade is grotendeels vervangen door geforceerde overrides. Daardoor is bronvolgorde moeilijk voorspelbaar en is elke nieuwe wijziging geneigd nóg specifieker te worden.

Opschoonactie:

1. eerst lagen en volgorde vastleggen;
2. tokens → basis → component → responsive → uitzonderingen;
3. binnen één component naar normale specificiteit terugbrengen;
4. `!important` alleen behouden waar een externe browserregel of expliciete utility dit vereist.

#### CSS-003 — niet-gedefinieerde custom properties

Actieve CSS gebruikt onder andere:

- `--surface`;
- `--surface-2`;
- `--soft-green`;
- `--green-pale`;
- `--cream`;
- `--ink`.

Deze variabelen zijn in de geaudite basis niet centraal gedefinieerd. De browser negeert dan de complete declaratie of gebruikt alleen een opgegeven fallback.

Dit verklaart mede eerdere transparante of afwijkende achtergronden.

Opschoonactie:

- centrale tokenlijst maken;
- iedere variabele definiëren of vervangen door een bestaande token;
- CI-check toevoegen voor ongedefinieerde CSS-variabelen.

#### CSS-004 — `data-active-tab` wordt als stijl-hack gebruikt

Voor meerdere tabs wordt de werkelijke tab in `data-real-active-tab` gezet, terwijl `data-active-tab` voor CSS-doeleinden soms op `dashboard` blijft staan.

Impact:

- dashboardregels lekken naar andere tabs;
- selectors worden zeer lang;
- regressies zijn moeilijk lokaal te houden.

Opschoonactie:

- iedere tab één echte, stabiele bodyclass;
- gedeelde styling in componentclasses;
- dashboardregels alleen op het dashboard toepassen.

### P1 — performance en state-opslag

#### PERF-001 — volledige state wordt bij kleine wijzigingen meerdere keren gekloond

`commitChange()`:

1. kloont de volledige committed state vóór de wijziging;
2. valideert en slaat de volledige state op;
3. kloont de volledige state opnieuw als committed snapshot;
4. bij een fout wordt opnieuw gekloond (`index.html:7738–7787`).

Daarbovenop kunnen dubbele events dezelfde route tweemaal starten.

Impact neemt toe met:

- meer transacties;
- meer spaardoelen;
- grotere afbeeldingen;
- langere historie;
- meerdere apparaten.

Opschoonactie:

- geen opslag bij ongewijzigde waarde;
- per actie een kleine patch of transaction object;
- snapshots alleen bij echte mutatie;
- render en cloudsync schedulen;
- financiële validatie gericht op gewijzigde maand/entiteit.

#### DATA-001 — hoofdstate is één groeiend document

De kernstate wordt als één geheel lokaal en in één Firestore-hoofddocument bewaard. De cloudadapter heeft een grens rond 900 kB om onder Firestore-limieten te blijven.

Risico:

- transacties en historie groeien door;
- doelafbeeldingen kunnen de payload sterk vergroten;
- één wijziging uploadt veel ongewijzigde data;
- twee apparaten werken met revision-based last-write-wins.

Toekomstige, risicovollere architectuurfase:

- profiel/configuratie apart;
- maandrecords per maand;
- transacties per maand of collectie;
- afbeeldingen niet in hoofddocument;
- expliciete migratie met terugrolmogelijkheid.

Dit hoort niet in de eerste CSS-/codeconsolidatie.

#### DATA-002 — doelafbeeldingen worden voor cloudtransfer data-URL

Lokale afbeeldingen staan in IndexedDB, maar worden voor cloudtransfer in de state geëxpandeerd. Dit vergroot de Firestore-payload snel.

Opschoonrichting:

- afbeeldingsblob apart opslaan;
- in state alleen ID, MIME-type, checksum en eventueel thumbnail;
- limiet en compressie vóór upload;
- migratie pas na volledige back-up.

#### DATA-003 — globale schema- en importschema-versies zijn gekoppeld

De kern gebruikt `U3_SCHEMA_VERSION = 9`; Update 4 gebruikt eveneens `SCHEMA_VERSION = 9` en schrijft dit terug naar `state.meta.schemaVersion`.

Dat werkt toevallig zolang beide versies gelijk zijn. Als één module naar 10 gaat en de andere op 9 blijft, kan metadata worden teruggezet of verkeerd worden geïnterpreteerd.

Opschoonactie:

```text
meta.coreSchemaVersion
meta.importSchemaVersion
meta.uiVersion
```

Elke module migreert alleen haar eigen domein.

### P2 — JavaScriptarchitectuur en dode code

#### JS-001 — functies worden later opnieuw toegewezen

Aangetroffen meervoudige definities/toewijzingen:

- `getMonthlyBaseIncome`;
- `sumVasteTeruggaven`;
- `getMonthlyScenarioData`;
- `getMonthTransactions`;
- `renderDashboardGoalPreviewCard` — drie versies;
- `calcDoel`;
- `calcGroep`;
- `renderMobileGoalRow`;
- `openMobileGoalEditor`;
- `openMobileGoalManager`;
- `renderMobileSpaardoelen` — drie versies.

Dit zijn monkey patches. De actieve functie kan alleen worden bepaald door de laadvolgorde volledig te volgen.

Opschoonactie:

- per functie één eigenaar/module;
- oude versie pas verwijderen nadat een gedragstest voor de actieve versie bestaat;
- geen runtime reassignment van kernfuncties.

#### JS-002 — overschreven Update-2-renderblokken zijn vermoedelijk dood

Rond de latere spaardoelenupdates wordt een eerste override van onder andere `renderDashboardGoalPreviewCard` en `renderMobileSpaardoelen` kort daarna opnieuw overschreven. De eerste override heeft daardoor waarschijnlijk geen actief pad.

Status: **kandidaat voor verwijdering, nog niet verwijderen zonder tests**.

#### JS-003 — oude inline bankimport bestaat naast Update 4

`index.html` bevat nog de oudere:

- `bankImportDraft`;
- parser;
- mapping;
- `renderBankImportSection()`;
- `bindBankImport()`;
- importcommitlogica.

`update4.js` vervangt later globaal `renderBankImportSection` en `bindBankImport`.

Een deel van de oude code is daardoor vermoedelijk dood, maar `bankImportOpen` en enkele navigatiestukken kunnen nog worden gebruikt.

Opschoonactie:

- callgraph maken;
- resterende gedeelde flags losmaken;
- oude importer in één aparte commit verwijderen;
- CSV-fixtures vóór en na exact vergelijken.

#### JS-004 — helpers zijn dubbel aanwezig

Voorbeelden in kern en Update 4:

- `clone`;
- `round2`;
- `uid`;
- `ownerLabel`;
- transactietype-normalisatie;
- valutaformattering;
- escaping;
- owners-lijsten.

Opschoonactie:

- pure helpers naar één module;
- geen UI-module die kernmetadata overschrijft;
- tests op rounding, valuta, ownernormalisatie en transactietypen.

#### JS-005 — kandidaten met slechts één statische vermelding

High-confidence kandidaten om nader te bewijzen:

- `bankRememberCategory`;
- `blankGoal`;
- `moneyToneClass`;
- `monthOptions`;
- `personStatusBadge`;
- `renderAppSection`;
- `renderSpaardoelen`;
- `splitLastIndex`;
- `startFinizeIconObserver`;
- `transactionsByCategory`;
- `u2ApplyContribution`;
- `u3IncomeForOwner`.

“Eén tekstuele vermelding” is geen definitief bewijs wanneer functies dynamisch via strings kunnen worden aangesproken. Eerst runtime coverage, daarna verwijderen.

#### JS-006 — mojibake in spaargeschiedenis

In `index.html:10694` staat meerdere keren `Â·` in plaats van `·`.

Dit is klein, maar toont dat encodingcontrole ontbreekt.

Opschoonactie:

- UTF-8 zonder BOM waar mogelijk;
- encodingtest in CI;
- zoeken op `Â`, `Ã`, `�`.

### P2 — PWA en service worker

#### PWA-001 — activate verwijdert alle caches van dezelfde origin

De service worker verwijdert iedere cache waarvan de naam niet exact gelijk is aan de huidige cache (`service-worker.js:26–35`).

Cache Storage is originbreed. Veiliger:

```js
key.startsWith('finize-') && key !== CACHE_NAME
```

#### PWA-002 — assetfouten vallen terug op `index.html`

Voor iedere niet-navigatie-GET geldt:

```js
cached || fetch(...).catch(() => caches.match('./index.html'))
```

Daardoor kan een mislukte JavaScript-, CSS- of afbeeldingrequest HTML terugkrijgen. Dat geeft MIME- of syntaxfouten die moeilijk te diagnosticeren zijn.

Correct:

- alleen navigaties krijgen HTML-fallback;
- assets geven hun eigen cache, netwerkfout of specifieke offline-placeholder.

#### PWA-003 — `cache.addAll()` maakt installatie fragiel

De app-shell bevat ook `finize-v4.html` en `finize-mobile.html`. Als één shellbestand ontbreekt, kan `cache.addAll()` de hele installatie laten falen.

Opschoonactie:

- eerst aantonen welke bestanden werkelijk actief zijn;
- legacy pagina’s uit app-shell;
- kritieke en optionele assets scheiden;
- response-status controleren.

#### PWA-004 — app-shell bevat legacy pagina’s

De service worker cachet:

- `finize-v4.html`;
- `finize-mobile.html`.

Zolang dat zo is, kunnen deze bestanden niet zonder meer worden gearchiveerd of verwijderd. Eerst de app-shell aanpassen en offline-updateflow testen.

### P2 — repository, documentatie en CI

#### REPO-001 — generieke commitmessages

Veel recente commits heten alleen `Add files via upload`. Hierdoor is het moeilijk om:

- een bug te koppelen aan een wijziging;
- veilig te bisecten;
- snel terug te draaien;
- te zien welke versie werkelijk stabiel was.

Aanbevolen format:

```text
fix(import): voorkom dubbele modallisteners
refactor(css): consolideer alleen mobiele KPI-kaarten
test(finance): voeg scenariofixture toe voor spaarpot
```

#### REPO-002 — geen reproduceerbare tooling

`package.json` en `package-lock.json` ontbreken.

Gevolg:

- test- en audittools zijn niet vastgepind;
- CI kan niet lokaal identiek worden uitgevoerd;
- Node-/package-updates kunnen onverwacht gedrag veranderen.

Eerste niet-functionele toevoeging:

- `package.json`;
- lockfile;
- scripts voor syntax, lint, CSS-audit en Playwright;
- Node 24 vastleggen.

#### REPO-003 — actieve en historische bestanden staan naast elkaar

Waarschijnlijke categorieën:

**Actief**
- `index.html`
- `update4.js/css`
- `update5.js/css`
- `service-worker.js`
- `manifest.json`
- `firebase.json`
- `firestore.rules`
- actieve iconen

**Historisch of documentair**
- `index-OLD.html`
- `finize-mobile.html`
- `finize-v4.html`
- Update-4 implementatie-/progressdocumenten
- mogelijk oudere assets

Nog niet verwijderen. Eerst:

1. referenties zoeken;
2. service worker aanpassen;
3. tests uitvoeren;
4. naar `archive/` of Git-tag verplaatsen;
5. pas later uit hoofdbranch verwijderen.

#### DOC-001 — README is tegelijk handleiding en changelog

De README bevat een lange opeenvolging van releaseblokken v32–v50, inclusief dubbele v44-koppen.

Aanbevolen scheiding:

- `README.md` — installeren, ontwikkelen, deployen;
- `CHANGELOG.md` — releases;
- `docs/architecture.md` — state, rendering, storage;
- `docs/data-model.md` — financiële entiteiten;
- `docs/import.md` — CSV/importworkflow.

#### CI-001 — Node.js 20-waarschuwing in GitHub Actions

De getoonde workflowwaarschuwing meldt dat acties die Node.js 20 targeten door GitHub op Node.js 24 worden uitgevoerd.

Dit is momenteel een waarschuwing, geen appfout.

Opschoonactie:

- workflowbestand exact lokaliseren;
- officiële nieuwste action-major gebruiken;
- Node 24 in lokale tooling en CI gelijkzetten;
- workflow opnieuw uitvoeren zonder annotation.

De workflowfile was in de huidige connectorinventaris niet eenduidig te lokaliseren; dit item moet bij de repository-inventaris expliciet worden afgerond.

## 7. Specifieke CSS-conflicten die eerst moeten worden bevroren

Voor ieder van onderstaande componenten moeten vóór opschoning screenshots én computed styles worden vastgelegd:

1. mobiele dashboardheader;
2. vier mobiele KPI-kaarten;
3. Gezamenlijke rekening;
4. zakgeldkaart;
5. gezamenlijk budgetpreview;
6. spaardoelenpreview;
7. bottomnavigation;
8. persoonlijke vaste lasten;
9. persoonlijke variabele budgetten;
10. transactielijst;
11. mobiele spaardoelenrij;
12. spaardoel met subdoelen;
13. bankimportmodal;
14. matchdialog;
15. validatiefoutdialog;
16. tablet-sidebar;
17. desktop-sidebar en spaardoelendetail.

De progressiebalkbreedte van spaardoelen blijft een bekende visuele bug in v50. Deze moet niet met een nieuwe losse override worden “opgelost” tijdens de audit. Eerst de actieve layoutdefinitie isoleren, daarna één componentcommit.

## 8. Veilige opschoonvolgorde

### Fase 0 — versie bevriezen

- Git-tag maken: `v50-audit-baseline`.
- Firestore-export en JSON-back-up maken.
- Bovenstaande SHA-256-hashes bewaren.
- v51/v52 niet als basis gebruiken.
- Geen functionele updates mengen met opschoning.

**Gate:** herstel van de v50-bestanden en data is getest.

### Fase 1 — test- en meetlaag toevoegen

Geen productielogica wijzigen.

Toevoegen:

- `package.json` + lockfile;
- Node 24;
- syntaxcheck;
- CSS-parsercheck;
- test op dubbele IDs;
- test op ongedefinieerde CSS-variabelen;
- Playwright-schermen op 360, 390, 768, 1024 en 1440 px;
- financiële fixturetests;
- importfixturetests;
- lokale mock voor cloudadapter.

**Gate:** huidige v50 slaagt of bekende afwijkingen zijn expliciet vastgelegd.

### Fase 2 — architectuurdocumentatie en actieve bestanden

- laadvolgorde documenteren;
- statevelden inventariseren;
- actieve versus legacy bestanden labelen;
- README/changelog splitsen;
- geen code verwijderen.

**Gate:** ieder actief bestand heeft een eigenaar en doel.

### Fase 3 — stabiliteitsfixes zonder visuele wijziging

In kleine commits:

1. importlisteners éénmalig binden;
2. dubbele inputevents verwijderen;
3. modalbackdrophandlers corrigeren;
4. één bootstrap/initial render;
5. opslag overslaan bij ongewijzigde waarde.

**Gate:** importstress-test, alle screenshotvergelijkingen gelijk.

### Fase 4 — CSS-consolidatie per component

Volgorde:

1. tokens en ontbrekende variabelen;
2. basisutilities;
3. bankimportdialogs;
4. bottomnavigation;
5. dashboardheader/KPI;
6. dashboardkaarten;
7. persoonlijke tabs;
8. spaardoelen;
9. tablet;
10. desktop.

Per component:

- laatste actieve declaraties verzamelen;
- eerdere volledig overschreven declaraties verwijderen;
- computed-style diff;
- screenshotdiff;
- interactietest;
- commit;
- pas dan volgend component.

**Verboden:** één grote “CSS cleanup”-commit.

### Fase 5 — JavaScript modulariseren

Doelstructuur:

```text
src/
  core/
    state.js
    validation.js
    migrations.js
    calculations.js
  storage/
    local-state.js
    cloud-state.js
    goal-images.js
  import/
    parser.js
    classifier.js
    import-store.js
    import-sync.js
    import-ui.js
  ui/
    render.js
    events.js
    modal.js
    icons.js
  app.js
```

Eerst verplaatsen zonder herschrijven. Daarna:

- monkey patches elimineren;
- oude importer verwijderen;
- helpers centraliseren;
- UI en berekeningen scheiden;
- één eventdelegatielaag.

**Gate:** alle financiële fixtures en screenshots gelijk.

### Fase 6 — data- en cloudarchitectuur

Alleen na stabiele testdekking:

- aparte schemaversies;
- state opdelen;
- afbeeldingen apart;
- per-maanddocumenten;
- conflictstrategie;
- beveiligde Firestore-regels.

Dit is de fase met het hoogste migratierisico.

### Fase 7 — PWA en repository opschonen

- service worker gericht herschrijven;
- app-shell minimaliseren;
- legacy bestanden archiveren;
- GitHub Actions moderniseren;
- releaseworkflow en semantische commitmessages;
- definitieve documentatie.

## 9. Acceptatiecriteria voor “geen appwijziging”

Een opschoonstap is alleen geslaagd wanneer:

- alle financiële fixture-uitkomsten exact gelijk zijn;
- state-export vóór en na semantisch gelijk is;
- geen schema- of revisionwijziging ontstaat door alleen openen;
- screenshots binnen vooraf ingestelde pixelmarge gelijk zijn;
- computed styles van het aangepakte component gelijk zijn;
- tabnavigatie en modals identiek werken;
- offline starten, update en herstel werken;
- een import met 50 regels na 50 bewerkingen geen extra handlers heeft;
- cloudsync niet vaker start dan vóór de afgesproken stabiliteitscorrectie;
- geen nieuw console-error of unhandled rejection optreedt.

## 10. Aanbevolen eerste uitvoeringspakket

De eerste daadwerkelijke opschoonupdate moet klein blijven en mag nog geen CSS-consolidatie bevatten:

1. testharnas en baseline;
2. importlistener-accumulatie oplossen;
3. dubbele inputevents oplossen;
4. modalbackdrophandlers oplossen;
5. ontbrekende CSS-tokenlijst documenteren, nog niet visueel vervangen;
6. securitymigratie ontwerpen, maar publieke regels nog niet zonder authenticatie dichtzetten.

Daarna kan de CSS componentgewijs worden aangepakt.

## 11. Eindoordeel

Finize kan gecontroleerd worden opgeschoond zonder zichtbare of functionele verandering, maar niet veilig via een grote automatische rewrite.

De codebase bevat genoeg goede validatie-, migratie- en importmechanismen om te behouden. De voornaamste technische schuld zit in:

- opeengestapelde CSS-overrides;
- globale functievervanging;
- dubbele eventbinding;
- volledige statebewerkingen;
- publiek toegankelijke Firestore-data;
- actieve en historische code in dezelfde runtime.

De juiste aanpak is daarom: **eerst meetbaar maken, daarna per component en per verantwoordelijkheid consolideren**.
