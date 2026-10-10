# Finize V117 — P3-uitvoeringsverslag

Datum: 10 oktober 2026. Branch: `agent/v117-stabilisatie`. Uitgangspunt: geaccepteerde P2-commit `33154fe38f52ce943e8ee7add5d18842c27643a1`. Lokale en remote `main` zijn opnieuw gelezen: beide staan op v116, `a56e8659d0c20f6c35b008c08e8bb27f23c5541a`.

## Status en afbakening

De recordgerichte cloudlaag, hervatbare migratie, periodequeries, gecontroleerde ontvangst op een tweede client en synchronisatie vanuit de duurzame IndexedDB-outbox zijn lokaal geïmplementeerd. De financiële motor, P1/P2-commitgaranties en bestaande schermen blijven leidend. **P3 is nog niet volledig acceptabel:** de app blijft voor schermen en commitvoorbereiding afhankelijk van de complete lokale historie. Dit is een open architectuurcriterium, ook wanneer de regressies groen zijn. P4 is niet gestart.

De nieuwe transportlaag accepteert uitsluitend `127.0.0.1` en een Firebase-project met `demo-` als prefix. De browserkoppeling werkt alleen vanuit de lokale testapplicatie en na expliciet aanmaken en aansluiten van een emulatorsessie. De bestaande productieroute schakelt niet automatisch om. Er zijn geen productiegegevens of productieregels gewijzigd, geen deployment, push of merge uitgevoerd.

**Belangrijke beperking:** periodegegevens zijn beschikbaar via de nieuwe lees-API en bewezen projecties. De bestaande interface wordt nog uit de volledige lokale P2-administratie opgebouwd. Ook de voorbereiding en volledige integriteitscontrole van een cloudcommit gebruiken voorlopig een complete canonieke administratie. Dit verslag bewijst dus de P3-cloudinfrastructuur, niet dat de volledige app al uitsluitend met gedeeltelijk geladen historie werkt. De aansluiting van alle financiële lees- en schrijfpaden op die werkwijze blijft een P3-blokkade; het cachebeleid en bewijs met 5.400 bankbewegingen horen daarna bij P4. Verwijder vooraf geen historische lokale records.

## Herstelpunt en bescherming

Vooraf is de technische kopie `backups/v117-stabilisatie/before-p3-2026-10-10` gemaakt: 246 bestanden, per bestand bytes en SHA-256, met branch, uitgangscommit en lokale Git-status. Alle 246 kopieën zijn opnieuw gecontroleerd: nul afwijkingen. SHA-256 van `backup-manifest.json`: `ffd0bea52be3a8ca6c5bfa638c06ebb716013e27308e6bb0d5e9037245d09d97`.

De reeds aanwezige lokale bestanden en niet-geïntegreerde branches blijven behouden. De bestaande statwijzigingen in `app.css`, de oude tests en de losse publicatiebewijzen zijn niet als P3-code meegenomen. `app.css` blijft bytegelijk met de beginsituatie. Het oorspronkelijke losse `firebase-debug.log` wordt na emulatorgebruik hersteld uit de eerder gehashte technische back-up `before-2026-10-09T19-12-24-546Z`; de nieuwe emulatorlog blijft afzonderlijk bewaard. De technische kopie bevat broncode en lokale bestanden; het is geen productie-Firestore-export. De eerder gevraagde slaapstand is ingetrokken en wordt niet uitgevoerd.

## Oorzaken en nieuw opslagcontract

Het generatiemodel vereiste voor cloudgebruik een volledige hoofdstate. Een maand was niet zelfstandig aantoonbaar compleet en twee verschillende offline standen konden niet veilig als één nieuwe financiële stand worden behandeld. De nieuwe opslag bewaart dezelfde schema-v11-records met stabiele identiteit; de financiële uitkomsten worden uitsluitend door de bestaande motor berekend.

