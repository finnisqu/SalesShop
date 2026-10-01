/* Optional two-column presentation for Blank and Lines.
   This is deliberately view-only: notebook entries keep their normal storage/order. */

function notebookColumnMode() {
  return state.settings?.notebookColumnMode === 'two' ? 'two' : 'one';
}

function notebookColumnsEligible() {
  const style = notebookPaperView();
  return (style === 'blank' || style === 'lines') && notebookWidthMode() !== 'float';
}

function notebookColumnGlyph(kind) {
  return kind === 'two'
    ? '<span class="notebook-column-glyph two"><i></i><i></i></span>'
    : '<span class="notebook-column-glyph one"><i></i></span>';
}

function installNotebookColumnControls(root) {
  const widthControls = $('[data-notebook-width-controls]',root);
  if (!widthControls) return;

  let divider = $('[data-column-control-divider]',widthControls);
  if (!divider) {
    divider = document.createElement('span');
    divider.className = 'notebook-layout-control-divider';
    divider.dataset.columnControlDivider = '';
    widthControls.appendChild(divider);
  }

  let one = $('[data-notebook-columns="one"]',widthControls);
  if (!one) {
    one = document.createElement('button');
    one.type = 'button';
    one.className = 'notebook-width-button notebook-column-button';
    one.dataset.notebookColumns = 'one';
    one.title = 'One column';
    one.setAttribute('aria-label','One column');
    one.innerHTML = notebookColumnGlyph('one');
    widthControls.appendChild(one);
  }

  let two = $('[data-notebook-columns="two"]',widthControls);
  if (!two) {
    two = document.createElement('button');
    two.type = 'button';
    two.className = 'notebook-width-button notebook-column-button';
    two.dataset.notebookColumns = 'two';
    two.title = 'Two columns';
    two.setAttribute('aria-label','Two columns');
    two.innerHTML = notebookColumnGlyph('two');
    widthControls.appendChild(two);
  }

  $$('[data-notebook-columns]',widthControls).forEach(btn=>{
    btn.onclick = ()=>{
      state.settings ||= {};
      state.settings.notebookColumnMode = btn.dataset.notebookColumns === 'two' ? 'two' : 'one';
      save();
      renderAll();
    };
  });

  updateNotebookColumnControls(root);
}

function updateNotebookColumnControls(root) {
  const eligible = notebookColumnsEligible();
  const mode = notebookColumnMode();
  const widthControls = $('[data-notebook-width-controls]',root);
  if (!widthControls) return;

  $('[data-column-control-divider]',widthControls)?.classList.toggle('hidden',!eligible);
  $$('[data-notebook-columns]',widthControls).forEach(btn=>{
    btn.classList.toggle('hidden',!eligible);
    const active = eligible && btn.dataset.notebookColumns === mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  });
}

function clearNotebookColumnLayout(root) {
  const body = $('.notebook-page-body',root);
  const source = $('[data-notebook-entries]',root);
  const writing = $('.notebook-writing-zone',root);
  const layout = $('[data-notebook-column-layout]',root);
  if (!body || !layout) return;

  /* This path mostly matters when width mode changes without a full render. */
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
  updateNotebookColumnControls(root);
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
  updateNotebookColumnControls(root);
  applyNotebookColumnLayout(root);
};

const _salesShopColumnRenderNotebook = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopColumnRenderNotebook(root);
  if (!root) return;
  installNotebookColumnControls(root);
  applyNotebookColumnLayout(root);
};
