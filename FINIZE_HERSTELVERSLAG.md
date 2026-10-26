# Finize herstelverslag — 25 oktober 2026

Werkbranch: `codex/finize-audit-herstel-20261025`. Uitgangspunt: lokale en remote main schoon op `e9f3dbd1203bfd3f91c24c1c3f9ef6ed979b9791` (V118-r12).

## Bronnen en grenzen

Herstelprompt volledig gelezen. Beide oorspronkelijke bijlagen via de eerdere chat teruggevonden: `Finize-technische-audit-2026-10-25.md` en het ZIP met tien bewijsbestanden. Geen inhoudelijk verschil tussen auditcommit en actuele main. Bewijsarchief bevat een eerdere in-memory bulkproef en 108 eerder geslaagde bestaande tests; dit zijn geen actuele productiemetingen.

Alle reproducties gebruiken synthetische gegevens en een aparte lokale browsercontext met productieverbindingen geblokkeerd. Geen productiegegevens, banksessies, rekeningbindingen, autorisaties of migraties gewijzigd. Dion gaf tijdens uitvoering aanvullende toestemming voor publicatie zodra relevante tests, controles en reviews foutloos zijn afgerond. Dit machtigt geen productiegegevenscorrecties of banksync.

## Stap 0 — Diagnose

- Onderzocht: frontend request/ingest, provideradapter, backend sync/HTTP-handler, profielreader en groepsgoedkeuring.
- Productieoorzaak van sync en bulk blijft onbewezen. Geen actuele foutrespons of productielogs ontvangen. Backendreader leest aantoonbaar legacy `budgetState/current`, terwijl frontend ook actieve recordopslag ondersteunt. Geen speculatieve wijziging van die autorisatiebron.
- Bewezen foutdiagnostiekprobleem: ophalen, JSON-antwoord, staging en opslag konden dezelfde generieke verbindingsmelding krijgen.
- Wijziging `src/ui/bank-connection.mjs`: fase aan fout koppelen; begrijpelijke stap tonen; `lastFailure` bewaart uitsluitend fase, toegestane foutcode en HTTP-status. Geen ruwe fouttekst, bankinhoud, profiel-ID of token in diagnostiek. Geen wijziging aan timeout/retry/identiteit/backend.
- `app.js` opnieuw gegenereerd via `scripts/build.mjs`.
- Bestaande Node-tests provider en multirekening: **41/41 geslaagd**.
- Bestaande browserroute cash/goedkeuren/herhaalde sync/herladen: **2/2 geslaagd**, 390 en 1440 px.
- Nieuwe browserproef zes geselecteerd/zevende niet: **geslaagd**, daadwerkelijke dialoog en IndexedDB, na herladen categorie en zes financiële effecten behouden; zevende onbevestigd.
- Vier foutinjecties request/JSON/staging/opslag: **4/4 geslaagd**, geen wijziging van bestaande transacties en geen ruwe bankdetails in de foutmelding.
- Native IndexedDB-fout op de tweede importwrite: **geslaagd**; 1/6 goedgekeurd, vier niet geprobeerd, na herladen één effect, retry levert precies zes unieke effecten. De eerste versie van de foutinjectie nam ten onrechte aan dat de opgeslagen rijen altijd een array waren; de gecorrigeerde proef breekt de tweede native write af.

Review: startverslag en stapverslag via computerbesturing naar ChatGPT verzonden. Volledige auditoverdracht en stap-0-review gelezen. **Voorwaardelijk technisch akkoord voor stap 1**: alleen vaste toegestane foutwaarden, HTTP-fetch niet verwarren met volledige opslag, productieoorzaken openhouden. De vier foutproeven dekken dit. Reviewer beoordeelde het verslag, niet onafhankelijk de diff. Geen toestemming voor merge/deploy.

## Stap 1 — Maandgebonden importweergave

Bewezen oorzaak: bundelselectie op datumbereik, daarna volledige bundel gebruikt voor details, tellingen en match-/bulkselectie.

