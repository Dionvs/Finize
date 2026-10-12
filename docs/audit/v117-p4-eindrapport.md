> Actuele beoordeling: het [V117-vrijgaveverslag](v117-vrijgaveverslag.md) vervangt de onderstaande historische stopstatus. De volledige financiële 500- en 5.400-proeven zijn afgerond; de twintigsecondennorm is een prestatiestreefwaarde. Veilige gebruikersafhandeling van financiële conflicten en integraal groot migratie-/herstelbewijs blijven voorwaarden vóór productieactivering. Beide buildhashes en de laatste regressies staan in het actuele verslag. De oudere fouten en meetwaarden hieronder blijven historisch bewijs.

# Finize V117 — P4 en totaaloverzicht

Actuele eindregressie: 622 Node, 42 echte Rules en 283 unieke browsergevallen geslaagd. Eén browsergeval faalt door emulator-geheugentekort bij initialisatie; 24 browsergevallen en drie kleine afsluitende proeven zijn niet geprobeerd. De actuele build is niet volledig groen; zie het vrijgaveverslag.

**Historisch stopverslag.** Het vervolg van 11 oktober staat in het [aanvullende opslagherstelverslag](v117-p4-opslagherstel.md). Hashes en meetwaarden hieronder horen bij de eerdere stopbuild. Het laatste gebruikersverzoek vervangt de eerdere slaapstandopdracht: de pc blijft aan.

## Status en begrenzing

P4 is gestopt bij een grote opslagblokkade op `agent/v117-stabilisatie`, vanuit de geaccepteerde P3-commit `1db602a0986f09e5739169f9de40c1debe95abf9`. P4 is niet geaccepteerd of releasegereed. De schaalproef met 500 afzonderlijke bankbewegingen over drie maanden faalt bij herhaald gebruik op een echte IndexedDB-quota. De overige controles worden afzonderlijk vastgelegd; groene deelresultaten heffen deze blokkade niet op.

Er zijn geen productie-Firestore-verbindingen, migraties, regelpublicaties, deployments, pushes of merges naar main uitgevoerd. De Dashboard-interface en financiële motor zijn behouden. Kleine noodzakelijke bedieningen zijn toegevoegd in Data & back-up en in de bestaande salarisverwerking. Er zijn geen beschermde financiële gegevens verwijderd. De eerdere slaapstandopdracht is vervallen.

**Releaseblokkade:** verschillende financiële goedkeuringen van dezelfde bankbron blijven veilig geblokkeerd met beide versies en operatiebewijzen. Een ondersteunde gebruikersroute om dit conflict financieel te herbeoordelen ontbreekt nog. Het afzonderlijke [productie-releaseplan](v117-productie-releaseplan.md) bevat een concreet voorstel en veilige rollbackvoorwaarden; dat plan is niet uitgevoerd.

## Herstelpunt en controle van bestaande wijzigingen

Vooraf zijn 268 bestanden met SHA-256 teruggelezen en geverifieerd in `backups/v117-stabilisatie/before-p4-2026-10-10`. Het herstelmanifest heet `backup-manifest.json`; SHA-256: `534B77E378B7C2BBD9BFBC45C38B9F62040F9056B54ADD064E9D29A41C411862`. Dit is een technische broncodeback-up, geen productiegegevens-export. De 14 vooraf aanwezige lokale wijzigingen zijn beschermd. De emulatorlog is na afsluiten uit dit herstelpunt teruggezet.

De eerdere eindruns gebruikten `backups/v117-stabilisatie/p4-final-build-manifest.json`. De uiteindelijke stopbuild staat in `p4-stop-build-manifest.json`; alle opgenomen bron-, test-, configuratie- en buildbestanden zijn na de suites opnieuw vergeleken. PWA-assets gebruiken gezamenlijk `117-p4`; CSS heeft dezelfde bytes als vóór P4.

Actuele app.js SHA-256: `278c265f00e96252cec12e231e316fccd0574813606474bf29a5dff3163ea5a5`. De stopverificatie bewaart de build in `backups/v117-stabilisatie/p4-stop-build-manifest.json`, uitkomsten in `p4-stop-suite-status.json` en de log in `p4-stop-all.log`. De afzonderlijke schaaldiagnose staat in `p4-scale-storage-diagnostic.log` en `p4-scale-failure-3.json`. De oudere `p4-final-suite-status.json` staat terecht op niet voltooid; er bestaat geen groen compleet P4-eindbewijs.

## P1–P3: behouden contracten

| Pakket | Geaccepteerde basis en behouden gedrag |
| --- | --- |
| P1 | `committed`, `rejected`, `uncertain`; intentie zonder duurzaam bewijs wordt niet heruitgevoerd; readback na verloren bevestiging; centrale status en tien afzonderlijke broncommits bij bulkgoedkeuring. Historisch bewijs: [stabilisatieverslag](v117-stabilisatie.md). |
| P2 | IndexedDB is na gecontroleerde migratie de enige lokale financiële schrijfwaarheid. Eén awaited transactie voor records, imports, revisie, receipt, journal en outbox; oorspronkelijke localStorage-kopie blijft beschermd; huishoudscope. Bewijs: [P2-verslag](v117-p2-verslag.md). |
| P3 | Recordopslagversie 2, epoch, Security Rules, hervatbare staged cloudoperaties, manifesten, periodequeries, geverifieerde cumulatieve basis en dezelfde canonieke motor. Alleen expliciete testcloud aangesloten. Bewijs: [P3-aanvulling](v117-p3-aanvulling-verslag.md). |

Eerdere pakketresultaten zijn historisch bewijs; de P4-eindsuites controleren de actuele combinatie opnieuw. Onbekende of ontbrekende financiële perioden blijven fouten en worden niet als nul gerekend. Globale planning, volledige importlevenscyclus en herstel/export mogen nog steeds een expliciete volledige integriteitscontrole vereisen. Gewone maandweergaven en transacties gebruiken het geladen, bewezen afhankelijkheidsdomein.

