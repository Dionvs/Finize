# V118 P5b — productiecontrole drie ING-rekeningen

Controle op **25 oktober 2026**, met opnieuw opgehaalde GitHub-, Google Cloud-, Firebase Auth- en private bankmetadata, inspectie van de bestaande gebruikersinterface en synthetische tests. Geen deployment, push, merge, adoptie, cloudconfiguratiewijziging, financiële wijziging, bankautorisatie, intrekking of banksynchronisatie uitgevoerd.

**Besluit: VOORWAARDELIJK GEREED.** Fase 1, uitsluitend de backend met een lege `ENABLE_BANKING_ACCOUNTS`, is technisch voorbereid. Activering van het register en Gezamenlijk blijft geblokkeerd door de hieronder beschreven ontbrekende invoer en overgangsvoorwaarden. Dara blijft uitgeschakeld.

## A. Productiestatus

| Onderdeel | Actueel vastgesteld |
|---|---|
| Repository / branch | `Dionvs/Finize`, `main` |
| GitHub en lokale HEAD | `d87263b0c46eb0e4143ac58aaccb332924beca64`; geen nieuwere main-commit |
| GitHub Pages | Laatste build `built` voor dezelfde commit; zes publieke bestanden komen overeen met deze commit |
| Werkboom | De eerdere lokale uitbreiding is nog niet gecommit; bestaande wijzigingen behouden. Alleen dit verslag is als nieuw repositorybestand toegevoegd tijdens de controle |
| Firebase / regio | `financien-7dd43`, `europe-west4` |
| Function | `enableBanking`, `ACTIVE`, revisie `enablebanking-00007-moh`; laatst gewijzigd 23 oktober 2026. Cloud Run bevestigt dezelfde gereedstaande revisie met 100% van het verkeer |
| Runtime | Node 22; `finize-bank@financien-7dd43.iam.gserviceaccount.com` |
| Begrenzing | Minimaal 0, maximaal 1 instantie, concurrency 8, 256 MiB, timeout 180 seconden |
| Secretbinding | `ENABLE_BANKING_PRIVATE_KEY`, expliciet versie 1; versie `ENABLED`. Geen secretinhoud gelezen |
| Runtime-IAM | Alleen custom projectrol `finizeBankBackend`; op dit secret uitsluitend de runtime-identiteit expliciet Secret Accessor |
| TTL | `metadata.finizeBankExpiresAt`: `ACTIVE` |
| Callbacklogging | Bestaande uitsluiting `finize-bank-callback-request-url` aanwezig en ingeschakeld |
| Bankconfiguratie | Ingeschakeld; configuratieverificatie ingeschakeld; register ontbreekt/is leeg; oorspronkelijke Dion-parameters ongewijzigd |

De custom rol bevat exact `datastore.databases.get`, `datastore.entities.get`, `datastore.entities.list`, `datastore.entities.create`, `datastore.entities.update` en `firebaseauth.users.get`. Geen bredere runtime-projectrol vastgesteld. Er zijn geen nieuwe rechten, diensten of secrets nodig gebleken.

De gedeployde backend heeft zijn eigen bestaande bronpakket; de actuele Pages-commit bewijst niet dat de nieuwe lokale backend al draait. De geregistreerde backendbron is nog dezelfde opslaggeneratie als bij het herstelpunt.

De actieve Enable Banking-app is `7696f675-1163-458c-ab91-66da8e100ee4`, **PRODUCTION / Active / Account Information / Restricted**. De officiële lijst toont na verversen ING **••••7899 én ••••7513**. Callback:

`https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking/callback`

Deze komt overeen met de serverconfiguratie. De aangemelde Control Panel-gebruiker is Dion, met dezelfde geverifieerde e-mail als de gecontroleerde Finize-identiteit. E-mail, UID, volledige IBAN, bankhash en sessiegegevens zijn uit dit verslag weggelaten.

