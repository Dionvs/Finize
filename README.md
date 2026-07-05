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
