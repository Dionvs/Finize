# V118-r7: extra inkomsten wel of niet verdelen als zakgeld

- Bij het verwerken en handmatig bewerken van extra inkomsten staat een standaard checkbox: Meetellen voor zakgeldverdeling. Salaris houdt zijn bestaande verwerking.
- Aangevinkt telt de ontvangst mee in de bestaande verdeling. Uitgevinkt blijft het inkomen bij gezamenlijk en verhoogt het geen van beide zakgeldbedragen. De werkelijke inkomsten en bankbedragen blijven intact.
- Bestaande transacties blijven meetellen totdat de gebruiker expliciet anders kiest en opslaat. Geen migratie of automatische herboeking.
- Een spaarinleg gekoppeld aan uitgevinkt inkomen verbruikt het apart gehouden bedrag één keer. Ook een persoonlijk spaardoel dat uit deze gezamenlijke inkomsten wordt betaald verlaagt het persoonlijk zakgeld niet nogmaals.
- Het dashboard vermeldt bij Zakgeld welk inkomen buiten de verdeling blijft. Importgoedkeuring, originele bankbron, opslaan en herladen gebruiken bestaande functies.
- Release-assets: 118-r7 / finize-v118-r7. De oudere algemene UI-tests voor het oude jaaroverzicht en oude budgetknoppen blijven buiten de gerichte groene controles.

## Verificatie

301 gerichte Node-tests geslaagd. Negen browserchecks geslaagd: mobiele/desktopkeuze, handmatige invoer, aan/uit en opnieuw opslaan, gekoppeld sparen en herladen, behoud van de bestaande administratieve koppeling, offline herladen en upgrade/terugrol met gegevensbehoud. Syntax, CSS, reproduceerbare build en diffcontrole geslaagd.
