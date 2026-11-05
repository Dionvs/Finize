const isIphone = /iPhone|iPod/i.test(navigator.userAgent || '');
document.documentElement.classList.toggle('finize-ios-phone', isIphone);

// Reserve the actual navigation height, including its scrollbar and safe areas.
document.addEventListener('DOMContentLoaded', () => {
  const navigation = document.querySelector('.v4-bottom-nav');
  if (!navigation) return;
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--mobile-nav-height', `${navigation.getBoundingClientRect().height}px`);
  }).observe(navigation);
});
