# Finize V118 — minimale UX-verbeteringen

Oplevering: 16 oktober 2026. Testpeildatum en synthetische financiële fixtures: 14 oktober 2026.

## A. Versiecontrole en werkgebied

- Branch: `impeccable-v118-ux-minimal`.
- Begincommit: `3f9b8859f4e4e1ebc5ed2e6ff1e915a71d3c2c9f` (V118-r3).
- Bij aanvang was de werkboom schoon. De lokale HEAD, GitHub `main` en de succesvolle Pages-build verwezen naar deze commit.
- De live `app.js` en `app.css` waren bytegelijk aan de lokale bestanden. `index.html` was gelijk na normalisatie van Windows-/Unix-regeleinden.
- Bij afronding is opnieuw bevestigd dat Pages nog deze begincommit publiceert.
- Er zijn geen wijzigingen naar GitHub gestuurd, gemerged of gepubliceerd. De implementatie staat lokaal, ongecommit op de aparte branch, klaar voor beoordeling.
- Geen gebruikersadministratie, productiedata, echte bankgegevens, Firestore-regels, database, migraties of cloudopslag aangepast.

Bronmap: `G:\Mijn Drive\Codex\financien\outputs\dion_dara_budget\webapp\github\Finize-live-repo`.

## B. Uitgevoerde verbeteringen

| Onderdeel | Status | Aanpak | Visuele impact en controle |
|---|---|---|---|
| Navigatienamen | Uitgevoerd | Namen afgeleid van de bestaande labels, ook wanneer CSS die labels verbergt; decoratieve iconen verborgen voor screenreaders | Geen gewijzigde navigatie-indeling; geen naamloze knoppen in de 35 axe-metingen |
| Dialoogfocus | Uitgevoerd | Gedeelde aanvulling op de bestaande vensters: beginfocus, Tab/Shift+Tab, inert achtergrond, Escape via bestaande sluitknop, focusherstel | Zelfde vensters en opslaghandlers; zichtbare focusring is bedoeld. Gewijzigde invoer vraagt bevestiging vóór weggooien; importconcepten houden hun bestaande sluitlogica |
| Kaart- en knopsemantiek | Uitgevoerd | Afzonderlijke native primaire knop in bestaande inkomens-, transactie- en doelkaarten, met secundaire acties erbuiten; zichtbare tekst in toegankelijke namen; budgetvoortgang met rol en waarden | Geen verschoven kaarten; inkomensbron en hoofdactie afzonderlijk getest; geen geneste interactieve kaarten in axe |
| Aanraakgebieden | Gedeeltelijk | Onzichtbare lokale uitbreiding van veilige klikgebieden; icoonafmetingen blijven gelijk | Vaste-lastenactie krijgt 44×44 px. Uitgaveacties krijgen extra ruimte zonder layoutgroei. Naburige bediening is op 320/390/430 px gecontroleerd |
| Contrast | Uitgevoerd binnen de onderzochte schermen | Donkerdere bestaande groen-, blauw- en teksttinten op de concrete elementen die onvoldoende contrast hadden | Geen globale kleurvariabelen gewijzigd; 0 contrastmeldingen in de 35 axe-metingen |
| Jaarlegenda | Uitgevoerd | Legenda en balken gebruiken dezelfde lokale kleurbronnen; maandgroepen hebben uitleesbare bedragen en toetsenbordfocus | Grafiektype, volgorde, maten en bedragen behouden |
| Prognosestatus | Uitgevoerd | Rekeningnaam zichtbaar; geen bestedingsruimte bij de bestaande nuluitkomst; indicatie blijft herkenbaar; rood accent bij nulruimte en negatieve prognose | Bestaande status- en rekenlogica behouden; tekortwaarschuwing blijft direct zichtbaar |
| Instellingen en back-up | Uitgevoerd | Begrijpelijkere hoofdteksten; technische cloudinformatie blijft uitklapbaar aanwezig; bestaand configuratieveld kreeg een verborgen label | Geen functies verplaatst of verwijderd; kortere tekstblokken mogen lokaal minder hoogte gebruiken |

### Bewust beperkte aanraakcorrecties

- De twee volgordepijlen staan direct boven elkaar. Alleen de horizontale klikruimte is vergroot; verticale vergroting zou de twee acties laten overlappen. Dit levert geen algemene 44×44-px-garantie op.
- De uitbreiding van de statusknop is bij breedtes onder 390 px uitgeschakeld. Een meting op 320 px vond overlap met de maandkiezer. Die uitbreiding is teruggedraaid; de oorspronkelijke afmetingen blijven daar behouden.
- Sommige mobiele uitgaveknoppen zijn door de bestaande kolombreedte minder dan 44 px breed. Hun klikgebied is veilig vergroot, zonder kolommen of kaartmaten aan te passen.

