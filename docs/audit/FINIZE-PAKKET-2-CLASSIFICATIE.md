# Pakket 2 — classificatie vóór testwijzigingen

Basis: herstelbranch op `6246bd5`, met pakket 1 behouden. GitHub-main: `7a7d72e`. Bij deze nulmeting waren er nog geen wijzigingen aan bestaande tests of applicatiecode voor pakket 2. Onderzoeksprobes staan uitsluitend onder `.cache/pakket2/`.

## Node-nulmeting

Alle 100 root-testbestanden zijn afzonderlijk met Node/TAP uitgevoerd: **84 bestanden geslaagd, 16 mislukt**. Dit zijn bestandenaantallen, niet aantallen assertions. De oorspronkelijke logbestanden en tellingen staan in `.cache/pakket2/node-before.json`.

| Bestand | Classificatie | Aangetoonde oorzaak / te behouden controle |
|---|---|---|
| `fix-round-1-6.test.cjs` | Verouderde testextractie en onjuiste afbakening | Eindmarker van functie-extractie bestaat niet meer; daardoor worden latere functies meegetest. Encodingtest behandelt ook CSS-commentaren als zichtbare inhoud. Privacy, gedeelde rekenfunctie en echte zichtbare tekst blijven toetsbaar. |
| `forecast-current-basis.test.cjs` | Verouderde verwachting | Toegevoegde onbetaalde historische last van € 100 blijft gereserveerd. Cash is € 2.000, na reservering € 1.900. Test mag beide begrippen niet gelijkstellen. |
| `html-inline-syntax.test.cjs` | Verouderde verwachting | Vereist externe assets en nul inline scripts; de actuele, reproduceerbare release is bewust inline. |
| `package7-release-audit.test.cjs` | Onvolledige testdouble + oude releasewaarde | Fetch-event mist `waitUntil`; mismatch-fixture vervangt r25 terwijl actuele marker r46 is. Bescherming tegen een verkeerde offline shell moet behouden blijven. |
| `service-worker-cache.test.cjs` | Verouderde verwachting | Vereist externe assetverwijzingen en hardgecodeerde r25. Zelfde huidige release in shell, losse assets en worker blijft verplicht. |
| `update4-final-regression.test.cjs` | Verouderde verwachting | Cacheversie r25 vastgelegd in test. |
| `update4-ui-structure.test.cjs` | Verouderde verwachting | Externe stylesheet/scriptverwijzingen verwacht bij inlinelevering. |
| `update5-responsive-structure.test.cjs` | Verouderde verwachting | Zelfde inline/externe mismatch en hardgecodeerde r25. |
| `v117-p2.test.cjs` | Onjuiste afhankelijkheidsresolutie | Hardgecodeerd `node_modules/playwright/...` bestaat niet onder pnpm. De AST-controle op awaited financiële opslag blijft vereist. |
| `v117-p4-salary.test.cjs` | Ongeldige fixture | Alleen bankdatum gewijzigd naar september; betaaldatum blijft oktober. Huidige administratieve maand volgt betaaldatum. Bron-/bankdatum moet behouden blijven. |
| `v117-p4.test.cjs` | Ongeldige fixture | Novemberfixture houdt een oktoberbetaaldatum. Budget-ID- en historische assertions blijven behouden. |
| `v118-p5b-backend.test.mjs` | Onjuiste uitvoerconfiguratie | Gegenereerde `functions/shared` ontbreekt vóór backendbuild. |
| `v118-p5b-bootstrap.test.mjs` | Onjuiste uitvoerconfiguratie | Dezelfde ontbrekende backendbuild. |
| `v118-p5b-configuration.test.mjs` | Onjuiste uitvoerconfiguratie | Dezelfde ontbrekende backendbuild. |
| `v118-p5b-multi.test.mjs` | Onjuiste uitvoerconfiguratie | Dezelfde ontbrekende backendbuild. |
| `v118-p5b-retention-emulator.test.mjs` | Ontbrekende emulator / SDK-omgeving | Vereist expliciet loopback-emulator 8189. Geen inhoudelijke uitslag zolang de geïsoleerde emulator ontbreekt. |

Er is in deze Node-mislukkingen nog geen nieuwe applicatiebug bewezen. Herhaling na herstel van testomgeving en verwachtingen moet deze classificatie bevestigen; afwijkingen worden apart geregistreerd.

## UI-nulmeting met prioriteit

De drie betrokken browserbestanden zijn opnieuw uitgevoerd: **31 geslaagd, 17 mislukt, 0 overgeslagen**. De eerdere negen open gevallen zijn hieronder afzonderlijk opgenomen.

