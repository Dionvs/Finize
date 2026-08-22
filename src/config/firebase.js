export const FIREBASE_SDK_VERSION = '11.10.0';

export const DEFAULT_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyCiJHGv9nlC_o4c2Xyj9UcyqHWW-YTxKfY',
  authDomain: 'financien-7dd43.firebaseapp.com',
  projectId: 'financien-7dd43',
  storageBucket: 'financien-7dd43.firebasestorage.app',
  messagingSenderId: '487713041493',
  appId: '1:487713041493:web:68c897ae2fa06afd5838dc',
  measurementId: 'G-X2EXXZDK7S'
});

// Update 6 gebruikt uitsluitend vooraf gekoppelde, geverifieerde accounts.
// Lokale browsertests kunnen de laag daarnaast via window.__FINIZE_AUTH_ENABLED__ activeren.
export const AUTH_RELEASE_ENABLED = true;
