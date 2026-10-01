/* Spatial content layer: table formatting, promotable embedded text, single-click Grid writing,
   sticky hover controls, and text-bearing shape objects. */

const SPATIAL_NUMBER_FORMATS = new Set(['none','currency','percent','decimal']);
const SPATIAL_CELL_FILLS = new Set(['none','yellow','mint','blue','rose']);
let spatialSelectionPopoverTimer = null;

function spatialSelectedCellAnchors(object) {
  normalizeAdvancedSpatialTable?.(object);
  let cells = selectedSpatialTableCells?.(object) || [];
  if (!cells.length) cells = [{r:0,c:0}];
  const seen = new Set();
  const out = [];
  cells.forEach(({r,c})=>{
    const merge = spatialMergeCovering?.(object,r,c);
    const ar = merge?.r ?? r;
    const ac = merge?.c ?? c;
    const key = spatialCellKey(ar,ac);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({r:ar,c:ac,key});
  });
  return out;
}

function spatialSelectionUniformStyle(object,property,fallback) {
  const anchors = spatialSelectedCellAnchors(object);
  if (!anchors.length) return fallback;
  const values = anchors.map(({key})=>object.cellStyles?.[key]?.[property] || fallback);
  return values.every(value=>value===values[0]) ? values[0] : fallback;
}

function applySpatialCellStyle(object,property,value,allowed) {
  if (!allowed.has(value)) return;
  normalizeAdvancedSpatialTable?.(object);
  const anchors = spatialSelectedCellAnchors(object);
  if (!anchors.length) return;
  notebookPushUndoCheckpoint?.();
  object.cellStyles ||= {};
  anchors.forEach(({key})=>{
    object.cellStyles[key] ||= {};
    if (value === 'none') delete object.cellStyles[key][property];
    else object.cellStyles[key][property] = value;
    if (!Object.keys(object.cellStyles[key]).length) delete object.cellStyles[key];
  });
  object.updatedAt = new Date().toISOString();
  selectedSpatialObjectId = object.id;
  openSpatialFormatObjectId = object.id;
  save();
  renderAll();
}

function parseSpatialNumericValue(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text.startsWith('=')) return null;
  let normalized = text.replace(/[$,]/g,'');
  let percentLiteral = false;
  if (normalized.endsWith('%')) {
    percentLiteral = true;
    normalized = normalized.slice(0,-1);
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return percentLiteral ? value/100 : value;
}

function formatSpatialCellValue(raw,format='none') {
  const text = String(raw ?? '');
  if (format === 'none') return text;
  const value = parseSpatialNumericValue(text);
  if (value == null) return text;
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  }
  if (format === 'percent') {
    return new Intl.NumberFormat('en-US',{style:'percent',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
  }
  if (format === 'decimal') return value.toFixed(2);
  return text;
}

function spatialNumberFormatGlyph(format) {
  if (format==='currency') return '$';
  if (format==='percent') return '%';
  if (format==='decimal') return '.0';
  return '—';
}

function spatialNumberFormatControl(object) {
  const active = spatialSelectionUniformStyle(object,'numberFormat','none');
  const wrap = document.createElement('span');
  wrap.className = 'spatial-number-format-control';
  wrap.dataset.activeNumberFormat = active;
  ['none','currency','percent','decimal'].forEach(format=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `spatial-number-format-choice${format===active?' active':''}`;
    button.dataset.numberFormat = format;
    button.title = format==='none' ? 'No number format' : format==='currency' ? 'Currency' : format==='percent' ? 'Percent' : 'Decimal';
    button.setAttribute('aria-label',button.title);
    button.textContent = spatialNumberFormatGlyph(format);
    button.onclick = event=>{
      event.preventDefault();
      event.stopPropagation();
      applySpatialCellStyle(object,'numberFormat',format,SPATIAL_NUMBER_FORMATS);
    };
    wrap.appendChild(button);
  });
  return wrap;
}

function spatialFillControl(object) {
  const active = spatialSelectionUniformStyle(object,'fill','none');
  const wrap = document.createElement('span');
  wrap.className = 'spatial-fill-control';
  wrap.dataset.activeFill = active;
  ['none','yellow','mint','blue','rose'].forEach(fill=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `spatial-fill-choice fill-${fill}${fill===active?' active':''}`;
    button.dataset.cellFill = fill;
    button.title = fill==='none' ? 'No cell fill' : `${fill[0].toUpperCase()+fill.slice(1)} fill`;
    button.setAttribute('aria-label',button.title);
    button.innerHTML = '<span aria-hidden="true"></span>';
    button.onclick = event=>{
      event.preventDefault();
      event.stopPropagation();
      applySpatialCellStyle(object,'fill',fill,SPATIAL_CELL_FILLS);
    };
    wrap.appendChild(button);
  });
  return wrap;
}

