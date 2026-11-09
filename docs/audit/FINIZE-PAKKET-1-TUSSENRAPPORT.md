# Pakket 1 — tussenrapport en stopmoment

**Historische tussenstand.** De gebruiker heeft het hieronder gevraagde gerichte kapitaalherstel daarna expliciet goedgekeurd. Het herstel en de overige fasen van pakket 1 zijn vervolgens uitgevoerd; zie [het afgeronde pakketverslag](FINIZE-PAKKET-1-HERSTELVERSLAG.md) voor de actuele status. De oorspronkelijke observatie over de ledgercorrectie is daar gepreciseerd: de zichtbare kapitaalverlaging ontstaat bij de eerste opslag; de ledgercorrectie bij opnieuw opslaan.

Datum: 6 november 2026. Pakket 1 is nog niet afgerond. Fase 1.2 en 1.3 zijn niet gestart. Pakket 2 en 3 zijn niet gestart.

## Geïsoleerde werkomgeving

- Zelfstandige clone: `C:\Users\dionv\Documents\Codex\Finize-herstel-pakket1-20261106`.
- Bron: actuele GitHub `Dionvs/Finize`, `main` op `7a7d72e25660975ba88269e7835b98d32858ada5`.
- Werkbranch: `herstel/pakket1-financiele-bugs`.
- De clone had vóór het toevoegen van tests een schone werkboom. Er is niet geput uit de lokale wijzigingen van de Google Drive-werkmap.
- De zes gewijzigde gevolgde bestanden daar zijn `app.css`, `app.js`, `index.html`, `src/styles/dashboard-p3.css`, `src/ui/dashboard.mjs`, `tests/browser/v118-p3-dashboard.spec.cjs`. Hun SHA-256-vingerafdrukken zijn afzonderlijk vastgelegd en bij het stopmoment opnieuw vergeleken.
- De bestaande Google Drive-indexlock is niet verwijderd of hersteld. Er is niet gepubliceerd, gemerged of gepusht.

## Fase 1.1 — oorspronkelijke B1

De fout bestaat nog op de actuele GitHub-commit. `normalizeProductSnapshot` converteert onder andere `null`, lege strings, booleans en lege arrays met `Number(...)` naar een getal. Bij herhaald normaliseren kan een ontbrekende prijs zo een geldige nulprijs lijken. `applyProductSnapshot` schrijft die vervolgens naar het subdoelbedrag.

De nieuwe regressietest met bestaand doelbedrag € 150 faalt vóór herstel ook in de browser: na een product zonder prijs staat het invoerveld op € 0.

### Toegepaste minimale wijziging

Alleen `src/goals/product-link.mjs`, functie `normalizeProductSnapshot`, is functioneel gewijzigd:

```js
const hasPrice=typeof value.price==='number'||(typeof value.price==='string'&&value.price.trim()!=='');
const price=hasPrice?Number(value.price):NaN;
```

De bestaande controle op een eindig, niet-negatief getal blijft behouden. Daardoor blijven ontbrekende/ongeldige prijzen `null`, ook na herhaald normaliseren. Expliciete numerieke nul en string `"0"` blijven echte prijzen. De bestaande valuta- en automatische-aanvulregels zijn niet veranderd.

De normale build heeft dezelfde correctie verwerkt in `app.js` en het inline script in `index.html`. Er zijn geen CSS-regels, datamodellen, spaarverdelingsregels of opslagregels gewijzigd.

### Toegevoegde tests en resultaten

| Controle | Vóór | Huidige stand |
|---|---:|---:|
| Nieuwe prijs-unitgevallen | 7 geslaagd, 15 mislukt | 22 geslaagd, 0 mislukt |
| Vier bestaande gerichte testbestanden | 23 tests geslaagd | 23 tests geslaagd |
| Browserreproductie oorspronkelijke ontbrekende prijs | 0 geslaagd, 1 mislukt | Opgenomen in onderstaande geslaagde gevallen |
| Nieuwe browsergevallen plus bestaande productlinktest | Niet volledig uitgevoerd vóór herstel | 12 geslaagd, 4 mislukt |

De unitgevallen omvatten ontbrekend, `null`, leeg, witruimte, tekst, NaN, oneindig, negatief, booleans, arrays en objecten; daarnaast geldige numerieke prijzen, nulprijzen, buitenlandse valuta, ophalen met mocks, herhaald normaliseren en JSON-opslag.

De geslaagde browsergevallen controleren ontbrekende/lege/ongeldige prijzen, geen productlink, nieuw doel, desktop-tabelbewerker en de bestaande geldige productlinkroute. Ze gebruiken de echte lokale app, met externe verzoeken geblokkeerd en productmetadata nagebootst. Bij ontbrekende prijs blijven zowel € 150 als de berekende resterende bedragen en spaarverdeling behouden. Opslaan, herladen en opnieuw opslaan zijn meegenomen.

