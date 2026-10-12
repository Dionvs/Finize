# Finize V117 — vrijgaveverslag P1–P4

**Actueel vervolg (12 oktober 2026):** de [gerichte releasecheck met productieback-up en bestaande administratie](v117-gerichte-releasecheck.md) is leidend voor de actuele kandidaat, testuitslagen en productieblokkades. De [voorafgaande veiligheidsronde](v117-laatste-veiligheidscontroles.md) bewaart het bewijs van `117-p4r4b`. De onderstaande stopmelding en meettabellen beschrijven de eerder beoordeelde P1–P4-ronde; de oorspronkelijke versie is ook afzonderlijk bewaard.

## Besluit en begrenzing

V117 is lokaal ontwikkeld op **agent/v117-stabilisatie**. Financiële juistheid en duurzaam herstel blijven verplicht. De twintigsecondennorm is volgens de laatste gebruikersopdracht een **prestatiestreefwaarde**, geen automatische releaseblokkade. Er zijn geen productieverbindingen, productiemigraties, regelpublicaties, deployments, pushes of merges uitgevoerd. De pc blijft aan.

**Productieactivering is nog geblokkeerd.** Twee afwijkende financiële goedkeuringen van dezelfde bankbron worden veilig bewaard en geblokkeerd, maar hebben nog geen ondersteunde gebruikersroute voor herbeoordeling. Daarnaast ontbreekt onafhankelijk integraal herstelbewijs voor een grote bestaande legacy-database met beperkte vrije ruimte en nieuwe boekingen na omschakeling. Groene regressies lossen deze voorwaarden niet op.

**Definitieve stop: de eindregressie is onvolledig door een Firestore-emulator-OOM.** Op de laatste ongewijzigde build slagen 622 Node-gevallen, 42 echte Rules-gevallen en 283 unieke browsergevallen. Eén browsergeval faalt tijdens het initialiseren van zijn testhuishouden; 24 browsergevallen en drie afsluitende schrijf-/prestatiegevallen zijn niet geprobeerd. De standaard Firebase-export mislukt eveneens door Java-heapuitputting. Dit is een aantoonbare testomgevingsfout, geen aangetoonde nieuwe financiële of IndexedDB-quotafout. Het verplichte volledige groene eindbewijs ontbreekt wel.

De runtime heeft na de oorspronkelijke volledige schaalproeven nog één kleine functionele aanpassing gekregen: kalendergebonden periodeladen en afzonderlijk verversen van offline kopieën. De bewijsherkomst van beide builds staat hieronder; oudere schaalmetingen worden niet als opnieuw uitgevoerde metingen van de laatste build gepresenteerd.

## Veiligheid en herstelpunten

Uitgangspunt is geaccepteerde P3-HEAD **1db602a0986f09e5739169f9de40c1debe95abf9**. Alle bestaande lokale wijzigingen zijn behouden; deze werkzaamheden zijn niet gecommit.

Voorafgaand volledig technisch controlepunt: **backups/v117-stabilisatie/p44-checkpoint-20261011T143715**, 344 bestanden, 71.162.940 bytes; alle kopieën met SHA-256 teruggelezen. Manifest-SHA **683dfd7a664c6fae823b1969b88804d42303255e8b530eb487832cfc4e14de71**. Het extra controlepunt vóór het kalenderbeleid staat in **p44-before-period-policy/manifest.json**. Het definitieve aflevermanifest en verschiloverzicht komen in **p44-delivery-checkpoint-proof.json** en **p44-delivery-changes.json**. Dit zijn technische broncode-/bewijsback-ups, geen gebruikersdatabase-export.

| Build | App-SHA-256 | Bewijs |
|---|---|---|
| 117-p4r4 | c0b6f0e93dac70a4862c2fc69318582967017739704b4c21bc31c674f8a14713 | Kleine voor/na-metingen, volledige 500- en 5.400-proef, 621 Node, 304 algemene browserscenario's, 42 echte Rules-tests |
| 117-p4r4b | 98c4a068bc31b93301b05a423eb6e1fd2041bc17d67ae959b29fb88e1891d4e9 | Laatste kalender-/offlinebeleid; 622 Node, 42 Rules, 283 unieke browsergevallen; eindregressie onvolledig door emulator-OOM |
| Tussenmeting 117-p4r4b | f4134e44190a76c38c4c3a58615b89460dd6c0c4ece3d9a1ea832cd23146aa82 | Ontwikkelbewijs van begrensde werksets. Tijdens deze ontwikkelreeks is de aanvullende bescherming van actuele offlinekopieën nog toegevoegd; deze reeks is geen uniforme eindbuildproef. |

