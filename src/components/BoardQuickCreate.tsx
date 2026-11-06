import {useId,useRef,useState,type FormEvent} from 'react';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {MobileSheetHandle} from './MobileSheetHandle';
import {createPortal} from 'react-dom';
import './board-quick-create-mobile.css';

/** Name-only creation on the Board: do not navigate away or open a full editor.
 * Details can be completed later from the existing record preview. */
export function BoardQuickCreate({kind,onCreate}:{
  kind:'Deal'|'Account';
  onCreate:(name:string)=>string|null|undefined;
}) {
  const [open,setOpen]=useState(false);
  const [name,setName]=useState('');
  const [error,setError]=useState('');
  const trigger=useRef<HTMLButtonElement>(null);
  const inputId=useId();
  useModalScrollLock(open);
  const sheetRef=useDismissibleLayer<HTMLFormElement>(open,()=>close());
  const close=()=>{
    setOpen(false);setName('');setError('');
    trigger.current?.focus();
  };
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const clean=name.trim();
    if(!clean)return;
    try{
      const id=onCreate(clean);
      if(!id){setError('This name could not be saved. Check for duplicates and try again.');return;}
      close();
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Unable to create the record.');
    }
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
          aria-label={'Quick create '+kind.toLowerCase()} onSubmit={submit}
          >
          <MobileSheetHandle onClose={close}/>
          <header>
            <div><small>BOARD · QUICK CREATE</small><h2>New {kind.toLowerCase()}</h2></div>
            <button type="button" onClick={close} aria-label="Close quick create"
              autoFocus={typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches}>×</button>
          </header>
          <label htmlFor={inputId}>{kind} name</label>
          <input id={inputId}
            autoFocus={typeof window!=='undefined'&&window.matchMedia('(min-width:761px)').matches}
            required value={name}
            onChange={event=>{setName(event.target.value);setError('');}}
            maxLength={180} placeholder={kind==='Deal'?'Name of the opportunity':'Company or account name'}/>
          {error&&<p role="alert">{error}</p>}
          <footer>
            <button type="button" onClick={close}>Cancel</button>
            <button type="submit" className="is-primary" disabled={!name.trim()}>
              Create {kind.toLowerCase()}
            </button>
          </footer>
        </form>
      </div>,document.body)}
  </>;
}
