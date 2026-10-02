/* Physical notebook paper stack.
   Wide notebooks show Current + Reference side by side. Compressed notebooks overlap the two sheets
   and expose a clickable paper edge. Float mode stays single-page and offers Swap for the pinned ref. */

function notebookPaperFront() {
  return state.settings?.notebookPaperFront === 'reference' ? 'reference' : 'current';
}

function setNotebookPaperFront(front,{persist=true}={}) {
  state.settings ||= {};
  state.settings.notebookPaperFront = front === 'reference' ? 'reference' : 'current';
  if (persist) save();
  const pair=$('#notebookDock .notebook-page-pair');
  if (pair) pair.dataset.paperFront=state.settings.notebookPaperFront;
}

/* Reference prose is intentionally editable. History/origin metadata still records where the page
   came from; editing an old page should not require a separate unlock ritual. */
if (typeof notebookReferenceEntryElement==='function' && !window.__salesShopEditableReferenceEntries) {
  window.__salesShopEditableReferenceEntries=true;
  const _paperStackReferenceEntry=notebookReferenceEntryElement;
  notebookReferenceEntryElement=function(entry,step,fallbackRow) {
    const rendered=_paperStackReferenceEntry(entry,step,fallbackRow);
    const text=$('.notebook-reference-entry-text',rendered?.el);
    if (text) {
      text.contentEditable='true';
      text.spellcheck=true;
      text.setAttribute('role','textbox');
      text.setAttribute('aria-label','Edit reference note');
      text.addEventListener('beforeinput',()=>notebookBeginTypingCheckpoint?.());
      text.addEventListener('input',()=>{
        entry.text=typeof richPlainTextFromNode==='function' ? richPlainTextFromNode(text) : (text.textContent||'');
        entry.richHtml=typeof sanitizeRichHtml==='function' ? sanitizeRichHtml(text.innerHTML) : '';
        entry.updatedAt=nowISO?.() || new Date().toISOString();
        save();
      });
    }
    return rendered;
  };
}

if (typeof notebookReferenceObjectElement==='function' && !window.__salesShopEditableReferenceObjects) {
  window.__salesShopEditableReferenceObjects=true;
  const _paperStackReferenceObject=notebookReferenceObjectElement;
  notebookReferenceObjectElement=function(object,step) {
    const rendered=_paperStackReferenceObject(object,step);
    if (!rendered?.wrap) return rendered;

    if (object.type==='table') {
      const table=$('.notebook-reference-table',rendered.wrap);
      if (table) {
        let visibleIndex=0;
        const visibleCells=$$('td',table);
        for (let r=0;r<Math.max(1,Number(object.rows)||1);r++) {
          for (let c=0;c<Math.max(1,Number(object.cols)||1);c++) {
            const merge=notebookReferenceMergeCovering?.(object,r,c);
            if (merge && (merge.r!==r || merge.c!==c)) continue;
            const td=visibleCells[visibleIndex++];
            if (!td) continue;
            td.dataset.referenceRow=String(r);
            td.dataset.referenceCol=String(c);
            td.contentEditable='true';
            td.spellcheck=true;
            td.addEventListener('beforeinput',()=>notebookBeginTypingCheckpoint?.());
            td.addEventListener('focus',()=>{
              const raw=String(object.cells?.[r]?.[c]??'');
              if (td.textContent!==raw) td.textContent=raw;
            });
            td.addEventListener('input',()=>{
              object.cells ||= [];
              object.cells[r] ||= [];
              object.cells[r][c]=td.textContent||'';
              const key=typeof notebookFunctionCellKey==='function' ? notebookFunctionCellKey(r,c) : `${r}:${c}`;
              if (object.cellFormulas?.[key]) delete object.cellFormulas[key];
              recalcNotebookTableFormulas?.(object);
              object.updatedAt=nowISO?.() || new Date().toISOString();
              save();
            });
          }
        }
      }
    } else {
      const text=$('.notebook-reference-shape-text',rendered.wrap);
      if (text) {
        text.contentEditable='true';
        text.spellcheck=true;
        text.addEventListener('beforeinput',()=>notebookBeginTypingCheckpoint?.());
        text.addEventListener('input',()=>{
          object.text=text.textContent||'';
          object.updatedAt=nowISO?.() || new Date().toISOString();
          save();
        });
      }
    }
    return rendered;
  };
}

if (typeof buildNotebookReferencePage==='function' && !window.__salesShopEditableReferenceHeader) {
  window.__salesShopEditableReferenceHeader=true;
  const _paperStackBuildReference=buildNotebookReferencePage;
  buildNotebookReferencePage=function(ref) {
    const page=_paperStackBuildReference(ref);
    const titleWrap=$('.notebook-reference-title-wrap',page);
    let header=$('.notebook-reference-page-header',page);
    if (!header && titleWrap) {
      header=document.createElement('div');
      header.className='notebook-reference-page-header';
      titleWrap.appendChild(header);
    }
    if (header) {
      header.contentEditable='true';
      header.spellcheck=true;
      header.setAttribute('role','textbox');
      header.setAttribute('aria-label','Reference page title');
      header.addEventListener('input',()=>setNotebookPageHeader?.(header.textContent||'',ref.key,ref.pageId));
      header.addEventListener('keydown',event=>{
        if (event.key==='Enter') { event.preventDefault();header.blur(); }
      });
    }
    return page;
  };
}

