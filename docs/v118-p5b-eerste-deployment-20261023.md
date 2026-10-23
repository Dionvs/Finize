# P5b — eerste deployment en servercontrole

23 oktober 2026. De bankbackend is gedeployd en gecontroleerd. **Bankroutes en frontendkoppeling blijven uitgeschakeld; er is nog geen API-banksessie en er zijn geen saldi of transacties opgehaald.**

Dit verslag vervangt de openstaande deploymentpunten uit de eerdere voorbereidingsverslagen voor zover hieronder gecontroleerd. Hun overige grenzen blijven gelden.

## Enable Banking

- Production-app Finize, ID 7696f675-1163-458c-ab91-66da8e100ee4, actief en alleen AIS.
- Na expliciete toestemming de callback opgeslagen en opnieuw vanuit de applicatielijst gelezen: https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking/callback.
- De bestaande gekoppelde ING-rekening is exact gelijk aan het door de gebruiker gekozen actieve Finize-profiel Dion, eindigend op 7899.
- De gedeployde functie heeft zelf GET /application en GET /aspsps?country=NL uitgevoerd, met de bestaande Secret Manager-sleutel. De agent heeft geen secretwaarde gelezen, geëxporteerd of gelogd.
- Servercontrole geslaagd: key ID, PRODUCTION, active, AIS zonder PIS, Nederland, callback en persoonlijke ING/NL-connector bevestigd. Provider meldt maximum_consent_validity=15552000 seconden; de bestaande backend begrenst een toekomstige aanvraag tot maximaal 180 dagen. Dit bewijst nog geen daadwerkelijke banktoestemming of beschikbare bankhistorie.

## Werkelijke deployment

- Functie projects/financien-7dd43/locations/europe-west4/functions/enableBanking, toestand ACTIVE.
- Cloud Run-service enablebanking, revisie enablebanking-00002-qit, 100% verkeer op die revisie.
- Node 22, 256 MiB, één CPU, minInstances=0, maxInstances=1, concurrency=8, timeout 180 seconden.
- Runtime-identiteit finize-bank@financien-7dd43.iam.gserviceaccount.com. De eigen projectrol bevat nog exact de zes eerder goedgekeurde permissies. Geen runtime-rechten toegevoegd.
- Uitsluitend deze regionale functie en de onderliggende Run-service gebruiken die runtime-identiteit. Secretpolicy van ENABLE_BANKING_PRIVATE_KEY geeft alleen dit account de expliciete Secret Accessor-binding. Secretversie 1 is gebonden; de waarde is niet opgehaald door de agent.
- Cloud Run Invoker voor allUsers is uitsluitend op deze ene service ingesteld, zoals de bestaande onRequest-configuratie vereist voor de providercallback. Alle andere routes blijven onder de applicatiecontroles vallen. Geen publieke projectrechten.
- Backendparameter ENABLE_BANKING_ENABLED=false. Frontend BANK_API_ENABLED=false. Alleen de read-only metadatacontrole staat aan met ENABLE_BANKING_VERIFY_CONFIGURATION=true.
- De werkelijke laatste build 9f75799d-ef80-4182-88e4-95053c709584 heeft status SUCCESS en gebruikt finize-bank-build. Ook de eerste build slaagde. Het bestaande Compute-account met Editor is niet gebruikt of aangepast.

## Afzonderlijk bouwaccount met beperkte rechten

finize-bank-build@financien-7dd43.iam.gserviceaccount.com heeft geen aangemaakte privésleutels en geen Firestore-, Firebase Auth- of Secret Manager-toekenningen.

| Eigen rol | Exacte permissies | Toepassingsgebied |
| --- | --- | --- |
| finizeBankBuildLogs | logging.logEntries.create | Project; alleen logs schrijven |
| finizeBankBuildArtifacts | artifactregistry.repositories.get, artifactregistry.repositories.downloadArtifacts, artifactregistry.repositories.uploadArtifacts | Alleen repository projects/financien-7dd43/locations/europe-west4/repositories/finize-bank |
| finizeBankBuildSource | storage.objects.get, storage.objects.list | Voorwaardelijk beperkt tot de concrete gcf-v2-sources- en gcf-v2-uploads-buckets van dit project in europe-west4 |

De permissions zijn vooraf op ondersteuning voor custom roles gecontroleerd en de opgeslagen rollen/bindings zijn teruggelezen. Geen Editor/Owner of brede bouwrol toegekend. De regio-buckets worden door GCF beheerd; de bronrol is niet tot één functie-object beperkt. Op dit moment is dit de enige regionale functie. Herbeoordeel deze scope voordat andere functies in dezelfde regio komen.

## Callbackcodes in logs

- Loguitsluiting finize-bank-callback-request-url ingesteld in _Default, teruggelezen en gecontroleerd.
- Filter beperkt tot service enablebanking/functie enableBanking in europe-west4 en HTTP-request-URL's met /callback, met of zonder querystring.
- Vier synthetische controleverzoeken zijn via hun trace-ID teruggevonden in de toegangslogs. Het synthetische callbackverzoek is daar niet teruggevonden nadat de controleverzoeken zichtbaar waren. Er zijn geen echte autorisatiecodes gebruikt.
- Applicatielogs en auditlogs blijven behouden. Sinks gecontroleerd: alleen _Default en _Required; geen extra actieve exportsinks. De configuratiecheck logt uitsluitend veilige controle-uitkomsten, geen sleutel/JWT/providerpayload/IBAN.

