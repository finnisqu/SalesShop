/* Small guards for notebook-page-workflow. */

if (typeof nowISO==='undefined') window.nowISO=()=>new Date().toISOString();

if (typeof notebookFavoriteShelfHtml==='function' && !window.__salesShopFavoriteShelfPlaceholder) {
  window.__salesShopFavoriteShelfPlaceholder=true;
  const _favoriteShelfHtml=notebookFavoriteShelfHtml;
  notebookFavoriteShelfHtml=function() {
    return _favoriteShelfHtml() || '<div class="notebook-history-favorites is-empty" data-history-favorites aria-hidden="true"></div>';
  };
}

if (typeof buildNotebookReferencePage==='function' && !window.__salesShopReferenceMetadataButtons) {
  window.__salesShopReferenceMetadataButtons=true;
  const _referenceMetadataBuild=buildNotebookReferencePage;
  buildNotebookReferencePage=function(ref) {
    const page=_referenceMetadataBuild(ref);
    const actions=$('.notebook-reference-actions',page);
    if (!actions) return page;

    const favorite=document.createElement('button');
    favorite.type='button';
    favorite.className='notebook-reference-meta-button';
    const fav=notebookPageFavorite(ref.key,ref.pageId);
    favorite.classList.toggle('active',fav);
    favorite.title=fav?'Remove Reference page from Favorites':'Favorite Reference page';
    favorite.setAttribute('aria-label',favorite.title);
    favorite.innerHTML=notebookMetaIcon('favorite',fav);
    favorite.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPageFavorite(ref.key,ref.pageId,!fav);
      renderAll();
    };

    const lock=document.createElement('button');
    lock.type='button';
    lock.className='notebook-reference-meta-button';
    const locked=notebookPageLocked(ref.key,ref.pageId);
    lock.classList.toggle('active',locked);
    lock.title=locked?'Unlock Reference page':'Lock Reference page';
    lock.setAttribute('aria-label',lock.title);
    lock.innerHTML=notebookMetaIcon('lock',locked);
    lock.onclick=event=>{
      event.preventDefault();event.stopPropagation();
      setNotebookPageLocked(ref.key,ref.pageId,!locked);
      renderAll();
    };

    actions.prepend(lock);
    actions.prepend(favorite);
    return page;
  };
}

/* Re-run the final paper workflow after the current render stack has finished. */
if (typeof installNotebookPaperWorkflow==='function') {
  requestAnimationFrame(()=>installNotebookPaperWorkflow($('#notebookDock')));
}