`src/import/runtime.js` gebruikt nu een tijdelijke `WeakMap` voor de maandcontext en één `importViewRows`-filter op oorspronkelijke bankdatum. `importViewSummary`, `renderDraftModalMeasured`, `matchCandidates` en bulkbewerking gebruiken dezelfde rijselectie. Een andere geselecteerde dashboardmaand verandert een al geopende import niet. Wisselen in de nieuwe keuzelijst slaat eerst het bestaande concept veilig op; alle maanden blijft een expliciete keuze. Importhistorie opent expliciet alle maanden.

`renderReceipt` toont bij een maandcontext geen hele-bundeltotalen. `bindImportPanel` leest de werkelijke importdetails en berekent daarvan de maandtotalen. Bij ontbrekende/verouderde details wordt de bestaande cloudreader gebruikt; bij onbeschikbaarheid staat er expliciet dat de maandtotalen nog niet beschikbaar zijn. Geen opgeslagen maandindex of mutatie van bundelrijen toegevoegd. Centrale financiële engine ongewijzigd.

Gerichte mobiele browserproef **geslaagd**: 3 septemberrijen (€33), 5 oktoberrijen (€75); oktober-bulk en vergelijkbare transacties bevatten uitsluitend vijf rijen. Wisselen van dashboardmaand laat het geopende venster op oktober staan. Vijf goedkeuringen laten september en alle originele bankvelden intact. Alle maanden toont acht; september toont drie; maandreceipt toont 3/€33. Ontbrekende details tonen geen gefingeerde totalen. Screenshot daadwerkelijk geopend en visueel gecontroleerd; geen horizontale overflow.

Bestaande gerichte selected-month/import-review-tests: **2/2 geslaagd**. Review stap 1 wordt gevraagd vóór stap 2.

Review stap 1: **technisch akkoord voor stap 2**, op basis van gerapporteerde resultaten. Aanvulling: async resultaten mogen geen vervangen editor bijwerken; bestaande guard controleert dit. Ongedateerde bronregels mogen niet stil verdwijnen: toegevoegd bericht met aantal en verwijzing naar Alle maanden; oorspronkelijke rij en fout blijven daar zichtbaar. Geen toestemming voor publicatie.

## Stap 2 — Winkelherkenning

Bewezen oorzaak: exacte organisatievergelijking houdt Middelburg/Vlissingen apart. In `organizationName` een kleine tabel met volledige genormaliseerde namen toegevoegd: Jumbo Middelburg/Vlissingen/Foodmarkt → Jumbo; AH Middelburg/Vlissingen → Albert Heijn; AH to go Rotterdam → afzonderlijk AH to go. Bestaande normalisatie van Albert Heijn met filiaalnummer behouden. Onbekende bedrijven behouden hun naam. Geen substringregel `ah` toegevoegd.

`recognitionProposal` normaliseert ook bestaande organisatieregelwaarden voor vergelijking. Alle passende bestaande regels blijven beschikbaar; tegenstrijdige categorieën worden als conflict gerapporteerd. `matchIdentity` en `learnedRecognitionRules` gebruiken dezelfde canonieke organisatie. Geen bankbron-ID, deduplicatie, automatische goedkeuring of financiële categorie aan alias gekoppeld.

Nieuwe gerichte Node-controles voor aliassen, negatieve matches, categorieconflict, behoud brondata en context/expliciete goedkeuring: **geslaagd**. Bestaande suggestions-tests: **25/25 geslaagd**. Mobiele browser: vijf Middelburg plus drie Vlissingen vormen acht afzonderlijke geselecteerde bronnen, acht duurzame effecten; onbekend Jumbo Bouwbedrijf blijft onbevestigd. Tien originele bronrijen inclusief één zonder datum blijven behouden; bericht verwijst naar Alle maanden en daar blijft de importfout zichtbaar. Herladen behoudt acht goedkeuringen. **Geslaagd**.

Review stap 2 wordt gevraagd vóór stap 3.

Review stap 2: **technisch akkoord voor stap 3**, op basis van gerapporteerde resultaten. Reviewer bevestigt exacte aliassen, behoud conflicten en acht afzonderlijke effecten. Verzoekt bestaande financiële engine te behouden en alleen gerichte occurrence-/salaris-/vervangingscontroles toe te voegen. Geen merge/deploy/gegevensacties.

## Stap 3 — Planning en werkelijke betalingen

