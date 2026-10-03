/* Page-owned paper style + low-friction spatial writing + paper-object rotation + nested create flyouts.
   Loaded after the clean Binder and paper-object layers so this is the final owner of paper behavior. */

const NOTEBOOK_PAGE_STYLE_V1 = new Set(['lines','cornell','grid']);
const NOTEBOOK_PAGE_GRID_PAPERS_V1 = new Set(['blank','grid','dots']);
const NOTEBOOK_PAGE_COLUMN_MODES_V1 = new Set(['one','two']);
let paperBehaviorSelectionFinishedAt = 0;

/* --- Page-owned paper metadata ---------------------------------------------------------- */
function notebookPagePaperStyleMapFinal() {
  state.settings ||= {};
  state.settings.notebookPagePaperStyles ||= {};
  return state.settings.notebookPagePaperStyles;
}

function notebookPaperStyleDefaultsFinal() {
  const raw=state.settings?.notebookPaperView;
  let view=raw==='cornell'?'cornell':raw==='lines'?'lines':'grid';
  let gridPaper=NOTEBOOK_PAGE_GRID_PAPERS_V1.has(state.settings?.notebookGridPaper)
    ? state.settings.notebookGridPaper
    : (raw==='blank'?'blank':'grid');
  const columnMode=state.settings?.notebookColumnMode==='two'?'two':'one';
  if (view!=='grid') gridPaper='grid';
  return {view,gridPaper,columnMode:view==='cornell'?'one':columnMode};
}

function normalizeNotebookPagePaperStyleFinal(style={},fallback=notebookPaperStyleDefaultsFinal()) {
  const view=NOTEBOOK_PAGE_STYLE_V1.has(style.view)?style.view:fallback.view;
  const gridPaper=NOTEBOOK_PAGE_GRID_PAPERS_V1.has(style.gridPaper)?style.gridPaper:fallback.gridPaper;
  const columnMode=NOTEBOOK_PAGE_COLUMN_MODES_V1.has(style.columnMode)?style.columnMode:fallback.columnMode;
  return {
    view,
    gridPaper:view==='grid'?gridPaper:'grid',
    columnMode:view==='cornell'?'one':columnMode
  };
}

function ensureNotebookPagePaperStyleFinal(key=currentNotebookDate,pageId=currentNotebookPageId) {
  if (!key || !pageId) return notebookPaperStyleDefaultsFinal();
  const storageKey=typeof notebookPageMetadataKey==='function'
    ? notebookPageMetadataKey(key,pageId)
    : `${key}::${pageId}`;
  const map=notebookPagePaperStyleMapFinal();
  const prior=map[storageKey];
  const normalized=normalizeNotebookPagePaperStyleFinal(prior||{});
  const changed=!prior || prior.view!==normalized.view || prior.gridPaper!==normalized.gridPaper || prior.columnMode!==normalized.columnMode;
  if (changed) map[storageKey]=normalized;
  return normalized;
}

function notebookPagePaperStyleFinal(key=currentNotebookDate,pageId=currentNotebookPageId) {
  return ensureNotebookPagePaperStyleFinal(key,pageId);
}

function setNotebookPagePaperStyleFinal(key,pageId,next,{persist=true,render=true}={}) {
  if (!key || !pageId) return;
  const storageKey=typeof notebookPageMetadataKey==='function'
    ? notebookPageMetadataKey(key,pageId)
    : `${key}::${pageId}`;
  const normalized=normalizeNotebookPagePaperStyleFinal(next,notebookPagePaperStyleFinal(key,pageId));
  notebookPagePaperStyleMapFinal()[storageKey]=normalized;

  /* These globals now act only as the default for a page that has never owned a style yet. */
  state.settings ||= {};
  state.settings.notebookPaperView=normalized.view;
  state.settings.notebookGridPaper=normalized.gridPaper;
  state.settings.notebookColumnMode=normalized.columnMode;
  if (persist) save();
  if (render) renderAll();
  return normalized;
}

/* Final getters: the physical sheet owns these values. */
notebookPaperView=function() {
  return notebookPagePaperStyleFinal().view;
};
notebookGridPaper=function() {
  const style=notebookPagePaperStyleFinal();
  return style.view==='grid'?style.gridPaper:'grid';
};
notebookColumnMode=function() {
  return notebookPagePaperStyleFinal().columnMode;
};

