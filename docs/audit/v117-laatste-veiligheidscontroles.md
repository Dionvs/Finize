# V117 — laatste veiligheids- en vrijgavecontroles

**Later vervolg op dezelfde dag:** de [gerichte releasecheck met productieback-up en de bestaande administratie](v117-gerichte-releasecheck.md) is nu leidend. Die controle gebruikt kandidaat `117-p4r4c` na twee noodzakelijke veiligheidsreparaties en de uitdrukkelijk gevraagde salarisvoorbereiding. Onderstaand verslag blijft het bewijs van de voorafgaande ongewijzigde `117-p4r4b`-ronde; de productieback-up is later afzonderlijk door de gebruiker geautoriseerd.

Peildatum: 12 oktober 2026. Werkbranch: `agent/v117-stabilisatie`.

Dit is het actuele vervolg op het [P1–P4-verslag](v117-vrijgaveverslag.md). De oorspronkelijke verslagen, mislukte pogingen en schaalmetingen blijven historisch bewijs. Prestatieoptimalisatie is gestopt. Geen productie-Firestore, deployment, push of merge; geen slaapstandopdracht.

**Vrijgavebesluit: stoppen voor beoordeling; productie blijft geblokkeerd.** Alle uitvoerbare controles zijn groen: 622 Node, 42 Rules, 306 gewone browsergevallen, drie afsluitende controles en de onafhankelijke gefaseerde migratie/herstelproef. Twee vereiste browsergevallen op de oorspronkelijke schaalhistorie blijven ontbreken. Het definitieve conflictontwerp is gereed; de interface is volgens opdracht niet geïmplementeerd.

## Build en afbakening

De applicatie is tijdens deze controles niet gewijzigd of opnieuw gebouwd. Definitieve build: **117-p4r4b**. Testaanpassingen betreffen uitsluitend lokale emulatoradressen, browserverkeer en aanvullende bewijsregistratie; financiële assertions zijn behouden.

| Bestand | SHA-256 |
| --- | --- |
| app.js | `98c4a068bc31b93301b05a423eb6e1fd2041bc17d67ae959b29fb88e1891d4e9` |
| app.css | `df32bfc4b70dddacfe41271c7247c18347bbcedd0b865169d2d7d6f413166962` |
| index.html | `b2e69945d5b1c16d6ee38a86d1cf9f12fe586900b833e9e8adb87da0c4d92045` |
| service-worker.js | `6e7f04be0804efefa58adb7168a5412eab22aef147b9ebc10ec46616b5329bbf` |
| firestore.rules | `4af7169306fc619ea216301ea333adae47a9f687551bbdaf1c171d0e05eda73e` |
| firestore.indexes.json | `6ea08f0dbb54e3b96223a73d969431fb7bd8ee338988f88e13877203951a3fe3` |

Alle bewijsbestanden van deze ronde staan in `backups/v117-safety-20261011/`. `regression-manifest.json` legt 230 bron-, script-, test- en buildbestanden vast; de eindcontrole vindt nul wijzigingen. Ook de lokaal geserveerde assets hebben exact dezelfde hashes (`build-and-evidence-check.json`). De eerdere 443 bewijsbestanden, samen 264.799.475 bytes, zijn afzonderlijk behouden en van SHA-256 voorzien in `prior-evidence/` en `prior-evidence-manifest.json`; eerdere rapporten en gewijzigde testhulpen zijn eveneens gekopieerd vóór aanpassing.

De [machineleesbare eindstatus](../../backups/v117-safety-20261011/release-checks-status.json) controleert de uitslagen, bevroren bestanden, archiefchecksums, beide volledige exports en ongewijzigde financiële assertions van de meetkopie. `allRequiredBrowserCasesPassed:false` houdt de twee ontbrekende gevallen expliciet zichtbaar.

## Teststatus

