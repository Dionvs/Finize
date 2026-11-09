# Pakket 2 — bevinding 04: gemengde inkomsten van dezelfde tegenrekening

**Status: technische oorzaak bewezen; gewenste herkenningsafspraak vereist een keuze. Geen applicatiecorrectie uitgevoerd.** Deze bevinding is niet zonder meer een financiële rekenbug of uitsluitend een foutieve test.

## Oorspronkelijke proef

De bestaande emulator-browsertest `P4 salary person proposal, explicit correction, offline restart and second client preserve cents` keurt fictieve ontvangsten expliciet goed:

- Werkgever A: salaris €2530 voor Dion, vakantiegeld €100 en bonus €50; alle drie vanaf `NL10EMPLOYERA`.
- Werkgever B: salaris €3200 voor Dara vanaf `NL20EMPLOYERB`.

De reeds goedgekeurde bedragen en salarisvervanging slagen: werkelijk en geprognosticeerd inkomen €5880, salarisplanning Dion €2500. Er worden geen nieuwe transacties automatisch goedgekeurd.

Een latere fictieve import bevat `Salaris werkgever A september`, €2530, vanaf dezelfde tegenrekening. De test verwacht een salarisvoorstel met Dion als persoon. Werkelijk verschijnt een onderbouwd voorstel als **overige inkomsten**, zonder salaris-persoonsveld; de regel staat nog ter beoordeling.

## Technische oorzaak

`src/import/runtime.js`:

- `learnedRecognitionRules` leert ook het inkomenstype uit een expliciete goedkeuring.
- `rememberRecognitionRules` vervangt een bestaande regel met dezelfde tegenrekening en rekeningcontext. Het inkomenstype is geen onderscheidend onderdeel van die vervangingssleutel.
- De laatste bonusgoedkeuring vervangt daardoor de eerdere salarisregel van werkgever A door `overige-inkomsten`.
- De volgende salarisomschrijving krijgt het voorstel van die tegenrekeningregel.

Dit volgt het huidige leermechanisme, maar botst met de oudere testverwachting dat dezelfde werkgever ondanks verschillende betaalsoorten opnieuw een salaris-persoonsvoorstel krijgt.

## Gerichte tegenproef

Alleen in een tijdelijke testkopie kregen vakantiegeld en bonus elk een andere fictieve tegenrekening. Bedragen en salaris-/correctieassertions bleven gelijk. Het historische voorstel werd dan **salaris met Dion**, zoals de oorspronkelijke assertion verwacht. De oorspronkelijke gemengde dataset is daarna hersteld.

Deze tegenproef is geen volledig geslaagde browsertest: zij passeert de betreffende salaris-/persoonscontroles maar stopt later op een oude duplicatenoverzichtselector. Dat latere testbedieningsprobleem staat los van de aangetoonde herkenningsbotsing.

## Keuze voor vervolg

1. **Bestaand herkenningsgedrag behouden.** De gemengde-betalingenproef blijft als verklaarde beperking geregistreerd; haar salarisverwachting wordt niet stilzwijgend verwijderd om groen te krijgen. Pakket 2 kan met deze afzonderlijk gerapporteerde beperking verder worden onderzocht.
2. **Een nieuwe herkenningsafspraak onderzoeken.** Bijvoorbeeld bij meerdere aantoonbare inkomenstypen vanaf dezelfde tegenrekening een onzeker/conflicterend voorstel tonen, in plaats van stellig het laatst geleerde type te kiezen. De precieze prioriteit van omschrijving, tegenrekening en persoonsbewijs moet dan vooraf worden vastgesteld. Dit is een functionele uitbreiding buiten de eerder goedgekeurde balkcorrectie.

Bij optie 2 blijven expliciete goedkeuring, brongegevens, salarisvervanging, historische maanden en bestaande financiële assertions verplicht. Er is geen datamigratie of productiewijziging voorgesteld of uitgevoerd.

## Bewijs en grenzen

`pakket2-bevinding04-bewijs.json` bevat beide werkelijke synthetische voorstellen en de actieve regeltypen. De ruwe logs staan onder `.cache/pakket2/salary-proposal-probe.*` en `salary-distinct-control.*`. Er is geen conclusie over echte banktransacties getrokken en geen productiegegeven geraadpleegd.

## Besluit gebruiker

De gebruiker kiest: bestaand gedrag behouden, beperking rapporteren en pakket 2 vervolgen. De gemengde testdataset en haar oorspronkelijke salarisverwachting blijven behouden; de mislukking wordt verklaard gerapporteerd. Er volgt geen functionele herkenningscorrectie in pakket 2.
