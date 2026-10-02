/* Small cleanup for staged function mode: always restore the normal fx trigger before applying
   the active-mode checkmark state. */
if (typeof syncNotebookFunctionModeUi === 'function' && !window.__salesShopFunctionTriggerReset) {
  window.__salesShopFunctionTriggerReset=true;
  const _functionModeUi=syncNotebookFunctionModeUi;
  syncNotebookFunctionModeUi=function(root=$('#notebookDock')) {
    if (root) {
      $$('.spatial-function-control',root).forEach(control=>{
        control.classList.remove('function-picking');
        delete control.dataset.functionType;
        const trigger=$('.spatial-function-trigger',control);
        if (!trigger) return;
        trigger.textContent='ƒx';
        trigger.title='Functions';
        trigger.setAttribute('aria-label','Functions');
        trigger.onclick=event=>{
          event.preventDefault();
          event.stopPropagation();
          const opening=!control.classList.contains('flyout-open');
          control.classList.toggle('flyout-open',opening);
          if (opening) orientUnifiedFlyout?.(control);
        };
      });
    }
    return _functionModeUi(root);
  };
}
