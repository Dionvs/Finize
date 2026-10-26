# V118-r16 — actuele prognosebasis en persoonlijk maandbedrag

Basis: V118-r15, `bfd406ebe2bd605866aa04429873852a19db7057`. Afzonderlijke herstelbranch: `codex/personal-month-savings-forecast-20261026`.

## Diagnose en afbakening

Twee fouten zijn synthetisch gereproduceerd: historische salarisplanning kon opnieuw doorwerken in de toekomstige grafiek, terwijl het actuele P1-saldo de geboekte ontvangst al bevatte. Daarnaast werd een resterend maandbudget over de gekozen grafiekperiode verdeeld. Daardoor kon dezelfde toekomstige dag per filter een ander saldo krijgen. Een uitsluitend lezende controle van de beschikbare cloudstaat reproduceerde een verschil tussen kaart en grafiek, zonder financiële gegevens op te slaan. De precieze mobiele momentopname is daarmee niet achteraf bewezen.

Voorbeeld één: actuele kas 2.000, historische geplande ontvangst 1.000 en toekomstige last 100. De kaart voorspelde 1.900, de oude grafiek 2.900. Voorbeeld twee: novemberbudget 100 en inkomen op 5 november; exclusief inkomen versus inclusief inkomen verdeelde het budget over vier respectievelijk vijf dagen. Beide tests falen op de oude code.

De vijf dashboardfilters krijgen expliciet `currentCashBasis:true`. Zij projecteren de toekomst vanaf dezelfde actuele P1-opening als de vaste KPI-periode. Historische punten blijven afzonderlijk bewaard. Directe legacy-aanroepen zonder deze vlag behouden hun reconstructiecontract. Toekomstige budgetspreiding gebruikt de resterende kalendermaand; de historische reconstructie blijft ongewijzigd. Inkomensdatum blijft exclusief voor KPI's en inclusief voor het salarisfilter.

Bij zichtbare historische punten kan de historische modelstand afwijken van het actuele saldo. Een uitsluitend voor de grafiek gemaakt `balance-basis`-object verklaart deze aansluiting eenmaal op vandaag. De dagdetails noemen dit **Actuele saldobasis — alleen in deze grafiek**. Het is geen bankboeking, waarneming, financieel event, checkpoint, ledger of opgeslagen record. Beginsaldo plus mutaties blijft het ongewijzigde eindsaldo. Geen aansluiting bij onbekende basis, delta nul of afwezige zichtbare historie. De bestaande kwaliteitsstatus en controles op dezelfde financiële snapshot blijven behouden.

## Persoonlijk maandbedrag en spaarplanning

Eén helper in exacte centen berekent voor mobiel en desktop: zichtbaar persoonlijk totaalinkomen inclusief teruggaven minus persoonlijke vaste lasten minus werkelijk gebruikt variabel budget. Geen afzonderlijke tweede optelling van teruggaven. De huishoudengine en zakgeldverdeling veranderen niet.

De bestaande spaarmodal toont het maandbedrag en de formule. **Gebruik Over deze maand** kopieert na een expliciete klik eenmalig `max(0, maandbedrag)` naar de bestaande numerieke maandinstelling. Het bestaande handmatige bedrag wordt vooraf ingevuld en blijft bewerkbaar; annuleren wijzigt niets. De uitleg vermeldt dat latere transacties de kopie niet automatisch aanpassen. Geen dynamische modus, gegevensmigratie of automatische spaarboeking.

## Review en controle

ChatGPT beoordeelde eerst de diagnose, daarna de afgebakende opt-in en grafiekaansluiting, vervolgens de implementatie. Voorwaardelijk akkoord voor de gecombineerde eindcontrole, met nadruk op dagrekenidentiteit, onbekende/voorlopige kwaliteit, bronbehoud, annuleren, opslagfout en vertraagde bevestiging. Dit is een review van gedeelde codebevindingen en testbewijs; geen claim van een zelfstandig uitgevoerde volledige diff door ChatGPT.

