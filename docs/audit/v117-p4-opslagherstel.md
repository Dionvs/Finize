# Finize V117/P4 — aanvullend opslagherstel

## Status

**P4 gestopt bij een belangrijke prestatie- en verificatieblokkade in de 500-bronnenproef.** De reparatie van schrijfversterking slaagt in de kleine 20/100-proeven, maar P4 voldoet nog niet volledig aan de acceptatiecriteria. De laatste voortgang was 50%; de 500-proef rechtvaardigt geen 60%-melding. Geen releasevrijgave. De pc blijft aan.

Branch: `agent/v117-stabilisatie`; geaccepteerde P3-basis: `1db602a0986f09e5739169f9de40c1debe95abf9`. Bestaande lokale wijzigingen blijven behouden. Geen productieverbinding, productiemigratie, publicatie van regels of indexen, deployment, push of merge.

Vooraf zijn 285 technische bestanden gekopieerd en ieder teruggelezen met SHA-256. Manifest: `backups/v117-stabilisatie/before-storage-repair-20261011-091342/manifest.json`; SHA-256 `e1673e871849d761444c048d24fb27510e7d6a2928fbae561d717bb0db171ad9`. Dit is een broncodeherstelpunt, geen productiegegevens-export. Het [eerdere P4-stopverslag](v117-p4-eindrapport.md) blijft historisch bewijs van de oorspronkelijke quotafout.

Bij de afsluitende controle bleek dat het technische manifest de kopie van het gelijknamige appbestand had vervangen. Het ongewijzigde appmanifest is teruggelezen uit de bron en gecontroleerd tegen zijn vooraf vastgelegde SHA-256 `d346dffbb70d22017e713af462ed84ae835ac36dee3839ce25712a84761be78f`. Het staat nu onder `original-app/manifest.json` binnen het oorspronkelijke herstelpunt. `recovery-paths.json` legt deze herstelpaduitzondering vast. Daarna zijn alle 285 originele bestanden opnieuw gecontroleerd. Het technische manifest zelf is ongewijzigd. De nieuwe stopsnapshot gebruikt afzonderlijke `source/`- en `evidence/`-mappen en vermijdt deze naambotsing.

## Bewezen oorzaak en centrale reparatie

De voorproef gebruikt dezelfde bestaande goedgekeurde bankbron, dezelfde financiële instellingen en dezelfde import met 20 bronregels. De grotere administratie voegt uitsluitend 80 historische bankbewegingen in een aparte batch toe. Tien wijzigingen wisselen OV en Overig af; geen nieuwe import tijdens de reeks.

Vóór herstel schreef de tweede wijziging 1.199.010 bytes bij 20 bronnen en 3.280.867 bytes bij 100 bronnen. Het journal alleen schreef respectievelijk 1.152.986 en 3.226.051 bytes. De bronbedragen en financiële som bleven gelijk. Grote voor-/naversies, signatures, periodecontext en outboxbewijzen werden als volledige objecten opnieuw opgeslagen.

`payload-parts.mjs` verandert uitsluitend de fysieke IndexedDB-representatie. SHA-256-geadresseerde, onveranderlijke delen worden gedeeld door financiële records, importgegevens, journals, outbox en cache. De centrale adapter schrijft ontbrekende delen en gewijzigde verwijzingen in dezelfde native transactie. Een identiek fysiek record wordt niet opnieuw geschreven. Een afgebroken transactie publiceert geen nieuwe kennis over beschikbare delen.

Grote arrays met stabiele IDs krijgen een gehashte index en expliciete volgorde. Het vervangen of verplaatsen van één effect herschrijft daarmee niet alle historische arraysegmenten. De gecommitteerde state-graaf wordt reeds bij de oorspronkelijke financiële commit als fysiek bewijs gedeeld. `payloadStateHash` is geen tweede financiële waarheid: het bestaande layout-, schema- en SHA-256-contract blijft leidend bij laden en valideren.

De financiële commit normaliseert uitsluitend inhoudelijk gewijzigde transacties wanneer rekeningprofielen ongewijzigd zijn. Een wijziging van die profielen behoudt de bestaande bredere normalisatie. Ongewijzigde historische transacties worden hierdoor niet tijdens de eerste bewerking alsnog herschreven.

