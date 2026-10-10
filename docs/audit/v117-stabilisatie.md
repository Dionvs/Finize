# Finize V117 — gefaseerde stabilisatie

## Scope en herstelpunt

Ontwikkeling op `agent/v117-stabilisatie`, vanaf de opnieuw gecontroleerde lokale en remote `main` op `a56e8659d0c20f6c35b008c08e8bb27f23c5541a` (v116). V113 is geïntegreerd via `6818b88`. De handmatige noodreparatie-ZIP is niet gebruikt. Bestaande lokale bestanden en niet-geïntegreerde branches blijven behouden.

Technische back-up: `backups/v117-stabilisatie/before-2026-10-09T19-12-24-546Z`, 236 bestanden, 6.572.803 bytes, manifest met SHA-256-controle per bestand. Dit is een broncodeback-up; geen export van productiegegevens. De back-up staat buiten versiebeheer.

Herhaalde beginsituatie: 52 Node-testbestanden, 554 geregistreerde testgevallen en 235 Playwright-tests geslaagd. Syntax, CSS en gegenereerde build gecontroleerd. Logs: `backups/v117-stabilisatie/baseline-node.log` en `baseline-browser.log`.

Er is geen deployment uitgevoerd, niets naar main gepusht of gemerged en geen productie-Firestore aangepast.

## P1 — transactiestabiliteit

### Oorzaken en wijzigingen

- Een pending journal werd als uitvoerbare opdracht behandeld. Een afgewezen financiële opslag met een mislukte rollbackregistratie kon daardoor na herstart alsnog financiële effecten krijgen. Herstel controleert nu eerst het daadwerkelijk opgeslagen financiële operatiebewijs; intentie zonder bewijs wordt niet uitgevoerd.
- Het commitcontract onderscheidt `committed`, `rejected` en `uncertain`. Een bevestigd operatie-ID en importrevisie bewijzen een commit. Een onveranderde duurzame basistoestand bewijst afwijzing. Onleesbare of afwijkende toestand blijft onzeker. Onzekere operaties blokkeren herhalen totdat herstel de duurzame stand heeft gecontroleerd.
- Een onderbroken bevestiging na een geslaagde opslag wordt door readback als committed herkend; de financiële kandidaat wordt niet opnieuw toegepast.
- Goedkeurings- en heropeningsvelden worden op één plaats ingesteld. De centrale selector geeft expliciete goedkeuring voorrang op een achtergebleven reviewlabel. Een bewuste heropening blijft wel een reviewstatus.
- Het matchvenster wijzigde alleen voorstellen en keurde uitsluitend de oorspronkelijke regel goed. De expliciete actie voert nu de centrale goedkeuringsroute voor iedere geselecteerde bankbron afzonderlijk uit, met een eigen operatie-ID en verwachte bronrevisie.
- Het matchvenster bevat de oorspronkelijke regel als expliciete selectie, bedrag, bankdatum en actuele status. Het actieaantal volgt de selectie. Alleen gedeelde classificatie en bestemming worden overgenomen; bankbedragen, datums, beschrijvingen en bronidentiteiten blijven per bron behouden.
- Succesvolle bronnen blijven duurzaam verwerkt. Validatiefouten en conflicten betreffen alleen die bron. Een opslagfout of onzekere uitkomst stopt de resterende bronnen. Het resultaat vermeldt successen, ongeldige bronnen, conflicten, onzekerheid en niet-geprobeerde bronnen.
- De bestaande selectiegoedkeuring gebruikt dezelfde route. Bestaande regels voor bewezen en mogelijke duplicaten en de canonieke financiële motor blijven in gebruik.
- Tijdens de brede browsercontrole bleken een laat resultaat en opnieuw tekenen een sluitactie te kunnen doorkruisen en geopende secties dicht te klappen. Bediening wacht nu op afronding en geopende secties blijven behouden.
- De tweeklienttest ontdekte een afwijkend begincontract voor een ontbrekend clouddocument: de listener gebruikte een lege handtekening, de CAS-controle `0||`. Alleen de bevestigde lege beginstand (versie nul, lege handtekening) wordt nu geaccepteerd. Het verdwijnen van een bestaande revisie blijft een conflict.