- Volledige Node-run: 79 bestanden geslaagd, inclusief zeven nieuwe prognosegevallen en vijf maand-/spaargevallen met bestaande chunk- en recordcloudroundtrip.
- Twaalf nieuwe browsergevallen geslaagd: alle vijf filters, identieke dagbedragen, kalenderbudget, 320/390/430/1440 px, beide personen, handmatige invoer, nul/tekort, annuleren, herladen, latere wijziging, echte IndexedDB-opslagfout en vertraagde opslagbevestiging.
- Drie bestaande F1/F2-browsergevallen controleerden de nieuwe zichtbare formule en behoud van financiële gegevens. Hun fixture kreeg een geldig synthetisch rekeningtype/IBAN; eerdere voorbereidende commits werden anders afgewezen. De doelassertie gebruikt de bestaande actuele dashboardcomponent.
- Syntax, CSS en byte-reproduceerbare build gecontroleerd. Alleen de bestaande CSS-tokenmelding `--line`; geen CSS gewijzigd.

Een aanvullend oud desktopscenario verwacht `u5-planning-realisation`, een eerder vervangen dashboardstructuur. Deze bevinding wordt afzonderlijk tegen r15 gecontroleerd; geen productcode aangepast om een verouderde selector te laten slagen. De nieuwe tests dekken de gewijzigde persoonlijke functie ook op desktop.

De gecombineerde browser-/PWA-eindcontrole en publicatiecontrole worden hieronder aangevuld na afronding. Geen echte banksynchronisatie, bankautorisatie, backendwijziging of productiegegevensmutatie uitgevoerd.

## Definitieve eindcontrole vóór publicatie

- De gecombineerde run op de r16-assets: **96/96 browsergevallen geslaagd**, inclusief bankherstart met beide financiële contexten, importlevenscyclus, IndexedDB, gesimuleerd cloudtransport, twee apparaten, importconflicten, bestaande goedkeuringen, inkomensprognose, 320/390/430 px en echte r15→r16-PWA-upgrade/offline/terugrol.
- Aanvullende F1/F2-herhaling: **3/3 geslaagd**, inclusief 1440 px en identieke persoonlijke maandbedragen.
- Volledige definitieve Node-run: **79/79 bestanden geslaagd**. De zeven nieuwe prognosegevallen en vijf persoonlijke maand-/spaargevallen maken daar deel van uit; geen optelling als onafhankelijke bewijzen.
- De verouderde desktopselector is op ongewijzigde r15-assets (`bfd406e`) gereproduceerd: nul oude verdeelkaarten, één bestaand P3-dashboard. Dit scenario test een vervangen structuur; het is niet aangepast of als geslaagd gepresenteerd. De oorspronkelijke brede poging is daarom niet als foutloos geclaimd. De gerichte persoonlijke desktopcontroles slagen.
- Gegenereerde build bytegelijk, syntax en CSS geldig, diff zonder whitespacefouten. Geen gewijzigde CSS, engine, bankadapter, importherstel, backend, rules of bronschema.
- Mobiele resultaten daadwerkelijk geopend en gecontroleerd. Publicatie vereist het definitieve technische akkoord; daarna pas branchcommits, Pages en openbare controles.

ChatGPT gaf definitief technisch GO voor gecontroleerde publicatie op basis van het gedeelde verslag (geen onafhankelijk uitgevoerde volledige code-/testrun). Voorwaarden: alleen beoordeelde diff, afzonderlijke sourcecommits, origin/main exact op uitgangscommit, fast-forward zonder force, bestaande Pages-configuratie, zeven identieke publieke SHA-256's, geïsoleerde publieke functieproeven en uitsluitend lezende vergelijking van de vastgelegde manifest-/header-/bindinghashes. Bij afwijking stoppen, geen automatische gegevensreparatie.