Geen defecte aggregatie aangetoond. Financiële engine, planningstijdlijn, occurrence-IDs en salarisidentificatie blijven ongewijzigd. Bestaande `occurrenceFields`, salarisvelden en `sourceConfirmationFields` verduidelijken nu dat een gekoppelde betaling de planning vervangt en dat een eerdere handmatige ontvangst afzonderlijk, expliciet moet worden vervangen. Gelijk bedrag/datum is geen vervangingsbewijs. Toekomstige planning blijft bij `fixedAmountMode: none` behouden.

Nieuwe financiële controles: vaste last plan100/werkelijk110 telt110, volgende en vorige maand blijven100; salaris plan3000/ontvangen2500 telt2500. Een tweede werkelijke handmatige registratie telt bewust onafhankelijk mee totdat expliciete vervanging is bevestigd. Na die bestaande bevestigingsflow telt2500 één keer; handmatige bron en volledig vervangingsbewijs blijven behouden. **4/4 nieuwe gerichte Node-tests geslaagd**, inclusief de eerdere aliascontroles.

Mobiele UI-controle van de bestaande category→vaste last→betaalmoment→goedkeuren-flow: **geslaagd**, werkelijke110 en september/november100. Nieuwe uitleg aanwezig. Screenshot geopend. Eerder uitgevoerde tijdlijn-/salarissuites **42/42 geslaagd**.

Kleine noodzakelijke aanvulling op stap 1: bron openen vanuit een historische transactie gebruikt expliciet de maand van die bron; automatische importrefresh en conflict-/validatieheropening behouden de vastgelegde maandcontext. Verlate importantwoorden mogen een gesloten/vervangen venster niet heropenen; sluiten verhoogt het bestaande openSequence-token. Gerichte regressie volgt bij eindcontrole.

Geen bestaande productiegegevens gecorrigeerd. Zonder betrokken registraties blijft onbekend welke koppeling in productie ontbreekt. Review stap 3 wordt gevraagd vóór stap 4.

Review stap 3: **technisch akkoord voor stap 4**, op basis van gerapporteerde resultaten. Aanvullingen: ontbrekende clouddata nooit als lege bundel behandelen, pending lokale wijzigingen behouden, revisieconflict veilig stoppen en maandcontext-race nog controleren. Geen toestemming vanuit de reviewer voor productieacties; latere publicatietoestemming komt rechtstreeks van Dion.

## Stap 4 — Herhaalde synchronisatie

`resolveProviderImportBase` in `src/import/runtime.js` hergebruikt `recoverJournal`, `resolveImportDetails`, `fetchImportFromCloud`, pending-basecontrole en bestaand conflictbewijs. `bank-connection.mjs/ingest` gebruikt dit vóór staging in plaats van uitsluitend de lokale lijst. Ontbrekende details mogen alleen worden hersteld als de financiële samenvatting dezelfde versie en operatie noemt; een nieuwere externe financiële keuze vereist eerst de bestaande volledige administratiesynchronisatie. Nieuwe eerste import mag alleen bij aantoonbaar niet eerder gerefereerde identiteit als nieuw beginnen. Scope- of revisiewijziging stopt.

Vijf gerichte controles slagen: actuele details herstellen; gerefereerde cloudimport ontbreekt; cloudkeuze nieuwer dan financiële head; lokale versie verandert tijdens ophalen; pending keuze met gewijzigde cloudbasis. Bestaande lokale keuzes en financiële staat blijven behouden. Alle **9 nieuwe gerichte Node-tests** slagen. De **2 bestaande browserroutes** voor cash/approval/tweede sync/herladen slagen opnieuw na deze wijziging. De eerder geslaagde providertests bewijzen behoud bij identieke feiten, conflict bij gewijzigde feiten en afzonderlijke bankidentiteiten.

Provideradapter en backend zijn ongewijzigd. Productieoorzaak verbindingsfout blijft onbekend; geen live banksync gestart en geen sessie-/profielmigratie uitgevoerd.

Aanvullende cloudproef voor stap 5: echte IndexedDB plus het bestaande Firestore-recordtransport met uitsluitend gesimuleerde HTTP-responses; zes expliciete goedkeuringen duurzaam gepubliceerd naar een synthetische cloud, teruggelezen via `loadImport` en integriteitscontrole. Zevende onbevestigd; herhaalde sync idle; lokale reload behoudt zes effecten. **Geslaagd**, geen echt cloudverkeer. Review stap 4 wordt gevraagd vóór afronding van stap 5.