function spatialTableSelectionText(object) {
  const selection = (typeof activeSpatialTableSelection !== 'undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId !== object.id) return '';
  const bounds = spatialSelectionBoundsForTable?.(selection);
  if (!bounds) return '';
  if (bounds.rows===1 && bounds.cols===1) {
    const merge = spatialMergeCovering?.(object,bounds.r1,bounds.c1);
    return String(object.cells?.[merge?.r ?? bounds.r1]?.[merge?.c ?? bounds.c1] || '').trim();
  }
  const lines = [];
  for (let r=bounds.r1;r<=bounds.r2;r++) {
    const values = [];
    for (let c=bounds.c1;c<=bounds.c2;c++) {
      const merge = spatialMergeCovering?.(object,r,c);
      if (merge && (merge.r!==r || merge.c!==c)) {
        values.push('');
        continue;
      }
      values.push(String(object.cells?.[r]?.[c] || '').trim());
    }
    while (values.length && !values[values.length-1]) values.pop();
    if (values.some(Boolean)) lines.push(values.join(' | '));
  }
  return lines.join('\n').trim();
}

function appendSpatialCrmActions(controls,object) {
  const separator = document.createElement('span');
  separator.className = 'spatial-table-control-separator';
  controls.appendChild(separator);
  const promote = document.createElement('button');
  promote.type='button';
  promote.className='spatial-table-crm-action';
  promote.textContent='Promote';
  promote.title='Promote selected table text';
  promote.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const text=spatialTableSelectionText(object);
    if (!text) return toast('Select a cell or range with text first.');
    openPromoteModal(text,null);
  };
  const link = document.createElement('button');
  link.type='button';
  link.className='spatial-table-crm-action';
  link.textContent='Link';
  link.title='Link selected table text';
  link.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    const text=spatialTableSelectionText(object);
    if (!text) return toast('Select a cell or range with text first.');
    openLinkModal(text,null);
  };
  controls.append(promote,link);
}

const _salesShopSpatialContentControls = advancedSpatialTableControls;
advancedSpatialTableControls = function(object) {
  const controls = _salesShopSpatialContentControls(object);
  if (!$('.spatial-number-format-control',controls)) {
    const divider1=document.createElement('span');
    divider1.className='spatial-table-control-separator';
    controls.appendChild(divider1);
    controls.appendChild(spatialNumberFormatControl(object));
    controls.appendChild(spatialFillControl(object));
    appendSpatialCrmActions(controls,object);
  }
  return controls;
};

function enhanceSpatialTableCells(object,wrap) {
  normalizeAdvancedSpatialTable?.(object);
  const table = $('.spatial-table',wrap);
  if (!table) return;
  $$('td',table).forEach(td=>{
    const r=Number(td.dataset.spatialRow)||0;
    const c=Number(td.dataset.spatialCol)||0;
    const key=spatialCellKey(r,c);
    const style=object.cellStyles?.[key] || {};
    const format=SPATIAL_NUMBER_FORMATS.has(style.numberFormat) ? style.numberFormat : 'none';
    const fill=SPATIAL_CELL_FILLS.has(style.fill) ? style.fill : 'none';
    const raw=String(object.cells?.[r]?.[c] ?? '');
    td.dataset.numberFormat=format;
    td.dataset.cellFill=fill;
    td.dataset.rawValue=raw;
    if (document.activeElement !== td) td.textContent=formatSpatialCellValue(raw,format);

    const showRaw=()=>{
      const latest=String(object.cells?.[r]?.[c] ?? '');
      td.dataset.rawValue=latest;
      if (td.textContent !== latest) td.textContent=latest;
    };
    td.addEventListener('pointerdown',showRaw,true);
    td.addEventListener('focus',showRaw);
    td.addEventListener('input',()=>{ td.dataset.rawValue=td.textContent || ''; });
    td.addEventListener('blur',()=>{
      setTimeout(()=>{
        if (!td.isConnected || document.activeElement===td) return;
        const latest=String(object.cells?.[r]?.[c] ?? td.dataset.rawValue ?? '');
        td.textContent=formatSpatialCellValue(latest,format);
      },0);
    });
  });
}

const _salesShopSpatialContentRenderTable = renderSpatialTable;
renderSpatialTable = function(object,wrap) {
  _salesShopSpatialContentRenderTable(object,wrap);
  enhanceSpatialTableCells(object,wrap);
};

function enhanceSpatialShapeText(object,wrap) {
  if (!object || !['box','cloud'].includes(object.type) || !wrap) return;
  let text=$('.spatial-shape-text',wrap);
  if (!text) {
    text=document.createElement('div');
    text.className='spatial-shape-text';
    text.dataset.spatialShapeText='';
    wrap.appendChild(text);
  }
  text.textContent=object.text || '';
  const editable=typeof isCurrentNotebookPageEditable!=='function' || isCurrentNotebookPageEditable();
  text.contentEditable=editable?'true':'false';
  text.spellcheck=true;
  if (editable) {
    text.addEventListener('beforeinput',()=>notebookBeginTypingCheckpoint?.());
    text.addEventListener('input',()=>{
      object.text=text.textContent || '';
      object.updatedAt=new Date().toISOString();
      save();
    });
  }
}

