/* Final physical-paper behavior.
   - Paper color belongs to a page identity, not Current/Reference role.
   - One side tab belongs to the active/front sheet.
   - Stack: drag the active tab inward to pull the top sheet toward center and snap to Split.
   - Split: drag the active tab outward to layer that sheet on top again.
   - Recalculate physical geometry after fullscreen/resize.
   - Favorites live beneath the calendar. */

const NOTEBOOK_PAGE_PAPER_COLORS = new Set(['warm','blue','neutral']);

function notebookPagePaperColorMapFinal() {
  state.settings ||= {};
  state.settings.notebookPagePaperColors ||= {};
  return state.settings.notebookPagePaperColors;
}

function notebookPagePaperColorFinal(key,pageId,fallback='warm') {
  const value=notebookPagePaperColorMapFinal()[notebookPageMetadataKey?.(key,pageId) || `${key}::${pageId}`];
  return NOTEBOOK_PAGE_PAPER_COLORS.has(value) ? value : fallback;
}

function ensureNotebookPagePaperColorFinal(key,pageId,fallback='warm') {
  if (!key || !pageId) return fallback;
  const map=notebookPagePaperColorMapFinal();
  const storageKey=typeof notebookPageMetadataKey==='function' ? notebookPageMetadataKey(key,pageId) : `${key}::${pageId}`;
  if (!NOTEBOOK_PAGE_PAPER_COLORS.has(map[storageKey])) {
    map[storageKey]=NOTEBOOK_PAGE_PAPER_COLORS.has(fallback) ? fallback : 'warm';
    return {color:map[storageKey],changed:true};
  }
  return {color:map[storageKey],changed:false};
}

function setNotebookPagePaperColorFinal(key,pageId,color) {
  if (!key || !pageId || !NOTEBOOK_PAGE_PAPER_COLORS.has(color)) return;
  const storageKey=typeof notebookPageMetadataKey==='function' ? notebookPageMetadataKey(key,pageId) : `${key}::${pageId}`;
  notebookPagePaperColorMapFinal()[storageKey]=color;
  save();
  renderAll();
}

function notebookLegacyReferenceColorFinal() {
  const old=state.settings?.notebookReferencePaperTint;
  if (old==='neutral') return 'neutral';
  if (old==='same') return 'warm';
  return 'blue';
}

function ensureOpenNotebookPaperColorsFinal() {
  let changed=false;
  const currentKey=currentNotebookDate;
  const currentPage=currentNotebookPageId;
  if (currentKey && currentPage) {
    const result=ensureNotebookPagePaperColorFinal(currentKey,currentPage,'warm');
    changed ||= result.changed;
  }
  const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
  if (ref?.key && ref?.pageId) {
    const result=ensureNotebookPagePaperColorFinal(ref.key,ref.pageId,notebookLegacyReferenceColorFinal());
    changed ||= result.changed;
  }
  if (changed) save();
}

function applyOpenNotebookPaperColorsFinal(root=$('#notebookDock')) {
  if (!root) return;
  ensureOpenNotebookPaperColorsFinal();
  const current=$('.notebook-page-pair > .notebook-page',root) || $('.notebook-page',root);
  if (current && currentNotebookDate && currentNotebookPageId) {
    current.dataset.pagePaperColor=notebookPagePaperColorFinal(currentNotebookDate,currentNotebookPageId,'warm');
  }
  const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
  const refPage=$('.notebook-reference-page',root);
  if (refPage && ref?.key && ref?.pageId) {
    refPage.dataset.pagePaperColor=notebookPagePaperColorFinal(ref.key,ref.pageId,'blue');
  }
}

function notebookPaperColorChoiceFinal(role,key,pageId,label) {
  const active=notebookPagePaperColorFinal(key,pageId,role==='current'?'warm':'blue');
  const group=document.createElement('div');
  group.className='notebook-style-group notebook-page-paper-style-final';
  group.dataset.pagePaperStyleFinal=role;
  group.innerHTML=`
    <div class="notebook-style-group-label">${escapeHtml(label)}</div>
    <div class="notebook-style-choice-row">
      <button type="button" class="notebook-style-choice page-paper-choice ${active==='warm'?'active':''}" data-page-paper-color="warm" title="Warm paper" aria-label="Warm paper"><span class="page-paper-swatch swatch-warm"></span></button>
      <button type="button" class="notebook-style-choice page-paper-choice ${active==='blue'?'active':''}" data-page-paper-color="blue" title="Light blue paper" aria-label="Light blue paper"><span class="page-paper-swatch swatch-blue"></span></button>
      <button type="button" class="notebook-style-choice page-paper-choice ${active==='neutral'?'active':''}" data-page-paper-color="neutral" title="Neutral paper" aria-label="Neutral paper"><span class="page-paper-swatch swatch-neutral"></span></button>
    </div>`;
  $$('[data-page-paper-color]',group).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    setNotebookPagePaperColorFinal(key,pageId,button.dataset.pagePaperColor);
  });
  return group;
}

