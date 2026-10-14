# V118 P3 — Impeccable-hercontrole

Datum: 14 oktober 2026. Werkbuild `118-p3`, HEAD `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`, branch `agent/v117-stabilisatie`.

## Oordeel

De dashboardstructuur volgt de referenties en financiële prognosewaarden blijven bij P2. De presentatie is nog niet volledig acceptatieklaar: de persoonlijke zakgeldkaart toont een onjuist verdelingspercentage. Daarnaast zijn zes concrete presentatie-/responsiveverbeteringen gevonden. De eerdere oplevering was op dit punt te stellig.

Dit is een nieuwe, uitsluitend controlerende ronde op verzoek van de gebruiker. Er zijn geen applicatiebestanden gewijzigd. De 18 in het P3-opleverbewijs gehashte bestanden zijn opnieuw gecontroleerd: alle hashes zijn gelijk. Eerdere groene tests blijven historisch bewijs; in deze ronde is geen volledige testreeks opnieuw uitgevoerd.

## Uitgevoerde controle

- Impeccable 4.0.2-auditreferentie toegepast; sessiecontext uit de implementatieronde behouden.
- Onafhankelijke `impeccable_finish_reviewer` opnieuw gestart. Deze keer is de review uitgevoerd, inclusief de goedgekeurde referenties, actuele UI/CSS en screenshots.
- Nieuwe browseropeningen met uitsluitend synthetische testgegevens op 1440, 390 en 320 px; desktop ook versmald van 1440 naar 1200 px.
- Nieuwe screenshots en DOM-metingen onder `.cache/v118-p3-recheck/`, waaronder aparte mobiele screenshots na scrollen tot onderaan.
- Detector opnieuw uitgevoerd op verzoek van de gebruiker: `[]`. Dit is een mechanische uitkomst; de onderstaande semantische en visuele fouten worden er niet door uitgesloten.
- Geen deployment, productiegegevens, financiële berekeningen, andere fase of algemene prestatie-/regressieronde aangepast.

## Audit Health Score

| Dimensie | Score | Belangrijkste bewijs |
|---|---:|---|
| Toegankelijkheid | 3/4 | Contrasten van getoetste hoofdcombinaties voldoende; belangrijke mobiele ondersteunende tekst is 10–11 px |
| Performance | 4/4 | Geen nieuwe grafiekbibliotheek of netwerklaag; geen benchmarkclaim |
| Responsive | 3/4 | Geen pagina-overflow op drie breedtes; grafiek schaalt bij vensterverkleining verkeerd mee |
| Theming | 4/4 | Bestaande tokens, iconen en navigatie behouden |
| Implementatie-integriteit | 2/4 | Persoonlijk zakgeldpercentage onjuist; gebeurtenismarkering/minimum onvoldoende onderscheiden |
| **Totaal** | **16/20** | Goed fundament, één belangrijke presentatiecorrectie nodig |

Telling: 0 blokkerende P0-bevindingen, 1 P1, 5 P2, 1 P3. Dit is geen WCAG-certificering.

## Bevindingen op prioriteit

### 1. P1 — persoonlijk zakgeld wordt altijd als 100% getoond

Locatie: `src/core/runtime.js:3373` en `src/ui/dashboard.mjs:56`. Categorie: implementatie-integriteit/financiële presentatie.

De persoonlijke context levert slechts één allowance-rij aan. De presentatielaag deelt het bedrag vervolgens door de som van die ene rij. Live bevestigd op alle drie de breedtes: Dion krijgt `€ 1.166,58 · 100%`, terwijl dezelfde bestaande gezamenlijke verdeling Dion `44,9%` en Dara `55,1%` geeft. Het zakgeldbedrag is correct; het percentage is misleidend.

Herstel: gebruik de som van beide bestaande V117-zakgeldbedragen als presentatienoemer, ook wanneer alleen de eigen rij wordt getoond. Behoud de bestaande tekortbehandeling en wijzig geen verdelingsformule. Voeg één gerichte browserassertie voor het persoonlijke aandeel toe. Aanpak: `$impeccable harden`.

### 2. P2 — grafiek past zijn interne breedte niet aan na vensterverkleining

Locatie: `src/ui/dashboard.mjs:28` en de grafiekrendering in `load`. Categorie: responsive/toegankelijkheid.

Bij 1440 px heeft de grafiek een viewBox-breedte van 677. Na versmallen naar 1200 px is de daadwerkelijke grafiekbreedte 526,36 px, terwijl de viewBox 677 blijft. De 11px SVG-tekst wordt daardoor effectief circa 8,6 px en het bedoelde 44px-raakgebied circa 34,2 px. De native dagselectie blijft een bruikbaar alternatief; de beloofde grafiekleesbaarheid/touchgrootte blijft niet behouden.

Herstel: observeer de grafiekcontainer en teken bij een relevante breedtewijziging uitsluitend de bestaande P2-dataset opnieuw. Geen nieuwe prognoseaanvraag of financiële herberekening. Aanpak: `$impeccable adapt`.

### 3. P2 — minimum heeft dezelfde vorm en kleur als gewone uitgaven

Locatie: `src/styles/dashboard-p3.css:50`, `src/ui/dashboard.mjs:37`. Categorie: visuele hiërarchie/implementatie-integriteit.

`.p3-min` en `.p3-expense` delen dezelfde rode vulling, witte rand en stipvorm. De legenda noemt gezamenlijk Uitgaven / minimum. Alleen de KPI, toegankelijke puntnaam en de geselecteerde dag maken het minimum onderscheidbaar; de grafiek zelf doet dat onvoldoende.

