# Finize V118 P3 — Impeccable-herstel

Datum: 14 oktober 2026. Werkbuild: `118-p3r1`. Branch: `agent/v117-stabilisatie`.
HEAD: `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`. Lokaal, ongecommit en niet gepubliceerd.

## Uitkomst

Alle zeven bevindingen uit [`docs/v118-p3-impeccable-hercontrole.md`](docs/v118-p3-impeccable-hercontrole.md) zijn gericht hersteld. Vooraf waren ze nog aanwezig; er is niets opnieuw gewijzigd dat inmiddels al opgelost was. De kaartvolgorde, bestaande huisstijl, navigatie en financiële bronnen blijven volgens [`docs/v118-p3-dashboard-design.md`](docs/v118-p3-dashboard-design.md).

| Bevinding | Status en bewijs |
|---|---|
| Persoonlijk zakgeldpercentage | Opgelost. Gezamenlijk en persoonlijk gebruiken dezelfde twee V117-zakgeldbedragen als noemer. Fixture: Dion 44,9%, Dara 55,1%, met ongewijzigde bedragen. Beide persoonlijke contexten en de gezamenlijke context getest. |
| Grafiekresize | Opgelost. ResizeObserver tekent uitsluitend de bestaande dataset opnieuw, bewaart dagselectie/focus en coalescet updates per animation frame. Geen nieuwe P2-aanvraag bij resize, ook niet over de mobiele grens. |
| Herkenbaar minimum | Opgelost. Apart ruitvormig kader, zichtbaar datumlabel en afzonderlijke legenda. Minimumdatum/waarde komen uitsluitend uit P2. Concrete gebeurtenissen blijven als stip in het kader herkenbaar. |
| Neutrale saldopunten | Opgelost. Punten zonder concrete gebeurtenis hebben een neutrale saldomarkering. Alleen concrete uitgaven worden rood; inkomsten blijven blauw. Labels benoemen de betekenis. |
| Mobiele leesbaarheid | Opgelost. Belangrijke KPI-labels, status, spaardoelondertekst, doelbedragen, kwaliteitsinformatie en jaarlabels zijn minimaal 12 px. Hoofdwaarden zijn behouden. |
| Zichtbare prognoseperiode | Opgelost. Werkelijke P2-begin/einddatum staat bij Saldo-ontwikkeling. Standaard: Tot vóór volgend salaris; handmatig: Einddatum inbegrepen. Onbekende horizon krijgt geen fictieve einddatum. Alle filters getest. |
| Compactere desktop | Opgelost. Uitleg, kwaliteitsinformatie en instellingsacties delen ruimte; grafiekselectie en dagdetails staan naast elkaar; padding/gaps en grafiekhoogte zijn verkleind. Alle informatie en 44px-bediening blijven beschikbaar. |

## Bescherming van de bestaande werkstand

Vóór wijzigingen zijn branch, HEAD en de complete werkboom gecontroleerd. P5a/P1/P1b/P2/P3 waren ongecommit aanwezig en zijn behouden. Geen reset, checkout of opschoning uitgevoerd.

Herstelpunt met SHA-256 en gecontroleerde kopieën:

`C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-p3-herstel-20261014-155821`

`src/ui/presentation.js` is vóór de kleine aanvullende wijziging eveneens in dit herstelpunt opgenomen. Het manifest legt de oorspronkelijke status en hashes vast. De vergelijking met de eindstand staat in `.cache/v118-p3-herstel/file-comparison.json` en het auditbewijs.

## Exact aangepaste applicatiebestanden

- `src/core/runtime.js`: geeft de twee bestaande zakgeldbedragen als afgeleid presentatieveld door; ruimt de dashboard-UI op bij tabwisseling. Geen financiële formule gewijzigd.
- `src/ui/dashboard.mjs`: gedeelde percentagenoemer, ResizeObserver/lifecycle, dag-/focusbehoud, minimum-/neutrale markeringen, periodeaanduiding en compactere informatiegroepering.
- `src/styles/dashboard-p3.css`: 12px ondersteunende tekst, minimumvorm en compacte responsive layout binnen bestaande tokens.
- `src/ui/presentation.js`: slaat uitsluitend bij het actieve P3-dashboard de oude volledige herinitialisatie op breakpointwisseling over. Andere schermen behouden hun bestaande gedrag. P3 reageert via CSS en zijn grafiekobserver.
- `app.js` en `app.css`: opnieuw reproduceerbaar gegenereerd.
- `index.html` en `service-worker.js`: gezamenlijke lokale asset-/cacheversie `118-p3r1`.