Historische verificatie: P1 registreerde 565 Node-gevallen in 53 bestanden; 240 browserscenario's in de volledige toenmalige run en vervolgens 23 gerichte controles na de laatste P1-aanpassing (de uiteindelijke 241 gevallen zijn toen niet allemaal samen herhaald). P2 registreerde 572 Node-gevallen in 54 bestanden en 266/266 browserscenario's op één build. De geaccepteerde P3-aanvulling registreerde 589 Node-gevallen in 56 bestanden, 273/273 browserscenario's en 39/39 echte emulatorgevallen. Dit zijn geen vervangingen voor de actuele P4-eindcontrole.

## P4-oorzaken en implementatie

1. Geopende maanden bleven in P3 samen het actieve venster vergroten. Een normale ontvangst gebruikt nu de gekozen maand en drie voorafgaande maanden, plus expliciete offline pins en noodzakelijke pending afhankelijkheden. Historische perioden hebben afzonderlijke vervangbare kopieën.
2. Terugbetalingen trokken alle transacties van doelmaanden recursief in het afhankelijkheidsdomein. De closure volgt nu de matching financiële uitgaven en hun eigen bron-/splitrelaties. Ook variabele uitgaven blijven expliciete afhankelijkheden; een historische categoriecorrectie zonder de afhankelijke terugbetalingsmaand wordt geweigerd. Dit is met de bestaande emulatorregressie gecontroleerd.
3. Offline kopieën hadden geen eigen aantoonbaar opruimcontract. De nieuwe periodecache bewaart huishoudscope, epoch, cloudrevisie, SHA-256, gebruikstijd en pinstatus. Zij accepteert geen financiële mutaties. Ontvangst wordt eerst via P2 duurzaam bevestigd; een latere cache-quota kan die bevestiging niet ongedaan maken of als mislukte financiële commit voorstellen.
4. Een offline pin kon na een nieuwe cloudrevisie verouderen. Bevestigde gerichte synchronisatie ververst het actieve venster en de pins tegen de nieuwe revisie. Bij een netwerkonderbreking blijft het financiële cloudbewijs geldig, maar wordt de noodzaak tot hercontrole gemeld. Een oude of corrupte periodekopie wordt niet als actuele financiële waarheid gebruikt.
5. Een nieuw huishouden had nog geen afzonderlijke cloudinitialisatie zonder legacy-bron. `initializeNew` gebruikt hetzelfde gecontroleerde migratie-/recordprotocol met bronversie 0, volledige terugleescontrole en testactivering. Bestaande legacy-gegevens blokkeren deze route. Initialisatie en productieomschakeling zijn uitsluitend in de emulator toegestaan.
6. De volledige regressie ontdekte dat twee asynchrone acceptaties in de bestaande generatiecloud tegelijk dezelfde lokale basisrevisie konden gebruiken. IndexedDB weigerde de tweede commit terecht, maar de cloudsynchronisatie faalde. Het commit-/publicatiedeel van `acceptRemote` is nu geserialiseerd. Langzame back-ups blijven erbuiten, zodat een verouderde snapshot opnieuw wordt afgewezen vóór zijn commit. Scope- en revisiecontrole blijven gelden; een opslagfout wordt niet blind opnieuw geprobeerd. Een deterministische browserproef houdt de eerste commit tegen, start de tweede en controleert één gelijktijdige write, de duurzame nieuwste stand en afwijzing van een later oud snapshot. Alle 14 gerichte migratie-/acceptatieproeven slagen (`p4-cloud-acceptance-regression.log`).

### Aanvullende synchronisatierace

Een aanvullende deterministische proef toonde daadwerkelijk verlies van een lokaal bevestigde goedkeuring tijdens de asynchrone voorbereiding van een oude cloudontvangst. Het bewijs vóór reparatie (`p4-remote-local-overlap-before.json`) heeft `localCommitted: true`, `remoteAccepted: true`, `visibleLocal: false`, `durableLocal: false`. De cloudroute gebruikt nu de bij aanvang vastgelegde lokale commitidentiteit: een latere lokale commit wordt behouden met outbox en operatiebewijzen; de remote stand wacht op afzonderlijke controle. Ook tijdens laden van spaardoelafbeeldingen wordt deze grens opnieuw gecontroleerd. Andere geserialiseerde cloudontvangsten mogen hun gecontroleerde basis wel doorgeven. De 16 gerichte migratie-/cloudbrowsergevallen slagen, inclusief beide onderbrekingsgrenzen en herladen (`p4-remote-local-overlap-regression-2.log`, 16,5 seconden). Deze gerichte controle is vervolgens in de stopverificatie op dezelfde appbuild herhaald.

Dezelfde 16 gevallen slagen ook in de uiteindelijke reeks van 291 overige browsergevallen. De quotafout blijft daarvan afzonderlijk als falend geval vastgelegd.

### Budgetten OV en Overig

De fout is vóór reparatie in twee browserscenario's gereproduceerd (desktop 1440 px en mobiel 390 px): €50 bij OV en €20 bij Overig leverden €70 in het OV-overzicht. De oude `budgetCategoryMatches` gebruikte gedeeltelijke tekstvergelijking in beide richtingen. De totale canonieke uitgave werd niet verdubbeld; de budgettoewijzing en detailweergave waren verkeerd en verschilden tussen schermen. Bewijs: `backups/v117-stabilisatie/p4-ov-overig-before.log`.

