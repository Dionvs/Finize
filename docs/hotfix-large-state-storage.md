# Storage Hotfix 2 — gewone back-up en volledige cloudstate

Schema v11 blijft v11. Alleen persistence/sync verandert; financiële modellen, migration originals, planning, processing, ledger, coverage en zakgeldformules blijven gelijk. Hotfix 1 is de basis, commit 32542877a45f8bb95112e39e99896a82c523a454. Geen pruning of cleanup.

## Gewone noodback-up

Voorheen schreef `DataAdapter.backup` de volledige envelop onder de scoped last-good localStorage-sleutel. Nieuw: aparte IndexedDB `finize-state-backups`, versie 1, store `snapshots`, scope-index. Append-only volledige JSON-envelop met type last-good, household/context, schema, createdAt, revision/syncVersion, UTF-8 byteLength en SHA-256. Success uitsluitend na transactiereadback, volledige payload-, context-, schema-, lengte- en digestcontrole. Cloudadoptie/rebase en restore/reset wachten op bevestiging; failure behoudt de actieve state. Herstel controleert na de asynchrone gate opnieuw of de stand/account niet ondertussen veranderd is.

Legacy localStorage-noodback-ups blijven read-only bereikbaar. Geen backup wordt verwijderd om localStorage-ruimte vrij te maken. De bestaande synchronische presentatie gebruikt een scoped readcache, met async refresh; desktop/mobile layout en restore-entry blijven gelijk. De bestaande migration-backupdatabase blijft volledig apart en ongewijzigd. Hergebruik van een origineel logt uitsluitend integriteitsmetadata.

## Cloudprotocol

`households/{household}/budgetState/current` wordt een klein authoritative manifest: app/schema, stateFormat `finize-json-chunks-v1`, activeGeneration, stateMeta, revision, syncVersion/baseVersion, commitId, timestamps, chunkCount, totalByteLength en totalSha256. Onder `current/generations/{generation}` staat de descriptor; `.../chunks/{sequence}` bewaart de volledige JSON-string in deterministische Unicode-veilige delen van maximaal 240.000 UTF-8 bytes. Elk deel heeft generation, sequence/count, byteLength, cumulativeBytes en SHA-256. Het financiële object wordt nergens ingekort.

Write: serialize → hashes → descriptor incomplete → aaneengesloten immutable chunks → server-readback van ieder deel → volledige reconstructie/checksum → descriptor sealen → bestaande core-CAS + import-preflight in één transactie → current-switch samen met P5-importheaders → bestaande receipts bevestigen. Current blijft oud bij elke precommitfailure. Verloren CAS laat de nieuwe generation ongebruikt; er wordt niets opgeruimd. Readers hydrateren inline v9/v11 of verifiëren de volledige genoemde generation vóór de bestaande migratie/validatie/adoptie. Onbekend formaat, ontbrekend/corrupt deel of onjuiste metadata wordt geweigerd. Een accountwissel of nieuwere snapshot tijdens asynchroon lezen/back-uppen kan geen oudere/accountvreemde state adopteren.

`assertCloudBase` gebruikt voor een manifest dezelfde stateMeta-signature als voor inline state. Geen last-write-wins toegevoegd; bestaande rebase/importconflict-/journalcontracten blijven staan. Core en importheaderpublicatie blijven atomair. Gewone runtime-consumers krijgen uitsluitend het identieke v11-object.

## Rules

Bestaande geverifieerde accountLink/household-autorisatie en default deny blijven staan. Generation-create uitsluitend incomplete. Chunksequence 0 begint de cumulatieve keten; volgende chunk vereist de direct vorige immutable chunk in dezelfde generation. Sealen vereist de laatste chunk met exacte count/cumulatieve lengte; metadata wordt immutable. Current mag alleen een sealed, matchende generation uit hetzelfde household activeren, met syncVersion +1/baseVersion en niet-teruglopende revision. Een legacy client kan een chunked current niet vervangen door inline state. Bestaande inline reads/writes vóór omzetting blijven compatibel. Chunks/generations worden niet verwijderd.

Rules kunnen geen SHA-256 berekenen: clientverificatie controleert iedere opgeslagen byte; rules dwingen volledigheid van de immutable keten, scopes en CAS af. Emulatorproject `demo-finize-release`, uitsluitend loopback `127.0.0.1:8181`: 40/40 checks PASS, inclusief oude P5-contracten. Geen productiegegevens als testfixture.

## Gerichte acceptatie

T1–T16 PASS: grote echte IndexedDB-back-up/readback/failure/legacy; meerdere veilige cloudchunks; recursieve equality; missing/corrupt reject; incomplete/current; A/B CAS/stale signature; inline v9; reload; household rules; exacte financiële selectoroutput. Extra guards: late listener, sign-out en concurrente lokale keuze tijdens restore. P5-browsertestmocks ondersteunen nu dezelfde chunked persistencelaag en behouden hun financiële assertions en atomaire importchecks.

Representatieve reeds gemigreerde geïsoleerde v11-fixture: 2.671.420 UTF-8 bytes. Grootste component is expliciete synthetische Unicode-bronpayload (2.600.002); recurringFixedExpenses 46.356; legacyPlanningReferences 8.525; planning 6.124; budgetDefaultsHistory 2.131; ledger 2.074; income sources 1.913; goals 1.670. Dit is geen productiecapture. Werkelijke live-payloadgrootte/componenten worden alleen als grootte-/integriteitsmetadata gerapporteerd bij de veilige generationwrite.

Relevante Node-ronde: 13 bestanden, 143 geregistreerde cases PASS. Gerichte browseracceptatie plus auth/startup, P5 lifecycle/twee devices, backupdesktop/mobile en offline shell worden gecontroleerd; resultaten en livepublicatie staan in het afzonderlijke A–K-verslag. Syntax/CSS/build/--check PASS; CSS SHA-256 blijft ba99ba8633c996ca0106b6db6417e2fd6141a635bd00ab202d2307fb2def975f. Geen volledige P1–P7-regressie of Hotfix-1-heraudit.

## Releasegrens

Bronnen: runtime backup/cloud orchestration, state-backups/cloud-chunks, sync-protocol; firestore.rules; nieuwe storage/browser/emulatortests; P5-cloudmock-adapters; generated app.js; gekoppelde index/SW-marker `finize-v104-large-state-hotfix`; alleen markerassertions van bestaande assets-tests; dit document. Geen financiële engine, CSS, migration-backupbackend, schemawijziging of private captures. Normale hotfixcommit/push, bestaande Pages-workflow en uitsluitend rules na emulator-PASS zijn geautoriseerd. Geen financiële useraction live; uitsluitend reeds geautoriseerde normale v9→v11-load en read-only controle. Voor live migratie blijft oorspronkelijke cloudrevision 4998/syncVersion 799 leidend zolang niet anders aangetoond.