De extra herstelproef onderzoekt ook opnieuw openen na een lokale goedkeuring. Daarbij bleek de editor het legacy `baseVersion` te vergelijken met recordopslag, die een huishoudrevisie en epoch gebruikt. `pendingImportBaseMatches` controleert nu de bestaande duurzame importwachtrij, actuele importoperatie, receipts, eerste/laatste hash van de pending operatieketen en de bevestigde huishoudrevisie/epoch. Een afwijkende revisie, keten of conflictstatus wordt niet geaccepteerd. Dit vervangt alleen de ongeschikte legacy-controle bij een recordsessie; legacy-imports behouden hun bestaande contract.

De recordtransportlaag onderscheidt een mislukte netwerkrequest nu als `cloud-offline`, zodat de bestaande gecontroleerde lokale fallback werkt. HTTP-weigeringen, tokenfouten en beschadigde response-inhoud blijven fouten. Een later afgeronde sluitactie mag uitsluitend het eigen editorvenster sluiten. De browserproef vraagt na Sluiten expliciet opnieuw openen; een nog zichtbaar, sluitend venster is geen bewijs van een nieuw geopend venster.

### Gewijzigde interfaces en onderdelen

- `payload-parts.mjs`: `encodePayloadRow`, `decodePayloadRow`, `payloadDatabase`, `migratePayloadRepresentation` en transitieve `payloadReferences`.
- `household-store.mjs`: databaseversie 4, hervatbare fysieke migratiegate en `tx.seedStatePayload` binnen de bestaande atomaire financiële commit.
- `period-cache.mjs`: fysieke inventaris met unieke delen, gedeelde bereikbaarheid en atomaire opruiming van uitsluitend onbeschermde cacheafhankelijkheden.
- `core/runtime.js`: normalisatie van uitsluitend gewijzigde financiële transacties bij ongewijzigde rekeningprofielen.
- `import/runtime.js` en `record-sync.mjs`: optionele `pendingBaseMatches` bij importresolutie, gebaseerd op het bestaande recordcontract; bescherming tegen late sluitacties.
- `firestore-record-transport.mjs`: onderscheid tussen netwerkuitval, geweigerde toegang en ongeldige response-inhoud.
- `approval-group.mjs`: afzonderlijke melding voor opslagfouten, zonder definitieve schijnsuccessen.
- Native browsermeter, herhaalde-wijzigingsproef, representatiemigratie-/opruimproeven, extra unitcontroles en bestaande P2-native-inspectiehulp. PWA-assets en bijbehorende versiecontroles gebruiken gezamenlijk `117-p4r1`.

## Opslag- en migratiecontract

- Native IndexedDB-versie: 4. Fysieke payloadrepresentatie: 2. Financiële lokale opslagversie: 1; schema: 11; P3-cloudprotocol: ongewijzigd versie 2.
- Nieuwe fysieke stores: `payloadParts`, `payloadProtection`, `representationMeta`, `representationBackup`, `representationStage`.
- Vóór activering blijven de oorspronkelijke native records leidend. De migratiegate blokkeert applicatiewrites. Kopieer maximaal 50 records per checkpoint, bewaar originele inhoud en SHA-256, en hervat op store/key.
- Lees ieder staged record volledig terug en vergelijk hashes, aantallen en exacte JSON-inhoud. Omschakeling van alle logische stores en het versiecontract gebeurt in één atomaire activatietransactie.
- Na activering zijn uitsluitend de via de bestaande financiële layout gelezen IndexedDB-records leidend. localStorage, beschermde kopieën en staged records accepteren geen onafhankelijke financiële writes.
- Originele kopieën worden niet automatisch verwijderd. Een onbekend contract, verkeerde huishoudscope, ontbrekend deel of beschadigde hash stopt het lezen; geen lege fallback.

Bescherming volgt de volledige afhankelijkheidsgraaf van een financieel bewijs. Cacheopruiming controleert alle roots, beschermde roots, revisies en pending afhankelijkheden in dezelfde readwrite-transactie. Zij verwijdert uitsluitend cachegegevens zonder resterende of beschermde verwijzing. Alle financiële en herstelbewijzen blijven behouden, ook wanneer ze niet meer vanuit de actuele stand bereikbaar zijn.

## Meetmethode

De testmeter observeert echte native `put`, `add` en `delete`-aanroepen per objectstore, hun transactieafronding en aborts. Bytes zijn consequent `TextEncoder(JSON.stringify(payload)).length`. Iedere commit registreert operatie-ID/revisie, identieke en gewijzigde writes, opslaginventaris en `navigator.storage.estimate()`.