function installNotebookPaperColorStyleFinal(root=$('#notebookDock')) {
  if (!root) return;
  const menu=$('[data-notebook-view-menu]',root);
  if (!menu || !currentNotebookDate || !currentNotebookPageId) return;
  $('[data-reference-paper-group]',menu)?.remove();
  $$('[data-page-paper-style-final]',menu).forEach(node=>node.remove());
  menu.appendChild(notebookPaperColorChoiceFinal('current',currentNotebookDate,currentNotebookPageId,'Current sheet'));
  const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
  if (ref?.key && ref?.pageId) menu.appendChild(notebookPaperColorChoiceFinal('other',ref.key,ref.pageId,'Other sheet'));
}

function moveNotebookFavoritesBelowCalendarFinal(root=$('#modalRoot')) {
  const shell=$('.notebook-history-calendar-shell',root);
  const grid=$('.notebook-history-calendar-grid',shell);
  const favorites=$('[data-history-favorites]',shell);
  if (!shell || !grid || !favorites) return;
  grid.insertAdjacentElement('afterend',favorites);
}

if (typeof bindNotebookHistoryCalendar==='function' && !window.__salesShopFavoritesBelowCalendarFinal) {
  window.__salesShopFavoritesBelowCalendarFinal=true;
  const _favoritesBelowCalendarBind=bindNotebookHistoryCalendar;
  bindNotebookHistoryCalendar=function() {
    const result=_favoritesBelowCalendarBind();
    moveNotebookFavoritesBelowCalendarFinal($('#modalRoot'));
    return result;
  };
}

function notebookPaperRoleColorFinal(role) {
  if (role==='reference') {
    const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
    return ref?.key && ref?.pageId ? notebookPagePaperColorFinal(ref.key,ref.pageId,'blue') : 'blue';
  }
  return notebookPagePaperColorFinal(currentNotebookDate,currentNotebookPageId,'warm');
}

function notebookPaperResolvedLayoutFinal(pair) {
  if (!pair) return 'split';
  if (typeof applyNotebookPaperLayout==='function') applyNotebookPaperLayout(pair);
  return pair.dataset.paperResolvedLayout || (typeof resolvedNotebookPaperLayout==='function' ? resolvedNotebookPaperLayout(pair) : 'split');
}

function notebookPaperFrontFinal() {
  return typeof notebookPaperFront==='function' ? notebookPaperFront() : (state.settings?.notebookPaperFront==='reference'?'reference':'current');
}

function setNotebookPaperFrontFinal(role,{persist=true}={}) {
  const next=role==='reference'?'reference':'current';
  state.settings ||= {};
  if (state.settings.notebookPaperFront===next) return;
  state.settings.notebookPaperFront=next;
  if (persist) save();
  const pair=$('#notebookDock .notebook-page-pair');
  if (pair) pair.dataset.paperFront=next;
}

function notebookPaperSheetFinal(pair,role) {
  return role==='reference' ? $('.notebook-reference-page',pair) : $(':scope > .notebook-page',pair);
}

function rebuildNotebookActivePaperTabFinal(pair) {
  if (!pair) return;
  $$('.notebook-paper-peek,.notebook-paper-active-tab',pair).forEach(node=>node.remove());
  const role=notebookPaperFrontFinal();
  pair.dataset.paperFront=role;
  const tab=document.createElement('button');
  tab.type='button';
  tab.className=`notebook-paper-active-tab notebook-paper-active-tab-${role}`;
  tab.dataset.paperActiveTab=role;
  tab.dataset.paperColor=notebookPaperRoleColorFinal(role);
  tab.innerHTML=`<span>${role==='current'?'Current':'Reference'}</span>`;
  tab.title=notebookPaperResolvedLayoutFinal(pair)==='stack'
    ? `Drag ${role==='current'?'Current':'Reference'} inward to split the papers`
    : `Drag ${role==='current'?'Current':'Reference'} outward to layer it on top`;
  pair.appendChild(tab);
  bindNotebookActivePaperTabDragFinal(pair,tab,role);
}

