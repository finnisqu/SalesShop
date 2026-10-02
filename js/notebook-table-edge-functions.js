/* Opposite-edge table resizing + tolerant lightweight functions.
   Shift-clicking a row/column +/- edits the leading edge; normal clicks keep editing the trailing edge. */

function remapSpatialCellKeyMap(map,{rowDelta=0,colDelta=0,dropRow=null,dropCol=null}={}) {
  const out={};
  Object.entries(map||{}).forEach(([key,value])=>{
    const parts=String(key).split(':').map(Number);
    if (parts.length!==2 || !parts.every(Number.isFinite)) return;
    let [r,c]=parts;
    if (dropRow!=null && r===dropRow) return;
    if (dropCol!=null && c===dropCol) return;
    if (dropRow!=null && r>dropRow) r--;
    else r+=rowDelta;
    if (dropCol!=null && c>dropCol) c--;
    else c+=colDelta;
    if (r<0 || c<0) return;
    out[spatialCellKey(r,c)]={...value};
  });
  return out;
}

function remapNotebookFormulaKey(key,{rowDelta=0,colDelta=0,dropRow=null,dropCol=null}={}) {
  const {r:rawR,c:rawC}=notebookFunctionCellCoords?.(key) || {r:0,c:0};
  let r=rawR,c=rawC;
  if (dropRow!=null && r===dropRow) return null;
  if (dropCol!=null && c===dropCol) return null;
  if (dropRow!=null && r>dropRow) r--;
  else r+=rowDelta;
  if (dropCol!=null && c>dropCol) c--;
  else c+=colDelta;
  if (r<0 || c<0) return null;
  return notebookFunctionCellKey(r,c);
}

function remapNotebookCellFormulas(formulas,options={}) {
  const out={};
  Object.entries(formulas||{}).forEach(([targetKey,formula])=>{
    const nextTarget=remapNotebookFormulaKey(targetKey,options);
    if (!nextTarget || !formula) return;
    const nextSources=(formula.sources||[])
      .map(key=>remapNotebookFormulaKey(key,options))
      .filter(Boolean);
    out[nextTarget]={...formula,sources:nextSources};
  });
  return out;
}

function firstSpatialTableEdgeHasText(object,axis) {
  normalizeAdvancedSpatialTable?.(object);
  if (axis==='col') return (object.cells||[]).some(row=>String(row?.[0]??'').trim());
  return (object.cells?.[0]||[]).some(value=>String(value??'').trim());
}

function firstSpatialTableEdgeHitsMerge(object,axis) {
  normalizeAdvancedSpatialTable?.(object);
  return (object.merges||[]).some(merge=>axis==='col'
    ? merge.c===0
    : merge.r===0);
}

function shiftActiveTableSelectionForLeadingResize(object,axis,delta) {
  const selection=(typeof activeSpatialTableSelection!=='undefined') ? activeSpatialTableSelection : null;
  if (!selection || selection.objectId!==object.id) return;
  const shiftPoint=point=>{
    const next={...point};
    if (axis==='col') next.c=Math.max(0,next.c+(delta>0?1:-1));
    else next.r=Math.max(0,next.r+(delta>0?1:-1));
    return next;
  };
  activeSpatialTableSelection={...selection,start:shiftPoint(selection.start),end:shiftPoint(selection.end)};
}

