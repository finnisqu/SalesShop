/* Inspectable / editable notebook table formulas.
   A formula cell behaves like a restrained spreadsheet: click to inspect references; F2 or
   double-click to edit the existing source set using the normal range-selection interaction. */

let notebookFormulaInspection = null;

function notebookColumnLabel(index) {
  let n=Math.max(0,Number(index)||0)+1;
  let out='';
  while (n>0) {
    n--;
    out=String.fromCharCode(65+(n%26))+out;
    n=Math.floor(n/26);
  }
  return out;
}

function notebookCellReference(r,c) {
  return `${notebookColumnLabel(c)}${Math.max(0,Number(r)||0)+1}`;
}

function notebookFormulaSourceGroups(sourceKeys=[]) {
  const coords=[...new Set((sourceKeys||[]).map(String))]
    .map(key=>({key,...(notebookFunctionCellCoords?.(key)||{r:0,c:0})}))
    .filter(({r,c})=>Number.isFinite(r)&&Number.isFinite(c));
  const remaining=new Map(coords.map(item=>[item.key,item]));
  const groups=[];

  /* Prefer vertical runs first; this mirrors the most common SUM-column use case. */
  const byCol=new Map();
  coords.forEach(item=>{
    if (!byCol.has(item.c)) byCol.set(item.c,[]);
    byCol.get(item.c).push(item);
  });
  [...byCol.values()].forEach(items=>{
    items.sort((a,b)=>a.r-b.r);
    let run=[];
    const flush=()=>{
      if (run.length>=2) {
        groups.push(`${notebookCellReference(run[0].r,run[0].c)}:${notebookCellReference(run.at(-1).r,run.at(-1).c)}`);
        run.forEach(item=>remaining.delete(item.key));
      }
      run=[];
    };
    items.forEach(item=>{
      if (!run.length || item.r===run.at(-1).r+1) run.push(item);
      else { flush(); run=[item]; }
    });
    flush();
  });

  /* Then collapse any remaining horizontal runs. */
  const leftovers=[...remaining.values()];
  const byRow=new Map();
  leftovers.forEach(item=>{
    if (!byRow.has(item.r)) byRow.set(item.r,[]);
    byRow.get(item.r).push(item);
  });
  [...byRow.values()].forEach(items=>{
    items.sort((a,b)=>a.c-b.c);
    let run=[];
    const flush=()=>{
      if (run.length>=2) {
        groups.push(`${notebookCellReference(run[0].r,run[0].c)}:${notebookCellReference(run.at(-1).r,run.at(-1).c)}`);
        run.forEach(item=>remaining.delete(item.key));
      }
      run=[];
    };
    items.forEach(item=>{
      if (!run.length || item.c===run.at(-1).c+1) run.push(item);
      else { flush(); run=[item]; }
    });
    flush();
  });

  [...remaining.values()]
    .sort((a,b)=>a.r-b.r||a.c-b.c)
    .forEach(item=>groups.push(notebookCellReference(item.r,item.c)));
  return groups;
}

function notebookFormulaDisplay(formula) {
  if (!formula) return '';
  const names={sum:'SUM',average:'AVERAGE',product:'PRODUCT'};
  const name=names[formula.type]||String(formula.type||'').toUpperCase();
  return `=${name}(${notebookFormulaSourceGroups(formula.sources||[]).join(', ')})`;
}

function notebookFormulaForCell(object,r,c) {
  if (!object?.cellFormulas) return null;
  const merge=spatialMergeCovering?.(object,r,c);
  const key=notebookFunctionCellKey(merge?.r??r,merge?.c??c);
  return {key,target:{r:merge?.r??r,c:merge?.c??c},formula:object.cellFormulas[key]||null};
}

function clearNotebookFormulaInspection(root=$('#notebookDock')) {
  notebookFormulaInspection=null;
  if (!root) return;
  $$('.notebook-formula-source-preview,.notebook-formula-result-preview',root).forEach(cell=>{
    cell.classList.remove('notebook-formula-source-preview','notebook-formula-result-preview');
  });
  $$('.table-formula-inspector',root).forEach(el=>el.remove());
}

