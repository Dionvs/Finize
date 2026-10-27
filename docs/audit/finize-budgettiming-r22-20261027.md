# Finize — correctie timing maandbudget (opdracht r20, release r22)

27 oktober 2026. Gerichte vervolgcorrectie op [het r19-rapport](finize-liquiditeit-spaarcapaciteit-r19-20261027.md), geen volledige audit. Vergelijkingsbasis: exact `7fc20db19cd0ed9638bbd3c669946d973cc84bb8`. Implementatiebasis: schone `origin/main`, `7a6c48d9092f76a9245c06545728c8d9ada502ba` (r21). Werkbranch: `codex/v118-budgettiming`. De opdracht heet r20; de publicatie krijgt r22 om de reeds gepubliceerde r20/r21 en hun datum-/bankdekkingscorrecties te behouden.

## Oorzaak en gerichte wijziging

`selectMonthEndSavings` maakte een aparte `protectionDays`-lijn. Daarin selecteerde r19 elke budgetreservering waarvoor `reservation.month <= day.date.slice(0,7)` en trok het volledige restant van het concrete kassaldo af. Daardoor telde op 1 november ineens heel november mee, en op 1 december heel december. De gewone dagprognose verdeelde dezelfde pot ondertussen al correct over de kalenderdagen.

De financiële wijziging is beperkt tot de cumulatieve budgetregel in `src/core/daily-liquidity.mjs`. Deze sommeert nu de bestaande `day.estimatedBudgetCents` uit `projectDailyLiquidity`. Er is geen tweede reservering en geen nieuwe verdeelmethode.

Oud: `beschermdSaldo(d) = concreteKas(d) - som(volledige restpotten t/m maand(d)) - ongedateerdeBescherming(d)`.

Nieuw: `beschermdSaldo(d) = concreteKas(d) - som(dagbudgetschattingen t/m d) - ongedateerdeBescherming(d)`.

Het oplossen van het maximale spaarbedrag blijft gelijk. `E` is het beschermde saldo op de geselecteerde maandultimo; `minimumVerandering` is het laagste verschil ten opzichte van `E` op alle volgende gecontroleerde dagen, met maximaal nul. `nodig = buffer - minimumVerandering`; `veilig = max(0, E - nodig)`. De geselecteerde overboeking wordt na de kasstromen van maandultimo verondersteld. Deze eindedagberekening bewijst geen intradagvolgorde.

De bedragen blijven exacte gehele centen, met de bestaande verdeling van de restcenten over de eerste dagen. Budgetaggregatie blijft `max(0, totaalBudget - totaalBesteed)` per maand, eigenaar en fysieke rekening. Het r19-scenario blijft €1.150,00 − €1.114,54 = **€35,46**, niet €239,95. Refunds, fysieke rekeningtoewijzing en budgetactuals zijn niet aangepast.

## Exact dezelfde synthetische invoer voor beide versies

Saldo-ijkpunt op 26 oktober: €10.000. Resterend oktoberbudget €1.150; november- en decemberbudget elk €1.150. November en december: salaris €2.000 op de 5e, €1.000 op de 24e; vaste lasten €1.800 op de 1e en €100 op de 25e. In oktober zijn salarissen expliciet nul en beginnen deze lasten nog niet. Buffer €200; informatief spaarplan oktober €500. Geen echte gebruikersgegevens.

| Uitkomst | r19 | Correctie, r22 |
|---|---:|---:|
| Verwacht saldo 31 oktober | €8.850,00 | €8.850,00 |
| Nodig na 31 oktober, inclusief buffer | €3.200,00 | €2.198,40 |
| Veilig te sparen 31 oktober | €5.650,00 | **€6.651,60** |
| Extra ruimte bij plan €500 | €5.150,00 | €6.151,60 |
| Einde controle | 5 december | 5 december |

In dit scenario is het verschil van **€1.001,60 volledig toe te schrijven aan budgettiming**: dezelfde invoer, dezelfde daggrafiek, salarissen, kasstromen en buffer. De fout was dus reproduceerbaar aanwezig zonder productiegegevens op te halen.

