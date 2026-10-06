# Releasehotfix — grote migratieback-ups

## Onderzoek vóór wijziging

`CloudAdapter.acceptRemote` normaliseert de remote state op een clone en controleert vóór adoptie `ensureMigrationBackup`. Lokale load en de bestaande JSON/noodback-uprestore gebruiken dezelfde guard. De oude backend is `localStorage`: één JSON-string onder de account-/householdgebonden historische `finize-budget-planner-v1-pre-schema-v5`-sleutel. De naam is compatibility, niet de actuele bronversie. De envelop bewaart pre-v5-data, volledige package1-originelen, volledige package2-originelen plus v10-tussenstate en eventueel aanvullende originelen. Hierdoor worden bronpayloads meermaals binnen de kleine synchrone originquota opgeslagen.

De oude implementatie doet exacte string-readback maar geen checksum. Een opslagfout blokkeert terecht state-adoptie. Migratieback-ups zijn browserlocal, niet cloudmatig. Er bestond geen aparte herstel-UI voor deze envelop: oorspronkelijke `.state` kan als JSON via de bestaande import/herstelroute worden aangeboden. Oude enveloppen worden niet gewist, aangepast of verplaatst.

Productie vóór hotfix (alleen gelezen): schema9, revision4998, syncVersion799. De exacte volledige productiepayload is niet als private fixture geëxporteerd. Een geïsoleerde structureel gelijksoortige v9-fixture met 2.200.000 extra brontekens meet 2.291.363 UTF-8-bytes. De oude echte browserroute reproduceert QuotaExceededError, 0 cloudwrites en onveranderde actieve state.

## Oplossing en veiligheidscontract

Nieuwe back-ups gebruiken uitsluitend de aparte IndexedDB-database `finize-migration-backups`, versie1, store `originals`. Geen vermenging met ImportStore/CSV-lifecycle. Eén append-only record per oorspronkelijke envelop/source/scoped key en SHA-256. Metadata: sourceSchema, targetSchema11, source, household, revision, syncVersion indien beschikbaar, migrationId, createdAt, byteLength, sha256 en id. De volledige originele state en bestaande v10-tussenstate blijven aanwezig. Geen pruning, compressie, financiële herinterpretatie of schemawijziging.

Success is pas bevestigd na transaction-completion, read-after-write, identieke payload, byteLength en SHA-256/context/metadata-controle. Write/readback-failure stopt de local/cloud/restore-route vóór persistente vervanging. Concurrent identieke inserts behouden de eerste opgeslagen kopie. Herhaalde v11-loads maken geen nieuwe back-up. Een asynchroon wachtende cloudacceptatie toetst de bestaande stale-snapshotguard opnieuw na de back-up, zodat een ouder listenerresultaat een nieuwere snapshot niet vervangt.

`DataAdapter.load` is nu async; auth/bootstrap wacht vóór render en cloudconnect. De ongebruikte default-placeholder wordt vóór die gate niet opgeslagen. Falen toont de bestaande initialisatiediagnostiek en laat de bronopslag intact. De financiële migratiefuncties blijven gelijk. Alleen compatibiliteitslogging groepeert diagnostiekcodes zonder historische gegevens te corrigeren.

## Teruglezen en herstel

In de ingelogde browsercontext: `await FinizeMigrationBackups.list()` geeft geverifieerde scoped records; `await FinizeMigrationBackups.get(id)` controleert opnieuw; `FinizeMigrationBackups.legacy()` leest de oude localStorage-envelop. De JSON-string `record.payload` bevat `package2Original` of `package2CloudOriginal`; de `.state` daarin is het complete origineel. Export van dat origineel kan via de bestaande, bevestigingsplichtige JSON-herstelroute worden hersteld. Deze hotfix voert geen restore en geen automatische cleanup uit. De backup backend blijft browserlocal; wissen van browser/sitegegevens door de gebruiker kan die opslag verwijderen.

## Verificatie vóór publicatie

H1–H12: PASS in een echte lokale browser met geïsoleerde data. Inclusief grote payload, exacte readback, write failure, corrupte readback, v9→v11, identieke output, legacy-read, geen oude verwijderingen, reload, herhaalde load, context isolation en geen productieverzoeken. Eén aanvullende concurrente-cloudlistenerregressie PASS. Totaal relevante browserronde: 33/33 PASS, 0 fails/skips/retries. Daarin P1/P2, auth-shell (390/1440), cloudmock A/B en offline shell.

Relevante Node-ronde: 12 bestanden, 91 geregistreerde cases PASS, 0 fail/skip. Syntax/CSS/build/check PASS. CSS SHA-256 blijft `ba99ba8633c996ca0106b6db6417e2fd6141a635bd00ab202d2307fb2def975f`; firestore.rules ongewijzigd. Geen volledige P1–P7-suite opnieuw uitgevoerd.

Exacte vergelijking met de P7-releasecommit `cbbbec32f91a0a7e411794895b6902cb9ff6709a` op de grote fixture: volledige gemigreerde state bytegelijk, 2.271.419 UTF-8-bytes, SHA-256 `52d77631cdb596202c4f704ed7cd038e8c8cc85de07d5d6540d8d84c5bda4517`. Financiële/persistente verschillen: 0; bronschema9 intact. Bestaande render-only lege maandwrapper is niet de migratie-uitvoer en wordt niet als financiële wijziging aangemerkt.

## Bestanden en releasegrens

- `src/storage/migration-backups.mjs`: aparte geverifieerde back-end en legacyreader.
- `src/core/runtime.js`: async guards/bootstrap, scoped lees-/hersteldebugbaarheid en bestaande revisionguard na async wachtstap.
- `app.js`: reproduceerbare bronbundle.
- `index.html`, `service-worker.js`: gekoppelde versie `103-migration-backup-hotfix`, cachemarker `finize-v103-migration-backup-hotfix` voor een consistente update van de cache-first client.
- `tests/helpers/migration-runtime.cjs`: modulebinding voor de bestaande pure testharness.
- `tests/browser/hotfix-migration-backup.spec.cjs`: gerichte H1–H12 plus concurrente listener.
- `tests/browser/package1-data-foundation.spec.cjs`, `tests/browser/package2-planning-timeline.spec.cjs`: dezelfde bewaargaranties op de nieuwe backend en wachten op async-failure.
- `tests/html-inline-syntax.test.cjs`, `tests/service-worker-cache.test.cjs`, `tests/update4-final-regression.test.cjs`, `tests/update5-responsive-structure.test.cjs`, `tests/package7-release-audit.test.cjs`: exact nieuwe assetmarker; assertions blijven even strikt.
- Dit document: rootcause, verificatie en restorecontract.

Geen CSS/rules/financial-engine/schemawijziging. Geen private fixture, work-artifact, credentials of logs in de commit. Productiepublicatie pas na manifestcontrole en groene gerichte verificatie. Live migratie/postcontrole worden afzonderlijk gerapporteerd; de oorspronkelijke back-up blijft behouden.
