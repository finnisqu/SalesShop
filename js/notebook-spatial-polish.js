/* Follow-up for the spatial notebook foundation. */

function polishSpatialStyleActiveState(root) {
  const menu=$('[data-notebook-view-menu]',root);
  if (!menu) return;
  const spatialActive=!!$('[data-spatial-paper].active',menu);
  const linedActive=!!$('[data-lined-style].active',menu) && !spatialActive;
  if (spatialActive) $$('[data-lined-style]',menu).forEach(el=>el.classList.remove('active'));
  if (linedActive) $$('[data-spatial-paper]',menu).forEach(el=>el.classList.remove('active'));
}

function sizeSpatialCanvasToObjects(root) {
  if (notebookPaperView()!=='grid') return;
  const canvas=$('.grid-notebook-canvas',root);
  const page=$('.notebook-page',root);
  if (!canvas || !page) return;
  requestAnimationFrame(()=>{
    const step=spatialStep();
    const visibleWidth=Math.max(280,page.clientWidth-42);
    let right=0;
    let bottom=0;
    $$('.grid-note,.grid-editor-wrap,.notebook-spatial-object',canvas).forEach(el=>{
      right=Math.max(right,el.offsetLeft+Math.max(el.offsetWidth,el.scrollWidth||0));
      bottom=Math.max(bottom,el.offsetTop+Math.max(el.offsetHeight,el.scrollHeight||0));
    });
    const neededWidth=Math.max(visibleWidth,right?right+step*2:0);
    const neededHeight=Math.max(720,bottom?bottom+step*4:0);
    canvas.style.width=`${Math.ceil(neededWidth/step)*step}px`;
    canvas.style.minHeight=`${Math.ceil(neededHeight/step)*step}px`;
  });
}

/* Include construction objects in notebook Undo / Redo snapshots. */
if (typeof notebookHistorySnapshot === 'function' && !window.__salesShopSpatialUndo) {
  window.__salesShopSpatialUndo=true;
  const _spatialHistorySnapshot=notebookHistorySnapshot;
  notebookHistorySnapshot=function() {
    const parsed=JSON.parse(_spatialHistorySnapshot());
    parsed.notebookSpatialObjectsByPage=state.settings?.notebookSpatialObjectsByPage || {};
    return JSON.stringify(parsed);
  };

  const _spatialRestoreSnapshot=restoreNotebookHistorySnapshot;
  restoreNotebookHistorySnapshot=function(snapshot) {
    try {
      const parsed=JSON.parse(snapshot);
      state.settings ||= {};
      state.settings.notebookSpatialObjectsByPage=parsed.notebookSpatialObjectsByPage || {};
    } catch {}
    return _spatialRestoreSnapshot(snapshot);
  };
}

const _salesShopSpatialPolishRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _salesShopSpatialPolishRender(root);
  if (!root) return;
  polishSpatialStyleActiveState(root);
  sizeSpatialCanvasToObjects(root);
};
