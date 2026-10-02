/* Canonical Binder roster.
   Legacy notebook/split layers are allowed to mutate their compatibility keys during render,
   but they never own which pages are actually open. This file is loaded last and stores the
   authoritative Binder roster in notebookBinderRosterV3, a key no older layer knows about. */

const NOTEBOOK_BINDER_ROSTER_KEY='notebookBinderRosterV3';
const NOTEBOOK_BINDER_ROSTER_READY='notebookBinderRosterV3Ready';
const NOTEBOOK_BINDER_ROSTER_MAX=6;

function canonicalBinderRef(ref) {
  if (!ref?.key || !ref?.pageId) return null;
  return {key:String(ref.key),pageId:String(ref.pageId),id:`${ref.key}::${ref.pageId}`};
}
function canonicalBinderRefFromId(id) {
  const text=String(id||'');
  const at=text.indexOf('::');
  if (at<1 || at>=text.length-2) return null;
  return canonicalBinderRef({key:text.slice(0,at),pageId:text.slice(at+2)});
}
function canonicalBinderUnique(refs) {
  const seen=new Set();
  return (refs||[]).map(canonicalBinderRef).filter(Boolean).filter(ref=>{
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  }).slice(0,NOTEBOOK_BINDER_ROSTER_MAX);
}
function canonicalBinderCurrent() {
  return canonicalBinderRef({key:currentNotebookDate,pageId:currentNotebookPageId});
}

function canonicalBinderBootstrap() {
  state.settings ||= {};
  let existing=Array.isArray(state.settings[NOTEBOOK_BINDER_ROSTER_KEY])
    ? canonicalBinderUnique(state.settings[NOTEBOOK_BINDER_ROSTER_KEY])
    : [];

  if (!state.settings[NOTEBOOK_BINDER_ROSTER_READY]) {
    const candidates=[...existing];
    const add=ref=>{ const normalized=canonicalBinderRef(ref); if (normalized) candidates.push(normalized); };

    (state.settings.notebookBinderOpenPages||[]).forEach(add);
    (state.settings.notebookOpenPageOrder||[]).forEach(item=>{
      if (typeof item==='string') add(canonicalBinderRefFromId(item));
      else add(item);
    });
    (state.settings.notebookBinderSpread||[]).forEach(item=>{
      if (typeof item==='string') add(canonicalBinderRefFromId(item));
      else add(item);
    });
    add(state.settings.notebookReferencePage);
    add(canonicalBinderCurrent());
    try { add(notebookWorkingPageState?.()); } catch {}

    /* If the old UI still has tabs at first load, harvest them before retiring that UI. */
    try {
      $$('#notebookDock [data-binder-page]').forEach(node=>add(canonicalBinderRefFromId(node.dataset.binderPage)));
    } catch {}

    existing=canonicalBinderUnique(candidates);
    state.settings[NOTEBOOK_BINDER_ROSTER_READY]=true;
  }

  const current=canonicalBinderCurrent();
  if (current && !existing.some(ref=>ref.id===current.id) && existing.length<NOTEBOOK_BINDER_ROSTER_MAX) {
    existing.push(current);
  }
  if (!existing.length && current) existing=[current];

  state.settings[NOTEBOOK_BINDER_ROSTER_KEY]=existing.map(({key,pageId})=>({key,pageId}));
  return existing;
}

function canonicalBinderRoster() {
  state.settings ||= {};
  let roster=Array.isArray(state.settings[NOTEBOOK_BINDER_ROSTER_KEY])
    ? canonicalBinderUnique(state.settings[NOTEBOOK_BINDER_ROSTER_KEY])
    : [];
  if (!state.settings[NOTEBOOK_BINDER_ROSTER_READY]) roster=canonicalBinderBootstrap();

  const current=canonicalBinderCurrent();
  if (current && !roster.some(ref=>ref.id===current.id) && roster.length<NOTEBOOK_BINDER_ROSTER_MAX) {
    roster.push(current);
    state.settings[NOTEBOOK_BINDER_ROSTER_KEY]=roster.map(({key,pageId})=>({key,pageId}));
  }
  return roster;
}