| Open geval uit scan | Classificatie vóór wijziging | Onderzoeksbewijs |
|---|---|---|
| Gedeelde vaste-lasteneditor mobiel/desktop | Verouderde route/selectors | De hele lastregel is nu de bewerkknop; er is geen geneste knop 'Bewerken'. Verdeling staat achter 'Extra instellingen'. |
| 50/50 opslaan in tijdlijn | Verouderde route/selectors | Zelfde route; zichtbare knop heet 'Wijzigingen opslaan'. |
| Nieuwe last, maanduitzondering en stoppen | Verouderde route/selectors | Oude editorbediening/-labels; financiële eindpunten blijven afzonderlijk te controleren. |
| Vaste last verwijderen | Verouderde route/selectors | Oude geneste bewerkknop; verwijderactie zit in huidige editor. |
| Bankgoedkeuring 390 px | Test opent transactiekaart niet | Compacte kaart toont de bron, maar verwerken wordt bereikbaar na openen via `[data-u4-focus-open]`. |
| Bankgoedkeuring 1440 px | Zelfde verkeerde gebruikersroute | Zelfde compacte kaart, niet een financiële blokkade. |
| Goedkeuring met gelijktijdige wijziging | Zelfde routefout vóór bereiken scenario | Eerst huidige transactiekaart openen; conflictassertions behouden. |
| CSV/API-overlap expliciet koppelen | Verborgen actie in niet-geopende kaart | Specifieke overlapfixture na openen herhalen; identiteits-/brongegevensassertions behouden. |
| Tegenrekeningselectie | Onjuiste testopzet / ontbrekende typekeuze | Kies de huidige transactiefamilie 'Interne overboeking' en open de kaart; dan verschijnt de rekeningkeuze. |

Aanvullende echte browserprobes via huidige zichtbare bediening slagen **3/3**:

1. Vaste last naar 50/50 opslaan; huidige maand verandert, september blijft 'income-ratio'.
2. Compacte transactie openen en expliciet verwerken: vóór goedkeuring € 0 effect, erna € 10.
3. Type 'Interne overboeking' kiezen en bestaande Dara-rekening terugvinden in de tegenrekeningselector.

De eerste versie van de onderzoeksprobe gebruikte zelf nog de verborgen native selector en een verkeerd transactiefamilie-ID. Die probe is gecorrigeerd naar zichtbare bediening; er is daarvoor geen applicatiecode gewijzigd. Beide onderzoeksruns zijn bewaard.

De overige acht mislukkingen in deze prioriteitsrun zijn aanvankelijk kandidaten voor verdwenen dashboard-/lijstmarkup, gewijzigde zichtbare labels of oude spaardoel-/budgetselectors. Nadere inspectie bevestigt echter een echte applicatieregressie bij de directe mobiele doelvolgorde: de huidige mobiele kaarten bevatten helemaal geen verplaatsknoppen. Zie [de afzonderlijke bevinding](FINIZE-PAKKET-2-APPLICATIEBUG-01.md). De oorspronkelijke test is hiervoor niet afgezwakt of aangepast. De overige gevallen krijgen pas een definitieve beoordeling na herhaling via de actuele route.

## Vervolg en grenzen

Pas na deze registratie worden bestaande tests en uitvoerconfiguraties gericht bijgewerkt. Applicatiebugs die bij het bereiken van de oorspronkelijke financiële eindpunten alsnog blijken, krijgen een afzonderlijke reproductie en worden niet automatisch gerepareerd. De pakket-1-basis van 478 Node-gevallen en 35 browsergevallen blijft behouden. Geen publicatie, productiegegevens of bankverbindingen; uitsluitend fixtures, mocks en lokale demo-emulators.

## Herhaling via actuele routes

De vier vaste-lastenstromen plus aanvullende verdelings-/afschrijfdagtest en rekeningselectie slagen nu 6/6. De rekeningfixture stond op juli terwijl de bankimport oktober betreft: ook de geselecteerde maand is daarom vóór openen afgestemd. De compacte vaste-lastenlijst toont verdeling niet meer; dezelfde verdeling wordt nu in de actuele editor en canonieke tijdlijn gecontroleerd. De betalingsdag is een dagkeuze in plaats van een volledige datum. Geldbedragen, maanduitzondering, stop/verwijderhistorie en gewijzigde spaarverdeling blijven getoetst.