Financieel schema 11, lokaal opslagcontract 1, fysieke representatie 2, IndexedDB 4 en cloudprotocol 2 zijn behouden. Serviceworker en assetqueries hebben dezelfde versie. De productie-recordfactory is standaard uitgeschakeld en de emulatoradapter accepteert uitsluitend loopback/demo-configuratie.

## Resultaat per pakket

| Pakket | Resultaat en bewijs |
|---|---|
| P1 | Eén centrale financiële motor/statusroute, directe expliciete goedkeuring, eigen bankidentiteit en operatie per groepslid, CAS/revisies, committed/rejected/uncertain en herstel zonder blind herhalen. [P1-verslag](v117-stabilisatie.md). |
| P2 | Eén leidende lokale IndexedDB-administratie na gecontroleerde omschakeling; atomaire records/imports/journal/receipt/outbox; awaited commit vóór publicatie; beschermde legacy-kopieën en huishoudscope. [P2-verslag](v117-p2-verslag.md). |
| P3 | Recordgerichte cloudopslag met epoch, versiehek, Security Rules, idempotente staged operaties, terugleesbare hashes en maand-/cumulatieve projecties. Nieuwe installatie heeft een eigen initialisatieroute. Productie blijft uit. [P3-aanvulling](v117-p3-aanvulling-verslag.md). |
| P4 | Cache/inventaris, budgetidentiteit, persoonsgebonden salarisrealisatie, overlapracebescherming, inhoudsgeadresseerde bewijsdelen en gerichte lees-/voorbereidingsverbeteringen. Volledige financiële schaalcontrole geslaagd; vrijgavevoorwaarden blijven open. [Technisch P4.4-verslag](v117-p44-groepsgoedkeuring.md). |

## Opgeloste oorzaken

**Opslaggroei en schrijfversterking.** Journal, cloudbasis, periodecontext, outbox en cache schreven overlappende complete bewijssets. De centrale fysieke representatie bewaart onveranderlijke, gehashte payloaddelen en kleine verwijzingen. Alleen gewijzigde records en noodzakelijke nieuwe bewijzen worden geschreven. Schema, financiële betekenis en atomaire commits blijven gelijk. Tien bestaande-transactiewijzigingen bij 20/100 bronnen behouden de eerder aangetoonde **95,8–98,4% payloadbesparing**; ongewijzigde fysieke roots worden niet herschreven. Beschermde oude delen worden niet automatisch vernietigd.

**Lees- en voorbereidingsversterking.** Een operatie decodeert gedeelde delen eenmaal; kleine exacte fysieke artefacten kunnen binnen één expliciete groep gecontroleerd door naar de volgende bevestigde revisie. Scope, hash, revisie, operatie en migratiebasis moeten exact aansluiten. Een abort maakt de context ongeldig. Grote state-/journalstrings worden niet overgedragen. De canonieke selector bereidt bronlookup en budgetplanning eenmaal per oproep voor; cumulatieve dimensies delen één projectieresultaat. Er is geen tweede motor, globale mutable financiële cache of samengevoegde groepscommit.

**OV/Overig.** De oude gedeeltelijke naamvergelijking koppelde €50 OV en €20 Overig verkeerd in budgetdetails; de totale administratie-uitgave verdubbelde niet. De centrale koppeling gebruikt nu stabiele budget-ID, eigenaar en historische maand. Alleen een unieke exacte legacy-naam mag zonder ID worden gelezen. Ambigue of gedeeltelijke namen worden niet gekoppeld. Bestaande gegevens worden niet automatisch herschreven. Desktop, mobiel, historische hernoeming, CSV, herladen en tweede client zijn getest.

