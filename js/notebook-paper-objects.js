/* Paper-native notebook objects: Post-it notes + softer annotation shapes.
   This is a feature layer, not a Binder/layout override. The spatial lattice remains the storage
   skeleton while paper objects are allowed to feel looser and more physical on top of it. */

const NOTEBOOK_POSTIT_COLORS = new Set(['yellow','blue','mint','rose']);
const NOTEBOOK_ANNOTATION_TYPES = new Set(['box','cloud','oval','arrow','stop']);
const NOTEBOOK_ANNOTATION_STYLES = new Set(['pencil','sticky']);
let paperObjectPendingFocusId = null;

function paperObjectStampRotation(id='') {
  const sum=String(id).split('').reduce((total,char)=>total+char.charCodeAt(0),0);
  return (((sum % 9)-4)*0.24).toFixed(2);
}

function paperAnnotationStyle(object) {
  if (!object) return 'pencil';
  if (NOTEBOOK_ANNOTATION_STYLES.has(object.annotationStyle)) return object.annotationStyle;
  return (object.type==='arrow' || object.type==='stop') ? 'sticky' : 'pencil';
}

function paperAnnotationTone(object) {
  if (object?.type==='stop') return 'red';
  if (object?.type==='arrow') return 'yellow';
  return object?.annotationTone || 'yellow';
}

/* --- Creation --------------------------------------------------------------------------- */
const _paperObjectsCreateSpatialObject = createSpatialObject;
createSpatialObject = function(type,bounds) {
  if (type !== 'postit') return _paperObjectsCreateSpatialObject(type,bounds);
  if (!bounds) return;

  notebookPushUndoCheckpoint?.();
  const object={
    id:uid('spatial'),
    type:'postit',
    col:Math.max(0,Number(bounds.col)||0),
    row:Math.max(0,Number(bounds.row)||0),
    cols:Math.max(4,Math.round(Number(bounds.cols)||1)),
    rows:Math.max(4,Math.round(Number(bounds.rows)||1)),
    text:'',
    postitColor:'yellow',
    rotation:Number(paperObjectStampRotation(String(Date.now())+Math.random())),
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  spatialObjects().push(object);
  selectedSpatialObjectId=object.id;
  paperObjectPendingFocusId=object.id;
  save();
  clearSpatialSelection?.();
  renderAll();
};

/* The Grid marquee remains a single compact + flyout. Post-it joins Table and Annotation rather
   than creating another permanent toolbar. */
if (typeof drawSpatialSelection==='function') {
  const _paperObjectsDrawSpatialSelection=drawSpatialSelection;
  drawSpatialSelection=function(canvas,bounds,{toolbar=false}={}) {
    _paperObjectsDrawSpatialSelection(canvas,bounds,{toolbar:false});
    if (!toolbar) return;
    $('.grid-cell-selection-toolbar',canvas)?.remove();

    const controls=document.createElement('div');
    controls.className='grid-cell-selection-toolbar grid-create-control paper-object-create-control';
    controls.style.setProperty('--select-col',bounds.col);
    controls.style.setProperty('--select-row',bounds.row);
    controls.innerHTML=`
      <button type="button" class="grid-create-trigger" data-compact-flyout-trigger title="Create object" aria-label="Create object">+</button>
      <span class="grid-create-panel">
        <button type="button" data-spatial-create="table" title="Table" aria-label="Table"><span class="grid-create-table-icon" aria-hidden="true"></span></button>
        <button type="button" data-spatial-create="box" title="Annotation" aria-label="Annotation"><span class="grid-create-shape-icon paper-annotation-icon" aria-hidden="true"></span></button>
        <button type="button" data-spatial-create="postit" title="Post-it note" aria-label="Post-it note"><span class="grid-create-postit-icon" aria-hidden="true"></span></button>
      </span>`;
    canvas.appendChild(controls);
    $$('[data-spatial-create]',controls).forEach(button=>button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      createSpatialObject(button.dataset.spatialCreate,bounds);
    });
    bindCompactFlyout?.(controls);
    orientUnifiedFlyout?.(controls);
  };
}

/* --- Annotation family ------------------------------------------------------------------ */
setSpatialShapeType=function(object,type) {
  if (!object || !NOTEBOOK_ANNOTATION_TYPES.has(type) || object.type===type) return;
  notebookPushUndoCheckpoint?.();
  object.type=type;
  if ((type==='arrow' || type==='stop') && !NOTEBOOK_ANNOTATION_STYLES.has(object.annotationStyle)) {
    object.annotationStyle='sticky';
  }
  if (type==='stop') object.annotationTone='red';
  else if (type==='arrow' && !object.annotationTone) object.annotationTone='yellow';
  object.updatedAt=new Date().toISOString();
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  save();
  renderAll();
};

function setPaperAnnotationStyle(object,style) {
  if (!object || !NOTEBOOK_ANNOTATION_STYLES.has(style) || paperAnnotationStyle(object)===style) return;
  notebookPushUndoCheckpoint?.();
  object.annotationStyle=style;
  object.updatedAt=new Date().toISOString();
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  save();
  renderAll();
}

