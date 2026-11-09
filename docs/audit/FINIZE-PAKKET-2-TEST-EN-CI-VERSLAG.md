# Finize — pakket 2: testbetrouwbaarheid en CI

Stand: 9 november 2026. **Rapportage gereed, met open punten; geen volledig groene releaseacceptatie.** Pakket 3 is niet gestart. Niets is gepusht, gepubliceerd of gedeployd.

## Omgeving en afbakening

- Geïsoleerde clone: `C:\Users\dionv\Documents\Codex\Finize-herstel-pakket1-20261106`.
- Behouden branch: `herstel/pakket1-financiele-bugs`.
- GitHub-main opnieuw gecontroleerd: `7a7d72e25660975ba88269e7835b98d32858ada5`.
- Pakket 1 blijft behouden: commits `b8aa562`, `25a5850`, verslag `6246bd5`.
- De oorspronkelijke **478 Node-tests en 35 browsertests** blijven regressiebasis. Er zijn geen tests verwijderd of assertions uitgeschakeld om groen te krijgen.
- Uitsluitend fictieve fixtures, providermocks en lokale Firestore-demo-emulators. Geen productiesynchronisaties, productiegegevens, bankverbindingen, beveiligingsregels of datamigraties gewijzigd.

De zes oorspronkelijke gewijzigde Drive-bestanden hebben bij de laatste controle exact dezelfde SHA256-hashes als bij de eerdere controle. De eerder aanwezige indexlock is nu afwezig. Het hersteltraject heeft de originele werkmap en lock niet gewijzigd; de externe oorzaak is niet vastgesteld. Bewijs: `pakket2-bronbehoud.json`.

## Resultaat in één overzicht

| Controle | Vóór / nulmeting | Laatste gecontroleerde uitkomst | Betekenis |
|---|---|---|---|
| Root-Node-bestanden | 84 geslaagd, 16 mislukt van 100 | 99 normale bestanden geslaagd; het afzonderlijke retentiebestand slaagt met emulator | Configuratie/build/fixtures verklaard |
| Normale Node-testgevallen | 1.272 geslaagd, 20 mislukt van 1.292 gerapporteerde gevallen | **1.372 geslaagd, 0 mislukt, 0 overgeslagen** | Vóór herstel werden niet alle onderliggende gevallen bereikt; het verschil van 80 is niet uitsluitend nieuw geschreven tests |
| Oorspronkelijke financiële Node-basis | 478 geslaagd | 478 behouden binnen bovenstaande groene suite | Geen financiële basisassertions verwijderd |
| Backend-HTTP | Geen afzonderlijke vergelijkbare nulmeting | **1 geslaagd** | SDK/provider gemockt |
| Opslag/Firestore-regels | Emulator/configuratie bij enkele tests ontbrak | **42 geslaagd** | Geïsoleerde records-/historietests |
| Native bankretentie | Afzonderlijk emulatorbestand faalde in de algemene Node-run | **4 geslaagd** | Afzonderlijke loopback-runner |
| Prioriteitsbrowsergroep | 31 geslaagd, 17 mislukt van 48 | **48 geslaagd** | Alle negen eerder onverklaarde gevallen onderzocht; uitgebreidere gezamenlijke herhaling 59/59 |
| Browser-smoke | Oorspronkelijke 35 geslaagd | **44 geslaagd, 0 mislukt, 0 overgeslagen** | Oorspronkelijke 35 + 3 doelvolgorde + 2 importfocus + 4 budgetbalk |
| Brede browsercontrole | Run met 643 gevallen: 314 geslaagd, 173 mislukt/time-out, 156 overgeslagen/niet voltooid | Actuele inventaris 647: **624 geslaagd, 14 mislukt, 2 overgeslagen, 7 niet afgerond** | Samengevoegde nieuwste resultaten per uniek geval; geen nieuwe volledige run |
| Onafhankelijke visuele referentie | Zeven V50-contracten verouderd ten opzichte van main | **7 geslaagd** tegen gepinde r46-mainreferenties | Zes breedtes plus computed-style-contract; geen eigen branch als nulmeting gebruikt |
| Syntax/CSS/build | Bekende oude release-/extractieverwachtingen | Alle drie eindcontroles geslaagd | CSS meldt nog het bestaande token `--line`; geen pakket-3-opruiming uitgevoerd |
| GitHub Actions | Workflow miste directe push naar main | YAML/events/commands en suiteverdeling lokaal gecontroleerd | **Geen echte GitHub-run uitgevoerd**: branch is niet gepubliceerd |

