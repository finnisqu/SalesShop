/* Clean spatial extras: image previews/resizing and stored-source edit warning.
   No Binder, Reference, split-page, tab, or paper-layout behavior lives here. */

const notebookStoredInfoWarningsClean=new Set();

function notebookCleanEntryById(id) {
  if (!id) return null;
  if (typeof notebookEntryById==='function') {
    const found=notebookEntryById(id);
    if (found) return found;
  }
  for (const entries of Object.values(state.notebook||{})) {
    const found=(entries||[]).find(entry=>entry?.id===id);
    if (found) return found;
  }
  return null;
}
function notebookCleanStoredUses(entryId) {
  if (!entryId) return [];
  const collections=[['contact',state.contacts],['company',state.companies],['touchpoint',state.touchpoints],['reminder',state.reminders],['project',state.workItems],['update',state.projectUpdates]];
  const found=[];
  collections.forEach(([kind,items])=>(items||[]).forEach(item=>{ if (item?.sourceEntryId===entryId) found.push({kind,item}); }));
  return found;
}
function notebookCleanConfirmStoredEdit(entry,event) {
  const uses=notebookCleanStoredUses(entry?.id);
  if (!uses.length || notebookStoredInfoWarningsClean.has(entry.id)) return true;
  const kinds=[...new Set(uses.map(use=>use.kind))].join(', ');
  const ok=window.confirm(`This note has already been promoted or linked (${kinds}). Editing the notebook text will not rewrite the stored record. Continue?`);
  if (!ok) { event?.preventDefault?.();event?.stopImmediatePropagation?.();return false; }
  notebookStoredInfoWarningsClean.add(entry.id);
  toast?.('Editing source note · stored records stay unchanged');
  return true;
}
function notebookCleanStoredMarker(row,entry) {
  const uses=notebookCleanStoredUses(entry?.id);
  const existing=$('.notebook-stored-source-marker',row);
  if (!uses.length) { existing?.remove();return; }
  if (existing) return;
  const marker=document.createElement('span');
  marker.className='notebook-stored-source-marker';
  marker.textContent='↗';
  marker.title='This note has been promoted or linked to stored information';
  marker.setAttribute('aria-label',marker.title);
  row.appendChild(marker);
}
function notebookCleanBindStoredWarnings(root=$('#notebookDock')) {
  if (!root) return;
  $$('[data-entry-id]',root).forEach(row=>{
    const entry=notebookCleanEntryById(row.dataset.entryId);
    if (!entry) return;
    notebookCleanStoredMarker(row,entry);
    if (!notebookCleanStoredUses(entry.id).length || row.dataset.storedInfoGuardBound) return;
    row.dataset.storedInfoGuardBound='1';
    row.addEventListener('beforeinput',event=>notebookCleanConfirmStoredEdit(entry,event),true);
    row.addEventListener('dblclick',event=>notebookCleanConfirmStoredEdit(entry,event),true);
  });
}

/* Timer-based soft locks are retired. */
window.notebookTextIsSoftLocked=function(){ return false; };
window.scheduleNotebookSoftLocks=function(){};
window.decorateNotebookTextLocks=function(root) {
  if (!root) return;
  $$('.notebook-text-lock',root).forEach(node=>node.remove());
  $$('.notebook-text-softlocked',root).forEach(node=>node.classList.remove('notebook-text-softlocked','notebook-text-lock-nudge'));
  $$('[data-entry-id]',root).forEach(row=>row.classList.add('notebook-text-softunlocked'));
};

function notebookCleanSyncGridExtent(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-page.paper-grid',root).forEach(page=>{
    const body=$('.notebook-page-body',page);
    const canvas=$('.grid-notebook-canvas',page);
    if (!body || !canvas) return;
    let right=Math.max(canvas.scrollWidth,canvas.offsetWidth,page.clientWidth);
    let bottom=Math.max(canvas.scrollHeight,canvas.offsetHeight,page.clientHeight);
    const canvasRect=canvas.getBoundingClientRect();
    $$('.grid-note,.grid-editor-wrap,.notebook-spatial-object,.spatial-object-table',canvas).forEach(node=>{
      const rect=node.getBoundingClientRect();
      right=Math.max(right,rect.right-canvasRect.left+56);
      bottom=Math.max(bottom,rect.bottom-canvasRect.top+56);
    });
    const width=Math.ceil(Math.max(page.clientWidth,right));
    const height=Math.ceil(Math.max(page.clientHeight,bottom));
    canvas.style.minWidth=`${width}px`;
    body.style.minWidth=`${width}px`;
    body.style.minHeight=`${height}px`;
  });
}

