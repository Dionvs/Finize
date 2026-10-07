# Uitgebreide inkomensoverzichten

7 oktober 2026. Uitsluitend presentatie; schema v11 blijft v11.

Dashboard **Totaal gezamenlijke rekening** en Gezamenlijk **Totaal gezamenlijk inkomen** tonen op desktop dezelfde uitsplitsing. Op mobiel opent een tik op deze totaalkaarten een alleen-lezen overzicht met geselecteerde maand en Sluiten. Dion/Dara behouden hun bestaande uitsplitsing en inkomenseditor. De bestaande layout blijft behouden; uitsluitend drie lokale CSS-regels voor de klikbare bronlabels zijn toegevoegd.

`dashboardIncomeBreakdown()` behoudt alle bestaande berekeningen en returnwaarden. Alleen `items` is toegevoegd als presentatie van de reeds meegetelde componenten: één Salarissen-regel (ook bij expliciet nul), resterende Vaste teruggaven, bestaande meegetelde Terugbetalingen en aanvullende inkomsten gegroepeerd per soort. Groepering gebeurt in gehele centen. Het totaal, salarisvoorrang, financiële engine, privacy en opslagroutes zijn niet gewijzigd. Refunds/spaarbewegingen zonder bestaande inkomensimpact worden niet toegevoegd. `renderIncomeSources()` hergebruikt exact de bestaande persoonlijke opmaak; de persoonlijke renderer blijft als adapter bestaan.

Alle bronlabels zijn aanklikbaar. `incomeSourceProjectionRows()` selecteert uitsluitend de bestaande, reeds meegetelde actieve projecties voor de bron en maand. `openIncomeSourceTransactions()` toont deze als alleen-lezen transactielijst met datum, omschrijving, fysieke rekening en bedrag. Geplande/legacy bedragen zonder transactie worden expliciet uitgelegd, zonder fictieve transacties. Zakgeld blijft een planningbedrag. Persoonlijke transactiedetails volgen de bestaande deel- en KPI-privacyinstellingen. Op mobiel voorkomt de bronklik dat de inkomenseditor tegelijk opent; de editor zelf blijft bereikbaar via de kaart.

De mobiele leesroute `openJointIncomeOverview()` gebruikt het bestaande income-sheetpatroon, bevat geen invoervelden of savecommand en sluit via Sluiten, backdrop of Escape. Focus keert terug naar de kaart. Beide ingangen lezen dezelfde maand en uitsplitsing.

## Verificatie

- Volledige Node-suite: **48/48 bestanden**, **429/429 geregistreerde node:test-cases**, geen failures/skips; inclusief 9 nieuwe gerichte presentatietests.
- Gerichte browserregressie: **40/40 unieke cases PASS**: 10 nieuwe inkomenscases, 6 bestaande doelen/inkomen-pariteitscases, 22 P4/P6-regressies en 2 PWA/offlinecases. Getest op 390px/1440px en aanvullend de bestaande iPhone-layout op 390px. Geen page/console-errors in de nieuwe cases.
- Nieuwe cases testen identieke gezamenlijke uitsplitsingen, centensommen, salarisfallback, actual salary, expliciet nul, historische maanden, aanvullende soorten, uitsluiting van review/refund/savings, persoonlijke kaart/inkomenseditor, openen/sluiten en read-only state/storage. Bronklik wordt daarnaast getest voor meerdere transacties, salary fallback, persoonlijke teruggave, Zakgeld, gedeelde/verborgen persoonsgegevens, splits, geselecteerde historische maand en HTML/attribuut-escaping.
- Exacte reproduceerbare vergelijking vóór/na op dezelfde geïsoleerde fixture met vaste device-ID: volledige opgeslagen state, financiële projecties, forecast, scenarioresultaat en de vier getoonde inkomens-totalen **recursief exact gelijk**. Geen gewijzigde actuals, planning, zakgeld, goals/ledger, imports of closures. Geen save/cloudwrite door bekijken.
- Syntax, CSS-validatie, build en `build --check`: PASS. Generated app.js reproduceerbaar. CSS SHA-256: `1573ff2a94735165be035a004f7689c116f256eefce7b9fe709e67b728d5df78`; de enige CSS-diff is de lokale bronlabel-buttonopmaak, hover en keyboardfocus.
- Screenshots van Dashboard, Gezamenlijk, Dion en Dara op beide breedtes en iPhone handmatig beoordeeld. Geen snapshots automatisch bijgewerkt. Lokale evidence blijft buiten de repository.

## Publicatie

Door gebruiker afzonderlijk geautoriseerd. Bestaande Pages-route: `Dionvs/Finize`, branch `main`, root `/`. Index en service worker krijgen uitsluitend de bijbehorende asset/cacheversie `107-income-source-details` / `finize-v107-income-source-details`; versiegebonden tests volgen deze marker. Geen Firestore-ruleswijziging of deployment nodig. Geen productiegegevens of testdata schrijven. Het daadwerkelijke commit-/Pages-resultaat en live assetcheck worden na publicatie apart gerapporteerd.
