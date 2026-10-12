# Finize V117 — voorstel voor productie, niet uitgevoerd

**Actualisatie 12 oktober:** de gebruiker heeft inmiddels CSV-reset en clientpublicatie met bestaande cloudsynchronisatie toegestaan. De gecontroleerde reset en de beperkte publicatiereikwijdte staan in het [actuele verslag](v117-csv-reset-en-compatibele-publicatie.md). Onderstaande blokkades en migratiestappen blijven gelden voor activering van de nieuwe productie-recordopslag; deze wordt niet door de clientpublicatie geactiveerd.

Dit draaiboek is een voorstel. Financiële productiewrites, publicatie van regels en indexen, migratie, activering, deployment en merge naar main vereisen afzonderlijke toestemming. De gebruiker heeft uitsluitend het lezen van productie voor een volledige back-up en de herstelcontrole geautoriseerd; die zijn uitgevoerd in een aparte demo-omgeving. De huidige applicatie maakt geen productie-recordsessie aan. De voorbereide transportfactory is standaard geblokkeerd.

Actuele lokale build: **117-p4r4c**, app-SHA-256 **0840650614444b727d603f273838085b8e91cb5d2912db1dcdfbe8d593885713**. De [gerichte releasecheck](v117-gerichte-releasecheck.md) is leidend; het [P1–P4-verslag](v117-vrijgaveverslag.md) behoudt de oorspronkelijke meetherkomst. De volledige financiële 500- en 5.400-proeven zijn uitsluitend op de voorafgaande build `117-p4r4` uitgevoerd. De twee bestaande schaalhuishoudencontroles blijven open wegens een ontbrekende volledige export. Verdere prestatieoptimalisatie is gestopt. Het lezen, volledig back-uppen en herstellen van de bestaande productieadministratie is apart gecontroleerd. Vijf niet betrouwbaar toewijsbare salarisbetalingen zijn volgens gebruikersinstructie in de voorbereide testkopie heropend; de prognose gebruikt de ingestelde salarissen. Een ondersteunde definitieve conflictroute en werkelijke productievoorbereiding blijven voorwaarden vóór activering.

## Blokkades vóór toestemming

De gerichte hercontrole van beide oorspronkelijke schaalhuishoudens blijft niet uitvoerbaar zonder een volledige bruikbare export. De oude exportpogingen zijn onvolledig. De oorspronkelijke database is niet herstelbaar verklaard en er is geen 5.400-opbouw herhaald.

**Actuele verificatiestand:** 624 Node-, 42 echte Rules- en 306/308 gewone browsergevallen zijn gecontroleerd op dezelfde kandidaatbuild. De browserrun had 300 functionele successen; zes beeldvergelijkingen slaagden vervolgens tegen de ongewijzigde bestaande referenties na herstel van het pad in de aanvullende testconfiguratie. Twee gevallen op bestaande schaalhistorie blijven expliciet open. De aanvullende herstel-/schrijfcontroles, exacte hashes en de productieback-up staan in het [actuele overzicht](v117-gerichte-releasecheck.md). De oorspronkelijke financiële 500-/5.400-metingen blijven afzonderlijk bewijs.