function paperBehaviorSwitchPageStyle(next,root=$('#notebookDock')) {
  const before=notebookPagePaperStyleFinal();
  pageStateSyncDraft?.(root);
  const normalized=normalizeNotebookPagePaperStyleFinal(next,before);
  if (normalized.view==='grid') {
    if (before.view!=='grid') pageStateMaterializeDraft?.(root);
    ensureCurrentGridPlacements?.();
  } else {
    ensureCurrentPaperPlacements?.();
  }
  setNotebookPagePaperStyleFinal(currentNotebookDate,currentNotebookPageId,normalized,{persist:true,render:true});
}

/* Replace the style palette's write path so choosing paper changes this page, not every page. */
installSpatialStyleMenu=function(root) {
  const menu=$('[data-notebook-view-menu]',root);
  if (!menu) return;
  const style=notebookPagePaperStyleFinal();
  const linedMode=style.view==='cornell'?'cornell':(style.view==='lines'&&style.columnMode==='two'?'double':'single');
  const spatialMode=style.view==='grid'?style.gridPaper:null;

  menu.classList.add('notebook-style-groups');
  menu.innerHTML=`
    <div class="notebook-style-group">
      <div class="notebook-style-group-label">Lined</div>
      <div class="notebook-style-choice-row">
        <button type="button" class="notebook-style-choice ${linedMode==='single'?'active':''}" data-lined-style="single" title="Single-column lined paper" aria-label="Single-column lined paper">${spatialStyleIcon('lined-single')}</button>
        <button type="button" class="notebook-style-choice ${linedMode==='double'?'active':''}" data-lined-style="double" title="Two-column lined paper" aria-label="Two-column lined paper">${spatialStyleIcon('lined-double')}</button>
        <button type="button" class="notebook-style-choice notebook-style-choice-text ${linedMode==='cornell'?'active':''}" data-lined-style="cornell" title="Cornell notes" aria-label="Cornell notes">Cornell</button>
      </div>
    </div>
    <div class="notebook-style-group">
      <div class="notebook-style-group-label">Spatial</div>
      <div class="notebook-style-choice-row">
        <button type="button" class="notebook-style-choice ${spatialMode==='blank'?'active':''}" data-spatial-paper="blank" title="Blank spatial canvas" aria-label="Blank spatial canvas">${spatialStyleIcon('blank')}</button>
        <button type="button" class="notebook-style-choice ${spatialMode==='grid'?'active':''}" data-spatial-paper="grid" title="Grid paper" aria-label="Grid paper">${spatialStyleIcon('grid')}</button>
        <button type="button" class="notebook-style-choice ${spatialMode==='dots'?'active':''}" data-spatial-paper="dots" title="Dot-grid paper" aria-label="Dot-grid paper">${spatialStyleIcon('dots')}</button>
      </div>
    </div>`;

  $$('[data-lined-style]',menu).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const mode=button.dataset.linedStyle;
    paperBehaviorSwitchPageStyle({
      view:mode==='cornell'?'cornell':'lines',
      gridPaper:'grid',
      columnMode:mode==='double'?'two':'one'
    },root);
  });
  $$('[data-spatial-paper]',menu).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    paperBehaviorSwitchPageStyle({view:'grid',gridPaper:button.dataset.spatialPaper,columnMode:'one'},root);
  });
};