De aangeleverde actuele UI-bedragen (€2.660,55, €3.499,91, €200 en €0) zijn geen bewaarde, complete invoerrevisie. Dit onderzoek reconstrueert die bedragen niet en bewijst niet welk deel van dat specifieke verschil door timing komt. Ook de oude €23/€43,59 worden niet verondersteld nog ongedateerd te zijn. Productie is niet gelezen of gewijzigd.

## Vergelijking per dag

De volledige vergelijking staat in [CSV](finize-budgettiming-r19-r22-20261027.csv) en [JSON](finize-budgettiming-r19-r22-20261027.json): **82 regels**, twee versies voor alle 41 dagen van 26 oktober t/m 5 december. De kolommen bevatten datum, beginsaldo, concrete inkomsten/uitgaven, dagbudget, cumulatieve dagbudgetten, feitelijke budgetbeschermingsaftrek, cumulatieve budgetbescherming, concrete kas, gewone dagprognose, beschermde prognose, buffer, dagruimte, maximaal veilige overboeking en saldo na die overboeking. Alle getallen zijn eurocenten. Dagruimte is alleen de ruimte op die dag; het maximum over te boeken bedrag wordt door het minimum over de hele controleperiode begrensd.

In r19 is `budgetProtectionDebitCents` op 1 november en 1 december **115000**; na correctie respectievelijk **3834** en **3710**. De gewone daggrafieklijn is voor beide versies op iedere dag gelijk. De beschermingslijn voor veilig sparen verandert.

Onderstaande selectie toont beschermde saldi vóór de hypothetische overboeking en het nieuwe saldo erna. Cumulatieve schatting omvat oktober en alle daarna gecontroleerde dagen.

| Datum | r19 beschermd | Nieuw beschermd | Dagbudget nieuw | Cumulatieve schatting | Nieuw na €6.651,60 sparen |
|---|---:|---:|---:|---:|---:|
| 31 okt | €8.850,00 | €8.850,00 | €230,00 | €1.150,00 | €2.198,40 |
| 1 nov | €5.900,00 | €7.011,66 | €38,34 | €1.188,34 | €360,06 |
| 4 nov | €5.900,00 | €6.896,64 | €38,34 | €1.303,36 | €245,04 |
| 5 nov | €7.900,00 | €8.858,30 | €38,34 | €1.341,70 | €2.206,70 |
| 24 nov | €8.900,00 | €9.129,98 | €38,33 | €2.070,02 | €2.478,38 |
| 25 nov | €8.800,00 | €8.991,65 | €38,33 | €2.108,35 | €2.340,05 |
| 30 nov | €8.800,00 | €8.800,00 | €38,33 | €2.300,00 | €2.148,40 |
| 1 dec | €5.850,00 | €6.962,90 | €37,10 | €2.337,10 | €311,30 |
| 4 dec | €5.850,00 | €6.851,60 | €37,10 | €2.448,40 | **€200,00** |
| 5 dec | €7.850,00 | €8.814,50 | €37,10 | €2.485,50 | €2.162,90 |

Beide salarissen zijn afzonderlijk getest als concrete gebeurtenissen: +200000 cent op 5 november en +100000 op 24 november. De kas- en budgetlijn is daarnaast iedere dag vergeleken met een onafhankelijke integer-centberekening in `tests/helpers/budget-timing.cjs`. Die berekent de verwachte lijn zonder productieprojector of financiële selector. Elke dag vanaf de overboeking blijft minstens €200 over; één cent méér sparen doorbreekt op 4 december de buffer.

## Geen dubbele aftrek

Een werkelijke toekomstige budgetbetaling van €100 op 2 november verlaagt uitsluitend de novemberpot van €1.150 naar €1.050. De €100 staat eenmaal in de concrete kasstroom; de gespreide novemberuitgaven tellen op tot exact €1.050. Op 30 november is het totale beschermde saldo gelijk aan het scenario zonder die concrete vervanging.

De betaling valt vroeg in de maand. Daarom is het maximale veilige bedrag nu €6.610,00 in plaats van €6.651,60: het echte betaalmoment kan een striktere tussentijdse ondergrens geven dan een gelijkmatige schatting. Gelijke maandtotalen betekenen geen gelijke liquiditeit op iedere dag. De oude test die altijd gelijke spaarcapaciteit eiste is vervangen door dit kasstroombewijs.

