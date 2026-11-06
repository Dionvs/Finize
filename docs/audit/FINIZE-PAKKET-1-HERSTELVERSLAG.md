# FINIZE — Pakket 1: financieel herstel

**Status: pakket 1 afgerond; gestopt vóór pakket 2.**

Datum: 6 november 2026. De twee gerapporteerde bugs zijn lokaal hersteld. Het aanvullend ontdekte kapitaalprobleem is na expliciet akkoord eveneens gericht opgelost. De afsluitende controles slagen: **478 financiële/unit-/integratiegevallen in 22 bestanden en 35 browsergevallen**. Er is niets gepubliceerd en er zijn geen productiegegevens of bankverbindingen gewijzigd.

## 1. Nulmeting en isolatie

| Onderdeel | Vastgesteld |
|---|---|
| GitHub-bron | `https://github.com/Dionvs/Finize.git`, `main` |
| Basiscommit | `7a7d72e25660975ba88269e7835b98d32858ada5`, V118-r46 |
| Controle bij afronden | GitHub `main` staat nog op dezelfde commit |
| Zelfstandige clone | `C:\Users\dionv\Documents\Codex\Finize-herstel-pakket1-20261106` |
| Herstelbranch | `herstel/pakket1-financiele-bugs` |
| Initiële werkboom | Schoon; afhankelijkheden geïnstalleerd met de bestaande lockfile |
| Bestaande werkmap | Google Drive-werkmap niet gebruikt als wijzigingsbron en niet aangepast |

De Google Drive-werkmap stond op een oudere lokale commit en bevatte zes gewijzigde gevolgde bestanden. Die wijzigingen zijn niet meegenomen, overschreven, teruggedraaid of verwijderd. Hun SHA-256 is vóór en na het traject vergeleken:

- `app.css`
- `app.js`
- `index.html`
- `src/styles/dashboard-p3.css`
- `src/ui/dashboard.mjs`
- `tests/browser/v118-p3-dashboard.spec.cjs`

**Alle zes zijn exact gelijk gebleven.** De daar aanwezige niet-gevolgde mappen zijn niet bewerkt. De eerder vastgelopen worktree en Git-indexlock zijn niet hersteld of verwijderd. De nieuwe clone heeft een zelfstandige `.git`-map.

De bevindingen zijn opnieuw in de actuele code onderzocht. Zowel de prijsconversie van B1 als de weekberekening van B2 waren nog aanwezig. Voor de uitgebreide vergelijking is ook een onveranderde export van de basiscommit onder de genegeerde lokale bewijsmap gemaakt; deze komt rechtstreeks uit Git.

## 2. Fase 1.1 — B1: ontbrekende productprijs

### Technische oorzaak

`normalizeProductSnapshot` gebruikte rechtstreeks `Number(value.price)`. Onder andere `null`, een lege string, booleans en een lege array kunnen daarmee een getal worden. Vooral bij de tweede normalisatie — tijdens `applyProductSnapshot` — veranderde een ontbrekende prijs van `null` naar `0`. De bestaande automatische prijsaanvulling schreef die nul vervolgens naar het doelbedrag.

Dit gebeurt in de gedeelde productmodule. Deze wordt gebruikt door de subdoelbewerker, de desktop-tabelbewerker en het normaliseren van opgeslagen productinformatie.

### Kleinste correctie

`src/goals/product-link.mjs`, functie `normalizeProductSnapshot`, accepteert vóór conversie alleen een getal of een niet-lege string. De bestaande controle op eindige, niet-negatieve bedragen blijft staan. Ontbrekend of ongeldig blijft zo `null`, ook na herhaald normaliseren of JSON-opslag.

De afspraken voor geldige prijzen blijven gelijk:

- Een geldige europrijs of prijs zonder valutacode mag het productdoelbedrag automatisch aanvullen.
- Expliciet `0` en `"0"` blijven geldige nulprijzen.
- Een buitenlandse valuta overschrijft geen eurodoel.
- Een ontbrekende, lege of ongeldige prijs behoudt het handmatig ingestelde doelbedrag.
- Handmatig gekozen namen behouden het bestaande gedrag.

### Aanvullend kapitaalprobleem en toestemming

De uitgebreidere browsercontrole ontdekte een afzonderlijke bijwerking. Bij een doel van € 150 met € 100 gespaard en een geldige nieuwe productprijs van € 49,95 werd het zichtbare gespaarde saldo verlaagd. Na herladen en opnieuw opslaan volgde een ledgercorrectie van −€ 50,05. Bij een expliciete nulprijs was de correctie −€ 100.

