# V117 P4.4 — groepsgoedkeuring en complexiteitsbeoordeling

## Bewijsherkomst en actuele vrijgavebeoordeling

De volledige financiële 500- en 5.400-proeven zijn afgerond. Dit technische verslag bewaart de oorspronkelijke fasegebonden metingen en stopregels. Het [actuele vrijgaveverslag](v117-vrijgaveverslag.md) bevat de laatste acceptatievoorwaarden, de beperkte kalenderroute-aanpassing, beide buildhashes, definitieve regressies en releaseblokkades. De twintigsecondennorm is inmiddels een streefwaarde; de oorspronkelijke afkeuring uitsluitend op snelheid blijft als historisch bewijs bewaard.

## Veiligheid en uitgangspunt

De eindregressie van 117-p4r4b is onvolledig gestopt door een echte emulator-OOM. De resultaten hieronder horen bij hun genoemde fase/build en bewijzen geen volledig groene eindbuild. Exacte aantallen en blokkades staan in het vrijgaveverslag.

Branch agent/v117-stabilisatie, HEAD 1db602a0986f09e5739169f9de40c1debe95abf9. Alle bestaande lokale wijzigingen behouden. Voorafgaand technisch herstelpunt: backups/v117-stabilisatie/p44-checkpoint-20261011T143715. Alle 344 bestanden teruggelezen; manifest-SHA-256 683dfd7a664c6fae823b1969b88804d42303255e8b530eb487832cfc4e14de71. Dit is een broncode-/bewijsback-up, geen export van gebruikersadministraties.

Geen productieverbinding, regelpublicatie, cloudmigratie, deployment, push of merge naar main. Geen beschermde financiële gegevens verwijderd. De pc blijft aan.

## Diagnose en gerichte reparaties

De nulmeting gebruikt uitsluitend 20 en 100 bankbewegingen. Echte browserhandelingen maken tien wijzigingen aan dezelfde bestaande transactie en daarna één nieuwe CSV met tien spaarbetalingen. Opstarten, maandladen, edits, import/groep en synchronisatie hebben eigen meetfasen. Geschreven UTF-8 payloadbytes en navigator.storage.estimate zijn verschillende metingen.

Bij 100 bronnen maakt CSV plus groep vóór reparatie 281.736 JSON-serialisaties. De steekproef van één callstack per duizend stringify-aanroepen wijst vooral naar fysieke referentieopbouw, exacte recordsignaturen en herhaalde budgetplanning. Een steekproef is geen exacte verdeling van alle CPU-tijd. De eerdere miljoen-aanroepenmeting hoort bij de P4.3-500-proef; die is tijdens deze diagnose niet herhaald.

1. **Fysieke voorbereiding tussen groepsleden.** Het P4.3-memo eindigde bij iedere afzonderlijke goedkeuring. Alleen kleine, exact gesigneerde fysieke recordartefacten kunnen nu binnen dezelfde expliciete groep naar het volgende lid gaan. De vorige financiële commit moet bevestigd zijn en operatie-ID, opslagrevisie en migratiebasis moeten aansluiten. Voor gebruik moeten scope, duurzame SHA, opslagrevisie en migratiebasis exact gelijk zijn. Anders volgt de oorspronkelijke volledige voorbereiding. Native compare-and-swap blijft actief. Iedere bron heeft een eigen operatie-ID en native duurzame commit.
2. **Planning en bronlookup binnen één motorberekening.** Een synchronische selector bouwt nu één bronlookup en leest de budgetplanning één keer per maand/eigenaar. De lookup en planning vervallen bij terugkeer uit die selector. Zij bevatten geen opgeslagen financiële uitkomsten en worden nooit tussen verschillende motorberekeningen hergebruikt. Historische planning en stabiele budget-ID's blijven leidend.
3. **Cumulatieve voorbereiding.** Eén cumulatief resultaat liet dezelfde canonieke projecties veertien keer maken: dertien dimensies en een effecttelling. Een complete-stateberekening maakt nu één projectieresultaat en gebruikt dezelfde bestaande afrondingsfunctie voor alle dimensies. De gedeeltelijk geladen route blijft haar geverifieerde cumulatieve bewijs gebruiken. Iedere financiële commit voert alle bestaande mutatie-, bron-, dekking-, saldo- en revisiecontroles uit.

