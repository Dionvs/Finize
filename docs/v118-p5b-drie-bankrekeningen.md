# V118 P5b — drie onafhankelijke ING-bankverbindingen

25 oktober 2026. **Lokaal geïmplementeerd en getest; niet gepubliceerd of geactiveerd.** Geen push, merge, deployment, echte bankautorisatie of productiemigratie uitgevoerd.

## 1. Uitgangspunt en herstelpunt

GitHub `Dionvs/Finize`, branch `main`, is rechtstreeks gecontroleerd: geen nieuwere commit dan `d87263b0c46eb0e4143ac58aaccb332924beca64` (V118-r11). De werkboom was schoon. Productie gebruikt Functions-revisie `enablebanking-00007-moh`, Node 22, regio `europe-west4`, runtime `finize-bank`, min. 0/max. 1 instance en de bestaande Secret Manager-referentie naar `ENABLE_BANKING_PRIVATE_KEY`, versie 1. De zes bestaande IAM-permissies en actieve TTL-policy zijn vastgelegd; geen uitbreiding nodig.

Volledig bronarchief, geverifieerde Git-bundle, lokale configuratie en privéproductiemetadata staan buiten Git in `C:/Users/dionv/AppData/Local/Finize/p5b-drie-20261025/`. Ook het exacte gedeployde Functions-bronpakket is veiliggesteld: de MD5 komt overeen met de vastgelegde GCS-generatie; SHA-256 `ac63f6896771707358fbfc916c6a058095f0a7b03f7860ea0848e9fca63e67a2`.

Alle productiehandelingen waren alleen-lezen. De metadata-inspectie gebruikte veldprojecties en tellingen: Dions opgeslagen sessie en permanente binding hebben dezelfde gebruiker, huishouding, rekening en account-hash; de opgeslagen geldigheid loopt tot 21 april 2027. Geen private RSA-sleutel, provider-JWT, sessie-ID, autorisatiecode of echte transacties zijn als ontwikkelinput gelezen of als testfixture gebruikt. Er is geen nieuwe live providercontrole uitgevoerd: een opgeslagen geldigheidsdatum bewijst op zichzelf niet dat de bank intussen niets heeft ingetrokken.

## 2. Oorspronkelijke beperking en nieuwe registratie

De oude service koppelt alle routes aan één vaste `UID`, huishouding, profiel en IBAN, met metadata onder `finizeBankPrivate/ing/metadata`.

`functions/src/bank-registry.mjs` voegt één centrale, uitsluitend door de beheerder ingestelde registratie toe. `ENABLE_BANKING_ACCOUNTS` bevat een JSON-object met:

- `version: 1`, `providerMode: "restricted"` of `"contracted"`, `controlPanelUid` en bij contractuele toegang een echte `agreementRef`.
- Eén tot maximaal drie `accounts`, elk met `owner`, `actorRole`, `accountProfileId`, `uid`, `email`, `householdId`, `iban`, `accountHash`, `enabled` en `providerLinked`.

De registratie weigert dubbele profielen, eigenaarscontexten, IBAN’s en geconfigureerde bankidentiteiten; valideert ING-IBAN-controlecijfers; en koppelt Firebase-identiteit, e-mail en rol consistent. Dara mag niet Dions UID gebruiken. Voor een nieuwe actieve verbinding is vooraf een gecontroleerde Enable Banking-account-hash vereist.

De oorspronkelijke parameters blijven ongewijzigd als anker voor Dion. Een lege nieuwe parameter houdt de bestaande enkelrekeningmodus bruikbaar. Met registratie blijft dezelfde service-implementatie in gebruik, via een rekeninggebonden opslagadapter; geen drie gekopieerde functies.

## 3. Behoud van Dion en expliciete overgang

Dions bestaande `connection`, `account-binding`, `connection-control`, `sync-lock` en toekomstige `sync-status` blijven **op hun huidige paden**. Nieuwe rekeningen gebruiken `account-<SHA256(accountProfileId)>-<metadatasoort>` in dezelfde private metadata-collectie. Iedere rekening krijgt eigen sessie, binding, intrekkingsgeneratie, lock, synchronisatiegegevens en intrekkingswachtrij.

De idempotente overgang adopteert de bestaande Dion-verbinding in plaats van haar te verplaatsen. Een transactie controleert scope, IBAN-hash, permanente rekeningbinding, sessiegeldigheid, generatie en een eventueel actieve synchronisatie. Zij schrijft alleen een permanent `registry-control`-adoptiebewijs en een privé `session-owner-<hash>`-eigenaarsrecord. De oorspronkelijke sessie en binding blijven byte-inhoudelijk behouden; het adoptiebewijs bevat alleen een digest van de sessie, geen extra kopie van het sessie-ID. Een onduidelijke of ontbrekende binding stopt de overgang.

