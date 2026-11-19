import {RecordCard} from './RecordPageLayout';
import {FileLinksManager} from './FileLinksManager';
import {RecordManagedDocuments391} from './ManagedDocuments391';
import type {FileTarget} from '../services/fileLinks357a';
export function RecordFilesPanel({target}:{target:FileTarget}){
 return <RecordCard title="Files & Docs">
  {(target.kind==='company'||target.kind==='deal')&&
   <RecordManagedDocuments391 target={target}/>}
  <FileLinksManager target={target}/>
 </RecordCard>;
}