| Controle | Uitslag |
| --- | --- |
| Node-regressie | **622 geslaagd**, 60 testbestanden; definitieve hash |
| Firestore Security Rules | **42 geslaagd**, opnieuw op de schone emulator; nul skips, 126 seconden |
| Syntax, CSS, gegenereerde buildcontrole | **Geslaagd**; `build --check`, geen rebuild |
| Aanvullende resterende browserreeks | **28/28 geslaagd**; omvat oorspronkelijk infrastructuurgeval en 22 van de 24 eerder ontbrekende gevallen |
| Volledige beschikbare browserreeks | **306/306 geslaagd**, 18,9 minuten, nul skips/retries; twee expliciet ontbrekende schaalhuishoudencontroles |
| Drie afsluitende schrijf-/prestatiecontroles | **3/3 geslaagd**, 4,2 minuten; gerichte herhaling met gecorrigeerde netwerkmeetadapter **1/1 geslaagd**, 1,6 minuten |
| Onafhankelijke migratie/herstelproef | **Geslaagd in gekoppelde fasen**, inclusief native export/import, 4.065 exacte documenten, browserherstart en oude-clientweigering |

De 28 aanvullende gevallen overlappen deels met eerdere successen en tellen niet als 28 extra unieke regressiegevallen. De vereiste gewone browserset bevat 308 gevallen. Zeven afzonderlijke benchmarkgevallen worden niet daarin meegeteld: twee grote schaalproeven, drie afsluitende kleine controles en twee verouderde P4.2/P4.3-metingen.

De eerste brede herhaling stopte na 276 successen op een synchronisatietime-out in de salaristest; 29 gevallen werden toen niet uitgevoerd. Tegelijk werd een nieuwe directe-geheugen-OOM in de emulator vastgesteld. Deze run blijft als mislukt bewaard in `browser.json` en `browser.log`; hij wordt niet als groene volledige run gepresenteerd.

De drie afsluitende controles voeren de bestaande `after`-tak uit, inclusief echte offline wijzigingen, herstart, tweede client, abort/rollback en verloren bevestiging. Twintig herbewerkingen behouden oorspronkelijke bron en financiële totalen. Native ingediende UTF-8-payloads: eerste edit **150.553 / 153.992 bytes** bij 20 / 100 bronnen; volgende edits **43.594–45.874 / 46.252–48.532 bytes**. De bestaande grens voor extra historie en de reductieasserties slagen. Dit zijn ingediende bytes, niet de fysieke browserquota. Bewijs: `writes-final.json`, `writes-final.log` en de afzonderlijk behouden nieuwe `p4-repeated-edits-after.json`.

De oorspronkelijke netwerkmeetadapter herkende alleen poort 8181. Na omleiding naar de geïsoleerde emulator registreerde hij nul fetches. Die nulwaarden bewijzen geen afwezig netwerkverkeer. De oorspronkelijke kleine meting blijft bewaard; uitsluitend een kopie van de meetadapter en het testgeval is in de bewijsmap aangepast aan de werkelijke demo-poort, met extra assertions dat beide synchronisatiefasen werkelijk fetches meten. De financiële assertions en de bevroren applicatie-/testbestanden blijven intact. De kleine meting is daarom éénmaal gericht herhaald en geslaagd; geen applicatieoptimalisatie of schaalbenchmark. Betrouwbaar netwerkbewijs staat in `meter-validation-results.json` en `p44-performance-corrected-meter.json`.

| Kleine laatste-buildmeting | 20 bronnen | 100 bronnen |
| --- | ---: | ---: |
| Tien spaarboekingen, laatste duurzame lokale commit | 1,708 s | 3,988 s |
| Synchroniseren tien herbewerkingen, totale duur | 3,914 s | 8,577 s |
| Getelde fetches daarbij | 357 | 680 |
| Synchroniseren spaarboekingen, totale duur | 4,982 s | 7,010 s |
| Getelde fetches daarbij | 450 | 462 |

Dit zijn kleine synthetische metingen op deze pc; geen nieuwe schaalclaim of productiesnelheidsbelofte. CPU-spans zijn genest en asynchrone wachttijden overlappen; deze tijden mogen niet worden opgeteld. De eerdere schaalmetingen blijven afzonderlijk.

### Twee resterende controles met bestaande schaalhistorie

