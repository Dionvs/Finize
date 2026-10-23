# V118-r10 — bewaarde conflictversies downloaden

23 oktober 2026. Na afronding van de banktoestemming bevestigt het echte rekeningvenster de status **Verbonden** voor het bedoelde profiel. Oudere synchronisatieconflicten staan nog open; de eerste bankupdate wacht op beoordeling daarvan.

Het bestaande conflictvenster krijgt per conflict een knop **Beide versies downloaden**. Deze leest het duurzame conflictjournaal en gebruikt de bestaande JSON-downloadfunctie. De download bevat beide opgeslagen versies, de conflictstatus en exportdatum. Er worden geen keuzes gemaakt, gegevens opgeslagen of cloudverzoeken verstuurd. Ook een reeds opgelost journaal kan nog als bewaarde bron worden gedownload. Ontbrekende gegevens geven een zichtbare fout; de knop wordt altijd weer beschikbaar.

De herstelbestanden bevatten privégegevens en blijven buiten de repository. Het exporteren lost het conflict niet op. De bestaande oplossingen en hun gevolgen blijven behouden; een lokale keuze wordt niet gewist om een bankupdate mogelijk te maken.

De browsercontrole gebruikt bewust verschillende lokale en cloudtransacties en controleert dat de volledige export overeenkomt met het journaal. Actieve financiën en conflictkeuzes blijven ongewijzigd, ook na herladen. Het venster wordt tevens op 320 pixels op horizontale overloop gecontroleerd. Aanvullend worden de bestaande rekening-, bank-, beveiligings- en releasecontroles uitgevoerd.

Deze release past uitsluitend de frontend en bijbehorende releaseverwachtingen aan. Backend, IAM, secrets en bewaartermijnen blijven ongewijzigd. Voor publicatie worden syntax, reproduceerbare bundel, de Node-controles en gerichte browsercontroles gecontroleerd; na publicatie worden de Pages-commit en de openbare bestanden vergeleken.

Verificatie vóór publicatie: alle 73 Node-testbestanden geslaagd, 42 gerichte browsergevallen geslaagd. Twee afzonderlijke V117-herstelproeven zijn volgens hun bestaande voorwaarde overgeslagen omdat de optionele V117-herstelmap niet is opgegeven; de onafhankelijke r4-upgrade/offline/rollbackproef en de P7-cache-/herlaadproeven zijn wel geslaagd. De eerste uitvoering van de nieuwe backuptest had een lege transactiefixture; na correctie naar expliciete synthetische voorbeelden is de volledige gerichte reeks opnieuw geslaagd. Syntax, reproduceerbaarheid en controle op privéconfiguratie in de publicatie zijn geslaagd.
