# V117 — CSV-reset en publicatie met bestaande cloudsynchronisatie

Status 12 oktober 2026: **CSV-reset afgerond; V117-client en cache gepubliceerd en live gecontroleerd**. De nieuwe productie-recordopslag blijft uitgeschakeld.

Code-releasecommit: `745c8148f8e416d3119e3445e167cf98e86dcba8`. De [Pages-publicatie](https://github.com/Dionvs/Finize/actions/runs/38252202704) is geslaagd; alle zeven gecontroleerde live assets zijn bytegelijk aan die commit. De apphash blijft exact de geteste hash en de cacheversie is `finize-v117-p4r4c`. Zie het [machineleesbare publicatiebewijs](v117-publicatiebewijs.json).

De aangemelde Edge-app is opnieuw geopend en volledig herladen met de V117-script-/stijlverwijzingen. Een achtergebleven lokale snapshot werd aanvankelijk als conflict beschermd; de actuele cloudstand bleef leidend. De lokale JSON-export vóór en na opnieuw laden bevat exact de vijftien behouden handmatige boekingen, nul imports en twintig verwijderbewijzen, met ongewijzigde instellingen. Na herladen meldt de app **Cloud opgeslagen**. De oorspronkelijke volledige back-up en beide actuele app-exports blijven beschikbaar; geen oude snapshot is teruggezet.

## Besluit van de gebruiker

De gebruiker heeft expliciet toestemming gegeven om alle CSV-imports en hun gekoppelde verwerkingen te verwijderen, met behoud van een herstelbare back-up, instellingen en onafhankelijke handmatige boekingen. Alle apparaten waren volgens de gebruiker gesynchroniseerd. De definitieve verwijdering is nogmaals op het uitvoermoment bevestigd. De gebruiker wil vervolgens de app kunnen gebruiken en heeft publicatie/cache-update toegestaan, met uitstel van de nieuwe productie-recordopslag en de resterende grote-fixture- en conflictinterfacewerkzaamheden.

Publicatie betreft daarom de reeds geteste build `117-p4r4c`, SHA-256 `0840650614444b727d603f273838085b8e91cb5d2912db1dcdfbe8d593885713`, met de bestaande generatie-/hoofdaanwijzersynchronisatie. Productie-recordmigratie blijft in deze build expliciet uitgeschakeld. Geen beveiligingshek wordt omzeild of verwijderd om publicatie mogelijk te maken. De lokale opslagmigratie en hervatting blijven onderdeel van de bestaande geteste client.

## Back-up vóór verwijdering

De verse volledige Firestore-snapshot heeft serverleestijd **2026-10-12T10:11:18.769918Z**: 1.418 documenten in 228 collecties. Alle oorspronkelijke native veldtypen zijn in een lege demo-omgeving hersteld en exact teruggelezen. Het pakket bevat ook de twee standaard Firebase Auth-accounts en hun hashvelden, beschikbare configuratie, regels/indexinformatie en zeven gepubliceerde V116-assets. Echt wachtwoord-/OAuth-inloggen is niet getest. Er zijn geen Cloud Storage-buckets aangetroffen; de niet beschikbare tenantlijst-API blijft expliciet vermeld in het manifest.

De app-JSON-back-up van dezelfde ochtend is daarnaast bewaard en vergeleken met de cloudtransacties en instellingen. Deze JSON alleen bevat niet alle importdetails: het volledige cloudpakket blijft noodzakelijk voor herstel van CSV-bronnen.

Privébestanden staan onder `backups/v117-csv-reset-20261012/`, buiten Git. Een tweede ZIP staat op `C:\Users\dionv\.codex\backups\finize-before-csv-reset-20261012.zip`; alle 27 geselecteerde bestanden zijn na uitpakken opnieuw gecontroleerd. ZIP-SHA-256: `c976b2bc4e79d4fa1163a54667718c788b873412a82428accedaa95dfc633db1`. Beide locaties zijn gecontroleerd; onafhankelijke fysieke schijven zijn niet aangetoond. Alle oudere back-ups en logs blijven bewaard.

Negen oudere CSV-bestanden ontbraken al als volledige bestandsbytes in de cloud. Hun aanwezige bankregels zijn geback-upt. Deze beperking blijft historische informatie; de gebruiker heeft gekozen om maanden na publicatie opnieuw in te voeren.

## Reikwijdte en proef

De cloud bevat tien nog niet als verwijderd gemarkeerde importheaders: acht met een actuele verwijzing in de administratie en twee oude restanten zonder actuele verwijzing of financieel effect. De gewone app toont die laatste twee niet. Er zijn ook tien reeds verwijderde technische bewijzen.

De bestaande pure `planImportCommand(..., {type: 'delete'})` is voor alle tien imports gebruikt. De kandidaat bevat nul CSV-bronnen en nul importoverzichten, twintig technische verwijderbewijzen en exact de **vijftien oorspronkelijke onafhankelijke handmatige boekingen**. Planning, standaardinkomens en -budgetten inclusief historie, vaste lasten, rekeningprofielen, herkenningsregels en maandgegevens blijven gelijk. Het verwijderen van CSV-effecten wijzigt de gerealiseerde maandcijfers bewust; het is geen volledige reset van persoonlijke instellingen of handmatige administratie.

In een geïsoleerd browserprofiel is dezelfde route van de werkelijk gepubliceerde V116-app uitgevoerd. Alle tien imports zijn verwijderd, de financiële invarianten en instellingen zijn gecontroleerd, een volledige V116-procesherstart is geslaagd en daarna is dezelfde administratie verliesloos in V117 geopend. Er verscheen geen blokkade voor ontbrekende salarisbron. De eerste testharnas-time-out blijft als afzonderlijk bewijs bewaard; de geslaagde proef wacht op het werkelijk sluiten van ieder importvenster.

Het echte Edge-bevestigingsvenster blokkeerde de browserbediening; de gebruiker heeft dit op verzoek geannuleerd. Daarom wordt de strikt huishoudgebonden onderhoudsroute afzonderlijk in de demo beproefd. Zij hergebruikt de bestaande verwijderplanner en `createChunkedCloudStore`, verifieert iedere staged byte vóór activering, en publiceert de nieuwe hoofdaanwijzer en alle tien verwijderbewijzen atomair met precondities op de oude documentrevisies. Bij een gewijzigde financiële bron of instelling sinds de gecontroleerde back-up stopt de route. Pas na bevestigde verwijderbewijzen worden de betreffende importchunks verwijderd. Historische state-generaties en back-ups blijven beschermd. Deze route activeert geen V117-recordopslag.

De gebruiker heeft tijdens de voorbereiding zelf de acht zichtbare imports verwijderd. De eerste onderhoudspoging stopte terecht vóór iedere productie-write toen zij deze gewijzigde financiële stand zag. Alle verschillen zijn vervolgens vergeleken met de bestaande planner: uitsluitend de bevestigde CSV-verwijderingen, zonder toegevoegde of gewijzigde boekingen. Een aanvullende demo bootste deze situatie na: acht reeds verwijderde imports en twee resterende verborgen headers. Ook die hervatting en de afwijzing van een verouderde head zijn geslaagd.

De gecontroleerde productie-uitvoering verwijderde alleen de twee resterende imports en hun twee chunks. De nieuwe generatie, pointer en technische verwijderbewijzen zijn exact teruggelezen; cloudrevisie na onderhoud is **1005**. Eindstand: **15 onafhankelijke transactieregels, nul actieve importoverzichten, twintig technische verwijderbewijzen, nul chunks onder de tien verwijderde imports**. Alle 356 CSV-gerelateerde regels zijn bewust verwijderd; geen overige boeking is toegevoegd of gewijzigd. De tweede onafhankelijke readback bevestigt dezelfde eindstand. Alle oorspronkelijke back-ups blijven bewaard.

In de extra onderhoudsdemo liep het onbegrensd uitlezen van historische importchunks met een heap van 1.024 MiB vast op `Java heap space`. Die fout, log en heapdump blijven bewaard. De schone herhaling gebruikte een begrensde heap van 2.048 MiB en directe buffers van 512 MiB. De onderhoudsroute vraagt maximaal vier documenten per pagina, leest voor opruiming alleen generatie-/revisiemetadata en haalt uitsluitend de actieve brondelen volledig op. Zowel de volledige resetproef als de hervattingsproef slaagden daarmee. Dit is een infrastructuur-/onderhoudscontrole, geen applicatieoptimalisatie of nieuwe schaalopbouw.

## Herstel

Bij een afwijking: verdere invoer en synchronisatie eerst stoppen, alle actuele apparaten en de huidige cloudstand opnieuw veilig exporteren, en de oorspronkelijke volledige back-up in een aparte omgeving herstellen. Neem alle boekingen ná deze back-up mee voordat een gecontroleerde herstelgeneratie wordt gepubliceerd. Blind het oude JSON-bestand over een nieuwere administratie zetten is geen veilige herstelprocedure. Verwijderbewijzen en bronidentiteiten vereisen expliciete beoordeling bij herstel van oude imports.

## Afzonderlijk vervolgaanbod na publicatie

- Productie-recordsessie, hervatbare cloudmigratie en daadwerkelijk uitgerolde bescherming tegen oude schrijvende clients.
- De twee ontbrekende kalender-/offlinegevallen op de oorspronkelijke 500-/5.400-bronnenfixtures; er wordt geen volledige schaalopbouw herhaald voor deze publicatie.
- De afzonderlijk goed te keuren gebruikersinterface voor twee afwijkende goedkeuringen van dezelfde bron. Tot die tijd blijven zulke conflicten geblokkeerd en geldt de [minimale herstelprocedure](v117-minimale-conflictherstelprocedure.md).

De volledige 500-/5.400-schaalmetingen horen uitsluitend bij de eerdere build `117-p4r4`, niet bij de gepubliceerde kandidaat. De eerder behaalde 624 Node-, 42 regel-, 306 browsergevallen en drie afsluitende schrijfcontroles blijven als bewijs aan hun exacte build gekoppeld. Publicatie met bestaande cloudsynchronisatie is geen bewijs dat productie-recordopslag is omgeschakeld.
