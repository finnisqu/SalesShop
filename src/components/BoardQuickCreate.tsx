import {useId,useRef,useState,type FormEvent} from 'react';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {MobileSheetHandle} from './MobileSheetHandle';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {useCrmStore} from '../store/crmStore';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import {isOurCompany} from '../services/companyRelationship';
import {createPortal} from 'react-dom';
import './board-quick-create-mobile.css';

export interface BoardDealCreateDetails{
 companyId?:string;newCompanyName?:string;personIds:string[];newPeopleNames:string[];dueDate?:string;
}
/** Name-first Board creation with optional detail section; no navigation. */
export function BoardQuickCreate({kind,onCreate}:{
  kind:'Deal'|'Company'|'Account';
  onCreate:(name:string,details?:BoardDealCreateDetails)=>string|null|undefined|Promise<string|null|undefined>;
}) {
  const companies=useCrmStore(state=>state.companies);
  const people=useCrmStore(state=>state.contacts);
  const [open,setOpen]=useState(false);
  const [more,setMore]=useState(false),[saving,setSaving]=useState(false);
  const [companyId,setCompanyId]=useState(''),[newCompanyName,setNewCompanyName]=useState('');
  const [personIds,setPersonIds]=useState<string[]>([]),[newPeopleNames,setNewPeopleNames]=useState<string[]>([]);
  const [dueDate,setDueDate]=useState('');
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const trigger=useRef<HTMLButtonElement>(null);
  const inputId=useId();
  const reset=()=>{
    setOpen(false);setName('');setError('');setMore(false);
    setCompanyId('');setNewCompanyName('');setPersonIds([]);setNewPeopleNames([]);setDueDate('');
    trigger.current?.focus();
  };
  const close=()=>{if(!saving)reset();};
  useModalScrollLock(open);
  const sheetRef=useDismissibleLayer<HTMLFormElement>(open,()=>{if(!saving)close();});
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const clean=name.trim();if(!clean||saving)return;
    setSaving(true);setError('');
    try{
      const details:BoardDealCreateDetails={
        ...(companyId?{companyId}:{}),...(newCompanyName?{newCompanyName}:{}),
        personIds,newPeopleNames,...(dueDate?{dueDate}:{}),
      };
      const id=await onCreate(clean,kind==='Deal'&&more?details:undefined);
      if(!id){setError('This name could not be saved. Check for duplicates and try again.');return;}
      reset();
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to create the record.');}
    finally{setSaving(false);}
  };
  return <>
    <button type="button" ref={trigger} className="board-add-button"
      aria-haspopup="dialog" aria-expanded={open}
      onClick={()=>{setError('');setOpen(true);}}>+ {kind}</button>
    {open&&createPortal(
      <div className="board-create-backdrop ss-mobile-sheet-backdrop" onPointerDown={event=>{
        if(event.target===event.currentTarget)close();
      }}>
        <form ref={sheetRef} className="board-create-sheet ss-mobile-sheet" role="dialog" aria-modal="true"
          aria-label={'Quick create '+kind.toLowerCase()} onSubmit={event=>void submit(event)} aria-busy={saving}>
          <MobileSheetHandle onClose={close}/>
          <header>
            <div><small>BOARD · QUICK CREATE</small><h2>New {kind.toLowerCase()}</h2></div>
            <button type="button" onClick={close} disabled={saving} aria-label="Close quick create"
              autoFocus={typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches}>×</button>
          </header>
          <div className="board-create-fields ss-mobile-sheet-body">
            <label htmlFor={inputId}>{kind} name</label>
            <input id={inputId} className="board-create-name-input" disabled={saving}
              autoFocus={typeof window!=='undefined'&&window.matchMedia('(min-width:761px)').matches}
              data-dialog-initial-focus={typeof window!=='undefined'&&window.matchMedia('(min-width:761px)').matches?true:undefined}
              required value={name}
              onChange={event=>{setName(event.target.value);setError('');}}
              maxLength={180} placeholder={kind==='Deal'?'Name of the opportunity':'Company or account name'}/>
            {kind==='Deal'&&<>
              <button type="button" className="board-create-more" aria-expanded={more}
                onClick={()=>setMore(value=>!value)} disabled={saving}>
                More details <span aria-hidden="true">{more?'⌃':'⌄'}</span>
              </button>
              {more&&<div className="board-create-details" role="group" aria-label="New deal details">
                <div className="board-create-related">
                  <strong>Company</strong>
                  <div className="ss-record-association-current">
                    <span>{newCompanyName?'New · '+newCompanyName:
                      companies.find(c=>c.id===companyId)?.name||'No company selected'}</span>
                    {(companyId||newCompanyName)&&<button type="button" disabled={saving}
                      onClick={()=>{setCompanyId('');setNewCompanyName('');}}>Clear</button>}
                  </div>
                  <UnifiedRecordPicker kind="Company" triggerLabel="Search or create Company"
                    disabled={saving}
                    items={companies.filter(c=>!isOurOrgCompany(c)&&!isOurCompany(c))
                      .map(c=>({id:c.id,name:c.name,detail:c.aliases?.join(', ')}))}
                    onLink={id=>{setCompanyId(id);setNewCompanyName('');}}
                    onCreate={value=>{setCompanyId('');setNewCompanyName(value.trim());}}
                    helper="New Companies are created only after saving the Deal."/>
                </div>
                <div className="board-create-related">
                  <strong>People</strong>
                  <div className="board-create-chips">
                    {personIds.map(id=><button key={id} type="button" disabled={saving}
                      onClick={()=>setPersonIds(ids=>ids.filter(item=>item!==id))}>
                      {people.find(p=>p.id===id)?.name||'Person'} ×</button>)}
                    {newPeopleNames.map(name=><button key={name} type="button" disabled={saving}
                      onClick={()=>setNewPeopleNames(names=>names.filter(n=>n!==name))}>
                      New · {name} ×</button>)}
                  </div>
                  <UnifiedRecordPicker kind="Person" triggerLabel="Search or create Person"
                    disabled={saving}
                    items={people.filter(p=>!personIds.includes(p.id))
                      .map(p=>({id:p.id,name:p.name,detail:p.email||p.title}))}
                    onLink={id=>setPersonIds(ids=>ids.includes(id)?ids:[...ids,id])}
                    onCreate={name=>setNewPeopleNames(names=>
                      names.some(n=>n.toLowerCase()===name.toLowerCase())?names:[...names,name.trim()])}
                    helper="Select multiple People. New People are created only when you save."/>
                </div>
                <label htmlFor={inputId+'-date'}>Bid due date</label>
                <input type="date" id={inputId+'-date'} value={dueDate}
                  disabled={saving} onChange={event=>setDueDate(event.target.value)}/>
              </div>}
            </>}
            {error&&<p role="alert" className="board-create-error">{error}</p>}
          </div>
          <footer className="ss-mobile-sheet-actions">
            <button type="button" onClick={close} disabled={saving}>Cancel</button>
            <button type="submit" className="is-primary" disabled={!name.trim()||saving}>
              {saving?'Creating…':'Create '+kind.toLowerCase()}
            </button>
          </footer>
        </form>
      </div>,document.body)}
  </>;
}
