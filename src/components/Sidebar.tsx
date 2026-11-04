import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNotebookStore } from '../store/notebookStore';
import {useAppContextMenu,type AppContextAction} from './AppContextMenu';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {notebookPromotionActions} from '../services/notebookPromotionActions';
import type { NotebookEntry, NotebookFolder, NotebookObject } from '../types/notebook';

type PageFilter = 'all' | 'daily' | 'favorites' | 'project' | 'postits';
type NotebookIconName='search'|'all'|'daily'|'favorites'|'project'|'postits'|'trash';
function NotebookIcon({name}:{name:NotebookIconName}){
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    {name==='search'&&<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>}
    {name==='all'&&<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></>}
    {name==='daily'&&<><rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M7 3v4M17 3v4M3 10h18M8 14h4M8 17h8"/></>}
    {name==='favorites'&&<path d="m12 3 2.8 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.8 3 1.2-6.5-4.8-4.6 6.6-.9z"/>}
    {name==='project'&&<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></>}
    {name==='postits'&&<><path d="M5 3h14a2 2 0 0 1 2 2v10l-6 6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 21v-6h6M7 8h9M7 12h5"/></>}
    {name==='trash'&&<><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></>}
  </svg>;
}

function plainHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function objectSearchText(object: NotebookObject) {
  if (object.type === 'paper-card' || object.type === 'post-it' || object.type === 'paper-scrap') return object.text;
  if (object.type === 'business-card') return [object.name, object.company, object.title, object.email, object.phone].filter(Boolean).join(' ');
  if (object.type === 'image') return [object.alt, object.caption].filter(Boolean).join(' ');
  if (object.type === 'attachment') return object.name;
  if (object.type === 'shape') return object.text ?? '';
  return '';
}

function entrySearchText(entry: NotebookEntry) {
  return [
    entry.title,
    plainHtml(entry.contentHtml),
    ...entry.objects.map(objectSearchText),
  ].join(' ').toLowerCase();
}

function folderTree(folders:NotebookFolder[]): Array<{folder:NotebookFolder;depth:number}> {
  const rows:Array<{folder:NotebookFolder;depth:number}>=[];
  const visited=new Set<string>();
  const walk=(parentId:string|undefined,depth:number)=>{
    for(const folder of folders.filter(folder=>folder.parentId===parentId)){
      if(visited.has(folder.id))continue;
      visited.add(folder.id);rows.push({folder,depth});walk(folder.id,depth+1);
    }
  };
  walk(undefined,0);
  // Bad legacy or imported folder links cannot hide pages or recurse forever.
  for(const folder of folders)if(!visited.has(folder.id)){
    visited.add(folder.id);rows.push({folder,depth:0});walk(folder.id,1);
  }
  return rows;
}

interface NotebookSidebarProps {
  onOpenBeside?:(pageId:string)=>void;
  onOpenLeft?:(pageId:string)=>void;
  companionId?:string|null;
  activePane?:'left'|'right';stacked?:boolean;
  onSwap?:()=>void;onCloseLeft?:()=>void;onCloseRight?:()=>void;
  onToggleStack?:()=>void;onFocusPane?:(pane:'left'|'right')=>void;
}
const COLLAPSED_KEY='salesshop-notebook-folders-collapsed-v1';
const UNFILED='__unfiled__';
export function Sidebar({
  onOpenBeside,onOpenLeft,companionId,activePane='left',stacked=false,
  onSwap,onCloseLeft,onCloseRight,onToggleStack,onFocusPane,
}:NotebookSidebarProps) {
  const entries = useNotebookStore((state) => state.entries);
  const folders = useNotebookStore((state) => state.folders);
  const createFolder = useNotebookStore((state) => state.createFolder);
  const renameFolder = useNotebookStore((state) => state.renameFolder);
  const removeFolder = useNotebookStore((state) => state.removeFolder);
  const activeEntryId = useNotebookStore((state) => state.activeEntryId);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const selectEntry = useNotebookStore((state) => state.selectEntry);
  const trashedEntries = useNotebookStore((state) => state.trashedEntries);
  const restoreEntry = useNotebookStore((state) => state.restoreEntry);
  const reorderEntry = useNotebookStore((state) => state.reorderEntry);
  const moveEntryToFolder=useNotebookStore(state=>state.moveEntryToFolder);
  const duplicateEntry=useNotebookStore(state=>state.duplicateEntry);
  const renameEntry=useNotebookStore(state=>state.renameEntry);
  const deleteEntry=useNotebookStore(state=>state.deleteEntry);
  const toggleFavorite=useNotebookStore(state=>state.toggleFavorite);
  const contextActions=useAppContextMenu();
  const beginPromotion=usePersonalTaskStore(s=>s.beginPromotion);
  const [showHidden, setShowHidden] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [collapsedFolders,setCollapsedFolders]=useState<string[]>(()=>{
    try{const v=JSON.parse(localStorage.getItem(COLLAPSED_KEY)||'[]') as unknown;
      return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];
    }catch{return[];}
  });
  useEffect(()=>{try{localStorage.setItem(COLLAPSED_KEY,JSON.stringify(collapsedFolders));}catch{/* optional */}},[collapsedFolders]);
  const toggleFolder=(id:string)=>setCollapsedFolders(current=>current.includes(id)?
    current.filter(x=>x!==id):[...current,id]);
  const [showTrash, setShowTrash] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PageFilter>('all');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: 'before' | 'after' } | null>(null);

  const hiddenCount = entries.filter((entry) => entry.hidden).length;
  const folderRows=useMemo(()=>folderTree(folders),[folders]);
  const childrenMap=useMemo(()=>{
    const children=new Map<string,string[]>();
    for(const folder of folders)if(folder.parentId){
      children.set(folder.parentId,[...(children.get(folder.parentId)??[]),folder.id]);
    }
    return children;
  },[folders]);
  const descendants=(id:string)=>{
    const ids=new Set<string>([id]),pending=[id];
    while(pending.length){const current=pending.pop()!;
      for(const child of childrenMap.get(current)??[])if(!ids.has(child)){ids.add(child);pending.push(child);}
    }
    return ids;
  };
  const folderCount=(id:string)=>{
    const ids=descendants(id);
    return entries.filter(entry=>!!entry.folderId&&ids.has(entry.folderId)).length;
  };
  const visibleFolderRows=folderRows.filter(({folder})=>{
    const seen=new Set<string>();let parent=folder.parentId;
    while(parent&&!seen.has(parent)){
      if(collapsedFolders.includes(parent))return false;
      seen.add(parent);parent=folders.find(f=>f.id===parent)?.parentId;
    }
    return true;
  });
  const visibleFolderIds=useMemo(()=>{
    if(!activeFolderId)return null;
    if(activeFolderId===UNFILED)return new Set([UNFILED]);
    const ids=new Set<string>([activeFolderId]);
    for(let i=0;i<folders.length;i++){
      for(const folder of folders)if(folder.parentId&&ids.has(folder.parentId))ids.add(folder.id);
    }
    return ids;
  },[activeFolderId,folders]);
  const pageMenuActions=(entry:NotebookEntry):AppContextAction[]=>{
    const actions:AppContextAction[]=[
      {label:'Open page on left',onSelect:()=>onOpenLeft?onOpenLeft(entry.id):selectEntry(entry.id)},
      ...(onOpenBeside&&activeEntryId!==entry.id?
        [{label:'Open page on right',onSelect:()=>onOpenBeside(entry.id)}]:[]),
      {label:entry.favorite?'Remove favorite':'Add to favorites',onSelect:()=>toggleFavorite(entry.id)},
      {label:'Rename…',onSelect:()=>{
        const title=window.prompt('Rename notebook page',entry.title);
        if(title?.trim())renameEntry(entry.id,title.trim());
      }},
      {label:'Duplicate page',onSelect:()=>duplicateEntry(entry.id)},
      ...notebookPromotionActions({title:entry.title||'Review Notebook page',
        linked:{type:'notebook',id:entry.id},sourceLabel:entry.title||'Notebook page',
        sourceText:entry.title||undefined},beginPromotion),
    ];
    if(!entry.deletionLocked)actions.push({
      label:'Move to Recently Deleted…',destructive:true,dividerBefore:true,
      onSelect:()=>{if(window.confirm('Move “'+(entry.title||'Untitled page')+'” to Recently Deleted?'))deleteEntry(entry.id);}
    });
    return actions;
  };
  const folderMenuActions=(folder:NotebookFolder):AppContextAction[]=>[
    {label:'Open folder',onSelect:()=>{setActiveFolderId(folder.id);setFilter('all');setShowTrash(false);}},
    {label:'New subfolder…',onSelect:()=>askFolder(folder.id)},
    {label:'Rename folder…',onSelect:()=>{
      const name=window.prompt('Rename folder',folder.name);
      if(name?.trim())renameFolder(folder.id,name.trim());
    }},
    {label:'Remove folder…',destructive:true,dividerBefore:true,onSelect:()=>{
      if(!window.confirm('Remove “'+folder.name+'”? Its pages and subfolders will be moved up, not deleted.'))return;
      removeFolder(folder.id);if(activeFolderId===folder.id)setActiveFolderId(folder.parentId??null);
    }},
  ];
  const askFolder=(parentId?:string)=>{
    const name=window.prompt(parentId?'New subfolder name':'New folder name');
    if(!name?.trim())return;
    const id=createFolder(name,parentId);
    if(id){setActiveFolderId(id);setFilter('all');setShowTrash(false);
      if(parentId)setCollapsedFolders(current=>current.filter(x=>x!==parentId));}
  };
  const reorderEnabled = !showTrash && !query.trim() && filter === 'all';

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.hidden && !showHidden && entry.id !== activeEntryId) return false;
      if(filter==='all'&&activeFolderId===UNFILED&&entry.folderId)return false;
      if (filter==='all' && visibleFolderIds && activeFolderId!==UNFILED &&
        (!entry.folderId || !visibleFolderIds.has(entry.folderId))) return false;
      if (filter === 'daily' && !entry.dailyDate) return false;
      if (filter === 'favorites' && !entry.favorite) return false;
      if (filter === 'project' && !entry.context?.projectId) return false;
      if (filter === 'postits' && !entry.objects.some(object=>object.type==='post-it')) return false;
      if (needle && !entrySearchText(entry).includes(needle)) return false;
      return true;
    }).sort((a,b)=>filter==='daily'
     ?(b.dailyDate??'').localeCompare(a.dailyDate??'')
     :0);
  }, [activeEntryId, entries, filter, query, showHidden, visibleFolderIds]);

  const onDragOver = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    if (!draggingId || draggingId === targetId || !reorderEnabled) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropTarget({ id: targetId, placement });
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId || !dropTarget || !reorderEnabled) return;
    reorderEntry(draggingId, targetId, dropTarget.placement);
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <aside className="notebook-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">Binder</span>
          <h2>Notebook</h2>
        </div>
        <div className="sidebar-heading-actions">
          {hiddenCount > 0 && (
            <button
              className={`square-button sidebar-hidden-toggle ${showHidden ? 'active' : ''}`}
              onClick={() => setShowHidden((current) => !current)}
              title={showHidden ? 'Hide private sheets again' : `Show ${hiddenCount} hidden private sheet${hiddenCount === 1 ? '' : 's'}`}
              aria-label={showHidden ? 'Hide private sheets' : 'Show hidden private sheets'}
            >
              {showHidden ? '◉' : '○'}
            </button>
          )}
          <button className="square-button" onClick={() => createEntry(activeFolderId??undefined)} title="New page" aria-label="New page">
            +
          </button>
        </div>
      </div>

      {onOpenBeside&&<section className="notebook-split-rail" aria-label="Notebook split view">
        <div className="notebook-split-rail-header">
          <span aria-hidden="true">▣</span>
          <strong>{companionId?'Split group':'Page layout'}</strong>
          <details className="notebook-split-rail-more">
            <summary aria-label="Split view options" title="Split view options">⋯</summary>
            <div className="notebook-split-rail-menu">
              {companionId?<>
                <button type="button" onClick={onSwap}>⇄ Reverse views</button>
                <button type="button" onClick={onToggleStack}>{stacked?'◫ Show side by side':'▤ Show stacked'}</button>
                <button type="button" onClick={onCloseLeft}>Close left view</button>
                <button type="button" onClick={onCloseRight}>Close right view</button>
                <button type="button" onClick={onCloseRight}>Exit split · keep left</button>
              </>:<span>Open a second page to start a split.</span>}
            </div>
          </details>
        </div>
        <div className="notebook-split-rail-tabs">
          <button type="button" aria-pressed={activePane==='left'}
            onClick={()=>onFocusPane?.('left')} title="Focus the left page">
            <span aria-hidden="true">◧</span>
            <span className="notebook-split-rail-page">{entries.find(e=>e.id===activeEntryId)?.title||'Untitled page'}</span>
            <small>Left</small>
          </button>
          {companionId&&<button type="button" aria-pressed={activePane==='right'}
            onClick={()=>onFocusPane?.('right')} title="Focus the right page">
            <span aria-hidden="true">◨</span>
            <span className="notebook-split-rail-page">{entries.find(e=>e.id===companionId)?.title||'Untitled page'}</span>
            <small>Right</small>
          </button>}
          {!companionId&&<label className="notebook-split-rail-add">
            <span aria-hidden="true">＋</span>
            <select aria-label="Open a second Notebook page" value=""
              onChange={event=>{if(event.target.value)onOpenBeside?.(event.target.value);}}>
              <option value="">Open page beside…</option>
              {entries.filter(e=>e.id!==activeEntryId&&!e.hidden)
                .map(e=><option key={e.id} value={e.id}>{e.title||'Untitled page'}</option>)}
            </select>
          </label>}
        </div>
        {companionId&&<div className="notebook-split-rail-bottom">
          <button type="button" onClick={onSwap} title="Swap left and right">⇄ Swap</button>
          <button type="button" onClick={onToggleStack} title="Change split orientation">{stacked?'◫ Beside':'▤ Stack'}</button>
          <button type="button" onClick={onCloseRight} title="Close right view">× Close</button>
        </div>}
      </section>}
      <div className="notebook-page-search">
        <div className="notebook-search-field">
          <NotebookIcon name="search"/>
          <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
            placeholder="Find pages…" aria-label="Search notebook pages"/>
          {query&&<button type="button" className="notebook-search-clear"
            aria-label="Clear notebook search" title="Clear search" onClick={()=>setQuery('')}>×</button>}
        </div>
        <div className="notebook-page-filters" role="group" aria-label="Filter Notebook pages">
          <button type="button" className={filter==='all'&&!showTrash&&!activeFolderId?'active':''}
            title="All pages" aria-label="All pages" aria-pressed={filter==='all'&&!showTrash&&!activeFolderId}
            onClick={()=>{setShowTrash(false);setActiveFolderId(null);setFilter('all');}}>
            <NotebookIcon name="all"/><span>All</span></button>
          <button type="button" className={filter==='daily'&&!showTrash?'active':''}
            title="Daily Notes" aria-label="Daily Notes" aria-pressed={filter==='daily'&&!showTrash}
            onClick={()=>{setShowTrash(false);setActiveFolderId(null);setFilter('daily');}}>
            <NotebookIcon name="daily"/><span>Daily</span></button>
          <button type="button" className={filter==='favorites'&&!showTrash?'active':''}
            title="Favorite pages" aria-label="Favorite pages" aria-pressed={filter==='favorites'&&!showTrash}
            onClick={()=>{setShowTrash(false);setActiveFolderId(null);setFilter('favorites');}}>
            <NotebookIcon name="favorites"/></button>
          <button type="button" className={filter==='project'&&!showTrash?'active':''}
            title="Pages linked to projects" aria-label="Project pages" aria-pressed={filter==='project'&&!showTrash}
            onClick={()=>{setShowTrash(false);setActiveFolderId(null);setFilter('project');}}>
            <NotebookIcon name="project"/></button>
          <button type="button" className={filter==='postits'&&!showTrash?'active':''}
            title="Pages containing Post-its" aria-label="Pages with Post-its" aria-pressed={filter==='postits'&&!showTrash}
            onClick={()=>{setShowTrash(false);setActiveFolderId(null);setFilter('postits');}}>
            <NotebookIcon name="postits"/></button>
          <button type="button" className={showTrash?'active':''}
            title={'Recently deleted · '+trashedEntries.length}
            aria-label={'Recently deleted pages ('+trashedEntries.length+')'} aria-pressed={showTrash}
            onClick={()=>setShowTrash(value=>!value)}>
            <NotebookIcon name="trash"/>{trashedEntries.length>0&&<span className="notebook-filter-count">{trashedEntries.length}</span>}</button>
        </div>
        {!reorderEnabled&&!showTrash&&<small className="notebook-filter-help">Clear search or filter to reorder pages.</small>}
      </div>

      {!showTrash&&<section className="notebook-folder-panel notebook-folder-panel-v2" aria-label="Notebook folders">
        <header><span><strong>Folders</strong><small>{folders.length} folders · Organize your pages</small></span>
          <button type="button" title="New folder" onClick={()=>askFolder()}>+ Folder</button></header>
        {activeFolderId&&<div className="notebook-folder-current">
          <span>Showing {activeFolderId===UNFILED?'Unfiled pages':
            folders.find(f=>f.id===activeFolderId)?.name??'pages'}</span>
          <button type="button" onClick={()=>setActiveFolderId(null)}>All pages ×</button>
        </div>}
        <div className="notebook-folder-tree">
          <button type="button" className={'notebook-unfiled-row'+(activeFolderId===UNFILED?' is-active':'')+(draggingId?' accepts-page-drop':'')}
            onDragOver={event=>{if(draggingId){event.preventDefault();event.dataTransfer.dropEffect='move';}}}
            onDrop={event=>{
              if(!draggingId)return;event.preventDefault();event.stopPropagation();
              moveEntryToFolder(draggingId,null);setActiveFolderId(UNFILED);
              setDraggingId(null);setDropTarget(null);
            }}
            onClick={()=>{setActiveFolderId(UNFILED);setFilter('all');setShowTrash(false);}}>
            <span aria-hidden="true">▤</span><strong>Unfiled</strong>
            <small>{entries.filter(entry=>!entry.folderId).length}</small>
          </button>
          {visibleFolderRows.map(({folder,depth})=>{
            const isCollapsed=collapsedFolders.includes(folder.id);
            const hasChildren=childrenMap.has(folder.id);
            return <div key={folder.id}
              className={'notebook-folder-row'+(activeFolderId===folder.id&&filter==='all'?' is-active':'')+
                (draggingId?' accepts-page-drop':'')}
              style={{paddingLeft:Math.min(depth,6)*12+5}}
              onDragOver={event=>{if(!draggingId)return;event.preventDefault();event.dataTransfer.dropEffect='move';}}
              onDrop={event=>{
                if(!draggingId)return;event.preventDefault();event.stopPropagation();
                moveEntryToFolder(draggingId,folder.id);
                setActiveFolderId(folder.id);setFilter('all');setDraggingId(null);setDropTarget(null);
              }}>
              <button type="button" className="notebook-folder-toggle"
                aria-label={(isCollapsed?'Expand ':'Collapse ')+folder.name} aria-expanded={!isCollapsed}
                disabled={!hasChildren} onClick={()=>toggleFolder(folder.id)}>
                {hasChildren?(isCollapsed?'▸':'▾'):'·'}
              </button>
              <button type="button" className="notebook-folder-open"
                onContextMenu={event=>contextActions.openPointer(event,folder.name,folderMenuActions(folder))}
                onKeyDown={event=>contextActions.openKeyboard(event,folder.name,folderMenuActions(folder))}
                aria-pressed={activeFolderId===folder.id&&filter==='all'}
                onClick={()=>{setActiveFolderId(folder.id);setFilter('all');setShowTrash(false);}}>
                <span aria-hidden="true">▣</span><span>{folder.name}</span><small>{folderCount(folder.id)}</small>
              </button>
              <button type="button" className="notebook-folder-extra" title={'New subfolder in '+folder.name}
                aria-label={'New subfolder in '+folder.name} onClick={()=>askFolder(folder.id)}>+</button>
              <button type="button" className="notebook-folder-extra" title={'Rename '+folder.name}
                aria-label={'Rename '+folder.name} onClick={()=>{
                  const name=window.prompt('Rename folder',folder.name);
                  if(name?.trim())renameFolder(folder.id,name);
                }}>✎</button>
            </div>;
          })}
        </div>
        {draggingId&&<p className="notebook-folder-drop-help">Drop the page onto a folder to file it.</p>}
      </section>}
      <div className="page-list">
        {showTrash ? (
          <div className="notebook-trash-list" aria-label="Recently deleted Notebook pages">
            <p>Pages are recoverable here for seven days. Locked pages cannot be deleted.</p>
            {trashedEntries.map(item=><div className="notebook-trash-row" key={item.entry.id}>
              <span><strong>{item.entry.title||'Untitled page'}</strong>
                <small>Deleted {new Date(item.deletedAt).toLocaleDateString()}</small></span>
              <button type="button" onClick={()=>{restoreEntry(item.entry.id);setShowTrash(false);}}>Restore</button>
            </div>)}
            {!trashedEntries.length&&<p>Nothing recently deleted.</p>}
          </div>
        ) : visibleEntries.map((entry) => {
          const active = entry.id === activeEntryId;
          const text = plainHtml(entry.contentHtml);
          const before = dropTarget?.id === entry.id && dropTarget.placement === 'before';
          const after = dropTarget?.id === entry.id && dropTarget.placement === 'after';
          return (
            <button
              key={entry.id}
              className={`page-tab tone-${entry.tone} ${active ? 'active' : ''} ${entry.id===companionId?'is-companion':''} ${entry.favorite ? 'is-favorite' : ''} ${entry.hidden ? 'is-hidden-page' : ''} ${draggingId === entry.id ? 'is-dragging' : ''} ${before ? 'drop-before' : ''} ${after ? 'drop-after' : ''}`}
              onClick={() => onOpenLeft?onOpenLeft(entry.id):selectEntry(entry.id)}
              onContextMenu={event=>contextActions.openPointer(event,entry.title||'Notebook page',pageMenuActions(entry))}
              onKeyDown={event=>contextActions.openKeyboard(event,entry.title||'Notebook page',pageMenuActions(entry))}
              draggable={reorderEnabled}
              onDragStart={(event) => {
                if (!reorderEnabled) return;
                setDraggingId(entry.id);
                setDropTarget(null);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', entry.id);
              }}
              onDragOver={(event) => onDragOver(event, entry.id)}
              onDrop={(event) => onDrop(event, entry.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTarget(null);
              }}
              title={[
                entry.title,
                entry.favorite ? 'Favorite' : '',
                entry.openAtStart ? 'Opens at start' : '',
                entry.hidden ? 'Hidden private sheet' : '',
                entry.deletionLocked ? 'Deletion locked' : '',
                reorderEnabled ? 'Drag to reorder' : '',
              ].filter(Boolean).join(' · ')}
            >
              {reorderEnabled && <span className="page-tab-drag" aria-hidden="true">⋮⋮</span>}
              <span className="page-tab-title">{entry.title}</span>
              <span className="page-tab-preview">{text || `${entry.paperStyle.replace('-', ' ')} sheet`}</span>
              <span className="page-tab-status" aria-hidden="true">
                {entry.openAtStart && <span title="Opens at start">⌂</span>}
                {entry.hidden && <span title="Hidden private sheet">◌</span>}
                {entry.deletionLocked && <span title="Deletion locked">▣</span>}
              </span>
              <span className="page-tab-favorite" aria-hidden="true">★</span>

            </button>
          );
        })}
        {!showTrash && !visibleEntries.length && (
          <div className="notebook-page-empty">
            <strong>No pages found</strong>
            <span>Try another search or filter.</span>
          </div>
        )}
      </div>
      {contextActions.menu}
    </aside>
  );
}
