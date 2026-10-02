/* Final Binder / spatial behavior layer.
   One top tab bar owns up to six open pages. Single/Double is an explicit presentation choice.
   Hidden pages remain physically represented as colored paper layers around the visible sheet(s). */

const NOTEBOOK_BINDER_UI_MAX = 6;
const notebookStoredInfoWarnings = new Set();

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

/* --------------------------------------------------------------------------
   Ordinary notebook content is fluid again. Only content that has already
   become a CRM source gets a one-time edit warning in the current session.
   -------------------------------------------------------------------------- */
function notebookFixStoredUses(entryId) {
  if (!entryId) return [];
  const collections=[
    ['contact',state.contacts],['company',state.companies],['touchpoint',state.touchpoints],
    ['reminder',state.reminders],['project',state.workItems],['update',state.projectUpdates]
  ];
  const found=[];
  collections.forEach(([kind,items])=>(items||[]).forEach(item=>{
    if (item?.sourceEntryId===entryId) found.push({kind,item});
  }));
  return found;
}

/* Earlier soft-lock wrappers resolve these globals at render/edit time, so replacing them here
   removes timer-based locking without having to unwind the legacy wrapper chain. */
notebookTextIsSoftLocked=function(){ return false; };
scheduleNotebookSoftLocks=function(){
  try { clearTimeout(notebookSoftLockTimer); } catch {}
};
decorateNotebookTextLocks=function(root) {
  if (!root) return;
  $$('.notebook-text-lock',root).forEach(node=>node.remove());
  $$('.notebook-text-softlocked',root).forEach(node=>node.classList.remove('notebook-text-softlocked','notebook-text-lock-nudge'));
  $$('[data-entry-id]',root).forEach(row=>row.classList.add('notebook-text-softunlocked'));
};

function notebookFixStoredInfoMarker(row,entry) {
  if (!row || !entry) return;
  const uses=notebookFixStoredUses(entry.id);
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

function notebookFixConfirmStoredEdit(entry,event) {
  const uses=notebookFixStoredUses(entry?.id);
  if (!uses.length || notebookStoredInfoWarnings.has(entry.id)) return true;
  const kinds=[...new Set(uses.map(use=>use.kind))].join(', ');
  const ok=window.confirm(`This note has already been promoted or linked (${kinds}). Editing the notebook text will not rewrite the stored record. Continue?`);
  if (!ok) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    return false;
  }
  notebookStoredInfoWarnings.add(entry.id);
  toast?.('Editing source note · stored records stay unchanged');
  return true;
}

function notebookFixBindStoredInfoWarnings(root=$('#notebookDock')) {
  if (!root) return;
  $$('[data-entry-id]',root).forEach(row=>{
    const entry=notebookFixEntryById(row.dataset.entryId);
    if (!entry) return;
    notebookFixStoredInfoMarker(row,entry);
    if (!notebookFixStoredUses(entry.id).length || row.dataset.storedInfoGuardBound) return;
    row.dataset.storedInfoGuardBound='1';
    row.addEventListener('beforeinput',event=>notebookFixConfirmStoredEdit(entry,event),true);
    row.addEventListener('dblclick',event=>notebookFixConfirmStoredEdit(entry,event),true);
  });
}

/* --------------------------------------------------------------------------
   Spatial images: preview + existing grid grab handle for movement + a quiet
   bottom-right resize handle. Width is page-entry metadata and survives reload.
   -------------------------------------------------------------------------- */
function notebookFixBindSpatialImageObject(container,entry,preview,image) {
  if (!container || !entry?.attachment || !preview || !image) return;
  const spatial=container.classList.contains('grid-note');
  const saved=Math.max(80,Math.min(640,Number(entry.attachment.displayWidth)||220));
  preview.style.setProperty('--spatial-image-width',`${saved}px`);
  container.style.setProperty('--spatial-image-width',`${saved}px`);
  if (!spatial) return;

  container.classList.add('notebook-spatial-image-object');
  const grab=typeof ensureGridGrabHandle==='function' ? ensureGridGrabHandle(container) : $('.grid-grab-handle',container);
  if (grab) {
    grab.title='Drag to move image';
    grab.setAttribute('aria-label','Move image');
  }

  let handle=$('.notebook-spatial-image-resize',preview);
  if (!handle) {
    handle=document.createElement('button');
    handle.type='button';
    handle.className='notebook-spatial-image-resize';
    handle.title='Drag to resize image';
    handle.setAttribute('aria-label','Resize image');
    handle.innerHTML='<span aria-hidden="true"></span>';
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
    handle.setPointerCapture?.(event.pointerId);
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
      save();
      binderFluidSyncGridExtent?.($('#notebookDock'));
    };
    document.addEventListener('pointermove',move,{passive:false});
    document.addEventListener('pointerup',up,{once:true});
    document.addEventListener('pointercancel',up,{once:true});
  });
}

