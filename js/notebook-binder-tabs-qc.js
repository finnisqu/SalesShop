/* Final Binder tab / paper-stack cleanup.
   - The top bar is the only tab navigation.
   - Tabs are grouped into clear left/right banks (max three each).
   - Same-date pages receive deterministic labels.
   - Hidden pages render as full sheets physically underneath the visible paper, not title bubbles. */

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

function notebookTabQcLeftCount(pages) {
  return Math.min(3,Math.ceil((pages?.length||0)/2));
}

function notebookTabQcSideForIndex(index,pages) {
  return index<notebookTabQcLeftCount(pages)?'left':'right';
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
    if (span && span.textContent!==label) span.textContent=label;
    else if (!span && button.textContent!==label) button.textContent=label;
    button.dataset.tabSide=notebookTabQcSideForIndex(index,pages);
    const active=button.classList.contains('active');
    const title=active ? `${label} — current page` : label;
    if (button.title!==title) button.title=title;
    if (button.getAttribute('aria-label')!==title) button.setAttribute('aria-label',title);
  });
}

function notebookTabQcSameChildren(parent,desired) {
  if (!parent || parent.children.length!==desired.length) return false;
  return desired.every((node,index)=>parent.children[index]===node);
}

/* Make left/right ownership visible instead of relying on a hairline through one continuous row. */
function notebookTabQcArrangeTopTabs(root=$('#notebookDock')) {
  const nav=$('.notebook-binder-top-tabs',root);
  if (!nav) return;
  const pages=notebookTabQcOpenPages();
  const buttons=$$('.notebook-binder-top-tab',nav);
  if (!buttons.length) return;

  let left=$('.notebook-binder-tab-bank-left',nav);
  let right=$('.notebook-binder-tab-bank-right',nav);
  let spine=$('.notebook-binder-tab-spine',nav);
  if (!left) {
    left=document.createElement('div');
    left.className='notebook-binder-tab-bank notebook-binder-tab-bank-left';
  }
  if (!spine) {
    spine=document.createElement('i');
    spine.className='notebook-binder-tab-spine';
    spine.setAttribute('aria-hidden','true');
  }
  if (!right) {
    right=document.createElement('div');
    right.className='notebook-binder-tab-bank notebook-binder-tab-bank-right';
  }

  const leftCount=notebookTabQcLeftCount(pages);
  const desiredLeft=buttons.slice(0,leftCount);
  const desiredRight=buttons.slice(leftCount);
  if (!notebookTabQcSameChildren(left,desiredLeft)) left.replaceChildren(...desiredLeft);
  if (!notebookTabQcSameChildren(right,desiredRight)) right.replaceChildren(...desiredRight);
  if (nav.children.length!==3 || nav.children[0]!==left || nav.children[1]!==spine || nav.children[2]!==right) {
    nav.replaceChildren(left,spine,right);
  }
  nav.dataset.leftCount=String(desiredLeft.length);
  nav.dataset.rightCount=String(desiredRight.length);
}

function notebookTabQcVisibleSheets(shell) {
  const pair=$('.notebook-page-pair',shell);
  let nodes=[];
  if (pair) {
    nodes=$$(':scope > .notebook-page,:scope > .notebook-reference-page',pair)
      .filter(node=>node.getBoundingClientRect().width>1 && getComputedStyle(node).display!=='none');
  }
  if (!nodes.length) {
    const page=$('.notebook-page',shell);
    if (page) nodes=[page];
  }
  return nodes.sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left);
}

function notebookTabQcPaperColor(ref) {
  try { return notebookPagePaperColorFinal?.(ref.key,ref.pageId) || 'warm'; }
  catch { return 'warm'; }
}

function notebookTabQcVisibleRefBySide(side,pages,spread) {
  if (!spread?.length) return null;
  const ids=spread.filter(Boolean);
  if (ids.length===1) return pages.find(page=>page.id===ids[0]) || null;
  const id=side==='right'?ids[1]:ids[0];
  return pages.find(page=>page.id===id) || null;
}

/* Full-size underlays sit behind the live sheet. Only their offset edge is exposed, so they look
   like actual pages underneath instead of a vertical control/tab. */