function canonicalBinderWrite(roster,{persist=false}={}) {
  state.settings ||= {};
  let next=canonicalBinderUnique(roster);
  const current=canonicalBinderCurrent();
  if (!next.length && current) next=[current];
  state.settings[NOTEBOOK_BINDER_ROSTER_KEY]=next.map(({key,pageId})=>({key,pageId}));
  state.settings[NOTEBOOK_BINDER_ROSTER_READY]=true;
  canonicalBinderMirrorCompatibility(next);
  if (persist) save();
  return next;
}

function canonicalBinderMirrorCompatibility(roster=canonicalBinderRoster()) {
  state.settings ||= {};
  const next=canonicalBinderUnique(roster);
  const current=canonicalBinderCurrent();
  state.settings.notebookBinderOpenPages=next.map(({key,pageId})=>({key,pageId}));
  state.settings.notebookOpenPageOrder=next.map(ref=>ref.id);
  state.settings.notebookBinderDisplayMode='single';
  state.settings.notebookBinderActiveSide='left';
  state.settings.notebookBinderSpread=current?[current.id]:[];
  delete state.settings.notebookReferencePage;
  delete state.settings.notebookPaperFront;
  delete state.settings.notebookPaperLayout;
  return next;
}

/* All Binder readers now read the private canonical roster. */
singleBinderOpenPages=function(){ return canonicalBinderRoster(); };
notebookBinderOpenPages=function(){ return canonicalBinderRoster(); };
notebookBinderPageById=function(id){ return canonicalBinderRoster().find(ref=>ref.id===id)||null; };
notebookBinderActiveRef=function(){ return canonicalBinderCurrent(); };
notebookBinderSpread=function(){ const current=canonicalBinderCurrent(); return current?[current.id]:[]; };
notebookBinderFacingRef=function(){ return null; };
notebookBinderDisplayMode=function(){ return 'single'; };
syncNotebookBinderLegacyState=function({persist=false}={}){
  const pages=canonicalBinderRoster();
  canonicalBinderMirrorCompatibility(pages);
  if (persist) save();
  return {pages,active:canonicalBinderCurrent(),spread:notebookBinderSpread(),facing:null};
};
singleBinderNormalizeLegacyState=function({persist=false}={}){
  const pages=canonicalBinderRoster();
  canonicalBinderMirrorCompatibility(pages);
  if (persist) save();
  return {pages,active:canonicalBinderCurrent()};
};

/* Existing quarantine helpers become canonical-aware too. */
if (typeof singleBinderHotfixRoster==='function') singleBinderHotfixRoster=function(){ return canonicalBinderRoster(); };
if (typeof singleBinderHotfixRestoreRoster==='function') {
  singleBinderHotfixRestoreRoster=function(roster,{persist=false}={}){
    const pages=canonicalBinderWrite(Array.isArray(roster)&&roster.length?roster:canonicalBinderRoster());
    canonicalBinderMirrorCompatibility(pages);
    if (persist) save();
  };
}

function canonicalBinderActivate(ref,{record=true}={}) {
  ref=canonicalBinderRef(ref);
  if (!ref) return;
  const roster=canonicalBinderRoster();
  if (!roster.some(page=>page.id===ref.id)) return;
  if (canonicalBinderCurrent()?.id===ref.id) {
    canonicalBinderMirrorCompatibility(roster);
    singleBinderPolish?.($('#notebookDock'));
    return;
  }

  notebookPageState()[ref.key]=ref.pageId;
  setNotebookWorkingPage?.(ref.key,ref.pageId,{record,kind:'binder-tab'});
  currentNotebookDate=ref.key;
  currentNotebookPageId=ref.pageId;
  canonicalBinderMirrorCompatibility(roster);
  save();
  renderAll();

  /* Older render wrappers may rewrite compatibility state. Restore from the private roster only. */
  canonicalBinderMirrorCompatibility(roster);
  singleBinderHotfixRemoveLegacy?.($('#notebookDock'));
  singleBinderPolish?.($('#notebookDock'));
  requestAnimationFrame(()=>{
    canonicalBinderMirrorCompatibility(roster);
    singleBinderHotfixRemoveLegacy?.($('#notebookDock'));
    singleBinderPolish?.($('#notebookDock'));
  });
}
singleBinderActivate=canonicalBinderActivate;
binderSetActivePage=function(ref,{record=true}={}){ canonicalBinderActivate(ref,{record}); };
activateNotebookPeerPage=function(ref,{record=true}={}){ canonicalBinderActivate(ref,{record}); };
notebookBinderOpenPageOnSide=function(ref,side,{record=true}={}){ canonicalBinderActivate(ref,{record}); };

