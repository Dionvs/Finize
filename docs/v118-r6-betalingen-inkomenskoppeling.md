# V118-r6: toekomstige betalingen en administratieve inkomenskoppeling

- De dashboardkaart toont alleen geplande vaste lasten, vaste inkomsten, salaris en zakgeld na vandaag, binnen de gekozen periode en rekening. Historische bankboekingen blijven op de grafiek beschikbaar.
- Alle passende betalingen staan direct in de kaart. De knop Bekijk alles vervalt; de lijst wordt vanaf 360 px verticaal scrollbaar en is met het toetsenbord bereikbaar.
- Spaarinleg kan worden gekoppeld aan goedgekeurd ontvangen inkomen, waaronder belastingteruggave, in dezelfde maand en voor dezelfde budgeteigenaar. De koppeling blijft administratief: inkomen, maandruimte, kasbewegingen en spaardoelmutatie veranderen niet door de koppeling.
- Bestaande interne inleg behoudt de bestaande financiële verwerking. Bedraggrenzen, dubbele toewijzing en ongeldige/verwijderde bronnen blijven bewaakt.
- Geen schemawijziging of productiedatamutatie. Index en service worker gebruiken 118-r6 / finize-v118-r6.

## Verificatie

258 gerichte Node-tests en 9 browserchecks geslaagd bij de implementatie, inclusief mobiel/desktop, scrollen, periodekeuze en herladen van de inkomenskoppeling. Syntax, CSS, reproduceerbare build en diffcontrole geslaagd.

De brede bestaande regressie is niet volledig groen: update4-ui-structure verwacht nog het oude dashboard-year-overview; oudere budgetknoptests gebruiken een niet meer aanwezige knopnaam. Deze controles zijn niet als geslaagd gerapporteerd.

Releasecontrole: 258 gerichte Node-tests en 33 versie-/cachetests geslaagd. Acht browserchecks geslaagd: desktop/mobiel, 430 px zonder JavaScriptfouten, offline herladen, upgrade van r4 naar r6 en terugrollen met behoud van transacties, planning, imports, IndexedDB en localStorage.