De groepsvoorbereiding bewaart maximaal 4.096 recordsignaturen met samen maximaal 4 MiB UTF-16-signatuurtekst. Een record mag maximaal 32.768 tekens en 128 fysieke delen bevatten. Dit zijn hergebruikgrenzen, geen browsergeheugengarantie. Grote records en hele state-/journalstrings worden niet overgedragen. String- en digestmemos beginnen opnieuw bij ieder groepslid. Alle artefacten vervallen na de groep; er is geen globale mutable cache, nieuwe financiële state, objectstore, databaseversie of migratie toegevoegd. Bij abort is de context ongeldig. Verloren bevestiging blijft via het duurzame operatiebewijs worden gecontroleerd.

## Kleine ontwikkelmetingen

Eerste nameting vóór de aanvullende cumulatieve reparatie, milliseconden tot de laatste native commit:

| Bankbronnen | Nulmeting | Eerste nameting | JSON-aanroepen vóór / eerste na |
|---|---:|---:|---:|
| 20 | 1.900 | 1.768 | 124.783 / 102.523 |
| 100 | 4.423 | 3.816 | 281.736 / 198.256 |

De definitieve nameting op de vastgelegde eindbuild staat hieronder. De geïsoleerde Node-controle van cumulatieve voorbereiding gaat bij beide groottes van 14 naar 1 motorprojecties, met bytegewijs identieke financiële resultaten. Gemeten losse walltijd 20 bronnen 6,86 → 2,32 ms; 100 bronnen 11,06 → 3,37 ms. Dat is een kleine Node-meting zonder browser, IndexedDB of emulator en geen browserlatentieclaim.

## Definitieve kleine metingen

App-SHA-256 c0b6f0e93dac70a4862c2fc69318582967017739704b4c21bc31c674f8a14713. Assets en serviceworker gezamenlijk 117-p4r4. Financieel schema 11, lokaal opslagcontract 1, fysieke representatie 2, IndexedDB-versie 4 en cloudprotocol 2 blijven gelijk. De nadere bron/effectverifier is vóór de eerste grote proef aangescherpt en apart met 20 bronnen getest; de runtime bleef gelijk. De eerste gedeeltelijke Rules-run is daarbij bewust onderbroken en niet bij de definitieve telling opgeteld. De nieuwe gate legt de definitieve testharness en runtime samen vast.

| Bankbronnen | Lokale tien commits vóór / na | UI-resultaat vóór / na | Cloudsynchronisatie vóór / na |
|---|---:|---:|---:|
| 20 | 1.900 / 1.697 ms | 2.177 / 2.108 ms | 5.563 / 4.688 ms |
| 100 | 4.423 / 3.702 ms | 5.334 / 4.366 ms | 6.576 / 6.720 ms |

Dit zijn één groep per grootte en tien opeenvolgende edits; geen tien onafhankelijke groepsbenchmarks. Emulator-/systeemlast, cachewarmte, willekeurige operatie-ID's en meetoverhead beïnvloeden walltijd. De cloudsynchronisatie bij 100 bronnen is niet aantoonbaar sneller geworden. De UI-wachtconditie is aangescherpt; de lokale native complete-klok is de vergelijkbare duurzaamheidsmeting.

Bij 100 bronnen, CSV plus tien goedkeuringen:

| Technisch werk | Vóór | Definitief na |
|---|---:|---:|
| JSON-serialisaties | 281.736 | 197.440 |
| Fysieke SHA-berekeningen | 52.826 | 37.276 |
| Fysiek opnieuw gecodeerde recordinhouden | 9.568 | 2.584 |
| Fysiek hergebruikte recordinhouden | 22.272 | 26.853 |
| Fysieke rootencoderingen | 198 | 198 |
| Storecodec-recordvergelijkingen | 12.667 | 12.667 |
| Storecodec-recordencoderingen, inclusief afhankelijkheidscontroles | 9.749 | 9.749 |
| Financiële validaties | 11 | 11 |
| Financiële validatietijd | 895 ms | 541 ms |
| Fysieke encodertijd | 1.481 ms | 1.067 ms |
| Native payloadPart-gets | 6.732 | 6.729 |

