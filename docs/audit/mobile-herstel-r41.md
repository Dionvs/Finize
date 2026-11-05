# Mobiel herstel op basis van V118-r41

Uitgevoerd op branch `agent/mobile-herstel-r41`, vanaf GitHub-commit `396978e2f8ecdccaeb74bc5149ecc4d70f6fa282`. Alleen lokaal; niet gepubliceerd. De achterhaalde wijzigingen in de oorspronkelijke werkmap zijn niet meegenomen of overschreven.

## Wat is aangepast

- De mobiele header toont logo en tabnaam links en de maandselector rechts op dezelfde regel. De volledige opslagstatus staat op een eigen regel daaronder. De losse tabtitel en maand onder de header zijn verwijderd; de tabnaam blijft een semantische H1.
- Bedragen breken niet meer midden in de waarde af. KPI's en vaste-lastenrijen krijgen op smalle schermen meer regels; de illustratie staat onder het spaartotaal. Bij uitzonderlijk lange bedragen op extreem weinig ruimte blijft de volledige waarde horizontaal beschikbaar binnen het bedragvak, zonder de hele pagina te verbreden.
- De ondernavigatie blijft altijd één rij. Compacte iconen, tussenruimte en labels houden de knoppen uit elkaar. Als de beschikbare ruimte bij smalle schermen of vergroting te klein is, kan alleen de navigatierij horizontaal schuiven; alle knoppen blijven via tikken en toetsenbordfocus bereikbaar. Een `ResizeObserver` reserveert haar werkelijke hoogte, inclusief scrollbar en safe areas.
- Onder 240 CSS-pixels toont de maandselector een korte maand en tweecijferig jaar, bijvoorbeeld ‘sep 26’. De volledige maandnaam en het volledige jaartal blijven in de toegankelijke naam beschikbaar. Dit geeft de tabnaam naast het logo voldoende ruimte bij sterke vergroting.
- Mobiele status-, informatie-, toevoeg- en uitklapacties hebben grotere aanraakvlakken. Invoer is minimaal 16 px op mobiel en apparaten met touch, ook zonder iPhone-identificatie.
- Hover-effecten gelden alleen voor een nauwkeurige aanwijzer die kan hoveren. Toetsenbordfocus blijft apart beschikbaar.
- De toast animeert alleen opacity en transform. Reduced motion houdt alleen een korte fade over en schakelt de validatiepuls uit. Mobiele financiële voortgangsbalken veranderen direct.
- Het desktopontwerp, financiële productiecode, opslagstructuur en importgoedkeuring zijn niet gewijzigd. Nieuwe animaties, een grotere desktopcompositie en ondersteuning voor 1.000 doelen zijn niet toegevoegd.

De bewerkbare bronbestanden zijn aangepast; `app.css`, `app.js` en de inline release in `index.html` zijn met het bestaande buildscript gegenereerd.

## Testuitkomst

| Controle | Resultaat |
| --- | --- |
| Bestaande mobiele regressies + nieuwe herstel- en headertests | **24 geslaagd, 0 mislukt** |
| Geselecteerde prognosemaand | **17 geslaagd, 0 mislukt** na onderbouwde correctie van vijf verwachtingen |
| Uitgebreide Node-run | **1.181 tests: 1.166 geslaagd, 15 bestaande mislukkingen**; vooraf waren dit 20 mislukkingen |
| JavaScript-syntax | Geslaagd, inclusief beide inline scripts |
| CSS | Geslaagd; uitsluitend de reeds bekende ongedefinieerde token `--line` |
| Gegenereerde runtime | Byte-reproduceerbaar |
| Git whitespacecontrole | Geslaagd |

De browsercontrole omvat 320, 390 en 430 px, lange namen, grote bedragen, invoervelden, focusbegrenzing, Escape/annuleren, liggend scrollen, reduced motion en een hybride tabletcontext. De bestaande mobiele suite controleert ook lege doelen, tekorten, maandwissels en het behoud van de desktopweergave op 768 en 1440 px. Openen en annuleren veranderen in de tests de financiële state niet.

De aanvullende header-/navigatietests omvatten ook 195 CSS-pixels, een lange opslagstatus, de maand september, één tabtitel in de header zonder losse titel eronder, uitlijning op één regel en het daadwerkelijk aanklikken van alle zes navigatieknoppen. Focus op de eerste en laatste knop brengt deze ook bij een horizontaal verschoven rij in beeld. Schermbeelden: [320 px](../../.cache/mobile-herstel/header-nav-320.png) en [195 px](../../.cache/mobile-herstel/header-nav-195.png).

Na de headercorrectie is ook de echte Chromium-browserzoom op 200% opnieuw gecontroleerd: alle zes knoppen zijn daadwerkelijk aangeklikt op één navigatierij, de tabnaam overlapt de maand niet en de status blijft eronder. Navigeren verandert de financiële teststate niet. [Meetgegevens van deze vervolgcontrole](../../.cache/mobile-herstel/header-nav-zoom-results.json).