Het tussenrapport beschreef dit aanvankelijk als één opslagstap. De verdere analyse preciseert de volgorde:

1. `modal.finizeGoalEdit` normaliseert subdoelen en produceert afgeleide velden, waaronder `algespaard`.
2. De opgeslagen subdoeltoewijzing wordt begrensd op het nieuwe doelbedrag.
3. De save-handler nam het afgeleide `algespaard` over het echte totaalsaldo heen over.
4. De gevraagde saldocorrectie was bij de eerste opslag een no-op omdat het ledger al € 100 bevatte; het onjuist verlaagde zichtbare saldo bleef zo bestaan.
5. Bij opnieuw opslaan werd dát verlaagde saldo als een handmatige correctie aangeboden.

De gebruiker heeft vervolgens expliciet opgedragen: **“Ja behoud het gespaard kapitaal. En ga verder.”**

De save-handler in `src/core/runtime.js`, `openMobileGoalEditor`, zet daarom het expliciet gelezen veld ‘Al gespaard’ als laatste in de wijzigingen:

```js
Object.assign(current,changes,{algespaard:savedAmount});
```

Daarna blijven de bestaande subdoelnormalisatie en ledgerverwerking hun werk doen. Het bestaande kapitaalmodel bewaart het volledige doelvermogen ook als subdoelen al gevuld zijn; geld boven een verlaagd doelbedrag verdwijnt daardoor niet. Er is geen nieuwe geldpot, verdeelregel of dataveld toegevoegd.

Een bewust door de gebruiker gewijzigde spaarstand blijft werken: de extra browsertests controleren op mobiel én desktop dat € 100 naar € 75 precies één ledgercorrectie van −€ 25 oplevert.

### Bewijs en acceptatie B1

| Geval | Uitkomst na herstel |
|---|---|
| Bestaand doel € 150, prijs ontbreekt | € 150 behouden |
| Bestaand doel € 150, lege prijs | € 150 behouden |
| Bestaand doel € 150, ongeldige prijs | € 150 behouden |
| Geldige productprijs | Bestaande automatische aanvulling werkt |
| Expliciete nulprijs | Doelbedrag mag nul worden; gespaard kapitaal blijft € 100 |
| Geen productlink | Bedrag en kapitaal blijven gelijk |
| Opslaan, herladen, heropenen, opnieuw opslaan | Bedragen blijven correct, geen ongewenste ledgercorrectie |
| Nieuw doel met handmatig subdoelbedrag | Ontbrekende productprijs wist het bedrag niet |
| Desktop-tabelbewerker | Zelfde bescherming via gedeelde prijsnormalisatie |
| Resterend doelbedrag en verdeling bij ontbrekende prijs | Exact gelijk aan vóór de bewerking |
| Historie, ledger en transacties bij ongewijzigd kapitaal | Ongewijzigd in de gecontroleerde browsergevallen |
| Bewuste handmatige saldocorrectie | Bestaande verwerking behouden |

Voor de nieuwe prijs-unitgevallen was de nulmeting **7 geslaagd / 15 mislukt**. Na herstel slagen alle **22**. De oorspronkelijke browserreproductie van de ontbrekende prijs faalde vóór herstel aantoonbaar met € 0 in plaats van € 150.

Na de eerste prijsfix bleven vier kapitaalgevallen rood. Na het goedgekeurde kapitaalherstel slagen ook die, en de twee controles voor expliciete handmatige saldocorrectie. Deze gevallen zitten allemaal in de afsluitende browserrun.

## 3. Fase 1.2 — B2: kalenderweken en tijdwisseling

### Technische oorzaak

`src/core/recurring-occurrences.mjs`, functie `u3OccurrenceDates`, bouwde wekelijkse datums met `start.getTime() + index * 7 * 86400000`. De maandgrenzen waren lokale datums om 12:00. Na een tijdwisseling lag een volgende gebeurtenis om 11:00 of 13:00. Daardoor kon een datum net buiten de eerste of laatste maandgrens vallen.

De gedeelde `plannedOccurrences` wordt onder meer gebruikt door de maandprognose, dagprognose en validatie van transacties tegen geplande vaste lasten. Die afnemers hebben geen afzonderlijke financiële reparatie gekregen: ze ontvangen nu de juiste kalenderdatums uit dezelfde bron.

### Kleinste correctie

Wekelijkse herhaling gebruikt nu `Date.setDate` met een aantal kalenderdagen. De lokale ankerdag en referentietijd blijven behouden. Voor het efficiënt overslaan van oude weken wordt een UTC-kalenderdagnummer gebruikt; dat nummer bepaalt alleen de beginindex, niet het tijdstip van de uitvoering.