## B. Dion — bestaande verbinding

**De bestaande verbinding kan op haar huidige opslagpaden behouden blijven.** Vastgesteld:

- `connection` en `account-binding` verwijzen naar hetzelfde oorspronkelijke profiel `account-f836cfaa`, dezelfde gebruiker en dezelfde huishouding.
- De opgeslagen bankhash komt tussen beide records overeen én is gelijk aan de eerder vastgelegde oorspronkelijke hash. De opgeslagen IBAN-controlehash past bij de oorspronkelijke serverconfiguratie.
- De oorspronkelijke configuratie heeft geen expliciet ingevulde `ENABLE_BANKING_ACCOUNT_HASH`. Dit blijft zo; de bestaande permanente private binding is het anker. Ook de toekomstige Dion-registerentry moet dit configuratieveld leeg laten.
- Opgeslagen sessieverval: **21 april 2027, 19:13:49.248 UTC**. Niet verlopen, niet uitgeschakeld, `retentionVersion: 1`; intrekkingsgeneratie consistent.
- De permanente binding heeft geen TTL-veld. De tijdelijke sessie heeft opruimdatum 28 april 2027, 19:13:49.248 UTC: zeven dagen na de oorspronkelijke vervaldatum.
- Geen actieve synchronisatievergrendeling, geen openstaande intrekking en geen niet-verlopen autorisatiestate. Twee resterende autorisatiestates zijn verlopen.
- Een sessie-ID en provider-account-ID zijn volgens tellingen aanwezig; hun waarden zijn niet afgedrukt of in de nieuwe controlebewijzen opgeslagen.
- De actuele Firebase-gebruiker bestaat, is niet uitgeschakeld, heeft een geverifieerde passende e-mail en de actuele huishoudkoppeling heeft rol `dion`.
- De opnieuw gelezen identiteit-, hash-, geldigheids- en controlevelden zijn gelijk aan het eerdere herstelpunt. Dit is een vergelijking van geselecteerde metadata, geen volledige uitlezing van sessiegeheimen of financiële historie.

**Geldigheid bij Enable Banking is tijdens deze controle niet opnieuw opgevraagd.** Een toekomstige vervaldatum in Firestore bewijst niet dat ING of Enable Banking de toestemming inmiddels niet heeft ingetrokken. Bestaande providerlogs tonen eerdere geslaagde sessieverzoeken; die zijn geen actuele bevestiging van `AUTHORIZED`. Er is geen nieuwe `GET /sessions`, balans- of transactievraag uitgevoerd voor deze controle.

De nieuwe opslagcode ondersteunt de bestaande structuur. Dion houdt de originele `connection`, `account-binding`, `connection-control` en `sync-lock`. De adoptie kopieert, verwijdert of herschrijft deze niet. Er is geen financieel migratiepad: transacties, bronidentiteiten, CSV-relaties, goedkeuringen, ijkpunten en prognoses worden niet door de adoptie geschreven. Synthetische behoudtests slagen; echte financiële datasets zijn niet als testmateriaal opgehaald.

## C. Gezamenlijk — tweede verbinding

| Benodigde invoer | Bevinding |
|---|---|
| Bestaand profiel | `account-388ed1e4`, actief, eigenaar `gezamenlijk`; bestaande Finize-interface gecontroleerd |
| Volledige ING-IBAN | Betrouwbaar beschikbaar in rekeningdetails; controlecijfers geldig; exact gelijk aan de officiële gekoppelde rekening **••••7513** |
| Providerwhitelist | Gezamenlijke rekening zichtbaar onder dezelfde actieve Restricted-app; geen nieuwe koppeling toegevoegd |
| Firebase-context | Dions bestaande UID, geverifieerde e-mail, huishouding en rol `dion` zijn gecontroleerd en kunnen de expliciete gezamenlijke actor vormen |
| Rekeninghouderrecht | Providerkoppeling onder Dions Control Panel-context vastgesteld. De interface-eigenaar `gezamenlijk` bewijst op zichzelf geen juridisch rekeninghouderschap. Voor activering moet Dion bevoegd mede-rekeninghouder zijn en zelf de vereiste ING-toestemming geven |
| Officiële `identification_hash` | **Niet vastgesteld** |
| Eigen provider-account-ID / sessie | Nog geen gecontroleerde gezamenlijke Finize-sessie; een account-ID is sessiegebonden en mag niet van Dion worden hergebruikt |