De categorieën overlappen; tel ze niet op tot één totaal. De 624 groene browserresultaten komen uit gerichte runs op verschillende momenten/commits, niet uit één volledige run van de uiteindelijke HEAD. De laatste applicatiefix is afzonderlijk met de relevante regressies, alle normale Node-tests en de 44 smokes gecontroleerd. De browserinventaris bevat 647 actuele unieke `(bestand, titel)`-gevallen. Voor ieder geval is het nieuwste werkelijk uitgevoerde resultaat op `result.startTime` gebruikt. Historische titelaliassen zijn genormaliseerd. De tijdelijke salaris-tegenproef met bewust andere tegenrekeningen telt niet mee. Twee bestaande expliciete skips en zeven niet voltooide schaalgevallen zijn afzonderlijk benoemd.

Volledige telling en herleidbaarheid: [pakket2-browser-resultaten.json](pakket2-browser-resultaten.json). Dit bevat ook SHA256-hashes van de gebruikte lokale rapportbestanden. De ruwe logs staan onder `.cache/pakket2/` in deze clone.

## Fase 2.1 — Node-tests

Alle 16 aanvankelijk mislukte bestanden zijn vóór wijziging geclassificeerd in [FINIZE-PAKKET-2-CLASSIFICATIE.md](FINIZE-PAKKET-2-CLASSIFICATIE.md). Oorzaken waren verouderde functie-extractie/releaseverwachtingen, onvolledige testdoubles, foutieve historische fixtures, ontbrekende gegenereerde backendmodules en emulatorafhankelijkheid.

De financiële grens tussen vastgelegd banksaldo en ruimte na onbetaalde historische verplichtingen is behouden. Een saldo van €2.000 betekent bij €100 openstaande reservering geen €2.000 vrije ruimte. Fixtures en verwachtingen zijn hierop onderbouwd gecorrigeerd.

De normale runner bouwt eerst de gedeelde backendmodules en voert alle 99 toepasselijke root-bestanden uit. Alleen het exact genoemde native retentiebestand gaat naar de aparte emulatorketen. Dit is geen algemene emulatorfilter en geen stille uitschakeling. Emulatorrunners weigeren productiehosts en gebruiken demo-projecten/loopback.

Bewijs: `node-before.json`, `node-after-budget-bar.log`, `backend-http-final.log`, `records-emulator.log`, `bank-retention-runner.log`.

## Fase 2.2 — Browserproblemen en goedgekeurde reparaties

De negen eerder onverklaarde gevallen zijn individueel onderzocht: vier vaste-lastenstromen, drie bankgoedkeurings-/concurrentiestromen, CSV/API-overlap en rekeningselectie. De fouten ontstonden door oude geneste bewerkknoppen, verborgen velden in nog niet geopende compacte kaarten, oude opslaanknoppen en een ontbrekende transactiefamiliekeuze. De huidige zichtbare route slaagt met behoud van bedragen, bronidentiteit, conflict- en historische assertions.

Breder zijn onder andere oude dashboard-/inkomensroutes, compacte importfocus, geldige accountregisterfixtures, historische maandselectie, inline-PWA-intercepties, duurzame opslagtijdstippen en grafiekbediening gecorrigeerd. Het classificatiedocument bevat de bevindingen per cohort en de controles vóór/na.

Drie applicatiefouten zijn **uitsluitend na afzonderlijk akkoord** gericht hersteld:

| Reparatie | Kleinste wijziging | Bewijs / commit |
|---|---|---|
| Mobiele spaardoelvolgorde | Bestaande handlers aansluiten op actuele mobiele kaarten; bediening herstellen | 3 nieuwe breedtegevallen geslaagd; `34df089`; [bug 01](FINIZE-PAKKET-2-APPLICATIEBUG-01.md) |
| Focus na groepsgoedkeuring | Bestaande importfocus opnieuw toepassen na herstel van open/ingeklapte groepen | 2 nieuwe gevallen geslaagd; zes goedkeuringen blijven bewaard; `458063d`; [bug 02](FINIZE-PAKKET-2-APPLICATIEBUG-02.md) |
| Negatieve budgetbalk | Alleen zichtbare ratio begrenzen op 0–1 | 4 nieuwe gevallen en bestaande V113-reeks 16/16 geslaagd; `02aabfa`; [bug 03](FINIZE-PAKKET-2-APPLICATIEBUG-03.md) |

