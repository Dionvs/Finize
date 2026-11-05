# V118-r42 — mobiele header en navigatie

De mobiele header combineert logo en tabnaam links met de maandselector rechts. De opslagstatus staat op een eigen regel. De dubbele titel en maand onder de header zijn verwijderd. De navigatie blijft één rij, met horizontaal schuiven wanneer de beschikbare breedte onvoldoende is.

Deze release bevat ook het eerder lokaal uitgevoerde mobiele herstel: leesbare bedragen, grotere aanraakvlakken, 16px-invoer, hover op geschikte aanwijzers en consequente reduced motion. Financiële berekeningen en productiegegevens zijn niet aangepast. Vijf oude prognosetestverwachtingen zijn onderbouwd bijgewerkt voor een eenmaal gereserveerde fictieve verplichting van € 100; deze post bestaat uitsluitend in de testfixture.

- Basis/rollback: `396978e2f8ecdccaeb74bc5149ecc4d70f6fa282` (V118-r41), lokale tag `rollback/v118-r41-before-mobile-r42`.
- Nieuwe inline-shell en serviceworker-cache: `118-r42` / `finize-v118-r42`.
- Controle: syntax, CSS en reproduceerbare gegenereerde runtime; gerichte mobiele/header-/navigatiecontroles, inclusief 195 CSS-pixels en echte Chromium-zoom op 200%.
- Bekende uitgangssituatie: de brede Node-suite bevat nog 15 al bestaande mislukkingen, afzonderlijk beschreven in [het herstelverslag](mobile-herstel-r41.md). Deze release claimt geen volledig groene brede suite.
- Hardwarecontrole op iPhone, Android en iPad blijft open. Browseremulatie is geen vervanging daarvoor.

De gebruiker heeft publicatie naar GitHub/Pages expliciet opgedragen. De releasecontrole verifieert na het pushen de Pages-build, publieke releasekenmerken, hashes van de gepubliceerde HTML/CSS/JavaScript/serviceworker en de live mobiele interface met geïsoleerde fictieve gegevens. Geen live financiële gegevens worden daarvoor aangepast.