function notebookCleanBindSpatialImage(container,entry,preview) {
  if (!container || !entry?.attachment || !preview) return;
  const spatial=container.classList.contains('grid-note');
  const saved=Math.max(80,Math.min(640,Number(entry.attachment.displayWidth)||220));
  preview.style.setProperty('--spatial-image-width',`${saved}px`);
  container.style.setProperty('--spatial-image-width',`${saved}px`);
  if (!spatial) return;
  container.classList.add('notebook-spatial-image-object');
  const grab=typeof ensureGridGrabHandle==='function'?ensureGridGrabHandle(container):$('.grid-grab-handle',container);
  if (grab) { grab.title='Drag to move image';grab.setAttribute('aria-label','Move image'); }
  let handle=$('.notebook-spatial-image-resize',preview);
  if (!handle) {
    handle=document.createElement('button');
    handle.type='button';handle.className='notebook-spatial-image-resize';handle.title='Drag to resize image';handle.setAttribute('aria-label','Resize image');handle.innerHTML='<span aria-hidden="true"></span>';
    preview.appendChild(handle);
  }
  if (handle.dataset.resizeBound) return;
  handle.dataset.resizeBound='1';
  handle.addEventListener('pointerdown',event=>{
    if (event.button!==0) return;
    event.preventDefault();event.stopPropagation();
    const startX=event.clientX;
    const startWidth=Math.max(80,preview.getBoundingClientRect().width||saved);
    let next=startWidth;
    container.classList.add('is-resizing-image','is-selected');
    const move=ev=>{
      ev.preventDefault();
      next=Math.max(80,Math.min(640,startWidth+(ev.clientX-startX)));
      preview.style.setProperty('--spatial-image-width',`${Math.round(next)}px`);
      container.style.setProperty('--spatial-image-width',`${Math.round(next)}px`);
    };
    const up=()=>{
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',up);
      document.removeEventListener('pointercancel',up);
      container.classList.remove('is-resizing-image');
      entry.attachment.displayWidth=Math.round(next);
      entry.updatedAt=typeof nowISO==='function'?nowISO():new Date().toISOString();
      save();notebookCleanSyncGridExtent($('#notebookDock'));
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',up,{once:true});
    document.addEventListener('pointercancel',up,{once:true});
  });
}
function notebookCleanRenderSpatialImages(root=$('#notebookDock')) {
  if (!root) return;
  $$('[data-entry-id]',root).forEach(container=>{
    const entry=notebookCleanEntryById(container.dataset.entryId);
    const attachment=entry?.attachment;
    if (!attachment?.dataUrl || !String(attachment.type||'').startsWith('image/')) return;
    let preview=$('.notebook-spatial-attachment-preview',container);
    if (!preview) {
      preview=document.createElement('figure');preview.className='notebook-spatial-attachment-preview';
      const image=document.createElement('img');image.className='notebook-spatial-attachment-image';image.src=attachment.dataUrl;image.alt=attachment.name||'Notebook image';image.draggable=false;
      const caption=document.createElement('figcaption');caption.textContent=attachment.name||'Image';
      preview.append(image,caption);
      const text=container.querySelector('.grid-note-text,.grid-history-text,.entry-text');
      if (text && String(text.textContent||'').trim()===String(attachment.name||'').trim()) text.hidden=true;
      container.appendChild(preview);container.classList.add('has-spatial-image-attachment');
    }
    notebookCleanBindSpatialImage(container,entry,preview);
  });
}

async function notebookCleanCompressedImageDataUrl(file) {
  if (!file || !String(file.type||'').startsWith('image/')) return '';
  if (file.size<=900*1024) { try { return await readFileAsDataURL(file); } catch { return ''; } }
  try {
    const raw=await readFileAsDataURL(file);
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=raw;});
    const maxSide=1600;
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||1,img.naturalHeight||1));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round((img.naturalWidth||1)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||1)*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    let data=canvas.toDataURL('image/webp',.82);
    if (data.length>1800000) data=canvas.toDataURL('image/webp',.68);
    return data;
  } catch { return ''; }
}
if (typeof handleNotebookFiles==='function') {
  handleNotebookFiles=async function(files,key=dateKey(),pageId=null) {
    if (!files?.length) return;
    state.notebook[key] ||= [];
    const targetPageId=pageId || ensureNotebookPage(key);
    let optimized=0,metadataOnly=0;
    for (const file of files) {
      let dataUrl='';
      const isImage=String(file.type||'').startsWith('image/');
      if (isImage) { dataUrl=await notebookCleanCompressedImageDataUrl(file);if (file.size>900*1024&&dataUrl) optimized++; }
      else if (file.size<=900*1024) { try { dataUrl=await readFileAsDataURL(file); } catch {} }
      if (!dataUrl) metadataOnly++;
      appendNotebookEntry(file.name,'attachment',key,targetPageId,{attachment:{name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl,displayWidth:220}});
    }
    save();renderAll();
    toast(metadataOnly?'Attached. Some large files are metadata only.':optimized?'Attached · image optimized for notebook':'Attached');
  };
}

function notebookCleanSpatialExtras(root=$('#notebookDock')) {
  if (!root) return;
  decorateNotebookTextLocks(root);
  notebookCleanBindStoredWarnings(root);
  notebookCleanRenderSpatialImages(root);
  notebookCleanSyncGridExtent(root);
}
const _cleanSpatialRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _cleanSpatialRenderNotebook(root);
  if (!root) return;
  notebookCleanSpatialExtras(root);
  requestAnimationFrame(()=>notebookCleanSpatialExtras(root));
};
