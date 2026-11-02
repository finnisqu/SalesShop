import {useMemo,useState,type KeyboardEvent} from 'react';
import {taskAssociationKey,type TaskAssociation} from '../store/personalTaskStore';
export interface AssociationOption {key:string;linked:TaskAssociation;label:string;}
const labels:Record<TaskAssociation['type'],string>={
 quote:'Quote',project:'Deal',company:'Company',contact:'Person',notebook:'Notebook',
};
/** Search scales to thousands of CRM records without a multi-thousand-option select. */
export function TaskAssociationsField({options,value,onChange}:{
 options:AssociationOption[];value:TaskAssociation[];onChange:(items:TaskAssociation[])=>void;
}){
 const [search,setSearch]=useState('');
 const [type,setType]=useState<'all'|TaskAssociation['type']>('all');
 const [open,setOpen]=useState(false);
 const selectedKeys=useMemo(()=>new Set(value.map(taskAssociationKey)),[value]);
 const matches=useMemo(()=>{
   const words=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
   return options.filter(x=>!selectedKeys.has(x.key)&&(type==='all'||type===x.linked.type)
     &&words.every(word=>x.label.toLocaleLowerCase().includes(word))).slice(0,12);
 },[options,selectedKeys,type,search]);
 const add=(item:AssociationOption)=>{
   if(selectedKeys.has(item.key))return;
   onChange([...value,{...item.linked,label:item.label}]);
   setSearch('');setOpen(true);
 };
 const submit=(e:KeyboardEvent<HTMLInputElement>)=>{
   if(e.key==='Escape'){setOpen(false);return;}
   if(e.key==='Enter'&&open&&matches.length){e.preventDefault();add(matches[0]);}
 };
 return <div className="tasks-associations" aria-label="Related records">
   <div className="tasks-associations-header"><strong>Related records</strong>
     <small>Link as many Companies, People, Deals or Quotes as you need</small></div>
   {value.length>0&&<div className="tasks-association-chips">
     {value.map((link,i)=><span className="tasks-association-chip" key={taskAssociationKey(link)+i}>
       <b>{labels[link.type]}</b> {link.label?.replace(/^(Quote|Deal|Company|Person|Notebook) · /,'')||link.id}
       <button type="button" title="Remove association" aria-label={'Remove '+(link.label||link.id)}
         onClick={()=>onChange(value.filter((_,j)=>j!==i))}>×</button>
     </span>)}
   </div>}
   <div className="tasks-associations-search">
     <select value={type} aria-label="Related record type" onChange={e=>{setType(e.target.value as typeof type);setOpen(true);}}>
       <option value="all">All types</option>
       {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select>
     <input type="search" aria-label="Search related records" placeholder="Type a name, company or deal…"
       value={search} onFocus={()=>setOpen(true)} onChange={e=>{setSearch(e.target.value);setOpen(true);}}
       onKeyDown={submit}/>
   </div>
   {open&&<div className="tasks-associations-results" role="group" aria-label="Matching related records">
     {matches.length?matches.map(x=><button type="button" key={x.key} onClick={()=>add(x)}>
       <span>{labels[x.linked.type]}</span><strong>{x.label.replace(/^(Quote|Deal|Company|Person|Notebook) · /,'')}</strong><b>+</b>
     </button>):<p>{search?'No matching unlinked records':'No more records to link'}</p>}
     <button type="button" className="tasks-associations-close" onClick={()=>setOpen(false)}>Close search</button>
   </div>}
 </div>;
}
