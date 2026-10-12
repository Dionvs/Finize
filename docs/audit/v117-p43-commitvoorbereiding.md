# V117 P4.3 — incrementele commitvoorbereiding

## Uitkomst en stopbesluit

De kleine herstel- en veiligheidsproeven slagen. De eenmalige proef met **500 bankbewegingen over drie maanden** haalt de bestaande twintigsecondennorm voor tien lokale goedkeuringen nog niet. Daarom zijn de volledige Node-/Playwright-regressies en 5.400-proef niet gestart. P4.3 levert een aantoonbare verbetering, maar P4 is niet voltooid of releasegereed.

Er is geen nieuwe quotafout, native database-abort of dubbele financiële verwerking aangetoond. De grote groep was bij de prestatiedeadline nog bezig: negen bevestigde native commits. De diagnostische wachtconditie bereikte daarna tien commits en het groepsresultaat 10/10, maar de financiële nacontrole stopte op een fout in de test zelf. Het volledige financiële eindresultaat na synchronisatie, herstart en een tweede client is daardoor **voor deze 500-proef niet bewezen**. De twintigsecondennorm is niet verhoogd en de zware proef is niet herhaald.

## Veiligheid en herleidbaarheid

- Branch: agent/v117-stabilisatie; Git-HEAD: 1db602a0986f09e5739169f9de40c1debe95abf9. Bestaande lokale wijzigingen behouden; geen commit of push.
- Voorafgaand herstelpunt: backups/v117-stabilisatie/p43-checkpoint-20261011T130049; 315 bestanden teruggelezen en gecontroleerd. SHA-256 manifest: 7bda96aa81890a98f436ee870cd7d5a7b6f5a99d16e3802a21f9104e618b41f7.
- App-SHA-256: b00f31de3214045c43f5aa35cea666f7e5e11d0b7084afcafd8ccc632dd8cfd1. Asset-/serviceworkerversie: 117-p4r3. Financieel schema 11, lokaal opslagcontract 1, fysieke representatie 2, IndexedDB-versie 4 en cloudprotocol 2 behouden.
- De vastgelegde 221 bron-, test- en configuratiebestanden zijn gedurende de Rules-/500-gate onveranderd gebleven. Na deze gate is alleen de testharness gecorrigeerd en een kleine verifierregressie toegevoegd; de app en runtime zijn identiek gebleven. Het oplevermanifest legt beide feiten afzonderlijk vast.
- Geen productieverbinding, productiemigratie, regelpublicatie, deployment, push/merge naar main of verwijdering van beschermde gebruikersgegevens. De pc blijft aan.

## Bewezen oorzaken en reparaties

1. De fysieke encoder herhaalde werk aan dezelfde bron- en effectrecords in pending journal, financiële commit, statebewijs en journalafronding. De bestaande memo eindigde bij iedere native transactie. Er is nu één expliciet doorgegeven, operatiegebonden voorbereidingscontext met onveranderlijke fysieke deelreferenties en hashes. Dit is geen financiële statecache.
2. De financiële opslagcodec kopieerde en serialiseerde onveranderde records opnieuw. De store bewaart nu uitsluitend vergelijkingsmetadata van de laatst geverifieerde duurzame basis: exacte inhoudssignaturen en periodeverwijzingen. Alleen gewijzigde records krijgen opnieuw opslagencodering, periodetoewijzing en een diff. De oorspronkelijke financiële validaties blijven volledig actief.
3. Automatische cacheopruiming las alle financiële records en hydrateerde historische journals opnieuw. De atomaire opruimroute gebruikt nu beschermde deelwortels, native beschermingsstatussen en één gerichte metarecord-read. Zij behoudt alle gedeelde en transitief beschermde delen. De historische browsertest meet nu nul volledige financialRecords-getAll-opdrachten.
4. Twee kleine bestaande bedienings-/herstelproblemen werden door bredere controles zichtbaar. Een herbouwde maandkiezer verloor zijn lopende busy-status, waardoor een klik tijdens laden genegeerd kon worden. Nieuwe knoppen nemen nu die status over. Daarnaast ontbrak cloud-offline in de foutcodes die geverifieerd offline periodeladen toestaan. De netwerkfout wordt nu in beide relevante herstelroutes herkend; een toegangsweigering blijft geblokkeerd.