De drie goedkeuringsgevallen en CSV/API-overlap slagen na het zichtbaar openen van de transactiekaart. De financiële assertions zijn ongewijzigd. De bank-/rekeningbestanden tellen samen 33 geslaagd en vier resterende fouten in deze tussenrun: de rekeningfixture (inmiddels apart geslaagd) en drie dashboardgevallen op oude `.p3-kpi`-markup. De huidige renderer `outlookHtml` toont het rechtstreekse banksaldo, inclusief herkomst en waarnemingstijd; de oude tekst 'Berekend t/m' en het oude balance-infopaneel bestaan niet meer. De test moet het actuele saldo en de bron/peildatum via de huidige saldoactie controleren, naast de ongewijzigde herhaal-/netwerkassertions. Dit is een verouderde testverwachting, geen in deze run aangetoonde financiële bug.

De volledige niet-emulator-Node-suite is na het mobiele herstel opnieuw uitgevoerd: 1.372 geslaagd, 0 mislukt, 0 overgeslagen.

## Testserverconfiguratie

De testserver geeft `.mjs` terug als `application/octet-stream`, terwijl diverse browsertests pure ES-modules laden. De tijdelijke pakket-1/2-server corrigeerde dit al. Dit is een bewezen omgevingsprobleem: de standaard testserver krijgt dezelfde JavaScript-MIME-koppeling zodat de suite zonder tijdelijke server kan draaien. De geïsoleerde browserprocessen blijven uitsluitend op loopback en met fixtures/mocks werken. Het hergebruik van een willekeurig bestaand serverproces wordt uitgeschakeld om testen van een verkeerde checkout te voorkomen.

## Poortisolatie vóór brede uitvoering

Poort 4173 blijkt al bezet door een Node-testserver die sinds 5 november draait. Dat bestaande proces blijft ongemoeid. Negentien browserbestanden bevatten hardgecodeerde 4173-origins, ook voor tweede browsercontexten en quota. Om alle controles daadwerkelijk op deze clone uit te voeren, wordt de testorigin via één helper uit `FINIZE_TEST_PORT` afgeleid (standaard blijft 4173). De brede lokale run gebruikt een vrije poort. Dit verandert uitsluitend testconfiguratie; geen assertions of applicatieroutes.

## Emulators en CI-voorbereiding

De eerder ontbrekende emulatoromgeving is daadwerkelijk uitgevoerd: 42 P3/P4-opslaggevallen en 4 native bankretentiegevallen slagen, zonder overgeslagen gevallen. Alleen demo-projecten op loopback zijn gebruikt. De bestaande emulatorstarter bevat Windows-specifieke globale CLI-/Java-paden. Voor reproduceerbare Linux-CI moet de starter een expliciet geïnstalleerde test-CLI en standaard JAVA_HOME ondersteunen. Bestaande lokale terugvalpaden blijven werken. De retentietest houdt zijn strikte 8189-guard; de SDK komt uit de tijdelijke testtoolmap. Er worden geen productieafhankelijkheden bijgewerkt.

## Brede dashboardclassificatie vóór aanpassing

De eerste brede poging is afgebroken tijdens het bestand `dashboard-selected-month.spec.cjs`, na negen vastgelegde mislukkingen. Er is geen volledige suite-uitslag geclaimd; de oorspronkelijke voortgang/errorlogs zijn bewaard. Drie gevallen bevestigen de al bekende 194,5px-onderruimte. De grens van 125 px blijft ongewijzigd: dit is een echte, reeds voor pakket 3 ingeplande layoutbevinding.

De overige dashboardgevallen gebruiken oude periodeknoppen, verwachten automatisch geopende dagdetails of dashboardpanelen die bewust verdwenen zijn. `docs/v118-r38-dashboard.md` bevestigt expliciet de verwijdering van Budgetten/Jaaroverzicht en vervanging door een periodekeuzelijst. De huidige bron sluit dagdetails aanvankelijk en opent ze na dagkeuze. Dit zijn verouderde testverwachtingen. Maandgrenzen, onbekende saldi, behoud van financiële state, context, betaalgebeurtenissen en racebescherming blijven assertions. De browserproef voor een verdwenen jaarselector wordt gericht op kalenderjaarovergang en filterreset; de bestaande financiële jaarberekeningen blijven integraal door de Node-tests voor `yearView` getoetst. Geen verwijderde UI wordt opnieuw geïntroduceerd om oude tests te laten slagen.

