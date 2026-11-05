# Finize V118-r38: dashboard

Het dashboard volgt de aangeleverde olijfgroene mobiele compositie. De bestaande app-header en navigatie blijven staan. De kaart Veilig te sparen, saldo-ontwikkeling, komende betalingen, zakgeld en favoriete spaardoelen gebruiken de bestaande financiële berekeningen en gegevens. Budgetten en Jaaroverzicht zijn van het dashboard verwijderd; de andere tabbladen en hun berekeningen zijn niet aangepast.

De vijf bestaande prognoseperioden staan in een keuzelijst direct boven de grafiek. Een eigen einddatum, dagdetails, contextwissel, waarschuwingen bij onzekere of ontbrekende gegevens en de uitleg bij bedragen blijven beschikbaar. Op brede schermen blijft het dashboard maximaal 480 px breed.

De release heeft cacheversie `finize-v118-r38`. De huisillustratie staat als lokaal bestand in de optionele app-cache. De ingebouwde HTML-shell en losse CSS/JS-bestanden zijn opnieuw uit dezelfde bron gebouwd.

## Controle

- `node scripts/build.mjs --check`
- `node scripts/check-syntax.mjs`
- `node scripts/check-css.mjs`
- `node --test tests/v118-p3-dashboard.test.cjs tests/service-worker-upgrade.test.cjs`
- Playwright: dashboard op 320, 390, 430, 768, 1280 en 1440 px; berekende bedragen, periodekeuze, dagdetails, contextwissel, betalingen, spaardoelen, navigatie en een positief spaarbedrag.
- Playwright: overgang van r37 naar r38, offline herladen, terugrollen en behoud van financiële state en bankimportbron.

Alle browsergegevens voor deze controle zijn fictief. De back-up van de twee lokale checkouts en Git-geschiedenis staat buiten de repository onder `backups/finize-dashboard-release-20261105` in de OneDrive-map financiën. Het herstelpunt voor de publieke versie is de Git-tag `backup/v118-r37-before-r38-20261105`.
