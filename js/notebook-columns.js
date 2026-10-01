/* Optional two-column presentation for Blank and Lines.
   This is deliberately view-only: notebook entries keep their normal storage/order.
   The toggle lives beside Blank / Lines inside the Style menu rather than in the main toolbar. */

function notebookColumnMode() {
  return state.settings?.notebookColumnMode === 'two' ? 'two' : 'one';
}

function notebookColumnsEligible() {
  const style = notebookPaperView();
  return (style === 'blank' || style === 'lines') && notebookWidthMode() !== 'float';
}

function notebookColumnGlyph(kind='two') {
  return kind === 'two'
    ? '<span class="notebook-column-glyph two" aria-hidden="true"><i></i><i></i></span>'
    : '<span class="notebook-column-glyph one" aria-hidden="true"><i></i></span>';
}

function installNotebookColumnStyleToggles(root) {
  const menu = $('[data-notebook-view-menu]',root);
  if (!menu) return;

  ['blank','lines'].forEach(style=>{
    const row = $(`[data-paper-view="${style}"]`,menu);
    if (!row || $('[data-style-columns]',row)) return;

    const toggle = document.createElement('span');
    toggle.className = 'notebook-style-column-toggle';
    toggle.dataset.styleColumns = style;
    toggle.setAttribute('role','button');
    toggle.setAttribute('tabindex','0');
    toggle.setAttribute('title','Two columns');
    toggle.setAttribute('aria-label',`Two columns for ${style} notebook`);
    toggle.innerHTML = notebookColumnGlyph('two');
    row.appendChild(toggle);

    const activate = e=>{
      e.preventDefault();
      e.stopPropagation();
      captureNotebookDraftBuffer(root);
      state.settings ||= {};
      const turningOff = notebookPaperView() === style && notebookColumnMode() === 'two';
      state.settings.notebookPaperView = style;
      state.settings.notebookColumnMode = turningOff ? 'one' : 'two';
      save();
      renderAll();
    };
    toggle.addEventListener('click',activate);
    toggle.addEventListener('keydown',e=>{
      if (e.key === 'Enter' || e.key === ' ') activate(e);
    });
  });

  updateNotebookColumnStyleToggles(root);
}

function updateNotebookColumnStyleToggles(root) {
  const mode = notebookColumnMode();
  const style = notebookPaperView();
  $$('[data-style-columns]',root).forEach(toggle=>{
    const eligibleStyle = toggle.dataset.styleColumns;
    const active = mode === 'two' && style === eligibleStyle && notebookWidthMode() !== 'float';
    toggle.classList.toggle('active',active);
    toggle.setAttribute('aria-pressed',String(active));
  });
}

function clearNotebookColumnLayout(root) {
  const body = $('.notebook-page-body',root);
  const source = $('[data-notebook-entries]',root);
  const writing = $('.notebook-writing-zone',root);
  const layout = $('[data-notebook-column-layout]',root);
  if (!body || !layout) return;

  const entries = $$('.notebook-entry',layout);
  entries.forEach(entry=>source?.appendChild(entry));
  if (writing && writing.parentElement !== body) body.appendChild(writing);
  layout.remove();
  source?.classList.remove('notebook-column-source');
}

function applyNotebookColumnLayout(root) {
  const shell = $('.notebook-shell',root);
  const body = $('.notebook-page-body',root);
  const source = $('[data-notebook-entries]',root);
  const writing = $('.notebook-writing-zone',root);
  if (!shell || !body || !source || !writing) return;

  clearNotebookColumnLayout(root);
  const active = notebookColumnsEligible() && notebookColumnMode() === 'two';
  shell.classList.toggle('notebook-columns-two',active);
  shell.classList.toggle('notebook-columns-one',!active);
  updateNotebookColumnStyleToggles(root);
  if (!active) return;

  const entries = $$('.notebook-entry',source);
  const layout = document.createElement('div');
  layout.className = 'notebook-two-column-layout';
  layout.dataset.notebookColumnLayout = '';
  const left = document.createElement('div');
  left.className = 'notebook-page-column notebook-page-column-left';
  const right = document.createElement('div');
  right.className = 'notebook-page-column notebook-page-column-right';
  layout.append(left,right);

  /* Keep whole notebook objects intact. The first half reads down the left column;
     the second half continues on the right, with live writing at the end of the flow. */
  if (!entries.length) {
    left.appendChild(writing);
  } else {
    const split = Math.ceil(entries.length / 2);
    entries.forEach((entry,index)=>(index < split ? left : right).appendChild(entry));
    right.appendChild(writing);
  }

  source.classList.add('notebook-column-source');
  source.insertAdjacentElement('afterend',layout);
}

/* Width changes can happen without a global render. Float temporarily forces one-column,
   while the saved preference returns automatically when the sheet is redocked. */
const _salesShopColumnApplyWidth = applyNotebookWidthMode;
applyNotebookWidthMode = function(root) {
  _salesShopColumnApplyWidth(root);
  if (!root) return;
  applyNotebookColumnLayout(root);
  updateNotebookColumnStyleToggles(root);
};

const _salesShopColumnRenderNotebook = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopColumnRenderNotebook(root);
  if (!root) return;
  installNotebookColumnStyleToggles(root);
  applyNotebookColumnLayout(root);
};
