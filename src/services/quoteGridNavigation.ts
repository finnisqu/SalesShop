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
/** Navigate by stable row/column identity, even when React exchanges an
 * editable cell's input for its resting button after a blur/commit.
 * activate=true is used by the mobile keyboard accessory: it opens the next
 * editable button rather than leaving the user to tap it again. */
export function moveQuickGridFocus(root:HTMLElement,from:HTMLElement,
 direction:QuickGridDirection,activate=false):boolean{
 const rows=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-row]'));
 const controls=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'));
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
  const updated=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'));
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
 key:string;shiftKey:boolean;ctrlKey:boolean;metaKey:boolean;target:EventTarget|null;
 preventDefault:()=>void;
};
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
 const direction:QuickGridDirection|undefined=
  event.key==='Tab'?(event.shiftKey?'previous':'next'):
  event.key==='Enter'&&editing?'next':
  !editing&&event.key==='ArrowRight'?'right':
  !editing&&event.key==='ArrowLeft'?'left':
  !editing&&event.key==='ArrowDown'?'down':
  !editing&&event.key==='ArrowUp'?'up':undefined;
 if(!direction)return;
 if(moveQuickGridFocus(root,target,direction,editing&&event.key==='Enter'))event.preventDefault();
}