Afzonderlijke regressies bewijzen dat uitgaven van een andere financiële eigenaar of fysieke rekening de gezamenlijke novemberpot niet verminderen, en dat een oktoberbetaling niet van november wordt afgetrokken. Bestaande terugbetalings-, categorie- en kapitaalkoppelingstests blijven slagen.

## December en de begrensde zekerheid

De bestaande horizonregel blijft intact: hele volgende maand, daarna tot en met de eerste relevante salaris-/zakgeldontvangst binnen de bestaande grens. Voor sparen op 31 oktober betekent dit volledige novemberdekking en een liquiditeitscontrole tot en met **5 december**.

Dat is voldoende voor dit bestaande, begrensde veiligheidscriterium, maar **bewijst geen dekking van heel december**. November verbruikt uiterlijk 30 november exact de volle €1.150. Van december telt t/m 5 december €185,50 mee; er wordt geen €1.150 op 1 december afgetrokken en het decemberbudget wordt niet over vijf dagen samengeperst. Bij een afzonderlijke prognose t/m 31 december telt de bestaande spreiding wel op tot exact €1.150.

Een aanvullende regressie plant een zeer grote overboeking op 20 december: deze verandert de controle tot 5 december niet, terwijl de afzonderlijke december-maandlijn wel negatief eindigt. Daarmee is de grens expliciet bewezen. Er wordt geen automatische horizonverlenging naar steeds nieuwe maanden ingevoerd. Een volledige decembergarantie is geen uitkomst van deze KPI; daarvoor is een nieuwe berekening met een passende maand en actuele gegevens nodig. De bestaande uitlegpopover vermeldt nu ook expliciet dat de rest van de gedeeltelijke eindmaand niet als gedekt is aangetoond. De kaart en layout zijn ongewijzigd.

## Gewijzigde bestanden en functies

- `src/core/daily-liquidity.mjs`: alleen budgetopbouw in `selectMonthEndSavings` en de toelichtende commentaarregel.
- `src/ui/dashboard.mjs`: alleen de noodzakelijke rekenuitleg in `calculationHelp`, inclusief de horizonbeperking; geen gewijzigde KPI-markup of CSS.
- `tests/month-end-budget-timing.test.cjs`, `tests/helpers/budget-timing.cjs`: regressies A–G, onafhankelijke daglijn, maandgrenzen, concrete betaling en rekening-/eigenaarisolatie.
- `tests/liquidity-budget-pot.test.cjs`: twee verwachtingen vervangen die juist het oude vroegtijdig reserveren vastlegden.
- `tests/browser/month-end-budget-timing.spec.cjs`: kaart, uitleg, planonafhankelijkheid, minimumkaart en schermbreedtes 320/390/430/1440.
- `scripts/compare-month-end-budget-timing.cjs`: reproduceerbare vergelijking met alle oorspronkelijke r19-bronnen uit Git en de actuele bron, inclusief assertions en CSV/JSON-export.
- `index.html`, `service-worker.js`, `app.js` en bestaande versietests: consistente release-/cachemarker `118-r22`; app.js reproduceerbaar gegenereerd. Geen inhoudelijke CSS-wijziging.
- `tests/browser/liquidity-pot-release.spec.cjs`: vastgepinde r21→r22-update, offlineproef en terugrol met behoud van financiële state en IndexedDB-bronbewijs.

`projectDailyLiquidity`, `buildLiquidityInput`, `financialForecastForMonth`, `budgetActual`, salarissen, zakgeldverdeling, bankadapters, Firestore en opslaglogica zijn inhoudelijk ongewijzigd. De r21-regel voor voorlopige bankdekking blijft gelden: een indicatief bedrag is zichtbaar met waarschuwing. Ontbrekende essentiële datumgegevens blijven blokkeren; datums worden niet ingevuld.

## Regressies en reproduceerbaarheid

Uitgevoerde gerichte Node-run: **44/44 geslaagd**, geen overgeslagen gevallen. Volledige Node-run: **85 testbestanden geslaagd**. De nieuwe A–G-controles vormen zes testgevallen; A/F is één volledige onafhankelijke dagvergelijking, G wordt daarnaast door bestaande suites afgedekt.