function notebookFixRenderSpatialImages(root=$('#notebookDock')) {
  if (!root) return;
  $$('[data-entry-id]',root).forEach(container=>{
    const entry=notebookFixEntryById(container.dataset.entryId);
    const attachment=entry?.attachment;
    if (!attachment?.dataUrl || !String(attachment.type||'').startsWith('image/')) return;

    let preview=$('.notebook-spatial-attachment-preview',container);
    let image=preview ? $('.notebook-spatial-attachment-image',preview) : null;
    if (!preview) {
      preview=document.createElement('figure');
      preview.className='notebook-spatial-attachment-preview';
      image=document.createElement('img');
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
    }
    notebookFixBindSpatialImageObject(container,entry,preview,image);
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
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
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
        attachment:{name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl,displayWidth:220}
      });
    }
    save();renderAll();
    toast(metadataOnly ? 'Attached. Some large files are metadata only.' : optimized ? 'Attached · image optimized for notebook' : 'Attached');
  };
}

/* --------------------------------------------------------------------------
   Binder state: six open pages max, with open pages independent of the one/two
   visible sheets. The top tab order is the physical order of the Binder.
   -------------------------------------------------------------------------- */
notebookBinderOpenPages=function() {
  state.settings ||= {};
  const current=binderNormalizeRef?.({key:currentNotebookDate,pageId:currentNotebookPageId});
  let raw=Array.isArray(state.settings.notebookBinderOpenPages) ? state.settings.notebookBinderOpenPages : [];
  let pages=raw.map(ref=>binderNormalizeRef?.(ref)).filter(Boolean);

  if (!pages.length) {
    const oldOrder=Array.isArray(state.settings.notebookOpenPageOrder) ? state.settings.notebookOpenPageOrder : [];
    pages=oldOrder.map(id=>binderRefFromId?.(id)).filter(Boolean);
    const legacy=binderNormalizeRef?.(state.settings.notebookReferencePage);
    if (legacy && !pages.some(page=>page.id===legacy.id)) pages.push(legacy);
  }
  if (current && !pages.some(page=>page.id===current.id)) pages.unshift(current);
  const seen=new Set();
  pages=pages.filter(page=>page?.id && !seen.has(page.id) && seen.add(page.id)).slice(0,NOTEBOOK_BINDER_UI_MAX);
  if (!pages.length && current) pages=[current];
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  return pages;
};

function notebookBinderDisplayMode() {
  state.settings ||= {};
  let mode=state.settings.notebookBinderDisplayMode;
  if (mode!=='single' && mode!=='double') {
    mode=(Array.isArray(state.settings.notebookBinderSpread) && state.settings.notebookBinderSpread.length>1) ? 'double' : 'single';
    state.settings.notebookBinderDisplayMode=mode;
  }
  const width=typeof notebookWidthMode==='function' ? notebookWidthMode() : state.settings.notebookWidthMode;
  if (width==='float' || width==='dock-left') return 'single';
  return mode;
}

function notebookBinderNeighbor(active,pages) {
  if (!active || pages.length<2) return pages.find(page=>page.id!==active?.id) || null;
  const index=Math.max(0,pages.findIndex(page=>page.id===active.id));
  return pages[index+1] || pages[index-1] || pages.find(page=>page.id!==active.id) || null;
}

