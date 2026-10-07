# Presentatiecorrectie na publicatie v108

Uitgangspunt: gepubliceerde commit `69602c527972cc849f972c746f566c86e42529a7`, schema 11. Dit verslag beschrijft de geteste aanvullende presentatiecorrectie. Publicatie is afzonderlijk door de gebruiker geautoriseerd op 7 oktober 2026, met releasemarker `finize-v109-account-presentation`.

De gebruiker heeft bij de livecontrole twee aanvullende correcties gevraagd:

- Gezamenlijk toont mobiel eveneens **Over deze maand**, met exact dezelfde `r.forecast.owners.gezamenlijk.available` als desktop. De kaart is geen spaareditor. **Spaargeld deze maand** blijft boven de spaardoelentabel bewerkbaar.
- De bestaande spaardoelentabel blijft behouden, inclusief alle tien kolommen, voortgang en totaalregel. De accounttabellen passen binnen hun kaart zonder interne horizontale scroll. Op smalle schermen zijn lettergrootte en celpadding compacter en mag tekst afbreken. De desktopweergave blijft zoals in de aangeleverde afbeelding. Dashboardpreview en de aparte spaardoelenbeheerflow zijn ongemoeid.

## Oorzaak en wijzigingen

`renderJointFirstRow` gebruikte nog `r.spaarpotDezeMaand` en `data-saving-edit`; de oorspronkelijke fix 1 betrof alleen persoonlijke tabs. Deze gezamenlijke mobiele presentatie gebruikt nu de reeds bestaande desktopselector.

De eerdere responsieve accounttabel had bewust `min-width:1050px` en `overflow-x:auto`. Dit is naar aanleiding van het nieuwe verzoek vervangen door een kaartbrede vaste tabelindeling, zonder minimumbreedte. De aanpassing is begrensd tot `.u5-joint-goals-preview`. De algemene bewerkbare doelentabellen krijgen deze regels niet.

Gewijzigd: `src/core/runtime.js`, `src/styles/base.css`, `tests/browser/fix-round-1-6.spec.cjs`; `app.js` en `app.css` opnieuw gegenereerd via de bestaande builder. Geen wijziging aan engine, planning, imports, storage of rules.

## Gerichte verificatie

- Nieuwe regressie reproduceerde vóór de correctie de horizontale overflow op 390px; 768/1280/1440px pasten al.
- **7/7 unieke gerichte browsercases PASS**: vier schermbreedtes 390/768/1280/1440, bestaande account/KPI/editorchecks op 390/1440 en bestaande viewportparitycase.
- Bij iedere accountcontrole: tien tabelkolommen, totaalregel, passende tabelgrenzen, beschikbare spaaractie. Gezamenlijke mobiele KPI: juiste centrale waarde, niet aanklikbaar als spaareditor.
- Volledige fixturestate, financiële effecten en forecast blijven exact gelijk vóór/na read-only navigatie en viewportwisseling; geen page-/console-errors.
- Syntax PASS, CSS PASS (981 nodes, 0 ongedefinieerde tokens), build PASS, generated runtime byte-reproduceerbaar, `git diff --check` PASS.
- Screenshots op alle vier breedtes met geïsoleerde lokale fixture handmatig beoordeeld. Op 390px is de tienkolomstabel noodzakelijk compacter.
- De al geslaagde volledige 49/462 Node- en 203 browsercontrole is op verzoek niet opnieuw uitgevoerd. De nieuwe 390px-case is na herstel van een testhelperfout afzonderlijk opnieuw uitgevoerd; productcode wijzigde daarbij niet.

Schema 11; geen financiële berekening, bankOriginal, zakgeld, spaarsaldo, planning, closure of productiegegevens gewijzigd. Voor deze publicatie blijven schema 11 en alle financiële contracten ongewijzigd; uitsluitend de bestaande releaseversieplaatsen worden bijgewerkt.
