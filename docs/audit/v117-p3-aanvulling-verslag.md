# Finize V117 — P3 aanvullende implementatie

Datum: 10 oktober 2026. Branch: `agent/v117-stabilisatie`. Uitgangspunt: P3-infrastructuurcommit `3227586922687c59abb3653aea3e4c31ed161b35`; geaccepteerde P2: `33154fe38f52ce943e8ee7add5d18842c27643a1`.

## Status

De aanvullende implementatie sluit geverifieerde perioden aan op de bestaande schermen, lokale commits en recordsynchronisatie. Normale maandweergaven en transacties reconstrueren geen complete bankhistorie. De canonieke financiële motor blijft de enige rekenmotor. P4 is niet gestart. Er is niets gedeployed, gepubliceerd, naar main gepusht of in productie-Firestore gewijzigd.

**De definitieve controles zijn geslaagd; deze P3-aanvulling wordt ter beoordeling aangeboden.** Het eerdere P3-verslag blijft staan als historisch bewijs van de toenmalige architectuurblokkade; dit aanvullende verslag beschrijft de oplossing en haar grenzen. Geen kritieke financiële afwijking is in de uitgevoerde eindproeven gevonden. De hieronder genoemde functionele grenzen blijven expliciet gelden.

De nieuwe route is uitsluitend bereikbaar via een expliciete lokale emulatorsessie. Aansluiten van die sessie opent standaard de geselecteerde maand. De productieapp schakelt niet om naar records zonder afzonderlijk goedgekeurde productievoorbereiding.

## Opgeloste oorzaken

1. Schermen en mutaties behandelden de volledige schema-v11-state als impliciete voorwaarde. Een gedeeltelijke state heeft nu een expliciete marker, geverifieerde maanden, bronafhankelijkheden, cumulatieve basis en cloudrevisie. Een ontbrekende periode of projectie veroorzaakt een fout, geen nultotaal.
2. De cumulatieve spaardoelsaldi waren afhankelijk van alle historische ledgerregels. De geverifieerde cumulatieve projectie levert nu het saldo buiten het geladen ledgerdeel. De bestaande motor berekent de veranderingen in het geladen deel. Oude ledgerregels blijven afzonderlijk duurzaam bewaard.
3. Cloudcommitvoorbereiding en terugleescontrole lazen alle canonieke records. Gerichte commits controleren nu de geladen afhankelijkheden, gewijzigde records, betrokken hashmanifesten, geraakte maandprojecties en cumulatieve delta. De bestaande epoch-, operatie- en revisiecontrole blijft van kracht.
4. Een geopende oude maand ontbrak aanvankelijk in de duurzame synchronisatiebasis. Periodeontvangst bevestigt nu in één IndexedDB-transactie de records, head, het ontvangstbewijs en de uitgebreide cloudbasis, zonder financiële heruitvoering of verwijdering van pending operaties.
5. Het jaarlijkse Dashboard verwacht twaalf maandresultaten. Het krijgt geverifieerde samenvattingen zonder twaalf maanden bankregels te laden. Ook een ontbrekende Dashboard-projectie blokkeert de ontvangst.
6. De volledige historie kon na een zeldzame globale planningsbewerking in het actieve venster blijven staan. Na bevestigde synchronisatie keert de app terug naar de actieve maand. De oude lokale records worden daarbij niet verwijderd.

## Scherm- en verwerkingspaden

| Pad | Benodigde gegevens |
| --- | --- |
| Opstarten van de lokale recordsessie | Instellingen, actieve maand met aantoonbare afhankelijkheden, cumulatieve financiële basis en twaalf Dashboard-samenvattingen |
| Dashboard, budgetoverzichten, inkomstenplanning, zakgeld en prognose | Bestaande motor op het geverifieerde maanddomein; jaarlijkse tabel uit bewezen projecties |
| Spaardoelen | Actuele geverifieerde doelsaldi plus wijzigingen in het geladen ledgerdeel |
| Transactieoverzichten en CSV-goedkeuring | Bankbronnen en effecten van het geladen maanddomein; importdetails voor de geopende/bewerkte batch |
| Historische maandkiezer | Afzonderlijke periodequery; bestaande geopende maanden blijven beschikbaar totdat een expliciete volledige controle wordt afgesloten |
| Historische correctie, terugbetaling, splitsing, koppeling of spaardekking | Gewijzigde bron en alle aantoonbaar verbonden financiële maanden; anders expliciet laden of veilig stoppen |
| Tweede client | Geverifieerde maandontvangst, atomair lokaal bevestigd; geen complete voorgeladen administratie vereist |
| Offline | Eerder geverifieerde geladen maanden en duurzame lokale wijzigingen; onbekende perioden worden niet als leeg voorgesteld |