De opgeslagen fysieke payload telt roots en unieke delen één keer; gedeelde bereikbaarheid en logisch gehydrateerde omvang worden apart getoond. Dit omvat geen interne databasepagina's, indexen, compressie of browserboekhouding. De origin-meting omvat bovendien andere opslag op dezelfde oorsprong en kan vertraagd of ruisgevoelig zijn. Een verschil tussen die metingen is geen bewezen aantal interne databasewrites.

De voorproef staat in `p4-repeated-edits-before.json`; de definitieve nameting komt in `p4-repeated-edits-after.json`. Tussenmetingen en falende diagnosepogingen blijven bewaard. De testgrens voor 20 versus 100 bronnen is niet verruimd om een falende meting groen te maken.

## Verificatie en openstaande punten

### A — tien wijzigingen van dezelfde bestaande goedkeuring

Definitieve A-run: **2/2 browserscenario's geslaagd**, inclusief opslag-/rollbackfout, offline herstart, verloren bevestiging, idempotente herhaling en tweede client. Build SHA-256: `a4ccb05e1f88c0cb523dd6e4d580c412c14ead7b0609caaeb2288c830d6df843`. Voorproef: de historische stopbuild `278c265f00e96252cec12e231e316fccd0574813606474bf29a5dff3163ea5a5`.

| Commit | Vóór: 20 bronnen | Na: 20 bronnen | Vóór: 100 bronnen | Na: 100 bronnen |
| --- | ---: | ---: | ---: | ---: |
| 1 | 2.053.208 | 150.553 | 6.024.620 | 153.992 |
| 2 | 1.199.010 | 45.874 | 3.280.867 | 48.532 |
| 3 | 1.208.334 | 43.762 | 3.290.191 | 46.420 |
| 4 | 1.215.600 | 43.594 | 3.297.457 | 46.252 |
| 5 | 1.220.729 | 43.818 | 3.302.586 | 46.476 |
| 6 | 1.225.814 | 44.018 | 3.307.671 | 46.676 |
| 7 | 1.230.943 | 44.242 | 3.312.800 | 46.900 |
| 8 | 1.236.024 | 44.438 | 3.317.881 | 47.096 |
| 9 | 1.241.174 | 44.673 | 3.323.031 | 47.331 |
| 10 | 1.246.284 | 44.875 | 3.328.141 | 47.533 |
| **Totaal UTF-8-bytes ingediend** | **13.077.120** | **549.847** | **35.785.245** | **577.208** |

De totale ingediende payload daalt met 95,8% en 98,4%. Er zijn juist méér kleine native schrijfopdrachten: bij 20 bronnen vóór herstel 56 in commit 1 en daarna telkens 15; na herstel 270, 76, 73 en vervolgens telkens 72. Bij 100 bronnen vóór herstel 216 en daarna telkens 15; na herstel 275, 80, 77 en vervolgens telkens 76. Alle gemeten opdrachten zijn duurzaam afgerond; identieke records zijn nul keer opnieuw geschreven.

De tweede commit schrijft bij beide groottes exact dezelfde kleine roots: journal 5 opdrachten/2.670 bytes, financialRecords 4/880, financialHead 1/549, operatiebewijs 1/249, financiële outbox 2/826, import 1/578 en importwachtrij 1/165. Beschermingsmetadata: 13/1.170. Alleen de nieuwe immutable delen verschillen: 48/38.787 versus 52/41.445 bytes. De extra indexpaden verklaren 2.658 extra bytes; geen extra historische transactie of bestaand bewijsdeel wordt herschreven. Van de vier financiële records zijn twee de doelbron/het doeleffect, plus de gewijzigde importsamenvatting en state-metadata.

| Kleine proef | Payload begin → eind | Payloadgroei | Browser-origin begin → eind |
| --- | ---: | ---: | ---: |
| Vóór, 20 | 2.092.467 → 3.253.309 | 1.160.842 | 1.402.386 → 2.865.330 |
| Na, 20 | 1.100.615 → 1.604.474 | 503.859 | 2.168.864 → 1.550.845 |
| Vóór, 100 | 4.094.082 → 6.586.230 | 2.492.148 | 1.702.540 → 6.950.875 |
| Na, 100 | 3.194.097 → 3.725.317 | 531.220 | 6.013.227 → 3.547.911 |