Review stap 4: **technisch akkoord voor stap 5**. Vereist nog revisiewijziging vlak vóór persist en late-response-/maandcontextcontrole. Beide gerichte browserproeven slagen: een verlate lokale importread opent het gesloten venster niet opnieuw; een historische rij opent september terwijl dashboard oktober selecteert. Bij een concurrente importversie ná staging stopt opslag met `import-conflict` en blijft de nieuwere lokale keuze plus financiële staat behouden. Controle met reeds goedgekeurde bron wordt opgenomen in de eindrun.

## Stap 5 — Bulkgoedkeuring

Geen defect in de normale zes-goedkeuringenroute aangetoond. Daarom geen wijziging aan `approveSelectedSources`, `runApprovalGroup`, commitserialisatie of afzonderlijke operatiebewijzen.

De gerichte echte browser-/IndexedDB-proeven bewijzen zes geselecteerd met zevende ongewijzigd, juiste categorie, duurzame reload, acht filiaalbetalingen zonder samenvoeging, eerlijke gedeeltelijke opslagfout (1/6 en vier niet geprobeerd) en veilige retry zonder dubbele effecten. Aanvullend zijn zes goedkeuringen met bestaande recordtransport en gesimuleerde cloudresponses teruggelezen en geverifieerd. Productieoorzaak van de gemelde vijf achterblijvers blijft onbekend; de specifieke productierijstructuur en foutuitslag zijn daarvoor nog nodig.

Geen gegevensreparatie of herimport uitgevoerd. Review stap 5 wordt gevraagd vóór eindcontrole/publicatievoorbereiding.

Review stap 5: **technisch akkoord voor eindcontrole en publicatievoorbereiding**. Reviewer vereist behoud van reeds goedgekeurde effecten bij revisieconflict, PWA-upgrade/offline/cache/data en volledige relevante herhaling. Publicatie blijft afhankelijk van Dions directe toestemming en geslaagde controles.

## Stap 6 — Eindcontrole en release V118-r13

### Status per gemeld probleem

| Probleem | Aangetoond en uitgevoerd | Resterende grens |
| --- | --- | --- |
| September/oktober vermengd | Presentatiefout hersteld: maandfilter op bronbankdatum voor rijen, tellingen, matches en bulk; historie/alle maanden expliciet bereikbaar. | Financiële engine telde al per maand; geen dataherberekening uitgevoerd. |
| Winkelfilialen apart | Kleine exacte aliastabel; dezelfde canonieke organisatie bij voorstellen, leren en groepskeuze. | Geen brede AH-match of nieuwe categorie; tegenstrijdige bestaande regels blijven conflict. |
| Vaste last plan plus betaling | Bestaande occurrence-flow gecontroleerd: 100 gepland/110 betaald telt 110. Uitleg verduidelijkt. | Ontbrekende productiekoppeling niet automatisch ingevuld. |
| Salaris dubbel | Bestaande salarisflow gecontroleerd: plan3000/werkelijk2500 telt2500. Twee werkelijk geregistreerde ontvangsten vereisen expliciete vervangingsbevestiging. | Geen automatische verwijdering of vervanging op bedrag/datum. |
| Opnieuw bank bijwerken | Bestaande cloudreader/pending-/revisiecontrole vóór staging hergebruikt; fase van mislukken zichtbaar zonder gevoelige foutinhoud. | Productieoorzaak onbekend; legacy backendprofielreader ongewijzigd, geen live banksync getest. |
| Zes gekozen, slechts één verwerkt | Normale lokale en gesimuleerde cloudroute bewijzen zes duurzame goedkeuringen. Native foutinjectie rapporteert gedeeltelijk resultaat en retry zonder dubbeltelling. | Specifieke productieoorzaak onbewezen; bulkarchitectuur niet zonder bewijs aangepast. |

### Aanvullingen en verklaarde testafwijkingen

