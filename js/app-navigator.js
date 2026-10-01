/* Lightweight per-tab navigator rails.
   Memory already owns a real explorer nav; Board and Quotes get small rails that can grow later. */

function boardNavigatorHtml() {
  const mode = state.settings?.boardMode || 'projects';
  return `
    <aside class="section-navigator" data-section-navigator="board">
      <div class="section-navigator-title">Board</div>
      <button class="section-nav-item ${mode==='projects'?'active':''}" data-nav-board-mode="projects">Projects</button>
      <button class="section-nav-item ${mode==='accounts'?'active':''}" data-nav-board-mode="accounts">Accounts</button>
      <div class="section-nav-divider"></div>
      <div class="section-nav-placeholder">Saved views can live here later.</div>
    </aside>`;
}

function quoteNavigatorHtml() {
  return `
    <aside class="section-navigator" data-section-navigator="quotes">
      <div class="section-navigator-title">Quotes</div>
      <button class="section-nav-item active" data-quote-nav="all">All quotes <span>${state.quotes.length}</span></button>
      <button class="section-nav-item" data-quote-nav="new">+ New quote</button>
      <div class="section-nav-divider"></div>
      <div class="section-nav-placeholder">Filters and saved quote views can live here later.</div>
    </aside>`;
}

function installSectionNavigator(viewName,html) {
  const view = $(`#view-${viewName}`);
  if (!view) return;
  view.classList.add('has-section-navigator');
  view.querySelector(':scope > .section-navigator')?.remove();
  view.insertAdjacentHTML('afterbegin',html);
}

function bindAppNavigatorActions() {
  $$('[data-nav-board-mode]').forEach(btn=>btn.onclick=()=>{
    state.settings.boardMode=btn.dataset.navBoardMode;
    save();
    renderBoard();
  });
  $('[data-quote-nav="new"]')?.addEventListener('click',()=>createBlankQuote());
}

function installAppNavigators() {
  installSectionNavigator('board',boardNavigatorHtml());
  installSectionNavigator('quotes',quoteNavigatorHtml());
  bindAppNavigatorActions();
}

/* Board and Quotes sometimes re-render without using renderAll(), so keep their rails attached there too. */
const _salesShopNavigatorRenderBoard = renderBoard;
renderBoard = function() {
  _salesShopNavigatorRenderBoard();
  installSectionNavigator('board',boardNavigatorHtml());
  bindAppNavigatorActions();
};

const _salesShopNavigatorRenderQuotes = renderQuotes;
renderQuotes = function() {
  _salesShopNavigatorRenderQuotes();
  installSectionNavigator('quotes',quoteNavigatorHtml());
  bindAppNavigatorActions();
};

const _salesShopNavigatorRenderAll = renderAll;
renderAll = function() {
  _salesShopNavigatorRenderAll();
  installAppNavigators();
};
