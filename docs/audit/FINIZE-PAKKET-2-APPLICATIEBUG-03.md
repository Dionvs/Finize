# Pakket 2 — applicatiebug 03: negatieve mobiele budgetbalk

Status: afzonderlijk door de gebruiker goedgekeurd en gericht hersteld. Geen productiegegevens gebruikt of gewijzigd.

## Reproductie

De bestaande V113-regressietest maakt uitsluitend synthetische gegevens: een opname van €500 uit een spaardoel, waarvan €300 categoriecorrectie Kleding, plus een terugbetaling van €100 aan dezelfde categorie in oktober 2026. Netto categoriegebruik is −€400 bij een budget van €100. Alle voorafgaande financiële assertions slagen: budget −€400, bankcashflow €600, twee brontransacties, spaardoelsaldo €1500 en geen extra inkomen.

Open op 360 px de gezamenlijke rekening en Variabele lasten. Kleding toont correct −€400 / €100, maar de balk is volledig gevuld. Desktop 1440 px toont dezelfde bedragen met een lege balk.

## Verwacht en werkelijk

| Geval | Verwacht | Gemeten |
|---|---|---|
| Mobiel 360 px | 0% balk bij negatief netto gebruik | Inline `width:-400%`; echte balk 264 px op een spoor van 264 px |
| Desktop 1440 px | 0% | Inline `width:0%`; echte balk 0 px |

De negatieve CSS-breedte is ongeldig en wordt door de browser als automatische breedte behandeld. De volledige mobiele balk is visueel gecontroleerd in de screenshot. Het bovenste KPI-overzicht toont wel correct 0%.

## Technische oorzaak en ernst

`src/core/runtime.js`, `renderJointFirstRow`, begrenst de categorieratio alleen bovenaan: `Math.min(1, used / row.budget)`. Een terugbetaling/categoriecorrectie kan `used` negatief maken. Dat levert negatieve CSS op. De bedragen en financiële verwerking zijn correct; dit is een bewezen weergavefout die het budgetgebruik verkeerd voorstelt, geen aangetoond verlies of verkeerde boeking.

## Kleinste voorgestelde correctie

Begrens uitsluitend de getoonde balkratio in deze bewezen mobiele renderer op 0–1. Behoud het negatieve bedrag en alle financiële berekeningen. Geen brede CSS-aanpassing, migratie, andere spaarregel of productieactie.

Behoud de bestaande financiële assertions en de 0%-assertion. Controleer netto negatief, nul, positief en boven budget, op mobiel 360/390/430 en desktop 1440. Controleer ook dat transacties, spaardoel en maandhistorie onveranderd blijven.

## Bewijs

- `pakket2-bug03-bewijs.json`: werkelijke DOM-/CSS-maten en tekst.
- `evidence/pakket2-bug03-360.png`: geopende mobiele screenshot.
- `.cache/pakket2/negative-budget-proof.json` en `.log`: 1 geslaagd (desktop), 1 mislukt (mobiel), met behouden oorspronkelijke 0%-assertion.
- `tests/browser/v113-csv-processing.spec.cjs`: bestaande test `V113 optionele spaarbudgetcorrectie en negatieve refund`.

De verouderde rekeningfixture, maandkeuze en kaartbediening zijn eerst gecorrigeerd. Daardoor bereikt deze test nu de oorspronkelijke inhoudelijke balkassertion. Deze assertion wordt niet aangepast om de suite groen te maken.

## Uitgevoerd herstel en controle

Eén bronregel in `renderJointFirstRow` begrenst nu alleen de zichtbare ratio op 0–1. `app.js` en de inline `index.html` zijn via de bestaande build bijgewerkt. De getoonde negatieve bedragen, financiële effecten en historische opslag zijn ongemoeid gebleven.

- Bestaande V113-reeks: 16/16 geslaagd, inclusief de eerder falende negatieve-refundbalk.
- Nieuwe `budget-bar-refunds.spec.cjs`: 4/4 geslaagd op 360/390/430/1440 px, telkens met netto −400, nul, 25 en 150 bij budget 100. Zowel de ingestelde breedte als de werkelijke vulling wordt getoetst; de spoorbreedte is de binnenbreedte, zodat desktopranden niet als vulling meetellen.
- Alle 1372 normale Node-tests slagen, 0 mislukt en 0 overgeslagen.
- De nieuwe mobiele screenshot is geopend en visueel gecontroleerd. De balk is leeg, het negatieve bedrag blijft zichtbaar.
- De vier nieuwe gevallen zijn toegevoegd aan de bestaande smoke-opdracht; de oorspronkelijke 35 en vijf eerdere herstelgevallen blijven behouden. De gezamenlijke smoke-run slaagt 44/44 (`smoke-after-budget.json`).

Bewijs: `.cache/pakket2/budget-bar-fixed.json`, `budget-bar-final.json`, `node-after-budget-bar.log` en `evidence/pakket2-bug03-na-430.png`. Geen productiegegevens, bankverbindingen of beveiligingsregels gewijzigd.