## C. Rustigere Vooruitblik en Saldo-ontwikkeling

Verwijderd uit de standaardweergave:

- De ondertitel “Je verwachte saldo en aankomende betalingen.”
- De uitklapregel “Hoe wordt Vrij na verplichtingen bepaald?” en de lange standaarduitleg.
- De lange eerste onvolledigheidsmelding onder de KPI's.
- De standaarduitleg over planning, bankboekingen en kleuren boven de saldografiek.
- “Ruimte boven spaardoel” en uitgebreide spaarberekeningsuitleg staan nu bij de relevante informatieknop.

Er zijn kleine informatieknoppen bij Vrij na verplichtingen, Huidig saldo, Laagste prognose, Buffer en Saldo-ontwikkeling. De uitleg opent door klik, aanraking of toetsenbord. Sluiten werkt via de sluitknop, Escape, dezelfde informatieknop of buitenklik. De native Popover API verzorgt light-dismiss; een beperkte fallback houdt de uitleg bereikbaar zonder die API. De vensters passen binnen de viewport en kunnen intern scrollen.

Direct zichtbaar gebleven:

- Alle vier KPI-bedragen en de minimumdatum.
- Gepland sparen en een korte waarschuwing wanneer extra uitgaven het spaardoel kunnen verlagen.
- De bestaande prognosestatus en indicatie, rekeningnaam en bruikbare instellingsacties.
- Het saldo met de datum van het bruikbare werkelijk ingevoerde saldo-ijkpunt. Er wordt niet ten onrechte “automatisch bijgewerkt” of “door de bank bevestigd” beweerd.
- Tekorten onder nul of onder de buffer, met datum en bedrag.
- Saldo-ijkpuntverschillen en de gevolgen voor de lijn.
- Periode, grafiek, legenda, minimumindicator, bufferlijn, dagkeuze en bestaande datumdetails.

### Dynamische oorzaken

`src/ui/liquidity-explanations.mjs` vertaalt uitsluitend codes die de bestaande prognose al teruggeeft. Het bestand berekent geen bedragen, voegt geen financiële controles toe en slaat geen uitleg op.

De presentatie ondersteunt onder meer:

- Geen bruikbaar banksaldo: voer saldo en datum in.
- Geen beginsaldo vóór de periode: voeg een eerder saldo met datum toe.
- Ontbrekende ontvangst-/betaaldatum: controleer betaalmomenten of kies een einddatum.
- Onduidelijke betaalrekening of budgetrekening: controleer rekeningkeuze/primair account.
- Onvolledige bankdekking of ontbrekende maanden: controleer importperiode/maandgegevens en werk het saldo bij.
- Bankmutaties die nog moeten worden nagekeken of waarvan bron, bedrag of boekingsstatus niet bruikbaar is.
- Ambigue koppelingen tussen bankmutaties, vaste lasten, inkomsten en zakgeld.
- Ongeldige of tegenstrijdige saldo-ijkpunthistorie.
- Onbeschikbare financiële gegevens, tegenstrijdige gebeurtenissen of een dubbele reservering.

Per gemelde code staan probleem, gevolg, oplossingsstap en een bestaande vervolgrichting bij elkaar. Meerdere gebeurtenissen met dezelfde oorzaak worden als één oorzaak gegroepeerd. Technische bronmelding en code blijven in technische details beschikbaar. Voor onbekende codes meldt de UI eerlijk dat de precieze oorzaak onbekend is. Er zijn geen nieuwe statussen “Geschat” of “Compleet” aan de financiële motor toegevoegd.

Bij de bestaande herberekening worden de informatievensters opnieuw uit de actuele projectie opgebouwd. Een test bevestigt dat de melding over ontbrekend saldo verdwijnt zodra dit is ingevoerd. Een synthetische prognose met eerder saldo en volledige bankdekking houdt de bestaande status `projected` en krijgt geen verzonnen onvolledigheidsreden.

## D. Visuele vergelijking

Bewijsmap:

`C:\Users\dionv\.codex\visualizations\2026\10\14\01a13bd8-f040-7e83-914c-d8ed8d96a5f1\finize-ux`

