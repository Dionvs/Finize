# Visuele verbetering Finize — 27 oktober 2026

Basis: V118-r24, commit `cfc576f34fa0e28a65083a441d483a12b96a269e`.
Aanvankelijk uitsluitend lokaal uitgevoerd. Na review is publicatie als V118-r25 expliciet geautoriseerd; zie [het releaseverslag](v118-r25-release.md).

## Uitgevoerd

- Onder 768 px staan de KPI-kaarten in twee kolommen. Kaarten groeien met de inhoud; de hoofdbreedte houdt ook rekening met een zichtbare browser-scrollbar.
- Budgetten en transacties staan op mobiel onder elkaar. Omschrijvingen kunnen doorlopen en de transactielijst heeft een begrensde eigen scrollruimte.
- Van 768 tot 1199 px staan budgetten en transacties, en de spaardoelenlijst en het detailpaneel, onder elkaar. De afbeelding in het detailpaneel staat boven de tekst.
- De brede indeling vanaf 1200 px blijft behouden.
- Mobiele periodeknoppen lopen door naar een volgende regel.
- Mobiele volledige bewerkvensters hebben één scrollende overlay; de achterliggende pagina blijft op zijn plaats.
- In Nakijken schuift de bestaande actiegroep met de inhoud mee. De gewone HTML-springlink **Naar acties** brengt de gebruiker naar de bestaande knoppen en verplaatst de toetsenbordfocus naar de actiegroep.

De bestaande tekstformaten, infoknopjes, kleuren, iconen en financiële inhoud zijn behouden. De nieuwe stylesheet bevat geen lettergrootte-aanpassingen. De importwijziging voegt alleen de springlink en zijn doel toe; de bestaande acties en handlers zijn ongewijzigd.

## Verificatie

- Alle **86 Node-testbestanden** geslaagd, inclusief financiële regressies.
- **12 layouttests** geslaagd op de definitieve code: 320, 390, 430, 767, 768, 1024, 1199, 1200 en 1440 px; daarnaast vergelijking van berekende tekstformaten en infoknopmaten met de oorspronkelijke CSS, voor standaard- en iPhone-weergave, en de bereikbaarheid van sluiten/opslaan in het mobiele spaardoelvenster.
- De layouttests controleren de inhoud van kaarten en hun schermgrenzen, niet alleen de paginabreedte. Daarmee wordt afsnijding achter `overflow:hidden` ook gedetecteerd. De financiële state blijft identiek bij het doorlopen van de schermen.
- Bredere gerichte browserronde: **46 geslaagd, 3 bestaande prognosetests mislukt**. Alle nieuwe layout- en importnavigatietests, iPhone/Android-indelingstests, betaalvoortgang en toetsenbord-/focuscontroles slagen.
- JavaScript-syntax, CSS-parse, reproduceerbare build en `git diff --check` geslaagd.
- Impeccable-detector voor de nieuwe stylesheet: geen bevindingen.
- Lokale app geopend en visueel gecontroleerd met synthetische testgegevens. De preview blokkeert externe script-, worker- en verbindingsroutes; er zijn geen productiegegevens gebruikt voor deze implementatietests.

## Bestaande testafwijkingen

De drie prognosetests in `v118-ux-minimal.spec.cjs` verwachten oudere prognose-uitleg of prognosegrenzen. Alle drie falen ook met de oorspronkelijke `HEAD:app.css` en `HEAD:app.js`. De uitleg en rekenmotor zijn binnen deze opdracht niet aangepast. Deze vergelijking is vastgelegd in `.cache/responsive-fit/baseline-ux.log`.

Daarnaast zijn twee oude tests uit `desktop-special-tabs.spec.cjs` expliciet tegen de oorspronkelijke code uitgevoerd. Ook daar ontbreken de oude dashboardverdelingskaarten en het veld `#u3RecDebitDate`. Deze oudere tests zijn niet gerepareerd binnen de visuele opdracht. De bredere desktopronde is daarom geen volledig groene regressiesuite.

Lokale bewijsbestanden:

- `.cache/responsive-fit/unit.log`
- `.cache/responsive-fit/final-browser.log`
- `.cache/responsive-fit/final-layout.log`
- `.cache/responsive-fit/baseline.log`
- `.cache/responsive-fit/baseline-ux.log`
- `.cache/responsive-fit/mobile-390.png`

## Resterende apparaatcontrole

De iPhone- en Androidcontroles zijn browseremulaties. Werkelijke iPhone/Safari-, Android-schermtoetsenbord- en 200%-browserzoomcontroles zijn hiermee niet bewezen. De afzonderlijk geautoriseerde release verhoogt de PWA-cache naar `finize-v118-r25`.
