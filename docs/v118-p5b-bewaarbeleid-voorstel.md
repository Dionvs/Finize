# Voorstel bewaarbeleid bankkoppeling

**Status na akkoord:** de onderstaande termijnen zijn door de gebruiker goedgekeurd en lokaal geïmplementeerd en getest. Zie [implementatie en verificatie](v118-p5b-retentie-implementatie-20261023.md). De overige tekst hieronder bewaart het oorspronkelijke voorstel; automatische opschoning is nog niet geactiveerd.

23 oktober 2026. Ter beoordeling vóór eerste echte bankautorisatie. **Dit voorstel activeert geen verwijderingen, TTL, scheduler of cloudwijziging.** De bankroutes en frontend blijven uitgeschakeld.

## Voorgestelde termijnen

| Gegevens | Geldigheid / gebruik | Voorstel voor opschonen |
| --- | --- | --- |
| Gehashte autorisatiestate en koppelpoging | Maximaal 10 minuten; eenmaal te gebruiken | Vanaf 24 uur na het verlopen van de poging automatisch laten verwijderen |
| Tijdelijke synchronisatievergrendeling | Maximaal 3 minuten | Vanaf 24 uur na afloop automatisch laten verwijderen |
| Sessie-ID en rekening-ID van een actieve verbinding | Alleen tot het door de provider bevestigde einde van de toestemming | Vanaf 7 dagen na het toestemmingsverloop verwijderen; bij bevestigde intrekking direct uit de actieve verbinding halen |
| Oude sessie waarvan intrekking nog niet is bevestigd | Alleen behouden om intrekking opnieuw te proberen; geen toegang tot ophalen herstellen | Herhalen bij een volgende expliciete intrekkingsactie; uiterlijk vanaf 7 dagen na het oorspronkelijke sessieverloop verwijderen |
| Vaste rekeningbinding, zonder sessie-ID | Nodig om te voorkomen dat herautorisatie ongemerkt een andere provideridentiteit accepteert | Behouden zolang het bijbehorende rekeningprofiel bestaat; alleen via expliciete beheerhandeling wijzigen/verwijderen |
| Transacties, saldobronnen, CSV-/API-bronbewijzen en goedkeuringen | Onderdeel van de financiële administratie | Geen automatische verwijdering door dit beleid; bestaande verwijder-/exportprocedure blijft gelden |

De 24 uur en 7 dagen zijn voorgestelde productkeuzes. Een technisch verlopen record mag al niet meer worden gebruikt, ook als het nog niet fysiek is verwijderd.

## Waarom de verbinding eerst moet worden gesplitst

De huidige connection-record bevat zowel de sessiereferentie als de vaste accountHash. Een TTL op dit hele document zou ook het bewijs van de eerder gekoppelde rekeningidentiteit wissen. Dat mag de controle bij herautorisatie niet verzwakken.

Voor uitvoering moet de vaste binding daarom eerst in een afzonderlijk privaat record worden behouden. Herautorisatie moet die binding ook controleren nadat het oude sessiedocument is verwijderd. De eerdere sessievaliditeit moet bij retired-records worden vastgelegd; momenteel bevatten die alleen sessionId en revokePending. Bestaande bindingswaarden mogen niet worden verzonnen of opnieuw afgeleid uit een transactiebedrag of omschrijving.

## Voorbereide uitvoeringsroute

Gebruik de ingebouwde Firestore-TTL-functie voor uitsluitend tijdelijke private bankmetadata. Hiervoor is geen delete-permissie op het runtime-account nodig en er hoeft geen aparte opschoonscheduler te worden gemaakt.

- Voeg alleen aan te verwijderen bankdocumenten een uniek rootveld finizeBankExpiresAt toe, met een echte Firestore Timestamp. De huidige numerieke value.expiresAt is geen TTL-veld.
- Pas dit veld niet toe op de vaste rekeningbinding, financiële bronnen of huishoudadministratie.
- Controleer vóór activering de collectiegroup metadata en alle bestaande documenten met dit veld. TTL werkt op een collectiegroup, niet uitsluitend op één documentpad. Controleer ook of er al een TTL-veld actief is; er kan maar één per groep bestaan.
- Activeer uitsluitend deze specifieke veldpolicy; geen algemene Firebase-deployment van regels/indexen. Bij een bestaande of conflicterende policy eerst stoppen en beoordelen.
- Houd rekening met de asynchrone verwijdering: Google beschrijft doorgaans verwijdering binnen 24 uur ná het ingestelde vervalmoment, zonder garantie van directe verwijdering. Toegangscontroles blijven daarom de geldigheid zelf afdwingen.
- Bevestigde intrekking blijft via de bestaande applicatieroute de actieve sessiewaarde leegmaken. Mislukte intrekking moet zichtbaar blijven en een volgende poging moet ook oude retired-sessies behandelen.
- Presenteer in de definitieve privacytekst een opschoonmoment plus de gebruikelijke technische verwerkingsvertraging, geen harde verwijdergarantie die Firestore niet biedt.

## Vereiste controles vóór activering

1. Een verlopen/gebruikte state blijft ongeldig vóór en ná TTL-verwijdering; herhalen wisselt nooit opnieuw een code uit.
2. Na het verwijderen van een verlopen sessie blijft dezelfde vaste rekeninghash vereist bij herautorisatie.
3. Mislukte intrekking blokkeert lokaal ophalen, blijft opnieuw uitvoerbaar en verdwijnt niet voordat de sessie is ingetrokken of veilig verlopen.
4. Tijdstempels verschuiven niet bij elke statuslezing; alleen nieuwe pogingen/sessies mogen een nieuwe termijn krijgen.
5. Het nieuwe veld komt uitsluitend op de bedoelde tijdelijke bankrecords voor. Financiële bronnen en profielbindingen krijgen het niet.
6. Retentie-instellingen en definitieve privacytekst worden samen gepubliceerd, pas na akkoord op dit voorstel en geslaagde tests.

## Huidige status

Geen echte API-banksessie aangemaakt. De gedeployde backend is technisch gecontroleerd maar uitgeschakeld. Dit voorstel staat lokaal; er zijn geen records verwijderd en de runtime-IAM-rol is niet gewijzigd. De lokale privacytekst vermeldt daarom nog expliciet dat automatische opschoning vóór het eerste bankgebruik moet worden afgerond.

Bron: [Firestore TTL](https://docs.cloud.google.com/firestore/native/docs/ttl).
