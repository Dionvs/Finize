# Finize v113 — technisch implementatieverslag

Werkgebied: `agent/v113-csv-verwerking` in de aangewezen Google Drive-repository. Er is niets gepusht, gemerged of gedeployd en er zijn geen productiegegevens gewijzigd. Dit verslag beschrijft de werkelijke implementatie en de lokale verificatie; de releasebeslissing blijft afzonderlijk.

## A. Aangetroffen problemen

- `applyTransactionFamily()` en de splitsingseditor in `src/import/runtime.js` verloren bij splitsen of een typewissel geldige bestemmingen en bedragen. Handmatige en automatische bedragen waren onvoldoende onderscheiden.
- De oorspronkelijke bankmutatie werd in verschillende overzichten afgeleid van goedgekeurde financiële regels. Daardoor konden nog niet goedgekeurde, uitgesloten en gesplitste transacties verkeerd worden weergegeven.
- `createImportDraft()` bewaarde bewezen duplicaten met `duplicateSource`, maar lifecyclebewerkingen behandelden verwerkingen vooral als eigendom van één batch. Een overlappende actieve import bood daardoor onvoldoende bescherming bij terugtrekken of verwijderen van de eerste batch.
- Heropening en verwerking van goedgekeurde imports hadden onvoldoende scheiding tussen lokaal concept en de opgeslagen goedgekeurde effecten. Bronvervanging moest ook via een tweede import naar dezelfde bankbron veilig blijven.
- `refund-exceeds-category` blokkeerde toegestane negatieve categoriebelasting. Een spaaropname kon nog niet rechtstreeks over optionele budgetcategorieën worden verdeeld met behoud van één doelmutatie.
- Algemene meldingen maakten bedragverschillen en ontbrekende bestemmingen slecht herleidbaar. Een volledige rij opnieuw renderen tijdens bedraginvoer kon bovendien focus en de volgende klik verliezen.
- Oude onverwerkte importregels die uitsluitend in IndexedDB stonden, hadden geen leesbare bankprojectie. Een ontbrekende bronkoppeling werd onvoldoende onderscheiden van een normale, geldige oudere transactie.

## B. Uitgevoerde wijzigingen

### Editor en validatie

`src/core/processing-lines.mjs` bevat de centrale pure centverdeling. Nieuwe splitsingen beginnen met twee automatische regels; de eerste bewaart de bestaande bestemming. Een specifieke vaste-lastkoppeling wordt niet naar de tweede regel gekopieerd. Vaste bedragen blijven behouden, afrondingscenten volgen de regelvolgorde en een nieuwe regel begint op nul als alle bestaande regels handmatig zijn. Oude regels zonder metadata gelden als handmatig.

Regel-ID's en vastzettingen blijven bij een typewissel behouden. Alleen onverenigbare bestemmingen worden verwijderd. Eén resterende regel klapt in naar gewone verwerking met behoud van bedrag, bestemming, ID en een aparte totaalreferentie. Een verschil blijft dus ongeldig, ook na inklappen.

De editor gebruikt standaard HTML-invoer, bedrag naast bestemming, noodzakelijke vervolgvelden, verwijderknoppen en horizontale lijnen. Bedragwijzigingen werken andere automatische bedragen bij zonder het actieve invoerveld of de volgende knop te vervangen. Validatie geeft intern bron-, regel- en veldgegevens en verschillen in centen; zichtbare meldingen zijn Nederlands en concreet.

### Centrale financiële motor

De bestaande `transaction-engine.mjs`, `transaction-processing.mjs` en hun selectors blijven de financiële waarheid. Uitgaven ondersteunen budget, meerdere vaste lasten en gedeeltelijke uitsluiting binnen één hoofdtype. Vaste-lastactuals worden uit actieve betalingen afgeleid; planning blijft gelijk.

Een spaaropname levert eenmaal een doelmutatie op. `directBudgetAllocations` beschrijft optionele categoriecorrecties; deze delen de opnamecapaciteit met bestaande spaardekking. `categoryActuals()` en `categoryProcessingDetails()` gebruiken dezelfde effecten. Zowel maandtotalen als categoriedetails bevatten de directe correctie. Onvoldoende doelsaldo en overbenutting blijven blokkerend.

Terugbetalingen ondersteunen meerdere categorieën en correctiemaanden, met de bankmaand als standaard voor de v113-editor. De categoriecapaciteitsblokkade is verwijderd. Negatief gebruik blijft in berekeningen en tekst zichtbaar; uitsluitend de grafische balkbreedte wordt begrensd. Terugbetaling en spaarcorrectie wijzigen geen gepland zakgeld.

