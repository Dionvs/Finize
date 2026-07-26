# Status Finize v50-opruimregister

Statuswaarden:

- `open`: nog te onderzoeken of op te lossen;
- `opgelost`: geïmplementeerd en door de afgesproken tests bewezen;
- `bewezen niet actief`: statisch én tijdens runtime aantoonbaar niet actief;
- `uitgesteld met reden`: bewust niet gewijzigd om scope, data of bevroren uitvoer te beschermen.

| ID | Prioriteit | Status | Bewijs of reden |
|---|---|---|---|
| SEC-001 | P0 | uitgesteld met reden | Geen login gewenst; publieke Firestore-toegang blijft een geaccepteerd privacyrisico. |
| SEC-002 | P0 | opgelost | Tekst- en attribuutescaping, URL-validatie en injectiebrowsertest. |
| STAB-001 | P1 | opgelost | Vijftig importrenders houden exact één click- en change-handler. |
| STAB-002 | P1 | opgelost | Eén inputroute en no-op guard; browsertest controleert revision en lokale write. |
| STAB-003 | P1 | opgelost | Centrale backdropafhandeling blijft werken na interne klikken en heropenen. |
| STAB-004 | P1 | opgelost | Centrale bootstrap; exact één eerste `renderActiveTab`. |
| CSS-001 | P1 | opgelost | 138 identieke, later herhaalde declaraties verwijderd; snapshots en computed styles gelijk. |
| CSS-002 | P1 | uitgesteld met reden | Alleen bewezen identieke declaraties zijn verwijderd; overige `!important`-regels blijven om de v50-weergave te bevriezen. |
| CSS-003 | P1 | opgelost | Actief tokenbestand en CI-controle melden nul ongedefinieerde tokens; dynamische procenttokens zijn expliciet runtime-eigendom. |
| CSS-004 | P1 | uitgesteld met reden | Bestaande tabselectors blijven waar vervanging zonder visuele wijziging niet bewezen is. |
| PERF-001 | P1 | uitgesteld met reden | No-op writes en dubbele events zijn opgelost; geen nieuw patchmodel. |
| DATA-001 | P1 | uitgesteld met reden | Het Firestore-hoofddocument wordt niet opgesplitst. |
| DATA-002 | P1 | uitgesteld met reden | Doelafbeeldingen krijgen geen nieuwe cloudopslag. |
| DATA-003 | P1 | uitgesteld met reden | Opgeslagen schema-keys blijven ongewijzigd. |
| JS-001 | P2 | opgelost | `src/app-entry.js` en expliciete core-, import-, storage- en UI-module-eigenaren; esbuild levert één IIFE-bundle. |
| JS-002 | P2 | uitgesteld met reden | Financieel gevoelige historische overrides blijven zolang verwijderen niet met volledige runtimecoverage is bewezen. |
| JS-003 | P2 | bewezen niet actief | De Update 4-hooks vervangen parser/UI-routes vóór de eerste render; import- en browsertests bewijzen de actieve route. |
| JS-004 | P2 | opgelost | Gedeelde state-clone centraal; andere gelijknamige helpers behouden afwijkende, geteste contracten. |
| JS-005 | P2 | uitgesteld met reden | Geen functie verwijderd zonder volledige runtimecoverage; herstelbaarheid weegt zwaarder dan extra regels verwijderen. |
| ENC-001 | P2 | uitgesteld met reden | De zichtbare v50-mojibake blijft bewust onderdeel van de bevroren baseline. |
| PWA-001 | P2 | opgelost | Activatie verwijdert alleen caches met de prefix `finize-`. |
| PWA-002 | P2 | opgelost | Alleen navigatie valt terug op `index.html`; assets nooit. |
| PWA-003 | P2 | opgelost | Kritieke en optionele install-assets zijn gescheiden. |
| REPO-001 | P2 | opgelost | De branch bevat afgebakende semantische commits. |
| REPO-002 | P2 | opgelost | Node 24, pnpm-lock, reproduceerbare build en volledige testscripts. |
| REPO-003 | P2 | opgelost | Legacybestanden verwijderd na 25 Node- en 18 browsertests; tag/back-up is herstelroute. |
| DOC-001 | P3 | opgelost | Handleiding, architectuur, technisch verslag en historische changelog zijn gescheiden. |
| CI-001 | P3 | opgelost | GitHub Actions gebruikt Node 24 en dezelfde niet-destructieve controles. |

## Samenvatting

- `opgelost`: 17
- `bewezen niet actief`: 1
- `uitgesteld met reden`: 10
- `open`: 0

De uitgestelde punten zijn geen ongemelde restpunten: ze beschermen bewust de afgesproken data-, authenticatie- en visuele grenzen.