Daarnaast is **echte Chromium-browserzoom op 200%** ingesteld via de browser-API, niet via CSS-zoom: effectieve viewport 195 CSS-pixels, devicePixelRatio 2. Dashboard, Gezamenlijk, Dion, Dara, Spaardoelen, Data en Instellingen hebben daarbij geen horizontale pagina-overflow. Dit is desktopbrowserbewijs en geen test van een echte telefoon.

## De fictieve vaste last van € 100

Deze post komt uitsluitend uit `tests/dashboard-selected-month.test.cjs`: id `monthly`, naam **Maandelijkse last**, bedrag **10.000 cent**, gepland op **3 oktober 2026**. Het is geen gevonden of gewijzigde post uit de administratie van de gebruiker.

De fixture heeft een banksaldo van 43.478 cent op 14 oktober. De betaling van 3 oktober is niet gekoppeld. Het bestaande contract `overdue-fixed-reserved` reserveert die verplichting eenmaal; het maakt daarvan geen bankafschrijving.

| Moment | Berekening in gehele centen | Verwachte waarde na reservering |
| --- | --- | --- |
| 14 oktober | 43.478 − 10.000 gereserveerd | 33.478 |
| 1 november | Oktoberreservering blijft eenmaal aanwezig | 33.478 |
| Na de novemberlast | 33.478 − 10.000 | 23.478 |
| 1 december | Novemberbetaling is eenmaal verwerkt | 23.478 |
| Na de decemberlast | 23.478 − 10.000 | 13.478 |

De oude vijf verwachtingen sloegen de oktoberreservering over. Alleen deze testverwachtingen zijn aangepast. Aanvullende assertions controleren het bedrag, de geplande datum en dat er precies één achterstallige reservering is. Controle op een toekomstige saldowaarneming, maandgrenzen en bronimmutabiliteit is behouden. De productie-rekenlogica is niet veranderd.

## Openstaande testmeldingen

De 15 resterende Node-mislukkingen kwamen ook vóór dit herstel voor. Ze zijn niet verwijderd, overgeslagen of blind groen gemaakt:

- `fix-round-1-6`: twee oudere verwachtingen over mobiele spaarbediening en één teken-/UTF-8-assertion.
- `forecast-current-basis`: één verwachting rond historische aansluiting en reservering; de test verwacht 200.000 cent en krijgt 190.000 cent. Vereist een afzonderlijke onderbouwing van banksaldo versus waarde na reserveringen.
- `html-inline-syntax`, `service-worker-cache`, `update4-final-regression`, `update4-ui-structure`, `update5-responsive-structure`: oudere structuur-/releaseverwachtingen of toolingafhankelijkheden.
- `package7-release-audit`: drie serviceworker-mock-/installatieverwachtingen.
- `v117-p2`: één async-opslagassertion.
- `v117-p4-salary` en `v117-p4`: twee financiële fixture-/verwachtingsafwijkingen die een afzonderlijke analyse vereisen.

Vervolgvoorstel voor de financiële meldingen: reproduceer elk geval in gehele centen, toon bankwaarde en reserveringen apart en leg het bedoelde contract vast. Alleen daarna een aparte test- of rekenwijziging voorstellen. Deze mobiele ronde geeft daarvoor geen automatische vrijgave.

## Bewijs en reproduceerbaarheid

Voor/na-screenshots en ruwe testuitvoer staan lokaal onder [`.cache/mobile-herstel`](../../.cache/mobile-herstel/). Daar staan ook de reserveringsdiagnose en metingen van de echte browserzoom. Deze map is volgens de bestaande gitignore geen onderdeel van de bronwijziging.

- [Rekening op 390 px vóór](../../.cache/mobile-herstel/voor-rekening-390.png) / [na](../../.cache/mobile-herstel/na-rekening-390.png).
- [Grote bedragen op 320 px vóór](../../.cache/mobile-herstel/voor-doelen-320.png) / [na](../../.cache/mobile-herstel/na-doelen-320.png).
- [Gecombineerde browseruitvoer](../../.cache/mobile-herstel/browser-tests.txt).
- [Brede Node-uitvoer](../../.cache/mobile-herstel/node-tests.txt).
- [Financiële diagnose](../../.cache/mobile-herstel/finance-diagnosis.json).
- [Browserzoommetingen](../../.cache/mobile-herstel/browser-zoom-results.json).

Google Drive kon de lokale testafhankelijkheden niet betrouwbaar installeren. De controle gebruikte daarom dezelfde gepinde versies vanuit de bestaande tijdelijke lokale toolingomgeving. Er zijn geen dependencyversies, lockfiles of productieconfiguraties aangepast. Het buildscript en de CSS-controle ondersteunen hiervoor al `FINIZE_TOOLING_NODE_MODULES`. De browsercontrole gebruikte dezelfde bronbestanden, een lokale server en geïsoleerde testgegevens.

## Nog fysiek controleren

Echte iPhone, Android en iPad: toetsenbordzoom, scrollen met geopend toetsenbord, tikfeedback, safe areas en geïnstalleerde PWA-modus. Geen van deze hardwarecontroles wordt als uitgevoerd aangemerkt. Ook ingelogde cloudstromen en productiegegevens zijn niet gebruikt.

Voor publicatie zijn deze apparaatcontroles en een aparte releasecontrole nodig. Er is niets gepusht of gepubliceerd.