De elf controles omvatten CSV-aanmaak plus tien afzonderlijke goedkeuringen. De cumulatieve voorbereiding maakt per aanroep nu één motorprojectie; andere mutatie-, dekking- en broncontroles blijven bestaan. De definitieve groepsmeting telt 255 selectoroproepen; de afzonderlijke teller bestond nog niet in de P4.3-nulbuild. De geïsoleerde 14→1-proef en broncode bewijzen de herhaling zonder een ontbrekende oude teller als nul te presenteren.

De verbetering is gericht en niet constant in administratieomvang: brede recordvergelijkingen en afhankelijkheidsencoderingen blijven zichtbaar. De commitklokken bevatten compacte tussentellers. Verschillen tussen opeenvolgende snapshots laten het terugkerende werk bij de latere groepsleden zien; de eerste snapshot bevat ook de voorafgaande CSV-voorbereiding. Geneste CPU-spans, native walltijd en HTTP-wall mogen niet bij elkaar worden opgeteld.

Tien edits in de afzonderlijke schrijfacceptatiefixture schrijven exact dezelfde payload als P4.3: 549.847 bytes bij 20 bronnen, 577.208 bij 100. Respectievelijk 923/923 en 964/964 aangevraagde/afgeronde writes; nul ongewijzigde fysieke writes. De extra historische transactierecords worden niet opnieuw geschreven. De eerdere besparing van 95,8–98,4% blijft behouden. De totale bytes bij nieuwe groepen variëren door nieuwe identiteiten en manifestpaden; die zijn geen deterministische bytebenchmark.

Navigator.storage.estimate in de CPU-fixture: 20 bronnen vóór 1.907.488→2.522.472, na 1.906.460→2.524.012 bytes; 100 bronnen vóór 5.730.400→5.017.063, na 5.831.490→5.036.537 bytes. Dalingen door browsercompactie zijn geen verwijdering van financiële historie. De exacte verdeling tussen pagina-overhead, compactie en meetruis is niet gemeten; dit is geen sluitende verklaring van de origin-opslag.

## Testharness en foutproeven

De native operationReceipts-complete-event blijft de lokale duurzaamheidsklok. De UI-klok en cloudbevestiging staan afzonderlijk. De 500-harness krijgt een begrensde afrondingswachtconditie om financiële correctheid te kunnen controleren, ook wanneer twintig seconden wordt overschreden. De prestatienorm blijft exact twintig seconden; een overschrijding blijft een mislukte acceptatiegate na het financiële eindbewijs.

De nieuwe native foutinjectie breekt de financiële transactie bij het achtste operatiebewijs af. Bij 20 en 100 bronnen blijven zeven successen duurzaam; de achtste wordt afgewezen, de laatste twee niet geprobeerd. Na herstart kiest de gebruiker de gedeelde bestemming opnieuw voor de drie resterende bronnen. Niet-geprobeerde bronnen behouden hun eerdere duurzame keuzes. Daarna zijn er tien afzonderlijke goedgekeurde bronnen en effecten, originele bankgegevens, correcte totalen, idempotente synchronisatie en dezelfde stand op de tweede client.

Twee fouten in de ontwikkeltest zijn expliciet hersteld: de UI sorteert bankregels anders dan de CSV-volgorde, en alleen selecteren mag geen spaarbestemming verzinnen voor eerder niet-geprobeerde bronnen. Deze fouten zaten in de verwachtingen van de nieuwe test, niet in een bewezen financiële productiefout.

## Eenmalige 500-proef: geslaagd