**Salaris.** De oude route telde persoonsplanning en ontvangen salaris naast elkaar. incomeDefaultsHistory blijft de planning; een expliciet bevestigd regulier salaris vervangt de planning voor uitsluitend de gekozen persoon/maand. Dion gepland €2.500/ontvangen €2.530 plus Dara €3.200 geeft **€5.730**, geen €8.230. Dion/Dara gebruiken de bestaande persoonsidentiteiten. Herkenning vereist eerdere handmatige goedkeuringen met dezelfde werkgeversrekening en ontvangende rekening; het bedrag bepaalt de persoon niet. Onvoldoende of tegenstrijdig bewijs laat de persoon leeg. Bonus/vakantiegeld blijven apart. Geen automatische goedkeuring.

**Synchronisatie-overlap.** Een oude remote ontvangst kon tijdens asynchrone voorbereiding een nieuwere lokale goedkeuring verliezen. De ontvangst bewaakt nu de oorspronkelijke lokale commitidentiteit opnieuw vóór publicatie, ook na assetladen. Beide geautoriseerde remote ontvangsten worden geserialiseerd. Nieuwe lokale state, outbox en operatiebewijzen blijven beschermd.

**Laadbeleid.** Het eerdere beleid schoof het viermaandsvenster met iedere historische selectie mee. De laatste build gebruikt de huidige kalendermaand en drie vorige maanden als actief venster; een oudere selectie vraagt alleen die maand en bewezen afhankelijkheden. Expliciete mutatieafhankelijkheden en pending perioden blijven behouden. Offline pins worden als afzonderlijke gecontroleerde cachekopieën ververst wanneer hun revisie verouderd is, en vergroten de financiële werkset niet. Opruiming beschermt de actuele vier maanden, de geselecteerde maand en pins binnen dezelfde atomaire transactie. Jaaroverzichten gebruiken kleine geverifieerde maandprojecties; zij vereisen geen jaar aan bankrecords.

## Kleine prestatie- en schrijfmetingen

Alle tijden hieronder horen bij build 117-p4r4. Eén groepsronde per grootte, tien opeenvolgende wijzigingen; geen tien onafhankelijke startup-/groepsmetingen.

| Bronnen | Tien lokale commits vóór → na | UI vóór → na | Cloud vóór → na |
|---|---:|---:|---:|
| 20 | 1.900 → 1.697 ms | 2.177 → 2.108 ms | 5.563 → 4.688 ms |
| 100 | 4.423 → 3.702 ms | 5.334 → 4.366 ms | 6.576 → 6.720 ms |

Bij 100 bronnen daalt JSON 281.736→197.440 aanroepen, SHA 52.826→37.276 en fysieke encoderingen 9.568→2.584. Elf noodzakelijke financiële validaties blijven bestaan. Niet iedere fase wordt sneller: cloudbevestiging bij 100 bronnen is iets langzamer.

Tien wijzigingen schrijven bij 20 bronnen **549.847 bytes / 923 afgeronde writes**; bij 100 **577.208 / 964**. Ongewijzigde fysieke writes: **0**. Browseroriginramingen en logische UTF-8-payloadbytes zijn verschillende grootheden; index-/paginaoverhead en compactie zijn niet exact verklaard. Metingen per store/commit en vóór/na staan in de beschermde p44-performance-* en p44-repeated-edits-after.json-bestanden. De herhaling op de laatste build is door de emulatorblokkade niet gestart.

## Voltooide schaalproeven

| Meting | 500 bronnen / 3 maanden | 5.400 bronnen / 36 maanden |
|---|---:|---:|
| Meetgroepen | 1 | 3 |
| Eenmalige cloudinrichting + attach | 30,512 s | 508,385 s |
| Koude start mediaan / max | 8,741 / 8,741 s | 20,338 / 21,292 s |
| Warme start mediaan / max | 11,204 / 11,204 s | 22,649 / 23,230 s |
| Maandladen mediaan / max | 5,491 / 5,491 s | 14,707 / 19,917 s |
| Individuele goedkeuring incl. UI mediaan / max | 2,391 / 2,391 s | 4,350 / 5,471 s |
| Tien lokale duurzame commits mediaan / max | **16,723 / 16,723 s** | **27,469 / 27,717 s** |
| UI-resultaat mediaan / max | 17,326 / 17,326 s | 28,070 / 28,295 s |
| Daaropvolgende cloudbevestiging mediaan / max | 22,846 / 22,846 s | 46,635 / 51,378 s |
| Unieke bronnen na expliciete extra handelingen | **511** | **5.433** |
| Financiële eindcontrole | Geslaagd | Geslaagd |