function resizeSpatialTableLeadingEdge(object,axis,delta) {
  if (!object || object.type!=='table' || !['row','col'].includes(axis) || ![-1,1].includes(Math.sign(delta))) return;
  normalizeAdvancedSpatialTable?.(object);
  const adding=delta>0;

  if (axis==='row' && (object.tableTitleRow || object.tableHeaderRow)) {
    toast('Turn off Title/Header before changing the top edge.');
    return;
  }

  const colSquares=typeof spatialTableColumnSquares==='function' ? spatialTableColumnSquares(object) : 2;
  if (adding) {
    if (axis==='col' && (Number(object.col)||0)<colSquares) {
      toast('No room to add a column on the left.');
      return;
    }
    if (axis==='row' && (Number(object.row)||0)<1) {
      toast('No room to add a row above.');
      return;
    }
  } else {
    if (axis==='col' && object.cols<=1) return;
    if (axis==='row' && object.rows<=1) return;
    if (firstSpatialTableEdgeHasText(object,axis)) {
      toast(`Clear the first ${axis==='col'?'column':'row'} before removing it.`);
      return;
    }
    if (firstSpatialTableEdgeHitsMerge(object,axis)) {
      toast(`Split merged cells on the first ${axis==='col'?'column':'row'} before removing it.`);
      return;
    }
  }

  notebookPushUndoCheckpoint?.();

  if (adding && axis==='col') {
    object.cells.forEach(row=>row.unshift(''));
    object.cols++;
    object.merges=(object.merges||[]).map(merge=>({...merge,c:merge.c+1}));
    object.cellStyles=remapSpatialCellKeyMap(object.cellStyles,{colDelta:1});
    object.cellFormulas=remapNotebookCellFormulas(object.cellFormulas,{colDelta:1});
    object.col=Math.max(0,(Number(object.col)||0)-colSquares);
  } else if (adding && axis==='row') {
    object.cells.unshift(Array.from({length:object.cols},()=>''));
    object.rows++;
    object.merges=(object.merges||[]).map(merge=>({...merge,r:merge.r+1}));
    object.cellStyles=remapSpatialCellKeyMap(object.cellStyles,{rowDelta:1});
    object.cellFormulas=remapNotebookCellFormulas(object.cellFormulas,{rowDelta:1});
    object.row=Math.max(0,(Number(object.row)||0)-1);
  } else if (!adding && axis==='col') {
    object.cells.forEach(row=>row.shift());
    object.cols--;
    object.merges=(object.merges||[]).map(merge=>({...merge,c:merge.c-1})).filter(merge=>merge.c>=0);
    object.cellStyles=remapSpatialCellKeyMap(object.cellStyles,{dropCol:0});
    object.cellFormulas=remapNotebookCellFormulas(object.cellFormulas,{dropCol:0});
    object.col=(Number(object.col)||0)+colSquares;
  } else if (!adding && axis==='row') {
    object.cells.shift();
    object.rows--;
    object.merges=(object.merges||[]).map(merge=>({...merge,r:merge.r-1})).filter(merge=>merge.r>=0);
    object.cellStyles=remapSpatialCellKeyMap(object.cellStyles,{dropRow:0});
    object.cellFormulas=remapNotebookCellFormulas(object.cellFormulas,{dropRow:0});
    object.row=(Number(object.row)||0)+1;
  }

  shiftActiveTableSelectionForLeadingResize(object,axis,delta);
  normalizeAdvancedSpatialTable?.(object);
  ensureSemanticTableRows?.(object,{persist:false});
  object.updatedAt=new Date().toISOString();
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  recalcNotebookTableFormulas?.(object);
  save();
  renderAll();
}

/* Capture Shift-click before the existing +/- onclick handler. */
if (!window.__salesShopLeadingEdgeSteppers) {
  window.__salesShopLeadingEdgeSteppers=true;
  document.addEventListener('click',event=>{
    if (!event.shiftKey) return;
    const button=event.target?.closest?.('[data-table-cols],[data-table-rows]');
    if (!button) return;
    const wrap=button.closest('.spatial-object-table');
    const object=spatialObjectById?.(wrap?.dataset.spatialObjectId);
    if (!object) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.hasAttribute('data-table-cols')) {
      resizeSpatialTableLeadingEdge(object,'col',Number(button.dataset.tableCols));
    } else {
      resizeSpatialTableLeadingEdge(object,'row',Number(button.dataset.tableRows));
    }
  },true);
}

