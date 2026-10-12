# V117 P4.2 — lees- en verwerkingsprestaties

## Afbakening en controlepunt

Lokale ontwikkeling op `agent/v117-stabilisatie`, zonder commit, push, productieverbinding, deployment of verwijdering van beschermde gegevens. De pc blijft aan.

Het vooraf gemaakte herstelpunt staat in `backups/v117-stabilisatie/p42-checkpoint-20261011T091711`. Alle 397 opgenomen bestanden zijn teruggelezen en met SHA-256 gecontroleerd. Manifest: `5771174811959a6ba842722e8a150c3a0a8c30a12e00e8470c2a0536868ea163`. Bronbestanden en eerdere bewijsbestanden staan in afzonderlijke mappen; het applicatiebestand `manifest.json` wordt daardoor niet door het technische manifest overschreven.

Definitieve applicatiebuild: `b36e258f9ea0e0cc2a6773acd89c2575b62d62260057ed7e554802426842b3f6` (SHA-256 van app.js). PWA-/assetversie: `117-p4r2`. Financieel schema 11, lokaal opslagcontract 1, fysieke representatie 2 en IndexedDB-versie 4 blijven gelijk. Het volledige verificatiemanifest bevat 218 bron-, test-, script- en configuratiebestanden.

## Bewezen oorzaken

1. De adapter deelde reeds native leesverzoeken binnen een transactie, maar de decoder begon voor ieder logisch record opnieuw. Gedeelde delen werden daardoor opnieuw gehasht en ontleed.
2. De decoder kopieerde iedere tussenuitkomst met `structuredClone`, ook binnen diep geneste bewijsstructuren. In de nulmeting bedroeg het mediane aantal van deze kopieën per bewerking 18.350 bij 20 bronnen en 82.035 bij 100 bronnen.
3. Voor de controle op een open importoperatie werd het volledige journal uitgepakt, inclusief afgeronde operaties en hun historische batch-/herstelgegevens. Dit was geen vereiste voor die controle.
4. De encoder serialiseerde objecten voordat deze tekst gebruikt werd en herhaalde dezelfde hashberekeningen binnen een schrijftransactie. Ook korte gewone strings werden onnodig apart geserialiseerd.

De nulmeting is uitgevoerd vóór optimalisatie met dezelfde optionele instrumentatie. Bij 100 bronnen overschreed de groepsproef de bestaande 20-secondencontrole: op het laatste meetmoment was €495 van €750 zichtbaar, terwijl de verwerking nog liep. Dit is een afgebroken prestatieproef, geen vastgesteld foutief financieel eindresultaat. De timeout is niet verhoogd. De tien bestaande-transactiewijzigingen bij beide groottes waren vóór optimalisatie wel afzonderlijk gemeten.

## Centrale reparaties en levensduur

- `createPayloadDecoder(readPart)` deelt gecontroleerde immutable delen uitsluitend binnen één native database-transactie. Nieuwe transacties lezen en controleren opnieuw, ook als een vorig verzoek hetzelfde bewijs gebruikte. Financiële roots of revisies worden niet tussen transacties gecachet.
- De decoder maakt eenmaal per logisch resultaat een eigen waardeboom. Gelijke subobjecten krijgen afzonderlijke mutable objecten; een wijziging aan één veld of resultaat beïnvloedt geen andere kopie. `undefined`, sleutelvolgorde, Unicode en letterlijk markerachtige gebruikersgegevens behouden hun betekenis.
- De encoder onthoudt exacte teksthashes per schrijftransactie, en identieke strings/objecten uitsluitend binnen één synchrone encodering. Een volgende bewerking kan gewijzigde objecten dus niet uit een vorige objectcache terugkrijgen.
- `getAllMatching(criteria)` selecteert native scalaire journalmetadata vóór het uitpakken van bewijsdelen. Alleen `status`, `operation` en `importId` zijn ondersteund. Gecodeerde queryvelden of ongeldige criteria stoppen veilig. Dit vraagt nog steeds de compacte native journalroots op; er is geen nieuwe persistente index of destructieve migratie.
- `ImportStore.listJournal(criteria)` gebruikt deze selectie voor open importoperaties, herstel en bestaande conflictmeldingen. De volledige lijst blijft beschikbaar voor audit- en bestaande opschoonroutes. Afgeronde bewijzen worden niet verwijderd.
- De optionele meetpunten bewaren zelf geen financiële data. Zonder testobserver zijn ze uitgeschakeld. Zij meten codecwerk, het canonieke financiële verwerkingsplan en de bestaande renderfuncties.