### Bronnen, lifecycle en opslag

`src/core/bank-sources.mjs` voegt bronrecords met `recordRole: bank-source` toe aan de bestaande transactieverzameling. Er is geen tweede bankadministratie of importdatabase. Het bronrecord bewaart het origineel, stabiele `bankSourceId`, compacte `importReferences`, de goedgekeurde verwerking en een verwerkingsrevisie. De bestaande financiële selectors sluiten deze bronrecords uit.

De bron blijft actief zolang een bestaande batchverwijzing actief is. `import-lifecycle.mjs` behoudt verwerking en stabiele relaties wanneer andere imports de bron ondersteunen. Herstellen activeert eenmaal; verwijderen van de laatste verwijzing volgt het bestaande verwijderprotocol. Conflictdetectie in `import-sync-protocol.mjs` vergelijkt ook gedeelde bankbronnen.

Bestaande betrouwbare bronbewijzen blijven leidend. Oppervlakkige overeenkomsten worden niet automatisch samengevoegd. De gebruiker kiest bij een mogelijke overlap expliciet dezelfde beweging of een afzonderlijke betaling; herhaling behoudt die keuze. Rekeningkenmerken en fysieke rekeningcontext blijven onafhankelijk van budgeteigenaar.

Oude onverwerkte imports worden op een kloon gelezen via dezelfde bronadapter. Een vluchtige leesbuffer binnen de bestaande `ImportStore` wordt bij huishoudwissel gewist. Dit voegt geen persistente opslag toe en verandert of keurt geen oude gegevens goed bij openen of herladen.

### Herbewerken en bronherstel

`beginImportEditor()` maakt een lokaal concept vanuit de actuele opgeslagen bron. `commitImportEditor()` valideert de geselecteerde eindtoestand, controleert import- en bronversies en gebruikt het bestaande journal, de synchronisatie-outbox en bronvervanging. Andere lokale wijzigingen worden niet stilzwijgend toegepast. Annuleren en sluiten wijzigen de actieve effecten niet. Een mislukte opslag behoudt de oude goedgekeurde toestand. Ook een mislukte synchronisatiewachtrij of afgebroken financiële commit draait reeds geschreven importdetails terug; het journal markeert een gemelde fout als teruggedraaid zodat herladen die niet alsnog toepast. De editor bewaart zijn oorspronkelijke huishoudscope en kan na een huishoudwissel geen concept of verwerking in het andere huishouden schrijven.

`src/import/source-repair.mjs` controleert eerst of bronherstel nodig is. Geldige oudere transacties openen rechtstreeks. Bij een defect worden rekening, datum, bedrag en beschikbare aanvullende kenmerken vergeleken met opnieuw aangeboden CSV-data. Bevestiging herstelt de bestaande relatie met behoud van classificatie, splitsingen en effecten. Een herstelactie controleert opnieuw de versies en het huishouden. De bestaande `StateBackupStore` maakt vooraf een teruggelezen, integriteitsgecontroleerde back-up. Een onzekere overeenkomst, verkeerde bron, beschadigde back-up, opslagfout of conflict laat de oude toestand intact.

## C. Financiële correctheid

De oorspronkelijke bankbeweging en de goedgekeurde financiële verwerking worden afzonderlijk geselecteerd. `selectBankTransactions()` toont eenmaal het oorspronkelijke getekende bedrag, de bankdatum en de fysieke rekening, onafhankelijk van classificatiestatus. Financiële selectors gebruiken uitsluitend geldige actieve goedgekeurde effecten.

Een split creëert financiële bestemmingen en geen extra bankbeweging. Gedeeltelijk Niet meetellen sluit alleen die bestemming uit. Een correctiemaand verplaatst alleen een budgetcorrectie. Een spaarmutatie creëert geen fictieve banktransactie. Interne overboekingen leveren geen regulier huishoudinkomen of uitgaven op.

Herbewerken vervangt de effecten van dezelfde stabiele bron. Importondersteuning, split-ID's en relatie-ID's blijven behouden, zodat vaste lasten en spaardekking niet aan achtergebleven resultaten blijven hangen. Herhaald opslaan, importeren, terugtrekken en herstellen wordt afzonderlijk getest op idempotentie.

De geïsoleerde financiële referentie bevat bestaande goedgekeurde uitgave- en spaargegevens. De twee oorspronkelijke effecten, volledige forecast, planning en afgesloten snapshots zijn onveranderd vergeleken. Zie `v113-protected-reference.json` en regressietest 75 met `tests/fixtures/v113-financial-reference.json`. De vergelijking is een fixturecontrole, geen inspectie van productiehuishoudens.

