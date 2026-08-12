const isIphone = /iPhone|iPod/i.test(navigator.userAgent || '');
document.documentElement.classList.toggle('finize-ios-phone', isIphone);
