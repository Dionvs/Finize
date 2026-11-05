# Finize V118-r41: mobiele tabs

Gezamenlijk, Dion, Dara en Spaardoelen volgen de drie aangeleverde afbeeldingen. De bestaande dashboardkleuren en lokale huisillustratie zijn hergebruikt. De nieuwe weergave geldt uitsluitend onder 768 px; het dashboard, Instellingen, de bestaande navigatie en de desktopweergaven blijven behouden.

De overzichtskaart gebruikt dezelfde maandbedragen als voorheen. Vaste lasten tonen bestaande betaalmomenten en gekoppelde betaalstatussen; variabele lasten en transacties gebruiken de bestaande selectors. De compacte spaardoelregels tonen dezelfde saldi, voortgang en maandinleg. Volledige doelbedragen, categoriegegevens, berekeningen, doelbeheer en spaargeschiedenis zijn bereikbaar via bestaande acties of native uitklapbare onderdelen. Inkomen blijft aanklikbaar voor de bestaande bronnen en bediening. De persoonlijke naam en zichtbaarheid volgen het account; gedeelde persoonlijke tabs blijven alleen-lezen.

Er zijn geen wijzigingen aan financiële berekeningen, opslag, imports, schema's of backend. De nieuwe CSS wordt met de bestaande bouwstap in app.css en de inline HTML-shell opgenomen. Release- en cacheversie: `118-r41` / `finize-v118-r41`.

## Back-up

Vóór bewerking zijn bronbestanden en de volledige Git-geschiedenis opgeslagen onder `backups/finize-mobile-tabs-r41-20261105` in de OneDrive-map financiën. `source/` bevat de bronkopie en `finize-history.bundle` de Git-geschiedenis. Het publieke herstelpunt is `backup/v118-r40-before-r41-20261105` op commit `2950e64dddefb71083682e2ddec95172313f18cf`.

De actieve bron is de Google Drive-checkout `Finize-dashboard-lokaal`. Het oudere lokale werk in `Finize-live-repo` is ongemoeid gelaten.

## Controle

- 61 gerichte Node-tests: persoonlijke maandbedragen, maandafsluiting/veilig sparen, spaardoelboekingen, dashboardcontract en serviceworker.
- 32 gerichte browsercontroles: nieuwe tabs op 320/390/430 px, Dion en Dara, negatieve/lege situaties, gelijkblijvende financiële state bij bekijken, maandwissel, uitleg, bestaande bewerkacties, importmenu, verwerking pas na bevestiging, accountrechten en desktopgrenzen.
- De r40→r41-upgrade, offline herladen en terugrollen bewaren financiële state en een fictieve bankimportbron in IndexedDB.
- De geopende schermen en screenshots zijn visueel gecontroleerd. De aangepaste tabs zijn op 768 en 1440 px ook met screenshots van vóór de wijziging vergeleken: identiek. Dashboardbeelden waren eveneens identiek.
- Syntax, CSS, reproduceerbare bouw en `git diff --check` slagen. De Impeccable-detector gaf geen bevindingen. De bestaande CSS-melding over `--line` blijft bestaan.
- Browsercontroles gebruiken fictieve gegevens en blokkeren cloudverkeer. Er is geen test op een fysieke telefoon uitgevoerd.

De volledige bestaande testsuite is niet groen: vijf verwachtingen in `dashboard-selected-month.test.cjs` falen exact hetzelfde in de onaangepaste r40-back-up. Daarnaast bevatten oudere accountnavigatietests drie verouderde dashboardverwachtingen uit de periode vóór de dashboardvernieuwing. Deze bestaande afwijkingen zijn buiten deze visuele wijziging gelaten; de relevante controles hierboven slagen.

## Publicatiecontrole

Publicatie verloopt via `main` en GitHub Pages. Controleer na de succesvolle Pages-build HTTP 200, de r41-shell, SHA-256 van de publieke HTML/CSS/JS/serviceworker en de nieuwe mobiele tabs met fictieve browserdata. Het herstelpunt blijft beschikbaar voor terugrollen.