De voorbereidingscontext is gebonden aan huishouden, duurzame SHA, opslagrevisie en migratiebasis. De native compare-and-swap controleert die basis opnieuw. Een scopeverschil wordt geweigerd; een niet-passende context vervalt naar de volledige codec. Een afgebroken native transactie maakt haar context ongeldig. Niet-verliesvrij JSON, waaronder undefined en bijzondere typen, krijgt geen signatuurhergebruik. Tests vergelijken volledige en voorbereide encodering bytegewijs en testen mutatie van eerder aangeboden objecten.

Het commitcontract committed/rejected/uncertain, atomaire opslag, oorspronkelijke bankgegevens, operatiebewijzen en outbox blijven behouden. Publicatie van financiële state volgt pas na native transactiebevestiging. Iedere geselecteerde bron houdt haar eigen operatie-ID en commit.

## Kleine tijdmetingen vóór en na

Dezelfde 20/100-fixtures, tien afwisselende budgetwijzigingen van dezelfde goedgekeurde bankbron, geen nieuwe imports tijdens die tien edits. De gerichte CPU-fixture bevat de bewerkte import met alle bronnen; de afzonderlijke schrijfacceptatiefixture voegt de extra historie in een andere importbatch toe. Deze twee fixtures worden niet door elkaar vergeleken.

Tijden in milliseconden. De editkolommen zijn mediaan / maximum van tien opeenvolgende wijzigingen. De groepskolommen omvatten CSV-aanmaak, gebruikersbediening en tien goedkeuringen; dat zijn afzonderlijke eenmalige groepsmetingen.

| Bankbronnen | Edit vóór | Edit na | CSV + groep vóór | CSV + groep na |
|---|---:|---:|---:|---:|
| 20 | 891 / 2.023 | 584 / 731 | 5.486 | 2.672 |
| 100 | 2.380 / 3.184 | 1.473 / 1.891 | 12.081 | 6.435 |

Voor de zesde wijziging bij 100 bronnen: SHA-aanroepen 14.054 → 9.331; fysieke encodertijd 422 → 152 ms; seedStatePayload 131 → 9 ms. Er veranderen vier logische opslagrecords; 248 worden in de store hergebruikt. Binnen de fysieke voorbereiding worden 1.789 van 2.754 recordvergelijkingen hergebruikt. De vijf bestaande codecaanroepen omvatten ook de onveranderde financiële validaties: in totaal worden nog 808 records geëncodeerd en 248 hergebruikt. De reparatie maakt de gehele financiële verwerking dus nog niet constant in werksetomvang.

Bij 100 bronnen, CSV plus tien spaarbetalingen: fysieke SHA-aanroepen 86.750 → 52.832, encodeRoot 4.288 → 1.395 ms, statebewijsvoorbereiding 542 → 81 ms, native commit-wall 3.119 → 785 ms. Het aantal fysieke root-encodeaanroepen blijft 198: er wordt minder inhoud per aanroep herhaald. Native payloadPart-gets blijven ongeveer gelijk, 6.754 → 6.741; de optimalisatie maakt geen ongecontroleerde leescache tussen transacties.

De laatste meting splitst ook rekeningnormalisatie, importrevisiecontrole, importrevisievoorbereiding, journalvoorbereiding, financiële validatie en outboxvoorbereiding. Deze afzonderlijke spans waren in de nulmeting niet allemaal aanwezig; ontbrekende nulmetingen zijn geen nulwaarden. SHA was vóór de reparatie alleen gecombineerd gemeten, na de reparatie afzonderlijk voor encodering en verificatie.

CPU-spans zijn genest. Native transactie-wall omvat overlappend encoderwerk en wachttijd. Opgetelde database-requesttijden kunnen groter zijn dan de operatieduur. HTTP-wall is geen afzonderlijke emulator-CPU-meting. Instrumentatie, browseropslagcompactie en systeemlast beïnvloeden walltijden; niet iedere gemeten versnelling kan uitsluitend aan één reparatie worden toegeschreven. De lagere aantallen hashberekeningen en hergebruikte records zijn afzonderlijk controleerbaar.

## Schrijfversterking en opslaggroei

| Tien bestaande-transactiewijzigingen | 20 bronnen | 100 bronnen |
|---|---:|---:|
| Geschreven UTF-8 payload vóór P4.3 | 549.847 | 577.208 |
| Geschreven UTF-8 payload na P4.3 | 549.847 | 577.208 |
| Aangevraagde / afgeronde writes | 923 / 923 | 964 / 964 |
| Ongewijzigde fysieke writes | 0 | 0 |
| Logische fysieke beginopslag | 1.100.615 | 3.194.097 |
| Logische fysieke eindopslag | 1.604.474 | 3.725.317 |

