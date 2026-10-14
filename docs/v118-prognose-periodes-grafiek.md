# V118 — Definitieve prognoseperiodes en historische saldografiek

Datum: 14 oktober 2026. Status: lokaal geïmplementeerd en gericht geverifieerd; gereed voor beoordeling. Geen commit, push, merge, deployment of wijziging van productiegegevens.

## Uitgangspunt en herstelpunt

Gewenste repository: `G:\Mijn Drive\Codex\financien\outputs\dion_dara_budget\webapp\github\Finize-live-repo`. Branch: `agent/v117-stabilisatie`. HEAD vóór en na het werk: `e473dbb35e2e43d9e33e5eefe404f4f170cb8509`.

De eerdere lokale correctie voor salaris/zakgeld, afschrijfdagen en grafiekdetails was ongecommit aanwezig en is behouden. Voor deze vervolgstap zijn 367 gevolgde/niet-genegeerde bestanden gekopieerd naar `..\Finize-herstel-v118-periodes-20261014-183039`. Iedere kopie is met SHA-256 tegen het origineel gecontroleerd. Het manifest bevat alle bestandsnamen en hashes. De eerdere rapporten en auditbestanden blijven als bewijs van hun eigen oplevermoment bewaard.

## De vijf periodes

| Keuze | Begin | Einde |
|---|---|---|
| **Deze maand** — standaard | Eerste kalenderdag van de huidige maand | Laatste kalenderdag |
| **7 dagen** | Vandaag | Vandaag + 6 dagen |
| **14 dagen** | Vandaag | Vandaag + 13 dagen |
| **Eigen datum** | Vandaag | Gekozen einddatum, inclusief |
| **Volgend salaris** | Vandaag | Dag vóór het volgende betrouwbare relevante salaris |

De bestaande voorkeur `finize-dashboard-context` bewaart nu ook de periode en eigen einddatum. De keuze blijft bij Gezamenlijk/Dion/Dara wisselen en na herladen behouden. Een verlopen eigen einddatum valt bij herladen veilig terug op Deze maand.

Volgend salaris berekent zijn grens opnieuw voor de fysieke rekening. Een interne ontvangst of zakgeld wordt in deze expliciete salarisstand geen salarisdatum. Als een relevante betrouwbare salarisplanning ontbreekt, verschijnt een melding met de mogelijkheid een andere periode of salarisinstelling te kiezen. Deze maand en de handmatige periodes blijven zonder salaris beschikbaar.

## Eén doorlopende P2-berekening uit planning en bankboekingen

`selectDailyLiquidity` gebruikt voor de grafiek een expliciete `startDate`. Het bestaande P1-register levert het laatste geldige ijkpunt vóór de gewenste periode. Vanaf dat anker bouwt dezelfde bestaande P2-invoer en centberekening de dagelijkse saldolijn op. Er is geen afzonderlijke historische motor, opgeslagen saldohistorie of tweede financiële berekening toegevoegd.

De historische en toekomstige dagen gebruiken dezelfde bestaande bronnen: salarisregels, berekend zakgeld per persoon/maand, vaste-lastenoccurrences met afschrijfdag, expliciete overige inkomsten/transfers, resterende maandbudgetten en bruikbare bankboekingen. Historische bedragen, frequenties, daginstellingen en budgetregels komen uit de bestaande maandselectoren en wijzigingshistorie. Nieuwe instellingen lekken niet terug naar oudere maanden.

Geplande kasdatums na het saldo-anker blijven ook zichtbaar wanneer ze inmiddels verstreken zijn. Het ontbreken van CSV-dekking verbergt de lijn niet. De interface benoemt het resultaat als **berekend saldo uit planning en beschikbare bankboekingen**, met afzonderlijke labels Gepland, Werkelijk en Voorlopig verwerkt. De kaart Huidig saldo blijft de afzonderlijke P1-bankstand tonen.

Het voorbeeld uit de opdracht is getest met een P1-saldo van € 2.000 aan het einde van 30 september, dus als beginstand voor 1 oktober: een geplande hypotheek van € 1.200 op 3 oktober geeft zonder CSV een berekend saldo van € 800 op 3 oktober. Alle 31 dagen van oktober blijven beschikbaar.

Een ouder ijkpunt kan de geselecteerde maand ondersteunen: de bestaande opslaglaag laadt de benodigde tussenliggende maanden. De limiet van 24 maanden geldt voor de gekozen weergave/prognosehorizon, niet voor de ouderdom van het noodzakelijke anker. Ontbrekende opslaghistorie blijft zichtbaar als onvolledig.

## CSV-vervanging en mogelijke overlap

