# Finize V118-r19 — liquiditeitsprognose en veilig sparen

Datum: 27 oktober 2026. Uitgangspunt: nieuwste `origin/main`, V118-r18, `405b237c33700615d6f188e9615ca4a093ab6a87`. Werkbranch: `codex/v118-liquiditeit-spaarcapaciteit`.

Het bestaande rapport **Diagnose laagste prognose €47,61**, onderzoeksdatum 26–27 oktober, is gelezen. Er is geen nieuwe productieaudit uitgevoerd. De hieronder genoemde reconstructies gebruiken uitsluitend synthetische invoer en de in de opdracht aangeleverde bedragen. Er is geen bewaarde financiële cloudrevisie opnieuw opgehaald.

## 1. Verholpen oorzaken en gewijzigde functies

| Bestand / functie | Wijziging |
|---|---|
| `src/core/daily-liquidity.mjs` / `buildLiquidityInput` | Eén budgetpot per maand, financiële eigenaar en fysieke rekening. Eerst plannen en actuals optellen, dan het totale restant op nul begrenzen. De administratieve categorieën blijven bestaan. |
| `src/core/transaction-engine.mjs` / `budgetActual` | Optioneel projectiefilter voor de fysieke rekening. De bestaande transactiedefinities, refunds en directe budgetallocaties worden hergebruikt. Bestaande aanroepen zonder dit filter behouden hun werking. |
| `src/core/daily-liquidity.mjs` / `selectMonthEndSavings` | Afzonderlijke beschermingslijn op echte/concreet geplande kasstromen. Volledige resterende maandbudgetten tellen eenmaal mee vanaf het begin van hun maand, ook in de maand waarin de controlehorizon eindigt. |
| `src/ui/dashboard.mjs` / `outlookHtml`, `calculationHelp` | Hoofdbedrag plus uitsluitend Gepland sparen en Extra ruimte. Uitleg over volledige budgetdekking; geen voortgang of resterende inleg in deze kaart. |
| `tests/liquidity-budget-pot.test.cjs` | Gerichte regressies A–M, rekening/eigenaar, terugbetaling, datumzekerheid, kapitaalkoppeling en expliciete kasstroomreconciliatie. |
| `tests/month-end-savings.test.cjs`, browsertests | Vergelijking met het volledige maandplan; vereenvoudigde kaart, onzekerheid, vijf filters en de permanente gezamenlijke buffer. |
| `index.html`, `service-worker.js`, versietests, `app.js` | Release/cachemarker `118-r19` en reproduceerbare bundel. Geen inhoudelijke CSS-wijziging. |

`projectDailyLiquidity`, `hardAvailability`, `withAvailability`, salarisverdeling, zakgeldregels en `financialForecastForMonth` zijn niet herschreven. Er zijn geen veranderingen aan bankadapters, importlogica, opslagcommands, backend of Firestore-regels.

## 2. Exacte budgetaggregatie

Alle bedragen zijn synthetische regressie-invoer uit de aangeleverde diagnose:

| Post | Plan | Besteed | Oude positieve rest |
|---|---:|---:|---:|
| B1 | €600,00 | €470,05 | €129,95 |
| B2 | €150,00 | €155,00 | €0,00 |
| B3 | €100,00 | €110,72 | €0,00 |
| B4 | €200,00 | €90,00 | €110,00 |
| B5 | €100,00 | €288,77 | €0,00 |
| Totaal | €1.150,00 | €1.114,54 | €239,95 |

Oud: `som(max(0, planPerPost - actualPerPost)) = €239,95`.

Nieuw: `max(0, €1.150,00 - €1.114,54) = €35,46`. De onterechte extra reservering van **€204,49** vervalt. Bij €1.150 en €1.300 besteding is de reservering €0; een overschrijding verhoogt het banksaldo niet. De bestaande categorieactuals blijven opvraagbaar, bijvoorbeeld €110,72 voor B3.

Dezelfde pot wordt door dagprognose en spaarberekening gebruikt. Een andere eigenaar of andere fysieke rekening kan deze pot niet compenseren. Een werkelijke besteding op een tweede fysieke rekening verlaagt de eerste pot niet. Terugbetalingen volgen de bestaande correctiemaand en budgettoewijzing.