function bindStickySpatialHover(wrap) {
  if (!wrap || wrap.dataset.stickyHoverBound) return;
  wrap.dataset.stickyHoverBound='1';
  let timer=null;
  const show=()=>{
    clearTimeout(timer);
    wrap.classList.add('hover-controls-visible');
  };
  const hide=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if (wrap.matches(':hover') || wrap.classList.contains('format-open')) return;
      wrap.classList.remove('hover-controls-visible');
    },700);
  };
  wrap.addEventListener('pointerenter',show);
  wrap.addEventListener('pointerleave',hide);
  $$('.spatial-object-format-toggle,.spatial-object-drag-handle,.spatial-object-format-toolbar',wrap).forEach(el=>{
    el.addEventListener('pointerenter',show);
    el.addEventListener('pointerleave',hide);
  });
}

const _salesShopSpatialContentRenderObject = renderSpatialObject;
renderSpatialObject = function(object,canvas) {
  _salesShopSpatialContentRenderObject(object,canvas);
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;
  enhanceSpatialShapeText(object,wrap);
  bindStickySpatialHover(wrap);
};

function spatialTextSelectionContext(selection=window.getSelection()) {
  if (!selection?.rangeCount || selection.isCollapsed) return null;
  const nodeElement=node=>node?.nodeType===Node.ELEMENT_NODE ? node : node?.parentElement;
  const start=nodeElement(selection.anchorNode)?.closest?.('.spatial-table td,.spatial-shape-text');
  const end=nodeElement(selection.focusNode)?.closest?.('.spatial-table td,.spatial-shape-text');
  if (!start || start!==end) return null;
  const text=selection.toString().trim();
  if (!text) return null;
  return {root:start,text,range:selection.getRangeAt(0).cloneRange()};
}

function showSpatialTextSelectionPopover() {
  clearTimeout(spatialSelectionPopoverTimer);
  spatialSelectionPopoverTimer=setTimeout(()=>{
    const ctx=spatialTextSelectionContext();
    if (!ctx) return;
    removeSelectionPopover();
    const rect=ctx.range.getBoundingClientRect();
    const pop=document.createElement('div');
    pop.id='selectionPopover';
    pop.className='selection-popover notebook-paper-popover spatial-selection-popover';
    pop.innerHTML='<button type="button" data-spatial-text-promote>Promote</button><button type="button" data-spatial-text-link>Link</button>';
    document.body.appendChild(pop);
    const width=pop.offsetWidth || 118;
    pop.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,rect.left))}px`;
    pop.style.top=`${Math.max(8,rect.top-(pop.offsetHeight||28)-6)}px`;
    $$('button',pop).forEach(button=>button.addEventListener('mousedown',event=>event.preventDefault()));
    $('[data-spatial-text-promote]',pop).onclick=()=>openPromoteModal(ctx.text,null);
    $('[data-spatial-text-link]',pop).onclick=()=>openLinkModal(ctx.text,null);
  },18);
}

if (!window.__salesShopSpatialTextSelection) {
  window.__salesShopSpatialTextSelection=true;
  document.addEventListener('pointerup',()=>{
    if (spatialTextSelectionContext()) showSpatialTextSelectionPopover();
  },true);
  document.addEventListener('selectionchange',()=>{
    if (spatialTextSelectionContext()) showSpatialTextSelectionPopover();
  });
}

function bindSingleClickSpatialWriting(root) {
  if (notebookPaperView?.()!=='grid') return;
  const canvas=$('.grid-notebook-canvas',root);
  if (!canvas || canvas.dataset.singleClickWriteBound) return;
  canvas.dataset.singleClickWriteBound='1';

  canvas.addEventListener('dblclick',event=>{
    if (event.target.closest('.grid-note,.grid-editor-wrap,.grid-history-rail,.notebook-spatial-object,.grid-cell-selection-toolbar')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);

  canvas.addEventListener('click',event=>{
    if (event.button!==0 || event.defaultPrevented) return;
    if (event.target.closest('.grid-note,.grid-editor-wrap,.grid-history-rail,.notebook-spatial-object,.grid-cell-selection-toolbar,.grid-cell-selection')) return;
    if (window.getSelection()?.toString().trim()) return;
    if (typeof isCurrentNotebookPageEditable==='function' && !isCurrentNotebookPageEditable()) return;
    const rect=canvas.getBoundingClientRect();
    const workspaceLeft=gridWorkspaceLeft?.(canvas) || 0;
    const step=notebookPaperRhythm?.() || 28;
    const x=event.clientX-rect.left-workspaceLeft;
    if (x<0) return;
    const col=Math.max(0,Math.floor(x/step));
    const row=Math.max(0,Math.floor((event.clientY-rect.top)/step));
    clearGridNoteSelection?.(canvas);
    openGridEditor(root,canvas,{col,row});
  });
}

const _salesShopSpatialContentRenderNotebook = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopSpatialContentRenderNotebook(root);
  if (!root) return;
  bindSingleClickSpatialWriting(root);
};
