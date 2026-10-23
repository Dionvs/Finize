import { stageProviderSnapshot, providerBatchId } from '../import/enable-banking-adapter.mjs';
import { bankAuthorizationUrl } from '../import/bank-authorization-url.mjs';

export const BANK_BACKEND_URL = 'https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking';
export const BANK_API_ENABLED = true; // Backend independently restricts access to the configured user and account.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const messages = {
  'backend-not-configured': 'De bankkoppeling is nog niet geactiveerd.',
  'reauthorization-required': 'Banktoegang is verlopen. Autoriseer de rekening opnieuw.',
  'forbidden-user': 'Dit account mag de bankkoppeling niet gebruiken.',
  'forbidden-account': 'Deze rekening is niet toegestaan.',
  'unauthenticated': 'Log opnieuw in bij Finize en probeer het nog eens.',
  'invalid-token': 'Je aanmelding is verlopen. Log opnieuw in bij Finize.',
  'scope-changed': 'Het huishouden is gewijzigd. Open deze rekening opnieuw.',
  'no-bank-transactions': 'Nog geen banktransacties opgehaald. Bestaande CSV-imports blijven beschikbaar bij Importeren.',
  'synchronization-busy': 'Deze rekening wordt al bijgewerkt. Probeer het straks opnieuw.',
  'provider-identity-conflict': 'Afwijkende gegevens voor dezelfde bankidentiteit. Bestaande gegevens blijven behouden.',
  'provider-unavailable': 'De bank is tijdelijk niet bereikbaar. Bestaande gegevens blijven behouden.'
};