notebookBinderSpread=function() {
  state.settings ||= {};
  const pages=notebookBinderOpenPages();
  const ids=new Set(pages.map(page=>page.id));
  const active=notebookBinderActiveRef?.() || pages[0] || null;
  let spread=Array.isArray(state.settings.notebookBinderSpread)
    ? state.settings.notebookBinderSpread.filter(id=>id&&ids.has(id)) : [];
  spread=[...new Set(spread)].slice(0,2);

  if (notebookBinderDisplayMode()==='single' || pages.length<2) {
    const id=active?.id && ids.has(active.id) ? active.id : spread[0] || pages[0]?.id;
    spread=id?[id]:[];
  } else {
    if (active?.id && !spread.includes(active.id)) {
      const side=state.settings.notebookBinderActiveSide==='right'?1:0;
      if (spread.length<2) spread.push(active.id);
      else spread[side]=active.id;
    }
    if (spread.length<2) {
      const neighbor=notebookBinderNeighbor(active,pages);
      if (neighbor && !spread.includes(neighbor.id)) spread.push(neighbor.id);
    }
    pages.forEach(page=>{ if (spread.length<2 && !spread.includes(page.id)) spread.push(page.id); });
    const order=new Map(pages.map((page,index)=>[page.id,index]));
    spread=[...new Set(spread)].sort((a,b)=>(order.get(a)??99)-(order.get(b)??99)).slice(0,2);
  }
  state.settings.notebookBinderSpread=spread;
  if (active?.id && spread.includes(active.id)) state.settings.notebookBinderActiveSide=spread.indexOf(active.id)===1?'right':'left';
  return spread;
};

function notebookFixSetActiveRef(ref,{record=true,side=null}={}) {
  ref=binderNormalizeRef?.(ref);
  if (!ref) return;
  const pages=notebookBinderOpenPages();
  if (!pages.some(page=>page.id===ref.id)) return;
  let spread=[...(notebookBinderSpread?.()||[])];
  const mode=notebookBinderDisplayMode();

  if (mode==='single') spread=[ref.id];
  else if (!spread.includes(ref.id)) {
    const target=side==='right'?1:0;
    if (spread.length<2) {
      if (!spread.length) spread=[ref.id];
      else spread=target===0?[ref.id,spread[0]]:[spread[0],ref.id];
    } else spread[target]=ref.id;
  }
  state.settings.notebookBinderSpread=[...new Set(spread.filter(Boolean))].slice(0,2);
  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:'binder-tab'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  const final=state.settings.notebookBinderSpread;
  state.settings.notebookBinderActiveSide=final.indexOf(ref.id)===1?'right':'left';
  syncNotebookBinderLegacyState?.({persist:true});
  markBinderTurn?.(ref,state.settings.notebookBinderActiveSide);
  renderAll();
}

function notebookFixTabSide(index,pages) {
  return index<Math.ceil(pages.length/2)?'left':'right';
}

function notebookFixActivateTab(ref,index) {
  const active=notebookBinderActiveRef?.();
  if (active?.id===ref.id) return; // current tab is intentionally inert
  const spread=notebookBinderSpread?.()||[];
  if (spread.includes(ref.id)) return notebookFixSetActiveRef(ref,{record:true});
  const pages=notebookBinderOpenPages();
  notebookFixSetActiveRef(ref,{record:true,side:notebookFixTabSide(index,pages)});
}

function setNotebookBinderDisplayMode(mode) {
  state.settings ||= {};
  mode=mode==='double'?'double':'single';
  const pages=notebookBinderOpenPages();
  const active=notebookBinderActiveRef?.() || pages[0];
  if (mode==='double' && pages.length<2) return toast?.('Open another page before using two-page view.');
  state.settings.notebookBinderDisplayMode=mode;
  if (mode==='single') state.settings.notebookBinderSpread=active?[active.id]:[];
  else {
    const neighbor=notebookBinderNeighbor(active,pages);
    const ids=[active?.id,neighbor?.id].filter(Boolean);
    const order=new Map(pages.map((page,index)=>[page.id,index]));
    state.settings.notebookBinderSpread=ids.sort((a,b)=>(order.get(a)??99)-(order.get(b)??99));
  }
  syncNotebookBinderLegacyState?.({persist:true});
  renderAll();
}

