# V118-r45 — titel en maandpil bovenaan logo uitlijnen

Titel en maandpil beginnen aan dezelfde bovenkant als het ongewijzigde logo. De regelhoogte van de titel en pilhoogte zijn 25,25 px, de helft van het normale logo van 50,5 px. De bestaande kleinere logo's op smalle schermen blijven behouden. De statusregels, hun rijpositie en tekstvormgeving blijven ongewijzigd; lange statusmeldingen mogen doorgroeien.

Controle: zes header-/navigatiegevallen geslaagd op 195/320/390/430 px, waaronder exacte bovenuitlijning en halverwegepositie op 390 px. Twaalf aanvullende mobiele tabcontroles en offline r45-herladen slagen met ongewijzigde fictieve financiële state. Screenshot geopend; syntax, CSS en reproduceerbare build gecontroleerd. De eerder gemelde brede testfouten en bekende CSS-token --line vallen buiten deze gerichte wijziging; geen volledige suite of fysieke telefoontest uitgevoerd.

Rollback: dd11756989a693bbfc050706d530a5a26e6b5f2a, tag rollback/v118-r44-before-header-alignment. Geen financiële logica of gegevens gewijzigd. Na push worden Pages, publieke hashes en twaalf live tabweergaven gecontroleerd.