De eerder bewezen besparing van 95,8–98,4% tegenover de oude opslagroute blijft behouden. Extra historie schrijft geen historische transactierecords opnieuw. De 27.361 extra bytes bij 100 bronnen zitten in nieuwe payloadParts, onder meer gewijzigde afhankelijkheids-/manifestpaden; alle overige objectstores schrijven over de tien edits exact dezelfde aantallen en bytes. Dit is geen claim van exact constante metadataomvang.

Per objectstore, per commit en met operatie-ID/revisie staan alle writes in p43-repeated-edits-after.json. Alleen de doelbankbron en haar vervangen effect veranderen binnen de historische transactierecords. Nieuwe bewijsdelen, tien operatiebewijzen en outbox/journalmetadata verklaren noodzakelijke groei; oude beschermde bewijsdelen zijn niet opgeruimd.

Browseroriginmetingen zijn afzonderlijk vastgelegd. Bij 20 bronnen: 2.175.578 → 1.550.994 bytes; bij 100: 6.012.253 → 7.007.821 bytes. Deze verschillen zijn geen financiële recordtelling. Interne pagina's, compactie en meetruis zijn niet afzonderlijk verklaard; er wordt geen sluitende verklaring voor alle originverschillen geclaimd.

## Eenmalige 500-proef en resterend knelpunt

500 unieke bankbewegingen, drie maanden, zes oorspronkelijke CSV-batches en twee rekeningen, inclusief splitsingen over financiële maanden, terugbetalingen, interne overboekingen, vaste lasten, spaardekking en historische correctie. De beginsituatie is via de bestaande motor in de emulator opgebouwd. Echte browserhandelingen importeren en verwerken daarna één nieuwe spaarbetaling en de groep van tien; dit zijn geen 500 afzonderlijke handmatige imports. Quota opnieuw 384 MiB, niet verruimd.

| Meting | P4.2, eenmalig ms | P4.3, eenmalig ms |
|---|---:|---:|
| Testinrichting | 65.011 | 38.009 |
| Koude start inclusief aansluiten | 21.903 | 9.556 |
| Warme start inclusief aansluiten | 23.460 | 11.901 |
| Historische maand laden | 10.930 | 5.847 |
| Eén CSV-concept maken | 7.058 | 3.729 |
| Eén lokale goedkeuring, inclusief bediening | 7.305 | 3.366 |
| Cloudbevestiging van die ene goedkeuring | 34.977 | 22.857 |
| Tien lokale goedkeuringen binnen 20 s | Nee | Nee |

De negende native goedkeuring is op 19.698 ms bevestigd; de eerste op 3.088 ms. Het maandtotaal op de deadline is €1.271 terwijl de nog lopende groep uiteindelijk €1.351 zou moeten opleveren. Dit verschil van €80 hoort bij de nog niet bevestigde laatste geselecteerde betaling. Er zijn 511 bankbronnen zichtbaar, maar dat aantal alleen is geen bewijs van goedkeuring.

De profiler registreert op het stopmoment: 998.426 JSON-serialisaties / 8.196 ms; fysieke encoding 182 rootaanroepen / 6.635 ms; financiële validatie 11 aanroepen / 6.396 ms; SHA 231.525 aanroepen / 3.329 ms, waarvan encoding 214.392 / 3.043 ms; codec 54 aanroepen / 910 ms; seedStatePayload 10 / 397 ms; native commit-wall 10 / 3.032 ms. 61.732 recordvergelijkingen omvatten 49.870 encoderingen en 11.862 hergebruikte records, tegenover 78 werkelijk gewijzigde opslagrecords in de afgeronde commits. Deze telling omvat het CSV-concept en de nog lopende laatste goedkeuring; zij is geen complete eindmeting.

Tijdens deze groep: nul cloud-fetches, nul native aborts. Cloudwachttijd verklaart deze lokale vertraging niet. Brede financiële validatie, kandidaat-/bewijsserialisatie en het opnieuw opbouwen van grote fysieke rootmanifesten blijven aantoonbaar werksetafhankelijk. De SHA- en seedreparatie heeft dat overige werk niet weggenomen. Deze geneste tijden worden niet bij elkaar opgeteld tot een fictieve tijdverdeling.

### Fout in de diagnostische nacontrole

De oorspronkelijke nacontrole vergeleek source.id (source-bank-...) met effect.bankSourceId (bank-...). Daardoor werden nul effecten gevonden. Een aparte kleine proef met 20 bestaande bronnen reproduceert die foutieve lookup en vindt met de juiste bankSourceId exact tien bronnen en tien effecten, correcte bedragen, €750 spaarverwerking, 30 unieke cloudbronnen en hetzelfde resultaat na herladen.