openNotebookPageInBinder=function(key,pageId) {
  const ref=binderNormalizeRef?.({key,pageId});
  if (!ref) return;
  let pages=notebookBinderOpenPages();
  const existingIndex=pages.findIndex(page=>page.id===ref.id);
  closeModal?.();
  if (existingIndex>=0) return notebookFixActivateTab(pages[existingIndex],existingIndex);
  if (pages.length>=NOTEBOOK_BINDER_UI_MAX) return toast?.(`Binder can hold up to ${NOTEBOOK_BINDER_UI_MAX} open pages.`);
  pages.push(ref);
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  save();
  notebookFixActivateTab(ref,pages.length-1);
};
setNotebookReferencePage=function(key,pageId){ openNotebookPageInBinder(key,pageId); };

function notebookFixReorderTabs(sourceId,targetId) {
  if (!sourceId || !targetId || sourceId===targetId) return;
  let pages=notebookBinderOpenPages();
  const from=pages.findIndex(page=>page.id===sourceId),to=pages.findIndex(page=>page.id===targetId);
  if (from<0 || to<0) return;
  const [moved]=pages.splice(from,1);
  pages.splice(to,0,moved);
  state.settings.notebookBinderOpenPages=pages.map(({key,pageId})=>({key,pageId}));
  const spread=notebookBinderSpread?.()||[];
  if (spread.length===2) {
    const order=new Map(pages.map((page,index)=>[page.id,index]));
    state.settings.notebookBinderSpread=[...spread].sort((a,b)=>(order.get(a)??99)-(order.get(b)??99));
  }
  save();renderAll();
}

/* --------------------------------------------------------------------------
   One browser-like top tab strip. No duplicated left/right rails.
   -------------------------------------------------------------------------- */
function notebookFixInstallTopTabs(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $$('.notebook-binder-side-rail,.notebook-binder-tabs,.notebook-binder-tabs-final',shell).forEach(node=>node.remove());
  $('.notebook-binder-top-tabs',shell)?.remove();
  const pages=notebookBinderOpenPages();
  shell.dataset.binderOpenCount=String(pages.length);
  if (pages.length<=1) return;

  const spread=notebookBinderSpread?.()||[];
  const active=notebookBinderActiveRef?.();
  const nav=document.createElement('nav');
  nav.className='notebook-binder-top-tabs';
  nav.setAttribute('aria-label','Open notebook pages');
  nav.dataset.displayMode=notebookBinderDisplayMode();
  pages.forEach((ref,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.draggable=true;
    button.className=`notebook-binder-top-tab${active?.id===ref.id?' active':''}${spread.includes(ref.id)?' visible-page':''}${notebookPageFavorite?.(ref.key,ref.pageId)?' favorite-page-tab':''}`;
    button.dataset.binderPage=ref.id;
    button.dataset.paperColor=notebookPagePaperColorFinal?.(ref.key,ref.pageId)||'warm';
    button.dataset.tabIndex=String(index);
    const label=binderFluidTabTitle?.(ref) || notebookPeerPageTitle?.(ref) || ref.key;
    button.title=active?.id===ref.id?`${label} — current page`:label;
    button.innerHTML=`<span class="notebook-binder-top-tab-label">${escapeHtml(label)}</span>`;
    if (active?.id===ref.id) button.setAttribute('aria-current','page');
    button.onclick=event=>{ event.preventDefault();event.stopPropagation();notebookFixActivateTab(ref,index); };
    button.addEventListener('dragstart',event=>{
      nav.dataset.dragPage=ref.id;
      button.classList.add('is-dragging');
      try { event.dataTransfer.setData('text/plain',ref.id);event.dataTransfer.effectAllowed='move'; } catch {}
    });
    button.addEventListener('dragend',()=>{ button.classList.remove('is-dragging');delete nav.dataset.dragPage; });
    button.addEventListener('dragover',event=>{ event.preventDefault();event.dataTransfer.dropEffect='move';button.classList.add('drag-over'); });
    button.addEventListener('dragleave',()=>button.classList.remove('drag-over'));
    button.addEventListener('drop',event=>{
      event.preventDefault();button.classList.remove('drag-over');
      const source=nav.dataset.dragPage || event.dataTransfer?.getData('text/plain');
      notebookFixReorderTabs(source,ref.id);
    });
    nav.appendChild(button);
  });
  const toolbar=$('.notebook-toolbar',shell);
  if (toolbar?.nextSibling) shell.insertBefore(nav,toolbar.nextSibling);
  else shell.prepend(nav);
}

