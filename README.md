# Finize

Finize is een persoonlijke budgetplanner voor gezamenlijke uitgaven, persoonlijke balans, transacties en spaardoelen.

Live app: https://dionvs.github.io/Finize/

## PWA installeren

- Android Chrome: open de app, gebruik het browsermenu en kies **Toevoegen aan startscherm**.
- iPhone Safari: open de app, tik op delen en kies **Zet op beginscherm**.

## Opslag

Gegevens worden lokaal opgeslagen in de browser. Als Firebase/Firestore is verbonden, kan de app live synchroniseren tussen apparaten.

## Bestanden

- `index.html` is de actieve GitHub Pages app.
- `index-OLD.html` is een back-up van de vorige versie.
- `manifest.json` en `service-worker.js` maken de app PWA-ready.
- `firestore.rules` bevat de gepubliceerde toegangsregels voor Finize en zijn importchunks.
- `icons/` bevat de app-iconen.