function notebookTabQcBuildUnderlays(root=$('#notebookDock')) {
  const shell=$('.notebook-shell',root);
  if (!shell) return;
  $('.notebook-binder-page-layers',shell)?.remove();
  $('.notebook-binder-paper-layers',shell)?.remove();
  $('.notebook-binder-underlays',shell)?.remove();

  const pages=notebookTabQcOpenPages();
  const spread=notebookBinderSpread?.() || [];
  if (pages.length<=1 || !spread.length) return;
  const sheets=notebookTabQcVisibleSheets(shell);
  if (!sheets.length) return;

  const shellRect=shell.getBoundingClientRect();
  const leftCount=notebookTabQcLeftCount(pages);
  const leftItems=[],rightItems=[];
  pages.forEach((ref,index)=>{
    if (spread.includes(ref.id)) return;
    (index<leftCount?leftItems:rightItems).push({ref,index});
  });

  const leftSheet=sheets[0];
  const rightSheet=sheets.length>1?sheets[sheets.length-1]:sheets[0];
  const underlays=document.createElement('div');
  underlays.className='notebook-binder-underlays';
  underlays.setAttribute('aria-label','Open pages underneath');

  const makeSide=(side,items,anchor)=>{
    if (!items.length || !anchor) return;
    const visibleRef=notebookTabQcVisibleRefBySide(side,pages,spread);
    const visibleIndex=visibleRef ? pages.findIndex(page=>page.id===visibleRef.id) : -1;
    const ordered=[...items].sort((a,b)=>{
      if (visibleIndex>=0) return Math.abs(a.index-visibleIndex)-Math.abs(b.index-visibleIndex);
      return side==='left' ? b.index-a.index : a.index-b.index;
    });
    const rect=anchor.getBoundingClientRect();
    ordered.forEach((item,depthIndex)=>{
      const depth=depthIndex+1;
      const page=document.createElement('button');
      page.type='button';
      page.className=`notebook-binder-underlay notebook-binder-underlay-${side}`;
      page.dataset.binderPage=item.ref.id;
      page.dataset.paperColor=notebookTabQcPaperColor(item.ref);
      page.dataset.depth=String(depth);
      page.title=notebookTabQcLabel(item.ref,pages,item.index);
      page.setAttribute('aria-label',`Open ${page.title}`);
      page.style.left=`${Math.round(rect.left-shellRect.left + (side==='left'?-depth*6:depth*6))}px`;
      page.style.top=`${Math.round(rect.top-shellRect.top + depth*2)}px`;
      page.style.width=`${Math.round(rect.width)}px`;
      page.style.height=`${Math.round(Math.max(1,rect.height-depth*2))}px`;
      page.style.zIndex=String(Math.max(1,8-depth));
      page.onclick=event=>{
        event.preventDefault();event.stopPropagation();
        if (typeof notebookFixActivateTab==='function') notebookFixActivateTab(item.ref,item.index);
      };
      underlays.appendChild(page);
    });
  };

  makeSide('left',leftItems,leftSheet);
  makeSide('right',rightItems,rightSheet);
  shell.appendChild(underlays);
}

function notebookTabQcPolish(root=$('#notebookDock')) {
  if (!root) return;
  notebookTabQcRemoveLegacySideNavigation(root);
  notebookTabQcRelabelTopTabs(root);
  notebookTabQcArrangeTopTabs(root);
  notebookTabQcBuildUnderlays(root);
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
    const legacySelector='.notebook-binder-side-rail,.notebook-binder-side-tab,.notebook-binder-tabs,.notebook-binder-tabs-final,.notebook-paper-peek,.notebook-paper-active-tab';
    const observer=new MutationObserver(mutations=>{
      const legacyAdded=mutations.some(mutation=>Array.from(mutation.addedNodes||[]).some(node=>
        node.nodeType===1 && (node.matches?.(legacySelector) || node.querySelector?.(legacySelector))
      ));
      if (!legacyAdded || scheduled) return;
      scheduled=true;
      requestAnimationFrame(()=>{
        scheduled=false;
        notebookTabQcRemoveLegacySideNavigation(root);
      });
    });
    observer.observe(root,{childList:true,subtree:true});
  }
  let resizeRaf=0;
  const resize=()=>{
    cancelAnimationFrame(resizeRaf);
    resizeRaf=requestAnimationFrame(()=>notebookTabQcPolish($('#notebookDock')));
  };
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('fullscreenchange',resize);
}

requestAnimationFrame(()=>notebookTabQcPolish($('#notebookDock')));