`budget-assignment.mjs` bepaalt nu centraal de stabiele budget-ID binnen de juiste persoon en financiële maand. CSV- en handmatige goedkeuring bewaren die identiteit; selectors, budgetbedragen en details gebruiken dezelfde koppeling. Alleen een unieke, exact genormaliseerde naam mag een legacy-transactie zonder ID uitlezen. Een gedeeltelijke naam of een ambigue naam levert geen koppeling op. Een aangeleverde onbekende ID wordt bij nieuwe verwerking geweigerd. Historische planning bepaalt de naam van de oorspronkelijke maand. Splitsingen erven nooit ongemerkt de budget-ID van hun parent. Er vindt geen automatische herschrijving van bestaande transacties plaats.

Vier gerichte browserproeven slaagden vóór de gecombineerde eindcontrole: beide schermformaten, echte CSV-goedkeuringen voor beide budgetten, aparte bedragen en bronnen, historische hernoeming, herladen, emulator en tweede client. Bewijs: `p4-ov-overig-after-2.log`. De eindrun hieronder moet dezelfde reparatie opnieuw bewijzen.

### Salarisplanning en persoonskoppeling

De oude salarisroute hield bij een gezamenlijke ontvangst de persoonsplanning aan en telde daarnaast de ontvangst op. De voorproef registreerde €8.230 bij gepland Dion €2.500, gepland Dara €3.200 en ontvangen Dion €2.530. Daarnaast kon een legacy-heuristiek een persoon kiezen op basis van bedrag en omschrijving. Bewijs: `p4-salary-double-count-before.json` en `p4-salary-before.log`.

`salary-assignment.mjs` koppelt een expliciet goedgekeurd salaris aan Dion of Dara, de stabiele bron `income-defaults-salary-<persoon>` en de bankmaand. `incomeDefaultsHistory` blijft de planning; de bestaande prognosemotor vervangt voor die persoon en maand de planning door het werkelijke salaris. De planning blijft beschikbaar voor vergelijking. Dion €2.530 en Dara €3.200 leveren samen €5.730, met ongewijzigde planning. De gecontroleerde fixture geeft zakgeld €2.198,85 / €2.781,15 en ongewijzigde spaardoelmutaties. Een salarisontvangst op de gezamenlijke rekening maakt geen voorschot aan.

Het bestaande CSV-scherm toont alleen bij salaris de keuze Dion/Dara. Een voorstel vereist een exact overeenkomende werkgeversrekening én ontvangende rekening, plus eerdere actieve handmatige salarisgoedkeuringen die één persoon aanwijzen. Het bedrag speelt geen rol. Tegenstrijdige of ontbrekende herkenning laat de keuze leeg. Deze herkenning gebruikt de geladen goedkeuringen; een niet-geladen oude betaling geeft geen voorstel en vraagt handmatige keuze. Voorstellen geven nooit automatische goedkeuring. Vakantiegeld, bonus en nabetaling blijven afzonderlijke inkomsten, ook als een werkgeversregel eerder salaris voorstelde. Andere inkomsten vereisen geen persoon.

Een expliciete wijziging van persoon vervangt de oude verwerking met dezelfde bron, eigen operatiebewijs en nieuwe revisie. Bankbedrag, bankdatum en bronidentiteit blijven behouden. Bij maandgrenzen geldt de bankmaand; er wordt geen andere salarismaand geraden. Een salarisafschrijving kan niet als positieve ontvangst worden verwerkt. Oude gezamenlijke salarisbetalingen zonder betrouwbare persoonskoppeling worden niet toegewezen op bedrag of tekst. De app toont 'Salaris koppelen' en blokkeert onbetrouwbare prognoses tot handmatige herbeoordeling via de bestaande editor. Deze controle blokkeert ook cloudprojecties/migratie van onopgeloste oude betalingen; dit is een gegevensafhankelijke releasevoorwaarde.

De praktijkproef ontdekte daarnaast dat de bestaande importlezer bij heropenen altijd een beschikbare cloudkopie verlangde, ook voor een nieuwe lokaal bevestigde import met een nog open outbox. Alleen bij een expliciet ontbrekende cloudheader én een open outbox wordt nu de duurzame lokale import geopend. Ontbrekende bevestigde imports, onvolledige delen en corrupte bewijzen blijven fouten. De bestaande cloud-importtest controleert die drie grenzen; de salarisproef controleert daadwerkelijk wijzigen vóór de eerste sync.

## Opslagcontract en interfaces

IndexedDB wordt niet-destructief opgewaardeerd van databaseversie 2 naar 3. Het lokale inhoudscontract blijft `storageVersion: 1`, `schemaVersion: 11`. De objectstore `periodCache` en indexen `imports.status` / `periodCache.offline` worden toegevoegd. Oude verbindingen sluiten bij versionchange; een geblokkeerde upgrade stopt en kan worden herhaald. Een oude versie-2-opener kan de opgewaardeerde database niet terugdraaien.

`createPeriodCache` biedt `usage`, `remember`, `read`, `pin`, `pinnedPeriods` en `evict`. `defaultPeriodWindow` bepaalt vier kalendermaanden, ook over jaargrenzen. `openMonth` gebruikt deze policy binnen de bestaande recordsessie. `initializeNew` is de expliciete emulatorinitialisatie. `createProductionRecordTransport` is alleen voorbereid: een standaardconfiguratie weigert vóór enig verzoek. Geauthenticeerd huishouden, opslagversie, minimaal client 117, actieve vrijgave en epoch zijn verplicht; daadwerkelijke regels blijven de beveiligingsgrens. De huidige app biedt uitsluitend `createEmulatorSession` op localhost.

`evict` neemt head, records, outbox, journals, queue, imports en periodecache in één readwrite-transactie. Pending writes, conflicten, open imports en herstelafhankelijkheden blokkeren opruiming. Het werkelijk duurzaam geselecteerde maandvenster en pins worden daar opnieuw gelezen. Gedeelde canonieke records blijven intact: uitsluitend volledige afzonderlijke periodekopieën worden verwijderd. Opruiming schrijft geen financiële head en maakt geen financiële operatie. Een herladen periode moet opnieuw hashes, revisie, projecties en dependencies bewijzen.