/* Opening Reference makes that paper the front sheet only when the layout needs to stack. Wide
   two-page mode still shows both equally. */
if (typeof setNotebookReferencePage==='function' && !window.__salesShopReferenceFrontOnOpen) {
  window.__salesShopReferenceFrontOnOpen=true;
  const _paperStackSetReference=setNotebookReferencePage;
  setNotebookReferencePage=function(key,pageId) {
    state.settings ||= {};
    state.settings.notebookPaperFront='reference';
    return _paperStackSetReference(key,pageId);
  };
}

if (typeof swapNotebookReferencePage==='function' && !window.__salesShopReferenceSwapFront) {
  window.__salesShopReferenceSwapFront=true;
  const _paperStackSwap=swapNotebookReferencePage;
  swapNotebookReferencePage=function() {
    state.settings ||= {};
    state.settings.notebookPaperFront='current';
    return _paperStackSwap();
  };
}

function installNotebookPaperPeeks(pair) {
  if (!pair) return;
  pair.dataset.paperFront=notebookPaperFront();
  let currentPeek=$('[data-paper-peek="current"]',pair);
  let referencePeek=$('[data-paper-peek="reference"]',pair);
  if (!currentPeek) {
    currentPeek=document.createElement('button');
    currentPeek.type='button';
    currentPeek.className='notebook-paper-peek notebook-paper-peek-current';
    currentPeek.dataset.paperPeek='current';
    currentPeek.innerHTML='<span>Current</span>';
    currentPeek.title='Bring Current page to front';
    currentPeek.onclick=event=>{ event.preventDefault();event.stopPropagation();setNotebookPaperFront('current'); };
    pair.appendChild(currentPeek);
  }
  if (!referencePeek) {
    referencePeek=document.createElement('button');
    referencePeek.type='button';
    referencePeek.className='notebook-paper-peek notebook-paper-peek-reference';
    referencePeek.dataset.paperPeek='reference';
    referencePeek.innerHTML='<span>Reference</span>';
    referencePeek.title='Bring Reference page to front';
    referencePeek.onclick=event=>{ event.preventDefault();event.stopPropagation();setNotebookPaperFront('reference'); };
    pair.appendChild(referencePeek);
  }
}

function installFloatingReferenceSwap(root) {
  const ref=notebookReferencePageState?.();
  const head=$('.notebook-paper-head',root);
  if (!ref || !head) return;
  let button=$('[data-floating-reference-swap]',head);
  if (!button) {
    button=document.createElement('button');
    button.type='button';
    button.className='notebook-floating-reference-swap';
    button.dataset.floatingReferenceSwap='';
    button.textContent='Swap';
    button.title='Swap Current with the pinned Reference page';
    button.onclick=event=>{ event.preventDefault();event.stopPropagation();swapNotebookReferencePage?.(); };
    head.appendChild(button);
  }
}

/* Float is a one-sheet presentation. Keep Reference pinned in state, but don't render a second full
   page. The Swap button lets the two sheets exchange roles without leaving Float. */
if (typeof installNotebookReferenceView==='function' && !window.__salesShopFloatSingleReference) {
  window.__salesShopFloatSingleReference=true;
  const _paperStackInstallReference=installNotebookReferenceView;
  installNotebookReferenceView=function(root=$('#notebookDock')) {
    if (typeof notebookWidthMode==='function' && notebookWidthMode()==='float') {
      installFloatingReferenceSwap(root);
      return;
    }
    const result=_paperStackInstallReference(root);
    const pair=$('.notebook-page-pair',root);
    if (pair) installNotebookPaperPeeks(pair);
    return result;
  };
}

/* Presentation changes don't normally rebuild the notebook. With a pinned Reference they must,
   because Float switches between the physical two-sheet desk and single-sheet presentation. */
if (!window.__salesShopReferencePresentationRefresh) {
  window.__salesShopReferencePresentationRefresh=true;
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#notebookDock [data-notebook-width]');
    if (!button || !state.settings?.notebookReferencePage) return;
    setTimeout(()=>renderAll?.(),0);
  },false);
}

/* If a two-page layout already exists when this final layer loads, decorate it immediately. */
const _paperStackRenderNotebook=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _paperStackRenderNotebook(root);
  if (!root) return;
  const pair=$('.notebook-page-pair',root);
  if (pair) installNotebookPaperPeeks(pair);
  if (notebookWidthMode?.()==='float') installFloatingReferenceSwap(root);
};
