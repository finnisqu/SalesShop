import {afterEach,describe,expect,it,vi} from 'vitest';
import type {NotebookDocument,NotebookEntry} from '../types/notebook';
import {
  markPendingNotebookSync,readPendingNotebookSync,clearPendingNotebookSync,
  mergePendingNotebookChanges,type PendingNotebookSync,
} from './notebookCloudRecovery';

const early='2026-11-05T13:00:00Z',late='2026-11-05T14:00:00Z';
const page=(id:string,updatedAt=early,contentHtml=id):NotebookEntry=>({
  id,title:id,contentHtml,createdAt:early,updatedAt,
  strokes:[],objects:[],paperStyle:'lined',tone:'cream',texture:'clean',
  favorite:false,hidden:false,openAtStart:false,deletionLocked:true,
});
const doc=(entries:NotebookEntry[]):NotebookDocument=>({
  schemaVersion:3,entries,activeEntryId:entries[0]?.id??null,folders:[],trashedEntries:[],
});
const scope={userId:'alice',organizationId:'shop'};
const marker:PendingNotebookSync={...scope,token:'one',
  changedEntryIds:['edit','stale','new'],createdEntryIds:['new'],trashedEntryIds:[],createdFolderIds:[]};
afterEach(()=>vi.unstubAllGlobals());

describe('Interrupted private Notebook saves',()=>{
  it('keeps newer remote pages while restoring only marked newer local edits',()=>{
    const cloud=doc([page('edit'),page('stale',late,'Remote latest'),page('untouched',late,'Cloud only')]);
    const local=doc([page('edit',late,'Edited offline'),page('stale',early,'Outdated'),
      page('untouched',early,'Stale cache'),page('new',late,'New offline')]);
    const result=mergePendingNotebookChanges(cloud,local,marker)!;
    expect(result.entries.find(e=>e.id==='edit')?.contentHtml).toBe('Edited offline');
    expect(result.entries.find(e=>e.id==='stale')?.contentHtml).toBe('Remote latest');
    expect(result.entries.find(e=>e.id==='untouched')?.contentHtml).toBe('Cloud only');
    expect(result.entries.find(e=>e.id==='new')?.contentHtml).toBe('New offline');
    expect(mergePendingNotebookChanges(cloud,local,null)).toBe(cloud);
  });

  it('does not resurrect an existing remotely deleted page or erase newer pages',()=>{
    const local=doc([page('deleted',late)]);
    expect(mergePendingNotebookChanges(doc([]),local,{
      ...marker,changedEntryIds:['deleted'],createdEntryIds:[],
    })?.entries).toEqual([]);
    const cloud=doc([page('edit',late,'Newer server')]);
    const result=mergePendingNotebookChanges(cloud,doc([page('edit',early,'Old')]),marker);
    expect(result).toBe(cloud);
  });

  it('recovers a later trash tombstone but never deletes a newer server edit',()=>{
    const cloud=doc([page('edit',early)]);
    const local={...doc([]),trashedEntries:[{entry:page('edit'),deletedAt:late}]};
    const pending={...marker,changedEntryIds:[],createdEntryIds:[],trashedEntryIds:['edit']};
    const recovered=mergePendingNotebookChanges(cloud,local,pending)!;
    expect(recovered.entries).toHaveLength(0);
    expect(recovered.trashedEntries).toHaveLength(1);
    const latestCloud=doc([page('edit','2026-11-05T15:00:00Z')]);
    expect(mergePendingNotebookChanges(latestCloud,local,pending)).toBe(latestCloud);
  });

  it('uses a lightweight user-and-organization scoped token',()=>{
    const data=new Map<string,string>();
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>data.get(key)??null,
      setItem:(key:string,value:string)=>{data.set(key,value);},
      removeItem:(key:string)=>{data.delete(key);},
    });
    vi.stubGlobal('crypto',{randomUUID:()=> 'token-1'});
    const earlier=doc([page('edit')]);
    const later=doc([page('edit',late,'Offline notes'),page('new',late)]);
    const token=markPendingNotebookSync(scope,later,earlier);
    expect(token).toBe('token-1');
    expect(readPendingNotebookSync(scope)?.changedEntryIds).toEqual(['edit','new']);
    expect(readPendingNotebookSync(scope)?.createdEntryIds).toEqual(['new']);
    expect(readPendingNotebookSync({...scope,userId:'bob'})).toBeNull();
    expect(readPendingNotebookSync({...scope,organizationId:'other'})).toBeNull();
    expect([...data.values()][0]).not.toContain('Offline notes');
    clearPendingNotebookSync(scope,'other-token');
    expect(readPendingNotebookSync(scope)).not.toBeNull();
    clearPendingNotebookSync(scope,token!);
    expect(readPendingNotebookSync(scope)).toBeNull();
  });
});
