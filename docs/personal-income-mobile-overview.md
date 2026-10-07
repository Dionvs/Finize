# Persoonlijke mobiele inkomensuitsplitsing

Uitgangspunt: v109, commit `f9060e8b55849254a3ba0e64aa75a605d232c1d6`. Publicatie van deze geteste presentatiecorrectie is op 7 oktober 2026 afzonderlijk geautoriseerd. Releasemarker: `finize-v110-personal-income-overview`.

## Oorzaak en correctie

Gezamenlijk opende al een alleen-lezen inkomensoverzicht. Dion/Dara openden bij een tik op de mobiele inkomenskaart direct de inkomenseditor. Hun inline bronregels werden bovendien binnen de compacte Android-kaart afgesneden. De grotere iPhone-kaart en de desktopkaart hadden wel een zichtbare uitsplitsing.

Het bestaande modalpatroon is uitgebreid tot `openIncomeOverview`. Een tik, Enter of spatie op de persoonlijke mobiele inkomenskaart opent nu totaal, geselecteerde maand en bestaande bronregels. De bedragen komen ongewijzigd uit `personalIncomeOverview` en dezelfde zakgeldselector als de kaart. Bronlabels openen dezelfde bestaande actieve brontransacties; sluiten daarvan keert terug naar het overzicht. De bestaande editor blijft bereikbaar via **Inkomen aanpassen** en via de bestaande beheersectie. Desktop en inline iPhone-weergave blijven behouden.

Het overzicht controleert opnieuw persoonlijke tabtoegang en verborgen inkomens-KPI's, ook wanneer een eerder gerenderde kaart nog bestaat. Een gedeelde persoonlijke tab krijgt geen bewerkknop. Er is geen nieuwe calculator, financiële regel of privacy-instelling toegevoegd.

## Bestanden

- `src/core/runtime.js`: gedeeld overzicht, persoonlijk triggergedrag, toetsenbordbediening en bestaande editoractie.
- `app.js`: gegenereerd via de bestaande builder.
- `tests/browser/income-overview.spec.cjs`: Android/iPhone Dion/Dara-overzichten, brontransacties, editorbereikbaarheid, exacte som, geselecteerde maand, privacy en read-only state/storage.
- `tests/browser/function-parity-goals-income.spec.cjs`: bestaande mobiele editorcontrole loopt nu via het bronnenoverzicht.
- `tests/function-parity-goals-income.test.cjs`: routecontract volgt het nieuwe overzicht en vereist nog steeds de bestaande gedeelde editor.
- Dit verslag.

## Verificatie

De nieuwe Android-test faalde vóór de correctie: na openen bestond `incomeOverviewTitle` niet, omdat de editor werd geopend. Na de correctie slagen beide nieuwe Android/iPhone-tests.

- **19/19 unieke gerichte browsercases PASS**, inclusief inkomen op 390/1440px, historische maanden, salarisfallback, expliciete nul, splits, bronlinks, persoonlijke privacy en bestaande editor-/spaardoelpariteit. Een nieuwe privacytest gebruikte aanvankelijk een niet-geëxporteerde functie; die test is gecorrigeerd naar de echte klikroute en afzonderlijk geslaagd. Productcode wijzigde daarbij niet.
- Inkomsten-Node-tests **9/9 PASS**; fixronde-Node-regressies **33/33 PASS**; functiepariteitscontract PASS.
- Syntax, CSS, build, generated-runtimecontrole en `git diff --check` PASS.
- Screenshots met geïsoleerde fixtures van Dion/Dara op Android/iPhone 390px en de bestaande 1440px-overzichten handmatig beoordeeld.
- Volledige fixturestate, financiële projectie, forecast, inkomen en lokale opslag exact gelijk vóór/na alleen-lezen acties. De bestaande editor-savetest bevestigt dezelfde historische schrijfroute.
- CSS, financiële engine, planning, import/sync, Firestore rules en schema zijn niet gewijzigd; schema blijft 11. Geen productiegegevens gewijzigd. De release omvat uitsluitend deze presentatiecorrectie en consistente versieplaatsen; het publicatieresultaat wordt afzonderlijk vastgelegd.

De eerder geslaagde volledige suites zijn op verzoek niet herhaald. Alleen relevante regressies voor deze nieuwe presentatiecorrectie zijn uitgevoerd.