Testbestanden: `tests/v118-p3-dashboard.test.cjs`, `tests/browser/v118-p3-dashboard.spec.cjs`, plus uitsluitend de assetversie in `tests/html-inline-syntax.test.cjs`, `tests/package7-release-audit.test.cjs`, `tests/service-worker-cache.test.cjs`, `tests/update4-final-regression.test.cjs`, `tests/update5-responsive-structure.test.cjs` en `tests/browser/package7-release-audit.spec.cjs`.

Nieuwe opleverbestanden: dit verslag en `docs/audit/v118-p3-herstel-bewijs.json`. Eerdere rapporten blijven historische opleveringen.

## Zakgeld en randgevallen

De runtime levert `allowanceDistribution: [r.dion.zakgeld, r.dara.zakgeld]` vanuit de bestaande `calcScenario`-uitkomst. De kaart kan één of twee personen tonen; `allowanceShare` gebruikt altijd diezelfde gezamenlijke noemer. Deze verhouding is uitsluitend presentatie en verandert geen zakgeldbedrag of boeking.

De bestaande behandeling blijft behouden: bij totale nul of een negatief persoonsbedrag geen percentage/progressie, maar Verdeling niet beschikbaar. Een expliciete nul naast een positief bedrag blijft 0%/100%. Deze gevallen zijn afzonderlijk getest.

## Grafiek en lifecycle

De observer meet de daadwerkelijke containerbreedte, met een tolerantie van 0,5 px. Hertekening wordt per animation frame samengevoegd; een hoogtewijziging bij dezelfde breedte veroorzaakt geen hertekenlus. Resize gebruikt de reeds beschikbare projectie. De geselecteerde dag en focus op grafiekpunt/dagselectie worden waar van toepassing hersteld.

Bij tabwisseling of hermount worden observer, animation frame en gedelegeerde eventlisteners opgeruimd. Verouderde projectieresultaten blijven door de bestaande generatiecontrole onderdrukt. Terugkeren naar Dashboard laadt één actuele projectie; resize zelf laadt er geen.

Minimum en gebeurtenissen blijven gescheiden betekenissen. Een minimumdag met een uitgave heeft één toegankelijk grafiekpunt met ruitkader en uitgavenstip. Bij zowel een inkomst als uitgave benoemt het punt beide; er ontstaat geen nieuwe financiële gebeurtenis. Een budgetschatting op een dag maakt geen concrete uitgavenstip.

## Tests en DOM-metingen

**129 Node-tests geslaagd, 0 mislukt.** Daarvan 18 P3-presentatiegevallen, inclusief 4 nieuwe herstelgevallen. De direct geraakte P2-, zakgeld-, budget-, cache- en structuurcontracten zijn meegenomen.

**14 P3-browsertests geslaagd, 0 mislukt.** Daarvan 4 nieuwe herstelgevallen: aandelen, resize/lifecycle en twee mobiele controles. Bestaande P3-tests blijven groen voor filters, contextvoorkeur, rekeningdetails, buffer, Bekijk alles, jaarselectie, ontbrekende gegevens, raceconditions en financiële bronstate.

| Viewport | Grafiekbreedte | ViewBox-breedte | Effectieve SVG-tekst | Raakgebied | Pagina-overflow |
|---:|---:|---:|---:|---:|---|
| 1440 | 686,73 px | 686,73 | 12 px | 44×44 px | Nee |
| 1200, vanuit 1440 | 535,63 px | 535,63 | 12 px | 44×44 px | Nee |
| 1440, terug | 686,73 px | 686,73 | 12 px | 44×44 px | Nee |
| 390 | 344 px | 344 | 12 px | 44×44 px | Nee |
| 320 | 274 px | 274 | 12 px | 44×44 px | Nee |