/* --------------------------------------------------------------------------
   Colored paper layers behind the visible sheet(s). Tab order determines the
   layer order. Hovering a sliver peeks under the top papers and exposes title.
   -------------------------------------------------------------------------- */
function notebookFixLayerPaperColor(color) {
  if (typeof binderFluidPaperColorValue==='function') return binderFluidPaperColorValue(color);
  const dark=document.documentElement.dataset.theme==='dark';
  if (color==='blue') return dark?'#222b30':'#f1f8fb';
  if (color==='neutral') return dark?'#25282a':'#f7f7f3';
  return dark?'#29271f':'#fff9df';
}

function notebookFixVisibleSheetNodes(shell) {
  const pair=$('.notebook-page-pair',shell);
  const nodes=pair ? $$(':scope > .notebook-page,:scope > .notebook-reference-page',pair) : [$('.notebook-page',shell)].filter(Boolean);
  return nodes.filter(node=>node.getBoundingClientRect().width>0);
}

function notebookFixInstallPaperLayers(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $('.notebook-binder-paper-layers',shell)?.remove();
  $('.notebook-binder-page-layers',shell)?.remove();
  const pages=notebookBinderOpenPages();
  const spread=notebookBinderSpread?.()||[];
  if (pages.length<=1 || !spread.length) return;
  const nodes=notebookFixVisibleSheetNodes(shell);
  if (!nodes.length) return;

  const shellRect=shell.getBoundingClientRect();
  const rects=nodes.map(node=>({node,rect:node.getBoundingClientRect(),side:node.dataset.peerSide||null}));
  const leftRect=(rects.find(x=>x.side==='left')||rects[0]).rect;
  const rightRect=(rects.find(x=>x.side==='right')||rects[rects.length-1]).rect;
  const active=notebookBinderActiveRef?.();
  const activeIndex=Math.max(0,pages.findIndex(page=>page.id===active?.id));
  const midpoint=Math.ceil(pages.length/2);
  const layerWrap=document.createElement('div');
  layerWrap.className='notebook-binder-page-layers';

  const hidden=pages.map((ref,index)=>({ref,index})).filter(item=>!spread.includes(item.ref.id));
  const perSide={left:[],right:[]};
  hidden.forEach(item=>{
    let side;
    if (notebookBinderDisplayMode()==='single') side=item.index<activeIndex?'left':'right';
    else side=item.index<midpoint?'left':'right';
    perSide[side].push(item);
  });

  ['left','right'].forEach(side=>{
    const anchor=side==='left'?leftRect:rightRect;
    const items=perSide[side];
    items.forEach((item,depth)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className=`notebook-binder-page-layer notebook-binder-page-layer-${side}`;
      button.dataset.layerSide=side;
      button.dataset.binderPage=item.ref.id;
      button.dataset.layerDepth=String(depth);
      const color=notebookPagePaperColorFinal?.(item.ref.key,item.ref.pageId)||'warm';
      button.dataset.paperColor=color;
      button.style.setProperty('--layer-paper',notebookFixLayerPaperColor(color));
      const label=binderFluidTabTitle?.(item.ref)||notebookPeerPageTitle?.(item.ref)||item.ref.key;
      button.title=label;
      button.innerHTML=`<span>${escapeHtml(label)}</span>`;
      const offset=6+(depth*7);
      button.style.top=`${Math.round(anchor.top-shellRect.top+8+depth*2)}px`;
      button.style.height=`${Math.max(80,Math.round(anchor.height-16-depth*4))}px`;
      if (side==='left') button.style.left=`${Math.round(anchor.left-shellRect.left-offset)}px`;
      else button.style.left=`${Math.round(anchor.right-shellRect.left+offset-8)}px`;
      button.style.zIndex=String(Math.max(1,18-depth));
      button.addEventListener('pointerenter',()=>{
        shell.classList.add(`binder-layer-peek-${side}`);
        shell.style.setProperty('--binder-layer-peek',`${Math.min(54,24+depth*7)}px`);
        button.classList.add('is-peeking');
      });
      button.addEventListener('pointerleave',()=>{
        shell.classList.remove(`binder-layer-peek-${side}`);
        shell.style.removeProperty('--binder-layer-peek');
        button.classList.remove('is-peeking');
      });
      button.onclick=event=>{
        event.preventDefault();event.stopPropagation();
        const index=pages.findIndex(page=>page.id===item.ref.id);
        notebookFixActivateTab(item.ref,index);
      };
      layerWrap.appendChild(button);
    });
  });
  shell.appendChild(layerWrap);
}