## D. Compatibiliteit en back-up

Schema v11 blijft behouden. Nieuwe velden zijn optioneel; er is geen massamigratie. Aanvulling van bronverwijzingen gebeurt bij noodzakelijke expliciete bewerkingen; leesadapters houden oude imports bruikbaar. Bestaande gemengde legacyverwerkingen worden niet door alleen openen ongeldig gemaakt.

Vóór wijzigingen zijn oorspronkelijke bronbestanden, tests, documentatie en runtimebestanden lokaal bewaard in `backups/v113-csv-verwerking/`. Een manifest controleert 198 oorspronkelijke bestanden met SHA-256 en teruglezen. Deze ontwikkelback-up is lokaal en genegeerd door Git. Herstel van gebruikersgegevens gebruikt apart de bestaande scoped back-upvoorziening in de app.

Bestaande lokale wijzigingen zijn behouden. `index.html`, `firestore.rules`, serviceworker, packageconfiguratie en lockfile zijn niet inhoudelijk gewijzigd. `app.js` en `app.css` zijn uit bronmodules gegenereerd. Huishoudisolatie, importopslag en cloudconflictafhandeling blijven via de bestaande architectuur lopen.

## E. Tests en controleerbaar bewijs

De definitieve resultaten staan in `v113-verification.json`: 50 Node-testbestanden geslaagd, 551 geregistreerde Node-testgevallen geslaagd (plus assertions in de bestaande script-tests), 229 browsertests geslaagd en nul mislukte tests. De nieuwe V113-set bevat 85 Node-testgevallen en 11 browsergevallen. Productiebuild, syntax, CSS, gegenereerde runtime en `git diff --check` zijn geslaagd. Het volledige projectcommando `pnpm test` omvat Node-tests, JavaScript-syntax, CSS, byte-reproduceerbare runtimecontrole en Playwright. De nieuwe gerichte set staat in `tests/v113-csv-processing.test.cjs` en `tests/browser/v113-csv-processing.spec.cjs`.

De browsercontrole gebruikt Chromium op 360px en 1440px, echte CSV-bestandsinvoer, IndexedDB, herladen en een afzonderlijke offline PWA-sessie. De workflow omvat importeren, details, splitsen, bestemmingen, verwerken, heropenen, wijzigen en opnieuw opslaan. Ook expliciete duplicaatkeuzes, gedeelde importondersteuning, echte herstelback-up en oude onverwerkte imports zijn via de interface gecontroleerd. Mobiele en desktopafbeeldingen zijn lokaal bekeken; geen horizontale overloop op 360px.

De oorspronkelijke browsernulmeting had 214 geslaagde en vier mislukte tests. Twee fixtures misten expliciete rekening/goedkeuringscontext; twee verwachtingen telden een terugbetaling van €100 als normaal inkomen. Fixtures en verwachtingen zijn aan de bestaande financiële betekenis gekoppeld. Verder zijn verwachtingen voor het behoud van goedgekeurde effecten tijdens bewerken en negatieve categoriebelasting volgens de opdracht aangepast. De journaltests onderscheiden nu een daadwerkelijk achtergebleven pending ontvangstbewijs na een abrupte onderbreking van een gemelde opslagfout: alleen de eerste mag worden hervat. Dezelfde assertions op eenmaal toepassen en behoud van oude effecten blijven gelden. Financiële assertions zijn niet uitgeschakeld.

CSS meldt het bestaande ongedefinieerde token `--line`; de controle slaagt. De omgeving gebruikte de gebundelde pnpm 11.25 met bestaande dependencies; automatische dependencyherinstallatie is voor de verificatie uitgeschakeld vanwege een Google Drive-symlinkfout. Projectconfiguratie en lockfile blijven behouden.

### Dekking van de 60 gevraagde acceptatiescenario's

Onderstaande nummers verwijzen naar de benoemde V113-tests in het nieuwe Node-testbestand. Browser verwijst naar het nieuwe Playwright-bestand. Meerdere assertions binnen een test dekken samen een scenario; dit zijn geen zestig afzonderlijke browserruns.

