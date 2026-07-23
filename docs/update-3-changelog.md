# Finize Update 3 — changelog

Datum: 23 juli 2026  
Branch: `agent/update3-maandadministratie`  
Startpunt: `7954d93`

## Nieuw

- Schema v4 met een idempotente migratie vanuit schema v1, v2 en v3.
- Terugkerende vaste lasten per scenario met begin- en einddatum, actief-status, rekening, financiële bestemming, frequentie, bedragshistorie en maandoverride.
- Terugkerende inkomstenbronnen voor loon, toeslagen, vergoedingen en overige inkomsten.
- Verwacht versus werkelijk voor inkomsten, vaste lasten en uitgaven.
- Budgetbewaking op `financialFor`, inclusief `Geen budget ingesteld`, `Overig`, resterend en overschreden.
- Eenmalige openingssaldi en administratieve rekeningcontrole.
- Algemene reserve per eigenaar op basis van het netto budgetverschil bij afsluiting.
- Voorschotten en onderlinge schulden wanneer rekening en financiële bestemming verschillen.
- Maandafsluiting met Controle, Rekeningstanden, Overboekingen en Bevestigen.
- Heropenen met behoud van eerdere snapshots en verschilvoorstellen bij opnieuw afsluiten.
- Transactiereviewwachtrij in dezelfde lokale en Firestore-state als de rest van Finize.
- Herkenningsregels voor categorie, financiële bestemming en occurrence-koppelingen.
- Compacte Update 3-sectie in het bestaande dashboard en mobiele fullscreen-modals.

## Behouden

- De vijf bestaande tabs, navigatie en Finize-stijl.
- Update 2 als enige bron voor zakgeld, spaarruimte, spaardoelverdeling en het verwerken van spaardoelinleg.
- Bestaande transacties migreren met de oude eigenaar als zowel rekening als financiële bestemming. De migratie maakt daardoor geen kunstmatige schulden.
- Interne overboekingen tellen niet als inkomen of uitgave.

## PWA

- Cache verhoogd naar `finize-v14-maandadministratie`.
- Navigaties gebruiken network-first met een offline terugval naar de gecachete `index.html`.
