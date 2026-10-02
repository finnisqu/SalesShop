/* Split notebook workspace polish.
   - In true Split mode, Current and Reference get distinct two-row tool areas.
   - The presentation control remains centered between the two page toolbars.
   - Reference header actions move into its toolbar while split, then return to the paper header.
   - The final Grid lattice/selection alignment is refreshed whenever paper geometry changes. */

function notebookReferenceToolbarStyleControl(ref) {
  const wrap=document.createElement('div');
  wrap.className='notebook-reference-toolbar-style';
  const button=document.createElement('button');
  button.type='button';
  button.className='notebook-tool notebook-reference-toolbar-style-button';
  button.textContent='Style ▾';
  button.title='Reference sheet style';
  button.setAttribute('aria-label','Reference sheet style');

  const menu=document.createElement('div');
  menu.className='notebook-reference-toolbar-style-menu';
  const active=typeof notebookPagePaperColorFinal==='function'
    ? notebookPagePaperColorFinal(ref.key,ref.pageId,'blue')
    : 'blue';
  [['warm','Warm'],['blue','Blue'],['neutral','Neutral']].forEach(([color,label])=>{
    const choice=document.createElement('button');
    choice.type='button';
    choice.className=`notebook-reference-toolbar-style-choice${active===color?' active':''}`;
    choice.dataset.referenceToolbarPaper=color;
    choice.title=`${label} paper`;
    choice.setAttribute('aria-label',choice.title);
    choice.innerHTML=`<span class="notebook-reference-toolbar-swatch swatch-${color}" aria-hidden="true"></span><span>${label}</span>`;
    choice.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      if (typeof setNotebookPagePaperColorFinal==='function') setNotebookPagePaperColorFinal(ref.key,ref.pageId,color);
    };
    menu.appendChild(choice);
  });

  button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const opening=!wrap.classList.contains('open');
    document.querySelectorAll('.notebook-reference-toolbar-style.open').forEach(node=>node.classList.remove('open'));
    wrap.classList.toggle('open',opening);
  };
  wrap.append(button,menu);
  return wrap;
}

function restoreNotebookSplitToolbar(root=$('#notebookDock')) {
  const toolbar=$('.notebook-toolbar',root);
  if (!toolbar?.classList.contains('notebook-toolbar-split')) return;
  const currentPane=$('.notebook-split-tools-current',toolbar);
  const referencePane=$('.notebook-split-tools-reference',toolbar);
  const left=$('.notebook-toolbar-left',currentPane);
  const actions=$('.notebook-toolbar-actions',currentPane);
  const position=$('[data-notebook-width-controls]',toolbar)?.closest?.('.notebook-position-control') || $('[data-notebook-width-controls]',toolbar);
  const referenceActions=$('.notebook-reference-actions',referencePane);
  const referenceHead=$('.notebook-reference-head',root);

  if (left) {
    if (position) toolbar.insertBefore(left,position);
    else toolbar.prepend(left);
  }
  if (actions) {
    if (position?.nextSibling) toolbar.insertBefore(actions,position.nextSibling);
    else toolbar.appendChild(actions);
  }
  if (referenceActions && referenceHead) referenceHead.appendChild(referenceActions);
  currentPane?.remove();
  referencePane?.remove();
  toolbar.classList.remove('notebook-toolbar-split');
}

