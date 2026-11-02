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
type GridKeyEvent={
 key:string;shiftKey:boolean;target:EventTarget|null;
 preventDefault:()=>void;
};
/** Called on the worksheet root, on the capture phase.
 * Tab and Enter commit the active input before focusing the next cell.
 * Arrow keys navigate display cells, not text within active inputs. */
export function handleQuickGridKey(event:GridKeyEvent,root:HTMLElement):void{
 const target=event.target;
 if(!(target instanceof HTMLElement))return;
 const editing=target.matches('input,textarea,[contenteditable="true"]');
 const direction:QuickGridDirection|undefined=
  event.key==='Tab'?(event.shiftKey?'previous':'next'):
  event.key==='Enter'&&editing?'down':
  !editing&&event.key==='ArrowRight'?'right':
  !editing&&event.key==='ArrowLeft'?'left':
  !editing&&event.key==='ArrowDown'?'down':
  !editing&&event.key==='ArrowUp'?'up':undefined;
 if(!direction)return;
 const rows=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-row]'));
 const controls=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'));
 const index=controls.findIndex(el=>el===target||el.contains(target));
 if(index<0)return; // Native keyboard behavior elsewhere in the table.
 const cells=controls.map(el=>{
  const row=el.closest<HTMLElement>('[data-quick-grid-row]');
  const cell=el.closest<HTMLElement>('.qqs-cell,.qqt-cell');
  return {row:rows.indexOf(row!),column:cell?Array.from(cell.parentElement?.children??[]).indexOf(cell):-1};
 });
 const next=nextQuickGridCell(cells,index,direction);
 if(next===null)return; // Let Tab leave the table naturally at the end.
 event.preventDefault();
 if(editing)target.blur(); // Triggers the normal commit or cancellation path.
 requestAnimationFrame(()=>{
  const updated=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-editable]'));
  // Re-evaluate after the edit has changed React's rendered buttons/inputs.
  const nextCell=cells[next];
  const activeRows=Array.from(root.querySelectorAll<HTMLElement>('[data-quick-grid-row]'));
  const selected=updated.find(el=>{
   const row=el.closest<HTMLElement>('[data-quick-grid-row]');
   const cell=el.closest<HTMLElement>('.qqs-cell,.qqt-cell');
   return activeRows.indexOf(row!)===nextCell.row
    &&(cell?Array.from(cell.parentElement?.children??[]).indexOf(cell):-1)===nextCell.column;
  });
  selected?.focus({preventScroll:false});
 });
}