De zachte 64 MiB geldt uitsluitend voor vervangbare periodekopieën. Offline pins, brongegevens en bewijzen kunnen daarboven groeien. Als vier beschermde recente maanden zelf meer vragen dan de richtwaarde, worden ze behouden. Opruiming is geen financiële verwijdering en geen garantie voor onbeperkte browserquota.

## Opslagverantwoording en retentie

### Grote blokkade: echte quota bij de 500-bronnenproef

De aanvullende browserdiagnose met de echte emulator voltooide zeven van tien meetronden. In ronde acht faalde de afzonderlijke goedkeuring van €1. De financiële uitkomst bleef €5.857 in plaats van de verwachte €5.858; de importweergave meldde nul goedgekeurde regels. De geïnstrumenteerde IndexedDB-transacties bevestigen `QuotaExceededError` op de huishoudelijke financiële transactie én vervolgens op de `journal`-transactie. Dit is geen geïnjecteerde testfout. De eerdere eindrun 8 had eveneens een werkelijke quotafout, toen tijdens synchronisatie na zes afgeronde meetronden.

| Meetpunt | Getelde gegevensinhoud (MiB) | Browser-originopslag (MiB) |
| --- | ---: | ---: |
| Begin | 15,22 | 3,67 |
| Ronde 1 | 16,52 | 62,33 |
| Ronde 2 | 17,28 | 121,86 |
| Ronde 3 | 18,03 | 182,88 |
| Ronde 4 | 18,79 | 245,58 |
| Ronde 5 | 19,54 | 309,94 |
| Ronde 6 | 20,30 | 375,84 |
| Ronde 7 | 21,05 | 443,29 |
| Na fout in ronde 8 | 47,12 | 451,50 |

De gemeten testquota was 451,65 MiB. De originraming en JSON-payloadmeting zijn verschillende meetmethoden, met onder meer interne databaseopslag, compressie en mogelijk vertraagde ramingen. Het exacte interne aandeel per objectstore is niet bewezen. De groei bij dezelfde beperkte administratie is wel reproduceerbaar en blokkeert acceptatie. Schijfcontrole tijdens onderzoek toonde circa 324,67 GB vrij op C en 9,51 GB vrij op G; dit is geen bewijs van algemene schijfvolte. Een grotere browserquota instellen zou deze fout verbergen, niet oplossen.

De broninspectie toont dat een wijziging van kleine cumulatieve metadata het grote `__finizePeriodContext`-record verandert. De lokale outbox bewaart voor-/naversies van gewijzigde records; ontvangst en cacheverversing schrijven daarnaast grote bewijssets. Dit is een concrete vervolgrichting voor het onderzoeken van schrijfversterking, geen al bewezen verdeling van de interne browserbytes. De beschermde noodback-updatabase nam in deze diagnose nul bytes in en is dus niet als oorzaak aangewezen. De aanvullende herstelgegevens bij de fout verklaren de sprong in getelde journal-/outboxinhoud; zij zijn beschermd gebleven.

| Opslagcategorie bij fout | Bytes UTF-8 JSON |
| --- | ---: |
| Actieve financiële records | 6.152.815 |
| Offline bewaarde perioden | 0 |
| Open CSV-imports | 2.391 |
| Historische CSV-imports | 156.562 |
| Synchronisatie-outbox | 11.385.703 |
| Operatiebewijzen | 35.057 |
| Conflicten en hersteljournals | 22.222.430 |
| Beschermde migratiekopieën | 81.945 |
| Vervangbare periodecache | 9.316.741 |
| Opslagmetadata | 58.263 |
| Planningsbijlagen | 0 |

De categorieën zijn exclusief toegewezen; overlap in de byteverdeling is nul. Logische kopieën en referenties zijn wel aanwezig. De afzonderlijke offline-pinproef controleert bescherming van pins; nul offline bytes in deze schaalfixture betekent niet dat pins elders ongetest zijn.

De foutcontext noemt de opslagfout in het importresultaat als `1 ongeldig`. Dit is een aanvullende tekortkoming: een infrastructuurfout moet als opslag-/herstelprobleem worden gemeld, niet als ongeldige financiële invoer. Er is geen volledige herstart-/herstel-/tweede-clientcontrole van de 500-bronnenadministratie ná deze daadwerkelijke quotafout voltooid. Evenmin zijn alle tien herhalingen of de afsluitende complete cloud-/cache-invarianten geslaagd. De aparte geïnjecteerde quota-/herstelproeven vervangen dit ontbrekende eindbewijs niet.

Noodzakelijk vervolg staat in het productieplan: splits onveranderlijke bewijsdelen en mutabele metadata onder een expliciet opslagcontract, vermijd onnodig herschrijven van gelijke cachekopieën, bescherm alle pending afhankelijkheden en bewijs hervatten na echte quota opnieuw. Er is geen risicovolle nieuwe opslagmigratie of verwijdering van herstelgegevens uitgevoerd om de proef groen te maken.

`usage()` leest uitsluitend op expliciet verzoek een volledige opslaginventaris. Gewone maandweergaven en commits doen dit niet. De meting telt UTF-8 JSON-payloads van alle objectstores en de beschermde lokale migratiebron. Het resultaat verdeelt die bytes over:

- actieve financiële records;
- offline bewaarde periodekopieën;
- open en historische CSV-imports afzonderlijk;
- synchronisatie-outbox inclusief bewaarde cloudbasis;
- operatiebewijzen;
- conflicten en hersteljournals;
- beschermde migratiekopieën, eerder geladen niet-actieve records en legacy-bron;
- vervangbare periodecache;
- opslagmetadata.
- planningsbijlagen zoals spaardoelafbeeldingen.