## 3. Dagelijkse spreiding en laagste prognose

De bestaande methode blijft: deel gehele centen door het aantal resterende kalenderdagen; verdeel het centrestant vanaf de eerste dag. Oktober: €35,46 over 27–31 oktober, samen exact €35,46. November: €1.150 over 30 dagen; de eerste vier dagen elk €38,34, samen **€153,36**. Afzonderlijke categorieafronding gaf €153,40.

Een synthetische reconstructie met de opgegeven componenten levert:

`€4.823,02 - €664,95 - €525,61 - €1.041,59 - €35,46 - €1.924,91 - €225,00 - €153,36 = €252,14`.

Het minimum ligt daarbij op 4 november; de horizon blijft eindigen vóór de ontvangst op 5 november. De €200-buffer wordt niet van deze minimumkaart afgetrokken. De ongedateerde €66,59 wordt niet als bevestigde dagbetaling toegevoegd: de dagelijkse prognose blijft met zulke invoer **Onvolledig**. €252,14 is dus geen bevestigde actuele productie-uitkomst of veilige bestedingsruimte. Ook de eerdere gevoeligheidsuitkomst €185,55 uit de diagnose mag niet zonder datuminvoer als nieuwe daglijn worden gepresenteerd.

Alle vijf grafiekfilters houden dezelfde toekomstbedragen als de KPI. Historische reconstructie, huidige kasbasis en datums blijven volgens de bestaande selectors werken.

## 4. Methode voor veilig sparen

De berekening begint bij de bestaande banksaldobasis en behoudt alle echte bankmutaties en concrete plannen, inclusief vervangen betaalmomenten. De hypothetische geselecteerde maandspaaroverboeking wordt, volgens de bestaande identificatieregels, niet vooraf afgetrokken. Andere concrete overboekingen blijven meetellen.

Per dag wordt berekend:

`beschermdSaldo = concreetKasSaldo - cumulatieveResterendeMaandpotten - relevanteOngedateerdeVerplichtingen`.

De dagelijkse budgetschattingen worden hiervoor **niet** van `concreetKasSaldo` afgetrokken. Het is de bestaande `cashBalanceCents`-kolom. De volledige restpot van een maand telt vanaf de eerste dag van die maand mee en blijft daarna eenmaal in de cumulatieve uitgaven. Een al bekende toekomstige budgetbetaling blijft in de concrete kasstroom staan; het bestaande budgetactual verlaagt de nog te reserveren pot met hetzelfde bedrag. De test met een werkelijke €100-budgetbetaling bewijst gelijke spaarcapaciteit vóór/na die vervanging.

Laat `E` het beschermde saldo op maandultimo zijn. Neem het laagste verschil van ieder later beschermd saldo ten opzichte van `E`, inclusief nul. Dan:

`nodigBijAanvang = buffer - min(0, alle latere saldoveranderingen)`;

`veiligTeSparen = max(0, E - nodigBijAanvang)`.

Hierdoor beschermt de berekening ook vaste lasten vóór een salaris. De buffer voor gezamenlijk sparen bedraagt minimaal **€200**; een hoger ingesteld bedrag blijft gelden. Er worden geen opgeslagen rekeninginstellingen gewijzigd. De bestaande daggrafiek behoudt zijn ingestelde buffer. De horizon omvat de hele volgende maand en loopt daarna tot en met de eerstvolgende relevante salaris-/zakgeldontvangst, binnen de bestaande grens. De volledige budgetruimte van die laatste betrokken maand wordt eveneens beschermd: dit is bewust conservatief.

De teruggegeven `protectionDays` bevat per dag de concrete kasbasis, cumulatieve budgetbescherming, ongedateerde bescherming en beschermde saldo. Dit is berekeningsuitvoer en wordt niet als transactie of historisch saldo opgeslagen.

### Controle van een scenario met maandbudgetten

Synthetisch beginsaldo €10.000; budget iedere maand €1.150; salaris €2.000 op de 5e en €1.000 op de 24e; toekomstige lasten €1.800 op de 1e en €100 op de 25e.

