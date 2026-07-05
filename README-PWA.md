# Finize

Clear household budgeting for shared expenses, savings goals, and fair personal balance.

Single-file GitHub Pages app with Firestore sync via `budgetPlanners/finize`.

Live URL:

https://dionvs.github.io/Finize/

Firestore rules for public link sharing:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /budgetPlanners/finize {
      allow read, write: if true;
    }
  }
}
```


## PWA-ready kopie

Deze map bevat een PWA-ready kopie van de Finize app. Alle nieuwe bestanden hebben `PWA` in de naam, zodat ze niet door de bestaande bestanden lopen.

Bestanden:

- `index-PWA.html` — kopie van de app met PWA metadata en service-worker registratie.
- `manifest-PWA.json` — PWA manifest met relatieve paden voor GitHub Pages.
- `service-worker-PWA.js` — offline cache voor de app-shell.
- `icons-PWA/finize-PWA-icon-192.png` — PWA icoon 192×192.
- `icons-PWA/finize-PWA-icon-512.png` — PWA icoon 512×512.

Testen via GitHub Pages:

1. Upload alle PWA-bestanden naar de root van de repo.
2. Open `https://dionvs.github.io/Finize/index-PWA.html`.
3. Android Chrome: menu → Toevoegen aan startscherm.
4. iPhone Safari: delen → Zet op beginscherm.

Definitief maken:

Als alles werkt, kun je `index-PWA.html` hernoemen naar `index.html`, `manifest-PWA.json` naar `manifest.json`, `service-worker-PWA.js` naar `service-worker.js`, en de verwijzingen in de HTML overeenkomstig aanpassen. Voor deze kopie zijn bewust PWA-namen gebruikt om verwarring met je huidige bestanden te voorkomen.


## Logo

De PWA-iconen zijn gemaakt op basis van het aangeleverde Finize-logo.

- `icons-PWA/finize-PWA-icon-192.png`
- `icons-PWA/finize-PWA-icon-512.png`