Het oude vaste 104px-doelbalkcontract in `desktop-special-tabs` is eveneens achterhaald door de huidige compacte mobiele kaarten. De nieuwe controle toetst gelijke beschikbare breedte voor bedrag/balk/inleg, geldige voortgang en geen overloop bij korte/lange doelinhoud. Budgetbewerkers worden via hun huidige `data-open-owner-variable`-knop geopend. De dashboardinkomenssom wordt op de huidige gezamenlijke overzichtsroute gecontroleerd; de zichtbare zakgeldverdeling blijft apart aan de bestaande scenario-uitkomsten gekoppeld.

De herhaling bereikt twee aanvullende oude verwachtingen: het salarisfilter is sinds de gedocumenteerde inkomensprognosecorrectie inclusief de ontvangstdag (`docs/audit/finize-inkomensprognose-20261026.md`), dus 25 september en 25 kalenderdagen in deze fixture. De bestaande spaarbedragdialoog toont 'Over deze maand' en 'Handmatig spaarbedrag voor deze maand' in plaats van de oude labels. Alleen deze verwachtingen worden aangepast; geldbedragen en beschikbare bediening blijven getoetst.

Aanvullende fixtureclassificatie: de persoonlijke 'onbekende salarisgrens'-proef krijgt inmiddels expliciet een zakgeldontvangst op de 25e via de gedeelde UX-fixture. Om het oorspronkelijke onzekerheidsscenario werkelijk te testen worden voor dat specifieke profiel eerst de bekende ontvangstinstellingen verwijderd. De vaste-lastenoverzichtsdialoog heeft geen inkomstenstap of oude '→ Dion'-rijtekst meer; de eigenaar wordt nu voor iedere zichtbare rij tegen het canonieke item gecontroleerd, met een verplichte niet-lege lijst.

De brede inventaris blijft lang wachten op reeds verdwenen bediening doordat veel bestanden een testdeadline van 90 seconden hebben en geen actiegrens. De standaard zichtbare interactie krijgt een limiet van 10 seconden; expliciet langere bestandsinstellingen blijven leidend. Financiële assertions, opslag-wachtvoorwaarden en testgevallen worden niet verwijderd. De afgebroken diagnostische runs worden niet als complete testuitslag geteld.

## Prioriteitsronde afgerond

De definitieve gezamenlijke herhaling van `dashboard-selected-month`, `desktop-special-tabs`, `v118-p1b-accounts` en `v118-p5b-bank` slaagt: **59 geslaagd, 0 mislukt, 0 overgeslagen** (ruwe JSON `.cache/pakket2/priority-final.json`). Alle negen oorspronkelijke onverklaarde UI-gevallen zijn hiermee via de actuele gebruikersroute onderzocht en geslaagd, met behoud van financiële en historische eindassertions. Het afzonderlijk goedgekeurde herstel van mobiele doelvolgorde is de enige applicatiewijziging voor deze ronde.

De oorspronkelijke Node-nulmeting telde 1.292 door Node gerapporteerde testgevallen: 1.272 geslaagd, 20 mislukt. Vier niet-gebouwde backendbestanden en de ontbrekende emulator rapporteerden daarbij alleen een falende bestandswrapper; hun interne gevallen werden pas na correct inrichten werkelijk uitgevoerd. Daarom is 1.372 normale gevallen plus vier native emulatorgevallen geen simpele toevoeging van 84 nieuwe tests. De bestandentelling vóór herstel blijft 84/100 geslaagd en 16/100 mislukt.

## Brede importclassificatie: `finize-audit-herstel.spec.cjs`

De complete bestandsronde is bereikt en de mislukkingen zijn vastgelegd in `browser-remaining-fast-progress.log`: goedkeuring/categoriekeuze gebeurt nog op compacte, niet-geopende kaarten. De foutlogs tonen bestaande maar verborgen knoppen/selectors. Dit is dezelfde bewezen routefout als bij de geslaagde bankprobes en prioriteitsronde. De tests krijgen de expliciete klik op de transactiekaart vóór bewerken/verwerken, ook bij de nog te controleren rij na herladen. Bulkbediening blijft vóór het openen van de kaart staan. Assertions voor zes/acht afzonderlijke goedkeuringen, gedeeltelijke opslagfout, retry zonder dubbelen, vaste-lastvervanging, cloud-readback, bronbehoud en maandafbakening blijven intact. Nieuwe inhoudelijke afwijkingen na het bereiken van die eindpunten worden afzonderlijk beoordeeld.

## Brede classificatie: `fix-round-1-6.spec.cjs`

