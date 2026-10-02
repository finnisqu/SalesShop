/* Hover-close Binder tabs.
   Loaded after the canonical roster so tab open/close/reorder actions always use canonical state. */

function installBinderTabsWithClose(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $$('.notebook-binder-top-tabs,.notebook-binder-tabs-clean,.notebook-binder-side-rail,.notebook-binder-tabs,.notebook-binder-tabs-final',shell).forEach(node=>node.remove());

  const pages=typeof notebookBinderOpenPages==='function' ? notebookBinderOpenPages() : singleBinderOpenPages();
  shell.dataset.binderOpenCount=String(pages.length);
  if (pages.length<=1) return;

  const active=typeof notebookBinderActiveRef==='function' ? notebookBinderActiveRef() : singleBinderCurrentRef();
  const labels=singleBinderTabLabels(pages);
  const tabs=document.createElement('nav');
  tabs.className='notebook-binder-tabs-clean';
  tabs.setAttribute('aria-label','Open notebook pages');

  pages.forEach(ref=>{
    const tab=document.createElement('div');
    tab.className=`notebook-binder-tab-clean${active?.id===ref.id?' active':''}${notebookPageFavorite?.(ref.key,ref.pageId)?' favorite':''}`;
    tab.dataset.binderPage=ref.id;
    tab.dataset.paperColor=singleBinderPageColor(ref);
    tab.draggable=true;

    const label=labels.get(ref.id)||singleBinderDateLabel(ref);
    const open=document.createElement('button');
    open.type='button';
    open.className='notebook-binder-tab-open';
    open.title=active?.id===ref.id ? `${label} · open` : `Open ${label}`;
    if (active?.id===ref.id) open.setAttribute('aria-current','page');
    open.innerHTML=`<span class="notebook-binder-tab-label">${escapeHtml(label)}</span>`;
    open.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      if (active?.id!==ref.id) singleBinderActivate(ref,{record:true});
    };

    const close=document.createElement('button');
    close.type='button';
    close.className='notebook-binder-tab-close';
    close.draggable=false;
    close.title=`Close ${label}`;
    close.setAttribute('aria-label',close.title);
    close.innerHTML='<span aria-hidden="true">×</span>';
    close.onpointerdown=event=>{ event.preventDefault();event.stopPropagation(); };
    close.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      closeNotebookBinderPage(ref);
    };

    tab.append(open,close);

    tab.addEventListener('dragstart',event=>{
      if (event.target?.closest?.('.notebook-binder-tab-close')) {
        event.preventDefault();
        return;
      }
      tab.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain',ref.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed='move';
    });
    tab.addEventListener('dragend',()=>tab.classList.remove('is-dragging'));
    tab.addEventListener('dragover',event=>{
      event.preventDefault();
      tab.classList.add('drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect='move';
    });
    tab.addEventListener('dragleave',()=>tab.classList.remove('drag-over'));
    tab.addEventListener('drop',event=>{
      event.preventDefault();
      tab.classList.remove('drag-over');
      singleBinderReorder(event.dataTransfer?.getData('text/plain'),ref.id);
    });
    tabs.appendChild(tab);
  });

  const toolbar=$('.notebook-toolbar',shell);
  if (toolbar) toolbar.insertAdjacentElement('afterend',tabs);
  else shell.prepend(tabs);
  requestAnimationFrame(()=>singleBinderAlignTabs(root));
}

singleBinderInstallTabs=installBinderTabsWithClose;
requestAnimationFrame(()=>singleBinderPolish?.($('#notebookDock')));