De dalende originramingen zijn niet sluitend verklaard: ramingsruis, browserboekhouding of interne compaction kunnen meespelen. Dit is geen bewezen verwijdering of exact gemeten compaction. Voor deze kleine proef is de quota niet aangepast; de browser rapporteert verschillende originquota (nameting 481.579.061 en 405.434.831 bytes). De meetreeks verklaart de nieuwe logische records/bewijzen en metadata, maar verklaart het verschil met interne browserbytes niet exact. Alle ruwe per-storemetingen, operatie-ID's, revisies, commituitkomsten en inventarissen staan in `backups/v117-stabilisatie/p4-repeated-edits-before.json` en `p4-repeated-edits-after.json`.

De payloadgroei is afzonderlijk af te leiden: bij 20 bronnen 477.511 bytes nieuwe immutable delen + 12.420 beschermingsmetadata + 2.499 receipts + 11.429 netto extra/gewijzigde roots = 503.859 bytes. Bij 100 bronnen zijn dit 504.872 + 12.420 + 2.499 + 11.429 = 531.220 bytes. Overgeschreven kleine verwijzingen en verwijderde tijdelijke editorroots maken ingediende writes groter dan netto opgeslagen groei. Bestaande bewijsdelen worden niet opnieuw geschreven of verwijderd.

| Opslagcategorie na tien wijzigingen, bytes | 20 bronnen | 100 bronnen |
| --- | ---: | ---: |
| Actieve financiële records | 483.934 | 1.401.226 |
| Offline bewaarde perioden | 0 | 0 |
| Open CSV-imports | 0 | 0 |
| Historische CSV-imports | 579 | 194.897 |
| Synchronisatie-outbox | 137.975 | 204.270 |
| Operatiebewijzen | 3.553 | 3.553 |
| Conflicten en herstelbewijzen | 675.328 | 1.251.451 |
| Beschermde migratiekopieën | 74.191 | 295.017 |
| Vervangbare periodecache | 199.410 | 316.149 |
| Opslagmetadata | 29.504 | 58.754 |
| Planningsbijlagen | 0 | 0 |
| **Unieke fysieke payload** | **1.604.474** | **3.725.317** |

Dit is een exclusieve fysieke toerekening: gedeelde delen krijgen één eigenaar volgens vaste prioriteit, dus categorie-overlap in deze som is nul. De historische CSV-inhoud is hierdoor niet slechts 579 bytes groot; die deelt onderdelen met financiële records en bewijzen. De afzonderlijke gedeelde bereikbaarheid bedraagt 1.043.107 respectievelijk 2.930.700 bytes. Logisch gehydrateerde inhoud: 3.068.370 en 5.668.425 bytes. Niet meer vanuit actuele roots bereikbare, behouden delen tellen onder herstelbewijzen: 517.947 en 1.093.023 bytes. Hun groei is zichtbaar en valt buiten de cachelimiet; beschermde roots behouden alle onderliggende delen. Nul offline/open-importbytes in deze specifieke fixture betekent niet dat die functies ontbreken; aparte regressieproeven controleren ze.

De bron blijft €−10,00 op 3 oktober 2026 met dezelfde rekening en unieke bankidentiteit. De administratie behoudt 20 respectievelijk 100 bronnen. De volledige budgetimpact blijft 20.000 respectievelijk 100.000 eurocent, met 20 effecten in oktober en bij de grotere administratie 80 historische effecten in september. Herhaalde edits importeren geen nieuwe bewegingen en maken geen extra financieel effect.

De definitieve bewijsrun is gestopt in B. De testvolgorde blokkeert verdere fasen na een eerdere fout: A kleine schrijf-/herstelproeven, B één proef 500/3 maanden, C alle Node-, browser-, build- en echte emulatorregelcontroles, D één 5.400/36-maandenfixture met drie metingen. Er wordt geen grotere dataset gestart om een falende kleinere proef te omzeilen.

### Bewaarde eerste eindpoging

De eerste eindpoging op dezelfde appbuild slaagde voor A (2/2) maar stopte in B vóór een nieuwe financiële goedkeuring. De test verwachtte de eerste CSV-regel binnen de standaard vijf seconden. Die regel verscheen daarna wel in de foutcontext. De diagnose registreerde nul IndexedDB-aborts, 501 aanwezige bankbronnen (500 oorspronkelijke plus één nieuw importconcept), 9.640.694 bytes fysieke payload en 31.049.124 originbytes bij een expliciete lagere testquota van 402.653.184 bytes (384 MiB). Dit is geen gemeten quotafout. Volledige eindinvarianten en groepsgoedkeuring ontbraken in deze poging; zij tellen dus niet als geslaagd.