De maand-/jaarherhaling en de bestaande bedrag- en configuratietijdlijn zijn niet gewijzigd.

Andere gevonden millisecondeberekeningen zijn beoordeeld op relevantie. Bankretentietermijnen, UTC-bankzoekperioden en de afstandsfunctie voor importvergelijkingen zijn geen tweede wekelijkse planner. Zij zijn ongemoeid gelaten.

### Verplichte datumgevallen

De 72 nieuwe Node-gevallen controleren:

- 25 oktober 2026 en de volgende uitvoering op 1 november.
- Een anker vóór de wintertijdwisseling: 18 oktober 2026.
- Zomertijd maart 2027, inclusief 31 maart voor een woensdagse last.
- Wintertijd oktober 2027 en de maandagse grens op 1 november.
- Gewone weken, alle zeven weekdagen en meerdere maanden via een onafhankelijke kalenderoracle.
- December naar januari.
- Maanden van 28, 29, 30 en 31 dagen.
- Tweewekelijkse herhaling en een inclusieve einddatum op een tijdwisselingsdag.
- Maandelijkse eindedagmaandverankering en jaarlijkse schrikkeldagverankering.
- Geen dubbele of ontbrekende datums.
- Wijzigingen vanaf november die eerdere financiële maandregels gelijk laten.
- Gecombineerde effecten op maandlasten, laagste saldo en Veilig te sparen.

De tests bewijzen expliciet dat de gebruikte Node-tijdzone de Amsterdamse zomer- en wintertijd toepast. De browsercontroles gebruiken daarnaast expliciet `timezoneId: 'Europe/Amsterdam'` en testen de werkelijk gebundelde app.

### Financiële vergelijking op vaste fictieve gegevens

Beginsaldo € 1.000 op 31 oktober, geen inkomsten/budgetten, een wekelijkse last van € 10 vanaf de novemberplanning, buffer € 200:

| Uitkomst | Vóór | Na | Verklaring |
|---|---:|---:|---|
| Novemberuitvoeringen | 4 | 5 | 1 november ontbreekt niet meer |
| Novemberlasten | € 40 | € 50 | Eén last van € 10 terug in de planning |
| Laagste verwachte saldo | € 960 | € 950 | Dezelfde extra betaling |
| Benodigd openingssaldo volgende maand | € 240 | € 250 | € 200 buffer plus juiste lasten |
| Veilig te sparen op 31 oktober | € 760 | € 750 | Juiste novemberverplichtingen worden beschermd |

Daarnaast zijn vijf maandelijkse controledatasets vóór en na de weekcorrectie exact vergeleken. Hun maandprognose en waarden voor eindsaldo, vereist openingssaldo en Veilig te sparen zijn ongewijzigd. De lagere veilige spaarcapaciteit hierboven is een bedoelde correctie, geen nieuwe reserveringsregel.

### Historie

Selectors wijzigen de onderzochte state niet. Een opgeslagen afgesloten maand blijft byte-voor-byte gelijk in de gerichte controle. Een nieuwe bedragwijziging vanaf november behoudt de financiële septemberregels. Er is geen opgeslagen historie herschreven.

Een opnieuw berekende historische weekplanning kan voortaan een eerder onterecht ontbrekende datum wél bevatten. Dat is de kalendercorrectie; het is geen terugwerkende wijziging van gebruikersinstellingen of opgeslagen maandafsluitingen.

## 4. Fase 1.3 — integrale controle

De relevante bestaande Node-bestanden zijn zowel op de originele Git-commit als na herstel uitgevoerd. Op de basiscommit zijn de 20 geselecteerde bestaande bestanden **384/384 groen**. Met de twee nieuwe bestanden erbij zijn de 22 bestanden **478/478 groen**: 94 nieuwe gevallen, geen uitgeschakelde of afgezwakte bestaande financiële tests.

| Testgroep | Vóór herstel | Afsluitende stand |
|---|---|---|
| Bestaande geselecteerde financiële/unit-/integratiegevallen | 384 geslaagd, 0 mislukt | Behouden binnen de 478 geslaagde gevallen |
| Nieuwe B1-unitgevallen | 7 geslaagd, 15 mislukt | 22 geslaagd |
| Nieuwe B2-kalender-/financiële gevallen | 60 geslaagd, 12 mislukt | 72 geslaagd |
| Totaal geselecteerde Node-tests | 384 bestaande gevallen; nieuwe bugs apart rood gereproduceerd | **478 geslaagd, 0 mislukt, 0 overgeslagen** |
| Browsergevallen | Gerichte B1- en B2-reproducties rood; kapitaaluitbreiding 4 rood | **35 geslaagd, 0 mislukt, 0 overgeslagen** |
| Gegenereerde bestanden | Bestaande bronopbouw gebruikt | Reproduceerbaar en actueel |
| JavaScript-syntax | Bestaande levering met inline scripts | Geldig, inclusief beide inline scripts |
| CSS-parser | Bekende bestaande tokenwaarschuwing | Geldig; bestaande waarschuwing `--line` blijft |