| Pad binnen een huishouden | Betekenis |
| --- | --- |
| `financialStorage/current` | Opslagversie 2, minimumclient 117, onveranderlijk migratie-epoch, bronversie en migratiefase |
| `financialEpochs/{epoch}/meta/head` | Actuele revisie, publicatiefase, complete hashes, aantallen, maand- en cumulatieve bewijzen |
| `records/{id}-{part}` | Verliesloze canonieke records, importheaders, afzonderlijke importregels en oorspronkelijke CSV; stabiele IDs en onveranderlijke bronhash |
| `periods/{YYYY-MM}` | Financiële maandprojectie met expliciete recordafhankelijkheden en hashes |
| `globals/financial` | Herleidbare cumulatieve uitkomsten en actuele spaardoelen uit dezelfde administratie |
| `operations/{id}` | Onveranderlijk wijzigingscontract, basisrevisie en doelrevisie; faseovergang tot bevestigd |
| `operations/{id}/changes/{id}` | Voor- en naversie per gewijzigd document voor verificatie en herstel |
| `operations/{id}/members/{localId}` | Afzonderlijke, onveranderlijke lokale operatiebewijzen; geen groeiende ledenlijst in één document |
| `receipts/{localId}` | Koppeling aan een cloudoperatie; pas bewijs van succes nadat die operatie `committed` is |

Grote recordpayloads worden per Unicode-teken opgesplitst in delen van maximaal 180.000 UTF-8-bytes. Deze codec verandert geen bedragen, datums, bankidentiteiten of financiële regels. Verwijderde actuele effectrecords krijgen een beschermde tombstone; oorspronkelijke bronnen worden niet fysiek opgeruimd. Ook een terugkerende tombstone mag geen andere brongegevens krijgen.

## Leidende opslag per fase

| Fase | Financiële schrijver in de cloud | Bescherming |
| --- | --- | --- |
| Geen versiecontract | Bestaande generaties | Normale bestaande route blijft actief; nieuwe transportlaag heeft geen productietoegang |
| `preparing` | Alleen voorbereide migratie naar het nieuwe epoch | Oude financiële writes worden door regels geblokkeerd; oude bronnen blijven leesbaar |
| `verified` | Geen normale nieuwe financiële publicatie | Volledige terugleescontrole geslaagd; omschakeling nog niet uitgevoerd |
| `active` in emulator | Alleen recordmodel met revisiecontrole | Oud generatiemodel blijft beschermd als herstelbron; de lokale testsessie stopt de oude listener en schrijfwachtrij |

Lokaal blijft de bevestigde IndexedDB-commit de voorwaarde voor zichtbare goedkeuring. Cloudontvangst bewaart financiële records, importdetails, lokaal operatiebewijs en cloudcursor in één IndexedDB-transactie. Afwijkende lokale financiële of importwijzigingen blokkeren ontvangst. Een Promise of voorbereid cloudbewijs geldt niet als geslaagde financiële commit.

De bestaande P2-controle op de beschermde localStorage-bron is naar de centrale IndexedDB-commitgrens verplaatst. Daardoor geldt dezelfde controle voor lokale wijzigingen én P3-cloudontvangst. De browserproef laat een oudere client de beschermde kopie wijzigen en probeert daarna een nieuwere cloudstand te ontvangen: de ontvangst wordt aantoonbaar afgewezen, de eerdere IndexedDB-stand en beide gegevenskopieën blijven behouden.

## Migratie, onderbreking en rollback

`migrate` controleert de volledige oude bron: generatiepointer, generatiebeschrijving, volgorde, aantallen, SHA-256 van ieder deel en de totale state. Oude importheaders, rijchunks en oorspronkelijke CSV-delen worden via de bestaande importassembler teruggelezen. CSV-bytes en controlecode blijven behouden. Een afwijkende kandidaat of een gewijzigde importheader bij de omschakelgrens blokkeert de migratie.

Daarna wordt het oude model door de regels bevroren. Het epoch, de oude pointerhash, importheaderhash en beide inhoudshashes blijven onveranderlijk. De migratie publiceert een stabiele operatie en leest de nieuwe administratie volledig terug. State, imports, recordaantallen, maandafhankelijkheden en cumulatieve projecties moeten overeenkomen. `activate` vereist expliciete testomschakeling en herhaalt de controle.

