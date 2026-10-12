# V117 — gerichte releasecheck van de bestaande administratie

**Latere gebruikersbeslissing op 12 oktober:** CSV-verwijdering is expliciet goedgekeurd en gecontroleerd afgerond. De gebruiker heeft clientpublicatie met bestaande cloudsynchronisatie toegestaan en de nieuwe productie-recordopslag en overige vervolgpunten uitgesteld. Zie het [actuele reset- en publicatieverslag](v117-csv-reset-en-compatibele-publicatie.md). Onderstaand verslag bewaart de toestand en beperkingen op het oorspronkelijke beoordelingsmoment.

Controleverslag van 12 oktober 2026, gereed voor beoordeling. De bestaande administratie is veilig gemigreerd en hersteld in aparte demo-kopieën, na de hieronder beschreven salarisvoorbereiding. Dit is geen algemene productie-vrijgave. Geen productie-omschakeling, financiële productiewrites, deployment, push of merge. De gebruiker bevestigde dat alle apparaten waren gesynchroniseerd.

Kandidaat **117-p4r4c**, app-SHA-256 `0840650614444b727d603f273838085b8e91cb5d2912db1dcdfbe8d593885713`. De runtime en tests zijn vóór de volledige regressie met 230 controlesommen vastgezet. Deze kandidaat volgt op de eerder beoordeelde `117-p4r4b`; bewijs van die build blijft afzonderlijk bewaard.

## Productieback-up en herstel

De volledige Firestore-database is uitsluitend gelezen op serverleestijdstip **2026-10-12 08:32:53.210808 UTC**: **1.418 documenten in 228 collecties**, inclusief alle onderliggende collecties en historische generaties. Alle originele Firestore-veldtypen, documentpaden en systeemmetadata staan in de ruwe REST-export. De snapshot is geen beheerde Google Cloud-export.

Alle 1.418 documenten zijn in een lege lokale demo-emulator hersteld en ieder document is exact teruggelezen op veldinhoud. Firestore maakt bij herstel nieuwe systeem-create/update-tijden; de oorspronkelijke systeemmetadata blijven in de back-up staan. De financiële velden zijn gelijk gebleven.

Daarnaast zijn beide standaard Firebase Auth-accounts, configuratie en wachtwoordhash-instellingen, providerconfiguratie, werkelijk gepubliceerde Firestore-regels, indexconfiguratie en zeven actuele V116-sitebestanden bewaard. Beide accounts zijn in een aparte Auth-emulator geïmporteerd en gecontroleerd op UID, e-mail, providerkoppelingen en aanwezige wachtwoordhash/zout. Er is geen echte wachtwoord- of Google-login uitgevoerd. Multi-tenantconfiguratie is leeg en geen Finize-account heeft een tenant-ID; de tenant-list-API is op dit Firebase Auth-project niet beschikbaar. Dat is als beperking vastgelegd. Cloud Storage bevat geen buckets; de twee spaardoelen hebben geen ontbrekende lokale afbeeldingsverwijzingen.

De verzegelde back-up bevat 262.826.565 bytes aan bestanden. Een tweede ZIP-kopie is uitgepakt en alle 24 bestandscontrolesommen zijn gecontroleerd. Locaties:

