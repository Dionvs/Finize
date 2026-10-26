# Finize V118-r15 — bankherstart met bewaarde regelherkomst

Basis: `7b564a5e1ad6ebe91a5a9ac1bb2c489c0013fda5`, V118-r14. Herstelcommit: `ac2944e`. Diagnose, gemiste r14-fixture en voorafgaande ChatGPT-review staan in [het herstelverslag](finize-bankherstart-regelherkomst-20261026.md).

## Wijziging

Een geldige, historische herkomstvermelding van een geleerde herkenningsregel wordt niet langer behandeld als een actieve financiële afhankelijkheid. Alleen het exacte importBatchId-veld op de ondersteunde regelherkomstlocatie is uitgezonderd. Regel, herkomst, tombstone en financieel verwijderbewijs blijven behouden. Onbekend/ongeldig bewijs, financiële en historische verwijzingen, journals en conflicterende wachtrijen blijven blokkeren.

De import blijft een afzonderlijke, expliciet bevestigde generatie. Nieuwe transacties staan bij Nakijken en worden niet automatisch goedgekeurd. Bestaande bronidentiteiten en goedkeuringen blijven behouden. De financiële engine, spaarberekening, inkomstenverdeling en brongegevens zijn in deze release ongewijzigd. Het afzonderlijke spaarvraagstuk vereist eerst afbakening van de gewenste presentatie en verdeling.

## Controle na de laatste bronwijziging

- 77/77 bestanden van de volledige Node-run slagen.
- 30/30 gerichte Node-tests slagen: geldige en ongeldige regelherkomst, bronintegriteit, legacy/recordcloud, pending/conflict/uncertain opslag en prefixherkenning.
- 80/80 gecombineerde browsergevallen slagen. Beide bankimports worden daadwerkelijk synthetisch goedgekeurd; gezamenlijk wordt daarna verwijderd met de geleerde regel intact. Bevestigen, annuleren, opnieuw laden, herhalen en een volgende expliciete goedkeuring blijven correct. Financiële/historische gegevens en bronidentiteiten blijven behouden.
- Dezelfde browserronde controleert de bestaande prognosefuncties, mobiele breedtes 320/390/430 px en echte r14→r15-PWA-upgrade, offline herladen en softwareterugrol met gelijkblijvende proefgegevens, importdetails, journals en queue.
- Beide aanvullende PWA-cache/offline/reconnect-proeven slagen (2/2).
- JavaScript-syntax, CSS en gegenereerde build zijn gecontroleerd; alleen de bestaande CSS-tokenmelding `--line`. Build is byte-reproduceerbaar.

Deze tests overlappen. Het zijn synthetische bank- en cloudresponses met echte lokale browseropslag; geen echte banksynchronisatie. De specifiek onderzochte guard is daarnaast uitsluitend in geheugen op de geverifieerde financiële cloudstaat toegepast: vóór herstel geblokkeerd op regelherkomst, na herstel geen valse blokkade. Er is daarbij niets opgeslagen of opnieuw geïmporteerd.

## Publicatievoorwaarden

De oorspronkelijke voorwaardelijke publicatietoestemming van Dion blijft leidend. ChatGPT beoordeelt de definitieve controles vóór merge/publicatie. Publicatie verloopt uitsluitend via de bestaande Pages-bron main, zonder backend-, autorisatie-, sessie- of productiegegevensactie.

Voor publicatie is een alleen-lezen nulmeting van financiële manifest-, importheader- en permanente rekeningbindingsprojecties gemaakt. Na publicatie volgen succesvolle deploymentstatus, zeven publieke assethashes, geïsoleerde publieke browserproeven en dezelfde uitsluitend-lezen vergelijking. Dit verslag claimt geen geslaagde echte banksynchronisatie.