Negen migratieonderbrekingen zijn via echte Firestore-verzoeken getest: na bronbescherming, operatievoorbereiding, wijzigingsstaging, revisievergrendeling, toepassen van records, doelcontrole, ledenbewijs, definitieve commit en geverifieerde terugleescontrole. Een nieuwe store hervat hetzelfde epoch en dezelfde operatie. Daarnaast is een echt browservenster gesloten terwijl de migratie vergrendeld was; een nieuw venster hervat de migratie met behoud van huishoudgegevens en fotobytes.

Een grotere publicatie verloopt in kleine schrijfgroepen. Zolang `head.phase` op `applying` staat, leveren periodelezers geen financiële uitkomst. Na volledige controle worden head en operatie in één Firestore-commit definitief bevestigd. Een verloren netwerk- of lokale ontvangstbevestiging veroorzaakt geen tweede financiële uitvoering.

`exportRollback` bevat de **actuele** complete state, imports, oorspronkelijke bronnen, operatiebeschrijvingen, ledenbewijzen, wijzigingshistorie en ontvangstbewijzen. De test reconstrueert daaruit het bestaande generatieformaat en controleert dat ook een nieuwe boeking ná migratie behouden blijft. Er wordt geen oude pointer teruggezet en geen versiecontract verlaagd. Een daadwerkelijk productieherstel of productierollback is niet uitgevoerd en vereist een afzonderlijk plan en toestemming.

## Synchronisatie, twee apparaten en conflicten

`sync` leest de lokale head, records, imports, outbox en operatiebewijzen uit één IndexedDB-snapshot. Lokale operatie-ID's, revisies en SHA-256 bepalen de stabiele cloudoperatie. De cloud gebruikt compare-and-swap op revisie en epoch. De lokale outbox wordt pas verwijderd na controle van de definitieve cloudbewijzen; een inmiddels nieuwere lokale bewerking blijft staan. Ook de oude importwachtrij wordt alleen voor precies de bevestigde importversie opgeruimd.

`pull` ontvangt de complete geverifieerde cloudbasis op een nieuwe client of een client zonder open lokale wijzigingen. Records, imports, ontvangstbewijs en cursor worden atomair lokaal bevestigd. Een geforceerde IndexedDB-abort tijdens het schrijven van importdetails laat zowel de oude duurzame state als het scherm intact. Een onderbroken bevestiging na een geslaagde ontvangst wordt via het operatiebewijs herkend. Een verouderde UI-basis wordt niet over een nieuwere lokale wijziging gezet.

Bij afwijkende offline standen blijven beide volledige versies en imports in het huishoudjournal bewaard. Automatisch vervangen door de externe stand is geblokkeerd. Een expliciete lokale conflictkeuze controleert beide inhoudshashes, de actuele revisie en iedere afwijkende externe goedkeuring. De benodigde goedkeurings-ID's moeten afzonderlijk als beoordeeld worden meegegeven. De keuze en beide bronversies blijven bewaard. Ook een cloudbevestigde conflictkeuze met verloren lokale ontvangstbevestiging wordt na herstart zonder herhaling afgerond.

De browserproef verwerkt tien CSV-spaartransacties met één groepsbevestiging: €50, €100, €75, €25, €200, €40, €60, €90, €30 en €80. Resultaat: tien goedgekeurde bankbronnen, tien unieke effecten, €750 sparen, originele bedragen en datums behouden. Offline opslag, herladen, synchronisatie en herhaalde synchronisatie behouden die uitkomst. Een tweede browserclient begint leeg en ontvangt dezelfde administratie via `pull`; er wordt geen voorgevulde cloudstate als bewijs gebruikt.

Spaardoelfoto's worden vanuit de huishoudstore als echte bytes overgedragen. De lokale referentie blijft lokaal behouden. Een ontbrekende foto blokkeert de overdracht met behoud van de outbox, in plaats van een lege foto naar de cloud te schrijven. Grote fotobytes blijven in de gesplitste canonieke records en worden niet herhaald in het cumulatieve financiële samenvattingsdocument. Een synthetische payload van 1,1 MB is samen met de oude generatie- en CSV-chunks in de echte emulator verliesloos gemigreerd.

## Periodeladen en financiële invarianten

