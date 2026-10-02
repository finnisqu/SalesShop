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

  const loadVisualFixes=()=>{
    if (!document.querySelector('link[data-binder-visual-fixes]')) {
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='notebook-binder-visual-fixes.css';
      link.dataset.binderVisualFixes='';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-binder-visual-fixes]')) {
      const script=document.createElement('script');
      script.src='js/notebook-binder-visual-fixes.js';
      script.async=false;
      script.dataset.binderVisualFixes='';
      document.body.appendChild(script);
    }
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
