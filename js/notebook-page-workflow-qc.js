/* Small guards for notebook-page-workflow. */

if (typeof notebookFavoriteShelfHtml==='function' && !window.__salesShopFavoriteShelfPlaceholder) {
  window.__salesShopFavoriteShelfPlaceholder=true;
  const _favoriteShelfHtml=notebookFavoriteShelfHtml;
  notebookFavoriteShelfHtml=function() {
    return _favoriteShelfHtml() || '<div class="notebook-history-favorites is-empty" data-history-favorites aria-hidden="true"></div>';
  };
}

/* Re-run the final paper workflow after the current render stack has finished. */
if (typeof installNotebookPaperWorkflow==='function') {
  requestAnimationFrame(()=>installNotebookPaperWorkflow($('#notebookDock')));
}
