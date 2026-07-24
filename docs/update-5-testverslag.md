# Update 5 — testverslag

Datum: 24 juli 2026

## Automatische controles

De volledige set Update 2-, 3-, 4- en 5-tests is uitgevoerd. De Update 5-dekking controleert onder meer:

- gezamenlijk onder, exact op en boven budget in beide scenario’s;
- persoonlijk transactieverbruik van Dion en Dara zonder wijziging van zakgeld;
- onveranderde inkomensratio’s, minimumverdeling en hypotheekverdeling;
- `variabelVoorVerdelingTotaal === variabelBudgetTotaal`;
- werkelijke transacties blijven zichtbaar in `variabelTotaal`;
- afwezigheid van de oude `Math.max(variabelBudgetTotaal, variabelTotaal)`-koppeling;
- expliciete grenzen 767/768 en 1023/1024 px;
- de zeven nieuwe klassen worden alleen als presentatieklasse gebruikt;
- vier mobiele KPI-kolommen en geen complexe dashboardsiblingselector;
- één chevronvariabele en één open-state-systeem;
- geen lege mediaqueries, versie-reparatieblokken of dubbele selector/property/media-combinaties voor de geconsolideerde componenten;
- geen nieuwe opgeslagen financiële velden.

Daarnaast worden inline en externe JavaScript-syntax, HTML-balans, dubbele IDs, service-worker-assets en regressies uit eerdere updates gecontroleerd.

## Componentvergelijking mobiel

Op 360 en 390 px zijn nulmeting en eindresultaat per component vergeleken op positie, afmetingen, padding, typografie, regelafbreking en overflow.

Exact gelijk:

- mobiele header;
- KPI-rij met vier kolommen;
- Gezamenlijke rekening;
- zakgeldkaart;
- budgetpreview;
- spaardoelenpreview;
- bottomnavigation;
- Gezamenlijk-KPI’s;
- fullscreen vaste-lasteneditor.

De maandselector behield exact dezelfde buitenmaten. Alleen het afgesproken uniforme chevronbeeld veranderde naar het gedeelde lichte 18 px-systeem.

## Tablet en desktop

- 768, 820 en 1023 px: iconensidebar van 80 px, gedeelde handlers/data en gestapelde brede panelen.
- 1024, 1280, 1440 en 1920 px: sidebar van 240 px en desktopcontent tot maximaal 1480 px.
- Na de tabletcontrole zijn 390 en 1024 px opnieuw gecontroleerd om lekkende mediaregels uit te sluiten.
- De desktopcomponenten sidebar, paginaheader, primaire KPI’s en planning/realisatiepanelen waren op alle vier desktopbreedtes exact gelijk aan de fase-nulmeting.
- Dashboard, Gezamenlijk, Dion, Dara, Spaardoelen en Data & back-up zijn lokaal geopend; bedragen en labels bleven leesbaar.

De browsercontrole gebruikte bestaande lokale data en wijzigde geen transacties, doelen of opgeslagen financiële waarden.

## Browserannotaties

Op 1538 px is gecontroleerd dat de vijf dubbele of overbodige elementen ontbreken, de maandoptie voor kopiëren behouden blijft en de hoofdactie voor uitgaven nog aanwezig is. Negatieve waarden renderen app-breed met `rgb(159, 70, 57)`, inclusief het dashboard en de persoonlijke KPI’s en stroomkaarten van Dion en Dara. Alle zes zijbalktabs hebben een afbeelding of gedeeld SVG-icoon. De spaardoelenpreview toont drie doelen zonder afsnijding; de scrollruimte blijft begrensd voor een vierde doel. Er traden geen vroege JavaScript-fouten op.

Op de Gezamenlijk-pagina is daarnaast gemeten dat de verticale hoofdblokafstand overal 16 px bedraagt. De smalle desktop-spaardoelenkolom gebruikt één kaartkolom; iedere doelkaart gebruikt de volledige beschikbare breedte zonder horizontale overflow.

## Bewust behouden uitzonderingen

- `max-width:640px`: uitsluitend generieke niet-V4-onderdelen en gedeelde tabellen/hulpelementen.
- `max-width:374px`: alleen editor- en navigatiefit; geen verkleining van dashboard-KPI-typografie en geen wijziging naar minder dan vier KPI-kolommen.
- Er zijn geen browserfallbacks met dubbele selector/property/media-combinaties nodig.
