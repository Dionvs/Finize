import { stageProviderSnapshot, providerBatchId } from '../import/enable-banking-adapter.mjs';
import { bankAuthorizationUrl } from '../import/bank-authorization-url.mjs';

export const BANK_BACKEND_URL = 'https://europe-west4-financien-7dd43.cloudfunctions.net/enableBanking';
export const BANK_API_ENABLED = true; // Backend independently restricts access to the configured user and account.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const messages = {
  'backend-not-configured': 'De bankkoppeling is nog niet geactiveerd.',
  'reauthorization-required': 'Banktoegang is verlopen. Autoriseer de rekening opnieuw.',
  'forbidden-user': 'Deze bankkoppeling is niet beschikbaar voor jouw aanmelding. Gebruik de geverifieerde aanmelding van de toegestane rekeninghouder.',
  'forbidden-account': 'Deze rekening is niet toegestaan.',
  'unauthenticated': 'Log opnieuw in bij Finize en probeer het nog eens.',
  'invalid-token': 'Je aanmelding is verlopen. Log opnieuw in bij Finize.',
  'scope-changed': 'Het huishouden is gewijzigd. Open deze rekening opnieuw.',
  'no-bank-transactions': 'Nog geen banktransacties opgehaald. Bestaande CSV-imports blijven beschikbaar bij Importeren.',
  'synchronization-busy': 'Deze rekening wordt al bijgewerkt. Probeer het straks opnieuw.',
  'provider-identity-conflict': 'Afwijkende gegevens voor dezelfde bankidentiteit. Bestaande gegevens blijven behouden.',
  'import-conflict': 'De import is intussen gewijzigd. Synchroniseer eerst de administratie en open daarna de actuele import. Bestaande keuzes blijven behouden.',
  'cloud-missing': 'De bestaande bankimport ontbreekt in de cloud. Er zijn geen nieuwe bankgegevens verwerkt. Laat de opslag controleren.',
  'provider-unavailable': 'De bank is tijdelijk niet bereikbaar. Bestaande gegevens blijven behouden.',
  'provider-access-blocked': 'Deze rekening is nog niet vrijgegeven voor deze Enable Banking-app. Voor een andere rekeninghouder zijn eigen toestemming en passende providertoegang vereist.',
  'bank-registry-migration-required': 'De bestaande bankverbinding moet eerst veilig door de beheerder worden overgezet. Autoriseer niet opnieuw.',
  'account-identity-changed': 'De rekeningbinding wijkt af. De verbinding is uit voorzorg geblokkeerd; laat de beheerder dit controleren.',
  'session-owner-missing': 'De bestaande banksessie kan niet veilig aan deze rekening worden gekoppeld. Laat de beheerder de overgang controleren.',
  'wrong-provider-account': 'Het bankantwoord hoort bij een andere rekening. Er zijn geen gegevens verwerkt.',
  'bootstrap-busy': 'Er staat al een toestemmingsaanvraag open. Rond die eerst af of probeer het na tien minuten opnieuw.',
  'bootstrap-session-protected': 'De ontvangen banksessie hoort bij een bestaande verbinding. Die is beschermd; laat de beheerder dit controleren.',
  'bootstrap-candidate-exists': 'Er is al banktoestemming ontvangen. Laat deze eerst controleren en activeren.',
  'bootstrap-candidate-unavailable': 'Er is nog geen bruikbare nieuwe banktoestemming. Laat de beheerder dit controleren.',
  'bootstrap-provider-session-invalid': 'De nieuwe banktoestemming kon niet worden bevestigd. Laat de beheerder dit controleren.',
  'bootstrap-review-required': 'De uitkomst van de toestemmingsaanvraag moet eerst door de beheerder worden gecontroleerd. Start nog geen nieuwe aanvraag.'
};

