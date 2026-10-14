import { liquidityBuffer } from '../core/liquidity-settings.mjs';
import { decimalAmountToCents } from '../import/bank-input-contract.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderLiquiditySettings(profile) {
  const config=profile.liquidity || {}, joint=profile.accountOwner==='gezamenlijk';
  return `<section class="card liquidity-settings"><h3>Dagelijkse prognose</h3>
    <form data-liquidity-form class="bank-account-form">
    <label class="bank-account-archive-filter"><input type="checkbox" name="primaryForOwner" ${config.primaryForOwner?'checked':''} ${profile.accountType!=='payment'?'disabled':''}> Gebruik deze betaalrekening voor de maandplanning van ${joint?'Gezamenlijk':escape(profile.accountOwner==='dion'?'Dion':'Dara')}</label>
    <p class="hint">Deze keuze koppelt vaste lasten en budgetten zonder eigen rekeningkeuze aan deze fysieke rekening.</p>
    <div class="bank-account-fields"><label>Veiligheidsbuffer (€)<input name="buffer" type="number" min="0" step="0.01" required inputmode="decimal" value="${liquidityBuffer(profile)/100}"></label>
    ${['dion','dara'].map(person=>`<label>Salaris ${person==='dion'?'Dion':'Dara'}: betaaldag op deze rekening<input name="salary-${person}" type="number" min="1" max="31" step="1" inputmode="numeric" value="${escape(config.salaryDays?.[person]??'')}"></label>`).join('')}</div>
    <p class="hint">Vul alleen een bevestigde maandelijkse betaaldag in (1–31). Leeg betekent onbekend of niet op deze rekening. In een kortere maand gebruiken we de laatste dag. Dit wijzigt geen salarisbedragen. ${joint?'De standaardbuffer voor de primaire gezamenlijke betaalrekening is € 200.':''}</p>
    <p role="alert" data-liquidity-error></p><div class="bank-account-actions"><button class="primary" type="submit">Prognose-instellingen opslaan</button></div></form></section>`;
}
export function bindLiquiditySettings(panel,profile,{save,ensureScope,onOpen}) {
  const form=panel.querySelector('[data-liquidity-form]');if(!form)return;
  const operationId=crypto.randomUUID(),createdAt=new Date().toISOString(),expectedProfile=structuredClone(profile);
  let busy=false;
  form.elements.primaryForOwner.onchange=()=>{
    if(profile.accountOwner==='gezamenlijk') form.elements.buffer.value=form.elements.primaryForOwner.checked?'200':'0';
  };
  form.onsubmit=async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    const error=form.querySelector('[data-liquidity-error]');error.textContent='';
    try {
      const values={primaryForOwner:form.elements.primaryForOwner.checked,bufferCents:decimalAmountToCents(Number(form.elements.buffer.value)),salaryDays:{}};
      for(const person of ['dion','dara'])if(form.elements['salary-'+person].value!=='')values.salaryDays[person]=Number(form.elements['salary-'+person].value);
      busy=true;form.querySelectorAll('input,button').forEach(el=>el.disabled=true);
      ensureScope();await save({type:'liquidity-settings',id:profile.id,expectedProfile,values,operationId,createdAt});ensureScope();onOpen();
    } catch(failure) {
      error.textContent=failure.commitOutcome==='uncertain'?'Opslaguitkomst onzeker. Herlaad de app voordat je opnieuw probeert.':failure.message;
      if(failure.commitOutcome!=='uncertain'){busy=false;form.querySelectorAll('input,button').forEach(el=>el.disabled=false);form.elements.primaryForOwner.disabled=profile.accountType!=='payment';}
    }
  };
}