1. `P4 release: existing 500 and 5400 histories use bounded verified windows on final build`.
2. `P4.4 release: completed 500-source household survives real offline PWA restart and repeated synchronization`.

Deze vereisen de bestaande oorspronkelijke schaalhuishoudens. De oude emulator kon geen volledige export leveren; de read-only reddingspogingen bevatten slechts metadata en zijn expliciet onvolledig (`existing-export-status.json`, `existing-known-export-status.json`). Er is geen grond om de oude financiële testdatabase herstelbaar te noemen. Bij hervatting was het oorspronkelijke Java-proces niet meer aanwezig; deze werkzaamheden hebben dat proces niet beëindigd. De schone emulator heeft die historie niet. De gevallen zijn zichtbaar uitgesloten, niet geslaagd verklaard. Geen nieuwe 5.400-opbouw uitgevoerd. Voor een werkelijk volledige 308/308-vrijgave blijven deze twee controles nodig zodra een volledige bruikbare testexport beschikbaar is, of na een afzonderlijk beoordeelde wijziging van de testaanpak.

De kleine kalender-/offlinegevallen slagen op de definitieve build: vier actuele kalendermaanden, expliciet gekozen oudere maanden, pins zonder verruiming van de actuele query, offline laden en herversen van kopieën. Ook de echte offline PWA-herstart voor een nieuw huishouden slaagt. Hun bewijs vervangt de twee controles op bestaande schaalhistorie niet. `browser-capacity-final.json` bevat alle 306 unieke groene gevallen, inclusief het oorspronkelijke infrastructuurgeval `P4 same bank source changed on two clients stays blocked with both approvals and proofs preserved`.

## Emulator-OOM: oorzaak, herstel en grenzen

De oorspronkelijke log bevat **`OutOfMemoryError: Java heap space`**, onder meer tijdens Rules-evaluatie in `ExpressionValue.toBuilder` / `DatastoreRuleContextBuilder` / `AsyncTwoPhaseRulesAuthorizer`. Ook de standaard volledige export liep op heapuitputting vast. Het proces gebruikte een 3 GiB heaplimiet en bevatte omvangrijke schaalhistorie naast regressiegegevens. Heapuitputting is bewezen; een specifieke emulatorgeheugenlek of exact aandeel per fixture is zonder heapdump niet bewezen.