De test wacht nu maximaal twintig seconden op de werkelijk gerenderde regels na duurzame importopslag, en rapporteert CSV-aanmaaktijd apart van goedkeuringstijd. Geen financiële assertie, bytegrens of quota is verruimd. De gehele bewijsreeks wordt opnieuw gestart; de eerste poging blijft onder `backups/v117-stabilisatie/attempt1-*` bewaard, inclusief manifest, suite-status, A-meting, B-foutcontext en diagnostiek. C en D zijn in de eerste poging terecht niet gestart.

### B — definitieve stop bij 500 bankbewegingen / drie maanden

De herhaalde eindpoging gebruikte dezelfde appbuild en één operationele ronde. A slaagde opnieuw (2/2). B bouwde de echte emulatoradministratie op, laadde maanden, verwerkte en synchroniseerde de individuele €1-betaling, en startte vervolgens de tienvoudige groepsgoedkeuring. De importwachttijd was nu voldoende. De groep was binnen twintig seconden nog niet afgerond: de laatst gelezen oktober-spaarstortingen waren **65.100 cent**, tegenover **135.100 cent** na de volledige groep. Dit betekent €50 verwerkt uit de groep van €750, bovenop de bestaande €601. Er was nog geen definitief groepsresultaat.

Dit bewijst een te trage/onvoltooide proef, **niet** dat Finize na afronding definitief slechts één van tien zou verwerken. De latere negen broncommits, herstart, tweede client, complete eindinvarianten en cacheopruiming van deze 500-administratie zijn niet bewezen. De testgrens voor de groepsgoedkeuring is niet opnieuw verruimd; de grotere proeven blijven gestopt.

| Gemeten handeling, één beschikbare meting | Milliseconden |
| --- | ---: |
| Emulatoropbouw en eerste aansluiting | 69.886 |
| Koude start met cloudperiode | 26.614 |
| Warme herstart met cloudperiode | 35.724 |
| Historische maand laden | 17.721 |
| Eerste CSV-concept duurzaam opslaan en tonen | 11.394 |
| Individueel goedkeuren | 11.981 |
| Synchronisatie na individuele goedkeuring | 52.549 |
| Tienvoudige goedkeuring | Niet afgerond binnen 20.000 |

Er is één meting per afgeronde handeling: mediaan en maximum zijn daardoor hetzelfde getal, geen statistisch betrouwbaar prestatieresultaat. De oudere stopbuild registreerde bijvoorbeeld circa 2,6 seconden per individuele goedkeuring en circa 2,5 seconden per maandladen over meerdere ronden. Dit zijn verschillende runs; zij tonen een duidelijke onderzoeksnoodzaak, geen gecontroleerde benchmarkvergelijking. Het inhoudsgeadresseerde model gebruikt méér kleine requests. De huidige decoder leest delen afzonderlijk, decodeert per logische root en kloont bewijsstructuren. Dit zijn concrete onderzoekspunten voor lees-/decodeversterking, maar hun exacte aandeel in de vertraging is nog niet gemeten. Ze worden niet als bewezen enige oorzaak gepresenteerd.

Bij de stop: nul geregistreerde IndexedDB-aborts, 511 aanwezige bankbronnen (500 oorspronkelijke + 11 geïmporteerde), 10.260.481 payloadbytes en 32.807.113 browser-originbytes bij 402.653.184 bytes quota. Begin: 9.076.534 payloadbytes en 19.805.735 originbytes. De nieuwe stop is dus geen waargenomen quotaoverschrijding. De oorspronkelijke quotafout is hiermee nog niet op grote schaal volledig afgetest.

| Opslagcategorie bij B-stop, bytes | Omvang |
| --- | ---: |
| Actieve financiële records | 6.764.588 |
| Offline perioden | 0 |
| Open CSV-imports | 23.388 |
| Historische CSV-imports | 1.165 |
| Synchronisatie-outbox | 628.676 |
| Operatiebewijzen | 2.901 |
| Conflicten/herstelbewijzen | 1.158.712 |
| Beschermde migratiekopieën | 187.600 |
| Vervangbare periodecache | 1.370.078 |
| Opslagmetadata | 123.373 |
| Planningsbijlagen | 0 |
| **Totale unieke payload** | **10.260.481** |

