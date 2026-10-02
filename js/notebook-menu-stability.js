/* Stable notebook palettes: fixed option order, hover grace, canonical presentation order,
   and a clearer inward-arrows Merge icon. Loaded after the earlier notebook toolbar layers. */

const NOTEBOOK_POSITION_CANONICAL_ORDER = ['medium','full','float','dock-left'];
const NOTEBOOK_FLYOUT_CLOSE_DELAY = 950;

function stableNotebookPositionOrder(root=$('#notebookDock')) {
  const control = root ? $('[data-notebook-width-controls]',root) : null;
  if (!control) return;
  NOTEBOOK_POSITION_CANONICAL_ORDER.forEach(key=>{
    const button = $(`[data-notebook-width="${key}"]`,control);
    if (button) control.appendChild(button);
  });
}

/* The earlier Position layer intentionally moved the active option first so it would remain
   visible inside the collapsed width. Keep its behavior, but normalize the expanded list back to
   one permanent order every time it syncs. CSS below makes the active button visible at rest. */
if (typeof syncNotebookPositionControl === 'function' && !window.__salesShopStablePositionOrder) {
  window.__salesShopStablePositionOrder = true;
  const _stablePositionSync = syncNotebookPositionControl;
  syncNotebookPositionControl = function(root) {
    const result = _stablePositionSync(root);
    stableNotebookPositionOrder(root);
    return result;
  };
}

function notebookFlyoutKind(control) {
  if (control?.classList.contains('spatial-align-control')) return 'align';
  if (control?.classList.contains('spatial-number-format-control')) return 'number';
  if (control?.classList.contains('spatial-fill-control')) return 'fill';
  return '';
}

function syncNotebookFlyoutCurrent(control) {
  if (!control) return;
  const kind = notebookFlyoutKind(control);
  if (!kind) return;
  const active = $('.active',control);
  if (!active) return;

  let current = $('.spatial-flyout-current',control);
  if (!current) {
    current = document.createElement('span');
    current.className = 'spatial-flyout-current';
    current.setAttribute('aria-hidden','true');
    control.prepend(current);
  }

  current.className = `spatial-flyout-current spatial-flyout-current-${kind}`;
  if (kind === 'fill') {
    const fillClass = [...active.classList].find(name=>name.startsWith('fill-'));
    if (fillClass) current.classList.add(fillClass);
  }
  current.innerHTML = active.innerHTML;
  current.title = active.title || '';
}

function bindNotebookFlyoutGrace(control) {
  if (!control) return;
  if (!control.__salesShopFlyoutOpen) {
    control.__salesShopFlyoutTimer = 0;
    control.__salesShopFlyoutOpen = ()=>{
      clearTimeout(control.__salesShopFlyoutTimer);
      control.classList.add('flyout-open');
    };
    control.__salesShopFlyoutClose = ()=>{
      clearTimeout(control.__salesShopFlyoutTimer);
      control.__salesShopFlyoutTimer = setTimeout(()=>{
        if (control.matches(':hover') || control.matches(':focus-within')) return;
        control.classList.remove('flyout-open');
      },NOTEBOOK_FLYOUT_CLOSE_DELAY);
    };
    control.addEventListener('pointerenter',control.__salesShopFlyoutOpen);
    control.addEventListener('pointerleave',control.__salesShopFlyoutClose);
    control.addEventListener('focusin',control.__salesShopFlyoutOpen);
    control.addEventListener('focusout',control.__salesShopFlyoutClose);
  }

  $$('button',control).forEach(button=>{
    if (button.dataset.stableFlyoutHoverBound) return;
    button.dataset.stableFlyoutHoverBound = '1';
    button.addEventListener('pointerenter',control.__salesShopFlyoutOpen);
    button.addEventListener('pointerleave',control.__salesShopFlyoutClose);
  });
}

function installNotebookStableFlyouts(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-align-control,.spatial-number-format-control,.spatial-fill-control',root).forEach(control=>{
    syncNotebookFlyoutCurrent(control);
    bindNotebookFlyoutGrace(control);
  });
}

function stableNotebookMergeGlyph(controls) {
  const button = controls ? $('.spatial-table-merge-button.spatial-table-merge-icon-button',controls) : null;
  if (!button) return;
  button.title = 'Merge selected cells';
  button.setAttribute('aria-label','Merge selected cells');
  button.innerHTML = `
    <span class="spatial-table-merge-glyph inward" aria-hidden="true">
      <svg viewBox="0 0 18 18" focusable="false">
        <path d="M1.8 5.8V1.8h4M1.8 1.8l5 5M6.8 4.2v2.6H4.2" />
        <path d="M16.2 5.8V1.8h-4M16.2 1.8l-5 5M11.2 4.2v2.6h2.6" />
        <path d="M1.8 12.2v4h4M1.8 16.2l5-5M6.8 13.8v-2.6H4.2" />
        <path d="M16.2 12.2v4h-4M16.2 16.2l-5-5M11.2 13.8v-2.6h2.6" />
      </svg>
    </span>`;
}

/* Future table-control redraws pass through here, so the Merge icon and flyout behavior remain
   correct after selecting a different cell/range or changing table structure. */
if (typeof advancedSpatialTableControls === 'function' && !window.__salesShopStableTableMenus) {
  window.__salesShopStableTableMenus = true;
  const _stableTableControls = advancedSpatialTableControls;
  advancedSpatialTableControls = function(object) {
    const controls = _stableTableControls(object);
    stableNotebookMergeGlyph(controls);
    $$('.spatial-align-control,.spatial-number-format-control,.spatial-fill-control',controls).forEach(control=>{
      syncNotebookFlyoutCurrent(control);
      bindNotebookFlyoutGrace(control);
    });
    return controls;
  };
}

function installNotebookMenuStability(root) {
  if (!root) return;
  stableNotebookPositionOrder(root);
  installNotebookStableFlyouts(root);
  $$('.spatial-table-controls',root).forEach(stableNotebookMergeGlyph);
}

const _salesShopMenuStabilityRender = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopMenuStabilityRender(root);
  if (!root) return;
  installNotebookMenuStability(root);
};
