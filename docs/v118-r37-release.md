# V118-r37 — ING-saldobasis en betaaldatum

Publicatie geautoriseerd op 2 november 2026. Basis: V118-r36, commit 50f796acc230ab5b51d561e1b76627af8fdccdb3.

## Gedrag

De laatst geschikte externe ING-opgave is leidend voor de actuele rekeningstand, dagelijkse prognose, bufferwaarschuwing en Veilig te sparen. XPCD blijft als verwacht saldo herkenbaar, met peilmoment. Bankboekingen worden niet opnieuw op die externe stand toegepast. Planning, budgetspreiding, spaarformule en handmatige fallback gebruiken de bestaande rekenketen. Een nog niet verwerkte vaste last kan tijdelijk conservatief gereserveerd blijven; een geldige gekoppelde betaling vervangt de gehele occurrenceplanning.

De bestaande aanpasbare datum heet Betaaldatum en bepaalt de administratieve maand. Oorspronkelijke bankgegevens en bankreconciliatie blijven behouden; expliciete vaste-lastoccurrences en refundmaanden blijven afzonderlijke toewijzingen. Herimport bewaart handmatige datumcorrecties.

## Controle en opslag

313 gerichte financiële/import-/opslagtests en 16 browsercontroles slagen. De browserronde omvat mobiel en desktop, bestaande transactieroutes, r36 naar r37 serviceworker-update, offline herladen en terugrollen naar r36 met behoud van synthetische financiële gegevens en IndexedDB-bronbewijs. Twee oude reserveringstests zijn aangescherpt op de bestaande regel: cash blijft gelijk, de ongekoppelde verplichting wordt eenmaal gereserveerd. De financiële code is daarvoor niet veranderd.

Read-only onderzoek bevestigde dat het actuele huishouden de volledige JSON-chunkopslag gebruikt en geen actieve gedeeltelijke cloudperiodeopslag. Daarom is voor bestaande betaaldatumcorrecties geen cloudindexmigratie nodig. Budget- en maandprojecties worden uit de reeds aanwezige gegevens berekend. De toekomstige gedeeltelijke recordopslag blijft afzonderlijk te beoordelen bij activering. Geen gegevensmigratie, bankverzoek of handmatige saldoaanpassing is onderdeel van deze release.

Syntax, CSS, reproduceerbare build en whitespacecontrole slagen. De bekende bestaande CSS-tokenmelding --line blijft onveranderd. Geen claim dat de volledige historische testsuite is uitgevoerd.

## Publicatie en herstel

Doel: main / GitHub Pages vanuit repositoryroot. index.html en service-worker.js gebruiken 118-r37 / finize-v118-r37. Herstelpunt: tag backup/v118-r36-before-r37-20261102 op de basiscommit. Terugrollen kan via een expliciete herstelrelease; de proef toont dat deze codewissel de opgeslagen financiële brongegevens bewaart. Oude software interpreteert betaaldatumcorrecties weer volgens de oude regels.

Publicatiecontrole: geslaagde Pages-build, releaseaanduidingen en SHA-256-vergelijking van index.html, app.js, app.css en service-worker.js. Geen financiële productiehandelingen bij deze controle.
