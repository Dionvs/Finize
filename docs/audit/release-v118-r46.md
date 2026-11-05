# V118-r46 — zichtbare titelverhouding volgens afbeelding

De eerdere correctie lijnde vooral de regelvakken uit. Deze vervolgcorrectie maakt de titel schreefloos en groter (21 px normaal, 18 px onder 360 px), met 25,25 px regelhoogte. De maandpil blijft 25,25 px hoog, begint bovenaan het ongewijzigde logo en eindigt halverwege het normale logo. De pil krijgt minder horizontale padding zodat ook september en Gezamenlijk op één regel passen. Statusmelding, logo en headerrooster blijven behouden.

Zes gerichte header-/navigatietests geslaagd op 195/320/390/430 px. De compacte gevallen controleren nu expliciet september, titelgrootte, één regel, geen overlap, bovenuitlijning en de halve logohoogte. Screenshot geopend. Twaalf aanvullende tabcontroles en offline herladen slagen met ongewijzigde fictieve state. Syntax, CSS, reproduceerbare build en diff gecontroleerd. Geen financiële wijziging; de eerdere brede testfouten vallen buiten deze gerichte correctie. Geen fysieke telefoontest.

Een afzonderlijke lokale upgradeproef van r44 naar r45 bevestigt dat een reeds geopende pagina na een worker-update nog zijn oude weergave kan houden; herladen toont de nieuwe versie en behoudt de teststate, ook offline. Dit bewijst niet welke versie op de telefoon van de gebruiker stond. Geen cache- of updatecode gewijzigd.

Rollback: a46f3051d9fbe1be38e0c79e7402d7cfc550f576; tag rollback/v118-r45-before-title-scaling. Publicatie omvat controle van Pages, publieke bestandshashes en mobiele tabs.
