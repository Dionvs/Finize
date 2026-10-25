# P5b — gezamenlijke ING-bootstrap

Lokale uitbreiding na fase 1 (`enablebanking-00008-yib`). De bestaande multirekeningarchitectuur en financiële invoerroute blijven leidend. Deze bootstrap is alleen bedoeld voor bestaand profiel `account-388ed1e4` (Gezamenlijk); Dion en Dara kunnen haar niet als rekeningdoel gebruiken.

## Herstelpunt vóór ontwikkeling

`C:/Users/dionv/AppData/Local/Finize/p5b-bootstrap-herstel-20261025/`

432 bronbestanden, inclusief lokale wijzigingen, zijn gearchiveerd. De actuele bankmetadata, configuratie, lokale omgevingsconfiguratie en financiële referentie zijn versleuteld met Windows DPAPI voor de huidige Windows-gebruiker. De map heeft een beperkte ACL. Alle bronbestanden en de versleutelde metadata zijn succesvol teruggelezen en op integriteit gecontroleerd. Het fase-1-backendpakket is opnieuw met de actieve GCS-generatie vergeleken. Bewijs en het concrete rollbackplan staan in de herstelmap.

DPAPI-herstel vereist toegang tot dit Windows-account en zijn DPAPI-profiel. Oude sessies of financiële snapshots worden nooit automatisch over actuele gegevens teruggezet; code/configuratie terugzetten is geen intrekking van toestemming.

## Configuratie en grenzen

`ENABLE_BANKING_BOOTSTRAP` heeft standaard een lege waarde: geen bootstrap. Bij expliciete private serverconfiguratie is een JSON-object nodig met `enabled: true`, `accountProfileId: "account-388ed1e4"`, de gecontroleerde volledige `iban`, `providerLinked: true`, `holderConfirmed: true`, `providerMode: "restricted"`.

UID, e-mail, huishouding en de bevoegde rol worden aan de bestaande serverconfiguratie van Dion gebonden. De configuratie moet werkelijk gecontroleerd rekeninghouderschap en de bestaande providerwhitelist vertegenwoordigen; booleans vormen zelf geen bewijs. De backend controleert actuele Firebase-identiteit, geverifieerde e-mail, huishoudrol, actief gezamenlijk profiel en IBAN bij start en callback. Frontendvelden kunnen deze gegevens niet kiezen. De volledige IBAN staat niet in code of tests.

Het normale `ENABLE_BANKING_ACCOUNTS`-register blijft ongewijzigd streng. Met een leeg register blijft Dion in de bestaande enkelrekeningmodus werken. De bootstrap start geen financiële import en staat geen normale synchronisatie van een kandidaat toe.

## Bestaande workflow hergebruiken

De nieuwe `bank-bootstrap.mjs` gebruikt de bestaande `createSingleBankService`, providerclient en native Firestore-opslag. De opslagadapter leidt de tijdelijke verbinding naar rekeninggebonden `bootstrap-candidate`, `bootstrap-identity`, `bootstrap-control`, `bootstrap-lock` en `bootstrap-retired-*`. De permanente normale `connection` en `account-binding` blijven afwezig tot promotie.

Een start gebruikt een afzonderlijke willekeurige state met `purpose: joint-bootstrap`, vastgelegde scope, IBAN-controlehash, korte vervaltermijn en intrekkingsgeneratie. De bestaande callback kiest de workflow uitsluitend op server-state; queryparameters kunnen geen purpose selecteren. Oude normale states zonder purpose blijven bruikbaar voor de normale flow. Purpose en IBAN zijn ook in de gedeelde callback afgedwongen.

De callback consumeert state eenmalig, controleert actuele autorisatie opnieuw en selecteert exact één account met de ingestelde IBAN. De officiële hash komt alleen uit het providerantwoord. Een extra GET van sessiemetadata moet `AUTHORIZED`, de juiste account-ID, hash en niet-verlopen toegang bevestigen. Er worden geen transacties of saldi opgehaald.

Dions legacy-sessie en permanente binding worden rechtstreeks meegenomen bij elke sessieclaim, installatie, controle en intrekking. De globale eigenaarsregistratie is vóór adoptie immers nog niet voldoende. Ook andere bekende rekeningverbindingen en bestaande eigenaarsrecords worden beschermd. Een beschermde sessie wordt niet geclaimd of ingetrokken. Een eigen afgewezen sessie krijgt eerst duurzame intrekkingsmetadata en wordt daarna gericht ingetrokken; mislukking blijft zichtbaar en expliciet herhaalbaar.