Een vergelijking met de geback-upte oorspronkelijke codec gaf exact dezelfde fysieke roots en geordende deelhashes voor een 100-bronnenjournal en randgevallen met Unicode, escapes, `undefined` en letterlijke markers. Hashes, CAS, commitvolgorde, atomaire publicatie, operatiebewijzen en financiële motor zijn behouden.

## Kleine metingen

Chromium via Playwright, echte native IndexedDB en Firestore-emulator op `127.0.0.1:8181`, project `demo-finize-v117`. De doeltransactie is tienmaal via de bestaande editor afwisselend aan OV en Overig toegewezen. Bankdatum, bedrag en bronidentiteit zijn behouden. Tijdens die tien wijzigingen zijn geen transacties geïmporteerd. De afzonderlijke spaarproef volgt daarna.

| Meting | 20 vóór | 20 na | 100 vóór | 100 na |
|---|---:|---:|---:|---:|
| Editorbewerking, mediaan van 10, ms | 1.501 | 813 | 4.577 | 2.403 |
| Native requests per editorbewerking, mediaan | 1.888 | 1.148 | 6.790 | 4.398 |
| Native payloadPart-gets, mediaan | 1.734 | 1.022 | 6.662 | 4.270 |
| Tussentijdse codec-structuredClones, mediaan | 18.350 | 19 | 82.035 | 19 |
| Maand openen, één meting, ms | 2.385 | 1.385 | 4.660 | 2.890 |
| Warm lokaal starten, één meting, ms | 1.641 | 750 | niet voltooid | 1.934 |
| CSV maken + tien spaartransacties lokaal verwerken, ms | 13.757 | 5.601 | timeout, onvoltooid | 11.921 |
| Alleen lokale groepsgoedkeuring na reparatie, ms | — | 4.484 | — | 10.378 |
| Native payloadPart-gets in CSV + groepsproef | 9.256 | 3.847 | niet vastgelegd bij timeout | 6.762 |

Editorbewerkingen worden circa 46–47% sneller. Bij de groottes van deze gerichte leesproef bleef de totale geschreven payload voor de tien wijzigingen exact gelijk vóór en na de leesreparatie: 549.855 respectievelijk 942.207 UTF-8 JSON-bytes. De 100-bronnenleesproef gebruikt één grotere bewerkte importbatch; deze cijfers mogen niet worden verward met de afzonderlijke opslagacceptatiefixture die extra historie in een andere batch plaatst.

De afzonderlijke opslagacceptatieproef met extra historie in een andere batch is op dezelfde nieuwe app-build herhaald: 549.847 bytes bij 20 bronnen en 577.208 bij 100 bronnen, exact dezelfde uitkomst als vóór deze leesoptimalisatie. Nul ongewijzigde fysieke writes, alle aangevraagde writes duurzaam afgerond. De eerder bewezen besparing van 95,8–98,4% ten opzichte van de oude opslagroute blijft hiermee behouden. Logische fysieke payload groeide in deze tien wijzigingen van 1.100.615 naar 1.604.474 bytes respectievelijk 3.194.097 naar 3.725.317 bytes. Beschermde bewijzen zijn niet verwijderd.

### Tijdverdeling en beperkingen

Voor de spaarproef bij 100 bronnen na reparatie: totaal 11.921 ms, waarvan CSV-aanmaak 1.361 ms en lokale groepsgoedkeuring 10.378 ms; de resterende tijd omvat de Playwright-bediening. Binnen deze totale meting: financieel verwerkingsplan 513 ms, hoofdschermrender 441 ms, importschermrender 18 ms, encoder 4.278 ms, SHA-256 2.597 ms en materialisatie 13 ms. SHA-256 en serialisatie vallen deels binnen de encoder; deze submetingen mogen niet bij elkaar worden opgeteld.