- Reeds goedgekeurde bankbron plus alle financiële effecten blijven bytegelijk bij revisiewijziging ná staging/vóór persist. Nieuwere lokale notitie en goedkeuring blijven behouden.
- Verschijnen en verdwijnen van een lokale import tijdens cloudophalen veroorzaken een veilig conflict. De tests controleren ook goedkeuringsbewijs en oorspronkelijke bankvelden; geen overschrijving.
- Verlate lokale read én verlate journalread mogen een daadwerkelijk gesloten venster niet heropenen. Na ieder relevant await-moment wordt het openingtoken opnieuw gecontroleerd. Historische bron opent zijn eigen bankmaand.
- Eerste brede browserrun: 36/45 geslaagd. Vier historietests negeerden een afgewezen voorbereidende commit (nieuw profiel zonder accountType); dezelfde fout met ongewijzigde r12 gereproduceerd. Vier layouttests toonden augustusrijen vanuit de huidige maand. Fixtures gebruiken nu passende bestaande seed, expliciete augustuscontext en een gecontroleerde commit; de functionele verwachtingen zijn behouden. Alle acht afzonderlijk geslaagd. Negende afwijking was de bestaande verwachte verbindingsmelding; die tekst is behouden met de nieuwe veilige fase erbij.
- De extra raceproef wacht expliciet totdat de asynchrone sluitactie duurzaam is afgerond vóór de vertraagde response wordt vrijgegeven. Dit onderscheidt een nog bezig zijnde sluitactie van onterecht heropenen.

### Controles

- Gerichte Node-suites: **148/148**, plus actuele provider-/multirekeningsuites **41/41**; samen **189 geslaagd, 0 mislukt**, waaronder 11 nieuwe herstelgevallen. Geen volledige repositorybrede suite geclaimd.
- Definitieve gerichte browserherhaling: **45/45 geslaagd, 0 mislukt** op de definitieve releasebestanden. Onder meer echte IndexedDB, foutinjectie, gesimuleerd bestaand record-cloudtransport, goedkeuring/herladen, maand-/racegrenzen, 320/390/430/1440 px en r12→r13/offline/rollback. De negen oorspronkelijke afwijkingen zijn verklaard en in deze volledige herhaling afgedekt.
- Build byte-reproduceerbaar; JavaScript-syntax, CSS-parse en diffcontrole geslaagd. Eén reeds bekende CSS-tokenmelding `--line`; geen nieuwe CSS gewijzigd. UI-detector: geen meldingen. Mobiele screenshots daadwerkelijk geopend en visueel gecontroleerd.
- Dated herstelarchief van de oorspronkelijke r12: `backups/audit-herstel-20261025/baseline-r12.zip`, SHA-256 `c732384a29e88274533fb623e14c0bb8d95367b58f9b3c07f2c6c1d35eb29460`.
- Machineleesbaar bewijs: `docs/audit/finize-herstel-20261025.json`; actuele logs en screenshots bewaard onder `backups/audit-herstel-20261025/`. Beschermde engine/provider/backend/rules vergeleken met uitgangscommit en ongewijzigd.

### Gewijzigde bestanden en publicatiegrens

Productiecode uitsluitend `src/import/runtime.js`, `src/ui/bank-connection.mjs`, gegenereerd `app.js`, plus gekoppelde asset-/cacheversie in `index.html` en `service-worker.js`. Testbewijs: nieuwe `tests/finize-audit-herstel.test.cjs`, `tests/browser/finize-audit-herstel.spec.cjs`, `tests/helpers/audit-record-cloud.cjs`; gerichte uitbreiding van bankbrowser-/PWA-test, reparatie van twee bestaande browserfixtures en actualisatie van bestaande releaseversie-asserties. Geen wijziging aan financiële engine, provideridentiteit, backend, Firestore-rules, gegevensschema, timeouts of retrybeleid.

Git-diff/commit en dit verslag vormen het reviewbare resultaat. Review is gebaseerd op gedeelde bevindingen en testbewijs; ChatGPT heeft niet zelfstandig de volledige diff uitgevoerd. Publicatie volgt pas na het laatste technische akkoord en een foutloze relevante eindrun; daarna Pages-status, exacte publieke assethashes en synthetische browsercontrole. Alle productiegegevens- en bankhandelingen blijven uitgesloten.

