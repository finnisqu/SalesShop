/* Final Binder tab cleanup.
   Top tabs are the only tab navigation. Duplicate-date pages receive deterministic labels. */

function notebookTabQcOpenPages() {
  try { return notebookBinderOpenPages?.() || []; }
  catch { return []; }
}

function notebookTabQcPageTitle(ref) {
  if (!ref?.key || !ref?.pageId) return '';
  try {
    const header=String(notebookPageHeader?.(ref.key,ref.pageId) || '').trim();
    if (header) return header;
  } catch {}
  return '';
}

function notebookTabQcCompactDate(key) {
  try { return fmtDate(key,{month:'short',day:'numeric'}); }
  catch { return String(key||'Page'); }
}

function notebookTabQcLabel(ref,pages,index) {
  const title=notebookTabQcPageTitle(ref);
  if (title) return title;
  const sameDate=pages.filter(page=>page.key===ref.key);
  const date=notebookTabQcCompactDate(ref.key);
  if (sameDate.length<=1) return date;
  const ordinal=sameDate.findIndex(page=>page.id===ref.id)+1;
  return `${date} · ${Math.max(1,ordinal)}`;
}

function notebookTabQcRemoveLegacySideNavigation(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-binder-side-rail,.notebook-binder-side-tab,.notebook-binder-tabs,.notebook-binder-tabs-final,.notebook-paper-peek,.notebook-paper-active-tab',root)
    .forEach(node=>node.remove());
}

function notebookTabQcRelabelTopTabs(root=$('#notebookDock')) {
  if (!root) return;
  const pages=notebookTabQcOpenPages();
  const byId=new Map(pages.map((page,index)=>[page.id,{page,index}]));
  $$('.notebook-binder-top-tab',root).forEach(button=>{
    const hit=byId.get(button.dataset.binderPage);
    if (!hit) return;
    const {page,index}=hit;
    const label=notebookTabQcLabel(page,pages,index);
    const span=$('.notebook-binder-top-tab-label',button);
    if (span) span.textContent=label;
    else button.textContent=label;
    const active=button.classList.contains('active');
    button.title=active ? `${label} — current page` : label;
    button.setAttribute('aria-label',button.title);
  });
}

function notebookTabQcPolish(root=$('#notebookDock')) {
  if (!root) return;
  notebookTabQcRemoveLegacySideNavigation(root);
  notebookTabQcRelabelTopTabs(root);
}

const _notebookTabQcRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _notebookTabQcRender(root);
  if (!root) return;
  notebookTabQcPolish(root);
  requestAnimationFrame(()=>notebookTabQcPolish(root));
};

if (!window.__salesShopBinderTabQcWatch) {
  window.__salesShopBinderTabQcWatch=true;
  const root=$('#notebookDock');
  if (root && typeof MutationObserver!=='undefined') {
    let scheduled=false;
    const observer=new MutationObserver(()=>{
      if (scheduled) return;
      scheduled=true;
      requestAnimationFrame(()=>{
        scheduled=false;
        notebookTabQcPolish(root);
      });
    });
    observer.observe(root,{childList:true,subtree:true});
  }
}

requestAnimationFrame(()=>notebookTabQcPolish($('#notebookDock')));
