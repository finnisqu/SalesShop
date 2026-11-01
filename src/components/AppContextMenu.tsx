import {useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type MouseEvent as ReactMouseEvent} from 'react';
import {createPortal} from 'react-dom';
import './app-context-menu.css';

export interface AppContextAction {
  label:string;
  onSelect:()=>void;
  disabled?:boolean;
  destructive?:boolean;
  dividerBefore?:boolean;
}
interface MenuState {x:number;y:number;title:string;actions:AppContextAction[];}
const MENU_WIDTH=226;
/** Context actions are optional shortcuts to *existing* flows.
 * Only callers with useful actions override native right click. */
export function useAppContextMenu(){
  const [state,setState]=useState<MenuState|null>(null);
  const hostRef=useRef<HTMLDivElement>(null);
  const lastTriggerRef=useRef<HTMLElement|null>(null);
  const open=(x:number,y:number,title:string,actions:AppContextAction[],target:HTMLElement)=>{
    if(!actions.length)return;
    lastTriggerRef.current=target;
    setState({
      x:Math.max(8,Math.min(x,window.innerWidth-MENU_WIDTH-8)),
      y:Math.max(8,Math.min(y,window.innerHeight-Math.min(380,actions.length*39+54)-8)),
      title,actions,
    });
  };
  const openDirect=(x:number,y:number,title:string,actions:AppContextAction[],element:HTMLElement)=>{
    if(actions.length)open(x,y,title,actions,element);
  };
  const openPointer=(event:ReactMouseEvent<HTMLElement>,title:string,actions:AppContextAction[])=>{
    if(!actions.length)return;
    const target=event.target;
    if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable="true"],a[href]'))return;
    event.preventDefault();
    event.stopPropagation();
    open(event.clientX,event.clientY,title,actions,event.currentTarget);
  };
  const openKeyboard=(event:ReactKeyboardEvent<HTMLElement>,title:string,actions:AppContextAction[])=>{
    if(event.key!=='ContextMenu'&&!(event.shiftKey&&event.key==='F10'))return;
    if(!actions.length)return;
    event.preventDefault();event.stopPropagation();
    const rect=event.currentTarget.getBoundingClientRect();
    open(rect.left+Math.min(32,rect.width/2),rect.top+Math.min(34,rect.height),title,actions,event.currentTarget);
  };
  useEffect(()=>{
    if(!state)return;
    hostRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dismiss=(event:PointerEvent)=>{
      if(!hostRef.current?.contains(event.target as Node))setState(null);
    };
    const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setState(null);lastTriggerRef.current?.focus();}};
    const scroll=()=>setState(null);
    const resize=()=>setState(null);
    document.addEventListener('pointerdown',dismiss,true);
    document.addEventListener('keydown',keydown,true);
    window.addEventListener('resize',resize);
    window.addEventListener('scroll',scroll,true);
    return ()=>{
      document.removeEventListener('pointerdown',dismiss,true);
      document.removeEventListener('keydown',keydown,true);
      window.removeEventListener('resize',resize);
      window.removeEventListener('scroll',scroll,true);
    };
  },[state]);
  const menu=state&&typeof document!=='undefined'
    ?createPortal(<div ref={hostRef} className="ss-app-context-menu" role="menu"
      aria-label={state.title} style={{left:state.x,top:state.y,width:MENU_WIDTH}}
      onContextMenu={event=>event.preventDefault()}
      onKeyDown={event=>{
        if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
        event.preventDefault();
        const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        if(!buttons.length)return;
        const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
        const increment=event.key==='ArrowDown'?1:-1;
        buttons[(current+increment+buttons.length)%buttons.length]?.focus();
      }}>
      <div className="ss-app-context-menu-title">{state.title}</div>
      {state.actions.map((action,i)=><button key={i} type="button" role="menuitem"
        disabled={action.disabled}
        className={(action.destructive?'is-destructive':'')+(action.dividerBefore?' has-divider':'')}
        onClick={()=>{setState(null);action.onSelect();}}>
        {action.label}
      </button>)}
    </div>,document.body):null;
  return {openPointer,openDirect,openKeyboard,close:()=>setState(null),menu};
}
