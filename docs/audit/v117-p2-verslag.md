# Finize V117 — P2, duurzame lokale opslag

## Besluit en begrenzing

P2 voldoet aan zijn lokale acceptatiecriteria en is op 10 oktober 2026 afgerond op `agent/v117-stabilisatie`, aansluitend op de geaccepteerde P1-commit `54e8d94`. De volledige Node- en browsersuites slagen op dezelfde definitieve applicatiebuild. Geen onopgeloste kritieke financiële P2-fout is in deze controles gevonden. P3 is niet gestart en blijft op verzoek gepauzeerd tot de gebruiker dit verslag heeft kunnen doorgeven.

Geen productie-Firestore, regels of cloudgegevens zijn aangepast. Geen deployment, push of merge naar main. De canonieke financiële motor, schema-v11-betekenis en het Dashboard blijven behouden. Het broncodeherstelpunt met manifest en SHA-256-controles staat in `backups/v117-stabilisatie/before-2026-10-09T19-12-24-546Z`; de oorspronkelijke lokale wijzigingen blijven buiten de P2-commit.

Bij de afsluitende back-upcontrole is een naamconflict hersteld: het technische controlemanifest staat nu in `backup-manifest.json`, zodat het oorspronkelijke PWA-bestand `manifest.json` ook herstelbaar blijft. Zijn oorspronkelijke bytes komen exact overeen met de vooraf vastgelegde hash. Alle 236 bronbestanden zijn opnieuw met succes tegen het controlemanifest geverifieerd. SHA-256 van `backup-manifest.json`: `c25e0f3b1ce5f82abf2098da311c0884494f9341e09c3c4219839a33e2dd1fd2`.

## Oorzaken en oplossing

De volledige financiële state werd bij wijzigingen naar localStorage geschreven. De kleine browserquota maakte een normale groeiende administratie daardoor onbruikbaar. Financiële opslag en importdetails werden bovendien in verschillende opslagstappen bevestigd. P2 gebruikt voortaan één IndexedDB-transactie voor onderling afhankelijke financiële records, importrevisies, operatiebewijs, journalafronding en synchronisatie-outbox. Alleen gewijzigde financiële records worden geschreven. Ongewijzigde grote gegevens worden niet opnieuw weggeschreven.

De overgang naar asynchrone opslag maakte extra problemen zichtbaar. De doelbewerker had twee afzonderlijke savehandlers; die zijn geconsolideerd tot één financiële commit. Een tijdelijke lege maandbudgetstructuur in de schermstate veroorzaakte onterecht onzeker herstel; het journal bewaart nu apart de bevestigde duurzame basis. De bestaande optimistische controle op veranderingen in het scherm blijft behouden. Afgeronde journals verwijderen beide omvangrijke basissnapshots. De maandkiezer kon jaar en maand gelijktijdig opslaan; zijn knoppen wachten nu op de lopende bevestiging, zodat de volgende keuze de vorige niet doorkruist.

## Opslagcontract en leidende laag

De bestaande importdatabase wordt in plaats opgewaardeerd van versie 1 naar 2, zonder verwijderen van objectstores of gegevens. Naam: `finize-imports-v1` voor expliciete legacy/lokale administratie en `finize-imports-v1-{householdId}` voor een huishouden. De opslag heeft daarnaast een zelfstandig contract `storageVersion: 1` en `schemaVersion: 11`. Onbekende opslag- of schemaversies worden geweigerd; er wordt geen lege administratie voor in de plaats gezet.

| Fase | Leidende gegevens | Financiële wijzigingen |
|---|---|---|
| Voor kopiëren | Beschermde oorspronkelijke localStorage-state en bestaande importdatabase | De nieuwe client schrijft nog niet |
| Prepared | Oorspronkelijke opslag; IndexedDB-kopie is nog ongeverifieerd | Geblokkeerd |
| Controle | SHA-256-readback van de volledige gereconstrueerde state; aantallen en hashes van bestaande imports, journal en syncQueue; controle oorspronkelijke bron | Geblokkeerd |
| Active / verified | IndexedDB is de enige financiële schrijver | Pas na voltooide IndexedDB-transactie zichtbaar |

De oude localStorage-state blijft bytegelijk beschermd en wordt niet automatisch verwijderd of als tweede financiële schrijver bijgehouden. De migratiemetadata bevat bronkey, bronhash, bronschema, tijdstip, huishoudscope, inventaris van de bestaande stores en de fase. Een oudere client die de beschermde bron toch wijzigt wordt bij activatie, opslaan of herstart gedetecteerd: beide standen blijven behouden en de nieuwe client blokkeert met een zichtbare foutmelding. Voor afwijkende oude offline standen is expliciete conflictoplossing nodig.