/* --------------------------------------------------------------------------
   Single / Double is an orthogonal presentation option inside the existing
   Position flyout. Width remains Medium / Full / Float / Dock.
   -------------------------------------------------------------------------- */
function notebookFixSpreadGlyph(mode) {
  if (mode==='double') return '<span class="notebook-spread-glyph double" aria-hidden="true"><i></i><i></i></span>';
  return '<span class="notebook-spread-glyph single" aria-hidden="true"><i></i></span>';
}

function notebookFixInstallSpreadToggle(root=$('#notebookDock')) {
  const control=$('[data-notebook-width-controls]',root);
  if (!control) return;
  let button=$('[data-notebook-spread-toggle]',control);
  if (!button) {
    button=document.createElement('button');
    button.type='button';
    button.className='notebook-width-button notebook-spread-toggle';
    button.dataset.notebookSpreadToggle='';
    control.appendChild(button);
  }
  const mode=notebookBinderDisplayMode();
  button.dataset.spreadMode=mode;
  button.innerHTML=notebookFixSpreadGlyph(mode);
  button.title=mode==='double'?'Switch to single-page view':'Switch to two-page view';
  button.setAttribute('aria-label',button.title);
  const width=typeof notebookWidthMode==='function'?notebookWidthMode():state.settings?.notebookWidthMode;
  const disabled=(width==='float'||width==='dock-left') || (mode==='single' && notebookBinderOpenPages().length<2);
  button.disabled=disabled;
  button.onclick=event=>{
    event.preventDefault();event.stopPropagation();
    if (button.disabled) return;
    setNotebookBinderDisplayMode(mode==='double'?'single':'double');
  };
}

/* Medium toolbar follows the exact visible paper/spread footprint. */
function notebookFixMediumToolbar(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const toolbar=$('.notebook-toolbar',shell);
  if (!shell || !toolbar) return;
  const mode=typeof notebookWidthMode==='function'?notebookWidthMode():state.settings?.notebookWidthMode;
  if (mode!=='medium') {
    ['width','max-width','margin-left','margin-right'].forEach(prop=>toolbar.style.removeProperty(prop));
    return;
  }
  const pair=$('.notebook-page-pair',shell);
  const target=notebookBinderDisplayMode()==='double' && pair && notebookFixVisibleSheetNodes(shell).length>1
    ? pair : ($('.notebook-page',shell)||pair);
  const width=Math.round(target?.getBoundingClientRect?.().width||0);
  if (!width) return;
  toolbar.style.setProperty('width',`${width}px`,'important');
  toolbar.style.setProperty('max-width',`${width}px`,'important');
  toolbar.style.setProperty('margin-left','auto','important');
  toolbar.style.setProperty('margin-right','auto','important');
}

function notebookFixSizeTopTabs(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  const tabs=$('.notebook-binder-top-tabs',shell);
  if (!shell || !tabs) return;
  const pair=$('.notebook-page-pair',shell);
  const target=notebookBinderDisplayMode()==='double' && pair && notebookFixVisibleSheetNodes(shell).length>1
    ? pair : ($('.notebook-page',shell)||pair);
  const width=Math.round(target?.getBoundingClientRect?.().width||0);
  if (width) {
    tabs.style.width=`${width}px`;
    tabs.style.maxWidth=`${width}px`;
  }
}

function notebookFinalVisualFixes(root=$('#notebookDock')) {
  if (!root) return;
  decorateNotebookTextLocks?.(root);
  notebookFixBindStoredInfoWarnings(root);
  notebookFixRenderSpatialImages(root);
  notebookFixInstallTopTabs(root);
  notebookFixInstallSpreadToggle(root);
  notebookFixMediumToolbar(root);
  requestAnimationFrame(()=>{
    notebookFixSizeTopTabs(root);
    notebookFixInstallPaperLayers(root);
    binderFluidSyncGridExtent?.(root);
  });
}

const _notebookVisualFixRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _notebookVisualFixRender(root);
  if (!root) return;
  notebookFinalVisualFixes(root);
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
