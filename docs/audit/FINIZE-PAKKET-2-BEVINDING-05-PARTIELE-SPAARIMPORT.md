# Pakket 2 — bevinding 05: spaarimport met gedeeltelijke historie

Status: gereproduceerde applicatiefout; op besluit van de gebruiker als bekende beperking gerapporteerd. Geen functionele correctie in pakket 2.

## Reproductie en bewijs

Op 9 november 2026 is de bestaande browserproef `V117 P3 partial history: real screens, ten CSV approvals, offline restart, historical correction and second client` gericht uitgevoerd tegen de lokale Firestore-emulator (demo-project, poort 8181).

De fictieve dataset bevat 36 historische transacties. Na activering van gedeeltelijk laden opent oktober 2026 met nul historische transacties in de actieve werkset. De financiële vergelijking met de volledig geladen werkset slaagt. Vervolgens worden tien fictieve CSV-spaarboekingen geïmporteerd.

Bij het wijzigen van de eerste importregel van interne overboeking naar `Sparen` verandert het interne concepttype naar `sparen`. Het opnieuw tekenen van de regel breekt echter af met:

> Een vereiste financiële periode is niet geverifieerd. Ontbrekende historie is geen nul.

Het spaardoelkeuzeveld verschijnt daardoor niet. Het scenario bereikt de tien goedkeuringen niet. De overeenkomstige proef met volledig geladen gegevens slaagt in de eerdere gerichte run (`records-retest.json`). Dit is dus geen bewijs van verlies van goedgekeurde transacties.

## Technische oorzaak

De vastgelegde browserstack loopt via `onDraftChange` → `renderDraftRowCard` → `rowHtml` → `dependentFieldsHtml` → `savingsContributionFields` → `selectTransactionProjections` → `periodDependencyState`.

In `src/import/runtime.js` vraagt `savingsContributionFields` de transactieprojecties rechtstreeks op. Bij de gedeeltelijke werkset leidt dit tot de controle op ontbrekende, niet geverifieerde financiële perioden. De importeditor handelt deze afhankelijkheid bij het hertekenen niet af. De projectiecontrole zelf beschermt tegen berekenen met ontbrekende historie en mag niet worden omzeild of door nulwaarden vervangen.

Ernst: blokkerende bediening voor dit gereproduceerde gedeeltelijke-historiescenario. De omvang buiten dit scenario is nog niet vastgesteld.

## Voorgesteld vervolg

Onderzoek een gerichte correctie die de benodigde periodeafhankelijkheden verifieert/laadt voordat de spaarvelden worden opgebouwd, met behoud van brongegevens, expliciete goedkeuring en financiële controles. Geen algemene refactor, migratie of verzwakking van de projectiecontrole.

Alternatief: de fout als bekende beperking rapporteren en pakket 2 vervolgen zonder applicatiecorrectie. In dat geval blijft de bestaande financiële test met de huidige verwachting falend geregistreerd.

## Bewijsbestanden en veiligheid

De tijdelijke meetinstrumentatie is verwijderd. De ongewijzigde productiebundel is alleen voor de lokale diagnose in de browserrespons geïnstrumenteerd; geen applicatiebronbestand is hiervoor aangepast.

- `.cache/pakket2/editor-delegation-probe.json` en `.log`: concepttype vóór/na wijziging en foutmelding.
- `.cache/pakket2/editor-delegation-stack.json` en `.log`: volledige browserstack en falende veldassertion.
- `.cache/pakket2/records-retest.json`: overige tien gerichte gevallen geslaagd, deze ene proef mislukt.

Uitsluitend fictieve gegevens en een geïsoleerde lokale emulator zijn gebruikt. Productiegegevens en bankverbindingen zijn ongemoeid gebleven.

## Besluit gebruiker

De gebruiker kiest rapporteren. De fout blijft een bekende applicatiebeperking; de bestaande proef en haar financiële verwachtingen blijven behouden. Pakket 2 wordt vervolgd zonder deze applicatiecorrectie.