### Bestanden en interfaces

Nieuwe modules: `src/storage/commit-outcome.mjs` en `src/import/approval-group.mjs`.

Gewijzigd: `src/core/runtime.js`, `src/core/transaction-model.mjs`, `src/import/runtime.js`, `src/import/source-repair.mjs`, `src/storage/sync-protocol.mjs` en de gegenereerde `app.js`.

Interfaces: `inspectCommitOutcome`, `readCommitOutcome`, `commitOutcomeError`, `runApprovalGroup`, `approvalGroupSummary`, `approveTransactionProcessing`, `reopenTransactionProcessing`, `DataAdapter.readDurableState`, `DataAdapter.adoptDurableState` en `approveSelectedSources`. Importcommits leveren `outcome` en `operationId`; opslagfouten dragen `commitOutcome` en `operationId`. `commitSummary` wordt awaited. Het bestaande core-savecontract wordt pas in P2 volledig asynchroon gemaakt.

### Testdekking en bewijs

Nieuwe Node-regressies staan in `tests/v117-p1.test.cjs`. Ze controleren statusconsistentie, groepsresultaten, zeven successen gevolgd door opslagfalen, dubbele fouten, verloren bevestiging, vijf geselecteerde bronnen, fouten op iedere voorbereidingsgrens, mislukte rollback, onleesbare duurzame toestand en blokkeren van herhalen.

Nieuwe echte browserinteracties staan in `tests/browser/v117-p1.spec.cjs`: tien spaartransacties bij 390 en 1440 pixels met één bevestiging, precies vijf geselecteerde transacties, zeven successen gevolgd door opslagfalen en herhalen van alleen de resterende drie, afsluiten na een vertraagde bevestiging en een tweede browserclient via de bestaande cloudcode met een geïsoleerde Firestore-testdouble.

De bestaande tests voor automatisch uitvoeren vanuit een onbevestigd pending journal zijn aangepast aan het expliciet goedgekeurde contract. De oude matchtest verwachtte slechts één goedkeuring na groepsbevestiging; die controle verwacht nu afzonderlijke goedkeuring van alle geselecteerde bronnen. Financiële bedragen, herstelbare invoer en het uitblijven van dubbele effecten blijven expliciet gecontroleerd.

Meetomgeving: Windows, lokale HTTP-server op 127.0.0.1:4173, Playwright Chromium, één worker, geblokkeerde service workers en externe cloudverbindingen in de nieuwe fixtures. Browserherladen gebruikt echte localStorage en IndexedDB. Dit is geen productie-Firestore-bewijs.

Gericht browserbewijs: tien afzonderlijke bronnen en tien effecten, totaal €750 naar sparen, originele bankgegevens gelijk voor en na herladen. Selectie van vijf verandert exact de gekozen vijf bronnen. Financiële regressies blijven in de bestaande suites voor salaris, vaste lasten, sparen, terugbetalingen, splitsingen, dekking en historische maanden.

### Acceptatiepoort

Status: P1 geaccepteerd voor verdere lokale ontwikkeling, 9 oktober 2026. Geen openstaande kritieke financiële P1-fout gevonden in de uitgevoerde controles. P2 kan beginnen.

Uitgevoerd: 53 Node-testbestanden geslaagd (554 bestaande en 11 nieuwe geregistreerde testgevallen). Volledige browserregressie: 240 geslaagd in 6,0 minuten. Daarna, voor de laatste aanpassing aan het lege cloudbegincontract en het expliciete groepsresultaat, 23 gerichte browsercontroles op de opnieuw gebouwde code geslaagd in 45,6 seconden; deze bevatten ook de zesde nieuwe P1-browsertest voor tien goedkeuringen op twee clients. De volledige suite bevat daarmee inmiddels 241 tests; er wordt niet beweerd dat alle 241 samen op de laatste build zijn uitgevoerd.

De eerste brede P1-run had 235 geslaagde en vier mislukte controles: twee verouderde matchverwachtingen en twee interactieproblemen rond sluiten/geopende secties. De interactieproblemen zijn hersteld. Een gerichte vervolgcontrole had 35 successen en twee testfouten door het opnieuw dichtklikken van een al geopende sectie; de tests openen die nu alleen indien nodig. De daaropvolgende volledige run is groen. De eerste tweeklienttest faalde op het lege cloudbegincontract; na de contractreparatie slaagt die test.