function installNotebookSplitToolbar(root=$('#notebookDock')) {
  if (!root) return;
  const pair=$('.notebook-page-pair',root);
  const toolbar=$('.notebook-toolbar',root);
  if (!toolbar) return;
  const layout=pair && typeof notebookPaperResolvedLayoutFinal==='function'
    ? notebookPaperResolvedLayoutFinal(pair)
    : pair?.dataset?.paperResolvedLayout;
  const split=!!pair && layout==='split' && (typeof notebookWidthMode!=='function' || notebookWidthMode()!=='float');
  if (!split) {
    restoreNotebookSplitToolbar(root);
    return;
  }
  if (toolbar.classList.contains('notebook-toolbar-split')) return;

  const left=$('.notebook-toolbar-left',toolbar);
  const actions=$('.notebook-toolbar-actions',toolbar);
  const rawPosition=$('[data-notebook-width-controls]',toolbar);
  const position=rawPosition?.closest?.('.notebook-position-control') || rawPosition;
  const referenceActions=$('.notebook-reference-actions',root);
  const ref=typeof notebookReferencePageState==='function' ? notebookReferencePageState() : state.settings?.notebookReferencePage;
  if (!left || !actions || !position || !referenceActions || !ref) return;

  const currentPane=document.createElement('div');
  currentPane.className='notebook-split-tools notebook-split-tools-current';
  const currentRow1=document.createElement('div');
  currentRow1.className='notebook-split-toolbar-row notebook-split-current-primary';
  const currentRow2=document.createElement('div');
  currentRow2.className='notebook-split-toolbar-row notebook-split-current-secondary';
  currentRow1.appendChild(left);
  currentRow2.appendChild(actions);
  currentPane.append(currentRow1,currentRow2);

  const referencePane=document.createElement('div');
  referencePane.className='notebook-split-tools notebook-split-tools-reference';
  const referenceRow1=document.createElement('div');
  referenceRow1.className='notebook-split-toolbar-row notebook-split-reference-primary';
  const referenceRow2=document.createElement('div');
  referenceRow2.className='notebook-split-toolbar-row notebook-split-reference-secondary';
  referenceActions.dataset.splitToolbarMoved='1';
  referenceRow1.appendChild(referenceActions);
  referenceRow2.appendChild(notebookReferenceToolbarStyleControl(ref));
  referencePane.append(referenceRow1,referenceRow2);

  toolbar.insertBefore(currentPane,position);
  if (position.nextSibling) toolbar.insertBefore(referencePane,position.nextSibling);
  else toolbar.appendChild(referencePane);
  toolbar.classList.add('notebook-toolbar-split');
}

/* The spatial interaction layer is rooted at the Grid canvas. Make sure any existing selection box
   gets repainted after split/fullscreen geometry changes instead of visually retaining stale bounds. */
function repaintNotebookSpatialSelectionAfterLayout(root=$('#notebookDock')) {
  if (!root || typeof activeSpatialSelection==='undefined' || !activeSpatialSelection) return;
  const canvas=$('.grid-notebook-canvas',root);
  if (!canvas) return;
  const hasToolbar=!!$('.grid-cell-selection-toolbar',canvas);
  drawSpatialSelection?.(canvas,activeSpatialSelection,{toolbar:hasToolbar});
}

function refreshNotebookSplitWorkspace(root=$('#notebookDock')) {
  if (!root) return;
  installNotebookSplitToolbar(root);
  requestAnimationFrame(()=>repaintNotebookSpatialSelectionAfterLayout(root));
}

if (typeof refreshNotebookPhysicalPaperFinal==='function' && !window.__salesShopSplitRefreshBridge) {
  window.__salesShopSplitRefreshBridge=true;
  const _splitPhysicalRefresh=refreshNotebookPhysicalPaperFinal;
  refreshNotebookPhysicalPaperFinal=function(root=$('#notebookDock')) {
    const result=_splitPhysicalRefresh(root);
    refreshNotebookSplitWorkspace(root);
    return result;
  };
}

if (!window.__salesShopSplitToolbarDismiss) {
  window.__salesShopSplitToolbarDismiss=true;
  document.addEventListener('pointerdown',event=>{
    if (event.target?.closest?.('.notebook-reference-toolbar-style')) return;
    document.querySelectorAll('.notebook-reference-toolbar-style.open').forEach(node=>node.classList.remove('open'));
  },true);
  window.addEventListener('resize',()=>requestAnimationFrame(()=>refreshNotebookSplitWorkspace($('#notebookDock'))),{passive:true});
  document.addEventListener('fullscreenchange',()=>requestAnimationFrame(()=>refreshNotebookSplitWorkspace($('#notebookDock'))));
}

const _splitWorkspaceRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _splitWorkspaceRenderNotebook(root);
  if (!root) return;
  refreshNotebookSplitWorkspace(root);
};

requestAnimationFrame(()=>refreshNotebookSplitWorkspace($('#notebookDock')));
