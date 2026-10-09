# Finize v115 — concrete foutmeldingen bij CSV-goedkeuring

## A. Aangetroffen probleem

De melding op de screenshot komt uit `commitImportCommandUnlocked()` in `src/import/runtime.js`. `commitChange()` in `src/core/runtime.js` ving de onderliggende fout af en gaf uitsluitend `false` terug. `DataAdapter.save()` ving opslagfouten eveneens af. Daardoor verdwenen zowel financiële validatiemeldingen als browseropslagfouten achter de algemene tekst “Financiële commit is afgebroken”.

De specifieke oorzaak in het huishouden van de gebruiker is met de screenshot niet vast te stellen. Een geïsoleerde ING-betaling van 26 september 2026 van €189,56 kan in oktober wel worden verwerkt. Dat bewijst geen herstel van de oorspronkelijke, gegevensafhankelijke blokkade.

## B. Uitgevoerde wijzigingen

- `commitChange()` ondersteunt optioneel `throwOnError`. De fout wordt pas doorgegeven nadat de oorspronkelijke toestand is hersteld. Bestaande aanroepers blijven hun booleanresultaat ontvangen.
- De centrale `DataAdapter.save()` geeft desgevraagd de opslagoorzaak door en accepteert een ontbrekende actieve opslagcontext niet meer als succesvolle opslag.
- De bestaande atomische importcommit vraagt deze concrete fout op. Het bestaande journal en de importdetails worden bij een fout teruggedraaid.
- `src/core/mutation-errors.mjs` vertaalt volle of geblokkeerde browseropslag naar Nederlandse meldingen met vervolgstappen. Financiële validatiemeldingen blijven behouden.
- De goedkeuringsmelding vermeldt dat de bestaande verwerking behouden blijft en dat opnieuw proberen mogelijk is.
- Cache, asset-URL's en bijbehorende testverwachtingen gebruiken `finize-v115-opslagmeldingen`. De runtime is vanuit de bronmodules opgebouwd.

## C. Financiële correctheid

Er zijn geen financiële regels versoepeld. Bij de drie gesimuleerde opslagfouten zijn zowel de volledige financiële state als het opgeslagen importrecord ongewijzigd. Opnieuw opslaan na herstel vervangt de categorie eenmaal, met behoud van één oorspronkelijke bankbeweging. Een afzonderlijke test controleert de echte spaarsaldovalidatie en rollback van `commitChange()`.

## D. Compatibiliteit

Geen schemamigratie of wijziging aan Firestore-regels. Geen productiegegevens aangepast. Bestaande opslag-, projectie- en importjournalroutes blijven in gebruik. De eerdere lokale wijzigingen buiten deze reparatie blijven behouden.

## E. Verificatie

De vijf nieuwe browserregressies slagen: volle opslag, geblokkeerde opslag, behoud van een concrete foutoorzaak, ING-verwerking voor september en centrale spaarsaldovalidatie met rollback. De eerste gerichte testrun liep vast op een ingeklapte sectie; de test opent nu die sectie. Er is hiervoor geen appgedrag aangepast.

De nieuwe Node-test controleert vertaling en behoud van foutoorzaken. Alle 51 Node-testbestanden slagen, met 552 geregistreerde Node-testcases plus de bestaande scriptasserties. Syntax-, CSS- en generated-runtimecontroles slagen. De bestaande CSS-waarschuwing over `--line` blijft bekend.

De volledige `pnpm test` eindigt met exitcode 0: alle 234 browsertests slagen, inclusief de volledige CSV-workflows op 360px en 1440px en offline herbewerkingen. `git diff --check` slaagt. De mobiele splitweergave is ook visueel geopend en gecontroleerd.

## F. Grenzen

De oorspronkelijke fout in de daadwerkelijke gebruikersgegevens is niet gereproduceerd. De nieuwe melding moet bij herhaling de concrete oorzaak zichtbaar maken. Een echte Android-telefoon en de daadwerkelijke huishoudgegevens zijn niet gebruikt; de browsercontroles gebruiken geïsoleerde gegevens.

## G. Release

De gewijzigde release is technisch getest zonder harde blokkades. Publicatie is expliciet toegestaan. Het feitelijke Pages-, live-asset- en cache-upgradebewijs wordt na publicatie afzonderlijk vastgelegd in `v115-publicatiebewijs.json`; de onderliggende logs en geïsoleerde controles staan in `backups/v115-opslagmelding/`.
