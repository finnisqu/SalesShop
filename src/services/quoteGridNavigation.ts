/**
 * Pure keyboard navigation for the two Quick Quote worksheets.
 * The DOM adapter uses cell coordinates so arrows never jump into a pencil,
 * delete button or read-only calculated value.
 */
export interface QuickGridCell {row:number;column:number;}
export type QuickGridDirection='next'|'previous'|'left'|'right'|'up'|'down';
export function nextQuickGridCell(cells:readonly QuickGridCell[],
 currentIndex:number,direction:QuickGridDirection):number|null{
 const here=cells[currentIndex];
 if(!here)return null;
 if(direction==='next')return currentIndex+1<cells.length?currentIndex+1:null;
 if(direction==='previous')return currentIndex>0?currentIndex-1:null;
 const horizontal=direction==='left'||direction==='right';
 const choices=cells.map((cell,index)=>({...cell,index})).filter(cell=>{
  if(cell.index===currentIndex)return false;
  return horizontal?cell.row===here.row&&(direction==='right'?cell.column>here.column:cell.column<here.column)
   :direction==='down'?cell.row>here.row:cell.row<here.row;
 });
 choices.sort((a,b)=>horizontal
  ?Math.abs(a.column-here.column)-Math.abs(b.column-here.column)
  :Math.abs(a.row-here.row)-Math.abs(b.row-here.row)
   ||Math.abs(a.column-here.column)-Math.abs(b.column-here.column));
 return choices[0]?.index??null;
}
/** Only visible, enabled cells participate in spreadsheet navigation.
 * Mobile Areas intentionally collapse some desktop columns; these hidden
 * buttons must not steal Prev/Next or keyboard focus. */
export function quickGridControlIsNavigable(control:HTMLElement):boolean{
 if(control.getClientRects().length===0||
    control.matches(':disabled,[aria-disabled="true"],[readonly]')||
    control.closest('[inert],[hidden],[aria-hidden="true"],[aria-disabled="true"]'))
  return false;
 // visibility:hidden can still report a nonempty DOMRect. Do not send a
 // phone keyboard to an invisible column or temporarily hidden editor.
 const view=control.ownerDocument?.defaultView;
 return !view||!['hidden','collapse'].includes(view.getComputedStyle(control).visibility);
}

/** The mobile keyboard toolbar shares the same filter as Tab/Enter. Its
 * disabled Prev/Next buttons must never include collapsed desktop columns. */
export function quickGridLinearNeighborAvailable(
 root:HTMLElement,from:HTMLElement,direction:'previous'|'next',
):boolean{
 const controls=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'))
  .filter(quickGridControlIsNavigable);
 const index=controls.findIndex(el=>el===from||el.contains(from));
 return index>=0&&(direction==='previous'?index>0:index<controls.length-1);
}

/** Navigate by stable row/column identity, even when React exchanges an
 * editable cell's input for its resting button after a blur/commit.
 * activate=true is used by the mobile keyboard accessory: it opens the next
 * editable button rather than leaving the user to tap it again. */
export function moveQuickGridFocus(root:HTMLElement,from:HTMLElement,
 direction:QuickGridDirection,activate=false):boolean{
 const rows=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-row]'));
 const controls=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'))
  .filter(quickGridControlIsNavigable);
 const index=controls.findIndex(el=>el===from||el.contains(from));
 if(index<0)return false;
 const coordinate=(el:HTMLElement):QuickGridCell=>{
  const row=el.closest<HTMLElement>('[data-quick-grid-row]');
  const cell=el.closest<HTMLElement>('.qqs-cell,.qqt-cell');
  return {row:rows.indexOf(row!),column:cell?
   Array.from(cell.parentElement?.children??[]).indexOf(cell):-1};
 };
 const cells=controls.map(coordinate);
 const next=nextQuickGridCell(cells,index,direction);
 if(next===null)return false;
 const target=cells[next];
 // An iPhone only opens its software keyboard reliably when the next edit
 // begins synchronously inside the user's tap. The next resting button
 // already exists, so activate it before allowing React to replace cells.
 const immediate=controls[next];
 if(activate&&immediate instanceof HTMLButtonElement){
  immediate.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  immediate.click();
  return true;
 }
 if(from.matches('input,textarea,[contenteditable="true"]'))from.blur();
 requestAnimationFrame(()=>{
  const updated=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'))
   .filter(quickGridControlIsNavigable);
  const currentRows=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-row]'));
  const nextControl=updated.find(el=>{
   const row=el.closest<HTMLElement>('[data-quick-grid-row]');
   const cell=el.closest<HTMLElement>('.qqs-cell,.qqt-cell');
   return currentRows.indexOf(row!)===target.row
    &&(cell?Array.from(cell.parentElement?.children??[]).indexOf(cell):-1)===target.column;
  });
  if(!nextControl)return;
  // Keep the target visible within the quotation's scrollable worksheet,
  // without jumping back to the top or sideways to an unrelated column.
  nextControl.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  if(activate&&nextControl instanceof HTMLButtonElement)nextControl.click();
  else nextControl.focus({preventScroll:true});
 });
 return true;
}

type GridKeyEvent={
 key:string;shiftKey:boolean;ctrlKey:boolean;metaKey:boolean;
 altKey?:boolean;isComposing?:boolean;target:EventTarget|null;
 preventDefault:()=>void;
};
/** Only one-line spreadsheet inputs use Enter for navigation.
 * Shift+Enter travels backward, while multiline editors, IME composition
 * and browser modifier shortcuts keep their native keyboard behavior. */
export function quickGridKeyDirection(
 event:Pick<GridKeyEvent,'key'|'shiftKey'|'ctrlKey'|'metaKey'|'altKey'|'isComposing'>,
 editing:boolean,singleLineInput:boolean,
):QuickGridDirection|undefined{
 if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return undefined;
 if(event.key==='Tab')return event.shiftKey?'previous':'next';
 if(event.key==='Enter')return editing&&singleLineInput
  ?(event.shiftKey?'previous':'next'):undefined;
 if(editing)return undefined;
 if(event.key==='ArrowRight')return 'right';
 if(event.key==='ArrowLeft')return 'left';
 if(event.key==='ArrowDown')return 'down';
 if(event.key==='ArrowUp')return 'up';
 return undefined;
}
/** Called on the worksheet root, on the capture phase.
 * Tab and Enter commit the active input before focusing the next editable cell.
 * Arrow keys navigate display cells, not text within active inputs. */
export function handleQuickGridKey(event:GridKeyEvent,root:HTMLElement):void{
 const target=event.target;
 if(!(target instanceof HTMLElement))return;
 const editing=target.matches('input,textarea,[contenteditable="true"]');
 // Copy the focused display value without needing to highlight the text.
 // Native copy still applies inside text inputs and on browsers without Clipboard API.
 if(!editing&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c'
   &&target.hasAttribute('data-quick-grid-editable')
   &&typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
  const text=target.textContent?.trim();
  if(text){
   event.preventDefault();
   void navigator.clipboard.writeText(text).catch(()=>{});
  }
  return;
 }
 const direction=quickGridKeyDirection(event,editing,target.matches('input'));
 if(!direction)return;
 if(moveQuickGridFocus(root,target,direction,editing&&event.key==='Enter'))event.preventDefault();
}
