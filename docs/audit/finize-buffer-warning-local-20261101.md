# Lokale update bufferwaarschuwing — 1 november 2026

Status: geïmplementeerd en gericht gecontroleerd, niet gepubliceerd. Branch codex/buffer-warning-causes, basis 7c83a41. Geen commits, push, merge of deployment uitgevoerd.

## Wijzigingen

- src/core/daily-liquidity.mjs: withAvailability voegt bufferWarning toe. bufferWarningFor laat dezelfde projectDailyLiquidity-engine opnieuw rekenen met dezelfde broninvoer, datumgrenzen, kasstromen en saldo-observaties, uitsluitend zonder geschatte variabele budgetpotten. Spaartransferplannen worden net als in de bestaande harde beschikbaarheid uitgesloten. De uitkomsten zijn afgeleid en worden niet opgeslagen.
- src/ui/dashboard.mjs: bufferWarningHtml vervangt de uitgebreide buffertekortmelding door maximaal één standaard gesloten details-component. bindBufferWarning houdt aria-expanded gelijk aan de native uitklapstatus. Geen nieuwe kaart, tab of modal.
- src/styles/dashboard-p3.css: compacte melding met bestaand waarschuwings-/informatie-icoon en bestaande kleurvariabelen. Hard gebruikt de bestaande urgente tekstkleur, budget/onzeker gebruikt rustigere tekst. Geen groot gekleurd vlak.
- app.js en app.css: lokaal opnieuw gegenereerd uit bovenstaande bronnen. Geen nieuwe dependency of wijziging aan cache-/publicatieversie.
- tests/buffer-warning.test.cjs en tests/browser/buffer-warning.spec.cjs: nieuwe gerichte controles. Eén bestaande negatieve-dashboardtest in tests/browser/v118-p3-dashboard.spec.cjs aangepast aan de nieuwe component.

## Classificatie

Beide minima gebruiken dezelfde periode en dezelfde beginstand. De lijn zonder budgetschatting behoudt echte transacties, toekomstige inkomens, vaste-lastvervanging en de bestaande onzekerheidsreserves. Zij wordt expliciet met dezelfde motor berekend; cashBalanceCents is niet zonder controle als vervanging gebruikt.

1. Zonder budgetschatting onder buffer: harde waarschuwing, met bedrag/datum van het harde minimum.
2. Alleen inclusief budgetschatting onder buffer: zachte melding ‘Mogelijk … onder buffer’.
3. Beide: één harde melding met vermelding budgetinvloed. Details tonen beide minima met hun eigen datum. Het budgeteffect en extra tekort worden op de datum van het inclusieve minimum vergeleken, niet door minima van verschillende dagen op te tellen.
4. Geen tekort en geen relevante berekeningsonzekerheid: geen melding.
5. Ongedateerde verplichtingen of onvolledige prognose: onzekerheid expliciet. Bij geen bewezen tekort verschijnt ‘Buffer nog onzeker’; bij een budgettekort wordt geen stellige dekking van vaste lasten beloofd. Onzekere bedragen worden herkenbaar getoond en niet als fictieve gedateerde betalingen afgetrokken.

## Details en bediening

Dezelfde component toont op verzoek minima zonder/met budget, beide datums, de buffer, beide tekorten, de vergelijkbare stand zonder budget op de inclusieve minimumdatum, geschatte budgetinvloed en aanvullend tekort. Relevante verplichtingen worden beperkt tot vijf zichtbare posten plus een aanduiding van de overige posten. Ongedateerde posten staan als onzeker vermeld. Tekorten worden nooit bij elkaar opgeteld.

Native details/summary ondersteunt muis, touch, Enter en spatie. De bestaande focusstijl blijft actief. Het toggle-event actualiseert aria-expanded. De uitklapstand is standaard gesloten en wordt niet opgeslagen.

## Verificatie

- 11 nieuwe gerichte Node-tests geslaagd: geen tekort, hard, zacht, beide, exacte buffergrens, onzekerheid, verschillende minimumdatums, ongewijzigde dag-/spaarberekening, betaalde vaste last, meerdere betalingen en saldo-observatie.
- 78 bestaande gerichte P2-, budgetpot- en huidige-dagtests geslaagd. Geen volledige testsuite herhaald.
- 15 nieuwe browsertests geslaagd: vier meldingsvarianten op 320/390/1440 px en integratie in het echte dashboard op alle drie breedtes. Inclusief openen/sluiten met muis, touch, Enter en spatie, aria-expanded, compactheid en geen horizontale overflow.
- Eén bestaande browserregressie voor negatieve/onzekere prognose en de instellingenactie geslaagd.
- Negen volledige selectorvergelijkingen met de oorspronkelijke HEAD-bron: alle bestaande uitvoervelden exact gelijk, exclusief het nieuwe bufferWarning-veld. Bronstate onveranderd. Deze controles omvatten expliciete horizons, de inkomens-KPI-horizon en Veilig te sparen bij drie saldohoogten.
- Syntax, CSS, gegenereerde bestanden en git diff --check gecontroleerd. Bestaande CSS-melding over --line blijft ongewijzigd. Impeccable-detector: geen bevindingen voor de gewijzigde UI/CSS.

## Financiële grenzen

De bestaande daglijn, budgetspreiding, vervanging van betaalde vaste lasten, historische maandlogica en formule van Veilig te sparen zijn niet gewijzigd. Bankkoppelingen, imports, goedkeuringen, budgetten, rekeningprofielen en productiegegevens zijn niet aangepast. Tests gebruiken uitsluitend synthetische gegevens; browsernetwerk buiten de lokale testserver is in de nieuwe tests geblokkeerd.

De nieuwe vergelijking betekent een extra read-only aanroep van de bestaande prognose-engine. Een ongedateerde verplichting krijgt geen verzonnen datum; de melding blijft daarom onzeker waar de bronnen dat vereisen. Er wordt geen volledigheid van bankgegevens beloofd.

## Previews

Synthetische lokale afbeeldingen staan in .cache/buffer-warning/:

- dashboard-390-closed.png en dashboard-390-open.png: mobiel in het echte dashboard.
- dashboard-1440-closed.png en dashboard-1440-open.png: desktop in het echte dashboard.
- hard-390-open.png: beide oorzaken met afzonderlijke tekorten en datums.

Stop vóór publicatie. Afzonderlijk akkoord voor push/merge/deployment is nog niet gegeven.

## Publicatie r28 — 1 november 2026

Publicatie is daarna expliciet door de gebruiker geautoriseerd. Tijdens verversen van origin/main bleken commits tot f8130ba uitsluitend een inline index.html te hebben gewijzigd. De daarin aanwezige financiële correcties, compacte transactielabels en styling zijn behouden en naar de bewerkbare bronnen gesynchroniseerd. buildLiquidityInput, projectDailyLiquidity en selectMonthEndSavings zijn na bundeling rechtstreeks vergeleken met de actuele r27-inlinecode en gelijk bevonden. De oorspronkelijke lokale vergelijkingen met 7c83a41 blijven historisch testbewijs; r27 is de publicatiebasis.

De build genereert voortaan ook de aanwezige inline-shell uit dezelfde JS/CSS-bronnen. Cache-/inlineversie is r28; de serviceworker herkent de actuele inline-marker naast de bestaande externe-assetshell. Offline herladen met een bewust aanwezige oude cache slaagt met ongewijzigde opgeslagen synthetische state. De 15 component-/dashboardcontroles slagen op de gecombineerde bron; aanvullende 430px-controles en 13 gerichte Node/cachetests zijn uitgevoerd. Geen productieboekingen, banksyncs of cloudgegevenswijzigingen.