Bewijs: p44-scale-3.json en p44-scale-36.json. De tien geselecteerde spaarbetalingen behouden eigen bedragen, datums, rekeningen en bronidentiteiten, krijgen tien operatiebewijzen en exact één effect per bron. Bij 500 voegen één losse en tien gezamenlijke betalingen samen €751 toe. Drie operationele rondes bij 5.400 voegen €2.253 toe. Alle relevante canonieke centdimensies en maandprojecties zijn vergeleken vóór/na herladen, herhaalde sync, tweede client, cacheopruiming en historisch laden.

De volledige 5.400-proef duurt **1.823.313 ms** inclusief inrichting en uitzonderlijke volledige historische integriteitscontrole/Node-orakel. Dat is geen normale opstarttijd. De oude test faalde pas op de afsluitende harde twintigsecondenassertie, nadat financiallyVerified:true was opgeslagen. Er is geen quota-/integriteitsfout of time-out als financiële fout aangemerkt. Het originele mislukte log blijft bewaard. De test rapporteert de norm voortaan als annotatie volgens de nieuwe opdracht; de zware proef is niet nogmaals uitgevoerd om een groene telling te maken.

Gewone geladen werksets in de oorspronkelijke meting bevatten bij 500 circa 752 transactie-/effectrecords; bij drie jaar circa 1.458, en de oudste maand 360. Geen volledige financialRecords.getAll in de gewone routes. De nieuwe kalenderroute krijgt apart bewijs op dezelfde bestaande huishoudens, zonder herimport of nieuwe historie. Een kleine gecontroleerde 20/100-vergelijking houdt exact dezelfde tien actuele bankbronnen aan en varieert alleen oude historie. Dat is de zuivere vergelijking van laadomvang; de 500/5.400-fixtures hebben verschillende maanddichtheid en financiële varianten.

## Volledige opslagverantwoording

UTF-8 JSON van opgeslagen roots en gedeelde delen, ieder fysiek deel eenmaal toegerekend. Momentopname na alle schaalcontroles; categorietoerekening kan verschuiven wanneer gedeelde roots van eigenaar veranderen.

| Categorie | 500, bytes | 5.400, bytes |
|---|---:|---:|
| Actieve financiële records | 772.711 | 1.103.272 |
| Offline bewaarde perioden | 0 | 0 |
| Open CSV-imports | 0 | 0 |
| Historische CSV-importroots | 2.762 | 8.286 |
| Synchronisatie-outbox/basis | 400 | 400 |
| Operatiebewijzen | 5.818 | 15.376 |
| Conflicten en hersteljournals, incl. behouden oude delen | 2.957.024 | 16.138.652 |
| Beschermde migratiekopieën | 3.031.636 | 10.423.017 |
| Vervangbare periodecache | 4.453.408 | 6.718.521 |
| Opslagmetadata | 190.918 | 531.212 |
| **Totaal** | **11.414.677** | **34.938.736** |

CSV-bytes die in gedeelde beschermde delen zitten worden niet nogmaals bij historische CSV-roots geteld. De volledige inventaris rapporteert ook bereikbaar volume per categorie: gedeelde overlap **4.037.106 / 5.981.076 bytes**, niet extra opgeteld. Beschermde niet-meer-bereikbare delen **2.787.940 / 15.642.214** blijven behouden. Geen beschermde gegevens verwijderd.

Totale logische ruimte begin→eind: 9.077.022→11.414.677 en 12.604.822→34.938.736 bytes. Originmeting begin→eind: 22.815.736→24.305.921 en 27.651.324→60.168.814 bytes. De testquota is steeds **384 MiB**; er is geen verhoging gedaan om een fout te verbergen. Geen nieuwe daadwerkelijke quota-/native abort tijdens normaal schaalgebruik.