/* --- Creation palette: Table | Sticker > | Pencil > ------------------------------------ */
function paperBehaviorCreateAnnotation(type,style,bounds) {
  if (!bounds || !NOTEBOOK_ANNOTATION_TYPES?.has?.(type)) return;
  notebookPushUndoCheckpoint?.();
  const object={
    id:uid('spatial'),
    type,
    col:Math.max(0,Number(bounds.col)||0),
    row:Math.max(0,Number(bounds.row)||0),
    cols:Math.max(type==='arrow'?3:2,Math.round(Number(bounds.cols)||1)),
    rows:Math.max(2,Math.round(Number(bounds.rows)||1)),
    text:'',
    annotationStyle:style==='sticky'?'sticky':'pencil',
    annotationTone:type==='stop'?'red':'yellow',
    rotation:Number(paperObjectStampRotation?.(String(Date.now())+Math.random())||0),
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  spatialObjects().push(object);
  selectedSpatialObjectId=object.id;
  if (typeof paperObjectPendingFocusId!=='undefined') paperObjectPendingFocusId=object.id;
  save();
  clearSpatialSelection?.();
  renderAll();
}

function paperBehaviorCreatePreset(preset,bounds) {
  if (preset==='table') return createSpatialObject('table',bounds);
  if (preset==='postit') return createSpatialObject('postit',bounds);
  const [style,type]=String(preset||'').split(':');
  if ((style==='sticky'||style==='pencil') && NOTEBOOK_ANNOTATION_TYPES?.has?.(type)) {
    paperBehaviorCreateAnnotation(type,style,bounds);
  }
}

function paperBehaviorCreateIcon(kind) {
  if (kind==='sticker') return '<span class="paper-create-family-icon sticker" aria-hidden="true"></span>';
  if (kind==='pencil') return '<span class="paper-create-family-icon pencil" aria-hidden="true"></span>';
  if (kind==='arrow') return '<span class="paper-create-shape-icon arrow" aria-hidden="true"></span>';
  if (kind==='stop') return '<span class="paper-create-shape-icon stop" aria-hidden="true"></span>';
  if (kind==='cloud') return '<span class="paper-create-shape-icon cloud" aria-hidden="true"></span>';
  if (kind==='oval') return '<span class="paper-create-shape-icon oval" aria-hidden="true"></span>';
  if (kind==='box') return '<span class="paper-create-shape-icon box" aria-hidden="true"></span>';
  return '';
}

function paperBehaviorOrientCreateSubmenus(controls) {
  const page=controls?.closest?.('.notebook-page');
  if (!page) return;
  const boundary=page.getBoundingClientRect();
  requestAnimationFrame(()=>{
    $$('.paper-create-family',controls).forEach(family=>{
      const rect=family.getBoundingClientRect();
      family.classList.toggle('submenu-left',rect.right+132>boundary.right);
    });
  });
}

drawSpatialSelection=function(canvas,bounds,{toolbar=false}={}) {
  let box=$('.grid-cell-selection',canvas);
  if (!box) {
    box=document.createElement('div');
    box.className='grid-cell-selection';
    canvas.appendChild(box);
  }
  box.style.setProperty('--select-col',bounds.col);
  box.style.setProperty('--select-row',bounds.row);
  box.style.setProperty('--select-cols',bounds.cols);
  box.style.setProperty('--select-rows',bounds.rows);
  $('.grid-cell-selection-toolbar',canvas)?.remove();
  if (!toolbar) return;

  const controls=document.createElement('div');
  controls.className='grid-cell-selection-toolbar grid-create-control paper-object-create-control paper-create-nested';
  controls.style.setProperty('--select-col',bounds.col);
  controls.style.setProperty('--select-row',bounds.row);
  controls.innerHTML=`
    <button type="button" class="grid-create-trigger" data-compact-flyout-trigger title="Create object" aria-label="Create object">+</button>
    <span class="grid-create-panel paper-create-main-panel">
      <button type="button" data-paper-create="table" title="Table" aria-label="Table"><span class="grid-create-table-icon" aria-hidden="true"></span></button>
      <span class="paper-create-family" data-create-family="sticker">
        <button type="button" class="paper-create-family-trigger" title="Sticker objects" aria-label="Sticker objects">${paperBehaviorCreateIcon('sticker')}</button>
        <span class="paper-create-submenu">
          <button type="button" data-paper-create="postit" title="Post-it note" aria-label="Post-it note"><span class="grid-create-postit-icon" aria-hidden="true"></span></button>
          <button type="button" data-paper-create="sticky:arrow" title="Arrow sticker" aria-label="Arrow sticker">${paperBehaviorCreateIcon('arrow')}</button>
          <button type="button" data-paper-create="sticky:stop" title="Stop-sign sticker" aria-label="Stop-sign sticker">${paperBehaviorCreateIcon('stop')}</button>
          <button type="button" data-paper-create="sticky:cloud" title="Cloud sticker" aria-label="Cloud sticker">${paperBehaviorCreateIcon('cloud')}</button>
          <button type="button" data-paper-create="sticky:oval" title="Oval sticker" aria-label="Oval sticker">${paperBehaviorCreateIcon('oval')}</button>
        </span>
      </span>
      <span class="paper-create-family" data-create-family="pencil">
        <button type="button" class="paper-create-family-trigger" title="Pencil annotations" aria-label="Pencil annotations">${paperBehaviorCreateIcon('pencil')}</button>
        <span class="paper-create-submenu">
          <button type="button" data-paper-create="pencil:box" title="Pencil box" aria-label="Pencil box">${paperBehaviorCreateIcon('box')}</button>
          <button type="button" data-paper-create="pencil:cloud" title="Pencil cloud" aria-label="Pencil cloud">${paperBehaviorCreateIcon('cloud')}</button>
          <button type="button" data-paper-create="pencil:oval" title="Pencil oval" aria-label="Pencil oval">${paperBehaviorCreateIcon('oval')}</button>
          <button type="button" data-paper-create="pencil:arrow" title="Pencil arrow" aria-label="Pencil arrow">${paperBehaviorCreateIcon('arrow')}</button>
        </span>
      </span>
    </span>`;
  canvas.appendChild(controls);
  $$('[data-paper-create]',controls).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    paperBehaviorCreatePreset(button.dataset.paperCreate,bounds);
  });
  bindCompactFlyout?.(controls);
  orientUnifiedFlyout?.(controls);
  paperBehaviorOrientCreateSubmenus(controls);
};