Er zijn **120 gelijke voor-/na-beeldparen** automatisch vergeleken, plus de nieuwe geopende informatievensters. De opnames gebruiken 320, 390, 430, 768, 1024 en 1440 × 900 px, dezelfde synthetische fixtures en dezelfde financiële peildatum. Ze omvatten hoofdtabs, beide Vooruitblik-contexten, onbekende/later aangevangen/negatieve/volledig bruikbare prognoses, transactie-, budget- en spaardoelvensters, bankimport, importcontrole, login, registratie en accountinstellingen.

Geometrievergelijking bevestigt op alle zes breedtes **0 px verandering** in de gemeten kaart- en vensterposities/-maten van Gezamenlijk, Dion, Dara, Spaardoelen, transactie-invoer, budgetbewerking en spaardoelbewerking. Op alle vergeleken pagina's is geen nieuwe horizontale overflow gevonden.

Toegestane zichtbare verschillen:

- Donkerdere tekst en knoppen, correcte legendakleur en zichtbare toetsenbordfocus.
- Kleine informatieknoppen en compactere uitleg.
- Rekeningnaam, concrete saldodatum en duidelijkere nulruimte-/tekortpresentatie.
- Minder hoogte voor uitleg op het dashboard en in Data & back-up. Daardoor schuift daaropvolgende inhoud omhoog; de kaartvolgorde en kolomindeling blijven gelijk.
- In enkele mobiele KPI's breekt een titel met informatieknop eerder af. De bovenste kaarten blijven dezelfde twee-bij-twee-indeling gebruiken.

Niet doorgevoerd: nieuw ontwerp, tabelherstructurering, grotere mobiele tabelletters, andere periodefilters, andere importworkflow, nieuwe kaarten, globale spacingwijziging of financiële aanpassingen.

Bewijsbestanden: `comparison.json` (financieel/geometrie), `pixel-comparison.json` (beeldverschillen), `complete-comparison.json` (volledig bruikbare projecties), `axe-current.json` (35 metingen), `before/` en `after/` (screenshots). De drie `voor-na-dashboard-*.png`-bestanden tonen representatieve vergelijkingen op 390, 768 en 1440 px.

## E. Tests en beperkingen

### Uitgevoerde controles

- JavaScript-syntax geldig; CSS geldig, met de al bestaande waarschuwing voor het ongedefinieerde token `--line`.
- `app.js` en `app.css` reproduceerbaar gegenereerd en gecontroleerd.
- Alle 72 Node-testbestanden uitgevoerd: **71 geslaagd, 1 bestaande fout**.
- Gerichte eindronde: **32/32 geslaagd** voor UX, dashboard en spaarruimte; gelogd in `.cache/impeccable-v118-final-focused.log`.
- Aanvullende controle na de laatste focusverfijning: **6/6 geslaagd**, inclusief terugkeer naar een opnieuw getekende kaart met gewijzigde tekst en terugkeer naar het info-icoon na een vervolgvenster. De twee nieuwe cases registreren ook JavaScriptfouten. Log: `.cache/impeccable-v118-focus-final.log`.
- Brede bestaande browserronde: **72 geslaagd, 9 fouten, 2 overgeslagen** van 83. Eén fout betrof een selector die na de goedgekeurde verplaatsing van uitleg een verborgen actie koos. Deze test kiest nu de zichtbare instellingsactie en is opnieuw getest.
- De overige acht browserfouten zijn afzonderlijk gereproduceerd met de ongewijzigde gepubliceerde `3f9b885`-assets, via een alleen-lezen testserver. Ze zijn niet stilzwijgend gerepareerd of als geslaagd geteld.
- 35 axe-metingen op 390, 768 en 1440 px, inclusief informatievenster, invoervensters, login en registratie: geen contrastfouten, naamloze knoppen, geneste interactie of zichtbare-tekst/naam-mismatches in de onderzochte toestanden.
- Nieuwe visuele rondes: geen opgevangen JavaScriptfouten; externe verzoeken geblokkeerd en serviceworkers uitgeschakeld.
- Een onderbroken ronde gaf `ERR_NETWORK_IO_SUSPENDED` tijdens navigatie na het onderbreken van de omgeving. Deze uitslag geldt niet als geslaagde eindcontrole; de gerichte eindronde is opnieuw gestart.

### Reeds bestaande testfouten

| Bestand | Bestaande fout op begincommit |
|---|---|
| `tests/update4-ui-structure.test.cjs` | Verwacht het oude `dashboard-year-overview`-element en tabeljaaroverzicht |
| `tests/browser/import-review-simplification.spec.cjs` | Eén goedkeuringscase verwacht dat een rij direct in Goedgekeurd verschijnt |
| `tests/browser/update6-account-navigation.spec.cjs` | Twee cases verwachten de oude favoriete-doelenpreview; één verwacht de oude inkomensbewerkknoppen op het dashboard |
| `tests/browser/v118-p2-liquidity.spec.cjs` | Probeert een inmiddels bestaande select met `.fill()` te bedienen |
| `tests/browser/v118-prognose-correctie.spec.cjs` | Drie cases verwachten hoverselectie buiten de huidige puntmarkeringen |

