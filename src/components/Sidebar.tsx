import { useMemo, useState, type DragEvent } from 'react';
import { useNotebookStore } from '../store/notebookStore';
import type { NotebookEntry, NotebookFolder, NotebookObject } from '../types/notebook';

type PageFilter = 'all' | 'favorites' | 'project' | 'postits';

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

export function Sidebar() {
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
  const [showHidden, setShowHidden] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PageFilter>('all');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: 'before' | 'after' } | null>(null);

  const hiddenCount = entries.filter((entry) => entry.hidden).length;
  const folderRows=useMemo(()=>folderTree(folders),[folders]);
  const askFolder=(parentId?:string)=>{
    const name=window.prompt(parentId?'New subfolder name':'New folder name');
    if(!name?.trim())return;
    const id=createFolder(name,parentId);
    if(id){setActiveFolderId(id);setFilter('all');setShowTrash(false);}
  };
  const reorderEnabled = !showTrash && !query.trim() && filter === 'all';

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.hidden && !showHidden && entry.id !== activeEntryId) return false;
      if (filter==='all' && activeFolderId && entry.folderId!==activeFolderId) return false;
      if (filter === 'favorites' && !entry.favorite) return false;
      if (filter === 'project' && !entry.context?.projectId) return false;
      if (filter === 'postits' && !entry.objects.some(object=>object.type==='post-it')) return false;
      if (needle && !entrySearchText(entry).includes(needle)) return false;
      return true;
    });
  }, [activeEntryId, activeFolderId, entries, filter, query, showHidden]);

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

      <div className="notebook-page-search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notebook…"
          aria-label="Search notebook pages"
        />
        <div className="notebook-page-filters" aria-label="Notebook page filters">
          <button type="button" className={filter === 'all'&&!showTrash ? 'active' : ''} onClick={() => {setShowTrash(false);setActiveFolderId(null);setFilter('all');}}>All</button>
          <button type="button" className={filter === 'favorites'&&!showTrash ? 'active' : ''} onClick={() => {setShowTrash(false);setActiveFolderId(null);setFilter('favorites');}}>★</button>
          <button type="button" className={filter === 'project'&&!showTrash ? 'active' : ''} onClick={() => {setShowTrash(false);setActiveFolderId(null);setFilter('project');}}>Project</button>
          <button type="button" className={filter === 'postits'&&!showTrash ? 'active' : ''}
            onClick={() => {setShowTrash(false);setActiveFolderId(null);setFilter('postits');}}>Post-its</button>
          <button type="button" className={showTrash ? 'active' : ''} onClick={() => setShowTrash(value=>!value)}>Recently Deleted ({trashedEntries.length})</button>
        </div>
        {!reorderEnabled && !showTrash && <small>Clear search/filter to reorder pages.</small>}
      </div>

      {!showTrash&&<section className="notebook-folder-panel" aria-label="Notebook folders">
        <header><strong>Folders</strong><button type="button" title="New folder" onClick={()=>askFolder()}>+ Folder</button></header>
        {folderRows.map(({folder,depth})=><div className={'notebook-folder-row'+(activeFolderId===folder.id&&filter==='all'?' is-active':'')}
          key={folder.id} style={{paddingLeft: Math.min(depth,6)*12+5}}>
          <button className="notebook-folder-open" type="button"
            aria-pressed={activeFolderId===folder.id&&filter==='all'}
            onClick={()=>{setActiveFolderId(folder.id);setFilter('all');setShowTrash(false);}}>
            <span aria-hidden="true">▸</span><span>{folder.name}</span><small>{entries.filter(entry=>entry.folderId===folder.id).length}</small>
          </button>
          <button type="button" title={'New subfolder in '+folder.name} aria-label={'New subfolder in '+folder.name}
            onClick={()=>askFolder(folder.id)}>+</button>
          <button type="button" title={'Rename '+folder.name} aria-label={'Rename '+folder.name} onClick={()=>{
            const name=window.prompt('Rename folder',folder.name);
            if(name?.trim())renameFolder(folder.id,name);
          }}>✎</button>
          <button type="button" title={'Remove '+folder.name} aria-label={'Remove '+folder.name} onClick={()=>{
            if(!window.confirm('Remove “'+folder.name+'”? Its pages and subfolders will be moved up, not deleted.'))return;
            removeFolder(folder.id);
            if(activeFolderId===folder.id)setActiveFolderId(folder.parentId??null);
          }}>×</button>
        </div>)}
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
              className={`page-tab tone-${entry.tone} ${active ? 'active' : ''} ${entry.favorite ? 'is-favorite' : ''} ${entry.hidden ? 'is-hidden-page' : ''} ${draggingId === entry.id ? 'is-dragging' : ''} ${before ? 'drop-before' : ''} ${after ? 'drop-after' : ''}`}
              onClick={() => selectEntry(entry.id)}
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
    </aside>
  );
}