function bindNotebookPaperActivationFinal(pair) {
  if (!pair || pair.dataset.paperActivationFinal==='1') return;
  pair.dataset.paperActivationFinal='1';
  const bind=(sheet,role)=>{
    if (!sheet) return;
    sheet.addEventListener('pointerdown',event=>{
      if (event.button!==0 || event.target.closest('.notebook-paper-active-tab')) return;
      const front=notebookPaperFrontFinal();
      if (front===role) return;
      const layout=notebookPaperResolvedLayoutFinal(pair);
      setNotebookPaperFrontFinal(role,{persist:true});
      pair.dataset.paperFront=role;
      rebuildNotebookActivePaperTabFinal(pair);
      if (layout==='stack') {
        /* The first click on an exposed rear paper only brings that physical sheet forward. */
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  };
  bind(notebookPaperSheetFinal(pair,'current'),'current');
  bind(notebookPaperSheetFinal(pair,'reference'),'reference');
}

let notebookActivePaperDragFinal=null;

function bindNotebookActivePaperTabDragFinal(pair,tab,role) {
  tab.addEventListener('pointerdown',event=>{
    if (event.button!==0) return;
    const layout=notebookPaperResolvedLayoutFinal(pair);
    notebookActivePaperDragFinal={pair,tab,role,layout,pointerId:event.pointerId,startX:event.clientX,moved:false};
    tab.setPointerCapture?.(event.pointerId);
    pair.classList.add('active-paper-tab-dragging');
    pair.dataset.paperDragRole=role;
    event.preventDefault();
    event.stopPropagation();
  });

  tab.addEventListener('pointermove',event=>{
    const drag=notebookActivePaperDragFinal;
    if (!drag || drag.tab!==tab || event.pointerId!==drag.pointerId) return;
    const dx=event.clientX-drag.startX;
    if (Math.abs(dx)>3) drag.moved=true;
    if (drag.layout==='stack') {
      const inward=role==='current' ? Math.max(0,dx) : Math.max(0,-dx);
      const amount=Math.min(150,inward*.78);
      pair.style.setProperty('--active-paper-inward',`${amount}px`);
    } else {
      const outward=role==='current' ? Math.max(0,-dx) : Math.max(0,dx);
      const amount=Math.min(90,outward*.55);
      pair.style.setProperty('--active-paper-outward',`${amount}px`);
    }
    event.preventDefault();
  });

  const finish=event=>{
    const drag=notebookActivePaperDragFinal;
    if (!drag || drag.tab!==tab || (event.pointerId!=null && event.pointerId!==drag.pointerId)) return;
    notebookActivePaperDragFinal=null;
    pair.classList.remove('active-paper-tab-dragging');
    pair.style.removeProperty('--active-paper-inward');
    pair.style.removeProperty('--active-paper-outward');
    delete pair.dataset.paperDragRole;
    const dx=event.clientX-drag.startX;
    let changed=false;
    if (drag.layout==='stack') {
      const inward=role==='current' ? dx : -dx;
      if (inward>86) {
        state.settings ||= {};
        state.settings.notebookPaperLayout='split';
        state.settings.notebookPaperFront=role;
        changed=true;
      }
    } else {
      const outward=role==='current' ? -dx : dx;
      if (outward>70) {
        state.settings ||= {};
        state.settings.notebookPaperLayout='stack';
        state.settings.notebookPaperFront=role;
        changed=true;
      }
    }
    if (changed) {
      save();
      renderAll();
      return;
    }
    rebuildNotebookActivePaperTabFinal(pair);
  };
  tab.addEventListener('pointerup',finish);
  tab.addEventListener('pointercancel',finish);
  tab.addEventListener('click',event=>{
    if (notebookActivePaperDragFinal?.moved) event.preventDefault();
  });
}

function refreshNotebookPhysicalPaperFinal(root=$('#notebookDock')) {
  if (!root) return;
  applyOpenNotebookPaperColorsFinal(root);
  installNotebookPaperColorStyleFinal(root);
  const pair=$('.notebook-page-pair',root);
  if (!pair) return;
  notebookPaperResolvedLayoutFinal(pair);
  pair.style.removeProperty('--paper-drag-offset');
  pair.style.removeProperty('--paper-layer-preview');
  rebuildNotebookActivePaperTabFinal(pair);
  bindNotebookPaperActivationFinal(pair);
}

if (!window.__salesShopPhysicalPaperResizeFinal) {
  window.__salesShopPhysicalPaperResizeFinal=true;
  let timer=0;
  const schedule=()=>{
    cancelAnimationFrame(timer);
    timer=requestAnimationFrame(()=>refreshNotebookPhysicalPaperFinal($('#notebookDock')));
  };
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('fullscreenchange',()=>requestAnimationFrame(schedule));
}

const _physicalPaperFinalRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _physicalPaperFinalRender(root);
  if (!root) return;
  refreshNotebookPhysicalPaperFinal(root);
};

requestAnimationFrame(()=>{
  refreshNotebookPhysicalPaperFinal($('#notebookDock'));
  moveNotebookFavoritesBelowCalendarFinal($('#modalRoot'));
});
