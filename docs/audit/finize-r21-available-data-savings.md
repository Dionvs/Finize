# V118-r21 — spaarbedrag op basis van aanwezige gegevens

De gebruiker werkt zelf de bank bij op maandultimo. Onbevestigde of gedeeltelijke bankdekking houdt daarom de weergave van het berekende spaarbedrag niet langer tegen.

`selectMonthEndSavings` behandelt uitsluitend `unknown-bank-coverage` en `partial-bank-coverage` als informatieve redenen. De berekening gebruikt ongewijzigd het vastgelegde saldo, aanwezige transacties, concrete planning, volledige maandbudgetbescherming en de bestaande buffer. De dekking wordt niet als volledig opgeslagen of gepresenteerd: de redenen blijven behouden en de uitkomst houdt status `provisional`. Het dashboard toont het bestaande `indicativeCents`-bedrag en de bijbehorende extra ruimte. De uitleg vermeldt dat de gebruiker zelf de bank op de laatste dag van de maand bijwerkt.

Andere tekortkomingen blijven blokkeren: een ontbrekend bruikbaar saldo-ijkpunt, onbekende benodigde betaaldatum, ontbrekende financiële periode of onbetrouwbare inkomenshorizon levert geen fictief bedrag op. Gepland sparen blijft informatief. Er zijn geen veranderingen aan transacties, betaaldatums, bankkoppelingen, goedkeuringen of dekking in opgeslagen gegevens.

De nieuwe regressies controleren onbekende en gedeeltelijke dekking met een beschikbare-data-uitkomst van €750, een maandplan van €500 en €250 extra. De beschermingslijn, benodigde opening en €200-buffer zijn exact gelijk aan dezelfde fixture met bevestigde dekking. Ontbrekende essentiële gegevens blijven geblokkeerd. Onvoldoende ruimte toont €0 en wordt niet opgehoogd tot het spaarplan.

Dit vervangt bewust de eerdere eis in r19/r20 dat onbevestigde bankdekking een numeriek spaarbedrag blokkeert. De historische verslagen beschrijven de destijds geldende werking.

Validatie: 84 Node-testbestanden en 21 browsergevallen geslaagd, waaronder vier schermafmetingen, bestaande prognosefilters en de r20→r21-PWA-update, offline en terugrol. De gewijzigde kaart is daadwerkelijk geopend en visueel gecontroleerd. Syntax, CSS, reproduceerbare bundel en diffcontrole slagen; de bestaande CSS-tokenmelding `--line` blijft aanwezig. Er zijn geen productiegegevens gewijzigd en geen bank-API-acties uitgevoerd.
