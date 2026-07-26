# Technisch verslag Finize v53-code-cleanup

## Gewijzigde onderdelen

- `index.html` laadt alleen `app.js` en `app.css`.
- `src/` bevat de onderhoudbare JavaScriptmodules en CSS-bronnen.
- `scripts/` bevat de reproduceerbare build-, syntax-, CSS- en consolidatiecontroles.
- `tests/` bevat 26 Node-regressies en 19 browsertests.
- `service-worker.js` gebruikt gerichte Finize-cacheopruiming en veilige offline-fallbacks.
- Niet meer geladen updatebestanden en drie historische HTML-kopieën zijn uit Git verwijderd.

## Centrale contracten

- `commitChange` blijft de enige transactionele kern voor financiële statewijzigingen.
- `getTransactionExpenseImpact`, `resolveMonthlyIncome`, `getMonthFinancialResult` en `getCalculationDateForSelectedMonth` zijn via `src/core/calculations.js` vindbaar.
- State-cloning is centraal ondergebracht in `src/core/state.js`.
- Importparser, classificatie, opslag en synchronisatie hebben afzonderlijke modulefacades onder `src/import/`.
- De bestaande `FinizeUpdate4`- en `FinizeUpdate5`-facades blijven compatibel.

## Datamigraties

Er is geen datamigratie uitgevoerd. Schema v9, localStorage-sleutels, IndexedDB-databases, Firestore-paden en importopslag zijn ongewijzigd.

## Uitgevoerde controles

- 26 Node-tests voor financiële logica, migraties, import, undo, historie, UI-structuur en PWA-cachecontracten.
- 19 Playwright-tests voor bootstrap, listenerstabiliteit, modals, injectieveiligheid, offline PWA-start en zes schermbreedtes.
- Visuele snapshots en computed styles op 360, 390, 430, 768, 1024 en 1440 px.
- JavaScript- en service-worker-syntax, CSS-parser, ongedefinieerde tokens, HTML-structuur, reproduceerbare build en `git diff --check`.
- Lokale handmatige controle via `http://localhost:3000/`.

## Bewust behouden en resterende risico's

- Mojibake en de bekende spaardoel-progressiebalkafwijking zijn bewust niet aangepast.
- Publieke Firestore-regels blijven een geaccepteerd privacyrisico; de gebruiker wil geen login.
- De resterende `!important`-declaraties en tabselectors zijn niet mechanisch verwijderd wanneer dat de bevroren weergave zou wijzigen.
- De kernruntime is nu een echte ES-module met domeinmodules eromheen, maar verdere interne opsplitsing van enkele grote functies kan later nog zonder functionele wijziging worden voortgezet.
- Een live Firestore-schrijfprobe is niet uitgevoerd, omdat die expliciete toestemming vereist en cloudpaden/datamodel niet zijn gewijzigd.

## Vormgeving

De mobiele en desktopvormgeving is niet gewijzigd. De visuele regressies blijven binnen de vastgelegde grens van 0,2%.