Dit is **geen volledig groene algemene regressiesuite**. De oudere verwachtingen zijn buiten deze UX-opdracht gelaten.

Resterende axe-best-practice-meldingen: ontbrekende zichtbare h1 op enkele tablet-/instellingenschermen, lege actie-kolomkoppen, kopvolgorde en niet-unieke landmarks in het spaardoeloverzicht. De zeer kleine mobiele spaardoeltabeltekst blijft eveneens bestaan; alleen het contrast is binnen deze opdracht aangepast.

Niet getest: echte cloudschrijfacties, echte accountaanmaak, productiedata, volledige emulatorregressie, fysieke iPhones/Safari, geopende mobiele schermtoetsenborden, oude browsers zonder Popover API en volledige WCAG-conformiteit.

## F. Financiële consistentie

Voor en na zijn per breedte de volledige scenarioresultaten, alle twaalf maandprojecties en drie dagelijkse rekeningprojecties diep vergeleken. Alle zes vergelijkingen zijn exact gelijk. Ook de zes aanvullende volledig bruikbare projecties zijn exact gelijk. Hiermee zijn onderliggende resultaten vergeleken, niet alleen afgeronde schermbedragen.

De financiële motor, classificatie, CSV-verwerking, duplicaatdetectie, splits, refunds, opslag- en synchronisatiemodules zijn niet gewijzigd. De wijzigingen in `src/core/runtime.js` betreffen renderteksten, ARIA, kaartbediening en eventdoorgifte.

## Gewijzigde bestanden en beoordeling

- `src/ui/dialog-accessibility.js`: vensterbediening.
- `src/ui/liquidity-explanations.mjs`: presentatie van bestaande oorzaken.
- `src/ui/dashboard.mjs`: info-iconen, tekst, KPI-bediening en jaarlegenda.
- `src/core/runtime.js`: navigatienamen, kaartsemantiek, voortgang en instellingen-/back-upteksten.
- `src/ui/presentation.js`: afzonderlijke primaire doelkaartknop.
- `src/styles/ux-minimal.css`: lokale correcties; bestaande stylesheets niet gerefactord.
- `src/app-entry.js`, `scripts/build.mjs`, `app.js`, `app.css`: opname en gegenereerde build.
- `tests/browser/helpers/v118-ux-fixture.cjs`, `tests/browser/v118-ux-minimal.spec.cjs`, `tests/v118-ux-explanations.test.cjs`: geïsoleerde fixtures en gerichte controles.
- `tests/browser/v118-p3-dashboard.spec.cjs`, `tests/browser/v118-vrij-spaardoel.spec.cjs`: verwachtingen aangepast aan uitleg op aanvraag; rekenasserties behouden.
- `scripts/capture-v118-ux.cjs`: reproduceerbare visuele en financiële vergelijking.
- Dit rapport.

Iedere bronwijziging is in de Git-diff te beoordelen en terug te draaien. Er is geen automatische vervolg- of publicatiestap uitgevoerd. Overnemen en publiceren vereisen expliciete goedkeuring.

Aanvulling 16 oktober 2026: de gebruiker heeft publicatie expliciet goedgekeurd. De back-up, nieuwe cacheversie en aanvullende releasecontroles staan in [V118-r4 release](v118-r4-release.md).

## Beelden openen

- [Voor/na dashboard op mobiel](C:/Users/dionv/.codex/visualizations/2026/10/14/01a13bd8-f040-7e83-914c-d8ed8d96a5f1/finize-ux/voor-na-dashboard-390.png)
- [Voor/na dashboard op tablet](C:/Users/dionv/.codex/visualizations/2026/10/14/01a13bd8-f040-7e83-914c-d8ed8d96a5f1/finize-ux/voor-na-dashboard-768.png)
- [Voor/na dashboard op desktop](C:/Users/dionv/.codex/visualizations/2026/10/14/01a13bd8-f040-7e83-914c-d8ed8d96a5f1/finize-ux/voor-na-dashboard-1440.png)
- [Dynamische uitleg op mobiel](C:/Users/dionv/.codex/visualizations/2026/10/14/01a13bd8-f040-7e83-914c-d8ed8d96a5f1/finize-ux/after/390-informatie-minimum.png)
