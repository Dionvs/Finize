# Finize — gericht herstel van de open punten uit pakket 2

Datum: 9 november 2026. Dit is het vervolg op `FINIZE-PAKKET-2-TEST-EN-CI-VERSLAG.md`.

**Gerichte reparaties uitgevoerd; verslag gereed. Geen volledige groene releaseacceptatie: de grote schaalvalidatie blijft open. Op verzoek zijn de verdere omvangrijke tests gestopt.**

## Afbakening

De reparaties staan lokaal in `C:\Users\dionv\Documents\Codex\Finize-herstel-pakket1-20261106`, op branch `herstel/pakket1-financiele-bugs`, boven basiscommit `3f779bae97a4748f8296a018dddbda92a651c25d`. De werkboom was bij aanvang schoon. De eerdere pakket-1- en pakket-2-wijzigingen zijn behouden.

Alle controles gebruiken fictieve fixtures, lokale browsers, providermocks en Firestore-demo-emulators op loopback. De oorspronkelijke Drive-werkmap, productiegegevens en bankverbindingen zijn niet gewijzigd. Er is niet gecommit, gepusht, gepubliceerd of gedeployd.

## Uitgevoerde reparaties

| Punt | Oorzaak en gerichte oplossing |
|---|---|
| Spaarimport bij gedeeltelijke historie | De spaarvelden vroegen transactieprojecties op zonder maand. De bestaande projectiecontrole weigert dat terecht bij gedeeltelijke historie. Beide aanroepen gebruiken nu de financiële maand van de importregel. Er worden geen ontbrekende bedragen als nul ingevuld en geen bewijscontroles uitgezet. |
| Salaris na bonus/vakantiegeld vanaf dezelfde tegenrekening | Een later geleerde extra-inkomstenregel overheerste het eerdere salaris. Een salarisomschrijving krijgt nu een salarisvoorstel wanneer dezelfde werkgever én ontvangstrekening al eenduidig handmatig bevestigd salaris voor één persoon opleveren. Andere werkgevers/rekeningen, afschrijvingen en omschrijvingen zonder salarisbewijs krijgen die voorrang niet. Het voorstel neemt ook de oude bonusnaam niet over. De regelopslag blijft bestaan; niets wordt automatisch goedgekeurd. |
| Mobiele onderruimte | Zowel `body` als de hoofdcontainer reserveerden ruimte voor de vaste navigatie. De dubbele reservering op `body` is verwijderd; de bestaande navigatieruimte in de hoofdcontainer blijft staan. De oorspronkelijke grens van 125 px is behouden. |
| Focus na hertekenen inkomenskaart | De bestaande focusvoorziening herkent nu ook een directe knop met `data-open-income-overview`. Na hertekenen kan zij de nieuwe knop terugvinden. |
| Marker-/legendakleur | De inkomstenmarker gebruikt nu dezelfde bestaande donkere blauwtint als de legendatekst. De leesbare tekstkleur is behouden. |
| Inkomstenbronnenbeheer niet bereikbaar | Het bestaande beheer is bereikbaar gemaakt via het gezamenlijke inkomensoverzicht, ook op desktop. De nieuwe route is expliciet beperkt tot gezamenlijke posten. Persoonlijke vaste lasten en persoonlijke inkomstenbronnen horen niet in dit overzicht. Opslaan en terugkeren behouden deze afbakening. Bestaande beheer- en opslagfuncties worden hergebruikt. |
| Nieuwe-huishoudenproef | De proef gebruikt de zichtbare beheerroute, actuele vaste-lastenknoppen en het bestaande extra-instellingenpaneel. De rekeningfixture bevat geldige synthetische Nederlandse IBAN's, rekeningtypen en statussen; de proef controleert nu ook dat die setup werkelijk wordt opgeslagen. De gedeelde CSV-helper kan deze rekeningidentiteit expliciet meekrijgen. Bedragen, offline opslag, bronbewijzen en tweede-clientvergelijkingen blijven gecontroleerd. |
| Groepsherstelproeven | Na herstart opent de proef eerst de compacte kaart van een resterende regel voordat zij de spaarvelden bedient. De financiële verwachtingen voor zeven bewaarde successen en drie hervatte regels zijn behouden. |
| Salaris-duplicatenproef | De proef kiest bij een historische herimport eerst alle maanden, zodat het bestaande duplicatenoverzicht van september zichtbaar is. De verwachting blijft: geen zesde bankbeweging of financieel effect. |
| Schaal-CI | De schaalworkflow gebruikt nu `FINIZE_EVIDENCE_PREFIX=p44`. De producent en vervolgproeven gebruiken daardoor dezelfde bewijsbestandsnamen. De workflow bewaart ook de bewijsmap als artifact. |
| Begrensde volledige recordlezingen | Een 5.400-bronnenrun liep bij het ophalen van alle records vast op `Java heap space` in de lokale emulator. Ongefilterde recordlezingen gebruiken nu de standaard documentnaamcursor en maximaal 200 records per antwoord; alle records blijven verplicht. Fouten op vervolgpagina's worden doorgegeven. Bronhash-, manifest- en eindstandcontroles blijven actief. Tests met 200/401 documenten en een geweigerde vervolgpagina slagen. Dit begrenst antwoorden, maar bewijst geen volledige oplossing voor de grote schaalgrens: een latere poging liep tijdens het stagen opnieuw tegen emulatorgeheugen aan. |
| Isolatie van emulatorfixtures | De handmatig aangemaakte tweede/herstartclients en de lege-huishoudenhelper in de opslagtests volgden de geïsoleerde emulatorpoort nog niet. Zij gebruiken nu dezelfde bestaande hostinstelling als de hoofdclient. De oorspronkelijke hervattings-, migratie- en concurrentieassertions blijven behouden. |
| Snelle CI-regressie | Vier spaarkoppelproeven zijn toegevoegd aan de bestaande smokeopdracht, waaronder een nieuwe controle op gedeeltelijke historie. De smoke-inventaris telt nu 48 gevallen. |