| Oorspronkelijk scenario | Bewijs |
|---|---|
| 1 automatisch splitsen | 01–04 |
| 2 handmatige bedragen | 02–08 |
| 3 exacte eurocenten | 04 |
| 4 totaal te hoog/laag | 07, 10, 29 |
| 5 één resterende regel | 09–10 |
| 6 budget/vaste last/uitsluiting | 14 |
| 7 meerdere vaste lasten | 15 |
| 8 één spaardoel, optionele categorieën | 16–18 |
| 9 directe correctie en dekking | 19–20, 63 |
| 10 terugbetaling per categorie/maand | 23 |
| 11 negatief gebruik | 24, browser sparen/refund |
| 12 volledig herbewerken | 28–32, 66, browser volledige workflow |
| 13 hoofdtype behoudt bedragen | 12–13 |
| 14 ongeldig concept behoudt oude effecten | 29, 33 |
| 15 annuleren | 30, browser volledige workflow |
| 16 herhaald opslaan | 31 |
| 17 vaste-laststatus na wijzigen | 15, 65–66 |
| 18 één oorspronkelijke overzichtsregel | 35, browser volledige workflow |
| 19 oude batches | 39, 50, 73–74 |
| 20 synchronisatieconflict | 34, 49, 59, 72 |
| 21 bron blijft bij Onbekend/Nakijken | 27, 73 |
| 22 splits blijft één bankbeweging | 14, 35 |
| 23 herclassificatie wijzigt origineel niet | 28, 70 |
| 24 gedeeltelijk Niet meetellen | 14, browser volledige workflow |
| 25 interne overboeking | 36, bestaande overboekingstests |
| 26 sparen creëert geen bankbron | 16–21 |
| 27 refund behoudt bankdatum | 23 |
| 28 identieke afzonderlijke betalingen | 37, browser keuze distinct |
| 29 herimport/herverwerking | 31, 40–47, browser overlap/keuzes |
| 30 ontbreken nieuwe rekeningvelden | 39, 50, 73 |

| Aanvulling | Scenario 1–10: bewijs per scenario |
|---|---|
| Overlap | 40; 41; 42; 43; 44; 45; 37; 48/65; 47; 39/63/74 |
| Eerste splitsactie | 01; 01; 04; 03; 11; 12; 12; 09; 10/29; 30 |
| Noodzakelijk herstel | 50/60; 51; 51; 52; 53/55; 54; 58; 59/72; 51/52; 39/50/73 |

Aanvullend getest: laatste actieve import verwijderen met een inactieve andere verwijzing (61), handmatige vervangingen (62), gedeeltelijk verloren bronbedrag (64), beschadigd bronheader (68), oude undo-route (69), fysieke rekening bij herbewerken (70), centrale categoriedetails (71), huishoudwissel tijdens herstel (72) en leesbare oude onverwerkte overlap zonder gegevensconversie (73–74). Tests 75–81 bewaken de opgeslagen financiële referentie, fouten in importopslag/wachtrij/financiële commit inclusief herstart en de huishoudscope van een open editor. Na de duurzame financiële commit wordt een fout in journalopruiming als herstelbare afronding behandeld; de interface meldt dan geen mislukte financiële verwerking en journalherstel past niets dubbel toe.

## F. Resterende beperkingen en niet-geteste onderdelen

- Geen fysieke Androidtelefoon gebruikt; mobiel is Chromium met 360px viewport. Andere browserengines zijn niet apart getest.
- Geen productie-Firestore of echte gelijktijdige apparaten gebruikt. Cloudconflicten en huishoudgrenzen zijn lokaal met de bestaande testvoorzieningen gecontroleerd; dit vervangt geen productieproef.
- Onherstelbare bronnen zonder betrouwbaar rekeningkenmerk worden bewust niet automatisch gekoppeld. De app behoudt de bestaande verwerking en geeft een concrete vervolgstap.
- De financiële referentie is representatief en geïsoleerd; er is geen volledige audit van alle persoonlijke historische productiegegevens uitgevoerd.
- De v113-versiemarker en PWA-cache-identiteit zijn behouden. Bij een afzonderlijke release moet de normale versie- en cachevernieuwing nog worden uitgevoerd, zodat bestaande installaties de gewijzigde runtime ontvangen.
- Back-upmanifest, screenshots en volledige uitvoerlogs staan lokaal onder de genegeerde back-upmap. De compacte verificatie en referentieresultaten staan wel in de reviewbare wijziging.

## G. Releasegereedheid

Ja: deze implementatie is lokaal technisch gereed voor een afzonderlijke releasebeslissing, op basis van de groene controles in `v113-verification.json` en met de beperkingen uit F. Vóór publicatie hoort de normale versie- en PWA-cachevernieuwing bij de releasevoorbereiding. Publicatie blijft een afzonderlijke beslissing na beoordeling van deze branch. Er zijn geen productiegegevens gemigreerd en er is geen release uitgevoerd.