export function installBankConnection(root, { enabled = BANK_API_ENABLED, baseUrl = BANK_BACKEND_URL } = {}) {
  const production = new URL(BANK_BACKEND_URL), target = new URL(baseUrl);
  const local = ['127.0.0.1', 'localhost'].includes(root.location?.hostname) && target.hostname === '127.0.0.1' && target.protocol === 'http:';
  if (!local && (target.origin !== production.origin || target.pathname !== production.pathname || target.protocol !== 'https:')) throw new Error('Ongeldige bankbackend.');
  const busyAccounts = new Set();
  const panels = new Map();
  let lastFailure = null;
  const phaseNames = { authorization: 'Aanmelding controleren', request: 'Bankgegevens ophalen', response: 'Bankantwoord lezen',
    'import-read': 'Bestaande import lezen', staging: 'Bankgegevens vergelijken', storage: 'Import opslaan' };
  const inPhase = async (phase, action) => {
    try { return await action(); }
    catch (error) { throw Object.assign(error instanceof Error ? error : new Error('bank-unavailable'), { bankPhase: phase }); }
  };
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
    const token = await inPhase('authorization', () => user.getIdToken());
    const response = await inPhase('request', () => root.fetch(baseUrl + route, {
      method: 'POST', cache: 'no-store', redirect: 'error',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    }));
    const data = await inPhase('response', () => response.json());
    if (!response.ok) throw Object.assign(new Error('bank-unavailable'), { code: data.error, bankPhase: 'request', httpStatus: response.status });
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
  async function ingest(snapshot, householdId, expectedProfileId = snapshot.accountProfileId) {
    if (snapshot.accountProfileId !== expectedProfileId) throw Object.assign(new Error('wrong-provider-account'), {code:'wrong-provider-account'});
    const runtime = root.FinizeUpdate4Runtime;
    if (root.CloudAdapter.importScope() !== householdId || snapshot.householdId !== householdId) throw new Error('Het huishouden is gewijzigd.');
    const id = providerBatchId(snapshot.accountProfileId, snapshot.account.identificationHash);
    const previous = await inPhase('import-read', () => runtime.resolveProviderImportBase(root, id));
    const imports = await inPhase('import-read', () => runtime.ImportStore.listImports());
    const batch = await inPhase('staging', () => stageProviderSnapshot(snapshot, root.state, previous, imports, runtime.classifyOriginal));
    await inPhase('storage', () => runtime.persistImportDraft(root, batch));
    return batch;
  }
  function bind(panel, profile) {
    const element = panel.querySelector('[data-bank-connection]');
    if (!element || element.dataset.bound) return;
    element.dataset.bound = 'true';
    const householdId = root.CloudAdapter.importScope(), status = element.querySelector('[data-bank-status]');
    const actionKey = JSON.stringify([householdId, profile.id]);
    const compact = element.hasAttribute('data-bank-compact');
    let connected = false, checking = false, activationBlocked = false, bootstrapAvailable = false, bootstrapCandidate = false;
    const eligible = enabled && profile.status !== 'archived';
    const sameScope = () => { if (root.CloudAdapter.importScope() !== householdId) throw Object.assign(new Error('scope-changed'), { code: 'scope-changed' }); };
    const controls = () => element.querySelectorAll('button').forEach(item => {
      item.disabled = busyAccounts.has(actionKey) || (checking && !item.hasAttribute('data-bank-review')) || (!eligible && !item.hasAttribute('data-bank-review')) ||
        (activationBlocked && (item.hasAttribute('data-bank-authorize') || item.hasAttribute('data-bank-sync'))) || (item.hasAttribute('data-bank-sync') && !connected);
    });
    panels.set(element, controls);
    const failureMessage = error => {
      const rawCode = error.code || error.message;
      const code = Object.hasOwn(messages, rawCode) ? rawCode : 'bank-unavailable';
      const phase = Object.hasOwn(phaseNames, error.bankPhase) ? error.bankPhase : null;
      // Deliberately retain only allowlisted diagnostics, never bank payloads or raw errors.
      lastFailure = { phase, code, httpStatus: Number.isInteger(error.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599 ? error.httpStatus : null };
      const message = messages[code] || (error.name === 'AbortError' ? 'De bank reageert niet op tijd. Probeer het opnieuw.' : 'De actie is niet afgerond. Controleer je verbinding en probeer opnieuw.');
      return message + (phase ? ' Stap: ' + phaseNames[phase] + '.' : '');
    };
    async function checkConnection() {
      if (!eligible) return;
      checking = true; controls();
      try {
        const result = await request('/status', { accountProfileId: profile.id });
        sameScope();
        connected = result.connected === true;
        bootstrapAvailable = result.bootstrapAvailable === true && !connected;
        bootstrapCandidate = bootstrapAvailable && result.candidateVerified === true;
        activationBlocked = result.activationBlocked === true || bootstrapAvailable && (result.bootstrapBusy || result.revocationPending || result.bootstrapReviewRequired);
        const authorizeButton=element.querySelector('[data-bank-authorize]');
        if(authorizeButton)authorizeButton.textContent=bootstrapCandidate?'Banktoegang controleren':'Banktoegang autoriseren';
        const consent = new Date(result.validUntil), lastSuccessful = new Date(result.lastSuccessfulSync?.fetchedAt);
        const sameSuccessfulFetch = !compact && Number.isFinite(lastSuccessful.getTime()) &&
          result.lastSuccessfulSync.fetchedAt === root.state?.bankSyncStatus?.[profile.id]?.fetchedAt;
        status.textContent = (result.bootstrapReviewRequired ? messages['bootstrap-review-required'] : bootstrapCandidate ? 'Toestemming ontvangen. Deze rekening wacht nog op activering. Je kunt de banktoegang alvast controleren.' :
          bootstrapAvailable ? 'Je kunt voor deze gezamenlijke rekening afzonderlijk toestemming geven bij ING.' :
          activationBlocked ? messages['provider-access-blocked'] : connected ? (compact ? '' : 'Verbonden. Je kunt de bank handmatig bijwerken.') : 'Geen geldige bankverbinding. Geef toestemming bij ING om deze rekening te koppelen.') +
          (!compact && result.validUntil && Number.isFinite(consent.getTime()) ? ' Toestemming geldig tot ' + new Intl.DateTimeFormat('nl-NL', {dateStyle:'short'}).format(consent) + '.' : '') +
          (!compact && Number.isFinite(lastSuccessful.getTime()) ? ' Laatste volledige synchronisatie: ' + new Intl.DateTimeFormat('nl-NL', {dateStyle:'short',timeStyle:'short'}).format(lastSuccessful) + '.' : '') +
          (result.revocationPending ? ' Eerdere banktoegang is nog niet volledig ingetrokken. Kies Banktoegang intrekken om het opnieuw te proberen.' : '') + (sameSuccessfulFetch ? '' : lastSync(profile));
      } catch (error) {
        connected = false;
        activationBlocked = ['forbidden-user','forbidden-account','provider-access-blocked','bank-registry-migration-required','account-identity-changed','session-owner-missing'].includes(error.code);
        status.textContent = failureMessage(error) + lastSync(profile);
      } finally { checking = false; refreshControls(); }
    }
    void checkConnection();
    element.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || button.disabled || busyAccounts.has(actionKey) || (checking && !button.hasAttribute('data-bank-review'))) return;
      busyAccounts.add(actionKey); refreshControls();
      try {
        sameScope();
        if (button.hasAttribute('data-bank-review')) {
          const imports = await root.FinizeUpdate4Runtime.ImportStore.listImports();
          sameScope();
          const batch = imports.find(item => item.channel === 'bank-api' && item.accountProfileId === profile.id);
          if (!batch) throw Object.assign(new Error('no-bank-transactions'), { code: 'no-bank-transactions' });
          await root.FinizeUpdate4.openImportDetails(batch.id);
        } else if (button.hasAttribute('data-bank-authorize')) {
          if(bootstrapCandidate){
            status.textContent='Nieuwe banktoegang controleren…';
            await request('/bootstrap/verify',{accountProfileId:profile.id});sameScope();await checkConnection();return;
          }
          status.textContent = 'Toestemmingspagina van ING openen via Enable Banking…';
          const result = await request(bootstrapAvailable?'/bootstrap/start':'/auth/start', { accountProfileId: profile.id });
          sameScope();
          const url = bankAuthorizationUrl(result.url);
          if (!url) throw new Error('Ongeldige autorisatielink.');
          root.location.assign(url);
        } else if (button.hasAttribute('data-bank-disconnect')) {
          status.textContent = 'Banktoegang intrekken…';
          await request(bootstrapAvailable?'/bootstrap/disconnect':'/disconnect', { accountProfileId: profile.id });
          sameScope(); connected = false; status.textContent = 'Banktoegang ingetrokken. Je financiële historie blijft behouden.';
        } else if (button.hasAttribute('data-bank-sync')) {
          lastFailure = null;
          status.textContent = 'Bankgegevens ophalen…';
          const toDate = new Date().toISOString().slice(0, 10);
          const fromDate = new Date(Date.parse(toDate) - 30 * 86400000).toISOString().slice(0, 10);
          const snapshot = await request('/sync', { accountProfileId: profile.id, fromDate, toDate });
          sameScope();
          await ingest(snapshot, householdId, profile.id);
          status.textContent = snapshot.complete ? 'Bank bijgewerkt. Financiële verwerking staat klaar bij Nakijken.' : 'Gedeeltelijk opgehaald. Eerdere transacties blijven behouden; probeer later opnieuw.';
          root.renderActiveTab?.();
        }
      } catch (error) {
        if (error.code === 'reauthorization-required' || button.hasAttribute('data-bank-disconnect')) connected = false;
        status.textContent = button.hasAttribute('data-bank-disconnect') ? 'Het intrekken is nog niet bevestigd. Probeer Banktoegang intrekken opnieuw. Je financiële historie blijft behouden.' : failureMessage(error);
      } finally {
        busyAccounts.delete(actionKey);
        refreshControls();
      }
    });
  }
  return { render, bind, ingest, get lastFailure() { return lastFailure && { ...lastFailure }; } };
}