Nieuwe registratie kan vóór deze expliciete adoptie niet als een lege bankverbinding worden gebruikt: de backend geeft `bank-registry-migration-required`. Een provider-sessie kan slechts aan één Finize-rekening worden toegewezen. Een callback die een sessie van een andere rekening teruggeeft wordt afgewezen **zonder die andere sessie in te trekken**. Ongebruikte autorisatiestates blijven bestaan en zijn via hun opgeslagen profiel, gebruiker en huishouding gebonden. TTL blijft tijdelijke metadata opruimen op basis van oorspronkelijke geldigheid; permanente bindings- en adoptiegegevens krijgen geen TTL.

Er wordt geen financiële state gemigreerd: bron-ID’s, CSV-relaties, goedkeuringen, saldo-ijkpunten en prognoses blijven intact. Er is geen nieuwe toestemming voor Dion nodig zolang haar bestaande banksessie daadwerkelijk geldig is.

## 4. Autorisatievoorwaarden voor Gezamenlijk en Dara

Elke route controleert een Firebase ID-token met intrekkingscontrole, de actuele geverifieerde/actieve Firebase-gebruiker, de exacte toegestane UID/e-mail, de actuele `accountLinks`-huishouding/rol en het bestaande profiel met de juiste eigenaar en IBAN. Callback en gegevensoplevering controleren de relevante grenzen opnieuw. De Admin SDK omzeilt Firestore-regels; daarom gebeurt deze controle in de backend. Requestvelden kunnen geen gebruiker, IBAN of huishouding configureren.

Voor Gezamenlijk kan Dion als expliciet aangewezen gezamenlijke rekeninghouder autoriseren, zodra dit eigen rekeningbezit/toegangsrecht en de providerkoppeling zijn gecontroleerd. Een sessie mag meerdere bankrekeningen teruggeven; Finize selecteert uitsluitend de ene vooraf gekozen rekening. Een apart autorisatieproces levert een aparte sessie op.