openNotebookPageInBinder=function(key,pageId) {
  const ref=canonicalBinderRef({key,pageId});
  if (!ref) return;
  let roster=canonicalBinderRoster();
  if (!roster.some(page=>page.id===ref.id)) {
    if (roster.length>=NOTEBOOK_BINDER_ROSTER_MAX) return toast?.(`Binder can hold up to ${NOTEBOOK_BINDER_ROSTER_MAX} open pages.`);
    roster=canonicalBinderWrite([...roster,ref],{persist:true});
  }
  closeModal?.();
  canonicalBinderActivate(ref,{record:true});
};
setNotebookReferencePage=function(key,pageId){ openNotebookPageInBinder(key,pageId); };

closeNotebookBinderPage=function(ref) {
  ref=canonicalBinderRef(ref);
  if (!ref) return;
  let roster=canonicalBinderRoster();
  if (roster.length<=1 || !roster.some(page=>page.id===ref.id)) return;
  const active=canonicalBinderCurrent();
  const index=roster.findIndex(page=>page.id===ref.id);
  roster=roster.filter(page=>page.id!==ref.id);

  if (active?.id===ref.id) {
    const next=roster[Math.min(index,roster.length-1)] || roster[index-1] || roster[0];
    notebookPageState()[next.key]=next.pageId;
    setNotebookWorkingPage?.(next.key,next.pageId,{record:true,kind:'binder-close'});
    currentNotebookDate=next.key;
    currentNotebookPageId=next.pageId;
  }
  canonicalBinderWrite(roster,{persist:true});
  renderAll();
  requestAnimationFrame(()=>{
    canonicalBinderMirrorCompatibility(canonicalBinderRoster());
    singleBinderPolish?.($('#notebookDock'));
  });
};
closeNotebookPeerPage=closeNotebookBinderPage;

singleBinderReorder=function(sourceId,targetId) {
  if (!sourceId || !targetId || sourceId===targetId) return;
  const roster=canonicalBinderRoster();
  const from=roster.findIndex(page=>page.id===sourceId);
  const to=roster.findIndex(page=>page.id===targetId);
  if (from<0 || to<0) return;
  const [moved]=roster.splice(from,1);
  roster.splice(to,0,moved);
  canonicalBinderWrite(roster,{persist:true});
  renderAll();
};

/* Returning to Notebook also restores compatibility state from the canonical roster. */
if (typeof showView==='function') {
  const _canonicalShowView=showView;
  showView=function(name) {
    if (name!=='notebook') return _canonicalShowView(name);
    const roster=canonicalBinderRoster();
    let active=canonicalBinderCurrent();
    if (!active || !roster.some(page=>page.id===active.id)) active=roster[0]||active;
    if (active) {
      currentNotebookDate=active.key;
      currentNotebookPageId=active.pageId;
    }
    canonicalBinderMirrorCompatibility(roster);
    const result=_canonicalShowView(name);
    canonicalBinderMirrorCompatibility(roster);
    singleBinderPolish?.($('#notebookDock'));
    requestAnimationFrame(()=>{
      canonicalBinderMirrorCompatibility(roster);
      singleBinderHotfixRemoveLegacy?.($('#notebookDock'));
      singleBinderPolish?.($('#notebookDock'));
    });
    return result;
  };
}

/* Last render wrapper: compatibility keys may churn, canonical roster never does. */
const _canonicalBinderRender=renderNotebookSurface;
renderNotebookSurface=function(root) {
  const roster=canonicalBinderRoster();
  canonicalBinderMirrorCompatibility(roster);
  _canonicalBinderRender(root);
  if (!root) return;
  canonicalBinderMirrorCompatibility(roster);
  singleBinderHotfixRemoveLegacy?.(root);
  singleBinderPolish?.(root);
  requestAnimationFrame(()=>{
    canonicalBinderMirrorCompatibility(roster);
    singleBinderHotfixRemoveLegacy?.(root);
    singleBinderPolish?.(root);
  });
};

canonicalBinderWrite(canonicalBinderBootstrap(),{persist:true});
requestAnimationFrame(()=>{
  canonicalBinderMirrorCompatibility(canonicalBinderRoster());
  singleBinderHotfixRemoveLegacy?.($('#notebookDock'));
  singleBinderPolish?.($('#notebookDock'));
});