| Moment | Concrete kas | Cumulatief budget | Beschermd saldo vóór nieuwe spaaroverboeking |
|---|---:|---:|---:|
| 31 oktober | €10.000 | €1.150 | €8.850 |
| 1 november | €8.200 | €2.300 | €5.900 |
| 5 november | €10.200 | €2.300 | €7.900 |
| 24 november | €11.200 | €2.300 | €8.900 |
| 25 november | €11.100 | €2.300 | €8.800 |
| 1 december | €9.300 | €3.450 | €5.850 |
| 5 december, einde controle | €11.300 | €3.450 | €7.850 |

Laagste toekomstige verandering: €5.850 − €8.850 = −€3.000. Nodig: €3.000 + €200 = €3.200. Veilig: **€5.650**. Na deze overboeking blijft ieder gecontroleerd beschermd dagsaldo vanaf maandultimo ten minste €200; het minimum is exact €200 op 1 december. Eén cent extra zou die buffer doorbreken.

## 5. Ongedateerde verplichtingen

Een concrete `cashDates`-/afschrijfdag blijft een gedateerd plan. Zonder concrete bankdag blijft een last een `undated-obligation`, buiten de bevestigde daglijn.

Omdat het bestaande model geen betrouwbare uiterste-betaaldatum voor een ongedateerde occurrence heeft, ondersteunt de berekening één kleine optionele metadata-map op de bron: `paymentDeadlines[occurrenceId] = YYYY-MM-DD`. Dit is expliciet een bovengrens, geen afschrijfdatum. Een deadline voor een ander betaalmoment wordt niet hergebruikt. De reservering telt conservatief vanaf het begin van de betreffende occurrence-maand, of eerder wanneer de expliciete deadline dat vereist. Er worden geen datums automatisch ingevuld of opgeslagen.

De bestaande vaste-lasteneditor heeft hiermee geen nieuw deadline-invoerveld gekregen. Zonder expliciet aangeleverde geldige deadline of concrete betaaldag blijft de spaarprognose **Onvolledig**. Een einddatum van een abonnement of de occurrence-ankerdag wordt nooit stilzwijgend als deadline geïnterpreteerd. De bevestiging in de opdracht over €23 + €43,59 is niet omgezet in productiegegevens of een hardcoded uitzondering.

Synthetische tests bewijzen: expliciete oktoberdeadlines beschermen exact €66,59; dagelijkse cashdatums blijven `null`; een later expliciet gekoppelde bankbetaling vervangt de reservering zonder dubbele aftrek. Zonder datum/deadline, bij een ongeldige deadline of een verkeerde occurrence blijven veilig bedrag en extra ruimte onbekend. Overige ambiguïteits- en rekeningwaarschuwingen worden niet door een deadline opgeheven.

## 6. Informatieve KPI-regels en bestaande logica

De kaart houdt dezelfde positie en bevat uitsluitend het veilige bedrag en twee vergelijkingsregels:

`extraRuimte = max(0, veiligTeSparen - geplandSparen)`.

Bewezen voorbeelden: €750 / €500 / €250; alleen het plan op €600 zetten geeft €750 / €600 / €150; €300 capaciteit tegenover €500 plan geeft €0 extra. Het plan wordt niet als extra bankafschrijving of tweede reservering afgetrokken. Onvoldoende essentiële data: hoofdbedrag `—`, geen numerieke Extra ruimte, waarschuwing en wel het bekende maandplan.

`remainingPlannedCents`, de bijbehorende tekortvergelijking en de uitsluitend daarvoor gebruikte kaartpresentatie zijn verwijderd uit deze selector/kaart. De teksten **Al uitgevoerd** en **Nog uit te voeren** ontbreken uit de geteste kaart. De algemene spaarrealisatieberekening blijft beschikbaar voor andere bestaande functies.

Een synthetische €6.100-bestaande-kapitaalkoppeling behoudt `existingCapitalDeposit = 6100`, spaardoeleffect €6.100 en echte uitgaande bankkasstroom −€6.100. De spaarcapaciteit neemt met precies €6.100 af wanneer de echte afschrijving na het ijkpunt plaatsvindt. De bronstaat en de koppeling blijven ongewijzigd.

De bestaande maandmotor blijft een gezamenlijke spaarreservering vóór zakgeldverdeling verwerken. Dat bestaande verdelingscontract is niet veranderd. De onafhankelijkheid van de twee KPI-vergelijkingsregels betekent geen wijziging van die historische zakgeldregel. Gezamenlijk behouden extra inkomsten en expliciet meegerekende extra inkomsten blijven hun bestaande verschillende effecten houden; beide gerichte regressies slagen.

