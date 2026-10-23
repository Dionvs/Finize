# P5b — lokale voorbereiding vóór publicatie

**Vervolg na akkoord:** het bewaarbeleid is inmiddels lokaal geïmplementeerd en getest; zie [actuele implementatiestatus](v118-p5b-retentie-implementatie-20261023.md). De beschrijving hieronder legt de eerdere voorbereidingsstap vast. Cloud-TTL en bankgebruik zijn nog niet geactiveerd.

23 oktober 2026. Alleen lokaal voorbereid en getest. Geen publicatie, backenddeployment, bankautorisatie, TTL-activering of verwijdering uitgevoerd in deze stap.

## Bankknoppen

- Bij openen van de rekeningdetails wordt na activering alleen /status gelezen. Er worden niet vanzelf saldi of transacties opgehaald.
- Bank bijwerken is pas beschikbaar na een bevestigde verbinding. Geen verbinding of verlopen toestemming krijgt een duidelijke vervolgstap.
- Tijdens aanvragen zijn knoppen geblokkeerd tegen dubbel klikken. Bestaande imports nakijken blijft beschikbaar wanneer alleen de verbindingstatus wordt gecontroleerd of wanneer de statuscontrole mislukt.
- Verlopen aanmelding, verkeerde rekening, verlopen banktoestemming, timeouts en verbindingsfouten krijgen begrijpelijke meldingen. Onbekende server-/netwerkfouten worden niet als ruwe technische tekst getoond.
- Bij een mislukte intrekking verschijnt geen succesmelding: de intrekking blijft expliciet onbevestigd en kan opnieuw worden geprobeerd. Ophalen wordt in dat paneel geblokkeerd totdat de verbinding opnieuw is gecontroleerd.
- Na bevestigde intrekking is ophalen geblokkeerd; de financiële historie blijft behouden.
- Laatst opgehaalde gegevens krijgen een leesbare Nederlandse datum/tijd; onvolledigheid blijft zichtbaar.
- Verzoeken hebben een eindige wachttijd: 190 seconden voor ophalen, 65 seconden voor de overige acties. De serverlimiet blijft 180 seconden.
- Gearchiveerde rekeningen kunnen niet autoriseren/ophalen/intrekken vanuit dit paneel; nakijken blijft beschikbaar. De bestaande backend blokkeert gearchiveerde profielen eveneens. Een eventuele bestaande verbinding moet daarom vóór archiveren worden ingetrokken; het archiveren zelf is niet gewijzigd en trekt geen banktoegang in.

## Privacy en voorwaarden

De lokale privacy.html en terms.html beschrijven nu de ingerichte bankserver, aparte activering en rekeninghouderstoestemming, één toegestane eigen ING-rekening, handmatig ophalen, mogelijke onvolledigheid, de bestaande goedkeuringsroute, de grenzen van intrekken en de scheiding tussen sessiegegevens en financiële historie.

De tekst maakt geen aanspraak op reeds actieve automatische opschoning. Zij vermeldt dat deze vóór echt bankgebruik moet worden afgerond. De bestaande overige juridische bepalingen en vormgeving zijn behouden. Het Enable Banking Control Panel-privacybeleid is als zodanig gelabeld; dat document is geen vervanging voor de informatie bij bankautorisatie.

## Bewaarbeleid ter beoordeling

Zie [concreet voorstel](v118-p5b-bewaarbeleid-voorstel.md): tijdelijke koppelpogingen en vergrendelingen vanaf 24 uur na hun vervalmoment laten opschonen; verlopen sessiereferenties vanaf 7 dagen na hun sessieverloop. Financiële bronnen vallen buiten automatische opschoning.

De vaste rekeninghash moet eerst buiten het te verwijderen sessiedocument worden behouden. Anders zou het verwijderen van een verlopen sessie de bescherming tegen een gewijzigde rekeningidentiteit bij herautorisatie verzwakken. Oude niet-ingetrokken sessies moeten hun oorspronkelijke vervaldatum behouden en opnieuw kunnen worden ingetrokken. Dit zijn concrete vereisten voor de volgende lokale backendwijziging; zij zijn nog niet uitgevoerd.

De termijnen zijn een voorstel. Firestore TTL verwijdert asynchroon; de ingestelde termijn is geen garantie dat een document exact op dat moment fysiek weg is. Alleen een uniek Timestamp-veld op tijdelijke private bankrecords mag later een TTL-policy krijgen. Geen TTL op financiële bronnen of de vaste rekeningbinding.

## Verificatie

- Negen unieke gerichte browsertests geslaagd, inclusief de bestaande controles op fysieke rekeningstand, expliciete financiële goedkeuring, CSV/API-overlap en duurzaam herladen.
- De nieuwe controles dekken ontbreken/verlopen van banktoestemming, alleen een statusverzoek bij openen, netwerkuitval, beschikbare Nakijken-knop en herhalen van mislukte intrekking.
- Mobiel 390 px en desktop 1440 px gecontroleerd. Afzonderlijke beelden van de bankbediening en de bestaande verwerking zijn gemaakt met uitsluitend synthetische gegevens.
- Privacy- en voorwaardenpagina lokaal geopend; de onderlinge navigatie en bijgewerkte inhoud gecontroleerd.
- Syntaxcontrole geslaagd; gegenereerde app reproduceerbaar; mechanische Impeccable-controle op de gewijzigde UI-/HTML-bestanden gaf geen bevindingen.
- Geen brede volledige regressiesuite uitgevoerd. Bij een echte release zijn de overige bestaande onvoltooide wijzigingen en de gewone PWA-/cacheversierelease nog te controleren.

## Bestanden en uitrolgrens

Gewijzigd: src/ui/bank-connection.mjs, privacy.html, terms.html, tests/browser/v118-p5b-bank.spec.cjs en de gegenereerde app.js. Het bewaarbeleid en dit verslag zijn toegevoegd. Herstelkopieën van de drie handmatig aangepaste productbestanden staan buiten de repository onder C:/Users/dionv/AppData/Local/Finize/p5b-releasevoorbereiding-20261023/.

Frontend BANK_API_ENABLED blijft false. De backendvlag is in deze stap niet gewijzigd. Geen commit/push, serviceworker-cachewijziging, Firestore-regels of bestaande financiële gegevens aangepast.

Volgende stap na beoordeling van het bewaarbeleid: tijdelijke metadata en vaste binding lokaal scheiden, opschoning en intrekkingsherhalingen testen, daarna pas de specifieke cloudpolicy en de gezamenlijke activering/publicatie ter goedkeuring voorleggen.