Dezelfde test wisselt ook dynamisch door naar 390/320 en terug naar 1440. Selectie en focus blijven bruikbaar; er zijn **0 extra P2-aanvragen en 0 Firestore-verzoeken** door de resize-reeks. Muis, echte touch via de browser-touchinvoer en Enter/Space zijn gebruikt. De financiële bronstate blijft bytegelijk na de geteste interacties. Belangrijke mobiele ondersteunende teksten meten alle 12 px; vier prognose-KPI's en vier jaar-KPI's blijven 2×2.

Build, byte-reproduceerbare assets, JavaScript-syntax, CSS en `git diff --check` slagen. CSS meldt alleen het eerder bestaande token `--line`.

## Visuele controle en Impeccable

De daadwerkelijk beschikbare Impeccable 4.0.2-playbooks harden, adapt, clarify, typeset en layout zijn toegepast op de zeven bevindingen. De sessiecontext en bestaande Finize-tokens zijn hergebruikt. Polish is als afsluitende gerichte controle uitgevoerd op het gebouwde dashboard en de echte screenshots. Geen nieuwe ontwerprichting, beeldgeneratie of algemene refactor.

De mechanische detector op de gewijzigde dashboard-UI/CSS geeft `[]`. Dat resultaat is aangevuld met daadwerkelijke DOM-metingen en visuele vergelijking, niet als zelfstandig kwaliteitsbewijs gebruikt. Er is in deze herstelronde geen nieuwe onafhankelijke reviewer gestart; de bestaande onafhankelijke bevindingen zijn aantoonbaar afgewerkt zoals gevraagd.

Screenshots, daadwerkelijk geopend en vergeleken met de eerdere P3-weergave en de goedgekeurde referenties:

- `.cache/v118-p3-herstel/dashboard-1440.png`
- `.cache/v118-p3-herstel/dashboard-1200.png`
- `.cache/v118-p3-herstel/dashboard-390.png`
- `.cache/v118-p3-herstel/dashboard-320.png`

Op 1440 px wordt dezelfde synthetische dashboardfixture **1336 px hoog in plaats van 1558 px**: 222 px, circa 14,2%, korter. Kaartvolgorde en inhoud blijven behouden. Op 1200 px mogen de filters naar een eigen rij; grafiek en betalingen blijven naast elkaar. Op mobiel blijft de bestaande indeling behouden, met de grotere ondersteunende tekst. De bestaande ondernavigatie blijft vast en de volledige inhoud blijft erboven bereikbaar na scrollen.

## Bewijs van ongewijzigde financiële logica

De hashes van P1/P2-modules, profielregisters, bankinvoer, eerdere opslag-/importwijzigingen en hun bewijsdocumenten zijn gelijk aan het herstelpunt. De transactiemotor is bovendien gelijk aan de Git-versie op HEAD.

Omdat `src/core/runtime.js` ook bestaande financiële functies bevat, zijn afzonderlijke bronsecties vóór/na vergeleken: `calcScenario`, `monthlyFinancialForecast`, `sumTransactions`, `getMonthFinancialResult`, `calcGroep`, `calcDoel` en `resolveMonthlyIncome` zijn alle bytegelijk. Hashes staan in `.cache/v118-p3-herstel/financial-functions.json` en het auditbewijs. De browsertests vergelijken de getoonde P2-waarden en bestaande maandprojecties opnieuw.

## Grenzen en beoordeling

Geen commit, push, merge, deployment, productiewijziging, cloudmigratie, P4/P5b, schaaltest, benchmark of volledige emulator-/V118-regressie uitgevoerd. Alle browsergegevens zijn synthetisch en lokaal.

Resterende grenzen zijn die van P2: ontbrekende rekening-/salarisinstellingen of bankdekking blijven onzekerheden. De controle gebruikte Chromium-browseremulatie, geen fysieke telefoon of volledige schermlezer-/WCAG-certificering. De desktopweergave blijft bij lange kwaliteitsmeldingen hoger dan de illustratieve referentie; relevante informatie wordt niet verborgen om een vaste hoogte af te dwingen.

De zeven herstelpunten zijn afgerond en geverifieerd. P3 blijft wachten op beoordeling door de gebruiker voordat het definitief wordt afgesloten of P4 begint.
