import { ACCOUNT_OWNERS, accountIsArchived, availableAccountProfiles } from '../core/account-profiles.mjs';
import { renderLiquiditySettings, bindLiquiditySettings } from './liquidity-settings.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const labels = {payment:'Betaalrekening',savings:'Spaarrekening'};
const statuses = {confirmed:'Bevestigd',provisional:'Voorlopig',incomplete:'Onvolledig',unknown:'Onbekend'};
const euro = value => value === null ? 'Onbekend' : new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(value/100);
const readableIban = value => String(value || '').replace(/\s/g,'').replace(/(.{4})/g,'$1 ').trim();
const maskedIban = value => value ? `${String(value).replace(/\s/g,'').slice(0,4)} •••• ${String(value).replace(/\s/g,'').slice(-4)}` : 'Rekeningkenmerk ontbreekt';

export function createBankAccountsUI({getState,getScope,getImports,balances,save,ownerLabel,onOpen,hasConflict,openConflicts}) {
  let selected = '', showArchived = false, editing = false;
  const overviewButton = () => '<button type="button" class="ghost" data-accounts-back>← Bankrekeningen</button>';
  function open(id='') { selected=id;editing=false;onOpen(); }
  function render() { return '<section class="bank-accounts" data-bank-accounts aria-label="Bankrekeningen"><p role="status">Bankrekeningen laden…</p></section>'; }
  async function bind(container) {
    const panel=container.querySelector('[data-bank-accounts]');
    if(!panel)return;
    const household=getScope();
    const ensureScope=()=>{if(household!==getScope())throw new Error('Het huishouden is gewijzigd. Open Bankrekeningen opnieuw.');};
    const imports=await getImports().catch(()=>null);
    if(!panel.isConnected||household!==getScope())return;
    const state=getState(), profile=(state.accountProfiles||[]).find(row=>row.id===selected);
    const bindConflicts=()=>{if(hasConflict?.()){panel.insertAdjacentHTML('afterbegin','<div role="status"><p>Er is een synchronisatieconflict. Beide versies zijn bewaard.</p><button type="button" class="ghost" data-accounts-conflicts>Synchronisatieconflicten bekijken</button></div>');panel.querySelector('[data-accounts-conflicts]').onclick=openConflicts;}};
    const back='<button type="button" class="ghost" data-accounts-settings>← Instellingen</button>';
    if(editing){ renderForm(panel,profile,ensureScope);return; }
    if(profile){
      panel.innerHTML=`${overviewButton()}<div class="bank-accounts-heading"><h2>${escape(profile.name)}</h2><span>${accountIsArchived(profile)?'Gearchiveerd':'Actief'}</span></div>
        <section class="card bank-account-details"><div class="card-head"><h3>Rekeninggegevens</h3></div><dl class="u6-settings-list">
        <div><dt>Bank</dt><dd>${escape(profile.bank || 'Onbekend')}</dd></div><div><dt>IBAN / kenmerk</dt><dd>${escape(readableIban(profile.identifier))}</dd></div>
        <div><dt>Eigenaar</dt><dd>${escape(ownerLabel(profile.accountOwner))}</dd></div><div><dt>Type</dt><dd>${labels[profile.accountType] || 'Nog niet ingesteld'}</dd></div></dl>
        <div class="bank-account-actions"><button type="button" class="primary" data-account-edit>Rekening bewerken</button><button type="button" class="ghost" data-account-status>${accountIsArchived(profile)?'Rekening heractiveren':'Rekening archiveren'}</button></div>
        <p role="alert" data-account-error></p><div data-account-archive-confirm hidden><p>De rekening blijft met alle historie bewaard. Voor nieuwe imports en banksaldo’s moet je haar eerst heractiveren.</p><button type="button" class="primary" data-account-archive>Bevestig archiveren</button><button type="button" class="ghost" data-account-archive-cancel>Annuleren</button></div></section>
        ${renderLiquiditySettings(profile)}${balances.render()}`;
      panel.querySelector('[data-accounts-back]').onclick=()=>open();
      panel.querySelector('[data-account-edit]').onclick=()=>{editing=true;onOpen();};
      const statusCommand={type:accountIsArchived(profile)?'reactivate':'archive',id:profile.id,expectedProfile:structuredClone(profile),operationId:crypto.randomUUID(),createdAt:new Date().toISOString()};
      let busy=false;
      const changeStatus=async()=>{
        if(busy)return;busy=true;panel.querySelectorAll('button').forEach(button=>button.disabled=true);
        try{ensureScope();await save(statusCommand);ensureScope();onOpen();}
        catch(error){panel.querySelector('[data-account-error]').textContent=error.message;if(error.commitOutcome!=='uncertain'){busy=false;panel.querySelectorAll('button').forEach(button=>button.disabled=false);}}
      };
      panel.querySelector('[data-account-status]').onclick=()=>accountIsArchived(profile)?changeStatus():panel.querySelector('[data-account-archive-confirm]').hidden=false;
      panel.querySelector('[data-account-archive]').onclick=changeStatus;
      panel.querySelector('[data-account-archive-cancel]').onclick=()=>panel.querySelector('[data-account-archive-confirm]').hidden=true;
      bindLiquiditySettings(panel,profile,{save,ensureScope,onOpen});
      bindConflicts();await balances.bind(panel,null,profile.id);
      return;
    }
    selected='';
    const profiles=showArchived?state.accountProfiles || []:availableAccountProfiles(state.accountProfiles);
    panel.innerHTML=`${back}<div class="bank-accounts-heading"><h2>Bankrekeningen</h2><button type="button" class="primary" data-account-add>Bankrekening toevoegen</button></div>
      <label class="bank-account-archive-filter"><input type="checkbox" data-accounts-archived ${showArchived?'checked':''}> Toon gearchiveerde rekeningen</label>
      ${!profiles.length?'<p class="hint">Nog geen actieve bankrekeningen. Voeg je eerste bankrekening toe.</p>':''}
      ${ACCOUNT_OWNERS.map(owner=>{const rows=profiles.filter(row=>row.accountOwner===owner);return rows.length?`<section class="bank-account-group"><h3>${escape(ownerLabel(owner))}</h3><div class="bank-account-list">${rows.map(row=>{
        const projection=balances.project({accountProfileId:row.id,imports:imports || [],importsAvailable:imports!==null});
        return `<button type="button" class="card bank-account-row" data-account-open="${escape(row.id)}"><span><strong>${escape(row.name || 'Bankrekening')}</strong><span>${escape(row.bank || 'Bank onbekend')} · ${escape(maskedIban(row.identifier))}</span><span>${labels[row.accountType] || 'Type nog niet ingesteld'} · ${accountIsArchived(row)?'Gearchiveerd':'Actief'}</span></span><span class="bank-account-row-balance"><strong>${euro(projection.balanceCents)}</strong><span>${projection.checkpoint?statuses[projection.status]:'Nog geen saldo-ijkpunt'}</span></span></button>`;
      }).join('')}</div></section>`:'';}).join('')}`;
    panel.querySelector('[data-accounts-settings]').onclick=()=>{selected='';onOpen('settings');};
    panel.querySelector('[data-account-add]').onclick=()=>{selected='';editing=true;onOpen();};
    panel.querySelector('[data-accounts-archived]').onchange=event=>{showArchived=event.target.checked;onOpen();};
    panel.querySelectorAll('[data-account-open]').forEach(button=>button.onclick=()=>open(button.dataset.accountOpen));
    bindConflicts();
  }
  function renderForm(panel,profile,ensureScope) {
    const option=(value,label,current)=>`<option value="${value}" ${value===current?'selected':''}>${escape(label)}</option>`;
    panel.innerHTML=`${overviewButton()}<section class="card bank-account-details"><h2>${profile?'Rekening bewerken':'Bankrekening toevoegen'}</h2>
      <form class="bank-account-form" data-account-form><div class="bank-account-fields">
      <label>Rekeningnaam<input name="name" maxlength="100" required value="${escape(profile?.name || '')}"></label>
      <label>Banknaam (optioneel)<input name="bank" maxlength="100" value="${escape(profile?.bank || '')}"></label>
      <label class="bank-account-iban-field">IBAN<input name="identifier" required autocomplete="off" spellcheck="false" value="${escape(profile?.identifier || '')}"></label>
      <label>Eigenaar<select name="accountOwner" required>${!profile?'<option value="">Kies eigenaar</option>':''}${ACCOUNT_OWNERS.map(owner=>option(owner,ownerLabel(owner),profile?.accountOwner)).join('')}</select></label>
      <label>Rekeningtype<select name="accountType" required>${!profile?.accountType?'<option value="">Kies rekeningtype</option>':''}${Object.entries(labels).map(([type,label])=>option(type,label,profile?.accountType)).join('')}</select></label></div>
      <p class="hint">Wijzig een IBAN alleen om een invoerfout te herstellen. Een andere fysieke bankrekening voeg je als nieuwe rekening toe. Bij bestaande historie kunnen IBAN en eigenaar niet worden gewijzigd.</p>
      <p role="alert" data-account-error></p><div class="bank-account-actions"><button type="submit" class="primary">Rekening opslaan</button><button type="button" class="ghost" data-account-cancel>Annuleren</button></div></form></section>`;
    const form=panel.querySelector('form'), operationId=crypto.randomUUID(),id=profile?.id || 'account-'+crypto.randomUUID(),createdAt=new Date().toISOString();
    let locked=false, uncertain=false;
    const cancel=()=>{if(!locked){editing=false;onOpen();}};
    panel.querySelector('[data-accounts-back]').onclick=cancel;
    panel.querySelector('[data-account-cancel]').onclick=cancel;
    form.elements.name.focus();
    form.onsubmit=async event=>{
      event.preventDefault();if(locked||!form.reportValidity())return;
      const values=Object.fromEntries(new FormData(form));
      locked=true;panel.querySelectorAll('button,input,select').forEach(element=>element.disabled=true);
      const feedback=panel.querySelector('[data-account-error]');feedback.textContent='';
      try{ensureScope();await save({type:profile?'update':'create',id,values,operationId,createdAt,expectedProfile:profile?structuredClone(profile):null});ensureScope();selected=id;editing=false;onOpen();}
      catch(error){uncertain=error.commitOutcome==='uncertain';feedback.textContent=uncertain?'Opslaguitkomst onzeker. Herlaad de app voordat je opnieuw probeert.':error.message;}
      finally{if(form.isConnected&&!uncertain){locked=false;panel.querySelectorAll('button,input,select').forEach(element=>element.disabled=false);}}
    };
  }
  return {open,render,bind};
}