/* --- Selection should never block jotting ------------------------------------------------ */
document.addEventListener('pointerup',event=>{
  const canvas=event.target?.closest?.('.grid-notebook-canvas');
  if (!canvas) return;
  setTimeout(()=>{
    if (typeof activeSpatialSelection!=='undefined' && activeSpatialSelection) paperBehaviorSelectionFinishedAt=Date.now();
  },0);
});

document.addEventListener('click',event=>{
  if (Date.now()-paperBehaviorSelectionFinishedAt<260) return;
  if (typeof activeSpatialSelection==='undefined' || !activeSpatialSelection) return;
  const canvas=event.target?.closest?.('.grid-notebook-canvas');
  if (!canvas) return;
  if (event.target.closest('.grid-cell-selection-toolbar,.notebook-spatial-object,.grid-note,.grid-editor-wrap,.grid-grab-handle')) return;
  if (typeof isCurrentNotebookPageEditable==='function' && !isCurrentNotebookPageEditable()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const cell=spatialPointerCell(canvas,event);
  clearSpatialSelection(canvas);
  openGridEditor?.($('#notebookDock'),canvas,cell);
},true);

function paperBehaviorTypeIntoFreshGridEditor(key) {
  requestAnimationFrame(()=>{
    const wrap=(typeof activeGridEditor!=='undefined')?activeGridEditor?.wrap:null;
    const editor=wrap?.querySelector?.('[data-grid-rich-editor]') || activeGridEditor?.textarea || wrap?.querySelector?.('[contenteditable="true"],textarea');
    if (!editor) return;
    try { editor.focus({preventScroll:true}); } catch { editor.focus?.(); }
    if (key==='Enter') return;
    if (editor.isContentEditable) {
      try { document.execCommand('insertText',false,key); }
      catch { editor.textContent=(editor.textContent||'')+key;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:key})); }
    } else {
      const value=String(editor.value||'');
      editor.value=value+key;
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
}

document.addEventListener('keydown',event=>{
  if (typeof activeSpatialSelection==='undefined' || !activeSpatialSelection) return;
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!(event.key.length===1 || event.key==='Enter')) return;
  const active=document.activeElement;
  if (active?.matches?.('input,textarea,[contenteditable="true"]')) return;
  const root=$('#notebookDock');
  const canvas=$('.grid-notebook-canvas',root);
  if (!canvas || notebookPaperView()!=='grid') return;
  if (typeof isCurrentNotebookPageEditable==='function' && !isCurrentNotebookPageEditable()) return;
  event.preventDefault();
  const cell={col:activeSpatialSelection.col,row:activeSpatialSelection.row};
  clearSpatialSelection(canvas);
  openGridEditor?.(root,canvas,cell);
  paperBehaviorTypeIntoFreshGridEditor(event.key);
},true);

/* --- Rotation --------------------------------------------------------------------------- */
function paperBehaviorClampRotation(value) {
  let next=Math.max(-15,Math.min(15,Number(value)||0));
  if (Math.abs(next)<.8) next=0;
  return Math.round(next*10)/10;
}

function paperBehaviorBeginRotation({event,host,getRotation,setLive,commit}) {
  if (event.button!==0 || !host) return;
  event.preventDefault();
  event.stopPropagation();
  const rect=host.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const angle=(x,y)=>Math.atan2(y-cy,x-cx)*180/Math.PI;
  const startPointer=angle(event.clientX,event.clientY);
  const start=Number(getRotation?.())||0;
  let next=start;
  const move=ev=>{
    let delta=angle(ev.clientX,ev.clientY)-startPointer;
    if (delta>180) delta-=360;
    if (delta<-180) delta+=360;
    next=paperBehaviorClampRotation(start+delta);
    if (ev.shiftKey) next=Math.round(next/5)*5;
    setLive?.(next);
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    document.removeEventListener('pointercancel',up);
    commit?.(next);
  };
  document.addEventListener('pointermove',move,{passive:false});
  document.addEventListener('pointerup',up,{once:true});
  document.addEventListener('pointercancel',up,{once:true});
}