`commitChange` bereidt eerst synchroon een kandidaat. Als historische afhankelijkheden ontbreken, wordt die kandidaat niet opgeslagen of als definitief gepubliceerd. De recordsessie laadt de noodzakelijke maanden, waarna alleen de oorspronkelijke wijziging op de uitgebreide basis wordt toegepast. Onverwacht gewijzigde velden veroorzaken een conflict. Daarna valideren dezelfde financiële diensten de kandidaat en volgt de bestaande awaited IndexedDB-commit.

Bij een individuele of groepsgoedkeuring blijven de P1-uitkomsten `committed`, `rejected` en `uncertain`, onveranderlijke operatiebewijzen, stabiele bron-ID's en revisies behouden. De tien goedkeuringen hebben tien afzonderlijke lokale financiële commits en effecten; synchronisatie bundelt hun operatiebewijzen zonder de bankbewegingen samen te voegen.

## Opslag- en interfacecontract

| Bestand | Wijziging |
| --- | --- |
| `src/storage/period-workspace.mjs` | Geverifieerde gedeeltelijke state, afhankelijkheden, cumulatieve delta, gerichte commitvoorbereiding en idempotente publicatie |
| `src/storage/record-manifest.mjs` | SHA-256-buckets van canonieke recordidentiteiten; controle van complete exports en gewijzigde buckets |
| `src/storage/cloud-record-model.mjs` | Maandgerichte snapshotvoorbereiding, geverifieerde instellingen en manifestmetadata |
| `src/storage/cloud-records.mjs` | Gerichte terugleescontrole; eenmalige gecontroleerde upgrade van eerdere P3-opslag; oud snapshotcontract geblokkeerd na manifestomschakeling |
| `src/storage/record-sync.mjs` | Maandontvangst, gerichte outboxsynchronisatie, verloren bevestigingen, periodieke conflicten en tijdelijke volledige controle |
| `src/storage/record-session.mjs` | Periodegericht aansluiten van de bestaande lokale applicatie op de emulator |
| `src/storage/household-store.mjs` | Alleen head-geselecteerde financiële records lezen; atomaire periode- en conflictontvangst; historische lokale records beschermen |
| `src/core/runtime.js` | Aansluiting op schermen, maandkiezer, commitvalidatie, Dashboard-projecties en expliciete volledige back-up |
| `src/core/transaction-engine.mjs` | Maanddomeincontrole en geverifieerde cumulatieve totalen; ontbrekende perioden geven een fout |
| `src/core/data-normalization.mjs` | Spaarsaldo met bewezen historische ledgerbasis |
| `src/core/transaction-processing.mjs` | De bestaande mutatiediensten gebruiken expliciet het geladen afhankelijkheidsdomein |
| `firestore.rules` | Manifestwrites volgen hetzelfde beschermde operatieprotocol; oudere recordclients kunnen het manifestcontract niet terugdraaien |
| `app.js` | Reproduceerbaar gegenereerde runtime; geen handmatige bundelwijzigingen |
| `tests/v117-p3-periods.test.cjs`, `tests/browser/v117-p3.spec.cjs`, `tests/emulator/v117-p3.test.cjs` | Aanvullende periode-, browser-, invariant-, schaal- en herstelproeven |

Nieuwe hoofdinterfaces: `openWorkspace(months)`, `commitWorkspace({before,state,imports,operationId,members})`, `preparePeriodStorage()`, `openMonth(month,{additionalMonths})` en `openFullHistory(month,reason)`. Interne `periodAcceptance` en `resolutionAcceptance` gebruiken dezelfde P2-commitgrens; zij zijn geen tweede opslag- of transactiemotor.