P2 hergebruikt de bestaande bankbronidentiteit, occurrence-ID's, salaris-/zakgeldrelaties, transferlinks en financiële goedkeuring. Een bewezen vervangende bankbron verwijdert alleen de overeenkomstige geplande kasbeweging uit de lijn; overige planning blijft bestaan. Werkelijke bankdatum en werkelijk bedrag zijn leidend.

De hypotheektest verfijnt de planning naar € 1.205 op 2 oktober. Daardoor wordt 2 oktober € 795, verdwijnt de tweede afschrijving op 3 oktober en veranderen de volgende dagsaldi. Een ongekoppelde echte mutatie komt aanvullend in de lijn. Een gedeeltelijke CSV verwijdert geen andere hypotheek, verzekering, salaris- of zakgeldplanning.

Een behouden handmatige link blijft bewijs als de bankbron opnieuw bij Nakijken staat. Zonder bewezen goedkeuring geeft een expliciete mogelijke overlap onzekerheid: de mogelijke tweede kasmutatie staat niet op de lijn. Een onzekere uitgaande verplichting blijft conservatief gereserveerd; een onzekere positieve ontvangst verhoogt de lijn niet. Dit verwijdert geen planning definitief en keurt niets automatisch goed. Gelijke bedragen, omschrijvingen of nabije datums gelden niet als vervangingsbewijs.

Dagdetails kunnen bij een werkelijke post het oorspronkelijke bedrag vermelden, bijvoorbeeld **planning € 1.200 vervangen**. Deze informatie wordt afgeleid uit de bewezen bronrelatie en blijft uitleesmetadata; er wordt geen nieuwe transactie opgeslagen.

## Handmatig saldo: vanaf de peildatum overschrijven, ervoor behouden

De aanvullende verduidelijking van de gebruiker is geïmplementeerd: **een handmatige saldo-invoer overschrijft het berekende saldo vanaf haar eigen datum en verandert de dagen ervoor niet**.

P1 bewaart een waarneming aan het einde van de bankdag. Op die datum verwerkt P2 eerst de bekende/geplande dagmutaties en zet vervolgens het eindsaldo exact op de handmatig ingevoerde waarde. De volgende dag begint met die waarde. Mutaties op of vóór de peildatum worden daarna niet opnieuw belast.

Het verschil verschijnt in de dagdetails als **Handmatig saldo-ijkpunt**, inclusief het ingestelde saldo. Deze uitleesgebeurtenis sluit beginsaldo + dagmutaties + ijkpuntverschil exact op het ingestelde eindsaldo aan. Het is geen bankbetaling of financiële boeking en wordt niet aan de opgeslagen transacties toegevoegd. De interface toont ook het controleverschil tussen de eerdere berekening en de waarneming.

P1-validatie, actieve revisies, correcties en fysieke rekeningselectie blijven leidend. Meerdere waarnemingen worden chronologisch toegepast. Een later geïmporteerde CSV vóór een handmatige peildatum verfijnt de eerdere dagen en het verklaarde ijkpuntverschil; zij belast het ingestelde saldo erna niet opnieuw.

Een saldo-invoer is geen bewijs dat een budget financieel is besteed. Na een nieuw ijkpunt blijven de resterende budgetten daarom afkomstig uit de bestaande P2-budgetselectie, zonder verzonnen budgetrealisatie. De gerichte test vergelijkt de verdere lijn met de bestaande P2-projectie vanaf hetzelfde ijkpunt.

Ontbreekt een ijkpunt vóór de periode, dan begint de bekende lijn bij het eerste bruikbare ijkpunt binnen de periode. Eerdere saldi worden niet teruggerekend of verzonnen. Op de eerste waarnemingsdag kan het beginsaldo onbekend zijn, terwijl het eindsaldo wel bekend is. Zonder enig bruikbaar beginsaldo verschijnt een melding en blijven bekende geplande kasbewegingen via de betalingslijst beschikbaar.

## Grafiek en details

De bestaande SVG, kleurenfamilie, dashboardstructuur, kaarten en interactie zijn behouden. Oranje lijn en subtiele vulling tonen verstreken dagen; groen toont vandaag en de toekomst. Beide delen sluiten aan op de verticale stippellijn Vandaag. De vier periodes die vandaag starten hebben geen oranje segment. Het teken of de betrouwbaarheid van een saldo bepaalt de segmentkleur niet.

Desktophover, tikken, toetsenbord en de dagkeuzelijst blijven werken. Een tik geeft een blijvende detailkaart. Ook een lege dag is selecteerbaar en vermeldt **Geen mutaties**. Dagdetails tonen datum, berekend beginsaldo, iedere afzonderlijke kasbeweging/herkomst, dagsom en berekend eindsaldo. Vervangen planning verschijnt niet als tweede mutatie. Een handmatige saldo-aanpassing wordt herkenbaar uitgelegd.

