# V118 P3 — dashboardontwerp

Datum: 14 oktober 2026. Modus: Operate. Dit is een uitbreiding binnen de bestaande Finize-huisstijl; de goedgekeurde compositie staat vast.

## Visuele bronnen

De bij deze opdracht aangeleverde `1-finize_financieel_overzicht.jpg` (desktop) en `2-finize_financieel_dashboard_2025.jpg` (mobiel), oorspronkelijk aangeduid als PNG, zijn de primaire visuele referenties. Bronmap: de remote-attachments-map van gesprek `01a13983-2ffc-74b3-ab88-cf80f3d79e61`. Hun bedragen, namen, jaartallen en datums worden niet als appgegevens gebruikt.

## Indeling en gedrag

De bestaande sidebar, onderste mobiele navigatie, maandkeuze en begroeting blijven. Vooruitblik komt bovenaan, zonder nieuw tabblad. Rustige witte panelen, bestaande groene accentkleur, bestaande iconen en typografie. Vier compacte KPI's: Vrij na verplichtingen, Huidig saldo, Laagste prognose, Buffer. Context en horizon staan direct boven de KPI's; een waarschuwing staat eronder.

Vanaf 1100 px: saldo-ontwikkeling en betalingen in verhouding ongeveer 1,7:1; daaronder Budgetten, Zakgeld, Spaardoelen in drie kolommen. Jaaroverzicht: vier compacte KPI's links in 2×2, maandgrafiek rechts. Tussen 768 en 1099 px blijven vier prognose-KPI's en drie middenkaarten waar leesbaar, hoofdpanelen stapelen. Onder 768 px: KPI's 2×2, grafiek, betalingen, Budgetten/Zakgeld in twee kolommen, Spaardoelen, Jaaroverzicht. Onder 360 px stapelen Budgetten/Zakgeld. Jaar-KPI's mobiel altijd 2×2, zonder maandgrafiek. Containers hebben min-width:0; filters scrollen uitsluitend binnen hun eigen rij. Touchdoelen minimaal 44 px, duidelijke focus, native datum- en jaarselectie.

## Financiële bronnen

| Presentatie | Enige bron |
|---|---|
| Vrij na verplichtingen | P2 `freeAfterObligationsCents`, anders `indicativeFreeAfterObligationsCents` met Indicatie |
| Spaardoelondertekst | P2 `savingsGoalCents`, uitsluitend informatief |
| Huidig saldo | P2 `opening.balanceCents`, status en peildatum uit P1 |
| Minimum en datum | P2 `minimumBalanceCents` en `minimumDate` |
| Buffer | P2 `bufferCents` |
| Saldo-ontwikkeling | P2 `days[].expectedBalanceCents`, bufferlijn, minimum en gebeurtenismarkeringen |
| Betalingen | P2 gebeurtenissen met actual/provisional/planned binnen dezelfde inclusieve horizon en hetzelfde profiel; geen replaced/reservation/unresolved |
| Budgetten | Bestaande opgeloste maandbudgetten en `sumTransactions`/`budgetActual`; geen voorlopige bankimpact |
| Zakgeld | `calcScenario(state)` bestaande Dion/Dara-zakgeldbedragen; aandelen zijn presentatie van de som, geen nieuwe verdelingsformule |
| Spaardoelen | Bestaande `calcGroep` en doelgegevens, zonder verzonnen status |
| Jaarcijfers | `getMonthFinancialResult` met dezelfde huishoudbetekenis als het bestaande jaaroverzicht; ontbrekende maandprojecties blijven ontbrekend, geen nulvervanging |

Jaaroverzicht blijft een huishoudjaaroverzicht, zoals de bestaande bron; context wisselt de rekeningprognose, budgetten en concrete doelen. Een label maakt deze scope expliciet. Gemiddeld per maand is besteed gedeeld door het aantal beschikbare maandprojecties; bij onvolledigheid wordt het aantal vermeld. Open/toekomstmaanden zijn bestaande projecties, geen bevestigde historie.

## Interacties

Context kiest gezamenlijk of de eigen persoonlijke rol uit de bestaande accountcontext; zonder aangemelde rol wordt de bestaande lokale persoonlijke tab gebruikt. Alleen een unieke actieve primaire betaalrekening wordt automatisch gekozen; anders volgt rekeningbeheer. De laatste context wordt als lokale UI-voorkeur onthouden, buiten financiële state.

Volgende salaris laat `endDate` weg. 7/14 dagen gebruiken kalenderdagen vanaf vandaag, Einde maand de laatste kalenderdag, Eigen datum een native datumveld. P2 valideert de horizon. Alle Vooruitblik-onderdelen krijgen één projectieresultaat. Een generatie-ID voorkomt dat een laat antwoord een nieuwere keuze overschrijft.

Saldo opent `openBankAccountDetails(id)`; Buffer en ontbrekende salarisdatum openen `FinizeLiquidity.openSettings(id)`. Bekijk alles bij betalingen opent de volledige P2-lijst in het bestaande modalpatroon. Budgetten/zakgeld verwijzen naar de bestaande contexttab, doelen naar Spaardoelen. Grafiekpunten zijn native knoppen voor klik, touch en toetsenbord, met een gedeeld detailvak. Geen fictieve transactiedetails of onbewezen bronlinks.

## Expliciete correcties op afbeeldingen

- Vrij na verplichtingen vervangt Veilig beschikbaar, met spaardoel als ondertekst zonder tweede aftrek.
- Geen verlengde standaardhorizon om een salaris uit de voorbeeldgrafiek te tonen.
- Zakgeld toont geplande verdeling en percentages, geen verbruiksvoortgang.
- Mobiel vier jaar-KPI's, geen grafiek; desktop vier KPI's en inkomsten/uitgaven per maand.
- Werkelijke navigatieroutes blijven; geen verzonnen Data-route of tweede mobiele navigatie.
- Onbekende bedragen worden tekst/een streep, nooit een financiële nul. Voorlopige waarschuwingen vermelden onzekerheid.

## Herstel en grens

Voor codewijzigingen zijn alle gewijzigde en niet-gevolgde bestanden gekopieerd en met SHA-256 gecontroleerd in `C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-p3-20261014-102601` met manifest, branch en HEAD. Geen productiedata, financiële motor, cloudcontracten of volgende fase wijzigen.