function paperBehaviorRotationHandle() {
  const handle=document.createElement('button');
  handle.type='button';
  handle.className='paper-object-rotate-handle';
  handle.title='Drag to rotate · Shift snaps to 5°';
  handle.setAttribute('aria-label','Rotate object');
  handle.innerHTML='<span aria-hidden="true">↻</span>';
  return handle;
}

function paperBehaviorInstallSpatialRotation(object,wrap) {
  if (!object || !wrap || !(NOTEBOOK_ANNOTATION_TYPES?.has?.(object.type) || object.type==='postit')) return;
  if ($('.paper-object-rotate-handle',wrap)) return;
  const handle=paperBehaviorRotationHandle();
  wrap.appendChild(handle);
  const apply=value=>{
    if (object.type==='postit') wrap.style.setProperty('--postit-rotation',`${value}deg`);
    else wrap.style.setProperty('--annotation-rotation',`${value}deg`);
  };
  handle.addEventListener('pointerdown',event=>paperBehaviorBeginRotation({
    event,
    host:wrap,
    getRotation:()=>Number(object.rotation)||0,
    setLive:apply,
    commit:value=>{
      const next=paperBehaviorClampRotation(value);
      if (next===(Number(object.rotation)||0)) return;
      notebookPushUndoCheckpoint?.();
      object.rotation=next;
      object.updatedAt=new Date().toISOString();
      apply(next);
      save();
    }
  }));
}

function paperBehaviorInstallImageRotation(root=$('#notebookDock')) {
  $$(`.grid-note.notebook-spatial-image-object[data-entry-id]`,root).forEach(note=>{
    const entry=typeof notebookCleanEntryById==='function'?notebookCleanEntryById(note.dataset.entryId):null;
    const preview=$('.notebook-spatial-attachment-preview',note);
    if (!entry?.attachment || !preview) return;
    const rotation=paperBehaviorClampRotation(entry.attachment.rotation||0);
    preview.style.setProperty('--image-rotation',`${rotation}deg`);
    let handle=$('.paper-object-rotate-handle',note);
    if (!handle) {
      handle=paperBehaviorRotationHandle();
      note.appendChild(handle);
    }
    if (handle.dataset.paperRotationBound) return;
    handle.dataset.paperRotationBound='1';
    handle.addEventListener('pointerdown',event=>paperBehaviorBeginRotation({
      event,
      host:preview,
      getRotation:()=>Number(entry.attachment.rotation)||0,
      setLive:value=>preview.style.setProperty('--image-rotation',`${value}deg`),
      commit:value=>{
        const next=paperBehaviorClampRotation(value);
        entry.attachment.rotation=next;
        entry.updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();
        preview.style.setProperty('--image-rotation',`${next}deg`);
        save();
      }
    }));
  });
}

const _paperBehaviorRenderSpatialObject=renderSpatialObject;
renderSpatialObject=function(object,canvas) {
  _paperBehaviorRenderSpatialObject(object,canvas);
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;
  if (NOTEBOOK_ANNOTATION_TYPES?.has?.(object.type)) {
    const rotation=paperBehaviorClampRotation(object.rotation||0);
    wrap.style.setProperty('--annotation-rotation',`${rotation}deg`);
  }
  if (object.type==='postit') {
    const rotation=paperBehaviorClampRotation(object.rotation||0);
    wrap.style.setProperty('--postit-rotation',`${rotation}deg`);
  }
  paperBehaviorInstallSpatialRotation(object,wrap);
};

/* Keep style metadata and image rotation controls refreshed after every page render. */
const _paperBehaviorRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  ensureNotebookPagePaperStyleFinal(currentNotebookDate,currentNotebookPageId);
  _paperBehaviorRenderNotebook(root);
  if (!root) return;
  paperBehaviorInstallImageRotation(root);
  requestAnimationFrame(()=>paperBehaviorInstallImageRotation(root));
};

/* Page deletion should release its paper-style metadata too. */
if (typeof deleteBlankNotebookPage==='function' && !window.__salesShopPaperStyleDeleteClean) {
  window.__salesShopPaperStyleDeleteClean=true;
  const _paperBehaviorDeleteBlank=deleteBlankNotebookPage;
  deleteBlankNotebookPage=function(key,pageId) {
    const storageKey=typeof notebookPageMetadataKey==='function'?notebookPageMetadataKey(key,pageId):`${key}::${pageId}`;
    const blank=notebookPageIsTrulyBlank?.(key,pageId);
    const result=_paperBehaviorDeleteBlank(key,pageId);
    if (blank) {
      delete notebookPagePaperStyleMapFinal()[storageKey];
      save();
    }
    return result;
  };
}