function installLeadingEdgeStepperHints(root=$('#notebookDock')) {
  if (!root) return;
  $$('[data-table-cols]',root).forEach(button=>{
    const add=Number(button.dataset.tableCols)>0;
    button.title=`${add?'Add':'Remove'} column · Shift: ${add?'add on left':'remove from left'}`;
  });
  $$('[data-table-rows]',root).forEach(button=>{
    const add=Number(button.dataset.tableRows)>0;
    button.title=`${add?'Add':'Remove'} row · Shift: ${add?'add above':'remove from top'}`;
  });
}

/* Functions accept blank/text source cells. Numeric values participate; other values are ignored.
   An all-nonnumeric SUM/PRODUCT returns 0, while AVERAGE returns N/A. */
notebookFunctionResult=function(type,values) {
  if (!Array.isArray(values) || !values.length) return type==='average' ? 'N/A' : 0;
  if (type==='sum') return values.reduce((a,b)=>a+b,0);
  if (type==='average') return values.reduce((a,b)=>a+b,0)/values.length;
  if (type==='product') return values.reduce((a,b)=>a*b,1);
  return 'N/A';
};

recalcNotebookTableFormulas=function(object) {
  if (!object || object.type!=='table' || !object.cellFormulas) return false;
  normalizeAdvancedSpatialTable?.(object);
  let changed=false;
  for (let pass=0;pass<4;pass++) {
    let passChanged=false;
    Object.entries(object.cellFormulas).forEach(([targetKey,formula])=>{
      if (!formula || !['sum','average','product'].includes(formula.type) || !Array.isArray(formula.sources)) return;
      const target=notebookFunctionCellCoords(targetKey);
      if (target.r<0 || target.c<0 || target.r>=object.rows || target.c>=object.cols) {
        delete object.cellFormulas[targetKey];
        changed=true;
        return;
      }
      const values=[];
      formula.sources.forEach(key=>{
        if (key===targetKey) return;
        const {r,c}=notebookFunctionCellCoords(key);
        if (r<0 || c<0 || r>=object.rows || c>=object.cols) return;
        const parsed=parseSpatialNumericValue?.(object.cells?.[r]?.[c]);
        if (parsed!=null && Number.isFinite(parsed)) values.push(parsed);
      });
      const result=notebookFunctionResult(formula.type,values);
      const clean=typeof result==='number'
        ? (Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8))))
        : String(result);
      if (String(object.cells?.[target.r]?.[target.c]??'')!==clean) {
        object.cells[target.r][target.c]=clean;
        passChanged=true;
        changed=true;
      }
    });
    if (!passChanged) break;
  }
  return changed;
};

commitNotebookFunctionPick=function() {
  const mode=notebookFunctionPickMode;
  if (!mode) return false;
  const object=spatialObjectById?.(mode.objectId);
  if (!object || object.type!=='table') { cancelNotebookFunctionPick?.(); return false; }
  const targetKey=notebookFunctionCellKey(mode.target.r,mode.target.c);
  const sources=[...mode.sources].filter(key=>key!==targetKey);
  if (!sources.length) {
    toast('Select at least one source cell.');
    return false;
  }

  notebookPushUndoCheckpoint?.();
  object.cellFormulas ||= {};
  object.cellFormulas[targetKey]={type:mode.type,sources};
  recalcNotebookTableFormulas(object);
  object.cellStyles ||= {};
  object.cellStyles[targetKey] ||= {};
  if (!object.cellStyles[targetKey].align) object.cellStyles[targetKey].align='right';
  object.updatedAt=new Date().toISOString();
  notebookFunctionPickMode=null;
  activeSpatialTableSelection={objectId:object.id,start:{...mode.target},end:{...mode.target}};
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  save();
  renderAll();
  return true;
};

const _edgeFunctionsRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _edgeFunctionsRender(root);
  if (!root) return;
  installLeadingEdgeStepperHints(root);
};
