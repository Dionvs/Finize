import {
  TODAY,
  calcDoel,
  calcGroep,
  calcScenario,
  eur,
  formatDateNL,
  getSelectedMonth,
  goalIcon,
  goalImageSource,
  iconSvg,
  monthLabel,
  pct,
  renderActiveTab,
  renderDataTab,
  renderGoalGroup,
  renderIconKpi,
  renderPageHeading,
  safeImageUrl,
  state,
  textSafe,
  visibleGoalOwnerKeys
} from "../core/runtime.js";

(function(){
  'use strict';

  let selectedGoalRef = '';
  let goalOwnerFilter = 'alle';
  let goalViewMode = 'master';
  let largeLayoutActive = window.innerWidth >= 768;

  function reuseMobileNavigationIcons(){
    document.querySelectorAll('.v4-sidebar .tab-btn[data-tab]').forEach(button=>{
      const mobileIcon = document.querySelector(`.v4-bottom-nav .bottom-nav-btn[data-tab="${button.dataset.tab}"] .bn-icon`);
      const sidebarIcon = button.querySelector('.u5-nav-icon');
      if (mobileIcon && sidebarIcon){
        sidebarIcon.replaceChildren(...[...mobileIcon.childNodes].map(node=>node.cloneNode(true)));
      }else if (sidebarIcon && button.dataset.tab === 'data'){
        sidebarIcon.innerHTML = iconSvg('receipt');
      }
    });
  }

  function markNegativeValues(root=document){
    root.querySelectorAll('.value').forEach(element=>{
      element.classList.toggle('is-negative', /^[−-]\s*€/.test(element.textContent.trim()));
    });
  }

  function goalGroups(){
    const result = calcScenario(state);
    const visibleOwners=visibleGoalOwnerKeys();
    return [
      {owner:'gezamenlijk',label:'Gezamenlijk',pot:result.spaarpotDezeMaand,goals:state.spaardoelen.gezamenlijk || []},
      {owner:'dion',label:'Dion',pot:result.dion.beschikbaarVoorSparen,goals:state.spaardoelen.dion || []},
      {owner:'dara',label:'Dara',pot:result.dara.beschikbaarVoorSparen,goals:state.spaardoelen.dara || []}
    ].filter(group=>visibleOwners.includes(group.owner));
  }

  function calculatedGoals(){
    return goalGroups().flatMap(group=>
      calcGroep(group.goals, group.pot, TODAY).map(item=>({...item,owner:group.owner,ownerLabel:group.label}))
    );
  }

  function selectedGoal(items){
    const visible = goalOwnerFilter === 'alle' ? items : items.filter(item=>item.owner === goalOwnerFilter);
    let selected = visible.find(item=>`${item.owner}:${item.doel.id}` === selectedGoalRef);
    if (!selected) selected = visible.find(item=>item.doel.favoriet) || visible[0] || null;
    if (selected) selectedGoalRef = `${selected.owner}:${selected.doel.id}`;
    return {visible,selected};
  }

  function goalImageMarkup(goal, className){
    const source = safeImageUrl(goalImageSource(goal));
    const style = source ? ` style="background-image:url('${source}')"` : '';
    return `<span class="${className}${source?' has-image':''}"${style}>${source?'':goalIcon(goal)}</span>`;
  }

  function goalListCard(item){
    const goal = item.doel;
    const target = Number(goal.doelbedrag)||0;
    const saved = Number(goal.algespaard)||0;
    const progress = target > 0 ? Math.min(100,Math.round(saved/target*100)) : 0;
    const reference = `${item.owner}:${goal.id}`;
    return `<div class="u5-goal-list-card${reference===selectedGoalRef?' active':''}" data-u5-select-goal="${textSafe(reference)}" data-reorder-goal data-goal-owner="${item.owner}" data-goal-id="${textSafe(goal.id)}" role="button" tabindex="0">
      <button type="button" class="goal-direct-drag-handle" data-goal-drag-handle aria-label="${textSafe(goal.naam||'Spaardoel')} verplaatsen" title="Verslepen om de volgorde te wijzigen"></button>
      ${goalImageMarkup(goal,'u5-goal-list-image')}
      <span class="u5-goal-list-copy">
        <span class="u5-goal-list-title"><strong>${textSafe(goal.naam||'Spaardoel')}</strong><em>${goal.favoriet?'★':''}</em></span>
        <small>${textSafe(item.ownerLabel)} · ${eur(saved)} van ${eur(target)}</small>
        <span class="progress-track"><span class="progress-fill" style="width:${progress}%"></span></span>
      </span>
      <b>${progress}%</b>
    </div>`;
  }

  function goalListContent(items){
    if (goalOwnerFilter !== 'alle') return items.map(goalListCard).join('');
    return goalGroups().map(group=>{
      const owned = items.filter(item=>item.owner === group.owner);
      if (!owned.length) return '';
      return `<section class="u5-goal-owner-group" aria-label="${textSafe(group.label)} spaardoelen">
        <div class="u5-goal-owner-label"><span>${textSafe(group.label)}</span><small>${owned.length} ${owned.length === 1 ? 'doel' : 'doelen'}</small></div>
        <div class="u5-goal-owner-items">${owned.map(goalListCard).join('')}</div>
      </section>`;
    }).join('');
  }

  function goalDetail(item){
    if (!item) return `<div class="card u5-goal-empty"><strong>Nog geen spaardoelen</strong><span>Voeg een doel toe om de detailweergave te gebruiken.</span></div>`;
    const goal = item.doel;
    const target = Number(goal.doelbedrag)||0;
    const saved = Number(goal.algespaard)||0;
    const progress = target > 0 ? Math.min(100,Math.round(saved/target*100)) : 0;
    const calculated = calcDoel(goal,TODAY);
    return `<article class="card u5-goal-detail">
      <div class="u5-goal-detail-hero">
        ${goalImageMarkup(goal,'u5-goal-detail-image')}
        <div>
          <span class="section-kicker">${textSafe(item.ownerLabel)} · ${goal.favoriet?'Favoriet':'Spaardoel'}</span>
          <h2>${textSafe(goal.naam||'Spaardoel')}</h2>
          <p>${eur(saved)} van ${eur(target)}</p>
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <strong>${progress}% voltooid</strong>
        </div>
      </div>
      <div class="u5-goal-detail-grid">
        <div><span>Nog te gaan</span><strong>${eur(calculated.nogTeGaan)}</strong></div>
        <div><span>Benodigd per maand</span><strong>${calculated.benodigdPerMaand===null?'—':eur(calculated.benodigdPerMaand)}</strong></div>
        <div><span>Vaste inleg</span><strong>${eur(Number(goal.vasteInleg)||0)}</strong></div>
        <div><span>Werkelijke inleg deze maand</span><strong>${eur(item.werkelijkeInleg)}</strong></div>
        <div><span>Doeldatum</span><strong>${goal.doeldatum?formatDateNL(goal.doeldatum):'Geen doeldatum'}</strong></div>
        <div><span>Verwachte waarde</span><strong>${calculated.verwachteWaarde===null?'—':eur(calculated.verwachteWaarde)}</strong></div>
        <div><span>Verwacht rendement</span><strong>${Math.round((Number(goal.rendement)||0)*10000)/100}% ${goal.rendementPeriode==='maandelijks'?'per maand':'per jaar'}</strong></div>
        <div><span>Verdeling</span><strong>${goal.vastBedrag?'Alleen vast bedrag':'Naar rato'}</strong></div>
      </div>
      <div class="u5-goal-detail-actions">
        <button type="button" class="primary" data-open-goal-editor="${item.owner}:${textSafe(goal.id)}">Alle instellingen bewerken</button>
        <button type="button" class="ghost" data-add-goal="${item.owner}">+ Spaardoel</button>
      </div>
      <p class="hint">Bewerken gebruikt dezelfde opslag, berekeningen en afbeeldingsdata als de mobiele doelbewerker.</p>
    </article>`;
  }

  function goalTableView(groups){
    return `<div class="u5-goal-table-stack">
      ${groups.map(group=>`<section class="card">
        <div class="card-head"><h2>${group.label}</h2><button type="button" class="ghost small" data-add-goal="${group.owner}">+ Spaardoel</button></div>
        ${renderGoalGroup(`spaardoelen.${group.owner}`,group.goals,group.pot)}
      </section>`).join('')}
    </div>`;
  }

  function bindGoalPresentation(root){
    root.querySelectorAll('[data-u5-goal-filter]').forEach(button=>button.addEventListener('click',()=>{
      goalOwnerFilter = button.dataset.u5GoalFilter;
      renderActiveTab();
    }));
    root.querySelectorAll('[data-u5-select-goal]').forEach(button=>{
      const select=event=>{
        if(event.target.closest('[data-goal-drag-handle]'))return;
        selectedGoalRef = button.dataset.u5SelectGoal;
        renderActiveTab();
      };
      button.addEventListener('click',select);
      button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(event);}});
    });
    root.querySelectorAll('[data-u5-goal-view]').forEach(button=>button.addEventListener('click',()=>{
      goalViewMode = button.dataset.u5GoalView;
      renderActiveTab();
    }));
  }

  function renderGoals(){
    const groups = goalGroups();
    const allowedFilters=new Set(['alle',...groups.map(group=>group.owner)]);
    if(!allowedFilters.has(goalOwnerFilter))goalOwnerFilter='alle';
    const items = calculatedGoals();
    const totals = items.reduce((sum,item)=>{
      sum.saved += Number(item.doel.algespaard)||0;
      sum.target += Number(item.doel.doelbedrag)||0;
      sum.monthly += Number(item.werkelijkeInleg)||0;
      return sum;
    },{saved:0,target:0,monthly:0});
    const selection = selectedGoal(items);
    const root = document.getElementById('tab-spaardoelen');
    root.innerHTML = `${renderPageHeading(`Spaardoelen — ${monthLabel(getSelectedMonth())}`,'Elke maand een stap dichter bij wat jullie belangrijk vinden.')}
      <div class="overview-kpi-row cols-4 u5-goal-kpis">
        ${renderIconKpi('◇','green','Totaal gespaard',eur(totals.saved),`van ${eur(totals.target)}`,{valueClass:'value pos'})}
        ${renderIconKpi('◎','blue','Totaal doelbedrag',eur(totals.target),'alle doelen samen')}
        ${renderIconKpi('↗','green','Gemiddelde voortgang',totals.target>0?pct(totals.saved/totals.target):'0%','op basis van doelbedrag')}
        ${renderIconKpi('€','blue','Inleg deze maand',eur(totals.monthly),monthLabel(getSelectedMonth()))}
      </div>
      <div class="u5-goal-toolbar">
        <div class="u5-segmented" aria-label="Filter op eigenaar">
          ${[['alle','Alle'],...groups.map(group=>[group.owner,group.label])].map(([value,label])=>`<button type="button" class="${goalOwnerFilter===value?'active':''}" data-u5-goal-filter="${value}">${label}</button>`).join('')}
        </div>
        <div class="u5-segmented" aria-label="Spaardoelenweergave">
          <button type="button" class="${goalViewMode==='master'?'active':''}" data-u5-goal-view="master">Kaarten</button>
          <button type="button" class="${goalViewMode==='table'?'active':''}" data-u5-goal-view="table">Tabelweergave</button>
        </div>
      </div>
      ${goalViewMode === 'table' ? goalTableView(groups) : `<div class="u5-goal-master">
        <aside class="card u5-goal-list">
          <div class="card-head"><div><h2>Spaardoelen</h2><span class="hint">${selection.visible.length} zichtbaar</span></div></div>
          <div class="u5-goal-list-scroll">${goalListContent(selection.visible) || '<p class="hint">Geen doelen in deze groep.</p>'}</div>
          <button type="button" class="ghost" data-add-goal="${selection.selected?.owner||(goalOwnerFilter==='alle'?'gezamenlijk':goalOwnerFilter)}">+ Spaardoel</button>
        </aside>
        ${goalDetail(selection.selected)}
      </div>`}`;
    bindGoalPresentation(root);
  }

  function makeDataCard(title,description,className){
    const card = document.createElement('section');
    card.className = `card ${className}`;
    card.innerHTML = `<div class="card-head"><h2>${title}</h2></div><p class="hint">${description}</p><div class="toolbar"></div>`;
    return card;
  }

  function renderData(){
    renderDataTab();
    const root = document.getElementById('tab-data');
    root.classList.add('u5-data-page');
    const cards = [...root.querySelectorAll(':scope > .card')];
    const backupCard = cards.find(card=>card.querySelector('#btnExport'));
    const firestoreCard = cards.find(card=>card.querySelector('#firebaseConfigInput'));
    if (!backupCard || !firestoreCard) return;

    backupCard.querySelector('h2').textContent = 'Import en export';
    const backupToolbar = backupCard.querySelector('.toolbar');
    const restoreButton = backupCard.querySelector('#btnRestoreBackup');
    const resetButton = backupCard.querySelector('#btnReset');

    const localCard = makeDataCard('Lokale back-up','Herstel de laatste automatisch bewaarde lokale noodkopie.','u5-data-local');
    localCard.querySelector('.toolbar').appendChild(restoreButton);

    const dangerCard = makeDataCard('Gevarenzone','Deze actie wist de lokale Finize-gegevens pas na bevestiging.','u5-data-danger');
    dangerCard.querySelector('.toolbar').appendChild(resetButton);

    const sections = document.createElement('div');
    sections.className = 'u5-data-sections';
    backupCard.parentNode.insertBefore(sections,backupCard);
    sections.append(localCard,backupCard,firestoreCard,dangerCard);
    if (backupToolbar && !backupToolbar.children.length) backupToolbar.remove();
  }

  window.FinizeUpdate5 = Object.freeze({
    renderGoals,
    renderData,
    markNegativeValues
  });

  reuseMobileNavigationIcons();

  window.addEventListener('resize',()=>{
    const next = window.innerWidth >= 768;
    if (next === largeLayoutActive) return;
    largeLayoutActive = next;
    renderActiveTab();
  });

  if(window.__finizeBootstrap)window.__finizeBootstrap.update5Ready=true;
  window.__finizeMaybeFinishBootstrap?.();
})();