Laatste logs: `backups/v117-stabilisatie/p1-node-final.log`, `p1-full-browser-final.log` en `p1-sync-browser.log`. Syntax, CSS en reproduceerbare build slagen; de bestaande waarschuwing over het CSS-token `--line` is ongewijzigd.

Financieel bewijs: tien afzonderlijke spaarbronnen geven tien effecten en €750 spaartoename; een selectie van vijf behoudt de overige vijf bronnen en verwerkt alleen de som van de gekozen bedragen. Zeven bevestigde effecten blijven bestaan bij de achtste opslagfout en herladen; na herhalen zijn er exact tien unieke effecten. De tweede browserclient heeft dezelfde bedragen, datums, bron-ID's, verwerkings-ID's en goedkeuringsstatussen en veroorzaakt geen echo-write. De bestaande financiële regressies zijn groen. Een volledige, afzonderlijke driejaarsvergelijking van alle invarianten in eurocenten blijft P4.

P1 vervangt nog niet de omvangrijke localStorage-statewrites; dat is expliciet P2. Recordgerichte cloudsynchronisatie en emulatormigratie horen bij P3. De driejaars-, cache- en aanvullende offline/emulatoracceptatie horen bij P4. Geen van die pakketten is hiermee geaccepteerd.

## P2 — lokale opslag

Afgerond voor lokale ontwikkeling op 10 oktober 2026. Eén atomaire IndexedDB-commit bewaart financiële records, importdetails, revisies, operatiebewijs en outbox. De volledige administratie migreert verliesloos met verificatie en behoud van oude opslag; de app publiceert financiële wijzigingen pas na commitbevestiging. Huishoudens en fotocaches zijn gescheiden. De volledige suites op dezelfde definitieve build slagen: 54 Node-bestanden met 572 geregistreerde testgevallen en 266 Playwright-tests, geen mislukkingen of skips. Volle localStorage met tien CSV-groepsgoedkeuringen, zeven IndexedDB-commitgrenzen en vier migratieherstarts zijn aantoonbaar getest.

Uitgebreid technisch verslag: [v117-p2-verslag.md](v117-p2-verslag.md). Bestanden, hashes en reproduceerbaar testbewijs: [v117-p2-bewijs.json](v117-p2-bewijs.json). De technische back-up is opnieuw geverifieerd; het controlemanifest heet nu `backup-manifest.json` om het oorspronkelijke PWA-bestand `manifest.json` te behouden. P2 is vervolgens expliciet geaccepteerd als basis voor P3; geen productieaanpassing, deployment, push of merge naar main.

## P3 — cloudinfrastructuur

Lokaal geïmplementeerd: recordgerichte periodequeries, geverifieerde projecties uit de bestaande motor, een hervatbare migratie, bescherming tegen oude clients via echte Firestore-regels, idempotente outboxpublicatie en atomaire ontvangst op een tweede client. Beide conflictversies blijven bewaard. Tien CSV-spaartransacties blijven na één groepsbevestiging, offline herladen en echte emulatorsynchronisatie afzonderlijk goedgekeurd, samen €750.

Verslag: [v117-p3-verslag.md](v117-p3-verslag.md). Bewijs: [v117-p3-bewijs.json](v117-p3-bewijs.json). De nieuwe transportlaag is uitsluitend voor de lokale demo-emulator beschikbaar. De bestaande schermen en volledige commitreadback gebruiken nog de complete lokale administratie. P3-acceptatie blijft daarom open; dit is geen vrijgave van een volledige app met gedeeltelijk geladen historie. Productieomschakeling vereist aparte toestemming. P4 blijft gestopt totdat het open P3-criterium is opgelost en het verslag is goedgekeurd.

## P4 — cache en releasecontrole

Nog niet gestart. Vereist veilig cachebeleid, 36 maanden en minimaal 5.400 bronnen in echte browsertests, offline en twee clients, financiële vergelijking in eurocenten, emulatorcontrole en volledige regressie.