**Beschermde opslag kan blijven groeien.** De zachte 64 MiB geldt uitsluitend voor vervangbare cache. Receipts, originele CSV, journal-/migratieroots en offline data zijn daardoor niet begrensd. Dit blijft een capaciteitsrisico; de huidige proef bewijst geen onbeperkt jarengebruik.

Veilige toekomstige retentie vereist een volledig terugleesbaar archief/export, complete bron-/operatieketen, financiële invarianten, herstel inclusief nieuwe boekingen en een compact idempotentiebewijs voor oude herhaalverzoeken. Controleer in dezelfde verwijdertransactie alle pending/offline/conflict-/herstelafhankelijkheden en gedeelde verwijzingen. Geen termijn alleen rechtvaardigt verwijdering. Onomkeerbare verwijdering vereist afzonderlijke toestemming.

## Regressie, bediening en herstel

Het definitieve machineleesbare overzicht staat in **p44b-final-status.json** met apphash, exacte aantallen, duur, logs en controle op bronwijzigingen tijdens de suite. De eindstand bij de infrastructuurblokkade staat hieronder.

| Laatste build: daadwerkelijk uitgevoerd | Geslaagd | Mislukt | Overgeslagen | Niet geprobeerd |
|---|---:|---:|---:|---:|
| Volledige Node-suite, 60 bestanden | 622 | 0 | 0 | 0 |
| Echte Firestore Rules, 2 bestanden | 42 | 0 | 0 | 0 |
| Algemene browsersuite, unieke gevallen | 283 | 1 infrastructuurfout | 0 | 24 |
| Afsluitende kleine schrijf-/prestatieproeven | 0 | 0 | 0 | 3 |

Syntax, CSS en gegenereerde assets slagen. Het runtime-/testmanifest bleef tijdens iedere deelrun gelijk. De algemene browserverzameling telt 308 gevallen. Zeven benchmarks zijn daar expliciet buiten gehouden: twee oorspronkelijke schaalgevallen, twee schrijfgevallen, de actuele kleine prestatieproef en twee historische P4.2/P4.3-benchmarks. De twee schaalgevallen hebben eerder bewijs op 117-p4r4; de drie actuele kleine gevallen zijn na de OOM niet gestart; de twee historische benchmarks zijn bewust niet herhaald. Niet-geprobeerde gevallen worden niet als skips of successen geteld.

De drie browserpogingen leveren 256, daarna 24, daarna 5 successen, waarbij de laatste twee eerder geslaagde gevallen herhaalt: **283 unieke successen**. Twee testcontractproblemen zijn opgelost: de oude historische viermaandsassertie en het te vroeg lezen bij opnieuw pinnen. De derde poging stopt op een echte emulatorfout vóór de conflictgoedkeuringen beginnen. Logs en alle eerdere uitslagen blijven behouden; er is geen groene procesuitslag geconstrueerd.

De eerste build heeft daadwerkelijk 621 Node-, 304 algemene browser- en 42 Rules-gevallen zonder skips doorlopen. De kleine 40- en extra verifiergate overlappen met de algemene browserreeks; zij worden niet als extra unieke tests opgeteld. De 500-proef slaagt; het originele 5.400-geval heeft uitsluitend de beschreven prestatieassertiefout. Twee verouderde P4.2/P4.3-benchmarkgevallen zijn bewust niet opnieuw uitgevoerd.

De nieuwe bedieningsproef houdt de eerste native financiële commit tegen: zichtbaar bezig, bevestigen/sluiten uitgeschakeld, modal inert, geen succesmelding en nul duurzaam goedgekeurde nieuwe bronnen. Twee extra klik-events starten geen extra bewerking. Na vrijgave volgen exact tien eigen commits, sync en identiek herlaadbewijs. De bestaande 500-administratie is daarnaast met een echte offline PWA-herstart en herhaalde sync gecontroleerd. Pending offline wijzigingen, verloren bevestiging, abort bij groepslid acht, zeven behouden successen, veilig herhalen, revisie-/epochconflict, huishouden, corrupte/ontbrekende delen en onderbroken migratie blijven gerichte regressies.

