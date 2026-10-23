import { selectAccountBalance, checkpointHistory, prepareBalanceCheckpoint, applyBalanceCheckpoint } from '../core/balance-checkpoints.mjs';
import { decimalAmountToCents } from '../import/bank-input-contract.mjs';
import { accountIsArchived } from '../core/account-profiles.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const euro = value => value === null ? 'Onbekend' : new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(value/100);
const dateNL = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('-') : 'Onbekend';
const recordedAt = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('nl-NL',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : 'Onbekend';
const statusLabels = { confirmed:'Bevestigd', provisional:'Voorlopig', incomplete:'Onvolledig', unknown:'Onbekend' };
const reasons = {
  'intraday-provider-balance':'Dit is een geboekt providersaldo op het vermelde tijdstip, geen einde-dagijkpunt. Mutaties van die dag worden niet nogmaals opgeteld.',
  'provider-sync-incomplete':'Niet alle providerpagina’s zijn opgehaald. Eerdere bankgegevens blijven behouden.',
  'missing-checkpoint':'Voer eerst een werkelijk banksaldo met peildatum in.',
  'awaiting-review':'Er staan bankmutaties bij Nakijken. Deze tellen voorlopig mee.',
  'unknown-bank-coverage':'Niet bevestigd dat alle bankmutaties sinds het ijkpunt zijn aangeleverd.',
  'partial-bank-coverage':'De bankgegevens dekken slechts een deel van deze periode.',
  'possible-duplicate':'Een mogelijke dubbele bankbron wacht op een identiteitskeuze en telt niet mee.',
  'unresolved-account-profile':'Een bankbron kan niet eenduidig aan deze fysieke rekening worden gekoppeld.',
  'invalid-bank-source':'Een bron mist geldige bankgegevens en telt niet mee.',
  'invalid-bank-amount':'Een bron heeft geen geldig bedrag in eurocenten en telt niet mee.',
  'conflicting-bank-source':'Gegevens van dezelfde bankbron spreken elkaar tegen. De bron telt niet mee.',
  'pending-bank-source':'Een reservering is nog niet geboekt en telt niet mee.',
  'unknown-bank-status':'Een bron heeft een onbekende boekingsstatus en telt niet mee.',
  'manual-without-bank-evidence':'Een handmatige registratie is geen aangetoonde bankmutatie en telt niet mee.',
  'manual-transfer-unresolved':'Een handmatige overboeking heeft geen aangetoonde bankbron op deze fysieke rekening en telt niet mee.',
  'missing-period':'Niet alle historische maanden vanaf het ijkpunt zijn beschikbaar.',
  'imports-unavailable':'Importdetails konden niet worden geladen. Probeer opnieuw.',
  'bank-sources-unavailable':'Bankbronnen konden niet volledig worden gelezen.',
  'invalid-checkpoint-history':'De ijkpunthistorie bevat ongeldige gegevens.',
  'duplicate-checkpoint-id':'Een ijkpunt-ID komt meer dan eenmaal voor.',
  'invalid-checkpoint-revision':'Een correctie mist een geldige eerdere waarneming.',
  'conflicting-checkpoint-revisions':'Er zijn tegenstrijdige waarnemingen voor dezelfde dag. Controleer de synchronisatie.',
  'unsafe-balance-amount':'Dit bedrag is te groot om exact te berekenen.',
  'invalid-balance-date':'De gevraagde datum is ongeldig.'
};
function reasonMarkup(rows) {
  return [...new Set(rows.map(row => reasons[row.code] || 'De rekeningstand is nog niet volledig controleerbaar.'))]
    .map(message => `<li>${escape(message)}</li>`).join('');
}

/** Small extension of the existing bank-account/import interface. */
export function createAccountBalanceUI({ getState, getScope, getImports, commit, today, actor }) {
  const bound = new WeakSet();
  const render = () => '<section class="balance-panel" data-balance-panel aria-label="Rekeningstanden"><h3>Rekeningstanden</h3><p role="status">Rekeningstanden laden…</p></section>';
  async function bind(rootElement, owner, selectedProfileId='') {
    const panel = rootElement.querySelector('[data-balance-panel]');
    if (!panel || bound.has(panel)) return;
    bound.add(panel);
    const householdId = getScope().householdId;
    let imports = [], importsAvailable = true;
    try { imports = await getImports(); } catch { importsAvailable = false; }
    if (!panel.isConnected || householdId !== getScope().householdId) return;
    const options = () => ({ scope: getScope(), imports, importsAvailable, today: today() });
    const ensureScope = () => { if (householdId !== getScope().householdId) throw new Error('Het huishouden is gewijzigd. Open de rekening opnieuw.'); };
    const refresh = () => {
      ensureScope();
      const state = getState(), profiles = (state.accountProfiles || []).filter(profile => selectedProfileId ? profile.id === selectedProfileId : !owner || profile.accountOwner === owner);
      panel.innerHTML = `<h3>Rekeningstanden</h3><p class="hint">Gebruik het geboekte banksaldo aan het einde van een bankdag. Stand tot en met ${dateNL(today())}.</p>${profiles.length ? profiles.map(profile => {
        const projection = selectAccountBalance(state,{ ...options(), accountProfileId: profile.id, toDate: today() });
        const history = checkpointHistory(state,profile.id,getScope());
        const active = new Set(history.active.map(row=>row.id));
        return `<article class="balance-account" data-balance-account="${escape(profile.id)}"><div class="u4-receipt-head"><div><h4>${escape(profile.name || profile.bank || 'Bankrekening')}</h4><p class="hint balance-identifier">${escape(profile.identifier || '')}</p></div><div><strong class="balance-amount" data-balance-value>${euro(projection.balanceCents)}</strong><span class="balance-status" data-balance-status>${statusLabels[projection.status]}</span></div></div>
          <p class="hint">${projection.checkpoint ? `${projection.checkpoint.source==='provider-observation'?'Vanaf providersaldo':'Vanaf ijkpunt'} ${dateNL(projection.checkpoint.asOfDate)}${projection.observedAt?' · '+escape(recordedAt(projection.observedAt)):''} · ${euro(projection.openingCents)}` : 'Nog geen saldo-ijkpunt.'}</p>
          <details class="balance-explanation"><summary>Controle en herkomst</summary><p>Bankbronnen: ${statusLabels[projection.quality.bankSources] || 'Onzeker'}. Dekking: ${{complete:'bekend compleet',partial:'gedeeltelijk',unknown:'onbekend'}[projection.quality.coverage]}. Opslag: ${projection.quality.storage === 'verified' ? 'gegevens beschikbaar' : 'afhankelijkheden ontbreken'}.</p><ul>${reasonMarkup(projection.reasons)}</ul><p>Bevestigde mutaties: ${euro(projection.confirmedCents)} · Voorlopige mutaties: ${euro(projection.provisionalCents)}.</p></details>
          <div class="balance-actions"><button type="button" class="primary small" data-balance-add ${accountIsArchived(profile)?'disabled':''}>${projection.checkpoint?'Banksaldo bijwerken':'Banksaldo invoeren'}</button>${accountIsArchived(profile)?'<p class="hint">Heractiveer de rekening voor een nieuw banksaldo. Eerdere ijkpunten blijven raadpleegbaar en corrigeerbaar.</p>':''}</div>
          <details class="balance-history"><summary>Eerdere ijkpunten (${history.rows.length})</summary>${history.rows.map(row=>`<div class="balance-history-row"><div><strong>${dateNL(row.asOfDate)} · ${euro(row.amountCents)}</strong><p class="hint">Revisie ${row.revision} · ${row.id===projection.checkpoint?.id?'Huidig ijkpunt':active.has(row.id)?'Eerder ijkpunt':'Vervangen'}<br>Vastgelegd ${escape(recordedAt(row.createdAt))}${row.actor && row.actor===actor() ? ' · Door jou' : ''}${row.supersedesId ? `<br>Correctie van revisie ${history.rows.find(previous=>previous.id===row.supersedesId)?.revision || '?'}` : ''}${row.note ? `<br>${escape(row.note)}` : ''}</p></div>${active.has(row.id)?`<button type="button" class="ghost small" data-balance-correct="${escape(row.id)}">Corrigeren</button>`:''}</div>`).join('') || '<p class="hint">Nog geen waarnemingen.</p>'}</details><div data-balance-editor></div></article>`;
      }).join('') : '<p class="hint">Nog geen rekeningprofiel. Gebruik de bestaande CSV-import om een rekeningprofiel te koppelen.</p>'}`;
    };
    refresh();
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-balance-add],[data-balance-correct]');
      if (!button) return;
      try {
        ensureScope();
        const account = button.closest('[data-balance-account]'), accountProfileId = account.dataset.balanceAccount;
        const old = button.dataset.balanceCorrect ? (getState().balanceCheckpoints || []).find(row=>row.id===button.dataset.balanceCorrect) : null;
        panel.querySelectorAll('[data-balance-editor]').forEach(editor=>editor.replaceChildren());
        const editor = account.querySelector('[data-balance-editor]'), operationId = crypto.randomUUID(), createdAt = new Date().toISOString();
        let command = null, locked = false;
        editor.innerHTML = `<form class="balance-form" data-balance-form><h4>${old?'Banksaldo corrigeren':'Banksaldo invoeren'}</h4><p class="hint">Bedrag en peildatum gaan over het geboekte saldo aan het einde van die dag. Mutaties op die dag zitten er al in.</p>
          <div class="balance-fields"><label>Banksaldo (€)<input name="amount" data-balance-amount type="number" step="0.01" inputmode="decimal" required value="${old?old.amountCents/100:''}"></label><label>Peildatum<input name="date" data-balance-date type="date" required max="${today()}" value="${old?old.asOfDate:today()}"></label></div>
          <label>Toelichting (optioneel)<textarea name="note" data-balance-note rows="2" maxlength="1000">${escape(old?.note || '')}</textarea></label>
          <p role="alert" data-balance-error></p><div data-balance-comparison aria-live="polite"></div><div class="balance-actions"><button type="submit" class="primary" data-balance-check>Controleer saldo</button><button type="button" class="primary" data-balance-confirm hidden>Bevestig banksaldo</button><button type="button" class="ghost" data-balance-cancel>Annuleren</button></div></form>`;
        const form = editor.querySelector('form'), error = form.querySelector('[data-balance-error]'), confirm = form.querySelector('[data-balance-confirm]');
        form.querySelector('[data-balance-amount]').focus();
        const invalidate = () => { command = null; confirm.hidden = true; form.querySelector('[data-balance-comparison]').replaceChildren(); };
        form.addEventListener('input',()=>{ if(!locked) invalidate(); });
        form.querySelector('[data-balance-cancel]').onclick = () => { if (!locked) { editor.replaceChildren(); button.focus(); } };
        form.onsubmit = async event => {
          event.preventDefault(); if (locked) return;
          try {
            ensureScope(); invalidate(); error.textContent = '';
            if (!form.reportValidity()) return;
            imports = await getImports(); importsAvailable = true; ensureScope();
            const amountText = form.elements.amount.value;
            if (!amountText) throw new Error('Vul het banksaldo in.');
            command = { operationId, createdAt, accountProfileId, amountCents: decimalAmountToCents(Number(amountText)), asOfDate: form.elements.date.value,
              note: form.elements.note.value, actor: actor() || null, supersedesId: old?.id || null };
            const prepared = prepareBalanceCheckpoint(getState(), command, options());
            const comparison = prepared.reconciliation;
            command.previewSignature = prepared.previewSignature;
            form.querySelector('[data-balance-comparison]').innerHTML = `<div class="balance-comparison"><h4>Controleer de waarneming</h4><dl><div><dt>Verwachte stand</dt><dd>${euro(comparison.expectedCents)}</dd></div><div><dt>Ingevoerd banksaldo</dt><dd>${euro(comparison.observedCents)}</dd></div><div><dt>Controleverschil</dt><dd>${euro(comparison.differenceCents)}</dd></div></dl><ul>${reasonMarkup(comparison.reasons)}</ul><p>${old?'Deze correctie vervangt het gekozen ijkpunt; de eerdere waarneming blijft bewaard.':'Dit banksaldo wordt het nieuwe uitgangspunt vanaf de peildatum.'} Een controleverschil maakt geen transactie aan.</p></div>`;
            confirm.hidden = false; confirm.focus();
          } catch (e) { command = null; error.textContent = e.message; }
        };
        confirm.onclick = async () => {
          if (!command || locked) return;
          locked = true; [...form.elements].forEach(input=>input.disabled=true);
          let uncertain = false;
          try {
            ensureScope(); imports = await getImports(); importsAvailable = true; ensureScope();
            const intent = { ...command, confirmed:true }, context = options();
            const saved = await commit(state => { ensureScope(); applyBalanceCheckpoint(state, intent, context); }, { operationId, render:false, throwOnError:true });
            if (!saved) throw new Error('Opslaan is afgebroken. De waarneming is niet bevestigd.');
            ensureScope(); refresh();
            panel.querySelector(`[data-balance-account="${CSS.escape(accountProfileId)}"] [data-balance-add]`)?.focus();
          } catch (e) {
            uncertain = e.commitOutcome === 'uncertain';
            error.textContent = uncertain ? 'Opslaguitkomst onzeker. Herlaad de app voordat je opnieuw probeert; een bevestigde waarneming blijft bewaard.' : e.message;
            if(e.code === 'balance-confirmation-required') invalidate();
          } finally { if(form.isConnected && !uncertain){locked=false;[...form.elements].forEach(input=>input.disabled=false);} }
        };
      } catch(e) { panel.querySelector('[data-balance-panel-error]')?.remove(); panel.insertAdjacentHTML('beforeend',`<p role="alert" data-balance-panel-error>${escape(e.message)}</p>`); }
    });
  }
  return { render, bind, project: options => selectAccountBalance(getState(), { scope:getScope(), toDate:today(), ...options }) };
}
