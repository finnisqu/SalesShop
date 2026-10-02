function init() {
  applyTheme();
  $('#nav').onclick=e=>{ const b=e.target.closest('[data-view]'); if(b)showView(b.dataset.view); };
  $('#quickNewBtn').onclick=openQuickNew;
  $('#themeToggleBtn').onclick=toggleTheme;
  const cmd=$('#commandInput');
  cmd.oninput=()=>renderCommandResults(cmd.value);
  cmd.onkeydown=e=>{ if(e.key==='Enter'&&cmd.value.trim()) captureCommand(cmd.value.trim()); if(e.key==='Escape') $('#commandResults').classList.add('hidden'); };
  document.addEventListener('click',e=>{ if(!e.target.closest('.command-wrap'))$('#commandResults').classList.add('hidden'); if(!e.target.closest('.selection-popover')&&!e.target.closest('.entry-text'))removeSelectionPopover(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeModal();removeSelectionPopover();} if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();cmd.focus();cmd.select();} });
  $('#resetDemoBtn').onclick=()=>{
    if(confirm('Reset this prototype back to the demo data?')){
      localStorage.removeItem(STORAGE_KEY);
      state=seedData();
      save();
      currentQuoteId=state.quotes[0]?.id;
      currentNotebookDate=dateKey();
      showView('board');
      toast('Demo reset');
    }
  };
  showView('board');
}

init();

/* Notebook finalization.
   Keep useful fluid/spatial fixes, then finish with one Binder owner, one quarantine layer,
   and a private canonical roster that no legacy renderer can overwrite. */
(function loadNotebookFinalLayers(){
  const BUILD='20261002-1646-canonical-roster';
  const withBuild=path=>`${path}?v=${BUILD}`;

  const ensureStyle=(key,path)=>{
    if (document.querySelector(`link[data-${key}]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=withBuild(path);
    link.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='';
    link.setAttribute(`data-${key}`,'');
    document.head.appendChild(link);
  };

  const loadScript=(key,path,next)=>{
    const selector=`script[data-${key}]`;
    const existing=document.querySelector(selector);
    if (existing) {
      if (existing.dataset.loaded==='1') next?.();
      else if (next) existing.addEventListener('load',next,{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=withBuild(path);
    script.async=false;
    script.setAttribute(`data-${key}`,'');
    script.addEventListener('load',()=>{
      script.dataset.loaded='1';
      next?.();
    },{once:true});
    document.body.appendChild(script);
  };

  ensureStyle('binder-fluid-qc','notebook-binder-fluid-qc.css');
  loadScript('binder-fluid-qc','js/notebook-binder-fluid-qc.js',()=>{
    ensureStyle('binder-visual-fixes','notebook-binder-visual-fixes.css');
    loadScript('binder-visual-fixes','js/notebook-binder-visual-fixes.js',()=>{
      ensureStyle('binder-single-clean','notebook-binder-single-clean.css');
      loadScript('binder-single-clean','js/notebook-binder-single-clean.js',()=>{
        ensureStyle('binder-single-hotfix','notebook-binder-single-hotfix.css');
        loadScript('binder-single-hotfix','js/notebook-binder-single-hotfix.js',()=>{
          loadScript('binder-canonical-roster','js/notebook-binder-canonical-roster.js');
        });
      });
    });
  });
})();
