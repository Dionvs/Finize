# Update 5 — desktop/tablet en geplande zakgeldverdeling

Datum: 24 juli 2026

## Gewijzigd

- Tablet gebruikt van 768 tot en met 1023 px een vaste iconensidebar van 80 px en gestapelde brede panelen.
- Desktop start bij 1024 px met een sidebar van 240 px, een compacte paginaheader en content tot maximaal 1480 px.
- Mobiele renderpaden, bottomnavigation, modals en bediening onder 768 px zijn behouden.
- Dashboard toont de vier afgesproken KPI’s en scheidt “Geplande verdeling” van “Werkelijk maandresultaat”.
- Gezamenlijk, Dion, Dara, Spaardoelen en Data & back-up hergebruiken hun bestaande data, handlers en opslag.

## Financiële correctie

`calcScenario` gebruikt voor de geplande kostenpot altijd het vooraf ingestelde variabele budget:

```js
const variabelVoorVerdelingTotaal = variabelBudgetTotaal;
```

`variabelTotaal` blijft het werkelijk geboekte gezamenlijke transactietotaal. Gezamenlijke en persoonlijke transacties wijzigen het vooraf berekende zakgeld niet. De bestaande inkomensratio’s, minimumverdeling, hypotheekverdeling en returnwaarde `variabelVoorVerdelingTotaal` zijn behouden.

Bronnen van waarheid:

- planning en zakgeld: `calcScenario`;
- werkelijk maandresultaat: de bestaande, ongewijzigde `getMonthFinancialResult`;
- budgetgebruik en budgetverschil: bestaande budget- en transactiehelpers;
- persoonlijke realisatie: bestaande `variabeleUitgaven` en `beschikbaarVoorSparen`.

Er zijn geen nieuwe financiële statevelden, schema’s, opslagwaarden of migraties toegevoegd.

## Tweede CSS-consolidatie

- De mobiele V4-regels staan in één primair `max-width:767px`-blok; het losse tweede blok bevat uitsluitend de bestaande Update 2/3-subsystemen.
- Het gedocumenteerde `max-width:640px`-blok blijft alleen bestaan voor actieve generieke niet-V4-onderdelen.
- Eén klein `max-width:374px`-blok blijft behouden voor aantoonbare editor- en navigatie-overflow; het wijzigt de vier dashboard-KPI-kolommen niet.
- De oude impliciete tablet/mobiel-laag tot 1023 px en de oude desktopgrens zijn verwijderd.
- De tablet- en desktopbasis staat logisch in `update5.css`.
- Complexe dashboard-siblingselectors zijn verwijderd.
- Chevrons gebruiken één `--finize-chevron`-variabele en één open-state-rotatie.
- Voor de afgesproken componenten zijn geen dubbele selector/property/media-combinaties meer aanwezig.
- Versiecommentaren, lege reparatieblokken en volledig overschreven declaraties zijn verwijderd.

CSS-inventarisatie, inclusief inline CSS en `update5.css`:

| Maatstaf | Voor | Na |
|---|---:|---:|
| Regelblokken | 1.546 | 1.438 |
| Selectoren | 1.882 | 1.704 |
| Mediaqueries | 88 | 8 |
| `!important` | 2.025 | 1.721 |
| CSS-omvang | 240.141 bytes | 205.609 bytes |

De consolidatie veranderde geen financiële functies, state, opslag, schema’s, transacties, handlers of navigatiestate.

## Verwerkte desktopannotaties

- Dubbele dashboardkop, losse dashboardknop en losse knop voor het kopiëren van de vorige maand zijn verwijderd; de bestaande maandoptie en hoofdactie blijven beschikbaar.
- De overbodige Firestore-voettekst en de subtitel in de zijbalk zijn verwijderd; de opslagstatus staat nu direct onder Finize.
- De zijbalk hergebruikt de mobiele navigatie-iconen. Data & back-up gebruikt een bestaand gedeeld back-upicoon omdat deze pagina geen mobiele bottomnavigation-tab heeft.
- Negatieve waarden worden app-breed op hun weergegeven minteken gemarkeerd en zijn daardoor overal rood, zonder positieve kostenbedragen mee te kleuren.
- De desktop-spaardoelenpreview biedt zes pixels extra onderruimte, toont drie doelen volledig en blijft bij extra doelen scrollbaar.
- De Gezamenlijk-pagina gebruikt tussen de primaire KPI’s, beide dashboardrijen en de beheerblokken dezelfde verticale tussenruimte van 16 px als binnen de kaartgrids.
- De spaardoelenpreview in de smalle desktopkolom toont doelen onder elkaar, zodat inhoud en acties niet meer worden ingeklemd; tablet behoudt de brede gedeelde layout.
- De service-worker-cache gebruikt na de functiepariteitsronde `finize-v93-responsive-function-parity`; de gegenereerde assets gebruiken dezelfde versiequery.

## Functiepariteit vaste lasten — 5 september 2026

- Mobiel, tablet en desktop openen voortaan dezelfde bestaande planning- en terugkerende-lasteneditor.
- `state.recurringFixedExpenses[scenario]` is daarmee op iedere schermgrootte de enige bewerkbare bron voor vaste lasten; de legacy vaste-lastenarrays blijven alleen voor migratie en compatibiliteit aanwezig.
- Gezamenlijke vaste lasten bieden overal dezelfde keuze tussen 50/50 en naar rato. Dions bestaande minimumaandeel vóór verkoop is ongewijzigd.
- Persoonlijke vaste lasten gebruiken dezelfde velden en opslag, maar verbergen de niet-toepasselijke verdelingskeuze.
- De bestaande bedragshistorie, maanduitzonderingen, afschrijfdatum, actiefstatus en cloudsynchronisatie zijn behouden. Er is geen nieuwe financiële of navigatiestate toegevoegd.