Cloudbevestiging is afzonderlijk gemeten. Na de tien spaarbetalingen: 8.654 ms bij 20 bronnen en 12.674 ms bij 100 bronnen. De som van HTTP-verzoektijden bedroeg 5.425 respectievelijk 5.531 ms; gelijktijdige verzoeken overlappen. Dit meet wachttijd op HTTP inclusief emulator/netwerk, niet afzonderlijk Java-server-CPU. De database-request- en hydratatiewalltijden overlappen eveneens en kunnen groter zijn dan de totale operatieduur. De ruwe verslagen geven aantallen, unieke hashes, duplicaten, transacties, requests per store, CPU-spans en writes per operatie. Geen schijnbaar sluitende optelsom van overlappende tijden.

De native schrijfmeter en tijdinstrumentatie veroorzaken eigen overhead, onder meer door payloadinspectie. De 500-proef gebruikt die zware observer niet. Browseroriginomvang en logische UTF-8 payloadomvang zijn verschillende maten. Compactie, interne databasepagina's en meetruis verhinderen een exacte verklaring van originverschillen; deze verschillen worden niet aan financiële recordgroei gelijkgesteld.

## Verificatiestatus

21 gerichte browsertests slagen op de genoemde app-build: 11 P2-migratie-/commitproeven, 7 fysieke migratie-/integriteits-/queryproeven, 2 bestaande-transactiewijzigings-/herstelproeven en 1 gecombineerde 20/100-prestatieproef. Daarna is één 500-bronnenproef uitgevoerd en niet geslaagd door vertraging. Op deze definitieve build zijn bovendien 44 gerichte Node-testgevallen uitgevoerd, alle geslaagd en nul overgeslagen. Die 44 omvatten de 7 codec-gevallen en de relevante P1/P2/P3-/periodecontracten. Syntax, CSS en reproduceerbare build slagen; de bestaande CSS-waarschuwing voor `--line` blijft bestaan.

| Fase | Geslaagd | Mislukt | Overgeslagen | Betekenis |
|---|---:|---:|---:|---|
| Geïnstrumenteerde browsernulmeting | 0 | 1 | 0 | 20 volledig; 100 tien edits voltooid, groepsproef onderbroken na timeout |
| Tussenmeting met alleen decoderreparatie | 1 | 0 | 0 | Geen definitieve buildacceptatie |
| Definitieve gerichte browsersuite | 21 | 0 | 0 | Alle kleine acceptatie-/herstelproeven groen |
| Definitieve 500-proef | 0 | 1 | 0 | Prestatieblokkade, groep nog bezig |
| Definitieve gerichte Node-suite | 44 | 0 | 0 | Financiële-/opslag-/periodecontracten en codec |

De volledige Node-suite, volledige Playwright-suite, aparte volledige Security Rules-suite en 5.400-proef zijn niet gestart. Dit zijn niet uitgevoerde gates, geen stilzwijgend overgeslagen geslaagde tests. De voorwaardelijke vervolgstap uit P4.2 (eerst een geslaagde 500-proef) is niet bereikt. Het vastgelegde manifest is na de geautomatiseerde stop opnieuw gecontroleerd: alle 218 bestanden onveranderd.

## Eén 500-bronnenproef — acceptatie niet gehaald

Echte Chromium-interacties, echte emulator en daadwerkelijk geladen Security Rules. 500 afzonderlijke bankbronnen, drie maanden, meerdere rekeningen/importbatches en de bestaande representatieve financiële varianten. Eén operationele ronde, geen herhaalde zware benchmark. De testquota is opnieuw 384 MiB, gelijk aan de vorige stopproef; de quota is niet verruimd.

| Meting | Vorige stopbuild, ms | P4.2, ms |
|---|---:|---:|
| Initiële cloud-/lokale testinrichting | 69.886 | 65.011 |
| Koude start inclusief cloudladen | 26.614 | 21.903 |
| Warme start inclusief aansluiten | 35.724 | 23.460 |
| Maand laden | 17.721 | 10.930 |
| Eén CSV-concept maken | 11.394 | 7.058 |
| Eén lokale duurzame goedkeuring | 11.981 | 7.305 |
| Afzonderlijke cloudbevestiging daarna | 52.549 | 34.977 |
| Tien lokale goedkeuringen | niet binnen 20 s | niet binnen 20 s |
| Cloudbevestiging van alle tien | niet bereikt | niet bereikt |

