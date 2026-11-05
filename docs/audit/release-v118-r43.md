# V118-r43 — compacte mobiele header

Gerichte vervolgcorrectie op V118-r42: de mobiele header is bij een korte statusmelding circa 58–60 px hoog, met logo over beide regels. De titel staat hoger naast het logo; de maandpil staat op dezelfde regel en is 26 px hoog. De status staat direct onder de titel. Lange statusmeldingen mogen de header laten meegroeien zodat tekst niet wordt afgesneden. De ondernavigatie en financiële logica zijn niet gewijzigd.

Controle: 26 gerichte browsergevallen geslaagd, inclusief de hoogte van de header en maandpil op 320 en 390 px, lange statusmeldingen op 195/320/390/430 px, bereikbaarheid van navigatie en desktopbehoud. Syntax, CSS en gegenereerde runtime zijn gecontroleerd. De lokale beelden en testuitvoer staan in `.cache/mobile-herstel`.

Nieuwe releasekenmerken: `118-r43` en `finize-v118-r43`. Voorafgaand aan publicatie wordt de offline-start met de nieuwe cacheversie getest; na publicatie worden Pages, publieke hashes en live mobiele layout gecontroleerd met geïsoleerde fictieve gegevens en een testlogin.

Rollback: `78d571880f641bc35931a2b1fae47a7aa0b597ee` (V118-r42), lokale tag `rollback/v118-r42-before-compact-header`. Geen nieuwe afhankelijkheden, gegevensmigratie of aanpassing aan financiële berekeningen. De eerder geregistreerde brede testmeldingen en nog openstaande hardwarecontroles blijven van toepassing.
