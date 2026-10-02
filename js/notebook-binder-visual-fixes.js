/* Final visual/interaction fixes for Binder tabs, Medium toolbar, and spatial attachments. */

function notebookFixEntryById(id) {
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

function notebookFixRenderSpatialImages(root=$('#notebookDock')) {
  if (!root) return;
  $$('[data-entry-id]',root).forEach(container=>{
    if (container.querySelector('.notebook-attachment-image,.notebook-spatial-attachment-preview')) return;
    const entry=notebookFixEntryById(container.dataset.entryId);
    const attachment=entry?.attachment;
    if (!attachment?.dataUrl || !String(attachment.type||'').startsWith('image/')) return;

    const preview=document.createElement('figure');
    preview.className='notebook-spatial-attachment-preview';
    const image=document.createElement('img');
    image.className='notebook-spatial-attachment-image';
    image.src=attachment.dataUrl;
    image.alt=attachment.name||'Notebook image';
    image.draggable=false;
    const caption=document.createElement('figcaption');
    caption.textContent=attachment.name||'Image';
    preview.append(image,caption);

    const text=container.querySelector('.grid-note-text,.grid-history-text,.notebook-reference-entry-text,.entry-text');
    if (text && String(text.textContent||'').trim()===String(attachment.name||'').trim()) text.hidden=true;
    container.appendChild(preview);
    container.classList.add('has-spatial-image-attachment');
  });
}

async function notebookFixCompressedImageDataUrl(file) {
  if (!file || !String(file.type||'').startsWith('image/')) return '';
  if (file.size<=900*1024) {
    try { return await readFileAsDataURL(file); } catch { return ''; }
  }
  try {
    const raw=await readFileAsDataURL(file);
    const img=new Image();
    await new Promise((resolve,reject)=>{ img.onload=resolve;img.onerror=reject;img.src=raw; });
    const maxSide=1600;
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||1,img.naturalHeight||1));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round((img.naturalWidth||1)*scale));
    canvas.height=Math.max(1,Math.round((img.naturalHeight||1)*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let data=canvas.toDataURL('image/webp',.82);
    if (data.length>1800000) data=canvas.toDataURL('image/webp',.68);
    return data;
  } catch { return ''; }
}

if (typeof handleNotebookFiles==='function' && !window.__salesShopSpatialImageStorageFix) {
  window.__salesShopSpatialImageStorageFix=true;
  handleNotebookFiles=async function(files,key=dateKey(),pageId=null) {
    if (!files?.length) return;
    state.notebook[key] ||= [];
    const targetPageId=pageId || ensureNotebookPage(key);
    let optimized=0,metadataOnly=0;
    for (const file of files) {
      let dataUrl='';
      const isImage=String(file.type||'').startsWith('image/');
      if (isImage) {
        dataUrl=await notebookFixCompressedImageDataUrl(file);
        if (file.size>900*1024 && dataUrl) optimized++;
      } else if (file.size<=900*1024) {
        try { dataUrl=await readFileAsDataURL(file); } catch {}
      }
      if (!dataUrl) metadataOnly++;
      appendNotebookEntry(file.name,'attachment',key,targetPageId,{
        attachment:{name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl}
      });
    }
    save();
    renderAll();
    toast(metadataOnly ? 'Attached. Some large files are metadata only.' : optimized ? 'Attached · image optimized for notebook' : 'Attached');
  };
}

/* Current-page tabs are indicators, not commands. Hidden/open pages remain commands. */
if (typeof notebookBinderRailTab==='function' && !window.__salesShopCurrentBinderTabNoop) {
  window.__salesShopCurrentBinderTabNoop=true;
  const _notebookFixRailTab=notebookBinderRailTab;
  notebookBinderRailTab=function(ref,index,side,spread,active) {
    const button=_notebookFixRailTab(ref,index,side,spread,active);
    if (!button) return button;
    const isCurrent=!!active?.id && active.id===ref?.id;
    button.classList.toggle('current-page-tab',isCurrent);
    if (isCurrent) {
      button.setAttribute('aria-current','page');
      button.title=`${binderFluidTabTitle?.(ref)||button.title||'Current page'} — current`;
      button.onclick=event=>{ event.preventDefault();event.stopPropagation(); };
    }
    return button;
  };
}

function notebookFixPositionBinderRails(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  const pages=notebookBinderOpenPages?.() || [];
  if (pages.length<=1) return;
  installNotebookBinderDualRails?.(root);
  positionNotebookBinderRails?.(root);

  const left=$('.notebook-binder-side-rail-left',shell);
  const right=$('.notebook-binder-side-rail-right',shell);
  const page=$('.notebook-page-pair > .notebook-page',shell) || $('.notebook-page',shell);
  if (!left || !right || !page) return;
  const shellRect=shell.getBoundingClientRect();
  const pageRect=page.getBoundingClientRect();
  const lift=Math.max(0,pages.length-3)*60;
  const top=Math.max(8,Math.round(pageRect.top-shellRect.top+82-lift));
  left.style.top=right.style.top=`${top}px`;
}

function notebookFixMediumToolbar(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const toolbar=$('.notebook-toolbar',shell);
  if (!shell || !toolbar) return;
  const mode=typeof notebookWidthMode==='function' ? notebookWidthMode() : state.settings?.notebookWidthMode;
  const pair=$('.notebook-page-pair',shell);
  const visibleSheets=pair ? $$(':scope > .notebook-page,:scope > .notebook-reference-page',pair).filter(node=>node.getBoundingClientRect().width>0) : [$('.notebook-page',shell)].filter(Boolean);
  if (mode!=='medium' || visibleSheets.length!==1) {
    toolbar.style.removeProperty('width');
    toolbar.style.removeProperty('max-width');
    toolbar.style.removeProperty('margin-left');
    toolbar.style.removeProperty('margin-right');
    return;
  }
  const page=visibleSheets[0];
  const width=Math.round(page.getBoundingClientRect().width);
  if (!width) return;
  toolbar.style.setProperty('width',`${width}px`,'important');
  toolbar.style.setProperty('max-width',`${width}px`,'important');
  toolbar.style.setProperty('margin-left','auto','important');
  toolbar.style.setProperty('margin-right','auto','important');
}

function notebookFinalVisualFixes(root=$('#notebookDock')) {
  if (!root) return;
  notebookFixRenderSpatialImages(root);
  notebookFixPositionBinderRails(root);
  notebookFixMediumToolbar(root);
}

const _notebookVisualFixRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _notebookVisualFixRender(root);
  if (!root) return;
  notebookFinalVisualFixes(root);
  requestAnimationFrame(()=>notebookFinalVisualFixes(root));
};

if (!window.__salesShopNotebookVisualFixResize) {
  window.__salesShopNotebookVisualFixResize=true;
  let raf=0;
  const refresh=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>notebookFinalVisualFixes($('#notebookDock')));
  };
  window.addEventListener('resize',refresh,{passive:true});
  document.addEventListener('fullscreenchange',refresh);
  document.addEventListener('click',event=>{
    if (event.target?.closest?.('#notebookDock [data-notebook-width]')) setTimeout(refresh,0);
  },true);
}

requestAnimationFrame(()=>notebookFinalVisualFixes($('#notebookDock')));