Herstel: een eigen ring of vorm voor het minimum, zichtbaar datumlabel en afzonderlijke legenda-aanduiding. Datum en bedrag blijven uit P2 komen. Aanpak: `$impeccable clarify`.

### 4. P2 — saldopunten zonder gebeurtenis lijken uitgaven

Locatie: `src/ui/dashboard.mjs:37`. Categorie: implementatie-integriteit.

Een begin-/eindpunt zonder inkomen en zonder concrete gebeurtenis valt terug op `p3-expense`. Live bevestigd voor 14 oktober: rode uitgavenstip, terwijl het detailvak Geen concrete betaling meldt. De legenda suggereert daarmee een kasgebeurtenis die er niet is.

Herstel: neutrale saldomarkering voor punten zonder gebeurtenissen; uitgavenkleur uitsluitend voor concrete uitgaven. Aanpak: `$impeccable clarify`.

### 5. P2 — belangrijke mobiele ondersteunende tekst is te klein

Locatie: `src/styles/dashboard-p3.css:98`, `:127`, `:129`, `:145`. Categorie: leesbaarheid/toegankelijkheid.

DOM-metingen bevestigen 10 px voor saldo-/kwaliteitsstatus en spaardoelondertekst, 11 px voor onder meer labels en doelbedragen. Dit is geen automatische WCAG-overtreding op basis van lettergrootte alleen, maar belangrijke betrouwbaarheidstekst vraagt op een telefoon te veel inspanning.

Herstel: belangrijke ondersteunende informatie naar ten minste ongeveer 12 px, daarna 320/390 px controleren op wrapping en bedragen. Aanpak: `$impeccable typeset`.

### 6. P2 — exacte prognoseperiode staat uitsluitend in ingeklapte uitleg

Locatie: `src/ui/dashboard.mjs:44` en de vaste grafiekcaption. Categorie: duidelijkheid.

Een geselecteerd filter is herkenbaar, maar de berekende begin-/einddatum staat alleen in de uitleg. Bij Volgende salaris is juist de daadwerkelijke salarisgrens financieel betekenisvol. De as toont wel losse daglabels, maar geen expliciete periodeverklaring.

Herstel: compacte dynamische periode bij Saldo-ontwikkeling, inclusief einde vóór salaris bij de standaardhorizon. Aanpak: `$impeccable clarify`.

### 7. P3 — desktopcompositie is ruimer dan de goedgekeurde referentie

Locatie: Vooruitblik en hoofdpanelen. Categorie: compositie/ruimtegebruik.

De juiste kaarten staan in de juiste volgorde, maar uitleg, kwaliteitsinformatie, instellingsactie en grafiekbediening maken het dashboard aanzienlijk hoger. Daardoor verschijnen de middenkaarten en jaarcijfers later dan in het voorbeeld.

Herstel: verwante uitleg en kwaliteitsinformatie compacter groeperen en lege verticale ruimte verminderen, zonder 44px-doelen of onzekerheidsmeldingen weg te nemen. Aanpak: `$impeccable layout`.

## Gecontroleerd en geen fout bevonden

- Geen horizontale pagina-overflow op 1440, 390 en 320 px.
- De gemeten zichtbare tekstknoppen/filters en details-samenvattingen halen bij de oorspronkelijke breedte minimaal 44 px in beide richtingen. SVG-doelen bij resize zijn de afzonderlijke bevinding hierboven.
- Getoetste contrasten: secundaire tekst op kaart 6,00:1; groene tekst op wit en wit op geselecteerd groen 5,06:1; waarschuwingstekst op waarschuwingachtergrond 5,16:1. Dit is een steekproef, geen volledige contrastcertificering.
- Vier mobiele prognose-KPI's en vier jaar-KPI's blijven 2×2; de mobiele jaargrafiek is verborgen.
- De vermeende overlap van ondernavigatie en Jaaroverzicht op de lange screenshot is geen onbereikbare inhoud. Verse screenshots na scrollen tot onderaan tonen alle jaarcijfers volledig boven de navigatie. De oorspronkelijke full-page-capture laat een vaste navigatie op haar viewportpositie over een verder verlengde pagina zien.
- P2 blijft de bron van prognosewaarden; het spaardoel wordt niet opnieuw afgetrokken. Bedragen worden niet door de audit gewijzigd.

## Aanbevolen vervolgronde

Eerst `$impeccable harden` voor het persoonlijke percentage, vervolgens `$impeccable adapt` voor resize, `$impeccable clarify` voor markeringen/periode, en `$impeccable typeset`/`$impeccable layout` voor leesbaarheid en compactheid. Sluit af met `$impeccable polish` en een gerichte controle van alleen de gewijzigde gevallen.

Deze punten kunnen afzonderlijk of in één herstelronde worden uitgevoerd. Deze controlerende opdracht heeft de fixes niet toegepast.

## Bewijsbestanden

- `.cache/v118-p3-recheck/dom-metrics.json`: breedtes, fonts, raakgebieden, grafiek-viewBox en persoonlijke zakgeldtekst.
- `.cache/v118-p3-recheck/check.log`: compacte uitvoer van de live controle.
- `.cache/v118-p3-recheck/impeccable-detector.json`: geen mechanische bevindingen.
- `.cache/v118-p3-recheck/dashboard-1440.png`, `dashboard-390.png`, `dashboard-320.png`: verse dashboards.
- `.cache/v118-p3-recheck/year-bottom-390.png`, `year-bottom-320.png`: bereikbare jaarcijfers na scrollen tot onderaan.