Het bestaande opslagversie-2/epochcontract blijft gelden. `integrityMode: manifest`, `manifestHashes` en `settingsHash` markeren de gecontroleerde recordintegriteit. Een eerdere P3-administratie zonder deze bewijzen wordt eerst volledig teruggelezen en verifieerbaar aangevuld, zonder nieuwe financiële boeking. Daarna weigeren zowel de client als de echte Security Rules een terugkeer naar het oude volledige-snapshotcommitcontract. De oorspronkelijke v116-generaties en imports blijven beschermd.

Een gewone commit leest alleen de gewijzigde manifestbuckets; die bevatten identiteiten en hashes, geen tweede financiële administratie. Gewijzigde records en projecties worden via hetzelfde bestaande operatieprotocol staged, teruggelezen en pas na definitieve head-publicatie bevestigd. Een grotere publicatie blijft tijdens `applying` onleesbaar als financiële eindstand. Herstart en herhaling gebruiken dezelfde operatiebewijzen.

## Historische afhankelijkheden en uitzonderingen

De bestaande codec bewaart bankdatum, financiële maand, vaste-lastenmaand, terugbetalingsmaand en splitsingsafhankelijkheden. De bronclosure omvat gekoppelde effectregels, interne paren, spaardekking, vervangingen en terugbetalingsdoelmaanden. Een correctie werkt alle werkelijk geraakte maandprojecties en de cumulatieve resultaten bij. De benodigde maanden komen uit bron- en revisiebewijzen, niet alleen uit de momenteel zichtbare maand.

Een expliciete volledige controle blijft nodig bij globale planningswijzigingen, wijziging van de set spaardoelen, terugtrekken/herstellen van een complete import en volledige integriteits- of herstel-export. Dit zijn operaties met administratiebrede afhankelijkheden. De volledige controle omvat alle bewezen cloudperioden en noodzakelijke lege planningsmaanden. Na bevestiging wordt het actieve venster weer klein; een volgende gewone commit werkt alleen zijn geraakte maandprojecties bij.

Een volledige back-up van uitsluitend een gedeeltelijke state wordt geweigerd. Een complete export vereist een bewezen complete cloudstand zonder open lokale wijzigingen. Het oude back-upherstelcontract kan een periodeadministratie niet overschrijven. Productieherstel blijft een afzonderlijke gecontroleerde migratie, waarvoor deze opdracht geen toestemming geeft.

## Conflicten en offline bescherming

Beide conflictversies, relevante importgegevens en operatie-ID's blijven in het huishoudjournal bewaard. Een gemanipuleerde beoordelingskopie of gewijzigde remote revisie wordt geweigerd. Bij een expliciete lokale keuze moeten alle afwijkende externe goedkeuringen als beoordeeld worden bevestigd.

Niet-overlappende wijzigingen worden tegen de actuele geverifieerde basis samengevoegd, opnieuw door de bestaande financiële diensten gevalideerd en eerst lokaal atomair bevestigd. De conflictkeuze, nieuwe cloudbasis en retrybare outbox horen bij dezelfde IndexedDB-transactie. Een verloren cloudbevestiging kan na herstart worden afgemaakt zonder tweede financiële uitvoering.

**Functionele grens:** wanneer dezelfde bankverwerking op beide apparaten verschillend is aangepast, volgt een expliciete blokkade `financial-reapproval-required`. Geen van beide goedkeuringen wordt automatisch gekozen of verwijderd. Deze aanvulling introduceert geen nieuwe conflictoplossingsinterface. Ook ontbrekende bronrelaties, onbekende offline maanden en een complete back-upimport over een gedeeltelijke administratie blijven veilig geblokkeerd.

Huishoudscope, bronimmutabiliteit en de beschermde legacy-localStorage-controle blijven centraal gecontroleerd. Pending wijzigingen worden nooit door een maandontvangst of verloren cloudbevestiging weggegooid.