De testharness gebruikt voortaan vastgelegde bron-ID's en bankbron-ID's en bewaart de lokale voltooiingsmeting vóór vervolgasserties. Deze kleine testreparatie verandert geen applicatielogica. De oorspronkelijke 500-foutbestanden blijven ongewijzigd. De exacte lokale voltooiingsduur van alle tien, cloudduur van de groep, volledige eindinvarianten en tweede-clientcontrole ontbreken voor die grote proef. Het nieuwe kleine bewijs wordt daar niet voor in de plaats gezet.

## Opslagcategorieën bij de gestopte 500-proef

Uniek toegerekende UTF-8 JSON-payloadbytes, gedeelde delen eenmaal geteld:

| Categorie | Bytes |
|---|---:|
| activeFinancialRecords | 6.809.259 |
| offlinePeriods | 0 |
| openCsvImports | 0 |
| historicalCsvImports | 2.762 |
| syncOutbox | 873.049 |
| operationReceipts | 5.020 |
| conflictsAndRecovery | 1.508.382 |
| protectedMigrationCopies | 187.600 |
| replaceablePeriodCache | 1.370.952 |
| storageMetadata | 136.334 |
| planningAssets | 0 |
| **Totaal** | **10.893.358** |

Begintotaal: 9.075.802 bytes; einddiagnose: 10.893.358 bytes. De categorieën tellen exact op. Beschermde, momenteel niet rechtstreeks bereikte delen: 1.361.799 bytes. De logische gehydrateerde omvang van alle snapshots is 85.088.097 bytes; dat is niet de fysieke opslagomvang. De browser meldt bij de einddiagnose 11.727.789 originbytes en quota 402.653.184 bytes.

De 64 MiB-grens geldt voor vervangbare periodecache en begrenst beschermde bewijs-/hersteldelen niet. Die blijven groeien bij nieuwe operaties. Gedeelde-payloadallocatie kan bytes tussen categorieën verschuiven zonder verwijdering. Het bestaande veilige retentievoorstel blijft noodzakelijk: eerst geverifieerde vervangende checkpoints, behoud van outbox/conflicten/migratie- en herstelafhankelijkheden, aantallen/hashes en aantoonbaar herstel; geen onomkeerbare verwijdering zonder afzonderlijke toestemming. In deze fase is geen beschermde retentieopruiming uitgevoerd.

## Daadwerkelijk uitgevoerde verificatie

| Definitieve app-build | Geslaagd | Mislukt | Overgeslagen |
|---|---:|---:|---:|
| Gerichte P1/P2/P3-/codec Node-suite | 47 | 0 | 0 |
| Gerichte browserreeks | 37 | 0 | 0 |
| Aanvullende kleine verifierregressie | 1 | 0 | 0 |
| Echte Firestore-emulator/Security Rules | 42 | 0 | 0 |
| Eén 500-bronnenproef | 0 | 1 | 0 |

127 geslaagde definitieve gerichte testgevallen, één afgekeurde schaalproef. Ontwikkelingsruns en de nulmeting zijn niet bij deze eindtelling opgeteld. Syntax, CSS en reproduceerbare gegenereerde assets slagen; de bekende CSS-waarschuwing voor --line blijft bestaan. De algemene Node- en Playwright-suites en 5.400-proef zijn niet uitgevoerd, conform de stopgate; deze zijn geen geslaagde of stilzwijgend overgeslagen tests.

De kleine proeven bewijzen bedragen/bronidentiteit bij tien herhaalde budgetwijzigingen; €750 voor tien afzonderlijke spaarbetalingen; geen dubbele effecten na herhaalde sync; historische afhankelijkheden en geen nulinterpretatie van ontbrekende data; offline herstart; verloren bevestiging; geweigerde/afgebroken commits en mislukte rollbackregistratie; onderbroken migratie; ontbrekende/corrupte delen; huishoudwissels; gelijke financiële SHA met afwijkende revisie/epoch; twee apparaten en behoud van conflicterende goedkeuringen. De oorspronkelijke financiële motor is behouden.

Meetomgeving: Windows 11 Home build 26200; AMD Ryzen 5 5500U, circa 7,34 GiB zichtbaar RAM; Node 24.19.0; Playwright 1.55 / Chromium 140.0.7339.16; Firebase CLI 15.24 / Firestore-emulator 1.21; Java 21, maximaal 3 GiB heap; één Playwright-worker. De testemulator is na de laatste controles bewust gestopt; exitcode 4294967295 in het emulatorlog komt van deze stopactie, niet van een fout tijdens de 500-proef. Geen betrouwbare applicatiegeheugenpiek gemeten. Financiële browsertests blokkeren productieadressen; de nieuwe-installatietest oefent ook de lokale PWA/offline-shell.

