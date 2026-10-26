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

## Technische vrijgave en nacontrole

ChatGPT gaf vóór publicatie expliciet technisch GO voor deze afzonderlijke bankrelease. De volledige reactie is gelezen. De reviewer baseert zich op het aangeleverde bewijs en heeft de tests niet onafhankelijk uitgevoerd. Herstelbranch gepusht; main is zonder force-push vanaf de opnieuw gecontroleerde uitgangscommit vooruitgezet naar releasecommit `cfcab5d3387d8ac6399152cd5017687e851b4227`.

[Pages-run 40333383833](https://github.com/Dionvs/Finize/actions/runs/40333383833) eindigde completed/success. Pages meldt built op exact het releasecommit, zonder fout.

Alle publieke assets retourneren HTTP 200 en hun SHA-256 is exact gelijk aan de Git-objecten:

| Asset | SHA-256 |
|---|---|
| index.html | c89b31004c25831bcf3f3916d03b5e900f02b886c7f65823947e9b85aea8921f |
| app.js | b06f0439fc1bc7ebf082179c667b4ec5dd12bf1be8b804e795df032890e5f80b |
| app.css | 992ca943d6294b462ab851e5ab808c8b7d6084f7fa9f90f4014916b6e04da285 |
| service-worker.js | 257041840f15fabe35bcb05bea1805c8d042be6b9f91ea7740e0fbaf4111c92b |
| manifest.json | 00cbaa9a122b7a02219bdf7bedd7b1824e6e744a4b430201e7a8e6585726e239 |
| icons/icon-192.png | 7a804e24cd03a592ac480b107567783388ae1de7b8eef2820299d6addbc85af5 |
| finize-logo.png | b0d5e979f9bea750fa2a2bb25a0514033b64738caec987039b680886c0d66e88 |

De verbeterde geïsoleerde publieke browserproeven op 320/390/430 px slagen. Beide bestaande CSV-effecten blijven na herladen behouden. De bankimport is daadwerkelijk synthetisch goedgekeurd zodat de historische herkenningsregel ontstaat, daarna verwijderd. Zonder bevestiging wordt hervatting geweigerd; met bevestiging ontstaat één afzonderlijke generatie die bij herhaling dezelfde ID houdt. Regel en tombstone blijven bytegelijk. De nieuwe rij blijft Nakijken met lege goedkeuringsbron. Geen paginastoring of horizontale overloop.

Alle externe requests zijn bij de publieke proeven geblokkeerd. Functionele controles gebruiken uitsluitend de bestaande synthetische authdriver en geïsoleerde lokale proefgegevens. De normale inlogpoort blijft bij geblokkeerde SDK gesloten. Dit is geen bewijs van werkende productieauthenticatie of een echte banksynchronisatie.

Na publicatie zijn financiële manifest-, 24 importheader- en twee permanente rekeningbindingsprojecties opnieuw uitsluitend gelezen. Hashes en aantallen zijn exact gelijk aan de nulmeting (`matchesBefore: true`). Geen Firestore-write, echte bank-API-call, autorisatie of sessiewijziging uitgevoerd. Er wordt geen onbeperkte claim over alle denkbare externe wijzigingen gedaan.

ChatGPT gaf na de nacontrole afsluitend technisch GO: op basis van het aangeleverde verslag geen resterende releaseblokkade. Het afzonderlijke spaarvraagstuk blijft ongewijzigd en wacht op de verduidelijking van de gebruiker. Deze verslagaanvulling wijzigt geen release-assets of broncode.