Gedeelde bereikbaarheid bedraagt 13.183.231 bytes; logisch gehydrateerde inhoud 34.997.350 bytes. Niet-actueel bereikbare maar behouden delen: 1.114.034 bytes. Categorieën tellen unieke bytes exclusief toe; deze bedragen mogen niet bij de browserraming worden opgeteld.

### Testaantallen, build en omgeving

| Controle op de stopbuild | Daadwerkelijke uitkomst |
| --- | --- |
| Definitieve Playwright A | 2 geslaagd, 0 mislukt, 0 overgeslagen |
| Definitieve Playwright B | 0 geslaagd, 1 mislukt, 0 overgeslagen |
| Aanvullende gerichte Node-controle | 12 geregistreerd en geslaagd, 0 mislukt, 0 overgeslagen; naamfilter, geen volledige suite |
| JavaScript-syntax | Geslaagd |
| CSS | Geslaagd; bestaande ongedefinieerde token `--line` blijft gemeld |
| Build byte-reproduceerbaarheid | Geslaagd |
| Volledige Node-suite | Niet gestart door B-stop |
| Volledige Playwright-regressie C | Niet gestart door B-stop |
| Aparte Firestore Security Rules-suite | Niet gestart door B-stop |
| 5.400 bronnen / 36 maanden D | Niet gestart door B-stop |

De name-filtered Node-run omvat codec, onveranderlijke historische delen, corruptie, gedeelde kleine objecten, stabiele indexpaden, offline transport, pending recordbasis en vijf relevante P3-invariantproeven. Niet geselecteerde gevallen zijn niet uitgevoerd; de runner meldt daarvoor geen afzonderlijke skipped-gevallen. De eindmanifestcontrole bevestigt **214 bron-, test-, configuratie- en buildbestanden ongewijzigd** tijdens A/B. Buildhash `a4ccb05e1f88c0cb523dd6e4d580c412c14ead7b0609caaeb2288c830d6df843`; PWA-assets `117-p4r1`. CSS heeft dezelfde bytes als het voorafgaande herstelpunt.

Bewijs: `p4-final-build-manifest.json`, `p4-final-suite-status.json`, `p4-storage-final-all.log`, `p4-final-a-repeated-edits.log`, `p4-final-b-500-movements.log`, `p4-scale-failure-3.json` en `p4-storage-focused-node.log`, allemaal in `backups/v117-stabilisatie`. De status staat terecht op `completed: false`. De eerste en tweede eindpoging hebben samen vier geslaagde A-uitvoeringen en twee falende B-uitvoeringen; dat zijn **drie unieke scenario's**, geen zes verschillende tests.

Vóór de uiteindelijke editor-/transportaanpassing slaagden 17 gerichte P2/migratiebrowserscenario's en de kleine herhaalproef op een eerdere tussenbuild; de toenmalige heropenproef faalde. De zes nieuwe fysieke migratie-/opruimscenario's zijn daarin opgenomen: browser sluiten na checkpoint, verkeerde scope, onbekende versie, transitieve cachebescherming, afgebroken activering en ontbrekend bewijsdeel. Dit is bruikbaar ontwikkelbewijs, **geen** herhaling van de complete migratiesuite op de huidige stopbuild. Een eerdere Node-volrun is evenmin actueel eindbewijs.

Meetomgeving: Windows 11 Home 10.0.26200, AMD Ryzen 5 5500U (12 logische processors), 7,34 GiB zichtbaar RAM; Node 24.19.0, Playwright 1.55.0, Chromium 140.0.7339.16; Firebase CLI 15.24, echte Firestore-emulator 1.21 met Java 21 en `-Xmx3g`. App 127.0.0.1:4173, emulator 127.0.0.1:8181, uitsluitend `demo-finize-v117`. Productie-Firebase-/SDK-verzoeken zijn in de browserproeven geblokkeerd. B gebruikt daadwerkelijk emulatoropslag met de Security Rules, maar de aparte volledige regelacceptatiesuite is nog niet uitgevoerd. Geen betrouwbare afzonderlijke applicatiegeheugenmeting beschikbaar. Geen productiemigratie bewezen.

