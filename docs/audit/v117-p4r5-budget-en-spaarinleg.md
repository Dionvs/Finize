# V117 p4r5 — budgetdetails en interne spaarinleg

Een vaste last met dezelfde categorienaam als een variabel budget kon in de budgetdetaillijst verschijnen, hoewel het budgetgebruik die last niet meetelde. De budgetdialoog vraagt nu uitsluitend variabele details op. De vaste-lastrealisatie en oorspronkelijke banktransactie blijven bestaan.

Bij een ontvangen interne overboeking of extra bijdrage kan de gebruiker een bestaand spaardoel en inlegbedrag aanwijzen. De daadwerkelijke spaarboeking krijgt een expliciete koppeling aan die goedgekeurde ontvangst en een gekoppeld bedrag. Alleen de spaarboeking verhoogt het spaardoel. De ontvangst blijft buiten inkomen en zakgeld; het gekoppelde deel van de spaarboeking vermindert de maandruimte niet nogmaals.

De koppeling vereist dezelfde bankmaand, budgeteigenaar en een bestaand spaardoel. Bedragen worden in eurocenten gecontroleerd. Dubbele of te hoge toerekening geeft geen maandcorrectie en blokkeert opslaan. Wijzigen of verwijderen van een gebruikte ontvangst vereist eerst aanpassing van de spaarboeking. Ongekoppeld sparen houdt het bestaande gedrag. Koppelingen worden niet via bulkherkenning naar andere bronnen gekopieerd. Oorspronkelijke CSV-data blijven ongewijzigd.

De bestaande importeditor, kandidaatvalidatie, opslag en synchronisatie worden hergebruikt. Periode-afhankelijkheden bevatten de expliciete bronkoppeling. Productie-recordmigratie blijft uitgeschakeld. Een automatische koppeling op basis van uitsluitend gelijk bedrag is niet toegevoegd.

## Gebruik

1. Kies bij de ontvangen interne overboeking **Inleg bestaand geld voor spaardoel**, selecteer het doel en controleer **Inlegbedrag**. Sla deze verwerking op.
2. Kies bij de daadwerkelijke spaarboeking hetzelfde doel en bij **Betaald uit interne inleg** de goedgekeurde ontvangst. Controleer **Gekoppeld bedrag** en sla op.
3. Controleer de maandruimte en het spaardoelsaldo. De koppeling blijft na herladen bewaard.

Een ontvangst zonder verdere spaarboeking verhoogt het spaardoelsaldo niet. Koppelingen tussen verschillende maanden en gesplitste ontvangsten zijn nog niet ondersteund; validatie blokkeert die gevallen.

## Vrijgavecontrole

- Volledige Node-reeks: 61 testbestanden, 631 door de Node-test-runner gerapporteerde gevallen, geslaagd.
- JavaScript-syntax, CSS-parser, gegenereerde bestanden en whitespacecontrole geslaagd.
- Nieuwe browserroute op 390 en 1440 px, inclusief bewaren/herladen, geslaagd.
- Regressie voor CSV, transacties en service-worker/cache: 38 browsergevallen geslaagd. Vier aanvullende record-synchronisatiegevallen startten aanvankelijk niet door een uitgeschakelde emulator; alle vier slaagden daarna in een nieuwe geïsoleerde demo zonder schaalfixtures. Samen met elf controles voor sparen, terugbetalingen en prognoses zijn 53 unieke browsergevallen geslaagd.
- De eerdere schaalmetingen zijn niet herhaald. Geen prestatieoptimalisaties, productie-datamigratie of wijzigingen aan Firestore-regels.

Cache en assetversie: `117-p4r5`. Publicatie is door de gebruiker toegestaan na geslaagde controles. Privé-administratiekopieën en gedetailleerde logs blijven buiten Git.
