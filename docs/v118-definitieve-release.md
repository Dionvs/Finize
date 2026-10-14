# Finize V118 — definitieve release

Datum: 14 oktober 2026. Release: **118-r1**. Status: **controles geslaagd; publicatie wordt uitgevoerd**. Dit is nog geen bevestiging van een live V118-release.

## Opgenomen en uitgesteld

V118 bevat P5a-bankinvoercontract, P1-saldo-ijkpunten, P1b-bankrekeningbeheer, P2-dagelijkse liquiditeit/Vrij na verplichtingen, P3-dashboard met Impeccable-herstel en P4-transactiesuggesties. De oorspronkelijke opleververslagen en auditbestanden blijven als afzonderlijk historisch bewijs behouden.

P5b is doorgeschoven naar een toekomstige fase **Bankkoppelingen**, omdat de definitieve identiteit, statusovergangen, dekking, autorisatie en correctierelaties afhangen van de gekozen provider. Zie [toekomstige-bankkoppelingen.md](toekomstige-bankkoppelingen.md). Er is geen P5b-code of fictieve adapter gebouwd.

## Wijzigingen tijdens de afronding

Er zijn geen productiefuncties, financiële formules, opslagarchitectuur of UI-vormgeving aangepast tijdens deze afronding. De versie-/cacheverwijzingen in `index.html`, `service-worker.js` en de zes bijbehorende bestaande releasetests zijn gewijzigd van `118-p4r1` naar `118-r1`. `app.js` en `app.css` zijn reproduceerbaar gebouwd; de eerder gevalideerde applicatiebron blijft behouden.

Toegevoegd: deze releasebeschrijving, het compacte architectuurdocument, `tests/v118-release-safety.test.cjs`, `tests/browser/v118-release-safety.spec.cjs` en `docs/audit/v118-definitieve-release-bewijs.json`. De extra tests onderzoeken uitsluitend de bestaande integratie, approval-/leeratomaire grens, compatibiliteit en PWA-upgrade/rollback. De proef met privéproductiegegevens en V117-assets is expliciet opt-in; algemene tests vereisen geen privébestanden.

## Daadwerkelijk gecontroleerd op de definitieve build

**471 Node-tests geslaagd, 0 mislukt.** De zes V118-pakketcontracten, drie nieuwe release-integratiegevallen en direct relevante V117/import/salaris/refund/spaar/historische budget/sync/cache/releasecontracten zijn uitgevoerd. Exacte commando's en loghashes staan in het auditbewijs.

**64 browsergevallen geslaagd, 0 mislukt:** 61 bestaande gerichte V118/P7-gevallen, twee nieuwe opslag-/upgradegevallen en één echte PWA-upgrade-/rollbackproef. Geen nieuwe schaaltests of benchmarks, geen volledige V117/V118-regressie en geen emulatorreeks.

Build, syntax, CSS, byte-reproduceerbare distributie en diffcontrole slagen. Het reeds bekende CSS-token `--line` is geen nieuwe bevinding.

### Financiële veiligheid en samenwerking

- P4-leren en financiële goedkeuring delen dezelfde duurzame commit. Een echte IndexedDB-abort tijdens opslag van herkenningsregels bewaart noch een nieuwe leerregel, noch een financiële verwerking. Na herstart en opnieuw goedkeuren ontstaan precies één regel en één verwerking.
- Een verouderde bron-/cloudkeuze blokkeert goedkeuring; geen leerregel wordt duurzaam toegevoegd en de cloudkeuze blijft intact.
- De koppeling P4 → P1/P2 is expliciet getest: een werkelijk geboekte, nog niet goedgekeurde CSV-bron telt voorlopig eenmaal in het fysieke saldo. Goedkeuring voegt de budgetverwerking toe, zonder tweede bankmutatie. De rekeningbuffer blijft eenmaal verwerkt.
- De pakkettests controleren stabiele fysieke rekening-ID's, handmatige toevoeging, archiveren zonder historieverlies, ijkpuntcorrectie, brondekking, onzekere gegevens en rekeningconflicten. De afgesproken tijdelijke huishoudtoegang blijft behouden.
- P2/P3-tests controleren salarisvervanging, vaste lasten, budgetreserveringen, transfers, spaargeld, eenmaal buffer, de standaardhorizon vóór betrouwbaar volgend salaris, eigen einddatum, onzekerheidsmeldingen en dezelfde bestaande maand-/zakgelduitkomsten.
- P4-tests controleren expliciete goedkeuring, historische budgetten, geen eigenaarsovername, salarisevidence, occurrencekeuze, onbevestigde transferparen, doelcontext, lege refundmaand, vijf-uit-tien bulkkeuze, individuele bronlinks, splits, intrekken/hergoedkeuren en herladen.
- Historische budget- en vaste-lasthistorie, latere maandwijzigingen, salaris-/zakgeldberekening, refunds, interne spaarinleg en veilige syncconflicten zijn met de gerichte bestaande contracten gecontroleerd.

### Productiegegevens, IndexedDB en Firestore

Een verse bestaande productieadministratie is alleen gelezen, met controle dat de cloudhead tijdens de uitlezing niet wijzigde. De opgeslagen toestand blijft bytegelijk na de V118-normalisatie; herhaalde normalisatie geeft dezelfde toestand. Transactie- en import-ID's blijven behouden. De ruwe uitlezing is uitsluitend privé en lokaal opgeslagen; zij wordt niet gecommit of gepubliceerd.

