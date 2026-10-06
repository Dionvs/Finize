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

De actieve GitHub Pages-runtime wordt reproduceerbaar gebouwd naar `app.js` en `app.css`. `index.html` laadt uitsluitend deze twee runtimebestanden.

## PWA installeren

- Android Chrome: open de app, gebruik het browsermenu en kies **Toevoegen aan startscherm**.
- iPhone Safari: open de app, tik op delen en kies **Zet op beginscherm**.

## Opslag

Gegevens worden lokaal opgeslagen in localStorage en IndexedDB. Als Firebase/Firestore is verbonden, kan de app synchroniseren tussen apparaten. De hoofdstate gebruikt schema v11 met een backwards-compatible migratie vanaf bestaande state, inclusief v9. Bestaande hoofdstatekeys en Firestore-paden blijven behouden. ImportStore gebruikt vanaf P5 dezelfde stores met lokale huishoudenisolatie. Vaste lasten, budgetten en geplande inkomsten gebruiken één historische tijdlijn. Zie [Pakket 2](docs/package-2-planning-timeline.md) voor de v11-migratie en [Pakket 1](docs/package-1-data-foundation.md) voor het datamodelfundament.

De transactiesemantiek en source-verwerking gebruiken één gedeelde pure engine. Zie [Pakket 3](docs/package-3-transaction-engine.md) voor approval, splits, actuals, compatibility en testresultaten.

Importbatches ondersteunen individuele beoordeling, meerdere open batches, Terugtrekken, Herstellen en permanent Verwijderen. Cloudheaders en de financiële snapshot worden samen versiegecontroleerd gepubliceerd. Conflicterende lokale keuzes blijven bewaard; de cloudstand blijft actief tot een expliciete keuze. Zie [Pakket 5](docs/package-5-import-lifecycle.md) voor het protocol, tests en resterende legacygrenzen. P4-actuals, prognose en volledig planningsgedreven zakgeld blijven dezelfde centrale engine gebruiken.

## Belangrijke bestanden

- `index.html`: actieve GitHub Pages-app.
- `app.js` en `app.css`: reproduceerbare runtime-uitvoer.
- `src/`: onderhoudbare modules en componentgerichte stijlbronnen.
- `service-worker.js` en `manifest.json`: PWA-bestanden.
- `firestore.rules`: toegangsregels voor de hoofdstate, imports en importchunks.
- `tests/`: financiële, opslag-, structuur- en browserregressies.
- `docs/v50-architecture.md`: actieve architectuur en opslagverantwoordelijkheden.
- `docs/package-1-data-foundation.md`: canoniek datamodel en migratiefundament, schema v10.
- `docs/package-2-planning-timeline.md`: historische planning, scenario-uitfasering en veilige schema-v11-migratie.
- `docs/package-3-transaction-engine.md`: canonieke transactiemotor, source-verwerking en resterende legacybeperking.
- `docs/package-4-savings-refunds-forecast.md`: definitieve savings/refunds/coverage en planninggedreven zakgeld.
- `docs/package-5-import-lifecycle.md`: CSV lifecycle, versiegebonden cloudopslag en expliciete conflictoplossing.
- `docs/package-6-functional-consolidation.md`: gedeelde manual flow, budgetcategoriebron, historische editors en P1–P5-regressies.
- `docs/package-7-release-audit.md`: eindaudit, bewezen contractbugfixes, volledige regressie en release-readiness; geen release uitgevoerd.
- `docs/CHANGELOG-HISTORISCH.md`: historische releasebeschrijvingen.

## Firestore-regels publiceren

Na een bewuste wijziging van `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

Authenticatie en een dataherstructurering vallen buiten de v50-opruiming.
