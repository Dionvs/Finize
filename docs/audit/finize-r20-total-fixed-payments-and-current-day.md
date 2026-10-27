# V118-r20 — totaal-KPI vaste lasten en betalingen op de berekendag

De betaalvoortgang hoort bij de bovenste KPI Vaste lasten totaal. Dezelfde bestaande helper voor goedgekeurde, gekoppelde occurrencebetalingen wordt nu opgeteld tot één Betaald / gepland-bedrag en één voortgangsbalk per eigenaar. De categoriekaarten zijn teruggezet naar de bestaande verdeling van vaste-lastenbedragen. Er is geen wijziging van financiële vastlegging, betaaldatums, categorieën of goedkeuringen.

De tweede correctie betreft een aangetoonde datumgrens in `daily-liquidity.mjs`. Een ouder end-of-day-saldo-ijkpunt, aangevuld met aanwezige bankboekingen, werd behandeld alsof ook de berekendag al afgesloten was. Een nog niet gekoppeld plan met precies die betaaldatum kreeg daardoor ten onrechte een onbekende datum en ontbrak in de verwachte daglijn.

De motor behoudt zulke plannen op hun bestaande dag wanneer de waarneming ouder is of een timestampgrens heeft. Een daadwerkelijk end-of-day-ijkpunt van diezelfde dag blijft uitgesloten van deze behandeling. Expliciet gekoppelde bankbetalingen vervangen het plan zoals voorheen, ook wanneer de bankbetaling al in de actuele saldobasis zit. Niet-gekoppelde plannen van eerdere dagen blijven onzeker; er wordt geen nieuwe betaaldatum verzonnen.

`includeAsOfPlans` is uitsluitend berekeningsmetadata, geen nieuw opgeslagen financieel veld. Dezelfde grens wordt gebruikt voor de daglijn en voor concrete dekking van budgetreserveringen. Onbekende bankdekking blijft een afzonderlijke blokkade voor een numeriek veilig spaarbedrag.

Controles: volledige Node-run met 83 bestanden geslaagd; zeven gerichte regressies voor de datumgrens geslaagd; 22 browsercontroles geslaagd, inclusief 320/390/430/1440 px, eigenaren, herladen, bestaande prognoses, r19→r20-update, offline en terugrol. De totaal-KPI is aanvullend visueel geopend en op overlap en begrenzing getest. Syntax, CSS, reproduceerbare build en diffcontrole slagen. Alleen de bestaande CSS-tokenmelding `--line` blijft aanwezig.

De actuele financiële reconstructie is uitsluitend gelezen en in geheugen berekend. De privébedragen en het volledige onderzoeksverslag zijn buiten deze openbare repository bewaard. Er zijn geen productiegegevenswrites of echte bank-API-acties uitgevoerd.
