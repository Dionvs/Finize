# V118-r44 — headerverhouding volgens referentie

Logo en responsieve logomaten blijven gelijk aan r43. De titel groeit van 18 naar 20 px (op smalle schermen van 16 naar 17 px). De maandselectie groeit naar 13 px tekst en een pil van 30 px hoog; op smalle schermen blijft de maandtekst 11 px. Titel en pil blijven verticaal gecentreerd op dezelfde regel. Status blijft daaronder, de normale header blijft maximaal 60 px hoog en lange statusmeldingen mogen doorgroeien.

Gecontroleerd: zes gerichte browsergevallen op 195/320/390/430 px, lange status, bereikbare navigatie en compacte header; twaalf aanvullende tabcontroles op 320/390 px met ongewijzigde fictieve financiële state; offline herladen met r44-cache en ongewijzigde state. Screenshots geopend. Syntax, CSS, reproduceerbare build en diff-controle geslaagd. De bekende ongedefinieerde CSS-token --line blijft bestaan.

Het afzonderlijke testonderzoek van 5 november is afgerond en staat als Finize-testonderzoek-2026-11-05.md in de financiële werkmap met bewijsmap. De daarin gemelde 15 Node- en negen browsermislukkingen en de functionele oplossingen zijn niet onderdeel van deze visuele release. De brede suite is voor deze gerichte wijziging niet opnieuw uitgevoerd. Geen financiële logica, gegevensmigratie of productiegegevens gewijzigd. Geen fysieke telefoontest uitgevoerd.

Rollback: 86dc2a4a4c320d2e984701f343cbfdad03d9f480, lokale tag rollback/v118-r43-before-header-proportions. Publicatiecontrole: Pages-succes, publieke bestandshashes en mobiele tabs worden na push gecontroleerd.
