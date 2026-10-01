/* Notebook paper/layout polish.
   Keeps notebook controls physical and minimal while preserving page scroll across app renders. */

const notebookPageScrollPositions = new Map();

function notebookLayoutKey() {
  return `${currentNotebookDate || dateKey()}::${currentNotebookPageId || 'page'}::${notebookPaperView?.() || 'blank'}`;
}

function notebookWidthMode() {
  const mode = state.settings?.notebookWidthMode || 'full';
  return mode === 'medium' ? 'medium' : 'full';
}

function applyNotebookWidthMode(root) {
  const shell = $('.notebook-shell', root);
  if (!shell) return;
  const mode = notebookWidthMode();
  shell.classList.toggle('notebook-width-medium', mode === 'medium');
  shell.classList.toggle('notebook-width-full', mode === 'full');
  $$('[data-notebook-width]', root).forEach(btn => {
    const active = btn.dataset.notebookWidth === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function installNotebookWidthControls(root) {
  const toolbar = $('.notebook-toolbar', root);
  const actions = $('.notebook-toolbar-actions', root);
  if (!toolbar || !actions) return;

  let controls = $('[data-notebook-width-controls]', toolbar);
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'notebook-width-controls';
    controls.dataset.notebookWidthControls = '';
    controls.innerHTML = `
      <button type="button" class="notebook-width-button" data-notebook-width="medium" title="Medium page width" aria-label="Medium page width">
        <span class="notebook-width-glyph medium"></span>
      </button>
      <button type="button" class="notebook-width-button" data-notebook-width="full" title="Full page width" aria-label="Full page width">
        <span class="notebook-width-glyph full"></span>
      </button>`;
    toolbar.insertBefore(controls, actions);
  }

  $$('[data-notebook-width]', controls).forEach(btn => {
    btn.onclick = () => {
      state.settings.notebookWidthMode = btn.dataset.notebookWidth === 'medium' ? 'medium' : 'full';
      save();
      applyNotebookWidthMode(root);
    };
  });
  applyNotebookWidthMode(root);
}

function moveNotebookToolsIntoPaper(root) {
  const head = $('.notebook-paper-head', root);
  const date = $('.notebook-date', head);
  const toolbarLeft = $('.notebook-toolbar-left', root);
  if (!head || !date || !toolbarLeft) return;

  let headTools = $('.notebook-paper-head-tools', head);
  if (!headTools) {
    headTools = document.createElement('div');
    headTools.className = 'notebook-paper-head-tools';
    date.insertAdjacentElement('afterend', headTools);
  }

  const mic = $('[data-mic]', toolbarLeft);
  const attach = $('[data-attach]', toolbarLeft);
  const fileInput = $('[data-file-input]', toolbarLeft);
  if (mic) headTools.appendChild(mic);
  if (attach) headTools.appendChild(attach);
  if (fileInput) headTools.appendChild(fileInput);

  /* The old Today label was just a label. The date printed on the paper already says more. */
  $('.notebook-toolbar-date', toolbarLeft)?.remove();
}

function normalizeNotebookToolbar(root) {
  const actions = $('.notebook-toolbar-actions', root);
  if (!actions) return;
  $$(':scope > .notebook-tool, :scope > .notebook-view-wrap > .notebook-tool', actions).forEach(btn => {
    btn.classList.add('notebook-toolbar-button');
  });
}

function restoreNotebookPaperScroll(root) {
  const page = $('.notebook-page', root);
  if (!page) return;
  const key = notebookLayoutKey();
  const saved = notebookPageScrollPositions.get(key) || 0;
  page.scrollTop = saved;
  page.addEventListener('scroll', () => {
    notebookPageScrollPositions.set(key, page.scrollTop);
  }, {passive:true});
}

/* Prevent the recent-history strip from visibly gliding down again on every global render. */
scrollNotebookEntriesToBottom = function(root) {
  const entries = $('[data-notebook-entries]', root);
  if (entries) entries.scrollTop = entries.scrollHeight;
};

const _salesShopRenderNotebookLayout = renderNotebookSurface;
renderNotebookSurface = function(root) {
  _salesShopRenderNotebookLayout(root);
  if (!root) return;
  moveNotebookToolsIntoPaper(root);
  installNotebookWidthControls(root);
  normalizeNotebookToolbar(root);

  /* Put recent history at its resting position before the scheduled legacy scroll runs. */
  const entries = $('[data-notebook-entries]', root);
  if (entries) entries.scrollTop = entries.scrollHeight;

  restoreNotebookPaperScroll(root);
};
