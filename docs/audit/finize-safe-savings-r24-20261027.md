# V118-r24 — definitieve spaarberekening en bevestigd maandslot

27 oktober 2026. Werkbranch: `codex/v118-safe-savings-final`. Deze afronding bouwt voort op de exacte formule en verificatie van [r23](finize-safe-savings-r23-20261027.md) en herstelt daarnaast de behandeling van ongebruikt budget bij een reeds bevestigd maandslot.

## Geldende berekening

Alleen de volledige volgende kalendermaand telt mee. De cumulatieve kasstroom begint bij nul, inclusief dit nulpunt in de minimumbepaling. Salarissen, vaste lasten en bekende concrete bankmutaties staan op hun bestaande datums. Het volledige resterende variabele maandbudget wordt uitsluitend op de laatste kalenderdag eenmaal afgetrokken; daadwerkelijke budgetbetalingen hebben die restpot al verlaagd.

```
benodigde opening = 20000 - min(0, alle cumulatieve dagsaldi volgende maand)
veilig te sparen = max(0, verwacht huidig maandeindsaldo - benodigde opening)
```

Gehele centen; de buffer van €200 telt precies eenmaal mee. Oktober beoordeelt november tot en met de 30e; november beoordeelt december tot en met de 31e. Ook het vooraf ophalen van maanden is tot die grens beperkt. De dagelijkse budgetspreiding en de aparte bufferinstelling van Laagste prognose blijven ongewijzigd. Gepland sparen en Extra ruimte blijven uitsluitend vergelijkingen. Onbevestigde bankdekking blijft informatief; ontbrekende essentiële invoer blijft herkenbaar onvolledig.

Het expliciete voorbeeld blijft bewezen: €3.000 verwacht eindsaldo, laagste cumulatieve kasstroom −€1.850, benodigde opening €2.050, dus **€950 sparen**. Alle dertig volgende-maanddagen blijven na de overboeking minimaal €200; één cent extra zou die grens doorbreken.

## Aanvullend gevonden maandslotgeval

De controle in r23 toonde dat een ongebruikt budget van de al afgesloten huidige maand nog als toekomstige uitgave werd afgetrokken. Bij een expliciet end-of-bank-day-ijkpunt op de laatste kalenderdag bevat het vastgelegde saldo de hele maand al. Ongebruikt budget is dan overgebleven geld, geen nog te betalen verplichting.

`closedOpeningMonth` is uitsluitend afgeleide berekeningsmetadata: dezelfde dag als het ijkpunt, expliciet `end-of-bank-day` en de laatste kalenderdag. Alleen die gesloten maand wordt uitgesloten van toekomstige budgetaftrek. Een ouder ijkpunt dat via aanwezige bankmutaties wordt doorgerekend is geen bevestigd maandslot; daarvoor blijft het resterende budget in de prognose. Timestampwaarnemingen worden evenmin stilzwijgend tot dagslot gemaakt.

Synthetische vergelijking, telkens een oktoberbudget van €1.150 en een ongewijzigd volledig novemberbudget van €1.150:

| Oktoberbesteding in deze vergelijking | Bevestigd eindsaldo | Restant oktober, geen toekomstige afschrijving | Nodig voor november | Veilig sparen | Begin november na sparen |
|---|---:|---:|---:|---:|---:|
| €100 | €9.900 | €1.050 | €2.000 | €7.900 | €2.000 |
| €0 | €10.000 | €1.150 | €2.000 | €8.000 | €2.000 |

€100 minder uitgegeven levert zo precies **€100 extra sparen** op. De novemberplanning, het novemberbudget, benodigde opening en €200-buffer veranderen niet. Er wordt geen extra novemberbudget gecreëerd. De bijbehorende onafhankelijke regressie controleert dit met een echte synthetische budgettransactie en bronstaatbehoud.

## Gewijzigde bron en grenzen

- `src/core/daily-liquidity.mjs`: r23-formule plus de beperkte afsluitingsgrens hierboven.
- `tests/safe-savings-correction.test.cjs`: nu dertien gerichte gevallen, inclusief het gesloten maandbudget en een niet-afgesloten ouder ijkpunt.
- `tests/browser/month-end-budget-timing.spec.cjs`: echte runtimecontrole van €950 en van €8.000 bij €10.000 bevestigd maandsaldo; ongebruikt oktoberbudget wordt niet alsnog afgeschreven.
- Release/cachemarker `118-r24`, bijbehorende versietests en reproduceerbare bundel. Geen inhoudelijke CSS-wijziging.

Geen productiegegevens gewijzigd of voor deze afronding uitgelezen. Geen banken gesynchroniseerd, geen echte autorisatie gestart en geen transacties, betaalafspraken, budgetplannen of financiële verdelingsregels aangepast. De voorbeelden en browserdata zijn synthetisch. De correctie verandert uitsluitend de prognose, niet de opgeslagen financiële invoer.

## Validatie

De volledige definitieve Node-run slaagt: **86 bestanden en 1.113 geregistreerde testgevallen**, plus de bestaande directe bestandsasserties. Alle **53 relevante browsergevallen slagen** zonder mislukte of overgeslagen gevallen, inclusief r23→r24-upgrade, offline en terugrol met behoud van financiële state en IndexedDB-bewijs. De dertien specifieke formule-/afsluitingsgevallen maken deel uit van deze telling.

JavaScript-syntax, CSS, reproduceerbare build en diffcontrole slagen; uitsluitend de bestaande CSS-tokenmelding `--line`. Geen inhoudelijke CSS-diff. Het volledige r23-verificatieverslag blijft bewaard als historische tussenstap; deze versie is de uiteindelijke afronding. Commit, Pages en openbare nacontrole worden na uitvoering hieronder vastgelegd.