500 oorspronkelijke unieke bankbewegingen, drie maanden, zes importbatches en twee rekeningen, met de bestaande representatieve financiële varianten. Daarna via echte browserhandelingen één nieuwe spaarbetaling en tien gezamenlijke spaarbetalingen. Vaste quota 384 MiB, niet verhoogd. De Firestore-emulator en echte Security Rules zijn gebruikt.

| Meting | P4.4, één volledige ronde |
|---|---:|
| Inrichting emulatoradministratie | 30.512 ms |
| Koude start inclusief aansluiten | 8.741 ms |
| Warme start inclusief aansluiten | 11.204 ms |
| Historische maand laden | 5.491 ms |
| CSV-concept individueel / groep | 2.751 / 3.069 ms |
| Individuele goedkeuring, inclusief bediening | 2.391 ms |
| Tien native duurzame goedkeuringen | **16.723 ms** |
| UI-resultaat groep | 17.326 ms |
| Cloudbevestiging groep, na lokaal resultaat | 22.846 ms |

De afzonderlijke native bevestigingen staan op 1.911, 3.583, 5.209, 6.855, 8.483, 10.136, 11.782, 13.458, 15.062 en 16.723 ms. Tien verschillende operatie-ID's en aansluitende opslagrevisies. Het oorspronkelijke twintigsecondencriterium is gehaald. Dit is één meting op deze machine, geen productie-SLA of percentielclaim.

Het volledige financiële eindbewijs is nu uitgevoerd: 511 unieke bankbronnen na de ene individuele betaling en de tien groepsbetalingen. Iedere nieuwe bankbron heeft precies één eigen effect met identieke bankgegevens, bedrag, datum en rekeningprofiel, de gekozen spaarbestemming en expliciete handmatige goedkeuring. Totaal extra sparen 75.100 cent; alle overige gevraagde dimensies blijven identiek aan de volledige canonieke administratie. Alle maandprojecties zijn opnieuw vergeleken, inclusief de historische maanden. Herladen, opnieuw synchroniseren, cacheopruiming, historisch laden en een tweede client behouden dezelfde resultaten. Er zijn nul volledige financialRecords-getAll-opdrachten tijdens de gemeten gewone maand-/commitroute. De latere integriteitscontroles zijn expliciete acceptatiecontroles.

De maandroute vraagt 1.217 cloudrecord-reads, 95 HTTP-verzoeken, met 752 geladen transactierecords inclusief bron/effect/afhankelijkheden. Groepsvoorbereiding plus synchronisatie gebruikt 4.615 document-reads, 205 writes en 504 HTTP-verzoeken. Dit is nog een aanzienlijke synchronisatiekost. Geen cloudverzoeken tijdens de afzonderlijke lokale goedkeuringen.

De volledige CSV/groepsfase telt nog 813.250 JSON-serialisaties, 197.708 fysieke SHA-berekeningen en 62.937 storecodec-recordvergelijkingen. Elf native financiële commits omvatten CSV-aanmaak en tien goedkeuringen. Fysiek gecodeerde recordinhouden 31.696, hergebruik 126.585. Geneste spans: encoder 5.777 ms; financiële validaties 2.976 ms; native commit-wall 3.444 ms. De P4.3-snapshot bevatte circa 998.000 JSON-aanroepen maar slechts negen afgeronde goedkeuringen; dat is geen gelijkwaardige volledige vóór/na-500-benchmark. De kleine proeven vormen het gecontroleerde vergelijkingsbewijs.

## Opslag bij de volledige 500-proef

Fysieke payload plus roots/metadata, per categorie eenmalig toegerekend. Gedeelde delen kunnen bij een andere actieve periode naar een andere categorie verschuiven; een kleine CSV-root betekent niet dat de bronbytes verdwenen zijn.

| Categorie na alle controles | Bytes |
|---|---:|
| Actieve financiële records | 772.711 |
| Offline vastgezette perioden | 0 |
| Open CSV-imports | 0 |
| Historische CSV-imports | 2.762 |
| Synchronisatie-outbox en basismetadata | 400 |
| Operatiebewijzen | 5.818 |
| Conflicten en hersteljournals | 2.957.024 |
| Beschermde migratiekopieën | 3.031.636 |
| Vervangbare periodecache | 4.453.408 |
| Opslagmetadata | 190.918 |
| Planningsafbeeldingen | 0 |
| **Totaal** | **11.414.677** |