function renderNotebookFormulaInspection(root=$('#notebookDock')) {
  if (!root) return;
  $$('.notebook-formula-source-preview,.notebook-formula-result-preview',root).forEach(cell=>{
    cell.classList.remove('notebook-formula-source-preview','notebook-formula-result-preview');
  });
  $$('.table-formula-inspector',root).forEach(el=>el.remove());
  if (!notebookFormulaInspection || (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode)) return;

  const {objectId,targetKey}=notebookFormulaInspection;
  const object=spatialObjectById?.(objectId);
  const formula=object?.cellFormulas?.[targetKey];
  if (!object || !formula) { notebookFormulaInspection=null; return; }
  const wrap=root.querySelector(`[data-spatial-object-id="${objectId}"]`);
  if (!wrap) return;
  const target=notebookFunctionCellCoords(targetKey);
  const targetCell=notebookTableCellAt?.($('.spatial-table',wrap),target.r,target.c)
    || wrap.querySelector(`td[data-spatial-row="${target.r}"][data-spatial-col="${target.c}"]`);
  targetCell?.classList.add('notebook-formula-result-preview');

  (formula.sources||[]).forEach(key=>{
    const {r,c}=notebookFunctionCellCoords(key);
    const td=notebookTableCellAt?.($('.spatial-table',wrap),r,c)
      || wrap.querySelector(`td[data-spatial-row="${r}"][data-spatial-col="${c}"]`);
    td?.classList.add('notebook-formula-source-preview');
  });

  if (!targetCell) return;
  const chip=document.createElement('button');
  chip.type='button';
  chip.className='table-formula-inspector';
  chip.title='Double-click or press F2 to edit formula references';
  chip.innerHTML=`<span class="table-formula-inspector-fx" aria-hidden="true">ƒx</span><span>${notebookFormulaDisplay(formula)}</span>`;
  const wrapRect=wrap.getBoundingClientRect();
  const cellRect=targetCell.getBoundingClientRect();
  const pageRect=wrap.closest('.notebook-page')?.getBoundingClientRect();
  const down=!!(pageRect && cellRect.top-pageRect.top<44);
  chip.style.left=`${Math.round((cellRect.left+cellRect.right)/2-wrapRect.left)}px`;
  chip.style.top=`${Math.round((down?cellRect.bottom:cellRect.top)-wrapRect.top)}px`;
  chip.classList.toggle('below',down);
  chip.onclick=event=>{ event.preventDefault(); event.stopPropagation(); };
  chip.ondblclick=event=>{
    event.preventDefault(); event.stopPropagation();
    beginExistingNotebookFormulaEdit(object,targetKey);
  };
  wrap.appendChild(chip);
}

function inspectNotebookFormulaCell(td,object) {
  if (!td || !object || (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode)) return;
  const r=Number(td.dataset.spatialRow)||0;
  const c=Number(td.dataset.spatialCol)||0;
  const info=notebookFormulaForCell(object,r,c);
  if (!info?.formula) {
    if (notebookFormulaInspection?.objectId===object.id) clearNotebookFormulaInspection();
    return;
  }
  notebookFormulaInspection={objectId:object.id,targetKey:info.key};
  renderNotebookFormulaInspection();
}

function beginExistingNotebookFormulaEdit(object,targetKey) {
  const formula=object?.cellFormulas?.[targetKey];
  if (!object || !formula || !['sum','average','product'].includes(formula.type)) return false;
  const target=notebookFunctionCellCoords(targetKey);
  notebookFormulaInspection={objectId:object.id,targetKey};
  activeSpatialTableSelection={objectId:object.id,start:{...target},end:{...target}};
  notebookFunctionPickMode={
    objectId:object.id,
    type:formula.type,
    target:{...target},
    sources:new Set(formula.sources||[]),
    editingExisting:true
  };
  selectedSpatialObjectId=object.id;
  if (typeof openSpatialFormatObjectId!=='undefined') openSpatialFormatObjectId=object.id;
  const wrap=$(`#notebookDock [data-spatial-object-id="${object.id}"]`);
  if (wrap) {
    wrap.classList.add('is-selected','format-open');
    paintSpatialTableSelection?.($('.spatial-table',wrap),object);
  }
  syncNotebookFunctionModeUi?.();
  renderNotebookFormulaInspection();
  return true;
}