Dit bestand is volledig uitgevoerd. De mobiele tabellen bestaan nog, maar staan nu onder 'Alle doelbedragen en maandinleg'; de oude KPI-/spaarbedragselectors verwijzen naar vervangen mobiele kaarten. De importhelper rendert een septemberdraft in een oktobercontext en opent geen transactiekaart. Latere goedkeuringen en een reeds goedgekeurde transactie vereisen eveneens de huidige open-/bewerkroute. Classificatie: verouderde routes/selectors en een onjuiste maandcontext in de testhelper. Alleen de tests worden aangepast: zichtbaar openklappen, juiste importmaand kiezen, expliciet openen/heropenen. Behoud van alle financiële state, bankOriginal, commit-aantallen, dag-/occurrencekeuzes, conceptopslag, eenmalige ledgerboeking en concurrentiecontrole blijft verplicht.

## Stop bij bewezen applicatiebug 02

De importherhaling bereikt 8/10 geslaagde gevallen. Twee resterende gevallen tonen een echte fout na groepsgoedkeuring: de bewaarde gesloten toestand van Goedgekeurd overschrijft de door de focusfunctie geopende groep. Daardoor blijft focusmodus actief terwijl de actieve kaart, terugknop en maandkeuze verborgen zijn. De eerdere routeclassificatie is voor dit vervolgprobleem dus onvoldoende; zie `FINIZE-PAKKET-2-APPLICATIEBUG-02.md` voor de gecorrigeerde classificatie, oorzaak en het minimale herstelvoorstel.

Twee aanvullende synthetische proeven bevestigen de fout op 390 en 1440 px. Een tweede diagnostische ronde bevestigt bovendien dat sluiten en opnieuw openen de lijstbediening herstelt en alle zes goedkeuringen behoudt. De applicatiecode is hiervoor niet gewijzigd. De brede browserrun en de eigen emulator zijn gestopt. Geen volledige brede uitslag, geen echte GitHub Actions-run en geen publicatie geclaimd. Pakket 2 wacht conform de gebruikersinstructie op een afzonderlijk besluit.

## Vervolg na akkoord op applicatiebug 02

De gebruiker heeft gericht focusherstel en vervolg van pakket 2 expliciet goedgekeurd. Na herstel slagen de tien importgevallen; maandkeuze en terugkeer zijn weer bereikbaar zonder geforceerde bediening. Nieuwe blijvende focusregressietests volgen op 390 en 1440 px.

De reeds uitgevoerde brede ronde classificeert drie mobiele mislukkingen in `fixed-payment-progress.spec.cjs` als verouderde geometrieselectors: de bedragen, percentages en eigenaarcontroles slagen vóór de test een niet meer bestaande kaartcontainer aanspreekt. De huidige container is `.mt-kpi` met een `h3`-label. Vier gevallen in `forecast-current-basis.spec.cjs` bereiken de financiële controles niet door verdwenen `.p3-kpis`/periodeknoppen. De r38-layout biedt dezelfde cash-/minimuminformatie in saldokaart en grafiekstatistieken. Alleen die selectoren en periodebediening worden overgezet; alle concrete centbedragen, maand-/daggrenzen en onveranderde financiële state blijven assertions.

De aanvullende mobiele tabelcontroles verwachtten geen interne overloop, terwijl de huidige bron expliciet `overflow:auto` en `min-width:900px` op de uitklapbare tienkolomstabel voorschrijft. De test controleert voortaan op mobiel de werkende interne scroll, bereikbaarheid van de laatste kolom en geen pagina-overloop; desktop behoudt de oorspronkelijke fitcontroles. De volgende transactie wordt na terugkeer naar de lijst geopend. Een bedragwijziging wordt vóór sluiten expliciet op duurzame conceptopslag gecontroleerd, zodat een nog lopende asynchrone schrijfactie niet als afgerond wordt behandeld; de financiële 100→150-assertion blijft ongewijzigd.

De gerichte herhaling van `fix-round-1-6` en `fixed-payment-progress` slaagt: 21/21. Alle vier prognosegevallen slagen vervolgens na het vernauwen van de minimumselector tot de zichtbare waarde, buiten de verborgen uitlegpaneeltjes. Daarmee slagen deze 25 onderzochte gevallen. De 100→150-proef slaagt op mobiel en desktop na wachten op de bestaande duurzame conceptopslag; de inhoudelijke assertion is behouden.

De normale Node-run sluit nu uitsluitend het exact benoemde retentie-emulatorbestand uit, in plaats van alle toekomstige bestandsnamen met '-emulator.test.'. De actuele selectie is aantoonbaar dezelfde 99 bestanden; hierdoor kunnen toekomstige tests niet onbedoeld buiten de inventaris vallen. De vier native retentiegevallen blijven via hun eigen strikte loopback-runner beschikbaar.

