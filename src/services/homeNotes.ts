import type {NotebookEntry,PostItObject} from '../types/notebook';

export interface HomeNote{
 entryId:string;objectId:string;text:string;createdAt:string;updatedAt:string;
 tone:PostItObject['tone'];
}
/** Home Notes are Post-its inside Notebook's existing private inbox. */
export function homeNotes(entries:readonly NotebookEntry[]):HomeNote[]{
 return entries.filter(entry=>entry.isPostItInbox).flatMap(entry=>
  entry.objects.filter((item):item is PostItObject=>item.type==='post-it')
   .map(item=>({entryId:entry.id,objectId:item.id,text:item.text,
    createdAt:item.createdAt,updatedAt:item.updatedAt,tone:item.tone})))
  .sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||
    a.objectId.localeCompare(b.objectId));
}
export function homeNoteTitle(text:string):string{
 const first=text.split(/\r?\n/).map(line=>line.trim()).find(Boolean);
 return (first??'Untitled note').slice(0,120);
}
export function homeNoteSummary(text:string):string{
 const lines=text.trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 return lines.slice(1).join(' ').slice(0,180);
}
export interface HomeNoteRequest{mode:'create'|'preview';objectId?:string}
export function openHomeNote(detail:HomeNoteRequest={mode:'create'}):void{
 window.dispatchEvent(new CustomEvent<HomeNoteRequest>('salesshop:home-note',{detail}));
}