Beginpayload 9.077.022 bytes; na de goedkeuringen/synchronisatie 11.359.889; na alle herlaad-/historische controles 11.414.677. Bij het groepsresultaat waren actieve financiële records nog 6.904.731 bytes, migratiekopieën 188.459 en periodecache 1.401.188. Het latere verschuiven van gedeelde delen is zichtbaar in de volledige opslaginventaris; categorieën zijn geen zelfstandige financiële waarheden.

Gedeelde payload-overlap 4.037.106 bytes, niet nogmaals bij het totaal opgeteld. Andere gerapporteerde categorie-overlap nul. Beschermde niet-meer-bereikbare delen 2.787.940 bytes blijven behouden. Browseroriginmeting 22.815.736→24.305.921 bytes, afzonderlijk van de logische payload. Native pagina-/indexoverhead en compactie zijn niet volledig uitgesplitst. Geen quota- of native opslagfout; geen beschermde gegevens verwijderd.

## Complexiteit en releasevoorwaarden

De combinatie van lokale atomaire records, gedeelde bewijsdelen, pending journals, beschermde migratiekopieën en cloudperiodebewijzen is complex. De writebesparing rechtvaardigt niet onbeperkte toevoeging van caches en uitzonderingen. P4.4 beperkt hergebruik tot de bestaande encoder en één synchronische motorberekening, zonder nieuwe opslagvorm. De oude wire-/hashcontracten blijven intact.

Opstarten en synchroniseren omvatten nog volledige bewijsverificatie en brede voorbereiding van geladen afhankelijkheden. Resultaten van lokale goedkeuring mogen niet als cloud- of opstartprestaties worden gepresenteerd. Bij een financieel correcte maar te trage 500-proef stopt de zware gate met gemeten bewijs; er volgt geen onbeperkte reeks nieuwe micro-optimalisaties.

De ondersteunde gebruikersroute voor afwijkende goedkeuringen op twee apparaten en het definitieve integrale migratie-/herstelbewijs blijven afzonderlijke releasevoorwaarden. Beschermde opslaggroei en tijdelijke migratieruimte vereisen eveneens expliciete verantwoording. Geen onomkeerbare retentie uitgevoerd.

## Brede regressie: correcte asynchrone testgrenzen

De eerste brede browserrun stopte na zeven successen bij de vaste-lastverwijdertest. De test las de tijdelijke oude state nadat de editorrij al afwezig was, vóór de awaited IndexedDB-commit. De bestaande handler opent de planning pas na de duurzame commit. De test wacht nu op die planning en controleert `DataAdapter.readDurableState()`: de last blijft historisch bewaard, geldt vorige maand en geldt niet meer vanaf de gekozen maand. De tweede brede poging stopte na tien successen bij een knophoogtemeting tijdens opnieuw tekenen na een mobiele reload. De test wacht nu op bootstrap en zichtbaarheid en herhaalt dezelfde minimaal-44-pixelassertie tot een echte bounding box bestaat. Er is voor beide bevindingen geen runtimewijziging gedaan. Alle elf gevallen in het betreffende browserbestand slagen daarna. De eerdere mislukte logs blijven bewaard; zij worden niet als financiële regressie of overgeslagen succes gepresenteerd.

De hervatte gate controleert de hashes van alle runtimebestanden vóór hergebruik van de reeds geslaagde Node-, emulator- en 500-gates. Alleen de genoemde test en de hervatoptie van de testrunner zijn gewijzigd; de apphash blijft gelijk. De 500-proef wordt niet herhaald.

## Gewijzigde onderdelen en interfaces ten opzichte van P4.3

