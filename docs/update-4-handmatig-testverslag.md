# Update 4 — handmatig testverslag

Datum: 23 juli 2026

## Uitgevoerd

- Bestaande Update 2- en Update 3-Node-tests.
- Schema-, parser-, classificatie-, profiel-, duplicaat-, splits-, ledger-, verwerkings- en undotests.
- Inline JavaScript-parse, `node --check`, HTML-structuur en `git diff --check`.
- Lokale browsercontrole zonder consolefouten.
- Desktop en mobiele breedtes 430 px en 384 px.
- Importpaneel, bestandselectie, full-screen modal, open Nakijken, ingeklapte Zeker-sectie, scroll en sticky footer.
- IndexedDB-concept na sluiten/herladen en blokkade van een tweede concept.
- PWA-app-shell met `update4.js` en `update4.css`.

## Fixtures

Getest met synthetische ING-fixtures voor Dion, Dara en gezamenlijk plus overlap- en edge-cases. De drie echte geanonimiseerde exports zijn nog niet aangeleverd en staan daarom als laatste externe acceptatiestap open.

## Handmatige herhaalstappen

1. Open `index.html` via een lokale HTTP-server.
2. Kies bij Bank import & uitgaven een ING-CSV.
3. Koppel of maak het exact herkende rekeningprofiel.
4. Controleer Nakijken, splits en bijzondere typen.
5. Sluit en heropen de modal; het concept moet intact blijven.
6. Kies Alles verwerken en controleer transacties, maandtotalen, sparen en voorschotten.
7. Open het importbonnetje, pas een verwerking aan en kies Wijzigingen verwerken.
8. Kies Import ongedaan maken en controleer dat alle financiële gevolgen verdwijnen.
9. Herhaal stap 6 in een afgesloten maand; de maand moet Correctie nodig tonen.