Nieuwe installatie test budgetten en vaste lasten maken/wijzigen, inkomsten, spaardoelen, eerste CSV, groepsgoedkeuring, beginsaldi/projecties, offline en tweede client zonder legacy-voorwaarde. OV/Overig en salaris hebben echte CSV/editor-, desktop-/mobiele viewport-, historische en synchronisatiecontroles. Financiële keuzes worden niet automatisch goedgekeurd.

Twee oude brede tests lazen te vroeg: vaste-lastverwijdering vóór de awaited commit en mobiele knophoogte tijdens opnieuw tekenen. Zij wachten nu op de bestaande duurzame/zichtbare uitkomst met dezelfde inhoudelijke assertions. De offline-pinproef wacht zowel bij de eerste als bij de herhaalde pinactie op de afgeronde native opslagactie, die pas na gecontroleerd historisch laden begint. Eerdere mislukte ontwikkellogs blijven bewaard.

De eindregressie op 117-p4r4b stopte na 256 successen bij een oude P3-assertie die vier historische maanden eiste. De app leverde één maand, conform het nieuwe contract. Alleen die twee scope-assertions zijn aangepast naar één maand; de historische financiële correctie, synchronisatie, offline herstart, tweede client en controle op nul volledige financiële getAll-reads blijven verplicht en slagen bij hervatten. De eerste run en manifesten blijven bewaard. Na de herhaalde pinactie is ook de cacheproef volledig geslaagd. De drie partities dekken 283 unieke gevallen; de overige 25 eindgevallen zijn door de infrastructuurfout nog niet geslaagd.

Een eerste kleine laadfixture maakte onbedoeld één importbatch per transactie en veranderde daarmee ook globale importmetadata. De definitieve vergelijking gebruikt dezelfde twee batches en financiële instellingen bij beide groottes, dezelfde tien actuele bronnen en uitsluitend extra historische bankregels. De oorspronkelijke mislukte vergelijkingslog blijft beschermd; er is geen productiegegeven aangepast.

Meetomgeving: Windows 11 Home 26200, Ryzen 5 5500U/12 logische processors, circa 7,34 GiB RAM, Node 24.19, Playwright 1.55/Chromium 140, Firebase CLI 15.24/Firestore-emulator 1.21, Java 21/Xmx3g, één browserworker, loopback 4173/8181, uitsluitend demo-finize-v117. Geen betrouwbare geheugenpiek, productie-internetlatentie/facturatie, Safari/Firefox of echt mobiel OS gemeten. De oorspronkelijke eis van tien onafhankelijke prestatieronden is niet volledig uitgevoerd; aantallen staan per meting.

De nieuwe bedieningsproef, de aanvullende offline PWA-proef met 500 bronnen en de volledige nieuwe-installatieroute slagen op 117-p4r4. Hun herhaling op de eindbuild is niet bereikt. De gerichte kalendervergelijking slaagde in de ontwikkelreeks; de aangescherpte eindbuildproeven voor beide schaalhuishoudens en actuele offlinekopieën zijn evenmin bereikt. Deze bewijsniveaus mogen niet worden samengevoegd tot één groene eindrun.

## Emulatorfout en veilig stopmoment

De emulator meldt `java.lang.OutOfMemoryError: Java heap space` in de Rules-contextopbouw, vóór afwijkende financiële goedkeuringen worden uitgevoerd. De bestaande schaalhuishoudens blijven leesbaar. De standaard `emulators:export` faalt vervolgens eveneens door heapuitputting tijdens het verzamelen van de exportgegevens. Er is geen bruikbare volledige database-export gemaakt. Zes metadata-documenten van beide schaalhuishoudens zijn afzonderlijk met HTTP 200 teruggelezen en gehasht in `p44b-last-emulator-metadata.json`; dat is aanvullend bewijs, geen volledige financiële back-up.

Beschikbare OOM- en exportlogs zijn beschermd. Het afsluitsignaal voor het emulatorproces is door de automatische toolgoedkeuring geweigerd omdat toestemming vereist is. Het proces is blijven staan; de weigering is niet omzeild. Het actieve `firebase-debug.log` is vergrendeld en daarom expliciet uitgezonderd van de definitieve actuele bronkopie. De vooraf bestaande versie blijft in het oorspronkelijke controlepunt en in `preserved-before-run` behouden; de leesbare OOM-logkopieën zitten bij het eindbewijs. De pc is niet in slaapstand gezet.

