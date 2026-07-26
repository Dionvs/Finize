# Finize v50 — actieve architectuur

## Runtime en laadvolgorde

De v50-baseline laadt in deze volgorde:

1. twee inline stijlblokken uit `index.html`;
2. `update4.css`;
3. `update5.css`;
4. de vroege foutregistratie uit `index.html`;
5. de kernruntime uit `index.html`;
6. `update4.js`;
7. `update5.js`;
8. de service-workerregistratie.

De tijdelijke bronfragmenten onder `src/legacy/` bewaren exact deze cascade- en uitvoervolgorde. `scripts/build.mjs` maakt daar zonder timestamp of sourcemap de gecommitteerde `app.css` en `app.js` van. Tot de actieve omschakeling blijven de oorspronkelijke bestanden door `index.html` geladen.

## State en financiële kern

- `state` is de centrale, genormaliseerde budgetstate.
- `commitChange` blijft de enige transactionele kern voor gevalideerde statewijzigingen.
- Schema v9 blijft ongewijzigd.
- De bestaande transacties, maandresultaten, afsluitsnapshots en verdelingsregels blijven de financiële bron van waarheid.
- De verdeling vóór verkoop blijft `Math.max(0.40, inkomensaandeelDion)`.
- De verdeling na verkoop blijft hypotheek 50/50 en overige gezamenlijke lasten naar rato van inkomen.

## Opslagverantwoordelijkheden

| Opslag | Sleutel of pad | Verantwoordelijkheid |
|---|---|---|
| localStorage | `finize-budget-planner-v1` | compacte kernstate |
| localStorage | `finize-budget-planner-v1-last-good-backup` | laatst geldige lokale back-up |
| localStorage | `finize-budget-planner-v1-pre-schema-v5` | historische migratieback-up |
| localStorage | `finize-device-id` | stabiel apparaat-ID |
| localStorage | `finize-firebase-config` | lokale Firebase-configuratie |
| IndexedDB | `finize-goal-images-v1` | lokale spaardoelafbeeldingen |
| IndexedDB | Update 4 ImportStore | importdetails, journal en retrywachtrij |
| Firestore | `budgetPlanners/finize` | compacte kernstate |
| Firestore | `budgetPlanners/finize/imports/{importId}` | importheader |
| Firestore | `budgetPlanners/finize/imports/{importId}/chunks/{chunkId}` | importchunks |

Lokale importdetails blijven leidend. Cloudkopieën mogen lokale bewerkingen niet stilzwijgend overschrijven.

## Compatibiliteitsfacades en globals

De volgende interne contracten blijven tijdens de modularisering bestaan:

- `window.FinizeUpdate4`;
- `window.FinizeUpdate5`;
- `FinizeUpdate4Runtime`;
- `FinizeUpdate4Process`;
- `window.DataAdapter`;
- `window.CloudAdapter`.

Er wordt geen externe API toegevoegd. Functies worden pas uit globals gehaald nadat tests en de actieve bundle aantonen dat alle aanroepen via expliciete imports lopen.

## Actief en legacy

| Bestandsgroep | v50-status | Einddoel |
|---|---|---|
| `index.html` inline CSS/JS | actief | alleen markup en `app.*`-verwijzingen |
| `update4.js/css` | actief | opgenomen in modules en bundle |
| `update5.js/css` | actief | opgenomen in modules en bundle |
| `app.js/css` | gegenereerd, nog niet actief | enige actieve runtime |
| `src/legacy/` | tijdelijke bron | vervangen door echte modules |
| `index-OLD.html`, `finize-v4.html`, `finize-mobile.html` | herstelkopieën | verwijderen na bewezen gelijkwaardigheid |

## Bewust bevroren v50-uitvoer

De bekende mojibake en de bestaande spaardoel-progressiebalkafwijking zijn onderdeel van de visuele v50-baseline. Deze opschoning verandert ze niet.

## Uitgestelde risico's

- Publieke Firestore-toegang blijft een bewust geaccepteerd privacyrisico, omdat authenticatie niet gewenst is.
- Het hoofdstate-document wordt niet opgesplitst.
- Doelafbeeldingen krijgen geen nieuwe cloudopslag.
- Er komen geen afzonderlijke opgeslagen schemaversies per opslaglaag.
