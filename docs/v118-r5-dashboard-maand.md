# V118-r5 — dashboard volgt de geselecteerde maand

17 oktober 2026. Implementatie en publicatie expliciet goedgekeurd. Basis: V118-r4, commit `b398f0d9a369ceb50e10f00181067b0e9e48dbe1`.

## Resultaat

De maandkiezer is nu leidend voor Vooruitblik, saldo-ontwikkeling, betalingslijsten, budgetten, zakgeld en het jaaroverzicht. Bij een maandwissel wordt het periodefilter teruggezet naar **Deze maand**, inclusief de eerste en laatste kalenderdag; een oude eigen datum en geselecteerde grafiekdag worden gewist.

De filters 7/14 dagen starten vandaag binnen de huidige maand, anders op de eerste van de gekozen maand. Ze eindigen uiterlijk op het maandeinde. Eigen datum valideert dezelfde maandgrenzen. Volgend salaris blijft rekeninggebonden en wordt begrensd op het maandeinde; zonder betrouwbare salarisdatum wordt geen grens verzonnen. Het jaaroverzicht volgt het nieuwe maandjaar; een handmatig gekozen jaar blijft behouden zolang de maand niet wijzigt.

Spaardoelen benoemen opgebouwde bedragen als **Huidige stand**; bijbehorende maandplanning volgt de selectie. Huidig saldo blijft een bekende bankstand met expliciete ijkpuntdatum, geen gefingeerd toekomstig banksaldo. Bij historische periodes benoemt de kaart de historische saldodag.

## Berekening en ontbrekende gegevens

De bestaande dagelijkse motor is uitgebreid, zonder tweede berekening of datamodel. De werkelijke datum, zichtbare periode, salarisreferentiedatum en uiterste bruikbare waarnemingsdatum zijn gescheiden. Een toekomstige opening rekent vanaf het bekende ijkpunt via tussenliggende planning en bankgebeurtenissen vooruit. Historische periodes gebruiken geen ijkpunten na hun einddatum. Correcties en minima op het scherm blijven binnen de zichtbare periode.

De kalenderas en dagselectie blijven volledig. Dagen zonder bruikbaar saldo krijgen `null` in de presentatie, een onderbreking en uitleg; zij tellen niet als nul mee in lijn, minimum of waarschuwing. De echte berekende dagen blijven ongewijzigd. De regels voor actuele bestedingsruimte blijven behouden. Benodigde tussenmaanden worden via de bestaande opslag-/prognosekoppeling opgevraagd.

De broninterface voor dagelijkse projectie krijgt twee optionele, niet-opgeslagen parameters: `horizonReferenceDate` voor het zoeken naar de volgende ontvangst en `horizonLimitDate` voor de uiterste maandgrens. Bestaande aanroepen zonder `startDate` behouden hun gedrag. Geen wijziging aan schema, transacties, CSV, bankbronnen, opslagsysteem, synchronisatie, authenticatie, Firebase-configuratie of productiedata.

## Bewijs en controles

- Voor/na met dezelfde synthetische gegevens op 390 en 1440 pixels, gezamenlijk en Dion: de gepubliceerde r4-assets tonen bij november nog de periode **1–31 oktober**, met werkelijke grafiekdagen **14–31 oktober**. De nieuwe versie toont **1–30 november**. Geen JavaScriptfouten in deze acht beelden.
- 210 gerichte Node-controles groen, inclusief 17 nieuwe maandgevallen, dagelijkse prognose, historische reconstructie, spaarruimte, transactie-/planningscontracten en cachebescherming (`.cache/dashboard-month-r5-node-final.log`).
- Volledige Node-bestandsronde: 72/73 groen. Alleen de bestaande `update4-ui-structure.test.cjs` verwacht nog het oude `dashboard-year-overview`-element. Die fout is ook tegen de ongewijzigde r4-bestanden opnieuw aangetoond (`.cache/dashboard-month-baseline-structure.log`). Dit is geen volledig groene algemene suite.
- Eerste browserronde: 41/41 groen. Een latere ronde werd tijdens een lange onderbreking van de omgeving verstoord: één navigatietime-out en 41 geslaagde cases, met 23,2 uur gemeten duur. Die ronde is niet gebruikt als definitief groen bewijs.
- Definitieve release-browserronde: **43/43 groen**, zonder overgeslagen gevallen, in 2,8 minuten (`.cache/dashboard-month-r5-browser-final.log`). Inclusief de echte r4 → r5 cache-upgrade, offline herladen en terugrollen, met behoud van synthetische transacties, planning, maandafsluitingssnapshot, doelen, ijkpunten, importbron, journal, wachtrij en lokale opslag.
- Getest op 320, 390, 768 en 1440 pixels: gezamenlijke en persoonlijke context, kalendergrenzen, maand-/jaarwissel, filters, ontbrekende dagen, snelle maandwissel met late respons, herladen, budget-/zakgeldvergelijking met bestaande selectors, focus en bestaande vensters.
- Build, syntax, CSS en reproduceerbaarheid geldig; de bestaande melding over token `--line` blijft vermeld. Geen nieuwe CSS of layout toegevoegd.

Niet geclaimd: volledige cloud-/emulatorregressie, echte Google-aanmelding, echte banksynchronisatie of fysieke Safari/iPhone-test. Browsercontroles gebruiken synthetische gegevens en blokkeren externe backendverzoeken.

## Back-up en cache

- Nieuwe cache: `finize-v118-r5`; index, kritieke assets en versieasserties gebruiken `118-r5`.
- Back-up vóór wijzigingen: `backups/dashboard-month-20261016-225952/`, met bron-ZIP, volledige geverifieerde Git-bundle en SHA-256-manifest.
- Aanvullend: kopieën van de lokale kandidaat, gecontroleerde bestandskopieën en binaire patch in hetzelfde back-uppunt.
- Herstel-tag: `rollback/finize-v118-r4-20261017`. De back-up is voor software; productiedata zijn niet geëxporteerd of gewijzigd.
- Bij herstel: publiceer de oude runtime als nieuwe commit. Wis geen localStorage of IndexedDB. De worker ruimt alleen verouderde Finize-appcaches op.

## Beelden

- [Voor: november met oktoberlijn, desktop](../.cache/dashboard-selected-month/before-dion-1440.png)
- [Na: november met volledige novemberlijn, desktop](../.cache/dashboard-selected-month/after-dion-1440.png)
- [Voor: mobiel](../.cache/dashboard-selected-month/before-dion-390.png)
- [Na: mobiel](../.cache/dashboard-selected-month/after-dion-390.png)
- [Historische maand zonder beginsaldo](../.cache/dashboard-selected-month/september-onbekend-390.png)

Machineleesbare vergelijking: `.cache/dashboard-selected-month/before-after.json`. Screenshots en logs zijn lokaal bewaard en worden niet als runtimebestanden gepubliceerd.
