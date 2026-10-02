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

/* Final notebook/Binder QC is intentionally loaded after the full legacy override stack. */
(function loadBinderFluidQc(){
  if (!document.querySelector('link[data-binder-fluid-qc]')) {
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='notebook-binder-fluid-qc.css';
    link.dataset.binderFluidQc='';
    document.head.appendChild(link);
  }

  const loadTabQc=()=>{
    if (!document.querySelector('link[data-binder-tabs-qc]')) {
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='notebook-binder-tabs-qc.css';
      link.dataset.binderTabsQc='';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-binder-tabs-qc]')) {
      const script=document.createElement('script');
      script.src='js/notebook-binder-tabs-qc.js';
      script.async=false;
      script.dataset.binderTabsQc='';
      document.body.appendChild(script);
    }
  };

  const loadVisualFixes=()=>{
    if (!document.querySelector('link[data-binder-visual-fixes]')) {
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='notebook-binder-visual-fixes.css';
      link.dataset.binderVisualFixes='';
      document.head.appendChild(link);
    }

    const existingVisual=document.querySelector('script[data-binder-visual-fixes]');
    if (existingVisual) {
      if (existingVisual.dataset.loaded==='1') loadTabQc();
      else existingVisual.addEventListener('load',loadTabQc,{once:true});
      return;
    }

    const visual=document.createElement('script');
    visual.src='js/notebook-binder-visual-fixes.js';
    visual.async=false;
    visual.dataset.binderVisualFixes='';
    visual.addEventListener('load',()=>{
      visual.dataset.loaded='1';
      loadTabQc();
    },{once:true});
    document.body.appendChild(visual);
  };

  const existing=document.querySelector('script[data-binder-fluid-qc]');
  if (existing) {
    if (existing.dataset.loaded==='1') loadVisualFixes();
    else existing.addEventListener('load',loadVisualFixes,{once:true});
    return;
  }

  const script=document.createElement('script');
  script.src='js/notebook-binder-fluid-qc.js';
  script.async=false;
  script.dataset.binderFluidQc='';
  script.addEventListener('load',()=>{
    script.dataset.loaded='1';
    loadVisualFixes();
  },{once:true});
  document.body.appendChild(script);
})();