`function-parity-goals-income.spec.cjs` heeft één aanvullende verouderde knopnaam: de huidige mobiele knop heet 'Inkomen € …' en draagt `data-open-income-overview="dion"`. De fout treedt op vóór openen van het formulier. Alleen de selector wordt aangepast; de salaris-/teruggavewaarden, gelijke desktopuitlezing, historische standaardregels en onveranderde legacy-teruggaven blijven assertions.

## Aanvullende brede classificatie

- `hotfix-migration-backup`: de images-race injecteert een gate in een extern app.js-request dat door de actuele inline shell niet wordt gedaan. De gate zit aantoonbaar ook in de huidige HTML. De testinjectie verhuist naar die lokale HTML-response; de assertions voor lokale goedkeuring, outbox, hash en geweigerde oudere cloudstand blijven onveranderd.
- `import-history-cloud-refresh`: een ongerichte `h2`-selector matcht nu tevens verborgen transactiekaartkoppen. De zichtbare kop Importdetails wordt exact aangesproken. De twee echte conflictgevallen slagen al.
- `import-history-readonly`: de onderzoeksprobe toont `first:false`, `second:true`, met zichtbaar en duurzaam nog juli in plaats van de bedoelde oktobercontext. De eerste fixturecommit vervangt het rekeningregister met een onvolledig profiel en ongeldig test-IBAN; actuele identiteits-/historievalidatie weigert dit. Het bedoelde legacy-profiel wordt daarom als initiële fixture geladen. De commits moeten expliciet slagen vóór het read-only-scenario; alle state-/batch-/sync-/prognosevergelijkingen blijven behouden.
- `import-review-simplification`: alleen het oude label Verwerkingsdatum verschilt van de huidige Betaaldatum (gedocumenteerd in r37). De vier velden en alle verwerkingsassertions blijven behouden.
- `income-outlook`: zes gevallen stoppen vóór financiële controles op verdwenen `.p3-kpis`/filterknoppen. De r38-saldokaart/grafiekstatistieken en periodekeuzelijst worden gebruikt. De concrete bedragen, periode-onafhankelijkheid en twee raceproeven blijven dezelfde assertions.
- `income-overview`: de oude dashboard-inkomenskaart is bewust verdwenen in r38; de route 'Hoe is dit verdeeld?' opent nu het gezamenlijke overzicht. Mobiele inkomsten zijn een bedragknop die de bronuitsplitsing in een dialoog opent, in plaats van inline bronregels. De tests moeten die huidige zichtbare route volgen. Bedragen, bronuitsplitsing, privacy, historische maanden, fysieke rekeningisolatie, read-only-gedrag en XSS-assertions blijven vereist. Geen verdwenen dashboardkaart wordt opnieuw ingevoerd om oude tests te bedienen.

De gerichte herhaling van back-upconcurrentie, historische importlezing, importkop/velden en inkomensprognose slaagt 37/37. De geweigerde rekeningfixture is opgelost zonder de rekeningvalidatie te wijzigen. De echte opgeslagen historie, read-only-vergelijkingen, concurrente goedkeuring/outbox en alle concrete prognosebedragen blijven getoetst. Ook de afzonderlijke inkomenshistorieproef slaagt 1/1 na uitsluitend correctie van de zichtbare knopselector.

## Mobiele presentatie en oude dashboard-/formuliercontracten

De iPhone-tekstreeks vraagt nog `.mobile-kpi-grid`/`.mobile-kpi-value` op, terwijl de huidige mobiele rekeningweergave `.mt-kpis`/`.mt-amount` gebruikt. De nieuwe bron gebruikt bewust een meebewegend raster; de test controleert nu de twee financiële kaarten, niet-overlappende zichtbare plaatsing, leesbare labels/bedragen en gelijke iPhone/Android-kolommen bij dezelfde breedte. De bestaande minimumlettergrootte voor invoer blijft staan.

`mobile-recovery` verwacht 24px-statushoogte terwijl de actieve headerregel expliciet minimaal 20px vastlegt; de r46-releasenotitie bevestigt behoud van die headerstatuspositie. Alleen deze oude maatverwachting wordt bijgewerkt; eenregelige maand/titel, uitlijning, navigatie, focus en financiële state blijven gecontroleerd.

