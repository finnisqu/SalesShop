import { useState } from 'react';
import { leavePlaygroundUrl, resetPlaygroundStorage } from '../lib/developerPlayground';

/** Fixed compact escape hatch. Mounted only on the strictly local sandbox route. */
export function DeveloperPlaygroundToolbar() {
  const [expanded,setExpanded]=useState(false);
  const reset=()=>{
    if(!window.confirm('Reset all local Playground changes and reload fictional sample data? This does not affect any real company.'))return;
    resetPlaygroundStorage();
    window.location.reload();
  };
  return <aside className={`developer-playground-toolbar${expanded?' is-expanded':''}`}
    aria-label="Developer sandbox controls">
    <button type="button" className="developer-playground-toggle" aria-expanded={expanded}
      onClick={()=>setExpanded(value=>!value)}>◇ Playground <span>{expanded?'×':'☰'}</span></button>
    {expanded && <div className="developer-playground-toolbar-actions">
      <div><strong>Fictional sandbox</strong><small>Local demo · no customer cloud access</small></div>
      <button type="button" onClick={reset}>Reset demo</button>
      <button type="button" onClick={()=>window.location.assign(leavePlaygroundUrl())}>← Platform Studio</button>
    </div>}
  </aside>;
}
