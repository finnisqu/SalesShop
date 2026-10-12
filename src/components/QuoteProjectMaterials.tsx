import { useState } from 'react';
import { useQuoteStore } from '../store/quoteStore';
import type { Quote } from '../types/quote';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';

/** Quote-only pinboard. Selecting from the Catalog in Takeoffs also adds here. */
export function QuoteProjectMaterials({quote}:{quote:Quote}){
  const pin=useQuoteStore(s=>s.pinProjectMaterial);
  const unpin=useQuoteStore(s=>s.unpinProjectMaterial);
  const [name,setName]=useState('');
  const [open,setOpen]=useState(false);
  const editable=quoteIsCommerciallyEditable(quote);
  const materials=quote.projectMaterials??[];
  return <section className="quote-project-materials" aria-label="Project Materials">
    <div className="quote-project-materials-heading"><div><strong>★ Project materials</strong>
      <span>{materials.length} pinned · automatically suggested in material pickers</span></div>
      <button type="button" aria-expanded={open} onClick={()=>setOpen(x=>!x)}>
        {open?'Done':materials.length?'Edit materials':'+ Add material'}
      </button>
    </div>
    {materials.length>0&&<div className="quote-project-materials-chips">
      {materials.map(m=><span key={m.id}>★ {m.label}
        {open&&editable&&<button type="button" onClick={()=>unpin(quote.id,m.id)}
          aria-label={`Unpin ${m.label}`}>×</button>}</span>)}
    </div>}
    {open&&editable&&<form onSubmit={e=>{e.preventDefault();if(name.trim()){pin(quote.id,name);setName('');}}}>
      <input value={name} maxLength={300} onChange={e=>setName(e.target.value)}
        aria-label="Material to pin" placeholder="Type a material or color to pin for this project"/>
      <button type="submit">+ Pin</button>
    </form>}
  </section>;
}