De inventaris omvat ook huishoudgebonden migratie- en noodback-updatabases, beschermde localStorage-kopieën en spaardoelafbeeldingen. Gegevens van een ander huishouden tellen niet mee. Deze inventaris maakt geen ontbrekende database aan en verwijdert geen back-up.

Categorieën vormen een fysieke byteverdeling; hun overlap is nul en hun som moet gelijk zijn aan de totale payload. Dit betekent niet dat inhoud nergens dubbel is opgeslagen: actieve state, cloudbasis, bewijsrecords en cachekopieën bevatten bewust verwijzingen of kopieën van dezelfde financiële informatie. De browsermeting `navigator.storage.estimate()` staat daarnaast apart en is voor de hele origin, inclusief onder meer applicatiecache en interne overhead. Zij wordt niet als exacte huishoudmeting voorgesteld. IndexedDB-indexen en paginering zijn niet uit JSON-byteaantallen af te leiden.

Beschermde opslag groeit met imports, receipts, journalbewijzen en bezochte oude records. P4 verwijdert die niet. Het [retentievoorstel](v117-productie-releaseplan.md#retentievoorstel--geen-beschermde-gegevens-verwijderd) vereist eerst een geverifieerde vervanging, complete herstelketen, idempotentiebewijzen en afwezigheid van alle beschermde afhankelijkheden. Geen loutere leeftijdsgrens rechtvaardigt vernietiging.

## Testomgeving en bewijs

Windows 11 Home 10.0.26200, AMD Ryzen 5 5500U, 12 logische processors, 7.34 GiB zichtbaar RAM. Node 24.19.0, Playwright 1.55.0, Chromium 140.0.7339.16. De app draait lokaal op 127.0.0.1:4173 en de echte Firestore-emulator op 127.0.0.1:8181 met demo-finize-v117 en de bestaande rules/indexen. Java 21 gebruikt voor de eindcontrole `-Xmx3g`; een eerdere langlopende emulator met verzamelde ontwikkelfixtures is vóór de controle herstart na een synchronisatietimeout. Externe Firebase-SDK- en productie-Firestore-verzoeken worden in de browsertests geblokkeerd. Firebase-authenticatie is een expliciete testdriver; Security Rules gebruiken echte emulatortokens, geen rules-testdouble.

De gebruiker heeft tijdens uitvoering uitsluitend het schaaltestdeel gewijzigd naar **500 afzonderlijke bankbewegingen over drie maanden**. De proeven met 150, 1.800 en 5.400 zijn voor nu vervallen. Deze beperking verandert de overige P4-controles niet. De definitieve fixture bevat 168 bronnen in augustus, 166 in september en 166 in oktober 2026, op twee rekeningen in zes CSV-batches. De bestaande financiële varianten blijven aanwezig: vaste lasten en budgethistorie, inkomsten, sparen/opnemen, terugbetalingen naar eerdere maanden, interne overboekingen, splitsingen over financiële maanden, spaardekking en een historische doelcorrectie. Afhankelijke financiële effecten kunnen buiten de drie bankmaanden vallen. De fixture materialiseert via de bestaande motor. Gelijke zichtbare velden hebben verschillende betrouwbare bronidentiteiten.

De 500 beginbronnen worden als reproduceerbare historie via de bestaande financiële motor opgebouwd en vervolgens werkelijk in de emulator geïnitialiseerd en in de browser geladen. De daaropvolgende CSV-imports en individuele/groepsgoedkeuringen verlopen via de werkelijke browserbediening. Zeven complete ronden bevatten 77 nieuwe goedkeuringen; de volgende afzonderlijke goedkeuring faalt. De volledige nieuwe-installatieproef begint daarnaast met een leeg huishouden en voert de eerste CSV-import zelf via de interface uit. Dit zijn verschillende bewijsroutes; de 500 beginbronnen zijn niet alle afzonderlijk via 500 browserklikken ingevoerd.

Voor deze omvang worden tien koude en warme starts, maandladingen, individuele goedkeuringen, tienvoudige groepsgoedkeuringen en synchronisaties gemeten. Koud betekent een nieuwe browsercontext met lege IndexedDB; warm betekent herladen van dezelfde lokale administratie. Dit is geen meting van een koude hardware-/OS-cache. Eerste cloudinitialisatie staat apart. Metingen rapporteren mediaan, maximum en ruwe waarnemingen, transportdocumenten en opslagcategorieën. Geheugen wordt niet als betrouwbare appmeting geclaimd. Lokale emulatorlatentie en gelijktijdige testbelasting zijn geen productiesnelheid. Drie bankmaanden passen geheel binnen het beschermde viermaandsvenster; deze proef bewijst daarom geen prestatielimiet voor jaren aan historie. De afzonderlijke P3-regressies met 36 maanden blijven gericht laden controleren.

Goedkeuringstijd begint bij de expliciete bevestigingsklik, nadat de CSV is ingelezen en de bestemming is gekozen; CSV-parsetijd is hierin niet inbegrepen. De afzonderlijke synctiming betreft de individuele wijziging; documentverkeer voor de tienvoudige goedkeuring en haar sync staat als gecombineerde meting apart. Metingen van eerste initialisatie en volledige integriteitscontrole vallen buiten gewone maand- en committijden.

### Gedeeltelijke prestaties vóór de quotablokkade

Dit zijn uitsluitend de voltooide metingen uit de falende aanvullende diagnose. De gevraagde tien herhalingen zijn niet gehaald. Eerste cloudinitialisatie duurde 33.648,6 ms. Koude en warme starts hieronder omvatten ook het aansluiten en geverifieerd openen van de recordsessie; zij zijn dus geen geïsoleerde JavaScript-/DOM-opstartmeting.

| Handeling | Voltooide metingen | Mediaan (ms) | Maximum (ms) |
| --- | ---: | ---: | ---: |
| Koude start met cloudperiode | 8 | 3.909 | 4.095 |
| Warme herstart met cloudperiode | 8 | 5.112 | 5.358 |
| Maandladen | 8 | 2.499 | 2.736 |
| Individueel goedkeuren | 7 | 2.616 | 2.884 |
| Tien geselecteerde goedkeuren | 7 | 17.206 | 18.597 |
| Synchronisatie na individuele goedkeuring | 7 | 12.907 | 33.742 |

De eerste individuele sync telde 2.139 transportaanvragen, 8.187 documentreads, 2.619 writes en 11.727.123 aanvraagbytes. De zevende telde 303 aanvragen, 4.859 reads, 47 writes en 888.576 aanvraagbytes. De eerste tienvoudige goedkeuring plus sync telde 498 aanvragen, 4.609 reads, 201 writes en 1.073.499 aanvraagbytes. Deze aantallen zijn transportmetingen, geen gefactureerde productie-eenheden; meerdere kleine aanvragen zijn samen groter dan één API-aanvraaglimiet. De hoge eerste sync en de gewone syncbelasting vragen verdere optimalisatie en herhaalde verificatie. De normale goedkeuringshandeling zelf deed in deze metingen nul cloudverzoeken vóór de expliciete sync.

Alle zeven complete ronden doorliepen de controle op nul volledige `financialRecords.getAll()`-reads tijdens gewone handelingen. De expliciete opslaginventaris na iedere ronde valt buiten die controle en timing. De proef heeft de afsluitende volledige cloudcontrole en opruiming/herladen niet bereikt. Daarom is geen correct eindtotaal na tien ronden of complete schaalacceptatie bewezen.

Financiële controles vergelijken alle door de bestaande motor geleverde effectdimensies in eurocenten, categorieën, prognoses, unieke bronnen en aantallen effecten met de volledige canonieke administratie. Na iedere herhaalde goedkeuring/sync blijft het aantal precies één per bankbron. Cacheopruiming, herstart en opnieuw historisch laden moeten dezelfde resultaten geven. De expliciete controle op de complete cloudadministratie valt buiten normale maand-/committiming.

De aparte canonieke referentie `backups/v117-stabilisatie/p4-financial-reference.json` bevat vóór de metingen 500 bankbronnen en 536 effecten. Splitsingen verklaren het verschil. Tien meetronden voegen 110 nieuwe bronnen en effecten toe; de verwachte eindstand bevat 610 bronnen en 646 effecten. De referentie alleen is geen syncbewijs: de volledige browserproef vergelijkt de echte cloudresultaten met deze canonieke berekening.

| Financiële dimensie | Canonieke beginreferentie (centen) | Verwacht na tien rondes, niet bereikt (centen) |
| --- | ---: | ---: |
| Rekeningkasstroom | 4.114.000 | 3.363.000 |
| Externe huishoudkasstroom | 4.250.800 | 4.250.800 |
| Werkelijke inkomsten | 5.400.000 | 5.400.000 |
| Werkelijke uitgaven | 1.221.200 | 1.221.200 |
| Budgetimpact | 428.200 | 428.200 |
| Vaste-lastenrealisatie | 720.000 | 720.000 |
| Spaarstortingen | 180.000 | 931.000 |
| Spaaropnamen | 90.000 | 90.000 |
| Spaardoelmutaties | 90.000 | 841.000 |
| Spaardekking | 1.000 | 1.000 |
| Niet gebruikte spaaropnamen | 89.000 | 89.000 |
| Terugbetalingen | 72.000 | 72.000 |
| Voorschotterugbetalingen | 0 | 0 |

In deze verwachte canonieke eindreferentie bedragen de extra spaarstortingen exact 751.000 cent en gaat het doelsaldo van €2.150 naar €9.660. Dit eindresultaat is door de quotafout niet in de complete browserproef bereikt of teruggelezen. Maandprojecties vergelijken daarnaast categorieën, inkomstenplanning, zakgeld, splitsingen, interne overboekingen, maandcorrecties en prognoses; de oorspronkelijke planning wordt niet overschreven.

## Definitieve testresultaten

De uitkomsten en bestandscontroles worden vastgelegd in `v117-p4-bewijs.json` met status `P4-blocked`. Een falende eerste run wordt niet verborgen; gerichte hercontrole en eindcontrole zijn afzonderlijke resultaten. Alleen een simulatie of een groene deelrun rechtvaardigt geen volledige acceptatie.

De vastgelegde stopbuild heeft 58 Node-testbestanden doorlopen: 606 geregistreerde testgevallen (0 overgeslagen) in 24 bestanden en 34 aanvullende assertiescripts, allemaal geslaagd. Syntax, CSS en byte-reproduceerbaarheid van gegenereerde assets zijn geslaagd. CSS meldt uitsluitend de bestaande ongedefinieerde token `--line`. De echte Firestore-emulatorsuite heeft 42 gevallen doorlopen: 42 geslaagd, 0 mislukt en 0 overgeslagen, in 100,862 seconden.

De actuele browserset heeft 292 unieke gevallen. De schaaldiagnose is één werkelijk uitgevoerd falend geval (9,5 minuten). Daarna zijn de overige 291 uitgevoerd op dezelfde appbuild: 291 geslaagd, 0 mislukt, 0 overgeslagen; Playwright rapporteert 6,9 minuten, totale procesduur 426,601 seconden. Het command voor deze aanvullende run gebruikt `--grep-invert '500 bank movements'`: het reeds uitgevoerde falende schaalgeval is daarin expliciet uitgesloten. Over beide runs samen: 292 uitgevoerd, 291 geslaagd, 1 mislukt, 0 overgeslagen. Dit is geen groene complete P4-suite.

De stopverificatie bevestigt alle 209 opgenomen build-/bron-/test-/configuratiebestanden bytegelijk na de suites, inclusief app.js SHA-256 `278c265f00e96252cec12e231e316fccd0574813606474bf29a5dff3163ea5a5`. De nieuwe-installatie-, offline-, cache-, conflict-, budget-, salaris- en PWA-gevallen maken deel uit van de 291 geslaagde browsergevallen. Er zijn geen daadwerkelijke productiedata of productiemigraties getest. De emulator is na afloop afgesloten en de vooraf bestaande emulatorlog is teruggezet. Alle 14 oorspronkelijke lokale wijzigingen en alle 268 herstelkopieën zijn opnieuw met SHA-256 gecontroleerd in het bewijsbestand.

De complete werkstand en relevante bewijsbestanden zijn als 298 teruggelezen en geverifieerde bestanden aanvullend vastgelegd in `backups/v117-stabilisatie/p4-stop-snapshot-2026-10-11`, met een eigen `manifest.json`. De code blijft lokaal en ongecommit op de ontwikkelbranch. De afzonderlijke productie-/herstelplanning is een voorstel en wordt niet uitgevoerd. De destijds opgenomen slaapstandopdracht is later vervallen. Er wordt na het aanvullende opslagherstelverslag geen slaapstand aangevraagd.

Gerichte salariscontrole vóór deze eindrun: vier browsergevallen geslaagd in 24,4 seconden (`p4-salary-browser-9.log`), inclusief het zichtbare blok bij onbetrouwbare oude salarissen in zowel de actieve als een historische maand. Gerichte conflictcontrole met de schone echte emulator: geslaagd (`p4-salary-conflict-browser-5.log`; diezelfde deelrun bevatte nog een afzonderlijke testbedieningsfout die later is hersteld). De salarisbediening en cachekaart zijn als screenshot geopend en visueel gecontroleerd.

### Afwijkingen tijdens ontwikkeling en hercontrole

Eerdere logs blijven bewaard. De eerste cache-/quota-/periodeproeven vonden een verloren maandinvoer bij asynchrone herweergave, een ongeobserveerde IndexedDB-abortmelding na een synchrone quota-exceptie en een te beperkte dependencyselectie voor variabele terugbetalingen. Deze oorzaken zijn centraal hersteld en worden opnieuw door de eindsuite gecontroleerd. De eerste eenmaandsschaalproef bereikte de tiende ronde, maar gebruikte ten onrechte een strikt kleiner-dan-vergelijking waar het verwachte aantal exact gelijk is; alleen die eenmaandsverwachting is gecorrigeerd.

De salarisproeven zijn ontwikkeld met stabiele bronrij-ID's en expliciete periodekeuzes. Onjuiste testaannamen over ingeklapte rijen, de validatiedialoog, twee gelijktijdige foutmeldingen, volledige-historieselectors en de afzonderlijke weergave van bewezen duplicaten zijn in de proef gecorrigeerd. De daaropvolgende echte fout bij heropenen van een nog niet gesynchroniseerde import is afzonderlijk in de implementatie hersteld. Een synchronisatietimeout in de oude, langlopende emulator is bewaard; dezelfde conflictproef slaagt na een schone start. Geen van deze eerdere deelruns wordt als definitieve V117-acceptatie gebruikt.

De gecombineerde run `p4-final-all-3.log` is na de eerste browserfout gestopt: twee oude modal-fixtures veronderstelden nog automatisch toegewezen gezamenlijke salarissen. Die fixtures bevatten nu expliciete persoonsidentiteiten; bedragen en financiële verwachtingen zijn behouden. De hercontrole van alle 11 modal- en commitgevallen slaagt (`p4-salary-legacy-regression.log`). De nieuwe negatieve proeven voor ongekoppelde salarissen blijven gehandhaafd. Run 4 ontdekte vervolgens de daadwerkelijke overlappende cloudacceptatie hierboven en is gestopt. De complete controle wordt daarom opnieuw op de aangepaste, vastgelegde build uitgevoerd in `p4-final-all-5.log`. De eerdere runs zijn geen volledige acceptatie.

Run 5 passeerde deze foutpunten en vond twee oude CSV-browserfixtures die een salaris zonder de nieuwe expliciete persoonskeuze probeerden te verwerken. Beide tests kiezen nu via het werkelijke CSV-scherm Dion; de bedragen en financiële verwachtingen zijn gelijk gebleven. Alle 41 gevallen uit de bestaande inkomsten-, transactiemotor- en functionele consolidatiebrowserbestanden slagen (`p4-salary-all-existing-routes.log`, 1,1 minuut). Run 5 is gestopt en de volledige eindcontrole wordt herhaald in run 6. De appbuild is tussen run 5 en 6 bytegelijk.

Run 6 passeerde alle bestaande P1–P3-browsergevallen en ontdekte een timingfout in de nieuwe mobiele budgetproef: de test herlaadde onmiddellijk na klikken op oktober, voordat de asynchrone maandcommit was bevestigd. De foutcontext toont aantoonbaar november met de novemberbudgetten, zonder fout budgeteffect. De proef wacht nu op de duurzaam gepubliceerde geselecteerde maand, zowel bij november openen als bij terugkeren naar oktober. Alle vier budgetscenario's zijn drie keer herhaald: 12/12 geslaagd in 1,3 minuut (`p4-budget-month-confirmation-regression.log`). De uiteindelijke complete run gebruikt vervolgens een schone emulator en dezelfde appbuild, met de bevestigde testbediening.

Run 7 is bij de nieuwe gebruikersinstructie gestopt om uitsluitend de schaalproef aan te passen naar 500 bankbewegingen over drie maanden. De fixture controleert nu expliciet het aantal unieke bankbronrecords en de drie bronmaanden. De fixturegenerator geeft ook de persoonlijke rekeningidentiteit expliciet door, zodat alle 500 bronnen als afzonderlijke bank-source-records bestaan. De appcode is hierbij niet gewijzigd. Run 8 probeerde opnieuw de complete suites met 290 browsergevallen en faalde op een echte quota na zes meetronden. Hij is gestopt bij de afzonderlijk gevonden lokale/cloudrace. Na reparatie zijn twee regressiegevallen toegevoegd; de actuele browserset heeft 292 gevallen. De schaaldiagnose is één uitgevoerd falend geval; de overige 291 worden afzonderlijk op dezelfde appbuild gecontroleerd. De eerdere grootschalige proeven worden niet als geslaagd of uitgevoerd eindbewijs opgevoerd.

## Gewijzigde onderdelen

Nieuwe bronmodules: `src/storage/period-cache.mjs`, `src/storage/storage-inventory.mjs`, `src/core/budget-assignment.mjs` en `src/core/salary-assignment.mjs`. Uitgebreid: `household-store.mjs`, `record-sync.mjs`, `period-projections.mjs`, `cloud-records.mjs`, `firestore-record-transport.mjs`, de bestaande canonieke transactiemotor/-model/-verwerking, CSV-runtime en `src/core/runtime.js`. Gegenereerde `app.js` en gezamenlijke PWA-versies in `index.html` / `service-worker.js`. `package.json`, `scripts/test-p4.mjs` en het emulatorscript geven een reproduceerbare P4-suite.

Nieuwe tests en fixtures: `tests/v117-p4.test.cjs`, `tests/v117-p4-salary.test.cjs`, `tests/browser/v117-p4.spec.cjs`, `tests/browser/v117-p4-scale.spec.cjs`, `tests/browser/v117-p4-budget-identity.spec.cjs`, `tests/browser/v117-p4-salary.spec.cjs`, `tests/emulator/v117-p4.test.cjs`, `tests/helpers/v117-p4-browser.cjs` en `tests/helpers/v117-p4-fixture.cjs`. De bestaande helper `tests/helpers/package5-fixture.cjs` geeft optioneel de echte rekeningidentiteit door; de standaard voor overige proeven blijft gelijk. `hotfix-migration-backup.spec.cjs` borgt geserialiseerde remote commits en behoud van lokale goedkeuringen op twee async grenzen. Bestaande PWA-versieasserties, onveilige oude salarisverwachtingen en de P3-verwachting voor het viermaandsvenster zijn bijgewerkt. De financiële motor is niet vervangen of uitgebreid met een parallel model. Het bewijs-JSON bevat de volledige lijst gewijzigde bestanden en SHA-256-controles.

## Stopmoment

Na de verificatie stopt het werk bij dit verslag voor beoordeling. Het productieplan wordt niet uitgevoerd. Een bekende ontbrekende conflictroute, falende financiële proef, onvoldoende migratiebewijs of onbewezen grootschalige document-/opslaglimiet wordt als blokkade vermeld en niet als releasegereed aangeboden.

## Resterende grenzen en niet-geteste productieonderdelen

- **Grote P4-blokkade:** de 500-bronnenproef faalt op een echte IndexedDB-quota, inclusief een fout bij journalregistratie. De schrijfversterking en herstelroute moeten worden opgelost en opnieuw bewezen. Zeven afgeronde meetronden zijn geen vervanging voor tien geslaagde rondes en de afsluitende invarianten.
- **Releaseblokkade:** een gebruiker kan een afwijkende goedkeuring van dezelfde bankbron nog niet via een ondersteunde herbeoordelingsroute oplossen. Beide versies en bewijzen worden veilig behouden. Alleen het conflictvoorstel is opgeleverd.
- Oude salarissen zonder betrouwbare persoonskoppeling vragen expliciete herbeoordeling. Ze blokkeren de betrokken berekening en cloudmigratie. Er is geen automatische toewijzing of opschoning uitgevoerd.
- De totale beschermde browseropslag is niet begrensd door de periodecache. Imports, receipts, noodback-ups en beschermde historie groeien verder. De inventaris en het retentievoorstel maken dat zichtbaar; compacte archivering en verwijdering van beschermde gegevens zijn niet geïmplementeerd of toegestaan.
- De browsersuite gebruikt Chromium op Windows met mobiele en desktopviewports. Firefox, Safari, echte iOS/Android-apparaten, externe netwerklatentie en browserdruk door andere applicaties zijn niet hiermee bewezen.
- Op verzoek is alleen de schaalmeting van 500 bankbewegingen over drie maanden geprobeerd. Zeven meetronden zijn afgerond; ronde acht faalde. De oorspronkelijk gevraagde 1.800-/5.400-bronnenprestatieproeven zijn geen onderdeel van dit bewijs; meerjarige prestaties blijven onbewezen.
- Authenticatie in de app gebruikt een testdriver; de emulatorregels worden met echte regelsevaluatie en testtokens gecontroleerd. Productie-authenticatie, werkelijke rollen, quota, facturering, regels/indexuitrol en productiedata zijn niet verbonden of getest.
- Salarisherkenning gebruikt alleen geladen eerdere expliciete goedkeuringen. Bij ontbrekende of tegenstrijdige rekeningherkenning blijft handmatige keuze nodig. Bankmaand is de koppelmaand; de app raadt geen afwijkende loonmaand uit tekst of bedrag.
- De testbewijzen horen bij de volledige vastgelegde lokale build, inclusief de behouden vooraf aanwezige lokale wijzigingen. Een schone clone van uitsluitend de P3-commit vertegenwoordigt deze P4-build niet. Codewijzigingen staan lokaal op de ontwikkelbranch; er is geen productiepublicatie uitgevoerd.
