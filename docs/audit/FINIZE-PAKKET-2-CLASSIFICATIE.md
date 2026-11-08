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
