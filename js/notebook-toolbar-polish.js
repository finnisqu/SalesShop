/* Final notebook toolbar polish: one morphing Position control and quieter persistent chrome. */

function notebookPositionMode() {
  const mode = notebookWidthMode?.() || 'medium';
  return ['medium','full','float'].includes(mode) ? mode : 'medium';
}

function notebookDockGlyph() {
  return '<span class="notebook-width-glyph dock-left" aria-hidden="true"><i></i></span>';
}

function syncNotebookPositionControl(root) {
  const control = $('[data-notebook-width-controls]',root);
  if (!control) return;
  control.classList.add('notebook-position-control');
  control.title = 'Notebook position';
  control.setAttribute('aria-label','Notebook position');

  let dock = $('[data-notebook-width="dock-left"]',control);
  if (!dock) {
    dock = document.createElement('button');
    dock.type='button';
    dock.className='notebook-width-button notebook-position-placeholder';
    dock.dataset.notebookWidth='dock-left';
    dock.title='Dock in navigator (coming soon)';
    dock.setAttribute('aria-label','Dock in navigator — coming soon');
    dock.innerHTML=notebookDockGlyph();
    dock.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      toast('Navigator dock is a placeholder for now.');
    };
    control.appendChild(dock);
  }

  const mode = notebookPositionMode();
  const preferred = ['medium','full','float','dock-left'];
  const buttons = preferred.map(key=>$(`[data-notebook-width="${key}"]`,control)).filter(Boolean);
  buttons.forEach(button=>{
    const active = button.dataset.notebookWidth === mode;
    button.classList.toggle('active',active);
    if (button.dataset.notebookWidth !== 'dock-left') button.setAttribute('aria-pressed',String(active));
  });

  /* Collapsed mode shows only the selected presentation. Put it first in DOM so the control
     can smoothly reveal the other options to its right on hover/focus. */
  const active = buttons.find(button=>button.classList.contains('active')) || buttons[0];
  if (active) control.appendChild(active);
  preferred.filter(key=>key!==active?.dataset.notebookWidth).forEach(key=>{
    const button=$(`[data-notebook-width="${key}"]`,control);
    if (button) control.appendChild(button);
  });

  if (!control.dataset.positionSyncBound) {
    control.dataset.positionSyncBound='1';
    control.addEventListener('click',event=>{
      if (!event.target.closest('[data-notebook-width]')) return;
      setTimeout(()=>syncNotebookPositionControl($('#notebookDock')),0);
    });
  }
}

const _salesShopToolbarPolishApplyWidth = applyNotebookWidthMode;
applyNotebookWidthMode = function(root) {
  const result = _salesShopToolbarPolishApplyWidth(root);
  if (root) syncNotebookPositionControl(root);
  return result;
};

const _salesShopToolbarPolishRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopToolbarPolishRender(root);
  if (!root) return;
  syncNotebookPositionControl(root);
};
