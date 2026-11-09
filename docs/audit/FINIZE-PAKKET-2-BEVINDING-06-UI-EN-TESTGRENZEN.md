# Pakket 2 — resterende UI-bevindingen en testgrenzen

Datum: 9 november 2026. Geen applicatiecorrecties voor onderstaande punten uitgevoerd. De gebruiker vraagt grotere aanpassingen te rapporteren en de overige controles te vervolgen.

## Focus na hertekenen van een mobiele inkomenskaart

De bestaande focusproef opent bij 390 px het inkomensoverzicht via `.mt-income`, hertekent het persoonlijke scherm na wijziging van de weergegeven naam en sluit met Escape. De oorspronkelijke knop is dan vervangen; de nieuwe inkomensknop krijgt geen focus. De assertion blijft falen.

Oorzaak: `openIncomeOverview` kan alleen de oorspronkelijke trigger focussen wanneer die nog verbonden is met de DOM. De algemene `openerSelector` in `src/ui/dialog-accessibility.js` bewaart `data-open-income-overview` uitsluitend voor de oude `.ux-card-primary`-constructie, niet voor de directe mobiele knop. Bij hertekenen ontbreekt daardoor een stabiele terugkeerselector.

Ernst: toegankelijkheidsprobleem bij deze hertekenrandvoorwaarde; geen aangetoonde financiële wijziging. De proef simuleert de tussentijdse hertekening programmatisch. Er is geen volledige gebruikersroute naar een gelijktijdige naamswijziging bewezen. Een gerichte toekomstige correctie kan de bestaande mobiele openeridentiteit ondersteunen zonder financiële logica te wijzigen.

Bewijs: `ux-current-retest.json`, geval `focusherstel vindt de oorspronkelijke kaart na hertekenen met veranderde tekst`.

## Verschil tussen grafiekmarker en legendatekst

De oude jaarbalken zijn sinds r38 verwijderd. De bijgewerkte presentatieproef gebruikt daarom de bestaande saldografiek. Daar verschilt de berekende kleur van de inkomstenmarker (`rgb(77, 127, 184)`) van de legendatekst (`rgb(54, 102, 158)`). `src/styles/ux-minimal.css` maakt de legendatekst donkerder dan de markerstijl.

Dit is een bewezen visueel verschil, geen bewezen fout in bedragen of categorisatie. Of exact gelijke kleuren nog de bedoelde ontwerpafspraak zijn, moet bij pakket 3 worden vastgesteld; een bewust donkerdere tekst voor leesbaarheid is mogelijk. De gelijkheidsassertion is behouden en blijft rood. Geen CSS aangepast om haar groen te maken.

Bewijs: `ux-current-retest.json`, geval `jaarlegenda gebruikt de reeks-kleuren en bedragen zijn zonder hover uitleesbaar`. De historische testnaam is voor herleidbaarheid behouden; de huidige verwachting en de verwijderde jaarweergave zijn in de test toegelicht.

## Oude nieuwe-huishoudenproef bereikt inkomensbron niet

`v117-p4.spec.cjs` verwacht na openen van de eigenaargebonden planning een knop `+ Inkomstenbron`. De huidige eigenaargebonden route toont uitsluitend vaste lasten. De oudere gemengde beheerfunctie bestaat nog intern, maar de proef heeft geen gevalideerde actuele gebruikersroute daarheen.

Classificatie: verouderde testbediening met een resterende dekkingsvraag voor terugkerende inkomstenbronnen. Dit bewijst op zichzelf niet dat het opslaan van zulke bronnen defect is. De oorspronkelijke assertions voor € 3.100 inkomen, budgetten, vaste lasten, offline herstart en tweede client blijven behouden. De rest van dit ene samengestelde scenario is niet bereikt. Er is geen interne globale testhaak aan de applicatie toegevoegd en geen vervangende financiële verwachting verzonnen.

Bewijs: `new-household-current-route.json`. De tussentijdse proef met een niet-geëxporteerde interne functienaam is teruggenomen en telt niet als actuele gebruikersroute.

## Schaalbewijs niet volledig beschikbaar

De eerdere 500-transactiesproef strandt op een ontbrekende uitvoermap bij het schrijven van foutbewijs. Deze rapportagefout kan de oorspronkelijke fout maskeren. De gedeelde browserhelper maakt die lokale uitvoermap nu standaard aan. De zware proef is conform de afspraak niet opnieuw gestart; de onderliggende schaaluitkomst is dus niet bevestigd.

De 5.400-transactiesproef is niet afgerond binnen de brede limiet van 90 minuten. De resterende schaal-/prestatiegevallen staan afzonderlijk in het testoverzicht en in de handmatige schaalworkflow. Geen financiële schaalassertion verwijderd of afgezwakt.
