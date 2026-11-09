# Finize lokaal en in CI testen

Gebruik een schone clone, de gedeclareerde Node-/pnpm-versies en uitsluitend fictieve gegevens. De scripts werken vanuit de repositoryroot.

```text
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run test:unit
pnpm run test:backend
pnpm run check:syntax
pnpm run check:css
pnpm run check:generated
pnpm run test:smoke
```

`test:unit` bouwt eerst de gedeelde backendmodules en voert alle root-Node-testbestanden uit, behalve de expliciete native Firestore-retentietest. `test:backend` controleert de HTTP-laag met SDK-/providermocks. `test:smoke` behoudt de 35 browsergevallen van pakket 1 en voegt drie mobiele volgordegevallen, twee importfocusgevallen en vier budgetbalkgevallen toe. De volledige browserinventaris blijft beschikbaar via `pnpm run test:browser`; bekende mislukkingen worden in het pakketverslag genoemd en worden niet automatisch overgeslagen.

## Een eigen lokale testpoort

De standaardpoort is 4173. Een bestaand serverproces wordt niet hergebruikt. De server en alle browsercontexten gebruiken dezelfde helperorigin; `.mjs` wordt als JavaScript aangeboden.

PowerShell, als 4173 al bezet is:

```powershell
$env:FINIZE_TEST_PORT='4193'
$env:FINIZE_TEST_OUTPUT_DIR='.cache/browser-results'
pnpm run test:browser
```

Kies bij gelijktijdige onafhankelijke runs ook verschillende uitvoermappen. Productiegegevens of privé-snapshotvariabelen horen niet in deze testomgeving.

## Echte Firestore-emulators

Java 21 en Firebase CLI zijn nodig. Op Windows blijft de bestaande globale CLI-/Java-terugval werken. Anders stel je `JAVA_HOME` in en laat je `FINIZE_FIREBASE_CLI` verwijzen naar het bestand `firebase-tools/lib/bin/firebase.js` van een afzonderlijke testinstallatie.

De CI installeert de testtools met exacte directe versies, zonder productiecredentials:

```text
npm install --prefix .cache/ci-tools --no-save --ignore-scripts --no-audit --no-fund firebase-tools@15.24.0 firebase-admin@13.6.0
```

PowerShell:

```powershell
$env:FINIZE_FIREBASE_CLI=Join-Path $PWD '.cache/ci-tools/node_modules/firebase-tools/lib/bin/firebase.js'
$env:FINIZE_BANK_DEPENDENCIES=Join-Path $PWD '.cache/ci-tools'
pnpm run test:emulator
pnpm run test:emulator:bank
```

De eerste opdracht start uitsluitend `demo-finize-v117` op `127.0.0.1:8181` en gebruikt de bestaande Firestore-regels ongewijzigd. De tweede gebruikt uitsluitend `demo-finize-bank-retention` op `127.0.0.1:8189`. De retentietest weigert een andere host. Beide starters stoppen hun emulator na afloop en geven een foutcode door.

De volledige browserinventaris bevat daarnaast tests die de lokale records-emulator gebruiken. Laat daarvoor dezelfde CLI `emulators:exec --only firestore --project demo-finize-v117 --config firebase.emulator.json` uitvoeren met `pnpm exec playwright test` als script, zoals in de workflow. Start geen tweede emulator op een bezette poort. Voor reeds gecontroleerd lokaal hergebruik biedt de records-runner `--reuse`.

## GitHub Actions

`.github/workflows/verify.yml` heeft snelle controles bij pushes naar `main` en PR's naar `main`. Die omvatten syntax, CSS, build, alle normale Node-tests, backend-HTTP en browser-smoke. Een handmatige start en de wekelijkse planning voeren ook de echte emulators en volledige browserinventaris uit. Mislukkingen blijven een mislukte workflowstatus; browserresultaten worden als artifact bewaard.

De workflow heeft uitsluitend `contents: read`, gebruikt geen productiesecrets en voert geen deployment uit. Zolang deze branch niet is gepusht, zijn alleen lokale uitvoering en lokale YAML-controle bewezen; er is dan nog geen echte GitHub Actions-uitslag.

## Afzonderlijke schaalproeven

De snelle workflow draait bij pushes/PRs naar main; de uitgebreidere functionele controle draait handmatig en wekelijks. De tien schaal-/prestatiegevallen blijven beschikbaar in de afzonderlijke, uitsluitend handmatige workflow `verify-scale.yml`. Zo blokkeert een schaalrun de functionele reeks niet door de gezamenlijke tijdslimiet. De suite met alle gevallen blijft lokaal beschikbaar; geen assertion is voor deze splitsing verwijderd. Bekende applicatiefouten blijven de uitgebreide workflow terecht rood maken.