De 44 smokes en 1.372 normale Node-tests slagen na de laatste applicatiewijziging. Latere wijzigingen betreffen tests, CI en verslaglegging. Geen nieuwe financiële rekenregels of productiedatawijzigingen in pakket 2.

### Resterende 14 mislukte browsergevallen

| Aantal | Bevinding | Classificatie en besluit |
|---:|---|---|
| 3 | Mobiele onderruimte 194,5 px bij grens 125 px | Bestaande layoutbevinding; behouden voor pakket 3, grens niet afgezwakt |
| 6 | Spaarimport met gedeeltelijk geladen historie; afhankelijke conflict/verifier/groepsproeven bereiken hun eindassertions niet | Applicatieblokkade bij opvragen niet geverifieerde periodeprojecties; directe stack en gedeelde-helpertegenproef vastgelegd. Gebruiker kiest rapporteren; geen omzeiling met nulwaarden. [Bevinding 05](FINIZE-PAKKET-2-BEVINDING-05-PARTIELE-SPAARIMPORT.md) |
| 1 | Salaris/vakantiegeld/bonus vanaf één tegenrekening | Laatst geleerde type vervangt eerder type; nieuw salaris krijgt een overige-inkomstenvoorstel. Nog niet goedgekeurd. Gebruiker kiest bestaand gedrag behouden. [Bevinding 04](FINIZE-PAKKET-2-BEVINDING-04-HERKENNING.md) |
| 1 | Focus na hertekenen mobiele inkomenskaart | Bewezen toegankelijkheidsrandgeval in programmatisch gesimuleerde hertekening; geen financiële fout. [Bevinding 06](FINIZE-PAKKET-2-BEVINDING-06-UI-EN-TESTGRENZEN.md) |
| 1 | Marker-/legendakleur verschilt | Bewezen visueel verschil; bedoeling van exacte kleurgelijkheid nog te bevestigen, mogelijk bewust donkerdere tekst. Geen CSS-wijziging. [Bevinding 06](FINIZE-PAKKET-2-BEVINDING-06-UI-EN-TESTGRENZEN.md) |
| 1 | Oude nieuwe-huishoudenproef zoekt inkomstenbron in eigenaargebonden vaste-lastenvenster | Verouderde bediening; volledige actuele route voor dit samengestelde scenario niet gevalideerd. Geen vervangende financiële assertions verzonnen. [Bevinding 06](FINIZE-PAKKET-2-BEVINDING-06-UI-EN-TESTGRENZEN.md) |
| 1 | 500-bronnenschaalproef faalde op ontbrekende bewijsmap | Testconfiguratie: map wordt nu door de gedeelde helper aangemaakt. Onderliggende fout kan gemaskeerd zijn; geen zware hertest, dus geen geslaagde schaalclaim. [Bevinding 06](FINIZE-PAKKET-2-BEVINDING-06-UI-EN-TESTGRENZEN.md) |

De salaris- en gedeeltelijke-historiebeperkingen zijn volgens besluit gerapporteerd. Ook overige grotere ingrepen zijn als open punt behouden. Geen rode assertion is verwijderd, afgezwakt of in een nieuwe skip veranderd.

## Fase 2.3 — CI

`.github/workflows/verify.yml` start bij **push naar main**, **PR naar main**, handmatig en wekelijks. De snelle job voert syntax/CSS/reproduceerbare build, alle normale Node-tests, de gemockte backendtest en 44 browsergevallen uit. De uitgebreide job voegt de afzonderlijke emulators en de functionele browserinventaris toe.