De profielcontrole gebeurde via de bestaande als cloud-opgeslagen gemelde Finize-interface en zichtbare profiel-ID's. Er zijn geen volledige financiële cloudchunks gelezen. Bij activering moet de backend het actuele cloudprofiel opnieuw controleren; de code weigert een veranderd profiel, eigenaar of IBAN.

**Gezamenlijk is architectonisch voorbereid, maar nog niet volledig configureerbaar als actieve registerentry.** De ontbrekende officiële bankhash is een harde blokkade: een nieuwe ingeschakelde rekening zonder hash wordt afgewezen.

Waarom de hash ontbreekt en hoe verder:

1. De whitelist toont de IBAN, maar geen `identification_hash`. Toevoegen in het Control Panel geeft de Finize-app geen eigen API-autorisatie. De bestaande private Finize-binding betreft uitsluitend Dion.
2. De gedocumenteerde `GET /application` retourneert geen gekoppelde rekeninghashes. De publieke API documenteert geen algemene voorautorisatie-opvraag waarmee alleen een IBAN voldoende is om deze hash te verkrijgen. De gedocumenteerde sessieautorisatie retourneert rekeninggegevens met de officiële hash. Een bestaande geautoriseerde sessie kan rekeningmetadata bieden, maar er is geen afzonderlijke gezamenlijke sessie vastgesteld; Dions sessie wordt hiervoor niet hergebruikt.
3. Gebruik eerst een betrouwbaar bestaand providerbewijs dat de hash ondubbelzinnig aan **••••7513** verbindt, bijvoorbeeld passende bestaande requestdetails of een officiële providerbevestiging. De bekeken applicatie-/logoverzichten leverden dat bewijs niet. Er is geen bericht aan Enable Banking verstuurd.
4. Ontbreekt zo'n bestaand bewijs, dan is een **afzonderlijk goedgekeurde server-side verificatieautorisatie voor Gezamenlijk** nodig om de hash uit het officiële sessieantwoord te verkrijgen. Dit maakt nieuwe toestemming/sessiemetadata en vereist dus afzonderlijke toestemming. Daarvoor moet vooraf een gecontroleerde bootstraproute worden voorbereid: de huidige actieve registervalidatie verlangt de hash al vóór `/auth/start`. De oude Dion-configuratie overschrijven, een willekeurige hash invullen of de controle uitschakelen is geen toegestane bootstrap.

