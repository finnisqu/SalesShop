import {useId,useRef,useState,type FormEvent} from 'react';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {MobileSheetHandle} from './MobileSheetHandle';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {useCrmStore} from '../store/crmStore';
import {useNavigationStore} from '../store/navigationStore';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import {isOurCompany} from '../services/companyRelationship';
import {recordNameKey} from '../services/recordNameKey';
import {createPortal} from 'react-dom';
import './board-quick-create-mobile.css';

export interface BoardDealCreateDetails{
 companyId?:string;newCompanyName?:string;personIds:string[];newPeopleNames:string[];dueDate?:string;
}
/** A Deal may be created before an optional Company/Person link fails. Keep
 * that record's ID so the UI cannot accidentally create a duplicate on retry. */
export interface BoardPartialCreate{
 id:string;warning:string;
}
type BoardCreateOutcome=string|null|undefined|BoardPartialCreate;
/** Name-first Board creation with optional details; navigation only for
 * explicit recovery of a record already created with partial links. */
export function BoardQuickCreate({kind,onCreate}:{
  kind:'Deal'|'Company'|'Account';
  onCreate:(name:string,details?:BoardDealCreateDetails)=>BoardCreateOutcome|Promise<BoardCreateOutcome>;
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
  const [pendingCreated,setPendingCreated]=useState<string|null>(null);
  const openProject=useNavigationStore(state=>state.openProject);
  const openCompany=useNavigationStore(state=>state.openCompany);
  const savingRef=useRef(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const inputId=useId();
  const reset=()=>{
    setOpen(false);setName('');setError('');setMore(false);
    setCompanyId('');setNewCompanyName('');setPersonIds([]);setNewPeopleNames([]);setDueDate('');
    setPendingCreated(null);trigger.current?.focus();
  };
  const close=()=>{if(!savingRef.current)reset();};
  const openPendingCreated=()=>{
    if(!pendingCreated)return;
    const id=pendingCreated;
    reset();
    if(kind==='Deal')openProject(id);
    else openCompany(id);
  };
  useModalScrollLock(open);
  const sheetRef=useDismissibleLayer<HTMLFormElement>(open,close);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const clean=name.trim();if(!clean||savingRef.current||pendingCreated)return;
    // Block a second Enter or click before React paints the disabled button.
    savingRef.current=true;setSaving(true);setError('');
    try{
      const details:BoardDealCreateDetails={
        ...(companyId?{companyId}:{}),...(newCompanyName?{newCompanyName}:{}),
        personIds,newPeopleNames,...(dueDate?{dueDate}:{}),
      };
      const result=await onCreate(clean,kind==='Deal'&&more?details:undefined);
      if(!result){setError('This name could not be saved. Check for duplicates and try again.');return;}
      if(typeof result==='object'){
        setPendingCreated(result.id);
        setError(result.warning);
        return;
      }
      reset();
    }catch(reason){setError(reason instanceof Error?reason.message:'Unable to create the record.');}
    finally{savingRef.current=false;setSaving(false);}
  };
  return <>
    <button type="button" ref={trigger} className="board-add-button"
      aria-haspopup="dialog" aria-expanded={open}
      onClick={()=>{setError('');setPendingCreated(null);setOpen(true);}}>+ {kind}</button>
    {open&&createPortal(
      <div className="board-create-backdrop ss-mobile-sheet-backdrop" onPointerDown={event=>{
        if(event.target===event.currentTarget)close();
      }}>
        <form ref={sheetRef} className="board-create-sheet ss-mobile-sheet" role="dialog" aria-modal="true"
          aria-label={'Quick create '+kind.toLowerCase()} onSubmit={event=>void submit(event)} aria-busy={saving}>
          <MobileSheetHandle onClose={close} disabled={saving}/>
          <header>
            <div><small>BOARD · QUICK CREATE</small><h2>New {kind.toLowerCase()}</h2></div>
            <button type="button" onClick={close} disabled={saving} aria-label="Close quick create"
              autoFocus={typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches}>×</button>
          </header>
          <div className="board-create-fields ss-mobile-sheet-body">
            <label htmlFor={inputId}>{kind} name</label>
            <input id={inputId} className="board-create-name-input" disabled={saving||Boolean(pendingCreated)}
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
                    items={people.map(p=>({id:p.id,name:p.name,
                      detail:personIds.includes(p.id)?'Already selected':p.email||p.title}))}
                    onLink={id=>setPersonIds(ids=>ids.includes(id)?ids:[...ids,id])}
                    onCreate={value=>{
                      const clean=value.trim();
                      const existing=people.find(p=>recordNameKey(p.name)===recordNameKey(clean));
                      if(existing)
                        throw new Error(personIds.includes(existing.id)
                          ?'This Person is already selected.'
                          :'This Person already exists. Select them above.');
                      if(newPeopleNames.some(n=>recordNameKey(n)===recordNameKey(clean)))
                        throw new Error('This Person is already in the pending selection.');
                      setNewPeopleNames(names=>[...names,clean]);
                    }}
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
            {pendingCreated?
              <button type="button" className="is-primary" onClick={openPendingCreated}>
                Open created {kind.toLowerCase()}
              </button>:
              <button type="submit" className="is-primary" disabled={!name.trim()||saving}>
                {saving?'Creating…':'Create '+kind.toLowerCase()}
              </button>}
          </footer>
        </form>
      </div>,document.body)}
  </>;
}
