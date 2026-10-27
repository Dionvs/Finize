# V118-r23 — volledige volgende maand en één buffer van €200

Datum: 27 oktober 2026. Basis: `3bd0723d00ff8c2fec4fe90fec0351de2bb31779` (V118-r22). Werkbranch: `codex/v118-safe-savings-final`.

De bestaande lokale correctie is behouden, gecontroleerd en afgerond voor publicatie. Dit vervangt voor Veilig te sparen de dagelijkse budgetspreiding en de extra ontvangstperiode van r22. Laagste prognose behoudt zijn eigen bestaande dagelijkse budgetspreiding en horizon.

## Berekening

De spaaroverboeking vindt aan het einde van de geselecteerde maand plaats. De verwachte eindstand vóór die nieuwe overboeking is `E`. Bestaande echte bankboekingen blijven verwerkt; de geselecteerde hypothetische maandspaaroverboeking wordt niet vooraf afgetrokken.

De concrete kasstroom van de volledige volgende kalendermaand wordt opnieuw gebaseerd op nul. Salarissen en vaste lasten tellen op hun werkelijk ingestelde datums. Het volledige nog resterende variabele maandbudget wordt eenmaal op de laatste kalenderdag afgetrokken. Werkelijke budgetbetalingen staan al in de concrete kasstroom en verlagen de restpot; dezelfde cent wordt niet opnieuw afgetrokken. Het huidige maandrestant wordt bij de prognose van de huidige maandultimo eveneens eenmaal meegenomen.

Met `C(d)` als cumulatieve kasstroom vanaf de nulbasis:

```
minimum = min(0, alle C(d) van de volgende maand)
benodigde opening = 20000 - minimum
veilig te sparen = max(0, E - benodigde opening)
```

Alle bedragen zijn gehele centen. De €200-buffer wordt uitsluitend na het bepalen van dit minimum toegepast. Een niet-negatieve kasstroom heeft dus precies €200 nodig. De spaarberekening gebruikt exact €200; de afzonderlijke grafiekbufferinstelling en opgeslagen rekeninginstellingen worden niet gewijzigd.

Het venster eindigt op de laatste kalenderdag van de volgende maand: oktober→30 november, november→31 december. De reeds bestaande regelaar voor het ophalen van vereiste maanden is ook tot diezelfde grens beperkt. Een onnodige derde maand kan de runtime daardoor niet alsnog blokkeren.

## Expliciete onafhankelijke controle

Synthetische invoer: verwacht oktober-eindsaldo €3.000; vaste last €1.850 op 1 november; salaris €2.000 op 5 november; salaris €1.000 op 24 november; vaste last €100 op 25 november. In dit specifieke voorbeeld is het variabele budget nul.

| Moment | Cumulatief vanaf €0 | Saldo na €950 sparen |
|---|---:|---:|
| Begin | €0 | €2.050 |
| 1 november | −€1.850 | **€200** |
| 5 november | €150 | €2.200 |
| 24 november | €1.150 | €3.200 |
| 25 november | €1.050 | €3.100 |
| 30 november | €1.050 | €3.100 |

Minimum: −€1.850. Benodigd: €200 − (−€1.850) = **€2.050**. Veilig te sparen: €3.000 − €2.050 = **€950**. De regressie controleert onafhankelijk alle dertig dagen en toont dat één cent extra sparen het minimum onder €200 zou brengen. Ook de centvariant €3.000,01 − (€1.850,03 + €200) = €949,98 slaagt.

Een tweede synthetische fixture heeft €10.000 beginsaldo, €1.150 maandbudget en twee salarissen met vaste lasten op 1/5/24/25 november. Het verwachte oktober-eindsaldo is €8.850; de grootste cumulatieve daling in november is €1.800. Nodig: €2.000; veilig: **€6.850**. Het novemberbudget wordt pas op 30 november afgetrokken. De eerdere r22-uitkomst €6.651,60 gebruikte een andere budgettiming en liep door tot 5 december; dat venster is volgens de nieuwe opdracht vervangen.