/* Formula cells get a tiny passive marker and inspection/re-entry behavior. */
function installNotebookFormulaCellBehavior(root=$('#notebookDock')) {
  if (!root) return;
  $$('.spatial-object-table',root).forEach(wrap=>{
    const object=spatialObjectById?.(wrap.dataset.spatialObjectId);
    if (!object) return;
    $$('td',wrap).forEach(td=>{
      const r=Number(td.dataset.spatialRow)||0;
      const c=Number(td.dataset.spatialCol)||0;
      const info=notebookFormulaForCell(object,r,c);
      td.classList.toggle('has-notebook-formula',!!info?.formula);
      if (td.dataset.formulaInspectBound) return;
      td.dataset.formulaInspectBound='1';
      td.addEventListener('focusin',()=>inspectNotebookFormulaCell(td,object));
      td.addEventListener('click',()=>inspectNotebookFormulaCell(td,object));
      td.addEventListener('dblclick',event=>{
        const current=notebookFormulaForCell(object,r,c);
        if (!current?.formula) return;
        event.preventDefault();
        event.stopPropagation();
        beginExistingNotebookFormulaEdit(object,current.key);
      });
    });
  });
  renderNotebookFormulaInspection(root);
}

if (!window.__salesShopFormulaInspectionKeys) {
  window.__salesShopFormulaInspectionKeys=true;
  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.isComposing || event.key!=='F2') return;
    const td=document.activeElement?.closest?.('.spatial-object-table td');
    if (!td) return;
    const wrap=td.closest('.spatial-object-table');
    const object=spatialObjectById?.(wrap?.dataset.spatialObjectId);
    if (!object) return;
    const info=notebookFormulaForCell(object,Number(td.dataset.spatialRow)||0,Number(td.dataset.spatialCol)||0);
    if (!info?.formula) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginExistingNotebookFormulaEdit(object,info.key);
  },true);

  document.addEventListener('pointerdown',event=>{
    if (!notebookFormulaInspection || (typeof notebookFunctionPickMode!=='undefined' && notebookFunctionPickMode)) return;
    if (event.target?.closest?.('.spatial-object-table td,.table-formula-inspector,.spatial-table-controls')) return;
    clearNotebookFormulaInspection();
  },true);
}

/* Keep inspection on the result after committing/canceling an existing formula edit. */
if (typeof commitNotebookFunctionPick==='function' && !window.__salesShopFormulaCommitInspection) {
  window.__salesShopFormulaCommitInspection=true;
  const _formulaCommit=commitNotebookFunctionPick;
  commitNotebookFunctionPick=function() {
    const mode=notebookFunctionPickMode;
    const result=_formulaCommit();
    if (result && mode?.objectId && mode?.target) {
      notebookFormulaInspection={objectId:mode.objectId,targetKey:notebookFunctionCellKey(mode.target.r,mode.target.c)};
      setTimeout(()=>renderNotebookFormulaInspection(),0);
    }
    return result;
  };
}

if (typeof cancelNotebookFunctionPick==='function' && !window.__salesShopFormulaCancelInspection) {
  window.__salesShopFormulaCancelInspection=true;
  const _formulaCancel=cancelNotebookFunctionPick;
  cancelNotebookFunctionPick=function() {
    const mode=notebookFunctionPickMode;
    if (mode?.editingExisting) notebookFormulaInspection={objectId:mode.objectId,targetKey:notebookFunctionCellKey(mode.target.r,mode.target.c)};
    const result=_formulaCancel();
    setTimeout(()=>renderNotebookFormulaInspection(),0);
    return result;
  };
}

const _formulaEditRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  _formulaEditRender(root);
  if (!root) return;
  installNotebookFormulaCellBehavior(root);
};