- `src/storage/payload-parts.mjs`: optioneel `createPayloadPreparation(binding, previous)` en gecontroleerd `advancePayloadPreparation(preparation, head, operationId)`. Bestaande fysieke encoding en decoder blijven compatibel.
- `src/import/runtime.js`: expliciet groepsgebonden voorbereidingsargument door dezelfde editor-/commandroute, pas doorschuiven na duurzame financiële commit en journalafronding. Geen extra opgeslagen financiële velden.
- `src/core/budget-assignment.mjs`: optionele reeds opgeloste planning binnen één motoroproep; stabiele budgetidentiteit en legacyregels behouden.
- `src/core/transaction-engine.mjs`: lokale lookup en planningsvoorbereiding; `sumProjectionEffects(projections, dimension)` hergebruikt dezelfde bestaande afronding.
- `src/storage/period-projections.mjs`: eenmalige canonieke projectie voor complete cumulatieve totalen; gedeeltelijk laden blijft de bestaande gecontroleerde bewijsroute gebruiken.
- `tests/v117-p44.test.cjs` en drie `tests/browser/v117-p44-*.spec.cjs`: exacte bindingsgrenzen, gewijzigde historie, cumulatieve centen, groepsuitval bij acht, veilig herhalen en een aangescherpt klein bron/effectbewijs.
- `tests/helpers/indexeddb-performance-meter.cjs`, `v117-p4-browser.cjs` en `v117-source-proof.cjs`: per-commitmetingen, losse duurzaamheids-/UI-/cloudklokken en strikt één effect per bankbron.
- `tests/browser/v117-p4-scale.spec.cjs`: volledige financiële eindcontrole vóór afkeuring op snelheid; de bestaande twintigsecondennorm blijft intact.
- `tests/browser/desktop-special-tabs.spec.cjs`: bestaande assertions wachten op de daadwerkelijke duurzame/zichtbare toestand.
- `scripts/test-p44.mjs`: vaste gates, buildmanifest, eerste-foutstop en gecontroleerd hervatten van algemene regressie zonder de geslaagde 500-proef te herhalen.
- `app.js`, `index.html`, `service-worker.js` en zes bestaande assettests: gezamenlijke versie `117-p4r4`; `app.css` ongewijzigd.
- Dit verslag, het P4-overzicht en het productieplan: actuele bewijzen naast beschermde historische stopresultaten.

De exacte per-bestand-SHA-256-verschillen tegen het herstelpunt worden bij oplevering vastgelegd. Er zijn geen nieuwe objectstores, cloudrecords, opslagversies of financiële classificaties door P4.4 toegevoegd.

## Financiële invarianten en begrenzing van het bewijs

De volledige canonieke administratie is de referentie voor de financiële dimensies in eurocenten: inkomen, werkelijke uitgaven, budgetimpact per eigenaar/categorie, vaste-lastrealisatie, spaardoelstortingen en -opnamen, dekking, terugbetalingen, interne overboekingen en zakgeld. De gesplitste financiële maanden en historische budget-/vaste-lastwijzigingen blijven in de fixture aanwezig. De volledige maandprojecties worden vergeleken, niet uitsluitend de som van het nieuwe sparen. De oorspronkelijke bronbedragen, bankdatums en rekeningen worden vóór de nieuwe goedkeuring vastgelegd en achteraf exact vergeleken. Bron-ID en effect-ID zijn verschillende identiteiten; de koppeling loopt via `bankSourceId`.

De gerichte tests bewaren het bestaande P1/P2-contract bij verloren bevestiging, afgewezen native commit, pending herstel, ontbrekende/corrupte bewijsdelen, onderbroken migratie, revisie-/epochconflict en huishoudwissel. De fout bij lid acht bewijst ook dat hervatten de zeven eerdere successen niet dubbel uitvoert. Dit bewijs vervangt geen onafhankelijke integrale migratie-/rollbackoefening met een grote, bijna volle bestaande gebruikersdatabase en nieuwe boekingen na omschakeling.