## Releaseblokkades versus later werk

| Soort | Voorwaarde |
|---|---|
| **Verificatieblokkade vóór vrijgave** | Firestore-emulator raakt na de langdurige testreeks door de 3 GiB Java-heap; initialisatie en standaardexport falen. Eerst een geschikte, geïsoleerde testomgeving herstellen en de 24 resterende browsergevallen, het mislukte geval en drie kleine schrijf-/prestatiegevallen afronden op dezelfde appbuild. Geen drempelverhoging, wissen van gegevens of geslaagde simulatie als vervanging. |
| **Releaseblokkade vóór recordactivering** | Ondersteunde veilige conflictoplossing voor afwijkende goedkeuringen van dezelfde bron, of een afzonderlijk goedgekeurde en geteste bruikbare herstelprocedure. Geen force-overwrite, JSON-handbewerking of reset als oplossing. |
| **Releaseblokkade vóór migratie/activering** | Onafhankelijke grote legacy-migratie-/herstelproef met beperkte vrije ruimte, interruption, alle bronbestanden en nieuwe boekingen na cutover. Lege emulatorinitialisatie is geen vervanging. |
| **Per-huishouden blokkade** | Onopgeloste oude salarisbetalingen zonder bewezen persoonskoppeling, ontbrekend/corrupt bewijs, onzekere commits, conflicten of onvoldoende migratieruimte. |
| **Vereiste productievoorbereiding** | Afzonderlijke toestemming, echte back-ups/restorebewijs, auth/huishoudrollen, regels/indexen, v116-writehek, epoch, gecontroleerde eerste activering en monitoring. |
| **Na V117 optimaliseren** | Trage startup/cloudsync, veel technische reads/vergelijkingen, driejaarsgroep boven twintig seconden, architectuurvereenvoudiging en veilig retentieontwerp. Geen verdere micro-optimalisatieronde in deze oplevering. |

Geen omvangrijke conflictinterface geïmplementeerd zonder de eerder vereiste afzonderlijke goedkeuring. Het [productie-releaseplan](v117-productie-releaseplan.md) beschrijft een concrete beperkte workflow: beide keuzes en financiële gevolgen zichtbaar, herbeoordelen via dezelfde motor tegen actuele revisie, nieuw operatiebewijs met verwijzingen naar beide originelen, succes pas na duurzame commit, herstart/ack/CAS getest. Dit voorstel is nog geen werkende of goedgekeurde herstelroute.

## Gewijzigde onderdelen en productieplan

P4.4 wijzigt centraal payloadvoorbereiding, importgroepdoorgifte, budgetlookup, canonieke projectiehergebruik en cumulatieve voorbereiding. De laatste kleine wijziging betreft record-sync/period-cache; er zijn geen nieuwe financiële velden, objectstores, cloudrecordtypes of tweede transactiemotor toegevoegd. P4 als geheel omvat ook salaris-/budgetidentiteit, opslaginventaris, import/migratie, racebescherming en beperkte Data & back-up-bediening. De exacte bestanden en SHA-256-verschillen tegen het technische controlepunt staan in p44-delivery-changes.json.

Interfaces: createPayloadPreparation(binding, previous), advancePayloadPreparation(preparation, head, operationId), requestedPeriodWindow(month, currentMonth), planCacheEviction(..., currentMonth), bestaande loadPeriod/commit/sync/verifyIntegrity, cache usage/pin/evict. Hergebruik vereist aantoonbare duurzame basis; bij onvoldoende bewijs volledige gecontroleerde voorbereiding of afwijzing.

Het [afzonderlijke productieplan](v117-productie-releaseplan.md) behandelt back-ups, compatibele regels/indexen vóór cutover, oude tabbladen/clients, versie/epoch, hervatbare kopieer- en volledige readbackstappen, expliciete headomschakeling, twee-apparatencontrole, onderbrekingen en rollback die alle nieuwe boekingen behoudt. Het plan is **niet uitgevoerd**. Deze oplevering is een controlepunt voor beoordeling, geen verklaring van productiegeschiktheid.

