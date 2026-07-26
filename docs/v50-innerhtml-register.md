# V50-register dynamische HTML-routes

De 62 actieve `innerHTML`-toekenningen zijn per route beoordeeld. Het register groepeert herhaalde renderfuncties; elke concrete vindplaats blijft controleerbaar met `rg -n "innerHTML\\s*=" index.html update4.js update5.js`.

| Groep | Classificatie | Bescherming |
|---|---|---|
| iconen en vaste SVG-fragmenten | statisch vertrouwd | alleen vaste `iconSvg`-namen |
| dashboard-, data- en beheermarkup | vertrouwde templates met dynamische tekst | `textSafe` voor tekst en `attrSafe` voor attributen |
| transactielijsten en budgetdetails | gebruikers- of cloudgestuurd | omschrijving, categorie, notitie en ID worden ontsmet |
| spaardoelen en subdoelen | gebruikers- of cloudgestuurd | naam, link en ID worden ontsmet; afbeeldingen apart gevalideerd |
| import-, match- en validatiedialogen | CSV- of cloudgestuurd | `esc` voor tekst en `escAttr` voor attribuutwaarden |
| rekeningprofielen en herkenningsregels | gebruikers- of cloudgestuurd | waarden lopen via veilige option- en inputrendering |
| status-, maand- en afsluitdialogen | gemengd | vrije namen en omschrijvingen worden ontsmet |
| modals leegmaken | statisch | uitsluitend `innerHTML=''` |

## Centrale contracten

- `textSafe(value)` ontsmet dynamische tekst voor HTML.
- `attrSafe(value)` ontsmet attribuutwaarden en verwijdert besturingstekens.
- Update 4 gebruikt dezelfde scheiding via `esc` en `escAttr`.
- `safeImageUrl(value)` accepteert uitsluitend lokale `blob:`-afbeeldingen en base64 PNG, JPEG, WebP of GIF.
- CSS-percentages en bedragen komen uitsluitend uit begrensde numerieke waarden.

De injectietest gebruikt kwaadaardige transactiebeschrijvingen, categorieën, notities, CSV-velden en IDs. De payload blijft letterlijk zichtbaar, maakt geen element aan en voert geen eventhandler uit.