De daadwerkelijke uitgelezen administratie is in een geïsoleerd lokaal browserprofiel gestart met de gecontroleerde live V117-bundle. Daarna is dezelfde IndexedDB geopend door V118, vervolgens door V117 en opnieuw door V118. Transacties, historische budgetten, inkomensinstellingen, vaste lasten, spaarledger, imports, maandgegevens en de maanduitkomsten voor september/oktober/november blijven gelijk. Een uitsluitend in deze geïsoleerde proef toegevoegd V118-ijkpunt blijft ook bij software-rollback behouden.

Schema 11, native IndexedDB-versie 4, lokale opslagversie 1 en de bestaande Firestore-generation-/envelopecontracten blijven ongewijzigd. V118 voegt optionele velden toe via bestaande records. Geen nieuwe migratie, database-ingreep, security-ruleswijziging of productie-recordactivering is nodig. Het reeds bestaande productie-recordtransport blijft geblokkeerd en de recordsessie blijft uitsluitend lokaal/emulatorgericht.

De bestaande gemockte device A/B- en conflictcontracten zijn opnieuw uitgevoerd. Er is geen echte schrijfproef met twee productieapparaten uitgevoerd.

### PWA en rollback

De echte service worker is lokaal door V117 → V118 → offline V118 → V117 gegaan op één origin. Het nieuwe cache-/assetschema laadt, de app herstart offline en bestaande lokale transacties, regels en ledger blijven behouden. De bestaande cachetests controleren ook mismatched shellweigering, cache-isolatie en behoud van journals/broninformatie na reconnect.

Rollback betreft uitsluitend applicatiecode: een gewone nieuwe revertcommit van de V118-release naar de gecontroleerde V117-client, via dezelfde `main`/Pages-route. Geen reset, force-push, cloudrestore of terugzetten van een oude financiële snapshot. Nieuwe financiële gegevens moeten behouden blijven. V117 toont de nieuwe bankbeheerfuncties niet, maar behoud van de optionele ijkpuntgegevens en de bestaande financiële uitkomsten is in de downgradeproef bevestigd.

### Interface

Dashboard/vooruitblik, Vrij na verplichtingen en toelichting, rekeningbeheer, rekeningdetails, saldoformulieren, CSV/Nakijken, voorstelredenen, alternatieven, bulk, modals, navigatie en herladen zijn op 1440, 390 en 320 px getest. P3-screenshots zijn opnieuw geopend en visueel gecontroleerd. P4 behoudt de eerder gecontroleerde compacte uitleg en bestaande vormgeving. Er is geen concrete nieuwe visuele afwijking gevonden; geen algemene Impeccable-audit of redesign uitgevoerd.

## Overgenomen bewijs

De eerdere pakketverslagen en zeven auditbestanden blijven behouden. De ongewijzigde financiële motor, het P3-herstel en de oorspronkelijke ontwerpkeuzes zijn daarmee herleidbaar. Historische grote-fixture-/emulatormetingen zijn niet als nieuwe releasecontrole gepresenteerd. De nieuwe tests en private productie-compatibiliteitsproef zijn aanvullend bewijs op de definitieve releaseassets.

## Productiedoel, herstelpunt en publicatie

GitHub API, remote `main` en de laatste succesvolle Pages-run bevestigen: **GitHub Pages legacy, branch `main`, repositoryroot `/`**, productie-URL **https://dionvs.github.io/Finize/**. `main` is niet beschermd; er is geen PR-/reviewvereiste omzeild. De bestaande Firebase-configuratie betreft Firestore, geen Hosting-releasepad. Firebase-project `financien-7dd43` is uitsluitend gelezen.

Laatst gecontroleerde stabiele productiecommit: `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`, build `117-p4r5`, succesvolle Pages-run `38293280017`. Alle zeven live shell-/icoonassets zijn bytegelijk aan die commit en lokaal veiliggesteld.

Herstelpunt: `C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-release-20261014-170442`. De 58 gewijzigde/niet-gevolgde bestanden zijn gekopieerd, met manifest en SHA-256-terugleescontrole. Bestaande herstelpunten zijn behouden. Herstelbare lokale Git-ref: `rollback/finize-v117-p4r5-20261014` naar de stabiele V117-commit. De verse private productie-uitlezing blijft buiten Git.

Releasecommit, deploymentresultaat en live-smokecheck worden hieronder na daadwerkelijke uitvoering vastgelegd. Er worden alleen via de bestaande Pages-workflow applicatiebestanden gepubliceerd; geen Firestore-regels, indexen, authenticatie of backendconfiguratie uitgerold.

## Nog niet gecontroleerd en beperkingen

Een echte aangemelde productiegebruikerssessie en schrijf-/multi-deviceproef worden niet gebruikt voor deze publicatie, om productieschrijfacties te vermijden. De live-smokecheck gebruikt een geïsoleerde sessie met geblokkeerde backendschrijfacties. Geen fysieke telefoon, andere browserengine of volledige toegankelijkheidscertificering. Oud V117-emulator-/schaalbewijs blijft aan zijn oorspronkelijke build gebonden. Er zijn geen aannames over een provider of bankdekking aan de release toegevoegd.

## Publicatieresultaat

Nog niet gepubliceerd. Publicatie en niet-destructieve livecontrole volgen uitsluitend nadat het definitieve bron-/artefact-/geheimenonderzoek is afgerond.