Geen hash uit de IBAN afgeleid en geen verificatieautorisatie uitgevoerd. Bronnen: [whitelist en afzonderlijke autorisatie](https://enablebanking.com/docs/api/linked-accounts/), [API-contract](https://enablebanking.com/docs/api/reference/), [rekeningidentiteit over sessies](https://enablebanking.com/docs/faq/), [bestaande requestmetadata](https://enablebanking.com/docs/api/control-panel/).

## D. Dara — derde verbinding

**Dara blijft geblokkeerd.** Met leeg register bestaat alleen de vaste Dion-toegang. In Restricted-registermodus blokkeert de backend een andere UID dan de Control Panel-UID; Dara mag bovendien niet met Dions UID worden geconfigureerd. Ook `enabled: true` en `providerLinked: true` omzeilen die blokkade niet.

Voor de eerste registratie Dara weglaten. Latere toegang vereist haar eigen actuele geverifieerde Firebase-identiteit, juiste huishoudrol, gecontroleerde rekeningidentiteit, eigen toestemming en aantoonbaar passende Enable Banking-toegang. Die zijn hier niet als gereed vastgesteld.

De actuele [Restriction of Use](https://enablebanking.com/terms/) beperkt deze vorm van gebruik tot de toegestane gekoppelde rekeningen van de Control Panel-gebruiker. ING-bereikbaarheid of een gedeeld huishouden verleent Dara geen toegang. De lokale contractuele modus vereist een overeenkomstverwijzing; dat configuratieveld is zelf geen bewijs van een overeenkomst. De huidige app is zichtbaar Restricted en wordt niet als contractueel vrijgegeven behandeld.

## E. Rekeningregistratie, adoptie en rollback

`functions/src/bank-registry.mjs` accepteert maximaal drie unieke eigenaarscontexten, profielen, IBAN's en geconfigureerde hashes. Dion moet exact aan de oorspronkelijke configuratie blijven voldoen. Per verzoek controleert de backend token/intrekking, actuele gebruiker, geverifieerde e-mail, huishouding/rol en het bestaande rekeningprofiel. De frontend kan geen eigen IBAN, eigenaar of huishouding als configuratie opleggen.

Nieuwe rekeningen krijgen profielgebonden metadatasleutels, eigen binding, sessie, intrekkingsgeneratie, lock en synchronisatiestatus. Globale sessie-eigenaarsrecords verhinderen sessiegebruik tussen rekeningen; autorisatiestate blijft aan profiel/gebruiker/huishouding gebonden. De bestaande adapter, Nakijken en dashboardknoppen verwerken het geselecteerde profiel. Verkeerde-profielantwoorden worden vóór frontendopslag geweigerd.

### Alleen-lezen adoptieplan

Het bestaande script `functions/scripts/adopt-bank-registry.mjs` is geïnspecteerd; `--help` is uitgevoerd. **Er is geen echt productieplan via dit script uitgevoerd**, omdat bestaande lokale ADC ontbreekt: geen ingestelde credentialverwijzing en geen standaard ADC-bestand. De bestaande Firebase CLI-login voor deze metadata-audit is niet automatisch ADC voor dit script. Daarnaast ontbreekt de hash voor een volledige actieve registratie van Dion plus Gezamenlijk. Geen fictieve productieconfiguratie gemaakt. Een plan met alleen de echte Dion-entry is conceptueel mogelijk, maar vraagt eveneens een geldige bestaande ADC-aanmelding.

De planfunctie is met synthetische fixtures getest. Zij leest `connection`, `account-binding`, `connection-control`, `sync-lock`, `registry-control` en het bij de sessie horende eigenaarsrecord. Planmodus schrijft niets en roept de provider niet aan. Een latere `--apply` zou bij benodigde adoptie alleen twee private records schrijven:

- `registry-control`, met scope-/bindingsbewijs en sessiedigests;
- `session-owner-<digest>`, met rekeninggebonden eigendom en verval.

De oorspronkelijke sessie, permanente binding, financiële records en overige rekeningmetadata blijven staan. Herhalen na succesvolle adoptie schrijft niets zolang de relevante adoptiegegevens onveranderd zijn. Ontbrekende/afwijkende binding, scope, generatie, verlopen sessie of actieve lock stopt de operatie.

**Gelijktijdigheid blijft een expliciete activeringsvoorwaarde.** Firestore-transacties controleren de gelezen records bij uitvoering en herhalen bij conflicten. Maar het plan is geen gereserveerde productiesnapshot: de code vergrendelt geen nieuwe legacy-autorisaties tussen plan, adoptie en configuratie-uitrol. Een legacy-callback die na adoptie afrondt kan een nieuwe sessie opleveren zonder bijbehorend eigenaarsrecord. Registermodus blokkeert dan veilig met `session-owner-missing`, maar Dion kan tijdelijk onbeschikbaar zijn. Daarom bankacties tijdens de overgang pauzeren, alle nog geldige/in uitvoering zijnde autorisaties uitsluiten en vlak vóór registeractivering het echte plan opnieuw beoordelen; zo nodig dezelfde actuele sessie expliciet opnieuw adopteren. Geen automatische reset.

### Fase 1 en rollback

Met `ENABLE_BANKING_ACCOUNTS` leeg gebruikt de nieuwe backend de bestaande enkelrekeningservice. Starten/initialiseren voert geen adoptie of Firestore-migratie uit. De bestaande startupcontrole kan alleen `GET /application` en `GET /aspsps` uitvoeren. Ook bij het bekijken van de gezamenlijke rekeningdetails kon de bestaande backend koud starten en deze configuratiecontroles doen; dat creëert geen banktoestemming of sessie en haalt geen bankgegevens op.

Bij de huidige Dion-metadata schrijft een normale statuscontrole geen nieuwe binding of retentieversie. De oudere compatibiliteitsroute kan bij nog niet overgezette oude metadata wél een binding/retentieversie aanvullen; dat geval is hier niet aanwezig. **Een expliciete synchronisatie schrijft voortaan ook `sync-status`**, zelfs in enkelrekeningmodus. Dit is beoogde private synchronisatiemetadata, geen automatische deploymentmigratie of financiële wijziging. Deze grens is aanvullend getest.

Leegmaken van het register laat Dion op dezelfde paden terugvallen. Het oorspronkelijke backendbronpakket en de oorspronkelijke configuratie kunnen eveneens worden hersteld. Extra rekeningmetadata blijft bewaard en wordt in enkelrekeningmodus niet gebruikt. Rollback trekt een nieuwe gezamenlijke providertoestemming niet automatisch in; intrekking vraagt een afzonderlijke bewuste actie. Een verlopen of ingetrokken toestemming wordt niet met een oude snapshot gerepareerd.

Na nieuwe Dion-autorisatie onder een legacybackend moet vóór heractivering van het register opnieuw worden geadopteerd. Geen oude financiële state of oude sessie over actuele gegevens heen terugzetten.

Herstelpunt `C:/Users/dionv/AppData/Local/Finize/p5b-drie-20261025/` is aanwezig. SHA-256 opnieuw gecontroleerd:

| Bestand | SHA-256 |
|---|---|
| `source-r11.zip` | `f4beb7999dfef2dc8ab9c9b99a2f65b833288e8b536d41f81b547571bf9f03a2` |
| `repository.bundle` | `92de0126e718187939c57fc62d08342831c01d68582110e6d0ed00ba737e68e4` |
| `deployed-functions-source.zip` | `ac63f6896771707358fbfc916c6a058095f0a7b03f7860ea0848e9fca63e67a2` |

## F. Gerichte tests en resterende onzekerheden

| Controle | Resultaat |
|---|---|
| Bestaande P5b-backend, configuratie, provider en multirekeningtests | **70/70 geslaagd**, zowel op lokale Node 24 als Node 22.23.4 |
| Echte Functions-HTTP-handler met synthetische SDK/provider | **1/1 geslaagd**, op Node 24 en Node 22 |
| Aanvullende auditgevallen: lege registratie/status zonder writes, expliciete sync met alleen bedoelde metadata | **2/2 geslaagd**, Node 22; testbestand buiten Git |
| Bestaand gericht geval interne transfer `P7 X5` | **1/1 geslaagd**: fysieke rekeningmutaties blijven zelfstandig; geen dubbele externe huishoudkasstroom |
| Gerichte browserscenario's | **23/23 geslaagd**, inclusief drie profielen op 1440/390/320 px, sessie-/profielgrenzen, dashboard, herhalen/herladen en conflict-/herstelroutes |
| Frontendbuild en syntax | Gegenereerde runtime reproduceerbaar; syntax geldig; diffcontrole geslaagd |
| Functions-dependencies en build | Geïsoleerde `npm ci` vanuit bestaande lockfile geslaagd; 252 pakketten. Gelockt: `firebase-admin 13.10.0`, `firebase-functions 6.6.0`. Imports en build op Node 22 geslaagd; gedeelde bestanden bytegelijk aan hun bron |
| Herstel/configuratie | Lockfile ongewijzigd; lokale private omgevingsconfiguratie gelijk aan herstelpunt |

De 29 multirekeninggevallen omvatten expliciete/idempotente adoptie, onzekerheidsstops, verkeerde UID/rol/IBAN/hash, sessiewisseling, permanente binding, callbackhergebruik/-toewijzing, gescheiden locks, intrekking/verval, behouden Dion-goedkeuringen/CSV-relaties en heradoptie na rollback. Fixtures zijn synthetisch. Geen zware regressiesuite of benchmarks uitgevoerd. Waarschuwingen over Node 24 tegenover de Functions-engine en experimentele testmocks zijn geen testfouten; runtimecontrole is ook op Node 22 uitgevoerd.

Onzekerheden blijven: daadwerkelijke actuele providergeldigheid van Dion; officiële gezamenlijke hash en eigen sessie; definitieve rekeninghouderbevoegdheid voor de gezamenlijke autorisatie; echte CLI-planuitvoering met ADC; overgang zonder gelijktijdige bankacties. Synthetische tests vervangen geen gecontroleerde eerste productieactivering.

Geanonimiseerde nieuwe bewijzen en testlogs staan uitsluitend lokaal buiten Git:

`C:/Users/dionv/AppData/Local/Finize/p5b-productiecontrole-20261025/`

Daar staan onder andere `production-redacted.json`, `joint-redacted.json`, `control-panel-redacted.txt`, `public-checks.json`, `local-proof.json`, de Node-/HTTP-/transfer-/compatibiliteitslogs en browserresultaten. De geïsoleerde dependency-/buildkopie bevat geen productieomgevingsbestand of sleutel. De repository-implementatie is tijdens deze controle niet gerepareerd of aangepast.

Eindhercontrole tot **10:52 UTC**: dezelfde GitHub-commit, productieconfiguratie en geselecteerde private metadata; bronbestandsmanifest ongewijzigd op dit nieuwe verslag na. Cloud Run-verkeer en TTL-velden zijn aanvullend vastgelegd in `runtime-redacted.json`.

## G. Besluit en eerstvolgende toestemming

**VOORWAARDELIJK GEREED: technisch veilig voor fase 1, maar met expliciet genoemde blokkades voor fase 2 of 3.**

Fase 1 betreft uitsluitend de nieuwe backend in enkelrekeningmodus: lege `ENABLE_BANKING_ACCOUNTS`, alle oorspronkelijke Dion-parameters en bestaande runtime-, IAM-, secret- en callbackinstellingen behouden. De bestaande gepubliceerde frontend blijft hiermee compatibel. Geen gezamenlijke activering of adoptie als onderdeel van die stap.

Vóór registeractivering zijn een echte beoordeelde planuitvoering, de gecontroleerde gezamenlijke hash/configuratie, een veilige bootstrap indien nodig en een overgang zonder gelijktijdige autorisaties vereist. Dara blijft buiten de actieve registratie totdat eigen toegangsvoorwaarden aantoonbaar zijn vervuld.

**Exacte eerstvolgende handeling waarvoor toestemming nodig is:** uitsluitend de gecontroleerde lokale `enableBanking`-backend naar het bestaande project in `europe-west4` deployen met lege `ENABLE_BANKING_ACCOUNTS` en onveranderde oorspronkelijke configuratie. Dit vereist afzonderlijke goedkeuring; het is hier niet uitgevoerd. Push, merge, frontendpublicatie, `--apply`, registeractivering en nieuwe bankautorisatie vallen niet onder die eerste toestemming.