**Dara blijft geblokkeerd onder de huidige Restricted-app van Dion**, ook als iemand `enabled` en `providerLinked` voor haar inschakelt. Haar eigen Firebase-identiteit is noodzakelijk, maar op zichzelf onvoldoende. De actuele [voorwaarden, Restriction of Use](https://enablebanking.com/terms/) beperken persoonlijk gebruik tot rekeningen die behoren aan de Control Panel-gebruiker die ze heeft gekoppeld. De [whitelistinstructie](https://enablebanking.com/docs/api/linked-accounts/) en [FAQ](https://enablebanking.com/docs/faq/) bevestigen dat alleen specifiek gekoppelde rekeningen worden teruggegeven en dat koppelen in het Control Panel de afzonderlijke API-toestemming niet vervangt.

De huidige [GET /application-specificatie](https://enablebanking.com/docs/api/reference/#getapplicationresponse) biedt geen veld dat Restricted versus contractuele toestemming voor derden bewijst. De backend leidt dit dus niet af uit `active: true`. De serverconfiguratie blijft `restricted` totdat passende providerafspraken werkelijk zijn vastgesteld. De ondersteunde contractuele route vereist `providerMode: "contracted"`, een geldige overeenkomstverwijzing en Dara’s eigen geverifieerde UID/e-mail/rol, gecontroleerde bankidentiteit en eigen ING-toestemming. Een beheerder moet die externe bewijsstukken verifiëren; een configuratieveld is zelf geen juridische toestemming.

## 5. Backend, opslag en interface

Dezelfde Cloud Functions v2-export, regio, runtime-identiteit, RSA-secret, callback en GitHub Pages-frontend blijven gebruikt. Er zijn geen nieuwe IAM-rollen, Firestore-securityregels, geplande taken of financiële opslagformaten nodig. Synchronisatielocks en laatste volledige synchronisatie staan per rekening; verlopen toegang of mislukte intrekking van één rekening beïnvloedt de andere niet. De kortste geldigheidsdatum van opgeslagen toestemming en actuele providersessie wordt getoond.

De bestaande rekeningdetails behouden **Banktoegang autoriseren**, **Bank bijwerken**, **Nakijken** en **Banktoegang intrekken**. Ze tonen eigen status, ophaalmoment, eventuele laatste volledige synchronisatie, toestemmingsverval en gerichte blokkade-/herstelmeldingen. De frontendvergrendeling is per huishouding/rekening, zodat een trage rekening de andere niet blokkeert. Een antwoord voor een ander rekeningprofiel wordt vóór opslag afgewezen. De dashboardknoppen gebruiken steeds de geselecteerde fysieke rekening; geen nieuwe hoofdtab of redesign.

De financiële route blijft provideradapter → bankbronopslag → Nakijken → expliciete goedkeuring. De P5a-, P1/P1b-, P2- en P4-motoren zijn niet aangepast. Pending mutaties worden niet geboekt, bronidentiteiten blijven rekeninggebonden, CSV/API-overlap vraagt bewijs, interne transfers blijven buiten dubbele externe huishoudtotalen en ongeschikte providersaldi worden geen einde-dagijkpunt.

## 6. Gerichte verificatie

- **272 Node-gevallen geslaagd** in negen gerichte bestanden: bestaande P5b-backend/configuratie/provider, nieuwe 29 rekening-/overgangsgevallen, P5a-invoercontract, P1-saldo, P1b-profielen, P2-liquiditeit en relevante P7-ledgergrenzen.
- **Eén aanvullend HTTP-scenario geslaagd** via de echte `index.mjs`-handler met uitsluitend synthetische SDK-, Firebase-, sleutel- en providerantwoorden. Controleert alle bankroutes, actuele identiteit, genegeerde aangeleverde IBAN/huishouding, sessiegeheimen, callback en veilige logging.
- **23 gerichte browsergevallen geslaagd**: bestaande bankbediening/goedkeuring/CSV-relaties, drie profielen op 1440/390/320 pixels, afzonderlijke autorisatie en imports, blokkade van Dara, gelijktijdigheid, verkeerde-profielantwoorden, herhalen/herladen, dashboardcontext en bestaande conflict-/herstelkopieroutes.
- Syntax en reproduceerbare Functions-/frontendbuild gecontroleerd. Geen volledige zware regressie of benchmarks uitgevoerd. De schermcontroles en bankgegevens zijn synthetisch; geen nieuwe live ING-sessie gestart.

Herhalen van de gerichte banktests: `npm --prefix functions test`; HTTP-contracttest: `npm --prefix functions run test:http` (lokale Node-testmodulemocks; hier Node 24). De volledige lokale bewijsstukken en screenshots staan bij het herstelpunt, buiten Git.

## 7. Benodigde handmatige configuratie

`functions/bank-registry.example.json` bevat uitsluitend synthetische waarden, inclusief een bewust ongeldig productieproject. Maak pas na afzonderlijke productiegoedkeuring een privéconfiguratie buiten Git. Voor de CLI zijn de gelockte Functions-dependencies nodig (`npm ci --prefix functions`) en bestaande ADC met voldoende projectrechten; geen geëxporteerde privésleutel of provider-JWT.

Bekende bestaande Finize-profielen uit de inrichting:

| Context | Bestaand profiel | Rekeningkenmerk |
|---|---|---|
| Gezamenlijk | `account-388ed1e4` | eindigt op 7513 |
| Dion | `account-f836cfaa` | eindigt op 7899 |
| Dara | `account-18a27a81` | eindigt op 9629 |

Controleer vóór activering opnieuw het actuele register, de volledige IBAN en eigenaar; maak geen nieuwe profielen. Deze lokale ontwikkeling heeft geen echte financiële state als testdataset opgehaald.

Voor Gezamenlijk zijn nodig: het bestaande profiel, volledige gecontroleerde ING-IBAN, de account-hash uit de toegestane Enable Banking-koppeling, de expliciete geverifieerde Firebase-UID/e-mail/rol van de autoriserende gezamenlijke rekeninghouder en de bestaande huishouding. Koppel de specifieke gezamenlijke rekening in het Control Panel onder de juiste eigenaar, behoud de huidige app/certificaatsleutel en whitelist/callback, en stel daarna pas `providerLinked: true` en `enabled: true` in. Wijzig Dions oorspronkelijke configuratie niet.

Bij de eerste gezamenlijke activering worden `uid`, `email` en `householdId` exact overgenomen uit Dions oorspronkelijke serverparameters, met `owner: "gezamenlijk"`, `actorRole: "dion"` en het gezamenlijke profiel uit de tabel. `controlPanelUid` blijft Dions oorspronkelijke UID. Ook Dions eigen registerentry kopieert haar oorspronkelijke parameters exact: als `ENABLE_BANKING_ACCOUNT_HASH` oorspronkelijk leeg was, blijft dit registerveld voor Dion leeg. Haar bestaande private permanente binding blijft dan de rekeningidentiteit bepalen.

Voor Dara zijn haar echte Firebase-UID, geverifieerde e-mail en `accountLinks`-rol `dara` in dezelfde huishouding nog apart te bevestigen. Gebruik geen fictieve productie-identiteit. Zolang die gegevens ontbreken, laat haar uit de actieve registratie. Daarna kan zij voorbereid maar uitgeschakeld worden geregistreerd; Restricted-toegang blijft geblokkeerd totdat passende providerafspraken zijn bevestigd. Sla uitsluitend het `registry`-object op in de serverparameter `ENABLE_BANKING_ACCOUNTS`; de overige velden van het voorbeeld zijn voor de private CLI-configuratie.

## 8. Veilige publicatie, eerste activering en rollback

**Deze stappen zijn alleen voorbereid en nog niet uitgevoerd.**

1. Vraag afzonderlijke toestemming voor productiecode, private metadata-adoptie, configuratie en de gezamenlijke bankautorisatie. Hercontroleer actuele GitHub-HEAD, backendrevisie en de bestaande Dion-status. Rond eventuele openstaande Dion-autorisaties af en pauzeer bankacties tijdens de overgang; behoud alle tijdelijke metadata.
2. Publiceer na goedkeuring eerst de nieuwe backend met `ENABLE_BANKING_ACCOUNTS` leeg en alle oorspronkelijke Dion-parameters, runtime-/buildidentiteit en secretreferentie ongewijzigd. Controleer dat Dion verbonden blijft, zonder haar opnieuw te autoriseren.
3. Vul de private configuratie op basis van echte gecontroleerde metadata. Voer `node functions/scripts/adopt-bank-registry.mjs --config <privé-config.json>` uit voor het alleen-lezen plan. Stop bij ontbrekende binding, actieve synchronisatie, afwijkende identiteit, generatie of geldigheid.
4. Pas na beoordeling: dezelfde opdracht met `--apply`. Deze schrijft twee private adoptie-/eigenaarsrecords en geen financiële data. Herhalen verandert niets wanneer de adoptie al bevestigd is. Controleer het plan opnieuw vlak vóór configuratie-activering; zo worden eventueel tussentijds afgeronde legacy-autorisaties niet over het hoofd gezien.
5. Activeer de serverregistratie met Dion en uitsluitend gereed bevonden overige rekeningen. Publiceer de frontend met een nieuwe, samenhangende cacheversie en controleer Pages/assets. Dions r11-cachemarker is tijdens deze lokale stap niet gewijzigd.
6. Laat de bevoegde gezamenlijke rekeninghouder alleen Gezamenlijk autoriseren. Controleer vervolgens status en geselecteerde identiteit. Haal eerst een begrensde periode op, controleer de nieuwe gezamenlijke bronrecords en Nakijken, en vergelijk Dions bronnen, goedkeuringen en prognose met het vooraf gemaakte referentiepunt. Herhaal ophalen één keer en controleer bron-ID’s/aantallen. Keur niets automatisch goed; beoordeel CSV-overlap en interne transfers expliciet.
7. Bij een fout: stop de nieuwe activering. Maak `ENABLE_BANKING_ACCOUNTS` leeg of herstel het oorspronkelijke backendbronpakket/configuratie en de r11-frontend. Dion blijft op dezelfde metadatapaden en met dezelfde binding werken. Verwijder of herstel geen financiële data of oude sessie uit een snapshot. De extra rekeningmetadata blijft privé bewaard en kan later gecontroleerd worden hervat; intrekken van een nieuwe toestemming vraagt een aparte bewuste keuze.
8. Als Dion tijdens een rollback via de legacyversie opnieuw heeft geautoriseerd, voer vóór heractivering het adoptieplan opnieuw uit. Alleen de expliciete, gecontroleerde adoptie kan dan het nieuwe sessie-eigenaarsrecord toevoegen. Een verlopen of werkelijk ingetrokken toestemming kan niet met een rollback worden gerepareerd.

**Eindstatus:** maximaal drie afzonderlijke verbindingen lokaal ondersteund; Gezamenlijk technisch voorbereid; Dions bestaande productieverbinding niet gewijzigd; Dara standaard geblokkeerd. Productie wacht op afzonderlijke toestemming en echte configuratie-/toestemmingscontroles.