Financiële top-level lijsten met unieke ID's worden per record bewaard; hun volgorde staat in de head. Overige velden en onbekende legacygegevens blijven verliesloos als waarde bewaard. Bankdatum, financiële maand, vaste-lastenmaand en eventuele split-/terugbetalingsmaanden worden met de bestaande motor geïndexeerd. P2 laadt nog de volledige state; beperkt periode-laden en bijbehorende projecties behoren tot P3.

## Atomaire commit en herstel

Objectstores: `imports`, `journal`, `syncQueue`, `financialRecords`, `financialHead`, `operationReceipts` en `financialOutbox`. Een financiële commit gebruikt één readwrite-transactie met `durability: strict` over deze stores. De head bevat een aparte opslagrevisie, financiële revisie, layout, SHA-256, verificatievlag en operatie-ID.

- De verwachte hash van de bevestigde basis voorkomt dat een verouderd tabblad een nieuwere duurzame revisie overschrijft, ook na een losse duurzame read.
- Importcommits controleren tevens de voorafgaande importversie, operatie-ID, lifecycle en onveranderlijke bankbron.
- Een stabiel operatie-ID heeft een onveranderlijk commitbewijs. Dezelfde operatie herhalen met dezelfde toestand verandert de opslagrevisie niet; hetzelfde ID met een andere payload wordt geweigerd.
- `committed` volgt uitsluitend uit de voltooide transactie of verifieerbaar readback-bewijs. Bij verloren bevestiging wordt niet opnieuw financieel geboekt.
- `rejected` vereist een aantoonbaar onveranderde duurzame basis. Anders blijft de uitkomst `uncertain` en wordt herhalen geblokkeerd tot controle.
- Pending journalintenties worden nooit uitgevoerd bij herstart. Herstel leest eerst de echte duurzame toestand.
- De financiële kandidaat wordt tijdens await uit de zichtbare appstate verwijderd. Alleen na bevestiging wordt de state gepubliceerd; async-mutatiecallbacks en Promise-schijnsucces worden geweigerd.
- De duurzame outbox bewaart recordwijzigingen, voorgaande waarden, verwijderde records, hashes en revisies. Cloudbevestiging ruimt alleen bevestigde pending operaties op. Conflicten blijven beschermd. P2 gebruikt nog het bestaande cloudprotocol.

## Huishoudens en volledige migratie

Bankbronnen, effecten, importbatches, CSV-tekst/verwijzingen, splitsingen, goedkeuringen, onbekende velden, financiële historie en instellingen blijven behouden. De bestaande `imports`, `journal` en `syncQueue` blijven in dezelfde database staan en worden met aantallen en hashes geïnventariseerd. Open editors en pending herstelgegevens worden behouden. Bronbestanden worden in P2 niet naar een nieuw cloudmodel verplaatst.

De financiële store en importstore gebruiken dezelfde huishoudscope. Een echte account-/huishoudwissel herlaadt alle editors en closures, zodat geen pending actie of cache uit het vorige huishouden wordt hergebruikt. De browsercontrole wisselt A → B → A met een andere gebruiker binnen A en controleert afzonderlijke state, imports met dezelfde zichtbare ID, operatiebewijzen en outboxes. Ontbrekende of afwijkende oude accountstanden worden niet stilzwijgend samengevoegd.

Ook de bestaande foto-opslag en fotocache gebruiken nu een huishoudsleutel. De browsercontrole toont bij hetzelfde doel-ID de eigen foto van A respectievelijk B. Alleen fotoreferenties die in de beschermde oorspronkelijke administratie staan mogen uit de oude ongescopeerde fotostore worden gekopieerd; het oorspronkelijke bestand blijft behouden. Een niet leesbare foto wist de bestaande verwijzing niet meer.

## Bestanden en interfaces

Nieuwe bronmodule: `src/storage/household-store.mjs`. Gewijzigde bronmodules: `src/core/runtime.js`, `src/import/runtime.js`, `src/auth/runtime.js`, `src/core/mutation-errors.mjs`, `src/storage/commit-outcome.mjs`; gegenereerd: `app.js`. De financiële rekenmotor is niet gewijzigd.

Nieuwe/veranderde interfaces: `openHouseholdDatabase`, `encodeHouseholdState`, `decodeHouseholdState`, `createHouseholdStore`, `load`, `commit`, `migrate`, `verifyAndActivate`, `inspectOperation`, `pendingCloud`, `acknowledgeCloud`, `markCloudConflict`; async `DataAdapter.load/save/readDurableState/confirmCloudSnapshot`, `localSave`, `commitChange` en `persist`. `DataAdapter.commitBaseSignature()` geeft de reeds bevestigde basis; `supportsAtomicImports` kiest in de echte app de centrale atomaire importroute. Het `importMutation`-argument koppelt de import en haar syncbewijs aan de financiële commit. Het legacycompatibiliteitspad blijft voor bestaande roots/testdoubles zonder deze adapter behouden.

