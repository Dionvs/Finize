# P5b — cloudupdate en gerichte opschoning

**Vervolg:** de apprelease en afzonderlijke backendactivering worden beschreven bij [V118-r8](v118-r8-bankkoppeling-release-20261023.md). Onderstaande vlagstanden beschrijven het einde van de eerdere cloudfase.

23 oktober 2026. Uitgevoerd na toestemming om de cloudstap te beginnen. Dit verslag beschrijft de nieuwe uitrol; de eerdere lokale implementatie- en deploymentverslagen blijven historische momentopnamen.

## Backendupdate voltooid

- Cloud Functions v2 `enableBanking` in `europe-west4` is ACTIVE. Cloud Run-revisie `enablebanking-00003-zur` krijgt 100% van het verkeer.
- Build `ab170b36-653c-4c28-a1a1-14c6110917b3` is SUCCESS en gebruikt het bestaande beperkte bouwaccount `finize-bank-build`. De runtime gebruikt ongewijzigd `finize-bank`.
- Alleen `buildConfig.source` en `buildConfig.serviceAccount` zijn via de Functions API bijgewerkt. Project-IAM, service-IAM, runtime-instellingen, gewone configuratie, secretbindingen en callback-loguitsluiting zijn teruggelezen en gelijk aan vóór de update.
- Het pakket bevat exact `package.json`, `package-lock.json`, `build.mjs`, drie backendmodules en twee bestaande opslagdecoders. Geen .env, privé-/sleutelbestand, dependencies of frontend. SHA-256: `9eea2f51fad1129f4e06a3ab41b08c1de571366617fc305ec3dfa23b0fe04007`. De door Functions bevestigde bronversie is gelijk aan de actuele bronconfiguratie; de opslagchecksum van die versie is gelijk aan het lokale pakket. De buildresponse zelf bevat geen bronverwijzing.
- De gedeployde versie scheidt permanente rekeningbinding/intrekkingsgeneratie van tijdelijke sessiegegevens, behoudt oorspronkelijke vervaltermijnen en ondersteunt begrensde herhaling van mislukte intrekkingen.

## Gerichte TTL-policy

Vlak vóór de wijziging opnieuw gelezen: geen bestaande TTL-policy in collectiegroup `metadata` en nul documenten met `finizeBankExpiresAt`. Er is uitsluitend een PATCH met `updateMask=ttlConfig` uitgevoerd op:

`projects/financien-7dd43/databases/(default)/collectionGroups/metadata/fields/finizeBankExpiresAt`

De bestaande indexconfiguratie is na de wijziging teruggelezen en ongewijzigd. Er is geen algemene Firebase-deployment van regels of indexen uitgevoerd. De veldpolicy is als **ACTIVE** teruggelezen en de bijbehorende operatie is volledig afgerond (`done=true`, geen fout). De lijst van TTL-velden bevat uitsluitend dit ene veld en heeft geen vervolgpagina. Er zijn nog nul documenten met het vervalveld.

De backend zet dit Timestamp-veld uitsluitend op tijdelijke private bankrecords: koppelpogingen en synchronisatievergrendelingen 24 uur na hun geldigheid, sessiereferenties 7 dagen na het oorspronkelijke toestemmingsverloop. Financiële historie, permanente rekeningbinding en intrekkingsgeneratie krijgen dit veld niet. Onbekende sessievervaldatums blijven behouden voor intrekking/beoordeling. Firestore verwijdert asynchroon; toegang wordt onafhankelijk van fysieke verwijdering gecontroleerd.

## Verificatie

- De 40 gerichte backend-, configuratie- en providercontroles opnieuw geslaagd; echte SDK-entry en drie lokale HTTP-grenscontroles geslaagd. De eerder geslaagde vier emulator- en tien browsertests zijn zonder nieuwe productcodewijziging niet herhaald.
- Vijf live HTTP-controles geslaagd: vreemde origin 403, toegestane CORS-preflight 204, ontbrekend token 401, bankroutes uitgeschakeld 503 en callback uitgeschakeld 503. De 503 is hier de bedoelde blokkering.
- Alleen de nieuwe revisie gecontroleerd: provider-app, productie, uitsluitend rekeninginformatie, callback en persoonlijke ING/NL-connector bevestigd door de server. Geen geheime sleutel gelezen door de agent.
- Alle vier synthetische controleverzoeken in de toegangslogs gevonden; het synthetische callbackverzoek ontbreekt daar zoals bedoeld. De loguitsluiting is bovendien ongewijzigd.
- Na uitrol opnieuw bevestigd: runtime-rol bevat exact de zes goedgekeurde permissies, expliciete secrettoegang uitsluitend voor het runtime-account, geen eigen bouwsleutels en 100% verkeer op de nieuwe revisie.

## Activering en grenzen

`ENABLE_BANKING_ENABLED=false` en `BANK_API_ENABLED=false` blijven van kracht. De cloudupdate vraagt geen banktoestemming en haalt geen bankgegevens op. De volgende fase is de gecontroleerde Finize-release met bijgewerkte privacyinformatie, bewuste activering van de twee vlaggen en daarna ING-toestemming door de rekeninghouder voor Dion …7899. De lokale privacytekst moet bij die release de eerdere passage over nog niet actieve opschoning vervangen door de nu bevestigde termijnen en asynchrone verwijdering. Financiële verwerking blijft de bestaande afzonderlijke goedkeuringsroute gebruiken.

Geen financiële documenten gewijzigd, geen banksessie gestart, geen transacties/saldi opgehaald, geen ruimere rollen toegekend en geen Git-commit/push of frontendpublicatie uitgevoerd. Bewijsbestanden en herstelconfiguratie staan buiten de repository in `C:/Users/dionv/AppData/Local/Finize/p5b-clouduitrol-20261023/`; de configuratiebestanden daar bevatten persoonsgegevens en horen niet bij een openbare release.

Bronnen: [Functions-update met veldmasker](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch), [Firestore veldpolicy](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.fields/patch), [werking en vertraging van TTL](https://docs.cloud.google.com/firestore/native/docs/ttl).