function paperAnnotationShapeButton(type,label,title,object) {
  return `<button type="button" data-shape-type="${type}" class="${object.type===type?'active':''}" title="${title}">${label}</button>`;
}

spatialShapeToolbar=function(object) {
  const toolbar=document.createElement('div');
  const style=paperAnnotationStyle(object);
  toolbar.className='spatial-shape-toolbar spatial-object-format-toolbar paper-annotation-toolbar';
  toolbar.innerHTML=`
    ${paperAnnotationShapeButton('box','Box','Sketch box',object)}
    ${paperAnnotationShapeButton('cloud','Cloud','Cloud callout',object)}
    ${paperAnnotationShapeButton('oval','Oval','Oval callout',object)}
    ${paperAnnotationShapeButton('arrow','Arrow','Pointed arrow label',object)}
    ${paperAnnotationShapeButton('stop','Stop','Red stop-sign annotation',object)}
    <span class="spatial-table-control-separator"></span>
    <button type="button" data-annotation-style="pencil" class="paper-annotation-style ${style==='pencil'?'active':''}" title="Pencil outline">Pencil</button>
    <button type="button" data-annotation-style="sticky" class="paper-annotation-style ${style==='sticky'?'active':''}" title="Sticky annotation">Sticker</button>
    <span class="spatial-table-control-separator"></span>
    <button type="button" data-shape-delete class="notebook-toolbar-delete" title="Delete annotation" aria-label="Delete annotation">×</button>`;
  $$('[data-shape-type]',toolbar).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    setSpatialShapeType(object,button.dataset.shapeType);
  });
  $$('[data-annotation-style]',toolbar).forEach(button=>button.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    setPaperAnnotationStyle(object,button.dataset.annotationStyle);
  });
  $('[data-shape-delete]',toolbar).onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    removeSpatialObject(object.id);
  };
  return toolbar;
};

function paperPostitToolbar(object) {
  const toolbar=document.createElement('div');
  toolbar.className='spatial-shape-toolbar spatial-postit-toolbar spatial-object-format-toolbar';
  const active=NOTEBOOK_POSTIT_COLORS.has(object.postitColor) ? object.postitColor : 'yellow';
  ['yellow','blue','mint','rose'].forEach(color=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`spatial-postit-color ${color===active?'active':''}`;
    button.dataset.postitColor=color;
    button.title=`${color[0].toUpperCase()+color.slice(1)} note`;
    button.setAttribute('aria-label',button.title);
    button.innerHTML=`<span class="postit-color-swatch swatch-${color}" aria-hidden="true"></span>`;
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      notebookPushUndoCheckpoint?.();
      object.postitColor=color;
      object.updatedAt=new Date().toISOString();
      selectedSpatialObjectId=object.id;
      if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
      save();
      renderAll();
    };
    toolbar.appendChild(button);
  });
  const separator=document.createElement('span');
  separator.className='spatial-table-control-separator';
  const del=document.createElement('button');
  del.type='button';
  del.className='notebook-toolbar-delete';
  del.title='Delete Post-it';
  del.setAttribute('aria-label','Delete Post-it');
  del.textContent='×';
  del.onclick=event=>{
    event.preventDefault();
    event.stopPropagation();
    removeSpatialObject(object.id);
  };
  toolbar.append(separator,del);
  return toolbar;
}

const _paperObjectsInstallHoverUI=installSpatialObjectHoverUI;
installSpatialObjectHoverUI=function(object,canvas) {
  _paperObjectsInstallHoverUI(object,canvas);
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;
  if (NOTEBOOK_ANNOTATION_TYPES.has(object.type) && !$('.spatial-shape-toolbar',wrap)) wrap.appendChild(spatialShapeToolbar(object));
  if (object.type==='postit' && !$('.spatial-postit-toolbar',wrap)) wrap.appendChild(paperPostitToolbar(object));
};

