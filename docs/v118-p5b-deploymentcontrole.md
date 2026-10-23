# P5b — controle vóór eerste deployment

23 oktober 2026. Alleen cloudmetadata gelezen; geen secretwaarde, bankgegevens, deployment of cloudwijzigingen.

**Conclusie: lokaal geconfigureerd, nog niet gereed voor een werkende eerste deployment.**

## Vastgesteld

- Project `financien-7dd43`: billingEnabled=true. Geen bovenliggende organisatie/folder in de projectmetadata.
- Serviceaccount `finize-bank@financien-7dd43.iam.gserviceaccount.com` bestaat en is actief. De functie gebruikt dit account nu als vaste lokale runtime-identiteit, zonder omgevingsoverschrijving. Regio `europe-west4`, Node 22, minInstances=0, maxInstances=1.
- Secret `ENABLE_BANKING_PRIVATE_KEY`: versie 1 ENABLED. De secretpolicy geeft alleen dit account expliciet `roles/secretmanager.secretAccessor`. Geen projectbrede Secret Accessor gevonden; projectowner blijft beheerder en kan rechten wijzigen. Geen expliciete impersonatiebindings op het serviceaccount.
- Alleen de lokale export `enableBanking` bindt deze secret. Dit omvat alle bankroutes binnen dezelfde functie. Geheimtoegang geldt voor de runtime-identiteit, niet voor een route: hergebruik dit account niet voor andere workloads.
- Cloud Functions- en Cloud Run-API's zijn uitgeschakeld. Een daadwerkelijk draaiende functie, runtime-identiteit en exclusief gebruik in gedeployde workloads konden daarom niet worden gecontroleerd; dit verslag claimt die niet.
- Geen project-IAM-rollen toegekend aan finize-bank. De code kan met de huidige toekenningen geen Firestore lezen/schrijven en geen actuele Firebase-gebruikersstatus controleren.
- Geen `.env`-configuratie in repositoryroot of functions aanwezig. Application ID en verplichte gebruikers-/rekeningparameters hebben lege defaults. De juiste Enable Banking Application ID is dus **niet geconfigureerd of bevestigd**. Secretmetadata bewijst niet dat sleutel en applicatie bij elkaar horen.
- Geen wijzigingen aan Firestore-regels nodig. De Admin SDK omzeilt deze regels; autorisatie gebeurt expliciet in de backend. De eerder vastgestelde productie-/repositoryverschillen blijven bestaan. Geen regels mee deployen.

## Handmatig vóór deployment

1. Geef finize-bank een eigen IAM-rol met uitsluitend `datastore.databases.get`, `datastore.entities.get`, `datastore.entities.list`, `datastore.entities.create`, `datastore.entities.update` en `firebaseauth.users.get`. Dit ondersteunt transacties, bestaande profiel/chunk-lezingen, private metadata en intrekkings-/gebruikerscontrole. Geen financiële schrijfroute of documentverwijdering in deze backend. `roles/datastore.user` is een eenvoudiger maar ruimere optie, inclusief verwijderen; Editor/Owner/Auth Admin zijn niet nodig. Firestore-IAM beperkt dit niet tot individuele documentpaden; de applicatiecontroles blijven noodzakelijk.
2. Activeer Cloud Functions, Cloud Run, Cloud Build en Artifact Registry API's. Firestore, Identity Toolkit en Secret Manager zijn al actief. Controleer bij de uiteindelijke deployment ook build-serviceaccountrechten en het recht van de deployer om als finize-bank te deployen. Geef runtime en build geen brede rollen om eventuele deployfouten te omzeilen.
3. Maak lokaal `functions/.env.financien-7dd43` met de echte `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_UID`, `ENABLE_BANKING_EMAIL`, `ENABLE_BANKING_HOUSEHOLD_ID`, `ENABLE_BANKING_ACCOUNT_PROFILE_ID`, `ENABLE_BANKING_IBAN`, `ENABLE_BANKING_ASPSP_NAME` en `ENABLE_BANKING_REDIRECT_URL`. Gebruik Application ID uit de actieve Enable Banking Production-app; niet de Firebase App ID. Controleer het bestaande, niet-gearchiveerde profiel, geverifieerde Firebase-account en accountLinks-koppeling. `ENABLE_BANKING_ACCOUNT_HASH` kan vooraf worden vastgezet; anders bindt de eerste succesvolle callback de gecontroleerde ING-rekeninghash. Zet voorlopig `ENABLE_BANKING_ENABLED=false`.
4. Registreer bij dezelfde Enable Banking-app exact `https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking/callback` en gebruik die als redirectparameter. `https://example.com/callback` is hiervoor ongeschikt. Bevestig dat de toegestane ING-rekening bij deze Restricted Production-app hoort. Geen sleutel opnieuw exporteren of lokaal in env plaatsen.
5. Zorg dat SDK-dependencies vanuit de deploymentbron resolveerbaar zijn. De SDK-grenscontrole gebruikt momenteel de afzonderlijke lokale dependencycache; dat bewijst geen Firebase CLI-brondetectie vanuit deze Drive-checkout. Gebruik zo nodig een lokale NTFS-werkmap met dezelfde bronstructuur en `npm ci` in functions. Behoud de bovenliggende src/storage-bestanden voor de bestaande predeploy-build. Geen onvolledige node_modules-map verpakken.
6. Na afzonderlijke toestemming uitsluitend codebase `finize-bank` deployen, met expliciet project financien-7dd43; nooit een algemene Firebase-deploy die ook repositoryregels activeert. Publieke HTTP-invoker is nodig voor de providercallback; alle overige routes eisen Firebase-token plus gebruikers-, huishoud- en rekeningcontrole. Controleer na deployment daadwerkelijk regio, serviceAccountEmail en secretbinding. Laat backend en frontend uit totdat de gezamenlijke activering volgt.

## Gerichte lokale controle

Herstelkopie van index.mjs en local-check.mjs: `C:\Users\dionv\AppData\Local\Finize\p5b-deploymentcontrole-20261023-160047`.

De function-entry is geladen met de echte Firebase SDK uit de bestaande lokale cache. Manifestcontroles bevestigen v2, het vaste serviceaccount, europe-west4 en uitsluitend de bedoelde secretbinding. Drie HTTP-grenscontroles slagen (vreemde origin, preflight, ontbrekend token). Alle 13 synthetische backendtests slagen, waaronder verkeerde gebruiker/rekening, eenmalige state, verlopen toegang, paginering, lease en intrekking. Geen brede regressiesuite of productieaanroep.

Bronnen: [runtime-serviceaccount](https://firebase.google.com/docs/functions/manage-functions), [secretbinding](https://firebase.google.com/docs/functions/config-env), [Firestore IAM-methoderechten](https://docs.cloud.google.com/firestore/docs/security/iam), [Firebase Authentication-rechten](https://firebase.google.com/docs/projects/iam/permissions).