`modal-and-commit-stability` gebruikt een oude eigenaarsnaam in de transactieformuliertitel en een verdwenen dashboard-jaar-/zakgeldkaart. De actuele titel is 'Transactie toevoegen', met de eigenaar apart bij 'Betaald vanuit'. De eigenaarcontrole blijft daarom expliciet op dat veld. Zakgeld wordt uit de huidige twee persoonsbedragen opgeteld; voor vaste lasten wordt de geplande waarde van de betaald/gepland-weergave gelezen. De financiële gelijkheid blijft ongewijzigd. Het verdwenen jaarpaneel wordt conform r38 als afwezig gecontroleerd; de financiële jaarberekening blijft elders getoetst.

De inkomensbronreeks slaagt 15/15, inclusief privacy, fysieke rekeningisolatie, centensommen, historische bronweergave en XSS. De overige mobiele/modalreeks slaagt na de gedocumenteerde header-/rastercorrecties 29/29. De inkomensbronbedragen worden in centen vergeleken, inclusief de vaste teruggaven uit de expliciete fixture; alleen de verwachting over waar die bronregels zichtbaar zijn is gewijzigd. De terugkeer uit een brontransactie herstelt de vooraf geopende inkomensdialoog zoals de bestaande app beoogt.

`package2-planning-timeline` gebruikt de oude geneste vaste-lastbewerknop; de hele canonieke lastregel is nu de knop. De hoogte-/positiegetallen zijn nog van de oude dashboardkaarten. Voor die visuele vergelijking wordt een expliciete r46-mainreferentie gebruikt; eerdere financiële historie en back-upassertions blijven behouden.

`package3-transaction-engine` stopt op exact oude budgetknopnamen, een verkeerde importmaand en niet-geopende transactiekaarten. De actuele toegankelijke naam bevat ook de zichtbare bedragen; `data-open-budget-transactions` identificeert dezelfde categorie zonder die tekstafhankelijkheid. De importhelper kiest zichtbaar alle bronmaanden en opent de bedoelde kaart vóór Meer opties, bewerken of goedkeuren. Verwerken gebeurt na terugkeer naar de lijst. Financiële assertions voor vaste-lastactuals, splits, interne bijdragen, salary replacement, ledger, refunds en herladen blijven ongewijzigd. Nieuwe inhoudelijke afwijkingen worden niet automatisch als testfout behandeld.

De zeven V50-visuele gevallen zijn afzonderlijk gereproduceerd: alle zeven mislukken tegen de bewust gewijzigde r46-layout. Geen oude baseline is overschreven. Een nieuwe lokale Git-export van de onveranderde GitHub-maincommit `7a7d72e25660975ba88269e7835b98d32858ada5` levert onafhankelijke r46-pixel-/stijlreferenties. Daardoor wordt de herstelbranch niet met zijn eigen uitvoer vergeleken.

De V113/P1/P2-importfixtures vervangen na bootstrap het rekeningregister door onvolledige legacyprofielen. De huidige registervalidatie weigert daardoor de volledige testmutatie, inclusief geselecteerde maand; importregels verschijnen niet. Een correctie met initiële opslagprofielen is onderzocht. De V113-proef komt daarmee voorbij de ontbrekende regels, maar stopt vervolgens op niet-geopende kaartvelden. Deze nog niet volledig geverifieerde wijzigingen zijn niet behouden; de drie bestanden blijven voor verdere gerichte afhandeling openstaan. De registervalidatie blijft ongewijzigd.

De bronrouteringstest gebruikt een willekeurige muiscoördinaat op de transactieregel; die raakt niet noodzakelijk de bewerkknop. Beide CSV/API-gevallen slagen via de aanwezige zichtbare knop, met dezelfde bronrouteringsassertions. Het transferpaar miste bijbehorende bronregels in zijn lege importfixture; de actuele renderer toont uitsluitend paren die aan aanwezige bronregels verbonden zijn. De fixture krijgt die regels; transferbedragen en huishoudtotalen blijven ongewijzigd getoetst.

De maand-eindespaarreeks gebruikt verdwenen r38-KPI-elementen en periodeknoppen. De tien tests lezen nu hetzelfde spaarbedrag op de huidige kaart, geplande/extra bedragen in de bestaande berekeningsuitleg en de laagste prognose in de huidige grafiekstatistiek. De periodekeuzelijst vervangt alleen de oude filterknoppen. Alle oorspronkelijke concrete bedragen blijven gecontroleerd. Resultaat: 10/10 geslaagd. De transactiemotorreeks slaagt 15/15; CSV- en bank-API-bronroutering slagen beide via de zichtbare bewerkknop.

