# V118 P5b — Enable Banking, lokale implementatie

Datum: 23 oktober 2026. **Niet geactiveerd of gepubliceerd.**

## Gewijzigde modules en hergebruik

- functions/src/enable-banking.mjs: AIS-service, kortlevende RS256-JWT's, eenmalige gehashte state, sessies, herautorisatie, rekeningcontrole, paginering, synchronisatielease en intrekking.
- functions/src/index.mjs: Cloud Functions v2, Firebase ID-tokencontrole met intrekkingscontrole, actuele huishoudkoppeling, gecontroleerd rekeningprofiel en Secret Manager.
- src/import/enable-banking-adapter.mjs: providerrecords naar P5a, met bronpayload, identiteit, boekingsdatum, gehele centen, saldo-observaties en onvolledige dekking. Geen fictief CSV-bestand of CSV-identiteit.
- src/core/provider-balances.mjs: uitsluitend bruikbare geboekte saldo-observaties als projectiebasis, zonder handmatig ijkpunt te fabriceren.
- src/ui/bank-connection.mjs: autoriseren, handmatig ophalen, bestaande Nakijken-editor openen en banktoegang intrekken binnen Rekeningdetails.
- Kleine aansluitingen in bankbronnen, P1/P2, rekeningdetails, de bestaande importopslag en synchronisatie. Gegenereerde app.js lokaal bijgewerkt.

Hergebruikt: normalizeBankInput, fysieke accountProfiles, ensureImportBankSources/selectBankTransactions, P1 selectAccountBalance, P2 selectDailyLiquidity/projectDailyLiquidity, de P3-projectie-interface, P4 classifyOriginal, beginImportEditor/commitImportEditor, bestaande importjournals/operatiebewijzen en IndexedDB-/Firestore-chunkopslag.

## Verwerking

Geboekte, bewezen providerbronnen tellen onmiddellijk fysiek mee, ook vóór financiële goedkeuring. De bronheader is geen financiële boeking. Alleen de bestaande expliciete goedkeuringsroute maakt categorie-/budget-/salaris-/spaar-/vaste-lasteffecten. Goedkeuren boekt de kasbeweging niet opnieuw; ophalen behoudt bestaande keuzes.

De combinatie rekeningidentiteit en entry_reference bepaalt de providerbron. transaction_id wordt alleen als oorspronkelijk bewijs behouden. Ontbrekende identiteit blokkeert bronverwerking. Afwijkende feiten bij dezelfde identiteit blokkeren opslag zonder bestaande administratie te overschrijven.

CSV/API-overlap zonder gedeeld bewijs verschijnt als mogelijke dubbeling en telt niet nogmaals mee. De bestaande identiteitskeuze kan de bronnen expliciet koppelen. Beide importbewijzen blijven bewaard en goedgekeurde CSV-boekingen blijven intact. De omgekeerde volgorde (API, daarna CSV) is ook afgedekt.

CLBD met geldige referentiedatum kan een geboekt eindsaldo onderbouwen. ITBD met geldig tijdstip op de ophaaldag wordt afzonderlijk als intradaysaldo behandeld: voorlopig en met het tijdstip. Dezelfde dagmutaties worden niet nogmaals opgeteld. De maandgrafiek gebruikt de bestaande waarnemingscorrectie; openstaande geplande kasbewegingen van die dag blijven in de vooruitblik. Beschikbare, onbekende of ongedateerde saldi worden niet als einde-dagsaldo gebruikt. Handmatige ijkpunten blijven ongewijzigd.

Paginering wordt afgemaakt, ook na een lege pagina met vervolgcode. Bij ontbrekende pagina's blijft het resultaat zichtbaar onvolledig; eerdere transacties blijven bestaan. Volledige paginering bewijst geen volledige bankhistorie: P5a-dekking blijft conservatief gedeeltelijk.

De handmatige standaardperiode is 30 dagen. Backend accepteert maximaal 90 dagen per verzoek en begrenst paginering. Geen scheduler, betaalroute, financiële migratie of opslagomschakeling.

## Backendroutes

Basispad na eventuele deployment: https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking

| Route | Methode | Controle / resultaat |
| --- | --- | --- |
| /auth/start | POST | Firebase-token, geverifieerde toegestane UID, huishouden, profiel en exact ING-IBAN; alleen autorisatie-URL |
| /callback | GET | Eenmalige state, tien minuten geldig; identiteit, lidmaatschap en profiel opnieuw controleren; code uitsluitend server-side uitwisselen |
| /status | POST | Zelfde gebruikers-/rekeningcontroles; alleen publieke verbindingsstatus |
| /sync | POST | Zelfde controles, geldige sessie en lease; alleen toegestane rekening, geboekte transacties en saldi |
| /disconnect | POST | Zelfde controles; lokaal blokkeren vóór providerintrekking; private metadata bewaren als intrekken opnieuw moet worden geprobeerd |

Callback stuurt terug naar https://dionvs.github.io/Finize/?banklink=complete zonder code, provider-JWT of API-sessie-ID. Browserverzoeken zijn beperkt tot origin https://dionvs.github.io. CORS is aanvullend; token-, huishoud- en rekeningcontroles bepalen de toegang.

## Opslag en actieve regels

Backendmetadata staat uitsluitend onder finizeBankPrivate/ing/metadata/: gehashte states, verbinding, lease en eventueel nog in te trekken oude sessies. Geen clientrechten toevoegen; de bestaande algemene weigering dekt deze collectie.

Admin SDK omzeilt clientregels: daarom staat autorisatie expliciet in de service. De backend leest het bestaande households/<id>/budgetState/current en controleert het profiel met dezelfde pure chunkdecoder als de app. functions/build.mjs verpakt die decoder. Geen tweede opslagcodec.

De actieve regels gebruiken de oudere huishoudopslag. De nieuwere record-/epochregels uit de repository blijven ongeactiveerd. Deze integratie heeft die migratie niet nodig. **Geen regels deployen bij activering.** Providergegevens reizen via bestaande appcommits; sessiemetadata blijft buiten clientstate.

## Instellingen voor latere gezamenlijke activering

Er zijn twee blokkeringen: ENABLE_BANKING_ENABLED is standaard false; BANK_API_ENABLED in de frontend is false. Er wordt niet vanzelf verbonden. Herstelpunt: outputs/finize-p5b-herstel-20261023-125130 in de OneDrive-financiënwerkmap (broncode-voor-p5b.zip en HEAD.txt).

1. Regel Blaze/facturering en budgetmeldingen voor financien-7dd43. Cloud Functions, Cloud Run, Cloud Build, Artifact Registry en Secret Manager moeten beschikbaar zijn. Maak runtime-serviceaccount finize-bank@financien-7dd43.iam.gserviceaccount.com met uitsluitend noodzakelijke Firestore- en secrettoegang. Geef de deploymentgebruiker de benodigde impersonatierechten.
2. De gebruiker/beheerder zet de bestaande PEM rechtstreeks vanuit zijn lokale opslag in Secret Manager als ENABLE_BANKING_PRIVATE_KEY. De agent heeft de sleutel niet gelezen of gekopieerd. Alleen de functie bindt dit secret. Geen sleutel in Git, frontend, browseropslag of gewone omgevingsbestanden.
3. Configureer de gewone backendparameters hieronder met echte eigen waarden, nooit met de synthetische testrekening.

| Parameter | Betekenis |
| --- | --- |
| ENABLE_BANKING_APP_ID | Productie application-ID |
| ENABLE_BANKING_UID | Exacte toegestane Firebase-gebruikers-UID |
| ENABLE_BANKING_EMAIL | Bijbehorend geverifieerd e-mailadres |
| ENABLE_BANKING_HOUSEHOLD_ID | Bestaand huishouden |
| ENABLE_BANKING_ACCOUNT_PROFILE_ID | Eén bestaand actief rekeningprofiel |
| ENABLE_BANKING_IBAN | Exact eigen ING-IBAN, gelijk aan het servergelezen profiel |
| ENABLE_BANKING_ACCOUNT_HASH | Optioneel vooraf bekende hash; anders bindt de eerste geldige callback hem na exacte IBAN-/profielcontrole. Herautorisatie moet de identiteit behouden |
| ENABLE_BANKING_ASPSP_NAME | Werkelijke ING/NL-connector voor personal |
| ENABLE_BANKING_REDIRECT_URL | Exacte uiteindelijke HTTPS-callback |
| ENABLE_BANKING_SERVICE_ACCOUNT | Eigen minimaal bevoegde runtime-serviceaccount |
| ENABLE_BANKING_ENABLED | Pas bij gezamenlijke activering true |