Meetomgeving: Windows 11 Home build 26200, AMD Ryzen 5 5500U (12 logische processors), circa 7,34 GiB zichtbaar RAM; Node 24.19.0; Playwright 1.55 / Chromium 140.0.7339.16; Firebase CLI 15.24 / Firestore-emulator 1.21; Java 21 met maximaal 3 GiB heap; één Playwright-worker. Lokale emulator op 127.0.0.1:8181 en lokale webserver op poort 4173, uitsluitend demo-finize-v117. Geen betrouwbare applicatiegeheugenpiek gemeten. Origin-ruimte en geschreven payload worden afzonderlijk gerapporteerd. Geen productie-internetlatentie of Firestore-facturatie gemeten.

De kleine schrijfproef bevat tien opeenvolgende wijzigingen per grootte. De 500-proef is één volledige ronde, de goedgekeurde 5.400-gate is één administratie met drie operationele meetronden. Tien onafhankelijke opstart-/groep-/syncmetingen zijn niet uitgevoerd; medianen en maxima mogen alleen bij het daadwerkelijk gemeten aantal ronden worden geïnterpreteerd. Er is geen browserbewijs voor Firefox, Safari of mobiel OS buiten Chromium met mobiele viewport.

## Definitieve regressies op dezelfde applicatiebuild

| Gate | Geslaagd | Mislukt | Overgeslagen |
|---|---:|---:|---:|
| Volledige Node-suite (60 bestanden) | 621 | 0 | 0 |
| Volledige algemene Playwright-regressie | 304 | 0 | 0 |
| Echte Firestore-emulator en Security Rules | 42 | 0 | 0 |
| Gerichte kleine browsergate | 40 | 0 | 0 |
| Aanvullende bron/effectverifier | 1 | 0 | 0 |
| Eenmalige 500-bronnenproef | 1 | 0 | 0 |

De kleine gates overlappen grotendeels met de algemene browserreeks en mogen niet worden opgeteld als unieke tests. In de algemene reeks zijn zeven meetgevallen bewust apart gehouden: de twee schaalgevallen, twee schrijfmeetgevallen, de actuele P4.4-prestatiemeting en de twee historische P4.2/P4.3-prestatiemetingen. De twee schrijfgevallen en de actuele prestatiemeting zijn in de kleine gate uitgevoerd. De 500-gate is afzonderlijk uitgevoerd; de 5.400-gate volgt één keer na de algemene suite. De twee verouderde prestatiebenchmarks worden op deze eindbuild niet opnieuw gedraaid; hun vóór-/na-bewijs blijft in de eerdere verslagen staan. Er is geen stilzwijgende skip van een financieel regressiegeval.

De algemene browserreeks duurt 650.032 ms inclusief proces-/serverstart. Syntax, CSS en reproduceerbare gegenereerde assets slagen. Bestaande waarschuwingen over NO_COLOR/FORCE_COLOR en de CSS-variabele --line zijn geen nieuwe testfouten. De Node-/emulator-/500-bewijzen zijn hergebruikt na controle van alle runtimehashes; na die gates veranderden alleen de twee beschreven testwachtgrenzen en de expliciete hervatoptie van de runner. Het definitieve appbestand is in alle gates identiek. De runner controleert de volledige vastgelegde bron-/testmanifesten na de laatste gate opnieuw.

## Eenmalige driejaarsproef: voorbereiding

De goedgekeurde fixture bevat 5.400 bankbronnen over 36 maanden, drie rekeningen en 108 importbatches, inclusief persoonsgebonden reguliere salarissen en extra inkomsten. De geserialiseerde fixture is 22.999.397 tekens volgens de bestaande JSON-lengtemeting; dit is geen UTF-8-byteclaim. De emulatorinitialisatie plus attach duurt 508.384,6 ms. Het voorbereide migratieoperatiebewijs vermeldt 18.209 wijzigingen. Een aanvullende uitsluitend-lezen metadataopname staat in `p44-scale-36-readonly-progress.jsonl`; die drie reads veranderen geen financiële gegevens en vallen buiten de browsertransporttellers. Daarna meldt de proef `P4_SCALE_READY` en beginnen de operationele metingen. Deze inrichting van een lege emulator met historie is geen bewijs van migratie van een grote bestaande legacy-gebruikersdatabase.

