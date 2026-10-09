# Finize v116 — cache-isolatie bij een release-update

Deze aanvulling behoudt de concrete CSV-foutmeldingen uit v115. Zie ook `v115-opslagmeldingen.md` voor de opslag- en rollbackwijzigingen en de nog niet vastgestelde oorzaak van de oorspronkelijke gebruikersmelding.

## A. Aangetroffen probleem

De extra updatecontrole van v114 naar de nieuwe release liet zien dat een oude cache na activatie opnieuw kan verschijnen door een nog lopende oude paginalading. De serviceworker gebruikte `caches.match()` zonder cachenaam. Een oude HTML- of assetkopie kon daardoor worden gekozen bij offline gebruik wanneer de oude cache eerder in de zoekvolgorde stond.

## B. Wijzigingen

De serviceworker zoekt offline HTML en assets uitsluitend in zijn eigen `CACHE_NAME`. Het overnemen van pagina's via `clients.claim()` wordt nu meegenomen in de activatiebelofte, na verwijdering van oude caches. HTML, serviceworker en versietests gebruiken `finize-v116-cache-isolatie`.

## C. Financiële correctheid

De cachewijziging raakt geen financiële verwerking. Een updatecontrole met de echte v114-bestanden en de nieuwe bestanden via een geïsoleerde HTTP-server vergelijkt transacties, planning, afgesloten snapshots, localStorage en IndexedDB vóór en na de update en offline herladen. De financiële referentie blijft €300 aan uitgaven.

## D. Compatibiliteit

Geen datamigratie, financiële opslagwijziging of wijziging aan Firebase-regels. Een late oude cache kan fysiek aanwezig blijven tot een volgende workeractivatie; deze wordt door de nieuwe worker nooit gebruikt. Bestaande cacheverwijdering bij activatie en caches van andere apps blijven beschermd.

## E. Tests

Twee nieuwe Node-regressies controleren de verplichte cachenaam bij offline HTML/assets en dat activatie op zowel verwijderen als overnemen wacht. Een nieuwe browserregressie plaatst bewust een oude HTML-cache vóór de actuele cache en controleert offline openen en exact behoud van de opgeslagen state.

De gerichte browser- en HTTP-upgradecontroles slagen. De eerste nieuwe browsercontrole gebruikte nog niet opgeslagen standaardgegevens; de test slaat nu eerst een normale wijziging op voordat hij gegevensbehoud controleert. Er zijn geen financiële assertions versoepeld. De upgradecontrole registreert afzonderlijk dat activatie oude caches verwijdert en dat een later teruggekeerde oude cache niet meer gelezen wordt.

De volledige `pnpm test` slaagt met exitcode 0: 52 Node-testbestanden, 554 geregistreerde Node-testcases plus bestaande scriptasserties, en alle 235 browsertests. Productiebuild, syntax-, CSS-, generated-runtimecontrole en `git diff --check` slagen. De bekende CSS-waarschuwing over `--line` blijft ongewijzigd. De tien vooraf bestaande lokale testbestanden zijn byte voor byte behouden.

## F. Grenzen

De oorspronkelijke transactiefout in de werkelijke huishoudgegevens is niet gereproduceerd. De concrete meldingen uit v115 blijven daarvoor beschikbaar. De updatecontrole gebruikt geïsoleerde gegevens; er zijn geen productiegegevens gewijzigd. Het tijdelijk blijven bestaan van een ongebruikte oude cache is geen financieel effect en heeft geen invloed op de gekozen offline versie.

## G. Release

De release is technisch getest zonder harde blokkades en wordt gepubliceerd volgens de expliciete toestemming. Het uiteindelijke Pages- en livebewijs komt in `v116-publicatiebewijs.json`; ruwe logs en controles staan in `backups/v116-cache-isolatie/`.