Dit zijn afzonderlijke eenmalige praktijkproeven, geen statistisch vergelijkbare tienvoudige benchmark. De geïmporteerde datasetomvang en testbediening zijn wel dezelfde. Op het laatste 20-secondenmeetmoment bedroeg de zichtbare spaarverwerking €766 in plaats van het verwachte volledige maandtotaal €1.351. De UI meldde nog: “Geselecteerde transacties worden afzonderlijk opgeslagen…”. Geen definitief groepsresultaat; de testcontext is daarna beëindigd. Er is dus geen bewijs dat de groep uiteindelijk maar een gedeelte zou verwerken, maar ook geen acceptatiebewijs dat alle tien na voltooiing, herstart en cloudsynchronisatie correct blijven. Dit wordt nadrukkelijk niet als een nieuwe financiële fout gepresenteerd.

De oorspronkelijke maand-/cumulatieve controles vóór de groep zijn geslaagd. Bij de foutdiagnose waren 511 bankbronnen aanwezig, opslagrevisie 13, nul native database-aborts en geen aangetoonde quotafout. Het aantal bronnen alleen bewijst geen goedkeuring; de tien geïmporteerde bronnen kunnen al vóór financiële verwerking bestaan.

### Opslag bij de afgebroken 500-proef

| Categorie | Uniek toegerekende UTF-8 payloadbytes |
|---|---:|
| Actieve financiële records | 6.775.413 |
| Offline bewaarde perioden | 0 |
| Open CSV-imports | 22.206 |
| Historische CSV-imports | 1.165 |
| Synchronisatie-outbox | 689.068 |
| Operatiebewijzen | 3.429 |
| Conflicten en hersteljournals, inclusief beschermde oude delen | 1.237.177 |
| Beschermde migratiekopieën | 186.868 |
| Vervangbare periodecache | 1.371.039 |
| Opslagmetadata | 126.613 |
| Planningsassets | 0 |
| **Totaal** | **10.412.978** |

Begintotaal 9.076.290 bytes; einddiagnose 10.412.978 bytes, dus 1.336.688 meer tijdens opstart-/maand-/individuele verwerking en de onvoltooide groep samen. Beschermde, op dat moment niet rechtstreeks bereikte delen: 1.171.640 bytes. De categorieën tellen gedeelde delen slechts eenmaal, met voorrangsallocatie; het kleine historische-CSV-getal is geen maat voor alle logisch bereikbare CSV-inhoud. De volledige categorie-/overlaptellingen staan in het ruwe bestand.

Browserorigin: 19.782.985 naar 11.254.747 bytes, quota 402.653.184 bytes. Deze afname is niet verklaard door verwijdering van financiële bronnen of herstelbewijzen en wordt niet als bewezen compactie gepresenteerd. De originmeting bevat browserinterne overhead/meetruis en is niet gelijk aan de bovenstaande payloadtelling.

### Resterend knelpunt en vervolgbewijs

De kleine metingen bewijzen dat encoderwerk en herhaald traverseren van de geladen werkset nog kosten veroorzaken: de spaarproef doet 198 encoderingen; encodertijd groeit van 1.765 ms bij 20 naar 4.278 ms bij 100 bronnen. De commit bouwt nog `encodeHouseholdState(state)`, exacte financiële SHA-256 en `seedStatePayload(state)` over de volledige geladen werkset; het importjournal bevat tevens kandidaat- en basishandtekeningen. Gewijzigde fysieke delen blijven klein, maar het vinden daarvan vraagt nog veel CPU-werk. Normale reads blijven eveneens de benodigde actieve werkset valideren.

Deze resterende routes zijn uit broncode en kleine timing aangetoond. Hun afzonderlijke aandeel in de 7.305 ms van de 500-goedkeuring is niet gemeten met de zware observer; dit verslag schrijft de gehele resttijd daarom niet zonder bewijs aan één functie toe. Een verdere incrementele encodering moet eerst op 20/100 worden ontworpen en bewezen, inclusief betrouwbare bestaande deelreferenties, scope, revisie-/hashcontrole, corruptie, aborts en bescherming tegen mutable aliases. Geen nieuwe globale financiële statecache of verzwakte integriteitscontrole als snelle oplossing.

De 500-acceptatie blijft een ernstige prestatieblokkade. Volgens de afgesproken gate wordt niet doorgegaan naar volledige P4-acceptatie of 5.400 bronnen. De huidige veilige reparaties en bewijzen blijven beschikbaar; P4.2 en P4 worden niet als voltooid of releasegereed gemeld.

