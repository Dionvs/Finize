# V118-r8 — ING-bankkoppeling activeren

**Vervolg:** r8 is gepubliceerd en gecontroleerd. Bij de eerste echte toestemmingsaanvraag bleek de provider een ander gedocumenteerd adres te retourneren; zie [r9-correctie](v118-r9-bankautorisatie-20261023.md).

23 oktober 2026. Vervolg op de gecontroleerde backendupdate en actieve TTL-policy. De gebruiker heeft opdracht gegeven om de uitrol en inschakeling te beginnen. Deze release maakt de bestaande P5b-koppeling bereikbaar; alleen de ingestelde gebruiker en het ING-profiel Dion …7899 worden door de backend toegelaten. Een banktoestemming ontstaat pas wanneer de rekeninghouder de autorisatie doorloopt.

## Release-inhoud

- P5b-backend, provideradapter, bronherkomst en rekeningstand/prognose-integratie vastgelegd in de repository. De bankserver blijft dezelfde beperkte runtime- en bouwidentiteiten gebruiken.
- `BANK_API_ENABLED=true`; de backendparameter wordt afzonderlijk gecontroleerd op true. Openen vraagt uitsluitend verbindingsstatus op. Ophalen en autorisatie vereisen een expliciete klik. Financiële verwerking blijft afzonderlijk bij Nakijken.
- Privacyinformatie beschrijft de bevestigde automatische opschoning: tijdelijke pogingen/vergrendelingen vanaf 24 uur na geldigheid, sessiereferenties vanaf zeven dagen na oorspronkelijk toestemmingsverloop en asynchrone verwerking. De permanente binding en financiële historie vallen erbuiten.
- Bestaande PWA-updateprocedure gebruikt versie `118-r8`, met overeenkomende HTML-assets en serviceworkercache. Geen algemene Firestore-regel- of indexdeployment.

## Verificatie vóór publicatie

- Alle 73 reguliere Node-testbestanden geslaagd en de 40 aanvullende P5b-backend/configuratie/providergevallen geslaagd. Syntax, CSS en reproduceerbare appbuild gecontroleerd.
- 93 unieke actuele V118-browsertests geslaagd (92 bestaande gevallen plus de nieuwe controle van de geactiveerde bundel); twee bestaande tests blijven expliciet overgeslagen. De gerichte suites zijn na ontdekte verouderde verwachtingen per betrokken bestand opnieuw uitgevoerd; er is geen enkele integrale foutloze volledige browserrun geclaimd.
- Daarnaast 17 controles op HTML-beveiliging, PWA-cache en offline/reconnect geslaagd. De eerste brede run bevatte ook twaalf geslaagde bootstrap-/maanddashboardcontroles.
- De extra activeringstest gebruikt de echte bundel en onderschept alle netwerkverzoeken: alleen status bij openen, geen ophalen, autorisatie pas na klikken, juiste backendroute/profiel/token en navigatie naar een synthetische toestemmingspagina.
- Mobiele en desktopbeelden van de bankbediening bekeken; de lokale privacytekst in de browser geopend en navigatie gecontroleerd. Mechanische controle op de betrokken UI-/informatiebestanden gaf geen bevindingen.
- Releaseverwachtingen bijgewerkt van r7 naar r8. Enkele tests verwezen nog naar het oude jaaroverzicht, numerieke salarisdaginvoer, een eerdere grafiekhorizon of een vrije datum buiten de geselecteerde maand. Alleen de tests zijn aangepast aan de reeds bestaande productwerking; de dashboard-/liquiditeitsinstellingen zelf zijn niet gewijzigd voor deze correcties.
- Drie andere historische browserfouten zijn op een schone kopie van gepubliceerde commit `d1309e12ccc34c61b405ae050d7de175c52ff11f` met dezelfde verwachtingen gereproduceerd: `desktop-special-tabs` verwacht een vervangen dashboardselector, `import-history-cloud-refresh` vindt de oude knop niet in de gebruikte maandfixture en `v113-csv-processing` probeert een niet beschikbare categorieoptie te kiezen. Deze onopgeloste oude tests zijn niet als geslaagd geteld. De volledige oude browserverzameling is daardoor niet groen; de actuele P5b-controles op goedgekeurde CSV/API-overlap slagen wel.
- Het te publiceren pakket gecontroleerd: geen privésleutelinhoud, echte IBAN, privégebruikers-UID, .env/.secret-bestand, dependencycache of bronarchief opgenomen. Privéconfiguratie en operationele bewijsbestanden blijven buiten Git.

## Na publicatie te bevestigen

De backendactivering is al gecontroleerd: revisie `enablebanking-00004-bac` is ACTIVE, krijgt 100% verkeer en heeft uitsluitend `ENABLE_BANKING_ENABLED` van false naar true gewijzigd. Ontbrekende/ongeldige tokens blijven 401 en een callback zonder geldige state blijft 403. Zonder rekeninghouderstoestemming is er geen banktoegang.

Tijdens de voorcontrole van de bestaande live r7-browser meldt Finize een reeds bestaand rekeningconflict: lokale rekeningwijzigingen zijn niet gezamenlijk bevestigd. De app heeft de lokale state behouden. Dit is geen serverdeploymentfout. Er is niets teruggezet of overschreven; een eerste echte synchronisatie mag pas volgen na beoordeling van de rekeningverschillen.

Controleer de exacte gepushte commit in de GitHub Pages-build, de openbare r8-assets en privacytekst, de actieve backendparameter, de beperkte toegang en de ING-toestemmingsroute. Vraag de rekeninghouder zelf de banktoestemming af te ronden. Start geen eerste synchronisatie zolang niet duidelijk is dat de juiste rekening is gekoppeld en de app de vereiste opslag kan gebruiken.

De cloudfase staat in [clouduitrol](v118-p5b-clouduitrol-20261023.md). Bewijslogboeken, baselinevergelijkingen en herstelconfiguraties staan lokaal buiten de repository onder `C:/Users/dionv/AppData/Local/Finize/p5b-clouduitrol-20261023/`.