`loadPeriod` leest een head, de maandprojectie, cumulatieve projectie en alleen de records die volgens de query bij de maandafhankelijkheden horen. Daarna wordt de head opnieuw gecontroleerd. Ontbrekende projecties, gewijzigde hashes, ontbrekende recorddelen of een onvoltooide publicatie leveren een fout, nooit nul als financieel resultaat.

De canonieke motor berekent per maand in eurocenten: rekeningkasstroom, externe huishoudkasstroom, inkomsten, werkelijke uitgaven, budgeteffect, vaste-lastrealisatie, sparen, opnemen, spaardoelmutatie, spaardekking, ongebruikt spaargeld, terugbetalingskasstroom en voorschotterugbetaling. Categorie-uitkomsten, inkomstenplanning, vaste lasten, zakgeld, maandafsluitingen en scenarioresultaten komen uit dezelfde bestaande functies. Cumulatieve spaardoelen en aantallen worden uit de complete canonieke basis afgeleid.

Afhankelijkheden bevatten bron/effectgroepen, financiële maanden van splitsingen en vaste lasten, terugbetalingen naar oude maanden, interne paren, spaardekking en handmatige vervangingen. Een historische wijziging herberekent de projecties; voorheen aanwezige maanden blijven in de herberekening opgenomen. Tests vergelijken de geverifieerde maanduitkomsten en cumulatieve uitkomsten met de oorspronkelijke motor. Verliesloze state- en importteruglezing geeft daarnaast een volledige inhoudsvergelijking, inclusief onbekende compatibiliteitsvelden.

Een gedeeltelijk geladen ruwe state draagt een expliciet kenmerk. De bestaande transactie-effectselector blokkeert berekeningen daarop; bankselectie vereist een geverifieerde maand. Gebruik de bewezen `financials` en `cumulative` uit `loadPeriod` voor financiële resultaten. Een gedeeltelijke raw state kan niet als complete cloudcommit worden aangeboden. Afhankelijkheden over meerdere maanden kunnen extra historische records vereisen; de queryproef bewijst geen constante leesgrens voor iedere mogelijke afhankelijkheidsketen.

## Firestore-regels en quotamodel

De echte emulatorregels controleren huishoudtoegang, opslagversie, epoch, oude-clientfencing, revisieovergangen, onveranderlijke operatieleden en bronhashes. Als positieve controle publiceert een gekoppelde client vóór migratie succesvol een geldige v116-generatie, inclusief chunks en pointer. Na de migratieblokkade wordt een opnieuw geldige v116-pointerwijziging geweigerd. De tests proberen ook writes naar generaties, importheaders en importchunks, afwijkende epochs/versies, vreemde huishoudens en vervalste headrevisies. Deze verzoeken worden geweigerd. Geen regel is naar productie gepubliceerd.

