/** An Activity edit belongs to one account/workspace/Activity draft key.
 * Reusing a mounted inspector must never write old fields under the new key. */
export function activityEditorCanUseDraft(
 editing:boolean,
 originKey:string|null,
 currentKey:string|null,
 canEdit:boolean,
):boolean{
 return editing&&Boolean(currentKey)&&originKey===currentKey&&canEdit;
}
