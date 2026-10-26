# Werkpakket B — inkomensprognose, 26 oktober 2026

Basis: main `28025c6d09c685e1517ef31d3548bcb02b1b3cdf`, V118-r13. Afzonderlijke lokale wijziging; publicatie wacht op werkpakket A en gecombineerde eindcontrole.

## Herstel

De dashboard-KPI's gebruiken één vaste periode vanaf het huidige saldo tot de dag vóór het eerstvolgende relevante salaris of zakgeld. Het startsaldo telt mee in het minimum. Veilig beschikbaar trekt de bestaande veiligheidsbuffer eenmaal af en begrenst op nul. De vijf grafiekfilters blijven bestaan; het salarisfilter mag het inkomen op de einddatum tonen. Persoonlijk zakgeld blijft een interne geldstroom, zonder extra huishoudinkomen.

De bestaande liquiditeitsfuncties krijgen gerichte opties. Onbekende of onvolledige financiële gegevens blijven als zodanig herkenbaar. Bestaande zachte spaardoelen en brongegevens blijven behouden. KPI en grafiek gebruiken dezelfde peildatum en duurzame financiële basis; bij een tussentijdse wijziging worden beide eenmaal opnieuw berekend. Een oudere asynchrone reactie mag een nieuwe selectie niet overschrijven.

## Verificatie

- 120/120 gerichte Node-tests: inkomensprognose, bestaande liquiditeit, dashboard en prognosecorrectie.
- 28/28 gerichte browsertests: nieuwe inkomensgevallen, bestaande dashboard/prognose, serviceworker-upgrade en bestaande PWA-releaseproef.
- Mobiele breedtes 320, 390 en 430 px: vijf filters en beide contexten, geen horizontale overloop of paginastoring; financiële fixture blijft identiek.
- Ontvangen zakgeld op 31 oktober schuift de volgende grens naar november. Openingssaldo, buffer eenmaal, gelijktijdige inkomsten, ontbrekend inkomen en rekeningselectie zijn getest.
- Raceproef met een echte synthetische financiële commit tussen KPI en grafiek detecteert verschillende headhashes en herberekent beide. Afzonderlijke proef voorkomt overschrijven door een oude reactie.
- Gegenereerde build, syntax, CSS en diff gecontroleerd. UI-detector: geen bevindingen; screenshot 320 px geopend en visueel gecontroleerd.

Bewijsbestanden staan lokaal in `backups/bank-en-inkomensprognose-20261026/`; dit zijn synthetische tests, geen echte banktransacties of volledige garantie voor alle productieomstandigheden. De PWA-proef gebruikt voorlopig de bestaande r12→r13-fixture; een daadwerkelijke r13→volgende releaseproef volgt bij de gecombineerde vrijgave.

## Review

ChatGPT, gesprek “Septembertransacties controleren”, keurde het minimale voorstel vooraf goed. De technische eindreview gaf akkoord voor een afzonderlijke lokale commit, onder voorwaarde van dezelfde peildatum/financiële basis en het slagen van de 28 browsertests. Beide voorwaarden zijn gecontroleerd. Geen merge- of publicatieakkoord voor de combinatie is hiermee verondersteld.

Geen productiegegevens, bankverbinding, backend of financiële brongegevens zijn door deze werkzaamheden gewijzigd.

## Aanvullende brede controle

De volledige Node-run (76 testbestanden) bracht drie oude salarisgrafiekverwachtingen aan het licht die nog uitgingen van een exclusieve einddag en een maandlimiet. Die verwachtingen volgen nu de gevraagde inclusieve inkomensdag. Daarnaast is de opslagperiodeaanvraag voor een verre toekomstige grafiekmaand hersteld: laden tot de maand na de latere van vandaag en de zichtbare startdatum. Dit verandert geen financiële brongegevens of KPI-periode. De volledige Node-run slaagt na deze correctie; de gecombineerde browser- en releasecontrole volgt afzonderlijk. Het gegenereerde bestand wordt bij de gecombineerde build gecontroleerd.