## 7. Eerdere referenties en gewijzigde testverwachtingen

De bestaande referentievoorbeelden hebben geen variabele budgetpot en blijven exact geldig:

| Scenario | Banksaldo op maandultimo | Grootste toekomstige daling | Buffer | Nodige opening | Veilig |
|---|---:|---:|---:|---:|---:|
| Oktober | €2.700 | €1.800 | €200 | €2.000 | €700 |
| November, incl. gezamenlijk behouden €800-teruggave | €3.500 | €1.800 | €200 | €2.000 | €1.500 |

Oktober: start €2.200 + salarissen €2.600 + €3.400 − lasten €1.800 − €1.600 − €2.100 = €2.700. Volgende maand: eerst −€1.800, dan +€2.600, −€1.600, +€3.400, −€2.100; de grootste daling is €1.800. In de guardmaand komt de vroege −€1.800 vóór de volgende ontvangst eveneens mee.

November: dezelfde maandkasstroom plus €800 gezamenlijke teruggave geeft €3.500. Na €1.500 sparen blijft €2.000; de vroege decemberlast €1.800 laat precies €200 staan. De bestaande december-daglijntest behoudt minimum €200 en eindsaldo €2.500.

Een andere bestaande browserfixture had een gezamenlijke rekeningbuffer van €100. Voor veilig sparen geldt nu de gevraagde permanente ondergrens €200. Daarom verandert alleen de spaarverwachting €2.620 → €2.520: €2.920 einde − €200 toekomstige daling − €200 buffer. Na de bestaande wijziging van een vaste last naar €250 is de berekening €2.900 − €250 − €200 = €2.450, voorheen €2.550. Deze verwachtingen zijn met deze kasstroomonderbouwing aangepast; minimumkaart, persoonlijke rekening en verdeling blijven gelijk.

## 8. Validatie en grenzen

De volledige definitieve Node-run is geslaagd: **82 testbestanden**, waaronder de **18 nieuwe gerichte regressies**. Er zijn geen mislukte of overgeslagen Node-gevallen. De eerder uitgevoerde 130 gerichte gevallen en de latere volledige run zijn herhalingen, geen bij elkaar op te tellen onafhankelijke bewijzen.

JavaScript-syntax, CSS-parser, reproduceerbare bundel en `git diff --check` slagen. De CSS-controle meldt uitsluitend de bestaande ongedefinieerde token `--line`; er is geen inhoudelijke CSS-diff. De Impeccable-detector geeft voor de gewijzigde dashboardbron `[]`. Screenshots op 320 en 1440 px zijn daadwerkelijk geopend; de geautomatiseerde kaartcontrole omvat ook 390 en 430 px, geen horizontale overloop en geen paginafouten.

Een bredere eerste browserrun van 50 gevallen eindigde op 35 geslaagd en 15 mislukt. Vier waren nog geladen oude verwachtingen voor de eerdere €100-buffer; de herziene verwachtingen staan met volledige kasstroomberekening in sectie 7 en worden in de definitieve gerichte run herhaald. De andere elf komen uit de ongewijzigde oudere `package4-savings-refunds-forecast.spec.cjs`: ontbrekende spaardoelopties/importknoppen en niet tot stand gekomen fixturemutaties. Alle **zes verschillende scenariofamilies** zijn afzonderlijk op de bytevaste, ongewijzigde **r18-runtime** herhaald en falen daar ook. De dubbele schermbreedtes zijn niet elk opnieuw als apart baselinebewijs geteld. Dit is bestaand onderhoud aan die oude browserfixtures, geen als geslaagd gepresenteerde P4-run. Er is geen productcode aangepast om deze oudere tests passend te maken.

De veertien P7-browsercontroles uit de brede run slagen, inclusief cacheversies, offline/herverbinden, behoud van IndexedDB-bewijs en de bestaande injectie-/validatiecontroles. De definitieve aanvullende eindrun is **46/46 geslaagd**, zonder overgeslagen gevallen: actuele verwachtingen, actuele prognose, vaste-lastenweergave, kapitaalkoppelingen, P2/P3 en de echte r18→r19-serviceworkerupdate/terugrol. Een herhaling die de testserver van de inmiddels afgelopen brede run hergebruikte, is wegens `ERR_CONNECTION_REFUSED` afgebroken en volledig vervangen door die geslaagde run op een eigen lokale server; die infrastructuurpoging telt niet als geslaagde regressie.

