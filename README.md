# Finize

Finize is een persoonlijke budgetplanner voor gezamenlijke uitgaven, persoonlijke balans, transacties en spaardoelen.

Live app: https://dionvs.github.io/Finize/

## PWA installeren

- Android Chrome: open de app, gebruik het browsermenu en kies **Toevoegen aan startscherm**.
- iPhone Safari: open de app, tik op delen en kies **Zet op beginscherm**.

## Opslag

Gegevens worden lokaal opgeslagen in de browser. Als Firebase/Firestore is verbonden, kan de app live synchroniseren tussen apparaten.

## Bestanden

- `index.html` is de actieve GitHub Pages app.
- `index-OLD.html` is een back-up van de vorige versie.
- `manifest.json` en `service-worker.js` maken de app PWA-ready.
- `firestore.rules` bevat de gepubliceerde toegangsregels voor Finize en zijn importchunks.
- `icons/` bevat de app-iconen.

## Firestore-regels publiceren

Na het vervangen van `firestore.rules` moeten de regels eenmalig naar Firebase worden gepubliceerd:

```bash
firebase deploy --only firestore:rules
```

De regels geven Finize toegang tot het hoofddocument en de aparte import- en chunkdocumenten die nodig zijn om CSV-concepten tussen apparaten te openen.
## Importconcepten

- Bewerkingen in een CSV-concept worden automatisch lokaal opgeslagen en klaargezet voor cloudsynchronisatie.
- Met **Concept opslaan** kan de actuele versie expliciet naar IndexedDB en Firestore worden geschreven.
- De importeditor gebruikt een eigen scrollgebied, zodat lange transactielijsten op mobiel en desktop bewerkbaar blijven.



## Versie 32

De bankimportmodal gebruikt één betrouwbaar scrollvlak. Kop en actiebalk blijven sticky zichtbaar, terwijl de volledige importinhoud ertussen kan worden gescrold.


## Release v33 — bankimportworkflow

- Full-screen import behoudt sticky kop en actiebalk met één betrouwbaar scrollvlak.
- Bulk aanpassen voor transacties in Nakijken, ongecategoriseerd of de volledige import.
- Goedkeuren vervangt de losse statuskeuze.
- Bij vergelijkbare transacties verschijnt een selectievenster met individueel uitvinkbare matches.
- Transactietypen zijn gegroepeerd en opties worden contextafhankelijk getoond.
- Interne overboekingen ondersteunen expliciete bron- en doelrekening, inclusief geld van spaar- naar betaalrekening.


## Update v37

- Matchbevestigingen sluiten direct en blokkeren niet langer op opslag of cloudsync.
- Wijzigingen worden direct in de importweergave toegepast.
- IndexedDB-opslag en Firestore-synchronisatie lopen daarna op de achtergrond.
- Bij een lokale opslagfout wordt de wijziging teruggedraaid en gemeld.

## Versie 37 — matchdialoog stabiliteit

- Herstelt vastlopen op `Bezig…` wanneer optionele verwerkingsvelden ontbreken.
- Lege velden worden veilig verwijderd in plaats van via JSON te worden gekloond.
- De matchdialoog sluit en wordt eerst door de browser weggepaint voordat de volledige importlijst opnieuw wordt opgebouwd.
- De volledige matchactie heeft een foutgrens die wijzigingen terugdraait en een zichtbare melding toont bij een onverwachte fout.


## Update v38

- Importbewerkingen worden 350 ms samengevoegd voordat IndexedDB wordt geschreven.
- Per importconcept is maximaal één lokale write tegelijk actief.
- Cloudsync gebruikt één centrale lock; overlappende uploads worden samengevoegd.
- Een contextwijziging bouwt alleen de gewijzigde transactiekaart opnieuw op.
- De knop Concept opslaan forceert direct lokale opslag en één cloudsync.
- Bij Sluiten worden resterende lokale wijzigingen eerst geflusht; cloudsync vervolgt op de achtergrond.
- Opslagstatus in de footer toont lokaal opslaan, achtergrondcloudsync en fouten.


## Update v39

- Validatiefouten bij het verwerken van een bankimport worden in een klikbaar foutpaneel getoond.
- **Open transactie** scrolt naar de juiste kaart, opent **Meer opties** en markeert de relevante splitsregels.
- Splitfouten leggen nu duidelijk uit dat de som van de splits gelijk moet zijn aan het transactiebedrag.


## Versie 40 — dashboard en transactielogica

- Bottomnavigation gebruikt stabiele SVG-iconen in plaats van zware ingesloten PNG-bestanden.
- Het gezamenlijke budgetoverzicht scrollt intern wanneer niet alle categorieën passen.
- Budgetcategorieën openen een gefilterde lijst met de bijbehorende transacties.
- Naar/van spaarrekening en interne overboekingen tellen niet meer als budgetuitgave of inkomen.
- Extra inkomsten en teruggaven worden zichtbaar bij totaal inkomen, maar wijzigen de gezamenlijke verdelingsratio niet automatisch.
- Lege, verborgen splitsregels blokkeren de verwerking niet meer.