### Meetomgeving

Windows 11 Home, build 26200; AMD Ryzen 5 5500U; circa 7,34 GiB zichtbaar RAM; Node 24.19.0; Playwright 1.55.0 / Chromium 140.0.7339.16; Firebase CLI 15.24 / Firestore-emulator 1.21, Java 21 met maximaal 3 GiB heap. Eén Playwright-worker, lokale HTTP-server, serviceworkers geblokkeerd in de gerichte financiële proeven. Geen betrouwbare afzonderlijke geheugenpiekmeting uitgevoerd; daarvoor worden geen getallen geclaimd.

Bewijsbestanden staan onder `backups/v117-stabilisatie`: `p42-performance-before.json`, `p42-performance-after-decoder-only.json`, `p42-performance-after.json`, `p42-comparison.json`, `p42-small-before.log`, `p42-small-final.log`, `p42-targeted-node.log`, `p42-final-build-manifest.json`, `p42-final-suite-status.json`, `p42-final-b-500-movements.log` en `p42-scale-failure-3.json`. De oorspronkelijke vóór-opslagherstelmetingen en eerdere stopbewijzen zijn in het nieuwe controlepunt beschermd.

## Gewijzigde onderdelen ten opzichte van het controlepunt

- `src/storage/payload-parts.mjs`: centrale decode-/encodeoptimalisatie en metadataquery.
- `src/storage/performance.mjs`: optionele diagnostische spans.
- `src/import/runtime.js`: gerichte journalquery en meetpunten; bestaande goedkeurings-/herstelworkflow behouden.
- `src/core/runtime.js`: meetpunt om bestaande renderfunctie, zonder UI-/financiële wijziging.
- `tests/helpers/indexeddb-performance-meter.cjs` en `tests/browser/v117-p42-performance.spec.cjs`: native request-/tijdmetingen, 20/100, tien edits en tien spaarbetalingen.
- `tests/v117-p4-payload-parts.test.cjs`: aliasisolatie, nieuwe-transactievalidatie en gewijzigde encoderinvoer.
- `tests/browser/v117-p4-payload-migration.spec.cjs`: native metadataquery en corruptie-/revisieproef.
- `tests/browser/v117-p4-scale.spec.cjs`: aparte lokale/cloudtijd, expliciet groepsresultaat en afzonderlijke P4.2-bewijspaden.
- `scripts/test-p42.mjs`: acceptatiegates, vaste buildhashes en stop na mislukte 500-proef.
- `app.js`, `index.html`, `service-worker.js` en de zes bestaande assetversietests: gezamenlijke versie `117-p4r2`.
- Audit-/releasevoorbereidingsdocumenten: actuele bevindingen en blokkades. De exacte bestandslijst met hashes volgt uit `p42-stop-proof.json`.

## Open releasevoorwaarden

- Een ondersteunde veilige gebruikersroute voor tegenstrijdige financiële goedkeuringen ontbreekt nog. Beide versies/bewijzen blijven beschermd. Dit blijft een expliciete productie-releaseblokkade; een omvangrijke conflictinterface is niet geïmplementeerd.
- Beschermde operatiebewijzen en migratiekopieën kunnen blijven groeien. De 64 MiB-richtwaarde betreft uitsluitend vervangbare cache. Geen onomkeerbare retentie of verwijdering is uitgevoerd.
- De tijdelijke ruimtebehoefte bij migratie van een grote, bijna volle oude database blijft afzonderlijk te bewijzen.
- Productieactivering en werkelijke productiemigratie zijn niet uitgevoerd en vereisen afzonderlijke toestemming.

## Herstelpunt na de stop

De volledige broncode en bewijsbestanden zijn ook na P4.2 opgeslagen en teruggecontroleerd: `backups/v117-stabilisatie/p42-stop-20261011T124653` (316 bestanden). De manifesthash en controle-uitkomst staan in `p42-stop-backup-proof.json`. Alle 22 gewijzigde/nieuwe bestanden ten opzichte van het begincontrolepunt staan met hashes in `p42-stop-proof.json`. Alle wijzigingen blijven ongecommit op de ontwikkelbranch. De tijdelijke emulatorprocessen zijn beëindigd; de pc blijft aan.