Bij een onzekere code-uitwisseling blijft `exchangePending` staan. Herstart en gewone intrekking kunnen deze onzekerheid niet stilzwijgend wissen; een beheerder moet eerst de provideruitkomst vaststellen. Een beschermde sessie veroorzaakt eveneens een beheerdersstop. Callbackherhaling kan de lopende aanvraag van een andere callback niet ontgrendelen.

TTL gebruikt de oorspronkelijke sessievervaldatum plus zeven dagen voor kandidaat, eigenaarsrecord en intrekkingsmetadata. State en lock hebben korte, oorspronkelijke deadlines. TTL is geen providerintrekking. Permanente normale bindings-/adoptiegegevens krijgen geen TTL. Kandidaatidentiteit en controlebewijs worden niet stilzwijgend als normale binding beschouwd.

## Interface en promotie

De bestaande autorisatieknop in rekeningdetails gebruikt `/bootstrap/start` alleen wanneer de backend de bootstrap voor dat profiel beschikbaar meldt. Alleen openen doet statuslezingen, geen autorisatie of writes. Na toestemming toont Finize een nog niet actieve kandidaat. De knop wordt **Banktoegang controleren** en gebruikt `/bootstrap/verify`; **Bank bijwerken** blijft uitgeschakeld. Deze expliciete controle ververst uitsluitend de sessieattestatie. Een intrekking gebruikt `/bootstrap/disconnect`, met dezelfde bescherming van bestaande sessies.

Promotie is geen frontendroute. `functions/scripts/promote-bank-bootstrap.mjs` gebruikt bestaande ADC; standaard alleen plan, schrijven vereist `--apply`. Het script controleert project, expliciet opgegeven actuele revisie, runtime en alle oorspronkelijke plus nieuwe live configuratievelden. Het leest geen private RSA-sleutel en maakt geen provider-JWT.

Voor promotie zijn een goedgekeurde en uitgevoerde legacy-adoptie, de juiste actieve registerentry, de exacte officiële hash/IBAN, actuele bevoegde gebruiker/profiel, een niet-ingetrokken kandidaat en een maximaal 60 seconden oude expliciete sessiecontrole nodig. Zo nodig eerst **Banktoegang controleren** gebruiken. De transactie schrijft vijf private records: normale gezamenlijke sessie, permanente binding, bijgewerkt eigenaarsrecord, leeggemaakte kandidaat en promotiebewijs. Dions oorspronkelijke sessie/binding en financiële records worden niet geschreven. Herhalen is idempotent en controleert ook het bestaande eigenaarsrecord.

Een kandidaat is dus herbruikbaar voor dezelfde gezamenlijke rekening na gecontroleerde adoptie/activering; een tweede ING-autorisatie is niet standaard nodig. De bootstrap moet na succesvolle promotie weer worden uitgeschakeld.

## Gerichte verificatie

- 25 nieuwe bootstrap-/promotiegevallen geslaagd, met uitsluitend synthetische identiteiten, IBAN's, sessies en providerantwoorden; ook op Node 22. Twee aanvullende gevallen en gerichte hercontroles slagen: een onduidelijke legacybinding stopt vóór providerverkeer en een legacyvernieuwing na adoptie vereist heradoptie vóór promotie (27 afzonderlijke gevallen in totaal).
- De direct gewijzigde echte HTTP-handler is met synthetische SDK/providerantwoorden getest, inclusief callbacktoewijzing, ongewenste requestvelden, lege registratie, kandidaatstatus, sessiecontrole en geïsoleerde intrekking.
- Drie gerichte browsertests op 320, 390 en 1440 pixels: geen automatische autorisatie, expliciete klik, niet-actieve kandidaat, geen financiële mutaties/import/sync en correcte overgang naar normale bediening.
- Bestaande uitgebreide P5b-resultaten worden hergebruikt; geen brede regressiesuite herhaald.

Bewijzen staan lokaal buiten Git onder `C:/Users/dionv/AppData/Local/Finize/p5b-stap2a-20261025/`. De oorspronkelijke uitsluitingen voor Dara, automatische goedkeuring, CSV/API-overlap en de financiële motor zijn niet gewijzigd.