Nieuwe tests: `tests/v117-p2.test.cjs`, `tests/browser/v117-p2.spec.cjs`, `tests/browser/v117-p2-migration.spec.cjs`. De bestaande browserfixtures wachten op afgeronde opslaginitialisatie en awaiten financiële saves. De migratie-quotatest injecteert nu een echte IndexedDB-abort. De bestaande doelbewerkercontrole bewijst precies één revisieverhoging. `tests/ui-event-stability.test.cjs` controleert de actuele recordlookup in plaats van een oude closure. Bestaande financiële verwachtingen blijven behouden. De volledige bestandenlijst wordt met het P2-commitmanifest vastgelegd.

## Uitgevoerde nieuwe scenario's

Zeven Node-regressies controleren verliesloze roundtrip inclusief onbekende velden en financiële effecten, historische periode-indexen, ontbrekende records, alle kritieke async-aanroepers, onbekende versies, herstel tegen de bevestigde basis en behoud van uitkomst/operatie-ID bij gebruikersvriendelijke opslagmeldingen. Een reeds afgebroken transactie mag de oorspronkelijke quota- of beveiligingsfout niet vervangen door een tweede abortfout.

25 echte browserregressies controleren:

- Beschermde oude state, verificatie en herladen.
- Werkelijk volle localStorage (`QuotaExceededError`) gevolgd door tien CSV-groepsgoedkeuringen, zonder hoofdstatewrite naar localStorage.
- Afgebroken IndexedDB-commit op elk van de zeven relevante objectstores; geen financiële schijnsuccessen of verloren vorige verwerking.
- Zichtbare state pas na commitbevestiging.
- Een vertraagde jaarcommit in de echte maandkiezer, blokkeren van vervolginvoer tot bevestiging en daarna een duurzaam bewaarde maandkeuze.
- Browserpagina sluiten met een pending goedkeuring, herstart, afgewezen intentie en daarna expliciet éénmaal opnieuw goedkeuren.
- Financiële commitfout én mislukte rollbackregistratie, gevolgd door herstart.
- Een administratie van 18 MiB naar echte IndexedDB, ongewijzigd groot record niet opnieuw schrijven en correct herladen.
- Vier migratiemomenten met een echt afgesloten en opnieuw gestart Chromium-profiel: vóór commit, tijdens commit, na prepared en na activatie. Storingsinjectie dwingt de precieze grens af; dit is geen OS-stroomuitvaltest.
- Behoud van oude importrecords, CSV-verwijzingen, splitsingen, journal en syncQueue; exact één migratiebewijs na hervatten.
- Afwijkende oudere client vóór herstart en tijdens migratie; geen onjuiste activatie.
- Verouderd tweede tabblad, verloren commitbevestiging, huishoudwissel en idempotente operatiebewijzen.
- Beschermde migratie van oude fotoreferenties zonder verwijderen van het oorspronkelijke bestand; gescheiden fotocache bij gelijke doel-ID's in twee huishoudens.

## Financieel bewijs

Bij volle localStorage worden tien afzonderlijke bronnen en tien afzonderlijke effecten verwerkt: bedragen €35 t/m €44, totaal **39.500 eurocent** budgeteffect. Oorspronkelijke bedragen, bankdatums en bankOriginal blijven exact gelijk; effecten hebben tien unieke bankbron-ID's. De duurzame state en importdetails blijven na herladen exact gelijk. Er zijn nul hoofdstatewrites naar localStorage.

Op alle geïnjecteerde commitgrenzen blijven eerdere financiële state en importdetails exact behouden; de mislukte goedkeuring heeft **0 eurocent** budgeteffect. Een na herstart opnieuw expliciet goedgekeurde bron heeft precies **3.500 eurocent** effect. Codec-roundtrip vergelijkt alle velden en de bestaande motordimensies accountCashflow, budgetImpact, realExpense, goalDelta, incomeImpact en savingsDeposit. De bestaande brede suites borgen de overige financiële regels. Een afzonderlijke volledige driejaarsvergelijking van alle genoemde invarianten blijft P4.

## Definitieve verificatie

Build SHA-256 (`app.js`): `1a5d4a71603a2bb13f80f16a49ce21ee2030c16b0c2ef77d1fe127e3be94d065`.

Meetomgeving: Windows 10 x64, AMD Ryzen 5 5500U, 7.879.585.792 bytes RAM; Node v24.19.0, Playwright 1.55.0, Chromium 140.0.7339.16, lokale HTTP-server `127.0.0.1:4173`, één browserworker. De nieuwe fixtures blokkeren echte Firebase-/Firestore-verbindingen. PWA-tests hebben hun eigen serviceworkerinstellingen.

