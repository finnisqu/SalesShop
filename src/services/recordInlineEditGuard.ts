/** Guard editable Record properties so one unsaved About-field draft cannot
 * be displaced by another editor. The guard belongs to a single Record page. */
export function createRecordInlineEditGuard(){
 let activeId:string|null=null;
 return {
  claim(id:string):boolean{
   if(!id||(activeId!==null&&activeId!==id))return false;
   activeId=id;
   return true;
  },
  release(id:string):boolean{
   if(activeId!==id)return false;
   activeId=null;
   return true;
  },
  get activeId(){return activeId;},
 };
}