De eerste geïsoleerde vervanger op `127.0.0.1:8282` gebruikte 1 GiB heap en een expliciete directe-geheugenlimiet van 128 MiB. Die laatste limiet was te krap: de log vermeldt **132.121.647 bytes toegewezen**, maximum **134.217.728**, en een geweigerde buffer van **4.194.304 bytes**. Dit is een tweede, afzonderlijke configuratiefout in de testomgeving. Alleen de heap verhogen zou deze directe-geheugenlimiet niet oplossen. Java documenteert beide geheugengebieden afzonderlijk via [MaxDirectMemorySize](https://docs.oracle.com/en/java/javase/21/docs/specs/man/java.html).

Na een succesvolle volledige native export van deze nieuwe database (`clean-export-status.json`, HTTP 200; acht bestanden, 65.241.780 bytes, lengtes en hashes in `clean-export-files.json`) is uitsluitend deze nieuwe emulator herstart, met 1 GiB heap en 512 MiB direct geheugen. De native export is daadwerkelijk ingelezen; alle 4.065 documenten van het herstelhuishouden zijn exact teruggelezen. De bestanden en eerdere OOM-log blijven behouden.

De brede eindregressie gebruikt daarnaast een lege zelfstandige emulator op `127.0.0.1:8382`: **1.536 MiB heap, 512 MiB direct geheugen**, demo-project `demo-finize-v117`, eigen poort/log/proces. Het project kan uitsluitend localhost-demo bereiken. De runtimeadressen en productieconfiguratie zijn niet aangepast. Kleine tests maken hun eigen huishoudens; geen 500-/5.400-schaalfixtures. Procesinformatie en geheugensamples blijven bewijs. Schone scheiding en begrensde capaciteit zijn de oplossing voor deze testronde; dit is geen onbewezen claim dat elke schaalbelasting binnen dezelfde limieten past.

De complete beschikbare regressie, herhaalde Rules-tests en afsluitende kleine controles zijn op deze configuratie geslaagd zonder nieuwe OOM. De 82 afsluitende geheugensamples tonen maximaal 1.972.359.168 private procesbytes; minimaal 364.164 KiB fysiek en 3.700.348 KiB virtueel vrij. Dit zijn processamples, geen afzonderlijke heap-/direct-bufferprofilering. Ook deze database is na de controles volledig geëxporteerd: HTTP 200, zeven bestanden, 42.917.265 bytes (`capacity-export-status.json`, inclusief checksums). Daarna zijn uitsluitend de eigen nieuwe testemulators en lokale testserver afgesloten. Alle exports/logs blijven behouden; de pc is niet in slaapstand gezet.

## Onafhankelijke migratie en herstel

Uitsluitend synthetische gegevens: twaalf maanden, 360 oorspronkelijke bankbronnen, 24 oorspronkelijke CSV-imports, financiële historie met uitgaven, splitsingen, terugbetalingen, sparen, onttrekkingen, interne overboekingen en vaste-last-/budgetgeschiedenis. De proef start werkelijk met het v116-asset uit commit `a56e8659d0c20f6c35b008c08e8bb27f23c5541a`, assethash `d68ece44a8e981d9433c5a148949e1ddec7d639af5047cbaa33d6573e4df6ca3`.

Native Chromium-opslag: gebruik **17.050.088 bytes**, vast quotum **17.181.160 bytes**, dus 128 KiB vrij vóór upgrade. De echte IndexedDB-transactie faalt met `QuotaExceededError`; V117 activeert niet en het oorspronkelijke localStorage blijft bytegelijk. Daarna wordt uitsluitend expliciet aangemaakte synthetische vuldata vrijgemaakt. Het quotum blijft gelijk. Browser geheel sluiten/openen en migratie hervatten levert exact de oorspronkelijke opgeslagen v116-stand en alle 24 imports terug. Een lege maandbucket die v116 alleen in het geheugen tekent, is afzonderlijk geregistreerd en wordt niet verward met de opgeslagen migratiebron.

Na cloudomschakeling en bevestiging van de migratie-outbox volgt offline een nieuwe, handmatig goedgekeurde spaarboeking van **€12,34**. Een duurzame outbox blijft aanwezig; na verbinding wordt revisie 3 bevestigd. Het complete herstelpakket bevat nu **361 bankbronnen**, imports, operations, receipts en de nieuwe boeking. De beschermde oude generatie en oorspronkelijke CSV's blijven apart behouden. `complete-recovery-package.json` en `native-recovery-documents.json` leggen alle herstelgegevens vast.

De zelfstandige herstelproef schrijft naar een ander demo-huishouden, leest alle 4.065 native documenten exact terug en hervat na de emulator-export/herstart vanuit hetzelfde ongewijzigde pakket. Het oorspronkelijke langere testproces liep op de infrastructuurstoring/time-out vast; `independent-results.json` blijft mislukt bewaard. Het gekoppelde vervolg registreert eigen uitslag en hashes in `recovery-resume-proof.json` en `recovery-resume-results.json`. Dit is een expliciete gefaseerde herstelproef, geen vervangen oude log.

De afsluitende hersteltest slaagt (**1/1**, 2,8 minuten): exacte cloudstand/imports, volledige operations/receipts, drie idempotente operatieherhalingen, oorspronkelijke CSV-hashes, alle 360 oude `bankOriginal`-objecten, de nieuwe boeking, alle dertien financiële centdimensies cumulatief en per maand, browserherstart en herhaalde sync. De oude lokale databaseversie geeft `VersionError`; de oude cloudwrite geeft `permission-denied` en de beschermde pointer blijft ongewijzigd. Ook de herstelde browser houdt hetzelfde quotum van 17.181.160 bytes; gemeten gebruik 14.803.966 bytes.

Een afzonderlijke Node-controle in `financial-oracle-proof.json` decodeert de beschermde oorspronkelijke v116-generatie en vergelijkt die met de complete nieuwe stand. **Alle 744 oorspronkelijke transactie-/effectregels en 24 imports zijn exact behouden**. Alle twaalf maanden worden gecontroleerd. De enige cumulatieve verschillen zijn rekeningkasstroom **−1.234 cent**, spaarinleg **+1.234 cent**, doelmutatie **+1.234 cent**, één extra bankbron en één extra effect. De overige tien centdimensies en de elf eerdere maanden zijn ongewijzigd. Dit controleert ook het bedrag van de nieuwe boeking onafhankelijk van enkel een vergelijking met een kopie van dezelfde herstelstand.

Dit is bewijs voor een handmatige synthetische herstelroute in een afgesloten testomgeving. De doelhuishoudpaden zijn expliciet omgezet; oorspronkelijke bewijsinhoud blijft exact. Het levert geen productieherstelinterface of productieactivering op. Een terugkeer naar uitsluitend de oude v116-kopie na nieuwe boekingen blijft verboden.

## Schaalbewijs uitsluitend van de vorige build

De volledige **500 bronnen / 3 maanden** en **5.400 bronnen / 36 maanden**, inclusief oorspronkelijke opslag-, lees-, schrijf- en snelheidsmetingen, zijn uitsluitend gemeten op **117-p4r4**, apphash `c0b6f0e93dac70a4862c2fc69318582967017739704b4c21bc31c674f8a14713`. Zie de oorspronkelijke tabellen en `prior-evidence/p44-scale-3.json` / `p44-scale-36.json`.

Die proef heeft financieel bewijs inclusief herladen, tweede client, herhaalde sync en historische projecties; de 5.400-test eindigde met de toenmalige harde snelheidsassertie nadat `financiallyVerified:true` was opgeslagen. Dit is geen volledig groen testproces. De geaccepteerde tragere verwerking wordt afzonderlijk gerapporteerd. Geen van deze zware metingen wordt aan de laatste build toegeschreven en geen schaalopbouw is herhaald.

## Productieblokkades en gecontroleerde publicatie

Productieactivering blijft geblokkeerd zolang de ontbrekende bestaande-historiecontroles en een ondersteunde conflictafhandeling ontbreken. Het [definitieve compacte functionele ontwerp](v117-conflictroute-functioneel-ontwerp.md) is opgeleverd; implementatie vereist afzonderlijke goedkeuring. Beide afwijkende goedkeuringen blijven beschermd en geen versie wordt automatisch gekozen.

Daarnaast blijven de eerder vastgelegde productievoorwaarden gelden: ondersteunde browsers buiten Chromium, echte authenticatie/rollen en huishoudscheiding, werkelijke gebruikersquota, kostenbewaking, complete consistente productie-export en geverifieerd herstel inclusief apparaat-outboxes en alle nieuwe boekingen. Emulatorbewijs vervangt deze voorwaarden niet.

Na beoordeling, uitsluitend met afzonderlijke publicatietoestemming:

1. Sluit de resterende controles en conflictroute af; leg commit, exacte assets/rules/indexhashes en groene uitslagen vast.
2. Maak een consistente volledige productie-export plus huishoud-/apparaatbewijzen. Test volledig herstel in een aparte omgeving; behoud oude generaties.
3. Publiceer compatibele regels/indexen zonder recordactivering; verifieer rollen, huishoudhek en oude-clientweigeringen.
4. Laat oude verbindingen sluiten, inventariseer offline outboxes en migreer één expliciet goedgekeurd huishouden met hervatbare checkpoints en volledige terugleescontrole.
5. Controleer twee apparaten, offline/online, nieuwe boekingen, verloren bevestiging, herstart en financiële centinvarianten. Stop bij iedere afwijking; herstel uit de volledige actuele stand.
6. Breid pas na beoordeling uit. Bewaar bewijs en oude generaties; geen automatische destructieve opruiming.

Deze ronde stopt na de controles voor beoordeling. Er is geen publicatie uitgevoerd.