Definitieve review stap 6 via computerbesturing ontvangen en volledig gelezen: **technisch akkoord voor publicatie** op basis van 189/189 Node en 45/45 browsertests, verklaarde fixturecorrecties, behoud van bronnen/effecten/historie en beperkt diff. Reviewer vraagt exacte commit/schone working tree, geslaagde Pages-build, publieke assethashes en synthetische smoke. Bij afwijkende hashes, deploymentfalen of regressie stoppen en terugkoppelen. Productieoorzaken sync/bulk blijven open. Dions aanvullende directe publicatietoestemming vervangt de oorspronkelijke lokale opdrachtgrens tegen merge/deploy.

### Risico's en gebruik

Er is geen gegevensmigratie, automatische herimport, categoriewijziging van bestaande registraties of verwijdering. Nieuwe aliassen kunnen voortaan meer voorstellen binnen dezelfde organisatie opleveren; expliciete selectie en goedkeuring blijven verplicht. Een cloud-/revisieconflict kan Bank bijwerken bewust stoppen totdat de bestaande administratiesynchronisatie is gecontroleerd. De fase van een fout ondersteunt diagnose, maar bewijst niet de productieoorzaak.

Gebruikerssamenvatting: controleer een import standaard per geselecteerde bankmaand; kies bewust Alle maanden voor historie of ongedateerde regels. Bekende Jumbo-/AH-filialen kunnen samen worden voorgesteld, terwijl iedere betaling apart blijft. Koppel een vaste betaling aan het juiste betaalmoment en salaris aan de juiste persoon; bevestig een eerdere handmatige registratie alleen bij bewezen vervanging. Brondata en historie blijven behouden. Voor de specifieke productieproblemen bij sync/bulk zijn nog de veilige fase/code/status of concrete foutuitslag van de betrokken actie nodig.

## Publicatie en publieke verificatie