## Versie 41 — inkomen vanaf maand

- Standaardsalaris en standaardteruggave kunnen vanaf de geselecteerde maand worden ingesteld.
- De gekozen waarden gelden voor die maand en toekomstige maanden, totdat later een nieuwe standaard wordt ingesteld.
- Optioneel kan een wijziging alleen voor de geselecteerde maand gelden.
- CSV-inkomsten wijzigen de standaard niet en worden gekoppeld aan de rekeninghouder van het gebruikte rekeningprofiel.
- Standaardteruggaven tellen mee in de verdeelbasis; incidentele CSV-inkomsten en teruggaven niet.


## v42 – correctie inkomenshistorie

- Voorkomt dat oudere Update-3-functies de nieuwe inkomenshistorie overschrijven.
- Migreert oude maandwaarden nog maar één keer naar maandafwijkingen.
- Een nieuwe standaard vanaf een maand vervangt oude toekomstige overrides voor die persoon.
- Dashboard, persoonlijke tabbladen en verdeelsleutel gebruiken dezelfde inkomensbron.


## v44 – sparen uit uitgaven en maandinleg spaardoelen

- Naar/van spaarrekening, interne overboekingen en spaardoeltransacties worden niet meer getoond in de uitgavenlijsten.
- Ook oudere transacties met afwijkende schrijfwijzen worden als spaar- of interne overboeking herkend.
- Spaardoelen tonen primair **Inleg deze maand**.
- De uitsplitsing vaste inleg en naar rato staat in het doelvenster na het openen van een doel.


## Update v44
- Spaardoelen gebruiken opnieuw de bestaande compacte kaartindeling; alleen de tekst toont nu de totale inleg deze maand.
- Vaste lasten worden niet meer dubbel getoond of meegeteld in de transactielijsten.
- Variabele budgetcategorieën zijn klikbaar voor Gezamenlijk, Dion en Dara en openen de bijbehorende transacties.

## v44 spaardoelenpijl
- Gebouwd rechtstreeks op v44.
- Alleen het uitvouwpijltje van subdoelen is rechtsboven op de spaardoelenkaart geplaatst.
- Het pijltje gebruikt dezelfde ronde chevronstijl als de overige accordions.
- De kaartinhoud, berekeningen en overige weergaven zijn ongewijzigd.


## v44 spaardoelenpijl – positiecorrectie
- De subdoelchevron is verkleind.
- De chevron staat rechtsboven direct boven het voortgangspercentage.
- Alleen de rechterkolom reserveert ruimte; de overige kaartinhoud blijft ongewijzigd.


## v48
- Spaardoeltekst en voortgangsbalken gebruiken een uniforme breedte.
- Variabele budgetten worden via een losse bewerkkopie atomair opgeslagen voor de geselecteerde maand.


## v49

- Alleen de persoonlijke spaarpotberekening aangepast.
- Formule: zakgeld min persoonlijke vaste lasten min persoonlijk variabel budget.
- Werkelijke variabele uitgaven blijven zichtbaar als realisatie, maar bepalen de geplande spaarpot niet.

## v50 — consistente Finize-iconen

- Eén centrale professionele SVG-iconenset voor desktop en mobiel.
- Dezelfde betekenis gebruikt overal exact hetzelfde icoon.
- Sidebar en mobiele bottomnavigation delen dezelfde iconenbron.
- Dashboardkaarten, budgetcategorieën, vaste lasten en spaardoelen gebruiken dezelfde lijnstijl.
- Toevoegen, bewerken, verwijderen, importeren, exporteren, opslaan en synchroniseren hebben vaste actie-iconen.
- Unicode- en emoji-achtige categorie-iconen zijn vervangen door schaalbare SVG-lijniconen.
- Financiële berekeningen, state, Firestore, importlogica en eventhandlers zijn niet functioneel gewijzigd.


## v51 — uniforme spaardoelprogressie

- Gebouwd op de aangeleverde v50-iconenversie.
- Alle spaardoelen gebruiken op mobiel dezelfde middenkolom voor bedragstekst en voortgangsbalk.
- Spaardoelen met subdoelen en gewone spaardoelen hebben exact dezelfde beschikbare breedte.
- Nieuwe spaardoelen nemen automatisch dezelfde afmetingen over.
- Iconen, berekeningen, opslag en overige weergaven zijn niet gewijzigd.


## v52 — vaste spaardoel-progressiestrook

- Bedragstekst en progressiebalk gebruiken één vaste strook over de icoon- en inhoudskolom.
- Alle doelen hebben daardoor exact dezelfde balkbreedte, ook doelen met subdoelen.
- Nieuwe doelen gebruiken automatisch dezelfde afmetingen.
- De v50-iconenset en overige appwerking zijn ongewijzigd.