Na hervatting is V117-P1 afzonderlijk afgerond: 6/6 geslaagd met initiële rekeningfixtures en zichtbare kaartopening. Getoetst blijven groepsselectie, zeven duurzame commits bij opslagfout, foutloze hervatting, geen late heropening en synchronisatie met een tweede mockclient. V117-P2 heeft dezelfde verklaarde rekeningfixture/kaartoorzaak; alleen die testvoorbereiding en de kaartopening na herstart worden gecorrigeerd.

De zes maandgrens-budgettests en twee centrale-saldo/betaaldatumtests stoppen eveneens op de verdwenen r38-KPI-markup. De huidige spaarkaart, berekeningsuitleg en grafiekstatistiek tonen dezelfde waarden; uitsluitend die selectors worden aangepast. Concrete saldi, bankbronbedragen, budgetpotten, volgende-maandbuffer en onveranderde staat blijven vereist.

V117-P2 slaagt 14/14, inclusief alle zeven IndexedDB-abortgrenzen, volle localStorage, herstart met onafgemaakte goedkeuring en de bestaande grote-opslagproef. De saldo-/maandgrensgroep slaagt 8/8 met ongewijzigde financiële assertions. V113 krijgt uitsluitend dezelfde al bewezen initiële rekeningfixture en zichtbare kaart-/maandroute; de oude dashboardbudgetroute verwijst conform r38 naar het gezamenlijke rekeningoverzicht.

De acht P5-importlevenscyclusgevallen stoppen op verborgen goedkeurknoppen in compacte bronkaarten. De bestaande goedkeurhelper kiest alle bronmaanden en opent de bedoelde kaart vóór dezelfde goedkeuring. Levenscyclus, overlap, twee apparaten en atomaire cloudpublicatie blijven met ongewijzigde financiële assertions getest.

De P4-spaar/refundreeks mist haar spaardoelfixture doordat zij na bootstrap het rekeningregister vervangt: de gezamenlijke commit wordt geweigerd. Dat verklaart de lege doelkeuzelijst en ontbrekende categoriecorrecties vóór enige bedragassertion. De bedoelde profielen worden initieel ingevoerd; importkaartacties krijgen dezelfde zichtbare maand-/focusroute als de reeds geslaagde importreeksen. Er worden geen spaar-, refund- of dekkingsregels gewijzigd.

De opslagraceproef na afmelden faalt met `release is not a function`: de vaste wachttijd van 10 ms garandeert niet dat de asynchrone back-up al gestart is. De test wacht voortaan op de expliciete start van dezelfde geblokkeerde back-up. Afmelden gebeurt nog steeds tijdens die back-up; zowel geweigerde oude cloudacceptatie als volledig behouden lokale staat blijven vereist.

Van de 30 afzonderlijk uitgevoerde V118-bankmocktests slagen 27 direct. De drie resterende rekeningisolatiegevallen stoppen bij een ingeklapte Bankstatus op het r38-dashboard: de aanwezige synchronisatieknop is daardoor verborgen. De test opent de bestaande details via het zichtbare summary-element. De netwerklaag blijft volledig gemockt; de assertions blijven vereisen dat alleen de gekozen gezamenlijke/persoonlijke rekening wordt bijgewerkt en Dara geblokkeerd blijft.

P6 verwacht de oude titel Zakgeld, het oude mobiele bedrag-element en een vervallen geneste vaste-lastbewerknop. De huidige inkomenskaart en canonieke lastregel worden aangesproken; salarisprecedentie, terugbetaling en historische bedragen blijven ongewijzigd vereist. P7 vraagt een niet meer aanwezige externe app.js-tag en hardcodeert r25. De bestaande release-shellhelper controleert nu de actuele inline shell, met browser-releasebewijs en bytegelijke gecachete app.js/app.css; oude cacheverwijdering en behoud van een andere appcache blijven vereist.

De vervolggroep telt 44/48 geslaagd: alle bankrekeningisolatie-, opslag- en P7-release/PWA-gevallen slagen. P6 heeft nog vier oude presentatie-/routeverwachtingen: desktop heet Totaal inkomen, mobiel gebruikt een direct strong-element en de eigenaargebonden planner bevat inmiddels uitsluitend vaste lasten. De historische inkomstenproef opent daarom via de bestaande algemene plannerfunctie dezelfde echte editor; deze proef bewijst financiële editorhistorie, niet de menunavigatie. De concrete september-/januaribedragen blijven ongewijzigd.