## Gewijzigde onderdelen en behouden grenzen

- `selectMonthEndSavings`: maandgrens, budgetaftrek op maandultimo, nulbasis en één vaste buffer.
- `liquidityRequiredMonths`: voor de spaar-KPI ook vooraf uitsluitend de noodzakelijke maanden tot het einde van de volgende maand ophalen.
- `src/ui/dashboard.mjs`: uitleg aangepast aan precies deze methode; kaartindeling behouden.
- Tests: expliciete €950-controle, niet-negatieve kasstroom, laatste-dagbudget, echte budgetbetaling versus restpot, centen, februari/schrikkeljaar, jaarwisseling, ingestelde salarisdatums en onveranderde daglijn.

Gepland sparen en Extra ruimte blijven vergelijkingsinformatie en veroorzaken geen tweede reservering of fictieve bankafschrijving. De bestaande inkomens-/zakgeldmotor is niet aangepast. Onbevestigde bankdekking blijft informatief, zoals eerder gevraagd. Werkelijk ontbrekende essentiële gegevens blijven herkenbaar onvolledig.

Geen productie-Firestore, bankkoppelingen, echte transacties of andere financiële gebruikersgegevens zijn gewijzigd. Er is geen banksynchronisatie gestart en voor deze afronding is geen financiële productie-invoer uitgelezen. Alle financiële testvoorbeelden zijn synthetisch.

## Validatie

- Volledige Node-run: **86 bestanden**, met **1.111 geregistreerde Node-testgevallen** plus de bestaande directe bestandsasserties, geslaagd. De elf specifieke formule-/maandgrenstests maken hiervan deel uit; de 69 gerichte gevallen zijn geen extra onafhankelijke telling.
- Browser: **52 unieke relevante gevallen uiteindelijk geslaagd**. De eerste gecombineerde run had 46 geslaagd en zes mislukte oude verwachtingen/fixtures. De zeven betrokken gevallen zijn na de hieronder onderbouwde testaanpassingen herhaald en alle zeven geslaagd; één daarvan was al eerder geslaagd. Dit wordt niet als 53 unieke gevallen opgeteld.
- De oude persoonlijke verwachtingen gebruikten een buffer van €100. De nieuwe spaarberekening vraagt precies €200: €3.880 − €200 = €3.680 (voorheen €3.780) en €1.000 − €200 = €800 (voorheen €900). De persoonlijke minimumkaart/grafiek en haar €100-instelling blijven gelijk. De verwachte spaarbedragen zijn alleen met deze kasstroomberekening aangepast.
- De oude browserfixture voor nul spaarruimte veroorzaakte het tekort pas in december. Voor de nieuwe november-only-test is de late novemberlast €4.000: −€1.800 + €2.000 + €1.000 − €4.000 = −€2.800; benodigd €3.000 is hoger dan €2.750, dus €0 veilig. Het minimum tot het eerste salaris blijft €950. Geen productcode aangepast om die oude fixture passend te maken.
- Browserdekking omvat 320/390/430/1440 px, vijf grafiekfilters, nul/tekort, informatiedialoog, bronstaatbehoud, ontbrekende betaaldatum, bankdekking, P2/P3, instelling-/opslagfouten en r22→r23-PWA-upgrade, offline en terugrol met behoud van IndexedDB-bewijs.
- Syntax, CSS, byte-reproduceerbare build en diffcontrole slagen. Geen inhoudelijke CSS-wijziging; uitsluitend de bestaande CSS-tokenmelding `--line`. Impeccable-detector voor de gewijzigde UI-bron: geen bevindingen. Het mobiele resultaat is geopend en visueel gecontroleerd.

## Publicatie

Implementatiecommit, Pages-status en openbare nacontrole worden na afronding toegevoegd. De broncode wordt alleen gepubliceerd na de hierboven genoemde controles; eventuele aanvullende closeoutwijzigingen betreffen uitsluitend dit verslag en het publicatiebewijs.
