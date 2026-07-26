# Finize

Finize is een persoonlijke budgetplanner voor gezamenlijke uitgaven, persoonlijke balans, transacties en spaardoelen.

Live app: https://dionvs.github.io/Finize/

## Lokaal gebruiken

De app werkt rechtstreeks als statische webapp. Voor ontwikkeling:

```bash
pnpm install
pnpm run build
pnpm test
```

De actieve GitHub Pages-runtime wordt reproduceerbaar gebouwd naar `app.js` en `app.css`. Tijdens de v50-opruiming zijn de bestaande runtimebestanden nog actief totdat hun gelijkwaardigheid volledig is bewezen.

## PWA installeren

- Android Chrome: open de app, gebruik het browsermenu en kies **Toevoegen aan startscherm**.
- iPhone Safari: open de app, tik op delen en kies **Zet op beginscherm**.

## Opslag

Gegevens worden lokaal opgeslagen in localStorage en IndexedDB. Als Firebase/Firestore is verbonden, kan de app synchroniseren tussen apparaten. De bestaande opslagkeys, schema v9 en Firestore-paden blijven compatibel.

## Belangrijke bestanden

- `index.html`: actieve GitHub Pages-app.
- `app.js` en `app.css`: reproduceerbare runtime-uitvoer.
- `src/`: onderhoudbare broncode en tijdelijke volgordegetrouwe v50-fragmenten.
- `service-worker.js` en `manifest.json`: PWA-bestanden.
- `firestore.rules`: toegangsregels voor de hoofdstate, imports en importchunks.
- `tests/`: financiële, opslag-, structuur- en browserregressies.
- `docs/v50-architecture.md`: actieve architectuur en opslagverantwoordelijkheden.
- `docs/CHANGELOG-HISTORISCH.md`: historische releasebeschrijvingen.

## Firestore-regels publiceren

Na een bewuste wijziging van `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

Authenticatie en een dataherstructurering vallen buiten de v50-opruiming.
