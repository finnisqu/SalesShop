/* Spatial table layout defaults: two notebook grid squares per logical column. */

const SPATIAL_TABLE_DEFAULT_COL_SQUARES = 2;

function spatialTableColumnSquares(object) {
  if (!object || object.type !== 'table') return 1;
  let value = Math.round(Number(object.cellWidthSquares));
  if (!Number.isFinite(value) || value < 1) {
    value = SPATIAL_TABLE_DEFAULT_COL_SQUARES;
    object.cellWidthSquares = value;
    /* This also migrates existing prototype tables so old/new tables remain visually consistent. */
    save();
  }
  return Math.max(1,Math.min(8,value));
}

/* Keep the logical table model (rows/cols, merges, formulas later) separate from its physical
   notebook footprint. One logical column currently occupies two spatial-grid squares. */
const _salesShopTableLayoutRenderObject = renderSpatialObject;
renderSpatialObject = function(object,canvas) {
  _salesShopTableLayoutRenderObject(object,canvas);
  if (!object || object.type !== 'table') return;
  const escaped=(window.CSS&&CSS.escape)?CSS.escape(object.id):object.id;
  const wrap=canvas?.querySelector?.(`[data-spatial-object-id="${escaped}"]`);
  if (!wrap) return;
  const colSquares=spatialTableColumnSquares(object);
  wrap.style.setProperty('--object-cols',Math.max(1,Number(object.cols)||1) * colSquares);
  wrap.dataset.tableColumnSquares=String(colSquares);
};