De volledige Node-run omvat totale budgetpot, laagste prognose, salarisdatums, zakgeldverdeling, vaste lasten, terugbetalingen, fysieke rekeningfilters, spaartransacties, informatieve KPI-vergelijkingen, bankdekking, ontbrekende betaaldatums en bron-/opslagregressies. Synthetische ontbrekende-datumtests zijn geen aanname over de huidige productiegegevens.

JavaScript-syntax, CSS-parser, reproduceerbare bundel en `git diff --check` slagen. De CSS-controle heeft alleen de al bestaande melding voor `--line`.

**55/55 browsercontroles geslaagd**, nul skips: nieuwe timing-/uitlegtests op 320/390/430/1440 px, bestaande KPI-/dekkingstests, P2/P3, vaste-lastenweergave, P7 en de echte lokale r21→r22-serviceworkerupdate, offlineproef en terugrol. Financiële state en IndexedDB-bronbewijs blijven behouden. Mobiele en desktopscreenshots zijn geopend en visueel gecontroleerd. Externe diensten zijn in de lokale proeven geblokkeerd; er is geen echte cloud- of bankactie uitgevoerd.

Een nuladvies betekent dat geen positieve overboeking onder de geteste kaslijn past. Het repareert geen bestaand tekort: een aanvullende test met te weinig beginsaldo toont terecht nul capaciteit én een al bestaande bufferbreuk. De prognose blijft afhankelijk van de ingevoerde plannen, werkelijk aanwezige transacties en geschatte budgettiming.

Reproduceer vanaf de repository-root:

```powershell
node --test tests/month-end-budget-timing.test.cjs tests/liquidity-budget-pot.test.cjs tests/month-end-savings.test.cjs
node scripts/compare-month-end-budget-timing.cjs
node scripts/run-node-tests.mjs
node scripts/build.mjs --check
node node_modules/@playwright/test/cli.js test tests/browser/month-end-budget-timing.spec.cjs tests/browser/month-end-savings.spec.cjs tests/browser/v118-p2-liquidity.spec.cjs tests/browser/v118-p3-dashboard.spec.cjs tests/browser/fixed-payment-progress.spec.cjs tests/browser/liquidity-pot-release.spec.cjs tests/browser/package7-release-audit.spec.cjs
```

De upgradeproef vereist de r21-shell uit commit `7a6c48d` in `.cache/budgettiming-previous-shell`; deze fixture was aanwezig bij de uitgevoerde releasecontrole. Zonder fixture meldt die test expliciet een skip. De vergelijkingsgenerator haalt uitsluitend Git-bronnen op en schrijft lokaal; geen bank- of cloudtoegang.

Er zijn nul productie-Firestorewijzigingen, nul echte banksynchronisaties en geen wijzigingen aan bestaande transacties, budgetbedragen, financiële eigenaren, betaalafspraken, rekeningen of koppelingen uitgevoerd.

## Commit en publicatiestatus

Implementatiecommit: `45e508d462c0721ba2806035e93a45a6601d06e7`. Branch `codex/v118-budgettiming` is gepusht en via fast-forward opgenomen in `main`. Release **V118-r22** staat live op [GitHub Pages](https://dionvs.github.io/Finize/). [Pages-run 40497707186](https://github.com/Dionvs/Finize/actions/runs/40497707186) is geslaagd.

Zeven openbare bestanden geven HTTP 200 en zijn SHA-256-identiek aan de implementatiecommit, inclusief app.js, index.html en service-worker.js. De CSS is byte-identiek aan r21. Vier aanvullende openbare browserproeven op 320/390/430/1440 px slagen: €6.651,60 capaciteit, onafhankelijk spaarplan, expliciete horizonbegrenzing, voorlopige bankdekking, blokkade bij ontbrekende betaaldatum, geen voortgangsteksten, geen horizontale overloop en geen paginafouten. De openbare mobiele screenshot is geopend.

Deze proeven gebruiken uitsluitend synthetische lokale accountgegevens. Alle externe origins en alle niet-leesverzoeken zijn geblokkeerd. Geen echte authenticatie-, cloud- of banksynchronisatieclaim. [Machineleesbaar publicatiebewijs](finize-budgettiming-r22-public-20261027.json). Dit bewijs en de definitieve rapportstatus worden als afzonderlijke documentatiecommit gepubliceerd; de geteste financiële bron en runtime blijven ongewijzigd.