Bij het opstellen van de nieuwe fixture is eerst een verschil tussen het doelvermogen en het bestaande opening-ledger gecorrigeerd in uitsluitend de nieuwe testfixture. De financiële assertions zijn behouden. De vier onderstaande mislukkingen blijven daarna bestaan met een consistent beginsaldo.

## Onverwacht financieel probleem — expliciete geldige prijs lager dan gespaard saldo

Dit probleem blokkeert het goedkeuren van fase 1.1. Er is geen aanvullende applicatiereparatie voor uitgevoerd.

### Reproductie

1. Open een bestaand fictief doel met doelbedrag € 150 en daadwerkelijk gespaard saldo € 100. Het opening-ledger bevat eveneens € 100.
2. Laat het veld 'Al gespaard' ongemoeid.
3. Voeg een productlink toe met een expliciete geldige prijs van € 49,95.
4. Sla het doel op.
5. De app voegt een als `manual-correction` gelabelde ledgercorrectie van **−€ 50,05** toe, met `balanceBefore: 100` en `balanceAfter: 49.95`.

Bij een expliciete nulprijs verschijnt een correctie van **−€ 100**, met `balanceAfter: 0`. Beide gevallen zijn op **390 en 1440 px** aangetoond: vier mislukte browsergevallen.

### Beoordeling en technische afbakening

Het automatisch aanvullen van een geldig productdoelbedrag behoort tot de bestaande functionaliteit. Het verlagen van het gespaarde kapitaal terwijl de gebruiker dat veld niet wijzigt is een afzonderlijke financiële bijwerking die eerst beoordeeld moet worden.

De onderzochte route loopt via `openMobileGoalEditor`, `modal.finizeGoalEdit`, `u2NormalizeChildren`, `u2SetGoalSavedAmount` en de bestaande kapitaal-/ledgerverwerking. De normalisatie begrenst subdoelsaldi op hun doelbedrag; in de opgeslagen uitkomst volgt daarna een kapitaalcorrectie. De precieze kleinste herstelplaats moet bij toestemming verder worden geïsoleerd. Deze opslag- en normalisatiecode is in deze fase niet gewijzigd.

De nieuwe prijscontrole verandert de behandeling van geldige € 49,95- en nulprijzen niet. Dit is daarom geen aanwijzing dat de ontbrekende-prijsfix zelf deze bijwerking introduceert; een afzonderlijke vergelijking op de basiscommit moet dat bij vervolgonderzoek expliciet vastleggen.

### Gevraagde beslissing

Mag fase 1.1 gericht worden uitgebreid om deze onbedoelde kapitaalverlaging bij automatisch bijgewerkte productprijzen te onderzoeken en te herstellen? Uitgangspunt: alleen het doelbedrag mag door een geldige prijs veranderen; een niet door de gebruiker gewijzigd gespaard saldo moet behouden blijven. De juiste verwerking van eventueel overschot boven het nieuwe doelbedrag moet aansluiten bij het bestaande kapitaalmodel.

Tot dit besluit zijn fase 1.2 en 1.3 geblokkeerd. Het alternatief is de huidige beperkte B1-fix als onvolledige tussenstand te laten staan en het aanvullende probleem apart te behandelen. Er wordt geen geslaagde pakketacceptatie geclaimd.

## Bestanden en bewijs

- Functioneel gewijzigd: `src/goals/product-link.mjs`.
- Gegenereerd: `app.js`, inline JavaScript in `index.html`.
- Nieuw: `tests/product-price-preservation.test.cjs`.
- Nieuw: `tests/browser/pakket1-product-price.spec.cjs`.
- Dit tussenrapport.
- Lokale logbestanden en browserresultaten: `.cache/pakket1/`, waaronder `b1-unit-before.log`, `b1-unit-after.log`, `b1-existing-before.log`, `b1-browser-before.json`, `b1-browser-after.json`.
- De tijdelijke browserconfiguratie gebruikt een aparte lokale poort en geblokkeerde productieverbindingen; de bestaande projectconfiguratie is niet gewijzigd.

Er zijn nog geen commits gemaakt: de fase is niet geaccepteerd en de vier financiële assertions blijven rood staan. De wijziging en tests blijven als controleerbare werkboomdiff op de geïsoleerde herstelbranch bewaard.

## Bescherming en beperkingen

Geen productiegegevens gebruikt of gewijzigd. Geen echte banktransacties, banksynchronisaties, Firestore-operaties, datamigraties of beveiligingsregelwijzigingen uitgevoerd. De geconstateerde saldowijzigingen bestaan uitsluitend in afzonderlijke lokale browsercontexten met fictieve fixtures.

Niet uitgevoerd: B2-herstel, integrale pakketcontrole, volledige regressiesuite, emulatorcontrole en publicatie. Het volledige eindrapport voor pakket 1 volgt pas na hervatting en succesvolle afronding van alle fasen.
