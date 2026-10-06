# Sync Hotfix 3 — identieke cloudwrite-lus

Schema blijft v11. Basis: Storage Hotfix 2, commit `33d5ae0d5790efde48c23b58cc0d2a1af7026dfe`. Alleen sync-orchestration en gerichte tests veranderen; chunkprotocol, rules, CSS, financiële engine en migratie blijven ongewijzigd.

## Geïntegreerd bewijs vóór fix

Een echte CloudAdapter met checksum-geldige chunked current, echte importcallback en scoped IndexedDB-queue kreeg één expliciete lokale fixturewijziging. De eigen snapshot begon chunkhydratie, wachtte, en vervolgde pas nadat `saveNow` zijn `activeCommitId` had gewist. De listener adopteerde hem als remote, maakte een noodback-up en riep `onCloudAccepted` aan. De queue bevatte een record zonder lokale importdetails; staging leverde nul mutations, maar `flushImportSync` vroeg toch `queueSave/flushQueue` aan. Die commit genereerde dezelfde SHA en weer een vertraagde echo.

Drie vrijgegeven echo’s: vier corecommits totaal, drie remote-adopties, drie callbacks, drie back-ups, één ongewijzigde queue, identieke hashes. Assertion `coreWrites === 1` faalde met 4. Dit is geïntegreerd nieuw bewijs, niet een herhaling van de reeds bekende losse zero-stage-reproductie. Na fix geeft dezelfde test één commit en nul overige side effects.

## Minimale fix

`collectImportCloudIntents` is een gedeelde read-only selectie voor flush en staging. Ontbrekende details/conflictregels blijven bewaard en zijn als `pendingDiagnostics` plus een wijzigingsgebonden consolewaarschuwing beschikbaar. Geen periodieke warningtimer. Onjuiste compact receipts blijven fail-closed. Een conflicterend legacyrecord wordt niet automatisch opgewaardeerd. Nul publiceerbare intenties vraagt geen core-save aan; een latere geldige intentie synchroniseert normaal.

De listener legt een in-flight eigen commitidentiteit vast vóór hydration. Na hydration herkent hij bovendien de reeds bevestigde `lastConfirmedCommitId` met dezelfde version/signature. De bestaande stale-check blijft vóór acceptatie. Een echte latere commit van een ander device wordt normaal geadopteerd. Eigen echo’s maken geen adoptieback-up en starten geen importcallback; save-status wordt zo nodig gestabiliseerd.

Aanvullende no-op-invariant: de volledige serialized transferable state moet exact gelijk zijn aan `confirmedState`. Een read-only transactie controleert dezelfde core-CAS en alle importheaders. Alleen als alle stages reeds bevestigde echo’s zijn (ook de lege lijst), worden eventueel bestaande receipts bevestigd en wordt geen generation/current-write gemaakt. Nieuwe importpublicaties en werkelijke corewijzigingen blijven via de bestaande atomische commit gaan. Deze guard gebruikt geen metadata-only equality, timer of rate limit.

## Gerichte acceptatie

Nieuwe Node-cases en browsertests dekken S1–S14: missing/conflict/compact-receipt mismatch behouden; één echte publicatie; immediate inline/chunked eigen echo; vertraagde eigen echo; ander device; herhaalde no-op; echte corewijziging; CAS-conflict; reload; latere retry; reeds gecommitte receipt-echo; geen data/back-up/generationverwijdering door de guards. Financiële selectoroutput en full state/cloudintegriteit blijven gelijk.

De gewone Hotfix-2-opslagtests en relevante P5 lifecycle/two-device/auth/startup/CAS-tests worden opnieuw uitgevoerd. Geen volledige P1–P7-suite, migration-backupheraudit of payloadheranalyse. Definitieve aantallen en live observatie staan in het afzonderlijke A–I-eindverslag.

Definitieve lokale ronde: 14 relevante Node-testbestanden, 148 geregistreerde cases PASS; 33 browsercases PASS, waarvan 9 gerichte nieuwe sync-cases. De nieuwe Node-file bevat 5 gerichte cases. Geen failures/skips/retries. Syntax/CSS/build/--check PASS; CSS SHA-256 `ba99ba8633c996ca0106b6db6417e2fd6141a635bd00ab202d2307fb2def975f` blijft gelijk. De geïntegreerde failing-before-log is uitsluitend lokaal testbewijs en wordt niet gepubliceerd.

## Publicatiegrens

Eén normale hotfixcommit/push via bestaande Pages-workflow. Gekoppelde index/app/SW-marker `finize-v105-sync-loop-hotfix`; alleen bijbehorende assetassertions veranderen. Geen rulesdeployment omdat `firestore.rules` ongewijzigd is. Live uitsluitend de geautoriseerde app-load, observatie, reload en read-only historische/account/import/goals-controles. Geen transacties, CSV, saldo-/planningedits of cleanup. Het oudere Hotfix-1-backuprecord blijft ongemoeid als het niet veilig via bestaande read-only UI bereikbaar is.