1. Verschillende financiële goedkeuringen van dezelfde bankbron hebben nog geen ondersteunde gebruikersroute voor herbeoordeling. Beide versies blijven beschermd; automatische keuze is verboden. Zie het conflictvoorstel hieronder.
2. Alle definitieve Node-, browser- en emulatortests moeten op dezelfde vastgelegde build slagen. Het P4-verslag moet meetresultaten, niet-geteste onderdelen en eventuele prestatie- of documentlimieten expliciet vermelden.
3. Zowel de onafhankelijke synthetische herstelproef als het herstel van de bestaande administratie zijn gecontroleerd. De productieback-up bevat alle 1.418 documenten; de voorbereide migratiekopie behoudt alle twintig imports. Het actuele herstelpakket is met een nieuwe boeking van €12,34 in een tweede demo hersteld: 3.267 documenten teruggelezen, alle dertien financiële dimensies gelijk en herhaling van bevestigde operaties zonder extra effecten. Maak vóór een latere daadwerkelijke omschakeling opnieuw een actuele back-up. Terugzetten van uitsluitend v116 is na nieuwe boekingen niet toegestaan.
4. Controleer browserondersteuning buiten de gemeten Chromium-omgeving, productie-authenticatie, roltoewijzing, kostenbewaking en de werkelijke huishoudquota. Emulatorbewijs geeft geen toestemming of bewijs voor een productiemigratie.
5. Voer de vijf beoordeelde salarisheropeningen vóór activering uit via de bestaande atomaire route. Volgens gebruikersinstructie blijven deze CSV-regels op Nakijken zolang geen betrouwbare persoonskoppeling is teruggevonden; de prognose gebruikt het ingestelde salaris. De testkopie heeft deze route en de volledige herstart doorlopen. Wijs geen persoon toe op bedrag of omschrijving. Bewaar `incomeDefaultsHistory`, originele bankgegevens en alle oude goedkeuringsbewijzen. Gepland salaris geldt niet als goedgekeurde bankontvangst. Een budget-ID ontbreekt alleen legacy: geen automatische gegevenswijziging op gedeeltelijke budgetnamen.
6. Beoordeel de [gerichte releasecheck](v117-gerichte-releasecheck.md) samen met het historische [opslagherstelverslag](v117-p4-opslagherstel.md). Verdere prestatieoptimalisatie is gestopt. De drie kleine schrijf-/prestatiecontroles, gewone kalender-/offlinegevallen en regressie zijn geslaagd op `117-p4r4c`; de twee controles op ontbrekende schaalfixtures blijven open. De native quota-proef blokkeerde veilig bij 128 KiB vrije ruimte en hervatte op hetzelfde quotum na het vrijmaken van uitsluitend testvulling. Geen beschermde administratie is gewist. Herhaal de volledige 5.400-bronnenopbouw uitsluitend als een noodzakelijke wijziging de reeds bewezen schaalarchitectuur raakt.
7. De vroegere P4.2/P4.3-stopresultaten blijven historisch bewijs. De actuele volledige schaalproeven zijn financieel afgerond en tonen geen nieuwe quota-/integriteitsfout. Verdere micro-optimalisatie wordt uitgesteld. Snelheid wordt afzonderlijk gerapporteerd; de twintigsecondenstreefwaarde is geen automatische releaseblokkade.
8. Bewijs de fysieke migratie met voldoende tijdelijke quota, inclusief een grote bestaande administratie. Originelen, staging en nieuwe delen blijven tijdens omschakeling gelijktijdig beschermd. Een bijna volle oude database mag niet worden gereset of onomkeerbaar opgeruimd om de upgrade mogelijk te maken; een gecontroleerde export-/herstelroute vereist eigen verificatie en eventuele afzonderlijke toestemming.

9. Bevestig vóór activering de laatste hashes en exacte eindresultaten uit het vrijgaveverslag. De oorspronkelijke P4.3-bron/effect-ID-vergelijking is hersteld en de grote proeven gebruiken een strikt bron/effectbewijs. De laatste kalenderaanpassing krijgt eigen volledige regressies en een gerichte controle op beide bestaande schaalhuishoudens; oudere meetwaarden worden niet als een nieuwe zware benchmark gepresenteerd.

## Voorbereiding zonder omschakeling

- Leg commit, SHA-256 van app.js/app.css/index/serviceworker/rules/indexen en alle testbewijzen vast. Bewaar broncodeherstelpunt en bestaande lokale wijzigingen.
- Maak na afzonderlijke toestemming een consistente volledige database-export en een huishoudexport met bankbronnen, effecten, CSV-bytes, importrevisies, ledger, planning, operatiebewijzen, outbox en conflicten. Bewaar aantallen, record- en bronhashes en de financiële resultaten per maand in centen. Test teruglezen in een afzonderlijke testomgeving.
- Publiceer pas na toestemming eerst compatibele regels en indexen, zonder activering van recordwrites. Controleer werkelijke uitrolstatus en alle rol-/huishoudweigeringen. Oude clients mogen bestaande beschermde gegevens lezen zolang dat veilig kan; zij mogen na het epochhek geen nieuwe financiële writes in het oude model accepteren.
- Laat oude tabbladen hun IndexedDB-verbinding sluiten. Een geblokkeerde upgrade moet stoppen met een begrijpelijke melding; nooit een nieuwe lege administratie als vervanging openen. Vereis een ondersteunde clientversie voordat de huishoudomschakeling begint.

## Lokale representatiemigratie vóór cloudactivering

Native databaseversie 4 gebruikt fysieke payloadrepresentatie 2; financiële lokale opslagversie 1, schema 11 en cloudprotocol 2 behouden hun betekenis. `payloadStateHash` is uitsluitend een verwijzing naar fysiek gedeeld bewijs. Financiële reads blijven de bestaande layout, recordidentiteiten en SHA-256 controleren.