## Verificatie en financiële invarianten

Definitieve build-SHA-256 van `app.js`: `9491027f6063c759c05dcc901ef63d3a3e7a4dee2b15e84a5bec063a28525ade`.

| Controle | Definitieve uitslag |
| --- | --- |
| Node-regressie | 56 bestanden; 589 geregistreerde testgevallen geslaagd; 0 mislukt, 0 overgeslagen. Daarnaast zijn de 34 bestaande assertiescripts zonder geregistreerde Node-testgevallen succesvol uitgevoerd. |
| Volledige Playwright-suite | 273/273 geslaagd, 0 mislukt, 0 overgeslagen, 0 retries; 8,9 minuten. |
| Echte Firestore-emulator en Security Rules | 39/39 geslaagd, 0 mislukt, 0 overgeslagen; circa 153 seconden. Geen testdouble. |
| Build, syntax en gegenereerde bestanden | Geslaagd |
| CSS | Geldig; bestaand token `--line` zonder definitie blijft gemeld, geen nieuwe CSS-wijziging |

De aanvullende browserproef begint met 36 historische transacties die bewust niet in de actieve state staan. Zij bedient de bestaande importinterface, keurt tien verschillende spaarbedragen met één matchbevestiging goed, test offline bewaren en herladen, synchroniseert opnieuw, opent een oude maand via de maandkiezer, corrigeert een historische transactie en ontvangt dezelfde uitkomst op een lege tweede client. De financiële records worden daarbij niet via IndexedDB `getAll()` geladen. Een oude lokale bron wordt afzonderlijk teruggelezen om te bewijzen dat zij niet is verwijderd.

Andere proeven controleren historische refundafhankelijkheden, oude spaarledgerregels buiten de actieve state, ontbrekende Dashboard-projecties, integriteitsfouten, expliciete globale planning, aansluitende gerichte commits, verloren conflictbevestigingen en zeven afzonderlijke onderbrekingsgrenzen van een gerichte cloudcommit. De bestaande migratie-, rollback-, quota-, identiteit-, status-, groeps- en overige financiële regressies blijven onderdeel van de volledige suites.

Financiële vergelijkingen gebeuren met dezelfde bestaande motor, met gehele eurocenten voor effecttotalen. Onder meer:

- Tien CSV-bankbronnen en tien unieke effecten: 75.000 cent sparen, originele bedragen, datums en rekeningidentiteiten behouden.
- Gedeeltelijke unitfixture met oude uitgave en oude spaarboeking: budgetimpact 14.000 cent, cumulatieve spaarstortingen na tien nieuwe boekingen 82.500 cent, doelsaldo 282.500 cent inclusief de oorspronkelijke openingsbalans van 200.000 cent; gelijk aan de volledige canonieke administratie.
- Historische uitgave/terugbetaling: beide afhankelijke maandprojecties en de cumulatieve uitkomsten exact gelijk aan de complete administratie, ook na categoriecorrectie.
- Twee offline clients met verschillende goedgekeurde uitgaven: beide effecten behouden, totaal 3.000 cent; verloren lokale ontvangstbevestiging veroorzaakt geen extra cloudrevisie of effect.

## Metingen

Meetomgeving: Windows 11 Home 10.0.26200, AMD Ryzen 5 5500U (12 logische processors), circa 7,3 GiB fysiek geheugen; Node 24.19, Playwright 1.55.0, Chromium 140.0.7339.16, Firebase CLI 15.24 en Java 21. De echte Firestore-emulator draait lokaal op `127.0.0.1:8181` met project `demo-finize-v117`. Browserproeven gebruiken één worker, lokaal HTTP en geblokkeerde productie-Firestore-verzoeken. De testklok staat voor de browserscenario's op oktober 2026.

| Scenario | Historische bankbronnen | Historische transacties in actieve state | Reads openen maand | Reads normale commit | Volledige recordqueries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Emulator, één historische batch | 36 | 0 | 33 | 39 | 0 |
| Emulator, tienmaal zoveel bronnen in dezelfde 36 maanden | 360 | 0 | 33 | 39 | 0 |