De Node-selectie omvat doelen en spaarverdeling, spaarledger, vaste lasten, planningshistorie, transactieverwerking, terugbetalingen, persoonlijke maandtotalen, inkomsten, bank-/betaaldatum, budgetpot, laagste saldo en Veilig te sparen. De precieze bestanden staan in [pakket1-bewijs.json](pakket1-bewijs.json).

De zeven browserbestanden zijn:

1. `pakket1-product-price.spec.cjs`
2. `pakket1-weekly-calendar.spec.cjs`
3. `subgoal-product-link.spec.cjs`
4. `bootstrap-stability.spec.cjs`
5. `dynamic-html-security.spec.cjs`
6. `service-worker-upgrade.spec.cjs`
7. `bank-import-generation.spec.cjs`

Ze controleren onder andere nieuwe en bestaande doelen, beide save-routes, expliciete kapitaalcorrecties, herladen, financiële kaarten, handmatige goedkeuring, herhaalde bankmockupdates, generatie-/huishoudenisolatie en offline herladen. De gerichte nieuwe UI-controles lopen op **390 en 1440 px**; bestaande bankmockgevallen omvatten ook 320 en 430 px.

### Tijdelijke testomgeving

Voor de clone is poort 4191 gebruikt met een tijdelijke configuratie onder `.cache/pakket1/`, zonder een andere lokale appserver te hergebruiken. De bestaande bankmocktests hebben een bronmodule-route die poort 4173 noemt. Op de aparte poort gaf de standaardserver `.mjs` als niet-uitvoerbaar MIME-type terug: daardoor faalden aanvankelijk twaalf aanvullende bankgevallen bij de testopzet.

Alle twaalf zijn opnieuw uitgevoerd met een tijdelijke lokale server die `.mjs` als JavaScript serveert. Daarna is de hele selectie opnieuw uitgevoerd: **35/35 geslaagd**. Deze omgevingscorrectie staat uitsluitend in de genegeerde bewijsmap; bestaande projectconfiguratie, applicatieserver en banklogica zijn niet aangepast. De eerdere run is bewaard en telt niet als een geslaagde eindcontrole.

### UI-controle

De nieuwe browsergevallen openen en bedienen de daadwerkelijke lokale app. De dashboardbeelden op 390 en 1440 px zijn geopend en visueel bekeken. De B2-controle vindt geen horizontale pagina-overloop. Er zijn geen CSS-, navigatie- of schermmarkupwijzigingen aangebracht; alleen de bedoelde financiële bedragen en datums veranderen.

Dit is geen volledige visuele vergelijking van elk scherm of een test op fysieke telefoons.

## 5. Gewijzigde bestanden en commits

### `b8aa562` — Fix product price normalization and preserve saved goal capital

- `src/goals/product-link.mjs`: prijsnormalisatie.
- `src/core/runtime.js`: opgeslagen totaalvermogen behouden in de doel-save-handler.
- `app.js` en `index.html`: normale gegenereerde app-/inline-uitvoer.
- `tests/product-price-preservation.test.cjs`: 22 prijsgevallen.
- `tests/browser/pakket1-product-price.spec.cjs`: doelbedragen, kapitaal, beide bewerkroutes, herladen en expliciete saldocorrecties.

### `25a5850` — Schedule weekly expenses by local calendar days across DST

- `src/core/recurring-occurrences.mjs`: kalenderdagberekening voor weken.
- `app.js` en `index.html`: normale gegenereerde uitvoer.
- `tests/helpers/pakket1-weekly.cjs`: gedeelde fictieve gevallen en financiële fixture.
- `tests/weekly-calendar.test.cjs`: 72 datum-/financiële gevallen.
- `tests/browser/pakket1-weekly-calendar.spec.cjs`: gebundelde kalenderplanning en KPI's op mobiel en desktop.

Verslag en samengevat bewijs worden in een afzonderlijke documentatiecommit bewaard. Het eerdere tussenrapport blijft als historische tussenstand herkenbaar.