1. Inventariseer per apparaat de beschikbare origin-ruimte en beschermde gegevens. Er moet ruimte zijn voor originele records, hervatbare staging en nieuwe delen. Bij onvoldoende ruimte stopt migratie; de originele administratie blijft intact. Een broncodeback-up is geen financiële gebruikersback-up.
2. Sluit oude schrijfclients. Tijdens kopiëren blijft de oorspronkelijke native inhoud leidend en accepteert de nieuwe applicatie geen financiële writes. Bewaar SHA-256, store/key, huishoudscope, aantallen en voortgang per checkpoint.
3. Lees de volledige staged inhoud terug en vergelijk exact met de oorspronkelijke records, inclusief imports, pending journals, receipts en outbox. Activeer alle roots en het fysieke versiecontract atomair. Bij quota, browserafsluiting of corruptie wordt niet gedeeltelijk omgeschakeld.
4. Na activering is uitsluitend de nieuwe IndexedDB-representatie leidend. Bewaar `representationBackup`, `representationStage`, beschermd localStorage en alle migratiebewijzen. Deze kopieën accepteren geen zelfstandige wijzigingen.
5. Controleer opnieuw financiële sommen, bronidentiteit, offline wijziging, verloren bevestiging en opnieuw starten. Geblokkeerde of onbekende versies vereisen herstel; geen lege administratie als vervanging.

Voor activering kan de oorspronkelijke representatie worden hervat vanuit de beschermde originelen. Na nieuwe boekingen mag een software-rollback uitsluitend een client met ondersteuning voor databaseversie 4 en payloadrepresentatie 2 gebruiken. Een terugkeer naar een oudere fysieke representatie vereist een nieuwe volledige export/herstel-epoch met alle nieuwe records, receipts, outboxes en conflicten, exacte terugleescontrole en afzonderlijke toestemming. Alleen de oude kopie terugzetten zou nieuwe boekingen verliezen en is verboden.

## Migratie per huishouden

1. Vereis geauthenticeerd huishouden, client minimaal 117, opslagversie 2 en een unieke migratie-epoch. Neem een expliciete omschakelbeslissing op in het vrijgavebewijs.
2. Inventariseer alle apparaten met offline wijzigingen. Laat ieder apparaat zijn duurzame outbox bevestigen of exporteer die met operatiebewijzen. Afwijkende goedkeuringen blokkeren de omschakeling tot gecontroleerde herbeoordeling.
3. Zet het huishouden achter het migratiehek. Bewaar de oude hoofdwijzer, generaties, imports en ruwe bronnen onveranderd. Kopieer stabiele records en bronhashes naar de nieuwe epoch. Iedere migratiestap is hervatbaar; herhaling gebruikt dezelfde identiteit.
4. Lees ALLE gekopieerde delen terug. Vergelijk aantal unieke bankbewegingen, effecten, CSV-rijen, splitsingen, bronhashes, settings, operatiebewijzen en financiële maand-/cumulatieve resultaten. Iedere afwijking stopt activering.
5. Publiceer de nieuwe head alleen na volledig verificatiebewijs. Test dat een v116-client en een client met verkeerde epoch of revisie daadwerkelijk door de gepubliceerde Security Rules worden geweigerd.
6. Activeer eerst één gecontroleerd huishouden. Verifieer op twee apparaten: periodeweergave, tien afzonderlijke goedkeuringen, herladen, offline wijziging, herverbinding, herhaalde sync en verlies van bevestiging. Vergelijk financiële resultaten opnieuw.
7. Breid pas uit na expliciete beoordeling van de meetwaarden en foutmeldingen. Bewaar oude generaties en migratiekopieën; geen automatische destructieve opruiming.

## Onderbreking en herstel

Bij voorbereide migratie blijft de oude laag leidend en zijn financiële writes geblokkeerd. Hervat met dezelfde epoch en broncontrole. Bij `applying` wordt geen tussentoestand als financieel eindresultaat gelezen. Hervat de operatie met dezelfde ID; verifieer de duurzame head en receipts vóór herhaling.

Na definitieve recordactivering blijft de recordadministratie leidend. Een software-rollback mag alleen een client gebruiken die dit protocol begrijpt. Eerst writes stoppen, alle nieuwe operaties en apparaat-outboxes veilig exporteren, de complete nieuwe stand in een herstel-epoch opbouwen, teruglezen en financiële invarianten vergelijken. Pas daarna mag een gecontroleerde nieuwe wijzer worden gepubliceerd. Oud v116-snapshotherstel zonder nieuwe boekingen is geen veilige rollback.

## Conflictoplossing — afzonderlijk ontwerp, niet geïmplementeerd

Het [definitieve compacte functionele ontwerp](v117-conflictroute-functioneel-ontwerp.md) beschrijft de volledige gebruikersroute en acceptatiegevallen. Beide goedkeuringen en de originele bankbron blijven beschermd; één expliciete herbeoordeling gebruikt de bestaande motor, actuele revisie en nieuwe bewijsverwijzingen. Implementatie vereist afzonderlijke goedkeuring. Tot een ondersteunde, geteste route beschikbaar is, blijft productie-recordactivering geblokkeerd.

## Retentievoorstel — geen beschermde gegevens verwijderd