- `backups/v117-releasecheck-20261012/snapshot-02/`
- `C:\Users\dionv\.codex\backups\finize-v117-production-20261012.zip`
- `C:\Users\dionv\.codex\backups\finize-v117-production-20261012-verified\snapshot-02\`

Bewijs: `raw-restore-proof.json`, `auth-restore-proof.json`, `snapshot-02/final-backup-manifest.json` en `second-backup-proof.json`. De back-up bevat persoonlijke financiële gegevens en accountmateriaal en blijft buiten Git.

## Bestaande administratie en salarisregel

De cloudadministratie bevat 371 opgeslagen transactieregels en 20 importrecords: tien actieve imports en tien verwijderbewijzen. Eén actieve import bevat de oorspronkelijke CSV-bestandsbytes; negen oudere actieve imports bevatten wel hun opgeslagen oorspronkelijke bankregels, maar geen volledig oorspronkelijk CSV-bestand. De back-up behoudt alles wat werkelijk in de cloud staat; ontbrekende bestanden worden niet gereconstrueerd of als aanwezig opgevoerd.

De daadwerkelijke V116-runtime is met deze snapshot geopend en volledig afgesloten. De daaropvolgende V117-start behield alle oorspronkelijke transacties, imports, financiële historie, budget-/salarisinstellingen en alle 13 dimensies in eurocenten. Vijf oude CSV-salarisbetalingen konden noch uit de opgeslagen bestemming/inkomstenbron, noch uit eerdere goedkeuringen met dezelfde werkgever- en ontvangstrekening betrouwbaar aan Dion of Dara worden gekoppeld. Daardoor blokkeerde de oorspronkelijke kandidaat de prognose veilig.

Op uitdrukkelijke instructie van de gebruiker zijn die vijf regels **in de testkopie** via de bestaande atomaire heropenroute teruggezet naar **Nakijken**. Bankbron, CSV-regel en financiële verwerking krijgen dezelfde status; eerdere goedkeuringen blijven bewijs. De bankbrongegevens blijven ongewijzigd. De salarisprognose gebruikt vervolgens de bestaande ingestelde salarissen, totdat de werkelijke betalingen opnieuw worden goedgekeurd. Er is geen persoon geraden en gepland salaris wordt niet als goedgekeurde bankontvangst geboekt.

De vijf heropeningen trekken samen 1.070.268 cent aan eerder goedgekeurde salarisverwerking terug. Alleen de drie bijbehorende dimensies `accountCashflow`, `externalHouseholdCashflow` en `incomeImpact` veranderen met dit bedrag volgens de bestaande motor. Het oorspronkelijke banktotaal en alle overige dimensies blijven gelijk. Budgetten, vaste lasten, spaardoelen en hun historie blijven behouden.

Daarna is de voorbereide bestaande administratie in een afzonderlijk demo-huishouden gemigreerd. Een procesonderbreking na duurzame bescherming is in een nieuw proces hervat. De volledige stand en alle twintig imports zijn exact teruggelezen; alle 371 oorspronkelijke transactieregels blijven aanwezig. De bestaande legacy-bron blijft beschermd. Deze geslaagde proef vereist de expliciete salarisvoorbereiding vóór de daadwerkelijke omschakeling.

## Beperkte opslag, nieuwe boeking en onafhankelijk herstel

De V116-kopie is in een echt persistent Chromium-profiel gestart met **128 KiB vrije browseropslag**. Een native `QuotaExceededError` blokkeerde de V117-migratie; de oorspronkelijke V116-opslag bleef bytegelijk aanwezig. Na procesafsluiting is uitsluitend ongeveer 12 MiB synthetische testvulling vrijgemaakt. Het quotum is niet verhoogd. Een nieuwe V117-start hervatte veilig met alle oorspronkelijke imports en transacties.

Na de demo-omschakeling is offline een nieuwe synthetische uitgave van **€12,34** gemaakt. Volledig afsluiten en offline herstarten van de PWA behield die boeking. Online synchronisatie en herhaling verwerkten haar exact eenmaal. Het actuele volledige herstelpakket bevat ook alle nieuwe operaties, receipts en oude beschermde bronnen; terugzetten van alleen V116 is niet gebruikt.

Dat pakket is onafhankelijk in een tweede demo-huishouden hersteld. **3.267 documenten** zijn exact teruggelezen, met alle twintig imports, vijf operatiebewijzen en vier receipts. Alle **dertien financiële dimensies**, cumulatief en voor juni tot en met oktober, zijn gelijk gebleven. De enige extra financiële mutatie is de nieuwe uitgave: cashflow −1.234 cent, werkelijke uitgaven en budgetimpact +1.234 cent. Herhaald afspelen van bevestigde operaties levert geen nieuwe effecten op.

De herstelde kopie is bovendien in de browser geopend en offline herladen. De nieuwe boeking blijft exact eenmaal aanwezig; de vijf salarisregels blijven Nakijken zonder blokkade van de ingestelde salarisprognose. Een oude lokale client krijgt `VersionError` en een oude cloudwrite krijgt `permission-denied` onder de V117-demoregels. Dit bewijst het hek in de testomgeving; de huidige productieregels zijn nog niet omgeschakeld.

Bewijs: `salary-fallback-proof.json`, `candidate-interruption-proof.json`, `candidate-migration-proof.json`, `prepared-recovery-proof.json`, `prepared-independent-restore-proof.json` en `restored-browser-proof.json`, alle in `backups/v117-releasecheck-20261012/`. De aanvullende synthetische migratie-, quota-, onderbrekings- en conflictgevallen behoren ook tot de gewone regressie.

## Noodzakelijke veiligheidsreparaties

1. Heropenen zette eerst alleen CSV-regel/effect op Nakijken; de bankbron bleef Goedgekeurd. `reopenSourceInPlace` bewaart nu ook het bronbewijs, zet de bankbron op Nakijken en verhoogt de bronrevisie. De bestaande kandidaat-/atomaire commitroute blijft leidend.
2. De REST-recordtransportlaag liet native Firestore-timestamps weg. De oorspronkelijke productiepointer bevat zo'n timestamp. De decoder behoudt deze nu als ISO-tijdtekst, zodat de migratie-readback en bronvergelijking niet onterecht afwijken. De oorspronkelijke native veldtypen blijven daarnaast exact in de productieback-up staan.

De PWA-asset- en cachenaam is consequent bijgewerkt naar `117-p4r4c`. Dit zijn veiligheidsreparaties; er is geen prestatieoptimalisatie of conflictoplossingsinterface toegevoegd.

## Regressie en grenzen

- 624 Node-gevallen in 60 bestanden geslaagd; gegenereerde bestanden, syntax en CSS gecontroleerd.
- 42 Firestore-regelgevallen geslaagd in de geïsoleerde demo-emulator.
- Alle 306 uitvoerbare gewone browsergevallen geslaagd op dezelfde buildhash: 300 in de volledige run en zes visuele vergelijkingen na herstel van het referentiepad in de aanvullende testconfiguratie. De bestaande referentiebeelden zijn niet aangepast of opnieuw goedgekeurd. Geen functionele browserfout, skip of herhaalde financiële uitvoering is als groen weggeboekt.
- De drie afsluitende kleine schrijf-/prestatiecontroles zijn geslaagd. Een aanvullende meetcontrole voor 20 en 100 bronnen is eveneens geslaagd met werkelijke netwerkregistratie op de geïsoleerde emulatorpoort. Alle oorspronkelijke financiële assertions blijven behouden; het meetgereedschap voegt alleen controle op daadwerkelijk gemeten verzoeken toe. Er is geen optimalisatie uitgevoerd.
- De beperkte native quota, procesonderbreking, nieuwe offlineboeking, volledige onafhankelijke herstelproef, oude-clientbescherming en offline browsercontrole zijn geslaagd. Het definitieve machinebewijs is `releasecheck-final-status.json`.
- Twee kalender-/offline-verificaties op de oude 500-/5.400-fixtures blijven ontbreken doordat de oorspronkelijke omvangrijke testdatabase geen volledige bruikbare export heeft. Er is geen nieuwe 5.400-bronnenopbouw uitgevoerd.
- De volledige financiële 500-/5.400-schaalmetingen behoren uitsluitend bij `117-p4r4`, apphash `c0b6f0e93dac70a4862c2fc69318582967017739704b4c21bc31c674f8a14713`. Zij zijn geen schaalbewijs voor `117-p4r4b` of `117-p4r4c`.

## Conflicten en productieblokkades

De [minimale conflictherstelprocedure](v117-minimale-conflictherstelprocedure.md) bewaart beide keuzes en de volledige actuele administratie, inclusief nieuwe boekingen. Afzonderlijke transacties kunnen alleen na expliciete beoordeling en revisiecontrole worden samengevoegd. Twee afwijkende goedkeuringen van dezelfde banktransactie blijven veilig geblokkeerd totdat de afzonderlijk goedgekeurde beoordelingsroute beschikbaar is. Het [compacte functionele ontwerp](v117-conflictroute-functioneel-ontwerp.md) blijft een ontwerp.

Geen algemene productie-vrijgave: de productierecordsessie/migratie is nog niet ingeschakeld, de werkelijk gepubliceerde regels hebben het V117-record-/oude-clienthek nog niet, de twee grote-fixturegevallen ontbreken, negen oorspronkelijke oudere CSV-bestanden zijn niet in de cloud teruggevonden en de definitieve route voor dezelfde-bronconflicten is nog niet geïmplementeerd of voor productie goedgekeurd.

## Gecontroleerde publicatie — uitsluitend na beoordeling

1. Beoordeel dit bewijs, de exacte buildhash, de salarisvoorbereiding en de expliciete CSV-/conflictbeperkingen.
2. Laat alle apparaten opnieuw synchroniseren en stop tijdelijk nieuwe invoer. Maak dan opnieuw een volledige actuele back-up en controleer herstel; een oude snapshot mag geen nieuwe boekingen vervangen.
3. Bereid de afzonderlijk goedgekeurde productieverbinding, versie-/epochcontracten, regels en benodigde indexen voor. Controleer met productie-equivalente tests dat V116-writes worden geweigerd zodra recordopslag actief wordt. Activeer niet zolang een oude client kan overschrijven.
4. Voer de vijf beoordeelde heropeningen met bron- en goedkeuringsbewijs uit via de bestaande atomaire route, controleer de ingestelde salarisfallback, migreer naar een nieuw epoch en lees alle bronnen, imports en financiële totalen terug. Afwijking of onduidelijke ontvangst blokkeert activering.
5. Publiceer en activeer pas na afzonderlijke toestemming. Controleer op beide apparaten de juiste PWA-build, maandtotalen, CSV-goedkeuring, een nieuwe gecontroleerde boeking, herstart en synchronisatie. Bewaar oude bronnen en beide actuele back-ups.
6. Bij uitzonderlijke fouten: stop de betreffende writes en volg de conflictherstelprocedure. Zet nooit alleen de oude generatiepointer of een volledige oude administratie terug over nieuwere boekingen.

De oorspronkelijke emulator viel uit met `Java heap space` bij het opbouwen/kopiëren van waarden voor Firestore-regelbeoordeling (`ExpressionValue.toBuilder`, `DatastoreRuleContextBuilder`, `AsyncTwoPhaseRulesAuthorizer`). De oude omgeving bevatte de omvangrijke schaalfixtures en had een heapgrens van 3 GiB; ook een export mislukte daar. De logs bewijzen geheugenuitputting op die plaats, maar bewijzen geen afzonderlijke Firebase-geheugenlek. De ontbrekende volledige export van die oude testdatabase wordt niet als herstelbaar of als nieuw schaalbewijs behandeld.

Een eerste schone omgeving had voldoende Java-heap, maar slechts 128 MiB directe buffers. Die afzonderlijke OOM trad op bij 132.121.647 toegewezen bytes, een grens van 134.217.728 en een extra aanvraag van 4.194.304 bytes. Verhogen naar 512 MiB bleek op zichzelf onvoldoende: de aanvullende meetcontrole op `127.0.0.1:8482` liep later tegen 532.677.423 toegewezen directe bytes aan. De native volledige export van die tijdelijke demo liep vervolgens vast op de heapgrens van 1.536 MiB; ook de aanvullende gepagineerde export is onvolledig. Deze tijdelijke fixture-database wordt **niet volledig herstelbaar verklaard**. Foutlogs, gedeeltelijke exports en de geheugendump blijven bewaard. De volledige productieback-up en het onafhankelijke actuele huishoudherstelpakket zijn afzonderlijk aanwezig en succesvol hersteld.

De laatste controles gebruiken daarom een nieuwe schone demo op `127.0.0.1:8582`, met alleen de benodigde kleine fixtures en de bestaande-administratiekopie. De omvangrijke historische productiesnapshot en oude schaalfixtures worden niet in deze regressieomgeving hergebruikt. Java-heap is begrensd op 1.024 MiB en directe buffers op 512 MiB; de Netty-pool gebruikt twee directe en twee heap-arena's, geen kleine/normale threadcaches, kleinere poolchunks en vier eventloopthreads. Deze instellingen begrenzen de infrastructuur; de applicatie is niet aangepast. De [Netty-documentatie](https://netty.io/4.1/api/io/netty/buffer/PooledByteBufAllocator.html) beschrijft de arena-/cache-instellingen; de waargenomen stack bewijst bufferuitputting, geen afzonderlijk vastgesteld geheugenlek.

De afgebroken kleine meetcontrole en de browsercontrole van de herstelde administratie zijn in deze omgeving geslaagd zonder OOM. Het hoogste gemeten private geheugengebruik tijdens deze controles was 660.221.952 bytes, ongeveer 630 MiB. De volledige native export bevat **14.123.660 bytes in vier bestanden**, met controlesommen. Deze export is in een nieuw emulatorproces op `127.0.0.1:8682` ingelezen. De actuele financiële stand, imports en oorspronkelijke herstelbewijzen zijn opnieuw gecontroleerd: 3.266 documenten zijn exact gelijk; de head bevat de afzonderlijk bewezen, bevestigde browsersynchronisatie van revisie 5 naar 6 bij ongewijzigde financiële hashes. De eerste aanvullende vergelijking gebruikte nog de head van vóór die browsersynchronisatie; die mislukte vergelijking blijft bewaard. De bevestigde operatie en alle oorspronkelijke operaties/receipts zijn vervolgens expliciet gecontroleerd.

Bewijs: `bounded-export-status.json`, `bounded-native-import-proof.json`, `meter-bounded-results.json`, `bounded-memory-monitor.ndjson` en de afzonderlijke proces-/stopbewijzen. Alle eigen testservers zijn na de controles gestopt; geen van hun poorten luistert nog. Oudere logs en eerder geslaagde exports blijven beschikbaar in [het vorige veiligheidsverslag](v117-laatste-veiligheidscontroles.md).

De laatste bestandscontrole bevestigt dezelfde apphash en **alle 230 vastgelegde runtime-/testcontrolesommen**. Alle 24 productieback-upbestanden zijn in beide kopieën opnieuw gehasht, evenals de tweede ZIP en de vier bestanden van de demo-export. De zes oorspronkelijke beeldreferentiefouten, afgebroken emulatorcontrole en eerdere testharnasafwijzingen blijven zichtbaar; zij zijn niet uit de bewijsgeschiedenis verwijderd.

Geen productie-Firestore-write, deployment, push, merge of slaapopdracht is uitgevoerd.