export function installBankConnection(root, { enabled = BANK_API_ENABLED, baseUrl = BANK_BACKEND_URL } = {}) {
  const production = new URL(BANK_BACKEND_URL), target = new URL(baseUrl);
  const local = ['127.0.0.1', 'localhost'].includes(root.location?.hostname) && target.hostname === '127.0.0.1' && target.protocol === 'http:';
  if (!local && (target.origin !== production.origin || target.pathname !== production.pathname || target.protocol !== 'https:')) throw new Error('Ongeldige bankbackend.');
  let busy = false;
  const panels = new Map();
  function refreshControls() {
    for (const [element, update] of panels) {
      if (!element.isConnected) panels.delete(element); else update();
    }
  }
  async function request(route, payload) {
    if (!enabled) throw new Error('backend-not-configured');
    const user = root.FinizeAuth?.user;
    if (!user?.getIdToken) throw new Error('forbidden-user');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), route === '/sync' ? 190000 : 65000);
    try {
    const response = await root.fetch(baseUrl + route, {
      method: 'POST', cache: 'no-store', redirect: 'error',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'provider-unavailable'), { code: data.error });
    return data;
    } finally { clearTimeout(timer); }
  }
  function lastSync(profile) {
    const sync = root.state?.bankSyncStatus?.[profile.id];
    const at = new Date(sync?.fetchedAt);
    return sync && Number.isFinite(at.getTime()) ? ' Laatst opgehaald: ' + new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short' }).format(at) + (sync.complete ? '.' : ' · onvolledig.') : '';
  }
  function render(profile, { compact = false } = {}) {
    if (compact) {
      if (!enabled || profile.status === 'archived' || !root.state?.bankSyncStatus?.[profile.id]) return '';
      return '<span class="p3-bank-update" data-bank-connection="' + escape(profile.id) + '" data-bank-compact>' +
        '<span class="p3-bank-actions"><button type="button" class="primary small" data-bank-sync disabled>Bank bijwerken</button>' +
        '<button type="button" class="ghost small" data-bank-review>Nakijken</button></span>' +
        '<small role="status" aria-live="polite" data-bank-status>Verbinding controleren…</small></span>';
    }
    const disabled = !enabled || profile.status === 'archived' ? 'disabled' : '';
    const status = !enabled ? 'Nog niet geactiveerd. De bestaande administratie blijft beschikbaar.' :
      profile.status === 'archived' ? 'Deze rekening is gearchiveerd. De historie blijft beschikbaar.' : 'Verbinding controleren…';
    return '<section class="balance-panel" data-bank-connection="' + escape(profile.id) + '" aria-label="ING-bankkoppeling">' +
      '<h3>ING-bankkoppeling</h3><p>Geboekte bankmutaties tellen direct mee voor de rekeningstand. Financiële verwerking bevestig je bij Nakijken.</p>' +
      '<p role="status" aria-live="polite" data-bank-status>' + status + '</p><div class="balance-actions">' +
      '<button type="button" class="ghost" data-bank-authorize ' + disabled + '>Banktoegang autoriseren</button>' +
      '<button type="button" class="primary" data-bank-sync disabled>Bank bijwerken</button>' +
      '<button type="button" class="ghost" data-bank-review>Nakijken</button>' +
      '<button type="button" class="ghost" data-bank-disconnect ' + disabled + '>Banktoegang intrekken</button></div></section>';
  }
  async function ingest(snapshot, householdId) {
    const runtime = root.FinizeUpdate4Runtime, imports = await runtime.ImportStore.listImports();
    if (root.CloudAdapter.importScope() !== householdId || snapshot.householdId !== householdId) throw new Error('Het huishouden is gewijzigd.');
    const id = providerBatchId(snapshot.accountProfileId, snapshot.account.identificationHash);
    const previous = imports.find(batch => batch.id === id);
    const batch = stageProviderSnapshot(snapshot, root.state, previous, imports, runtime.classifyOriginal);
    await runtime.persistImportDraft(root, batch);
    return batch;
  }
  function bind(panel, profile) {
    const element = panel.querySelector('[data-bank-connection]');
    if (!element || element.dataset.bound) return;
    element.dataset.bound = 'true';
    const householdId = root.CloudAdapter.importScope(), status = element.querySelector('[data-bank-status]');
    const compact = element.hasAttribute('data-bank-compact');
    let connected = false, checking = false;
    const eligible = enabled && profile.status !== 'archived';
    const sameScope = () => { if (root.CloudAdapter.importScope() !== householdId) throw Object.assign(new Error('scope-changed'), { code: 'scope-changed' }); };
    const controls = () => element.querySelectorAll('button').forEach(item => {
      item.disabled = busy || (checking && !item.hasAttribute('data-bank-review')) || (!eligible && !item.hasAttribute('data-bank-review')) || (item.hasAttribute('data-bank-sync') && !connected);
    });
    panels.set(element, controls);
    const failureMessage = error => messages[error.code || error.message] || (error.name === 'AbortError' ? 'De bank reageert niet op tijd. Probeer het opnieuw.' : 'De actie is niet afgerond. Controleer je verbinding en probeer opnieuw.');
    async function checkConnection() {
      if (!eligible) return;
      checking = true; controls();
      try {
        const result = await request('/status', { accountProfileId: profile.id });
        sameScope();
        connected = result.connected === true;
        status.textContent = (connected ? (compact ? '' : 'Verbonden. Je kunt de bank handmatig bijwerken.') : 'Geen geldige bankverbinding. Geef toestemming bij ING om deze rekening te koppelen.') +
          (result.revocationPending ? ' Eerdere banktoegang is nog niet volledig ingetrokken. Kies Banktoegang intrekken om het opnieuw te proberen.' : '') + lastSync(profile);
      } catch (error) {
        connected = false; status.textContent = failureMessage(error) + lastSync(profile);
      } finally { checking = false; refreshControls(); }
    }
    void checkConnection();
    element.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || busy || (checking && !button.hasAttribute('data-bank-review'))) return;
      busy = true; refreshControls();
      try {
        sameScope();
        if (button.hasAttribute('data-bank-review')) {
          const imports = await root.FinizeUpdate4Runtime.ImportStore.listImports();
          sameScope();
          const batch = imports.find(item => item.channel === 'bank-api' && item.accountProfileId === profile.id);
          if (!batch) throw Object.assign(new Error('no-bank-transactions'), { code: 'no-bank-transactions' });
          await root.FinizeUpdate4.openImportDetails(batch.id);
        } else if (button.hasAttribute('data-bank-authorize')) {
          status.textContent = 'Toestemmingspagina van ING openen via Enable Banking…';
          const result = await request('/auth/start', { accountProfileId: profile.id });
          sameScope();
          const url = bankAuthorizationUrl(result.url);
          if (!url) throw new Error('Ongeldige autorisatielink.');
          root.location.assign(url);
        } else if (button.hasAttribute('data-bank-disconnect')) {
          status.textContent = 'Banktoegang intrekken…';
          await request('/disconnect', { accountProfileId: profile.id });
          sameScope(); connected = false; status.textContent = 'Banktoegang ingetrokken. Je financiële historie blijft behouden.';
        } else if (button.hasAttribute('data-bank-sync')) {
          status.textContent = 'Bankgegevens ophalen…';
          const toDate = new Date().toISOString().slice(0, 10);
          const fromDate = new Date(Date.parse(toDate) - 30 * 86400000).toISOString().slice(0, 10);
          const snapshot = await request('/sync', { accountProfileId: profile.id, fromDate, toDate });
          sameScope();
          await ingest(snapshot, householdId);
          status.textContent = snapshot.complete ? 'Bank bijgewerkt. Financiële verwerking staat klaar bij Nakijken.' : 'Gedeeltelijk opgehaald. Eerdere transacties blijven behouden; probeer later opnieuw.';
          root.renderActiveTab?.();
        }
      } catch (error) {
        if (error.code === 'reauthorization-required' || button.hasAttribute('data-bank-disconnect')) connected = false;
        status.textContent = button.hasAttribute('data-bank-disconnect') ? 'Het intrekken is nog niet bevestigd. Probeer Banktoegang intrekken opnieuw. Je financiële historie blijft behouden.' : failureMessage(error);
      } finally {
        busy = false;
        refreshControls();
      }
    });
  }
  return { render, bind, ingest };
}