## Code en verificatie

- functions/src/enable-banking.mjs: pure checkProviderConfiguration toegevoegd; leest uitsluitend /application en /aspsps, controleert productie-app en connector, geeft alleen beperkte controle-uitkomsten terug. /application is alleen met GET toegestaan.
- functions/src/index.mjs: optionele onInit-controle; geen nieuwe HTTP-route. Bij een mislukte providercontrole faalt de instantie gesloten. De schakelaar is standaard false; in deze deployment true.
- functions/local-check.mjs: bestaande dependencyresolver uitgebreid voor firebase-functions/v2/core.
- 29 gerichte Node-tests geslaagd, waaronder vier configuratie-/veiligheidstests. De echte SDK-entry en drie lokale HTTP-grenscontroles slagen. Lokale Node-runtime 24; de gedeployde runtime Node 22 is met de live controles getest.
- Vijf live HTTP-controles geslaagd: vreemde origin 403, toegestane CORS-preflight 204, ontbrekend token 401, bankroutes uitgeschakeld 503 en callback uitgeschakeld 503. De 503 is hier de bedoelde blokkering backend-not-configured.
- De serverlog van 23 oktober 2026, 16:51:13 Nederlandse tijd, bevestigt applicationVerified, production, accountInformationOnly, redirectVerified en personal als true; connector ING, land NL.
- Cloud Run-template en Cloud Functions-configuratie bevestigen beide de runtime-identiteit en de ingeschakelde configuratiecontrole. Actuele revisie, 100% verkeer, bouwaccount en secretbinding gecontroleerd.

## Deploymentroute en lokale bestanden

De Cloud Functions v2 REST API is gebruikt om buildConfig.serviceAccount expliciet vast te zetten. Er is geen algemene Firebase-deployment uitgevoerd en er zijn geen Firestore-regels gepubliceerd.

Het ZIP-pakket bevat uitsluitend package.json, package-lock.json, build.mjs, src/ en de bestaande verpakte shared/-decoder. Geen node_modules, .env-bestanden, sleutelbestanden of frontend. De gewone backendparameters zijn afzonderlijk als runtimeconfiguratie ingesteld; de privésleutel blijft een Secret Manager-binding.

SHA-256 van het laatste bronpakket: A797A15476C0D3A0F64AC3C508BB498C15AC15EC918A17834D20B2BA61907787. Deze hash is ook bij de laatste deploymentoperatie buiten de repository bewaard.

Ondersteunende deployment- en controlescripts, het pakket en de laatste operatie-/testbewijzen staan buiten de bronrepository in C:/Users/dionv/AppData/Local/Finize/p5b-vervolg/. Bronbestanden zijn niet verplaatst. Herstelkopieën van de drie aangepaste backendbestanden staan daar onder voor-configuratiecheck/.

functions/.env.financien-7dd43 bevat gewone configuratie inclusief persoonsgegevens en rekeningnummer; dit bestand blijft door Git genegeerd en zit niet in het bronpakket. De inhoud is na wijziging met de standaard dotenv-parser teruggelezen.

Let bij iedere volgende deployment opnieuw op het afzonderlijke bouwaccount, de vaste runtime-identiteit, de twee activeringsvlaggen en de bestaande loguitsluiting. Gebruik geen route die stilzwijgend terugvalt op het Compute-account met Editor. De geïnstalleerde Firebase CLI geeft bij de gewone v2-conversie geen expliciet buildConfig.serviceAccount mee; behoud van het bestaande veld moet bij zo'n andere route vooraf worden bevestigd.

## Nog nodig voor daadwerkelijk bankgebruik

1. Eerst de lokale P5b-frontend en overige bestaande onvoltooide bronwijzigingen gereedmaken voor een afzonderlijke gecontroleerde Finize-release. Er is geen frontendpublicatie, commit of push uitgevoerd.
2. Frontend-/backendkoppeling bewust activeren en de privacy-/voorwaardenpassages actualiseren voor echt gebruik.
3. De rekeninghouder doorloopt zelf de echte ING-toestemming. De eerdere Control Panel-link is geen API-banksessie. Pas daarna mogen echte providergegevens via de bestaande goedkeuringsroute worden gecontroleerd.
4. Bewaartermijnen en opvolging van eventueel mislukte sessie-intrekkingen voor finizeBankPrivate expliciet vastleggen vóór echt gebruik. Er is geen opschoonscheduler, TTL-policy of andere financiële automatisering toegevoegd.

Geen financiële documenten geschreven, geen bestaande administratie aangepast, geen bankautorisatie gestart en geen sessies, saldi of transacties opgevraagd.

Bronnen: [afzonderlijk bouwaccount en opslagbeperkingen](https://docs.cloud.google.com/functions/docs/building), [Cloud Functions v2-configuratie](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions), [loguitsluitingen](https://docs.cloud.google.com/logging/docs/reference/v2/rest/v2/projects.exclusions/create), [Enable Banking applicatiecontrole](https://enablebanking.com/docs/api/reference/#get-application).