4. Enable Banking: vervang https://example.com/callback door het bevestigde functieadres. Alleen Account Information en de eigen toegestane rekening. Restricted Production blijft persoonlijk eigen gebruik; de Control Panel-koppeling vervangt API-autorisatie niet.
5. Sluit vóór echte autorisatie callback-requestlogs met querystrings uit, ook in Cloud Run/platformtoegangslogs. Applicatielogs tonen geen codes, tokens, sessies of bankpayloads. Leg bewaarbeleid voor private backendmetadata en opvolging van eventuele retired-sessies vast.
6. Controleer origin en teruglink. Latere frontendpublicatie vereist de normale cacheversie-/serviceworkerrelease. Actualiseer bij echte activering de privacy-/voorwaardenpassages over de toekomstige koppeling.

## Gerichte verificatie

Eindresultaat: **162 Node-controles geslaagd, waaronder 25 nieuwe P5b-gevallen; 5 browsertests geslaagd**. SDK-entry, syntax, reproduceerbare build en whitespacecontrole geslaagd.

- Nieuwe P5b-tests: identiteit/rekening/huishouden, state/replay/verloop, gewijzigde toestemming tijdens callback, paginering, uitval, sessievernieuwing, intrekking tijdens ophalen, mislukte intrekking, bronidentiteit, beide CSV/API-volgordes, expliciete goedkeuring, fysieke/prognose-effecten, cloud-chunk-/syncbehoud.
- Bestaande gerichte P1/P2/P5a- en cloud-synccontracttests; geen volledige suite of schaalbenchmark.
- Browser: 390/1440 px, echte IndexedDB, synchronisatieknop met uitsluitend synthetisch antwoord, bestaande Nakijken-editor, goedkeuren, herhalen, herladen, goedgekeurde CSV behouden en actuele saldo-/maandgrafiekcontrole.
- Functions v2 SDK-entry lokaal gebundeld en geladen met demo-project. Origin, CORS-preflight en ontbrekend token gecontroleerd, zonder bank-/productieverzoeken.
- Syntax, reproduceerbare appbuild, Git-whitespace en visuele inspectie.

Backendafhankelijkheden zijn op een lokale C:-cache geïnstalleerd wegens schrijffouten van npm op Google Drive. functions/package-lock.json ligt in de repository. De opruimactie werd automatisch geblokkeerd; de onvolledige map is daarna veilig hernoemd naar node_modules.incomplete-p5b en blijft genegeerd. Google Drive ondersteunt hier geen junction. functions/local-check.mjs kan via FINIZE_BANK_DEPENDENCIES de normale C:-installatie gebruiken om de echte SDK-entry te controleren, zonder broncode te verplaatsen. Voor deployment moet de lokale CLI dezelfde dependencies kunnen oplossen. Geen bronbestanden verwijderd.

De directe lokale SDK-check is uitgevoerd met Node 24, FINIZE_BANK_DEPENDENCIES ingesteld op C:\Users\dionv\.cache\finize-p5b-functions, en daarna node functions/local-check.mjs. Deze entrycheck controleert tevens drie HTTP-grenzen met een demo-project en zonder netwerk. Op een normale lokale dependency-installatie is de extra variabele niet nodig. De gedeelde decoder wordt vooraf met node functions/build.mjs verpakt.

## Stopstatus en grenzen

Alleen lokaal en synthetisch. Geen commit, push, merge, deployment, Firestore-regelwijziging, factureringswijziging of echte bankgegevens.

Niet bewezen: daadwerkelijke ING-responsvelden, terugkijktermijn, rate limits, consent en geheime-sleutelconfiguratie voor de eigen rekening. Die volgen bij de afzonderlijke gezamenlijke activering. Ontbrekende boekingsdatum/identiteit of onduidelijk saldotype blijft geblokkeerd of onzeker; geen verzonnen financiële feiten.

Bronnen: [API](https://enablebanking.com/docs/api/reference/), [identiteiten en sessies](https://enablebanking.com/docs/faq/), [Restricted Production](https://enablebanking.com/docs/api/linked-accounts), [Firebase secrets](https://firebase.google.com/docs/functions/config-env).