De suite is lokaal gecontroleerd verdeeld in **637 functionele gevallen en 10 schaal-/prestatiegevallen**, zonder overlap of ontbrekende gevallen. `.github/workflows/verify-scale.yml` biedt die tien afzonderlijk aan en start uitsluitend handmatig. De volledige lokale suite blijft beschikbaar. Deze scheiding volgt het besluit zware schaalproeven apart te behandelen; zij verbergt hun status niet.

Beide workflows hebben alleen `contents: read`, checkout zonder bewaarde credentials en geen productiesecrets. Firebase-tooling is gepind en draait op lokale demo-emulators. De bestaande deploymentworkflow is niet gewijzigd. Mislukte tests geven een mislukte job; rapporten worden ook bij fouten als artifacts aangeboden.

Lokaal gecontroleerd: YAML-parsing, eventconfiguratie, expliciete testcommando's, suiteverdeling, Node/backend/emulator/smoke-uitkomsten. **Niet gecontroleerd: een daadwerkelijke GitHub Actions-run, Linux-pixelgelijkheid of deployment.** Er is bewust niet gepusht. De uitgebreide workflow zal met de bekende rode gevallen geen groene acceptatie geven; dat is de juiste signalering.

Uitvoerhandleiding: [FINIZE-TESTEN.md](../FINIZE-TESTEN.md).

## Fase 2.4 — Brede dekking en beperkingen

De gerichte cohorten controleren dashboard, gezamenlijke/persoonlijke rekeningen, doelen/verdeling, budgetten/refunds, vaste lasten, salarissen, transacties, CSV, bankmocks, historische maanden, prognoses, veilig sparen, Firestore-opslag, offline/PWA en navigatie. Vereiste mobiele breedtes 360/390 px, tablet en 1440 px zijn inbegrepen; aanvullende controles gebruiken 320/430/768/1024 px. De geslaagde gevallen bewijzen hun eigen scenario, geen foutloosheid van alle mogelijke financiële invoer.

Vier eerder ontbrekende gepinde shells zijn lokaal uit Git opgebouwd. Upgrade, offline herladen en terugrollen vanaf r23/r24/r36/r39/r40 zijn gericht gecontroleerd zonder lokale gegevens te wissen. Er zijn twee afzonderlijke V117-upgradeproeven overgeslagen omdat gecontroleerde oude V117-assets ontbreken. Privé-snapshots zijn niet gebruikt om die gaten te vullen.

Zeven schaal-/prestatiegevallen zijn niet voltooid: 5.400 transacties/36 maanden, drie performancevarianten, grote perioderamen, offline herstart met 500 bronnen en de grote bron/effectverifier. De eerdere brede run bereikte 90 minuten; er is daarna geen nieuwe volledige run gestart. De 500-bronnenfout is niet financieel geverifieerd. Twee kleinere herhaalde-bewerking/herstelgevallen en de 20/100-bronnenperioderamenproef slagen wel.

Bekende financiële/UI-beperkingen, niet bereikte eindassertions, ontbrekende V117-assets en niet uitgevoerde schaalproeven blijven expliciete grenzen aan de dekking. Een volledige groene release of universeel ongewijzigde UI wordt daarom niet geclaimd. Publicatie is hiermee niet afgevinkt: vooral de gedeeltelijke-spaarimportblokkade en de niet bereikte eindassertions vragen vervolg voordat volledige acceptatie mogelijk is.

## Bestanden, commits en overdracht

Het volledige bestandsoverzicht en de lokale commits van pakket 2 staan in [FINIZE-PAKKET-2-BESTANDEN-EN-COMMITS.md](FINIZE-PAKKET-2-BESTANDEN-EN-COMMITS.md). De classificatie is vóór de betrokken testwijzigingen begonnen en later met werkelijk uitgevoerde hertests aangevuld. De pakket-1-rapportage blijft apart beschikbaar.

De eigen testservers en emulator zijn na de controles beëindigd. De bestaande andere server op 4173 is niet gestopt. Productiegegevens, echte banktransacties en bankverbindingen zijn ongemoeid gebleven.

**Stop na pakket 2.** Pakket 3 en publicatie zijn niet uitgevoerd. Open punten zijn overgedragen; verdere functionele reparaties of ontwerpkeuzes vallen niet stilzwijgend onder dit verslag. Het overkoepelende eindrapport volgt pas na een afzonderlijk goedgekeurd pakket 3.