Er zijn geen financiële rekenformules, productieregels of datamigraties gewijzigd. Het salarisvoorstel is een bewuste functionele correctie en blijft een voorstel ter beoordeling. De bestaande projectie-, goedkeurings-, conflict- en broncontroles blijven actief.

De paginering volgt de standaard [Firestore StructuredQuery](https://firebase.google.com/docs/firestore/reference/rest/v1/StructuredQuery) en [Cursor](https://firebase.google.com/docs/firestore/reference/rest/v1/Cursor). Zij verandert de ongefilterde leesroute in de recordtransportlaag, ook in de voorbereide productieadapter; die adapter is niet geactiveerd of uitgerold. Gefilterde periodelezingen en financiële selectiecriteria zijn niet aangepast.

## Controles en bewijs

| Controle | Uitkomst en begrenzing |
|---|---|
| Normale Node-suite | **1.376 geslaagd, 0 mislukt, 0 overgeslagen.** Uitgevoerd na de import- en transportcorrecties, vóór de laatste afbakening van de beheerroute. |
| Gezamenlijke browserregressie | **101 geslaagd, 0 mislukt, 0 overgeslagen in één run.** Omvat de 48 smokes, de gerichte financiële/herstelgevallen en zeven onafhankelijke r46-visuele referenties. Ook deze run ging vooraf aan de laatste beheerafbakening. |
| Laatste beheerafbakening | **2 gerichte browserproeven geslaagd**, op 390 en 1440 px: persoonlijke planning blijft buiten het gezamenlijke overzicht; een gezamenlijke bron van €123,45 wordt opgeslagen; bewerken en terugkeren behouden de afbakening. |
| Bijbehorend structuurcontract | **1 bestaand Node-testbestand geslaagd**, aangepast aan de optionele parameter met behoud van de standaard vaste-lastenroute. |
| Firestore-regels, migratie en hervatting | **42 geslaagd.** Inclusief herstel na afbreken, historische afhankelijkheden, bronintegriteit en tweede clients op dezelfde geïsoleerde emulator. |
| Native bankretentie | **4 geslaagd**, op de afzonderlijke demo-emulator. |
| Backend-HTTP | **1 geslaagd**, met provider-/SDK-mocks. |
| 500 bankboekingen / 3 maanden | **Financieel geverifieerd scenario afgerond**, inclusief goedkeuringen, bron/effectbewijzen, synchronisatie, herstart en tweede client. Volledig resultaatbestand: `backups/v117-stabilisatie/p44-scale-3.json`. |
| 5.400 bankboekingen / 36 maanden | **Geen volledige acceptatie.** Een poging faalde op emulatorgeheugen, een volgende overschreed de oorspronkelijke totale 30-minutengrens en een herhaling faalde opnieuw op emulatorgeheugen bij het stagen. Een eerdere deelronde slaagde; dat is geen geslaagde volledige proef. |
| Overige zware vervolgproeven | Op verzoek gestopt. Onderbroken prestatiescenario's en de afhankelijke grote-periodencontrole zijn niet als geslaagd meegeteld. |
| Eindbestanden | JavaScript-syntax, CSS, reproduceerbare build en `git diff --check` geslaagd. |

Voor **ieder van de 14 oorspronkelijke mislukte browsergevallen** is een geslaagde gerichte hertest beschikbaar. Dit is geen nieuwe volledige run van de gehele browserinventaris. De laatste UI-afbakening is bewust alleen gericht gecontroleerd; de grote suites zijn daarna niet opnieuw gestart.

De financiële controles behouden onder meer tien spaarboekingen van samen €750, salaris/vakantiegeld/bonus van samen €5.880, de historische correcties, zeven bewaarde groepsgoedkeuringen met drie hervatte regels en de vaste last van €925 na herstart en op een tweede client. Er zijn geen financiële assertions verwijderd of afgezwakt en geen nieuwe skips gemaakt.

Herleidbaarheid, exacte gevallen, uitvoertijden en SHA256-hashes staan in [pakket2-gericht-herstel-resultaten.json](pakket2-gericht-herstel-resultaten.json). Dit bestand onderscheidt de build van de 101-regressierun van de laatste UI-build. De import- en recordtransportbron bleven tussen die builds gelijk. Ruwe logs staan onder `.cache/herstel-vervolg/` en `.cache/herstel-*.log`; schaalbewijs staat onder `backups/v117-stabilisatie/`.

## Wat nog openstaat

De 5.400-bronnenfixture heeft op deze computer geen volledige acceptatie gehaald. De emulator gebruikte 2 GB maximale Java-heap; de machine heeft ongeveer 7,3 GB fysiek geheugen. Gelijktijdige zware hertests veroorzaakten extra geheugendruk. Die uitvoering is gestopt; de kleinere vervolgcontrole gebruikte daarna een afzonderlijke demo-emulator. De geheugenfouten zijn infrastructuurbewijs, geen bewezen productieoorzaak en geen bewijs van verlies van goedgekeurde gebruikersgegevens.

In de geslaagde eerste deelronde van de grote proef duurden tien lokale goedkeuringen circa 26,8 seconden. Het bestaande, niet-blokkerende streefdoel van 20 seconden is daar dus niet gehaald. Er wordt geen algemene prestatieverbetering geclaimd. Een tijdelijk extra testbudget is teruggenomen; de bestaande tijdslimieten zijn in de uiteindelijke code behouden.

Ook werkelijk ontbrekend periodebewijs blijft de spaarprojectie blokkeren. De reparatie gebruikt de geverifieerde maand van de regel en vult ontbrekende historie niet met nul aan. Voor een salarisvoorstel blijft eenduidig handmatig bevestigd persoonsbewijs vereist.

## Wijzigingen in bestanden

- Applicatie: `src/import/runtime.js`, `src/core/runtime.js`, `src/ui/dialog-accessibility.js`, `src/styles/responsive-fit.css`, `src/styles/ux-minimal.css`, `src/storage/firestore-record-transport.mjs`.
- Bestaande tests/helpers: `tests/v117-p4-salary.test.cjs`, `tests/v117-p4.test.cjs`, `tests/update5-responsive-structure.test.cjs`, `tests/emulator/v117-p3.test.cjs`, `tests/emulator/v117-p4.test.cjs`, `tests/browser/savings-link-proposals.spec.cjs`, `tests/browser/v117-p4-salary.spec.cjs`, `tests/browser/v117-p4.spec.cjs`, `tests/browser/v117-p44-group-recovery.spec.cjs`, `tests/browser/v118-ux-minimal.spec.cjs`, `tests/helpers/v117-p4-browser.cjs`.
- CI en handleiding: `.github/workflows/verify-scale.yml`, `package.json`, `docs/FINIZE-TESTEN.md`.
- Gegenereerd met de bestaande build: `app.js`, `app.css`, `index.html`.

## Grenzen

Er is geen echte GitHub Actions-run of deployment uitgevoerd. De twee bestaande V117-upgradeproeven vereisen gecontroleerde oude V117-assets; daarvoor zijn geen privé-snapshots of verzonnen vervangers gebruikt. Browsercontroles op mobiele breedtes zijn geen test op een fysieke telefoon. Het bestaande CSS-signaal over `--line` en de bestaande detectorwaarschuwing over Arial vallen buiten deze gerichte reparaties.