### Financiële contracten en resterende blokkades

P1: committed/rejected/uncertain, receipt-readback en revisiecontrole blijven leidend; de kleine browserproef toont dat verloren bevestiging geen duplicaat veroorzaakt en commit-/rollbackfouten niet tot late uitvoering leiden. P2: IndexedDB publiceert uitsluitend na transactieafronding en blijft huishoudgebonden; localStorage is uitsluitend beschermde migratiebron/kleine metadata. P3: protocolversie 2, epoch, recordidentiteit, outbox en dezelfde financiële motor blijven behouden. Geen tweede financiële motor toegevoegd.

De bestaande OV/Overig- en salarisreparaties blijven in de code aanwezig. De herhaalproef wisselt OV/Overig zonder extra effecten; de volledige desktop-/mobiele budgetcontrole, salarisplanning/realisatie, nieuwe-installatieroute, PWA, twee-apparaatconflicten en alle projectiedimensies zijn **niet opnieuw integraal uitgevoerd** op deze stopbuild. Oud groen bewijs wordt niet als vervanging aangeboden. Zie het historische totaaloverzicht voor eerder uitgevoerde P1–P4-controles.

Releaseblokkades:

1. De 500-bronnenproef rondt groepsgoedkeuring niet binnen de huidige testgrens af en toont grote vertraging bij opstart, maandladen en sync. Eerst gerichte lees-/decode-/commitprofilering met 20 en 100 bronnen, daarna een centrale reparatie met bewijs dat geen historische gegevens worden herschreven of onnodig gehydrateerd. Geen nieuw zwaar schaalonderzoek vóór deze kleine route slaagt.
2. Alle volledige suites en de grote eindinvarianten ontbreken op de stopbuild. De niet-uitgevoerde driejaarsproef, echte volledige Rules-suite en huidige migratie-/nieuwe-installatieacceptatie blijven blokkades.
3. Afwijkende financiële goedkeuringen op twee apparaten hebben geen ondersteunde veilige gebruikersroute voor oplossing; beide versies blijven beschermd. Het conflictvoorstel in het productieplan is niet geïmplementeerd.
4. Fysieke migratie bewaart originelen, staging en nieuwe delen gelijktijdig. Daarvoor is extra tijdelijke quota nodig. De migratie van een grote, bijna volle bestaande v3-database is niet bewezen; een quota-/integriteitsfout moet veilig stoppen. Verwijderen van beschermde kopieën is geen toegestane oplossing.
5. Beschermde records en bewijzen zijn niet door 64 MiB begrensd. Onbeperkte groei en andere browsers dan de gemeten Chromium-omgeving zijn niet afgetest; veilige retentie/herstelvervanging vraagt afzonderlijk bewijs en zo nodig toestemming.

Het werk stopt bij dit verslag. Geen verdere zware proef, productiehandeling of slaapstand. Het [productie-releaseplan](v117-productie-releaseplan.md) blijft een voorstel dat pas na het opheffen van de blokkades en afzonderlijke toestemming kan worden uitgevoerd.

### Herstelbare oplevering

De lokale werkstand en relevante bewijsbestanden zijn teruggelezen vastgelegd in `backups/v117-stabilisatie/storage-stop-20261011-1106/manifest.json`. Bronbestanden staan onder `source/`; testbewijzen onder `evidence/`. `p4-storage-stop-proof.json` en `p4-storage-changed-files.json` leggen de actuele bron-/testhashes en **31 gewijzigde bestanden** ten opzichte van het oorspronkelijke herstelpunt vast. De code blijft lokaal en ongecommit op `agent/v117-stabilisatie`. De vooraf bestaande `firebase-debug.log` is hersteld uit de oorspronkelijke back-up; de echte Firestore-emulator is afgesloten. Geen financiële productiegegevens zijn benaderd of gewijzigd.

Beschermde gegevens kunnen blijven groeien: historische CSV-bronnen, receipts, nieuwe goedkeuringsbewijzen, nieuwe state-manifesten, conflicten en oorspronkelijke migratiekopieën. De zachte cachegrens van 64 MiB begrenst uitsluitend vervangbare cache. Een toekomstige retentie moet eerst volledige terugleesbare vervanging, idempotentie, herstelketen en afwezigheid van pending/conflict/offline-afhankelijkheden aantonen. Er worden geen beschermde gegevens onomkeerbaar verwijderd.