Lokale bewijsbestanden (niet in Git): `.cache/r19-unit-final.txt`, `.cache/r19-pot-node-final.txt`, `.cache/r19-release-browser.txt`, `.cache/r19-r18-baseline.txt`, `.cache/r19-r18-baseline-additional.txt`, `.cache/r19-final-browser-isolated.txt`. De PWA-uitroltest gebruikt de vastgepinde r18-shell uit `.cache/r19-previous-shell`; zonder die expliciete releasefixture wordt alleen die optionele uitroltest overgeslagen. In de uitgevoerde releaseproef is de fixture aanwezig.

Bekende invoer blijft een aparte controlegrens. Een synthetische regressie met de opgegeven zorgverzekeringsinvoer bewijst dat een gekoppelde oktoberbetaling van €37,50 alleen die oktober-occurrence vervangt; de novemberplanning blijft €225 op 1 november, rekening Gezamenlijk. Dit bewijst niet dat het werkelijke contractbedrag of die gebruikerskoppeling inhoudelijk juist is. Er is niets automatisch hersteld.

Gedeeltelijke of onbekende bankdekking blijft een blokkade voor een numeriek veilig spaarbedrag. De historische €4.823,02-basis en revisie 5609 zijn niet opnieuw onafhankelijk bevestigd. Geen nieuwe echte bank- of cloudbeschikbaarheidsclaim.

De implementatie heeft geen productiegegevens geschreven en geen echte banksynchronisatie gestart. De browsertests werken met synthetische lokale gegevens en blokkeren externe diensten. Geen wijzigingen aan transacties, budgetbedragen, bankkoppelingen, inkomstenverdeling, kapitaalkoppelingen of betaalafspraken in productie.

## 9. Commits en publicatie

Implementatie/releasecommit: `7fc20db19cd0ed9638bbd3c669946d973cc84bb8`, branch `codex/v118-liquiditeit-spaarcapaciteit`. De branch is gepusht en zonder force via fast-forward opgenomen in `main`. De bestaande Pages-configuratie blijft `main` met repository-root.

GitHub Pages-run [40462549359](https://github.com/Dionvs/Finize/actions/runs/40462549359) is **succesvol**. De openbare app toont de `118-r19`-assets. Zeven bestanden geven HTTP 200 en hebben exact dezelfde SHA-256 als de Git-blobs van de release: `index.html`, `app.js`, `app.css`, `service-worker.js`, `manifest.json`, `icons/icon-192.png` en `finize-logo.png`.

Op de openbare app slagen vier geïsoleerde synthetische browserproeven, op **320, 390, 430 en 1440 px**. Iedere proef controleert €750 veilig / €500 gepland / €250 extra, daarna uitsluitend het plan wijzigen naar €600 met behoud van €750 capaciteit en €150 extra. Bij een ontbrekende betaaldag worden veilig bedrag en Extra ruimte verborgen, terwijl Gepland sparen zichtbaar blijft. De voortgangsteksten ontbreken; er is geen horizontale overloop of paginafout. De screenshots zijn lokaal bewaard.

Alle externe origins en alle niet-leesverzoeken zijn in deze openbare proeven geblokkeerd; de synthetische auth-testdriver gebruikt een afzonderlijke lokale gebruikers-/huishoudcontext. Er zijn **nul productiegegevenswrites en nul echte bank-API-acties** uitgevoerd. Dit bewijst de openbare frontendwerking met synthetische invoer, geen echte authenticatie, cloudbeschikbaarheid of banksynchronisatie.

Controleerbaar publicatiebewijs: [finize-release-r19-public-20261027.json](finize-release-r19-public-20261027.json). Dit verslag en het bewijs worden als afzonderlijke documentaire closeoutcommit gepubliceerd; de financiële broncode en publieke runtime blijven daarbij gelijk aan `7fc20db19cd0ed9638bbd3c669946d973cc84bb8`.
