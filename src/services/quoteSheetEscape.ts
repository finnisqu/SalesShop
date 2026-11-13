/** Editable fields and nested Catalog pickers own their first Escape,
 * so a sheet should not close while its active child is canceling. */
export function quoteSheetEscapeShouldClose(
 event:Pick<KeyboardEvent,'key'|'defaultPrevented'|'target'>,
 insideSheet:boolean,
):boolean{
 if(event.key!=='Escape'||event.defaultPrevented||!insideSheet)return false;
 const target=event.target as Element|null;
 if(target&&typeof target.closest==='function'&&
  target.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],.qtl-combobox'))
  return false;
 return true;
}