/* --- Text ------------------------------------------------------------------------------- */
enhanceSpatialShapeText=function(object,wrap) {
  if (!object || !(NOTEBOOK_ANNOTATION_TYPES.has(object.type) || object.type==='postit') || !wrap) return;
  let host=wrap;
  if (object.type==='postit') {
    host=$('.spatial-postit-paper',wrap);
    if (!host) {
      host=document.createElement('div');
      host.className='spatial-postit-paper';
      wrap.prepend(host);
    }
  }

  let text=$('.spatial-shape-text',host);
  if (!text) {
    text=document.createElement('div');
    text.className=`spatial-shape-text${object.type==='postit'?' spatial-postit-text':''}`;
    text.dataset.spatialShapeText='';
    host.appendChild(text);
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
};

/* --- Resizing --------------------------------------------------------------------------- */
const _paperObjectsInstallShapeResizeHandles=installShapeResizeHandles;
installShapeResizeHandles=function(object,wrap) {
  if (!object || !wrap) return;
  if (object.type==='box' || object.type==='cloud') return _paperObjectsInstallShapeResizeHandles(object,wrap);
  if (!['oval','arrow','stop','postit'].includes(object.type) || $('.spatial-resize-handle',wrap)) return;
  const editable=typeof isCurrentNotebookPageEditable!=='function' || isCurrentNotebookPageEditable();
  if (!editable) return;

  const minCols=object.type==='postit'?3:(object.type==='arrow'?3:2);
  const minRows=object.type==='postit'?3:2;
  ['n','e','s','w'].forEach(direction=>{
    const handle=document.createElement('button');
    handle.type='button';
    handle.className=`spatial-resize-handle spatial-resize-${direction}`;
    handle.dataset.resizeDirection=direction;
    handle.title='Drag to resize';
    handle.setAttribute('aria-label',`Resize ${direction}`);
    handle.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      event.preventDefault();
      event.stopPropagation();
      closeActiveGridWritingMode?.();
      const step=spatialStep?.() || 28;
      const startX=event.clientX,startY=event.clientY;
      const start={
        col:Math.max(0,Number(object.col)||0),
        row:Math.max(0,Number(object.row)||0),
        cols:Math.max(minCols,Number(object.cols)||minCols),
        rows:Math.max(minRows,Number(object.rows)||minRows)
      };
      let next={...start};
      let checkpointed=false;
      handle.setPointerCapture?.(event.pointerId);
      selectedSpatialObjectId=object.id;
      wrap.classList.add('is-selected','is-resizing');

      const onMove=ev=>{
        const dc=Math.round((ev.clientX-startX)/step);
        const dr=Math.round((ev.clientY-startY)/step);
        next={...start};
        if (direction==='e') next.cols=Math.max(minCols,start.cols+dc);
        if (direction==='s') next.rows=Math.max(minRows,start.rows+dr);
        if (direction==='w') {
          const right=start.col+start.cols;
          next.col=Math.max(0,Math.min(right-minCols,start.col+dc));
          next.cols=right-next.col;
        }
        if (direction==='n') {
          const bottom=start.row+start.rows;
          next.row=Math.max(0,Math.min(bottom-minRows,start.row+dr));
          next.rows=bottom-next.row;
        }
        if (!checkpointed && (next.col!==start.col||next.row!==start.row||next.cols!==start.cols||next.rows!==start.rows)) {
          checkpointed=true;
          notebookPushUndoCheckpoint?.();
        }
        wrap.style.setProperty('--object-col',next.col);
        wrap.style.setProperty('--object-row',next.row);
        wrap.style.setProperty('--object-cols',next.cols);
        wrap.style.setProperty('--object-rows',next.rows);
      };
      const onUp=()=>{
        document.removeEventListener('pointermove',onMove);
        document.removeEventListener('pointerup',onUp);
        document.removeEventListener('pointercancel',onUp);
        wrap.classList.remove('is-resizing');
        if (!checkpointed) return;
        Object.assign(object,next,{updatedAt:new Date().toISOString()});
        save();
        renderAll();
      };
      document.addEventListener('pointermove',onMove,{passive:false});
      document.addEventListener('pointerup',onUp,{once:true});
      document.addEventListener('pointercancel',onUp,{once:true});
    });
    wrap.appendChild(handle);
  });
};

/* --- Final paper decoration -------------------------------------------------------------- */
const _paperObjectsRenderSpatialObject=renderSpatialObject;
renderSpatialObject=function(object,canvas) {
  _paperObjectsRenderSpatialObject(object,canvas);
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;

  if (object.type==='postit') {
    object.postitColor=NOTEBOOK_POSTIT_COLORS.has(object.postitColor)?object.postitColor:'yellow';
    if (!Number.isFinite(Number(object.rotation))) object.rotation=Number(paperObjectStampRotation(object.id));
    wrap.dataset.postitColor=object.postitColor;
    wrap.style.setProperty('--postit-rotation',`${Number(object.rotation)||0}deg`);
    enhanceSpatialShapeText(object,wrap);
  }

  if (NOTEBOOK_ANNOTATION_TYPES.has(object.type)) {
    wrap.dataset.annotationStyle=paperAnnotationStyle(object);
    wrap.dataset.annotationTone=paperAnnotationTone(object);
    enhanceSpatialShapeText(object,wrap);
  }

  if (object.type==='cloud') {
    const svg=$('.spatial-cloud-svg',wrap);
    const path=svg?.querySelector('path:not(.spatial-pencil-echo)');
    if (svg && path && !svg.querySelector('.spatial-pencil-echo')) {
      const echo=path.cloneNode(true);
      echo.classList.add('spatial-pencil-echo');
      svg.insertBefore(echo,path);
    }
  }

  if (paperObjectPendingFocusId===object.id) {
    paperObjectPendingFocusId=null;
    requestAnimationFrame(()=>{
      const text=$('.spatial-shape-text',wrap);
      if (!text || text.getAttribute('contenteditable')==='false') return;
      text.focus({preventScroll:true});
      const range=document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      const selection=window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }
};
