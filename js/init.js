function init() {
  $('#nav').onclick=e=>{ const b=e.target.closest('[data-view]'); if(b)showView(b.dataset.view); };
  $('#quickNewBtn').onclick=openQuickNew;
  const cmd=$('#commandInput'); cmd.oninput=()=>renderCommandResults(cmd.value); cmd.onkeydown=e=>{ if(e.key==='Enter'&&cmd.value.trim()) captureCommand(cmd.value.trim()); if(e.key==='Escape') $('#commandResults').classList.add('hidden'); };
  document.addEventListener('click',e=>{ if(!e.target.closest('.command-wrap'))$('#commandResults').classList.add('hidden'); if(!e.target.closest('.selection-popover')&&!e.target.closest('.entry-text'))removeSelectionPopover(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeModal();removeSelectionPopover();} if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();cmd.focus();cmd.select();} });
  $('#resetDemoBtn').onclick=()=>{ if(confirm('Reset this prototype back to the demo data?')){localStorage.removeItem(STORAGE_KEY);state=seedData();save();currentQuoteId=state.quotes[0]?.id;renderAll();toast('Demo reset');} };
  renderAll();
}

init();
