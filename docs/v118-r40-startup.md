# Finize V118-r40: openen van de app

Bij het openen gaf de service worker de online HTML pas door nadat de volledige pagina opnieuw in de offline cache was geschreven. Op een trage of vastlopende cachebewerking kon daardoor het laadscherm blijven staan. De online pagina wordt nu direct doorgegeven; het bewaren voor offline gebruik loopt als achtergrondwerk binnen dezelfde service-worker-gebeurtenis.

De financiële gegevens, berekeningen en accountrechten zijn niet gewijzigd. De nieuwe cacheversie is `finize-v118-r40`.

Een gerichte test laat de cachebewerking bewust nooit afronden en controleert dat de HTML-respons toch direct beschikbaar is. De browsercontrole omvat de overgang van r39 naar r40, offline herladen, terugrollen en behoud van lokale financiële state en bankimportbron.
