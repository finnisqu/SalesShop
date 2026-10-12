import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { HeadquartersDocumentState } from './useHeadquartersDocument';
import { newPlatformId, type PlatformNotebookDocument } from './headquartersTypes';

export function HeadquartersNotebook({store}:{store:HeadquartersDocumentState<PlatformNotebookDocument>}) {
 const {document,change,loading}=store;
 const [search,setSearch]=useState('');
 const pages=useMemo(()=>[...document.pages].filter(page=>page.title.toLowerCase().includes(search.toLowerCase()))
   .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt)),[document.pages,search]);
 const active=document.pages.find(p=>p.id===document.activePageId)??document.pages[0]??null;
 const add=()=>{
   const date=new Date().toISOString();
   const page={id:newPlatformId('hq_page'),title:'Untitled page',contentHtml:'<p></p>',pinned:false,
     createdAt:date,updatedAt:date};
   change(prev=>({...prev,pages:[page,...prev.pages],activePageId:page.id}));
 };
 const edit=(id:string,patch:Partial<typeof document.pages[number]>)=>
   change(prev=>({...prev,pages:prev.pages.map(page=>page.id===id?{...page,...patch,updatedAt:new Date().toISOString()}:page)}));
 const remove=()=>{
   if(!active || !window.confirm(`Delete "${active.title}" from your private headquarters notebook?`))return;
   change(prev=>{
     const pages=prev.pages.filter(page=>page.id!==active.id);
     return {...prev,pages,activePageId:pages[0]?.id??null};
   });
 };
 if(loading)return <p className="hq-empty">Opening your private headquarters notebook…</p>;
 return <section className="hq-notebook">
   <div className="hq-notebook-sidebar">
     <div className="hq-panel-heading"><div><span className="hq-kicker">IDEAS & NOTES</span><h2>Notebook</h2></div>
       <button type="button" className="hq-primary" onClick={add}>+ Page</button></div>
     <input aria-label="Search notebook page titles" placeholder="Find a page…" value={search}
       onChange={event=>setSearch(event.target.value)}/>
     <div className="hq-notebook-pages" aria-label="Notebook pages">
       {pages.map(page=><button type="button" key={page.id}
         className={`hq-notebook-page${page.id===active?.id?' active':''}`}
         onClick={()=>change(prev=>({...prev,activePageId:page.id}))}>
         <span>{page.pinned?'★ ':''}{page.title}</span>
         <small>{new Date(page.updatedAt).toLocaleDateString()}</small>
       </button>)}
       {!pages.length&&<p className="hq-empty">{search?'No matching pages.':'Your private notebook is ready. Create your first page.'}</p>}
     </div>
   </div>
   <div className="hq-notebook-body">
     {active?<div className="hq-notebook-sheet">
       <div className="hq-notebook-actions">
         <span className="hq-kicker">SALESSHOP HEADQUARTERS · PRIVATE</span>
         <div>
           <button type="button" onClick={()=>edit(active.id,{pinned:!active.pinned})} aria-label={active.pinned?'Unpin page':'Pin page'}>{active.pinned?'★ Pinned':'☆ Pin'}</button>
           <button type="button" className="hq-danger-link" onClick={remove}>Delete</button>
         </div>
       </div>
       <input className="hq-notebook-title" aria-label="Notebook page title"
         value={active.title} onChange={event=>edit(active.id,{title:event.target.value})}/>
       <p className="hq-notebook-meta">Updated {new Date(active.updatedAt).toLocaleString()}</p>
       <HeadquartersRichEditor key={active.id} html={active.contentHtml}
         onChange={html=>edit(active.id,{contentHtml:html})}/>
     </div>:<div className="hq-notebook-welcome"><h2>Your product notebook</h2>
       <p>Capture product ideas, release plans, customer conversations and anything else you want to remember.
       These pages belong to your Developer account, not any customer company.</p>
       <button type="button" className="hq-primary" onClick={add}>Create first page</button></div>}
   </div>
 </section>;
}

function HeadquartersRichEditor({html,onChange}:{html:string;onChange:(html:string)=>void}){
 const editor=useEditor({
   extensions:[StarterKit],content:html,immediatelyRender:false,
   editorProps:{attributes:{class:'hq-rich-editor-body',spellcheck:'true','aria-label':'Notebook writing area'}},
   onUpdate:({editor})=>onChange(editor.getHTML()),
 });
 useEffect(()=>{if(editor&&editor.getHTML()!==html)editor.commands.setContent(html,{emitUpdate:false});},[editor,html]);
 if(!editor)return <p>Preparing editor…</p>;
 const control=(name:string,action:()=>void,active=false)=><button key={name} type="button"
   aria-pressed={active} onClick={action}>{name}</button>;
 return <div className="hq-rich-editor">
   <div className="hq-rich-editor-toolbar" aria-label="Notebook formatting">
     {control('B',()=>editor.chain().focus().toggleBold().run(),editor.isActive('bold'))}
     {control('I',()=>editor.chain().focus().toggleItalic().run(),editor.isActive('italic'))}
     {control('H2',()=>editor.chain().focus().toggleHeading({level:2}).run(),editor.isActive('heading',{level:2}))}
     {control('• List',()=>editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList'))}
     {control('1. List',()=>editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}
     {control('Quote',()=>editor.chain().focus().toggleBlockquote().run(),editor.isActive('blockquote'))}
     {control('↶',()=>editor.chain().focus().undo().run())}
     {control('↷',()=>editor.chain().focus().redo().run())}
   </div>
   <EditorContent editor={editor}/>
 </div>;
}
