# Finize v114 — CSV-verwerking en cachevernieuwing

De gebruiker heeft publicatie en cachevernieuwing expliciet goedgekeurd op 9 oktober 2026. Deze release publiceert de lokaal geverifieerde v113-CSV-implementatie, inclusief overlappende imports, gegevensbehoud bij splitsen en noodzakelijk bronherstel. Het implementatieverslag en de oorspronkelijke lokale verificatie blijven beschikbaar in `v113-csv-implementatieverslag.md` en `v113-verification.json`.

Nieuwe PWA-cache: `finize-v114-csv-verwerking`. HTML en serviceworker gebruiken beide `app.js?v=114-csv-verwerking` en `app.css?v=114-csv-verwerking`. De bestaande activatielogica verwijdert oude Finize-shellcaches; gebruikersgegevens in localStorage, IndexedDB en Firestore worden daarmee niet gewist. Er is geen Firestore-regelwijziging of gegevensmigratie onderdeel van deze release.

## Releasecontroles

- Productiebuild geslaagd; runtime byte-reproduceerbaar.
- Volledige `pnpm test`: 50 Node-testbestanden, 551 geregistreerde Node-testgevallen en 229 browsertests geslaagd; geen mislukkingen.
- JavaScript-syntax, CSS en `git diff --check` geslaagd. De bestaande CSS-waarschuwing voor `--line` blijft ongewijzigd.
- Versiegebonden cachetests zijn bijgewerkt naar v114, inclusief onjuiste-shellcontrole en offline caching.
- Zie `v114-release-verification.json` voor de controlehashes van de vier releasebestanden.

## Publicatie

Doel is `main` van `Dionvs/Finize` met GitHub Pages op https://dionvs.github.io/Finize/. Na deployment worden de publieke bestanden op HTTP-status en identieke SHA-256 gecontroleerd. De mobiele en desktopcontrole en de upgrade van de oude PWA-cache gebruiken uitsluitend een geïsoleerde browsersessie met testgegevens en een testdriver; Firebaseverkeer wordt daarbij geblokkeerd. Dit is geen test met echte gebruikersaccounts of productie-Firestore. Het daadwerkelijke publicatiebewijs wordt na uitvoering lokaal vastgelegd in `v114-publicatiebewijs.json`.
