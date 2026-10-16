// Adds keyboard behavior to the existing dialogs; all close/save handlers remain authoritative.
const modalSelector = '.modal-backdrop.open > .modal, #u4ImportModalRoot.open > .u4-import-modal, .u4-match-dialog, .u4-validation-dialog';
const focusSelector = 'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),a[href],summary,[tabindex]:not([tabindex="-1"])';
const visible = element => element.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
const focusable = dialog => [...dialog.querySelectorAll(focusSelector)].filter(element => visible(element) && !element.closest('[inert]'));
const fields = dialog => JSON.stringify([...dialog.querySelectorAll('input,select,textarea')].map(field => [field.id || field.name, field.type === 'checkbox' || field.type === 'radio' ? field.checked : field.value]));
let active = null, lastOutside = null, pendingRestore = null, sequence = 0;
const sessions = new WeakMap(), inerted = new Map();
function openerSelector(element) {
  if (!element) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  for (const attribute of ['data-open-owner-variable','data-open-goal-editor','data-personal-saving-edit','data-u3-planning-owner','data-open-personal-transaction','data-open-joint-transaction','data-tab','data-p3-info','data-p3-action']) {
    if (element.hasAttribute(attribute)) return `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
  }
  if (element.matches('.ux-card-primary')) {
    for (const attribute of ['data-open-income-overview','data-u5-select-goal','data-edit-joint-transaction','data-edit-personal-transaction']) {
      const card=element.closest(`[${attribute}]`);
      if (card) return `[${attribute}="${CSS.escape(card.getAttribute(attribute))}"] > .ux-card-primary`;
    }
  }
  return null;
}

function unlock() {
  for (const [element, wasInert] of inerted) element.inert = wasInert;
  inerted.clear();
}
function lock(dialog) {
  // Inert siblings along the ancestor path, including other open dialog roots.
  for (let branch = dialog; branch.parentElement; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch || ['SCRIPT','STYLE','LINK'].includes(sibling.tagName)) continue;
      inerted.set(sibling, sibling.inert); sibling.inert = true;
    }
    if (branch.parentElement === document.body) break;
  }
}
function closeButton(dialog) {
  return [...dialog.querySelectorAll('button')].find(button => !button.disabled && visible(button) &&
    (/^(sluiten|annuleren)$/i.test(button.textContent.trim()) || button.getAttribute('aria-label') === 'Sluiten'));
}
function allowClose(dialog) {
  const session = sessions.get(dialog);
  // Import editors already preserve their concepts through their own close handlers.
  if (!session?.edited || dialog.closest('#u4ImportModalRoot') || fields(dialog) === session.initial) return true;
  if (!confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Sluiten zonder opslaan?')) return false;
  session.initial = fields(dialog); session.edited = false;
  return true;
}
function update() {
  const dialogs = [...document.querySelectorAll(modalSelector)].filter(visible);
  const next = dialogs.at(-1) || null;
  if (next === active) {
    // Some existing close handlers redraw the dashboard and load its cards asynchronously.
    if (!next && pendingRestore) {
      const target=[...document.querySelectorAll(pendingRestore.selector)].find(visible);
      if (target) { pendingRestore=null; target.focus({preventScroll:true}); }
      else if (performance.now()>pendingRestore.until) pendingRestore=null;
    }
    return;
  }
  const previous = active, oldSession = previous && sessions.get(previous);
  unlock(); active = next;
  if (!next) {
    const replacement = oldSession?.openerSelector && [...document.querySelectorAll(oldSession.openerSelector)].find(visible);
    const target = oldSession?.opener?.isConnected ? oldSession.opener : replacement ||
      [...document.querySelectorAll('button')].find(button => visible(button) && oldSession?.openerLabel && button.getAttribute('aria-label') === oldSession.openerLabel);
    if (target && visible(target) && !target.closest('[inert]')) target.focus({ preventScroll: true });
    else if (previous) {
      if (oldSession?.openerSelector) pendingRestore={selector:oldSession.openerSelector,until:performance.now()+2000};
      [...document.querySelectorAll('.tab-btn.active')].find(visible)?.focus({ preventScroll: true });
    }
    return;
  }
  pendingRestore=null;
  let informationOpener = null;
  for (const panel of document.querySelectorAll('[popover]')) {
    const nativeOpen = typeof panel.hidePopover === 'function' && panel.matches(':popover-open');
    if (next.contains(panel) || !nativeOpen && panel.dataset.open !== 'true') continue;
    const control = panel.id && document.querySelector(`[aria-controls="${CSS.escape(panel.id)}"]`);
    if (panel.contains(lastOutside)) informationOpener = control;
    if (nativeOpen) panel.hidePopover();
    else delete panel.dataset.open;
    control?.setAttribute('aria-expanded','false');
  }
  if (!sessions.has(next)) {
    const focused = document.activeElement;
    const opener = informationOpener || (!next.contains(focused) && focused !== document.body ? focused : lastOutside);
    sessions.set(next, { opener, openerSelector:openerSelector(opener), openerLabel:opener?.getAttribute('aria-label'),
      initial: fields(next), edited: false });
  }
  next.setAttribute('role', 'dialog'); next.setAttribute('aria-modal', 'true');
  if (!next.hasAttribute('aria-label') && !next.hasAttribute('aria-labelledby')) {
    const heading = next.querySelector('h1,h2,h3');
    if (heading) { heading.id ||= `finize-dialog-title-${++sequence}`; next.setAttribute('aria-labelledby',heading.id); }
    else next.setAttribute('aria-label','Finize venster');
  }
  lock(next);
  if (oldSession?.opener && next.contains(oldSession.opener) && visible(oldSession.opener)) oldSession.opener.focus({ preventScroll:true });
  if (!next.contains(document.activeElement)) {
    const initial = focusable(next).find(element => element.matches('input:not([type="checkbox"]):not([type="file"]),select,textarea')) || focusable(next)[0];
    if (initial) initial.focus({ preventScroll: true });
    else { next.tabIndex = -1; next.focus({ preventScroll: true }); }
  }
}
document.addEventListener('focusin', event => {
  // Existing open handlers may focus the dialog before the observer runs.
  // Do not mistake that first internal focus for the element that opened it.
  if (!active && !event.target.closest(modalSelector)) lastOutside = event.target;
  else if (active && !active.contains(event.target)) (focusable(active)[0] || active).focus({ preventScroll:true });
});
document.addEventListener('pointerdown',()=>{pendingRestore=null;},true);
for (const type of ['input','change']) document.addEventListener(type, event => {
  if (active?.contains(event.target)) sessions.get(active).edited = true;
}, true);
document.addEventListener('click', event => {
  if (!active) return;
  const button = event.target.closest('button');
  const isClose = button && active.contains(button) &&
    (/^(sluiten|annuleren)$/i.test(button.textContent.trim()) || button.getAttribute('aria-label') === 'Sluiten');
  const isBackdrop = event.target === active.parentElement;
  if ((isClose || isBackdrop) && !allowClose(active)) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
document.addEventListener('keydown', event => {
  if (!active || event.defaultPrevented) return;
  if (event.key === 'Escape') {
    // Reuse the existing button, including its draft preservation and validation behavior.
    const button = closeButton(active);
    if (button) { event.preventDefault(); event.stopImmediatePropagation(); button.click(); }
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusable(active), first = items[0], last = items.at(-1);
  if (!first) { event.preventDefault(); active.focus(); return; }
  if (!active.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
    event.preventDefault(); (event.shiftKey ? last : first).focus();
  }
}, true);
new MutationObserver(update).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class','hidden'] });
update();