Het ontwerp houdt rekening met maximaal 1 MiB per Firestore-document, 10 MiB per aanvraag en de limieten voor regeltoegangen. De transportlaag weigert conservatief documenten boven 800.000 JSON-bytes en aanvragen boven 8.000.000 bytes; schrijfgroepen bevatten maximaal acht documenten. Alleen de drie gebruikte recordqueryvelden worden geïndexeerd. Grote payloads, auditdocumenten, afhankelijkheidslijsten en bewijsdata zijn van indexering uitgezonderd. Bronnen: [Firestore-quota](https://firebase.google.com/docs/firestore/quotas) en [regels en atomaire bewerkingen](https://firebase.google.com/docs/firestore/security/rules-conditions).

Bij 5.400 eenvoudige bronnen met één effect en één importregel per bron zijn circa 16.200 actuele recorddocumenten te verwachten, plus importheaders, CSV-delen, projecties en metadata. De initiële onveranderlijke wijzigingsbewijzen voegen ongeveer evenveel documenten toe. Daarna worden alleen veranderde documenten en hun bewijzen geschreven. De exacte aantallen hangen af van splitsingen, operaties en brongrootte. Deze schatting is geen uitgevoerde 5.400-bronnenmeting.

De commitvoorbereiding berekent nog volledige projecties en de readback controleert alle records. Daardoor zijn de **writes** gericht, maar zijn de reads en rekentijd van een commit nog niet begrensd tot alleen de gewijzigde maand. Bewijsretentie en verdere optimalisatie zijn niet stilzwijgend als opgelost beschouwd. Het bewaarbeleid en de driejaarsmetingen blijven voor het vervolg nodig.

## Tests en meetomgeving

Definitieve applicatiebuild SHA-256: `f86b649a8f79d919e112a1ecb2cc76c5fbfbe47ec54558cf16929c5e091c7574`.

Meetomgeving: Windows 11 Home x64, AMD Ryzen 5 5500U, 7.879.585.792 bytes RAM; Node 24.19.0; Playwright 1.55.0 met Chromium 140.0.7339.16; één browserworker; lokale app `127.0.0.1:4173`. Firebase CLI 15.24.0, Firestore-emulator 1.21.0, Java 21.0.12.1+1, uitsluitend `demo-finize-v117` op `127.0.0.1:8181`. De tests blokkeren productie-Firebase-verzoeken. Emulatorauthenticatie gebruikt geverifieerde testclaims; echte accountaanmelding en productiedata zijn niet getest.

| Controle | Definitieve uitslag |
| --- | --- |
| Node-suite | 55 bestanden; 581 geregistreerde testgevallen geslaagd; 0 mislukt; 0 overgeslagen |
| Volledige Playwright-suite | 270 uitgevoerd; 270 geslaagd in 7,7 minuten; 0 mislukt; 0 overgeslagen |
| Afzonderlijke echte Firestore-regeltests | 24 uitgevoerd; 24 geslaagd; 0 mislukt; 0 overgeslagen |
| Syntax, CSS, reproduceerbare build | Geslaagd; bestaande CSS-waarschuwing `--line` blijft |

De aparte periodeproef omvat 36 maanden, 108 bankbewegingen en 297 actuele recorddocumenten. Eén maand haalt zes recorddocumenten op en gebruikt elf documentreads, inclusief head- en projectiecontroles. Gemeten tijdens de definitieve regressie: migratie 4.469,3 ms, maandquery 63,4 ms; de migratie schrijft 677 documenten, inclusief ongewijzigd bewaarde operatiebewijzen en metadata. Dit is een controle van de querygrens, geen realistische driejaarsbrowserproef met 5.400 bankbewegingen. De suites draaiden deels gelijktijdig; deze tijden zijn geen geïsoleerde productiebenchmark. Regelafhankelijke serverreads en netwerk-/productiebilling worden niet met de clientteller gemeten.

De eerste gerichte Node-run had één fixturefout (`fixed is not a function`); de fixture is hersteld. Een volledige tussenrun op de uiteindelijke applicatiebuild had 269 successen en één fout in de subdoeltest: de testfixture was alleen in het geheugen gezet en kon tijdens een echte asynchrone commit terugvallen op de eerdere duurzame stand. De fixture wordt nu via `commitChange` bevestigd voordat de UI-test begint; naam, doelbedrag en aantal subdoelen worden ongewijzigd gecontroleerd. De gerichte desktop-suite slaagt met 11/11. Een daarna begonnen volledige browserrun is voortijdig onderbroken; die is volledig opnieuw uitgevoerd. Alleen de afgeronde herhaling met 270 successen geldt als definitief regressiebewijs, samen met de Node- en emulatorruns op dezelfde buildhash. De gerichte broncontractcontrole heeft aanvullend 15/15 browsercontroles voor P2-migratie en P3-synchronisatie doorlopen.

Definitieve logs: `backups/v117-stabilisatie/p3-node-geverifieerd.log`, `p3-browser-geverifieerd.log`, `p3-emulator-acceptatie.log` en de zelfstandige emulatorherhaling `p3-emulator-zelfstandig-definitief.log`. Het bewijsbestand bevat hun SHA-256-controles en de hashes van alle gewijzigde bestanden. De brede browserrun bevestigt ook opnieuw daadwerkelijke IndexedDB-opslag en herladen van een administratie van circa 18 MiB, zonder ongewijzigde archiefpayload opnieuw te schrijven.

Reproduceerbaar: `node scripts/build.mjs`, `node scripts/run-node-tests.mjs`, `node scripts/test-p3-emulator.mjs` en, met de Firestore-emulator draaiend, `node node_modules/@playwright/test/cli.js test`. Voor een reeds draaiende lokale emulator: `node scripts/test-p3-emulator.mjs --reuse`. De nieuwe browsertests slaan ontbrekend emulatorbewijs niet over. Configuratie: `firebase.emulator.json` en `firestore.indexes.json`. Zie ook [Firebase-emulatorgebruik](https://firebase.google.com/docs/emulator-suite/connect_firestore).

## Gewijzigde bestanden en interfaces

- Nieuwe opslagmodules: `src/storage/period-projections.mjs`, `cloud-record-model.mjs`, `firestore-record-transport.mjs`, `cloud-records.mjs`, `record-sync.mjs`, `record-session.mjs` en `legacy-import-readback.mjs`.
- Bestaande integratie: `src/storage/household-store.mjs`, `src/core/runtime.js`, `src/core/transaction-engine.mjs`, `src/core/bank-sources.mjs`, `src/import/runtime.js` en gegenereerde `app.js`.
- Regels en testconfiguratie: `firestore.rules`, `firestore.indexes.json`, `firebase.emulator.json`, `.gitignore` en `scripts/test-p3-emulator.mjs`.
- Tests: `tests/v117-p3.test.cjs`, `tests/emulator/v117-p3.test.cjs`, `tests/helpers/v117-p3-emulator.cjs` en `tests/browser/v117-p3.spec.cjs`. De bestaande `tests/browser/desktop-special-tabs.spec.cjs` bevestigt zijn subdoelfixture voortaan eerst duurzaam.
- Verslag en bewijs: dit bestand, `v117-p3-bewijs.json` en het P3-deel van `v117-stabilisatie.md`.

Nieuwe hoofdinterfaces: `createRecordCloudStore`, `migrate`, `activate`, `commit`, `recover`, `loadPeriod`, `loadImport`, `verifyIntegrity`, `operationReceipt`, `operationStatus`, `exportRollback`, `createRecordSync`, `sync`, `pull`, `establishBase`, `conflictApprovalReview` en `resolveConflict`. De lokale store krijgt een consistente cloudsnapshot, atomaire cloudontvangst, selectieve bevestiging en een duurzaam conflict-/keuzejournal. De lokale commitinterface houdt zijn bestaande opties en krijgt een gecontroleerde `cloudAcceptance`-optie voor ontvangst. `createHouseholdStore` krijgt de bestaande broncontrole als geïnjecteerde `verifySource`, zodat alle financiële schrijvers hetzelfde controlepunt gebruiken.

## Resterende grenzen en overdracht

De daadwerkelijke status van emulatorverificatie is positief: echte Firestore-verzoeken en echte Security Rules zijn gebruikt; een testdouble vervangt dit bewijs niet. Emulatorlatentie is geen productielatentie. De emulator bewijst evenmin echte browserquota op alle apparaten, productieschaal of productiebilling, en controleert niet alle productie-index- en transactielimieten.

Voor volledige cloud-first vrijgave blijven expliciet nodig: omschakelgoedkeuring voor productie, een productietransport en publicatieplan voor regels, aansluiting van periodeprojecties op alle scherm-/cachepaden, begrensde lokale cache, optimalisatie/metingen van complete commitreadback, bewijsretentie en de 5.400-bronnenregressie. Conflicten worden veilig geblokkeerd en via de technische review-API afgehandeld; een nieuwe productieworkflow voor uitgebreide financiële conflictbeoordeling is hiermee niet uitgebracht.

Er is geen automatische verwijdering van oude generaties, localStorage, lokale financiële historie of conflicten toegevoegd. De 64 MiB-cache en productieopruiming zijn niet uitgevoerd. P4 blijft gestopt: eerst moet de open P3-afhankelijkheid van volledige historie worden opgelost en aantoonbaar getest; daarna is gebruikersgoedkeuring van het P3-verslag vereist. De bovenstaande beperkingen mogen niet worden overgeslagen door nu al gedeeltelijke raw states te laten doorrekenen of historie te wissen.