De commitmeting betreft één nieuwe uitgave, inclusief de gerichte publicatiecontrole. Beide fixtures hebben dezelfde instellingen en één historische batch; alleen de hoeveelheid oude bankbronnen groeit. De volledige historieverificatie die daarna als invariantbewijs wordt uitgevoerd valt buiten de normale commitmeting.

De transportteller rekent één read per `get` en minimaal één read per query, verder het aantal teruggegeven documenten. Dit is geen factureringsteller: aanvullende serverreads door Security Rules en indexkosten vallen er buiten. Na de ene nieuwe CSV-uitgave bevat het actieve domein twee financiële transactierecords: één bankbron en één effect. Na de tien spaarboekingen zijn dat twintig records, met tien afzonderlijke bankidentiteiten.

Een aparte emulatorfixture met 36 importbatches en tien nieuwe spaartransacties meet 68 reads bij openen en 293 bij de gezamenlijke cloudpublicatie. De praktijkbrowser met bestaande scherminstellingen meet 73 reads bij openen en 505 bij synchronisatie van de tien goedkeuringen, inclusief hun afzonderlijke operatiebewijzen en ontvangstcontrole. Dat zijn verschillende fixtures en meetgrenzen; het verschil wordt niet als onderlinge snelheidsvergelijking gepresenteerd. Deze P3-metingen bewijzen gericht laden en publiceren, geen productiekosten, browserquotagarantie of P4-driejaarsprestatieacceptatie met 5.400 bronnen.

## Herstelpunt, resterende grenzen en vervolg

Vooraf is een technische back-up gemaakt in `backups/v117-stabilisatie/before-p3-aanvulling-2026-10-10`: 263 bestanden met bytes, SHA-256, branch en uitgangscommit. Alle 263 kopieën zijn na de eindtests opnieuw gecontroleerd, zonder afwijkingen. Manifest-SHA-256: `3c47f5ecbdfd233b8aad039105502d8b30f7053438f5ab691a01f33a74f035bf`.

De reeds aanwezige 14 lokale wijzigingen/losse bestanden zijn apart tegen dit manifest gecontroleerd en worden niet in de aanvullende commit opgenomen. `app.css` blijft bytegelijk. Emulatoruitvoer is apart bewaard; het oorspronkelijke losse `firebase-debug.log` is na beëindiging van de eigen emulator hersteld. De 189 vastgelegde build-, bron-, script- en testbestanden zijn na alle tests bytegelijk aan de bevroren eindbuild. Remote `main` is opnieuw read-only gecontroleerd en blijft `a56e8659d0c20f6c35b008c08e8bb27f23c5541a`.

De bindende test- en hashgegevens worden vastgelegd in `v117-p3-aanvulling-bewijs.json`. De volledige logs blijven onder `backups/v117-stabilisatie/p3-aanvulling-final-*-3.log` aanwezig. Tussentijdse ontwikkelfouten en afgebroken eerdere volledige browserstarts tellen niet als geslaagde eindcontrole.

Tijdens ontwikkeling faalden gerichte proeven aanvankelijk door de ontbrekende Dashboard-samenvattingen en de ontbrekende duurzame cloudbasis na een historische maandontvangst; beide oorzaken zijn hersteld en de proeven zijn herhaald. Er zijn ook testfixturefouten gecorrigeerd: een niet-aangeboden jaar kiezen, een maandbudget in de verkeerde schema-v11-vorm en een grote legacy-fixture als één document aanbieden in plaats van via de bestaande generatiechunks. Twee eerdere volledige browserstarts zijn bewust onderbroken na aanvullende contractwijzigingen; alleen de complete eindrun telt als acceptatiebewijs.

Geen cacheverwijdering, cloudgeneratieopruiming, productiemigratie of productieregels-publicatie is uitgevoerd. Lokale financiële historie, oude generaties, ruwe CSV, pending operaties en herstelgegevens blijven beschermd. Een browser- of emulatorsimulatie bewijst geen productieomschakeling.

Hier wordt gestopt voor beoordeling. P4 vereist afzonderlijke goedkeuring van dit verslag.