**Niet gewijzigd:** CSS, Firestore-regels, datamodellen/schema's, bankproviderconfiguratie, import-/goedkeuringsregels, CI-workflows, dependencies en PWA-cacheversies. De bestaande herkenning van handmatige transacties en banksaldi is niet uitgebreid of vervangen.

## 6. Bewijs en herhalen

Het compacte, gecommitte bewijs staat in [pakket1-bewijs.json](pakket1-bewijs.json). Ruwe logs, de Git-baseline-export, tijdelijke server/configuratie en screenshots staan lokaal onder `.cache/pakket1/`.

Relevante bestanden daar:

- `b1-unit-before.log`, `b1-unit-after.log`, `b1-browser-before.json`, `b1-browser-after.json`, `b1-browser-capital-after.json` en `b1-manual-correction.json`.
- `b2-unit-before.log`, `b2-unit-after.log`, `b2-browser-before.json`, `b2-browser-after.json`.
- `financial-baseline.log` en `financial-baseline-summary.json`.
- `financial-final.log` en `financial-final-summary.json`.
- `financial-before-b2.json` en `financial-after-b2.json`.
- `package1-browser-final.json`: run met MIME-probleem; niet de einduitslag.
- `package1-browser-final-fixed-server.json`: 35/35 afsluitende run.
- `google-drive-before.json` en `google-drive-final.json`.

De nieuwe regressiegevallen zijn zonder aparte productiestappen te herhalen:

```powershell
node --test tests/product-price-preservation.test.cjs tests/weekly-calendar.test.cjs
pnpm exec playwright test tests/browser/pakket1-product-price.spec.cjs tests/browser/pakket1-weekly-calendar.spec.cjs
pnpm run check:generated
pnpm run check:syntax
```

Gebruik voor een volledige herhaling van de hier gebruikte poort en bredere browserselectie de bewaarde tijdelijke configuratie. De financiële selectie en testbestanden zijn ook volledig opgenomen in het JSON-bewijs.

## 7. Productiegegevens en resterende grenzen

**Productiegegevens, bankrekeningen en bankverbindingen zijn ongemoeid gebleven.** Er zijn geen echte banksynchronisaties, echte banktransacties, destructieve Firestore-operaties, productiebeveiligingswijzigingen of datamigraties uitgevoerd. Tests gebruiken vaste fixtures, geïsoleerde browseropslag en mocks. Bestaande CSV-bronnen en goedkeuringsstatussen worden niet gemigreerd of automatisch verwerkt.

Er zijn geen dependency-updates, brede refactors, cacheoptimalisaties of CI-reparaties uitgevoerd. Pakket 2 en 3 zijn niet gestart.

Resterende beperkingen:

- Niet de volledige Node-/browsersuite is uitgevoerd. De bekende oude testproblemen en negen UI-onderzoekspunten uit de scan blijven onderwerp van pakket 2; dit verslag verklaart die niet opgelost.
- Geen volledige Firebase-emulatorrun, productiebankcontrole, fysieke telefoontest of upgrade tussen twee gepubliceerde releases uitgevoerd.
- De bestaande CSS-tokenwaarschuwing blijft staan; CSS is ongewijzigd.
- Bestaande gegevens die eventueel al door een eerdere productprijsfout zijn aangepast, zijn niet automatisch hersteld. Dat vereist afzonderlijk bronbewijs en toestemming.
- De wijzigingen staan alleen op de lokale herstelbranch. Publicatie, samenvoegen naar `main` en een nieuwe release zijn niet uitgevoerd.

## 8. Acceptatie en stop

1. **B1 opgelost:** ontbrekende/ongeldige prijzen wissen geen doelbedrag; expliciete geldige prijzen werken; opgeslagen kapitaal blijft behouden.
2. **B2 opgelost:** kalenderweken bevatten de juiste lokale datums; maandlasten, minimumsaldo en Veilig te sparen bevatten de teruggevonden uitvoering.
3. **Historie behouden:** geen herschreven maandafsluitingen, transacties of kapitaalhistorie in de gerichte controles.
4. **Gerichte controles geslaagd:** 478 Node-gevallen, 35 browsergevallen, build-/syntaxcontroles.
5. **Productie en bestaande werkmap beschermd:** geen productiemutaties; alle zes gecontroleerde Google Drive-bestanden gelijk.

**Pakket 1 stopt hier. Voor pakket 2 is eerst expliciet akkoord van de gebruiker nodig.** Het overkoepelende eindrapport over alle drie pakketten wordt pas na de afzonderlijk goedgekeurde volgende pakketten gemaakt.