**V118-r13 gepubliceerd** naar [Finize](https://dionvs.github.io/Finize/). Releasecommit `e984e549d59dc4ced94f20bea95fb8029fa9bab2`, via werkbranch gepusht en fast-forward naar `main`. Voor publicatie was de working tree schoon. [Pages-run 40238809769](https://github.com/Dionvs/Finize/actions/runs/40238809769) is volledig geslaagd: build, deploy en statusrapportage.

Alle zeven publieke assets (index, app.js, app.css, service-worker, manifest, icon-192, logo) geven HTTP200 en zijn SHA-256-identiek aan de gitblobs van de releasecommit. Exacte hashes en browseruitkomsten staan in `docs/audit/finize-herstel-20261025-publicatie.json`. Publieke synthetische browserproeven op **320/390/1440 px geslaagd**: septemberbron blijft buiten oktober; twee Jumbo-filiaalbetalingen apart goedgekeurd; na reload precies twee financiële effecten; geen horizontale overflow of pageerrors. Screenshot van publieke 320px-weergave daadwerkelijk geopend.

Testgrens expliciet: met bewust geblokkeerde externe Firebase-SDK blijft de publieke aanmeldpoort terecht gesloten en verschijnt `Inloggen kon niet worden gestart`. Een eerste probe wachtte daardoor vergeefs op de financiële app-bootstrap; dit was onjuiste testvoorbereiding, geen aangetoonde releasefout. Die gesloten poort is afzonderlijk gecontroleerd. De functionele publieke proeven gebruiken daarna de **bestaande synthetische auth-testdriver**, verzonnen gebruiker/huishouden en eigen lokale scoped opslag. Alle externe origins bleven geblokkeerd. Dit bewijst de gepubliceerde assets/interface en lokale opslag, **geen echte authenticatie, productiecloudwrite of bankverbinding**. Geen productiecode aangepast voor de smoke-test.

De afsluitende documentatiecommit voegt uitsluitend dit publicatiebewijs toe; de geteste runtime-assets blijven ongewijzigd. Geen nieuwe volledige testcampagne nodig voor deze documentatie. Het publicatieverslag is via computerbesturing naar ChatGPT gestuurd voor afsluitende controle.

Afsluitende ChatGPT-review volledig gelezen: **akkoord met afbakening en eindoplevering** op basis van het verslag. Synthetische UI-controle is expliciet geen bewijs voor echte productieauthenticatie/cloud/banksync. Reviewer stemt in met uitsluitend documentatiebewijs toevoegen en vraagt daarna nogmaals Pages-status en de zeven publieke hashes te controleren.

## Aanvulling V118-r16 — prognose en persoonlijk spaarbedrag

Het vervolg op r15 is apart onderzocht en beoordeeld: actuele prognosekaart en toekomstige grafiek delen nu dezelfde P1-saldobasis; budgetspreiding hangt niet van het grafiekfilter af. De persoonlijke kaart volgt zichtbaar inkomen inclusief teruggaven minus vaste lasten minus gebruikt budget. Een expliciete keuze kopieert het actuele maandbedrag eenmalig naar de bestaande spaarplanning; handmatige invoer blijft mogelijk.

Volledig diagnose-, review-, test- en publicatiebewijs: [V118-r16-verslag](docs/audit/finize-prognose-maand-sparen-r16-20261026.md). Release `a2940e3`, 79 Node-bestanden en 96+3 browsergevallen geslaagd; Pages succesvol, zeven assethashes gelijk, negen geïsoleerde publieke synthetische proeven geslaagd. Uitsluitend gecontroleerde productiehashes gelijk vóór/na; geen productiegegevens- of echte bankactie. Het oudere desktopscenario met de vervangen dashboardstructuur faalt ook op r15 en blijft afzonderlijk gedocumenteerd.

## Aanvulling V118-r17 — maandultimo en gerichte koppelvoorstellen

Op verzoek van Dion vervangen we uitsluitend de eerste prognosekaart door **Veilig te sparen op [laatste dag geselecteerde maand]**, op dezelfde positie. Huidig saldo, laagste prognose, buffer en grafiekfilters behouden hun bestaande berekening. Het bestaande spaarplan wordt niet automatisch aangepast.

De nieuwe selector `selectMonthEndSavings` gebruikt dezelfde kasstromen en dagmotor. Met E als verwacht maandeindsaldo en C als cumulatieve kasstroom vanaf nul na maandultimo, inclusief nul in het minimum, geldt: benodigd beginsaldo = buffer − min(0, C); veilig te sparen = max(0, E − benodigd beginsaldo). De volledige volgende maand en de periode tot en met de eerste relevante ontvangst daarna tellen mee. Alleen een expliciet geïdentificeerde, nog geplande maandafsluitingsinleg waarvan we het bedrag oplossen wordt uitgesloten; uitgevoerde overboekingen en andere gedateerde spaarverplichtingen blijven meetellen. Het resterende maandplan is alleen vergelijkingsbedrag voor extra ruimte en tekort. Essentiële ontbrekende gegevens, waaronder onbekende betaaldagen of onvolledige bankdekking, leveren geen numerieke veilige spaarclaim op.

De importuitbreiding stelt uitsluitend bij een spaarboeking bestaande geschikte inkomsten of interne ontvangsten voor met exact gelijk resterend koppelbaar bedrag, binnen dezelfde financiële eigenaar en maand. Een interne ontvangst moet volgens de bestaande regels voor het spaardoel beschikbaar zijn. Een gelijk bedrag is geen identiteitsbewijs: de gebruiker kiest expliciet en verwerkt vervolgens via de bestaande goedkeuring. Geen algemene vergelijking van gewone uitgaven, geen automatische koppeling en geen wijziging van de bestaande financiële verwerking. Dions reeds gemaakte koppeling van € 6.100 wordt niet aangepast.

Validatie: 81 Node-testbestanden en 104 gecombineerde browsergevallen geslaagd, waaronder IndexedDB-herladen, synthetisch cloudtransport, bankimportconflicten en PWA-upgrade. Het aangeleverde volledig synthetische rekenvoorbeeld geeft oktober € 700, november € 1.500 en na de novemberoverboeking een decemberminimum van € 200. De buffer wordt eenmaal beschermd; sparen blijft een vergelijking zonder automatische planwijziging. De interface is getest op 320, 390, 430 en 1440 px. Eén eerste gecombineerde cloudproef faalde; dezelfde proef slaagde afzonderlijk en alle 104 proeven slaagden in de volledige herhaling. De oorzaak van die eenmalige mislukking is niet vastgesteld.

Dit werk verandert geen productiegegevens, bankverbindingen of backend. Synthetische proeven bewijzen geen geslaagde echte banksynchronisatie. Publicatie en controle van publieke assets worden na deployment in de opdrachtchat gerapporteerd.
