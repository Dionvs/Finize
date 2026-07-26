# Status Finize v50-opruimregister

Statuswaarden:

- `open`: nog te onderzoeken of op te lossen;
- `opgelost`: geïmplementeerd en door de afgesproken tests bewezen;
- `bewezen niet actief`: statisch én tijdens runtime aantoonbaar niet actief;
- `uitgesteld met reden`: bewust buiten deze opdracht gehouden.

| ID | Prioriteit | Status | Reden of acceptatie-eis |
|---|---|---|---|
| SEC-001 | P0 | uitgesteld met reden | De gebruiker wil geen login. Publieke Firestore-toegang blijft een geaccepteerd privacyrisico. |
| SEC-002 | P0 | open | Alle gebruikers-, CSV- en cloudtekst moet veilig als tekst renderen. |
| STAB-001 | P1 | open | Na 50 importrenders blijft exact één click- en change-handler actief. |
| STAB-002 | P1 | open | Eén interactie veroorzaakt maximaal één revision en opslagactie. |
| STAB-003 | P1 | open | Backdrops blijven sluiten na willekeurige interne interacties. |
| STAB-004 | P1 | open | Opstarten veroorzaakt exact één eerste render. |
| CSS-001 | P1 | open | Alleen bewezen overschreven selectors mogen componentgewijs verdwijnen. |
| CSS-002 | P1 | open | `!important` mag alleen zonder computed-styleverschil verdwijnen. |
| CSS-003 | P1 | open | Actieve custom properties moeten gedefinieerd of veilig vervangen zijn. |
| CSS-004 | P1 | open | Tabstyling krijgt één betekenis zonder visuele wijziging. |
| PERF-001 | P1 | uitgesteld met reden | Alleen no-op writes en dubbele events worden aangepakt; geen nieuw patchmodel. |
| DATA-001 | P1 | uitgesteld met reden | Het Firestore-hoofddocument wordt in deze opdracht niet opgesplitst. |
| DATA-002 | P1 | uitgesteld met reden | Doelafbeeldingen krijgen nu geen nieuwe cloudopslag. |
| DATA-003 | P1 | uitgesteld met reden | Opgeslagen schema-keys blijven ongewijzigd. |
| JS-001 | P2 | open | Iedere actieve functie krijgt één module-eigenaar en contracttest. |
| JS-002 | P2 | open | Verwijdering vereist callgraph, runtimecoverage en visuele gelijkheid. |
| JS-003 | P2 | open | De oude importer mag pas weg na identieke CSV-fixtureresultaten. |
| JS-004 | P2 | open | Helpers worden na contracttests gecentraliseerd. |
| JS-005 | P2 | open | Alleen bewezen niet-actieve functies worden verwijderd. |
| ENC-001 | P2 | uitgesteld met reden | De zichtbare v50-mojibake is bewust onderdeel van de bevroren baseline. |
| PWA-001 | P2 | open | Alleen caches met Finize-prefix mogen worden verwijderd. |
| PWA-002 | P2 | open | Alleen navigatie mag naar `index.html` terugvallen. |
| PWA-003 | P2 | open | Een optionele asset mag installatie niet blokkeren. |
| REPO-001 | P2 | open | Vanaf deze branch worden semantische commitberichten gebruikt. |
| REPO-002 | P2 | open | Package-, lock- en reproduceerbare testscripts ontbreken nog. |
| REPO-003 | P2 | open | Legacybestanden worden pas na runtime-equivalentie verwijderd. |
| DOC-001 | P3 | open | Handleiding en releasehistorie worden gescheiden. |
| CI-001 | P3 | open | Nieuwe CI gebruikt dezelfde Node 24-versie als lokaal. |