## Gewijzigde onderdelen en interfaces

- src/storage/payload-parts.mjs: operatiegebonden fysieke voorbereiding, exact signatuurhergebruik, abortinvalidatie; createPayloadPreparation(binding), preparationSignature en optionele finizePreparation-transactieoptie.
- src/storage/household-store.mjs: encodeHouseholdState(state, {basis}), private vergelijkingsmetadata, commit(..., {payloadPreparation}), CAS op hash/revisie/migratiebasis; incrementeel bijwerken na native bevestiging.
- src/import/runtime.js en src/core/runtime.js: dezelfde context door pending journal, bestaande commitChange/DataAdapter.save en journalafronding; bestaande async-durabilitycontract behouden; aanvullende timing; kleine maandkiezerreparatie.
- src/storage/period-cache.mjs en record-sync.mjs: gerichte cache-inventaris in de atomaire opruimroute en correct offlinefoutcontract.
- src/storage/performance.mjs en tests/helpers/indexeddb-performance-meter.cjs: optionele tellers/spans zonder financiële inhoud.
- tests/v117-p2.test.cjs en v117-p4-payload-parts.test.cjs: incrementeel versus volledig, historische perioden, gemuteerde objecten en JSON-randgevallen.
- tests/browser/v117-p43-{basis,performance,verifier}.spec.cjs: revisie-/epochbewijzen, 20/100-metingen en juiste bron/effectidentiteiten.
- tests/browser/v117-p3.spec.cjs: bestaande assertions via de logische adapter in plaats van ruwe fysieke refs; optionele browserdiagnostiek. v117-p4.spec.cjs: offline cache plus geblokkeerde toegangsweigering.
- tests/helpers/v117-p4-browser.cjs en v117-p4-scale.spec.cjs: native bevestigingsklok, afzonderlijke lokale/UI/cloudmetingen, bronidentiteiten en behoud van mislukte prestatienorm.
- scripts/test-p43.mjs: vaste gatevolgorde, buildmanifest, één 500-proef en stop bij afkeuring.
- app.js, index.html, service-worker.js en zes bijbehorende assettests: gezamenlijke versie 117-p4r3. app.css reproduceerbaar behouden.

De exacte wijzigingen en hashes tegenover het technische controlepunt staan in p43-stop-proof.json. De volledige broncode, documentatie en bewijsbestanden zijn in het afsluitende technische herstelpunt beschermd.

## Openstaande blokkades

1. De bestaande lokale groepsnorm van twintig seconden wordt bij 500 bronnen niet gehaald; resterende serialisatie-/validatie-/manifestkosten gericht onderzoeken zonder financiële controles te verzwakken. Geen nieuwe zware test tijdens die diagnose.
2. Het complete financiële eindbewijs bij 500, de volledige regressies en de eenmalige 5.400-proef ontbreken. Deze blijven acceptatieblokkades.
3. Afwijkende financiële goedkeuringen van dezelfde bankbron blijven veilig bewaard en geblokkeerd. Een ondersteunde gebruikersroute voor financiële herbeoordeling ontbreekt; de eerdere releaseblokkade blijft staan. Geen omvangrijke conflictinterface toegevoegd.
4. Beschermde opslaggroei en tijdelijke migratieruimte bij bijna volle oude browsers zijn niet volledig opgelost. Een veilige retentie-/export-/herstelstrategie vereist aanvullend bewijs en zo nodig afzonderlijke toestemming voor onomkeerbare stappen.

## Bewijspaden

Onder backups/v117-stabilisatie: p43-performance-before.json, p43-performance-after.json, p43-comparison.json, p43-repeated-edits-after.json, p43-small-final.log, p43-node-final.log, p43-final-firestore-rules.log, p43-final-b-500-movements.log, p43-scale-failure-3.json, p43-small-verifier-final.log, p43-small-verifier.json, p43-final-build-manifest.json, p43-final-suite-status.json en p43-delivery-proof.json. Het productie-releaseplan is bijgewerkt met de actuele blokkade en niet uitgevoerd.

Afsluitend technisch herstelpunt: backups/v117-stabilisatie/p43-stop-20261011T141917. Het manifest en p43-stop-backup-proof.json bevatten de terugleescontrole en SHA-256.