De betalingskaart heet nu Betalingen in deze periode, omdat Deze maand ook verstreken dagen omvat. De oranje legenda gebruikt leesbare tekst met een oranje lijnsymbool. Op 1440, 390 en 320 px is geen horizontale pagina-overflow gemeten.

## Vrij na verplichtingen

De financiële definitie is behouden: de conservatieve minimale kasruimte binnen de geselecteerde periode, na resterende budgetten/ongedateerde verplichtingen en één veiligheidsbuffer. De waarde wordt niet vervangen door de huidige P1-bankstand of het laatste grafieksaldo. Het spaardoel blijft informatief en wordt niet nogmaals afgetrokken.

De gekozen periode bepaalt het te controleren minimum. In Deze maand blijven dus ook eerdere tijdelijke tekorten in die zichtbare maand relevant; een later positief eindsaldo verbergt ze niet. Bij 7/14 dagen en Eigen datum wordt het minimum binnen die periode gebruikt. Ontbrekende essentiële gegevens houden de definitieve vrijwaarde onbekend; de bestaande indicatieve waarde en onzekerheidslabels blijven beschikbaar.

De eerdere controles over 3, 6 en 12 maanden blijven slagen. Aanvullend zijn historische maandbudgetten, één buffer, het spaarstreven, eerdere tekorten en budgetreserveringen na handmatige ijkpunten geverifieerd.

## Werkelijk uitgevoerde verificatie

- **328 gerichte Node-tests geslaagd, 0 fouten.** Daarvan 29 nieuwe tests voor deze uitbreiding. Inclusief P1b, P2, P3, P4-suggesties, planninghistorie, salaris, eerdere zakgeldcorrectie en bestaande spaar-/refundcontracten.
- **27 gerichte browsertests geslaagd, 0 fouten**, waarvan 7 nieuw. Inclusief volledige maand zonder CSV op 1440/390/320 px, periodelengtes, eigen datum over jaargrens, salarisgrenzen per context, herladen, kleuren, desktophover, tikken, toetsenbord, CSV-vervanging, ontbrekend beginsaldo en handmatige saldo-overschrijving.
- Gerichte Node-controles voor februari/schrikkeljaar, ouder ijkpunt, historische dag-/bedrag-/budgetwijzigingen, voorlopige bankboekingen, gedeeltelijke CSV, codec/herladen, eerdere negatieve saldi en iedere dagidentiteit in centen.
- De bestaande rekeninginstellingflow salaris/zakgeld en vaste-lasten-dagkeuze blijft in de browsersuite opgenomen. Bestaande tests zijn alleen aangepast aan de bedoelde nieuwe standaardperiode, inclusieve 7/14 dagen en nieuwe tekst.
- Syntax, CSS, reproduceerbare build en `git diff --check` geslaagd. De bestaande CSS-melding `--line` blijft bestaan. De Impeccable-controle gaf geen bevindingen.

De browser gebruikt uitsluitend synthetische lokale fixtures in geïsoleerde contexten en blokkeert Firebase/backendverkeer. De CSV-browsertest materialiseert synthetische bankbronnen via de bestaande importcontracten; de bestaande importparser/-goedkeuringsflow is niet opnieuw volledig doorlopen. Geen productiecloudtest, schaalbenchmark of volledige V118-regressie uitgevoerd.

Laatste groene logs, screenshots, bestands- en bewijshashes staan beschreven in [het auditbewijs](audit/v118-prognose-periodes-grafiek-bewijs.json). De lokale bewijsbestanden staan onder `.cache/v118-periodes/`.

## Bestanden en resterende grenzen

Deze vervolgstap wijzigt `src/core/daily-liquidity.mjs`, `src/ui/dashboard.mjs`, `src/styles/dashboard-p3.css` en de gegenereerde `app.js`/`app.css`. Toegevoegd: `tests/v118-prognose-periodes.test.cjs`, `tests/browser/v118-prognose-periodes.spec.cjs`, dit verslag en het auditbewijs. Aangepaste bestaande tests: `tests/v118-p3-dashboard.test.cjs`, `tests/browser/v118-p3-dashboard.spec.cjs` en `tests/browser/v118-prognose-correctie.spec.cjs`. De overige eerdere lokale wijzigingen zijn behouden.

Berekende historische saldi zijn geen bankbevestiging. Een onvoldoende CSV-koppeling blijft onzeker; zonder bruikbaar beginsaldo blijven eerdere saldi onbekend. Voor planning vanaf oudere ijkpunten is de tussenliggende opslaghistorie nodig. Geen nieuwe bankintegratie, automatische financiële goedkeuring, formulewijziging, dashboardredesign of wijziging van opgeslagen historische basisgegevens toegevoegd.

**Lokaal gereed voor beoordeling. Nog niet publiceren.**
