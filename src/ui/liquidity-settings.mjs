import { liquidityBuffer } from '../core/liquidity-settings.mjs';
import { decimalAmountToCents } from '../import/bank-input-contract.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayOptions=day=>'<option value="">Niet ingesteld</option>'+[...Array.from({length:31},(_,i)=>i+1),'last'].map(value=>`<option value="${value}" ${value===day?'selected':''}>${value==='last'?'Laatste dag van de maand':'Dag '+value}</option>`).join('');
function receiptHtml({kind='salary',person='dion',day=''}={}) {
 return `<fieldset data-income-receipt class="bank-account-fields"><legend>Geplande ontvangst</legend><label>Soort inkomsten<select data-income-kind><option value="salary" ${kind==='salary'?'selected':''}>Salaris</option><option value="allowance" ${kind==='allowance'?'selected':''}>Zakgeld</option></select></label><label>Van wie<select data-income-person>${['dion','dara'].map(p=>`<option value="${p}" ${p===person?'selected':''}>${p==='dion'?'Dion':'Dara'}</option>`).join('')}</select></label><label>Dag van de maand<select data-income-day ${kind==='salary'?`name="salary-${person}"`:''}>${dayOptions(day)}</select></label><button type="button" class="ghost" data-income-remove>Ontvangst verwijderen</button></fieldset>`;
}
export function renderLiquiditySettings(profile) {
 const config=profile.liquidity || {},joint=profile.accountOwner==='gezamenlijk';
 const receipts=['salary','allowance'].flatMap(kind=>Object.entries(config[kind==='salary'?'salaryDays':'allowanceDays'] || {}).map(([person,day])=>({kind,person,day})));
 if(!receipts.length)receipts.push({person:joint?'dion':profile.accountOwner});
 return `<section class="card liquidity-settings"><h3>Dagelijkse prognose</h3><form data-liquidity-form class="bank-account-form">
 <label class="bank-account-archive-filter"><input type="checkbox" name="primaryForOwner" ${config.primaryForOwner?'checked':''} ${profile.accountType!=='payment'?'disabled':''}> Gebruik deze betaalrekening voor de maandplanning van ${joint?'Gezamenlijk':escape(profile.accountOwner==='dion'?'Dion':'Dara')}</label>
 <p class="hint">Deze keuze koppelt vaste lasten en budgetten zonder eigen rekeningkeuze aan deze fysieke rekening.</p>
 <label>Veiligheidsbuffer (€)<input name="buffer" type="number" min="0" step="0.01" required inputmode="decimal" value="${liquidityBuffer(profile)/100}"></label>
 <div data-income-receipts>${receipts.map(receiptHtml).join('')}</div><button type="button" class="ghost" data-income-add>Ontvangst toevoegen</button>
 <p class="hint">Kies per ontvangst salaris óf zakgeld, van wie en wanneer. Zakgeld hoort op de persoonlijke betaalrekening van die persoon. Het bedrag volgt automatisch de bestaande maandberekening. In een kortere maand gebruiken we de laatste kalenderdag. Niet ingesteld betekent dat geen betaaldag bekend is. ${joint?'De standaardbuffer voor de primaire gezamenlijke betaalrekening is € 200.':''}</p>
 <p role="alert" data-liquidity-error></p><div class="bank-account-actions"><button class="primary" type="submit">Prognose-instellingen opslaan</button></div></form></section>`;
}
export function bindLiquiditySettings(panel,profile,{save,ensureScope,onOpen}) {
 const form=panel.querySelector('[data-liquidity-form]');if(!form)return;
 const operationId=crypto.randomUUID(),createdAt=new Date().toISOString(),expectedProfile=structuredClone(profile);let busy=false;
 form.elements.primaryForOwner.onchange=()=>{if(profile.accountOwner==='gezamenlijk')form.elements.buffer.value=form.elements.primaryForOwner.checked?'200':'0';};
 form.querySelector('[data-income-add]').onclick=()=>{form.querySelector('[data-income-receipts]').insertAdjacentHTML('beforeend',receiptHtml({person:profile.accountOwner==='gezamenlijk'?'dion':profile.accountOwner}));form.querySelector('[data-income-receipt]:last-child [data-income-kind]').focus();};
 form.addEventListener('click',e=>{if(e.target.closest('[data-income-remove]'))e.target.closest('[data-income-receipt]').remove();});
 form.addEventListener('change',e=>{const row=e.target.closest('[data-income-receipt]');if(!row)return;const kind=row.querySelector('[data-income-kind]').value,person=row.querySelector('[data-income-person]').value;const day=row.querySelector('[data-income-day]');day.removeAttribute('name');if(kind==='salary')day.name='salary-'+person;});
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const error=form.querySelector('[data-liquidity-error]');error.textContent='';
  try {
   const values={primaryForOwner:form.elements.primaryForOwner.checked,bufferCents:decimalAmountToCents(Number(form.elements.buffer.value)),salaryDays:{},allowanceDays:{}};
   for(const row of form.querySelectorAll('[data-income-receipt]')){
    const kind=row.querySelector('[data-income-kind]').value,person=row.querySelector('[data-income-person]').value,day=row.querySelector('[data-income-day]').value;
    if(!day)continue;
    if(kind==='allowance'&&(profile.accountOwner!==person||profile.accountType!=='payment'))throw new Error('Kies voor zakgeld de persoonlijke betaalrekening van '+(person==='dion'?'Dion':'Dara')+'.');
    const target=values[kind==='allowance'?'allowanceDays':'salaryDays'];
    if(Object.hasOwn(target,person))throw new Error('Deze ontvangst staat tweemaal op dezelfde rekening. Verwijder de dubbele instelling.');
    target[person]=day==='last'?'last':Number(day);
   }
   busy=true;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
   ensureScope();await save({type:'liquidity-settings',id:profile.id,expectedProfile,values,operationId,createdAt});ensureScope();onOpen();
  }catch(failure){
   error.textContent=failure.commitOutcome==='uncertain'?'Opslaguitkomst onzeker. Herlaad de app voordat je opnieuw probeert.':failure.message;
   if(failure.commitOutcome!=='uncertain'){busy=false;form.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);form.elements.primaryForOwner.disabled=profile.accountType!=='payment';}
  }
 };
}