Syntax, CSS en byte-reproduceerbare build: geslaagd. De bestaande waarschuwing over CSS-token `--line` blijft ongewijzigd. Volledige Node-suite: **54 bestanden, 572 geregistreerde testgevallen geslaagd, 0 mislukt, 0 overgeslagen**; bestanden met losse assertions tellen daarnaast mee in de 54 bestanden. Volledige Playwright-suite: **266 uitgevoerd, 266 geslaagd, 0 mislukt, 0 overgeslagen**, duur **5,4 minuten**, zonder automatische retries. Beide volledige suites gebruiken de hierboven vermelde identieke applicatiebuild; de hash is na afloop opnieuw gecontroleerd.

Definitieve logs: `backups/v117-stabilisatie/p2-node-final.log` en `p2-browser-accepted.log`. De voorafgaande volledige run met negen te vroege testreads blijft ter verantwoording bewaard als `p2-browser-final.log`. Het controleerbare bewijs met bestandenlijst, SHA-256-hashes, testtotalen, migratiegegevens en financiële invarianten staat in `docs/audit/v117-p2-bewijs.json`.

De laatste opslaggroeiproef schrijft **18.945.967 bytes** naar echte IndexedDB: eerste commit **387 ms**, volgende wijziging **579 ms**, herladen **575 ms**. Het ongewijzigde grote archiefrecord wordt bij de volgende wijziging **0 keer** opnieuw geschreven. Dit zijn enkelvoudige metingen op de genoemde testmachine; het is geen prestatienorm of volledige driejaarsbenchmark.

De voorafgaande gerichte run had 23/23 successen. Eerdere runs vonden bootstrapfixture-races, twee overlappende doel-savehandlers, een oude localStorage-foutinjectie, een oude closure-naam in een statische test en de afwijkende journalbasis. Een volledige tussenrun op de definitieve applicatiebuild had 257 successen en negen fouten door tests die na een klik onmiddellijk de oude state lazen. De tests wachten nu op bevestigde opslag of het sluiten van de editor. Alle tien gerichte controles op die routes slagen; hun financiële verwachtingen zijn niet verzwakt. Alleen de volledige laatste run bepaalt de acceptatie. Onderbroken tussenruns zijn geen acceptatiebewijs.

## Grenzen voor P3 en P4

- Cloudopslag gebruikt nog de bestaande generaties/chunks. Recordgerichte cloudquery's, migratie-epoch, oude-clientcloudbescherming en Firebase-emulatorbewijs zijn P3. Er is in P2 geen productie- of emulatormigratie uitgevoerd.
- Een offline verschil tegenover een eerste cloudstand wordt met herstelgegevens en conflictstatus behouden; het wordt niet automatisch als veilige merge voorgesteld. P3 moet de conflictoplossing verder uitwerken.
- De lokale codec is recordgericht, maar volledige state-reconstructie en SHA-256 kosten nog tijd en geheugen. De 64 MiB-cache, veilige retentie en begrensd periode-laden zijn nog niet geïmplementeerd.
- De 18 MiB-controle is een opslaggroeiproef met synthetische payload, geen bewijs voor 36 realistische maanden en 5.400 bankbewegingen. Opstart, maandqueries, cloudrecords en driejaarsinvarianten moeten in P4 worden gemeten.
- Echte IndexedDB-transacties zijn in Chromium getest. Viewports toetsen mobiel gedrag; fysieke Safari-/Android-apparaten en OS-stroomuitval zijn hiermee niet bewezen.
- Oude localStorage, conflicten, operatiebewijzen en herstelafhankelijkheden blijven beschermd. Er is geen destructieve opruiming uitgevoerd.

De P2-acceptatiepoort is groen voor verdere lokale ontwikkeling. Er is geen P2-migratieblokkade gevonden in de geteste legacy- en huishoudscenario's. Bestaande afwijkende oude offline standen worden bewust geblokkeerd met behoud van beide kopieën; zij vereisen conflictoplossing. Dit verslag geeft geen productie- of P3/P4-acceptatie.

Voor overdracht naar P3: behoud dit lokale opslagcontract, de onveranderlijke operatiebewijzen, de huishoudscope en de canonieke financiële motor. Ontwikkel het recordgerichte cloudmodel en zijn migratie uitsluitend in test/emulator, bewijs financiële correctheid bij gedeeltelijk laden en behandel oude-client- en offlineconflicten expliciet. Start pas na de vervolginstructie van de gebruiker. P3 en P4 zijn nu niet uitgevoerd.

Het werk en dit verslag worden lokaal gecommit; daarna pauzeert de uitvoering vóór P3. Volgens de expliciete gebruikersopdracht wordt de Windows-slaapstand pas na veilig opgeslagen werk en verslag aangevraagd.