Vervangbare periodekopieën mogen automatisch binnen de zachte 64 MiB-richtwaarde worden opgeruimd na de atomaire controles. Offline pins vallen buiten deze richtwaarde. Cacheopruiming verwijdert geen canonieke records, imports, receipts, conflicten of journals.

Historische CSV-bytes, financiële bewijsrecords en receipts groeien met gebruik. Het huidige P2/P3-contract houdt bovendien eerder lokaal geladen records en een eventueel volledig migratieherstelpunt vast. Deze beschermde opslag is niet door de 64 MiB-cachegrens begrensd. Een cachelimiet is daarom geen garantie voor begrensde totale browseropslag.

Voor een toekomstige compacte lokale archivering zijn minimaal nodig: een afzonderlijk geverifieerd cloudarchief of export met alle bronbytes, recordhashes en operatieverwijzingen; bewezen complete herstelketen; vastlegging van de laatst geverifieerde revisie; afwezigheid van outbox, conflict, open import, offline pin of herstelafhankelijkheid; en hercontrole in dezelfde IndexedDB-transactie als verwijdering. Gedeelde records blijven tot de laatste verwijzing behouden. Rekenresultaten vóór en na herstel moeten in centen identiek zijn.

Receipts kunnen pas worden vervangen door een verifieerbaar compact idempotentiebewijs dat ook oude herhaalverzoeken en verloren bevestigingen afhandelt. Conflicten blijven tot expliciete oplossing én aantoonbare veilige archivering beschermd. CSV-bronnen moeten onveranderlijk beschikbaar blijven voor herimportcontrole en financiële verantwoording. Oude cloudgeneraties blijven tot migratie, rollback en nieuwe boekingen aantoonbaar gedekt zijn. Geen termijn alleen rechtvaardigt vernietiging. Onomkeerbare verwijdering vereist afzonderlijke toestemming.

## Limieten en kosten

### Lokale schrijfversterking en resterend bewijs

De gerichte voorproef bewees dat journals, signatures, `__finizePeriodContext`, cloudbasis, outbox en periodekopieën grote overlappende bewijssets opnieuw schreven. Bij dezelfde bestaande-transactiewijziging schreef alleen het journal vóór herstel 1,15–3,23 MB. De nieuwe native meting telt per objectstore de werkelijk ingediende payload en afgeronde writes; zij maakt interne databasepagina's en browsercompaction nog steeds niet exact meetbaar. Originramingen blijven daarom afzonderlijk gerapporteerd.

De lokale ontwikkelcode bevat inmiddels inhoudsgeadresseerde, onveranderlijke bewijsdelen met kleine verwijzingen vanuit records, journals, outbox en cache. Mutabele cumulatieve metadata krijgen eigen delen. Bescherming volgt ook alle onderliggende gedeelde delen; financiële en herstelgegevens worden niet door cacheopruiming verwijderd. De hervatbare fysieke migratie bewaart de originelen en gebruikt een afzonderlijk versiecontract. Acceptatie vereist de definitieve metingen en regressie uit het aanvullende verslag; dit is geen bewijs van een productiemigratie.

Cachekopieën met gelijke gecontroleerde inhoud worden via gedeelde delen opgeslagen; identieke roots worden niet opnieuw geschreven. De representatie moet dezelfde SHA-256-, revisie-, epoch-, huishoud- en atomaire commitgaranties blijven aantonen. Het quotum verhogen, browserinterne compaction veronderstellen of herstelgegevens wissen geldt niet als reparatie. De eindproeven gebruiken een expliciete lagere bovengrens van 384 MiB en blijven geblokkeerd na een eerder falende testfase. Accepteer uitsluitend afgerond bewijs van herstart, herhaalde synchronisatie, migratie en financiële invarianten.

Firestore heeft onder meer een documentlimiet van 1 MiB en een API-aanvraaglimiet van 10 MiB. Rules beperken documenttoegang tot 10 per enkele operatie en 20 per batch, naast de limiet per write. Zie [officiële quota](https://firebase.google.com/docs/firestore/quotas) en [atomaire writes en rules](https://firebase.google.com/docs/firestore/manage-data/transactions).

Het lokale recordprotocol splitst payloads op 180.000 UTF-8-bytes, gebruikt kleine writebatches en weigert te grote bewijsdocumenten of aanvragen. Projecties en afhankelijkheidslijsten moeten ook bij groei worden gemeten; payloadsplitsing garandeert niet dat iedere toekomstige head of projectie onbeperkt groeit. De P4-metingen rapporteren transportreads en -writes; zij omvatten geen apart gefactureerde rule-evaluatie, indexopslag of internetlatentie. Gebruik voor kostenbesluiten de [actuele Firestore-prijsdocumentatie](https://firebase.google.com/docs/firestore/pricing) en werkelijke productiequota, pas na toestemming om die omgeving te inspecteren.