Deze lange volledige inrichting is een schaalbaarheidsbevinding. Zij wordt niet vermengd met de tijd voor een gewone maand, lokale commit of cloudsynchronisatie. De uiteindelijke financiële-/prestatie-uitkomst volgt afzonderlijk; alleen een voorbereide operatie is geen geslaagde eindproef.

De eerste operationele driejaarsronde bevestigt tien eigen lokale commits in 27.469 ms, UI-resultaat 28.070 ms en daaropvolgende cloudbevestiging 42.147,8 ms. Koude start 16.334,1 ms, warme start 19.143,9 ms, historische maand 14.318,7 ms, individuele goedkeuring inclusief UI 5.470,6 ms en individuele sync 40.442,9 ms. Het twintigsecondenmeetdoel wordt in deze ronde niet gehaald; alle tien commits zijn wel bevestigd. Deze tussentijdse afronding vervangt de nog volgende volledige financiële eindcontrole niet. De gate blijft haar oorspronkelijke norm toepassen en zal een overschrijding ook na financieel correcte eindcontrole afkeuren.

## Architectuurbeoordeling na de grote meting

De drie operationele groepen bevestigen tien lokale commits in 27.469, 26.964 en 27.717 ms (mediaan 27.469, maximum 27.717 ms). De werkset bij de gewone maandroute blijft circa 1.458 bron-/effectrecords; de volledige driejaarshistorie wordt niet als maandweergave geladen. Toch telt de eerste CSV/groepsfase 1.154.554 JSON-serialisaties, 321.174 fysieke SHA-berekeningen, 85.795 storecodec-vergelijkingen en 55.071 payloadPart-gets voor 85 gewijzigde recordversies. Elf financiële validaties blijven uitgevoerd. Geneste spans: JSON 11.792 ms, encoder 8.788 ms, financiële validatie 4.452 ms, native commits 5.889 ms. Deze overlappende tijden worden niet opgeteld. Er zijn geen cloudfetches in de lokale groepsfase.

De oorspronkelijke klacht over herhaalde technische voorbereiding is dus gedeeltelijk verholpen, niet verdwenen. De 500-norm is gehaald en ongewijzigde historie wordt niet opnieuw geschreven, maar veel technische bewijsstructuren worden bij ieder groepslid opnieuw gelezen, vergeleken en samengesteld. De driejaarsgroep is niet constant in administratie-/bewijsomvang. De voorlopige ruimtetoename is 12.604.822 → 17.759.070 → 31.577.668 bytes voor inrichting en de eerste twee operationele ronden, inclusief historisch laden; dit is geen zuivere bytes-per-goedkeuringmeting.

Advies voor een volgende technische beoordeling: leg per laag vast welke bron, revisie, epoch, afhankelijkheid, foutuitkomst en bewaartermijn zij bewijst. Beoordeel de overlap tussen kandidaat/journal, periodcontext, cloudbasis, outbox en beschermde oude roots vóór verdere caches of micro-optimalisaties. Onderzoek een expliciete kleine mutatie-/afhankelijkheidsvoorbereiding tegen één bewezen duurzame basis, met dezelfde canonieke motor en afzonderlijke commits. Bewijs eerst op 20/100 dat geen bron-, saldo-, dekking-, revisie- of herstelcontrole verdwijnt. Verwijder geen bewijslagen of gegevens op grond van snelheidswinst alleen. P4.4 introduceert hiervoor geen nieuw formaat of extra parallelle financiële staat.

Retentie blijft een afzonderlijk ontwerp: beschermde oude roots en receipts zijn niet door de zachte 64 MiB-cachelimiet begrensd. Een veilige vervanging vereist volledige terugleesbare bron-/operatiearchivering, herstel met alle nieuwe boekingen, hetzelfde idempotentiebewijs en een atomair gecontroleerde afwezigheid van pending, offline, conflict en herstelafhankelijkheden. Pas daarna kan onomkeerbare verwijdering afzonderlijk ter goedkeuring worden voorgelegd. De huidige ronde verwijdert uitsluitend bestaande toegestane cachekopieën en geen beschermde financiële bewijzen.
