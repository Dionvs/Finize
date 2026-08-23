# Finize v53 — actieve architectuur

## Runtime en build

`index.html` bevat alleen markup en laadt `app.css` en `app.js`. De browser heeft geen buildserver nodig.

- `src/app-entry.js` bepaalt de uitvoervolgorde.
- `src/core/` bevat de state-, migratie-, validatie- en rekencontracten.
- `src/storage/` bevat de lokale, cloud- en afbeeldingsopslagcontracten.
- `src/import/` bevat parser, classificatie, importopslag, synchronisatie en UI-contracten.
- `src/ui/` bevat rendering, presentatie, modals en iconen.
- `src/styles/` bevat de actieve CSS-bronnen voor tokens, basis, dashboard, spaardoelen, import, tablet en desktop.
- `scripts/build.mjs` bundelt JavaScript met esbuild en voegt CSS in vaste cascadevolgorde samen.
- `app.js` en `app.css` zijn gegenereerd, gecommitteerd en byte-reproduceerbaar.

De build bevat geen timestamp en geen sourcemap. CI voert dezelfde Node 24-build uit en faalt als de gecommitteerde runtime afwijkt.

## State en financiële kern

- `state` is de centrale, genormaliseerde budgetstate.
- `commitChange` blijft de transactionele kern voor gevalideerde statewijzigingen.
- Schema v9 en alle bestaande opslagvormen blijven ongewijzigd.
- De verdeling vóór verkoop blijft `Math.max(0.40, inkomensaandeelDion)`.
- De verdeling na verkoop blijft hypotheek 50/50 en overige gezamenlijke lasten naar rato van inkomen.
- Bestaande transacties, maandresultaten, afsluitsnapshots en importeffecten blijven de financiële bron van waarheid.

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

## Compatibiliteit

De bestaande interne contracten blijven beschikbaar:

- `window.FinizeUpdate4`;
- `window.FinizeUpdate5`;
- `window.FinizeUpdate4Runtime`;
- `window.FinizeUpdate4Process`;
- `window.DataAdapter`;
- `window.CloudAdapter`.

Er is geen externe API toegevoegd. Klassieke globals die door de bestaande runtime en regressietests nodig zijn, worden expliciet gepubliceerd.

## PWA

De cachemarker is `finize-v89-subdoelen-desktop`. Alleen caches met de prefix `finize-` worden opgeruimd. Alleen navigatieverzoeken mogen offline op `index.html` terugvallen; ontbrekende scripts, CSS en afbeeldingen krijgen nooit HTML als vervanging. Optionele pictogrammen kunnen een installatie niet blokkeren.

Een gewijzigde openbare productlink bij een subdoel wordt eenmalig via de Microlink-metadata-API gelezen. Titel, europrijs, afbeelding, bronlink en ophaaltijd worden als compacte momentopname in het subdoel bewaard; dezelfde link veroorzaakt daarna geen nieuwe aanvraag. Bij een geblokkeerde winkel, netwerkfout of daglimiet blijven de handmatig ingevulde naam en het doelbedrag leidend.

Cloudwrites gebruiken een Firestore-transactie met een serverbrede `syncVersion` en unieke `commitId`. De eerste geldige cloudsnapshot is leidend; een apparaat-lokale `revision` bepaalt nooit meer welke apparaatstand wint. Als de cloud sinds de laatste bevestiging is veranderd, wordt de lokale stand als nood-back-up bewaard en daarna door de actuele cloudstand vervangen. Expliciet herstel van een JSON- of noodback-up wordt atomair als nieuwe cloudversie opgeslagen; de schermstand wisselt pas na bevestiging door Firestore. Vertraagd binnenkomende snapshots met een lagere of inconsistente `syncVersion` worden altijd genegeerd.

## Herstel en bewust behouden uitvoer

De tag `v50-audit-baseline`, de lokale Git-bundle en de back-up onder `backups/` vormen de herstelroute. De verwijderde legacy-HTML- en updatebestanden blijven via die route beschikbaar.

De bekende mojibake en de bestaande spaardoel-progressiebalkafwijking zijn bewust onderdeel van de bevroren v50-uitvoer en zijn niet in deze technische opschoning aangepast.

## Uitgestelde risico's

- Publieke Firestore-toegang blijft een geaccepteerd privacyrisico, omdat authenticatie niet gewenst is.
- Het hoofdstate-document wordt niet opgesplitst.
- Doelafbeeldingen krijgen geen nieuwe cloudopslag.
- Er komen geen afzonderlijke opgeslagen schemaversies per opslaglaag.
- Bestaande visueel noodzakelijke `!important`- en tabselectors blijven staan wanneer verwijderen de bevroren uitvoer verandert.
