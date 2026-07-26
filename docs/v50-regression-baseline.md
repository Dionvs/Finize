# Finize v50 — regressiebaseline

## Vastgelegde uitgangspunten

- Git-baseline: `36696c5`.
- Schema: v9.
- PWA-cache: `finize-v50-icon-system`.
- Bestaande tests: 24 Node-tests.
- Browserformaten: 360, 390, 430, 768, 1024 en 1440 px.
- Drie ING-fixtures: Dion, Dara en gezamenlijk.

## Visuele contracten

`tests/fixtures/v50-visual-state.json` bevat een vaste lokale state zonder live gebruikersdata. De browsertests bewaren per formaat een viewportafbeelding en vergelijken die met maximaal 0,2% pixelafwijking. `tests/fixtures/v50-computed-styles.json` bewaart de belangrijkste winnende stijlen van pagina, dashboard, KPI's, gezamenlijke rekening, zakgeld, spaardoelenpreview en mobiele ondernavigatie.

De screenshots worden op Windows gecontroleerd om platformafhankelijke letterrendering niet als productwijziging te behandelen. CI controleert op alle platformen de structuur, interacties, syntax, reproduceerbare build en horizontale overflow.

## Opslag- en cloudisolatie

Browsertests gebruiken een schone browsercontext, vaste localStorage-state en geblokkeerde service workers. Er worden geen live Firestore-writes uitgevoerd. Import-, cloud-, IndexedDB- en hersteltests gebruiken de bestaande mocks.

## Bekende baseline-afwijkingen

- acht CSS-tokens zijn in v50 gebruikt maar nog niet gedefinieerd: `--cream`, `--green-pale`, `--ink`, `--pct`, `--soft-green`, `--surface`, `--surface-2` en `--used-pct`;
- bekende mojibake blijft zichtbaar;
- de bekende spaardoel-progressiebalkafwijking blijft zichtbaar;
- dubbele selectors en `!important`-regels zijn nog aanwezig.

Deze punten worden alleen in hun geplande fase aangepast en mogen vóór dat moment niet via een algemene override worden gemaskeerd.
